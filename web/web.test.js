/**
 * Web/frontend test suite. Run: node web/web.test.js
 * 1. Cross-checks the browser grammar engine (codec-client.js) against the
 *    consensus-verified Node codec, over golden vectors + random data.
 * 2. Proves guided composition is sound & complete step-by-step.
 * 3. End-to-end static serving + /api/grammar over HTTP in mock mode.
 */

'use strict';

process.env.MESH_MOCK = '1';
process.env.DB_FILE = ':memory:';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const client = require('./codec-client');
const nodeCodec = require('../codec/haiku');
const data = require('../codec/trigg_data.json');

client.init({ dict: data.dict, frames: data.frames, features: { F_XLIT: data.features.F_XLIT } });

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
}

const toIndices = (buf16) => {
  const out = [];
  for (const b of buf16) { if (b === 0) break; out.push(b); }
  return out;
};

console.log('1. client grammar === consensus grammar (golden vectors)');
check('500 valid vectors: both frames accepted by client', () => {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors.txt'), 'utf8').trim().split('\n');
  for (const line of lines) {
    const hex = line.split(' ')[0];
    const buf = Buffer.from(hex, 'hex');
    assert(client.isValidFrame(toIndices(buf.subarray(0, 16))), 'A rejected: ' + hex);
    assert(client.isValidFrame(toIndices(buf.subarray(16, 32))), 'B rejected: ' + hex);
  }
});
check('500 garbage vectors: client verdict === reference verdict', () => {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors_garbage.txt'), 'utf8').trim().split('\n');
  for (const line of lines) {
    const [hex, s] = line.split(' ');
    const buf = Buffer.from(hex, 'hex');
    // garbage may contain embedded zeros: replicate node behaviour via full 16-byte check
    const nodeVerdict = nodeCodec.syntaxOk(buf) ? 1 : 0;
    // client operates on index arrays; frames with interior zeros are not composable
    // in the UI, but verdicts must still agree for zero-free frames
    if (!Array.from(buf).includes(0)) {
      assert((client.isValidFrame(Array.from(buf)) ? 1 : 0) === nodeVerdict, hex);
    }
  }
});
check('10k random zero-free frames: verdicts identical', () => {
  for (let n = 0; n < 10000; n++) {
    const arr = Array.from({ length: 1 + (n % 16) }, () => 1 + Math.floor(Math.random() * 255));
    const buf = Buffer.from(arr.concat(new Array(16 - arr.length).fill(0)));
    assert((client.isValidFrame(arr) ? 1 : 0) === (nodeCodec.syntaxOk(buf) ? 1 : 0));
  }
});
check('client rendering === node rendering on golden vectors', () => {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors.txt'), 'utf8').trim().split('\n').slice(0, 100);
  for (const line of lines) {
    const hex = line.split(' ')[0];
    const buf = Buffer.from(hex, 'hex');
    const a = toIndices(buf.subarray(0, 16));
    assert.strictEqual(client.renderFrame(a), nodeCodec.render(nodeCodec.expandFrame(buf.subarray(0, 16))));
  }
});
check('client nonceHex === composed bytes', () => {
  const buf = Buffer.from(fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors.txt'), 'utf8').split(' ')[0], 'hex');
  const a = toIndices(buf.subarray(0, 16)), b = toIndices(buf.subarray(16, 32));
  const composed = nodeCodec.composeNonce(a, b);
  assert.strictEqual(client.nonceHex(a, b), Buffer.from(composed).toString('hex'));
});

console.log('2. guided composition: sound and complete');
check('soundness: any path of allowedNext choices + canEnd => valid frame', () => {
  for (let t = 0; t < 300; t++) {
    let prefix = [];
    for (let steps = 0; steps < 16; steps++) {
      const { next, canEnd } = client.allowedNext(prefix);
      const opts = [...next];
      if (canEnd && (opts.length === 0 || Math.random() < 0.35)) break;
      assert(opts.length > 0, 'dead end at ' + JSON.stringify(prefix));
      prefix.push(opts[Math.floor(Math.random() * opts.length)]);
    }
    const { canEnd } = client.allowedNext(prefix);
    if (canEnd) assert(client.isValidFrame(prefix), 'unsound: ' + JSON.stringify(prefix));
  }
});
check('completeness: every golden frame is reachable via allowedNext', () => {
  const lines = fs.readFileSync(path.join(__dirname, '..', 'codec', 'test_vectors.txt'), 'utf8').trim().split('\n').slice(0, 200);
  for (const line of lines) {
    const buf = Buffer.from(line.split(' ')[0], 'hex');
    for (const half of [buf.subarray(0, 16), buf.subarray(16, 32)]) {
      const idx = toIndices(half);
      for (let j = 0; j < idx.length; j++) {
        const { next } = client.allowedNext(idx.slice(0, j));
        assert(next.has(idx[j]), `word ${idx[j]} not offered at pos ${j}`);
      }
      assert(client.allowedNext(idx).canEnd, 'cannot end complete frame');
    }
  }
});
check('empty prefix offers words and cannot end', () => {
  const { next, canEnd } = client.allowedNext([]);
  assert(next.size > 0 && !canEnd);
});

console.log('3. serving: static shell + /api/grammar over HTTP');
(async () => {
  const { server, pollOnce } = require('../server/index');
  await pollOnce();
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const idx = await fetch(base + '/');
  const idxText = await idx.text();
  check('GET / serves the app shell', () => {
    assert(idx.status === 200 && idx.headers.get('content-type').includes('text/html'));
    assert(idxText.includes('The Haiku Keepers') || idxText.includes('haiku keepers'));
  });
  const css = await fetch(base + '/style.css');
  check('GET /style.css served with css mime', () =>
    assert(css.status === 200 && css.headers.get('content-type').includes('text/css')));
  const g = await (await fetch(base + '/api/grammar')).json();
  check('GET /api/grammar serves dict(256) + frames(10) + F_XLIT', () =>
    assert(g.dict.length === 256 && g.frames.length === 10 && g.features.F_XLIT > 0));
  const trav = await fetch(base + '/../server/index.js');
  check('path traversal blocked', () => assert(trav.status === 404));
  const missing = await fetch(base + '/nope.js');
  check('missing file -> 404', () => assert(missing.status === 404));

  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
