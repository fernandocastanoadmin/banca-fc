// server.js - Servidor Central Multiequipo (LAN / Wi-Fi / Red Local) + API REST de Sincronización
// Sistema "Banca FC - Fernando Castaño (Seguro Te Paga)"

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const DB_FILE_PATH = path.join(__dirname, 'banca_fc_db.json');

const ALLOWED_PROXY_HOSTS = new Set([
  'loteriadehoy.com',
  'www.loteriadehoy.com',
  'lotoven.com',
  'www.lotoven.com',
  'loteriasdehoy.co',
  'www.loteriasdehoy.co',
  'chancesdehoy.com',
  'www.chancesdehoy.com',
  'resultadodelaloteria.com',
  'www.resultadodelaloteria.com'
]);

function fetchOfficialUrlViaHttps(targetUrl, redirectsLeft = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch (e) {
      return reject(new Error('URL inválida'));
    }
    if (parsed.protocol !== 'https:' || !ALLOWED_PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
      return reject(new Error('Dominio no autorizado para proxy'));
    }

    const req = https.get(parsed, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*'
      },
      timeout: 10000
    }, (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location && redirectsLeft > 0) {
        const nextUrl = new URL(upstream.headers.location, parsed).toString();
        upstream.resume();
        return resolve(fetchOfficialUrlViaHttps(nextUrl, redirectsLeft - 1));
      }
      if (upstream.statusCode < 200 || upstream.statusCode >= 300) {
        upstream.resume();
        return reject(new Error(`HTTP ${upstream.statusCode}`));
      }
      const chunks = [];
      upstream.on('data', (c) => chunks.push(c));
      upstream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });

    req.on('timeout', () => {
      req.destroy(new Error('Timeout consultando página oficial'));
    });
    req.on('error', reject);
  });
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function getLocalNetworkIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips.length > 0 ? ips : ['127.0.0.1'];
}

function readServerDb() {
  try {
    if (fs.existsSync(DB_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(DB_FILE_PATH, 'utf-8'));
    }
  } catch (e) {
    console.warn('Error leyendo banca_fc_db.json:', e.message);
  }
  return null;
}

function writeServerDb(data) {
  try {
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    console.error('Error guardando banca_fc_db.json:', e.message);
    return false;
  }
}

