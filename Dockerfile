# ── Fake HTTP server ──────────────────────────────────────────────────────────
# This is a stub Dockerfile for smoke-testing container infrastructure.
# It starts a minimal Node.js server on $PORT and responds 200 OK to every
# request — no real application code is executed.
#
# Real Dockerfiles for each service:
#   Backend  → apps/backend/Dockerfile
#   Frontend → apps/frontend/Dockerfile

FROM node:24-alpine

# Default port; override at runtime with -e PORT=<n> or in docker-compose
ENV PORT=3000

EXPOSE $PORT

# Inline a single-file HTTP server — no package.json, no dependencies.
# Every request gets a 200 OK with a plain-text body.
CMD ["node", "-e", "\
const http = require('http'); \
const port = Number(process.env.PORT) || 3000; \
http.createServer((req, res) => { \
  res.writeHead(200, { 'Content-Type': 'text/plain' }); \
  res.end('OK'); \
}).listen(port, () => console.log('fake server listening on port ' + port)); \
"]
