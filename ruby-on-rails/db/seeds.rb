# Demo data copied from the Express seeder. Re-running this task wipes those tables first.
# Cancelled seed orders keep the stock decrement from checkout, matching that seeder:
# status is written directly and does not go through the cancel/restore path.

USERS = [
  { name: "User", email: "user@example.com", password: "password", role: "user" },
  { name: "User 2", email: "user2@example.com", password: "password", role: "user" },
  { name: "User 3", email: "user3@example.com", password: "password", role: "user" },
  { name: "User 4", email: "user4@example.com", password: "password", role: "user" },
  { name: "User 5", email: "user5@example.com", password: "password", role: "user" }
].freeze

CATEGORIES = [
  { name: "Electronics", description: "Phones, laptops, audio and every day gadgets." },
  { name: "Books", description: "Fiction, non fiction and academic books." },
  { name: "Home & Living", description: "Kitchenware, decoration and furniture." }
].freeze

TAGS = ["Featured", "New Arrival", "Best Seller", "Discount", "Premium", "Eco Friendly"].freeze

PRODUCTS = [
  { category: "Electronics", name: "Smartphone X Pro", price: 8_990_000, stock: 40, description: "6.7 inch AMOLED display with a triple camera." },
  { category: "Electronics", name: "Wireless Earbuds Z", price: 749_000, stock: 120, description: "Active noise cancelling earbuds with 30 hours of playback." },
  { category: "Electronics", name: "Ultra Slim Laptop 14", price: 15_999_000, stock: 25, description: "14 inch ultrabook with 16GB RAM and 512GB SSD." },
  { category: "Electronics", name: "Smart Watch S2", price: 1_299_000, stock: 80, description: "GPS tracking, heart rate and sleep monitoring." },
  { category: "Electronics", name: "Mechanical Keyboard K1", price: 899_000, stock: 60, description: "Hot swappable switches with a aluminium frame." },
  { category: "Books", name: "The Pragmatic Programmer", price: 289_000, stock: 200, description: "A classic guide to software craftsmanship." },
  { category: "Books", name: "Clean Architecture", price: 315_000, stock: 150, description: "A craftsman guide to software structure and design." },
  { category: "Books", name: "Daring Greatly", price: 199_000, stock: 180, description: "How to build a remarkable life at work." },
  { category: "Home & Living", name: "Cast Iron Skillet 26cm", price: 349_000, stock: 90, description: "Pre seasoned skillet, oven safe up to 260C." },
  { category: "Home & Living", name: "Linen Table Runner", price: 129_000, stock: 140, description: "Hand washed linen runner for a 180cm table." }
].freeze

ORDERS = [
  { user: 0, status: "completed", items: [{ product: 0, quantity: 1 }, { product: 4, quantity: 2 }] },
  { user: 1, status: "shipped", items: [{ product: 2, quantity: 1 }] },
  { user: 2, status: "paid", items: [{ product: 1, quantity: 3 }] },
  { user: 3, status: "pending", items: [{ product: 5, quantity: 2 }, { product: 7, quantity: 1 }] },
  { user: 4, status: "completed", items: [{ product: 8, quantity: 1 }] },
  { user: 0, status: "cancelled", items: [{ product: 3, quantity: 1 }] },
  { user: 1, status: "paid", items: [{ product: 6, quantity: 4 }] },
  { user: 2, status: "pending", items: [{ product: 9, quantity: 2 }] },
  { user: 3, status: "shipped", items: [{ product: 0, quantity: 2 }, { product: 1, quantity: 1 }] },
  { user: 4, status: "completed", items: [{ product: 5, quantity: 1 }, { product: 8, quantity: 2 }] }
].freeze

COMMENTS = [
  { product: 0, user: 1, body: "Battery life is honestly better than advertised." },
  { product: 0, user: 2, body: "Great phone, only wish the charger was included." },
  { product: 0, user: 3, body: "Camera performs well even at night." },
  { product: 1, user: 0, body: "Comfortable for long listening sessions." },
  { product: 1, user: 4, body: "The case is a little bulky but the sound is excellent." },
  { product: 2, user: 2, body: "Replaced my old laptop and the difference is night and day." },
  { product: 2, user: 3, body: "Keyboard travel is comfortable for long coding sessions." },
  { product: 3, user: 1, body: "Battery lasts about three days with notifications on." },
  { product: 4, user: 0, body: "The tactile feel of these switches is superb." },
  { product: 4, user: 2, body: "Loud enough for an office, not for late night work." },
  { product: 5, user: 3, body: "Still relevant in 2026, highly recommended." },
  { product: 6, user: 4, body: "Changed how I structure my projects." },
  { product: 7, user: 1, body: "A gentle book that rewards a slow reader." },
  { product: 8, user: 2, body: "Pre seasoning works perfectly out of the box." },
  { product: 9, user: 0, body: "Colour matches the photos and it washes well." }
].freeze

ActiveRecord::Base.connection.disable_referential_integrity do
  [Comment, OrderItem, Order, ProductTag, Product, Tag, Category, User].each(&:delete_all)
end

if ActiveRecord::Base.connection.adapter_name.to_s.downcase.include?("sqlite")
  %w[users categories tags products product_tag orders order_items comments].each do |table|
    ActiveRecord::Base.connection.execute("DELETE FROM sqlite_sequence WHERE name = #{ActiveRecord::Base.connection.quote(table)}")
  rescue ActiveRecord::StatementInvalid
    nil
  end
end

users = []
users << User.create!(name: "Site Administrator", email: "admin@example.com", password: "password", role: "admin")
USERS.each { |row| users << User.create!(row) }

categories = {}
CATEGORIES.each do |row|
  category = Category.new(name: row[:name], description: row[:description])
  category.slug = Slugify.call(row[:name], max: 120)
  category.save!
  categories[row[:name]] = category
end

tags = TAGS.map do |name|
  tag = Tag.new(name: name)
  tag.slug = Slugify.call(name, max: 80)
  tag.save!
  tag
end

products = []
PRODUCTS.each_with_index do |row, index|
  product = Product.new(
    category_id: categories.fetch(row[:category]).id,
    name: row[:name],
    description: row[:description],
    price: row[:price],
    stock: row[:stock]
  )
  product.slug = Slugify.call(row[:name], max: 180)
  product.save!
  assigned = tags.select.with_index { |_tag, tag_index| (tag_index + index) % 3 == 0 }
  product.tags = assigned if assigned.any?
  products << product
end

ORDERS.each do |row|
  order = OrderCheckout.create(
    user: users[row[:user]],
    items: row[:items].map { |item| { "product_id" => products[item[:product]].id, "quantity" => item[:quantity] } }
  )
  next if row[:status] == "pending"

  order.update_columns(status: row[:status], updated_at: Time.current)
end

COMMENTS.each do |row|
  Comment.create!(
    product_id: products[row[:product]].id,
    user_id: users[row[:user]].id,
    body: row[:body]
  )
end

puts "[seed] demo data created: users=#{users.size} categories=#{categories.size} tags=#{tags.size} products=#{products.size} orders=#{Order.count} comments=#{Comment.count}"
puts "[seed] admin login -> admin@example.com / password"
