import { create } from "zustand";
import { socket } from "../lib/socket";
import toast from "react-hot-toast";

// Synthetic Ringtone generator using Web Audio API
class SyntheticRingtone {
  constructor() {
    this.audioCtx = null;
    this.intervalId = null;
  }

  start() {
    try {
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const playTone = () => {
        if (!this.audioCtx || this.audioCtx.state === "closed") return;
        
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // Standard US Ringback tone is a mix of 440Hz and 480Hz
        osc1.frequency.setValueAtTime(440, this.audioCtx.currentTime);
        osc2.frequency.setValueAtTime(480, this.audioCtx.currentTime);

        gain.gain.setValueAtTime(0, this.audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, this.audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.2, this.audioCtx.currentTime + 1.5);
        gain.gain.linearRampToValueAtTime(0, this.audioCtx.currentTime + 1.8);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start();
        osc2.start();

        osc1.stop(this.audioCtx.currentTime + 1.8);
        osc2.stop(this.audioCtx.currentTime + 1.8);
      };

      playTone();
      this.intervalId = setInterval(playTone, 3000);
    } catch (err) {
      console.warn("Ringtone could not start", err);
    }
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
  }
}

const ringtone = new SyntheticRingtone();

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" }
  ],
};

export const useCallStore = create((set, get) => ({
  // Socket.IO instance reference
  socket: null,
  
  // Call State: 'idle' | 'ringing' | 'connecting' | 'active' | 'ended'
  callState: "idle",
  
  // Call details
  callerId: null,
  calleeId: null,
  callerName: null,
  calleeName: null,
  callType: "video", // 'audio' | 'video'
  isCaller: false,
  isRoomCall: false,
  roomCallId: null,

  // Stream references
  localStream: null,
  remoteStream: null,
  peerConnection: null,
  pendingSignal: null,
  pendingIceCandidates: [], // ICE candidates queue (Flow 7)

  // UI state
  isMuted: false,
  isVideoPaused: false,
  callDuration: 0,
  timerInterval: null,
  isMinimized: false,
  connectionTimeout: null,

  // Current user profile details
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
    socket.off("connect", registerUser); // prevent duplicates
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

  // Event handlers called from Provider (Flow 6)
  handleCallIncoming: ({ signal, from, fromName, type }) => {
    if (get().callState !== "idle") {
      socket.emit("callRejected", { to: from });
      return;
    }

    ringtone.start();

    set({
      callState: "ringing",
      callerId: from,
      callerName: fromName,
      callType: type,
      isCaller: false,
      pendingSignal: signal,
      isMinimized: false,
    });
  },

  handleCallAccepted: async ({ signal }) => {
    const pc = get().peerConnection;
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(signal));
        
        // Clear connection timeout
        if (get().connectionTimeout) {
          clearTimeout(get().connectionTimeout);
          set({ connectionTimeout: null });
        }

        get().startCallTimer();
        set({ callState: "active" });

        // Process queued ICE candidates (Flow 7)
        const candidates = get().pendingIceCandidates;
        console.log(`Processing ${candidates.length} queued ICE candidates`);
        for (const candidate of candidates) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch (err) {
            console.error("Error adding queued remote ICE candidate:", err);
          }
        }
        set({ pendingIceCandidates: [] });
      } catch (err) {
        console.error("Error setting remote description on accept:", err);
        get().endCall();
      }
    }
  },

  handleCallRejected: () => {
    const peerName = get().isCaller ? get().calleeName : get().callerName;
    toast(`Call declined by ${peerName || "user"}`, { duration: 3000 });
    get().resetCallState();
  },

  handleCallCancelled: () => {
    toast("Call cancelled by caller", { duration: 3000 });
    get().resetCallState();
  },

  handleCallEnded: () => {
    toast("Call ended", { duration: 3000 });
    get().resetCallState();
  },

  handleIceCandidate: async ({ candidate }) => {
    const pc = get().peerConnection;
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error("Error adding remote ICE candidate:", err);
      }
    } else {
      // Queue candidate if remote description not set yet (Flow 7)
      set((state) => ({
        pendingIceCandidates: [...state.pendingIceCandidates, candidate],
      }));
    }
  },

  // Initiate call (Caller)
  initiateCall: async (targetUserId, targetUserName, type) => {
    if (get().callState !== "idle") {
      toast.error("You are already in a call or connecting");
      return;
    }

    set({
      callState: "connecting",
      calleeId: targetUserId,
      calleeName: targetUserName,
      callType: type,
      isCaller: true,
      isMuted: false,
      isVideoPaused: false,
      isMinimized: false,
      pendingIceCandidates: [],
    });

    // Set 15-second connection timeout to prevent permanent connecting hangs
    if (get().connectionTimeout) clearTimeout(get().connectionTimeout);
    const timeout = setTimeout(() => {
      if (get().callState === "connecting") {
        toast.error("Call connection timed out");
        get().endCall();
      }
    }, 15000);
    set({ connectionTimeout: timeout });

    try {
      // Get Media Stream
      const constraints = {
        audio: true,
        video: type === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ localStream: stream });

      // Create WebRTC connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      set({ peerConnection: pc });

      // Handle connection state change for automatic cleanup on disconnection/tab closure
      pc.onconnectionstatechange = () => {
        console.log("WebRTC Connection State:", pc.connectionState);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          toast("Call connection lost", { duration: 3000 });
          get().resetCallState();
        }
      };

      // Handle ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Handle Remote Tracks
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Create and set local Offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Emit call signal via socket
      const myUser = get().currentUser || {};
      
      socket.emit("callUser", {
        userToCall: targetUserId,
        signalData: offer,
        from: myUser._id,
        fromName: myUser.fullName,
        type,
      });

    } catch (err) {
      console.error("Failed to initiate WebRTC call:", err);
      toast.error("Could not access camera or microphone");
      get().resetCallState();
    }
  },

  // Accept incoming call (Callee)
  acceptCall: async () => {
    ringtone.stop();
    const targetUserId = get().callerId;
    const pendingSignal = get().pendingSignal;

    set({ callState: "connecting" });

    // Set 15-second connection timeout to prevent permanent connecting hangs
    if (get().connectionTimeout) clearTimeout(get().connectionTimeout);
    const timeout = setTimeout(() => {
      if (get().callState === "connecting") {
        toast.error("Call connection timed out");
        get().endCall();
      }
    }, 15000);
    set({ connectionTimeout: timeout });

    try {
      // Get local stream
      const constraints = {
        audio: true,
        video: get().callType === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ localStream: stream });

      // Create peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      set({ peerConnection: pc });

      // Handle connection state change for automatic cleanup on disconnection/tab closure
      pc.onconnectionstatechange = () => {
        console.log("WebRTC Connection State:", pc.connectionState);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          toast("Call connection lost", { duration: 3000 });
          get().resetCallState();
        }
      };

      // ICE Candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("iceCandidate", {
            to: targetUserId,
            candidate: event.candidate,
          });
        }
      };

      // Remote track handling
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      };

      // Add tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Set Remote Offer
      await pc.setRemoteDescription(new RTCSessionDescription(pendingSignal));

      // Create and set local Answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Emit accepted signal (Flow 5)
      socket.emit("callAccepted", {
        to: targetUserId,
        signal: answer,
      });

      // Process queued ICE candidates (Flow 7)
      const candidates = get().pendingIceCandidates;
      console.log(`Processing ${candidates.length} queued ICE candidates`);
      for (const candidate of candidates) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          console.error("Error adding queued remote ICE candidate:", err);
        }
      }
      set({ pendingIceCandidates: [] });

      get().startCallTimer();
      set({ callState: "active" });

    } catch (err) {
      console.error("Failed to accept WebRTC call:", err);
      toast.error("Could not access media devices");
      get().rejectCall();
    }
  },

  // Reject incoming call (Callee)
  rejectCall: () => {
    ringtone.stop();
    const targetId = get().callerId;
    if (targetId) {
      socket.emit("callRejected", { to: targetId });
    }
    get().resetCallState();
  },

  // End active call (Either side) / Cancel call (Caller) (Flow 3/4)
  endCall: () => {
    if (get().isRoomCall) {
      get().leaveRoomCall();
      return;
    }
    const targetId = get().isCaller ? get().calleeId : get().callerId;
    if (targetId) {
      if (get().callState === "connecting" && get().isCaller) {
        socket.emit("callCancelled", { to: targetId });
      } else {
        socket.emit("callEnded", { to: targetId });
      }
    }
    get().resetCallState();
  },

  // Toggle local Audio track
  toggleMute: () => {
    const stream = get().localStream;
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        set({ isMuted: !audioTrack.enabled });
      }
    }
  },

  // Toggle local Video track
  toggleVideo: () => {
    const stream = get().localStream;
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        set({ isVideoPaused: !videoTrack.enabled });
      }
    }
  },

  // Minimize call screen
  setMinimized: (isMinimized) => {
    set({ isMinimized });
  },

  // Start call duration timer
  startCallTimer: () => {
    if (get().timerInterval) clearInterval(get().timerInterval);
    set({ callDuration: 0 });
    const interval = setInterval(() => {
      set((state) => ({ callDuration: state.callDuration + 1 }));
    }, 1000);
    set({ timerInterval: interval });
  },

  // Join Room-Based call (Link Invitation)
  joinRoomCall: async (roomId, type, authUser) => {
    if (get().callState !== "idle" && get().roomCallId === roomId) {
      return; // Already connected/connecting in this room
    }

    get().resetCallState();

    set({
      callState: "connecting",
      callType: type,
      isRoomCall: true,
      roomCallId: roomId,
      isCaller: false, // will resolve dynamically
      isMinimized: false,
      callerName: authUser.fullName,
      calleeName: "Room Participant",
    });

    console.log(`[Room Call] Joining Room ${roomId} as ${authUser.fullName}`);

    // connection timeout safeguard (25s)
    if (get().connectionTimeout) clearTimeout(get().connectionTimeout);
    const timeout = setTimeout(() => {
      if (get().callState === "connecting" && !get().remoteStream) {
        toast.error("Call connection timed out");
        get().leaveRoomCall();
      }
    }, 25000);
    set({ connectionTimeout: timeout });

    try {
      // Get Media stream
      const constraints = {
        audio: true,
        video: type === "video",
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      set({ localStream: stream });

      // Create WebRTC Peer connection
      const pc = new RTCPeerConnection(ICE_SERVERS);
      set({ peerConnection: pc });

      pc.onconnectionstatechange = () => {
        console.log(`[Room Call] WebRTC State Changed: ${pc.connectionState}`);
        if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          toast("Room call connection lost", { duration: 3000 });
          get().resetCallState();
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("roomIceCandidate", {
            roomId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          console.log("[Room Call] Received remote track stream!");
          set({ remoteStream: event.streams[0] });

          if (get().connectionTimeout) {
            clearTimeout(get().connectionTimeout);
            set({ connectionTimeout: null });
          }
          get().startCallTimer();
          set({ callState: "active" });
        }
      };

      // Add local tracks to peer connection
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Bind Socket Room Call Listeners (Off duplicates first)
      socket.off("roomUserJoined");
      socket.off("roomSignal");
      socket.off("roomIceCandidate");
      socket.off("roomCallEnded");

      // Peer joined -> we are the initiator (caller)
      socket.on("roomUserJoined", async ({ userId, fullName }) => {
        console.log(`[Room Call] Peer joined: ${fullName} (${userId}). Creating offer.`);
        set({ isCaller: true, calleeName: fullName });

        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit("roomSignal", { roomId, signalData: offer });
        } catch (err) {
          console.error("[Room Call] Failed to create offer:", err);
        }
      });

      // Receive WebRTC Signal (Offer/Answer)
      socket.on("roomSignal", async ({ signalData }) => {
        console.log(`[Room Call] Received signal: ${signalData.type}`);
        try {
          if (signalData.type === "offer") {
            // We are the callee (answerer)
            set({ isCaller: false });
            await pc.setRemoteDescription(new RTCSessionDescription(signalData));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit("roomSignal", { roomId, signalData: answer });
          } else if (signalData.type === "answer") {
            // We are the caller (initiator), process answer
            await pc.setRemoteDescription(new RTCSessionDescription(signalData));

            if (get().connectionTimeout) {
              clearTimeout(get().connectionTimeout);
              set({ connectionTimeout: null });
            }
            get().startCallTimer();
            set({ callState: "active" });
          }
        } catch (err) {
          console.error("[Room Call] Signal process error:", err);
        }
      });

      // Receive remote ICE candidate
      socket.on("roomIceCandidate", async ({ candidate }) => {
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error("[Room Call] Add candidate error:", err);
        }
      });

      // Receiver ended call
      socket.on("roomCallEnded", () => {
        toast("The other participant left the call room.");
        get().resetCallState();
      });

      // Join the socket room call
      socket.emit("joinRoomCall", {
        roomId,
        userId: authUser._id,
        fullName: authUser.fullName,
        type,
      });

    } catch (err) {
      console.error("[Room Call] Join error:", err);
      toast.error("Could not access camera or microphone");
      get().resetCallState();
    }
  },

  // Leave active Room-Based call room
  leaveRoomCall: () => {
    const roomId = get().roomCallId;
    if (roomId) {
      socket.emit("leaveRoomCall", { roomId });
    }

    // Clean up room listeners
    socket.off("roomUserJoined");
    socket.off("roomSignal");
    socket.off("roomIceCandidate");
    socket.off("roomCallEnded");

    get().resetCallState();
  },

  // RESET ALL STATE AND STOP RESOURCES (Flow 4)
  resetCallState: () => {
    ringtone.stop();

    const state = get();

    // Clear connection timeout
    if (state.connectionTimeout) {
      clearTimeout(state.connectionTimeout);
    }

    // 1. Stop all media tracks
    if (state.localStream) {
      state.localStream.getTracks().forEach((track) => {
        track.stop();
        console.log(`Track ${track.kind} stopped.`);
      });
    }

    // 2. Close peer connection
    if (state.peerConnection) {
      state.peerConnection.ontrack = null;
      state.peerConnection.onicecandidate = null;
      try {
        state.peerConnection.close();
      } catch (err) {
        console.error("Error closing peerConnection:", err);
      }
    }

    // 3. Clear timers
    if (state.timerInterval) {
      clearInterval(state.timerInterval);
    }

    // Reset properties to default
    set({
      callState: "idle",
      callerId: null,
      calleeId: null,
      callerName: null,
      calleeName: null,
      isCaller: false,
      isRoomCall: false,
      roomCallId: null,
      localStream: null,
      remoteStream: null,
      peerConnection: null,
      pendingSignal: null,
      pendingIceCandidates: [],
      isMuted: false,
      isVideoPaused: false,
      callDuration: 0,
      timerInterval: null,
      isMinimized: false,
      connectionTimeout: null,
    });
  },
}));
