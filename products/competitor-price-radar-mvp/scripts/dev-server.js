const fs = require('fs');
const http = require('http');
const path = require('path');
const eventsHandler = require('../api/events');
const feedbackHandler = require('../api/feedback');
const waitlistHandler = require('../api/waitlist');

const root = path.join(__dirname, '..');
const publicDir = path.join(root, 'public');
const port = Number(process.env.PORT || 3000);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  const urlPath = new URL(req.url, `http://${req.headers.host}`).pathname;
  const filePath = path.normalize(path.join(publicDir, urlPath === '/' ? 'index.html' : urlPath));

  if (!filePath.startsWith(publicDir)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentTypes[path.extname(filePath)] || 'application/octet-stream');
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/waitlist')) {
    waitlistHandler(req, res);
    return;
  }
  if (req.url.startsWith('/api/events')) {
    eventsHandler(req, res);
    return;
  }
  if (req.url.startsWith('/api/feedback')) {
    feedbackHandler(req, res);
    return;
  }
  serveStatic(req, res);
});

server.listen(port, () => {
  console.log(`MVP template running at http://localhost:${port}`);
});
