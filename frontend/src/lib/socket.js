import io from "socket.io-client";

const socketUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:5001";

export const socket = io(socketUrl, {
  autoConnect: false,
  withCredentials: true,
});
