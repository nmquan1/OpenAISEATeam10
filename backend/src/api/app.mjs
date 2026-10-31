import http from 'node:http';
import {randomUUID, createHash, timingSafeEqual} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {resolve, extname} from 'node:path';
import {ValidationError} from '../../../contracts/model.js';
import {recommend} from '../agent/recommend.mjs';
import {HttpError, json, readJson} from './http.mjs';
import {healthRoute} from './routers/health.mjs';
import {evaluateRoute} from './routers/evaluate.mjs';
import {recommendationRoute} from './routers/recommend.mjs';
import {strategyRoute} from './routers/strategy.mjs';
const root = resolve(import.meta.dirname, '../../..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.md':'text/plain; charset=utf-8'};
const digest = s=>createHash('sha256').update(s).digest();
export function createApp({recommendImpl = recommend, apiToken = '', logger = console} = {}) {
  const routes = [healthRoute, evaluateRoute, strategyRoute, recommendationRoute(recommendImpl)];
  let windowStart = Date.now(), requests = 0;
  const server = http.createServer(async (req,res)=>{
    const requestId = randomUUID();
    res.setHeader('X-Request-Id',requestId);
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    // Dynamic chart widths currently require inline styles; scripts remain same-origin only.
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
    let path = '/';
    try {
      path = new URL(req.url,'http://localhost').pathname;
      const port = server.address()?.port;
      const hosts = [`localhost:${port}`,`127.0.0.1:${port}`];
      if (!hosts.includes(req.headers.host)) throw new HttpError(403,'Host denied');
      if (req.headers.origin && !hosts.map(h=>`http://${h}`).includes(req.headers.origin)) throw new HttpError(403,'Origin denied');
      const route = routes.find(r=>r.path === path);
      if (path.startsWith('/api/')) {
        if (!route) throw new HttpError(404,'API route not found');
        if (req.method !== route.method) {
          res.setHeader('Allow',route.method);
          throw new HttpError(405,`${route.method} required`);
        }
        if (path !== '/api/health' && apiToken && !timingSafeEqual(digest(req.headers.authorization ?? ''),digest(`Bearer ${apiToken}`))) throw new HttpError(401,'API token required');
        if (req.method === 'POST') {
          if (Date.now() - windowStart >= 60000) {windowStart = Date.now(); requests = 0;}
          if (++requests > 60) throw new HttpError(429,'Request limit exceeded; retry in one minute');
        }
        const body = req.method === 'POST' ? await readJson(req) : undefined;
        return json(res,200,await route.handle(body));
      }
      if (!['GET','HEAD'].includes(req.method)) {res.setHeader('Allow','GET, HEAD'); throw new HttpError(405,'GET or HEAD required');}
      // Only browser-safe modules are shared; backend/provider source stays private.
      const assets = {
        '/':'frontend/index.html', '/index.html':'frontend/index.html',
        '/src/app.js':'frontend/src/app.js', '/src/style.css':'frontend/src/style.css',
        '/engine/index.js':'backend/src/engine/index.js', '/engine/fees.js':'backend/src/engine/fees.js',
        '/engine/portfolio.js':'backend/src/engine/portfolio.js', '/contracts/model.js':'contracts/model.js',
        '/contracts/fee-catalog.js':'contracts/fee-catalog.js',
        '/docs/research.md':'docs/research.md', '/docs/architecture.md':'docs/architecture.md',
        '/docs/data-contract.md':'docs/data-contract.md', '/docs/api.md':'docs/api.md'
      };
      const file = Object.hasOwn(assets,path) ? assets[path] : null;
      if (!file) throw new HttpError(404,'Not found');
      let body;
      try {body = await readFile(resolve(root,file));} catch(e) {if (e.code === 'ENOENT') throw new HttpError(404,'Not found'); throw e;}
      res.writeHead(200,{'Content-Type':types[extname(file)],'Cache-Control':'no-cache'});
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch(error) {
      if (res.destroyed || res.headersSent) return;
      const status = error instanceof ValidationError ? 422 : error.name === 'TimeoutError' ? 504 : error.status ?? 500;
      const detail = status === 500 ? 'Internal server error' : error.message;
      if (status >= 500) logger.error({requestId,status,path,error:error.name});
      if (status === 429) res.setHeader('Retry-After','60');
      json(res,status,{type:'about:blank',title:http.STATUS_CODES[status],status,detail,error:detail,instance:path,requestId},{'Content-Type':'application/problem+json; charset=utf-8'});
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  server.keepAliveTimeout = 5000;
  return server;
}
