<?php

namespace App\Filters;

use App\Libraries\ApiJson;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

class NormalizeJsonFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null) {}

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
        $uri = $request->getUri()->getPath();
        if (str_contains($uri, '/docs') || str_contains($uri, '/swagger-ui/')) {
            return $response;
        }

        $body = $response->getBody();
        if (!is_string($body) || $body === '' || !str_starts_with(ltrim($body), '{') && !str_starts_with(ltrim($body), '[')) {
            return $response;
        }

        $decoded = json_decode($body, true);
        if (!is_array($decoded)) {
            return $response;
        }

        return $response->setJSON(ApiJson::normalize($decoded));
    }
}
