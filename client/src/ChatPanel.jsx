import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { socket } from "./socket";
import { Rnd } from "react-rnd";
import "./ChatPanel.css";
import "@fortawesome/fontawesome-free/css/all.css";
import { useUIStore } from "./store/uiStore";
import {
  EDGE_PADDING,
  LAUNCHER_HEIGHT,
  getLauncherPosition,
  getSafeViewportPosition,
  getSafeViewportSize,
  getSidebarPosition,
  getViewportRect,
} from "./utils/chatPositioning";

const PANEL_MIN_WIDTH = 300;
const PANEL_MIN_HEIGHT = 350;
const PANEL_DEFAULT_WIDTH = 360;
const PANEL_DEFAULT_HEIGHT = 460;
const ANCHOR_TRANSITION_MS = 240;
const MOBILE_BREAKPOINT = 768;
const MOBILE_NAV_HEIGHT = 60;
const MOBILE_SHEET_RATIO = 0.6;
const MOBILE_SHEET_MIN_HEIGHT = 260;
const MOBILE_SHEET_MAX_HEIGHT = 680;
const MOBILE_COLLAPSED_HEIGHT = 60;

const getSidebarRect = () => {
  const sidebar = document.querySelector(".ig-sidebar");
  if (!sidebar) return null;
  const rect = sidebar.getBoundingClientRect();
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return rect;
};

