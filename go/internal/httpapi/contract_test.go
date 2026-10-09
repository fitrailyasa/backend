package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/backend-starter/go/internal/model"
	"github.com/golang-jwt/jwt/v5"
)

func tokenFrom(t *testing.T, recBody map[string]any) string {
	t.Helper()
	data := recBody["data"].(map[string]any)
	token, _ := data["token"].(string)
	if token == "" {
		t.Fatalf("missing token: %#v", recBody)
	}
	return token
}

func TestRegisterIgnoresRequestedRole(t *testing.T) {
	s := newTestServer(t)
	rec := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"John Doe","email":"john@example.com","password":"password","password_confirmation":"password","role":"admin"
	}`, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register %d %s", rec.Code, rec.Body.String())
	}
	body := decode(t, rec)
	user := body["data"].(map[string]any)["user"].(map[string]any)
	if user["role"] != "user" || user["password"] != nil {
		t.Fatalf("user %#v", user)
	}
	if body["data"].(map[string]any)["expires_in"] != float64(3600) {
		t.Fatalf("expires %#v", body["data"])
	}
}

func TestCatalogCommentsAndOrders(t *testing.T) {
	s := newTestServer(t)
	register(t, s, "Admin", "admin@example.com")
	if err := s.db.Model(&model.User{}).Where("email = ?", "admin@example.com").Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}
	adminToken := login(t, s, "admin@example.com")
	userToken := register(t, s, "Regular", "user@example.com")

	forbidden := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Nope"}`, userToken)
	if forbidden.Code != http.StatusForbidden {
		t.Fatalf("forbidden %d", forbidden.Code)
	}
	invalid := perform(s, http.MethodPost, "/api/v1/categories", `{}`, adminToken)
	if invalid.Code != http.StatusUnprocessableEntity {
		t.Fatalf("invalid category %d %s", invalid.Code, invalid.Body.String())
	}

	category := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Electronics"}`, adminToken)
	categoryID := idOf(t, category)
	home := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Home & Living"}`, adminToken)
	if decode(t, home)["data"].(map[string]any)["slug"] != "home-living" {
		t.Fatalf("slug %#v", decode(t, home)["data"])
	}
	duplicate := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Electronics"}`, adminToken)
	if duplicate.Code != http.StatusConflict {
		t.Fatalf("duplicate category %d %s", duplicate.Code, duplicate.Body.String())
	}

	tag := perform(s, http.MethodPost, "/api/v1/tags", `{"name":"Featured"}`, adminToken)
	tagID := idOf(t, tag)
	product := perform(s, http.MethodPost, "/api/v1/products", fmt.Sprintf(`{
		"category_id":%d,"name":"Smartphone X","price":500,"stock":10,"description":"A phone","tags":[%d]
	}`, categoryID, tagID), adminToken)
	productID := idOf(t, product)

	listed := perform(s, http.MethodGet, "/api/v1/products?include=category,tags", "", "")
	row := decode(t, listed)["data"].([]any)[0].(map[string]any)
	if row["category"].(map[string]any)["name"] != "Electronics" || row["price"] != float64(500) {
		t.Fatalf("product %#v", row)
	}
	if row["tags"].([]any)[0].(map[string]any)["slug"] != "featured" {
		t.Fatalf("tags %#v", row["tags"])
	}
	if decode(t, perform(s, http.MethodGet, "/api/v1/products?tag=featured&min_price=100&max_price=600", "", ""))["meta"].(map[string]any)["total"] != float64(1) {
		t.Fatal("filters")
	}
	if perform(s, http.MethodGet, "/api/v1/products?include=supplier", "", "").Code != http.StatusUnprocessableEntity {
		t.Fatal("bad include")
	}

	blocked := perform(s, http.MethodDelete, fmt.Sprintf("/api/v1/categories/%d", categoryID), "", adminToken)
	if blocked.Code != http.StatusConflict {
		t.Fatalf("category delete %d %s", blocked.Code, blocked.Body.String())
	}

	comment := perform(s, http.MethodPost, fmt.Sprintf("/api/v1/products/%d/comments", productID), `{"body":"Battery is amazing"}`, userToken)
	if comment.Code != http.StatusCreated {
		t.Fatalf("comment %d %s", comment.Code, comment.Body.String())
	}
	commentID := idOf(t, comment)
	found := perform(s, http.MethodGet, fmt.Sprintf("/api/v1/products/%d/comments?search=battery&include=user", productID), "", "")
	if decode(t, found)["meta"].(map[string]any)["total"] != float64(1) {
		t.Fatalf("search %#v", decode(t, found))
	}
	if decode(t, found)["data"].([]any)[0].(map[string]any)["user"].(map[string]any)["password"] != nil {
		t.Fatal("password leaked")
	}

	stranger := register(t, s, "Stranger", "stranger@example.com")
	if perform(s, http.MethodPatch, fmt.Sprintf("/api/v1/comments/%d", commentID), `{"body":"Hijacked"}`, stranger).Code != http.StatusForbidden {
		t.Fatal("comment hijack")
	}

	order := perform(s, http.MethodPost, "/api/v1/orders", fmt.Sprintf(`{"items":[{"product_id":%d,"quantity":2},{"product_id":%d,"quantity":1}],"total":1}`, productID, productID), userToken)
	if order.Code != http.StatusCreated {
		t.Fatalf("order %d %s", order.Code, order.Body.String())
	}
	orderBody := decode(t, order)["data"].(map[string]any)
	if orderBody["total"] != float64(1500) || orderBody["status"] != "pending" {
		t.Fatalf("order body %#v", orderBody)
	}
	items := orderBody["items"].([]any)
	if len(items) != 1 || items[0].(map[string]any)["quantity"] != float64(3) {
		t.Fatalf("merged %#v", items)
	}
	if decode(t, perform(s, http.MethodGet, fmt.Sprintf("/api/v1/products/%d", productID), "", ""))["data"].(map[string]any)["stock"] != float64(7) {
		t.Fatal("stock")
	}

	orderID := idOf(t, order)
	if perform(s, http.MethodPatch, fmt.Sprintf("/api/v1/orders/%d/status", orderID), `{"status":"paid"}`, userToken).Code != http.StatusForbidden {
		t.Fatal("owner paid")
	}
	if perform(s, http.MethodGet, fmt.Sprintf("/api/v1/orders?user_id=%d", uint64(orderBody["user_id"].(float64))), "", userToken).Code != http.StatusForbidden {
		t.Fatal("user_id filter")
	}
	if perform(s, http.MethodPatch, fmt.Sprintf("/api/v1/orders/%d/status", orderID), `{"status":"cancelled"}`, userToken).Code != http.StatusOK {
		t.Fatal("cancel")
	}
	if decode(t, perform(s, http.MethodGet, fmt.Sprintf("/api/v1/products/%d", productID), "", ""))["data"].(map[string]any)["stock"] != float64(10) {
		t.Fatal("restock")
	}
	if perform(s, http.MethodDelete, fmt.Sprintf("/api/v1/orders/%d", orderID), "", userToken).Code != http.StatusForbidden {
		t.Fatal("user delete order")
	}
	if perform(s, http.MethodDelete, fmt.Sprintf("/api/v1/orders/%d", orderID), "", adminToken).Code != http.StatusOK {
		t.Fatal("admin delete order")
	}
}

