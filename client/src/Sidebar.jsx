// import { useEffect, useMemo, useState } from "react";
import { useEffect, useMemo, useState, useRef } from "react";
import { useUIStore } from "./store/uiStore";
import "./sidebar.css";
import { socket } from "./socket";
import { createPortal } from "react-dom";

const HOST_REQUEST_ITEM = { key: "requests", icon: "fa-solid fa-hands-clapping", label: "Join Requests" };
const MOBILE_BREAKPOINT = 768;
const DESKTOP_FLOATING_PANEL_LEFT = 96;
const REQUESTS_PANEL_GAP = 12;
const REQUESTS_PANEL_PADDING = 12;
const REQUESTS_PANEL_WIDTH = 260;
const REACTION_PICKER_PADDING = 12;
const REACTION_PICKER_HEIGHT = 132;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "👏", "😮", "🎉"];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const getViewportRect = () => {
  const viewport = window.visualViewport;
  return {
    width: viewport?.width ?? window.innerWidth,
    height: viewport?.height ?? window.innerHeight,
  };
};
const getMobileFloatingPanelPosition = () => {
  return {
    top: "auto",
    left: 12,
    right: 12,
    bottom: `calc(var(--mobile-nav-height, 60px) + env(safe-area-inset-bottom) + ${REQUESTS_PANEL_GAP}px)`,
    width: "auto",
  };
};
// const prevRequestsRef = useRef(joinRequests.length);

const BASE_NAV_ITEMS = [
  { key: "logo", icon: "fa-brands fa-instagram", label: "Instagram" },
  { key: "messages", icon: "fa-regular fa-paper-plane", label: "Messages" },
  { key: "reactions", icon: "fa-regular fa-face-smile", label: "Reaction" },
  { key: "invite", icon: "person_add", label: "Invite" },
];

const formatTimestamp = (ts) => {
  if (!ts) return "--";
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
};

const formatDuration = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
};

