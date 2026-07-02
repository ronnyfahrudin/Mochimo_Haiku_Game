/**
 * Server test suite. Run: node server/server.test.js
 * Uses in-memory SQLite + MESH_MOCK fixtures — fully offline.
 */

'use strict';

process.env.MESH_MOCK = '1';
process.env.DB_FILE = ':memory:';

const assert = require('assert');
const { clock, aeonOf, blocksToNeogenesis, seasonOf } = require('./aeon');
const { open } = require('./db');
const { Game, LIMITS } = require('./game');
const { wordBank, decodeNonce } = require('../codec/haiku');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
}

/* Build one known-valid haiku frame from the word bank (grammar frame 3:
   PREP, TIMED, \n, 'a', NS, \n, ING) — same approach as codec test 6. */
const data = require('../codec/trigg_data.json');
const F = data.features;
const dictIdx = (pred) => data.dict.findIndex(pred);
const FRAME = [
  dictIdx(e => e.tok === 'in'),
  dictIdx(e => (e.fe & F.F_TIMED) !== 0),
  1, // '\n'
  5, // 'a'
  dictIdx(e => (e.fe & F.F_NS) !== 0),
  1,
  dictIdx(e => (e.fe & F.F_ING) !== 0),
];
const FRAME2 = [...FRAME];
FRAME2[4] = data.dict.findIndex((e, i) => i > FRAME[4] && (e.fe & F.F_NS) !== 0); // vary a word

console.log('1. aeon clock');
check('block 0 is neogenesis of aeon 0', () => {
  const c = clock(0);
  assert(c.isNeogenesis && c.aeon === '0' && c.season === 'spring');
});
check('block 256 opens aeon 1 (summer)', () => {
  const c = clock(256);
  assert(c.isNeogenesis && c.aeon === '1' && c.season === 'summer');
});
check('block 511 is last block of aeon 1', () => {
  const c = clock(511);
  assert(c.aeon === '1' && c.blockInAeon === 255 && c.blocksToNeogenesis === 1);
});
check('seasons rotate every 4 aeons', () => {
  assert(seasonOf(4) === 'spring' && seasonOf(7) === 'winter');
});
check('bigint block numbers work', () => {
  assert(aeonOf(908559n).toString() === '3549' && blocksToNeogenesis(908559n) === 241);
});

console.log('2. auth flow');
const db = open(':memory:');
const game = new Game(db);
const TAG_A = '0x' + 'a1'.repeat(20);
const TAG_B = '0x' + 'b2'.repeat(20);
const BNUM = 908559n;

check('authStart issues a valid Mochimo memo code', () => {
  const r = game.authStart(TAG_A);
  assert(!r.verified && /^[A-Z0-9]+(-[A-Z0-9]+)*$/.test(r.memo));
  // memo grammar: groups all-caps or all-digit, alternating types
  const groups = r.memo.split('-');
  for (const g of groups) assert(/^[A-Z]+$/.test(g) || /^[0-9]+$/.test(g), 'mixed group: ' + g);
  for (let i = 1; i < groups.length; i++) {
    assert(/^[A-Z]+$/.test(groups[i]) !== /^[A-Z]+$/.test(groups[i - 1]), 'adjacent same-type groups');
  }
});
check('bad tag rejected', () => {
  assert.throws(() => game.authStart('0x1234'), /invalid tag/);
});
check('authComplete verifies the player', () => {
  game.authStart(TAG_B);
  game.authComplete(TAG_A, 'txid123');
  game.authComplete(TAG_B, 'txid456');
  assert(game.player(TAG_A).verified === 1);
});

