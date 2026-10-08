<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequireAdmin
{
    public function handle(Request $request, Closure $next)
    {
        if ($request->attributes->get('apiUser')?->role !== 'admin') {
            return response()->json(['success' => false, 'message' => 'This action is unauthorized'], 403);
        }
        return $next($request);
    }
}
