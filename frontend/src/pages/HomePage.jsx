import { useMutation, useQuery, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, useRef, useCallback } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  sendFriendRequest,
  withdrawFriendRequest,
} from "../lib/api";
import { Link } from "react-router";
import { CheckCircleIcon, MapPinIcon, UserPlusIcon, UsersIcon, SearchIcon, UserMinusIcon } from "lucide-react";

import { capitialize } from "../lib/utils";

import FriendCard, { getLanguageFlag } from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";

const HomePage = () => {
  const queryClient = useQueryClient();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const [pendingUserId, setPendingUserId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const observer = useRef();

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedData, isLoading: loadingUsers, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["users", searchQuery],
    queryFn: ({ pageParam = 1 }) => getRecommendedUsers({ page: pageParam, limit: 6, search: searchQuery }),
    getNextPageParam: (lastPage) => lastPage.page < lastPage.pages ? lastPage.page + 1 : undefined,
  });

  const recommendedUsers = recommendedData?.pages?.flatMap(page => page.users) || [];

  const lastUserElementRef = useCallback(node => {
    if (loadingUsers || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [loadingUsers, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const { data: outgoingFriendReqs } = useQuery({
    queryKey: ["outgoingFriendReqs"],
    queryFn: getOutgoingFriendReqs,
  });

  const { mutate: sendRequestMutation } = useMutation({
    mutationFn: sendFriendRequest,
    onMutate: async (userId) => {
      setOutgoingRequestsIds((prev) => new Set([...prev, userId]));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      setPendingUserId(null);
    },
    onError: (err, userId) => {
      setOutgoingRequestsIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
      setPendingUserId(null);
    },
  });

  const { mutate: withdrawRequestMutation } = useMutation({
    mutationFn: withdrawFriendRequest,
    onMutate: async (userId) => {
      setOutgoingRequestsIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outgoingFriendReqs"] });
      setPendingUserId(null);
    },
    onError: (err, userId) => {
      setOutgoingRequestsIds((prev) => new Set([...prev, userId]));
      setPendingUserId(null);
    },
  });

  useEffect(() => {
    const outgoingIds = new Set();
    if (outgoingFriendReqs && outgoingFriendReqs.length > 0) {
      outgoingFriendReqs.forEach((req) => {
        outgoingIds.add(req.recipient._id);
      });
      setOutgoingRequestsIds(outgoingIds);
    }
  }, [outgoingFriendReqs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto space-y-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Your Friends</h2>
          <Link to="/notifications" className="btn btn-outline btn-sm">
            <UsersIcon className="mr-2 size-4" />
            Friend Requests
          </Link>
        </div>

        {loadingFriends ? (
          <div className="flex justify-center py-12">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : friends.length === 0 ? (
          <NoFriendsFound />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {friends.map((friend) => (
              <FriendCard key={friend._id} friend={friend} />
            ))}
          </div>
        )}

        <section>
          <div className="mb-6 sm:mb-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Meet New Learners</h2>
                <p className="opacity-70">
                  Discover perfect language exchange partners based on your profile
                </p>
              </div>

              <form onSubmit={handleSearch} className="w-full sm:w-auto relative flex items-center">
                <input
                  type="text"
                  placeholder="Search users..."
                  className="input input-bordered w-full sm:w-64 pr-10"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
                <button type="submit" className="absolute right-2 btn btn-ghost btn-circle btn-sm">
                  <SearchIcon className="size-4" />
                </button>
              </form>
            </div>
            {searchQuery && (
              <div className="mt-2 text-sm opacity-70 flex items-center gap-2">
                Showing results for "{searchQuery}"
                <button onClick={handleClearSearch} className="text-primary hover:underline">Clear</button>
              </div>
            )}
          </div>

          {loadingUsers && !recommendedUsers.length ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : recommendedUsers.length === 0 ? (
            <div className="card bg-base-200 p-6 text-center">
              <h3 className="font-semibold text-lg mb-2">No recommendations available</h3>
              <p className="text-base-content opacity-70">
                Check back later for new language partners!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedUsers.map((user, index) => {
                  const hasRequestBeenSent = outgoingRequestsIds.has(user._id);
                  const isPending = pendingUserId === user._id;

                  const handleAction = () => {
                    setPendingUserId(user._id);
                    if (hasRequestBeenSent) {
                      withdrawRequestMutation(user._id);
                    } else {
                      sendRequestMutation(user._id);
                    }
                  };

                  return (
                    <div
                      key={user._id}
                      ref={index === recommendedUsers.length - 1 ? lastUserElementRef : null}
                      className="card bg-base-200 hover:shadow-lg transition-all duration-300"
                    >
                      <div className="card-body p-5 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="avatar size-16 rounded-full">
                            <img src={user.profilePic} alt={user.fullName} />
                          </div>

                          <div>
                            <h3 className="font-semibold text-lg">{user.fullName}</h3>
                            {user.location && (
                              <div className="flex items-center text-xs opacity-70 mt-1">
                                <MapPinIcon className="size-3 mr-1" />
                                {user.location}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Languages with flags */}
                        <div className="flex flex-wrap gap-1.5">
                          <span className="badge badge-secondary">
                            {getLanguageFlag(user.nativeLanguage)}
                            Native: {capitialize(user.nativeLanguage)}
                          </span>
                          <span className="badge badge-outline">
                            {getLanguageFlag(user.learningLanguage)}
                            Learning: {capitialize(user.learningLanguage)}
                          </span>
                        </div>

                        {user.bio && <p className="text-sm opacity-70">{user.bio}</p>}

                        {/* Action button */}
                        <button
                          className={`btn w-full mt-2 ${hasRequestBeenSent ? "btn-outline btn-error" : "btn-primary"} `}
                          onClick={handleAction}
                          disabled={isPending}
                        >
                          {hasRequestBeenSent ? (
                            isPending ? (
                              <>
                                <span className="loading loading-spinner size-4 mr-2" />
                                Withdrawing...
                              </>
                            ) : (
                              <>
                                <UserMinusIcon className="size-4 mr-2" />
                                Withdraw Request
                              </>
                            )
                          ) : (
                            isPending ? (
                              <>
                                <span className="loading loading-spinner size-4 mr-2" />
                                Sending...
                              </>
                            ) : (
                              <>
                                <UserPlusIcon className="size-4 mr-2" />
                                Send Friend Request
                              </>
                            )
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {isFetchingNextPage && (
                <div className="flex justify-center py-6 mt-4">
                  <span className="loading loading-spinner loading-md" />
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
