import { Link } from "react-router";
import { LANGUAGE_TO_FLAG } from "../constants";
import InitialAvatar from "./InitialAvatar";

const FriendCard = ({ friend }) => {
  return (
    <div className="card bg-base-200 hover:shadow-md transition-shadow">
      <div className="card-body p-4 space-y-3">

        {/* Avatar + Name */}
        <div className="flex items-center gap-3">
        {/* Avatar — colored initials if no photo, just like WhatsApp */}
          <div className="shrink-0">
            <InitialAvatar
              src={friend.profilePic}
              name={friend.fullName}
              size="12"
            />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold truncate text-base leading-tight">
              {friend.fullName}
            </h3>
            <p className="text-xs text-base-content/60 mt-0.5 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-success inline-block shrink-0" />
              Online
            </p>
          </div>
        </div>

        {/* Language badges */}
        <div className="flex flex-wrap gap-1.5">
          <span className="badge badge-secondary text-xs py-1 px-2">
            {getLanguageFlag(friend.nativeLanguage)}
            Native: {friend.nativeLanguage}
          </span>
          <span className="badge badge-outline text-xs py-1 px-2">
            {getLanguageFlag(friend.learningLanguage)}
            Learning: {friend.learningLanguage}
          </span>
        </div>

        {/* Actions */}
        <Link
          to={`/chat/${friend._id}`}
          className="btn btn-primary btn-sm w-full flex items-center gap-2"
        >
          {/* chat bubble icon */}
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd"
              d="M4.804 21.644A6.707 6.707 0 0 0 6 21.75a6.721 6.721 0 0 0 3.583-1.029c.774.182 1.584.279 2.417.279 5.322 0 9.75-3.97 9.75-9 0-5.03-4.428-9-9.75-9s-9.75 3.97-9.75 9c0 2.409 1.025 4.587 2.674 6.192.232.226.277.428.254.543a3.73 3.73 0 0 1-.814 1.686.75.75 0 0 0 .44 1.223ZM8.25 10.875a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25ZM10.875 12a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Zm4.875-1.125a1.125 1.125 0 1 0 0 2.25 1.125 1.125 0 0 0 0-2.25Z"
              clipRule="evenodd" />
          </svg>
          Message
        </Link>
      </div>
    </div>
  );
};

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
