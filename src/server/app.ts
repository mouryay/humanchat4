import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import settingsRoutes from './routes/settingsRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { env } from './config/env.js';
import { authenticatedLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import { success } from './utils/apiResponse.js';

const app = express();

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const originMatchers = env.corsOrigins.map((entry) => {
  if (entry === '*') {
    return /.*/i;
  }
  if (entry.includes('*')) {
    const pattern = `^${entry.split('*').map((segment) => escapeRegex(segment)).join('.*')}$`;
    return new RegExp(pattern, 'i');
  }
  return entry;
});

const isAllowedOrigin = (origin?: string | null): boolean => {
  if (!origin) {
    return true;
  }
  return originMatchers.some((matcher) => {
    if (typeof matcher === 'string') {
      return matcher === origin;
    }
    return matcher.test(origin);
  });
};

// Forwarded headers come from Cloud Run's proxy, so trust the first hop to keep rate limiting stable.
app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      if (origin) {
        console.warn(`[CORS] Blocked origin: ${origin}`);
      }
      callback(new Error('Origin not allowed by CORS'));
    },
    credentials: true
  })
);
app.use(morgan('combined'));
app.use(cookieParser());
app.use('/health', (_req, res) => success(res, { status: 'ok' }));
app.use('/api/webhooks', webhookRoutes);
app.use(express.json({ limit: '1mb' }));
app.use('/api/settings', authenticatedLimiter, settingsRoutes);
app.use('/api', authenticatedLimiter, routes);

type RouterLayer = {
  route?: { path: string; methods: Record<string, boolean> };
  name?: string;
  handle?: { stack?: RouterLayer[] };
  path?: string;
};

const collectRoutes = (): string[] => {
  const stack = (app as typeof app & { _router?: { stack?: RouterLayer[] } })._router?.stack;
  if (!stack) {
    return [];
  }

  const routes: string[] = [];
  const walk = (layers: RouterLayer[], prefix: string) => {
    layers.forEach((layer) => {
      if (layer.route?.path) {
        const methods = Object.keys(layer.route.methods)
          .filter((method) => layer.route?.methods[method])
          .map((method) => method.toUpperCase())
          .join(',');
        routes.push(`${methods} ${prefix}${layer.route.path}`);
        return;
      }
      if (layer.name === 'router' && layer.handle?.stack) {
        walk(layer.handle.stack, `${prefix}${layer.path ?? ''}`);
      }
    });
  };

  walk(stack, '');
  return routes;
};

const routeMap = collectRoutes();
if (routeMap.length > 0) {
  console.info('[RouteMap]', routeMap);
}

if (process.env.EXPOSE_ROUTE_MAP === '1') {
  app.get('/api/__debug/routes', (_req, res) => {
    res.json({ routes: collectRoutes() });
  });
}
app.use(errorHandler);

export default app;
