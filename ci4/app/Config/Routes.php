<?php

use CodeIgniter\Router\RouteCollection;

/** @var RouteCollection $routes */
$routes->get('/', 'Home::index');
$routes->get('health', 'Api::health');

$routes->get('swagger-ui/(:segment)', 'Docs::asset/$1');

$routes->group('api/v1', static function ($routes): void {
    $routes->get('docs', 'Docs::ui');
    $routes->get('docs.json', 'Docs::spec');
    $routes->get('/', 'Api::apiIndex');
    $routes->get('health', 'Api::health');
    $routes->post('auth/register', 'Auth::register');
    $routes->post('auth/login', 'Auth::login');
    $routes->post('auth/refresh', 'Auth::refresh');
    $routes->post('auth/logout', 'Auth::logout', ['filter' => 'api-auth']);
    $routes->get('auth/me', 'Auth::me', ['filter' => 'api-auth']);
    $routes->get('users/me', 'Auth::me', ['filter' => 'api-auth']);
    $routes->patch('users/me', 'Auth::updateMe', ['filter' => 'api-auth']);

    foreach (['categories', 'products', 'tags'] as $resource) {
        $routes->get($resource, 'Api::index/' . $resource);
        $routes->get($resource . '/(:num)', 'Api::show/' . $resource . '/$1');
        $routes->post($resource, 'Api::create/' . $resource, ['filter' => ['api-auth', 'api-admin']]);
        $routes->put($resource . '/(:num)', 'Api::update/' . $resource . '/$1', ['filter' => ['api-auth', 'api-admin']]);
        $routes->patch($resource . '/(:num)', 'Api::update/' . $resource . '/$1', ['filter' => ['api-auth', 'api-admin']]);
        $routes->delete($resource . '/(:num)', 'Api::delete/' . $resource . '/$1', ['filter' => ['api-auth', 'api-admin']]);
    }

    $routes->get('users', 'Api::index/users', ['filter' => ['api-auth', 'api-admin']]);
    $routes->get('users/(:num)', 'Api::show/users/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->post('users', 'Api::create/users', ['filter' => ['api-auth', 'api-admin']]);
    $routes->put('users/(:num)', 'Api::update/users/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->patch('users/(:num)', 'Api::update/users/$1', ['filter' => ['api-auth', 'api-admin']]);
    $routes->delete('users/(:num)', 'Api::delete/users/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('orders', 'Api::index/orders', ['filter' => 'api-auth']);
    $routes->get('orders/(:num)', 'Api::show/orders/$1', ['filter' => 'api-auth']);
    $routes->post('orders', 'Api::create/orders', ['filter' => 'api-auth']);
    $routes->patch('orders/(:num)/status', 'Api::status/$1', ['filter' => 'api-auth']);
    $routes->delete('orders/(:num)', 'Api::delete/orders/$1', ['filter' => ['api-auth', 'api-admin']]);

    $routes->get('comments', 'Api::commentIndex');
    $routes->get('products/(:num)/comments', 'Api::comments/$1');
    $routes->post('products/(:num)/comments', 'Api::commentCreate/$1', ['filter' => 'api-auth']);
    $routes->patch('comments/(:num)', 'Api::commentUpdate/$1', ['filter' => 'api-auth']);
    $routes->delete('comments/(:num)', 'Api::commentDelete/$1', ['filter' => 'api-auth']);
});
