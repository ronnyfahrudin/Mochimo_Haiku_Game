/**
 * Rewards test suite (Milestone 4). Run: node server/rewards.test.js
 * In-memory DB; builds a full aeon with ranked winners, mixed verification.
 */

'use strict';

process.env.MESH_MOCK = '1';

const assert = require('assert');
const { open } = require('./db');
const { Game } = require('./game');
const rewards = require('./rewards');

let pass = 0, fail = 0;
function check(name, fn) {
  try { fn(); pass++; console.log(`  ok  - ${name}`); }
  catch (e) { fail++; console.log(`  FAIL - ${name}: ${e.message}`); }
}

/* ---------- stage an aeon ---------- */
const db = open(':memory:');
const game = new Game(db);
const BNUM = 908559n; // aeon 3549
const AEON = '3549';

const data = require('../codec/trigg_data.json');
const F = data.features;
const idx = (p) => data.dict.findIndex(p);
const FRAME = [idx(e => e.tok === 'in'), idx(e => (e.fe & F.F_TIMED) !== 0), 1, 5,
  idx(e => (e.fe & F.F_NS) !== 0), 1, idx(e => (e.fe & F.F_ING) !== 0)];
const ings = data.dict.map((e, i) => (e.fe & F.F_ING) ? i : -1).filter(i => i > 0);
const nss = data.dict.map((e, i) => (e.fe & F.F_NS) ? i : -1).filter(i => i > 0);

// 6 players; p5 stays UNVERIFIED
const tags = [];
for (let i = 0; i < 6; i++) {
  const tag = '0x' + String(i).repeat(2).padStart(2, String(i)).repeat(20).slice(0, 40);
  tags.push(tag);
  game.authStart(tag);
  if (i !== 5) game.authComplete(tag, 'tx' + i);
}

// each player submits one unique poem
const subs = [];
tags.forEach((tag, i) => {
  const b = [...FRAME]; b[4] = nss[i + 1]; b[6] = ings[i + 1];
  subs.push(game.submit(tag, { a: FRAME, b }, BNUM).id);
});

// votes: sub0 gets 5, sub1 gets 4, sub2 gets 3, sub3 gets 2, sub4 gets 1, sub5 (unverified owner) gets 4
const voteMap = [[0, 5], [1, 4], [5, 4], [2, 3], [3, 2], [4, 1]];
for (const [s, n] of voteMap) {
  let cast = 0;
  for (let v = 0; v < 6 && cast < n; v++) {
    if (tags[v] === undefined) continue;
    try { game.vote(tags[v], subs[s], BNUM); cast++; } catch { /* self/limit */ }
  }
}

/* ---------- tests ---------- */

console.log('1. schedule');
check('default schedule totals 21 MCM over 50 ranks', () => {
  const s = rewards.defaultSchedule();
  const total = Object.values(s).reduce((a, b) => a + b, 0n);
  assert.strictEqual(total, 21n * rewards.MCM); // 5+3+2 + 7×1 + 40×0.1 = 21
});

console.log('2. payout build');
const manifest = rewards.buildPayout(game, db, AEON, { gameTag: '0x' + 'ff'.repeat(20) });
check('entries ranked by leaderboard and only verified tags', () => {
  assert(manifest.entries.length >= 4);
  for (const e of manifest.entries) assert(e.tag !== tags[5], 'unverified paid!');
  const ranks = manifest.entries.map(e => e.rank);
  assert.deepStrictEqual([...ranks].sort((a, b) => a - b), ranks, 'ranks ordered');
});
check('unverified winner appears in skipped with reason', () => {
  assert(manifest.skipped.some(s => s.tag === tags[5] && /verified/.test(s.reason)));
});
check('memo format AEON-N-RANK-R preserved from leaderboard', () => {
  for (const e of manifest.entries) {
    assert.strictEqual(e.memo, `AEON-${AEON}-RANK-${String(e.rank).padStart(3, '0')}`);
  }
});
check('totals: fee = 500 nMCM per recipient; required = amount + fee', () => {
  const fee = BigInt(manifest.totals.fee_nmcm);
  assert.strictEqual(fee, rewards.FEE_PER_DST * BigInt(manifest.entries.length));
  assert.strictEqual(
    BigInt(manifest.totals.required_nmcm),
    BigInt(manifest.totals.amount_nmcm) + fee);
});
check('amounts follow the schedule for each paid rank', () => {
  const s = rewards.defaultSchedule();
  for (const e of manifest.entries) {
    assert.strictEqual(BigInt(e.amount_nmcm), s[e.rank]);
  }
});

console.log('3. artifacts');
check('CSV has header + one row per entry', () => {
  const csv = rewards.toCSV(manifest).trim().split('\n');
  assert.strictEqual(csv.length, 1 + manifest.entries.length);
  assert(csv[1].split(',').length === 3);
});
check('Rosetta ops: 1 source + N destinations, balanced sign', () => {
  const ops = rewards.toRosettaOperations(manifest);
  assert.strictEqual(ops.length, 1 + manifest.entries.length);
  assert(ops[0].type === 'SOURCE_TRANSFER' && ops[0].amount.value.startsWith('-'));
  const destSum = ops.slice(1).reduce((a, o) => a + BigInt(o.amount.value), 0n);
  assert.strictEqual(destSum, BigInt(manifest.totals.amount_nmcm));
  assert(ops.slice(1).every(o => o.metadata.reference.startsWith('AEON-')));
});
check('Rosetta ops require source tag', () => {
  const m2 = { ...manifest, source_tag: null };
  assert.throws(() => rewards.toRosettaOperations(m2), /source_tag/);
});

console.log('4. persistence & idempotency');
check('persist once, refuse duplicate, allow --force', () => {
  assert.strictEqual(rewards.persist(db, manifest), true);
  assert.strictEqual(rewards.persist(db, manifest), false);
  assert.strictEqual(rewards.persist(db, manifest, true), true);
  const back = rewards.getPersisted(db, AEON);
  assert.strictEqual(back.totals.required_nmcm, manifest.totals.required_nmcm);
});

console.log('5. cap');
check('never more than 256 destinations', () => {
  assert(manifest.entries.length <= rewards.MAX_DST);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
