package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/backend-starter/go/internal/config"
	"github.com/backend-starter/go/internal/model"
	"github.com/backend-starter/go/internal/store"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	name := strings.NewReplacer("/", "_", " ", "_").Replace(t.Name())
	cfg := config.Config{
		Env:              "test",
		Host:             "127.0.0.1",
		Port:             8090,
		BaseURL:          "http://localhost:8090",
		Prefix:           "/api/v1",
		CORSOrigin:       "*",
		BodyLimit:        1 << 20,
		Dialect:          "sqlite",
		Storage:          "file:" + name + "?mode=memory&cache=shared",
		Sync:             true,
		JWTSecret:        "test-secret-test-secret-test-secret-12",
		AccessSecret:     "test-secret-test-secret-test-secret-12",
		RefreshSecret:    "test-secret-test-secret-test-secret-12",
		ExpiresIn:        3600,
		RefreshExpiresIn: 604800,
		Issuer:           "backend-starter-go",
		Audience:         "backend-starter-clients",
		BcryptRounds:     bcrypt.MinCost,
		PageLimit:        10,
		PageMax:          100,
		RateMax:          0,
	}
	db, err := store.Open(cfg)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	return New(cfg, db)
}

func perform(s *Server, method, path, body, token string) *httptest.ResponseRecorder {
	var reader *bytes.Reader
	if body == "" {
		reader = bytes.NewReader(nil)
	} else {
		reader = bytes.NewReader([]byte(body))
	}
	req := httptest.NewRequest(method, path, reader)
	if body != "" {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	rec := httptest.NewRecorder()
	s.engine.ServeHTTP(rec, req)
	return rec
}

func decode(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var payload map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("json: %v body=%s", err, rec.Body.String())
	}
	return payload
}

func TestHealthAndIndexAndDocs(t *testing.T) {
	s := newTestServer(t)
	health := perform(s, http.MethodGet, "/health", "", "")
	if health.Code != http.StatusOK {
		t.Fatalf("health status %d", health.Code)
	}
	body := decode(t, health)
	if body["status"] != "ok" || body["success"] != nil {
		t.Fatalf("health envelope leaked: %#v", body)
	}

	index := perform(s, http.MethodGet, "/api/v1", "", "")
	if index.Code != http.StatusOK {
		t.Fatalf("index status %d", index.Code)
	}
	payload := decode(t, index)
	if payload["success"] != true {
		t.Fatalf("index success: %#v", payload["success"])
	}

	spec := perform(s, http.MethodGet, "/api/v1/docs.json", "", "")
	if spec.Code != http.StatusOK {
		t.Fatalf("docs status %d body %s", spec.Code, spec.Body.String())
	}
	var document map[string]any
	if err := json.Unmarshal(spec.Body.Bytes(), &document); err != nil {
		t.Fatal(err)
	}
	if document["openapi"] != "3.0.3" {
		t.Fatalf("openapi version %v", document["openapi"])
	}
	info, _ := document["info"].(map[string]any)
	if info["title"] != "Backend Starter Kit API" {
		t.Fatalf("title %v", info["title"])
	}
	docs := perform(s, http.MethodGet, "/api/v1/docs", "", "")
	if docs.Code != http.StatusOK || !strings.Contains(docs.Body.String(), "Backend Starter Kit API") {
		t.Fatalf("docs page %d", docs.Code)
	}
}

