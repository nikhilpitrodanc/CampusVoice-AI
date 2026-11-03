import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

function apiDevServerPlugin() {
  return {
    name: 'api-dev-server',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/api/tickets' || url.pathname === '/api/process') {
          res.status = (code) => {
            res.statusCode = code;
            return res;
          };
          res.json = (data) => {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data));
            return res;
          };

          req.query = Object.fromEntries(url.searchParams.entries());

          if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
            const chunks = [];
            for await (const chunk of req) {
              chunks.push(chunk);
            }
            const rawBody = Buffer.concat(chunks).toString('utf-8');
            try {
              req.body = rawBody ? JSON.parse(rawBody) : {};
            } catch {
              req.body = {};
            }
          }

          try {
            if (url.pathname === '/api/tickets') {
              const fileUrl = pathToFileURL(resolve(process.cwd(), 'api/tickets.js')).href + `?t=${Date.now()}`;
              const { default: handler } = await import(/* @vite-ignore */ fileUrl);
              await handler(req, res);
            } else if (url.pathname === '/api/process') {
              const fileUrl = pathToFileURL(resolve(process.cwd(), 'api/process.js')).href + `?t=${Date.now()}`;
              const { default: handler } = await import(/* @vite-ignore */ fileUrl);
              await handler(req, res);
            }
          } catch (err) {
            console.error('API dev error:', err);
            if (!res.writableEnded) {
              res.status(500).json({ error: err.message || 'Internal Server Error' });
            }
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [react(), apiDevServerPlugin()]
  };
});
