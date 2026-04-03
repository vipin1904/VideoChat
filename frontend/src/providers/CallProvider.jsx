import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StreamVideo, StreamVideoClient, StreamCall, useCalls, RingingCall, StreamTheme } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useNavigate } from "react-router";

import useAuthUser from "../hooks/useAuthUser";
import { getStreamToken } from "../lib/api";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

export const CallProvider = ({ children }) => {
  const [videoClient, setVideoClient] = useState(null);
  const { authUser } = useAuthUser();
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    let client;
    const initVideoClient = async () => {
      if (!tokenData?.token || !authUser) return;
      try {
        client = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          token: tokenData.token,
        });
        setVideoClient(client);
      } catch (error) {
        console.error("Failed to init global stream video", error);
      }
    };
    initVideoClient();

    return () => {
      if (client) {
        client.disconnectUser().catch(console.error);
        setVideoClient(null);
      }
    };
  }, [authUser, tokenData]);

  if (!videoClient) return <>{children}</>;

  return (
    <StreamVideo client={videoClient}>
      <IncomingCallWatcher />
      {children}
    </StreamVideo>
  );
};

const IncomingCallWatcher = () => {
  const calls = useCalls();
  const navigate = useNavigate();

  // Find the first ringing call that we didn't create
  const incomingCall = calls.find(
    (c) => c.isCreatedByMe === false && c.state.callingState === "ringing"
  );

  if (!incomingCall) return null;

  return (
    <StreamTheme className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <StreamCall call={incomingCall}>
         <RingingCall 
            onAccept={() => {
              incomingCall.join();
              navigate(`/call/${incomingCall.id}`);
            }}
            onReject={() => {
              incomingCall.leave({ reject: true });
            }}
         />
      </StreamCall>
    </StreamTheme>
  );
};
