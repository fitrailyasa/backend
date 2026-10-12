package httpapi

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/backend-starter/go/internal/config"
	"github.com/backend-starter/go/internal/model"
	"github.com/backend-starter/go/internal/security"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type fieldErrors map[string][]string

type appError struct {
	status  int
	message string
	errors  fieldErrors
}

func (e *appError) Error() string { return e.message }

type principal struct {
	User model.User
	JTI  string
	Exp  int64
}

type pageQuery struct {
	Page   int
	Limit  int
	Offset int
	Sort   string
	Dir    string
}

type hit struct {
	count   int
	resetAt int64
}

type Server struct {
	cfg          config.Config
	db           *gorm.DB
	engine       *gin.Engine
	started      time.Time
	mu           sync.Mutex
	revoked      map[string]int64
	hits         map[string]hit
	globalHits   map[string]hit
	loginLimiter *security.LoginLimiter
	dummyHash    string
	rateSkip     bool
}

func New(cfg config.Config, db *gorm.DB) *Server {
	gin.SetMode(gin.ReleaseMode)
	if cfg.Env == "test" || cfg.Env == "development" {
		gin.SetMode(gin.TestMode)
	}
	s := &Server{
		cfg:        cfg,
		db:         db,
		started:    time.Now(),
		revoked:    map[string]int64{},
		hits:       map[string]hit{},
		globalHits: map[string]hit{},
		loginLimiter: security.NewLoginLimiter(security.LoginLimits{
			EmailMax:    cfg.LoginRateMax,
			EmailWindow: time.Duration(cfg.LoginRateWindowMS) * time.Millisecond,
			IPMax:       cfg.LoginIPRateMax,
			IPWindow:    time.Duration(cfg.LoginIPRateWindowMS) * time.Millisecond,
		}),
		// The global rate limiter never runs inside a test binary unless a
		// test opts in explicitly by clearing rateSkip, so suites do not flake.
		rateSkip: cfg.Env == "test" || testing.Testing(),
	}
	// A fixed bcrypt hash lets login spend comparable time when the email is
	// unknown, so response timing does not reveal which accounts exist.
	if dummy, err := bcrypt.GenerateFromPassword([]byte("dummy-password"), bcryptCost(cfg.BcryptRounds)); err == nil {
		s.dummyHash = string(dummy)
	}
	s.engine = s.routes()
	return s
}

func (s *Server) Run(addr string) error {
	httpServer := &http.Server{
		Addr:              addr,
		Handler:           s.engine,
		ReadHeaderTimeout: 10 * time.Second,
	}
	return httpServer.ListenAndServe()
}

