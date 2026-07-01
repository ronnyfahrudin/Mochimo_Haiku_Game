/**
 * Mochimo Haiku Codec
 * -------------------
 * Faithful JavaScript port of the haiku-related parts of Trigg's Algorithm
 * from the Mochimo reference implementation (src/trigg.c / src/trigg.h).
 *
 * A Mochimo block nonce is 32 bytes = two independent 16-byte "haiku frames".
 * Each byte indexes the 256-word semantic dictionary. A frame is valid when
 * its sequence of semantic features unifies with one of 10 grammar frames
 * (trigg_syntax). Expansion (trigg_expand) turns bytes into readable text.
 *
 * Data (dictionary + frames) is machine-extracted from the C source by
 * scripts/extract_dict.py into trigg_data.json — no hand copying.
 */

'use strict';

const data = require('./trigg_data.json');

const MAXH = 16;
const F_XLIT = data.features.F_XLIT; // 0x20000

const DICT = data.dict;      // [{ tok, fe } x 256]
const FRAMES = data.frames;  // [10][16] semantic feature rows

/* ------------------------------------------------------------------ */
/* Expansion: nonce bytes -> haiku text (port of trigg_expand)         */
/* ------------------------------------------------------------------ */

/**
 * Expand one 16-byte haiku frame into raw token text.
 * Mirrors trigg_expand(): tokens are concatenated, separated by a space
 * unless the token itself ends with '\n'. Control chars ('\b') are kept
 * raw here; use render() for display text.
 * @param {Uint8Array|Buffer} frame16 - 16 bytes (a zero byte terminates)
 * @returns {string} raw expanded text (may contain '\n' and '\b')
 */
function expandFrame(frame16) {
  let out = '';
  for (let i = 0; i < MAXH; i++) {
    const b = frame16[i];
    if (b === 0) break;
    const tok = DICT[b].tok;
    out += tok;
    if (!tok.endsWith('\n')) out += ' ';
  }
  return out;
}

/**
 * Post-process raw expanded text for human display.
 * '\b' in a token means "attach to the previous word" (e.g. plural "s",
 * "--", ":") — it erases the space that expansion inserted before it.
 */
function render(raw) {
  let out = '';
  for (const ch of raw) {
    if (ch === '\b') {
      if (out.endsWith(' ')) out = out.slice(0, -1);
    } else {
      out += ch;
    }
  }
  return out.replace(/[ \t]+\n/g, '\n').replace(/[ \t]+$/g, '').trimEnd();
}

/**
 * Decode a full 32-byte Mochimo nonce into its haiku.
 * @param {Uint8Array|Buffer|string} nonce - 32 bytes or hex string (0x ok)
 * @returns {{ text: string, frames: [string, string], valid: boolean,
 *             validFrames: [boolean, boolean] }}
 */
function decodeNonce(nonce) {
  const buf = toBytes(nonce, 32);
  const a = buf.subarray(0, 16);
  const b = buf.subarray(16, 32);
  const va = syntaxOk(a);
  const vb = syntaxOk(b);
  const ra = render(expandFrame(a));
  const rb = render(expandFrame(b));
  return {
    text: (ra + '\n' + rb).replace(/\n+/g, '\n').trim(),
    frames: [ra, rb],
    validFrames: [va, vb],
    valid: va && vb,
  };
}

/* ------------------------------------------------------------------ */
/* Syntax: grammar validation (port of trigg_syntax)                   */
/* ------------------------------------------------------------------ */

/**
 * Validate one 16-byte haiku frame against the 10 semantic grammar frames.
 * Faithful port of trigg_syntax().
 */
function syntaxOk(frame16) {
  const sf = new Array(MAXH);
  for (let j = 0; j < MAXH; j++) sf[j] = DICT[frame16[j]].fe >>> 0;

  for (let f = 0; f < FRAMES.length; f++) {
    const fp = FRAMES[f];
    let j = 0;
    let matched = true;
    for (; j < MAXH; j++) {
      if (fp[j] === 0) {
        if (sf[j] === 0) return true; // frame ended and nonce ended: OK
        matched = false;
        break;
      }
      if (fp[j] & F_XLIT) {
        if ((fp[j] & 255) !== frame16[j]) { matched = false; break; }
        continue;
      }
      if ((sf[j] & fp[j]) === 0) { matched = false; break; }
    }
    if (matched && j >= MAXH) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* Composition: words -> frame bytes (for the Haiku Forge)             */
/* ------------------------------------------------------------------ */

/** Map from display word -> list of dictionary indices carrying it. */
const WORD_INDEX = (() => {
  const m = new Map();
  DICT.forEach((e, i) => {
    const key = e.tok.replace(/[\b\n]/g, '');
    if (!m.has(key)) m.set(key, []);
    m.get(key).push(i);
  });
  return m;
})();

/**
 * Compose a 16-byte frame from an ordered list of dictionary indices.
 * Returns null if it doesn't satisfy the network grammar.
 * @param {number[]} indices - dictionary indices (1..255), max 16
 */
function composeFrame(indices) {
  if (indices.length > MAXH) return null;
  const frame = new Uint8Array(MAXH); // zero-filled terminator
  indices.forEach((v, i) => { frame[i] = v & 255; });
  return syntaxOk(frame) ? frame : null;
}

/**
 * Compose a full 32-byte nonce from two frames of dictionary indices.
 * A player-forged haiku that passes this IS a structurally valid Mochimo
 * mining nonce — the same rule the network enforces in peach_check().
 */
function composeNonce(indicesA, indicesB) {
  const a = composeFrame(indicesA);
  const b = composeFrame(indicesB);
  if (!a || !b) return null;
  const nonce = new Uint8Array(32);
  nonce.set(a, 0);
  nonce.set(b, 16);
  return nonce;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function toBytes(x, len) {
  if (typeof x === 'string') {
    const hex = x.startsWith('0x') ? x.slice(2) : x;
    if (hex.length !== len * 2) throw new Error(`expected ${len}-byte hex`);
    const out = new Uint8Array(len);
    for (let i = 0; i < len; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  if (x.length !== len) throw new Error(`expected ${len} bytes`);
  return x instanceof Uint8Array ? x : new Uint8Array(x);
}

/** Word bank for the Forge UI: display word, indices, semantic features. */
function wordBank() {
  return DICT.map((e, i) => ({
    index: i,
    word: e.tok.replace(/[\b\n]/g, ''),
    joinsPrevious: e.tok.startsWith('\b'),
    endsLine: e.tok.endsWith('\n'),
    features: e.fe,
  })).filter((w) => w.index !== 0); // 0 = NIL terminator
}

module.exports = {
  MAXH,
  DICT,
  FRAMES,
  expandFrame,
  render,
  decodeNonce,
  syntaxOk,
  composeFrame,
  composeNonce,
  wordBank,
};
