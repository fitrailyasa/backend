package model

import "time"

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