export default function Sidebar({
  children,
  joined = false,
  leaveRoom,
  room = "",
  copyRoomId,
  profileImage,
  approveRequest,
  rejectRequest,
  inviteUsers,
  isHost = false,
  username = "",
  joinTime = null,
  roomCreatedAt = null,
  mediaType,
  setMediaType
}) {
  const [activeNav, setActiveNav] = useState("home");
  const [showProfilePanel, setShowProfilePanel] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const openChatList = useUIStore((s) => s.openChatList);
  const unreadCounts = useUIStore((s) => s.unreadCounts);
  const joinRequests = useUIStore((s) => s.joinRequests);
  const sidebarRef = useRef(null);
  const requestsButtonRef = useRef(null);
  const requestsPanelRef = useRef(null);
  const reactionsButtonRef = useRef(null);
  const reactionPickerRef = useRef(null);
  const mobileProfileButtonRef = useRef(null);
  const profilePanelRef = useRef(null);
  const triggerInvite = useUIStore((s) => s.triggerInvite);

  const unreadTotal = useMemo(
    () => Object.values(unreadCounts || {}).reduce((acc, val) => acc + (val || 0), 0),
    [unreadCounts]
  );

  const avatarSrc = profileImage || "https://i.pravatar.cc/120?img=64";
  const [showRequests, setShowRequests] = useState(false);
  const [requestsPanelPosition, setRequestsPanelPosition] = useState({});
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({});

  // Responsive mobile detection hook
  const [isMobile, setIsMobile] = useState(() => window.matchMedia("(max-width:768px)").matches);
  useEffect(() => {
    const media = window.matchMedia("(max-width:768px)");
    const listener = () => setIsMobile(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // const navItems = useMemo(() => {
  //   const [logo, ...rest] = BASE_NAV_ITEMS;
  //   if (!isHost) return BASE_NAV_ITEMS;
  //   return [logo, HOST_REQUEST_ITEM, ...rest];
  // }, [isHost]);
  const navItems = useMemo(() => {
    const [logo, ...rest] = BASE_NAV_ITEMS;

    if (!isHost) {
      return BASE_NAV_ITEMS;
    }

    return [
      logo,
      HOST_REQUEST_ITEM,
      { key: "messages", icon: "fa-regular fa-paper-plane", label: "Messages" },
      { key: "video", label: "Video Mode" },
      { key: "audio", label: "Audio Mode" },
      { key: "reactions", icon: "fa-regular fa-face-smile", label: "Reaction" },
      { key: "invite", icon: "person_add", label: "Invite" },
    ];
  }, [isHost]);


  useEffect(() => {

    const handleClickOutside = (event) => {

      if (!sidebarRef.current) return;
      if (!(event.target instanceof Node)) return;

      if (sidebarRef.current.contains(event.target)) {
        return;
      }

      const chatPanel = document.querySelector(".chat-root");
      const requestsButton = requestsButtonRef.current;
      const requestsPanel = requestsPanelRef.current;
      const reactionsButton = reactionsButtonRef.current;
      const reactionPicker = reactionPickerRef.current;
      const mobileProfileButton = mobileProfileButtonRef.current;
      const profilePanel = profilePanelRef.current;

      if (
        !(requestsButton && requestsButton.contains(event.target)) &&
        !(requestsPanel && requestsPanel.contains(event.target)) &&
        !(chatPanel && chatPanel.contains(event.target)) &&
        !(reactionsButton && reactionsButton.contains(event.target)) &&
        !(reactionPicker && reactionPicker.contains(event.target)) &&
        !(mobileProfileButton && mobileProfileButton.contains(event.target)) &&
        !(profilePanel && profilePanel.contains(event.target))
      ) {

        setActiveNav("");
        setShowRequests(false);
        setShowReactionPicker(false);
        setShowProfilePanel(false);

        const ui = useUIStore.getState();
        ui.closeChat();
      }

    };

    document.addEventListener("pointerdown", handleClickOutside);

    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
    };

  }, []);

  useEffect(() => {
    if (!joined) {
      setShowRequests(false);
      setShowReactionPicker(false);
      setShowProfilePanel(false);
    }
  }, [joined]);

  useEffect(() => {
    if (!isHost) {
      setShowRequests(false);
    }
  }, [isHost]);

  // Match the join-requests panel alignment: fixed left edge, button-aligned top.
  useEffect(() => {
    if (!showReactionPicker) return;

    const updatePosition = () => {
      const button = reactionsButtonRef.current;
      if (!button) return;

      const viewport = getViewportRect();
      const rect = button.getBoundingClientRect();
      const panelRect = reactionPickerRef.current?.getBoundingClientRect();
      const panelHeight = panelRect?.height || REACTION_PICKER_HEIGHT;

      if (isMobile) {
        setReactionPickerPosition(getMobileFloatingPanelPosition());
        return;
      }

      setReactionPickerPosition({
        top: clamp(rect.top, REACTION_PICKER_PADDING, viewport.height - panelHeight - REACTION_PICKER_PADDING),
        left: DESKTOP_FLOATING_PANEL_LEFT,
        right: "auto",
        bottom: "auto",
      });
    };

    updatePosition();
    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(updatePosition) : null;
    if (resizeObserver && reactionsButtonRef.current) {
      resizeObserver.observe(reactionsButtonRef.current);
    }
    if (resizeObserver && reactionPickerRef.current) {
      resizeObserver.observe(reactionPickerRef.current);
    }
    if (resizeObserver && sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
      resizeObserver?.disconnect();
    };
  }, [showReactionPicker]);

  useEffect(() => {
    if (!showRequests) return;

    const updatePosition = () => {
      const button = requestsButtonRef.current;
      if (!button) return;

      const viewport = getViewportRect();
      const rect = button.getBoundingClientRect();
      const panelRect = requestsPanelRef.current?.getBoundingClientRect();
      const panelHeight = panelRect?.height || 0;

      if (isMobile) {
        setRequestsPanelPosition(getMobileFloatingPanelPosition());
        return;
      }

      setRequestsPanelPosition({
        top: clamp(rect.top, REQUESTS_PANEL_PADDING, viewport.height - panelHeight - REQUESTS_PANEL_PADDING),
        left: DESKTOP_FLOATING_PANEL_LEFT,
        right: "auto",
        bottom: "auto",
      });
    };

    updatePosition();
    const frameId = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);

    const viewport = window.visualViewport;
    viewport?.addEventListener("resize", updatePosition);
    viewport?.addEventListener("scroll", updatePosition);

    const resizeObserver = typeof ResizeObserver === "function" ? new ResizeObserver(updatePosition) : null;
    if (resizeObserver && requestsButtonRef.current) {
      resizeObserver.observe(requestsButtonRef.current);
    }
    if (resizeObserver && sidebarRef.current) {
      resizeObserver.observe(sidebarRef.current);
    }
    if (resizeObserver && requestsPanelRef.current) {
      resizeObserver.observe(requestsPanelRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("resize", updatePosition);
      viewport?.removeEventListener("scroll", updatePosition);
      resizeObserver?.disconnect();
    };
  }, [showRequests, joinRequests.length]);

  useEffect(() => {
    if (activeNav !== "messages") {
      const ui = useUIStore.getState();
      ui.closeChat();
    }
  }, [activeNav]);

  useEffect(() => {
    if (!joined) return;
    const timerId = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timerId);
  }, [joined]);

  const closeFloatingPanels = () => {
    setShowRequests(false);
    setShowReactionPicker(false);
    setShowProfilePanel(false);
  };

  const toggleProfilePanel = () => {
    setActiveNav("profile");
    setShowRequests(false);
    setShowReactionPicker(false);
    setShowProfilePanel((prev) => !prev);
  };

  const sendReaction = (emoji) => {
    if (!emoji) return;
    socket.emit("reaction", { emoji });
    setActiveNav("");
    setShowReactionPicker(false);
  };


  // sound refs
  const requestSoundRef = useRef(null);
  const messageSoundRef = useRef(null);

  // detect new requests
  const prevRequestsRef = useRef(0);

  useEffect(() => {
    if (joinRequests.length > prevRequestsRef.current) {
      requestSoundRef.current?.play().catch(() => { });
    }

    prevRequestsRef.current = joinRequests.length;
  }, [joinRequests.length]);

  // detect new messages
  const prevUnreadRef = useRef(0);

  useEffect(() => {
    if (unreadTotal > prevUnreadRef.current) {
      messageSoundRef.current?.play().catch(() => { });
    }

    prevUnreadRef.current = unreadTotal;
  }, [unreadTotal]);

  const handleNavClick = (key) => {

    setActiveNav(prev => prev === key ? "" : key);

    if (key === "requests" && isHost) {
      if (!showRequests) {
        const viewport = getViewportRect();
        const rect = requestsButtonRef.current?.getBoundingClientRect();
        if (rect) {
          setRequestsPanelPosition(
            isMobile
              ? getMobileFloatingPanelPosition()
              : {
                top: rect.top,
                left: DESKTOP_FLOATING_PANEL_LEFT,
                right: "auto",
                bottom: "auto",
              }
          );
        }
      }
      setShowRequests(prev => !prev);
      setShowProfilePanel(false);
      return;
    }

    if (key === "messages") {
      openChatList({ anchor: "sidebar" });
      setShowRequests(false);
      setShowReactionPicker(false);
      setShowProfilePanel(false);
      return;
    }

    if (key === "reactions") {
      if (!showReactionPicker) {
        const viewport = getViewportRect();
        const rect = reactionsButtonRef.current?.getBoundingClientRect();
        if (rect) {
          setReactionPickerPosition(
            isMobile
              ? getMobileFloatingPanelPosition()
              : {
                top: rect.top,
                left: DESKTOP_FLOATING_PANEL_LEFT,
                right: "auto",
                bottom: "auto",
              }
          );
        }
      }
      setShowRequests(false);
      setShowProfilePanel(false);
      setShowReactionPicker((prev) => !prev);
      return;
    }

    if (key === "video") {
      if (!isHost) return;
      setMediaType("video");
      socket.emit("mediaTypeUpdated", "video");
      return;
    }

    if (key === "audio") {
      if (!isHost) return;
      setMediaType("audio");
      socket.emit("mediaTypeUpdated", "audio");
      return;
    }

    if (key === "invite") {
      console.log("invite clicked");
      triggerInvite();
      closeFloatingPanels();
      return;
    }

    closeFloatingPanels();
  };

  const requestBadge =
    joinRequests.length > 0
      ? joinRequests.length > 99
        ? "99+"
        : joinRequests.length
      : null;
  const identityLabel = isHost ? "Created at" : "Joined at";
  const identityTimestamp = isHost ? roomCreatedAt ?? joinTime : joinTime;
  const timeInRoom = joinTime ? formatDuration(now - joinTime) : "0m 0s";
  const displayName = username?.trim() || "Guest";

  const mainClass = `main ${joined ? "" : "no-sidebar"}`.trim();

  return (
    <div className={mainClass}>
      {joined && (
        <button className="exit-btn" type="button" onClick={leaveRoom} aria-label="Leave room">
          <i className="fa-solid fa-person-walking-arrow-right"></i>
        </button>
      )}

      {joined && (
        <button
          ref={mobileProfileButtonRef}
          className={`mobile-profile-btn ${showProfilePanel ? "active" : ""}`.trim()}
          type="button"
          onClick={toggleProfilePanel}
          aria-label="Open profile"
        >
          <img src={avatarSrc} alt="Profile avatar" className="ig-avatar" />
        </button>
      )}

      {joined && (
        <div
          className="room-badge room-pill room-floating"
          onClick={copyRoomId}
          role="button"
          tabIndex={0}
        >
          Room ID: <strong>{room}</strong>
        </div>
      )}

      {joined && (
        <aside ref={sidebarRef} className="ig-sidebar ig-sidebar--collapsed" role="navigation" aria-label="Main navigation">
          {isHost && showRequests && createPortal(
            <div
              ref={requestsPanelRef}
              className="join-requests-panel"
              style={
                isMobile
                  ? undefined
                  : requestsPanelPosition
              }
            >
              <div className="join-header">Join Requests</div>

              {joinRequests.length === 0 && <div className="join-empty">No requests</div>}

              {joinRequests.map((user) => (
                <div key={user.userId ?? user.id} className="join-item">
                  <img
                    src={user.avatar || "https://i.pravatar.cc/60"}
                    className="join-avatar"
                    alt={`${user.name}'s avatar`}
                  />

                  <span className="join-name">{user.name}</span>

                  <div className="join-actions">
                    <button
                      className="accept-btn"
                      onClick={() => approveRequest?.(user.userId ?? user.id)}
                      disabled={!isHost}
                    >
                      Accept
                    </button>

                    <button
                      className="reject-btn"
                      onClick={() => rejectRequest?.(user.userId ?? user.id)}
                      disabled={!isHost}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>, document.body
          )}

          {showReactionPicker &&
            createPortal(
              <div
                ref={reactionPickerRef}
                className="reaction-picker"
                style={
                  isMobile
                    ? undefined
                    : reactionPickerPosition
                }
                role="dialog"
                aria-label="Quick reactions"
              >
                {REACTION_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="reaction-picker__button"
                    onClick={() => sendReaction(emoji)}
                    aria-label={`Send ${emoji} reaction`}
                  >
                    <span aria-hidden="true">{emoji}</span>
                  </button>
                ))}
              </div>,
              document.body
            )}

          <div className="ig-nav-top">
            {/* Only logo */}
            <button
              type="button"
              className="ig-nav-item logo"
              onClick={() => handleNavClick("logo")}
              aria-label="Sync-Together"
            >
              <img src="/logo.svg" alt="Sync Together Logo" className="sidebar-logo" />
              <span className="ig-tooltip">Sync-Together</span>
            </button>
          </div>

          <div className="ig-nav-center">
            {navItems
              .filter((item) => item.key !== "logo")
              .map((item) => (
                <button
                  key={item.key}
                  ref={
                    item.key === "requests"
                      ? requestsButtonRef
                      : item.key === "reactions"
                        ? reactionsButtonRef
                        : null
                  }
                  type="button"
                  // className={`ig-nav-item ${item.key === "logo" ? "logo" : ""} ${activeNav === item.key ? "active" : ""}`}
                  className={`ig-nav-item
                                          ${item.key === "video" && mediaType === "video" ? "media-active video-active" : ""}
                                          ${item.key === "audio" && mediaType === "audio" ? "media-active audio-active" : ""}
                                          ${item.key === "logo" ? "logo" : ""}
                                          ${activeNav === item.key ? "active" : ""}
                                        `}
                  onClick={() => handleNavClick(item.key)}
                  aria-label={item.label}
                >

                  {item.key === "messages" && unreadTotal > 0 && (
                    <span className="ig-badge">{unreadTotal > 99 ? "99+" : unreadTotal}</span>
                  )}

                  {item.key === "requests" && requestBadge && (
                    <span className="ig-badge">{requestBadge}</span>
                  )}

                  {item.key === "video" ? (
                    <img src="/video-icon.svg" alt="Video Mode" style={{ width: 22, height: 22 }} />
                  ) : item.key === "audio" ? (
                    <img src="/audio-icon.svg" alt="Audio Mode" style={{ width: 22, height: 22 }} />
                  ) : item.key === "requests" ? (
                    <i className="fa-solid fa-hands-clapping"></i>
                  ) : item.key === "invite" ? (
                    <span className="material-symbols-outlined">person_add</span>
                  ) : (
                    <i className={item.icon}></i>
                  )}

                </button>
              ))}
          </div>

          <div className="ig-nav-bottom">
            <button
              type="button"
              className={`ig-nav-item profile ${activeNav === "profile" ? "active" : ""}`.trim()}
              onClick={toggleProfilePanel}
              aria-label="Profile"
            >
              <img src={avatarSrc} alt="Profile avatar" className="ig-avatar" />
              <span className="ig-tooltip">Profile</span>
            </button>

            <button
              type="button"
              className={`ig-nav-item ${activeNav === "menu" ? "active" : ""}`.trim()}
              onClick={() => {
                setActiveNav("menu");
                closeFloatingPanels();
              }}
              aria-label="Menu"
            >
              <i className="fa-solid fa-bars"></i>
              <span className="ig-tooltip">Menu</span>
            </button>

            <button
              type="button"
              className={`ig-nav-item ${activeNav === "apps" ? "active" : ""}`.trim()}
              onClick={() => {
                setActiveNav("apps");
                closeFloatingPanels();
              }}
              aria-label="Apps"
            >
              <i className="fa-solid fa-table-cells"></i>
              <span className="ig-tooltip">Apps</span>
            </button>
          </div>
        </aside>
      )}

      {joined && showProfilePanel && (
        <div ref={profilePanelRef} className="profile-panel" role="dialog" aria-label="Profile details">
          <div className="profile-panel-title">Profile</div>
          <div className="profile-panel-row">
            <span className="profile-panel-label">Username</span>
            <span className="profile-panel-value">{displayName}</span>
          </div>
          <div className="profile-panel-row">
            <span className="profile-panel-label">Room ID</span>
            <span className="profile-panel-value" onClick={copyRoomId} style={{ cursor: "pointer" }}> {room} </span>
          </div>
          <div className="profile-panel-row">
            <span className="profile-panel-label">{identityLabel}</span>
            <span className="profile-panel-value">{formatTimestamp(identityTimestamp)}</span>
          </div>
          <div className="profile-panel-row">
            <span className="profile-panel-label">Time in room</span>
            <span className="profile-panel-value">{timeInRoom}</span>
          </div>
        </div>
      )}
      {/* Sound effects */}
      <audio ref={requestSoundRef} src="/request-sound.wav" preload="auto" />
      <audio ref={messageSoundRef} src="/notification-sound.wav" preload="auto" />

      <div className="content-area">{children}</div>
    </div>
  );
}