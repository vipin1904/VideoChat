import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";
import InitialAvatar from "../components/InitialAvatar";

import {
  Channel,
  Chat,
  MessageInput,
  MessageList,
  Thread,
  Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import toast from "react-hot-toast";

import ChatLoader from "../components/ChatLoader";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ─── WhatsApp‑style Chat Header ─── */
const ChatHeader = ({ targetUser, onVideoCall, onAudioCall, onClearChat }) => {
  const navigate = useNavigate();

  return (
    <header className="chat-header flex items-center gap-3 px-3 sm:px-4 py-2 bg-[#f0f2f5] border-b border-[#e9edef] shrink-0 z-20">

      {/* ← Back button */}
      <button
        onClick={() => navigate("/")}
        className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-black/8 transition-colors text-[#54656f]"
        title="Back"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
          strokeWidth={2.5} stroke="currentColor" className="w-5 h-5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
        </svg>
      </button>

      {/* Avatar + status — shows initials if no photo (WhatsApp style) */}
      <div className="relative shrink-0">
        <InitialAvatar
          src={targetUser?.image}
          name={targetUser?.name || targetUser?.fullName || ""}
          size="10"
          className="border border-[#e9edef]"
        />
        {targetUser?.online && (
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#00a884] border-2 border-[#f0f2f5] rounded-full" />
        )}
      </div>

      {/* Name + online */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-[#111b21] text-sm leading-tight truncate">
          {targetUser?.name || targetUser?.fullName || "Chat Partner"}
        </p>
        <p className="text-xs font-medium text-[#54656f]">
          {targetUser?.online ? "online" : "offline"}
        </p>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1 shrink-0">

        {/* Voice Call */}
        <button
          onClick={onAudioCall}
          title="Voice call"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[#00a884] bg-[#00a884]/10 hover:bg-[#00a884]/20 transition-all text-xs font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l.547 2.19c.204.814-.006 1.693-.57 2.258L6.22 8.784a16.533 16.533 0 0 0 7.228 7.228l1.416-1.417c.565-.565 1.444-.775 2.259-.57l2.19.547a1.91 1.91 0 0 1 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C6.71 22.5 1.5 17.29 1.5 10.75V4.5Z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">Voice</span>
        </button>

        {/* Video Call */}
        <button
          onClick={onVideoCall}
          title="Video call"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[#3b82f6] bg-[#3b82f6]/10 hover:bg-[#3b82f6]/20 transition-all text-xs font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3V13.5l4.5 4.5V6l-4.5 4.5V7.5a3 3 0 0 0-3-3H4.5Z" />
          </svg>
          <span className="hidden sm:inline">Video</span>
        </button>

        {/* Clear Chat */}
        <button
          onClick={onClearChat}
          title="Clear chat"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-red-500 bg-red-500/10 hover:bg-red-500/20 transition-all text-xs font-semibold"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
            strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
            <path strokeLinecap="round" strokeLinejoin="round"
              d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>
    </header>
  );
};

/* ─── ChatPage ─── */
const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient]   = useState(null);
  const [channel, setChannel]         = useState(null);
  const [targetUser, setTargetUser]   = useState(null);
  const [loading, setLoading]         = useState(true);

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken", targetUserId],
    queryFn: () => getStreamToken(targetUserId),
    enabled: !!authUser && !!targetUserId,
  });

  useEffect(() => {
    const initChat = async () => {
      if (!tokenData?.token || !authUser) return;
      try {
        const client = StreamChat.getInstance(STREAM_API_KEY);
        await client.connectUser(
          { id: authUser._id, name: authUser.fullName, image: authUser.profilePic },
          tokenData.token
        );
        const channelId = [authUser._id, targetUserId].sort().join("-");
        const currChannel = client.channel("messaging", channelId, {
          members: [authUser._id, targetUserId],
        });
        await currChannel.watch();

        const members = currChannel.state.members;
        const other = Object.values(members).find((m) => m.user.id !== authUser._id);
        if (other) setTargetUser(other.user);

        setChatClient(client);
        setChannel(currChannel);
      } catch (err) {
        console.error("Chat init error:", err);
        toast.error("Could not connect to chat. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    initChat();
  }, [tokenData, authUser, targetUserId]);

  const handleVideoCall = () => {
    if (!channel) return;
    const url = `${window.location.origin}/call/${channel.id}`;
    channel.sendMessage({ text: `📹 I've started a video call. Join me here: ${url}` });
    toast.success("Video call link sent!");
  };

  const handleAudioCall = () => {
    if (!channel) return;
    const url = `${window.location.origin}/call/${channel.id}?audioOnly=true`;
    channel.sendMessage({ text: `📞 I've started a voice call. Join me here: ${url}` });
    toast.success("Voice call link sent!");
  };

  const handleClearChat = async () => {
    if (!channel) return;
    if (!window.confirm("Clear all messages in this chat?")) return;
    try {
      await channel.truncate();
      toast.success("Chat cleared!");
    } catch (err) {
      toast.error("Failed to clear chat.");
    }
  };

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    /* Full viewport minus the top navbar (64 px) */
    <div className="whatsapp-chat-container flex flex-col w-full bg-[#efeae2]"
      style={{ height: "calc(100vh - 64px)" }}>

      {/* Fixed custom header — always visible */}
      <ChatHeader
        targetUser={targetUser}
        onVideoCall={handleVideoCall}
        onAudioCall={handleAudioCall}
        onClearChat={handleClearChat}
      />

      {/* Stream chat area fills remaining height */}
      <div className="flex-1 overflow-hidden">
        <Chat client={chatClient}>
          <Channel channel={channel}>
            <Window>
              {/* E2E encryption notice */}
              <div className="whatsapp-info-banner select-none">
                🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
              </div>
              <MessageList />
              <MessageInput focus />
            </Window>
            <Thread />
          </Channel>
        </Chat>
      </div>
    </div>
  );
};

export default ChatPage;
