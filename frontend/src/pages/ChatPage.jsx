import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendChatMessage, getUserFriends } from "../lib/api";
import { getAvatarUrl } from "../lib/utils";
import toast from "react-hot-toast";

import { PhoneIcon, VideoIcon, Trash2Icon, ArrowLeft, Send } from "lucide-react";
import { useCallStore } from "../store/useCallStore";
import { socket } from "../lib/socket";
import { getLanguageFlag } from "../components/FriendCard";
import ChatLoader from "../components/ChatLoader";

const ChatPage = () => {
  const { id: targetUserId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { initiateCall } = useCallStore();
  const { authUser } = useAuthUser();

  const [messageText, setMessageText] = useState("");
  const [messages, setMessages] = useState([]);
  const messagesEndRef = useRef(null);

  // Fetch Friends to display User Details in the Chat Header
  const { data: friends = [], isLoading: isFriendsLoading } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
    enabled: !!authUser,
  });

  const otherUser = friends.find((f) => f._id === targetUserId);

  // Fetch Message History
  const { data: historyMessages = [], isLoading: isMessagesLoading } = useQuery({
    queryKey: ["messages", targetUserId],
    queryFn: () => getMessages(targetUserId),
    enabled: !!authUser && !!targetUserId,
  });

  // Sync React Query history data to state
  useEffect(() => {
    if (historyMessages) {
      setMessages(historyMessages);
    }
  }, [historyMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle Socket.io real-time message events
  useEffect(() => {
    const handleReceiveMessage = (data) => {
      // Append only if it is from the active conversation partner
      if (data.senderId === targetUserId) {
        setMessages((prev) => [...prev, data]);
      }
    };

    socket.on("receiveMessage", handleReceiveMessage);
    return () => {
      socket.off("receiveMessage", handleReceiveMessage);
    };
  }, [targetUserId]);

  const startCall = async (type) => {
    if (!otherUser) {
      toast.error("User details not found");
      return;
    }

    try {
      // Initiate WebRTC call via socket.io signaling
      await initiateCall(targetUserId, otherUser.fullName, type);

      const logText = `📞 Started a ${type} call. Join here.`;

      // Save call invitation notification to chat history
      await sendChatMessage(targetUserId, logText);

      // Emit real-time message to let the other user see the log immediately
      const newMsg = {
        senderId: authUser._id,
        receiverId: targetUserId,
        text: logText,
        createdAt: new Date().toISOString(),
      };
      socket.emit("sendMessage", newMsg);
      setMessages((prev) => [...prev, newMsg]);

      navigate(`/call/${targetUserId}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to start call");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    const textToSend = messageText.trim();
    setMessageText("");

    try {
      // 1. Persist to MongoDB database
      const persistedMsg = await sendChatMessage(targetUserId, textToSend);

      // 2. Emit to socket for real-time delivery
      const socketMsg = {
        _id: persistedMsg._id,
        senderId: authUser._id,
        receiverId: targetUserId,
        text: textToSend,
        createdAt: persistedMsg.createdAt || new Date().toISOString(),
      };
      socket.emit("sendMessage", socketMsg);

      // 3. Update local UI state
      setMessages((prev) => [...prev, socketMsg]);
    } catch (err) {
      console.error("Failed to send message:", err);
      toast.error("Could not send message. Please try again.");
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (isFriendsLoading || isMessagesLoading || !authUser) {
    return <ChatLoader />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-base-100 overflow-hidden">
      {/* 🟢 CUSTOM CHAT HEADER WITH BACK BUTTON */}
      <div className="w-full flex items-center justify-between p-3 bg-base-200 border-b border-base-300 z-10 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Arrow Left Back button linking back to home */}
          <button 
            onClick={() => navigate("/")} 
            className="btn btn-sm btn-circle btn-ghost text-base-content hover:bg-base-300"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          {otherUser ? (
            <>
              <div className="avatar size-10 flex-shrink-0">
                <div className="rounded-full overflow-hidden ring-2 ring-primary/20">
                  <img src={getAvatarUrl(otherUser._id)} alt={otherUser.fullName} className="object-cover w-full h-full" />
                </div>
              </div>
              <div className="min-w-0">
                <h2 className="font-bold text-base truncate leading-tight">{otherUser.fullName}</h2>
                <div className="flex flex-wrap gap-1.5 mt-0.5 items-center">
                  <span className="text-[10px] badge badge-outline p-1.5 opacity-80 flex items-center gap-0.5">
                    {getLanguageFlag(otherUser.nativeLanguage)}
                    Native: {otherUser.nativeLanguage}
                  </span>
                  <span className="text-[10px] badge badge-secondary p-1.5 opacity-80 flex items-center gap-0.5">
                    {getLanguageFlag(otherUser.learningLanguage)}
                    Learning: {otherUser.learningLanguage}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div>
              <h2 className="font-bold text-base">Conversation</h2>
              <p className="text-xs opacity-65">Direct Message</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button 
            onClick={() => startCall("audio")} 
            className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" 
            title="Voice Call"
            disabled={!otherUser}
          >
            <PhoneIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => startCall("video")} 
            className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20" 
            title="Video Call"
            disabled={!otherUser}
          >
            <VideoIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 💬 MESSAGE LIST CHAT BUBBLES AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100/50">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-45 gap-2 text-center px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-semibold">No messages yet</p>
            <p className="text-xs">Say hello to start the conversation!</p>
          </div>
        ) : (
          messages.map((msg, index) => {
            const isMe = msg.senderId === authUser._id;
            return (
              <div key={msg._id || index} className={`chat ${isMe ? "chat-end" : "chat-start"} animate-fade-in`}>
                <div className="chat-image avatar">
                  <div className="w-8 rounded-full border border-base-300">
                    <img src={getAvatarUrl(isMe ? authUser._id : targetUserId)} alt="avatar" />
                  </div>
                </div>
                
                <div className={`chat-bubble shadow-md max-w-xs sm:max-w-md ${isMe ? "chat-bubble-primary text-primary-content" : "bg-base-200 text-base-content border border-base-300"}`}>
                  <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                </div>
                
                <div className="chat-footer opacity-50 text-[10px] mt-1">
                  {formatMessageTime(msg.createdAt)}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ✉️ CUSTOM MESSAGE INPUT COMPOSER */}
      <form onSubmit={handleSendMessage} className="p-3 bg-base-200 border-t border-base-300 flex gap-2 shrink-0 items-center">
        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={otherUser ? `Message ${otherUser.fullName}...` : "Type a message..."}
          className="input input-bordered flex-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-full bg-base-100"
          autoFocus
        />
        <button
          type="submit"
          disabled={!messageText.trim()}
          className="btn btn-circle btn-primary shadow-md hover:scale-105 transition-transform"
          title="Send Message"
        >
          <Send className="w-4 h-4 text-primary-content" />
        </button>
      </form>
    </div>
  );
};

export default ChatPage;
