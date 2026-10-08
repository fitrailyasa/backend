class CreateBackendStarterSchema < ActiveRecord::Migration[7.2]
  def change
    create_users
    create_categories
    create_tags
    create_products
    create_product_tag
    create_orders
    create_order_items
    create_comments
  end

  private

  def mysql?
    connection.adapter_name.to_s.downcase.include?("mysql")
  end

  def create_app_table(name)
    if mysql?
      create_table name, id: false, charset: "utf8mb4", collation: "utf8mb4_unicode_ci" do |table|
        table.column :id, "bigint unsigned", null: false, auto_increment: true, primary_key: true
        yield table
      end
    else
      create_table name, id: :bigint do |table|
        yield table
      end
    end
  end

  def reference(table, name, null:)
    if mysql?
      table.column "#{name}_id", "bigint unsigned", null: null
    else
      table.bigint "#{name}_id", null: null
    end
  end

  def role_column(table)
    if mysql?
      table.column :role, "enum('user','admin')", null: false, default: "user"
    else
      table.string :role, null: false, default: "user", limit: 20
    end
  end

  def status_column(table)
    if mysql?
      table.column :status, "enum('pending','paid','shipped','completed','cancelled')", null: false, default: "pending"
    else
      table.string :status, null: false, default: "pending", limit: 20
    end
  end

  def create_users
    create_app_table :users do |t|
      t.string :name, null: false, limit: 100
      t.string :email, null: false, limit: 150
      t.string :password, null: false, limit: 255
      role_column(t)
      t.timestamps null: false
    end
    add_index :users, :email, unique: true
  end

  def create_categories
    create_app_table :categories do |t|
      t.string :name, null: false, limit: 100
      t.string :slug, null: false, limit: 120
      t.text :description
      t.timestamps null: false
    end
    add_index :categories, :slug, unique: true
  end

  def create_tags
    create_app_table :tags do |t|
      t.string :name, null: false, limit: 60
      t.string :slug, null: false, limit: 80
      t.timestamps null: false
    end
    add_index :tags, :slug, unique: true
  end

  def create_products
    create_app_table :products do |t|
      reference(t, :category, null: false)
      t.string :name, null: false, limit: 150
      t.string :slug, null: false, limit: 180
      t.text :description
      t.decimal :price, precision: 12, scale: 2, null: false
      t.integer :stock, null: false, default: 0
      t.timestamps null: false
    end
    add_index :products, :category_id
    add_index :products, :slug, unique: true
    add_foreign_key :products, :categories, on_delete: :restrict
  end

  def create_product_tag
    create_app_table :product_tag do |t|
      reference(t, :product, null: false)
      reference(t, :tag, null: false)
    end
    add_index :product_tag, :product_id
    add_index :product_tag, :tag_id
    add_index :product_tag, %i[product_id tag_id], unique: true, name: "index_product_tag_on_product_and_tag"
    add_foreign_key :product_tag, :products, on_delete: :cascade
    add_foreign_key :product_tag, :tags, on_delete: :cascade
  end

  def create_orders
    create_app_table :orders do |t|
      reference(t, :user, null: false)
      status_column(t)
      t.decimal :total, precision: 12, scale: 2, null: false
      t.timestamps null: false
    end
    add_index :orders, :user_id
    add_index :orders, :status
    add_foreign_key :orders, :users, on_delete: :cascade
  end

  def create_order_items
    create_app_table :order_items do |t|
      reference(t, :order, null: false)
      reference(t, :product, null: false)
      t.integer :quantity, null: false
      t.decimal :price, precision: 12, scale: 2, null: false
      t.timestamps null: false
    end
    add_index :order_items, :order_id
    add_index :order_items, :product_id
    add_foreign_key :order_items, :orders, on_delete: :cascade
    add_foreign_key :order_items, :products, on_delete: :restrict
  end

  def create_comments
    create_app_table :comments do |t|
      reference(t, :product, null: false)
      reference(t, :user, null: false)
      t.text :body, null: false
      t.timestamps null: false
    end
    add_index :comments, :product_id
    add_index :comments, :user_id
    add_foreign_key :comments, :products, on_delete: :cascade
    add_foreign_key :comments, :users, on_delete: :cascade
  end
end
