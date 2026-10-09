package httpapi

import (
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (s *Server) listCategories(c *gin.Context) {
	query, include, ok := s.paginationWithInclude(c, []string{"id", "name", "slug", "created_at", "updated_at"}, []string{"products"})
	if !ok {
		return
	}
	db := s.db.Model(&model.Category{})
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		like := likePattern(search)
		db = db.Where("name LIKE ? OR description LIKE ?", like, like)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.Category
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if include["products"] {
		s.attachCategoryProducts(rows)
	}
	s.pageOK(c, "Categories retrieved", rows, metaFor(total, query))
}

func (s *Server) getCategory(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	include, ok := s.includes(c, []string{"products"})
	if !ok {
		return
	}
	row, err := s.findCategory(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if include["products"] {
		rows := []model.Category{row}
		s.attachCategoryProducts(rows)
		row = rows[0]
	}
	s.ok(c, "Category retrieved", row)
}

func (s *Server) createCategory(c *gin.Context) { s.saveCategory(c, 0, true) }
func (s *Server) replaceCategory(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveCategory(c, id, true)
}
func (s *Server) patchCategory(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveCategory(c, id, false)
}

func (s *Server) saveCategory(c *gin.Context, id uint64, required bool) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	var row model.Category
	if id > 0 {
		found, err := s.findCategory(id)
		if err != nil {
			s.writeErr(c, err)
			return
		}
		row = found
	}
	errs := fieldErrors{}
	if _, exists := body["name"]; exists || required {
		name, isString := text(body, "name")
		name = strings.TrimSpace(name)
		if !exists || name == "" {
			errs.add("name", "Name is required.")
		} else if !isString {
			errs.add("name", "Name must be a string.")
		} else if len(name) < 2 || len(name) > 100 {
			errs.add("name", "Name must be between 2 and 100 characters.")
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
	} else if id == 0 || (required && row.Slug == "") {
		row.Slug = slugify(row.Name)
	}
	if desc, present, ok := optionalString(body, "description"); present {
		if !ok {
			errs.add("description", "Description must be a string.")
		} else {
			row.Description = desc
		}
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	if err := s.uniqueSlug("categories", row.Slug, row.ID); err != nil {
		s.writeErr(c, err)
		return
	}
	var err error
	if id == 0 {
		err = s.db.Create(&row).Error
	} else {
		err = s.db.Save(&row).Error
	}
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if id == 0 {
		s.created(c, "Category created successfully", row)
		return
	}
	s.ok(c, "Category updated successfully", row)
}

func (s *Server) deleteCategory(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	if _, err := s.findCategory(id); err != nil {
		s.writeErr(c, err)
		return
	}
	var products int64
	if err := s.db.Model(&model.Product{}).Where("category_id = ?", id).Count(&products).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	if products > 0 {
		s.fail(c, http.StatusConflict, "Resource is still referenced by other records", nil)
		return
	}
	if err := s.db.Delete(&model.Category{}, id).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Category deleted successfully", nil)
}

func (s *Server) findCategory(id uint64) (model.Category, error) {
	var row model.Category
	if err := s.db.First(&row, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return row, &appError{status: http.StatusNotFound, message: "Category not found"}
		}
		return row, err
	}
	return row, nil
}

func (s *Server) attachCategoryProducts(rows []model.Category) {
	if len(rows) == 0 {
		return
	}
	ids := make([]uint64, len(rows))
	for i, row := range rows {
		ids[i] = row.ID
		rows[i].Products = []model.Product{}
	}
	var products []model.Product
	_ = s.db.Where("category_id IN ?", ids).Order("id desc").Find(&products).Error
	grouped := map[uint64][]model.Product{}
	for _, product := range products {
		grouped[product.CategoryID] = append(grouped[product.CategoryID], product)
	}
	for i, row := range rows {
		if items, ok := grouped[row.ID]; ok {
			rows[i].Products = items
		}
	}
}
