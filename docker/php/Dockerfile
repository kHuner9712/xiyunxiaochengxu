FROM php:8.1-fpm-alpine

RUN apk add --no-cache \
    libpng-dev \
    libjpeg-turbo-dev \
    freetype-dev \
    libzip-dev \
    libxml2-dev \
    oniguruma-dev \
    linux-headers \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        pdo_mysql \
        mysqli \
        gd \
        mbstring \
        zip \
        bcmath \
        fileinfo \
        pcntl \
        opcache \
    && pecl install redis-6.0.2 \
    && docker-php-ext-enable redis \
    && apk del $PHPIZE_DEPS

RUN curl -sS https://getcomposer.org/installer | php -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html

RUN echo "upload_max_filesize = 50M" >> /usr/local/etc/php/conf.d/shopxo.ini \
    && echo "post_max_size = 50M" >> /usr/local/etc/php/conf.d/shopxo.ini \
    && echo "max_execution_time = 300" >> /usr/local/etc/php/conf.d/shopxo.ini \
    && echo "memory_limit = 256M" >> /usr/local/etc/php/conf.d/shopxo.ini

EXPOSE 9000
CMD ["php-fpm"]
