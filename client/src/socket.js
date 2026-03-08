import { io } from "socket.io-client";

export const socket = io("https://sync-together.onrender.com", {
  transports: ["websocket"],
});