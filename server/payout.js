#!/usr/bin/env node
/**
 * Payout CLI — plan an aeon's reward transaction (never signs).
 *
 *   npm run payout -- --aeon 3549                 plan + write files
 *   npm run payout -- --aeon 3549 --dry-run       print only
 *   npm run payout -- --aeon 3549 --force         regenerate over an existing plan
 *
 * Env: DB_FILE (game database), GAME_TAG (payer tag for Rosetta ops).
 * Outputs to server/data/payouts/aeon-<N>.{json,csv,rosetta.json}
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { open, defaultFile } = require('./db');
const { Game } = require('./game');
const rewards = require('./rewards');

const args = process.argv.slice(2);
const get = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined;
};

const aeon = get('aeon');
if (!aeon || aeon === true) {
  console.error('usage: payout --aeon <N> [--dry-run] [--force]');
  process.exit(2);
}

const db = open(process.env.DB_FILE || defaultFile());
const game = new Game(db);

const manifest = rewards.buildPayout(game, db, aeon, {
  gameTag: (process.env.GAME_TAG || '').toLowerCase() || null,
});

/* ---- human summary ---- */
const fmt = (n) => {
  const v = BigInt(n);
  const whole = v / rewards.MCM, frac = (v % rewards.MCM).toString().padStart(9, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac} MCM` : `${whole} MCM`;
};
console.log(`\nAeon ${manifest.aeon} payout plan — ${manifest.totals.recipients} recipients`);
console.log('─'.repeat(64));
for (const e of manifest.entries.slice(0, 15)) {
  console.log(`#${String(e.rank).padStart(3)}  ${e.tag.slice(0, 10)}…${e.tag.slice(-4)}  ${fmt(e.amount_nmcm).padStart(12)}  ${e.memo}`);
}
if (manifest.entries.length > 15) console.log(`  … +${manifest.entries.length - 15} more`);
if (manifest.skipped.length) {
  console.log(`\n⚠ skipped (not verified): ${manifest.skipped.length}`);
  for (const s of manifest.skipped.slice(0, 5)) console.log(`  #${s.rank} ${s.tag.slice(0, 10)}… (${s.reason})`);
}
console.log('─'.repeat(64));
console.log(`total prizes : ${fmt(manifest.totals.amount_nmcm)}`);
console.log(`network fee  : ${fmt(manifest.totals.fee_nmcm)}  (${manifest.limits.fee_per_destination_nmcm} nMCM × ${manifest.totals.recipients})`);
console.log(`fund needed  : ${fmt(manifest.totals.required_nmcm)}${manifest.source_tag ? `  from ${manifest.source_tag}` : '  (set GAME_TAG for Rosetta ops)'}`);

if (get('dry-run')) { console.log('\n(dry run — nothing written)'); process.exit(0); }

/* ---- persist + files ---- */
const fresh = rewards.persist(db, manifest, !!get('force'));
if (!fresh) {
  console.error(`\nA plan for aeon ${manifest.aeon} already exists — use --force to regenerate.`);
  process.exit(1);
}

const dir = path.join(__dirname, 'data', 'payouts');
fs.mkdirSync(dir, { recursive: true });
const base = path.join(dir, `aeon-${manifest.aeon}`);
fs.writeFileSync(base + '.json', JSON.stringify(manifest, null, 1));
fs.writeFileSync(base + '.csv', rewards.toCSV(manifest));
if (manifest.source_tag) {
  fs.writeFileSync(base + '.rosetta.json', JSON.stringify({
    network_identifier: { blockchain: 'mochimo', network: 'mainnet' },
    operations: rewards.toRosettaOperations(manifest),
  }, null, 1));
}
console.log(`\nwritten:\n  ${base}.json\n  ${base}.csv${manifest.source_tag ? `\n  ${base}.rosetta.json` : ''}`);
console.log('\nNext: review the CSV, then sign & send the multi-destination TX from');
console.log('your wallet (or feed the rosetta.json to mochimo-mesh /construction/*).');
