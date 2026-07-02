/**
 * Storage layer — Node's built-in SQLite (node:sqlite, Node >= 22.5).
 * Zero external dependencies. DB file lives in server/data/ (gitignored);
 * tests use in-memory databases.
 */

'use strict';

const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');
const path = require('path');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS players (
  tag TEXT PRIMARY KEY,             -- 20-byte Mochimo account tag (0x hex)
  name TEXT,
  verified INTEGER NOT NULL DEFAULT 0,
  memo_code TEXT,                   -- pending verification memo
  verify_txid TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  aeon TEXT NOT NULL,
  tag TEXT NOT NULL REFERENCES players(tag),
  frame_a TEXT NOT NULL,            -- JSON array of dict indices
  frame_b TEXT NOT NULL,
  nonce_hex TEXT NOT NULL,          -- the composed, grammar-valid nonce
  text TEXT NOT NULL,               -- rendered haiku
  created_at INTEGER NOT NULL,
  UNIQUE(aeon, nonce_hex)           -- no duplicate poems per aeon
);
CREATE INDEX IF NOT EXISTS idx_sub_aeon ON submissions(aeon);
CREATE TABLE IF NOT EXISTS votes (
  aeon TEXT NOT NULL,
  voter_tag TEXT NOT NULL REFERENCES players(tag),
  submission_id INTEGER NOT NULL REFERENCES submissions(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (aeon, voter_tag, submission_id)
);
CREATE TABLE IF NOT EXISTS seen_blocks (
  bnum TEXT PRIMARY KEY,
  nonce_hex TEXT,
  haiku TEXT,
  kind TEXT NOT NULL,               -- standard | pseudo | neogenesis
  seen_at INTEGER NOT NULL
);
`;

function open(file) {
  if (file && file !== ':memory:') {
    fs.mkdirSync(path.dirname(file), { recursive: true });
  }
  const db = new DatabaseSync(file || ':memory:');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

function defaultFile() {
  return process.env.DB_FILE || path.join(__dirname, 'data', 'haiku.db');
}

module.exports = { open, defaultFile };
