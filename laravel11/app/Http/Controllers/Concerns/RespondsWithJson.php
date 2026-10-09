<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait RespondsWithJson
{
    protected function paginate(Request $request, Builder $query, string $message, array $sortable, callable $transform): JsonResponse
    {
        $page = max(1, (int) $request->query('page', 1));
        $limit = min(100, max(1, (int) $request->query('limit', 10)));
        $total = (clone $query)->count();
        $sort = in_array($request->query('sort', 'id'), $sortable, true) ? $request->query('sort', 'id') : 'id';
        $order = strtolower((string) $request->query('order', 'desc')) === 'asc' ? 'asc' : 'desc';
        $rows = $query->orderBy($sort, $order)->offset(($page - 1) * $limit)->limit($limit)->get();

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $rows->map($transform)->values(),
            'meta' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int) ceil($total / $limit),
            ],
        ]);
    }

    protected function ok(string $message, mixed $data): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data]);
    }

    protected function created(string $message, mixed $data): JsonResponse
    {
        return response()->json(['success' => true, 'message' => $message, 'data' => $data], 201);
    }

    protected function fail(int $status, string $message, ?array $errors = null): JsonResponse
    {
        $body = ['success' => false, 'message' => $message];
        if ($errors !== null) {
            $body['errors'] = $errors;
        }
        return response()->json($body, $status);
    }

    protected function isConflict(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());
        return str_contains($message, 'duplicate') || str_contains($message, 'unique');
    }

    protected function isForeignKey(QueryException $exception): bool
    {
        return str_contains(strtolower($exception->getMessage()), 'foreign key');
    }

    protected function ownsOrAdmin(Request $request, int|string $owner): bool
    {
        $user = $request->attributes->get('apiUser');
        return $user->role === 'admin' || (int) $user->id === (int) $owner;
    }

    protected function includes(Request $request): array
    {
        return array_filter(explode(',', (string) $request->query('include', '')));
    }
}
