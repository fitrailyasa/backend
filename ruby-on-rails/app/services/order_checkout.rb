class OrderCheckout
  def self.create(user:, items:)
    merged = merge_items(items)
    order = nil

    ApplicationRecord.transaction do
      products = load_products(merged.map { |item| item[:product_id] })
      missing = merged.map { |item| item[:product_id] }.find { |id| !products.key?(id) }
      raise ApiError.new("Product with id #{missing} not found", status: 404) if missing

      merged.each do |item|
        product = products[item[:product_id]]
        next if product.stock >= item[:quantity]

        raise ApiError.new(%(Insufficient stock for product "#{product.name}"), status: 409)
      end

      order = Order.create!(user_id: user.id, status: "pending", total: 0)
      total = BigDecimal("0")
      merged.each do |item|
        product = products[item[:product_id]]
        total += product.price.to_d * item[:quantity]
        OrderItem.create!(
          order_id: order.id,
          product_id: product.id,
          quantity: item[:quantity],
          price: product.price
        )
        product.update!(stock: product.stock - item[:quantity])
      end
      order.update!(total: total.round(2))
    end

    Order.includes(items: :product).find(order.id)
  end

  def self.update_status(order, status, user)
    return order if order.status == status

    if user.role != "admin" && !(order.status == "pending" && status == "cancelled")
      raise ApiError.new("This action is unauthorized", status: 403)
    end

    ApplicationRecord.transaction do
      previous = order.status
      if previous != "cancelled" && status == "cancelled"
        adjust_stock(order, :increment)
      elsif previous == "cancelled" && status != "cancelled"
        adjust_stock(order, :decrement)
      end
      order.update!(status: status)
    end

    order
  end

  def self.destroy(order)
    ApplicationRecord.transaction do
      adjust_stock(order, :increment) unless order.status == "cancelled"
      order.destroy!
    end
    true
  end

  def self.merge_items(items)
    totals = {}
    order = []
    items.each do |item|
      product_id = (item["product_id"] || item[:product_id]).to_i
      quantity = (item["quantity"] || item[:quantity]).to_i
      unless totals.key?(product_id)
        totals[product_id] = 0
        order << product_id
      end
      totals[product_id] += quantity
    end
    order.map { |product_id| { product_id: product_id, quantity: totals[product_id] } }
  end

  def self.load_products(ids)
    scope = Product.where(id: ids)
    scope = scope.lock if mysql?
    scope.index_by { |product| product.id.to_i }
  end

  def self.adjust_stock(order, direction)
    OrderItem.where(order_id: order.id).pluck(:product_id, :quantity).each do |product_id, quantity|
      scope = Product.where(id: product_id)
      scope = scope.lock if mysql?
      product = scope.first
      next unless product

      next_stock = direction == :increment ? product.stock + quantity : product.stock - quantity
      product.update!(stock: [next_stock, 0].max)
    end
  end

  def self.mysql?
    ApplicationRecord.connection.adapter_name.to_s.downcase.include?("mysql")
  end

  private_class_method :merge_items, :load_products, :adjust_stock, :mysql?
end
