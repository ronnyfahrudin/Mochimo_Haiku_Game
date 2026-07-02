/**
 * Mochimo Mesh API client (Rosetta standard).
 * All endpoints are POST + JSON. Public endpoint: https://api.mochimo.org
 *
 * MOCK MODE: set MESH_MOCK=1 to serve recorded fixtures from
 * server/fixtures/ — lets the whole stack run and be tested offline.
 * On first live run, use `npm run probe` to print raw responses and
 * confirm the nonce field mapping for your Mesh version.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const BASE = process.env.MESH_URL || 'https://api.mochimo.org';
const MOCK = process.env.MESH_MOCK === '1';
const NET = { blockchain: 'mochimo', network: 'mainnet' };

async function post(endpoint, body) {
  if (MOCK) return mockResponse(endpoint, body);
  const res = await fetch(BASE + endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`mesh ${endpoint} -> HTTP ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* High-level calls                                                    */
/* ------------------------------------------------------------------ */

async function networkStatus() {
  const r = await post('/network/status', { network_identifier: NET });
  return {
    blockNumber: BigInt(r.current_block_identifier.index),
    blockHash: r.current_block_identifier.hash,
  };
}

async function getBlock(index) {
  const r = await post('/block', {
    network_identifier: NET,
    block_identifier: { index: Number(index) },
  });
  return r.block || null;
}

/**
 * Extract the 32-byte nonce hex from a Mesh block object.
 * Defensive: Mesh versions may expose it under different metadata keys.
 * Returns lowercase hex without 0x, or null when absent/zeroed
 * (pseudoblocks and neogenesis blocks have zeroed nonces -> no haiku).
 */
function extractNonceHex(block) {
  if (!block) return null;
  const md = block.metadata || {};
  let n = md.nonce || md.Nonce || md.block_nonce
    || (md.trailer && md.trailer.nonce) || null;
  if (typeof n !== 'string') return null;
  n = n.toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{64}$/.test(n)) return null;
  if (/^0+$/.test(n)) return null; // zeroed: pseudo/neogenesis
  return n;
}

/**
 * Search for a verification deposit: a transaction TO the game tag whose
 * reference/memo equals `memo`. Requires the Mesh indexer
 * (/search/transactions). Returns { txid, amount } or null.
 */
async function findDepositByMemo(gameTag, memo, maxBlocksBack = 2000) {
  const r = await post('/search/transactions', {
    network_identifier: NET,
    account_identifier: { address: gameTag },
    limit: 100,
  });
  for (const tx of r.transactions || []) {
    const t = tx.transaction || tx;
    for (const op of t.operations || []) {
      const ref = (op.metadata && (op.metadata.reference || op.metadata.memo)) || '';
      const dest = op.account && op.account.address;
      if (ref === memo && dest && dest.toLowerCase() === gameTag.toLowerCase()) {
        return { txid: t.transaction_identifier.hash, amount: op.amount && op.amount.value };
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Mock fixtures                                                       */
/* ------------------------------------------------------------------ */

function mockResponse(endpoint, body) {
  const dir = path.join(__dirname, 'fixtures');
  if (endpoint === '/network/status') {
    return JSON.parse(fs.readFileSync(path.join(dir, 'network_status.json'), 'utf8'));
  }
  if (endpoint === '/block') {
    const idx = body.block_identifier.index;
    const f = path.join(dir, `block_${idx}.json`);
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    // synthesize a standard block with a valid haiku nonce, deterministic per index
    const vectors = fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors.txt'), 'utf8')
      .trim().split('\n');
    const hex = vectors[idx % vectors.length].split(' ')[0];
    const isNeo = idx % 256 === 0;
    const isPseudo = !isNeo && idx % 97 === 0; // sprinkle pseudoblocks
    return {
      block: {
        block_identifier: { index: idx, hash: 'mock'.padEnd(64, '0') },
        parent_block_identifier: { index: idx - 1, hash: 'mock'.padEnd(64, '0') },
        timestamp: Date.now(),
        transactions: [],
        metadata: { nonce: (isNeo || isPseudo) ? '0'.repeat(64) : hex, tcount: (isNeo || isPseudo) ? 0 : 3 },
      },
    };
  }
  if (endpoint === '/search/transactions') {
    const f = path.join(dir, 'search_transactions.json');
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
    return { transactions: [] };
  }
  throw new Error('no mock for ' + endpoint);
}

module.exports = { networkStatus, getBlock, extractNonceHex, findDepositByMemo, NET, BASE, MOCK };
