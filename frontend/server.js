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
  const wss = new WebSocketServer({ server, path: '/gaze-ws' });

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

    ws.on('close', () => console.log('[WS] client disconnected'));
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
