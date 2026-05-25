import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";
import { capitialize, getAvatarUrl } from "../lib/utils";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12">
            <img src={getAvatarUrl(friend._id)} alt={friend.fullName} />
          </div>
          <h3 className="font-semibold truncate">{friend.fullName}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {capitialize(friend.nativeLanguage)}
          </span>
          <span className="badge badge-outline text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {capitialize(friend.learningLanguage)}
          </span>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <div className="flex gap-2">
            <Link to={`/chat/${friend._id}`} className="btn btn-outline btn-sm flex-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Message
            </Link>
            <ClearChatButton friendId={friend._id} />
          </div>
          <button 
            onClick={() => {
              const myId = JSON.parse(localStorage.getItem('chat-user-cache') || '{}')._id; // Fast lookup if available, otherwise just rely on chat page or use window location logic
              // Without authUser hook directly in card, we can link them strictly to chat, but wait! The chat handles video calls. 
              // Better logic: let's add useAuthUser inside the component.
            }}
            className="btn btn-primary btn-sm w-full"
            style={{ display: 'none' }}
          >
            Video Call
          </button>
          
          <CallActionButton friend={friend} />
        </div>
      </div>
    </div>
  );
};

const ClearChatButton = ({ friendId }) => {
  const handleClear = async () => {
    if (window.confirm("Are you sure you want to clear the entire chat history for this user from the database?")) {
      try {
        await clearChatHistory(friendId);
        toast.success("Chat history cleared!");
      } catch (err) {
        console.error("Failed to clear chat:", err);
        toast.error("Could not clear chat history.");
      }
    }
  };

  return (
    <button 
      onClick={handleClear} 
      className="btn btn-outline btn-error btn-sm px-2.5 flex items-center justify-center" 
      title="Clear Chat History"
    >
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
};

import useAuthUser from "../hooks/useAuthUser";
import { useNavigate } from "react-router";
import toast from "react-hot-toast";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, clearChatHistory, sendChatMessage } from "../lib/api";
import { useCallStore } from "../store/useCallStore";
import { socket } from "../lib/socket";

const CallActionButton = ({ friend }) => {
  const { authUser } = useAuthUser();
  const navigate = useNavigate();
  
  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  if(!authUser || !friend) return null;

  const startCall = async (type) => {
    try {
      const roomId = `room-${Math.random().toString(36).substring(2, 11)}`;
      const logText = type === "video" 
        ? `🎥 Join my video call: http://localhost:5173/call/${roomId}?type=video`
        : `📞 Join my voice call: http://localhost:5173/call/${roomId}?type=audio`;

      // Save call invitation notification to chat history
      const persistedMsg = await sendChatMessage(friend._id, logText);

      // Emit real-time message to let the other user see the log immediately
      const newMsg = {
        _id: persistedMsg._id,
        senderId: authUser._id,
        receiverId: friend._id,
        text: logText,
        createdAt: persistedMsg.createdAt || new Date().toISOString(),
      };
      
      if (!socket.connected) {
        socket.connect();
      }
      
      socket.emit("sendMessage", newMsg);

      navigate(`/call/${roomId}?type=${type}`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to start call");
    }
  };

  return (
    <div className="flex gap-2">
      <button 
        onClick={() => startCall('audio')}
        className="btn btn-secondary btn-sm flex-1 shadow-lg shadow-secondary/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
        Voice
      </button>
      <button 
        onClick={() => startCall('video')}
        className="btn btn-primary btn-sm flex-1 shadow-lg shadow-primary/20"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
        Video
      </button>
    </div>
  )
}

export default FriendCard;

export function getLanguageFlag(language) {
  if (!language) return null;

  const langLower = language.toLowerCase();
  const countryCode = LANGUAGE_TO_FLAG[langLower];

  if (countryCode) {
    return (
      <img
        src={`https://flagcdn.com/24x18/${countryCode}.png`}
        alt={`${langLower} flag`}
        className="h-3 mr-1 inline-block"
      />
    );
  }
  return null;
}
