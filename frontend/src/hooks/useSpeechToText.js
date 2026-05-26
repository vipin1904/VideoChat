/**
 * useSpeechToText — browser-native voice-to-text hook
 * Uses Web Speech API (SpeechRecognition) — zero server cost, zero dependencies.
 * Works on Chrome, Edge, and Safari desktop.
 */
import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "call_transcripts";

// ── localStorage helpers ───────────────────────────────────────────────────
export function loadTranscripts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveTranscript(entry) {
  const existing = loadTranscripts();
  existing.unshift(entry); // most-recent first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteTranscript(id) {
  const existing = loadTranscripts().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function clearAllTranscripts() {
  localStorage.removeItem(STORAGE_KEY);
}

// ── Hook ───────────────────────────────────────────────────────────────────
export function useSpeechToText({ callId, participantName }) {
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = Boolean(SpeechRecognition);

  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [segments, setSegments] = useState([]); // { id, text, timestamp, speaker }
  const [interimText, setInterimText] = useState("");
  const [startTime, setStartTime] = useState(null);

  // Build a fresh recognition instance
  const createRecognition = useCallback(() => {
    if (!SpeechRecognition) return null;
    const rec = new SpeechRecognition();
    rec.continuous      = true;
    rec.interimResults  = true;
    rec.lang            = "en-US";
    rec.maxAlternatives = 1;
    return rec;
  }, [SpeechRecognition]);

  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;

    const rec = createRecognition();
    if (!rec) return;

    rec.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            setSegments((prev) => [
              ...prev,
              {
                id:        `${Date.now()}-${Math.random()}`,
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
                speaker:   participantName || "You",
              },
            ]);
            setInterimText("");
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (e) => {
      if (e.error === "no-speech") return; // ignore silence
      if (e.error === "aborted")   return;
      console.warn("SpeechRecognition error:", e.error);
    };

    rec.onend = () => {
      // Auto-restart if still supposed to be listening (Chrome stops after silence)
      if (recognitionRef.current && isListening) {
        try { recognitionRef.current.start(); } catch (_) {}
      }
    };

    recognitionRef.current = rec;
    rec.start();
    setIsListening(true);
    setStartTime(Date.now());
  }, [isSupported, isListening, createRecognition, participantName]);

  const stopListening = useCallback(() => {
    if (!isListening) return;
    setIsListening(false);
    setInterimText("");
    try { recognitionRef.current?.stop(); } catch (_) {}
    recognitionRef.current = null;
  }, [isListening]);

  /**
   * Persist the current transcript to localStorage and return the saved entry.
   */
  const persistTranscript = useCallback(
    (callTitle = "Video Call") => {
      if (segments.length === 0) return null;

      const entry = {
        id:        callId || `call-${Date.now()}`,
        title:     callTitle,
        createdAt: new Date().toISOString(),
        durationMs: startTime ? Date.now() - startTime : 0,
        wordCount: segments.reduce((acc, s) => acc + s.text.split(" ").length, 0),
        segments,
      };

      saveTranscript(entry);
      return entry;
    },
    [segments, callId, startTime]
  );

  const clearTranscript = useCallback(() => {
    setSegments([]);
    setInterimText("");
    setStartTime(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch (_) {}
    };
  }, []);

  const fullText = segments.map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join("\n");

  return {
    isSupported,
    isListening,
    segments,
    interimText,
    fullText,
    startListening,
    stopListening,
    persistTranscript,
    clearTranscript,
  };
}
