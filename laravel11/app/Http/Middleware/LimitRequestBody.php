<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class LimitRequestBody
{
    public function handle(Request $request, Closure $next)
    {
        $limit = (int) config('security.body_limit');
        if ($limit > 0) {
            $declared = (int) $request->server('CONTENT_LENGTH', 0);
            $size = $declared > 0 ? $declared : strlen($request->getContent());
            if ($size > $limit) {
                return response()->json([
                    'success' => false,
                    'message' => 'Request body too large',
                ], 413);
            }
        }

        return $next($request);
    }
}
