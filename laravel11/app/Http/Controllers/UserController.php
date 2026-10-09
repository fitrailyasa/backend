<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\RespondsWithJson;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    use RespondsWithJson;

    public function index(Request $request)
    {
        $query = User::query();
        if ($request->filled('search')) {
            $query->where(function ($sub) use ($request): void {
                $sub->orWhere('name', 'like', '%' . $request->query('search') . '%')
                    ->orWhere('email', 'like', '%' . $request->query('search') . '%');
            });
        }

        return $this->paginate(
            $request,
            $query,
            'Users retrieved',
            ['id', 'created_at', 'updated_at', 'name', 'email', 'role'],
            fn (User $user) => $user->toApi(),
        );
    }

    public function show(int $id)
    {
        $user = User::query()->find($id);
        if (!$user) return $this->fail(404, 'User not found');
        return $this->ok('User retrieved', $user->toApi());
    }

    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'email', 'max:150'],
            'role' => ['sometimes', Rule::in(['user', 'admin'])],
            'password' => ['required', 'string', 'min:8'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'email', 'role']);
        $data['password'] = password_hash($request->input('password'), PASSWORD_BCRYPT);
        try {
            $user = User::query()->create($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->created('User created successfully', $user->fresh()->toApi());
    }

    public function update(Request $request, int $id)
    {
        $user = User::query()->find($id);
        if (!$user) return $this->fail(404, 'User not found');
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'max:150'],
            'role' => ['sometimes', Rule::in(['user', 'admin'])],
            'password' => ['sometimes', 'string', 'min:8'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = $request->only(['name', 'email', 'role']);
        if ($request->filled('password')) $data['password'] = password_hash($request->input('password'), PASSWORD_BCRYPT);
        $data['updated_at'] = now();
        try {
            User::query()->where('id', $id)->update($data);
        } catch (QueryException $exception) {
            if ($this->isConflict($exception)) return $this->fail(409, 'Resource already exists');
            throw $exception;
        }
        return $this->ok('User updated successfully', User::query()->find($id)->toApi());
    }

    public function destroy(int $id)
    {
        $user = User::query()->find($id);
        if (!$user) return $this->fail(404, 'User not found');
        try {
            $user->delete();
        } catch (QueryException $exception) {
            if ($this->isForeignKey($exception)) return $this->fail(409, 'Resource is referenced and cannot be deleted');
            throw $exception;
        }
        return $this->ok('User deleted successfully', null);
    }

    public function me(Request $request)
    {
        $user = $request->attributes->get('apiUser');
        return $this->ok('User retrieved', [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ]);
    }

    public function updateMe(Request $request)
    {
        $current = $request->attributes->get('apiUser');
        $validator = Validator::make($request->all(), [
            'name' => ['sometimes', 'string', 'max:100'],
            'email' => ['sometimes', 'email', 'max:150', Rule::unique('users', 'email')->ignore($current->id)],
            'password' => ['sometimes', 'nullable', 'string', 'min:8'],
            'password_confirmation' => ['sometimes', 'nullable', 'string', 'same:password'],
        ]);
        if ($validator->fails()) return $this->fail(422, 'Validation failed', $validator->errors()->toArray());

        $data = ['updated_at' => now()];
        if ($request->filled('name')) $data['name'] = $request->input('name');
        if ($request->filled('email')) $data['email'] = $request->input('email');
        if ($request->filled('password')) $data['password'] = Hash::make($request->input('password'));
        User::query()->where('id', $current->id)->update($data);
        $user = User::query()->find($current->id)->toApi();
        return $this->ok('Profile updated successfully', [
            'id' => $user['id'],
            'name' => $user['name'],
            'email' => $user['email'],
            'role' => $user['role'],
            'created_at' => $user['created_at'],
            'updated_at' => $user['updated_at'],
        ]);
    }
}
