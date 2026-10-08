class Category < ApplicationRecord
  has_many :products, -> { order(:id) }, dependent: :restrict_with_exception

  validates :name, presence: true, length: { minimum: 2, maximum: 100 }
  validates :slug, presence: true, length: { maximum: 120 }
end
