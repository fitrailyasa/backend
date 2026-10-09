<?php

namespace App\Models;

use CodeIgniter\Model;

class ProductTagModel extends Model
{
    protected $table = 'product_tag';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['product_id', 'tag_id'];
    protected $useTimestamps = false;

    public function sync(int $productId, array $tagIds): void
    {
        $this->builder()->where('product_id', $productId)->delete();
        foreach (array_unique($tagIds) as $tagId) {
            $this->builder()->ignore(true)->insert([
                'product_id' => $productId,
                'tag_id' => $tagId,
            ]);
        }
    }
}