func (s *Server) routes() *gin.Engine {
	r := gin.New()
	// TRUST_PROXY decides whether X-Forwarded-For may stand in for the client
	// IP that every rate limiter keys on. Off by default so the limit cannot
	// be spoofed by an untrusted client.
	if s.cfg.TrustProxy {
		_ = r.SetTrustedProxies([]string{"0.0.0.0/0", "::/0"})
	} else {
		_ = r.SetTrustedProxies(nil)
	}
	r.Use(s.recover, s.secureHeaders, s.cors, s.limitBody, s.limitGlobal)
	r.GET("/health", s.health)

	api := r.Group(s.cfg.Prefix)
	api.GET("", s.index)
	api.GET("/docs", s.docsPage)
	api.GET("/docs/", s.docsPage)
	api.GET("/docs.json", s.docsJSON)

	auth := api.Group("/auth")
	auth.POST("/register", s.limitAuth, s.register)
	auth.POST("/login", s.limitAuth, s.login)
	auth.POST("/refresh", s.limitAuth, s.refresh)
	auth.POST("/logout", s.authenticate, s.logout)
	auth.GET("/me", s.authenticate, s.me)

	users := api.Group("/users")
	users.GET("", s.authenticate, s.admin, s.listUsers)
	users.POST("", s.authenticate, s.admin, s.createUser)
	users.GET("/me", s.authenticate, s.profile)
	users.PATCH("/me", s.authenticate, s.updateProfile)
	users.GET("/:id", s.authenticate, s.admin, s.getUser)
	users.PUT("/:id", s.authenticate, s.admin, s.replaceUser)
	users.PATCH("/:id", s.authenticate, s.admin, s.patchUser)
	users.DELETE("/:id", s.authenticate, s.admin, s.deleteUser)

	categories := api.Group("/categories")
	categories.GET("", s.listCategories)
	categories.GET("/:id", s.getCategory)
	categories.POST("", s.authenticate, s.admin, s.createCategory)
	categories.PUT("/:id", s.authenticate, s.admin, s.replaceCategory)
	categories.PATCH("/:id", s.authenticate, s.admin, s.patchCategory)
	categories.DELETE("/:id", s.authenticate, s.admin, s.deleteCategory)

	products := api.Group("/products")
	products.GET("", s.listProducts)
	products.GET("/:id/comments", s.listProductComments)
	products.POST("/:id/comments", s.authenticate, s.createComment)
	products.GET("/:id", s.getProduct)
	products.POST("", s.authenticate, s.admin, s.createProduct)
	products.PUT("/:id", s.authenticate, s.admin, s.replaceProduct)
	products.PATCH("/:id", s.authenticate, s.admin, s.patchProduct)
	products.DELETE("/:id", s.authenticate, s.admin, s.deleteProduct)

	tags := api.Group("/tags")
	tags.GET("", s.listTags)
	tags.GET("/:id", s.getTag)
	tags.POST("", s.authenticate, s.admin, s.createTag)
	tags.PUT("/:id", s.authenticate, s.admin, s.replaceTag)
	tags.PATCH("/:id", s.authenticate, s.admin, s.patchTag)
	tags.DELETE("/:id", s.authenticate, s.admin, s.deleteTag)

	orders := api.Group("/orders", s.authenticate)
	orders.GET("", s.listOrders)
	orders.POST("", s.createOrder)
	orders.GET("/:id", s.getOrder)
	orders.PATCH("/:id/status", s.updateOrderStatus)
	orders.DELETE("/:id", s.admin, s.deleteOrder)

	comments := api.Group("/comments")
	comments.GET("", s.listComments)
	comments.PATCH("/:id", s.authenticate, s.updateComment)
	comments.DELETE("/:id", s.authenticate, s.deleteComment)

	r.NoRoute(func(c *gin.Context) {
		s.fail(c, http.StatusNotFound, fmt.Sprintf("Route %s %s not found", c.Request.Method, c.Request.URL.Path), nil)
	})
	return r
}

func (s *Server) recover(c *gin.Context) {
	defer func() {
		if rec := recover(); rec != nil {
			s.fail(c, http.StatusInternalServerError, "Internal server error", nil)
			c.Abort()
		}
	}()
	c.Next()
}

// docsCSP is the only relaxation of the API's default-src 'none' policy: the
// Swagger UI page served by this app loads its assets from cdn.jsdelivr.net
// and is documented in go/README.md.
const docsCSP = "default-src 'self'; script-src 'unsafe-inline' https://cdn.jsdelivr.net; style-src https://cdn.jsdelivr.net; font-src https://cdn.jsdelivr.net; img-src 'self' data:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'"

// secureHeaders stamps the hardening headers on every response and strips
// framework fingerprints such as Server.
func (s *Server) secureHeaders(c *gin.Context) {
	header := c.Writer.Header()
	header.Set("X-Content-Type-Options", "nosniff")
	header.Set("X-Frame-Options", "DENY")
	header.Set("Referrer-Policy", "no-referrer")
	header.Set("Cross-Origin-Opener-Policy", "same-origin")
	header.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
	header.Set("Content-Security-Policy", "default-src 'none'")
	header.Del("Server")
	if s.cfg.EnableHSTS && s.requestSecure(c) {
		header.Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
	}
	c.Next()
	header.Del("Server")
}

// requestSecure reports whether the request arrived over HTTPS, honouring
// X-Forwarded-Proto only when the proxy in front of us is trusted.
func (s *Server) requestSecure(c *gin.Context) bool {
	if c.Request.TLS != nil {
		return true
	}
	return s.cfg.TrustProxy && strings.EqualFold(c.GetHeader("X-Forwarded-Proto"), "https")
}

