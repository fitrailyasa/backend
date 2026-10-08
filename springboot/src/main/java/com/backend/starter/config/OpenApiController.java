package com.backend.starter.config;

import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
public class OpenApiController {

    private static final Pattern SWAGGER_UI_VERSION = Pattern.compile("webjars/swagger-ui/([^/]+)/");

    private final String swaggerUiPage;

    public OpenApiController() throws IOException {
        String version = swaggerUiVersion();
        String assets = "/webjars/swagger-ui/" + version;
        swaggerUiPage = """
                <!DOCTYPE html>
                <html lang="en">
                <head>
                  <meta charset="utf-8">
                  <title>Backend Starter Kit API</title>
                  <link rel="stylesheet" href="%s/swagger-ui.css">
                </head>
                <body>
                  <div id="swagger-ui"></div>
                  <script src="%s/swagger-ui-bundle.js"></script>
                  <script src="%s/swagger-ui-standalone-preset.js"></script>
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
                """.formatted(assets, assets, assets);
    }

    @GetMapping(value = {"/api/v1/docs", "/api/v1/docs/", "/api/v1/swagger-ui/index.html"}, produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> ui() {
        return ResponseEntity.ok().contentType(MediaType.TEXT_HTML).body(swaggerUiPage);
    }

    @GetMapping(value = "/api/v1/docs.json", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<byte[]> document() throws IOException {
        try (InputStream input = new ClassPathResource("openapi.json").getInputStream()) {
            return ResponseEntity.ok()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(input.readAllBytes());
        }
    }

    private static String swaggerUiVersion() throws IOException {
        var resources = new PathMatchingResourcePatternResolver()
                .getResources("classpath*:/META-INF/resources/webjars/swagger-ui/*/swagger-ui-bundle.js");
        if (resources.length == 0) {
            throw new IllegalStateException("swagger-ui webjar was not found on the classpath");
        }
        String path = resources[0].getURL().toString();
        Matcher matcher = SWAGGER_UI_VERSION.matcher(path);
        if (!matcher.find()) {
            throw new IllegalStateException("Could not read the swagger-ui webjar version from " + path);
        }
        return matcher.group(1);
    }
}
