import { useEffect, useRef, useState } from "react";
import { useSearchParams, Link } from "react-router";
import {
  loadTranscripts,
} from "../hooks/useSpeechToText";
import {
  BrainCircuit,
  Copy,
  CheckCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Loader2,
  ScrollText,
  Lightbulb,
  ListChecks,
  Milestone,
  Smile,
} from "lucide-react";

// ── Puter.js AI summarization ───────────────────────────────────────────────
async function summarizeWithPuter(text) {
  // window.puter is injected by the CDN script in index.html
  if (!window.puter?.ai?.chat) {
    throw new Error(
      "Puter.js is not loaded. Check your internet connection and try again."
    );
  }

  const prompt = `You are an expert meeting summarizer. Analyze the following video call transcript and return a structured JSON summary. Do not include markdown code fences — return raw JSON only.

TRANSCRIPT:
${text}

Return this exact JSON shape:
{
  "keyPoints": ["...", "...", "..."],
  "decisions": ["..."],
  "actionItems": ["..."],
  "tone": "...",
  "oneSentenceSummary": "..."
}`;

  const response = await window.puter.ai.chat(prompt, { model: "gpt-4o-mini" });
  const content = typeof response === "string" ? response : response?.message?.content || JSON.stringify(response);

  // Strip any accidental code fences
  const clean = content.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(clean);
  } catch {
    // If JSON parse fails, return a plain summary
    return {
      keyPoints: [clean],
      decisions: [],
      actionItems: [],
      tone: "Unknown",
      oneSentenceSummary: clean.slice(0, 200),
    };
  }
}

