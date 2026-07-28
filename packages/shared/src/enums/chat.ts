export const CONVERSATION_TYPES = ["PM_CLIENT", "TEAM", "DISPUTE"] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

export const MESSAGE_TYPES = ["TEXT", "SYSTEM"] as const;
export type MessageType = (typeof MESSAGE_TYPES)[number];
