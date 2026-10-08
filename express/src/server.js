import { createApp } from './app.js';
import env from './config/env.js';
import { connectDatabase, disconnectDatabase, syncDatabase } from './config/database.js';

let server = null;
let shuttingDown = false;

async function bootstrap() {
  await connectDatabase();
  console.log(`[db] connected using dialect "${env.db.dialect}"`);

  if (env.db.sync) {
    await syncDatabase({ force: env.db.syncForce });
    console.log('[db] schema synchronised');
  }

  const app = createApp();

  server = app.listen(env.port, env.host, () => {
    console.log(`[http] listening on http://${env.host}:${env.port}${env.apiPrefix}`);
    console.log(`[http] health check at http://${env.host}:${env.port}/health`);
  });

  server.on('error', (error) => {
    console.error('[http] server error', error);
    process.exitCode = 1;
  });

  return server;
}

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[shutdown] received ${signal}, closing gracefully`);

  const forceExit = setTimeout(() => {
    console.error('[shutdown] forced exit after 10s');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  try {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDatabase();
    console.log('[shutdown] done');
    process.exit(0);
  } catch (error) {
    console.error('[shutdown] error while shutting down', error);
    process.exit(1);
  }
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    void shutdown(signal);
  });
}

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection', reason);
  void shutdown('unhandledRejection');
});

process.on('uncaughtException', (error) => {
  console.error('[process] uncaught exception', error);
  void shutdown('uncaughtException');
});

bootstrap().catch((error) => {
  console.error('[startup] failed to start the application', error);
  process.exit(1);
});

export default { bootstrap, shutdown };
