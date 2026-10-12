import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import env from './config/env.js';
import './models/index.js';

import requestId from './middleware/requestId.js';
import rateLimit from './middleware/rateLimit.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { health } from './controllers/healthController.js';

const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=()';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.trustProxy);
  app.set('etag', false);

  app.use(requestId);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          // The JSON API serves no scripts, styles or frames of its own. The
          // Swagger UI relaxes this per route in routes/index.js.
          defaultSrc: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
          frameAncestors: ["'none'"],
          // The API is served over HTTP. Helmet's default policy upgrades every
          // asset request to HTTPS, which leaves Swagger UI blank.
          upgradeInsecureRequests: null,
        },
      },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      referrerPolicy: { policy: 'no-referrer' },
      xFrameOptions: { action: 'deny' },
      strictTransportSecurity: false,
    }),
  );
  app.use((_req, res, next) => {
    res.setHeader('Permissions-Policy', PERMISSIONS_POLICY);
    next();
  });
  if (env.enableHsts) {
    app.use((req, res, next) => {
      if (req.secure) {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
      }
      next();
    });
  }
  app.use(
    cors({
      // Explicit allow-list; `*` is never combined with credentialed requests.
      origin: env.corsOrigins,
      credentials: true,
      maxAge: 600,
      exposedHeaders: [env.requestIdHeader, 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    }),
  );
  if (env.rateLimit.enabled) {
    app.use(
      rateLimit({
        windowMs: env.rateLimit.windowMs,
        max: env.rateLimit.max,
        // Liveness probe and route index page stay reachable for monitors.
        skip: (req) => req.path === '/health' || req.path === env.apiPrefix,
      }),
    );
  }
  app.use(compression());
  app.use(express.json({ limit: env.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));

  if (!env.isTest) {
    app.use(
      morgan(env.logFormat, {
        stream: { write: (line) => process.stdout.write(`${line.trimEnd()}\n`) },
      }),
    );
  }

  app.get('/health', health);
  app.use(env.apiPrefix, apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

export default createApp;
