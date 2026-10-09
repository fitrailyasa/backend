<?php

namespace App\Models;

use App\Models\Concerns\PresentsApiAttributes;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Comment extends Model
{
    use PresentsApiAttributes;

    protected $fillable = ['product_id', 'user_id', 'body'];

    public function product(): BelongsTo
    {
        return $this->belongsTo(Product::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
