class ProductTag < ApplicationRecord
  self.table_name = "product_tag"

  belongs_to :product
  belongs_to :tag
end
