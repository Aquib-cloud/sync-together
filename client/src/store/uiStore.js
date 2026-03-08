import { create } from "zustand";

const DEFAULT_CHAT_ANCHOR = "launcher";

const normalizeAnchor = (anchor) => (anchor === "sidebar" ? "sidebar" : DEFAULT_CHAT_ANCHOR);

const resolveAnchor = (options, fallbackAnchor = DEFAULT_CHAT_ANCHOR) => {
  if (typeof options === "string") {
    return normalizeAnchor(options);
  }
  if (options && typeof options === "object") {
    return normalizeAnchor(options.anchor);
  }
  return normalizeAnchor(fallbackAnchor);
};



// export const useUIStore = create((set) => ({
export const useUIStore = create((set, get) => ({
  chatOpen: false,
  activeChat: null,
  chatAnchor: DEFAULT_CHAT_ANCHOR,
  chatPositionNonce: 0,

  unreadCounts: {},
  joinRequests: [],

  openChat: (chatId = "room", options = {}) =>
    set((state) => ({
      chatOpen: true,
      activeChat: chatId,
      chatAnchor: resolveAnchor(options, state.chatAnchor),
      chatPositionNonce: state.chatPositionNonce + 1,
    })),

  openChatList: (options = {}) =>
    set((state) => ({
      chatOpen: true,
      activeChat: null,
      chatAnchor: resolveAnchor(options, state.chatAnchor),
      chatPositionNonce: state.chatPositionNonce + 1,
    })),

  closeChat: () =>
    set((state) => ({
      chatOpen: false,
      activeChat: null,
      chatAnchor: DEFAULT_CHAT_ANCHOR,
      chatPositionNonce: state.chatPositionNonce + 1,
    })),

  setChatOpen: (open) =>
    set((state) =>
      open
        ? { chatOpen: true }
        : {
          chatOpen: false,
          activeChat: null,
          chatAnchor: DEFAULT_CHAT_ANCHOR,
          chatPositionNonce: state.chatPositionNonce + 1,
        }
    ),

  setActiveChat: (chatId) => set({ activeChat: chatId }),
  setChatAnchor: (anchor) => set({ chatAnchor: normalizeAnchor(anchor) }),
  requestChatReposition: () =>
    set((state) => ({ chatPositionNonce: state.chatPositionNonce + 1 })),

  setUnreadCounts: (counts) => set({ unreadCounts: counts || {} }),

  incrementUnread: (chatId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: (state.unreadCounts?.[chatId] || 0) + 1,
      },
    })),

  resetUnread: (chatId) =>
    set((state) => ({
      unreadCounts: {
        ...state.unreadCounts,
        [chatId]: 0,
      },
    })),

  setJoinRequests: (list) => set({ joinRequests: list || [] }),

  inviteHandler: null,

  setInviteHandler: (fn) => set({ inviteHandler: fn }),

  triggerInvite: () => {
    const fn = get().inviteHandler;
    if (fn) fn();
  },

  addJoinRequest: (user) =>
    set((state) => {
      const id = user?.userId ?? user?.id;
      if (!id) return state;
      if (state.joinRequests.some((u) => (u.userId ?? u.id) === id)) return state;
      return { joinRequests: [...state.joinRequests, user] };
    }),

  removeJoinRequest: (id) =>
    set((state) => ({
      joinRequests: state.joinRequests.filter((u) => (u.userId ?? u.id) !== id),
    })),
}));