// cors reflects only origins from the CORS allowlist, never `*` together with
// credentials, and always marks responses as origin dependent.
func (s *Server) cors(c *gin.Context) {
	requestOrigin := c.GetHeader("Origin")
	allowed := ""
	if requestOrigin != "" {
		switch {
		case s.corsAllowsAny():
			allowed = "*"
		case s.corsAllowed(requestOrigin):
			allowed = requestOrigin
		}
	}
	c.Header("Vary", "Origin")
	if allowed != "" {
		c.Header("Access-Control-Allow-Origin", allowed)
		c.Header("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Request-Id")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		c.Header("Access-Control-Max-Age", "600")
		if allowed != "*" {
			c.Header("Access-Control-Allow-Credentials", "true")
		}
	}
	if c.Request.Method == http.MethodOptions {
		c.AbortWithStatus(http.StatusNoContent)
		return
	}
	c.Next()
}

func (s *Server) corsAllowsAny() bool {
	return contains(s.corsOriginList(), "*")
}

func (s *Server) corsAllowed(origin string) bool {
	return contains(s.corsOriginList(), origin)
}

func (s *Server) corsOriginList() []string {
	items := strings.Split(s.cfg.CORSOrigin, ",")
	origins := make([]string, 0, len(items))
	for _, item := range items {
		if trimmed := strings.TrimSpace(item); trimmed != "" {
			origins = append(origins, trimmed)
		}
	}
	return origins
}

func (s *Server) limitBody(c *gin.Context) {
	if c.Request.Body != nil {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, s.cfg.BodyLimit)
	}
	c.Next()
}

// rateLimitActive reports whether request counting is on. Counting is skipped
// in test binaries and under APP_ENV=test so suites never flake.
func (s *Server) rateLimitActive() bool {
	return !s.rateSkip && s.cfg.RateEnabled && s.cfg.RateMax > 0
}

// rateLimitExempt keeps liveness probes and the route index out of the global
// counter, as required by _SECURITY_SPEC.md section 2.
func rateLimitExempt(path, prefix string) bool {
	return path == "/health" || path == prefix || path == strings.TrimSuffix(prefix, "/")+"/"
}

// limitGlobal counts every request per client IP at 300/60s by default.
func (s *Server) limitGlobal(c *gin.Context) {
	if !s.rateLimitActive() || rateLimitExempt(c.Request.URL.Path, s.cfg.Prefix) {
		c.Next()
		return
	}
	if !s.track(s.globalHits, c, s.cfg.RateMax, s.cfg.RateWindowMS) {
		s.fail(c, http.StatusTooManyRequests, "Too many requests, please try again later", nil)
		c.Abort()
		return
	}
	c.Next()
}

// limitAuth keeps the extra per-IP limiter that register/login/refresh had
// before the global limiter existed.
func (s *Server) limitAuth(c *gin.Context) {
	if !s.rateLimitActive() {
		c.Next()
		return
	}
	if !s.track(s.hits, c, s.cfg.RateMax, s.cfg.RateWindowMS) {
		s.fail(c, http.StatusTooManyRequests, "Too many requests, please try again later", nil)
		c.Abort()
		return
	}
	c.Next()
}

// track counts one request against the client IP in the given store, writes
// the X-RateLimit-* headers and reports whether the caller is still within
// the limit. When it is not, Retry-After is set as well.
func (s *Server) track(store map[string]hit, c *gin.Context, max, windowMS int) bool {
	now := time.Now().UnixMilli()
	key := c.ClientIP()
	s.mu.Lock()
	entry, ok := store[key]
	if !ok || entry.resetAt <= now {
		entry = hit{count: 1, resetAt: now + int64(windowMS)}
	} else {
		entry.count++
	}
	store[key] = entry
	if len(store) > 5000 {
		for id, value := range store {
			if value.resetAt <= now {
				delete(store, id)
			}
		}
	}
	s.mu.Unlock()

	remaining := max - entry.count
	if remaining < 0 {
		remaining = 0
	}
	c.Header("X-RateLimit-Limit", strconv.Itoa(max))
	c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
	c.Header("X-RateLimit-Reset", strconv.FormatInt((entry.resetAt+999)/1000, 10))
	if entry.count > max {
		retry := (entry.resetAt - now + 999) / 1000
		if retry < 1 {
			retry = 1
		}
		c.Header("Retry-After", strconv.FormatInt(retry, 10))
		return false
	}
	return true
}

