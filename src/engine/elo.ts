export const DEFAULT_RATING = 1500;
export const DEFAULT_K_FACTOR = 32;

export type MatchOutcome = "player1" | "player2" | "draw";

export interface EloOptions {
  readonly kFactor?: number;
}

export interface RatingUpdate {
  readonly player1: number;
  readonly player2: number;
}

const SCORES: Record<MatchOutcome, readonly [number, number]> = {
  player1: [1, 0],
  player2: [0, 1],
  draw: [0.5, 0.5],
};

export function expectedScore(rating: number, opponentRating: number): number {
  return 1 / (1 + 10 ** ((opponentRating - rating) / 400));
}

export function updateRatings(
  rating1: number,
  rating2: number,
  outcome: MatchOutcome,
  options: EloOptions = {},
): RatingUpdate {
  const kFactor = options.kFactor ?? DEFAULT_K_FACTOR;
  const [score1, score2] = SCORES[outcome];

  return {
    player1: Math.round(rating1 + kFactor * (score1 - expectedScore(rating1, rating2))),
    player2: Math.round(rating2 + kFactor * (score2 - expectedScore(rating2, rating1))),
  };
}

export function outcomeFromGameCounts(player1Wins: number, player2Wins: number): MatchOutcome {
  if (player1Wins > player2Wins) return "player1";
  if (player2Wins > player1Wins) return "player2";
  return "draw";
}
