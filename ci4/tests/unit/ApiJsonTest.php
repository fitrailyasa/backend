<?php

use App\Libraries\ApiJson;
use CodeIgniter\Test\CIUnitTestCase;

/**
 * @internal
 */
final class ApiJsonTest extends CIUnitTestCase
{
    public function testNormalizeTurnsIdsAndMoneyIntoNumbers(): void
    {
        $normalized = ApiJson::normalize([
            'id' => '12',
            'category_id' => '3',
            'price' => '10.50',
            'name' => '12',
        ]);

        $this->assertSame(12, $normalized['id']);
        $this->assertSame(3, $normalized['category_id']);
        $this->assertSame(10.5, $normalized['price']);
        $this->assertSame('12', $normalized['name']);
    }

    public function testNormalizeTurnsMysqlDatetimesIntoIsoStrings(): void
    {
        $normalized = ApiJson::normalize([
            'created_at' => '2026-10-08 17:55:18',
            'updated_at' => '2026-10-08T17:55:18.12',
        ]);

        $this->assertSame('2026-10-08T17:55:18.000Z', $normalized['created_at']);
        $this->assertSame('2026-10-08T17:55:18.120Z', $normalized['updated_at']);
    }
}
