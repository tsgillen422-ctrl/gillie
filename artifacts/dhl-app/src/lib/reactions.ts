export type ReactionKey = "thumbsup" | "thumbsdown" | "heart" | "laugh" | "sad" | "angry";

export interface ReactionDef {
  key: ReactionKey;
  emoji: string;
  label: string;
}

export const REACTIONS: ReactionDef[] = [
  { key: "thumbsup", emoji: "👍", label: "Like" },
  { key: "heart", emoji: "❤️", label: "Love" },
  { key: "laugh", emoji: "😂", label: "Haha" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "angry", emoji: "😡", label: "Angry" },
  { key: "thumbsdown", emoji: "👎", label: "Dislike" },
];

export const DEFAULT_REACTION: ReactionKey = "heart";

export const REACTION_MAP: Record<string, ReactionDef> = Object.fromEntries(
  REACTIONS.map((r) => [r.key, r])
);
