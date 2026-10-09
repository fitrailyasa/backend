<?php

namespace Tests\Unit;

use App\Models\User;
use PHPUnit\Framework\TestCase;

class UserPasswordTest extends TestCase
{
    public function test_prefixed_bcrypt_hash_matches_the_plain_password(): void
    {
        $user = $this->userWithPassword('bcrypt$' . password_hash('password', PASSWORD_BCRYPT));

        $this->assertTrue($user->passwordMatches('password'));
        $this->assertFalse($user->passwordMatches('wrong-password'));
    }

    public function test_plain_bcrypt_hash_matches_without_a_prefix(): void
    {
        $user = $this->userWithPassword(password_hash('password', PASSWORD_BCRYPT));

        $this->assertTrue($user->passwordMatches('password'));
    }

    public function test_empty_hash_does_not_match(): void
    {
        $this->assertFalse($this->userWithPassword('')->passwordMatches('password'));
    }

    private function userWithPassword(string $hash): User
    {
        $user = new User();
        $user->setRawAttributes(['password' => $hash], true);

        return $user;
    }
}
