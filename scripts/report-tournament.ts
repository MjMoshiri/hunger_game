import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const RESULT_FILE = "data/tournament-result.json";
const OUTPUT_FILE = "docs/tournament/STANDINGS.md";

interface Verdict {
  title1: string;
  title2: string;
  item1Points: number;
  item2Points: number;
}

interface Standing {
  rank: number;
  playerId: string;
  name: string;
  rating: number;
  matchPoints: number;
  matchesPlayed: number;
  owner: string;
}

interface Result {
  entries: Array<{ id: string; owner: string; phrase: string }>;
  standings: Standing[];
  verdicts: Verdict[];
  failures: unknown[];
}

interface PhraseStats {
  wins: number;
  losses: number;
  draws: number;
  points: number;
}

function emptyStats(): PhraseStats {
  return { wins: 0, losses: 0, draws: 0, points: 0 };
}

function main(): void {
  const result = JSON.parse(readFileSync(RESULT_FILE, "utf8")) as Result;

  const stats = new Map<string, PhraseStats>();
  const ensure = (phrase: string): PhraseStats => {
    let s = stats.get(phrase);
    if (!s) {
      s = emptyStats();
      stats.set(phrase, s);
    }
    return s;
  };

  for (const v of result.verdicts) {
    const s1 = ensure(v.title1);
    const s2 = ensure(v.title2);
    s1.points += v.item1Points;
    s2.points += v.item2Points;
    if (v.item1Points > v.item2Points) {
      s1.wins += 1;
      s2.losses += 1;
    } else if (v.item2Points > v.item1Points) {
      s2.wins += 1;
      s1.losses += 1;
    } else {
      s1.draws += 1;
      s2.draws += 1;
    }
  }

  const rows = result.standings.map((standing) => ({
    ...standing,
    stats: stats.get(standing.name) ?? emptyStats(),
  }));

  const byModel = new Map<
    string,
    { points: number; wins: number; losses: number; draws: number; ratings: number[]; topRank: number }
  >();
  for (const row of rows) {
    let m = byModel.get(row.owner);
    if (!m) {
      m = { points: 0, wins: 0, losses: 0, draws: 0, ratings: [], topRank: Infinity };
      byModel.set(row.owner, m);
    }
    m.points += row.stats.points;
    m.wins += row.stats.wins;
    m.losses += row.stats.losses;
    m.draws += row.stats.draws;
    m.ratings.push(row.rating);
    m.topRank = Math.min(m.topRank, row.rank);
  }

  const modelRows = [...byModel.entries()]
    .map(([owner, m]) => ({
      owner,
      points: m.points,
      wins: m.wins,
      losses: m.losses,
      draws: m.draws,
      avgRating: Math.round(m.ratings.reduce((a, b) => a + b, 0) / m.ratings.length),
      best: m.topRank,
    }))
    .sort((a, b) => b.points - a.points || b.avgRating - a.avgRating);

  const medal = (rank: number): string => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "");

  const lines: string[] = [];
  lines.push("# Billboard Phrase Tournament — Standings");
  lines.push("");
  lines.push(
    `A round-robin of **${rows.length} billboard phrases** (10 each from 5 models), judged head-to-head by **Gemini** (\`gemini-3.1-flash-lite-preview\`).`,
  );
  lines.push(
    `Each matchup distributes **5 points** between the two phrases; ratings are Elo (start 1500, K=32). ${result.verdicts.length} matches judged, ${result.failures.length} failures.`,
  );
  lines.push("");
  lines.push("## Model Leaderboard");
  lines.push("");
  lines.push("Aggregated across each model's 10 phrases.");
  lines.push("");
  lines.push("| # | Model | Total Points | Record (W-L-D) | Avg Elo | Best Rank |");
  lines.push("|---|-------|-------------:|:--------------:|--------:|:---------:|");
  modelRows.forEach((m, i) => {
    lines.push(
      `| ${i + 1} ${medal(i + 1)} | **${m.owner}** | ${m.points} | ${m.wins}-${m.losses}-${m.draws} | ${m.avgRating} | #${m.best} |`,
    );
  });
  lines.push("");
  lines.push("## Phrase Standings");
  lines.push("");
  lines.push("| Rank | Phrase | Model | Elo | Points | W-L-D |");
  lines.push("|-----:|--------|-------|----:|-------:|:-----:|");
  for (const row of rows) {
    const phrase = row.name.replace(/\|/g, "\\|");
    lines.push(
      `| ${row.rank} ${medal(row.rank)} | ${phrase} | ${row.owner} | ${Math.round(row.rating)} | ${row.stats.points} | ${row.stats.wins}-${row.stats.losses}-${row.stats.draws} |`,
    );
  }
  lines.push("");

  mkdirSync(dirname(OUTPUT_FILE), { recursive: true });
  writeFileSync(OUTPUT_FILE, lines.join("\n"));

  console.log(`Wrote ${OUTPUT_FILE}`);
  console.log("\nModel leaderboard:");
  modelRows.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.owner} — ${m.points} pts, ${m.wins}-${m.losses}-${m.draws}, avg Elo ${m.avgRating}`);
  });
}

main();
