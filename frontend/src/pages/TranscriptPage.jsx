import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import {
  loadTranscripts,
  deleteTranscript,
  clearAllTranscripts,
} from "../hooks/useSpeechToText";
import {
  ScrollText,
  Trash2,
  Trash,
  BrainCircuit,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Search,
  ArrowLeft,
} from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
function fmtDuration(ms) {
  if (!ms) return "—";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleString([], {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ── Transcript Card ────────────────────────────────────────────────────────
const TranscriptCard = ({ entry, onDelete }) => {
  const [expanded, setExpanded] = useState(false);

  const preview = entry.segments?.slice(0, 3).map((s) => s.text).join(" ") || "";

  return (
    <div className="bg-[#1e2b3a] rounded-2xl overflow-hidden border border-white/5 hover:border-white/10 transition-colors shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 px-5 py-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#00a884]/20 flex items-center justify-center shrink-0 mt-0.5">
            <ScrollText className="w-5 h-5 text-[#00a884]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold text-sm truncate">{entry.title || "Video Call"}</p>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="flex items-center gap-1 text-white/50 text-xs">
                <Clock className="w-3 h-3" />
                {fmtDate(entry.createdAt)}
              </span>
              <span className="text-white/50 text-xs">
                ⏱ {fmtDuration(entry.durationMs)}
              </span>
              <span className="flex items-center gap-1 text-white/50 text-xs">
                <FileText className="w-3 h-3" />
                {entry.wordCount} words
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            to={`/summary?id=${entry.id}`}
            className="flex items-center gap-1.5 bg-[#00a884] hover:bg-[#008069] transition-colors text-white text-xs font-semibold px-3 py-1.5 rounded-full"
          >
            <BrainCircuit className="w-3.5 h-3.5" />
            Summarize
          </Link>
          <button
            onClick={() => onDelete(entry.id)}
            className="p-1.5 rounded-full text-white/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete transcript"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="px-5 pb-3">
        <p className="text-white/50 text-sm leading-relaxed line-clamp-2">{preview || "No transcript text."}</p>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-white/5 text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors text-xs font-medium"
      >
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        {expanded ? "Hide transcript" : `Show full transcript (${entry.segments?.length || 0} segments)`}
      </button>

      {/* Full transcript */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 max-h-72 overflow-y-auto">
          <div className="space-y-2 pt-3">
            {(entry.segments || []).map((seg) => (
              <div key={seg.id} className="flex gap-2.5">
                <span className="text-[#00a884] text-xs font-mono shrink-0 mt-0.5">{seg.timestamp}</span>
                <div>
                  <span className="text-white/60 text-xs font-semibold">{seg.speaker}: </span>
                  <span className="text-white/80 text-xs">{seg.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────
const TranscriptPage = () => {
  const [transcripts, setTranscripts] = useState([]);
  const [search, setSearch] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const reload = useCallback(() => {
    setTranscripts(loadTranscripts());
  }, []);

  useEffect(() => {
    reload();
    // Listen for storage events (in case another tab saves a transcript)
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, [reload]);

  const handleDelete = (id) => {
    deleteTranscript(id);
    reload();
  };

  const handleClearAll = () => {
    clearAllTranscripts();
    setShowConfirmClear(false);
    reload();
  };

  const filtered = transcripts.filter((t) => {
    const q = search.toLowerCase();
    return (
      !q ||
      (t.title || "").toLowerCase().includes(q) ||
      (t.segments || []).some((s) => s.text.toLowerCase().includes(q))
    );
  });

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      {/* Hero Header */}
      <div className="bg-gradient-to-b from-[#1a2d3f] to-[#0d1b2a] px-4 sm:px-8 pt-8 pb-6 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-5 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/20 flex items-center justify-center">
              <ScrollText className="w-6 h-6 text-[#00a884]" />
            </div>
            <h1 className="text-2xl font-bold text-white">Call Transcripts</h1>
          </div>
          <p className="text-white/50 text-sm">
            {transcripts.length > 0
              ? `${transcripts.length} transcript${transcripts.length !== 1 ? "s" : ""} stored locally in your browser`
              : "Transcripts are stored only in your browser — never on our servers"}
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6">
        {transcripts.length > 0 && (
          /* Search + Actions bar */
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type="text"
                placeholder="Search transcripts…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#1e2b3a] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-[#00a884]/60 transition-colors"
              />
            </div>
            <button
              onClick={() => setShowConfirmClear(true)}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
              <Trash className="w-4 h-4" />
              <span className="hidden sm:inline">Clear All</span>
            </button>
          </div>
        )}

        {/* Confirm clear dialog */}
        {showConfirmClear && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="bg-[#1e2b3a] rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl border border-white/10">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
                <Trash className="w-6 h-6 text-red-400" />
              </div>
              <h2 className="text-white text-center font-bold text-lg mb-2">Clear All Transcripts?</h2>
              <p className="text-white/50 text-center text-sm mb-6">
                This will permanently delete all {transcripts.length} stored transcripts. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/70 hover:text-white text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {transcripts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[#1e2b3a] flex items-center justify-center">
              <ScrollText className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-white font-semibold text-lg">No transcripts yet</h2>
            <p className="text-white/40 text-sm text-center max-w-xs">
              Start a video call, enable voice transcription, and your call transcripts will appear here.
            </p>
            <Link to="/" className="mt-2 btn btn-sm bg-[#00a884] hover:bg-[#008069] text-white border-0">
              Go to Calls
            </Link>
          </div>
        )}

        {/* No results from search */}
        {transcripts.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16 text-white/40 text-sm">
            No transcripts match "<span className="text-white/70">{search}</span>"
          </div>
        )}

        {/* Transcript cards */}
        <div className="space-y-4">
          {filtered.map((entry) => (
            <TranscriptCard key={entry.id} entry={entry} onDelete={handleDelete} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default TranscriptPage;
