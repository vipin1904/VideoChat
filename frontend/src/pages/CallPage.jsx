import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useCallStore } from "../store/useCallStore";
import useAuthUser from "../hooks/useAuthUser";
import { 
  Mic, 
  MicOff, 
  Video as VideoIcon, 
  VideoOff, 
  PhoneOff, 
  ArrowLeft,
  UserPlus,
  UserMinus,
  UserCheck,
  Video,
  Circle,
  Square,
  Sparkles,
  ShieldCheck,
  Zap,
  Globe
} from "lucide-react";
import toast from "react-hot-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getUserFriends, 
  getOutgoingFriendReqs, 
  getFriendRequests, 
  sendFriendRequest, 
  withdrawFriendRequest, 
  acceptFriendRequest 
} from "../lib/api";

const CallPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id: roomId } = useParams();
  const { authUser } = useAuthUser();

  const {
    callState,
    localStream,
    remoteStream,
    callType,
    isCaller,
    callerName,
    calleeName,
    isMuted,
    isVideoPaused,
    callDuration,
    toggleMute,
    toggleVideo,
    endCall,
    setMinimized,
  } = useCallStore();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);

  const peerName = isCaller ? calleeName : callerName;
  const otherUserId = isCaller 
    ? useCallStore.getState().calleeId 
    : useCallStore.getState().callerId;

  // Screen recording state
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const screenStreamRef = useRef(null);

  // Friendship management queries
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!otherUserId,
  });

  const { data: outgoingRequests = [] } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
    enabled: !!otherUserId,
  });

  const { data: friendRequests } = useQuery({
    queryKey: ["friendRequests"],
    queryFn: getFriendRequests,
    enabled: !!otherUserId,
  });

  const incomingRequests = friendRequests?.incomingReqs || [];

  // Friendship state computation
  const isAlreadyFriend = friends.some((f) => f._id === otherUserId);
  const sentRequest = outgoingRequests.find((req) => req.recipient?._id === otherUserId);
  const receivedRequest = incomingRequests.find((req) => req.sender?._id === otherUserId);

  // Friendship mutations
  const { mutate: sendRequest, isPending: isSending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      toast.success("Friend request sent!", { icon: "✉️" });
    },
    onError: () => toast.error("Failed to send friend request"),
  });

  const { mutate: withdrawRequest, isPending: isWithdrawing } = useMutation({
    mutationFn: withdrawFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      toast.success("Friend request withdrawn", { icon: "↩️" });
    },
    onError: () => toast.error("Failed to withdraw request"),
  });

  const { mutate: acceptRequest, isPending: isAccepting } = useMutation({
    mutationFn: acceptFriendRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friendRequests"] });
      queryClient.invalidateQueries({ queryKey: ["friends"] });
      toast.success("Friend request accepted!", { icon: "🤝" });
    },
    onError: () => toast.error("Failed to accept request"),
  });

  // Screen recording logic
  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: true
      });

      const mediaRecorder = new MediaRecorder(screenStream, {
        mimeType: "video/webm;codecs=vp9"
      });

      const chunks = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `call-recording-${peerName}-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.webm`;
        a.click();
        URL.revokeObjectURL(url);

        // Stop all tracks of screenStream
        screenStream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        toast.success("Recording downloaded successfully!", { icon: "🎥" });
      };

      // Stop recording if browser's native stop-sharing is clicked
      screenStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      screenStreamRef.current = screenStream;
      mediaRecorder.start();
      setIsRecording(true);
      toast.success("Recording started! Please choose the call tab/window to share.", { icon: "🔴" });
    } catch (err) {
      console.error("Failed to start screen recording:", err);
      toast.error("Could not start recording.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  };

  // Clean up screen recording on unmount
  useEffect(() => {
    return () => {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const isRoom = roomId && roomId.startsWith("room-");
  const hasJoinedRef = useRef(false);

  // Auto redirect to home if no active call OR join if room link is clicked
  useEffect(() => {
    if (isRoom && authUser) {
      if (!hasJoinedRef.current) {
        hasJoinedRef.current = true;
        const searchParams = new URLSearchParams(window.location.search);
        const callTypeFromUrl = searchParams.get("type") || "video";
        useCallStore.getState().joinRoomCall(roomId, callTypeFromUrl, authUser);
      }
    } else if (callState === "idle" && !isRoom) {
      navigate("/");
    }
  }, [isRoom, roomId, authUser, navigate, callState]);

  // Navigate back to home once a joined room call transitions to idle (ended or disconnected)
  useEffect(() => {
    if (callState === "idle" && hasJoinedRef.current) {
      navigate("/");
    }
  }, [callState, navigate]);

  // Attach local stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Attach remote stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  // Format call timer
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  // Back button minimizes the call instead of ending it
  const handleBack = () => {
    setMinimized(true);
    navigate(-1);
    toast("Call minimized", { icon: "📥", duration: 2000 });
  };

  if (callState === "idle") return null;

  return (
    <div className="w-screen h-[100dvh] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 overflow-hidden flex flex-col relative text-white select-none">
      
      {/* Dynamic Modern Header Bar */}
      <header className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={handleBack}
            className="btn btn-circle btn-ghost bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:scale-105 border border-white/10 transition-all shadow-lg"
            title="Minimize Call"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center text-primary font-bold text-sm shadow-md">
              {getInitials(peerName)}
            </div>
            <div>
              <h2 className="font-bold text-sm sm:text-base leading-tight drop-shadow-md">{peerName || "Active Call"}</h2>
              <span className="text-xs text-white/60 flex items-center gap-1.5 mt-0.5">
                <span className="size-2 rounded-full bg-success animate-pulse inline-block" />
                {callType === "video" ? "Video calling" : "Voice calling"}
              </span>
            </div>
          </div>
        </div>

        {/* In-Call Friendship Action Panel */}
        {otherUserId && (
          <div className="flex items-center gap-2">
            {isAlreadyFriend ? (
              <div className="badge badge-success gap-1.5 p-3.5 text-xs font-semibold backdrop-blur-md bg-success/20 border-success/30 text-success shadow-lg">
                <ShieldCheck className="size-4" />
                <span>Friends</span>
              </div>
            ) : sentRequest ? (
              <button
                onClick={() => withdrawRequest(otherUserId)}
                disabled={isWithdrawing}
                className="btn btn-xs sm:btn-sm btn-outline btn-error gap-1.5 rounded-full backdrop-blur-md bg-error/10 hover:bg-error border-error/30 text-white shadow-lg"
                title="Withdraw Friend Request"
              >
                {isWithdrawing ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <UserMinus className="size-4" />
                )}
                <span className="hidden sm:inline">Cancel Request</span>
              </button>
            ) : receivedRequest ? (
              <button
                onClick={() => acceptRequest(receivedRequest._id)}
                disabled={isAccepting}
                className="btn btn-xs sm:btn-sm btn-success gap-1.5 rounded-full backdrop-blur-md bg-success/20 border-success/30 hover:bg-success text-white shadow-lg animate-bounce"
                title="Accept Friend Request"
              >
                {isAccepting ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <UserCheck className="size-4" />
                )}
                <span>Accept Friend</span>
              </button>
            ) : (
              <button
                onClick={() => sendRequest(otherUserId)}
                disabled={isSending}
                className="btn btn-xs sm:btn-sm btn-primary gap-1.5 rounded-full backdrop-blur-md bg-primary/20 border-primary/30 hover:bg-primary text-white shadow-lg hover:scale-105 transition-transform"
                title="Send Friend Request"
              >
                {isSending ? (
                  <span className="loading loading-spinner loading-xs" />
                ) : (
                  <UserPlus className="size-4" />
                )}
                <span>Add Friend</span>
              </button>
            )}
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full h-full relative flex items-center justify-center">
        {callType === "video" ? (
          // PREMIUM VIDEO CALL LAYOUT
          <div className="w-full h-full relative flex items-center justify-center">
            
            {/* Remote Video Stream (Main screen) */}
            {remoteStream ? (
              <div className="w-full h-full relative overflow-hidden">
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
                {/* Vignette Overlay for Premium Cine Feel */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/45 pointer-events-none" />
              </div>
            ) : (
              // Ringing/Connecting User placeholder
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm gap-6 relative">
                <div className="relative flex items-center justify-center">
                  <div className="absolute size-28 rounded-full bg-primary/20 animate-ping duration-1000" />
                  <div className="absolute size-36 rounded-full bg-primary/10 animate-pulse duration-1000" />
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center text-primary-content text-3xl font-extrabold shadow-2xl relative z-10 ring-4 ring-white/10">
                    {getInitials(peerName)}
                  </div>
                </div>
                
                <div className="text-center z-10 px-4">
                  <h3 className="text-2xl font-extrabold tracking-tight text-white mb-2">{peerName || "User"}</h3>
                  <div className="flex items-center justify-center gap-2">
                    <span className="loading loading-ring loading-md text-primary"></span>
                    <span className="text-white/60 text-sm font-semibold tracking-wider uppercase animate-pulse">
                      {callState === "connecting" ? "Connecting Call..." : "Ringing..."}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Local Video Stream (Floating picture-in-picture with modern shadow and overlay status) */}
            {localStream && !isVideoPaused && (
              <div className="absolute bottom-28 right-4 w-32 h-48 sm:w-44 sm:h-64 rounded-2xl overflow-hidden border border-white/20 shadow-2xl shadow-black/80 z-20 bg-slate-950/80 transition-all duration-300 hover:scale-105 group ring-1 ring-primary/45">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
                <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded text-[10px] font-semibold text-white/80 opacity-0 group-hover:opacity-100 transition-opacity">
                  You
                </div>
              </div>
            )}
            
            {/* Show paused local video state overlay */}
            {isVideoPaused && (
              <div className="absolute bottom-28 right-4 w-32 h-48 sm:w-44 sm:h-64 rounded-2xl flex flex-col items-center justify-center border border-white/20 shadow-2xl bg-slate-900/90 text-white/50 text-xs z-20 ring-1 ring-error/45">
                <VideoOff className="w-6 h-6 mb-2 text-error animate-pulse" />
                <span className="font-semibold uppercase tracking-wider text-[10px]">Video Off</span>
              </div>
            )}
          </div>
        ) : (
          // PREMIUM AUDIO CALL LAYOUT
          <div className="flex flex-col items-center justify-center gap-8 px-4">
            <div className="relative flex items-center justify-center">
              {/* Multiplying Pulsing Outer Rings */}
              <div className="absolute w-40 h-40 rounded-full bg-primary/20 animate-ping duration-1000" />
              <div className="absolute w-52 h-52 rounded-full bg-primary/10 animate-pulse duration-1000" />
              <div className="absolute w-64 h-64 rounded-full bg-indigo-500/5 animate-pulse duration-1500" />
              
              {/* Profile Avatar Container */}
              <div className="w-36 h-36 rounded-full bg-gradient-to-tr from-primary via-indigo-600 to-purple-600 flex items-center justify-center text-primary-content text-5xl font-extrabold shadow-2xl relative z-10 ring-4 ring-white/10">
                {getInitials(peerName)}
              </div>
            </div>

            <div className="text-center z-10 space-y-2">
              <h2 className="text-3xl font-black tracking-tight text-white">{peerName || "Active Call"}</h2>
              <div className="flex items-center justify-center gap-1.5 text-primary-light font-semibold text-xs tracking-widest uppercase">
                <Zap className="size-4 text-warning animate-bounce" />
                <span>{callState === "active" ? "Call Connected" : "Connecting..."}</span>
              </div>
            </div>
          </div>
        )}

        {/* State Overlays when call is not active */}
        {callState === "connecting" && !remoteStream && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-10 gap-3">
            <div className="flex flex-col items-center gap-2 bg-black/40 p-6 rounded-2xl border border-white/5 shadow-2xl">
              <span className="loading loading-ring loading-lg text-primary"></span>
              <p className="font-bold text-base tracking-widest uppercase text-white animate-pulse">Establishing Peer Connection</p>
              <p className="text-xs text-white/50">Securing WebRTC handshakes...</p>
            </div>
          </div>
        )}
      </main>

      {/* Premium Floating Controls Panel (Bottom) */}
      <footer className="w-full pb-8 pt-4 px-6 bg-gradient-to-t from-black via-black/90 to-transparent flex flex-col items-center gap-4 z-40">
        
        {/* Call Timer Display */}
        {callState === "active" && (
          <div className="text-sm font-black font-mono tracking-widest text-primary-content bg-primary/20 px-4 py-1.5 rounded-full border border-primary/30 shadow-lg backdrop-blur-md flex items-center gap-2">
            <span className="size-2 rounded-full bg-danger bg-red-500 animate-ping" />
            <span>{formatTime(callDuration)}</span>
          </div>
        )}

        <div className="flex items-center justify-center gap-4 sm:gap-6 bg-white/5 border border-white/10 backdrop-blur-xl px-6 py-4 rounded-3xl shadow-2xl max-w-md w-full">
          {/* Mute Local Audio */}
          <button
            onClick={toggleMute}
            className={`btn btn-circle btn-md sm:btn-lg border border-white/10 transition-all duration-300 hover:scale-105 ${
              isMuted
                ? "bg-error/20 hover:bg-error/30 text-error border-error/45 shadow-lg shadow-error/20"
                : "bg-white/5 hover:bg-white/10 text-white shadow-md"
            }`}
            title={isMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isMuted ? <MicOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <Mic className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* Screen Recording Action */}
          <button
            onClick={handleToggleRecording}
            className={`btn btn-circle btn-md sm:btn-lg border border-white/10 transition-all duration-300 hover:scale-105 ${
              isRecording
                ? "bg-error/30 text-error border-error/50 hover:bg-error/40 shadow-lg animate-pulse"
                : "bg-white/5 hover:bg-white/10 text-white shadow-md"
            }`}
            title={isRecording ? "Stop Screen Recording" : "Record Screen"}
          >
            {isRecording ? <Square className="w-5 h-5 sm:w-6 sm:h-6 fill-error" /> : <Circle className="w-5 h-5 sm:w-6 sm:h-6 fill-white/20" />}
          </button>

          {/* Toggle Local Video (Mute/Pause) */}
          <button
            onClick={toggleVideo}
            disabled={callType === "audio"}
            className={`btn btn-circle btn-md sm:btn-lg border border-white/10 transition-all duration-300 hover:scale-105 ${
              callType === "audio"
                ? "bg-slate-900 text-slate-700 cursor-not-allowed opacity-30 border-none"
                : isVideoPaused
                ? "bg-error/20 hover:bg-error/30 text-error border-error/45 shadow-lg shadow-error/20"
                : "bg-white/5 hover:bg-white/10 text-white shadow-md"
            }`}
            title={isVideoPaused ? "Start Camera" : "Stop Camera"}
          >
            {isVideoPaused ? <VideoOff className="w-5 h-5 sm:w-6 sm:h-6" /> : <VideoIcon className="w-5 h-5 sm:w-6 sm:h-6" />}
          </button>

          {/* End Call (Red Accent Circle) */}
          <button
            onClick={endCall}
            className="btn btn-circle btn-md sm:btn-lg bg-red-600 hover:bg-red-500 border border-red-500/30 hover:border-red-500 text-white shadow-lg shadow-red-600/30 hover:scale-110 transition-all"
            title="End Call"
          >
            <PhoneOff className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>
      </footer>
    </div>
  );
};

export default CallPage;
