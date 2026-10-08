-- ---------------------------------------------------------------------------
-- Backend Starter Kit - MySQL / MariaDB schema
-- Canonical DDL for the shared API contract (see ../_SPEC.md section 1).
-- Database name: backend_starter   Charset: utf8mb4 / utf8mb4_unicode_ci
--
--   mysql -u root -p < database/schema.sql
--
-- Use this file when you prefer raw SQL migrations. The Express template can
-- also create the same tables with `npm run db:sync` (sequelize.sync()).
-- ---------------------------------------------------------------------------

CREATE DATABASE IF NOT EXISTS `backend_starter`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `backend_starter`;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS `comments`;
DROP TABLE IF EXISTS `order_items`;
DROP TABLE IF EXISTS `orders`;
DROP TABLE IF EXISTS `product_tag`;
DROP TABLE IF EXISTS `products`;
DROP TABLE IF EXISTS `tags`;
DROP TABLE IF EXISTS `categories`;
DROP TABLE IF EXISTS `users`;

SET FOREIGN_KEY_CHECKS = 1;

-- 1.1 users ------------------------------------------------------------------
CREATE TABLE `users` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(100)    NOT NULL,
  `email`      VARCHAR(150)    NOT NULL,
  `password`   VARCHAR(255)    NOT NULL COMMENT 'bcrypt hash, never returned by the API',
  `role`       ENUM('user','admin') NOT NULL DEFAULT 'user',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_email_unique` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.2 categories ------------------------------------------------------------
CREATE TABLE `categories` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`        VARCHAR(100)    NOT NULL,
  `slug`        VARCHAR(120)    NOT NULL COMMENT 'auto generated from name when empty',
  `description` TEXT            NULL,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `categories_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.3 products --------------------------------------------------------------
CREATE TABLE `products` (
  `id`          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` BIGINT UNSIGNED NOT NULL,
  `name`        VARCHAR(150)    NOT NULL,
  `slug`        VARCHAR(180)    NOT NULL COMMENT 'auto generated from name when empty',
  `description` TEXT            NULL,
  `price`       DECIMAL(12,2)   NOT NULL DEFAULT 0.00,
  `stock`       INT             NOT NULL DEFAULT 0,
  `created_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `products_slug_unique` (`slug`),
  KEY `products_category_id_idx` (`category_id`),
  CONSTRAINT `products_category_id_fk`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `products_price_check` CHECK (`price` >= 0),
  CONSTRAINT `products_stock_check` CHECK (`stock` >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.4 tags ------------------------------------------------------------------
CREATE TABLE `tags` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `name`       VARCHAR(60)     NOT NULL,
  `slug`       VARCHAR(80)     NOT NULL COMMENT 'auto generated from name when empty',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tags_slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.5 product_tag (pivot) ---------------------------------------------------
CREATE TABLE `product_tag` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `tag_id`     BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `product_tag_product_id_tag_id_unique` (`product_id`, `tag_id`),
  KEY `product_tag_tag_id_idx` (`tag_id`),
  CONSTRAINT `product_tag_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_tag_tag_id_fk`
    FOREIGN KEY (`tag_id`) REFERENCES `tags` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.6 orders ----------------------------------------------------------------
CREATE TABLE `orders` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `status`     ENUM('pending','paid','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
  `total`      DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'computed server side from order_items',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `orders_user_id_idx` (`user_id`),
  KEY `orders_status_idx` (`status`),
  CONSTRAINT `orders_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.7 order_items -----------------------------------------------------------
CREATE TABLE `order_items` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `order_id`   BIGINT UNSIGNED NOT NULL,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `quantity`   INT             NOT NULL DEFAULT 1,
  `price`      DECIMAL(12,2)   NOT NULL DEFAULT 0.00 COMMENT 'price snapshot taken when the order was created',
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `order_items_order_id_idx` (`order_id`),
  KEY `order_items_product_id_idx` (`product_id`),
  CONSTRAINT `order_items_order_id_fk`
    FOREIGN KEY (`order_id`) REFERENCES `orders` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `order_items_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `order_items_quantity_check` CHECK (`quantity` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1.8 comments --------------------------------------------------------------
CREATE TABLE `comments` (
  `id`         BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `product_id` BIGINT UNSIGNED NOT NULL,
  `user_id`    BIGINT UNSIGNED NOT NULL,
  `body`       TEXT            NOT NULL,
  `created_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `comments_product_id_idx` (`product_id`),
  KEY `comments_user_id_idx` (`user_id`),
  CONSTRAINT `comments_product_id_fk`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `comments_user_id_fk`
    FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
