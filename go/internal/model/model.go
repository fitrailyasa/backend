package model

import "time"

type User struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Email     string    `gorm:"size:150;not null;uniqueIndex" json:"email"`
	Password  string    `gorm:"size:255;not null" json:"-"`
	Role      string    `gorm:"size:20;not null;default:user" json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (User) TableName() string { return "users" }

type Category struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name        string    `gorm:"size:100;not null" json:"name"`
	Slug        string    `gorm:"size:120;not null;uniqueIndex" json:"slug"`
	Description *string   `gorm:"type:text" json:"description"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Products    []Product `gorm:"-" json:"products,omitempty"`
}

func (Category) TableName() string { return "categories" }

type Tag struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	Name      string    `gorm:"size:100;not null" json:"name"`
	Slug      string    `gorm:"size:120;not null;uniqueIndex" json:"slug"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (Tag) TableName() string { return "tags" }

type Product struct {
	ID          uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	CategoryID  uint64    `gorm:"column:category_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"category_id"`
	Name        string    `gorm:"size:150;not null" json:"name"`
	Slug        string    `gorm:"size:180;not null;uniqueIndex" json:"slug"`
	Description *string   `gorm:"type:text" json:"description"`
	Price       float64   `gorm:"type:decimal(12,2);not null" json:"price"`
	Stock       int       `gorm:"not null;default:0" json:"stock"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	Category    *Category `gorm:"-" json:"category,omitempty"`
	Tags        []Tag     `gorm:"-" json:"tags,omitempty"`
}

func (Product) TableName() string { return "products" }

type ProductTag struct {
	ProductID uint64 `gorm:"primaryKey;column:product_id;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	TagID     uint64 `gorm:"primaryKey;column:tag_id;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (ProductTag) TableName() string { return "product_tag" }

type Order struct {
	ID        uint64      `gorm:"primaryKey;autoIncrement" json:"id"`
	UserID    uint64      `gorm:"column:user_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"user_id"`
	Status    string      `gorm:"size:20;not null;default:pending" json:"status"`
	Total     float64     `gorm:"type:decimal(12,2);not null;default:0" json:"total"`
	CreatedAt time.Time   `json:"created_at"`
	UpdatedAt time.Time   `json:"updated_at"`
	User      *User       `gorm:"-" json:"user,omitempty"`
	Items     []OrderItem `gorm:"-" json:"items,omitempty"`
}

func (Order) TableName() string { return "orders" }

type OrderItem struct {
	ID        uint64   `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID   uint64   `gorm:"column:order_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"order_id"`
	ProductID uint64   `gorm:"column:product_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"product_id"`
	Quantity  int      `gorm:"not null" json:"quantity"`
	Price     float64  `gorm:"type:decimal(12,2);not null" json:"price"`
	Product   *Product `gorm:"-" json:"product,omitempty"`
}

func (OrderItem) TableName() string { return "order_items" }

type Comment struct {
	ID        uint64    `gorm:"primaryKey;autoIncrement" json:"id"`
	ProductID uint64    `gorm:"column:product_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"product_id"`
	UserID    uint64    `gorm:"column:user_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"user_id"`
	Body      string    `gorm:"type:text;not null" json:"body"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	User      *User     `gorm:"-" json:"user,omitempty"`
	Product   *Product  `gorm:"-" json:"product,omitempty"`
}

func (Comment) TableName() string { return "comments" }

var OrderStatuses = []string{"pending", "paid", "shipped", "completed", "cancelled"}
