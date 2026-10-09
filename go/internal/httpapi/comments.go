package httpapi

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (s *Server) listComments(c *gin.Context) {
	s.comments(c, 0)
}

func (s *Server) listProductComments(c *gin.Context) {
	productID, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	if _, err := s.findProduct(productID); err != nil {
		if app, ok := err.(*appError); ok && app.status == http.StatusNotFound {
			s.fail(c, http.StatusNotFound, fmt.Sprintf("Product with id %d not found", productID), nil)
			return
		}
		s.writeErr(c, err)
		return
	}
	s.comments(c, productID)
}

func (s *Server) comments(c *gin.Context, productID uint64) {
	query, ok := s.pagination(c, []string{"id", "body", "product_id", "user_id", "created_at", "updated_at"})
	if !ok {
		return
	}
	include, ok := s.includes(c, []string{"user", "product"})
	if !ok {
		return
	}
	db := s.db.Model(&model.Comment{})
	if productID > 0 {
		db = db.Where("product_id = ?", productID)
	} else if raw := c.Query("product_id"); raw != "" {
		id, err := parsePositive(raw)
		if err != nil {
			s.validation(c, fieldErrors{"product_id": {"product_id must be a positive integer."}})
			return
		}
		db = db.Where("product_id = ?", id)
	}
	if raw := c.Query("user_id"); raw != "" {
		id, err := parsePositive(raw)
		if err != nil {
			s.validation(c, fieldErrors{"user_id": {"user_id must be a positive integer."}})
			return
		}
		db = db.Where("user_id = ?", id)
	}
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		db = db.Where("body LIKE ?", likePattern(search))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.Comment
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.attachComments(rows, include)
	s.pageOK(c, "Comments retrieved", rows, metaFor(total, query))
}

func (s *Server) createComment(c *gin.Context) {
	productID, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	body, ok := s.bind(c)
	if !ok {
		return
	}
	if _, err := s.findProduct(productID); err != nil {
		if app, ok := err.(*appError); ok && app.status == http.StatusNotFound {
			s.fail(c, http.StatusNotFound, fmt.Sprintf("Product with id %d not found", productID), nil)
			return
		}
		s.writeErr(c, err)
		return
	}
	textBody, isString := text(body, "body")
	textBody = strings.TrimSpace(textBody)
	if _, exists := body["body"]; !exists || textBody == "" {
		s.validation(c, fieldErrors{"body": {"Body is required."}})
		return
	}
	if !isString {
		s.validation(c, fieldErrors{"body": {"Body must be a string."}})
		return
	}
	if len(textBody) > 2000 {
		s.validation(c, fieldErrors{"body": {"Body must be between 1 and 2000 characters."}})
		return
	}
	row := model.Comment{ProductID: productID, UserID: current(c).ID, Body: textBody}
	if err := s.db.Create(&row).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.created(c, "Comment created successfully", row)
}

func (s *Server) updateComment(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	body, ok := s.bind(c)
	if !ok {
		return
	}
	row, err := s.findComment(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if !s.owns(c, row.UserID) {
		return
	}
	textBody, isString := text(body, "body")
	textBody = strings.TrimSpace(textBody)
	if !isString || textBody == "" {
		s.validation(c, fieldErrors{"body": {"Body is required."}})
		return
	}
	if len(textBody) > 2000 {
		s.validation(c, fieldErrors{"body": {"Body must be between 1 and 2000 characters."}})
		return
	}
	row.Body = textBody
	if err := s.db.Save(&row).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Comment updated successfully", row)
}

func (s *Server) deleteComment(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	row, err := s.findComment(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if !s.owns(c, row.UserID) {
		return
	}
	if err := s.db.Delete(&model.Comment{}, id).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Comment deleted successfully", nil)
}

func (s *Server) findComment(id uint64) (model.Comment, error) {
	var row model.Comment
	if err := s.db.First(&row, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return row, &appError{status: http.StatusNotFound, message: "Comment not found"}
		}
		return row, err
	}
	return row, nil
}

func (s *Server) attachComments(rows []model.Comment, include map[string]bool) {
	if include["user"] {
		ids := map[uint64]struct{}{}
		for _, row := range rows {
			ids[row.UserID] = struct{}{}
		}
		keys := make([]uint64, 0, len(ids))
		for id := range ids {
			keys = append(keys, id)
		}
		var users []model.User
		if len(keys) > 0 {
			_ = s.db.Where("id IN ?", keys).Find(&users).Error
		}
		byID := map[uint64]model.User{}
		for _, user := range users {
			byID[user.ID] = user
		}
		for i, row := range rows {
			if user, ok := byID[row.UserID]; ok {
				copy := user
				rows[i].User = &copy
			}
		}
	}
	if include["product"] {
		ids := map[uint64]struct{}{}
		for _, row := range rows {
			ids[row.ProductID] = struct{}{}
		}
		keys := make([]uint64, 0, len(ids))
		for id := range ids {
			keys = append(keys, id)
		}
		var products []model.Product
		if len(keys) > 0 {
			_ = s.db.Where("id IN ?", keys).Find(&products).Error
		}
		byID := map[uint64]model.Product{}
		for _, product := range products {
			byID[product.ID] = product
		}
		for i, row := range rows {
			if product, ok := byID[row.ProductID]; ok {
				copy := product
				rows[i].Product = &copy
			}
		}
	}
}
