<?php

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class StarterDataSeeder extends Seeder
{
    public function run()
    {
        $db = $this->db;
        $now = date('Y-m-d H:i:s');
        $users = [];
        foreach (
            [
                ['Admin', 'admin@example.com', 'admin'],
                ['User', 'user@example.com', 'user'],
                ['User 2', 'user2@example.com', 'user'],
                ['User 3', 'user3@example.com', 'user'],
                ['User 4', 'user4@example.com', 'user'],
            ] as [$name, $email, $role]
        ) {
            $db->table('users')->insert(['name' => $name, 'email' => $email, 'password' => password_hash('password', PASSWORD_BCRYPT), 'role' => $role, 'created_at' => $now, 'updated_at' => $now]);
            $users[] = (int) $db->insertID();
        }

        $categories = [];
        foreach ([['Electronics', 'Electronic devices'], ['Home', 'Home essentials'], ['Books', 'Books and learning']] as [$name, $description]) {
            $db->table('categories')->insert(['name' => $name, 'slug' => strtolower($name), 'description' => $description, 'created_at' => $now, 'updated_at' => $now]);
            $categories[] = (int) $db->insertID();
        }
        $tags = [];
        foreach (['Popular', 'New', 'Sale', 'Premium', 'Portable', 'Eco'] as $name) {
            $db->table('tags')->insert(['name' => $name, 'slug' => strtolower($name), 'created_at' => $now, 'updated_at' => $now]);
            $tags[] = (int) $db->insertID();
        }

        $products = [];
        for ($index = 1; $index <= 10; $index++) {
            $db->table('products')->insert(['category_id' => $categories[($index - 1) % count($categories)], 'name' => 'Demo Product ' . $index, 'slug' => 'demo-product-' . $index, 'description' => 'Seeded product ' . $index, 'price' => $index * 10000, 'stock' => 5 + $index, 'created_at' => $now, 'updated_at' => $now]);
            $productId = (int) $db->insertID();
            $products[] = $productId;
            $db->table('product_tag')->insert(['product_id' => $productId, 'tag_id' => $tags[($index - 1) % count($tags)]]);
        }

        for ($index = 0; $index < 10; $index++) {
            $price = ($index + 1) * 10000;
            $db->table('orders')->insert(['user_id' => $users[($index % (count($users) - 1)) + 1], 'status' => 'pending', 'total' => $price, 'created_at' => $now, 'updated_at' => $now]);
            $orderId = (int) $db->insertID();
            $db->table('order_items')->insert(['order_id' => $orderId, 'product_id' => $products[$index], 'quantity' => 1, 'price' => $price, 'created_at' => $now, 'updated_at' => $now]);
        }
        for ($index = 0; $index < 15; $index++) {
            $db->table('comments')->insert(['product_id' => $products[$index % count($products)], 'user_id' => $users[($index % (count($users) - 1)) + 1], 'body' => 'Demo comment ' . ($index + 1), 'created_at' => $now, 'updated_at' => $now]);
        }
    }
}
