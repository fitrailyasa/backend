<?php

namespace App\Libraries;

use CodeIgniter\Debug\ExceptionHandler;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\IncomingRequest;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use Config\Exceptions;
use Throwable;

class ApiExceptionHandler implements ExceptionHandlerInterface
{
    public function __construct(private Exceptions $config) {}

    public function handle(Throwable $exception, RequestInterface $request, ResponseInterface $response, int $statusCode, int $exitCode): void
    {
        $path = $request instanceof IncomingRequest ? trim($request->getUri()->getPath(), '/') : '';
        if ($request instanceof IncomingRequest && ($path === 'api/v1' || str_starts_with($path, 'api/v1/'))) {
            $message = $statusCode >= 500 ? 'Internal server error' : ($exception instanceof PageNotFoundException ? 'Not found' : ($exception->getMessage() ?: 'Request failed'));
            $response->setStatusCode($statusCode)->setJSON(['success' => false, 'message' => $message])->send();
            if (ENVIRONMENT !== 'testing') exit($exitCode);
            return;
        }

        (new ExceptionHandler($this->config))->handle($exception, $request, $response, $statusCode, $exitCode);
    }
}
