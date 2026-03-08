import { io } from "socket.io-client";

// SAME ORIGIN — no IP, no port, LAN safe
export const socket = io(window.location.origin);