// ── Section Component ───────────────────────────────────────────────────────
const Section = ({ icon: Icon, title, color, items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-white/5 bg-white/3 overflow-hidden">
      <div className={`flex items-center gap-2.5 px-5 py-3.5 border-b border-white/5 bg-${color}-500/10`}>
        <Icon className={`w-4.5 h-4.5 text-${color}-400`} />
        <h3 className={`text-${color}-300 font-semibold text-sm`}>{title}</h3>
      </div>
      <ul className="px-5 py-4 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm text-white/80 leading-relaxed">
            <span className="text-white/30 font-mono shrink-0 mt-0.5">{i + 1}.</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────
const SummaryPage = () => {
  const [searchParams] = useSearchParams();
  const transcriptId   = searchParams.get("id");

  const [transcript, setTranscript] = useState(null);
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(null);
  const [copied, setCopied]         = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [summaryCleared, setSummaryCleared] = useState(false);
  const hasAutoStarted = useRef(false);

  // Load transcript from localStorage
  useEffect(() => {
    if (!transcriptId) return;
    const all = loadTranscripts();
    const found = all.find((t) => t.id === transcriptId);
    setTranscript(found || null);
  }, [transcriptId]);

  // Auto-start summarization when transcript is loaded
  useEffect(() => {
    if (transcript && !hasAutoStarted.current && !summaryCleared) {
      hasAutoStarted.current = true;
      runSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transcript]);

  const runSummary = async () => {
    if (!transcript) return;
    const text = transcript.segments
      .map((s) => `[${s.timestamp}] ${s.speaker}: ${s.text}`)
      .join("\n");

    if (!text.trim()) {
      setError("The transcript is empty — nothing to summarize.");
      return;
    }

    setLoading(true);
    setError(null);
    setSummary(null);
    try {
      const result = await summarizeWithPuter(text);
      setSummary(result);
    } catch (err) {
      setError(err.message || "AI summarization failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!summary) return;
    const text = [
      `📋 Call Summary — ${transcript?.title || "Video Call"}`,
      `\n🔑 Key Points:\n${summary.keyPoints.map((p, i) => `${i + 1}. ${p}`).join("\n")}`,
      summary.decisions?.length ? `\n✅ Decisions:\n${summary.decisions.map((d, i) => `${i + 1}. ${d}`).join("\n")}` : "",
      summary.actionItems?.length ? `\n📌 Action Items:\n${summary.actionItems.map((a, i) => `${i + 1}. ${a}`).join("\n")}` : "",
      `\n💬 Tone: ${summary.tone}`,
      `\n📝 Summary: ${summary.oneSentenceSummary}`,
    ].filter(Boolean).join("");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClearSummary = () => {
    setSummary(null);
    setSummaryCleared(true);
    hasAutoStarted.current = false;
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0d1b2a] flex flex-col items-center justify-center gap-6 text-white">
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-[#1e2b3a] flex items-center justify-center">
            <BrainCircuit className="w-12 h-12 text-[#00a884]" />
          </div>
          <div className="absolute -inset-2 rounded-3xl border-2 border-[#00a884]/30 animate-ping" />
        </div>
        <div className="text-center">
          <p className="text-white font-semibold text-lg mb-1">AI is analyzing your call…</p>
          <p className="text-white/40 text-sm">This usually takes 5–15 seconds</p>
        </div>
        <div className="flex gap-1.5">
          {[0,1,2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#00a884] animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
        <Loader2 className="w-5 h-5 text-white/20 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-[#1a2d3f] to-[#0d1b2a] px-4 sm:px-8 pt-8 pb-6 border-b border-white/5">
        <div className="max-w-3xl mx-auto">
          <Link
            to="/transcripts"
            className="inline-flex items-center gap-2 text-white/50 hover:text-white text-sm mb-5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Transcripts
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-2xl bg-[#00a884]/20 flex items-center justify-center">
              <BrainCircuit className="w-6 h-6 text-[#00a884]" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">AI Call Summary</h1>
              {transcript && (
                <p className="text-white/50 text-sm">
                  {transcript.title || "Video Call"} • {transcript.wordCount} words
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-5">

        {/* Error */}
        {error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 p-5">
            <p className="text-red-300 font-semibold text-sm mb-2">⚠️ Summarization Failed</p>
            <p className="text-red-400/70 text-sm">{error}</p>
            <button
              onClick={runSummary}
              className="mt-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* No transcript found */}
        {!transcript && !loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-[#1e2b3a] flex items-center justify-center">
              <ScrollText className="w-10 h-10 text-white/20" />
            </div>
            <h2 className="text-white font-semibold text-lg">Transcript not found</h2>
            <p className="text-white/40 text-sm text-center max-w-xs">
              This transcript may have been cleared. Go back to transcripts to find another one.
            </p>
            <Link to="/transcripts" className="mt-2 btn btn-sm bg-[#00a884] hover:bg-[#008069] text-white border-0">
              View Transcripts
            </Link>
          </div>
        )}

        {/* Summary cleared / ready to re-run */}
        {transcript && summaryCleared && !summary && !loading && !error && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#1e2b3a] flex items-center justify-center">
              <BrainCircuit className="w-8 h-8 text-[#00a884]" />
            </div>
            <p className="text-white/60 text-sm text-center">Summary cleared. Ready to summarize again.</p>
            <button
              onClick={runSummary}
              className="bg-[#00a884] hover:bg-[#008069] text-white font-semibold text-sm px-6 py-3 rounded-xl transition-colors flex items-center gap-2"
            >
              <BrainCircuit className="w-4 h-4" />
              Summarize Now
            </button>
          </div>
        )}

        {/* Summary output */}
        {summary && (
          <>
            {/* One-sentence summary card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#00a884]/20 to-[#1e2b3a] border border-[#00a884]/20 p-5">
              <p className="text-[#00a884] text-xs font-semibold mb-2 uppercase tracking-wider">Overview</p>
              <p className="text-white text-base leading-relaxed font-medium">{summary.oneSentenceSummary}</p>
              <div className="mt-3 inline-flex items-center gap-1.5 bg-[#1e2b3a] rounded-full px-3 py-1">
                <Smile className="w-3.5 h-3.5 text-yellow-400" />
                <span className="text-yellow-300 text-xs font-medium">Tone: {summary.tone}</span>
              </div>
            </div>

            {/* Structured sections */}
            <Section icon={Lightbulb}   color="yellow" title="Key Points"    items={summary.keyPoints}    />
            <Section icon={ListChecks}  color="green"  title="Decisions Made" items={summary.decisions}   />
            <Section icon={Milestone}   color="blue"   title="Action Items"   items={summary.actionItems} />

            {/* Action buttons */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 bg-[#1e2b3a] hover:bg-[#243447] border border-white/10 text-white text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                {copied ? <CheckCheck className="w-4 h-4 text-[#00a884]" /> : <Copy className="w-4 h-4" />}
                {copied ? "Copied!" : "Copy Summary"}
              </button>
              <button
                onClick={handleClearSummary}
                className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Clear Summary
              </button>
            </div>
          </>
        )}

        {/* Original transcript (collapsible) */}
        {transcript && (
          <div className="rounded-2xl border border-white/5 bg-[#1e2b3a] overflow-hidden">
            <button
              onClick={() => setShowTranscript((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ScrollText className="w-4 h-4 text-white/40" />
                <span className="text-white/60 text-sm font-medium">Original Transcript</span>
                <span className="text-white/30 text-xs">({transcript.segments?.length || 0} segments)</span>
              </div>
              {showTranscript ? (
                <ChevronUp className="w-4 h-4 text-white/30" />
              ) : (
                <ChevronDown className="w-4 h-4 text-white/30" />
              )}
            </button>
            {showTranscript && (
              <div className="px-5 pb-5 max-h-80 overflow-y-auto border-t border-white/5">
                <div className="space-y-2 pt-4">
                  {(transcript.segments || []).map((seg) => (
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
        )}
      </div>
    </div>
  );
};

export default SummaryPage;
