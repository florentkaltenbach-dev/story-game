// Shared types for keeper-service (minimal subset)

export type KeeperMode =
  | "player_response"
  | "mc_query"
  | "mc_generate"
  | "journal_write"
  | "compression"
  | "thread_evaluation";
