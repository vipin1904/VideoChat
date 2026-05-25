import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { getStreamToken } from "../lib/api";
import { getAvatarUrl } from "../lib/utils";
import { useCallStore } from "../store/useCallStore";
import OngoingCallBanner from "../components/OngoingCallBanner";
import { socket } from "../lib/socket";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

export const CallProvider = ({ children }) => {
  const { authUser } = useAuthUser();
  const { initSocket, callState, callerName, acceptCall, rejectCall, isMinimized } = useCallStore();
  const navigate = useNavigate();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  // Initialize Socket.IO connection & bind listeners with lifecycle cleanup (Flow 6)
  useEffect(() => {
    if (!authUser?._id) {
      useCallStore.getState().disconnectSocket();
      return;
    }

    initSocket(authUser);

    const onCallIncoming = (data) => useCallStore.getState().handleCallIncoming(data);
    const onCallAccepted = (data) => useCallStore.getState().handleCallAccepted(data);
    const onCallRejected = () => useCallStore.getState().handleCallRejected();
    const onCallCancelled = () => useCallStore.getState().handleCallCancelled();
    const onCallEnded = () => useCallStore.getState().handleCallEnded();
    const onIceCandidate = (data) => useCallStore.getState().handleIceCandidate(data);

    socket.on("callIncoming", onCallIncoming);
    socket.on("callAccepted", onCallAccepted);
    socket.on("callRejected", onCallRejected);
    socket.on("callCancelled", onCallCancelled);
    socket.on("callEnded", onCallEnded);
    socket.on("iceCandidate", onIceCandidate);

    return () => {
      socket.off("callIncoming", onCallIncoming);
      socket.off("callAccepted", onCallAccepted);
      socket.off("callRejected", onCallRejected);
      socket.off("callCancelled", onCallCancelled);
      socket.off("callEnded", onCallEnded);
      socket.off("iceCandidate", onIceCandidate);
    };
  }, [authUser, initSocket]);

  // Handle auto-navigation to call page when call starts or gets accepted
  useEffect(() => {
    if (callState === "active" && !isMinimized) {
      const otherUserId = useCallStore.getState().isCaller
        ? useCallStore.getState().calleeId
        : useCallStore.getState().callerId;
      if (otherUserId) {
        navigate(`/call/${otherUserId}`);
      }
    }
  }, [callState, isMinimized, navigate]);

  // Create Stream Video Client fallback for compatibility
  let videoClient = null;
  if (tokenData?.token && authUser) {
    try {
      videoClient = new StreamVideoClient({
        apiKey: STREAM_API_KEY,
        user: {
          id: authUser._id,
          name: authUser.fullName,
          image: getAvatarUrl(authUser._id),
        },
        token: tokenData.token,
      });
    } catch (error) {
      console.error("Failed to init stream video client fallback", error);
    }
  }

  const getInitials = (name) => {
    if (!name) return "U";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .substring(0, 2);
  };

  return (
    <>
      {videoClient ? (
        <StreamVideo client={videoClient}>{children}</StreamVideo>
      ) : (
        children
      )}

      {/* Custom Incoming Call Modal overlay */}
      {callState === "ringing" && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-base-300 p-8 rounded-2xl border border-white/10 flex flex-col items-center gap-6 shadow-2xl max-w-sm w-full mx-4 text-center">
            {/* Avatar Initials */}
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center text-primary-content text-3xl font-bold shadow-lg shadow-primary/30">
              {getInitials(callerName)}
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{callerName || "Unknown Caller"}</h2>
              <p className="text-white/60 animate-pulse text-sm">Incoming call...</p>
            </div>

            <div className="flex gap-4 w-full justify-center">
              <button
                onClick={rejectCall}
                className="btn btn-error btn-circle btn-lg text-white shadow-lg shadow-error/20 hover:scale-105 transition-transform"
                title="Decline"
              >
                {/* End Call Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 10.5V20a2 2 0 01-2 2H7a2 2 0 01-2-2v-9.5M3 10V7a4 4 0 018 0v3M21 10V7a4 4 0 00-8 0v3" />
                </svg>
              </button>
              
              <button
                onClick={acceptCall}
                className="btn btn-success btn-circle btn-lg text-white shadow-lg shadow-success/20 hover:scale-105 transition-transform"
                title="Accept"
              >
                {/* Accept Call Icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Minimized Call Banner */}
      {(callState === "active" || callState === "connecting") && isMinimized && (
        <OngoingCallBanner />
      )}
    </>
  );
};
