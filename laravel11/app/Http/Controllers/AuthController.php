<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Support\JwtToken;
use App\Support\LoginRateLimiter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AuthController extends Controller
{
    /**
     * Fixed bcrypt hash compared against when the email does not exist, so the
     * response time does not reveal whether an account is registered.
     */
    private const DUMMY_HASH = '$2y$12$8PS1sQY/P.Jg7/XfoNNn1uHVWasuKviUiPZa77bCbh1VBjGorAMPG';

    public function register(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'min:2', 'max:100'],
            'email' => ['required', 'email', 'min:3', 'max:150', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:72'],
            'password_confirmation' => ['required', 'string', 'same:password'],
        ], $this->accountMessages());
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());
        if (User::query()->where('email', $request->input('email'))->exists()) {
            return response()->json(['success' => false, 'message' => 'Email already exists'], 409);
        }

        $user = User::query()->create([
            'name' => $request->input('name'),
            'email' => $request->input('email'),
            'password' => password_hash((string) $request->input('password'), PASSWORD_BCRYPT),
            'role' => 'user',
        ]);
        return $this->tokenResponse($user->fresh()->toRawObject(), 201);
    }

    public function login(Request $request, LoginRateLimiter $limiter)
    {
        $validator = Validator::make($request->all(), [
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ], $this->accountMessages());
        if ($validator->fails()) return $this->invalid($validator->errors()->toArray());

        $email = LoginRateLimiter::normalizeEmail((string) $request->input('email'));
        $ip = (string) $request->ip();

        // Lock check runs before any password hashing/verification.
        $retryAfter = $limiter->retryAfter($email, $ip);
        if ($retryAfter !== null) {
            return response()->json([
                'success' => false,
                'message' => 'Too many failed login attempts. Please try again later.',
            ], 429)->header('Retry-After', (string) $retryAfter);
        }

        $user = User::query()->where('email', $request->input('email'))->first();
        $password = (string) $request->input('password');
        $valid = $user !== null
            ? $user->passwordMatches($password)
            : (password_verify($password, self::DUMMY_HASH) && false);

        if (!$valid) {
            $limiter->recordFailure($email, $ip);
            return response()->json(['success' => false, 'message' => 'These credentials do not match our records'], 401);
        }

        $limiter->clearEmail($email);
        return $this->tokenResponse($user->toRawObject());
    }

    public function refresh(Request $request)
    {
        $token = $request->bearerToken() ?: (string) $request->input('refresh_token', '');
        $claims = $token !== '' ? JwtToken::decode($token, 'refresh') : null;
        $user = $claims ? User::query()->find($claims['sub']) : null;
        if (!$claims || !$user) return response()->json(['success' => false, 'message' => 'Unauthenticated'], 401);
        JwtToken::revoke($claims);
        return response()->json(['success' => true, 'message' => 'Token refreshed successfully', 'data' => $this->tokenPayload($user->toRawObject())]);
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

    private function publicUser(object $user): array
    {
        return ['id' => $user->id, 'name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'created_at' => $user->created_at, 'updated_at' => $user->updated_at];
    }

    private function accountMessages(): array
    {
        return [
            'name.required' => 'Name is required.',
            'name.string' => 'Name must be a string.',
            'name.min' => 'Name must be between 2 and 100 characters.',
            'name.max' => 'Name must be between 2 and 100 characters.',
            'email.required' => 'Email is required.',
            'email.email' => 'The email must be a valid email address.',
            'email.min' => 'Email must be between 3 and 150 characters.',
            'email.max' => 'Email must be between 3 and 150 characters.',
            'email.unique' => 'The email has already been taken.',
            'password.required' => 'Password is required.',
            'password.string' => 'Password must be a string.',
            'password.min' => 'Password must be at least 8 characters long.',
            'password.max' => 'Password must be at least 8 characters long.',
            'password_confirmation.required' => 'password_confirmation is required.',
            'password_confirmation.same' => 'password_confirmation must match password.',
        ];
    }

    private function invalid(array $errors)
    {
        return response()->json(['success' => false, 'message' => 'Validation failed', 'errors' => $errors], 422);
    }
}
