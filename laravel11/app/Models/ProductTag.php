<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProductTag extends Model
{
    public $timestamps = false;

    protected $table = 'product_tag';

    protected $fillable = ['product_id', 'tag_id'];
}
