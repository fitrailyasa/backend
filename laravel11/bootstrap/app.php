<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\AuthenticateApi;
use App\Http\Middleware\RequireAdmin;
use App\Http\Middleware\NormalizeJson;
use App\Http\Middleware\RejectMalformedJson;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias([
            'api.jwt' => AuthenticateApi::class,
            'api.admin' => RequireAdmin::class,
        ]);
        $middleware->appendToGroup('api', RejectMalformedJson::class);
        $middleware->appendToGroup('api', NormalizeJson::class);
        $middleware->appendToGroup('web', NormalizeJson::class);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        $exceptions->render(function (Throwable $exception, $request) {
            if (!$request->is('api/*')) {
                return null;
            }

            if ($exception instanceof Illuminate\Validation\ValidationException) {
                return response()->json([
                    'success' => false,
                    'message' => 'Validation failed',
                    'errors' => $exception->errors(),
                ], 422);
            }

            $status = $exception instanceof Symfony\Component\HttpKernel\Exception\HttpExceptionInterface
                ? $exception->getStatusCode()
                : 500;

            return response()->json([
                'success' => false,
                'message' => $status >= 500 ? 'Internal server error' : ($exception->getMessage() ?: 'Request failed'),
            ], $status);
        });
    })->create();
