class Order < ApplicationRecord
  STATUSES = %w[pending paid shipped completed cancelled].freeze

  enum :status, {
    pending: "pending",
    paid: "paid",
    shipped: "shipped",
    completed: "completed",
    cancelled: "cancelled"
  }, validate: true, default: "pending"

  belongs_to :user
  has_many :items, -> { order(:id) }, class_name: "OrderItem", dependent: :destroy, inverse_of: :order

  validates :total, numericality: { greater_than_or_equal_to: 0 }
end
