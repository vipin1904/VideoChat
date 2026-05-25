import { create } from "zustand";
import { socket } from "../lib/socket";

export const useCallStore = create((set, get) => ({
  // Socket.IO instance reference
  socket: null,
  currentUser: null,

  // Initialize socket connection
  initSocket: (user) => {
    if (!user || !user._id) return;
    const userId = user._id;
    set({ currentUser: user });

    // Establish connection if not already connected
    if (!socket.connected) {
      socket.connect();
    }

    const registerUser = () => {
      console.log(`Registering user socket: ${userId}`);
      socket.emit("register", userId);
    };

    if (socket.connected) {
      registerUser();
    }

    // Bind connect event cleanly to ensure we re-register upon connection/reconnection
    socket.off("connect", registerUser);
    socket.on("connect", registerUser);

    // Bind requestRegister event so server can trigger registration dynamically
    socket.off("requestRegister", registerUser);
    socket.on("requestRegister", registerUser);

    set({ socket });
  },

  // Disconnect socket connection
  disconnectSocket: () => {
    socket.off("connect");
    socket.off("requestRegister");
    if (socket.connected) {
      socket.disconnect();
    }
    set({ socket: null, currentUser: null });
  },
}));
