<?php

namespace App\Models;

use CodeIgniter\Model;

class ProductModel extends Model
{
    protected $table = 'products';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['category_id', 'name', 'slug', 'description', 'price', 'stock'];
    protected $useTimestamps = true;
}
