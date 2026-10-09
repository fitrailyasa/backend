<?php

use App\Libraries\JwtToken;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class JwtTokenTest extends CIUnitTestCase
{
    private string $secret = 'testing-secret-that-is-at-least-32-characters';

    protected function setUp(): void
    {
        putenv('JWT_SECRET=' . $this->secret);
        $_ENV['JWT_SECRET'] = $this->secret;
        $_SERVER['JWT_SECRET'] = $this->secret;

        parent::setUp();
    }

    public function testIssueAndDecodeRoundTrip(): void
    {
        $user = (object) ['id' => 7, 'role' => 'admin'];
        $access = JwtToken::issue($user);
        $refresh = JwtToken::issue($user, 'refresh');

        $claims = JwtToken::decode($access);
        $this->assertIsArray($claims);
        $this->assertSame('7', $claims['sub']);
        $this->assertSame('admin', $claims['role']);
        $this->assertSame('access', $claims['token_type']);
        $this->assertNull(JwtToken::decode($refresh));
        $this->assertSame('refresh', JwtToken::decode($refresh, 'refresh')['token_type']);
    }

    public function testRevokedTokenCannotBeDecoded(): void
    {
        $token = JwtToken::issue((object) ['id' => 7, 'role' => 'user']);
        $claims = JwtToken::decode($token);
        $this->assertIsArray($claims);

        JwtToken::revoke($claims);

        $this->assertNull(JwtToken::decode($token));
    }
}
