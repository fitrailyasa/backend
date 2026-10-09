<?php

namespace App\Controllers;

use App\Libraries\ApiJson;

class Index extends BaseController
{
    public function show()
    {
        $base = rtrim((string) config('App')->baseURL, '/');
        return $this->response->setJSON([
            'success' => true,
            'message' => 'API index retrieved',
            'data' => ApiJson::index('backend-starter-ci4', $base),
        ]);
    }
}
