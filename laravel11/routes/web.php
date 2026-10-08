<?php

use Illuminate\Support\Facades\Route;

Route::get('/', function () {
    return view('welcome');
});

Route::get('/health', fn() => response()->json([
    'status' => 'ok',
    'uptime' => microtime(true) - LARAVEL_START,
    'timestamp' => now()->toISOString(),
]));
