<?php

namespace App\Libraries;

use Throwable;

class JwtToken
{
    public static function issue(object|array $user, string $type = 'access'): string
    {
        $user = (array) $user;
        $now = time();
        $ttl = (int) env($type === 'refresh' ? 'JWT_REFRESH_EXPIRES_IN' : 'JWT_EXPIRES_IN', $type === 'refresh' ? 604800 : 3600);
        $header = self::encode(['typ' => 'JWT', 'alg' => 'HS256']);
        $payload = self::encode([
            'sub' => (string) $user['id'],
            'role' => $user['role'],
            'iat' => $now,
            'exp' => $now + $ttl,
            'jti' => bin2hex(random_bytes(16)),
            'token_type' => $type,
        ]);
        $signature = self::encode(hash_hmac('sha256', $header . '.' . $payload, self::secret(), true));
        return $header . '.' . $payload . '.' . $signature;
    }

    public static function decode(string $token, ?string $type = 'access'): ?array
    {
        try {
            $parts = explode('.', $token);
            if (count($parts) !== 3) return null;
            [$header, $payload, $signature] = $parts;
            $expected = self::encode(hash_hmac('sha256', $header . '.' . $payload, self::secret(), true));
            if (!hash_equals($expected, $signature)) return null;
            $claims = json_decode(self::decodePart($payload), true, 512, JSON_THROW_ON_ERROR);
            if (!is_array($claims) || (int) ($claims['exp'] ?? 0) <= time()) return null;
            if ($type !== null && ($claims['token_type'] ?? null) !== $type) return null;
            if (cache()->get(self::blacklistKey($claims['jti'] ?? ''))) return null;
            return $claims;
        } catch (Throwable) {
            return null;
        }
    }

    public static function revoke(array $claims): void
    {
        cache()->save(self::blacklistKey($claims['jti'] ?? ''), true, max(1, (int) $claims['exp'] - time()));
    }

    private static function blacklistKey(string $jti): string
    {
        return 'jwt_blacklist_' . $jti;
    }

    private static function secret(): string
    {
        $secret = (string) env('JWT_SECRET', '');
        if (strlen($secret) < 32) throw new \RuntimeException('JWT_SECRET must contain at least 32 characters.');
        return $secret;
    }

    private static function encode(array|string $value): string
    {
        $bytes = is_array($value) ? json_encode($value, JSON_THROW_ON_ERROR) : $value;
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    private static function decodePart(string $part): string
    {
        $decoded = base64_decode(strtr($part, '-_', '+/'), true);
        if ($decoded === false) throw new \UnexpectedValueException('Invalid token encoding.');
        return $decoded;
    }
}
