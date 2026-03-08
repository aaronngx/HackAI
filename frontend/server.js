// ─────────────────────────────────────────────────────────────────────────────
// server.js  –  Custom Next.js server with WebSocket on /gaze-ws
// Run with:  node server.js   (instead of next dev / next start)
// ─────────────────────────────────────────────────────────────────────────────

const { createServer } = require('http');
const { parse }        = require('url');
const next             = require('next');
const { WebSocketServer } = require('ws');

const dev      = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port     = parseInt(process.env.PORT || '3000', 10);

const app    = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    await handle(req, res, parse(req.url, true));
  });

  // ── WebSocket server on the same HTTP port, path /gaze-ws ─────────────────
  // noServer: true so Next.js HMR upgrades (_next/webpack-hmr) are not blocked
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req.url);
    if (pathname === '/gaze-ws') {
      wss.handleUpgrade(req, socket, head, ws => {
        wss.emit('connection', ws, req);
      });
    }
    // all other paths (e.g. _next/webpack-hmr) fall through to Next.js
  });

  wss.on('connection', ws => {
    console.log('[WS] client connected —', wss.clients.size, 'total');

    ws.on('message', data => {
      // Broadcast gaze data to every OTHER connected client (e.g. admin dashboard)
      const msg = data.toString();
      for (const client of wss.clients) {
        if (client !== ws && client.readyState === 1 /* OPEN */) {
          client.send(msg);
        }
      }
    });

    ws.on('close', () => console.log('[WS] client disconnected —', wss.clients.size, 'remaining'));
    ws.on('error', err => console.error('[WS] error:', err.message));
  });

  server.listen(port, hostname, () => {
    console.log(`\n> Next.js ready on http://${hostname}:${port}`);
    console.log(`> WebSocket  ready on ws://${hostname}:${port}/gaze-ws\n`);
  });
}).catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
