import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { StreamVideo, StreamVideoClient } from "@stream-io/video-react-sdk";
import useAuthUser from "../hooks/useAuthUser";
import { getStreamToken } from "../lib/api";
import { getAvatarUrl } from "../lib/utils";
import { useCallStore } from "../store/useCallStore";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

export const CallProvider = ({ children }) => {
  const { authUser } = useAuthUser();
  const { initSocket } = useCallStore();

  // Initialize Socket.IO connection & bind listeners
  useEffect(() => {
    if (!authUser?._id) {
      useCallStore.getState().disconnectSocket();
      return;
    }

    initSocket(authUser);
  }, [authUser, initSocket]);

  // Create Stream Video Client context
  let videoClient = null;
  if (import.meta.env.VITE_STREAM_API_KEY && authUser) {
    try {
      // Use standard Stream Chat token for auth sync
      const token = localStorage.getItem("stream-token") || "";
      
      videoClient = new StreamVideoClient({
        apiKey: STREAM_API_KEY,
        user: {
          id: authUser._id,
          name: authUser.fullName,
          image: getAvatarUrl(authUser._id),
        },
        // Fallback token data lookup
        token: token || authUser._id, 
      });
    } catch (error) {
      console.error("Failed to init stream video client", error);
    }
  }

  return (
    <>
      {videoClient ? (
        <StreamVideo client={videoClient}>{children}</StreamVideo>
      ) : (
        children
      )}
    </>
  );
};