export default function ChatPanel({ roomId, device, members = [] }) {
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setChatOpen = useUIStore((s) => s.setChatOpen);
  const openChatList = useUIStore((s) => s.openChatList);
  const activeChat = useUIStore((s) => s.activeChat);
  const setActiveChat = useUIStore((s) => s.setActiveChat);
  const closeChatStore = useUIStore((s) => s.closeChat);
  const chatAnchor = useUIStore((s) => s.chatAnchor);
  const chatPositionNonce = useUIStore((s) => s.chatPositionNonce);
  const unreadCounts = useUIStore((s) => s.unreadCounts);
  const incrementUnread = useUIStore((s) => s.incrementUnread);
  const resetUnread = useUIStore((s) => s.resetUnread);

  const [input, setInput] = useState("");
  const [roomMessages, setRoomMessages] = useState([]);
  const [privateMessages, setPrivateMessages] = useState({});
  const [lastMessages, setLastMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState([]);
  const [showNewMsgBtn, setShowNewMsgBtn] = useState(false);
  const [panelMode, setPanelMode] = useState("list");
  const [viewportRect, setViewportRect] = useState(() => getViewportRect());
  const [panelSize, setPanelSize] = useState({
    width: PANEL_DEFAULT_WIDTH,
    height: PANEL_DEFAULT_HEIGHT,
  });
  const [panelPosition, setPanelPosition] = useState(() =>
    getLauncherPosition({
      width: PANEL_DEFAULT_WIDTH,
      height: LAUNCHER_HEIGHT,
      viewport: getViewportRect(),
      edgePadding: EDGE_PADDING,
    })
  );
  const [isAnchorAnimating, setIsAnchorAnimating] = useState(false);

  const typingTimeout = useRef();
  const inputRef = useRef();
  const lastTypingSent = useRef(0);
  const messagesContainerRef = useRef();
  const isAtBottomRef = useRef(true);
  const anchorTimerRef = useRef(null);

  const safePanelSize = useMemo(
    () =>
      getSafeViewportSize({
        width: panelSize.width,
        height: panelSize.height,
        minWidth: PANEL_MIN_WIDTH,
        minHeight: PANEL_MIN_HEIGHT,
        viewport: viewportRect,
        edgePadding: EDGE_PADDING,
      }),
    [panelSize.width, panelSize.height, viewportRect]
  );

  const collapsedHeight = Math.min(
    LAUNCHER_HEIGHT,
    Math.max(48, viewportRect.height - EDGE_PADDING * 2)
  );

  const maxPanelWidth = Math.max(180, viewportRect.width - EDGE_PADDING * 2);
  const maxPanelHeight = Math.max(120, viewportRect.height - EDGE_PADDING * 2);
  const minPanelWidth = Math.min(PANEL_MIN_WIDTH, maxPanelWidth);
  const minPanelHeight = Math.min(PANEL_MIN_HEIGHT, maxPanelHeight);

  const renderedWidth = safePanelSize.width;
  const renderedHeight = chatOpen ? safePanelSize.height : collapsedHeight;
  const isMobileViewport = viewportRect.width < MOBILE_BREAKPOINT;

  const mobileMaxAllowedHeight = Math.max(
    MOBILE_COLLAPSED_HEIGHT,
    viewportRect.height - MOBILE_NAV_HEIGHT - EDGE_PADDING * 2
  );
  const mobileSheetHeight = Math.min(
    MOBILE_SHEET_MAX_HEIGHT,
    mobileMaxAllowedHeight,
    Math.max(MOBILE_SHEET_MIN_HEIGHT, Math.round(viewportRect.height * MOBILE_SHEET_RATIO))
  );
  const mobileSheetOffset = Math.max(0, mobileSheetHeight - MOBILE_COLLAPSED_HEIGHT);

  const currentMessages = useMemo(
    () => (activeChat === "room" ? roomMessages : privateMessages?.[activeChat] ?? []),
    [activeChat, privateMessages, roomMessages]
  );

  const activeUser = useMemo(
    () => members.find((m) => m.id === activeChat)?.name || "User",
    [members, activeChat]
  );

  const anchorPosition = useCallback(
    (anchor, openState = chatOpen) => {
      const width = safePanelSize.width;
      const height = openState ? safePanelSize.height : collapsedHeight;

      if (anchor === "sidebar" && openState) {
        return getSidebarPosition({
          width,
          height,
          sidebarRect: getSidebarRect(),
          viewport: viewportRect,
          edgePadding: EDGE_PADDING,
        });
      }

      return getLauncherPosition({
        width,
        height,
        viewport: viewportRect,
        edgePadding: EDGE_PADDING,
      });
    },
    [chatOpen, safePanelSize.width, safePanelSize.height, collapsedHeight, viewportRect]
  );

  useEffect(() => {
    const syncViewport = () => setViewportRect(getViewportRect());

    syncViewport();
    window.addEventListener("resize", syncViewport);
    window.addEventListener("orientationchange", syncViewport);

    const vv = window.visualViewport;
    vv?.addEventListener("resize", syncViewport);
    vv?.addEventListener("scroll", syncViewport);

    return () => {
      window.removeEventListener("resize", syncViewport);
      window.removeEventListener("orientationchange", syncViewport);
      vv?.removeEventListener("resize", syncViewport);
      vv?.removeEventListener("scroll", syncViewport);
    };
  }, []);

  useEffect(() => {
    setPanelSize((prev) => {
      if (prev.width === safePanelSize.width && prev.height === safePanelSize.height) {
        return prev;
      }
      return safePanelSize;
    });
  }, [safePanelSize]);

  useEffect(() => {
    if (isMobileViewport) return;
    setPanelPosition((prev) =>
      getSafeViewportPosition({
        x: prev.x,
        y: prev.y,
        width: renderedWidth,
        height: renderedHeight,
        viewport: viewportRect,
        edgePadding: EDGE_PADDING,
      })
    );
  }, [isMobileViewport, renderedWidth, renderedHeight, viewportRect]);

  useEffect(() => {
    if (isMobileViewport) {
      setIsAnchorAnimating(false);
      return;
    }
    const next = anchorPosition(chatAnchor, chatOpen);
    setPanelPosition(next);

    clearTimeout(anchorTimerRef.current);
    setIsAnchorAnimating(true);
    anchorTimerRef.current = setTimeout(() => {
      setIsAnchorAnimating(false);
    }, ANCHOR_TRANSITION_MS);
  }, [chatPositionNonce, chatAnchor, chatOpen, anchorPosition, isMobileViewport]);

  useEffect(() => {
    if (!chatOpen) {
      setPanelMode("list");
    } else if (activeChat) {
      setPanelMode("thread");
    } else {
      setPanelMode("list");
    }
  }, [chatOpen, activeChat]);

  useEffect(
    () => () => {
      clearTimeout(anchorTimerRef.current);
    },
    []
  );

  useEffect(() => {
    if (chatOpen && panelMode === "thread") {
      inputRef.current?.focus();
    }
  }, [chatOpen, panelMode, activeChat]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || panelMode !== "thread") return;

    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setShowNewMsgBtn(false);
    } else {
      setShowNewMsgBtn(true);
    }
  }, [currentMessages, panelMode]);

  useEffect(() => {
    if (panelMode !== "thread") return;
    const el = messagesContainerRef.current;
    if (!el) return;

    const handleScroll = () => {
      const threshold = 60;
      const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
      isAtBottomRef.current = isBottom;
    };

    handleScroll();
    el.addEventListener("scroll", handleScroll);
    return () => el.removeEventListener("scroll", handleScroll);
  }, [panelMode]);

  useEffect(() => () => clearTimeout(typingTimeout.current), []);

  useEffect(() => {
    const handler = (msg) => {
      setRoomMessages((prev) => [...prev.slice(-128), msg]);
      if (!chatOpen || activeChat !== "room") {
        incrementUnread("room");
      }
      setLastMessages((m) => ({ ...m, room: msg }));
    };
    socket.on("roomMessage", handler);
    return () => socket.off("roomMessage", handler);
  }, [chatOpen, activeChat, incrementUnread]);

  useEffect(() => {
    const handler = (msg) => {
      const chatId = msg.senderId === socket.id ? msg.targetUserId : msg.senderId;

      setPrivateMessages((prev) => ({
        ...prev,
        [chatId]: [...(prev[chatId] || []).slice(-200), msg],
      }));

      if (!chatOpen || activeChat !== chatId) {
        incrementUnread(chatId);
      }

      setLastMessages((m) => ({
        ...m,
        [chatId]: msg,
      }));
    };

    socket.on("privateMessage", handler);
    return () => socket.off("privateMessage", handler);
  }, [chatOpen, activeChat, incrementUnread]);

  useEffect(() => {
    const addTypingRoom = ({ user }) => {
      if (activeChat !== "room" || user === device) return;
      setTypingUsers((prev) => [...new Set([...prev, user])]);
    };

    const removeTypingRoom = ({ user }) => {
      if (activeChat !== "room") return;
      setTypingUsers((prev) => prev.filter((u) => u !== user));
    };

    const addTypingDM = ({ user, senderId }) => {
      if (activeChat !== senderId || user === device) return;
      setTypingUsers((prev) => [...new Set([...prev, user])]);
    };

    const removeTypingDM = ({ user, senderId }) => {
      if (activeChat !== senderId) return;
      setTypingUsers((prev) => prev.filter((u) => u !== user));
    };

    socket.on("typingRoom", addTypingRoom);
    socket.on("stopTypingRoom", removeTypingRoom);
    socket.on("typingDM", addTypingDM);
    socket.on("stopTypingDM", removeTypingDM);

    return () => {
      socket.off("typingRoom", addTypingRoom);
      socket.off("stopTypingRoom", removeTypingRoom);
      socket.off("typingDM", addTypingDM);
      socket.off("stopTypingDM", removeTypingDM);
    };
  }, [activeChat, device]);

  useEffect(() => {
    if (!activeChat) return;
    resetUnread(activeChat);
  }, [activeChat, resetUnread]);

  useEffect(() => {
    const el = messagesContainerRef.current;
    if (!el || panelMode !== "thread" || !isAtBottomRef.current) return;

    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [typingUsers, panelMode]);

  const emitTyping = () => {
    if (!activeChat) return;
    const now = Date.now();
    if (now - lastTypingSent.current < 800) return;
    lastTypingSent.current = now;
    clearTimeout(typingTimeout.current);

    if (activeChat === "room") {
      socket.emit("typingRoom");
      typingTimeout.current = setTimeout(() => socket.emit("stopTypingRoom"), 1200);
      return;
    }

    socket.emit("typingDM", { targetUserId: activeChat });
    typingTimeout.current = setTimeout(
      () => socket.emit("stopTypingDM", { targetUserId: activeChat }),
      1200
    );
  };

  const sendMessage = () => {
    const message = input.trim();
    if (!message || !activeChat) return;

    if (activeChat === "room") {
      socket.emit("stopTypingRoom", { roomId });
      socket.emit("roomMessage", {
        roomId,
        senderName: device,
        message,
      });
    } else {
      socket.emit("stopTypingDM", { targetUserId: activeChat });
      socket.emit("privateMessage", {
        targetUserId: activeChat,
        senderName: device,
        message,
      });
    }

    setInput("");
  };

  const closeChat = () => {
    closeChatStore?.();
    setPanelMode("list");
  };

  const openChatPanel = () => {
    setActiveChat(null);
    setPanelMode("list");
    openChatList({ anchor: "launcher" });
  };

  const selectConversation = (id) => {
    setActiveChat(id);
    setChatOpen(true);
    setPanelMode("thread");
  };

  const handleBack = () => {
    setActiveChat(null);
    setPanelMode("list");
  };

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    const diffMs = Date.now() - date.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMs / 3600000);
    const days = Math.floor(diffMs / 86400000);

    if (minutes < 1) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const conversations = useMemo(() => {
    const list = [
      {
        id: "room",
        name: "Room Chat",
        preview: lastMessages.room?.message || "Start a room conversation",
        time: lastMessages.room?.time,
        unread: unreadCounts.room || 0,
        avatar: `https://i.pravatar.cc/80?u=${roomId || "room"}`,
      },
    ];

    members
      .filter((user) => user.id !== socket.id)
      .forEach((user) => {
        const lastMsg = lastMessages[user.id];
        list.push({
          id: user.id,
          name: user.name,
          preview: lastMsg?.message || "Tap to chat",
          time: lastMsg?.time,
          unread: unreadCounts[user.id] || 0,
          avatar: `https://i.pravatar.cc/80?u=${user.id}`,
        });
      });

    return list;
  }, [members, lastMessages, unreadCounts, roomId]);

  const avatarStack = conversations.slice(0, 3).map((c) => c.avatar);
  const unreadTotal = Object.values(unreadCounts || {}).reduce(
    (sum, value) => sum + (value || 0),
    0
  );

  const launcherButton = (
    <button className="messages-launcher" type="button" onClick={openChatPanel}>
      {unreadTotal > 0 && (
        <span className="ig-badge">
          {unreadTotal > 99 ? "99+" : unreadTotal}
        </span>
      )}
      <i className="fa-solid fa-paper-plane"></i>
      <span>Messages</span>
      <div className="launcher-avatars">
        {avatarStack.map((src, idx) => (
          <img key={src + idx} src={src} alt="avatar" />
        ))}
      </div>
    </button>
  );

  const chatBody = (
    <div
      className={`ig-chat-panel open ${panelMode === "thread" ? "thread-mode" : ""} ${
        chatAnchor === "sidebar" ? "anchor-sidebar" : "anchor-launcher"
      }`}
    >
      <div className={`ig-chat-header ${isMobileViewport ? "" : "drag-handle"}`.trim()}>
        <div className="header-left">
          {activeChat && (
            <button className="back-btn" type="button" onClick={handleBack} title="Back">
              <i className="fa-solid fa-chevron-left"></i>
            </button>
          )}
        </div>
        <div className="header-title">
          {activeChat ? (activeChat === "room" ? "Room Chat" : activeUser) : "Messages"}
        </div>
        <div className="header-right">
          <button className="close-btn" type="button" title="Close" onClick={closeChat}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>

      <div className="ig-panel-body" data-mode={panelMode}>
        <div className={`ig-chat-list ${panelMode === "list" ? "active" : ""}`}>
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`ig-chat-item ${
                activeChat === conversation.id ? "active" : ""
              } ${conversation.unread ? "unread" : ""}`}
              type="button"
              onClick={() => selectConversation(conversation.id)}
            >
              <div className="ig-avatar">
                <img src={conversation.avatar} alt={`${conversation.name} avatar`} />
              </div>

              <div className="ig-chat-meta">
                <div className="ig-chat-line">
                  <span className="ig-name">{conversation.name}</span>
                  <span className="ig-time">{formatTimestamp(conversation.time)}</span>
                </div>
                <div className="ig-chat-line">
                  <span className="ig-preview">{conversation.preview}</span>
                  {conversation.unread ? <span className="ig-unread-dot" /> : null}
                </div>
              </div>
            </button>
          ))}
          {conversations.length === 0 && (
            <div className="ig-empty">No conversations yet.</div>
          )}
        </div>

        <div className={`ig-thread ${panelMode === "thread" ? "active" : ""}`}>
          <div className="ig-thread-messages" ref={messagesContainerRef}>
            {showNewMsgBtn && (
              <button
                className="new-msg-chip"
                type="button"
                onClick={() => {
                  const el = messagesContainerRef.current;
                  if (!el) return;
                  el.scrollTop = el.scrollHeight;
                  setShowNewMsgBtn(false);
                }}
              >
                New messages
              </button>
            )}

            {currentMessages.map((msg) => {
              const isMine = msg?.senderId === socket.id;
              return (
                <div
                  key={`${msg.time}-${msg.senderId}-${msg.message}`}
                  className={`ig-msg ${isMine ? "mine" : ""}`}
                >
                  {!isMine && <div className="ig-msg-sender">{msg.senderName}</div>}
                  <div className="ig-msg-bubble">{msg.message}</div>
                  <div className="ig-msg-time">
                    {new Date(msg.time).toLocaleTimeString([], {
                      hour: "numeric",
                      minute: "2-digit",
                      hour12: true,
                    })}
                  </div>
                </div>
              );
            })}

            {typingUsers.length > 0 && (
              <div className="ig-typing">
                <span className="dot"></span>
                <span className="dot"></span>
                <span className="dot"></span>
                {activeChat === "room" && (
                  <span className="typing-label">
                    {typingUsers.join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing...
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="ig-thread-input">
            <textarea
              className="ig-message-input"
              placeholder="Message..."
              value={input}
              ref={inputRef}
              onChange={(event) => {
                setInput(event.target.value);
                emitTyping();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
            />
            <button type="button" className="ig-send-btn" onClick={sendMessage}>
              <i className="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const desktopPanel = (
    <Rnd
      className={`chat-rnd ${isAnchorAnimating ? "anchor-transition" : ""}`.trim()}
      style={{ zIndex: 1 }}
      size={{ width: renderedWidth, height: renderedHeight }}
      position={panelPosition}
      onDragStop={(_, data) => {
        setPanelPosition(
          getSafeViewportPosition({
            x: data.x,
            y: data.y,
            width: renderedWidth,
            height: renderedHeight,
            viewport: viewportRect,
            edgePadding: EDGE_PADDING,
          })
        );
      }}
      onResizeStop={(_, __, ref, ___, position) => {
        const nextSize = getSafeViewportSize({
          width: ref.offsetWidth,
          height: ref.offsetHeight,
          minWidth: PANEL_MIN_WIDTH,
          minHeight: PANEL_MIN_HEIGHT,
          viewport: viewportRect,
          edgePadding: EDGE_PADDING,
        });

        setPanelSize(nextSize);
        setPanelPosition(
          getSafeViewportPosition({
            x: position.x,
            y: position.y,
            width: nextSize.width,
            height: nextSize.height,
            viewport: viewportRect,
            edgePadding: EDGE_PADDING,
          })
        );
      }}
      minWidth={chatOpen ? minPanelWidth : renderedWidth}
      minHeight={chatOpen ? minPanelHeight : collapsedHeight}
      maxWidth={maxPanelWidth}
      maxHeight={chatOpen ? maxPanelHeight : collapsedHeight}
      dragHandleClassName="drag-handle"
      bounds="window"
      enableResizing={
        chatOpen
          ? {
              topRight: true,
              topLeft: true,
              bottomRight: true,
              bottomLeft: true,
            }
          : false
      }
    >
      <div className="ig-chat-wrapper">
        {!chatOpen && launcherButton}
        {chatOpen && chatBody}
      </div>
    </Rnd>
  );

  const mobilePanel = (
    <div
      className="chat-mobile-shell"
      style={{
        "--chat-mobile-height": `${mobileSheetHeight}px`,
        "--chat-mobile-offset": `${chatOpen ? 0 : mobileSheetOffset}px`,
      }}
    >
      <div className={`chat-mobile-sheet ${chatOpen ? "open" : "collapsed"}`.trim()}>
        <div className="ig-chat-wrapper">
          {!chatOpen && launcherButton}
          {chatOpen && chatBody}
        </div>
      </div>
    </div>
  );

  const panel = isMobileViewport ? mobilePanel : desktopPanel;

  if (typeof document === "undefined") return null;

  return createPortal(<div className="chat-root">{panel}</div>, document.body);
}
