<?php

namespace App\Http\Middleware;

use App\Support\ApiJson;
use Closure;
use Illuminate\Http\Request;

class NormalizeJson
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        if ($request->is('api/v1/docs') || $request->is('api/v1/docs/*') || $request->is('api/v1/docs.json') || $request->is('api/v1/docs.json/*')) {
            return $response;
        }

        $contentType = (string) $response->headers->get('Content-Type', '');
        if (!str_contains($contentType, 'json')) {
            return $response;
        }

        $decoded = json_decode($response->getContent(), true);
        if (!is_array($decoded)) {
            return $response;
        }

        $response->setData(ApiJson::normalize($decoded));
        return $response;
    }
}
