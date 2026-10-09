package model

import "time"

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