func (s *Server) authenticate(c *gin.Context) {
	token := bearer(c.GetHeader("Authorization"))
	if token == "" {
		s.fail(c, http.StatusUnauthorized, "Authentication token is missing", nil)
		c.Abort()
		return
	}
	claims, err := s.parseToken(token, "access", s.cfg.AccessSecret)
	if err != nil {
		s.fail(c, http.StatusUnauthorized, authMessage(err), nil)
		c.Abort()
		return
	}
	if s.isRevoked(claims.jti) {
		s.fail(c, http.StatusUnauthorized, "Token has been revoked", nil)
		c.Abort()
		return
	}
	var user model.User
	if err := s.db.First(&user, claims.sub).Error; err != nil {
		s.fail(c, http.StatusUnauthorized, "Token is invalid", nil)
		c.Abort()
		return
	}
	c.Set("principal", principal{User: user, JTI: claims.jti, Exp: claims.exp})
	c.Next()
}

func (s *Server) admin(c *gin.Context) {
	user := current(c)
	if user.Role != "admin" {
		s.fail(c, http.StatusForbidden, "This action is unauthorized", nil)
		c.Abort()
		return
	}
	c.Next()
}

func current(c *gin.Context) model.User {
	value, _ := c.Get("principal")
	principal, _ := value.(principal)
	return principal.User
}

func currentAuth(c *gin.Context) principal {
	value, _ := c.Get("principal")
	principal, _ := value.(principal)
	return principal
}

func (s *Server) ok(c *gin.Context, message string, data any) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": message, "data": data})
}

func (s *Server) created(c *gin.Context, message string, data any) {
	c.JSON(http.StatusCreated, gin.H{"success": true, "message": message, "data": data})
}

func (s *Server) pageOK(c *gin.Context, message string, data any, meta gin.H) {
	c.JSON(http.StatusOK, gin.H{"success": true, "message": message, "data": data, "meta": meta})
}

func (s *Server) fail(c *gin.Context, status int, message string, errs fieldErrors) {
	body := gin.H{"success": false, "message": message}
	if status == http.StatusUnprocessableEntity && len(errs) > 0 {
		body["errors"] = errs
	} else if len(errs) > 0 && status < 500 {
		body["errors"] = errs
	}
	c.JSON(status, body)
}

func (s *Server) validation(c *gin.Context, errs fieldErrors) {
	s.fail(c, http.StatusUnprocessableEntity, "Validation failed", errs)
}

func (s *Server) writeErr(c *gin.Context, err error) {
	var app *appError
	if errors.As(err, &app) {
		s.fail(c, app.status, app.message, app.errors)
		return
	}
	if isReference(err) {
		s.fail(c, http.StatusConflict, "Resource is still referenced by other records", nil)
		return
	}
	s.fail(c, http.StatusInternalServerError, "Internal server error", nil)
}

func isReference(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "foreign key") || strings.Contains(msg, "1451") || strings.Contains(msg, "constraint failed")
}

func (s *Server) health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"uptime":    time.Since(s.started).Seconds(),
		"timestamp": time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func (s *Server) index(c *gin.Context) {
	s.ok(c, "API index retrieved", gin.H{
		"name":          "backend-starter-go",
		"version":       "1.0.0",
		"prefix":        s.cfg.Prefix,
		"documentation": s.cfg.Prefix + "/docs",
		"base_url":      s.cfg.BaseURL,
		"endpoints":     routeIndex(),
	})
}

func (s *Server) docsJSON(c *gin.Context) {
	raw, err := os.ReadFile(openAPIPath())
	if err != nil {
		s.fail(c, http.StatusInternalServerError, "Internal server error", nil)
		return
	}
	c.Data(http.StatusOK, "application/json; charset=utf-8", raw)
}

func (s *Server) docsPage(c *gin.Context) {
	// The JSON API ships default-src 'none'; the Swagger UI is the one page
	// this app serves itself, so it gets a policy scoped to the assets it
	// genuinely loads (noted in go/README.md).
	c.Header("Content-Security-Policy", docsCSP)
	c.Data(http.StatusOK, "text/html; charset=utf-8", []byte(docsHTML))
}

const docsHTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Backend Starter Kit API - Go</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.21.0/swagger-ui.css" />
</head>
<body>
<div id="swagger-ui"></div>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.21.0/swagger-ui-bundle.js"></script>
<script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.21.0/swagger-ui-standalone-preset.js"></script>
<script>
window.ui = SwaggerUIBundle({
  url: "/api/v1/docs.json",
  dom_id: "#swagger-ui",
  persistAuthorization: true,
  docExpansion: "list",
  deepLinking: true,
  presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
  layout: "StandaloneLayout"
});
</script>
</body>
</html>`

func openAPIPath() string {
	if value := os.Getenv("OPENAPI_PATH"); value != "" {
		return value
	}
	starts := []string{}
	if wd, err := os.Getwd(); err == nil {
		starts = append(starts, wd)
	}
	if exe, err := os.Executable(); err == nil {
		starts = append(starts, filepath.Dir(exe))
	}
	for _, start := range starts {
		dir := start
		for i := 0; i < 6; i++ {
			candidate := filepath.Join(dir, "openapi.json")
			if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
				return candidate
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	return "openapi.json"
}

type tokenClaims struct {
	sub  uint64
	role string
	typ  string
	jti  string
	exp  int64
}

func (s *Server) issuePair(user model.User) (gin.H, error) {
	access, err := s.sign(user, "access", s.cfg.AccessSecret, s.cfg.ExpiresIn)
	if err != nil {
		return nil, err
	}
	refresh, err := s.sign(user, "refresh", s.cfg.RefreshSecret, s.cfg.RefreshExpiresIn)
	if err != nil {
		return nil, err
	}
	return gin.H{
		"user":          user,
		"token":         access,
		"refresh_token": refresh,
		"token_type":    "Bearer",
		"expires_in":    s.cfg.ExpiresIn,
	}, nil
}

func (s *Server) sign(user model.User, typ, secret string, seconds int) (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	now := time.Now()
	claims := jwt.MapClaims{
		"sub":  strconv.FormatUint(user.ID, 10),
		"role": user.Role,
		"typ":  typ,
		"jti":  hex.EncodeToString(buf),
		"iss":  s.cfg.Issuer,
		"aud":  s.cfg.Audience,
		"iat":  now.Unix(),
		"exp":  now.Add(time.Duration(seconds) * time.Second).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(secret))
}

func (s *Server) parseToken(raw, typ, secret string) (tokenClaims, error) {
	parsed, err := jwt.Parse(raw, func(token *jwt.Token) (any, error) {
		if token.Method != jwt.SigningMethodHS256 {
			return nil, fmt.Errorf("invalid alg")
		}
		return []byte(secret), nil
	}, jwt.WithIssuer(s.cfg.Issuer), jwt.WithAudience(s.cfg.Audience))
	if err != nil {
		return tokenClaims{}, err
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		return tokenClaims{}, jwt.ErrTokenInvalidClaims
	}
	if claims["typ"] != typ {
		return tokenClaims{}, jwt.ErrTokenInvalidClaims
	}
	subText, _ := claims["sub"].(string)
	sub, err := strconv.ParseUint(subText, 10, 64)
	if err != nil || sub == 0 {
		return tokenClaims{}, jwt.ErrTokenInvalidClaims
	}
	jti, _ := claims["jti"].(string)
	exp, _ := claims["exp"].(float64)
	role, _ := claims["role"].(string)
	return tokenClaims{sub: sub, role: role, typ: typ, jti: jti, exp: int64(exp)}, nil
}

func authMessage(err error) string {
	if errors.Is(err, jwt.ErrTokenExpired) {
		return "Token has expired"
	}
	return "Token is invalid"
}

func (s *Server) revoke(jti string, exp int64) {
	if jti == "" {
		return
	}
	s.mu.Lock()
	s.revoked[jti] = exp
	now := time.Now().Unix()
	for id, until := range s.revoked {
		if until <= now {
			delete(s.revoked, id)
		}
	}
	s.mu.Unlock()
}

func (s *Server) isRevoked(jti string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	exp, ok := s.revoked[jti]
	if !ok {
		return false
	}
	if exp <= time.Now().Unix() {
		delete(s.revoked, jti)
		return false
	}
	return true
}

func bearer(header string) string {
	parts := strings.SplitN(strings.TrimSpace(header), " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") || strings.TrimSpace(parts[1]) == "" {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func bcryptCost(rounds int) int {
	switch {
	case rounds < bcrypt.MinCost:
		return bcrypt.DefaultCost
	case rounds > bcrypt.MaxCost:
		return bcrypt.MaxCost
	default:
		return rounds
	}
}

func (s *Server) hashPassword(plain string) (string, error) {
	hashed, err := bcrypt.GenerateFromPassword([]byte(plain), bcryptCost(s.cfg.BcryptRounds))
	if err != nil {
		return "", err
	}
	return string(hashed), nil
}

func (s *Server) bind(c *gin.Context) (map[string]any, bool) {
	if c.Request.Body == nil {
		return map[string]any{}, true
	}
	decoder := json.NewDecoder(c.Request.Body)
	decoder.UseNumber()
	var body map[string]any
	if err := decoder.Decode(&body); err != nil {
		if errors.Is(err, io.EOF) {
			return map[string]any{}, true
		}
		var max *http.MaxBytesError
		if errors.As(err, &max) {
			s.fail(c, http.StatusRequestEntityTooLarge, "Payload too large", nil)
			return nil, false
		}
		s.fail(c, http.StatusBadRequest, "Invalid JSON payload", nil)
		return nil, false
	}
	if body == nil {
		body = map[string]any{}
	}
	return body, true
}

func (s *Server) pagination(c *gin.Context, sortable []string) (pageQuery, bool) {
	query, _, ok := s.paginationWithInclude(c, sortable, nil)
	return query, ok
}

func (s *Server) paginationWithInclude(c *gin.Context, sortable, allowed []string) (pageQuery, map[string]bool, bool) {
	query := pageQuery{Page: 1, Limit: s.cfg.PageLimit, Sort: "id", Dir: "DESC"}
	if !contains(sortable, "id") && len(sortable) > 0 {
		query.Sort = sortable[0]
	}
	errs := fieldErrors{}
	if raw := c.Query("page"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 100000 {
			errs.add("page", "Page must be a positive integer.")
		} else {
			query.Page = n
		}
	}
	if raw := c.Query("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > s.cfg.PageMax {
			errs.add("limit", fmt.Sprintf("Limit must be an integer between 1 and %d.", s.cfg.PageMax))
		} else {
			query.Limit = n
		}
	}
	if raw := strings.TrimSpace(c.Query("sort")); raw != "" {
		if !contains(sortable, raw) {
			errs.add("sort", fmt.Sprintf("Sort must be one of: %s.", strings.Join(sortable, ", ")))
		} else {
			query.Sort = raw
		}
	}
	if raw := strings.ToLower(strings.TrimSpace(c.Query("order"))); raw != "" {
		if raw != "asc" && raw != "desc" {
			errs.add("order", "Order must be either asc or desc.")
		} else if raw == "asc" {
			query.Dir = "ASC"
		}
	}
	if len(c.Query("search")) > 150 {
		errs.add("search", "Search must be at most 150 characters.")
	}
	selected := map[string]bool{}
	if allowed != nil {
		picked, message, bad := includeSelection(c.Query("include"), allowed)
		if bad {
			errs.add("include", message)
		} else {
			selected = picked
		}
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return query, nil, false
	}
	query.Offset = (query.Page - 1) * query.Limit
	return query, selected, true
}

func includeSelection(raw string, allowed []string) (map[string]bool, string, bool) {
	selected := map[string]bool{}
	if strings.TrimSpace(raw) == "" {
		return selected, "", false
	}
	var invalid []string
	allowedSet := map[string]bool{}
	for _, item := range allowed {
		allowedSet[item] = true
	}
	for _, part := range strings.Split(raw, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		if !allowedSet[part] {
			invalid = append(invalid, part)
			continue
		}
		selected[part] = true
	}
	if len(invalid) > 0 {
		allowedText := strings.Join(allowed, ", ")
		if allowedText == "" {
			allowedText = "none"
		}
		return nil, fmt.Sprintf("Unsupported include value(s): %s. Allowed: %s.", strings.Join(invalid, ", "), allowedText), true
	}
	return selected, "", false
}

func (s *Server) includes(c *gin.Context, allowed []string) (map[string]bool, bool) {
	selected, message, bad := includeSelection(c.Query("include"), allowed)
	if bad {
		s.validation(c, fieldErrors{"include": {message}})
		return nil, false
	}
	return selected, true
}

func metaFor(total int64, query pageQuery) gin.H {
	pages := 0
	if query.Limit > 0 {
		pages = int(math.Ceil(float64(total) / float64(query.Limit)))
	}
	return gin.H{"page": query.Page, "limit": query.Limit, "total": total, "total_pages": pages}
}

func (e fieldErrors) add(field, message string) {
	e[field] = append(e[field], message)
}

func contains(items []string, value string) bool {
	for _, item := range items {
		if item == value {
			return true
		}
	}
	return false
}

func text(body map[string]any, key string) (string, bool) {
	value, ok := body[key]
	if !ok || value == nil {
		return "", false
	}
	text, ok := value.(string)
	return text, ok
}

func asUint(value any) (uint64, bool) {
	switch typed := value.(type) {
	case json.Number:
		n, err := typed.Int64()
		return uint64(n), err == nil && n > 0
	case float64:
		return uint64(typed), typed >= 1 && typed == math.Trunc(typed)
	case string:
		n, err := strconv.ParseUint(strings.TrimSpace(typed), 10, 64)
		return n, err == nil && n > 0
	default:
		return 0, false
	}
}

func asInt(value any) (int, bool) {
	switch typed := value.(type) {
	case json.Number:
		n, err := typed.Int64()
		return int(n), err == nil
	case float64:
		return int(typed), typed == math.Trunc(typed)
	case string:
		n, err := strconv.Atoi(strings.TrimSpace(typed))
		return n, err == nil
	default:
		return 0, false
	}
}

func asFloat(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		n, err := typed.Float64()
		return n, err == nil
	case float64:
		return typed, true
	case string:
		n, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		return n, err == nil
	default:
		return 0, false
	}
}

func slugify(value string) string {
	var b strings.Builder
	dash := false
	for _, r := range strings.ToLower(strings.TrimSpace(value)) {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			b.WriteRune(r)
			dash = false
			continue
		}
		if r == '\'' || r == '"' || r == '`' {
			continue
		}
		if !dash && b.Len() > 0 {
			b.WriteByte('-')
			dash = true
		}
	}
	out := strings.Trim(b.String(), "-")
	if len(out) > 120 {
		out = strings.Trim(out[:120], "-")
	}
	if out == "" {
		return "item"
	}
	return out
}

