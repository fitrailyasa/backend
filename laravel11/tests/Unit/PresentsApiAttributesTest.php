<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\TestCase;

class PresentsApiAttributesTest extends TestCase
{
    public function test_to_api_hides_secrets_and_pivot_columns(): void
    {
        $user = new User();
        $user->setRawAttributes([
            'id' => 4,
            'name' => 'Ada',
            'email' => 'ada@example.com',
            'password' => 'secret-hash',
            'remember_token' => 'remember-me',
            'email_verified_at' => '2026-01-01 00:00:00',
            'pivot_product_id' => 9,
            'pivot_tag_id' => 3,
        ], true);

        $api = $user->toApi();

        $this->assertSame([
            'id' => 4,
            'name' => 'Ada',
            'email' => 'ada@example.com',
        ], $api);
    }
}
