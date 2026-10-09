<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Support\JwtToken;
use Closure;
use Illuminate\Http\Request;

class AuthenticateApi
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $claims = $token ? JwtToken::decode($token) : null;
        $user = $claims ? User::query()->find($claims['sub']) : null;
        if (!$token) {
            return response()->json(['success' => false, 'message' => 'Authentication token is missing'], 401);
        }
        if (!$claims || !$user) {
            return response()->json(['success' => false, 'message' => 'Token is invalid'], 401);
        }
        $request->attributes->set('apiUser', $user->toRawObject());
        $request->attributes->set('jwtClaims', $claims);
        return $next($request);
    }
}
