<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');
$routes->get('health', 'Health::index');

$routes->get('swagger-ui/(:segment)', 'Docs::asset/$1');

$routes->group('api/v1', static function ($routes): void {
    $routes->get('docs', 'Docs::ui');
    $routes->get('docs/index.html', 'Docs::ui');
    $routes->get('docs.json', 'Docs::spec');
    $routes->get('/', 'Index::show');
    $routes->get('health', 'Health::index');
    $routes->post('auth/register', 'Auth::register');
    $routes->post('auth/login', 'Auth::login');
    $routes->post('auth/refresh', 'Auth::refresh');
    $routes->post('auth/logout', 'Auth::logout', ['filter' => 'api-auth']);
    $routes->get('auth/me', 'Auth::me', ['filter' => 'api-auth']);
    $routes->get('users/me', 'Users::me', ['filter' => 'api-auth']);
    $routes->patch('users/me', 'Users::updateMe', ['filter' => 'api-auth']);

    $routes->get('categories', 'Categories::index');
    $routes->get('categories/(:num)', 'Categories::show/$1');
    $routes->post('categories', 'Categories::create', ['filter' => ['api-auth', 'api-admin']]);
    $routes->put('categories/(:num)', 'Categories::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->patch('categories/(:num)', 'Categories::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->delete('categories/(:num)', 'Categories::delete/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('products/(:num)/comments', 'Comments::forProduct/$1');
    $routes->post('products/(:num)/comments', 'Comments::create/$1', ['filter' => 'api-auth']);

    $routes->get('products', 'Products::index');
    $routes->get('products/(:num)', 'Products::show/$1');
    $routes->post('products', 'Products::create', ['filter' => ['api-auth', 'api-admin']]);
    $routes->put('products/(:num)', 'Products::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->patch('products/(:num)', 'Products::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->delete('products/(:num)', 'Products::delete/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('tags', 'Tags::index');
    $routes->get('tags/(:num)', 'Tags::show/$1');
    $routes->post('tags', 'Tags::create', ['filter' => ['api-auth', 'api-admin']]);
    $routes->put('tags/(:num)', 'Tags::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->patch('tags/(:num)', 'Tags::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->delete('tags/(:num)', 'Tags::delete/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('users', 'Users::index', ['filter' => ['api-auth', 'api-admin']]);
    $routes->get('users/(:num)', 'Users::show/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->post('users', 'Users::create', ['filter' => ['api-auth', 'api-admin']]);
    $routes->put('users/(:num)', 'Users::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->patch('users/(:num)', 'Users::update/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->delete('users/(:num)', 'Users::delete/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('orders', 'Orders::index', ['filter' => 'api-auth']);
    $routes->get('orders/(:num)', 'Orders::show/$1', ['filter' => 'api-auth']);
    $routes->post('orders', 'Orders::create', ['filter' => 'api-auth']);
    $routes->patch('orders/(:num)/status', 'Orders::status/$1', ['filter' => 'api-auth']);
    $routes->delete('orders/(:num)', 'Orders::delete/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('comments', 'Comments::index');
    $routes->patch('comments/(:num)', 'Comments::update/$1', ['filter' => 'api-auth']);
    $routes->delete('comments/(:num)', 'Comments::delete/$1', ['filter' => 'api-auth']);
});
