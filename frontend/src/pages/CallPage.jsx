import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getUserFriends } from "../lib/api";
import { StreamChat } from "stream-chat";
import {
  StreamCall,
  CallControls,
  SpeakerLayout,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  useStreamVideoClient,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";
import { UserPlusIcon, CopyIcon } from "lucide-react";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

const CallPage = () => {
  const { id: callId } = useParams();
  const [call, setCall] = useState(null);
  const [isConnecting, setIsConnecting] = useState(true);

  const { authUser, isLoading } = useAuthUser();
  const videoClient = useStreamVideoClient();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    let callInstance;
    
    const initCall = async () => {
      if (!tokenData?.token || !authUser || !callId || !videoClient) return;

      try {
        callInstance = videoClient.call("default", callId);
        await callInstance.join({ create: true });
        setCall(callInstance);
      } catch (error) {
        console.error("Error joining call:", error);
        toast.error("Could not join the call. Please try again.");
      } finally {
        setIsConnecting(false);
      }
    };

    initCall();

    return () => {
      if (callInstance) {
        callInstance.leave().catch(console.error);
      }
    };
  }, [tokenData, authUser, callId, videoClient]);

  if (isLoading || isConnecting) return <PageLoader />;

  return (
    <div className="w-screen h-[100dvh] bg-neutral overflow-hidden flex flex-col relative text-white">
      {videoClient && call ? (
        <StreamCall call={call}>
          <CallContent authUser={authUser} tokenData={tokenData} callId={callId} />
        </StreamCall>
      ) : (
        <div className="flex items-center justify-center h-full text-white/70">
          <p>Could not initialize call. Please refresh or try again later.</p>
        </div>
      )}
    </div>
  );
};

const CallContent = ({ authUser, tokenData, callId }) => {
  const { useCallCallingState } = useCallStateHooks();
  const callingState = useCallCallingState();
  const navigate = useNavigate();

  const [isInviting, setIsInviting] = useState(false);

  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const handleInviteFriend = async (friendId) => {
    setIsInviting(true);
    try {
      const chatClient = StreamChat.getInstance(STREAM_API_KEY);
      
      // Prevent reconnections
      if (!chatClient.userID) {
        await chatClient.connectUser(
          {
            id: authUser._id,
            name: authUser.fullName,
            image: authUser.profilePic,
          },
          tokenData.token
        );
      }

      const channelId = [authUser._id, friendId].sort().join("-");
      const channel = chatClient.channel("messaging", channelId, {
        members: [authUser._id, friendId],
      });

      const callUrl = `${window.location.origin}/call/${callId}`;
      await channel.sendMessage({
        text: `Hey! I've started a group video call. Join me here: ${callUrl}`,
      });

      toast.success("Invite sent successfully via Chat!");
      document.getElementById('invite_modal').close();
    } catch (error) {
      console.error("Error sending invite", error);
      toast.error("Failed to send invite");
    } finally {
      setIsInviting(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/call/${callId}`);
    toast.success("Call link copied!");
  };

  if (callingState === CallingState.LEFT) {
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/");
    return null;
  }

  const handleManualBack = () => {
    if (callId && videoClient) {
      const activeCall = videoClient.call("default", callId);
      activeCall.leave().catch(console.error);
    }
    if (window.history.state && window.history.state.idx > 0) navigate(-1);
    else navigate("/");
  };

  return (
    <StreamTheme className="w-full h-full flex flex-col relative">
      <div className="absolute top-4 left-4 z-[999999]">
        <button 
          className="btn btn-sm btn-circle btn-ghost bg-black/30 backdrop-blur-md text-white hover:bg-black/50 border-none"
          onClick={handleManualBack}
          title="Go Back"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        </button>
      </div>

      <div className="absolute top-4 right-4 z-[999999] flex gap-2">
        <button 
          className="btn btn-sm btn-ghost bg-black/30 backdrop-blur-md text-white hover:bg-black/50 border-none"
          onClick={copyLink}
        >
          <CopyIcon className="w-4 h-4 mr-2" />
          Copy Link
        </button>
        <button 
          className="btn btn-sm btn-primary shadow-lg shadow-primary/30 border-none"
          onClick={() => document.getElementById('invite_modal').showModal()}
        >
          <UserPlusIcon className="w-4 h-4 mr-2" />
          Invite Friends
        </button>
      </div>

      <div className="flex-1 w-full relative h-[calc(100vh-80px)]">
        <SpeakerLayout />
      </div>
      
      <div className="w-full p-4 bg-black/40 backdrop-blur-lg border-t border-white/10 flex justify-center">
        <CallControls />
      </div>

      {/* DaisyUI Invite Modal */}
      <dialog id="invite_modal" className="modal modal-bottom sm:modal-middle text-base-content">
        <div className="modal-box">
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>
          </form>
          <h3 className="font-bold text-lg mb-4">Invite to Group Call</h3>
          <p className="text-sm opacity-70 mb-4">Select a friend to invite them instantly to your room!</p>
          
          <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
            {friends.length === 0 ? (
              <p className="text-center italic opacity-60">No friends to invite.</p>
            ) : (
              friends.map(friend => (
                <div key={friend._id} className="flex items-center justify-between p-3 bg-base-200 rounded-lg">
                  <div className="flex items-center gap-3">
                    <img src={friend.profilePic} className="w-10 h-10 rounded-full" />
                    <span className="font-medium">{friend.fullName}</span>
                  </div>
                  <button 
                    disabled={isInviting}
                    className="btn btn-sm btn-secondary"
                    onClick={(e) => {
                      e.preventDefault();
                      handleInviteFriend(friend._id);
                    }}
                  >
                    Invite
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </StreamTheme>
  );
};

export default CallPage;
