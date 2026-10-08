FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip libicu-dev \
    && docker-php-ext-install intl mysqli \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader

COPY . .
RUN mkdir -p writable/cache writable/logs writable/session writable/uploads \
    && chmod -R 777 writable

EXPOSE 8081

CMD ["php", "spark", "serve", "--host", "0.0.0.0", "--port", "8081"]
