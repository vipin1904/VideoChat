import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  sendFriendRequest,
} from "../lib/api";
import { Link } from "react-router";
import { CheckCircleIcon, MapPinIcon, SearchIcon, UserPlusIcon, UsersIcon, MessageCircleIcon } from "lucide-react";
import { capitialize } from "../lib/utils";
import { getLanguageFlag } from "../components/FriendCard";
import InitialAvatar from "../components/InitialAvatar";
import NoFriendsFound from "../components/NoFriendsFound";

const FriendsPage = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("friends"); // "friends" | "add"

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ["users"],
    queryFn: getRecommendedUsers,
  });

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { mutate: sendRequestMutation, isPending } = useMutation({
    mutationFn: sendFriendRequest,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] }),
  });

  const outgoingIds = new Set((outgoingFriendReqs || []).map((r) => r.recipient._id));

  const filteredFriends = friends.filter((f) =>
    f.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = recommendedUsers.filter((u) =>
    u.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full min-h-screen bg-base-100">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-base-100 border-b border-base-300 px-4 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold tracking-tight">Contacts</h1>
          <button
            onClick={() => setTab(tab === "friends" ? "add" : "friends")}
            className="btn btn-primary btn-sm gap-2"
          >
            {tab === "friends" ? (
              <>
                <UserPlusIcon className="w-4 h-4" />
                Add People
              </>
            ) : (
              <>
                <UsersIcon className="w-4 h-4" />
                My Friends
              </>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div className="relative mb-3">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
          <input
            type="text"
            placeholder={tab === "friends" ? "Search friends…" : "Search people…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input input-bordered w-full pl-9 pr-4 h-10 text-sm rounded-full bg-base-200 border-0 focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Tab pills */}
        <div className="flex gap-4 border-b border-base-300">
          <button
            onClick={() => setTab("friends")}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "friends" ? "border-primary text-primary" : "border-transparent text-base-content/50"
            }`}
          >
            Friends {friends.length > 0 && <span className="ml-1 badge badge-sm badge-primary">{friends.length}</span>}
          </button>
          <button
            onClick={() => setTab("add")}
            className={`pb-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === "add" ? "border-primary text-primary" : "border-transparent text-base-content/50"
            }`}
          >
            Find People
          </button>
        </div>
      </div>

      {/* ── Friends Tab ── */}
      {tab === "friends" && (
        <div className="flex-1 overflow-y-auto">
          {loadingFriends ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : filteredFriends.length === 0 ? (
            search ? (
              <div className="text-center py-16 text-base-content/50 text-sm">
                No friends matching "{search}"
              </div>
            ) : (
              <NoFriendsFound />
            )
          ) : (
            <ul className="divide-y divide-base-200">
              {filteredFriends.map((friend) => (
                <li key={friend._id} className="flex items-center gap-3 px-4 py-3 hover:bg-base-200 transition-colors">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <InitialAvatar src={friend.profilePic} name={friend.fullName} size="12" />
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-success border-2 border-base-100 rounded-full" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{friend.fullName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="badge badge-secondary badge-xs">
                        {getLanguageFlag(friend.nativeLanguage)}
                        {capitialize(friend.nativeLanguage)}
                      </span>
                      <span className="badge badge-outline badge-xs">
                        {getLanguageFlag(friend.learningLanguage)}
                        {capitialize(friend.learningLanguage)}
                      </span>
                    </div>
                  </div>

                  {/* Chat button */}
                  <Link
                    to={`/chat/${friend._id}`}
                    className="btn btn-ghost btn-circle btn-sm text-primary"
                    title="Start chat"
                  >
                    <MessageCircleIcon className="w-5 h-5" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ── Add People Tab ── */}
      {tab === "add" && (
        <div className="flex-1 overflow-y-auto">
          {loadingUsers ? (
            <div className="flex justify-center py-16">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="text-center py-16 text-base-content/50 text-sm">
              {search ? `No users matching "${search}"` : "No new people to add right now!"}
            </div>
          ) : (
            <ul className="divide-y divide-base-200">
              {filteredUsers.map((user) => {
                const sent = outgoingIds.has(user._id);
                return (
                  <li key={user._id} className="flex items-center gap-3 px-4 py-3 hover:bg-base-200 transition-colors">
                    {/* Avatar */}
                    <div className="shrink-0">
                      <InitialAvatar src={user.profilePic} name={user.fullName} size="12" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{user.fullName}</p>
                      {user.location && (
                        <p className="text-xs text-base-content/50 flex items-center gap-1 mt-0.5">
                          <MapPinIcon className="w-3 h-3" /> {user.location}
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span className="badge badge-secondary badge-xs">
                          {getLanguageFlag(user.nativeLanguage)}
                          {capitialize(user.nativeLanguage)}
                        </span>
                        <span className="badge badge-outline badge-xs">
                          {getLanguageFlag(user.learningLanguage)}
                          {capitialize(user.learningLanguage)}
                        </span>
                      </div>
                    </div>

                    {/* Add button */}
                    <button
                      onClick={() => sendRequestMutation(user._id)}
                      disabled={sent || isPending}
                      className={`btn btn-sm shrink-0 ${sent ? "btn-disabled opacity-60" : "btn-primary"}`}
                      title={sent ? "Request sent" : "Add friend"}
                    >
                      {sent ? (
                        <CheckCircleIcon className="w-4 h-4" />
                      ) : (
                        <UserPlusIcon className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline ml-1">{sent ? "Sent" : "Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default FriendsPage;
