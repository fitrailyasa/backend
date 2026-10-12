<?php

namespace App\Providers;

use App\Support\InMemoryRateLimiter;
use App\Support\LoginRateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(InMemoryRateLimiter::class);
        $this->app->singleton(LoginRateLimiter::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
