/**
 * Aeon clock — maps Mochimo block numbers to game time.
 * An Aeon is 256 blocks. Block numbers where (bnum % 256 === 0) are
 * neogenesis blocks (full ledger snapshots, zeroed nonce, no haiku).
 * 4 Aeons ≈ 1 day, mapped to the four seasons.
 */

'use strict';

const AEON_BLOCKS = 256n;
const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

function toBig(bnum) {
  return typeof bnum === 'bigint' ? bnum : BigInt(bnum);
}

/** Aeon index for a block number (neogenesis block N*256 opens aeon N). */
function aeonOf(bnum) {
  return toBig(bnum) / AEON_BLOCKS;
}

/** Position within the current aeon: 0 (neogenesis) .. 255. */
function blockInAeon(bnum) {
  return Number(toBig(bnum) % AEON_BLOCKS);
}

/** Blocks remaining until the next neogenesis. */
function blocksToNeogenesis(bnum) {
  return 256 - blockInAeon(bnum);
}

/** Season name for an aeon (rotates every aeon; 4 aeons ≈ 1 day). */
function seasonOf(aeon) {
  return SEASONS[Number(toBig(aeon) % 4n)];
}

/** True if this block number is a neogenesis block. */
function isNeogenesisNumber(bnum) {
  return blockInAeon(bnum) === 0;
}

/** Full clock snapshot for the UI. */
function clock(bnum) {
  const aeon = aeonOf(bnum);
  return {
    block: toBig(bnum).toString(),
    aeon: aeon.toString(),
    blockInAeon: blockInAeon(bnum),
    blocksToNeogenesis: blocksToNeogenesis(bnum),
    season: seasonOf(aeon),
    isNeogenesis: isNeogenesisNumber(bnum),
  };
}

module.exports = { AEON_BLOCKS, aeonOf, blockInAeon, blocksToNeogenesis, seasonOf, isNeogenesisNumber, clock };
