import { Manager } from "tournament-organizer/components";

import {
  judgePair,
  POINTS_PER_MATCH,
  type JudgeOptions,
  type JudgeVerdict,
} from "./judge";
import {
  createTournament,
  getStandings,
  reportResult,
  serialize,
  type Standing,
} from "./tournament";

export interface MatchupVerdict extends JudgeVerdict {
  readonly matchId: string;
  readonly round: number;
  readonly title1: string;
  readonly title2: string;
}

export interface MatchFailure {
  readonly matchId: string;
  readonly round: number;
  readonly title1: string;
  readonly title2: string;
  readonly error: string;
}

export interface RoundRobinResult {
  readonly standings: Standing[];
  readonly verdicts: MatchupVerdict[];
  readonly failures: MatchFailure[];
  readonly serialized: string;
}

export interface RoundRobinOptions {
  readonly name?: string;
  readonly double?: boolean;
  readonly concurrency?: number;
  readonly judge?: JudgeOptions;
  readonly onMatch?: (completed: number, total: number) => void;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function runRoundRobin(
  items: readonly string[],
  options: RoundRobinOptions = {},
): Promise<RoundRobinResult> {
  const manager = new Manager();
  const tournament = createTournament(manager, options.name ?? "round-robin", {
    format: options.double ? "double-round-robin" : "round-robin",
    players: items.map((title, index) => ({ name: title, id: String(index + 1) })),
    scoring: { bestOf: POINTS_PER_MATCH * 2 - 1 },
  });

  const totalRounds = tournament.getStageOne().rounds;
  const concurrency = Math.max(1, options.concurrency ?? 4);
  const total = tournament
    .getMatches()
    .filter((match) => match.getPlayer1().id !== null && match.getPlayer2().id !== null).length;
  const verdicts: MatchupVerdict[] = [];
  const failures: MatchFailure[] = [];
  let completed = 0;

  while (true) {
    const matches = tournament.getActiveMatches();
    const roundVerdicts = await mapWithConcurrency(matches, concurrency, async (match) => {
      const player1Id = match.getPlayer1().id;
      const player2Id = match.getPlayer2().id;
      if (player1Id === null || player2Id === null) {
        return null;
      }

      const matchId = match.getId();
      const round = match.getRoundNumber();
      const title1 = tournament.getPlayer(player1Id).getName();
      const title2 = tournament.getPlayer(player2Id).getName();

      try {
        const verdict = await judgePair(title1, title2, options.judge);
        reportResult(tournament, matchId, {
          player1Wins: verdict.item1Points,
          player2Wins: verdict.item2Points,
        });
        completed += 1;
        options.onMatch?.(completed, total);
        return { matchId, round, title1, title2, ...verdict } satisfies MatchupVerdict;
      } catch (error) {
        tournament.enterResult(matchId, 0, 0);
        failures.push({
          matchId,
          round,
          title1,
          title2,
          error: error instanceof Error ? error.message : String(error),
        });
        completed += 1;
        options.onMatch?.(completed, total);
        return null;
      }
    });

    for (const verdict of roundVerdicts) {
      if (verdict !== null) {
        verdicts.push(verdict);
      }
    }

    if (tournament.getRoundNumber() >= totalRounds) {
      break;
    }
    tournament.nextRound();
  }

  return {
    standings: getStandings(tournament),
    verdicts,
    failures,
    serialized: serialize(tournament),
  };
}