func validSlug(value string) bool {
	if value == "" || len(value) > 180 {
		return false
	}
	dash := false
	for i, r := range value {
		ok := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if r == '-' {
			if i == 0 || dash {
				return false
			}
			dash = true
			continue
		}
		if !ok {
			return false
		}
		dash = false
	}
	return !dash
}

func validEmail(value string) bool {
	if len(value) < 3 || len(value) > 150 || strings.ContainsAny(value, " \t") {
		return false
	}
	at := strings.Index(value, "@")
	if at <= 0 || at != strings.LastIndex(value, "@") || at == len(value)-1 {
		return false
	}
	domain := value[at+1:]
	return strings.Contains(domain, ".") && !strings.HasPrefix(domain, ".") && !strings.HasSuffix(domain, ".")
}

func optionalString(body map[string]any, key string) (value *string, present, ok bool) {
	raw, exists := body[key]
	if !exists {
		return nil, false, true
	}
	if raw == nil {
		return nil, true, true
	}
	text, isString := raw.(string)
	if !isString {
		return nil, true, false
	}
	trimmed := strings.TrimSpace(text)
	return &trimmed, true, true
}

func (s *Server) idParam(c *gin.Context, name string) (uint64, bool) {
	n, err := strconv.ParseUint(c.Param(name), 10, 64)
	if err != nil || n < 1 {
		s.validation(c, fieldErrors{name: {name + " must be a positive integer."}})
		return 0, false
	}
	return n, true
}

func (s *Server) uniqueSlug(table, slug string, except uint64) error {
	var count int64
	query := s.db.Table(table).Where("slug = ?", slug)
	if except > 0 {
		query = query.Where("id <> ?", except)
	}
	if err := query.Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return &appError{status: http.StatusConflict, message: fmt.Sprintf("Slug %q has already been taken", slug)}
	}
	return nil
}

func likePattern(search string) string {
	return "%" + strings.TrimSpace(search) + "%"
}
