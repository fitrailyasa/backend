<?php

use App\Http\Controllers\ApiController;
use App\Http\Controllers\AuthController;
use App\Support\ApiJson;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('/', fn() => response()->json([
        'success' => true,
        'message' => 'API index retrieved',
        'data' => ApiJson::index('backend-starter-laravel', rtrim((string) config('app.url'), '/')),
    ]));
    Route::get('/health', fn() => response()->json([
        'status' => 'ok',
        'uptime' => microtime(true) - LARAVEL_START,
        'timestamp' => now()->toISOString(),
    ]));
    Route::post('/auth/login', [AuthController::class, 'login']);
    Route::post('/auth/refresh', [AuthController::class, 'refresh']);

    foreach (['categories', 'products', 'tags'] as $resource) {
        Route::get('/' . $resource, [ApiController::class, 'index'])->name($resource . '.index');
        Route::get('/' . $resource . '/{id}', [ApiController::class, 'show'])->name($resource . '.show');
        Route::middleware(['api.jwt', 'api.admin'])->group(function () use ($resource): void {
            Route::post('/' . $resource, [ApiController::class, 'store'])->name($resource . '.store');
            Route::put('/' . $resource . '/{id}', [ApiController::class, 'update'])->name($resource . '.update');
            Route::patch('/' . $resource . '/{id}', [ApiController::class, 'update'])->name($resource . '.patch');
            Route::delete('/' . $resource . '/{id}', [ApiController::class, 'destroy'])->name($resource . '.destroy');
        });
    }

    Route::middleware('api.jwt')->group(function (): void {
        Route::post('/auth/logout', [AuthController::class, 'logout']);
        Route::get('/auth/me', [AuthController::class, 'me']);
        Route::get('/users/me', [AuthController::class, 'me']);
        Route::get('/orders', [ApiController::class, 'index'])->name('orders.index');
        Route::get('/orders/{id}', [ApiController::class, 'show'])->name('orders.show');
        Route::post('/orders', [ApiController::class, 'store'])->name('orders.store');
        Route::patch('/orders/{id}/status', [ApiController::class, 'status']);
        Route::delete('/orders/{id}', [ApiController::class, 'destroy'])->name('orders.destroy')->middleware('api.admin');

        Route::post('/products/{productId}/comments', [ApiController::class, 'commentStore']);
        Route::patch('/comments/{id}', [ApiController::class, 'commentUpdate']);
        Route::delete('/comments/{id}', [ApiController::class, 'commentDestroy']);

        Route::middleware('api.admin')->group(function (): void {
            Route::get('/users', [ApiController::class, 'index'])->name('users.index');
            Route::get('/users/{id}', [ApiController::class, 'show'])->name('users.show');
            Route::post('/users', [ApiController::class, 'store'])->name('users.store');
            Route::put('/users/{id}', [ApiController::class, 'update'])->name('users.update');
            Route::patch('/users/{id}', [ApiController::class, 'update'])->name('users.patch');
            Route::delete('/users/{id}', [ApiController::class, 'destroy'])->name('users.destroy');
        });
    });
    Route::get('/products/{productId}/comments', [ApiController::class, 'comments']);
});
    Route::get('/comments', [ApiController::class, 'commentIndex']);
