import { useEffect, useState } from "react";
import { socket } from "./socket";
import Player from "./Player";
import Sidebar from "./Sidebar";
import Modal from "./Modal";
import LandingPage from "./LandingPage";
import ChatPanel from "./ChatPanel";
import ReactionOverlay from "./ReactionOverlay";
import "./LandingPage.css";
import { useUIStore } from "./store/uiStore";

export default function App() {
  const [showLanding, setShowLanding] = useState(true);
  // const [fadeInHome, setFadeInHome] = useState(false);

  const [room, setRoom] = useState("");
  const [device, setDevice] = useState("");
  const [joined, setJoined] = useState(false);
  const [waitingApproval, setWaitingApproval] = useState(false);
  const [error, setError] = useState("");
  const [mediaType, setMediaType] = useState("video");
  const [members, setMembers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [showQR, setShowQR] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [joinTime, setJoinTime] = useState(null);
  const [roomCreatedAt, setRoomCreatedAt] = useState(null);
  const [modal, setModal] = useState({ open: false, title: "", message: "", type: "info", onConfirm: null });
  const [isHost, setIsHost] = useState(false);
  const setChatOpen = useUIStore((s) => s.setChatOpen);
  const setActiveChat = useUIStore((s) => s.setActiveChat);
  const setUnreadCounts = useUIStore((s) => s.setUnreadCounts);
  const setJoinRequests = useUIStore((s) => s.setJoinRequests);
  const addJoinRequest = useUIStore((s) => s.addJoinRequest);
  const removeJoinRequest = useUIStore((s) => s.removeJoinRequest);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("room");
    if (r) setRoom(r);
  }, []);

  useEffect(() => {
    socket.on("joinApproved", (payload = {}) => {
      const now = Date.now();
      setJoined(true);
      setWaitingApproval(false);
      setError("");
      setChatOpen(false);
      setActiveChat(null);
      setJoinTime(payload.joinedAt ?? now);
      setRoomCreatedAt(payload.createdAt ?? now);
    });

    socket.on("joinRejected", () => {
      setWaitingApproval(false);
      setError("Host rejected your request");
    });

    return () => {
      socket.off("joinApproved");
      socket.off("joinRejected");
    };
  }, []);

  useEffect(() => {
    const handleMembersUpdated = ({ users, hostId } = {}) => {
      setMembers(Array.isArray(users) ? [...users] : []);
      setHostId(hostId ?? null);
    };

    socket.on("membersUpdated", handleMembersUpdated);

    return () => {
      socket.off("membersUpdated", handleMembersUpdated);
    };
  }, []);

  useEffect(() => {
    const handleHostStatus = ({ isHost: host }) => {
      setIsHost(host);
      if (!host) {
        setJoinRequests([]);
      }
    };

    const handleJoinRequest = ({ userId, name, roomId }) => {
      addJoinRequest({ userId, name, roomId });
    };

    const handleWaitingList = (waiting = []) => {
      setJoinRequests(
        waiting.map((user) => ({
          userId: user.userId ?? user.id,
          name: user.name,
          roomId: room,
        }))
      );
    };

    socket.on("hostStatus", handleHostStatus);
    socket.on("joinRequest", handleJoinRequest);
    socket.on("waitingList", handleWaitingList);

    return () => {
      socket.off("hostStatus", handleHostStatus);
      socket.off("joinRequest", handleJoinRequest);
      socket.off("waitingList", handleWaitingList);
    };
  }, [room, addJoinRequest, setJoinRequests]);


  const joinRoom = () => {
    if (!room.trim() || !device.trim()) {
      setError("Room ID and Name are required");
      return;
    }

    setError("");
    setWaitingApproval(true);

    socket.emit("join", {
      roomId: room.trim(),
      device: device.trim(),
    });
  };

  const leaveRoom = () => {
    setModal({
      open: true,
      title: "Leave Room",
      message: "Are you sure you want to leave the room?",
      type: "confirm",
      onConfirm: () => {
        socket.emit("leaveRoom", { roomId: room.trim(), device: device.trim() });
        setJoined(false);
        setWaitingApproval(false);
        setRoom("");
        setDevice("");
        setMembers([]);
        setHostId(null);
        setMediaType("video");
        setShowQR(false);
        setJoinTime(null);
        setRoomCreatedAt(null);
        setActiveChat(null);
        setChatOpen(false);
        setUnreadCounts({});
        setJoinRequests([]);
        setIsHost(false);
      },
    });
  };

  const copyRoomId = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(room);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = room;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setModal({
      open: true,
      title: "Copied",
      message: "Room ID copied!",
      type: "info",
    });
  };

  const copyInvite = async () => {
    if (!room) return;
    const link = `${window.location.origin}?room=${room}`;
    setInviteLink(link);
    try {
      await navigator.clipboard.writeText(link);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setModal({
      open: true,
      title: "Copied",
      message: "Invite link copied!",
      type: "info",
    });
    setShowQR(true);
  };

  const approveRequest = (userId) => {
    if (!room || !userId) return;
    socket.emit("approveJoin", { roomId: room.trim(), userId });
    removeJoinRequest(userId);
  };

  const rejectRequest = (userId) => {
    if (!room || !userId) return;
    socket.emit("rejectJoin", { roomId: room.trim(), userId });
    removeJoinRequest(userId);
  };

  const viewerCount = members?.length ?? 0;

  const content = (
    <div className="app">

      {joined && (
        <div className="viewer-count viewer-count--floating">
          <span className="viewer-number">
            {viewerCount}
          </span>
        </div>
      )}

      <div className="meet-layout">
        {joined && (
          <div className="viewer-count viewer-count--mobile">
            <span className="viewer-number">
              {viewerCount}
            </span>
          </div>
        )}

        {!joined && (
          <div className="join-pane">
            <p className="join-sub">
              Watch together in perfect sync.
            </p>

            <form
              className="join-form"
              onSubmit={(e) => {
                e.preventDefault();
                joinRoom();
              }}
            >
              <input
                autoFocus
                placeholder="Enter Room ID"
                value={room}
                onChange={(e) =>
                  setRoom(e.target.value.replace(/\s/g, ""))
                }
              />

              <input
                placeholder="Enter Your Name"
                value={device}
                onChange={(e) =>
                  setDevice(e.target.value.trimStart())
                }
              />

              <button type="submit" disabled={waitingApproval}>
                {waitingApproval ? "Waiting..." : "Join"}
              </button>

              {waitingApproval && (
                <p style={{ fontSize: "0.85rem", opacity: 0.7 }}>
                  Waiting for host approval...
                </p>
              )}

              {error && (
                <p style={{ color: "#ff6b6b", fontSize: "0.8rem" }}>
                  {error}
                </p>
              )}
            </form>
          </div>
        )}

        {joined && (
          <>
            <Player
              room={room}
              mediaType={mediaType}
              setMediaType={setMediaType}
              isHost={isHost}
              copyInvite={copyInvite}
              copyRoomId={copyRoomId}
            />
            <ChatPanel
              roomId={room}
              device={device}
              members={members}
            />
          </>
        )}
      </div>

      {showQR && (
        <div className="qr-overlay" onClick={() => setShowQR(false)}>
          <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Invite QR</h3>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(inviteLink)}`}
              alt="QR Invite"
            />
            <button type="button" onClick={() => setShowQR(false)}>Close</button>
          </div>
        </div>
      )}

      <Modal
        open={modal.open}
        title={modal.title}
        message={modal.message}
        type={modal.type}
        onConfirm={modal.onConfirm}
        onCancel={() => setModal((m) => ({ ...m, open: false }))}
        onClose={() => setModal((m) => ({ ...m, open: false }))}
      />
    </div>
  );

  return (
    <>
      {joined ? (
        <Sidebar
          members={members}
          hostId={hostId}
          joined={joined}
          leaveRoom={leaveRoom}
          room={room}
          copyRoomId={copyRoomId}
          approveRequest={approveRequest}
          rejectRequest={rejectRequest}
          isHost={isHost}
          username={device}
          joinTime={joinTime}
          roomCreatedAt={roomCreatedAt}
          
          mediaType={mediaType}
          setMediaType={setMediaType}
        >
          {content}
        </Sidebar>
      ) : (
        content
      )}
      {showLanding && (
        <LandingPage onFinish={() => setShowLanding(false)} />
      )}
      {joined && <ReactionOverlay />}
    </>
  );
}
