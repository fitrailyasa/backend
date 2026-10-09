<?php

namespace App\Controllers;

class Health extends BaseController
{
    public function index()
    {
        $start = (float) ($_SERVER['REQUEST_TIME_FLOAT'] ?? microtime(true));
        return $this->response->setJSON([
            'status' => 'ok',
            'uptime' => microtime(true) - $start,
            'timestamp' => gmdate('Y-m-d\TH:i:s.v\Z'),
        ]);
    }
}
