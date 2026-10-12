<?php

namespace App\Filters;

use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Caps request bodies at BODY_LIMIT bytes (100kb by default) and answers
 * with the standard error envelope (_SECURITY_SPEC.md section 3.4).
 */
class BodyLimitFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $limit = config('RateLimit')->bodyLimit;
        if ($limit <= 0) {
            return null;
        }

        $declared = (int) $request->getHeaderLine('Content-Length');
        if ($declared > $limit) {
            return $this->tooLarge();
        }

        return strlen((string) $request->getBody()) > $limit ? $this->tooLarge() : null;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}

    private function tooLarge(): ResponseInterface
    {
        return service('response')
            ->setStatusCode(413)
            ->setJSON(['success' => false, 'message' => 'Request body too large']);
    }
}
