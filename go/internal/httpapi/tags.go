package httpapi

import (
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func (s *Server) listTags(c *gin.Context) {
	query, ok := s.pagination(c, []string{"id", "name", "slug", "created_at", "updated_at"})
	if !ok {
		return
	}
	db := s.db.Model(&model.Tag{})
	if search := strings.TrimSpace(c.Query("search")); search != "" {
		db = db.Where("name LIKE ?", likePattern(search))
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.Tag
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.pageOK(c, "Tags retrieved", rows, metaFor(total, query))
}

func (s *Server) getTag(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	row, err := s.findTag(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Tag retrieved", row)
}

func (s *Server) createTag(c *gin.Context) { s.saveTag(c, 0, true) }
func (s *Server) replaceTag(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveTag(c, id, true)
}
func (s *Server) patchTag(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	s.saveTag(c, id, false)
}

func (s *Server) saveTag(c *gin.Context, id uint64, required bool) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	var row model.Tag
	if id > 0 {
		found, err := s.findTag(id)
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
	} else if id == 0 {
		row.Slug = slugify(row.Name)
	}
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	if err := s.uniqueSlug("tags", row.Slug, row.ID); err != nil {
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
		s.created(c, "Tag created successfully", row)
		return
	}
	s.ok(c, "Tag updated successfully", row)
}

func (s *Server) deleteTag(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	if _, err := s.findTag(id); err != nil {
		s.writeErr(c, err)
		return
	}
	if err := s.db.Delete(&model.Tag{}, id).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Tag deleted successfully", nil)
}

func (s *Server) findTag(id uint64) (model.Tag, error) {
	var row model.Tag
	if err := s.db.First(&row, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return row, &appError{status: http.StatusNotFound, message: "Tag not found"}
		}
		return row, err
	}
	return row, nil
}
