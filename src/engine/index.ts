export { Manager } from "tournament-organizer/components";

export {
  DEFAULT_K_FACTOR,
  DEFAULT_RATING,
  expectedScore,
  outcomeFromGameCounts,
  updateRatings,
} from "./elo";
export type { EloOptions, MatchOutcome, RatingUpdate } from "./elo";

export {
  createTournament,
  deserialize,
  getStandings,
  reportResult,
  serialize,
} from "./tournament";
export type {
  CreateTournamentOptions,
  MatchResult,
  PlayerSeed,
  Standing,
  TournamentFormat,
} from "./tournament";
