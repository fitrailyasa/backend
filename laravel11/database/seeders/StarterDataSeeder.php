<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class StarterDataSeeder extends Seeder
{
    public function run(): void
    {
        $now = now();
        $userIds = [];
        foreach (
            [
                ['Admin', 'admin@example.com', 'admin'],
                ['User', 'user@example.com', 'user'],
                ['User 2', 'user2@example.com', 'user'],
                ['User 3', 'user3@example.com', 'user'],
                ['User 4', 'user4@example.com', 'user'],
            ] as [$name, $email, $role]
        ) {
            $userIds[] = DB::table('users')->insertGetId([
                'name' => $name,
                'email' => $email,
                'password' => password_hash('password', PASSWORD_BCRYPT),
                'role' => $role,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $categoryIds = [];
        foreach ([['Electronics', 'Electronic devices'], ['Home', 'Home essentials'], ['Books', 'Books and learning']] as [$name, $description]) {
            $categoryIds[] = DB::table('categories')->insertGetId(['name' => $name, 'slug' => strtolower($name), 'description' => $description, 'created_at' => $now, 'updated_at' => $now]);
        }
        $tagIds = [];
        foreach (['Popular', 'New', 'Sale', 'Premium', 'Portable', 'Eco'] as $name) {
            $tagIds[] = DB::table('tags')->insertGetId(['name' => $name, 'slug' => strtolower($name), 'created_at' => $now, 'updated_at' => $now]);
        }

        $productIds = [];
        for ($index = 1; $index <= 10; $index++) {
            $productId = DB::table('products')->insertGetId([
                'category_id' => $categoryIds[($index - 1) % count($categoryIds)],
                'name' => 'Demo Product ' . $index,
                'slug' => 'demo-product-' . $index,
                'description' => 'Seeded product ' . $index,
                'price' => $index * 10000,
                'stock' => 5 + $index,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            $productIds[] = $productId;
            DB::table('product_tag')->insert(['product_id' => $productId, 'tag_id' => $tagIds[($index - 1) % count($tagIds)]]);
        }

        for ($index = 0; $index < 10; $index++) {
            $productId = $productIds[$index];
            $price = ($index + 1) * 10000;
            $orderId = DB::table('orders')->insertGetId([
                'user_id' => $userIds[($index % (count($userIds) - 1)) + 1],
                'status' => 'pending',
                'total' => $price,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('order_items')->insert([
                'order_id' => $orderId,
                'product_id' => $productId,
                'quantity' => 1,
                'price' => $price,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
        for ($index = 0; $index < 15; $index++) {
            DB::table('comments')->insert([
                'product_id' => $productIds[$index % count($productIds)],
                'user_id' => $userIds[($index % (count($userIds) - 1)) + 1],
                'body' => 'Demo comment ' . ($index + 1),
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }
}
