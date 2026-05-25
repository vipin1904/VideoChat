import { useCallStore } from "../store/useCallStore";
import { useNavigate } from "react-router";
import { Mic, MicOff, Video, VideoOff, PhoneOff, Maximize2 } from "lucide-react";

const OngoingCallBanner = () => {
  const {
    isCaller,
    callerName,
    calleeName,
    callDuration,
    isMuted,
    isVideoPaused,
    toggleMute,
    toggleVideo,
    endCall,
    setMinimized,
    callerId,
    calleeId,
  } = useCallStore();

  const navigate = useNavigate();

  const peerName = isCaller ? calleeName : callerName;
  const peerId = isCaller ? calleeId : callerId;

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

  const handleExpand = () => {
    setMinimized(false);
    navigate(`/call/${peerId}`);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-lg bg-neutral/85 backdrop-blur-xl border border-white/10 rounded-full px-5 py-2.5 shadow-2xl flex items-center justify-between text-white animate-fade-in-up">
      {/* Tap on user details -> Opens full call screen */}
      <div
        onClick={handleExpand}
        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity flex-1 min-w-0 pr-2"
        title="Click to expand call screen"
      >
        <div className="size-10 rounded-full bg-primary flex items-center justify-center text-primary-content text-sm font-bold shadow-md shadow-primary/20 shrink-0">
          {getInitials(peerName)}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate pr-1">{peerName || "Active Call"}</p>
          <p className="text-xs text-primary font-medium font-mono">
            {formatTime(callDuration)}
          </p>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={toggleMute}
          className={`btn btn-circle btn-sm border-none ${
            isMuted ? "btn-error text-white" : "btn-ghost bg-white/5 text-white hover:bg-white/10"
          }`}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
        </button>

        <button
          onClick={toggleVideo}
          className={`btn btn-circle btn-sm border-none ${
            isVideoPaused ? "btn-error text-white" : "btn-ghost bg-white/5 text-white hover:bg-white/10"
          }`}
          title={isVideoPaused ? "Turn Video On" : "Turn Video Off"}
        >
          {isVideoPaused ? <VideoOff className="size-4" /> : <Video className="size-4" />}
        </button>

        <button
          onClick={handleExpand}
          className="btn btn-circle btn-sm btn-ghost bg-white/5 text-white hover:bg-white/10 border-none"
          title="Expand"
        >
          <Maximize2 className="size-4" />
        </button>

        <button
          onClick={endCall}
          className="btn btn-circle btn-sm btn-error shadow-lg shadow-error/20 hover:scale-105 border-none text-white"
          title="End Call"
        >
          <PhoneOff className="size-4" />
        </button>
      </div>
    </div>
  );
};

export default OngoingCallBanner;
