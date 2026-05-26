import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken } from "../lib/api";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  useCall,
  ParticipantView,
  useParticipantViewContext,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ═══════════════════════════════════════════════════════════
   WhatsApp-style Video Call Layout
   ═══════════════════════════════════════════════════════════ */
const WACallUI = ({ audioOnly }) => {
  const { useCallCallingState, useLocalParticipant, useRemoteParticipants } = useCallStateHooks();
  const callingState = useCallCallingState();
  const call = useCall();
  const navigate = useNavigate();

  const localParticipant  = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const remoteParticipant  = remoteParticipants[0];

  const [micOn,    setMicOn]    = useState(true);
  const [camOn,    setCamOn]    = useState(!audioOnly);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [elapsed,  setElapsed]  = useState(0);

  // Call timer
  useEffect(() => {
    if (callingState !== CallingState.JOINED) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callingState]);

  // Redirect when call ends
  useEffect(() => {
    if (callingState === CallingState.LEFT) navigate("/");
  }, [callingState, navigate]);

  const formatTime = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleMic = async () => {
    try {
      if (micOn) await call.microphone.disable();
      else        await call.microphone.enable();
      setMicOn((v) => !v);
    } catch (_) {}
  };

  const toggleCam = async () => {
    if (audioOnly) return;
    try {
      if (camOn) await call.camera.disable();
      else        await call.camera.enable();
      setCamOn((v) => !v);
    } catch (_) {}
  };

  const endCall = async () => {
    try { await call.leave(); } catch (_) {}
    navigate("/");
  };

  const waiting = !remoteParticipant;

  return (
    <StreamTheme>
      <div className="wa-call-root fixed inset-0 bg-black flex flex-col">

        {/* ── Remote (full screen background) ── */}
        <div className="absolute inset-0">
          {remoteParticipant && !audioOnly ? (
            <ParticipantView
              participant={remoteParticipant}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Audio call or waiting: show colored avatar */
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a2536] gap-4">
              <div
                className="w-28 h-28 sm:w-36 sm:h-36 rounded-full flex items-center justify-center text-white font-bold text-4xl sm:text-5xl select-none"
                style={{ backgroundColor: "#3949AB" }}
              >
                {remoteParticipant?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <p className="text-white text-lg sm:text-xl font-semibold">
                {remoteParticipant?.name || "Calling…"}
              </p>
              {waiting ? (
                <p className="text-white/60 text-sm animate-pulse">Waiting for the other person…</p>
              ) : (
                <p className="text-white/70 text-sm font-mono">{formatTime(elapsed)}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Top bar: name + timer ── */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-safe pt-4 pb-2"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)" }}>
          <div>
            <p className="text-white font-semibold text-base sm:text-lg drop-shadow">
              {remoteParticipant?.name || "Connecting…"}
            </p>
            <p className="text-white/70 text-xs font-mono drop-shadow">
              {callingState === CallingState.JOINED ? formatTime(elapsed) : audioOnly ? "Voice call" : "Video call"}
            </p>
          </div>
          {/* Speaker toggle (audio only) */}
          {audioOnly && (
            <button onClick={() => setSpeakerOn((v) => !v)}
              className="wa-ctrl-btn bg-white/20 hover:bg-white/30" title="Speaker">
              {speakerOn ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L19.5 10.94l-1.72-1.72Z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* ── Local PIP (self view) ── */}
        {!audioOnly && localParticipant && (
          <div className="absolute top-16 sm:top-20 right-3 sm:right-4 z-20
                          w-24 h-36 sm:w-32 sm:h-48
                          rounded-2xl overflow-hidden border-2 border-white/30 shadow-xl">
            <ParticipantView
              participant={localParticipant}
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!camOn && (
              <div className="absolute inset-0 bg-[#1a2536] flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                  strokeWidth={1.5} stroke="white" className="w-8 h-8 opacity-50">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                </svg>
              </div>
            )}
          </div>
        )}

        {/* ── Control bar (bottom) ── */}
        <div className="relative z-10 mt-auto px-4 pb-safe pb-6 pt-4"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.70), transparent)" }}>
          <div className="flex items-center justify-center gap-5 sm:gap-8">

            {/* Mute mic */}
            <button onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}
              className={`wa-ctrl-btn ${micOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"}`}>
              {micOn ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                  <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5Z" />
                  <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>

            {/* End call — big red */}
            <button onClick={endCall} title="End call"
              className="wa-ctrl-btn bg-red-500 hover:bg-red-600 w-16 h-16 sm:w-18 sm:h-18 shadow-lg shadow-red-500/40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l.547 2.19c.204.814-.006 1.693-.57 2.258L6.22 8.784a16.533 16.533 0 0 0 7.228 7.228l1.416-1.417c.565-.565 1.444-.775 2.259-.57l2.19.547a1.91 1.91 0 0 1 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C6.71 22.5 1.5 17.29 1.5 10.75V4.5Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Camera toggle */}
            {!audioOnly ? (
              <button onClick={toggleCam} title={camOn ? "Turn off camera" : "Turn on camera"}
                className={`wa-ctrl-btn ${camOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3V13.5l4.5 4.5V6l-4.5 4.5V7.5a3 3 0 0 0-3-3H4.5Z" />
                </svg>
              </button>
            ) : (
              /* Spacer keeps layout symmetric for audio calls */
              <div className="wa-ctrl-btn opacity-0 pointer-events-none" />
            )}
          </div>
        </div>
      </div>
    </StreamTheme>
  );
};

/* ═══════════════════════════════════════════════════════════
   CallPage — initialises Stream Video client
   ═══════════════════════════════════════════════════════════ */
const CallPage = () => {
  const { id: callId } = useParams();
  const [searchParams]  = useSearchParams();
  const audioOnly       = searchParams.get("audioOnly") === "true";

  const [client, setClient]         = useState(null);
  const [call,   setCall]           = useState(null);
  const [isConnecting, setConnecting] = useState(true);

  const { authUser, isLoading } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const initCall = async () => {
      if (!tokenData?.token || !authUser || !callId) return;
      try {
        const videoClient = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: { id: authUser._id, name: authUser.fullName, image: authUser.profilePic },
          token: tokenData.token,
        });
        const callInstance = videoClient.call("default", callId);
        await callInstance.join({ create: true });
        setClient(videoClient);
        setCall(callInstance);
      } catch (err) {
        console.error("Error joining call:", err);
        toast.error("Could not join the call. Please try again.");
      } finally {
        setConnecting(false);
      }
    };
    initCall();
  }, [tokenData, authUser, callId]);

  if (isLoading || isConnecting) return <PageLoader />;

  if (!client || !call) {
    return (
      <div className="fixed inset-0 bg-[#1a2536] flex flex-col items-center justify-center gap-4 text-white">
        <p className="text-lg font-semibold">Could not connect to call</p>
        <button className="btn btn-primary" onClick={() => window.history.back()}>Go Back</button>
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <WACallUI audioOnly={audioOnly} />
      </StreamCall>
    </StreamVideo>
  );
};

export default CallPage;