// Fusiona de forma inteligente los tickets de distintas laptops sin perder ninguno
function mergeDatabases(existingDb, incomingDb, forceOverwrite = false) {
  if (!existingDb || forceOverwrite) {
    return incomingDb;
  }

  const merged = { ...existingDb, ...incomingDb };

  // 1. Fusionar Agencias por código
  const agencyMap = new Map();
  (existingDb.agencies || []).forEach(a => agencyMap.set(String(a.code), a));
  (incomingDb.agencies || []).forEach(a => agencyMap.set(String(a.code), a));
  merged.agencies = Array.from(agencyMap.values());

  // 2. Fusionar Cobradores
  const collectorSet = new Set([...(existingDb.collectors || []), ...(incomingDb.collectors || [])]);
  merged.collectors = Array.from(collectorSet);

  // 3. Fusionar Tickets (por serialSeguridad o ticketId+agencyCode) para que ninguna laptop pise las ventas de otra
  const ticketMap = new Map();
  const getKey = (t) => `${t.serialSeguridad || t.ticketId}_${t.agencyCode || t.usuario || '1000'}`;

  (existingDb.tickets || []).forEach(t => ticketMap.set(getKey(t), t));
  (incomingDb.tickets || []).forEach(t => {
    const key = getKey(t);
    const prev = ticketMap.get(key);
    if (!prev) {
      ticketMap.set(key, t);
    } else {
      // Si el ticket ya existía, conservar el estado más reciente (ej. ANULADO, PAGADO, GANADOR)
      const rank = { 'ACTIVO': 1, 'GANADOR': 2, 'PAGADO': 3, 'ANULADO': 4 };
      const prevRank = rank[prev.estado] || 1;
      const incRank = rank[t.estado] || 1;
      ticketMap.set(key, incRank >= prevRank ? { ...prev, ...t } : { ...t, ...prev });
    }
  });

  merged.tickets = Array.from(ticketMap.values()).sort((a, b) => {
    return Number(b.ticketId || 0) - Number(a.ticketId || 0);
  });

  // 4. Fusionar Resultados por fecha
  const mergedResults = { ...(existingDb.results || {}) };
  for (const [dateKey, resObj] of Object.entries(incomingDb.results || {})) {
    mergedResults[dateKey] = { ...(mergedResults[dateKey] || {}), ...resObj };
  }
  merged.results = mergedResults;

  // 5. Conservar el correlativo más alto de tickets
  const maxNext = Math.max(
    Number(existingDb.config?.nextTicketNumber || 1),
    Number(incomingDb.config?.nextTicketNumber || 1)
  );
  if (merged.config) {
    merged.config.nextTicketNumber = maxNext;
  }

  merged.updatedAt = new Date().toISOString();
  return merged;
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let reqPath = req.url.split('?')[0];

  // Endpoint para conocer la IP de la red local desde el Panel Admin
  if (reqPath === '/api/info') {
    const ips = getLocalNetworkIPs();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      port: PORT,
      ips: ips,
      posUrl: `http://${ips[0]}:${PORT}/index.html`,
      adminUrl: `http://${ips[0]}:${PORT}/admin.html`,
      appUrl: `http://${ips[0]}:${PORT}/app_movil/index.html`
    }));
    return;
  }

  // Endpoint API REST para sincronización entre varias Laptops (Taquillas POS <-> Panel Central)
  if (reqPath === '/api/sync') {
    if (req.method === 'GET') {
      const currentDb = readServerDb();
      if (currentDb) {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(currentDb));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 'empty' }));
      }
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
      });
      req.on('end', () => {
        try {
          const incoming = JSON.parse(body);
          const existing = readServerDb();
          const forceOverwrite = Boolean(incoming._forceOverwrite);
          delete incoming._forceOverwrite;

          const finalDb = mergeDatabases(existing, incoming, forceOverwrite);
          writeServerDb(finalDb);

          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: true, updatedAt: finalDb.updatedAt, data: finalDb }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ ok: false, error: 'JSON inválido' }));
        }
      });
      return;
    }
  }

  if (reqPath === '/api/proxy' && req.method === 'GET') {
    const reqUrlObj = new URL(req.url, `http://127.0.0.1:${PORT}`);
    const targetUrl = reqUrlObj.searchParams.get('url') || '';
    fetchOfficialUrlViaHttps(targetUrl)
      .then((html) => {
        res.writeHead(200, {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        res.end(html);
      })
      .catch((err) => {
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false, error: err.message || 'Error consultando fuente oficial' }));
      });
    return;
  }

  if (reqPath === '/app' || reqPath === '/app/' || reqPath === '/app_movil' || reqPath === '/app_movil/') {
    res.writeHead(302, { Location: '/app_movil/index.html' });
    res.end();
    return;
  }

  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  } else if (reqPath === '/admin' || reqPath === '/panel') {
    reqPath = '/admin.html';
  }

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(__dirname, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalNetworkIPs();
  const mainIp = ips[0];
  console.log('========================================================================');
  console.log('  BANCA FC FERNANDO CASTAÑO - SERVIDOR CENTRAL MULTIEQUIPO ACTIVO');
  console.log('========================================================================');
  console.log(`💻 EN ESTA LAPTOP (ADMINISTRADOR):`);
  console.log(`   👉 Panel Central: http://localhost:${PORT}/admin.html`);
  console.log(`   👉 Taquilla POS:  http://localhost:${PORT}/index.html`);
  console.log(`   📱 App Táctil:    http://localhost:${PORT}/app_movil/index.html`);
  console.log('------------------------------------------------------------------------');
  console.log(`🌐 EN LA OTRA LAPTOP / TELÉFONO / TABLET (MISMA RED WI-FI / LAN):`);
  console.log(`   Abra el navegador y escriba la dirección exacta:`);
  console.log(`   👉 Taquilla POS:  http://${mainIp}:${PORT}/index.html`);
  console.log(`   📱 App Táctil:    http://${mainIp}:${PORT}/app_movil/index.html`);
  console.log('========================================================================');
});
