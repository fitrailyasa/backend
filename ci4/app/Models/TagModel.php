<?php

namespace App\Models;

use CodeIgniter\Model;

class TagModel extends Model
{
    protected $table = 'tags';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['name', 'slug'];
    protected $useTimestamps = true;

    public function forProduct(int $productId): array
    {
        return $this->builder()
            ->select('tags.id, tags.name, tags.slug, tags.created_at, tags.updated_at')
            ->join('product_tag', 'tags.id = product_tag.tag_id')
            ->where('product_tag.product_id', $productId)
            ->get()
            ->getResultArray();
    }
}
