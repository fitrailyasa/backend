package model

import "time"

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

var OrderStatuses = []string{"pending", "paid", "shipped", "completed", "cancelled"}
