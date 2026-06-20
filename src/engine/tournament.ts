import type { Manager, Tournament } from "tournament-organizer/components";
import type {
  LoadableTournamentValues,
  SettableTournamentValues,
} from "tournament-organizer/interfaces";

import {
  DEFAULT_RATING,
  outcomeFromGameCounts,
  updateRatings,
  type EloOptions,
} from "./elo";

export type TournamentFormat =
  | "single-elimination"
  | "double-elimination"
  | "round-robin"
  | "double-round-robin"
  | "swiss";

export interface PlayerSeed {
  readonly name: string;
  readonly id?: string;
  readonly rating?: number;
}

export interface CreateTournamentOptions {
  readonly format: TournamentFormat;
  readonly players: readonly PlayerSeed[];
  readonly rounds?: number;
  readonly consolation?: boolean;
  readonly scoring?: SettableTournamentValues["scoring"];
}

export interface MatchResult {
  readonly player1Wins: number;
  readonly player2Wins: number;
  readonly draws?: number;
}

export interface Standing {
  readonly rank: number;
  readonly playerId: string;
  readonly name: string;
  readonly rating: number;
  readonly matchPoints: number;
  readonly matchesPlayed: number;
}

export function createTournament(
  manager: Manager,
  name: string,
  options: CreateTournamentOptions,
): Tournament {
  const tournament = manager.createTournament(name, {
    sorting: "descending",
    scoring: options.scoring,
    stageOne: {
      format: options.format,
      rounds: options.rounds,
      consolation: options.consolation,
    },
  });

  for (const seed of options.players) {
    const player = tournament.createPlayer(seed.name, seed.id);
    player.set({ value: seed.rating ?? DEFAULT_RATING });
  }

  tournament.startTournament();
  return tournament;
}

export function reportResult(
  tournament: Tournament,
  matchId: string,
  result: MatchResult,
  eloOptions?: EloOptions,
): void {
  const match = tournament.getMatch(matchId);
  const player1 = match.getPlayer1();
  const player2 = match.getPlayer2();

  tournament.enterResult(matchId, result.player1Wins, result.player2Wins, result.draws);

  if (player1.id === null || player2.id === null) {
    return;
  }

  const outcome = outcomeFromGameCounts(result.player1Wins, result.player2Wins);
  const seed1 = tournament.getPlayer(player1.id);
  const seed2 = tournament.getPlayer(player2.id);
  const updated = updateRatings(seed1.getValue(), seed2.getValue(), outcome, eloOptions);

  seed1.set({ value: updated.player1 });
  seed2.set({ value: updated.player2 });
}

export function getStandings(tournament: Tournament): Standing[] {
  return tournament.getStandings().map((entry, index) => ({
    rank: index + 1,
    playerId: entry.player.getId(),
    name: entry.player.getName(),
    rating: entry.player.getValue(),
    matchPoints: entry.matchPoints,
    matchesPlayed: entry.matches,
  }));
}

export function serialize(tournament: Tournament): string {
  return JSON.stringify(tournament.getValues());
}

export function deserialize(manager: Manager, data: string): Tournament {
  return manager.loadTournament(JSON.parse(data) as LoadableTournamentValues);
}
