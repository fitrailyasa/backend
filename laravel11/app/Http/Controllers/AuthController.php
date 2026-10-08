<?php

namespace App\Http\Controllers;

use App\Support\JwtToken;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        if (DB::table('users')->where('email', $request->input('email'))->exists()) {
            return response()->json(['success' => false, 'message' => 'Email already exists'], 409);
        }

        $id = DB::table('users')->insertGetId([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'password' => Hash::make($request->input('password')),
            'role' => 'user',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        return $this->tokenResponse(DB::table('users')->where('id', $id)->first(), 201);
    }

    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), ['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        $user = DB::table('users')->where('email', $request->input('email'))->first();
        if (!$user || !Hash::check($request->input('password'), $user->password)) {
            return response()->json(['success' => false, 'message' => 'These credentials do not match our records'], 401);
        }
        return $this->tokenResponse($user);
    }

    public function refresh(Request $request)
    {
        $token = $request->bearerToken() ?: (string) $request->input('refresh_token', '');
        $claims = $token !== '' ? JwtToken::decode($token, 'refresh') : null;
        $user = $claims ? DB::table('users')->where('id', $claims['sub'])->first() : null;
        if (!$claims || !$user) return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        JwtToken::revoke($claims);
        return response()->json(['success' => true, 'message' => 'Token refreshed successfully', 'data' => $this->tokenPayload($user)]);
    }

    public function logout(Request $request)
    {
        JwtToken::revoke($request->attributes->get('jwtClaims'));
        return response()->json(['success' => true, 'message' => 'Logged out successfully', 'data' => null]);
    }

    public function me(Request $request)
    {
        $user = $request->attributes->get('apiUser');
        $message = str_ends_with($request->path(), 'auth/me') ? 'Authenticated user retrieved' : 'User retrieved';
        return response()->json(['success' => true, 'message' => $message, 'data' => $this->publicUser($user)]);
    }

    public function updateMe(Request $request)
    {
        $current = $request->attributes->get('apiUser');
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($current->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'password_confirmation' => ['sometimes', 'nullable', 'string', 'same:password'],
        ]);
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());

        $data = ['updated_at' => now()];
        if ($request->filled('name')) $data['name'] = $request->input('name');
        if ($request->filled('email')) $data['email'] = $request->input('email');
        if ($request->filled('password')) $data['password'] = Hash::make($request->input('password'));
        DB::table('users')->where('id', $current->id)->update($data);
        $user = DB::table('users')->where('id', $current->id)->first();
        return response()->json(['success' => true, 'message' => 'Profile updated successfully', 'data' => $this->publicUser($user)]);
    }

    private function tokenResponse(object $user, int $status = 200)
    {
        return response()->json([
            'success' => true,
            'message' => $status === 201 ? 'User registered successfully' : 'Login successful',
            'data' => $this->tokenPayload($user),
        ], $status);
    }

    private function tokenPayload(object $user): array
    {
        return [
            'user' => $this->publicUser($user),
            'token' => JwtToken::issue($user),
            'refresh_token' => JwtToken::issue($user, 'refresh'),
            'token_type' => 'Bearer',
            'expires_in' => (int) env('JWT_EXPIRES_IN', 3600),
        ];
    }

    private function passwordMatches(string $plain, string $hash): bool
    {
        if (str_starts_with($hash, 'bcrypt$')) $hash = substr($hash, strlen('bcrypt$'));
        return $hash !== '' && password_verify($plain, $hash);
    }

    private function publicUser(object $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'created_at' => $user->created_at, 'updated_at' => $user->updated_at];
    }

    private function invalid(array $errors)
    {
        return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $errors], 422);
    }
}
