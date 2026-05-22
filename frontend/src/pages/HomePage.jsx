import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getOutgoingFriendReqs,
  getRecommendedUsers,
  getUserFriends,
  sendFriendRequest,
  withdrawFriendRequest,
} from "../lib/api";
import { Link } from "react-router";
import {
  MapPinIcon,
  UserPlusIcon,
  UsersIcon,
  SearchIcon,
  UserMinusIcon,
  SlidersHorizontal,
  X,
  Globe,
  Languages,
  RotateCcw
} from "lucide-react";

import { capitialize } from "../lib/utils";
import { LANGUAGES } from "../constants";

import FriendCard, { getLanguageFlag } from "../components/FriendCard";
import NoFriendsFound from "../components/NoFriendsFound";

const HomePage = () => {
  const queryClient = useQueryClient();
  const [outgoingRequestsIds, setOutgoingRequestsIds] = useState(new Set());
  const [pendingUserId, setPendingUserId] = useState(null);
  
  // Search & Filter States
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  
  const [locationInput, setLocationInput] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  
  const [nativeLanguage, setNativeLanguage] = useState("");
  const [learningLanguage, setLearningLanguage] = useState("");
  
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage, setUsersPerPage] = useState(6);

  const { data: friends = [], isLoading: loadingFriends } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const { data: recommendedData, isLoading: loadingUsers, isPlaceholderData } = useQuery({
    queryKey: ["users", searchQuery, nativeLanguage, learningLanguage, locationQuery, currentPage, usersPerPage],
    queryFn: () => getRecommendedUsers({
      page: currentPage,
      limit: usersPerPage,
      search: searchQuery,
      nativeLanguage,
      learningLanguage,
      location: locationQuery
    }),
    placeholderData: keepPreviousData,
  });

  const recommendedUsers = recommendedData?.users || [];
  const totalPages = recommendedData?.pages || 1;
  const totalUsers = recommendedData?.total || 0;

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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setLocationQuery(locationInput);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchInput("");
    setSearchQuery("");
    setLocationInput("");
    setLocationQuery("");
    setNativeLanguage("");
    setLearningLanguage("");
    setCurrentPage(1);
  };

  const activeFiltersCount = [
    searchQuery,
    locationQuery,
    nativeLanguage,
    learningLanguage
  ].filter(Boolean).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 bg-base-100/50 min-h-screen">
      <div className="container mx-auto space-y-10 max-w-7xl">
        {/* HEADER SECTION */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-base-200 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary">
              Dashboard
            </h1>
            <p className="text-sm opacity-70 mt-1">Manage your connections and discover global language partners.</p>
          </div>
          <Link to="/notifications" className="btn btn-primary shadow-lg shadow-primary/20 btn-sm gap-2">
            <UsersIcon className="size-4" />
            Friend Requests
          </Link>
        </div>

        {/* MY FRIENDS LIST */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-secondary/15 flex items-center justify-center text-secondary">
              <UsersIcon className="size-5" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight">Your Friends</h2>
            <span className="badge badge-secondary badge-sm font-semibold">{friends.length}</span>
          </div>

          {loadingFriends ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : friends.length === 0 ? (
            <NoFriendsFound />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {friends.map((friend) => (
                <FriendCard key={friend._id} friend={friend} />
              ))}
            </div>
          )}
        </section>

        {/* MEET NEW LEARNERS */}
        <section className="space-y-6 pt-6 border-t border-base-200">
          {/* SEARCH & FILTERS HEADER */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                  <Globe className="size-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">Meet New Learners</h2>
              </div>
              <p className="text-sm opacity-70 mt-1">
                Discover perfect language exchange partners based on your interests and location.
              </p>
            </div>

            {/* Filter Toggle Action */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`btn btn-sm gap-2 ${showFilters || activeFiltersCount > 0 ? "btn-primary" : "btn-outline"}`}
              >
                <SlidersHorizontal className="size-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <span className="badge badge-sm badge-secondary font-bold">{activeFiltersCount}</span>
                )}
              </button>
              {activeFiltersCount > 0 && (
                <button onClick={handleClearFilters} className="btn btn-sm btn-ghost gap-1.5 text-error">
                  <RotateCcw className="size-3.5" />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* FILTERS PANEL */}
          {(showFilters || activeFiltersCount > 0) && (
            <div className="card bg-base-200/50 backdrop-blur-md border border-base-300 shadow-xl overflow-hidden transition-all duration-300">
              <form onSubmit={handleSearchSubmit} className="card-body p-5 md:p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Name/Email search */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider opacity-70">Search Name/Email</span>
                    </label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50" />
                      <input
                        type="text"
                        placeholder="e.g. John Doe"
                        className="input input-bordered w-full pl-9 input-sm bg-base-100"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Native Language Select */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider opacity-70">Native Language</span>
                    </label>
                    <div className="relative">
                      <Languages className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 z-10" />
                      <select
                        className="select select-bordered w-full pl-9 select-sm bg-base-100"
                        value={nativeLanguage}
                        onChange={(e) => {
                          setNativeLanguage(e.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">All Languages</option>
                        {LANGUAGES.map((lang) => (
                          <option key={`native-${lang}`} value={lang.toLowerCase()}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Learning Language Select */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider opacity-70">Learning Language</span>
                    </label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50 z-10" />
                      <select
                        className="select select-bordered w-full pl-9 select-sm bg-base-100"
                        value={learningLanguage}
                        onChange={(e) => {
                          setLearningLanguage(e.target.value);
                          setCurrentPage(1);
                        }}
                      >
                        <option value="">All Languages</option>
                        {LANGUAGES.map((lang) => (
                          <option key={`learning-${lang}`} value={lang.toLowerCase()}>{lang}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Location search */}
                  <div className="form-control">
                    <label className="label py-1">
                      <span className="label-text text-xs font-semibold uppercase tracking-wider opacity-70">Country/Location</span>
                    </label>
                    <div className="relative">
                      <MapPinIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 opacity-50" />
                      <input
                        type="text"
                        placeholder="e.g. USA, Spain"
                        className="input input-bordered w-full pl-9 input-sm bg-base-100"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                {/* Filter Buttons */}
                <div className="flex justify-end gap-2 pt-2">
                  <button type="submit" className="btn btn-primary btn-sm px-6">
                    Apply Search
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* ACTIVE FILTERS LIST */}
          {activeFiltersCount > 0 && (
            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-xs opacity-75">Active Filters:</span>
              {searchQuery && (
                <div className="badge badge-neutral gap-1.5 p-3 text-xs">
                  Name: "{searchQuery}"
                  <X className="size-3.5 cursor-pointer" onClick={() => { setSearchInput(""); setSearchQuery(""); }} />
                </div>
              )}
              {nativeLanguage && (
                <div className="badge badge-neutral gap-1.5 p-3 text-xs">
                  Native: {capitialize(nativeLanguage)}
                  <X className="size-3.5 cursor-pointer" onClick={() => setNativeLanguage("")} />
                </div>
              )}
              {learningLanguage && (
                <div className="badge badge-neutral gap-1.5 p-3 text-xs">
                  Learning: {capitialize(learningLanguage)}
                  <X className="size-3.5 cursor-pointer" onClick={() => setLearningLanguage("")} />
                </div>
              )}
              {locationQuery && (
                <div className="badge badge-neutral gap-1.5 p-3 text-xs">
                  Location: "{locationQuery}"
                  <X className="size-3.5 cursor-pointer" onClick={() => { setLocationInput(""); setLocationQuery(""); }} />
                </div>
              )}
            </div>
          )}

          {/* USERS LISTING */}
          {loadingUsers && !recommendedUsers.length ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg text-primary" />
            </div>
          ) : recommendedUsers.length === 0 ? (
            <div className="card bg-base-200/30 border border-base-300 p-8 text-center shadow-inner">
              <Globe className="size-12 opacity-30 mx-auto mb-4" />
              <h3 className="font-bold text-xl mb-1">No learners found</h3>
              <p className="text-sm opacity-70 max-w-md mx-auto">
                No users match your criteria. Try adjusting your search query or removing some filters!
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedUsers.map((user) => {
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
                      className="card bg-base-200 border border-base-300 hover:-translate-y-1 hover:shadow-xl hover:border-primary/20 transition-all duration-300 group"
                    >
                      <div className="card-body p-6 space-y-4">
                        {/* USER DETAILS */}
                        <div className="flex items-center gap-4">
                          <div className="avatar size-16">
                            <div className="size-16 rounded-full overflow-hidden ring-2 ring-primary/20 ring-offset-base-100 ring-offset-2 transition-all duration-300 group-hover:ring-primary">
                              <img src={user.profilePic} alt={user.fullName} className="w-full h-full object-cover" />
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-lg truncate group-hover:text-primary transition-colors duration-200">
                              {user.fullName}
                            </h3>
                            {user.location && (
                              <div className="flex items-center text-xs opacity-70 mt-1">
                                <MapPinIcon className="size-3 mr-1 text-primary" />
                                <span className="truncate">{user.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Languages with flags */}
                        <div className="flex flex-wrap gap-2">
                          <span className="badge badge-secondary gap-1 p-2.5 font-medium text-xs">
                            {getLanguageFlag(user.nativeLanguage)}
                            Native: {capitialize(user.nativeLanguage)}
                          </span>
                          <span className="badge badge-outline gap-1 p-2.5 font-medium text-xs">
                            {getLanguageFlag(user.learningLanguage)}
                            Learning: {capitialize(user.learningLanguage)}
                          </span>
                        </div>

                        {/* BIO */}
                        {user.bio ? (
                          <p className="text-sm opacity-85 leading-relaxed line-clamp-3 min-h-[4.5rem]">
                            {user.bio}
                          </p>
                        ) : (
                          <p className="text-sm italic opacity-40 min-h-[4.5rem]">No bio provided.</p>
                        )}

                        {/* Action button */}
                        <button
                          className={`btn w-full mt-2 transition-all duration-300 ${
                            hasRequestBeenSent
                              ? "btn-outline btn-error hover:bg-error hover:text-white"
                              : "btn-primary hover:scale-[1.02]"
                          } `}
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

              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-10 pt-6 border-t border-base-300">
                <div className="text-sm opacity-70">
                  Showing <span className="font-medium text-primary">{totalUsers === 0 ? 0 : ((currentPage - 1) * usersPerPage) + 1}</span> to{" "}
                  <span className="font-medium text-primary">
                    {Math.min(currentPage * usersPerPage, totalUsers)}
                  </span>{" "}
                  of <span className="font-medium text-primary">{totalUsers}</span> learners
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  {/* Users per page selector */}
                  <div className="flex items-center gap-2 text-sm">
                    <span className="opacity-70">Per page:</span>
                    <select
                      className="select select-bordered select-sm"
                      value={usersPerPage}
                      onChange={(e) => {
                        setUsersPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                    >
                      <option value={6}>6</option>
                      <option value={12}>12</option>
                      <option value={24}>24</option>
                      <option value={48}>48</option>
                    </select>
                  </div>

                  <div className="join">
                    <button
                      className="join-item btn btn-sm btn-outline"
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1 || isPlaceholderData}
                    >
                      « Prev
                    </button>
                    
                    {/* Generate page buttons */}
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => {
                        // show first, last, current, and adjacent pages
                        return (
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - currentPage) <= 1
                        );
                      })
                      .map((p, idx, arr) => {
                        const showEllipsis = idx > 0 && p - arr[idx - 1] > 1;
                        return (
                          <div key={p} className="flex">
                            {showEllipsis && <button className="join-item btn btn-sm btn-disabled">...</button>}
                            <button
                              className={`join-item btn btn-sm ${
                                currentPage === p ? "btn-primary shadow-md" : "btn-outline"
                              }`}
                              onClick={() => setCurrentPage(p)}
                              disabled={isPlaceholderData}
                            >
                              {p}
                            </button>
                          </div>
                        );
                      })}

                    <button
                      className="join-item btn btn-sm btn-outline"
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages || isPlaceholderData}
                    >
                      Next »
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default HomePage;
