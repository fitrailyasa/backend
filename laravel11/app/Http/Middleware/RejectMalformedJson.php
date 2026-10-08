<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RejectMalformedJson
{
    public function handle(Request $request, Closure $next)
    {
        $contentType = strtolower((string) $request->header('Content-Type'));
        $body = $request->getContent();
        if ($body !== '' && (str_contains($contentType, 'application/json') || str_contains($contentType, '+json'))) {
            json_decode($body);
            if (json_last_error() !== JSON_ERROR_NONE) {
                return response()->json(['success' => false, 'message' => 'Invalid JSON'], 400);
            }
        }
        return $next($request);
    }
}