func TestRefreshAndExpiredToken(t *testing.T) {
	s := newTestServer(t)
	created := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"Refresh","email":"refresh@example.com","password":"password","password_confirmation":"password"
	}`, "")
	data := decode(t, created)["data"].(map[string]any)
	refresh := data["refresh_token"].(string)
	byField := perform(s, http.MethodPost, "/api/v1/auth/refresh", fmt.Sprintf(`{"refresh_token":%q}`, refresh), "")
	if byField.Code != http.StatusOK {
		t.Fatalf("refresh %d %s", byField.Code, byField.Body.String())
	}
	expired := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "1", "role": "user", "typ": "access", "jti": "expired-jti",
		"iss": s.cfg.Issuer, "aud": s.cfg.Audience,
		"iat": time.Now().Add(-2 * time.Minute).Unix(),
		"exp": time.Now().Add(-1 * time.Minute).Unix(),
	})
	signed, err := expired.SignedString([]byte(s.cfg.AccessSecret))
	if err != nil {
		t.Fatal(err)
	}
	me := perform(s, http.MethodGet, "/api/v1/auth/me", "", signed)
	if me.Code != http.StatusUnauthorized || decode(t, me)["message"] != "Token has expired" {
		t.Fatalf("expired %d %s", me.Code, me.Body.String())
	}
}

func TestListQueryAndCategoryValidation(t *testing.T) {
	s := newTestServer(t)
	badRegister := perform(s, http.MethodPost, "/api/v1/auth/register", `{
		"name":"A","email":"bad","password":"short","password_confirmation":"nope"
	}`, "")
	assertErrorFields(t, badRegister, "name", "email", "password", "password_confirmation")

	listed := perform(s, http.MethodGet, "/api/v1/categories?page=0&limit=0&sort=nope&order=sideways&include=nope", "", "")
	assertErrorFields(t, listed, "page", "limit", "sort", "order", "include")

	anonymous := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Valid Name"}`, "")
	if anonymous.Code != http.StatusUnauthorized {
		t.Fatalf("anonymous %d %s", anonymous.Code, anonymous.Body.String())
	}

	register(t, s, "Admin", "admin@example.com")
	if err := s.db.Model(&model.User{}).Where("email = ?", "admin@example.com").Update("role", "admin").Error; err != nil {
		t.Fatal(err)
	}
	admin := login(t, s, "admin@example.com")
	rejected := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"X","slug":"Bad Slug"}`, admin)
	assertErrorFields(t, rejected, "name", "slug")

	created := perform(s, http.MethodPost, "/api/v1/categories", `{"name":"Valid Category Name"}`, admin)
	if created.Code != http.StatusCreated {
		t.Fatalf("create %d %s", created.Code, created.Body.String())
	}
	if decode(t, created)["data"].(map[string]any)["slug"] != "valid-category-name" {
		t.Fatalf("slug %#v", decode(t, created)["data"])
	}
}

func assertErrorFields(t *testing.T, rec *httptest.ResponseRecorder, fields ...string) {
	t.Helper()
	if rec.Code != http.StatusUnprocessableEntity {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	errors, _ := decode(t, rec)["errors"].(map[string]any)
	for _, field := range fields {
		value, ok := errors[field].([]any)
		if !ok || len(value) == 0 {
			t.Fatalf("missing %s in %#v", field, errors)
		}
	}
}

func register(t *testing.T, s *Server, name, email string) string {
	t.Helper()
	rec := perform(s, http.MethodPost, "/api/v1/auth/register", fmt.Sprintf(
		`{"name":%q,"email":%q,"password":"password","password_confirmation":"password"}`, name, email), "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("register %s %d %s", email, rec.Code, rec.Body.String())
	}
	return tokenFrom(t, decode(t, rec))
}

func login(t *testing.T, s *Server, email string) string {
	t.Helper()
	rec := perform(s, http.MethodPost, "/api/v1/auth/login", fmt.Sprintf(`{"email":%q,"password":"password"}`, email), "")
	if rec.Code != http.StatusOK {
		t.Fatalf("login %d %s", rec.Code, rec.Body.String())
	}
	return tokenFrom(t, decode(t, rec))
}

func idOf(t *testing.T, rec *httptest.ResponseRecorder) uint64 {
	t.Helper()
	if rec.Code >= 300 {
		t.Fatalf("status %d %s", rec.Code, rec.Body.String())
	}
	return uint64(decode(t, rec)["data"].(map[string]any)["id"].(float64))
}
