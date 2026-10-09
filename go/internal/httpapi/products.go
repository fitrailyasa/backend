package httpapi

import (
	"errors"
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (s *Server) listProducts(c *gin.Context) {
	query, ok := s.pagination(c, []string{"id", "name", "slug", "price", "stock", "category_id", "created_at", "updated_at"})
	if !ok {
		return
	}
	include, ok := s.includes(c, []string{"category", "tags"})
	if !ok {
		return
	}
	db, ok := s.productQuery(c, include)
	if !ok {
		return
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.Product
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.attachProducts(rows, include["category"], include["tags"] || c.Query("tag_id") != "" || c.Query("tag") != "")
	s.pageOK(c, "Products retrieved", rows, metaFor(total, query))
}

func (s *Server) getProduct(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	include, ok := s.includes(c, []string{"category", "tags"})
	if !ok {
		return
	}
	row, err := s.findProduct(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	rows := []model.Product{row}
	s.attachProducts(rows, include["category"], include["tags"])
	s.ok(c, "Product retrieved", rows[0])
}

func (s *Server) createProduct(c *gin.Context) { s.saveProduct(c, 0, true) }
func (s *Server) replaceProduct(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveProduct(c, id, true)
}
func (s *Server) patchProduct(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveProduct(c, id, false)
}

func (s *Server) saveProduct(c *gin.Context, id uint64, required bool) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	var row model.Product
	if id > 0 {
		found, err := s.findProduct(id)
		if err != nil {
			s.writeErr(c, err)
			return
		}
		row = found
	}
	errs := fieldErrors{}
	if raw, exists := body["category_id"]; exists || required {
		if !exists || raw == nil {
			errs.add("category_id", "category_id is required.")
		} else if categoryID, ok := asUint(raw); !ok {
			errs.add("category_id", "category_id must be a positive integer.")
		} else {
			var count int64
			if err := s.db.Model(&model.Category{}).Where("id = ?", categoryID).Count(&count).Error; err != nil {
				s.writeErr(c, err)
				return
			}
			if count == 0 {
				s.validation(c, fieldErrors{"category_id": {"The selected category id is invalid."}})
				return
			}
			row.CategoryID = categoryID
		}
	}
	if _, exists := body["name"]; exists || required {
		name, isString := text(body, "name")
		name = strings.TrimSpace(name)
		if !exists || name == "" {
			errs.add("name", "Name is required.")
		} else if !isString {
			errs.add("name", "Name must be a string.")
		} else if len(name) < 2 || len(name) > 150 {
			errs.add("name", "Name must be between 2 and 150 characters.")
		} else {
			row.Name = name
		}
	}
	if raw, exists := body["slug"]; exists && raw != nil && raw != "" {
		slug, isString := raw.(string)
		slug = strings.TrimSpace(slug)
		if !isString || !validSlug(slug) {
			errs.add("slug", "Slug may only contain lowercase letters, numbers and single hyphens.")
		} else {
			row.Slug = slugify(slug)
		}
	} else if id == 0 {
		row.Slug = slugify(row.Name)
	}
	if desc, present, ok := optionalString(body, "description"); present {
		if !ok {
			errs.add("description", "Description must be a string.")
		} else {
			row.Description = desc
		}
	}
	if raw, exists := body["price"]; exists || required {
		if !exists || raw == nil {
			errs.add("price", "Price is required.")
		} else if price, ok := asFloat(raw); !ok || price < 0 {
			errs.add("price", "Price must be a number greater than or equal to 0.")
		} else {
			row.Price = price
		}
	}
	if raw, exists := body["stock"]; exists && raw != nil {
		stock, ok := asInt(raw)
		if !ok || stock < 0 {
			errs.add("stock", "Stock must be an integer greater than or equal to 0.")
		} else {
			row.Stock = stock
		}
	}
	tagIDs, tagsPresent, tagsOK := tagList(body)
	if tagsPresent && !tagsOK {
		errs.add("tags", "tags must be an array of positive integers.")
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	if err := s.uniqueSlug("products", row.Slug, row.ID); err != nil {
		s.writeErr(c, err)
		return
	}
	if tagsPresent {
		if err := s.ensureTags(tagIDs); err != nil {
			s.writeErr(c, err)
			return
		}
	}
	err := s.db.Transaction(func(tx *gorm.DB) error {
		var save error
		if id == 0 {
			save = tx.Create(&row).Error
		} else {
			save = tx.Save(&row).Error
		}
		if save != nil {
			return save
		}
		if tagsPresent {
			if err := tx.Where("product_id = ?", row.ID).Delete(&model.ProductTag{}).Error; err != nil {
				return err
			}
			for _, tagID := range tagIDs {
				if err := tx.Create(&model.ProductTag{ProductID: row.ID, TagID: tagID}).Error; err != nil {
					return err
				}
			}
		}
		return nil
	})
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if id == 0 {
		s.created(c, "Product created successfully", row)
		return
	}
	s.ok(c, "Product updated successfully", row)
}

func (s *Server) deleteProduct(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	if _, err := s.findProduct(id); err != nil {
		s.writeErr(c, err)
		return
	}
	var ordered int64
	if err := s.db.Model(&model.OrderItem{}).Where("product_id = ?", id).Count(&ordered).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if ordered > 0 {
		s.fail(c, http.StatusConflict, "Resource is still referenced by other records", nil)
		return
	}
	if err := s.db.Where("product_id = ?", id).Delete(&model.ProductTag{}).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if err := s.db.Where("product_id = ?", id).Delete(&model.Comment{}).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if err := s.db.Delete(&model.Product{}, id).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Product deleted successfully", nil)
}

func (s *Server) productQuery(c *gin.Context, include map[string]bool) (*gorm.DB, bool) {
	db := s.db.Model(&model.Product{})
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := likePattern(search)
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	if raw := c.Query("category_id"); raw != "" {
		id, err := parsePositive(raw)
		if err != nil {
			s.validation(c, fieldErrors{"category_id": {"category_id must be a positive integer."}})
			return nil, false
		}
		db = db.Where("category_id = ?", id)
	}
	if raw := c.Query("min_price"); raw != "" {
		price, ok := asFloat(raw)
		if !ok || price < 0 {
			s.validation(c, fieldErrors{"min_price": {"min_price must be a number greater than or equal to 0."}})
			return nil, false
		}
		db = db.Where("price >= ?", price)
	}
	if raw := c.Query("max_price"); raw != "" {
		price, ok := asFloat(raw)
		if !ok || price < 0 {
			s.validation(c, fieldErrors{"max_price": {"max_price must be a number greater than or equal to 0."}})
			return nil, false
		}
		db = db.Where("price <= ?", price)
	}
	tagID := uint64(0)
	if raw := c.Query("tag_id"); raw != "" {
		id, err := parsePositive(raw)
		if err != nil {
			s.validation(c, fieldErrors{"tag_id": {"tag_id must be a positive integer."}})
			return nil, false
		}
		tagID = id
	}
	tagSlug := strings.TrimSpace(c.Query("tag"))
	if tagID > 0 || tagSlug != "" {
		sql := "id IN (SELECT product_tag.product_id FROM product_tag JOIN tags ON tags.id = product_tag.tag_id WHERE 1=1"
		args := []any{}
		if tagID > 0 {
			sql += " AND tags.id = ?"
			args = append(args, tagID)
		}
		if tagSlug != "" {
			sql += " AND tags.slug = ?"
			args = append(args, slugify(tagSlug))
		}
		sql += ")"
		db = db.Where(sql, args...)
	}
	_ = include
	return db, true
}

func (s *Server) attachProducts(rows []model.Product, withCategory, withTags bool) {
	if len(rows) == 0 {
		return
	}
	if withCategory {
		ids := map[uint64]struct{}{}
		for _, row := range rows {
			ids[row.CategoryID] = struct{}{}
		}
		keys := make([]uint64, 0, len(ids))
		for id := range ids {
			keys = append(keys, id)
		}
		var categories []model.Category
		_ = s.db.Where("id IN ?", keys).Find(&categories).Error
		byID := map[uint64]model.Category{}
		for _, category := range categories {
			byID[category.ID] = category
		}
		for i, row := range rows {
			if category, ok := byID[row.CategoryID]; ok {
				copy := category
				rows[i].Category = &copy
			}
		}
	}
	if withTags {
		ids := make([]uint64, len(rows))
		for i, row := range rows {
			ids[i] = row.ID
			rows[i].Tags = []model.Tag{}
		}
		var links []model.ProductTag
		_ = s.db.Where("product_id IN ?", ids).Find(&links).Error
		tagIDs := map[uint64]struct{}{}
		for _, link := range links {
			tagIDs[link.TagID] = struct{}{}
		}
		keys := make([]uint64, 0, len(tagIDs))
		for id := range tagIDs {
			keys = append(keys, id)
		}
		var tags []model.Tag
		if len(keys) > 0 {
			_ = s.db.Where("id IN ?", keys).Find(&tags).Error
		}
		byID := map[uint64]model.Tag{}
		for _, tag := range tags {
			byID[tag.ID] = tag
		}
		grouped := map[uint64][]model.Tag{}
		for _, link := range links {
			if tag, ok := byID[link.TagID]; ok {
				grouped[link.ProductID] = append(grouped[link.ProductID], tag)
			}
		}
		for i, row := range rows {
			if items, ok := grouped[row.ID]; ok {
				rows[i].Tags = items
			}
		}
	}
}

func (s *Server) findProduct(id uint64) (model.Product, error) {
	var row model.Product
	if err := s.db.First(&row, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return row, &appError{status: http.StatusNotFound, message: "Product not found"}
		}
		return row, err
	}
	return row, nil
}

func (s *Server) ensureTags(ids []uint64) error {
	if len(ids) == 0 {
		return nil
	}
	var count int64
	if err := s.db.Model(&model.Tag{}).Where("id IN ?", ids).Count(&count).Error; err != nil {
		return err
	}
	if int(count) != len(ids) {
		return &appError{status: http.StatusUnprocessableEntity, message: "Validation failed", errors: fieldErrors{"tags": {"One or more selected tags are invalid."}}}
	}
	return nil
}

func tagList(body map[string]any) ([]uint64, bool, bool) {
	raw, exists := body["tags"]
	if !exists {
		raw, exists = body["tag_ids"]
	}
	if !exists {
		return nil, false, true
	}
	list, ok := raw.([]any)
	if !ok || len(list) == 0 {
		return nil, true, false
	}
	seen := map[uint64]struct{}{}
	ids := make([]uint64, 0, len(list))
	for _, item := range list {
		id, ok := asUint(item)
		if !ok {
			return nil, true, false
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	return ids, true, true
}

func parsePositive(raw string) (uint64, error) {
	return asUintStrict(raw)
}

func asUintStrict(raw string) (uint64, error) {
	id, ok := asUint(raw)
	if !ok {
		return 0, errors.New("invalid")
	}
	return id, nil
}
