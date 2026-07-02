/**
 * HaikuClient — browser-side grammar engine for the Forge.
 * Loads dictionary/frames from GET /api/grammar and offers:
 *   - guided composition: which words may come next, given a prefix
 *   - full-frame validation (same algorithm as consensus trigg_syntax)
 *   - nonce hex + rendered text preview
 *
 * Written as a plain script (no modules) so the same file runs in the
 * browser AND in Node for the cross-check test against codec/haiku.js.
 */

(function (root) {
  'use strict';

  const MAXH = 16;
  let DICT = null, FRAMES = null, F_XLIT = 0;

  function init(grammar) {
    DICT = grammar.dict;      // [{tok, fe} x 256]
    FRAMES = grammar.frames;  // [10][16]
    F_XLIT = grammar.features.F_XLIT;
  }

  /* ---- core matching (mirrors codec/haiku.js syntaxOk) ---- */

  function matchAt(frameRow, pos, wordIdx) {
    const fv = frameRow[pos];
    if (fv & F_XLIT) return (fv & 255) === wordIdx;
    return (DICT[wordIdx].fe & fv) !== 0;
  }

  /** Consensus-grammar validation of a complete frame (array of indices). */
  function isValidFrame(indices) {
    if (indices.length > MAXH) return false;
    const padded = indices.concat(new Array(MAXH - indices.length).fill(0));
    for (const row of FRAMES) {
      let ok = true;
      for (let j = 0; j < MAXH; j++) {
        if (row[j] === 0) { ok = padded[j] === 0 ? true : false; if (padded[j] === 0) return true; break; }
        if (padded[j] === 0) { ok = false; break; }
        if (!matchAt(row, j, padded[j])) { ok = false; break; }
      }
      if (ok) return true;
    }
    return false;
  }

  /**
   * Guided composition: given a prefix of word indices, return
   *   { next: Set<int> of allowed word indices, canEnd: bool }
   * derived from all grammar frames the prefix still satisfies.
   */
  function allowedNext(prefix) {
    const next = new Set();
    let canEnd = false;
    if (prefix.length > MAXH) return { next, canEnd };
    for (const row of FRAMES) {
      let ok = true;
      for (let j = 0; j < prefix.length; j++) {
        if (row[j] === 0 || !matchAt(row, j, prefix[j])) { ok = false; break; }
      }
      if (!ok) continue;
      const pos = prefix.length;
      if (pos >= MAXH || row[pos] === 0) { canEnd = true; continue; }
      if (row[pos] & F_XLIT) next.add(row[pos] & 255);
      else for (let w = 1; w < 256; w++) if (DICT[w].fe & row[pos]) next.add(w);
    }
    return { next, canEnd };
  }

  /* ---- rendering (mirrors codec expandFrame + render) ---- */

  function renderFrame(indices) {
    let raw = '';
    for (const i of indices) {
      const tok = DICT[i].tok;
      raw += tok;
      if (!tok.endsWith('\n')) raw += ' ';
    }
    let out = '';
    for (const ch of raw) {
      if (ch === '\b') { if (out.endsWith(' ')) out = out.slice(0, -1); }
      else out += ch;
    }
    return out.replace(/[ \t]+\n/g, '\n').replace(/[ \t]+$/g, '').replace(/\s+$/, '');
  }

  function nonceHex(framesA, framesB) {
    const bytes = new Array(32).fill(0);
    framesA.slice(0, MAXH).forEach((v, i) => { bytes[i] = v & 255; });
    framesB.slice(0, MAXH).forEach((v, i) => { bytes[16 + i] = v & 255; });
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function displayWord(i) {
    const tok = DICT[i].tok;
    if (tok === '\n') return '↵';
    return tok.replace(/[\b\n]/g, '');
  }

  const api = { init, isValidFrame, allowedNext, renderFrame, nonceHex, displayWord, MAXH,
    get dict() { return DICT; } };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaikuClient = api;
})(typeof window !== 'undefined' ? window : globalThis);
