export const SOCKET_EVENTS = {
  CHAT_MESSAGE: "chat:message",
  CHAT_TYPING: "chat:typing",
  PRESENCE_UPDATE: "presence:update",
  NOTIFICATION_NEW: "notification:new",
} as const;

export type SocketEvent = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
