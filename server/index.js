/**
 * The Verse Keepers — game server.
 * Zero-dependency HTTP API + Mesh poller. Run:
 *   node server/index.js               (live, uses https://api.mochimo.org)
 *   MESH_MOCK=1 node server/index.js   (offline mock mode)
 *
 * Endpoints (JSON):
 *   GET  /api/state                     current block, haiku of the block, aeon clock
 *   GET  /api/wordbank                  the 255-word Forge vocabulary
 *   POST /api/auth/start   {tag}        -> {memo} to include in a micro-TX
 *   POST /api/auth/check   {tag}        polls chain for the memo deposit
 *   GET  /api/me?tag=0x..               player state
 *   POST /api/haiku        {tag, frames:{a:[],b:[]}}   submit to the anthology
 *   GET  /api/anthology?aeon=N          (defaults to current aeon)
 *   GET  /api/leaderboard?aeon=N        frozen ranks + payout memos
 *   POST /api/vote         {tag, submissionId}
 */

'use strict';

const http = require('http');
const { URL } = require('url');
const mesh = require('./mesh');
const { open, defaultFile } = require('./db');
const { Game } = require('./game');
const { wordBank } = require('../codec/haiku');
const { clock } = require('./aeon');

const PORT = Number(process.env.PORT || 8090);
const POLL_MS = Number(process.env.POLL_MS || 10_000);
const GAME_TAG = (process.env.GAME_TAG || '').toLowerCase(); // game deposit address tag

const db = open(process.env.DB_FILE === ':memory:' ? ':memory:' : defaultFile());
const game = new Game(db);

let current = { blockNumber: 0n, blockHash: null };

/* ---------------- poller ---------------- */

async function pollOnce() {
  const status = await mesh.networkStatus();
  if (status.blockNumber === current.blockNumber) return;
  // ingest any blocks we skipped (small gaps only)
  const from = current.blockNumber === 0n ? status.blockNumber : current.blockNumber + 1n;
  for (let b = from; b <= status.blockNumber; b++) {
    let nonceHex = null;
    try {
      const block = await mesh.getBlock(b);
      nonceHex = mesh.extractNonceHex(block);
    } catch (e) {
      console.error(`block ${b}: ${e.message}`);
    }
    const info = game.ingestBlock(b, nonceHex);
    const label = info.kind === 'standard' ? info.haiku.replace(/\n/g, ' / ')
      : info.kind === 'neogenesis' ? '🌅 the world is reborn'
      : '… the network is silent';
    console.log(`block ${b} [${info.kind}] ${label}`);
  }
  current = status;
}

function startPolling() {
  pollOnce().catch(e => console.error('poll:', e.message));
  setInterval(() => pollOnce().catch(e => console.error('poll:', e.message)), POLL_MS);
}

/* ---------------- http ---------------- */

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('bad JSON'), { status: 400 }); }
}

function send(res, status, obj) {
  const body = JSON.stringify(obj, null, 1);
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

const routes = {
  'GET /api/state': async () => {
    const c = clock(current.blockNumber);
    const latest = game.latestHaikuBlock();
    return {
      network: mesh.MOCK ? 'mock' : 'mainnet',
      clock: c,
      haikuOfTheBlock: latest ? { block: latest.bnum, text: latest.haiku, nonce: latest.nonce_hex } : null,
    };
  },

  'GET /api/wordbank': async () => ({ words: wordBank() }),

  'POST /api/auth/start': async (req) => {
    const { tag } = await readJson(req);
    const r = game.authStart(String(tag || ''));
    return r.verified ? r : {
      ...r,
      instructions: `Send a micro-transaction (any amount, e.g. 1 nanoMochi + fee) to the game address` +
        (GAME_TAG ? ` (${GAME_TAG})` : '') +
        ` with reference/memo exactly: ${r.memo} — then call /api/auth/check.`,
    };
  },

  'POST /api/auth/check': async (req) => {
    const { tag } = await readJson(req);
    const p = db.prepare('SELECT memo_code, verified FROM players WHERE tag = ?').get(String(tag || '').toLowerCase());
    if (!p) throw Object.assign(new Error('unknown tag'), { status: 404 });
    if (p.verified) return { tag, verified: true };
    if (!GAME_TAG) throw Object.assign(new Error('server has no GAME_TAG configured'), { status: 503 });
    const hit = await mesh.findDepositByMemo(GAME_TAG, p.memo_code);
    if (!hit) return { tag, verified: false, pending: true, memo: p.memo_code };
    return game.authComplete(tag, hit.txid);
  },

  'GET /api/me': async (_req, q) => {
    const p = game.player(String(q.get('tag') || ''));
    if (!p) throw Object.assign(new Error('unknown tag'), { status: 404 });
    return p;
  },

  'POST /api/haiku': async (req) => {
    const { tag, frames } = await readJson(req);
    return game.submit(String(tag || ''), frames || {}, current.blockNumber);
  },

  'GET /api/anthology': async (_req, q) => {
    const aeon = q.get('aeon') || clock(current.blockNumber).aeon;
    return { aeon: String(aeon), entries: game.anthology(aeon) };
  },

  'GET /api/leaderboard': async (_req, q) => {
    const aeon = q.get('aeon') || clock(current.blockNumber).aeon;
    return { aeon: String(aeon), ranks: game.leaderboard(aeon) };
  },

  'POST /api/vote': async (req) => {
    const { tag, submissionId } = await readJson(req);
    return game.vote(String(tag || ''), Number(submissionId), current.blockNumber);
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, {});
  const u = new URL(req.url, 'http://x');
  const handler = routes[`${req.method} ${u.pathname}`];
  if (!handler) return send(res, 404, { error: 'not found' });
  try {
    send(res, 200, await handler(req, u.searchParams));
  } catch (e) {
    send(res, e.status || 500, { error: e.message });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Verse Keepers server on :${PORT} (${mesh.MOCK ? 'MOCK' : mesh.BASE})`);
    startPolling();
  });
}

module.exports = { server, game, db, pollOnce, routes };
