import Fastify from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { JsonRunStore, type RunStore } from '../store/index.ts';
import { recommend } from '../agent/recommend.ts';
import type { Recommend, RouteContext } from './types.ts';
import { registerTransport } from './plugins/transport.ts';
import { registerHealthRoutes } from './routers/health.ts';
import { registerEvaluateRoutes } from './routers/evaluate.ts';
import { registerRecommendRoutes, registerUsageRoutes } from './routers/recommend.ts';
import { registerRunsRoutes } from './routers/runs.ts';
import { registerHistoryRoutes } from './routers/history.ts';
import { registerStrategyRoutes } from './routers/strategy.ts';
const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
export interface AppOptions {
  host?: string;
  allowedHosts?: string[];
  allowedOrigins?: string[];
  aiConfigured?: boolean;
  modelConfigured?: boolean;
  store?: RunStore;
  recommendImpl?: Recommend;
  dailyAiLimit?: number;
  aiBudgetUsd?: number;
  logger?: boolean;
  frontendRoot?: string;
}
export async function buildApp(options: AppOptions = {}) {
  const origins = options.allowedOrigins ?? [
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ];
  const hosts = options.allowedHosts ?? ['localhost', '127.0.0.1', '[::1]'];
  const store = options.store ?? new JsonRunStore(resolve(root, '.local/workspace-runs.json'));
  const provider = options.recommendImpl ?? recommend;
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : { redact: ['req.headers.authorization', 'req.headers.apikey'] },
    trustProxy: false,
    bodyLimit: 32768,
    requestTimeout: 15000,
    connectionTimeout: 135000,
    ajv: {
      customOptions: {
        coerceTypes: false,
        useDefaults: false,
        removeAdditional: false,
        allErrors: false,
      },
    },
    genReqId: () => randomUUID(),
  });
  registerTransport(app, { hosts, origins });
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.3',
      info: { title: 'Market Maker API', version: '2.1.0' },
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/api/docs',
    staticCSP: true,
    uiConfig: { persistAuthorization: false, tryItOutEnabled: true },
  });
  const context: RouteContext = {
    store,
    provider,
    aiConfigured: options.aiConfigured ?? false,
    modelConfigured: options.modelConfigured ?? false,
    dailyAiLimit: options.dailyAiLimit ?? 20,
    aiBudgetUsd: options.aiBudgetUsd ?? 10,
  };
  registerHealthRoutes(app, context);
  registerEvaluateRoutes(app, context);
  registerRecommendRoutes(app, context);
  registerUsageRoutes(app, context);
  registerRunsRoutes(app, context);
  registerHistoryRoutes(app, context);
  registerStrategyRoutes(app);
  const frontend = options.frontendRoot ?? resolve(root, 'frontend/dist');
  if (existsSync(resolve(frontend, 'index.html'))) {
    await app.register(fastifyStatic, {
      root: frontend,
      prefix: '/',
      index: 'index.html',
      dotfiles: 'deny',
      wildcard: false,
    });
  }
  return app;
}
