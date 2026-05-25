import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getMessages, sendChatMessage, getUserFriends, clearChatHistory } from "../lib/api";
import { getAvatarUrl } from "../lib/utils";
import toast from "react-hot-toast";

import { PhoneIcon, VideoIcon, Trash2Icon, ArrowLeft, Send, Paperclip, X, Image, FileText, Film } from "lucide-react";
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
  const [selectedFile, setSelectedFile] = useState(null); // { base64, type, name }
  const fileInputRef = useRef(null);
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

  // Handle Socket.io real-time message events (Fully reactive)
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
      const roomId = `room-${Math.random().toString(36).substring(2, 11)}`;
      const logText = type === "video" 
        ? `🎥 Join my video call: http://localhost:5173/call/${roomId}?type=video`
        : `📞 Join my voice call: http://localhost:5173/call/${roomId}?type=audio`;

      // Save call invitation notification to chat history
      const persistedMsg = await sendChatMessage(targetUserId, logText);

      // Emit real-time message to let the other user see the log immediately
      const newMsg = {
        _id: persistedMsg._id,
        senderId: authUser._id,
        receiverId: targetUserId,
        text: logText,
        createdAt: persistedMsg.createdAt || new Date().toISOString(),
      };
      socket.emit("sendMessage", newMsg);
      setMessages((prev) => [...prev, newMsg]);

      navigate(`/call/${roomId}?type=${type}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to start call");
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Check size limit: Let's limit to 10MB to be safe and match the 15MB server limit
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      let type = "file";
      if (file.type.startsWith("image/")) type = "image";
      else if (file.type.startsWith("video/")) type = "video";

      setSelectedFile({
        base64: reader.result,
        type,
        name: file.name,
      });
      toast.success(`Attached ${file.name}`);
    };
    reader.onerror = () => {
      toast.error("Could not read file");
    };
    reader.readAsDataURL(file);

    // Reset input value to allow selecting same file again
    e.target.value = "";
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageText.trim() && !selectedFile) return;

    const textToSend = messageText.trim();
    const fileToSend = selectedFile;

    setMessageText("");
    setSelectedFile(null);

    try {
      // 1. Persist to MongoDB database
      const persistedMsg = await sendChatMessage(
        targetUserId,
        textToSend,
        fileToSend?.base64 || "",
        fileToSend?.type || "",
        fileToSend?.name || ""
      );

      // 2. Emit to socket for real-time delivery
      const socketMsg = {
        _id: persistedMsg._id,
        senderId: authUser._id,
        receiverId: targetUserId,
        text: textToSend,
        file: fileToSend?.base64 || "",
        fileType: fileToSend?.type || "",
        fileName: fileToSend?.name || "",
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

  const handleClearChat = async () => {
    if (!targetUserId) return;
    if (window.confirm("Are you sure you want to clear this entire chat history from the database?")) {
      try {
        await clearChatHistory(targetUserId);
        setMessages([]);
        toast.success("Chat history cleared!");
      } catch (err) {
        console.error("Failed to clear chat:", err);
        toast.error("Could not clear chat history.");
      }
    }
  };

  const formatMessageTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  if (!authUser) {
    return <ChatLoader />;
  }

  return (
    <div className="w-full h-full flex flex-col bg-base-100 overflow-hidden relative">
      {/* 🟢 CUSTOM CHAT HEADER WITH BACK BUTTON */}
      <div className="w-full flex items-center justify-between p-3 bg-base-200 border-b border-base-300 z-10 shrink-0 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          {/* Arrow Left Back button linking back to home (WhatsApp Style) */}
          <button 
            onClick={() => navigate("/")} 
            className="btn btn-sm btn-circle btn-ghost text-base-content hover:bg-base-300/80 transition-all flex items-center justify-center"
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
          ) : isFriendsLoading ? (
            <div className="flex items-center gap-3 animate-pulse">
              <div className="size-10 rounded-full bg-base-300"></div>
              <div className="space-y-1.5">
                <div className="h-4 w-28 bg-base-300 rounded"></div>
                <div className="h-3 w-16 bg-base-300 rounded"></div>
              </div>
            </div>
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
            className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20 hover:scale-105 transition-all" 
            title="Voice Call"
            disabled={!otherUser}
          >
            <PhoneIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={() => startCall("video")} 
            className="btn btn-sm btn-circle btn-ghost text-primary hover:bg-primary/20 hover:scale-105 transition-all" 
            title="Video Call"
            disabled={!otherUser}
          >
            <VideoIcon className="w-5 h-5" />
          </button>
          <button 
            onClick={handleClearChat} 
            className="btn btn-sm btn-circle btn-ghost text-error hover:bg-error/20 hover:scale-105 transition-all" 
            title="Clear Chat History"
            disabled={!otherUser}
          >
            <Trash2Icon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 💬 MESSAGE LIST AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-base-100/50">
        {isMessagesLoading ? (
          <div className="flex flex-col items-center justify-center h-full opacity-65 gap-2.5 text-center px-4">
            <span className="loading loading-spinner loading-md text-primary"></span>
            <p className="text-xs font-semibold uppercase tracking-wider animate-pulse">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-45 gap-2 text-center px-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p className="text-sm font-semibold">No messages yet</p>
            <p className="text-xs">Say hello or share photos, videos, and files!</p>
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
                  
                  {/* Render File Attachments based on fileType */}
                  {msg.file && msg.fileType === "image" && (
                    <div className="mb-2">
                      <img 
                        src={msg.file} 
                        alt={msg.fileName || "Attached Image"} 
                        className="rounded-lg max-w-full sm:max-w-[320px] object-cover border border-base-300/40 shadow-sm cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                        onClick={() => {
                          const newTab = window.open();
                          newTab.document.write(`<img src="${msg.file}" style="max-width:100%; height:auto;" />`);
                        }}
                      />
                    </div>
                  )}

                  {msg.file && msg.fileType === "video" && (
                    <div className="mb-2">
                      <video 
                        src={msg.file} 
                        controls 
                        className="rounded-lg max-w-full sm:max-w-[320px] max-h-[300px] border border-base-300/40 shadow-sm"
                      />
                    </div>
                  )}

                  {msg.file && msg.fileType === "file" && (
                    <div className="mb-2 flex items-center gap-3 p-3 bg-black/10 rounded-xl border border-white/5 max-w-xs shadow-inner">
                      <div className="size-9 rounded-full bg-primary/25 flex items-center justify-center text-primary shrink-0">
                        <FileText className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold truncate text-base-content/95">{msg.fileName}</p>
                        <a href={msg.file} download={msg.fileName} className="text-[10px] text-primary hover:underline font-extrabold mt-0.5 inline-block">Download File</a>
                      </div>
                    </div>
                  )}

                  {msg.text && (
                    msg.text.includes("/call/room-") ? (
                      <div className="flex flex-col gap-3 p-1 min-w-[200px] sm:min-w-[240px]">
                        <div className="flex items-center gap-3">
                          <div className={`size-10 rounded-full flex items-center justify-center ${msg.text.includes("type=video") ? "bg-red-500/20 text-red-500" : "bg-emerald-500/20 text-emerald-500"} shrink-0 shadow-inner`}>
                            {msg.text.includes("type=video") ? <VideoIcon className="size-5" /> : <PhoneIcon className="size-5" />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold truncate text-base-content">{msg.text.includes("type=video") ? "Video Call Invitation" : "Voice Call Invitation"}</p>
                            <p className="text-[10px] opacity-75 truncate text-base-content/85">Join to start talking</p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const match = msg.text.match(/\/call\/(room-[^\s\?]+)/);
                            const typeMatch = msg.text.match(/type=(video|audio)/);
                            if (match) {
                              const roomId = match[1];
                              const type = typeMatch ? typeMatch[1] : "video";
                              navigate(`/call/${roomId}?type=${type}`);
                            }
                          }}
                          className={`btn btn-xs sm:btn-sm w-full rounded-xl border-none shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-white font-extrabold ${msg.text.includes("type=video") ? "bg-red-500 hover:bg-red-600" : "bg-emerald-500 hover:bg-emerald-600"}`}
                        >
                          Join Call
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                    )
                  )}
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

      {/* 🟢 FLOATING ATTACHMENT PREVIEW OVERLAY */}
      {selectedFile && (
        <div className="absolute bottom-[72px] left-4 right-4 z-20 p-3.5 bg-base-300/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-xl flex items-center justify-between animate-fade-in-up">
          <div className="flex items-center gap-3 min-w-0">
            <div className="size-11 rounded-xl bg-primary/20 flex items-center justify-center text-primary shrink-0">
              {selectedFile.type === "image" ? (
                <Image className="size-6" />
              ) : selectedFile.type === "video" ? (
                <Film className="size-6" />
              ) : (
                <FileText className="size-6" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold truncate text-base-content">{selectedFile.name}</p>
              <p className="text-[10px] opacity-60">Ready to send ({selectedFile.type})</p>
            </div>
          </div>
          <button 
            onClick={() => setSelectedFile(null)} 
            className="btn btn-circle btn-xs btn-ghost hover:bg-base-300"
            title="Remove attachment"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {/* ✉️ MESSAGE INPUT COMPOSER WITH PAPERCLIP FILE SELECTOR */}
      <form onSubmit={handleSendMessage} className="p-3 bg-base-200 border-t border-base-300 flex gap-2 shrink-0 items-center">
        {/* Hidden File input supporting photos, videos, and general docs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleFileSelect} 
          accept="image/*,video/*,application/*,text/*" 
        />
        
        {/* Paperclip button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="btn btn-circle btn-ghost text-base-content hover:bg-base-300 hover:scale-105 transition-all"
          title="Share Photo, Video or File"
        >
          <Paperclip className="w-5 h-5 opacity-85" />
        </button>

        <input
          type="text"
          value={messageText}
          onChange={(e) => setMessageText(e.target.value)}
          placeholder={otherUser ? `Message ${otherUser.fullName}...` : "Type a message..."}
          className="input input-bordered flex-1 focus:outline-none focus:ring-1 focus:ring-primary rounded-full bg-base-100 placeholder:opacity-70 text-sm py-2"
          autoFocus
        />
        <button
          type="submit"
          disabled={!messageText.trim() && !selectedFile}
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
