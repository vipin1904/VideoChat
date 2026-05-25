import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import { 
  useStreamVideoClient, 
  StreamTheme, 
  StreamCall, 
  SpeakerLayout, 
  CallControls 
} from "@stream-io/video-react-sdk";
import useAuthUser from "../hooks/useAuthUser";
import "@stream-io/video-react-sdk/dist/css/styles.css";

const CallPage = () => {
  const navigate = useNavigate();
  const { id: roomId } = useParams();
  const { authUser } = useAuthUser();
  const client = useStreamVideoClient();
  const [call, setCall] = useState(null);

  useEffect(() => {
    if (!client || !roomId || !authUser) return;

    const searchParams = new URLSearchParams(window.location.search);
    const callType = searchParams.get("type") || "video";

    console.log(`[Stream Call] Joining room: ${roomId} (type: ${callType})`);

    const activeCall = client.call("default", roomId);
    
    activeCall
      .join({ create: true })
      .then(() => {
        if (callType === "audio") {
          activeCall.camera.disable();
        }
        setCall(activeCall);
      })
      .catch((err) => {
        console.error("Failed to join Stream Cloud Call:", err);
      });

    return () => {
      activeCall.leave().catch((err) => console.error("Error leaving call:", err));
    };
  }, [client, roomId, authUser]);

  if (!call) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-white select-none">
        <span className="loading loading-ring loading-lg text-primary"></span>
        <h3 className="mt-4 font-black uppercase tracking-widest text-sm animate-pulse">Connecting to Stream Cloud...</h3>
        <p className="text-xs opacity-50 mt-2">Securing direct high-quality stream channels</p>
      </div>
    );
  }

  return (
    <div className="w-screen h-[100dvh] bg-slate-950 text-white overflow-hidden flex flex-col relative select-none">
      <StreamTheme>
        <StreamCall call={call}>
          <div className="flex-1 relative flex flex-col h-full w-full">
            <SpeakerLayout />
            <CallControls onLeave={() => navigate("/")} />
          </div>
        </StreamCall>
      </StreamTheme>
    </div>
  );
};

export default CallPage;
