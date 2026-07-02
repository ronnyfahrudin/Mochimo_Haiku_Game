# Deploying The Haiku Keepers

The whole game is one zero-dependency Node.js process (Node ≥ 22.5) that serves
both the API and the PWA, plus a SQLite file. That's it.

## Environment

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `8090` | HTTP port (API + web) |
| `MESH_URL` | `https://api.mochimo.org` | Mesh API endpoint |
| `MESH_MOCK` | – | `1` = offline demo chain (dev only) |
| `POLL_MS` | `10000` | chain poll interval |
| `DB_FILE` | `server/data/haiku.db` | SQLite path |
| `GAME_TAG` | – | the game's own account tag: players send their login micro-TX here; also the payer in payout plans. **Required in production.** |

## First run checklist

1. Create a dedicated Mochimo account for the game; set its tag as `GAME_TAG`.
2. `npm run probe` — one-shot live check that the Mesh nonce field mapping in
   `server/mesh.js#extractNonceHex` matches your Mesh version. Compare the
   printed haiku with the same block on mochiscan.org. (One-line fix if not.)
3. `npm start`, open the site, forge a poem end-to-end, run a login micro-TX
   and confirm `/api/auth/check` flips to verified.

## Bare metal (systemd)

```ini
# /etc/systemd/system/haiku-keepers.service
[Unit]
Description=The Haiku Keepers (Mochimo Haiku Game)
After=network-online.target

[Service]
User=haiku
WorkingDirectory=/opt/haiku-keepers
Environment=PORT=8090
Environment=GAME_TAG=0xYOURGAMETAG...
Environment=DB_FILE=/var/lib/haiku-keepers/haiku.db
ExecStart=/usr/bin/node server/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

Put a reverse proxy (Caddy/nginx) in front for TLS. The app is a single
origin — no special routing needed; everything is under one port.

## Docker

```bash
docker build -t haiku-keepers .
docker run -d --name haiku-keepers \
  -p 8090:8090 \
  -e GAME_TAG=0xYOURGAMETAG... \
  -v haiku-data:/data \
  haiku-keepers
```

## Aeon operations (rewards)

At each Neogenesis the leaderboard freezes automatically. To pay an aeon:

```bash
npm run payout -- --aeon <N> --dry-run   # review
npm run payout -- --aeon <N>             # writes aeon-N.{json,csv,rosetta.json}
```

Review the CSV, then sign & broadcast the multi-destination TX **from your
wallet** (or feed `aeon-N.rosetta.json` to mochimo-mesh `/construction/*`).
The server never holds keys. Keep the manifests — they're the public audit
trail matching on-chain memos `AEON-N-RANK-R` to the archived anthology.

## Backups

Everything lives in the single SQLite file (`DB_FILE`) and the payout
manifests directory (`server/data/payouts/`). Snapshot both. The chain data
(`seen_blocks`) rebuilds itself from the network if lost; player, poem, and
vote tables are the precious parts.

## CI

`.github/workflows/ci.yml` runs the full offline test suite (73 assertions)
on every push and pull request with Node 22.
