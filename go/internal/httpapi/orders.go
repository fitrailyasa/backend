package httpapi

import (
	"fmt"
	"math"
	"net/http"
	"strings"

	"github.com/backend-starter/go/internal/model"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

func (s *Server) listOrders(c *gin.Context) {
	query, include, ok := s.paginationWithInclude(c, []string{"id", "status", "total", "user_id", "created_at", "updated_at"}, []string{"items", "items.product", "user"})
	if !ok {
		return
	}
	db := s.db.Model(&model.Order{})
	user := current(c)
	if raw := c.Query("user_id"); raw != "" && user.Role != "admin" {
		s.fail(c, http.StatusForbidden, "The user_id filter is only available to administrators", nil)
		return
	}
	if user.Role != "admin" {
		db = db.Where("user_id = ?", user.ID)
	} else if raw := c.Query("user_id"); raw != "" {
		id, err := parsePositive(raw)
		if err != nil {
			s.validation(c, fieldErrors{"user_id": {"user_id must be a positive integer."}})
			return
		}
		db = db.Where("user_id = ?", id)
	}
	if raw := strings.TrimSpace(c.Query("status")); raw != "" {
		if !contains(model.OrderStatuses, raw) {
			s.validation(c, fieldErrors{"status": {"Status must be one of: pending, paid, shipped, completed, cancelled."}})
			return
		}
		db = db.Where("status = ?", raw)
	}
	var total int64
	if err := db.Count(&total).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	var rows []model.Order
	if err := db.Order(query.Sort + " " + query.Dir).Limit(query.Limit).Offset(query.Offset).Find(&rows).Error; err != nil {
		s.writeErr(c, err)
		return
	}
	s.attachOrders(rows, include)
	s.pageOK(c, "Orders retrieved", rows, metaFor(total, query))
}

func (s *Server) getOrder(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	include, ok := s.includes(c, []string{"items", "items.product", "user"})
	if !ok {
		return
	}
	row, err := s.findOrder(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if !s.owns(c, row.UserID) {
		return
	}
	rows := []model.Order{row}
	s.attachOrders(rows, include)
	s.ok(c, "Order retrieved", rows[0])
}

func (s *Server) createOrder(c *gin.Context) {
	body, ok := s.bind(c)
	if !ok {
		return
	}
	items, errs := orderItems(body)
	if len(errs) > 0 {
		s.validation(c, errs)
		return
	}
	user := current(c)
	var created model.Order
	err := s.db.Transaction(func(tx *gorm.DB) error {
		ids := make([]uint64, 0, len(items))
		for _, line := range items {
			ids = append(ids, line.ProductID)
		}
		q := tx.Where("id IN ?", ids)
		if s.cfg.Dialect == "mysql" {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		var products []model.Product
		if err := q.Find(&products).Error; err != nil {
			return err
		}
		byID := map[uint64]model.Product{}
		for _, product := range products {
			byID[product.ID] = product
		}
		for _, line := range items {
			if _, found := byID[line.ProductID]; !found {
				return &appError{status: http.StatusNotFound, message: fmt.Sprintf("Product with id %d not found", line.ProductID)}
			}
		}
		for _, line := range items {
			product := byID[line.ProductID]
			if product.Stock < line.Quantity {
				return &appError{status: http.StatusConflict, message: fmt.Sprintf("Insufficient stock for product %q", product.Name)}
			}
		}
		created = model.Order{UserID: user.ID, Status: "pending", Total: 0}
		if err := tx.Create(&created).Error; err != nil {
			return err
		}
		var total float64
		for _, line := range items {
			product := byID[line.ProductID]
			if err := tx.Create(&model.OrderItem{
				OrderID: created.ID, ProductID: product.ID, Quantity: line.Quantity, Price: product.Price,
			}).Error; err != nil {
				return err
			}
			if err := tx.Model(&model.Product{}).Where("id = ?", product.ID).Update("stock", product.Stock-line.Quantity).Error; err != nil {
				return err
			}
			total += product.Price * float64(line.Quantity)
		}
		created.Total = math.Round(total*100) / 100
		return tx.Model(&created).Update("total", created.Total).Error
	})
	if err != nil {
		s.writeErr(c, err)
		return
	}
	rows := []model.Order{created}
	s.attachOrders(rows, map[string]bool{"items": true, "items.product": true})
	s.created(c, "Order created successfully", rows[0])
}

func (s *Server) updateOrderStatus(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	body, ok := s.bind(c)
	if !ok {
		return
	}
	status, isString := text(body, "status")
	status = strings.TrimSpace(status)
	if !isString || status == "" || !contains(model.OrderStatuses, status) {
		message := "Status is required."
		if isString && status != "" {
			message = "Status must be one of: pending, paid, shipped, completed, cancelled."
		}
		s.validation(c, fieldErrors{"status": {message}})
		return
	}
	order, err := s.findOrder(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	if !s.owns(c, order.UserID) {
		return
	}
	user := current(c)
	if order.Status == status {
		s.ok(c, "Order status updated successfully", order)
		return
	}
	if user.Role != "admin" && !(order.Status == "pending" && status == "cancelled") {
		s.fail(c, http.StatusForbidden, "This action is unauthorized", nil)
		return
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		previous := order.Status
		if previous != "cancelled" && status == "cancelled" {
			if err := adjustStock(tx, order.ID, 1, s.cfg.Dialect); err != nil {
				return err
			}
		} else if previous == "cancelled" && status != "cancelled" {
			if err := adjustStock(tx, order.ID, -1, s.cfg.Dialect); err != nil {
				return err
			}
		}
		order.Status = status
		return tx.Model(&order).Update("status", status).Error
	})
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Order status updated successfully", order)
}

func (s *Server) deleteOrder(c *gin.Context) {
	id, ok := s.idParam(c, "id")
	if !ok {
		return
	}
	order, err := s.findOrder(id)
	if err != nil {
		s.writeErr(c, err)
		return
	}
	err = s.db.Transaction(func(tx *gorm.DB) error {
		if order.Status != "cancelled" {
			if err := adjustStock(tx, order.ID, 1, s.cfg.Dialect); err != nil {
				return err
			}
		}
		if err := tx.Where("order_id = ?", order.ID).Delete(&model.OrderItem{}).Error; err != nil {
			return err
		}
		return tx.Delete(&model.Order{}, order.ID).Error
	})
	if err != nil {
		s.writeErr(c, err)
		return
	}
	s.ok(c, "Order deleted successfully", nil)
}

func (s *Server) owns(c *gin.Context, ownerID uint64) bool {
	user := current(c)
	if user.Role == "admin" || user.ID == ownerID {
		return true
	}
	s.fail(c, http.StatusForbidden, "This action is unauthorized", nil)
	return false
}

func (s *Server) findOrder(id uint64) (model.Order, error) {
	var row model.Order
	if err := s.db.First(&row, id).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			return row, &appError{status: http.StatusNotFound, message: "Order not found"}
		}
		return row, err
	}
	return row, nil
}

func (s *Server) attachOrders(rows []model.Order, include map[string]bool) {
	if len(rows) == 0 {
		return
	}
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
		_ = s.db.Where("id IN ?", keys).Find(&users).Error
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
	if include["items"] || include["items.product"] {
		ids := make([]uint64, len(rows))
		for i, row := range rows {
			ids[i] = row.ID
			rows[i].Items = []model.OrderItem{}
		}
		var items []model.OrderItem
		_ = s.db.Where("order_id IN ?", ids).Order("id asc").Find(&items).Error
		if include["items.product"] && len(items) > 0 {
			productIDs := map[uint64]struct{}{}
			for _, item := range items {
				productIDs[item.ProductID] = struct{}{}
			}
			keys := make([]uint64, 0, len(productIDs))
			for id := range productIDs {
				keys = append(keys, id)
			}
			var products []model.Product
			_ = s.db.Where("id IN ?", keys).Find(&products).Error
			byID := map[uint64]model.Product{}
			for _, product := range products {
				byID[product.ID] = product
			}
			for i, item := range items {
				if product, ok := byID[item.ProductID]; ok {
					copy := product
					items[i].Product = &copy
				}
			}
		}
		grouped := map[uint64][]model.OrderItem{}
		for _, item := range items {
			grouped[item.OrderID] = append(grouped[item.OrderID], item)
		}
		for i, row := range rows {
			if found, ok := grouped[row.ID]; ok {
				rows[i].Items = found
			}
		}
	}
}

type orderLine struct {
	ProductID uint64
	Quantity  int
}

func orderItems(body map[string]any) ([]orderLine, fieldErrors) {
	errs := fieldErrors{}
	raw, exists := body["items"]
	if !exists || raw == nil {
		errs.add("items", "Items is required.")
		return nil, errs
	}
	list, ok := raw.([]any)
	if !ok || len(list) == 0 || len(list) > 100 {
		errs.add("items", "Items must be a non-empty array.")
		return nil, errs
	}
	indexOf := map[uint64]int{}
	lines := make([]orderLine, 0, len(list))
	for index, item := range list {
		obj, ok := item.(map[string]any)
		if !ok {
			errs.add("items", fmt.Sprintf("items.%d must be an object.", index))
			continue
		}
		productID, ok := asUint(obj["product_id"])
		if !ok {
			errs.add("items", fmt.Sprintf("items.%d.product_id must be a positive integer.", index))
			continue
		}
		quantity, ok := asInt(obj["quantity"])
		if !ok || quantity < 1 {
			errs.add("items", fmt.Sprintf("items.%d.quantity must be an integer greater than or equal to 1.", index))
			continue
		}
		if at, found := indexOf[productID]; found {
			lines[at].Quantity += quantity
			continue
		}
		indexOf[productID] = len(lines)
		lines = append(lines, orderLine{ProductID: productID, Quantity: quantity})
	}
	return lines, errs
}

func adjustStock(tx *gorm.DB, orderID uint64, direction int, dialect string) error {
	var items []model.OrderItem
	if err := tx.Where("order_id = ?", orderID).Find(&items).Error; err != nil {
		return err
	}
	for _, item := range items {
		q := tx.Model(&model.Product{}).Where("id = ?", item.ProductID)
		if dialect == "mysql" {
			q = q.Clauses(clause.Locking{Strength: "UPDATE"})
		}
		var product model.Product
		if err := q.First(&product).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				continue
			}
			return err
		}
		next := product.Stock + direction*item.Quantity
		if next < 0 {
			next = 0
		}
		if err := tx.Model(&model.Product{}).Where("id = ?", product.ID).Update("stock", next).Error; err != nil {
			return err
		}
	}
	return nil
}
