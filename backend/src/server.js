import express from "express";
import "dotenv/config";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import dns from "dns";
import http from "http";
import { Server } from "socket.io";

dns.setServers(["8.8.8.8", "8.8.4.4"]);


import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";

import { connectDB } from "./lib/db.js";

const app = express();
const PORT = process.env.PORT;

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const __dirname = path.resolve();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true, // allow frontend to send cookies
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chat", chatRoutes);

if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  app.use(express.static(path.join(__dirname, "../frontend/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
  });
}

// User-socket mapping
const userSocketMap = {}; // userId -> socket.id

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Immediately request registration from the newly connected client socket
  socket.emit("requestRegister");

  socket.on("register", (userId) => {
    if (userId) {
      userSocketMap[userId] = socket.id;
      console.log(`User registered: ${userId} -> ${socket.id}`);
    }
  });

  socket.on("callUser", ({ userToCall, signalData, from, fromName, type }) => {
    const targetSocket = userSocketMap[userToCall];
    if (targetSocket) {
      io.to(targetSocket).emit("callIncoming", {
        signal: signalData,
        from,
        fromName,
        type, // 'audio' or 'video'
      });
    } else {
      socket.emit("callRejected", { reason: "User offline" });
    }
  });

  socket.on("callAccepted", ({ to, signal }) => {
    const targetSocket = userSocketMap[to];
    if (targetSocket) {
      io.to(targetSocket).emit("callAccepted", { signal });
    }
  });

  socket.on("callRejected", ({ to }) => {
    const targetSocket = userSocketMap[to];
    if (targetSocket) {
      io.to(targetSocket).emit("callRejected");
    }
  });

  socket.on("callCancelled", ({ to }) => {
    const targetSocket = userSocketMap[to];
    if (targetSocket) {
      io.to(targetSocket).emit("callCancelled");
    }
  });

  socket.on("callEnded", ({ to }) => {
    const targetSocket = userSocketMap[to];
    if (targetSocket) {
      io.to(targetSocket).emit("callEnded");
    }
  });

  socket.on("iceCandidate", ({ to, candidate }) => {
    const targetSocket = userSocketMap[to];
    if (targetSocket) {
      io.to(targetSocket).emit("iceCandidate", { candidate });
    }
  });

  // --- Room-Based WebRTC Calling ---
  socket.on("joinRoomCall", ({ roomId, userId, fullName, type }) => {
    socket.join(roomId);
    console.log(`User ${fullName} (${userId}) joined room call: ${roomId}`);
    
    // Notify other peers in the room that a new user has joined
    socket.to(roomId).emit("roomUserJoined", {
      userId,
      fullName,
      socketId: socket.id,
      type
    });
  });

  socket.on("roomSignal", ({ roomId, signalData }) => {
    // Broadcast WebRTC SDP signal (Offer/Answer) to all other room members
    socket.to(roomId).emit("roomSignal", {
      signalData,
      fromSocketId: socket.id
    });
  });

  socket.on("roomIceCandidate", ({ roomId, candidate }) => {
    // Broadcast WebRTC ICE candidate to all other room members
    socket.to(roomId).emit("roomIceCandidate", {
      candidate,
      fromSocketId: socket.id
    });
  });

  socket.on("leaveRoomCall", ({ roomId }) => {
    socket.leave(roomId);
    console.log(`Socket ${socket.id} left room call: ${roomId}`);
    socket.to(roomId).emit("roomCallEnded");
  });

  socket.on("sendMessage", (data) => {
    const { senderId, receiverId, message } = data;
    const targetSocket = userSocketMap[receiverId];
    if (targetSocket) {
      io.to(targetSocket).emit("receiveMessage", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const userId in userSocketMap) {
      if (userSocketMap[userId] === socket.id) {
        delete userSocketMap[userId];
        console.log(`Unregistered user: ${userId}`);
        break;
      }
    }
  });
});

// Invoke connectDB so we cache on boot or invocation
connectDB();

if (!process.env.VERCEL) {
  server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;
