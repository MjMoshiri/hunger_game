# hunger_game

An LLM-powered tournament engine that runs structured competitions between options and ranks them. Options are matched head-to-head, an LLM judge scores each matchup, and Elo ratings + a round-robin record decide the standings.

## Experiments

### Billboard Phrase Tournament

We asked five models — **Gemini, Claude, Deepseek, Grok, GPT** — to each generate 10 billboard-style phrases for the company, then ran a full round-robin (50 phrases, 1,225 matchups) with **Gemini** (`gemini-3.1-flash-lite-preview`) as the judge. Each matchup distributes 5 points between the two phrases and updates Elo ratings.

**→ [Full standings: `docs/tournament/STANDINGS.md`](docs/tournament/STANDINGS.md)**

Headline: **Claude won** the model leaderboard, with the single strongest phrase going 49-0. Raw verdicts live in [`data/tournament-result.json`](data/tournament-result.json).

## Engine

The reusable engine lives in `src/engine/`:

- `elo.ts` — Elo rating math (base 1500, K=32).
- `tournament.ts` — thin wrapper over [`tournament-organizer`](https://www.npmjs.com/package/tournament-organizer) (create, report, standings, (de)serialize).
- `judge.ts` — calls the Gemini API with structured output (pros/cons per item + a 5-point split) for a single matchup, with retry/backoff on truncated responses and 429/5xx.
- `runner.ts` — orchestrates a round-robin: judges every active match with a bounded concurrency pool and feeds results back as Elo updates.

## Running a tournament

1. Copy the env template and add your Gemini API key:

   ```bash
   cp .env.example .env.local
   # set GEMINI_API_KEY in .env.local
   ```

2. Run the tournament and generate the report:

   ```bash
   npm run tournament         # judges all matchups -> data/tournament-result.json
   npm run tournament:report  # builds docs/tournament/STANDINGS.md
   ```

   Concurrency defaults to 12; override with `GEMINI_CONCURRENCY`. The judge model can be overridden with `GEMINI_MODEL`.

## Development

This is a [Next.js](https://nextjs.org) app.

```bash
npm run dev    # start the dev server at http://localhost:3000
npm run build  # production build
npm run lint   # eslint
```
