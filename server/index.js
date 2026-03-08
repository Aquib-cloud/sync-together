console.log("SERVER FILE EXECUTED");

import compression from "compression";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import http from "http";
import path from "path";
import { Server } from "socket.io";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientBuildPath = path.join(__dirname, "../client/dist");
const PORT = process.env.PORT || 3000;
const corsOrigin = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : true;

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(cors({
  origin: corsOrigin,
  credentials: true
}));
app.use(express.json());
app.use(express.static(clientBuildPath));
app.use("/assets", express.static(path.join(clientBuildPath, "assets")));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

const rooms = {};

setInterval(() => {
  console.log("Active rooms:", Object.keys(rooms));
}, 30000);

io.on("connection", (socket) => {
  socket.on("action", ({ roomId, device, type, time }) => {
    let msg = `${device} ${type}`;
    if (type === "seeked") {
      msg += ` to ${time}s`;
    }
    io.to(roomId).emit("action", msg);
  });

  const approveUser = ({ roomId, userId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;

    const user = rooms[roomId].waiting.find(u => u.id === userId);
    if (!user) return;

    rooms[roomId].waiting =
      rooms[roomId].waiting.filter(u => u.id !== userId);

    io.to(rooms[roomId].host).emit("waitingList", rooms[roomId].waiting);

    rooms[roomId].users.push({ id: userId, name: user.name });
    rooms[roomId].members.push(userId);

    const target = io.sockets.sockets.get(userId);
    if (!target) return;

    const joinedAt = Date.now();

    target.join(roomId);
    target.emit("joinApproved", {
      roomId,
      createdAt: rooms[roomId].createdAt ?? joinedAt,
      joinedAt,
      isHost: false
    });

    target.emit("state", rooms[roomId].state);
    target.emit("mediaTypeUpdated", {
      previous: null,
      current: rooms[roomId].mediaType
    });
    target.emit("hostStatus", { isHost: false });

    io.to(roomId).emit("membersUpdated", {
      users: rooms[roomId].users,
      hostId: rooms[roomId].host
    });

    io.to(roomId).emit(
      "users",
      rooms[roomId].users.map(u => u.name)
    );
  };

  socket.on("admitUser", approveUser);
  socket.on("approveJoin", approveUser);

  socket.on("join", ({ roomId, device }) => {
    socket.roomId = roomId;
    socket.device = device;
    const now = Date.now();

    if (!rooms[roomId]) {
      rooms[roomId] = {
        state: { playing: false, time: 0 },
        users: [],
        members: [],
        host: null,
        mediaType: "video",
        waiting: [],
        createdAt: now
      };
    }

    // FIRST USER → HOST
    if (!rooms[roomId].host) {
      socket.join(roomId);

      rooms[roomId].host = socket.id;
      rooms[roomId].users.push({ id: socket.id, name: device });
      rooms[roomId].members.push(socket.id);

      console.log("Host created:", socket.id);

      socket.emit("joinApproved", {
        roomId,
        createdAt: rooms[roomId].createdAt ?? now,
        joinedAt: now,
        isHost: true
      });

      io.to(roomId).emit("membersUpdated", {
        users: rooms[roomId].users,
        hostId: rooms[roomId].host
      });

      socket.emit("hostStatus", { isHost: true });
      socket.emit("mediaTypeUpdated", {
        previous: null,
        current: rooms[roomId].mediaType
      });

      return;
    }

    // OTHER USERS → WAITING
    if (rooms[roomId].members.includes(socket.id) || rooms[roomId].waiting.some(u => u.id === socket.id)) return;

    rooms[roomId].waiting.push({ id: socket.id, name: device });

    const hostId = rooms[roomId].host;
    const hostSocket = hostId ? io.sockets.sockets.get(hostId) : null;
    if (!hostSocket) return;

    hostSocket.emit("joinRequest", { userId: socket.id, name: device, roomId });
  });


  const rejectUser = ({ roomId, userId }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;

    const isWaiting = rooms[roomId].waiting.some(u => u.id === userId);
    if (!isWaiting) return;

    rooms[roomId].waiting = rooms[roomId].waiting.filter(u => u.id !== userId);

    io.to(rooms[roomId].host).emit("waitingList", rooms[roomId].waiting);

    io.to(userId).emit("joinRejected", {
      message: "Host rejected your request"
    });
  };

  socket.on("rejectUser", rejectUser);
  socket.on("rejectJoin", rejectUser);

  // ROOM CHAT
  socket.on("roomMessage", ({ roomId, senderName, message }) => {

    if (!rooms[roomId]) return;
    if (!rooms[roomId].members.includes(socket.id)) return;

    io.to(roomId).emit("roomMessage", {
      senderId: socket.id,
      senderName,
      message,
      time: Date.now()
    });

  });

  // PRIVATE CHAT
  socket.on("privateMessage", ({ targetUserId, senderName, message }) => {

    if (!targetUserId || !message) return;
    if (!io.sockets.sockets.get(targetUserId)) return;

    if (!rooms[socket.roomId]) return

    const room = rooms[socket.roomId]

    if (!room.members.includes(targetUserId)) return

    const msg = {
      senderId: socket.id,
      senderName,
      targetUserId,
      message,
      time: Date.now()
    };

    io.to(targetUserId).emit("privateMessage", msg);
    socket.emit("privateMessage", msg);
  });

  // TYPING INDICATORS
  socket.on("typingRoom", () => {
    const roomId = socket.roomId
    if (!roomId) return

    socket.to(roomId).emit("typingRoom", {
      user: socket.device
    })
  })

  socket.on("stopTypingRoom", () => {
    const roomId = socket.roomId
    if (!roomId) return
    socket.to(roomId).emit("stopTypingRoom", {
      user: socket.device
    });
  });

  socket.on("typingDM", ({ targetUserId }) => {
    if (!io.sockets.sockets.get(targetUserId)) return
    socket.to(targetUserId).emit("typingDM", {
      user: socket.device,
      senderId: socket.id
    })
  })

  socket.on("stopTypingDM", ({ targetUserId }) => {

    if (!io.sockets.sockets.get(targetUserId)) return;

    socket.to(targetUserId).emit("stopTypingDM", {
      user: socket.device,
      senderId: socket.id
    });

  });

  socket.on("reaction", ({ emoji }) => {
    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId] || !emoji) return;
    if (!rooms[roomId].members.includes(socket.id)) return;

    // Keep reactions room-scoped like the rest of the watch-party events.
    io.to(roomId).emit("reaction", {
      emoji,
      senderId: socket.id
    });
  });

  socket.on("disconnect", () => {
    const { roomId, device } = socket;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].users =
      rooms[roomId].users.filter(u => u.id !== socket.id);
    rooms[roomId].members =
      rooms[roomId].members.filter(id => id !== socket.id);

    if (rooms[roomId].host === socket.id) {
      const newHost = rooms[roomId].members[0] || null;
      rooms[roomId].host = newHost;
      rooms[roomId].members.forEach(id => {
        io.to(id).emit("hostStatus", { isHost: id === rooms[roomId].host });
      });
    }

    rooms[roomId].waiting =
      rooms[roomId].waiting.filter(u => u.id !== socket.id);

    if (rooms[roomId].host) {
      io.to(rooms[roomId].host).emit("waitingList", rooms[roomId].waiting);
    }

    io.to(roomId).emit("membersUpdated", { users: rooms[roomId].users, hostId: rooms[roomId].host });
    io.to(roomId).emit("users", rooms[roomId].users.map(u => u.name));
    if (rooms[roomId].members.length === 0) {
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (empty)`);
    }
  });

  socket.on("play", ({ roomId, time }) => {
    socket.to(roomId).emit("play", { time });
  });

  socket.on("pause", ({ roomId, time }) => {
    socket.to(roomId).emit("pause", { time });
  });

  socket.on("seek", ({ roomId, time }) => {
    socket.to(roomId).emit("seek", { time });
  });

  socket.on("changeMediaType", ({ roomId, mediaType }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;
    const previous = rooms[roomId].mediaType;
    rooms[roomId].mediaType = mediaType;
    io.to(roomId).emit("mediaTypeUpdated", { previous, current: mediaType });
  });

  socket.on("mediaTypeUpdated", (mediaType) => {

    const roomId = socket.roomId;
    if (!roomId || !rooms[roomId]) return;
    if (rooms[roomId].host && rooms[roomId].host !== socket.id) return;

    const previous = rooms[roomId].mediaType;
    rooms[roomId].mediaType = mediaType;

    socket.to(roomId).emit("mediaTypeUpdated", {
      previous,
      current: mediaType
    });
  });

  socket.on("syncState", ({ roomId, targetUserId, currentTime, isPlaying, mediaType }) => {
    if (!rooms[roomId]) return;
    if (rooms[roomId].host !== socket.id) return;
    rooms[roomId].state = { playing: !!isPlaying, time: currentTime ?? 0 };
    if (mediaType) rooms[roomId].mediaType = mediaType;
    io.to(targetUserId).emit("syncState", {
      currentTime: currentTime ?? 0,
      isPlaying: !!isPlaying,
      mediaType: mediaType ?? rooms[roomId].mediaType
    });
  });

  socket.on("leaveRoom", ({ roomId, device }) => {
    if (!rooms[roomId]) return;
    rooms[roomId].waiting =
      rooms[roomId].waiting.filter(u => u.id !== socket.id);
    rooms[roomId].users = rooms[roomId].users.filter(u => u.id !== socket.id);
    rooms[roomId].members = rooms[roomId].members.filter(id => id !== socket.id);
    socket.leave(roomId);
    socket.roomId = null;
    socket.device = null;

    if (rooms[roomId].host === socket.id) {
      const newHost = rooms[roomId].members[0] || null;
      rooms[roomId].host = newHost;
      rooms[roomId].members.forEach(id => {
        io.to(id).emit("hostStatus", { isHost: id === rooms[roomId].host });
      });
    }
    io.to(roomId).emit("membersUpdated", {
      users: rooms[roomId].users,
      hostId: rooms[roomId].host
    });

    io.to(roomId).emit(
      "users",
      rooms[roomId].users.map(u => u.name)
    );

    if (rooms[roomId].members.length === 0) {
      delete rooms[roomId];
      console.log(`Room ${roomId} deleted (empty)`);
    }
  });
});

// Express 5 catch-all route for SPA fallback.
app.get("/{*path}", (req, res) => {
  res.sendFile(path.join(clientBuildPath, "index.html"));
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Sync-Together server running on port ${PORT}`);
});
