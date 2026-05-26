import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { useQuery } from "@tanstack/react-query";
import { getStreamToken, getUserFriends } from "../lib/api";
import { useSpeechToText } from "../hooks/useSpeechToText";

import {
  StreamVideo,
  StreamVideoClient,
  StreamCall,
  StreamTheme,
  CallingState,
  useCallStateHooks,
  useCall,
  ParticipantView,
  hasScreenShare,
} from "@stream-io/video-react-sdk";

import "@stream-io/video-react-sdk/dist/css/styles.css";
import toast from "react-hot-toast";
import PageLoader from "../components/PageLoader";
import InitialAvatar from "../components/InitialAvatar";
import { colorFromName } from "../components/InitialAvatar";

const STREAM_API_KEY = import.meta.env.VITE_STREAM_API_KEY;

/* ════════════════════════════════════════════════
   Invite Modal — send call link to more friends
   ════════════════════════════════════════════════ */
const InviteModal = ({ callId, onClose }) => {
  const { data: friends = [] } = useQuery({
    queryKey: ["friends"],
    queryFn: getUserFriends,
  });

  const [sent, setSent] = useState(new Set());

  const sendInvite = (friend) => {
    const callUrl = `${window.location.origin}/call/${callId}`;
    navigator.clipboard
      .writeText(callUrl)
      .catch(() => {});
    toast.success(`Call link copied! Share it with ${friend.fullName}`);
    setSent((s) => new Set([...s, friend._id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#1e2b3a] rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm max-h-[70vh] flex flex-col overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-white font-semibold text-base">Add to Call</h3>
          <button onClick={onClose}
            className="text-white/60 hover:text-white transition-colors text-xl leading-none">✕</button>
        </div>

        {/* Copy link row */}
        <div className="px-5 py-3 border-b border-white/10">
          <button
            onClick={() => {
              navigator.clipboard.writeText(`${window.location.origin}/call/${callId}`);
              toast.success("Call link copied to clipboard!");
            }}
            className="flex items-center gap-3 w-full text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                strokeWidth={2} stroke="white" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
              </svg>
            </div>
            <div>
              <p className="text-white text-sm font-medium group-hover:text-[#00a884] transition-colors">Copy call link</p>
              <p className="text-white/50 text-xs">Share with anyone</p>
            </div>
          </button>
        </div>

        {/* Friends list */}
        <div className="overflow-y-auto flex-1">
          {friends.length === 0 ? (
            <p className="text-white/50 text-sm text-center py-8">No friends to invite</p>
          ) : (
            friends.map((f) => (
              <div key={f._id}
                className="flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors">
                <InitialAvatar src={f.profilePic} name={f.fullName} size="10" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{f.fullName}</p>
                  <p className="text-white/50 text-xs">Tap to send call link</p>
                </div>
                <button
                  onClick={() => sendInvite(f)}
                  className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-semibold transition-all ${
                    sent.has(f._id)
                      ? "bg-white/10 text-white/40"
                      : "bg-[#00a884] hover:bg-[#008069] text-white"
                  }`}
                >
                  {sent.has(f._id) ? "Link Copied" : "Invite"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

/* ════════════════════════════════════════════════
   Recording hook
   ════════════════════════════════════════════════ */
function useCallRecorder() {
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl]     = useState(null);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);

  const startRecording = async () => {
    try {
      // Capture entire tab/screen (includes both video feeds)
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "browser" },
        audio: true,
        preferCurrentTab: true,
      });

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
          ? "video/webm;codecs=vp9"
          : "video/webm",
      });

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        const url  = URL.createObjectURL(blob);
        setBlobUrl(url);
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        toast.success("Recording saved! Click the download button to save.");
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
      toast.success("Recording started");
    } catch (err) {
      if (err.name !== "NotAllowedError") {
        toast.error("Could not start recording");
      }
    }
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const downloadRecording = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = `call-recording-${Date.now()}.webm`;
    a.click();
    setBlobUrl(null);
  };

  return { recording, blobUrl, startRecording, stopRecording, downloadRecording };
}

/* ════════════════════════════════════════════════
   Main WhatsApp-style call UI
   ════════════════════════════════════════════════ */
const WACallUI = ({ audioOnly, callId }) => {
  const { useCallCallingState, useLocalParticipant, useRemoteParticipants, useScreenShareState } = useCallStateHooks();
  const callingState    = useCallCallingState();
  const call            = useCall();
  const navigate        = useNavigate();

  const localParticipant   = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const { status: screenShareStatus } = useScreenShareState();
  const isSharingScreen = screenShareStatus === "enabled";

  const [micOn,           setMicOn]           = useState(true);
  const [camOn,           setCamOn]           = useState(!audioOnly);
  const [speakerOn,       setSpeakerOn]       = useState(true);
  const [elapsed,         setElapsed]         = useState(0);
  const [showInvite,      setShowInvite]      = useState(false);
  const [showTranscript,  setShowTranscript]  = useState(false);

  const { recording, blobUrl, startRecording, stopRecording, downloadRecording } = useCallRecorder();

  // ── Voice-to-text (browser SpeechRecognition, zero server cost) ──────────
  const localName = useAuthUser().authUser?.fullName || "You";
  const stt = useSpeechToText({ callId, participantName: localName });

  // Call timer
  useEffect(() => {
    if (callingState !== CallingState.JOINED) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [callingState]);

  // Redirect when call ends — auto-save transcript first
  useEffect(() => {
    if (callingState === CallingState.LEFT) {
      if (stt.isListening) stt.stopListening();
      if (stt.segments.length > 0) {
        stt.persistTranscript(
          remoteParticipants[0]
            ? `Call with ${remoteParticipants[0].name}`
            : "Video Call"
        );
      }
      navigate("/");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callingState]);

  const fmt = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const toggleMic = async () => {
    try {
      micOn ? await call.microphone.disable() : await call.microphone.enable();
      setMicOn((v) => !v);
    } catch (_) {}
  };

  const toggleCam = async () => {
    if (audioOnly) return;
    try {
      camOn ? await call.camera.disable() : await call.camera.enable();
      setCamOn((v) => !v);
    } catch (_) {}
  };

  const toggleScreenShare = async () => {
    if (audioOnly) return;
    try {
      await call.screenShare.toggle();
    } catch (err) {
      toast.error("Screen sharing failed or cancelled");
    }
  };

  const endCall = async () => {
    if (recording) stopRecording();
    if (stt.isListening) stt.stopListening();
    // Save transcript before leaving
    if (stt.segments.length > 0) {
      stt.persistTranscript(
        remoteParticipants[0]
          ? `Call with ${remoteParticipants[0].name}`
          : "Video Call"
      );
    }
    try { await call.leave(); } catch (_) {}
    navigate("/");
  };

  // Summarize: save transcript + navigate to summary page
  const handleSummarize = () => {
    if (stt.isListening) stt.stopListening();
    const saved = stt.persistTranscript(
      remoteParticipants[0]
        ? `Call with ${remoteParticipants[0].name}`
        : "Video Call"
    );
    if (saved) {
      navigate(`/summary?id=${saved.id}`);
    } else {
      toast.error("No transcript available. Enable voice transcription first.");
    }
  };

  // Multi-participant grid layout
  const hasMultiple = remoteParticipants.length > 1;

  // Active Screen Share Participant Detection
  const remoteScreenShareParticipant = remoteParticipants.find(p => hasScreenShare(p));
  const isLocalScreenSharing = localParticipant ? hasScreenShare(localParticipant) : false;
  const activeScreenShareParticipant = remoteScreenShareParticipant || (isLocalScreenSharing ? localParticipant : null);

  return (
    <StreamTheme>
      <div className="wa-call-root fixed inset-0 bg-black flex flex-col select-none">

        {/* ── Video area ── */}
        <div className="absolute inset-0">
          {remoteParticipants.length === 0 ? (
            /* Waiting screen */
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a2536] gap-5">
              <div className="w-32 h-32 rounded-full bg-[#3949AB] flex items-center justify-center text-white text-5xl font-bold animate-pulse">
                ?
              </div>
              <p className="text-white text-lg font-semibold">Waiting for others…</p>
              <p className="text-white/50 text-sm">Share the call link to invite people</p>
            </div>
          ) : activeScreenShareParticipant ? (
            /* Screen share view (highest priority) */
            <div className="w-full h-full bg-black relative">
              <ParticipantView
                participant={activeScreenShareParticipant}
                trackType="screenShareTrack"
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 rounded px-2.5 py-1 text-white text-xs font-semibold flex items-center gap-1.5 shadow">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00a884" className="w-4 h-4">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path fillRule="evenodd" d="M1.353 21.018a1.5 1.5 0 0 1-.33-1.637C2.261 16.22 5.65 14 9.75 14h4.5c4.1 0 7.489 2.221 8.727 5.381.258.658-.02 1.4-.633 1.637A23.957 23.957 0 0 1 12 22.5c-3.755 0-7.305-.86-10.647-1.482ZM9.75 15.5h4.5a8.23 8.23 0 0 1 5.378 1.986 22.483 22.483 0 0 0-10.756 0 8.23 8.23 0 0 1 5.378-1.986Z" clipRule="evenodd" />
                </svg>
                {activeScreenShareParticipant.sessionId === localParticipant?.sessionId
                  ? "You are sharing your screen"
                  : `${activeScreenShareParticipant.name} is sharing screen`}
              </div>
            </div>
          ) : hasMultiple ? (
            /* Grid for group calls */
            <div className={`w-full h-full grid gap-1 ${
              remoteParticipants.length === 1 ? "grid-cols-1" :
              remoteParticipants.length <= 4 ? "grid-cols-2" : "grid-cols-3"
            }`}>
              {remoteParticipants.map((p) => (
                <div key={p.sessionId} className="relative overflow-hidden bg-[#1a2536]">
                  <ParticipantView
                    participant={p}
                    trackType={hasScreenShare(p) ? "screenShareTrack" : "videoTrack"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 rounded px-2 py-0.5">
                    <span className="text-white text-xs font-medium">{p.name}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : !audioOnly ? (
            /* Single remote — full screen */
            <ParticipantView
              participant={remoteParticipants[0]}
              trackType={hasScreenShare(remoteParticipants[0]) ? "screenShareTrack" : "videoTrack"}
              className="w-full h-full object-cover"
            />
          ) : (
            /* Audio call — avatar */
            <div className="w-full h-full flex flex-col items-center justify-center bg-[#1a2536] gap-4">
              <div
                className="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-white font-bold text-5xl"
                style={{ backgroundColor: colorFromName(remoteParticipants[0]?.name || "") }}
              >
                {remoteParticipants[0]?.name?.[0]?.toUpperCase() || "?"}
              </div>
              <p className="text-white text-xl font-semibold">
                {remoteParticipants[0]?.name || "Unknown"}
              </p>
              <p className="text-white/60 text-sm font-mono">{fmt(elapsed)}</p>
            </div>
          )}
        </div>

        {/* ── Top bar ── */}
        <div className="relative z-10 flex items-center justify-between px-4 pt-10 pb-3 sm:pt-4"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.65), transparent)" }}>
          <div>
            <p className="text-white font-semibold text-sm sm:text-base drop-shadow">
              {remoteParticipants.length > 0
                ? remoteParticipants.length === 1
                  ? remoteParticipants[0]?.name
                  : `${remoteParticipants.length + 1} participants`
                : "Connecting…"}
            </p>
            <p className="text-white/70 text-xs font-mono drop-shadow">
              {callingState === CallingState.JOINED
                ? fmt(elapsed)
                : audioOnly ? "Voice call" : "Video call"}
            </p>
          </div>

          {/* Top-right actions */}
          <div className="flex items-center gap-2">
            {/* Recording indicator */}
            {recording && (
              <div className="flex items-center gap-1.5 bg-red-500/80 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-semibold">REC</span>
              </div>
            )}
            {/* STT (voice transcription) indicator */}
            {stt.isListening && (
              <div className="flex items-center gap-1.5 bg-[#00a884]/80 px-2 py-1 rounded-full">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-white text-xs font-semibold">LIVE</span>
              </div>
            )}
            {/* Download recorded video */}
            {blobUrl && (
              <button onClick={downloadRecording}
                className="bg-green-500/80 hover:bg-green-600 px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-1.5 transition-colors">
                ⬇ Download
              </button>
            )}
            {/* Speaker toggle (audio call) */}
            {audioOnly && (
              <button onClick={() => setSpeakerOn((v) => !v)}
                className="wa-ctrl-btn-sm bg-white/20 hover:bg-white/30" title="Speaker">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                  {speakerOn
                    ? <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM18.584 5.106a.75.75 0 0 1 1.06 0c3.808 3.807 3.808 9.98 0 13.788a.75.75 0 0 1-1.06-1.06 8.25 8.25 0 0 0 0-11.668.75.75 0 0 1 0-1.06Z" />
                    : <path d="M13.5 4.06c0-1.336-1.616-2.005-2.56-1.06l-4.5 4.5H4.508c-1.141 0-2.318.664-2.66 1.905A9.76 9.76 0 0 0 1.5 12c0 .898.121 1.768.35 2.595.341 1.24 1.518 1.905 2.659 1.905h1.93l4.5 4.5c.945.945 2.561.276 2.561-1.06V4.06ZM17.78 9.22a.75.75 0 1 0-1.06 1.06L18.44 12l-1.72 1.72a.75.75 0 1 0 1.06 1.06L19.5 13.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L20.56 12l1.72-1.72a.75.75 0 1 0-1.06-1.06L19.5 10.94l-1.72-1.72Z" />
                  }
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ── Dynamic PIP ── */}
        {!audioOnly && (
          (() => {
            let pipParticipant = null;
            let showPip = false;
            let mirror = false;
            let showCamOffPlaceholder = false;

            if (activeScreenShareParticipant) {
              if (isLocalScreenSharing) {
                pipParticipant = remoteParticipants[0];
                showPip = !!pipParticipant;
                showCamOffPlaceholder = pipParticipant && !pipParticipant.videoEnabled;
              } else {
                pipParticipant = localParticipant;
                showPip = !!pipParticipant;
                mirror = true;
                showCamOffPlaceholder = !camOn;
              }
            } else {
              if (!hasMultiple) {
                pipParticipant = localParticipant;
                showPip = !!pipParticipant;
                mirror = true;
                showCamOffPlaceholder = !camOn;
              }
            }

            if (!showPip || !pipParticipant) return null;

            return (
              <div className="absolute top-16 sm:top-20 right-3 sm:right-4 z-20
                              w-24 h-36 sm:w-32 sm:h-48
                              rounded-2xl overflow-hidden border-2 border-white/30 shadow-2xl">
                <ParticipantView
                  participant={pipParticipant}
                  trackType="videoTrack"
                  className="w-full h-full object-cover"
                  style={mirror ? { transform: "scaleX(-1)" } : undefined}
                />
                {showCamOffPlaceholder && (
                  <div className="absolute inset-0 bg-[#1a2536] flex items-center justify-center">
                    {mirror ? (
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"
                        strokeWidth={1.5} stroke="white" className="w-8 h-8 opacity-40">
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                    ) : (
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white text-base font-bold"
                           style={{ backgroundColor: colorFromName(pipParticipant.name || "") }}>
                        {pipParticipant.name?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* ── Live transcript overlay panel ── */}
        {stt.isSupported && showTranscript && (
          <div className="absolute bottom-40 sm:bottom-36 left-3 right-3 z-30
                          max-h-44 rounded-2xl overflow-hidden
                          bg-black/70 backdrop-blur-md border border-white/10 shadow-2xl
                          flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-[#00a884] text-xs font-semibold">🎙 Live Transcript</span>
                {stt.isListening && (
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00a884] animate-pulse" />
                )}
                <span className="text-white/30 text-[10px]">{stt.segments.length} segments</span>
              </div>
              <button
                onClick={() => setShowTranscript(false)}
                className="text-white/40 hover:text-white text-sm leading-none"
              >✕</button>
            </div>
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-1.5">
              {stt.segments.length === 0 && !stt.interimText && (
                <p className="text-white/30 text-xs italic">
                  {stt.isListening ? "Listening… start speaking" : "Start transcription to see text here"}
                </p>
              )}
              {stt.segments.map((seg) => (
                <div key={seg.id} className="flex gap-2">
                  <span className="text-[#00a884] text-[10px] font-mono shrink-0 mt-0.5">{seg.timestamp}</span>
                  <span className="text-white/80 text-xs leading-relaxed">{seg.text}</span>
                </div>
              ))}
              {stt.interimText && (
                <div className="flex gap-2">
                  <span className="text-[#00a884] text-[10px] font-mono shrink-0 mt-0.5">…</span>
                  <span className="text-white/40 text-xs italic leading-relaxed">{stt.interimText}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Control bar (bottom) ── */}
        <div className="relative z-10 mt-auto px-3 pb-8 sm:pb-6 pt-6"
          style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)" }}>

          {/* Main controls row */}
          <div className="flex items-center justify-center gap-4 sm:gap-6">

            {/* Mute */}
            <button onClick={toggleMic} title={micOn ? "Mute" : "Unmute"}
              className={`wa-ctrl-btn ${micOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                <path d="M8.25 4.5a3.75 3.75 0 1 1 7.5 0v8.25a3.75 3.75 0 1 1-7.5 0V4.5Z" />
                <path d="M6 10.5a.75.75 0 0 1 .75.75v1.5a5.25 5.25 0 1 0 10.5 0v-1.5a.75.75 0 0 1 1.5 0v1.5a6.751 6.751 0 0 1-6 6.709v2.291h3a.75.75 0 0 1 0 1.5h-7.5a.75.75 0 0 1 0-1.5h3v-2.291A6.751 6.751 0 0 1 5.25 12.75v-1.5A.75.75 0 0 1 6 10.5Z" />
                {!micOn && <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>}
              </svg>
            </button>

            {/* Camera toggle */}
            {!audioOnly ? (
              <button onClick={toggleCam} title={camOn ? "Turn off camera" : "Turn on camera"}
                className={`wa-ctrl-btn ${camOn ? "bg-white/20 hover:bg-white/30" : "bg-red-500 hover:bg-red-600"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3V13.5l4.5 4.5V6l-4.5 4.5V7.5a3 3 0 0 0-3-3H4.5Z" />
                  {!camOn && <line x1="2" y1="2" x2="22" y2="22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>}
                </svg>
              </button>
            ) : (
              <div className="wa-ctrl-btn opacity-0 pointer-events-none" />
            )}

            {/* Invite */}
            <button onClick={() => setShowInvite(true)} title="Add people"
              className="wa-ctrl-btn bg-white/20 hover:bg-white/30">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-5 h-5">
                <path d="M6.25 6.375a4.125 4.125 0 1 1 8.25 0 4.125 4.125 0 0 1-8.25 0ZM3.25 19.125a7.125 7.125 0 0 1 14.25 0v.003l-.001.119a.75.75 0 0 1-.363.63 13.067 13.067 0 0 1-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 0 1-.364-.63l-.001-.122ZM19.75 7.5a.75.75 0 0 1 .75.75v2.25h2.25a.75.75 0 0 1 0 1.5h-2.25v2.25a.75.75 0 0 1-1.5 0v-2.25H16.75a.75.75 0 0 1 0-1.5h2.25V8.25a.75.75 0 0 1 .75-.75Z" />
              </svg>
            </button>

            {/* End call */}
            <button onClick={endCall} title="End call"
              className="wa-ctrl-btn bg-red-500 hover:bg-red-600 !w-16 !h-16 shadow-lg shadow-red-500/40">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-7 h-7">
                <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l.547 2.19c.204.814-.006 1.693-.57 2.258L6.22 8.784a16.533 16.533 0 0 0 7.228 7.228l1.416-1.417c.565-.565 1.444-.775 2.259-.57l2.19.547a1.91 1.91 0 0 1 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C6.71 22.5 1.5 17.29 1.5 10.75V4.5Z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Screen Share */}
            {!audioOnly ? (
              <button onClick={toggleScreenShare} title={isSharingScreen ? "Stop sharing screen" : "Share screen"}
                className={`wa-ctrl-btn ${isSharingScreen ? "bg-[#00a884] hover:bg-[#008069]" : "bg-white/20 hover:bg-white/30"}`}>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-6 h-6">
                  <rect x="2" y="3" width="20" height="13" rx="2" />
                  <path d="M12 16v4M8 20h8" />
                  <path d="m10 9 2-2 2 2M12 7v5" />
                </svg>
              </button>
            ) : (
              <div className="wa-ctrl-btn opacity-0 pointer-events-none" />
            )}

            {/* Record */}
            <button
              onClick={recording ? stopRecording : startRecording}
              title={recording ? "Stop recording" : "Record call"}
              className={`wa-ctrl-btn ${recording ? "bg-red-500 hover:bg-red-600 animate-pulse" : "bg-white/20 hover:bg-white/30"}`}
            >
              {recording ? (
                /* Stop icon */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                </svg>
              ) : (
                /* Record icon */
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" className="w-6 h-6">
                  <circle cx="12" cy="12" r="7" />
                </svg>
              )}
            </button>
            {/* Voice Transcript toggle */}
            {stt.isSupported ? (
              <button
                onClick={() => {
                  if (stt.isListening) {
                    stt.stopListening();
                  } else {
                    stt.startListening();
                    setShowTranscript(true);
                  }
                }}
                title={stt.isListening ? "Stop voice transcription" : "Start voice transcription"}
                className={`wa-ctrl-btn ${
                  stt.isListening
                    ? "bg-[#00a884] hover:bg-[#008069] ring-2 ring-[#00a884]/40"
                    : "bg-white/20 hover:bg-white/30"
                }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                  <rect x="9" y="2" width="6" height="11" rx="3" />
                  <path d="M5 10a7 7 0 0 0 14 0M12 19v3M8 22h8" />
                </svg>
              </button>
            ) : (
              <div className="wa-ctrl-btn opacity-0 pointer-events-none" />
            )}

            {/* AI Summarize */}
            <button
              onClick={handleSummarize}
              title="Save & Summarize transcript with AI"
              className="wa-ctrl-btn bg-violet-600 hover:bg-violet-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="w-5 h-5">
                <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
              </svg>
            </button>
          </div>

          {/* Labels */}
          <div className="flex items-center justify-center gap-4 sm:gap-6 mt-1.5">
            {[
              "Mute",
              !audioOnly ? "Camera" : "",
              "Invite",
              "",
              !audioOnly ? "Share" : "",
              "Record",
              stt.isSupported ? "Transcript" : "",
              "AI Recap",
            ].map((label, i) => (
              <span key={i}
                className={`text-white/60 text-[10px] w-14 text-center ${i === 3 ? "w-16" : ""}`}>
                {label}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && <InviteModal callId={callId} onClose={() => setShowInvite(false)} />}
    </StreamTheme>
  );
};

/* ════════════════════════════════════════════════
   CallPage — initialises Stream Video client
   ════════════════════════════════════════════════ */
const CallPage = () => {
  const { id: callId }  = useParams();
  const [searchParams]  = useSearchParams();
  const audioOnly       = searchParams.get("audioOnly") === "true";

  const [client,  setClient]  = useState(null);
  const [call,    setCall]    = useState(null);
  const [isConn,  setIsConn]  = useState(true);

  const { authUser, isLoading } = useAuthUser();

  const { data: tokenData } = useQuery({
    queryKey: ["streamToken"],
    queryFn: getStreamToken,
    enabled: !!authUser,
  });

  useEffect(() => {
    const init = async () => {
      if (!tokenData?.token || !authUser || !callId) return;
      try {
        const vc = new StreamVideoClient({
          apiKey: STREAM_API_KEY,
          user: { id: authUser._id, name: authUser.fullName, image: authUser.profilePic },
          token: tokenData.token,
        });
        const ci = vc.call("default", callId);
        await ci.join({ create: true });
        setClient(vc);
        setCall(ci);
      } catch (err) {
        console.error("Call init error:", err);
        toast.error("Could not join the call. Please try again.");
      } finally {
        setIsConn(false);
      }
    };
    init();
  }, [tokenData, authUser, callId]);

  if (isLoading || isConn) return <PageLoader />;

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
        <WACallUI audioOnly={audioOnly} callId={callId} />
      </StreamCall>
    </StreamVideo>
  );
};

export default CallPage;
