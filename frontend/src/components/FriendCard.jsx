import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4">
        {/* USER INFO */}
        <div className="flex items-center gap-3 mb-3">
          <div className="avatar size-12">
            <img src={friend.profilePic} alt={friend.fullName} />
          </div>
          <h3 className="font-semibold truncate">{friend.fullName}</h3>
        </div>

        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="badge badge-secondary text-xs">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Link to={`/chat/${friend._id}`} className="btn btn-outline btn-sm w-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            Message
          </Link>
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
          
          <CallActionButton friendId={friend._id} />
        </div>
      </div>
    </div>
  );
};

import useAuthUser from "../hooks/useAuthUser";

const CallActionButton = ({ friendId }) => {
  const { authUser } = useAuthUser();
  if(!authUser) return null;
  const channelId = [authUser._id, friendId].sort().join("-");
  return (
    <Link to={`/call/${channelId}`} className="btn btn-primary btn-sm w-full shadow-lg shadow-primary/20">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
      Video Call
    </Link>
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
