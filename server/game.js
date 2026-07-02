/**
 * Game logic — auth (tag + memo micro-TX), the Forge (submissions),
 * voting, leaderboards, and live-block ingestion.
 */

'use strict';

const crypto = require('crypto');
const { decodeNonce, composeNonce } = require('../codec/haiku');
const { clock } = require('./aeon');

const LIMITS = {
  SUBMISSIONS_PER_AEON: 3,
  VOTES_PER_AEON: 5,
};

const TAG_RE = /^0x[0-9a-f]{40}$/i; // 20-byte Mochimo account tag

class Game {
  constructor(db) {
    this.db = db;
  }

  /* ---------------- auth ---------------- */

  /**
   * Begin login for a tag. Returns a memo code the player must include in a
   * micro-TX to the game address (Mochimo memo grammar: caps/digit groups
   * separated by dashes, letter and digit groups must alternate).
   */
  authStart(tag) {
    if (!TAG_RE.test(tag)) throw httpErr(400, 'invalid tag (expect 0x + 40 hex chars)');
    tag = tag.toLowerCase();
    const row = this.db.prepare('SELECT verified, memo_code FROM players WHERE tag = ?').get(tag);
    if (row && row.verified) return { tag, verified: true };
    // e.g. HAIKU-4F21-AB : alternating letter/digit groups, valid memo format
    const hex = crypto.randomBytes(3).toString('hex').toUpperCase();
    const memo = `HAIKU-${hex.slice(0, 4).replace(/[A-F]/g, c => String(c.charCodeAt(0) - 65))}-${hex.slice(4).replace(/[0-9]/g, c => String.fromCharCode(65 + Number(c)))}`;
    if (row) {
      this.db.prepare('UPDATE players SET memo_code = ? WHERE tag = ?').run(memo, tag);
    } else {
      this.db.prepare('INSERT INTO players (tag, memo_code, created_at) VALUES (?, ?, ?)')
        .run(tag, memo, Date.now());
    }
    return { tag, verified: false, memo };
  }

  /** Mark a player verified after their deposit memo was found on-chain. */
  authComplete(tag, txid) {
    this.db.prepare('UPDATE players SET verified = 1, verify_txid = ?, memo_code = NULL WHERE tag = ?')
      .run(txid || 'manual', tag.toLowerCase());
    return { tag: tag.toLowerCase(), verified: true };
  }

  player(tag) {
    return this.db.prepare('SELECT tag, name, verified FROM players WHERE tag = ?')
      .get(tag.toLowerCase()) || null;
  }

  /* ---------------- the Forge ---------------- */

