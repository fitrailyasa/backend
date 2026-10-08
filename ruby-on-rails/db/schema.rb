# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[7.2].define(version: 2026_10_08_100000) do
  create_table "categories", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.string "slug", limit: 120, null: false
    t.text "description"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_categories_on_slug", unique: true
  end

  create_table "comments", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.bigint "user_id", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["product_id"], name: "index_comments_on_product_id"
    t.index ["user_id"], name: "index_comments_on_user_id"
  end

  create_table "order_items", force: :cascade do |t|
    t.bigint "order_id", null: false
    t.bigint "product_id", null: false
    t.integer "quantity", null: false
    t.decimal "price", precision: 12, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["order_id"], name: "index_order_items_on_order_id"
    t.index ["product_id"], name: "index_order_items_on_product_id"
  end

  create_table "orders", force: :cascade do |t|
    t.bigint "user_id", null: false
    t.string "status", limit: 20, default: "pending", null: false
    t.decimal "total", precision: 12, scale: 2, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_orders_on_status"
    t.index ["user_id"], name: "index_orders_on_user_id"
  end

  create_table "product_tag", force: :cascade do |t|
    t.bigint "product_id", null: false
    t.bigint "tag_id", null: false
    t.index ["product_id", "tag_id"], name: "index_product_tag_on_product_and_tag", unique: true
    t.index ["product_id"], name: "index_product_tag_on_product_id"
    t.index ["tag_id"], name: "index_product_tag_on_tag_id"
  end

  create_table "products", force: :cascade do |t|
    t.bigint "category_id", null: false
    t.string "name", limit: 150, null: false
    t.string "slug", limit: 180, null: false
    t.text "description"
    t.decimal "price", precision: 12, scale: 2, null: false
    t.integer "stock", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category_id"], name: "index_products_on_category_id"
    t.index ["slug"], name: "index_products_on_slug", unique: true
  end

  create_table "tags", force: :cascade do |t|
    t.string "name", limit: 60, null: false
    t.string "slug", limit: 80, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["slug"], name: "index_tags_on_slug", unique: true
  end

  create_table "users", force: :cascade do |t|
    t.string "name", limit: 100, null: false
    t.string "email", limit: 150, null: false
    t.string "password", limit: 255, null: false
    t.string "role", limit: 20, default: "user", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["email"], name: "index_users_on_email", unique: true
  end

  add_foreign_key "comments", "products", on_delete: :cascade
  add_foreign_key "comments", "users", on_delete: :cascade
  add_foreign_key "order_items", "orders", on_delete: :cascade
  add_foreign_key "order_items", "products", on_delete: :restrict
  add_foreign_key "orders", "users", on_delete: :cascade
  add_foreign_key "product_tag", "products", on_delete: :cascade
  add_foreign_key "product_tag", "tags", on_delete: :cascade
  add_foreign_key "products", "categories", on_delete: :restrict
end
