import { useEffect, useState } from "react";
import { useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

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
import CallButton from "../components/CallButton";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

// Custom WhatsApp Web Header Component
const WhatsAppHeader = ({ targetUser, handleVideoCall, onClearChat }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-[#202c33] text-[#e9edef] border-b border-[#222e35] h-[60px] w-full z-10 select-none">
      {/* Left: Avatar + Details */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <img
            src={targetUser?.image || "https://avatar.iran.liara.run/public"}
            alt={targetUser?.name || "User"}
            className="w-10 h-10 rounded-full object-cover border border-[#2f3b43]"
          />
          {targetUser?.online && (
            <span className="absolute bottom-0 right-0 w-3 h-3 bg-[#00a884] border-2 border-[#202c33] rounded-full"></span>
          )}
        </div>
        <div>
          <h2 className="font-semibold text-sm leading-tight text-[#e9edef]">
            {targetUser?.name || targetUser?.fullName || "Chat Partner"}
          </h2>
          <p className="text-xs text-[#8696a0] mt-0.5">
            {targetUser?.online ? "online" : "offline"}
          </p>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-4 text-[#aebac1]">
        {/* Video Call */}
        <button
          onClick={handleVideoCall}
          className="hover:text-[#e9edef] transition-colors p-2 rounded-full hover:bg-[#374248]"
          title="Start video call"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-5.5 h-5.5"
          >
            <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3V13.5l4.5 4.5V6l-4.5 4.5V7.5a3 3 0 0 0-3-3H4.5Z" />
          </svg>
        </button>

        {/* Search */}
        <button className="hover:text-[#e9edef] transition-colors p-2 rounded-full hover:bg-[#374248]" title="Search messages">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.602 10.602Z" />
          </svg>
        </button>

        {/* Dropdown Menu */}
        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="hover:text-[#e9edef] transition-colors p-2 rounded-full hover:bg-[#374248]"
            title="Menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 12.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5ZM12 18.75a.75.75 0 1 1 0-1.5.75.75 0 0 1 0 1.5Z" />
            </svg>
          </button>

          {menuOpen && (
            <>
              <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)}></div>
              <div className="absolute right-0 mt-2 w-48 bg-[#233138] rounded-md shadow-lg border border-[#374248] py-1 z-30">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    onClearChat();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm text-[#f87171] hover:bg-[#182229] transition-colors flex items-center gap-2 font-medium"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                  Clear Chat
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatPage = () => {
  const { id: targetUserId } = useParams();

  const [chatClient, setChatClient] = useState(null);
  const [channel, setChannel] = useState(null);
  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const { authUser } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken", targetUserId],
    queryFn: () => getStreamToken(targetUserId),
    enabled: !!authUser && !!targetUserId, // this will run only when authUser and targetUserId are available
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

        // Retrieve chat partner user object for header status and avatar display
        const members = currChannel.state.members;
        const otherMember = Object.values(members).find(m => m.user.id !== authUser._id);
        if (otherMember) {
          setTargetUser(otherMember.user);
        }

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

  const handleVideoCall = () => {
    if (channel) {
      const callUrl = `${window.location.origin}/call/${channel.id}`;

      channel.sendMessage({
        text: `I've started a video call. Join me here: ${callUrl}`,
      });

      toast.success("Video call link sent successfully!");
    }
  };

  const handleClearChat = async () => {
    if (!channel) return;
    const confirmClear = window.confirm("Are you sure you want to clear all messages in this chat?");
    if (!confirmClear) return;

    try {
      // Direct client-to-Stream truncate method prevents any loading on custom servers
      await channel.truncate();
      toast.success("Chat messages cleared!");
    } catch (error) {
      console.error("Error truncating chat:", error);
      toast.error("Failed to clear chat. Please try again.");
    }
  };

  if (loading || !chatClient || !channel) return <ChatLoader />;

  return (
    <div className="whatsapp-chat-container flex h-[93vh] w-full bg-[#0b141a]">
      <Chat client={chatClient}>
        <Channel channel={channel}>
          <div className="flex flex-col flex-1 h-full relative overflow-hidden">
            <WhatsAppHeader
              targetUser={targetUser}
              handleVideoCall={handleVideoCall}
              onClearChat={handleClearChat}
            />
            <Window>
              <div className="whatsapp-info-banner select-none">
                🔒 Messages are end-to-end encrypted. No one outside of this chat can read them.
              </div>
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
