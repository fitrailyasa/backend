package seed

import (
	"fmt"

	"github.com/backend-starter/go/internal/config"
	"github.com/backend-starter/go/internal/model"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type userSeed struct {
	Name  string
	Email string
	Role  string
}

type productSeed struct {
	Category    string
	Name        string
	Price       float64
	Stock       int
	Description string
}

type orderSeed struct {
	User   int
	Status string
	Items  []itemSeed
}

type itemSeed struct {
	Product  int
	Quantity int
}

type commentSeed struct {
	Product int
	User    int
	Body    string
}

// Run inserts the shared demo catalog when admin@example.com is absent.
// It never drops or rewrites rows that are already stored.
func Run(db *gorm.DB, cfg config.Config) error {
	var existing int64
	if err := db.Model(&model.User{}).Where("email = ?", "admin@example.com").Count(&existing).Error; err != nil {
		return err
	}
	if existing > 0 {
		fmt.Println("[seed] admin@example.com already exists, nothing was changed")
		return nil
	}

	cost := cfg.BcryptRounds
	if cost < bcrypt.MinCost {
		cost = bcrypt.DefaultCost
	}
	hash, err := bcrypt.GenerateFromPassword([]byte("password"), cost)
	if err != nil {
		return err
	}
	password := string(hash)

	people := []userSeed{
		{Name: "Site Administrator", Email: "admin@example.com", Role: "admin"},
		{Name: "User", Email: "user@example.com", Role: "user"},
		{Name: "User 2", Email: "user2@example.com", Role: "user"},
		{Name: "User 3", Email: "user3@example.com", Role: "user"},
		{Name: "User 4", Email: "user4@example.com", Role: "user"},
		{Name: "User 5", Email: "user5@example.com", Role: "user"},
	}
	categories := []struct{ Name, Description string }{
		{"Electronics", "Phones, laptops, audio and every day gadgets."},
		{"Books", "Fiction, non fiction and academic books."},
		{"Home & Living", "Kitchenware, decoration and furniture."},
	}
	tagNames := []string{"Featured", "New Arrival", "Best Seller", "Discount", "Premium", "Eco Friendly"}
	products := []productSeed{
		{"Electronics", "Smartphone X Pro", 8990000, 40, "6.7 inch AMOLED display with a triple camera."},
		{"Electronics", "Wireless Earbuds Z", 749000, 120, "Active noise cancelling earbuds with 30 hours of playback."},
		{"Electronics", "Ultra Slim Laptop 14", 15999000, 25, "14 inch ultrabook with 16GB RAM and 512GB SSD."},
		{"Electronics", "Smart Watch S2", 1299000, 80, "GPS tracking, heart rate and sleep monitoring."},
		{"Electronics", "Mechanical Keyboard K1", 899000, 60, "Hot swappable switches with a aluminium frame."},
		{"Books", "The Pragmatic Programmer", 289000, 200, "A classic guide to software craftsmanship."},
		{"Books", "Clean Architecture", 315000, 150, "A craftsman guide to software structure and design."},
		{"Books", "Daring Greatly", 199000, 180, "How to build a remarkable life at work."},
		{"Home & Living", "Cast Iron Skillet 26cm", 349000, 90, "Pre seasoned skillet, oven safe up to 260C."},
		{"Home & Living", "Linen Table Runner", 129000, 140, "Hand washed linen runner for a 180cm table."},
	}
	orders := []orderSeed{
		{0, "completed", []itemSeed{{0, 1}, {4, 2}}},
		{1, "shipped", []itemSeed{{2, 1}}},
		{2, "paid", []itemSeed{{1, 3}}},
		{3, "pending", []itemSeed{{5, 2}, {7, 1}}},
		{4, "completed", []itemSeed{{8, 1}}},
		{0, "cancelled", []itemSeed{{3, 1}}},
		{1, "paid", []itemSeed{{6, 4}}},
		{2, "pending", []itemSeed{{9, 2}}},
		{3, "shipped", []itemSeed{{0, 2}, {1, 1}}},
		{4, "completed", []itemSeed{{5, 1}, {8, 2}}},
	}
	comments := []commentSeed{
		{0, 1, "Battery life is honestly better than advertised."},
		{0, 2, "Great phone, only wish the charger was included."},
		{0, 3, "Camera performs well even at night."},
		{1, 0, "Comfortable for long listening sessions."},
		{1, 4, "The case is a little bulky but the sound is excellent."},
		{2, 2, "Replaced my old laptop and the difference is night and day."},
		{2, 3, "Keyboard travel is comfortable for long coding sessions."},
		{3, 1, "Battery lasts about three days with notifications on."},
		{4, 0, "The tactile feel of these switches is superb."},
		{4, 2, "Loud enough for an office, not for late night work."},
		{5, 3, "Still relevant in 2026, highly recommended."},
		{6, 4, "Changed how I structure my projects."},
		{7, 1, "A gentle book that rewards a slow reader."},
		{8, 2, "Pre seasoning works perfectly out of the box."},
		{9, 0, "Colour matches the photos and it washes well."},
	}

	return db.Transaction(func(tx *gorm.DB) error {
		users := make([]model.User, 0, len(people))
		for _, person := range people {
			row := model.User{Name: person.Name, Email: person.Email, Password: password, Role: person.Role}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			users = append(users, row)
		}

		categoryByName := map[string]model.Category{}
		for _, item := range categories {
			desc := item.Description
			row := model.Category{Name: item.Name, Slug: slugify(item.Name), Description: &desc}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			categoryByName[item.Name] = row
		}

		tags := make([]model.Tag, 0, len(tagNames))
		for _, name := range tagNames {
			row := model.Tag{Name: name, Slug: slugify(name)}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			tags = append(tags, row)
		}

		storedProducts := make([]model.Product, 0, len(products))
		for _, item := range products {
			desc := item.Description
			row := model.Product{
				CategoryID:  categoryByName[item.Category].ID,
				Name:        item.Name,
				Slug:        slugify(item.Name),
				Description: &desc,
				Price:       item.Price,
				Stock:       item.Stock,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
			for index, tag := range tags {
				if (index+len(storedProducts))%3 == 0 {
					if err := tx.Create(&model.ProductTag{ProductID: row.ID, TagID: tag.ID}).Error; err != nil {
						return err
					}
				}
			}
			storedProducts = append(storedProducts, row)
		}

		for _, item := range orders {
			order := model.Order{UserID: users[item.User].ID, Status: "pending", Total: 0}
			if err := tx.Create(&order).Error; err != nil {
				return err
			}
			var total float64
			for _, line := range item.Items {
				product := storedProducts[line.Product]
				if product.Stock < line.Quantity {
					return fmt.Errorf("seed stock too low for %s", product.Name)
				}
				product.Stock -= line.Quantity
				if err := tx.Model(&model.Product{}).Where("id = ?", product.ID).Update("stock", product.Stock).Error; err != nil {
					return err
				}
				storedProducts[line.Product] = product
				price := product.Price
				if err := tx.Create(&model.OrderItem{
					OrderID: order.ID, ProductID: product.ID, Quantity: line.Quantity, Price: price,
				}).Error; err != nil {
					return err
				}
				total += price * float64(line.Quantity)
			}
			if err := tx.Model(&order).Updates(map[string]any{"total": total, "status": item.Status}).Error; err != nil {
				return err
			}
		}

		for _, item := range comments {
			row := model.Comment{
				ProductID: storedProducts[item.Product].ID,
				UserID:    users[item.User].ID,
				Body:      item.Body,
			}
			if err := tx.Create(&row).Error; err != nil {
				return err
			}
		}

		fmt.Printf("[seed] demo data created: users=%d categories=%d products=%d tags=%d orders=%d comments=%d\n",
			len(users), len(categories), len(storedProducts), len(tags), len(orders), len(comments))
		fmt.Println("[seed] admin login -> admin@example.com / password")
		return nil
	})
}

func slugify(value string) string {
	out := make([]rune, 0, len(value))
	dash := false
	for _, r := range value {
		switch {
		case r >= 'A' && r <= 'Z':
			out = append(out, r+32)
			dash = false
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			out = append(out, r)
			dash = false
		default:
			if !dash && len(out) > 0 {
				out = append(out, '-')
				dash = true
			}
		}
	}
	if len(out) > 0 && out[len(out)-1] == '-' {
		out = out[:len(out)-1]
	}
	if len(out) == 0 {
		return "item"
	}
	if len(out) > 120 {
		out = out[:120]
	}
	return string(out)
}