func TestRegisterLoginMeAndLogout(t *testing.T) {
	s := newTestServer(t)
	missing := perform(s, http.MethodPost, "/api/v1/auth/register", `{}`, "")
	if missing.Code != http.StatusUnprocessableEntity {
		t.Fatalf("register validation %d %s", missing.Code, missing.Body.String())
	}
	errs := decode(t, missing)["errors"].(map[string]any)
	if errs["email"] == nil || errs["password"] == nil {
		t.Fatalf("errors %#v", errs)
	}

	created := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"User","email":"user@example.com","password":"password","password_confirmation":"password"
	}`, "")
	if created.Code != http.StatusCreated {
		t.Fatalf("register %d %s", created.Code, created.Body.String())
	}
	data := decode(t, created)["data"].(map[string]any)
	user := data["user"].(map[string]any)
	if user["password"] != nil || user["role"] != "user" {
		t.Fatalf("user payload %#v", user)
	}
	token, _ := data["token"].(string)
	if token == "" || data["refresh_token"] == "" {
		t.Fatal("missing tokens")
	}

	dup := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"User","email":"user@example.com","password":"password","password_confirmation":"password"
	}`, "")
	if dup.Code != http.StatusUnprocessableEntity {
		t.Fatalf("duplicate %d", dup.Code)
	}

	bad := perform(s, http.MethodPost, "/api/v1/auth/login", `{"email":"user@example.com","password":"wrongpass"}`, "")
	if bad.Code != http.StatusUnauthorized {
		t.Fatalf("bad login %d", bad.Code)
	}

	anon := perform(s, http.MethodGet, "/api/v1/auth/me", "", "")
	if anon.Code != http.StatusUnauthorized {
		t.Fatalf("anon %d", anon.Code)
	}
	me := perform(s, http.MethodGet, "/api/v1/auth/me", "", token)
	if me.Code != http.StatusOK || decode(t, me)["data"].(map[string]any)["email"] != "user@example.com" {
		t.Fatalf("me %d %s", me.Code, me.Body.String())
	}

	logout := perform(s, http.MethodPost, "/api/v1/auth/logout", "", token)
	if logout.Code != http.StatusOK {
		t.Fatalf("logout %d", logout.Code)
	}
	revoked := perform(s, http.MethodGet, "/api/v1/auth/me", "", token)
	if revoked.Code != http.StatusUnauthorized || decode(t, revoked)["message"] != "Token has been revoked" {
		t.Fatalf("revoked %d %s", revoked.Code, revoked.Body.String())
	}

	missingRoute := perform(s, http.MethodGet, "/api/v1/missing", "", "")
	if missingRoute.Code != http.StatusNotFound {
		t.Fatalf("missing route %d", missingRoute.Code)
	}
}

func TestProductTagsAndOrderStock(t *testing.T) {
	s := newTestServer(t)
	hash, err := bcrypt.GenerateFromPassword([]byte("password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	admin := model.User{Name: "Site Administrator", Email: "admin@example.com", Password: string(hash), Role: "admin"}
	if err := s.db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}
	login := perform(s, http.MethodPost, "/api/v1/auth/login", `{"email":"admin@example.com","password":"password"}`, "")
	token := decode(t, login)["data"].(map[string]any)["token"].(string)

	category := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Electronics"}`, token)
	if category.Code != http.StatusCreated {
		t.Fatalf("category %d %s", category.Code, category.Body.String())
	}
	categoryID := int(decode(t, category)["data"].(map[string]any)["id"].(float64))
	tag := perform(s, http.MethodPost, "/api/v1/tags", `{"name":"Featured"}`, token)
	tagID := int(decode(t, tag)["data"].(map[string]any)["id"].(float64))

	product := perform(s, http.MethodPost, "/api/v1/products", `{
		"category_id":`+strconv.Itoa(categoryID)+`,
		"name":"Smartphone X Pro",
		"price":100,
		"stock":1,
		"tag_ids":[`+strconv.Itoa(tagID)+`]
	}`, token)
	if product.Code != http.StatusCreated {
		t.Fatalf("product %d %s", product.Code, product.Body.String())
	}
	productID := int(decode(t, product)["data"].(map[string]any)["id"].(float64))

	shown := perform(s, http.MethodGet, "/api/v1/products/"+strconv.Itoa(productID)+"?include=tags", "", "")
	tags := decode(t, shown)["data"].(map[string]any)["tags"].([]any)
	if len(tags) != 1 {
		t.Fatalf("tags %#v", decode(t, shown)["data"])
	}

	buyer := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"Buyer","email":"buyer@example.com","password":"password","password_confirmation":"password"
	}`, "")
	buyerToken := decode(t, buyer)["data"].(map[string]any)["token"].(string)
	order := perform(s, http.MethodPost, "/api/v1/orders", `{"items":[{"product_id":`+strconv.Itoa(productID)+`,"quantity":1}]}`, buyerToken)
	if order.Code != http.StatusCreated {
		t.Fatalf("order %d %s", order.Code, order.Body.String())
	}
	again := perform(s, http.MethodPost, "/api/v1/orders", `{"items":[{"product_id":`+strconv.Itoa(productID)+`,"quantity":1}]}`, buyerToken)
	if again.Code != http.StatusConflict || !strings.Contains(decode(t, again)["message"].(string), "Insufficient stock") {
		t.Fatalf("stock %d %s", again.Code, again.Body.String())
	}
}
