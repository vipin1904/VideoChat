import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useNavigate } from "react-router";

import {
  Channel,
  ChannelHeader,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";
import { PhoneIcon, VideoIcon, Trash2Icon } from "lucide-react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [loading, setLoading] = useState(true);
  const videoClient = useStreamVideoClient();
  const navigate = useNavigate();

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser, // this will run only when authUser is available
  });

  useEffect(() => {
    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;

      try {
        console.log("Initializing stream chat client...");

        const client = StreamChat.getInstance(STREAM_API_KEY);

        await client.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token
        );

        //
        const channelId = [authUser._id, targetUserId].sort().join("-");

        // you and me
        // if i start the chat => channelId: [myId, yourId]
        // if you start the chat => channelId: [yourId, myId]  => [myId,yourId]

        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });

        await currChannel.watch();

        setChatClient(client);
        setChannel(currChannel);
      } catch (error) {
        console.error("Error initializing chat:", error);
        toast.error("Could not connect to chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    initChat();
  }, [tokenData, authUser, targetUserId]);

  const startCall = async (type) => {
    if (!videoClient || !channel) {
      toast.error("Video client not ready");
      return;
    }
    const call = videoClient.call("default", channel.id);
    
    try {
      await call.getOrCreate({
        ring: true,
        data: {
          members: [{ user_id: authUser._id }, { user_id: targetUserId }],
          custom: { type } 
        }
      });
      navigate(`/call/${channel.id}`);
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

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    <div className="w-full h-full flex flex-col">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="w-full relative flex flex-col h-full">
            {/* Custom Header Actions Overlay */}
            <div className="absolute top-3 right-4 z-10 flex gap-2">
              <button onClick={() => startCall('audio')} className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" title="Voice Call">
                <PhoneIcon className="w-5 h-5" />
              </button>
              <button onClick={() => startCall('video')} className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" title="Video Call">
                <VideoIcon className="w-5 h-5" />
              </button>
              <button onClick={clearChat} className="btn btn-sm btn-circle btn-ghost text-error hover:bg-error/20" title="Clear Chat">
                <Trash2Icon className="w-5 h-5" />
              </button>
            </div>
            
            <Window>
              <ChannelHeader title="VideoChat Conversation" />
              <MessageList />
              <MessageInput focus />
            </Window>
          </div>
          <Thread />
        </Channel>
      </Chat>
    </div>
  );
};
export default ChatPage;
