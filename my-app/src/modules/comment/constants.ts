export const ALLOWED_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀"] as const;
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];
