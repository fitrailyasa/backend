-- ---------------------------------------------------------------------------
-- Backend Starter Kit - demo data for the raw SQL schema
--
-- Run AFTER database/schema.sql:
--   mysql -u root -p backend_starter < database/seed.sql
--
-- All demo accounts share the password: password
-- (bcrypt hash of "password", cost factor 10)
-- ---------------------------------------------------------------------------

USE `backend_starter`;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `comments`;
TRUNCATE TABLE `order_items`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `product_tag`;
TRUNCATE TABLE `products`;
TRUNCATE TABLE `tags`;
TRUNCATE TABLE `categories`;
TRUNCATE TABLE `users`;
SET FOREIGN_KEY_CHECKS = 1;

-- 1 admin + 5 users ---------------------------------------------------------
INSERT INTO `users` (`id`, `name`, `email`, `password`, `role`) VALUES
  (1, 'Site Administrator', 'admin@example.com', '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'admin'),
  (2, 'User',       'user@example.com',  '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'user'),
  (3, 'User 2',       'user2@example.com',  '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'user'),
  (4, 'User 3',      'user3@example.com', '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'user'),
  (5, 'User 4',     'user4@example.com',  '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'user'),
  (6, 'User 5',       'user5@example.com',   '$2b$10$c6smBI929qHI/r7gbAEZwuYc1qbn35CooyEtSzD52jKKCXB9RBQBa', 'user');

-- 3 categories --------------------------------------------------------------
INSERT INTO `categories` (`id`, `name`, `slug`, `description`) VALUES
  (1, 'Electronics',   'electronics',    'Phones, laptops, audio and every day gadgets.'),
  (2, 'Books',         'books',          'Fiction, non fiction and academic books.'),
  (3, 'Home & Living', 'home-and-living','Kitchenware, decoration and furniture.');

-- 6 tags --------------------------------------------------------------------
INSERT INTO `tags` (`id`, `name`, `slug`) VALUES
  (1, 'Featured',     'featured'),
  (2, 'New Arrival',  'new-arrival'),
  (3, 'Best Seller',  'best-seller'),
  (4, 'Discount',     'discount'),
  (5, 'Premium',      'premium'),
  (6, 'Eco Friendly', 'eco-friendly');

-- 10 products ---------------------------------------------------------------
INSERT INTO `products` (`id`, `category_id`, `name`, `slug`, `description`, `price`, `stock`) VALUES
  (1,  1, 'Smartphone X Pro',     'smartphone-x-pro',      '6.7 inch AMOLED display with a triple camera.',            8990000.00,  40),
  (2,  1, 'Wireless Earbuds Z',   'wireless-earbuds-z',    'Active noise cancelling earbuds, 30 hours playback.',         749000.00, 120),
  (3,  1, 'Ultra Slim Laptop 14', 'ultra-slim-laptop-14',  '14 inch ultrabook with 16GB RAM and 512GB SSD.',            15999000.00, 25),
  (4,  1, 'Smart Watch S2',       'smart-watch-s2',        'GPS tracking, heart rate and sleep monitoring.',              1299000.00, 80),
  (5,  1, 'Mechanical Keyboard K1','mechanical-keyboard-k1','Hot swappable switches with an aluminium frame.',              899000.00, 60),
  (6,  2, 'The Pragmatic Programmer', 'the-pragmatic-programmer', 'A classic guide to software craftsmanship.',           289000.00, 200),
  (7,  2, 'Clean Architecture',   'clean-architecture',    'A craftsman guide to software structure and design.',          315000.00, 150),
  (8,  2, 'Daring Greatly',       'daring-greatly',        'How to build a remarkable life at work.',                       199000.00, 180),
  (9,  3, 'Cast Iron Skillet 26cm','cast-iron-skillet-26cm','Pre seasoned skillet, oven safe up to 260C.',                  349000.00, 90),
  (10, 3, 'Linen Table Runner',   'linen-table-runner',    'Hand washed linen runner for a 180cm table.',                   129000.00, 140);

-- product_tag pivot ---------------------------------------------------------
INSERT INTO `product_tag` (`product_id`, `tag_id`) VALUES
  (1,1),(1,3),(2,1),(2,4),(3,2),(3,5),(4,1),(4,2),
  (5,3),(5,5),(6,3),(7,3),(8,1),(9,6),(10,6);

-- 10 orders, totals computed from order_items -------------------------------
INSERT INTO `orders` (`id`, `user_id`, `status`, `total`) VALUES
  (1,  2, 'completed', 10789000.00),
  (2,  3, 'shipped',   15999000.00),
  (3,  4, 'paid',       2247000.00),
  (4,  5, 'pending',     777000.00),
  (5,  6, 'completed',   349000.00),
  (6,  2, 'cancelled',  1299000.00),
  (7,  3, 'paid',       1260000.00),
  (8,  4, 'pending',     258000.00),
  (9,  5, 'shipped',   18727000.00),
  (10, 6, 'completed',   987000.00);

INSERT INTO `order_items` (`order_id`, `product_id`, `quantity`, `price`) VALUES
  (1, 1, 1, 8990000.00),
  (1, 5, 2,  899000.00),
  (2, 3, 1, 15999000.00),
  (3, 2, 3,  749000.00),
  (4, 6, 2,  289000.00),
  (4, 8, 1,  199000.00),
  (5, 9, 1,  349000.00),
  (6, 4, 1, 1299000.00),
  (7, 7, 4,  315000.00),
  (8, 10, 2, 129000.00),
  (9, 1, 2, 8990000.00),
  (9, 2, 1,  749000.00),
  (10, 6, 1, 289000.00),
  (10, 9, 2, 349000.00);

-- 15 comments ---------------------------------------------------------------
INSERT INTO `comments` (`product_id`, `user_id`, `body`) VALUES
  (1,  3, 'Battery life is honestly better than advertised.'),
  (1,  4, 'Great phone, only wish the charger was included.'),
  (1,  5, 'Camera performs well even at night.'),
  (2,  2, 'Comfortable for long listening sessions.'),
  (2,  6, 'The case is a little bulky but the sound is excellent.'),
  (3,  4, 'Replaced my old laptop and the difference is night and day.'),
  (3,  5, 'Keyboard travel is comfortable for long coding sessions.'),
  (4,  3, 'Battery lasts about three days with notifications on.'),
  (5,  2, 'The tactile feel of these switches is superb.'),
  (5,  4, 'Loud enough for an office, not for late night work.'),
  (6,  5, 'Still relevant in 2026, highly recommended.'),
  (7,  6, 'Changed how I structure my projects.'),
  (8,  3, 'A gentle book that rewards a slow reader.'),
  (9,  4, 'Pre seasoning works perfectly out of the box.'),
  (10, 2, 'Colour matches the photos and it washes well.');
