/**
 * Rewards — Milestone 4.
 * Builds the per-aeon payout for the frozen leaderboard as a single Mochimo
 * multi-destination transaction (up to 256 recipients, fee 500 nMCM per
 * destination), expressed as:
 *   1. a human-auditable JSON manifest,
 *   2. a CSV (tag, amount, memo),
 *   3. Rosetta Construction API operations (for signing via mochimo-mesh).
 *
 * SECURITY MODEL: this module never touches keys and never signs.
 * The server/CLI only *plans* the payout; signing happens wallet-side.
 *
 * Eligibility: only VERIFIED players are paid (their tag ownership was
 * proven by the memo micro-TX). Unverified winners are listed under
 * `skipped` so operators can chase them, but funds are never sent to a
 * tag nobody has proven they control.
 */

'use strict';

const MCM = 1_000_000_000n;           // 1 MCM = 1e9 nanoMochi
const FEE_PER_DST = 500n;             // nanoMochi, network minimum per destination
const MAX_DST = 256;                  // Mochimo multi-destination TX limit

/** Default prize schedule, in nanoMochi by rank (1-based). */
function defaultSchedule() {
  const s = {};
  s[1] = 5n * MCM;
  s[2] = 3n * MCM;
  s[3] = 2n * MCM;
  for (let r = 4; r <= 10; r++) s[r] = 1n * MCM;
  for (let r = 11; r <= 50; r++) s[r] = MCM / 10n; // 0.1 MCM
  return s;
}

/**
 * Build the payout plan for a frozen aeon.
 * @param {Game} game - server game instance (leaderboard source)
 * @param {object} db - sqlite handle (players table for verification status)
 * @param {string|number|bigint} aeon
 * @param {object} [opts]
 * @param {Object<number,bigint>} [opts.schedule] rank -> nanoMochi
 * @param {string} [opts.gameTag] source account tag (payer)
 * @returns payout manifest object
 */
function buildPayout(game, db, aeon, opts = {}) {
  const schedule = opts.schedule || defaultSchedule();
  const ranks = game.leaderboard(String(aeon), MAX_DST);

  const verifiedOf = (tag) => {
    const p = db.prepare('SELECT verified FROM players WHERE tag = ?').get(tag);
    return !!(p && p.verified);
  };

  const entries = [];
  const skipped = [];
  for (const r of ranks) {
    const amount = schedule[r.rank] || 0n;
    if (amount <= 0n) continue; // beyond the prize table
    const row = {
      rank: r.rank, tag: r.tag, votes: r.votes, memo: r.memo,
      poem: r.text, amount_nmcm: amount.toString(),
    };
    if (!verifiedOf(r.tag)) { skipped.push({ ...row, reason: 'tag not verified' }); continue; }
    entries.push(row);
    if (entries.length >= MAX_DST) break;
  }

  const total = entries.reduce((a, e) => a + BigInt(e.amount_nmcm), 0n);
  const fee = FEE_PER_DST * BigInt(entries.length);

  return {
    kind: 'mochimo-haiku-game/payout',
    version: 1,
    network: 'mainnet',
    aeon: String(aeon),
    created_at: new Date().toISOString(),
    source_tag: opts.gameTag || null,
    limits: { max_destinations: MAX_DST, fee_per_destination_nmcm: FEE_PER_DST.toString() },
    totals: {
      recipients: entries.length,
      amount_nmcm: total.toString(),
      fee_nmcm: fee.toString(),
      required_nmcm: (total + fee).toString(),
    },
    entries,
    skipped,
  };
}

/** CSV for spreadsheet review / wallet import: tag,amount_nmcm,memo */
function toCSV(manifest) {
  const rows = ['tag,amount_nmcm,memo'];
  for (const e of manifest.entries) rows.push(`${e.tag},${e.amount_nmcm},${e.memo}`);
  return rows.join('\n') + '\n';
}

/**
 * Rosetta Construction API operations (mochimo-mesh /construction/*):
 * one negative SOURCE_TRANSFER from the game tag, one positive
 * DESTINATION_TRANSFER per winner with the rank memo in metadata.
 */
function toRosettaOperations(manifest) {
  if (!manifest.source_tag) throw new Error('source_tag (GAME_TAG) required for Rosetta operations');
  const ops = [];
  let i = 0;
  ops.push({
    operation_identifier: { index: i++ },
    type: 'SOURCE_TRANSFER',
    account: { address: manifest.source_tag },
    amount: { value: '-' + manifest.totals.required_nmcm, currency: { symbol: 'MCM', decimals: 9 } },
  });
  for (const e of manifest.entries) {
    ops.push({
      operation_identifier: { index: i++ },
      type: 'DESTINATION_TRANSFER',
      account: { address: e.tag },
      amount: { value: e.amount_nmcm, currency: { symbol: 'MCM', decimals: 9 } },
      metadata: { reference: e.memo },
    });
  }
  return ops;
}

/** Persist a manifest for idempotency/audit. Returns false if it existed. */
function persist(db, manifest, force = false) {
  db.exec(`CREATE TABLE IF NOT EXISTS payouts (
    aeon TEXT PRIMARY KEY, manifest TEXT NOT NULL, created_at INTEGER NOT NULL)`);
  const existing = db.prepare('SELECT aeon FROM payouts WHERE aeon = ?').get(manifest.aeon);
  if (existing && !force) return false;
  db.prepare('INSERT OR REPLACE INTO payouts (aeon, manifest, created_at) VALUES (?,?,?)')
    .run(manifest.aeon, JSON.stringify(manifest), Date.now());
  return true;
}

function getPersisted(db, aeon) {
  try {
    const row = db.prepare('SELECT manifest FROM payouts WHERE aeon = ?').get(String(aeon));
    return row ? JSON.parse(row.manifest) : null;
  } catch { return null; }
}

module.exports = {
  MCM, FEE_PER_DST, MAX_DST,
  defaultSchedule, buildPayout, toCSV, toRosettaOperations, persist, getPersisted,
};
