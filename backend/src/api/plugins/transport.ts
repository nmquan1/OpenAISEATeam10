import type { FastifyInstance } from 'fastify';
import { ValidationError } from '../../../../contracts/model.ts';
import { HttpError } from '../http.ts';
interface TransportOptions {
  hosts: string[];
  origins: string[];
}
export function registerTransport(app: FastifyInstance, { hosts, origins }: TransportOptions) {
  const windows = new Map<string, { start: number; count: number }>();
  const limit = (key: string, maximum: number) => {
    const now = Date.now();
    for (const [id, window] of windows) if (now - window.start >= 60000) windows.delete(id);
    const window = windows.get(key) ?? { start: now, count: 0 };
    if (window.count >= maximum) throw new HttpError(429, 'Too many requests; retry in one minute');
    window.count++;
    windows.set(key, window);
  };
  app.addHook('onRequest', async (request, reply) => {
    reply
      .header('X-Request-Id', request.id)
      .header('X-Content-Type-Options', 'nosniff')
      .header('Referrer-Policy', 'no-referrer')
      .header('X-Frame-Options', 'DENY')
      .header('Cache-Control', 'no-store');
    let hostname: string;
    try {
      hostname = new URL(`http://${request.headers.host ?? 'localhost'}`).hostname;
    } catch {
      throw new HttpError(403, 'Host denied');
    }
    if (!hosts.includes(hostname)) throw new HttpError(403, 'Host denied');
    const origin = request.headers.origin;
    if (origin && !origins.includes(origin)) throw new HttpError(403, 'Origin denied');
    if (origin) reply.header('Access-Control-Allow-Origin', origin).header('Vary', 'Origin');
    if (request.method === 'OPTIONS')
      return reply
        .header('Access-Control-Allow-Methods', 'GET, POST, HEAD, OPTIONS')
        .header('Access-Control-Allow-Headers', 'Content-Type')
        .header('Access-Control-Max-Age', '600')
        .code(204)
        .send();
    const path = request.url.split('?')[0] ?? '';
    if (!path.startsWith('/api/docs'))
      reply.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
      );
    if (path === '/api/evaluate') limit(`evaluate:${request.ip}`, 60);
    else if (path === '/api/strategy') limit(`strategy:${request.ip}`, 60);
    else if (path === '/api/recommend') limit(`recommend:${request.ip}`, 10);
    else if (
      path === '/api/runs' ||
      path.startsWith('/api/runs/') ||
      path === '/api/history/validate'
    )
      limit(`history:${request.ip}`, 120);
  });
  app.setErrorHandler((error, request, reply) => {
    const err = error as Error & {
      status?: number;
      statusCode?: number;
      validation?: unknown;
      code?: string;
    };
    const status =
      err instanceof ValidationError || err.validation
        ? 422
        : err.name === 'TimeoutError'
          ? 504
          : (err.status ?? err.statusCode ?? 500);
    const detail = status === 500 ? 'Internal server error' : err.message;
    if (status >= 500)
      request.log.error(
        {
          err: { name: err.name, code: err.code },
          status,
          ...(err.name === 'ProviderError' ? { detail: err.message } : {}),
        },
        'Request failed',
      );
    if (status === 429) reply.header('Retry-After', '60');
    reply
      .code(status)
      .type('application/problem+json')
      .send({
        type: 'about:blank',
        title: status >= 500 ? 'Service error' : 'Request rejected',
        status,
        detail,
        error: detail,
        requestId: request.id,
      });
  });
  app.setNotFoundHandler((request, reply) =>
    reply.code(404).type('application/problem+json').send({
      type: 'about:blank',
      title: 'Not found',
      status: 404,
      detail: 'Route not found',
      error: 'Route not found',
      requestId: request.id,
    }),
  );
}
