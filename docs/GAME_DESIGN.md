# Game Design — The Verse Keepers (MVP: Haiku Forge)

## Vision
A calm, poetic word game that onboards non-crypto players into Mochimo.
Zero friction to play; a wallet is only needed to claim on-chain rewards.

## Visual identity
Derived from the official Mochimo mark: mint green (~#35E5A1) line-work on
dark charcoal (~#1E2528). Terminal/CRT poetry aesthetic. Seasons tint the
palette each Aeon (spring/summer/autumn/winter, 4 Aeons ≈ 1 day).

## Core loop (MVP)
1. Home shows the live **Haiku of the Block** (real nonce decoded from the
   latest standard block via Mesh API; pseudoblocks & neogenesis have zeroed
   nonces — shown as "the network is silent" / "the world is reborn").
2. **Forge**: player assembles a haiku from the network's 256-word bank.
   The composer enforces the exact consensus grammar (trigg_syntax port) —
   a finished haiku is a structurally valid Mochimo nonce. Show the player
   their haiku's 32-byte nonce hex as a badge ("this poem could mine a block").
3. Submit to the **Anthology of the Aeon** (max 3 submissions per account per Aeon).
4. **Vote** (verified accounts only, 5 votes per Aeon, no self-votes).
5. At Neogenesis: leaderboard freezes; top N verses earn nanoMochi; one
   multi-destination payout TX with memo `AEON-<n>-RANK-<r>`; anthology archived.

## Accounts & anti-abuse
- Guest: can forge and read; cannot vote or earn.
- Verified: Mochimo account tag + one-time micro-TX with unique memo code.
  One tag = one identity; creating fakes costs real fees.
- Rate limits per tag and per IP; profanity filter unnecessary (closed vocabulary!).

## Reward economics (initial)
- Aeon prize pool funded by treasury/sponsors; fixed schedule, e.g.
  rank 1: 5 MCM, 2: 3 MCM, 3: 2 MCM, 4–10: 1 MCM, 11–50: 0.1 MCM (tunable).
- Payout fee for 256 recipients = 128,000 nanoMochi total — negligible.

## Later modes (post-MVP)
- Verse Divination: guess masked words of the live block haiku (real-time).
- Block Watch: light predictions on next-block properties.
- Weekly "Grand Anthology" compiled from Aeon winners; shareable art cards.
