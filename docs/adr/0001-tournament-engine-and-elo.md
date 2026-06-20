# ADR 0001: Tournament engine and Elo

- Status: Proposed
- Date: 2026-06-19

## Decision

- Engine: **`tournament-organizer`** (npm, v4.1.1, MIT, TypeScript).
- Elo: compute ourselves (no dep).

## Notes

Formats via `stageOne.format`:

- single knockout → `single-elimination`
- double knockout → `double-elimination` (min 4 players)
- round robin → `round-robin` / `double-round-robin`
- Elo over N rounds → `swiss` + `stageOne.rounds: N`

ESM-only package. Default export is `Manager`; classes live under `tournament-organizer/components`, interfaces under `tournament-organizer/interfaces`. Almost everything is read via getters, not public fields.

Key methods :

- `manager.createTournament(name, settings)`
- `tournament.startTournament()` — required before results; throws with <2 players (<4 for double-elimination)
- `tournament.createPlayer(name, id?)` — add players before `startTournament()` (Swiss may add after)
- `enterResult(matchId, p1Wins, p2Wins, draws?)` — game-count based
- `nextRound()` — swiss/round-robin only (elim auto-advances). Throws if called past the configured `stageOne.rounds`, so stop at `rounds`. After the final Swiss round `getStatus()` stays `stage-one`, not `complete`.
- `getStandings()` — match record, not Elo
- `tournament.getValues()` ⇄ `manager.loadTournament(values)` — JSON round-trip

Elo: library only **reads** `Player.value` (for seeding/sort), never recalculates it. We compute Elo and write back via `player.set({ value })`. The library owns structure (pairings/brackets); we own ratings.

Engine implementation: `src/engine/` — `elo.ts` (pure math), `tournament.ts` (typed create/report/standings/serialize, writes Elo back to `value`), `index.ts` (barrel).
