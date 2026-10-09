package model

type OrderItem struct {
	ID        uint64   `gorm:"primaryKey;autoIncrement" json:"id"`
	OrderID   uint64   `gorm:"column:order_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:CASCADE" json:"order_id"`
	ProductID uint64   `gorm:"column:product_id;not null;index;constraint:OnUpdate:CASCADE,OnDelete:RESTRICT" json:"product_id"`
	Quantity  int      `gorm:"not null" json:"quantity"`
	Price     float64  `gorm:"type:decimal(12,2);not null" json:"price"`
	Product   *Product `gorm:"-" json:"product,omitempty"`
}

func (OrderItem) TableName() string { return "order_items" }
