<?php

namespace App\Filters;

use App\Libraries\JwtToken;
use App\Models\UserModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class ApiAuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');
        $token = preg_match('/^Bearer\s+(.+)$/i', $header, $matches) ? $matches[1] : '';
        $claims = $token !== '' ? JwtToken::decode($token) : null;
        $user = $claims ? model(UserModel::class, false)->builder()->where('id', $claims['sub'])->get()->getRow() : null;
        if ($token === '') {
            return service('response')->setStatusCode(401)->setJSON(['success' => false, 'message' => 'Authentication token is missing']);
        }
        if (!$claims || !$user) {
            return service('response')->setStatusCode(401)->setJSON(['success' => false, 'message' => 'Token is invalid']);
        }
        return null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}
}
