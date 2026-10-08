module ApiSerializer
  module_function

  def money(value)
    return nil if value.nil?

    decimal = value.is_a?(BigDecimal) ? value : BigDecimal(value.to_s)
    decimal.frac.zero? ? decimal.to_i : decimal.to_f
  end

  def time(value)
    value&.utc&.iso8601(3)
  end

  def user(record)
    return nil unless record

    {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
  end

  def category(record, includes: [])
    data = {
      id: record.id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    data[:products] = record.products.map { |product| product(product) } if includes.include?("products")
    data
  end

  def tag(record, includes: [])
    data = {
      id: record.id,
      name: record.name,
      slug: record.slug,
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    data[:products] = record.products.map { |product| product(product) } if includes.include?("products")
    data
  end

  def product(record, includes: [])
    data = {
      id: record.id,
      category_id: record.category_id,
      name: record.name,
      slug: record.slug,
      description: record.description,
      price: money(record.price),
      stock: record.stock,
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    data[:category] = category(record.category) if includes.include?("category")
    data[:tags] = record.tags.map { |item| tag(item) } if includes.include?("tags")
    data
  end

  def order_item(record, with_product: false)
    data = {
      id: record.id,
      order_id: record.order_id,
      product_id: record.product_id,
      quantity: record.quantity,
      price: money(record.price),
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    data[:product] = product(record.product) if with_product
    data
  end

  def order(record, includes: [])
    data = {
      id: record.id,
      user_id: record.user_id,
      status: record.status,
      total: money(record.total),
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    with_product = includes.include?("items.product")
    if includes.include?("items") || with_product
      data[:items] = record.items.map { |item| order_item(item, with_product: with_product) }
    end
    data[:user] = user(record.user) if includes.include?("user")
    data
  end

  def comment(record, includes: [])
    data = {
      id: record.id,
      product_id: record.product_id,
      user_id: record.user_id,
      body: record.body,
      created_at: time(record.created_at),
      updated_at: time(record.updated_at)
    }
    data[:user] = user(record.user) if includes.include?("user")
    data[:product] = product(record.product) if includes.include?("product")
    data
  end

  def auth(user, issued)
    {
      user: user(user),
      token: issued[:token],
      refresh_token: issued[:refresh_token],
      token_type: "Bearer",
      expires_in: issued[:expires_in]
    }
  end
end
