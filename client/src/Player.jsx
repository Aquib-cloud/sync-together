import { useEffect, useRef, useState, useCallback } from "react";
import { socket } from "./socket";
import QRCode from "qrcode";
import AudioPlayer from "./AudioPlayer";
import Modal from "./Modal";
import UploadBox from "./UploadBox";
import { useUIStore } from "./store/uiStore";

export default function Player({
  room,
  mediaType,
  setMediaType,
  isHost,
}) {
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const stageRef = useRef(null);
  const isRemoteAction = useRef(false);
  const prevMediaRef = useRef(mediaType);
  const pendingSyncRef = useRef(null);
  const volumeTimer = useRef(null);

  const [action, setAction] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [modeModal, setModeModal] = useState({ open: false, message: "" });
  const [copyModal, setCopyModal] = useState({ open: false, message: "" });
  const [volumeOverlay, setVolumeOverlay] = useState(null);

  // Build audio object URL when needed
  useEffect(() => {
    let url;
    if (mediaType === "audio" && selectedFile) {
      url = URL.createObjectURL(selectedFile);
      setAudioUrl(url);
    } else {
      setAudioUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaType, selectedFile]);

  // Build video object URL when needed
  useEffect(() => {
    let url;
    if (mediaType === "video" && selectedFile) {
      url = URL.createObjectURL(selectedFile);
      setVideoUrl(url);
    } else {
      setVideoUrl(null);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [mediaType, selectedFile]);

  const applySyncState = async (payload) => {
    if (!payload) return;
    const { currentTime = 0, isPlaying = false, mediaType: incomingType } = payload;
    if (incomingType && incomingType !== mediaType) {
      setMediaType(incomingType);
      setSelectedFile(null);
    }
    const el = videoRef.current || audioRef.current;
    if (!el) {
      pendingSyncRef.current = payload;
      return;
    }
    isRemoteAction.current = true;
    if (typeof currentTime === "number") {
      el.currentTime = currentTime;
    }
    if (isPlaying && el.paused) {
      await el.play().catch(() => { });
    } else if (!isPlaying && !el.paused) {
      el.pause();
    }
    pendingSyncRef.current = null;
    setTimeout(() => (isRemoteAction.current = false), 100);
  };

  // Socket listeners for play/pause/seek relay
  useEffect(() => {
    const getTarget = () => videoRef.current || audioRef.current;

    const handlePlay = async ({ time }) => {
      const el = getTarget();
      if (!el) return;
      if (!el.paused) return;
      isRemoteAction.current = true;
      el.currentTime = time;
      await el.play().catch(() => { });
      setTimeout(() => (isRemoteAction.current = false), 100);
    };


    const handlePause = ({ time }) => {
      const el = getTarget();
      if (!el) return;
      if (el.paused) return;
      isRemoteAction.current = true;
      el.currentTime = time;
      el.pause();
      setTimeout(() => (isRemoteAction.current = false), 100);
    };

    const handleSeek = ({ time }) => {
      const el = getTarget();
      if (!el) return;
      isRemoteAction.current = true;
      el.currentTime = time;
      setTimeout(() => (isRemoteAction.current = false), 100);
    };

    socket.off("play");
    socket.off("pause");
    socket.off("seek");
    socket.on("play", handlePlay);
    socket.on("pause", handlePause);
    socket.on("seek", handleSeek);

    return () => {
      socket.off("play", handlePlay);
      socket.off("pause", handlePause);
      socket.off("seek", handleSeek);
    };
  }, []);

  // Room media-type updates
  useEffect(() => {
    const handleMediaTypeUpdated = (type) => {
      const nextType = type?.current ?? type;
      const prev = prevMediaRef.current;
      if (nextType && prev && prev !== nextType) {
        setModeModal({
          open: true,
          message: `Room mode switched to ${nextType.toUpperCase()}`,
        });
      }
      if (nextType) {
        prevMediaRef.current = nextType;
        setMediaType(nextType);
        setSelectedFile(null);
      }
    };

    socket.on("mediaTypeUpdated", handleMediaTypeUpdated);

    return () => {
      socket.off("mediaTypeUpdated", handleMediaTypeUpdated);
    };
  }, [setMediaType]);

  // Sync state for late join + host responder
  useEffect(() => {
    const handleSyncState = async (payload) => {
      await applySyncState(payload);
    };

    const handleRequestSyncState = ({ newUserId }) => {
      if (!isHost) return;
      const el = videoRef.current || audioRef.current;
      if (!el) return;
      socket.emit("syncState", {
        roomId: room,
        targetUserId: newUserId,
        currentTime: el.currentTime,
        isPlaying: !el.paused && !el.ended,
        mediaType
      });
    };

    socket.on("syncState", handleSyncState);
    socket.on("requestSyncState", handleRequestSyncState);

    return () => {
      socket.off("syncState", handleSyncState);
      socket.off("requestSyncState", handleRequestSyncState);
    };
  }, [room, mediaType, isHost]);

  // Apply pending sync once media element ready
  useEffect(() => {
    if (pendingSyncRef.current) {
      applySyncState(pendingSyncRef.current);
    }
  }, [videoUrl, audioUrl, mediaType]);

  const formatTime = (t) => {
    if (typeof t !== "number" || Number.isNaN(t) || !Number.isFinite(t)) return "00:00";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const showVolumeOverlay = (vol) => {
    setVolumeOverlay(Math.round(vol * 100));
    if (volumeTimer.current) clearTimeout(volumeTimer.current);
    volumeTimer.current = setTimeout(() => setVolumeOverlay(null), 1000);
  };

  useEffect(() => {
    if (!action) return;
    const t = setTimeout(() => setAction(""), 2000);
    return () => clearTimeout(t);
  }, [action]);


  useEffect(() => {
    return () => {
      if (volumeTimer.current) clearTimeout(volumeTimer.current);
    };
  }, []);

  const handleInvite = useCallback(async () => {

    const link = `${window.location.origin}?room=${room}`;
    let qrData = "";

    try {
      qrData = await QRCode.toDataURL(link);
    } catch (err) {
      qrData = "";
    }

    let shared = false;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Sync Together",
          text: `Join my room ${room}`,
          url: link
        });
        shared = true;
      } catch (err) { }
    }

    if (!shared) {
      try {
        await navigator.clipboard.writeText(link);
      } catch (err) {

        const textarea = document.createElement("textarea");
        textarea.value = link;
        document.body.appendChild(textarea);
        textarea.select();

        try {
          document.execCommand("copy");
        } catch (e) { }

        document.body.removeChild(textarea);
      }
    }

    setCopyModal({
      open: true,
      message: (
        <span className="invite-content">
          {qrData && (
            <img
              src={qrData}
              alt="Invite QR"
              style={{
                width: "180px",
                height: "180px",
                borderRadius: "12px",
                display: "block",
                margin: "0 auto 12px"
              }}
            />
          )}
          <span style={{ wordBreak: "break-all" }}>{link}</span>
        </span>
      ),
    });
  }, [room]);

  const setInviteHandler = useUIStore((s) => s.setInviteHandler);

  useEffect(() => {
    setInviteHandler(handleInvite);
  }, [handleInvite, setInviteHandler]);

  // Keyboard shortcuts for active media (no socket emits)
  useEffect(() => {
    const handler = async (e) => {
      const media = videoRef.current || audioRef.current;
      if (!media) return;
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

      if (e.code === "ArrowUp") {
        e.preventDefault();
        const next = Math.min(1, (media.volume || 0) + 0.1);
        media.volume = next;
        media.muted = next === 0 ? media.muted : false;
        showVolumeOverlay(media.muted ? 0 : next);
      }

      if (e.code === "ArrowDown") {
        e.preventDefault();
        const next = Math.max(0, (media.volume || 0) - 0.1);
        media.volume = next;
        media.muted = next === 0 ? true : media.muted;
        showVolumeOverlay(media.muted ? 0 : next);
      }

      if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        media.muted = !media.muted;
        showVolumeOverlay(media.muted ? 0 : media.volume || 0);
      }

      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
        } else if (stageRef.current?.requestFullscreen) {
          stageRef.current.requestFullscreen().catch(() => { });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


  const renderPlayers = selectedFile
    ? (
      <>
        {mediaType === "video" && (
          <video
            ref={videoRef}
            src={videoUrl || ""}
            controls
            playsInline
            style={{ width: "100%" }}
            onPlay={() => {
              const el = videoRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("play", { roomId: room, time: el.currentTime });
            }}

            onPause={() => {
              const el = videoRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("pause", { roomId: room, time: el.currentTime });
            }}

            onSeeked={() => {
              const el = videoRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("seek", { roomId: room, time: el.currentTime });
            }}
          />
        )}

        {mediaType === "audio" && (
          <AudioPlayer
            ref={audioRef}
            src={audioUrl || ""}
            onPlay={() => {
              const el = audioRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("play", { roomId: room, time: el.currentTime });
            }}
            onPause={() => {
              const el = audioRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("pause", { roomId: room, time: el.currentTime });
            }}
            onSeek={() => {
              const el = audioRef.current;
              if (!el || isRemoteAction.current) return;
              socket.emit("seek", { roomId: room, time: el.currentTime });
            }}
          />
        )}
      </>
    )
    : null;

  return (
    <>
      <div
        className="meet-stage"
        ref={stageRef}
        onDoubleClick={() => {
          if (stageRef.current?.requestFullscreen) {
            stageRef.current.requestFullscreen().catch(() => { });
          }
        }}
      >
        {!selectedFile && (
          <UploadBox
            accept={mediaType === "video" ? "video/*" : "audio/*"}
            onSelect={(file) => {
              if (file) setSelectedFile(file);
            }}
          />
        )}
        {renderPlayers}
        {selectedFile && action && <div className="meet-status" key={action}>⚡ {action}</div>}
        {volumeOverlay !== null && <div className="volume-overlay">{volumeOverlay}%</div>}
      </div>

      {/* <div className="meet-controls">

        {isHost && (
          <div className="media-toggle">
            <button
              type="button"
              className={mediaType === "video" ? "active" : ""}
              onClick={() => {
                if (!isHost) return;
                setMediaType("video");
                setSelectedFile(null);
                socket.emit("mediaTypeUpdated", "video");
              }}
            >
              <i className="fa-solid fa-file-video"></i>
            </button>

            <button
              type="button"
              className={mediaType === "audio" ? "active" : ""}
              onClick={() => {
                if (!isHost) return;
                setMediaType("audio");
                setSelectedFile(null);
                socket.emit("mediaTypeUpdated", "audio");
              }}
            >
              <i className="fa-solid fa-music"></i>
            </button>
          </div>
        )}
      </div> */}

      <Modal
        open={modeModal.open}
        title="Room Mode Updated"
        message={modeModal.message}
        type="info"
        onClose={() => setModeModal({ open: false, message: "" })}
      />
      <Modal
        open={copyModal.open}
        title="Link Copied"
        message={copyModal.message}
        type="info"
        onClose={() => setCopyModal({ open: false, message: "" })}
      />
    </>
  );
}
