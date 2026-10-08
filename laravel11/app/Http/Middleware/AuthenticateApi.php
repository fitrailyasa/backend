<?php

namespace App\Http\Middleware;

use App\Support\JwtToken;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AuthenticateApi
{
    public function handle(Request $request, Closure $next)
    {
        $token = $request->bearerToken();
        $claims = $token ? JwtToken::decode($token) : null;
        $user = $claims ? DB::table('users')->where('id', $claims['sub'])->first() : null;
        if (!$token) {
            return response()->json(['success' => false, 'message' => 'Authentication token is missing'], 401);
        }
        if (!$claims || !$user) {
            return response()->json(['success' => false, 'message' => 'Token is invalid'], 401);
        }
        $request->attributes->set('apiUser', $user);
        $request->attributes->set('jwtClaims', $claims);
        return $next($request);
    }
}
