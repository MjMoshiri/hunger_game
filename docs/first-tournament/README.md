# First Tournament — Founder Intro-Post Titles

The first run of the tournament engine. 40 candidate titles for a founder's company-launch post were entered into a full **round-robin** and judged head-to-head by **Grok (`grok-4.3`)**. Every pairing played once — **780 matches** — and ratings were tracked with **Elo**.

## The question being optimized

Each match asked the judge to compare two titles for a founder introducing a company that uses LLM-powered tournament-style evaluations, targeting a "tech bro" audience (founders, AI builders, growth, product, VC-adjacent operators), on which is more **scroll-stopping, clear, novel, and likely to drive engagement**.

The judge had **5 points to split** between the two titles (e.g. `5-0`, `4-1`, `3-2`) plus concise pros/cons for each. More points wins the match.

## Results

📊 **[Full standings →](./STANDINGS.md)**

**Podium**

| # | Title | Elo | W–L |
| --: | :-- | --: | :-: |
| 🥇 | I Built an "AI Fight Club" for Your Marketing Copy. Here's Who Wins. | 1800 | 37–2 |
| 🥈 | We Replaced Our Client's 6-Week A/B Test With a 6-Hour Tournament. Here's What Happened. | 1778 | 36–3 |
| 🥉 | A/B Testing Is Dead. Long Live the Tournament. | 1773 | 35–4 |

**Wooden spoon:** *"Tired of Flawed Experiments and Slow Results?"* went 0–39 — beaten by every other title.

**Read of the field:** concrete, voice-driven hooks ("AI Fight Club", a real 6-week→6-hour before/after) and punchy "A/B testing is dead" framings dominated. Abstract, category-defining lines ("We're Turning Business Experiments into Structured Competitions") and bare questions landed at the bottom.

## How to read the table

- **Order / `#`** — the tournament standing, ranked by match record (wins, then tiebreakers).
- **Elo** — a parallel rating that weighs *who* you beat, not just how many. It mostly tracks the standing but can diverge slightly (beating strong titles is worth more). Start 1500, K = 32.
- **W–L** — match wins and losses across the 39 games each title played. No draws are possible (5 points can't split evenly).
- **Points** — total points the title collected across all matches (max 195 = 39 × 5). A finer-grained margin than W–L.

## Reproduce

```bash
# 1. Put your xAI key in .env.local
echo 'XAI_API_KEY=xai-...' >> .env.local

# 2. Run the round-robin (writes data/first-tournament-result.json)
npm run tournament

# 3. Regenerate this standings table from the saved result
npm run tournament:report
```

- Contestants: [`data/first-tournament.txt`](../../data/first-tournament.txt) (one title per line).
- Full output, including every match's pros/cons and point split: [`data/first-tournament-result.json`](../../data/first-tournament-result.json).
- Engine: [`src/engine`](../../src/engine) — `judge.ts` (Grok call), `tournament.ts` (structure + Elo), `runner.ts` (round-robin orchestration).
