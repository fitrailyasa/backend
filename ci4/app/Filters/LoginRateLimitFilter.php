<?php

namespace App\Filters;

use App\Libraries\RateLimiter;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Failed-login limiter for POST /api/v1/auth/login
 * (_SECURITY_SPEC.md section 1).
 *
 * The lock is checked BEFORE the controller hashes/verifies any password:
 * a locked account must not spend time verifying credentials. Failures are
 * recorded by the controller, which knows whether the credential check
 * actually failed, and a successful login clears the email counter.
 */
class LoginRateLimitFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        if (! $request instanceof IncomingRequest) {
            return null;
        }

        $retryAfter = RateLimiter::loginRetryAfter($this->email($request), $request->getIPAddress());
        if ($retryAfter <= 0) {
            return null;
        }

        return service('response')
            ->setStatusCode(429)
            ->setHeader('Retry-After', (string) $retryAfter)
            ->setJSON(['success' => false, 'message' => RateLimiter::LOCK_MESSAGE]);
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null) {}

    /**
     * The submitted email exactly as the controller will read it.
     */
    private function email(IncomingRequest $request): string
    {
        $raw = (string) $request->getBody();

        if ($raw !== '') {
            $data = json_decode($raw, true);
            if (is_array($data) && isset($data['email']) && is_string($data['email'])) {
                return $data['email'];
            }
        }

        $post = $request->getPost('email');

        return is_string($post) ? $post : '';
    }
}
