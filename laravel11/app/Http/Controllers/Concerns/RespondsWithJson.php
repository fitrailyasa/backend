<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

trait RespondsWithJson
{
    protected function paginate(Request $request, Builder $query, string $message, array $sortable, callable $transform, array $allowedIncludes = []): JsonResponse
    {
        if ($failure = $this->guardQuery($request, $sortable, $allowedIncludes)) {
            return $failure;
        }
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

    protected function guardQuery(Request $request, array $sortable, array $allowedIncludes, bool $paging = true): ?JsonResponse
    {
        $errors = $this->queryErrors($request, $sortable, $allowedIncludes, $paging);
        return $errors === [] ? null : $this->fail(422, 'Validation failed', $errors);
    }

    protected function queryErrors(Request $request, array $sortable, array $allowedIncludes, bool $paging = true): array
    {
        $errors = [];
        if ($paging) {
            $page = $request->query('page');
            if ($page !== null && $page !== '' && (filter_var($page, FILTER_VALIDATE_INT) === false || (int) $page < 1)) {
                $errors['page'] = ['Page must be a positive integer.'];
            }
            $limit = $request->query('limit');
            if ($limit !== null && $limit !== '' && (filter_var($limit, FILTER_VALIDATE_INT) === false || (int) $limit < 1 || (int) $limit > 100)) {
                $errors['limit'] = ['Limit must be an integer between 1 and 100.'];
            }
            $search = $request->query('search');
            if (is_string($search) && strlen($search) > 150) {
                $errors['search'] = ['Search must be at most 150 characters.'];
            }
            $sort = $request->query('sort');
            if ($sort !== null && $sort !== '' && !in_array($sort, $sortable, true)) {
                $errors['sort'] = ['Sort must be one of: ' . implode(', ', $sortable) . '.'];
            }
            $order = $request->query('order');
            if ($order !== null && $order !== '' && !in_array(strtolower((string) $order), ['asc', 'desc'], true)) {
                $errors['order'] = ['Order must be either asc or desc.'];
            }
        }
        $include = $request->query('include');
        if ($include !== null && $include !== '') {
            $parts = array_values(array_filter(array_map('trim', explode(',', (string) $include)), static fn ($part) => $part !== ''));
            $invalid = array_values(array_diff($parts, $allowedIncludes));
            if ($invalid !== []) {
                $allowed = $allowedIncludes === [] ? 'none' : implode(', ', $allowedIncludes);
                $errors['include'] = ['Unsupported include value(s): ' . implode(', ', $invalid) . '. Allowed: ' . $allowed . '.'];
            }
        }
        return $errors;
    }
}
