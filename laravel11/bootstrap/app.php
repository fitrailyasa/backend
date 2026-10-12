<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use App\Http\Middleware\AuthenticateApi;
use App\Http\Middleware\GlobalRateLimit;
use App\Http\Middleware\LimitRequestBody;
use App\Http\Middleware\RequireAdmin;
use App\Http\Middleware\NormalizeJson;
use App\Http\Middleware\RejectMalformedJson;
use App\Http\Middleware\SecurityHeaders;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__ . '/../routes/web.php',
        api: __DIR__ . '/../routes/api.php',
        commands: __DIR__ . '/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // X-Forwarded-For is only trusted when explicitly enabled.
        // (env() is correct here: the middleware callback runs before config loads.)
        $middleware->trustProxies(at: filter_var(env('TRUST_PROXY', false), FILTER_VALIDATE_BOOL) ? '*' : []);
        $middleware->append(SecurityHeaders::class);
        $middleware->append(GlobalRateLimit::class);
        $middleware->alias([
            'api.jwt' => AuthenticateApi::class,
            'api.admin' => RequireAdmin::class,
        ]);
        $middleware->appendToGroup('api', LimitRequestBody::class);
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
