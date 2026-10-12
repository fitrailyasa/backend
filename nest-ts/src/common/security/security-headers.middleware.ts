import type { NextFunction, Request, Response } from 'express';

/**
 * Security headers for every response (JSON API and the Swagger UI page).
 *
 * Registered as the very first middleware in `setupApp` so that later
 * responses - including 429s, 413s and errors produced before or after the
 * router - still carry them. `helmet` is not a dependency of this starter, so
 * the small header set from `_SECURITY_SPEC.md` section 3 is applied here.
 *
 * The JSON API gets `Content-Security-Policy: default-src 'none'`; the
 * Swagger UI (served from the same process) is HTML and gets a relaxed
 * `default-src 'self'` policy with whatever that UI genuinely needs. HSTS is
 * only sent when the request actually arrived over HTTPS and `ENABLE_HSTS`
 * is on.
 */
export const JSON_API_CSP = "default-src 'none'";

export const DOCS_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const BASE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

export interface SecurityHeadersOptions {
  docsBasePath?: string;
  enableHsts?: boolean;
}

export type SecurityHeadersMiddleware = (
  request: Request,
  response: Response,
  next: NextFunction,
) => void;

export const createSecurityHeadersMiddleware = ({
  docsBasePath = '/api/v1/docs',
  enableHsts = false,
}: SecurityHeadersOptions = {}): SecurityHeadersMiddleware => {
  return function securityHeaders(request, response, next) {
    for (const [name, value] of Object.entries(BASE_HEADERS)) response.setHeader(name, value);

    // The cors middleware appends to this field later (`vary` de-duplicates).
    response.setHeader('Vary', 'Origin');

    const pathname = request.path || String(request.url ?? '').split('?')[0];
    const isDocs = pathname === docsBasePath || pathname.startsWith(`${docsBasePath}/`);
    response.setHeader('Content-Security-Policy', isDocs ? DOCS_CSP : JSON_API_CSP);

    if (enableHsts && request.secure) {
      response.setHeader('Strict-Transport-Security', 'max-age=31536000');
    }

    // Fingerprint removal: Express can send `X-Powered-By`, Node no `Server`.
    response.removeHeader('X-Powered-By');
    response.removeHeader('Server');

    next();
  };
};
