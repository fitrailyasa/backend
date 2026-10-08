import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';

import env from './config/env.js';
import './models/index.js';

import requestId from './middleware/requestId.js';
import notFound from './middleware/notFound.js';
import errorHandler from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';
import { health } from './controllers/healthController.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.set('etag', false);

  app.use(requestId);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      exposedHeaders: [env.requestIdHeader, 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    }),
  );
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
