<?php

namespace App\Controllers;

class Docs extends BaseController
{
    public function ui()
    {
        return $this->response
            ->setContentType('text/html')
            ->setBody(<<<'HTML'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Backend Starter Kit API - CodeIgniter</title>
  <link rel="stylesheet" href="/swagger-ui/swagger-ui.css">
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="/swagger-ui/swagger-ui-bundle.js"></script>
  <script src="/swagger-ui/swagger-ui-standalone-preset.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: "/api/v1/docs.json",
      dom_id: "#swagger-ui",
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
      layout: "StandaloneLayout",
      persistAuthorization: true,
      docExpansion: "list",
      deepLinking: true
    });
  </script>
</body>
</html>
HTML);
    }

    public function spec()
    {
        $path = APPPATH . 'OpenApi/openapi.json';
        if (!is_file($path)) {
            return $this->response->setStatusCode(404)->setJSON(['success' => false, 'message' => 'OpenAPI document not found']);
        }

        return $this->response
            ->setContentType('application/json')
            ->setBody((string) file_get_contents($path));
    }

    public function asset(string $file)
    {
        $types = [
            'swagger-ui.css' => 'text/css',
            'swagger-ui-bundle.js' => 'application/javascript',
            'swagger-ui-standalone-preset.js' => 'application/javascript',
            'favicon-32x32.png' => 'image/png',
        ];
        if (!isset($types[$file])) {
            return $this->response->setStatusCode(404);
        }

        $root = realpath(ROOTPATH . 'vendor/swagger-api/swagger-ui/dist');
        $full = $root === false ? false : realpath($root . DIRECTORY_SEPARATOR . $file);
        if ($root === false || $full === false || !str_starts_with($full, $root) || !is_file($full)) {
            return $this->response->setStatusCode(404);
        }

        return $this->response
            ->setContentType($types[$file])
            ->setBody((string) file_get_contents($full));
    }
}
