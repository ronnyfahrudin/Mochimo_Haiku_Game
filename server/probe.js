/**
 * Live Mesh API probe — run on a machine with internet access:
 *   npm run probe
 * Prints raw /network/status and /block responses so you can confirm the
 * nonce field mapping in mesh.extractNonceHex() for your Mesh version.
 */
'use strict';
const mesh = require('./mesh');
(async () => {
  const s = await mesh.networkStatus();
  console.log('tip:', s.blockNumber.toString(), s.blockHash);
  const block = await mesh.getBlock(s.blockNumber);
  console.log('\n--- raw block.metadata ---');
  console.log(JSON.stringify(block && block.metadata, null, 2));
  const nonce = mesh.extractNonceHex(block);
  console.log('\nextracted nonce:', nonce || '(none / zeroed)');
  if (nonce) {
    const { decodeNonce } = require('../codec/haiku');
    const d = decodeNonce(nonce);
    console.log('valid:', d.valid, '\n--- haiku of the block ---\n' + d.text);
  }
})().catch(e => { console.error(e); process.exit(1); });