console.log('3. the Forge');
let subId;
check('valid haiku accepted; text matches codec; nonce is consensus-valid', () => {
  const r = game.submit(TAG_A, { a: FRAME, b: FRAME2 }, BNUM);
  subId = r.id;
  const d = decodeNonce(r.nonceHex);
  assert(d.valid && d.text === r.text && r.aeon === '3549');
});
check('grammar-breaking haiku rejected (422)', () => {
  assert.throws(() => game.submit(TAG_A, { a: [5], b: FRAME }, BNUM), /grammar/);
});
check('duplicate poem in same aeon rejected (409)', () => {
  assert.throws(() => game.submit(TAG_B, { a: FRAME, b: FRAME2 }, BNUM), /already exists/);
});
check(`submission limit ${LIMITS.SUBMISSIONS_PER_AEON}/aeon enforced`, () => {
  const alt = [...FRAME2]; // vary the verb for uniqueness
  const ings = data.dict.map((e, i) => (e.fe & F.F_ING) ? i : -1).filter(i => i > 0);
  game.submit(TAG_A, { a: FRAME, b: [...FRAME2.slice(0, 6), ings[1]] }, BNUM);
  game.submit(TAG_A, { a: FRAME, b: [...FRAME2.slice(0, 6), ings[2]] }, BNUM);
  assert.throws(
    () => game.submit(TAG_A, { a: FRAME, b: [...FRAME2.slice(0, 6), ings[3]] }, BNUM),
    /limit/);
});

console.log('4. voting');
check('self-vote rejected', () => {
  assert.throws(() => game.vote(TAG_A, subId, BNUM), /self/);
});
check('verified player can vote once per poem', () => {
  const r = game.vote(TAG_B, subId, BNUM);
  assert(r.ok && r.votesLeft === LIMITS.VOTES_PER_AEON - 1);
  assert.throws(() => game.vote(TAG_B, subId, BNUM), /already voted/);
});
check('closed-aeon vote rejected', () => {
  assert.throws(() => game.vote(TAG_B, subId, BNUM + 256n), /closed/);
});
check('anthology ranks by votes; leaderboard carries payout memos', () => {
  const a = game.anthology('3549');
  assert(a.length === 3 && a[0].id === subId && a[0].votes === 1);
  const lb = game.leaderboard('3549');
  assert(lb[0].rank === 1 && lb[0].memo === 'AEON-3549-RANK-001');
});

console.log('5. block ingestion');
check('standard block yields haiku', () => {
  const hex = require('fs').readFileSync(__dirname + '/../codec/test_vectors.txt', 'utf8')
    .split('\n')[0].split(' ')[0];
  const r = game.ingestBlock(908559n, hex);
  assert(r.kind === 'standard' && r.haiku.length > 0);
});
check('neogenesis detected by block number', () => {
  assert(game.ingestBlock(908800n, null).kind === 'neogenesis'); // 908800 % 256 === 0
});
check('zeroed nonce -> pseudo (silent)', () => {
  assert(game.ingestBlock(908560n, null).kind === 'pseudo');
});
check('latestHaikuBlock returns the standard block', () => {
  assert(game.latestHaikuBlock().bnum === '908559');
});

console.log('6. end-to-end over HTTP (mock mesh)');
(async () => {
  const { server, pollOnce } = require('./index');
  await pollOnce(); // ingest mock chain tip
  await new Promise(r => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const j = async (method, path, body) => {
    const res = await fetch(base + path, {
      method, headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };

  const state = await j('GET', '/api/state');
  check('GET /api/state serves clock + live haiku', () => {
    assert(state.status === 200 && state.body.clock && state.body.haikuOfTheBlock.text);
  });
  const wb = await j('GET', '/api/wordbank');
  check('GET /api/wordbank serves 255 words', () => assert(wb.body.words.length === 255));

  const TAG_C = '0x' + 'c3'.repeat(20);
  const auth = await j('POST', '/api/auth/start', { tag: TAG_C });
  check('POST /api/auth/start returns memo instructions', () => {
    assert(auth.status === 200 && auth.body.memo && auth.body.instructions.includes(auth.body.memo));
  });
  const sub = await j('POST', '/api/haiku', { tag: TAG_C, frames: { a: FRAME, b: FRAME2 } });
  check('POST /api/haiku accepts a valid poem over HTTP', () => {
    assert(sub.status === 200 && sub.body.nonceHex.length === 64);
  });
  const bad = await j('POST', '/api/haiku', { tag: TAG_C, frames: { a: [5], b: [5] } });
  check('POST /api/haiku returns 422 for bad grammar', () => assert(bad.status === 422));
  const anth = await j('GET', '/api/anthology');
  check('GET /api/anthology lists the poem', () => {
    assert(anth.status === 200 && anth.body.entries.some(e => e.id === sub.body.id));
  });

  server.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
