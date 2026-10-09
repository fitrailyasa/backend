package httpapi

import (
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
)

func (s *Server) register(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	errs := fieldErrors{}
	name, nameOK := text(body, "name")
	name = strings.TrimSpace(name)
	if _, exists := body["name"]; !exists || name == "" {
		errs.add("name", "Name is required.")
	} else if !nameOK {
		errs.add("name", "Name must be a string.")
	} else if len(name) < 2 || len(name) > 100 {
		errs.add("name", "Name must be between 2 and 100 characters.")
	}
	email, emailOK := text(body, "email")
	email = strings.ToLower(strings.TrimSpace(email))
	if _, exists := body["email"]; !exists || email == "" {
		errs.add("email", "Email is required.")
	} else if !emailOK || !validEmail(email) {
		errs.add("email", "The email must be a valid email address.")
	}
	password, passwordOK := text(body, "password")
	if _, exists := body["password"]; !exists || password == "" {
		errs.add("password", "Password is required.")
	} else if !passwordOK {
		errs.add("password", "Password must be a string.")
	} else if len(password) < 8 || len(password) > 72 {
		errs.add("password", "Password must be at least 8 characters long.")
	}
	confirmation, _ := text(body, "password_confirmation")
	if confirmation == "" {
		errs.add("password_confirmation", "password_confirmation is required.")
	} else if confirmation != password {
		errs.add("password_confirmation", "password_confirmation must match password.")
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	var count int64
	if err := s.db.Model(&model.User{}).Where("email = ?", email).Count(&count).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if count > 0 {
		s.validation(c, fieldErrors{"email": {"The email has already been taken."}})
		return
	}
	hashed, err := s.hashPassword(password)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	user := model.User{Name: name, Email: email, Password: hashed, Role: "user"}
	if err := s.db.Create(&user).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	pair, err := s.issuePair(user)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.created(c, "User registered successfully", pair)
}

func (s *Server) login(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	errs := fieldErrors{}
	email, emailOK := text(body, "email")
	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" || !emailOK || !validEmail(email) {
		errs.add("email", "The email must be a valid email address.")
	}
	password, passwordOK := text(body, "password")
	if password == "" || !passwordOK {
		errs.add("password", "Password is required.")
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	var user model.User
	err := s.db.Where("email = ?", email).First(&user).Error
	if err != nil || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password)) != nil {
		s.fail(c, http.StatusUnauthorized, "These credentials do not match our records", nil)
		return
	}
	pair, err := s.issuePair(user)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Login successful", pair)
}

func (s *Server) refresh(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	token, _ := text(body, "refresh_token")
	if token == "" {
		token, _ = text(body, "token")
	}
	if token == "" {
		token = bearer(c.GetHeader("Authorization"))
	}
	if token == "" {
		s.fail(c, http.StatusUnauthorized, "Refresh token is missing", nil)
		return
	}
	claims, err := s.parseToken(token, "refresh", s.cfg.RefreshSecret)
	if err != nil {
		s.fail(c, http.StatusUnauthorized, authMessage(err), nil)
		return
	}
	var user model.User
	if err := s.db.First(&user, claims.sub).Error; err != nil {
		s.fail(c, http.StatusUnauthorized, "Token is invalid", nil)
		return
	}
	pair, err := s.issuePair(user)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Token refreshed successfully", pair)
}

func (s *Server) logout(c *gin.Context) {
	auth := currentAuth(c)
	s.revoke(auth.JTI, auth.Exp)
	s.ok(c, "Logged out successfully", nil)
}

func (s *Server) me(c *gin.Context) {
	s.ok(c, "Authenticated user retrieved", current(c))
}
