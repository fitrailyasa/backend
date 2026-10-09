package model

import "time"

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
