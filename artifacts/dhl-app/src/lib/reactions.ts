export type ReactionKey =
  | "heart"
  | "fire"
  | "laugh"
  | "heart_eyes"
  | "wow"
  | "thumbsup"
  | "thumbsdown"
  | "sad"
  | "angry";

export interface ReactionDef {
  key: ReactionKey;
  emoji: string;
  label: string;
}

// The primary picker set shown in the UI.
export const REACTIONS: ReactionDef[] = [
  { key: "heart", emoji: "❤️", label: "Love" },
  { key: "fire", emoji: "🔥", label: "Fire" },
  { key: "laugh", emoji: "😂", label: "Haha" },
  { key: "heart_eyes", emoji: "😍", label: "Adore" },
  { key: "wow", emoji: "😮", label: "Wow" },
  { key: "thumbsup", emoji: "👍", label: "Like" },
];

// Legacy keys that may still exist on old reactions — never shown in the
// picker, but must keep rendering wherever counts/avatars appear.
const LEGACY_REACTIONS: ReactionDef[] = [
  { key: "thumbsdown", emoji: "👎", label: "Dislike" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "angry", emoji: "😡", label: "Angry" },
];

export const DEFAULT_REACTION: ReactionKey = "heart";

export const REACTION_MAP: Record<string, ReactionDef> = Object.fromEntries(
  [...REACTIONS, ...LEGACY_REACTIONS].map((r) => [r.key, r])
);
