<?php

namespace App\Controllers;

use App\Models\UserModel;
use CodeIgniter\Controller;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Psr\Log\LoggerInterface;

/**
 * BaseController provides a convenient place for loading components
 * and performing functions that are needed by all your controllers.
 *
 * Extend this class in any new controllers:
 * ```
 *     class Home extends BaseController
 * ```
 *
 * For security, be sure to declare any new methods as protected or private.
 */
abstract class BaseController extends Controller
{
    /**
     * Be sure to declare properties for any property fetch you initialized.
     * The creation of dynamic property is deprecated in PHP 8.2.
     */

    // protected $session;

    /**
     * @return void
     */
    public function initController(RequestInterface $request, ResponseInterface $response, LoggerInterface $logger)
    {
        // Load here all helpers you want to be available in your controllers that extend BaseController.
        // Caution: Do not put the this below the parent::initController() call below.
        // $this->helpers = ['form', 'url'];

        // Caution: Do not edit this line.
        parent::initController($request, $response, $logger);

        // Preload any models, libraries, etc, here.
        // $this->session = service('session');
    }

    protected function paginate($builder, array $sortable, string $message, callable $transform, array $allowedIncludes = [])
    {
        if ($failure = $this->guardQuery($sortable, $allowedIncludes)) {
            return $failure;
        }
        $request = $this->request;
        $page = max(1, (int) ($request->getGet('page') ?? 1));
        $limit = min(100, max(1, (int) ($request->getGet('limit') ?? 10)));
        $total = $builder->countAllResults(false);
        $sort = in_array($request->getGet('sort') ?? 'id', $sortable, true) ? ($request->getGet('sort') ?? 'id') : 'id';
        $order = strtolower((string) ($request->getGet('order') ?? 'desc')) === 'asc' ? 'ASC' : 'DESC';
        $rows = $builder->orderBy($sort, $order)->limit($limit, ($page - 1) * $limit)->get()->getResultArray();

        return $this->response->setJSON([
            'success' => true,
            'message' => $message,
            'data' => array_map($transform, $rows),
            'meta' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $total,
                'total_pages' => (int) ceil($total / $limit),
            ],
        ]);
    }

    protected function search($builder, array $fields): void
    {
        $term = $this->request->getGet('search');
        if ($term === null || $fields === []) {
            return;
        }
        $builder->groupStart();
        foreach ($fields as $index => $field) {
            if ($index === 0) {
                $builder->like($field, $term);
            } else {
                $builder->orLike($field, $term);
            }
        }
        $builder->groupEnd();
    }

    protected function present(array $row): array
    {
        unset($row['password'], $row['remember_token'], $row['email_verified_at']);
        return $row;
    }

    protected function includes(): array
    {
        return array_filter(explode(',', (string) $this->request->getGet('include')));
    }

    protected function input(): array
    {
        $raw = $this->request->getBody();
        if ($raw !== '' && json_decode($raw) === null && json_last_error() !== JSON_ERROR_NONE) {
            return ['_malformed_json' => true];
        }
        return $this->request->getJSON(true) ?? $this->request->getPost() ?? [];
    }

    protected function guardQuery(array $sortable, array $allowedIncludes, bool $paging = true)
    {
        $errors = $this->queryErrors($sortable, $allowedIncludes, $paging);
        return $errors === [] ? null : $this->invalid($errors);
    }

    protected function queryErrors(array $sortable, array $allowedIncludes, bool $paging = true): array
    {
        $errors = [];
        $request = $this->request;
        if ($paging) {
            $page = $request->getGet('page');
            if ($page !== null && $page !== '' && (filter_var($page, FILTER_VALIDATE_INT) === false || (int) $page < 1)) {
                $errors['page'] = ['Page must be a positive integer.'];
            }
            $limit = $request->getGet('limit');
            if ($limit !== null && $limit !== '' && (filter_var($limit, FILTER_VALIDATE_INT) === false || (int) $limit < 1 || (int) $limit > 100)) {
                $errors['limit'] = ['Limit must be an integer between 1 and 100.'];
            }
            $search = $request->getGet('search');
            if (is_string($search) && strlen($search) > 150) {
                $errors['search'] = ['Search must be at most 150 characters.'];
            }
            $sort = $request->getGet('sort');
            if ($sort !== null && $sort !== '' && !in_array($sort, $sortable, true)) {
                $errors['sort'] = ['Sort must be one of: ' . implode(', ', $sortable) . '.'];
            }
            $order = $request->getGet('order');
            if ($order !== null && $order !== '' && !in_array(strtolower((string) $order), ['asc', 'desc'], true)) {
                $errors['order'] = ['Order must be either asc or desc.'];
            }
        }
        $include = $request->getGet('include');
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

    protected function optionalPositiveInt(string $key, array &$errors, ?string $message = null): void
    {
        $value = $this->request->getGet($key);
        if ($value === null || $value === '') {
            return;
        }
        if (filter_var($value, FILTER_VALIDATE_INT) === false || (int) $value < 1) {
            $errors[$key] = [$message ?? ($key . ' must be a positive integer.')];
        }
    }

    protected function optionalMinNumber(string $key, array &$errors, string $message): void
    {
        $value = $this->request->getGet($key);
        if ($value === null || $value === '') {
            return;
        }
        if (!is_numeric($value) || (float) $value < 0) {
            $errors[$key] = [$message];
        }
    }

    protected function textRule(bool $required, int $min, int $max, string $label): array
    {
        return [
            'rules' => ($required ? 'required' : 'permit_empty') . "|string|min_length[{$min}]|max_length[{$max}]",
            'errors' => [
                'required' => "{$label} is required.",
                'min_length' => "{$label} must be between {$min} and {$max} characters.",
                'max_length' => "{$label} must be between {$min} and {$max} characters.",
            ],
        ];
    }

    protected function slugRule(int $max): array
    {
        return [
            'rules' => "permit_empty|string|max_length[{$max}]|regex_match[/^[a-z0-9]+(?:-[a-z0-9]+)*$/]",
            'errors' => [
                'max_length' => "Slug must be between 1 and {$max} characters.",
                'regex_match' => 'Slug may only contain lowercase letters, numbers and single hyphens.',
            ],
        ];
    }

    protected function validatePayload(array $data, array $rules): array
    {
        if (!$rules) {
            return [];
        }
        $validation = service('validation');
        if ($validation->setRules($rules)->run($data)) {
            return [];
        }
        $errors = [];
        foreach ($validation->getErrors() as $field => $message) {
            $errors[$field] = [(string) $message];
        }
        return $errors;
    }

    protected function slug(string $value): string
    {
        return trim(preg_replace('/-+/', '-', strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', trim($value)))), '-');
    }

    protected function taken(string $modelClass, string $field, mixed $value, ?int $exceptId = null): bool
    {
        $builder = model($modelClass, false)->builder()->where($field, $value);
        if ($exceptId !== null) {
            $builder->where('id !=', $exceptId);
        }
        return $builder->countAllResults() > 0;
    }

    protected function currentUser(): object
    {
        $header = $this->request->getHeaderLine('Authorization');
        preg_match('/^Bearer\s+(.+)$/i', $header, $matches);
        $claims = isset($matches[1]) ? \App\Libraries\JwtToken::decode($matches[1]) : null;
        $user = $claims ? model(UserModel::class, false)->find($claims['sub'] ?? 0) : null;
        return $user ? (object) $user : (object) ['id' => 0, 'role' => 'user'];
    }

    protected function ownsOrAdmin(int $owner): bool
    {
        $user = $this->currentUser();
        return $user->role === 'admin' || (int) $user->id === $owner;
    }

    protected function isConflict(\Throwable $exception): bool
    {
        $message = strtolower($exception->getMessage());
        return str_contains($message, 'duplicate') || str_contains($message, 'unique');
    }

    protected function respond(string $message, mixed $data)
    {
        return $this->response->setJSON(['success' => true, 'message' => $message, 'data' => $data]);
    }

    protected function fail(int $status, string $message)
    {
        return $this->response->setStatusCode($status)->setJSON(['success' => false, 'message' => $message]);
    }

    protected function invalid(array $errors)
    {
        return $this->response->setStatusCode(422)->setJSON(['success' => false, 'message' => 'Validation failed', 'errors' => $errors]);
    }
}
