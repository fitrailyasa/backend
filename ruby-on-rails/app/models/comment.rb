class Comment < ApplicationRecord
  belongs_to :product
  belongs_to :user

  validates :body, presence: true, length: { minimum: 1, maximum: 2000 }
end
