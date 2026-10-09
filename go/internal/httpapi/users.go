package httpapi

import (
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (s *Server) listUsers(c *gin.Context) {
	query, ok := s.pagination(c, []string{"id", "name", "email", "role", "created_at", "updated_at"})
	if !ok {
		return
	}
	db := s.db.Model(&model.User{})
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := likePattern(search)
		db = db.Where("name LIKE ? OR email LIKE ?", like, like)
	}
	if role := strings.TrimSpace(c.Query("role")); role != "" {
		db = db.Where("role = ?", role)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.User
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.pageOK(c, "Users retrieved", rows, metaFor(total, query))
}

func (s *Server) createUser(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	name, email, password, errs := userFields(body, true)
	role := "user"
	if raw, exists := body["role"]; exists && raw != nil {
		text, isString := raw.(string)
		if !isString || (text != "user" && text != "admin") {
			errs.add("role", "Role must be one of: user, admin.")
		} else {
			role = text
		}
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	if taken, err := s.emailTaken(email, 0); err != nil {
		s.writeErr(c, err)
		return
	} else if taken {
		s.validation(c, fieldErrors{"email": {"The email has already been taken."}})
		return
	}
	hashed, err := s.hashPassword(password)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	user := model.User{Name: name, Email: email, Password: hashed, Role: role}
	if err := s.db.Create(&user).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.created(c, "User created successfully", user)
}

func (s *Server) profile(c *gin.Context) {
	user, err := s.findUser(current(c).ID)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "User retrieved", user)
}

func (s *Server) updateProfile(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	user, err := s.findUser(current(c).ID)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if err := s.applyUser(c, &user, body, false); err != nil {
		if _, ok := err.(*appError); ok {
			s.writeErr(c, err)
			return
		}
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Profile updated successfully", user)
}

func (s *Server) getUser(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	user, err := s.findUser(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "User retrieved", user)
}

func (s *Server) replaceUser(c *gin.Context) { s.writeUser(c, true) }
func (s *Server) patchUser(c *gin.Context)   { s.writeUser(c, false) }

func (s *Server) writeUser(c *gin.Context, replace bool) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	body, ok := s.bind(c)
	if !ok {
		return
	}
	user, err := s.findUser(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if replace {
		if _, exists := body["name"]; !exists {
			s.validation(c, fieldErrors{"name": {"Name is required."}})
			return
		}
		if _, exists := body["email"]; !exists {
			s.validation(c, fieldErrors{"email": {"Email is required."}})
			return
		}
	}
	if err := s.applyUser(c, &user, body, true); err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "User updated successfully", user)
}

func (s *Server) deleteUser(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	if _, err := s.findUser(id); err != nil {
		s.writeErr(c, err)
		return
	}
	if err := s.db.Delete(&model.User{}, id).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "User deleted successfully", nil)
}

func (s *Server) applyUser(c *gin.Context, user *model.User, body map[string]any, allowRole bool) error {
	errs := fieldErrors{}
	if raw, exists := body["name"]; exists {
		name, isString := raw.(string)
		name = strings.TrimSpace(name)
		if !isString {
			errs.add("name", "Name must be a string.")
		} else if len(name) < 2 || len(name) > 100 {
			errs.add("name", "Name must be between 2 and 100 characters.")
		} else {
			user.Name = name
		}
	}
	if raw, exists := body["email"]; exists && raw != nil {
		email, isString := raw.(string)
		email = strings.ToLower(strings.TrimSpace(email))
		if !isString || !validEmail(email) {
			errs.add("email", "The email must be a valid email address.")
		} else if email != user.Email {
			taken, err := s.emailTaken(email, user.ID)
			if err != nil {
				return err
			}
			if taken {
				errs.add("email", "The email has already been taken.")
			} else {
				user.Email = email
			}
		}
	}
	password := ""
	if raw, exists := body["password"]; exists && raw != nil && raw != "" {
		value, isString := raw.(string)
		if !isString {
			errs.add("password", "Password must be a string.")
		} else if len(value) < 8 || len(value) > 72 {
			errs.add("password", "Password must be at least 8 characters long.")
		} else {
			password = value
		}
	}
	if confirmation, exists := text(body, "password_confirmation"); exists && confirmation != "" {
		if password == "" {
			errs.add("password_confirmation", "Password is required when password_confirmation is provided.")
		} else if confirmation != password {
			errs.add("password_confirmation", "password_confirmation must match password.")
		}
	}
	if allowRole {
		if raw, exists := body["role"]; exists && raw != nil {
			role, isString := raw.(string)
			if !isString || (role != "user" && role != "admin") {
				errs.add("role", "Role must be one of: user, admin.")
			} else {
				user.Role = role
			}
		}
	}
	if len(errs) > 0 {
		return &appError{status: http.StatusUnprocessableEntity, message: "Validation failed", errors: errs}
	}
	if password != "" {
		hashed, err := s.hashPassword(password)
		if err != nil {
			return err
		}
		user.Password = hashed
	}
	return s.db.Save(user).Error
}

func userFields(body map[string]any, required bool) (string, string, string, fieldErrors) {
	errs := fieldErrors{}
	name, nameOK := text(body, "name")
	name = strings.TrimSpace(name)
	if required && name == "" {
		errs.add("name", "Name is required.")
	} else if _, exists := body["name"]; exists && (!nameOK || len(name) < 2 || len(name) > 100) {
		if !nameOK {
			errs.add("name", "Name must be a string.")
		} else {
			errs.add("name", "Name must be between 2 and 100 characters.")
		}
	}
	email, emailOK := text(body, "email")
	email = strings.ToLower(strings.TrimSpace(email))
	if required && email == "" {
		errs.add("email", "Email is required.")
	} else if _, exists := body["email"]; exists && (!emailOK || !validEmail(email)) {
		errs.add("email", "The email must be a valid email address.")
	}
	password, passwordOK := text(body, "password")
	if required && password == "" {
		errs.add("password", "Password is required.")
	} else if _, exists := body["password"]; exists && password != "" && (!passwordOK || len(password) < 8 || len(password) > 72) {
		if !passwordOK {
			errs.add("password", "Password must be a string.")
		} else {
			errs.add("password", "Password must be at least 8 characters long.")
		}
	}
	return name, email, password, errs
}

func (s *Server) emailTaken(email string, except uint64) (bool, error) {
	var count int64
	query := s.db.Model(&model.User{}).Where("email = ?", email)
	if except > 0 {
		query = query.Where("id <> ?", except)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Server) findUser(id uint64) (model.User, error) {
	var user model.User
	if err := s.db.First(&user, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return user, &appError{status: http.StatusNotFound, message: "User not found"}
		}
		return user, err
	}
	return user, nil
}
