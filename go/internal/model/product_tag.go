package model

type ProductTag struct {
	ProductID uint64 `gorm:"primaryKey;column:product_id;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
	TagID     uint64 `gorm:"primaryKey;column:tag_id;constraint:OnUpdate:CASCADE,OnDelete:CASCADE"`
}

func (ProductTag) TableName() string { return "product_tag" }
