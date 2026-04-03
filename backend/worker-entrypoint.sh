#!/bin/sh
# Cloud Run requires an HTTP health endpoint even for background workers.
# This script starts a minimal health server alongside the BullMQ worker process.
set -e

PORT="${PORT:-8080}"

node -e "
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen($PORT, () => console.log('Health server listening on :$PORT'));
" &

exec node dist/workers/ocr.worker.js
