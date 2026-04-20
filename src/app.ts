import express, { Application, Request, Response, NextFunction } from 'express';
import { monitorRoutes } from './routes/monitor.routes';
import { logger } from './utils/logger';

const CTX = 'App';

export function createApp(): Application {
  const app = express();

  // ── Global middleware ──────────────────────────────────────────────────────
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // Basic request logger
  app.use((req: Request, _res: Response, next: NextFunction) => {
    logger.info(CTX, `${req.method} ${req.originalUrl}`);
    next();
  });

  // ── Routes ────────────────────────────────────────────────────────────────
  app.use('/api', monitorRoutes);

  // 404 handler
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, message: 'Route not found' });
  });

  // Global error handler
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error(CTX, 'Unhandled error', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  });

  return app;
}