  /**
   * Submit a haiku for the current aeon.
   * frames = { a: number[], b: number[] } — dictionary indices.
   * Grammar is enforced by the consensus-verified codec: a passing haiku
   * IS a structurally valid Mochimo mining nonce.
   */
  submit(tag, frames, currentBnum) {
    tag = tag.toLowerCase();
    const p = this.player(tag);
    if (!p) throw httpErr(401, 'unknown tag - call /api/auth/start first');
    const aeon = clock(currentBnum).aeon;

    const count = this.db.prepare('SELECT COUNT(*) c FROM submissions WHERE aeon = ? AND tag = ?')
      .get(aeon, tag).c;
    if (count >= LIMITS.SUBMISSIONS_PER_AEON) {
      throw httpErr(429, `submission limit reached (${LIMITS.SUBMISSIONS_PER_AEON}/aeon)`);
    }

    const nonce = composeNonce(frames.a || [], frames.b || []);
    if (!nonce) throw httpErr(422, 'haiku does not satisfy the network grammar');
    const nonceHex = Buffer.from(nonce).toString('hex');
    const text = decodeNonce(nonce).text;

    try {
      const r = this.db.prepare(
        'INSERT INTO submissions (aeon, tag, frame_a, frame_b, nonce_hex, text, created_at) VALUES (?,?,?,?,?,?,?)'
      ).run(aeon, tag, JSON.stringify(frames.a), JSON.stringify(frames.b), nonceHex, text, Date.now());
      return { id: Number(r.lastInsertRowid), aeon, nonceHex, text };
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) throw httpErr(409, 'this exact poem already exists in this aeon');
      throw e;
    }
  }

  /* ---------------- voting ---------------- */

  vote(voterTag, submissionId, currentBnum) {
    voterTag = voterTag.toLowerCase();
    const p = this.player(voterTag);
    if (!p) throw httpErr(401, 'unknown tag');
    if (!p.verified) throw httpErr(403, 'voting requires a verified wallet');
    const aeon = clock(currentBnum).aeon;

    const sub = this.db.prepare('SELECT id, tag, aeon FROM submissions WHERE id = ?').get(submissionId);
    if (!sub) throw httpErr(404, 'submission not found');
    if (sub.aeon !== aeon) throw httpErr(410, 'that anthology is closed');
    if (sub.tag === voterTag) throw httpErr(403, 'no self-votes');

    const used = this.db.prepare('SELECT COUNT(*) c FROM votes WHERE aeon = ? AND voter_tag = ?')
      .get(aeon, voterTag).c;
    if (used >= LIMITS.VOTES_PER_AEON) throw httpErr(429, `vote limit reached (${LIMITS.VOTES_PER_AEON}/aeon)`);

    try {
      this.db.prepare('INSERT INTO votes (aeon, voter_tag, submission_id, created_at) VALUES (?,?,?,?)')
        .run(aeon, voterTag, submissionId, Date.now());
    } catch (e) {
      if (String(e.message).includes('UNIQUE') || String(e.message).includes('PRIMARY'))
        throw httpErr(409, 'already voted for this poem');
      throw e;
    }
    return { ok: true, votesLeft: LIMITS.VOTES_PER_AEON - used - 1 };
  }

  /* ---------------- reading ---------------- */

  anthology(aeon) {
    return this.db.prepare(`
      SELECT s.id, s.tag, s.text, s.nonce_hex, s.created_at, COUNT(v.submission_id) AS votes
      FROM submissions s LEFT JOIN votes v ON v.submission_id = s.id
      WHERE s.aeon = ?
      GROUP BY s.id ORDER BY votes DESC, s.created_at ASC`).all(String(aeon));
  }

  /** Frozen ranking of an aeon — used for reward payouts (M4). */
  leaderboard(aeon, topN = 256) {
    return this.anthology(aeon).slice(0, topN)
      .map((r, i) => ({ rank: i + 1, ...r, memo: `AEON-${aeon}-RANK-${String(i + 1).padStart(3, '0')}` }));
  }

  /* ---------------- live chain ingestion ---------------- */

  /** Record a block; returns { kind, haiku } for broadcasting. */
  ingestBlock(bnum, nonceHex) {
    const c = clock(bnum);
    let kind = 'standard';
    let haiku = null;
    if (c.isNeogenesis) kind = 'neogenesis';
    else if (!nonceHex) kind = 'pseudo';
    else {
      const d = decodeNonce(nonceHex);
      haiku = d.text;
      if (!d.valid) kind = 'pseudo'; // defensive: unparseable nonce -> treat as silent
    }
    this.db.prepare('INSERT OR IGNORE INTO seen_blocks (bnum, nonce_hex, haiku, kind, seen_at) VALUES (?,?,?,?,?)')
      .run(c.block, nonceHex || null, haiku, kind, Date.now());
    return { ...c, kind, haiku };
  }

  latestHaikuBlock() {
    return this.db.prepare(
      "SELECT bnum, haiku, nonce_hex FROM seen_blocks WHERE kind = 'standard' ORDER BY CAST(bnum AS INTEGER) DESC LIMIT 1"
    ).get() || null;
  }
}

function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

module.exports = { Game, LIMITS, TAG_RE };
