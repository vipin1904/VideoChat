import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { getAvatarUrl } from "../lib/utils";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useNavigate } from "react-router";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageComposer,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import { PhoneIcon, VideoIcon, Trash2Icon } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { socket } from "../lib/socket";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const { initiateCall } = useCallStore();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const videoClient = useStreamVideoClient();
  const navigate = useNavigate();

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser, // this will run only when authUser is available
  });

  useEffect(() => {
    let active = true;
    let client;
    
    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        console.log("Initializing stream chat client...");

        client = StreamChat.getInstance(STREAM_API_KEY);

        // Prevent redundant connections or reconnecting to a different user
        if (client.userID !== authUser._id) {
          if (client.userID) {
            await client.disconnectUser();
          }
          await client.connectUser(
            {
              id: authUser._id,
              name: authUser.fullName,
              image: getAvatarUrl(authUser._id),
            },
            tokenData.token
          );
        }

        const channelId = [authUser._id, targetUserId].sort().join("-");
        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });

        await currChannel.watch();

        if (active) {
          setChatClient(client);
          setChannel(currChannel);
        }
      } catch (error) {
        console.error("Error initializing chat:", error);
        if (active) {
          setError(error);
          toast.error("Could not connect to chat. Please try again.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    initChat();

    return () => {
      active = false;
    };
  }, [tokenData, authUser, targetUserId]);

  // Handle socket message receipt and lifecycle cleanup (Flow 6)
  useEffect(() => {
    const handleReceiveMessage = (data) => {
      console.log("Real-time message received via socket:", data);
    };

    socket.on("receiveMessage", handleReceiveMessage);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, []);

  const startCall = async (type) => {
    if (!channel) return;
    const otherMember = Object.values(channel.state.members).find(
      (m) => m.user.id !== authUser._id
    );
    const otherUser = otherMember?.user;
    if (!otherUser) {
      toast.error("User not found in channel");
      return;
    }

    try {
      // Initiate WebRTC call via socket.io signaling
      await initiateCall(targetUserId, otherUser.name, type);

      // Send chat invitation notification
      await channel.sendMessage({
        text: `📞 Started a ${type} call. Join here: ${window.location.origin}/call/${authUser._id}`,
      });
      navigate(`/call/${targetUserId}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to start call");
    }
  };

  const clearChat = async () => {
    if(!channel) return;
    if(window.confirm("Are you sure you want to clear this entire chat history?")) {
      try {
        await channel.truncate();
        toast.success("Chat history cleared!");
      } catch(err) {
        toast.error("Could not clear chat.");
      }
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-6 bg-base-100">
        <p className="text-lg text-error font-medium">Could not connect to chat. Please check if server is running and try again.</p>
        <button onClick={() => navigate("/")} className="btn btn-primary">Go back to Home</button>
      </div>
    );
  }

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    <div className="w-full h-full flex flex-col">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="w-full relative flex flex-col h-full">
            <Window>
              <CustomChannelHeader channel={channel} authUser={authUser} onStartCall={startCall} onClearChat={clearChat} />
              <MessageList />
              <MessageComposer />
            </Window>
          </div>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};

const CustomChannelHeader = ({ channel, authUser, onStartCall, onClearChat }) => {
  const otherMember = Object.values(channel.state.members).find(
    (m) => m.user.id !== authUser._id
  );
  const otherUser = otherMember?.user;

  return (
    <div className="w-full flex items-center justify-between p-3 bg-base-200 border-b border-base-300">
      <div className="flex items-center gap-3 min-w-0">
        {otherUser && (
          <div className="avatar size-10 flex-shrink-0">
            <div className="rounded-full overflow-hidden ring-2 ring-primary/20">
              <img src={otherUser.image} alt={otherUser.name} className="object-cover w-full h-full" />
            </div>
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-bold text-base truncate">{otherUser?.name || "Conversation"}</h2>
          <p className="text-xs text-success flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-success inline-block animate-pulse" />
            Active
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <button onClick={() => onStartCall('audio')} className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" title="Voice Call">
          <PhoneIcon className="w-5 h-5" />
        </button>
        <button onClick={() => onStartCall('video')} className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" title="Video Call">
          <VideoIcon className="w-5 h-5" />
        </button>
        <button onClick={onClearChat} className="btn btn-sm btn-circle btn-ghost text-error hover:bg-error/20" title="Clear Chat">
          <Trash2Icon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default ChatPage;
