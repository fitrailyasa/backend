class Product < ApplicationRecord
  belongs_to :category
  has_many :product_tags, dependent: :destroy
  has_many :tags, -> { order(:id) }, through: :product_tags
  has_many :order_items, dependent: :restrict_with_exception
  has_many :comments, dependent: :destroy

  validates :name, presence: true, length: { minimum: 2, maximum: 150 }
  validates :slug, presence: true, length: { maximum: 180 }
  validates :price, numericality: { greater_than_or_equal_to: 0 }
  validates :stock, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
