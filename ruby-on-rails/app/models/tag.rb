class Tag < ApplicationRecord
  has_many :product_tags, dependent: :destroy
  has_many :products, -> { order(:id) }, through: :product_tags

  validates :name, presence: true, length: { minimum: 2, maximum: 60 }
  validates :slug, presence: true, length: { maximum: 80 }
end
