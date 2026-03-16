import { useState, useRef } from "react";

const TOPICS = [
  { label: "AI Agents", value: "AI Agents & Automation" },
  { label: "GenAI Tools", value: "Generative AI Tools" },
  { label: "Disruption", value: "Industry Disruption" },
  { label: "Future of Work", value: "Future of Work" },
  { label: "AI ROI", value: "AI ROI & Business Impact" },
  { label: "Regulation", value: "Regulation & Ethics" },
  { label: "Startups", value: "Startup Ecosystem" },
];

const TONES = ["Thought Leader", "Conversational", "Data-Driven"];

const INDUSTRIES = [
  "AI & Technology", "Ecommerce & Retail", "Digital Marketing",
  "SaaS & Software", "Finance & Fintech", "Healthcare & MedTech",
  "Education & EdTech", "Manufacturing & Automation",
];

const VOICES = [
  { label: "Rajeev Nar – AI Director, RVS Media", value: "Rajeev Nar, Director of RVS Media, a UK-based AI & ecommerce agency" },
  { label: "Senior AI Analyst", value: "a senior AI industry analyst" },
  { label: "AI Startup Founder", value: "a startup founder in the AI space" },
  { label: "Digital Transformation Consultant", value: "a digital transformation consultant" },
];

const LENGTHS = [
  { label: "Concise (600–800 words)", value: "600–800 words" },
  { label: "Standard (900–1200 words)", value: "900–1200 words" },
  { label: "Deep Dive (1500+ words)", value: "1500+ words" },
];

const STEPS = [
  { icon: "🔍", label: "Scanning industry news & signals…" },
  { icon: "🧠", label: "Analysing trends & synthesising insights…" },
  { icon: "✍️", label: "Writing your newsletter article…" },
  { icon: "✅", label: "Formatting & finalising…" },
];

function parseArticle(text) {
  const lines = text.split("\n");
  const elements = [];
  let key = 0;
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.startsWith("# ")) {
      elements.push(<h1 key={key++} style={{ fontFamily: "'Georgia', serif", fontSize: "1.45rem", fontWeight: 800, lineHeight: 1.2, marginBottom: 6, color: "#e8e8f0", letterSpacing: "-0.02em" }}>{line.replace(/^# /, "").replace(/\*\*/g, "")}</h1>);
    } else if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} style={{ fontFamily: "'Georgia', serif", fontSize: "1.05rem", fontWeight: 700, color: "#00e5ff", marginTop: 22, marginBottom: 8, letterSpacing: "-0.01em" }}>{line.replace(/^## /, "").replace(/\*\*/g, "")}</h2>);
    } else if (line.startsWith("### ")) {
      elements.push(<h3 key={key++} style={{ fontSize: "0.95rem", fontWeight: 700, color: "#c8c8d8", marginTop: 16, marginBottom: 6 }}>{line.replace(/^### /, "").replace(/\*\*/g, "")}</h3>);
    } else if (line.match(/^[-•*] /)) {
      const items = [];
      while (i < lines.length && lines[i].trim().match(/^[-•*] /)) {
        items.push(<li key={i} style={{ marginBottom: 6, color: "#c0c0d8", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: lines[i].trim().replace(/^[-•*] /, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />);
        i++;
      }
      elements.push(<ul key={key++} style={{ paddingLeft: 20, marginBottom: 14 }}>{items}</ul>);
      continue;
    } else if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].trim().match(/^\d+\. /)) {
        items.push(<li key={i} style={{ marginBottom: 6, color: "#c0c0d8", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: lines[i].trim().replace(/^\d+\. /, "").replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>") }} />);
        i++;
      }
      elements.push(<ol key={key++} style={{ paddingLeft: 20, marginBottom: 14 }}>{items}</ol>);
      continue;
    } else if (line === "---") {
      elements.push(<hr key={key++} style={{ border: "none", borderTop: "1px solid #2a2a3a", margin: "20px 0" }} />);
    } else {
      elements.push(<p key={key++} style={{ marginBottom: 13, color: "#c0c0d8", fontWeight: 300, lineHeight: 1.78, fontSize: "0.9rem" }} dangerouslySetInnerHTML={{ __html: line.replace(/\*\*(.+?)\*\*/g, "<strong style='color:#e8e8f0'>$1</strong>") }} />);
    }
    i++;
  }
  return elements;
}

export default function App() {
  const [industry, setIndustry] = useState("AI & Technology");
  const [selectedTopics, setSelectedTopics] = useState(["AI Agents & Automation"]);
  const [tone, setTone] = useState("Thought Leader");
  const [length, setLength] = useState("900–1200 words");
  const [voice, setVoice] = useState(VOICES[0].value);
  const [customTopic, setCustomTopic] = useState("");
  const [extraTopics, setExtraTopics] = useState([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [article, setArticle] = useState("");
  const [copied, setCopied] = useState(false);
  const timers = useRef([]);

  const allTopics = [...TOPICS, ...extraTopics.map(t => ({ label: t, value: t }))];

  const toggleTopic = (val) => {
    setSelectedTopics(prev =>
      prev.includes(val)
        ? prev.length > 1 ? prev.filter(t => t !== val) : prev
        : [...prev, val]
    );
  };

  const addCustomTopic = () => {
    const val = customTopic.trim();
    if (!val) return;
    setExtraTopics(prev => [...prev, val]);
    setSelectedTopics(prev => [...prev, val]);
    setCustomTopic("");
  };

  const generate = async () => {
    setLoading(true);
    setArticle("");
    setStep(1);
    timers.current.forEach(clearTimeout);
    timers.current = [];
    timers.current.push(setTimeout(() => setStep(2), 2200));
    timers.current.push(setTimeout(() => setStep(3), 5500));

    const prompt = `You are a top LinkedIn newsletter writer and AI industry analyst writing as ${voice}.

Write a compelling, insightful LinkedIn newsletter article that feels CURRENT and AUTHORITATIVE.

BRIEF:
- Industry: ${industry}
- Topics: ${selectedTopics.join(", ")}
- Tone: ${tone}
- Length: ${length}

STRUCTURE:
# [Compelling headline signalling change or insight]

📅 March 2026 Edition · The AI Shift Newsletter

## The Big Picture
(The macro shift happening RIGHT NOW in ${industry} — reference specific 2025-2026 developments)

## What's Actually Changing
(2–3 sub-trends within the topics. Bold sub-heading per trend, concrete example or stat per trend)

## The Opportunity
(What forward-thinking leaders should do NOW — specific, not generic)

## The Risk of Waiting
(What happens to those who don't adapt — urgent but not alarmist)

## My Take
(2–3 sentences of personal, slightly contrarian perspective as ${voice})

## Key Takeaways
- [crisp insight 1]
- [crisp insight 2]  
- [crisp insight 3]

---

💬 What's your experience with this shift? Reply or comment below. Follow The AI Shift for next week's edition.

TONE for "${tone}":
${tone === "Thought Leader" ? "Authoritative but inclusive. Use 'we'. Reference named trends. Sound like someone who's been in the room." : ""}
${tone === "Conversational" ? "Like talking to a smart colleague. Short sentences. Direct. Avoid jargon." : ""}
${tone === "Data-Driven" ? "Ground every claim in statistics. Use numbers, percentages, comparisons. Be analytical but readable." : ""}

Write the full article now with real, specific content. No placeholders.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1800,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setStep(4);

      let text = "";
      if (data.content) {
        for (const block of data.content) {
          if (block.type === "text") text += block.text;
        }
      }
      setArticle(text || "No content returned. Please try again.");
    } catch (e) {
      setArticle(`**Error:** ${e.message}`);
    } finally {
      timers.current.forEach(clearTimeout);
      setLoading(false);
      setStep(0);
    }
  };

  const copyText = (linkedIn = false) => {
    const text = linkedIn ? article.replace(/#{1,3} /g, "").replace(/\*\*/g, "") : article;
    navigator.clipboard.writeText(text);
    setCopied(linkedIn ? "linkedin" : "raw");
    setTimeout(() => setCopied(false), 2500);
  };

  const wordCount = article ? article.split(/\s+/).filter(Boolean).length : 0;
  const readTime = Math.ceil(wordCount / 200);

  return (
    <div style={{ background: "#0a0a0f", minHeight: "100vh", color: "#e8e8f0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e2e", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(10,10,15,0.9)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.02em" }}>
          The AI Shift
          <span style={{ background: "#7c4dff", color: "#fff", padding: "2px 9px", borderRadius: 20, fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.06em" }}>AGENT</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.68rem", color: "#5a5a78", border: "1px solid #1e1e2e", padding: "5px 12px", borderRadius: 20 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00c896", display: "inline-block", animation: "pulse 2s infinite" }} />
          Claude · Web Search Active
        </div>
      </div>

      {/* Hero */}
      <div style={{ textAlign: "center", padding: "44px 24px 28px" }}>
        <div style={{ display: "inline-block", background: "rgba(124,77,255,0.08)", border: "1px solid rgba(124,77,255,0.25)", color: "#7c4dff", padding: "4px 14px", borderRadius: 20, fontSize: "0.68rem", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
          LinkedIn Newsletter Automation
        </div>
        <h1 style={{ fontWeight: 800, fontSize: "clamp(1.6rem, 4vw, 2.4rem)", letterSpacing: "-0.03em", lineHeight: 1.1, marginBottom: 10 }}>
          Research. Write. <span style={{ color: "#7c4dff" }}>Publish.</span>
        </h1>
        <p style={{ color: "#5a5a78", fontSize: "0.88rem", maxWidth: 480, margin: "0 auto", lineHeight: 1.6, fontWeight: 300 }}>
          AI agent that researches real-time industry shifts and writes a polished LinkedIn newsletter article — in your voice.
        </p>
      </div>

      {/* Main */}
      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16, padding: "0 20px 60px", maxWidth: 1060, margin: "0 auto" }}>

        {/* Config */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, overflow: "hidden", alignSelf: "start" }}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid #1e1e2e" }}>
            <span style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a4a68", fontWeight: 700 }}>Configuration</span>
          </div>
          <div style={{ padding: 18 }}>

            {/* Industry */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4a68", marginBottom: 7, fontWeight: 700 }}>Industry</label>
              <select value={industry} onChange={e => setIndustry(e.target.value)}
                style={{ width: "100%", background: "#1a1a24", border: "1px solid #2a2a3a", color: "#e8e8f0", padding: "9px 12px", borderRadius: 9, fontSize: "0.83rem", outline: "none" }}>
                {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
              </select>
            </div>

            {/* Topics */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4a68", marginBottom: 7, fontWeight: 700 }}>Topic Focus</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {allTopics.map(t => (
                  <span key={t.value} onClick={() => toggleTopic(t.value)}
                    style={{ fontSize: "0.7rem", padding: "4px 10px", borderRadius: 20, border: `1px solid ${selectedTopics.includes(t.value) ? "#7c4dff" : "#2a2a3a"}`, background: selectedTopics.includes(t.value) ? "rgba(124,77,255,0.12)" : "transparent", color: selectedTopics.includes(t.value) ? "#9c6dff" : "#5a5a78", cursor: "pointer", transition: "all 0.15s" }}>
                    {t.label}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input value={customTopic} onChange={e => setCustomTopic(e.target.value)} onKeyDown={e => e.key === "Enter" && addCustomTopic()}
                  placeholder="Add topic…"
                  style={{ flex: 1, background: "#1a1a24", border: "1px solid #2a2a3a", color: "#e8e8f0", padding: "8px 11px", borderRadius: 9, fontSize: "0.78rem", outline: "none" }} />
                <button onClick={addCustomTopic}
                  style={{ background: "#1a1a24", border: "1px solid #2a2a3a", color: "#5a5a78", padding: "8px 12px", borderRadius: 9, fontSize: "0.78rem", cursor: "pointer" }}>
                  +
                </button>
              </div>
            </div>

            <div style={{ borderTop: "1px solid #1e1e2e", margin: "16px 0" }} />

            {/* Tone */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4a68", marginBottom: 7, fontWeight: 700 }}>Tone</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                {TONES.map(t => (
                  <button key={t} onClick={() => setTone(t)}
                    style={{ background: tone === t ? "rgba(0,229,255,0.08)" : "#1a1a24", border: `1px solid ${tone === t ? "rgba(0,229,255,0.4)" : "#2a2a3a"}`, color: tone === t ? "#00e5ff" : "#5a5a78", padding: "8px 4px", borderRadius: 8, fontSize: "0.65rem", cursor: "pointer", transition: "all 0.15s" }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4a68", marginBottom: 7, fontWeight: 700 }}>Length</label>
              <select value={length} onChange={e => setLength(e.target.value)}
                style={{ width: "100%", background: "#1a1a24", border: "1px solid #2a2a3a", color: "#e8e8f0", padding: "9px 12px", borderRadius: 9, fontSize: "0.83rem", outline: "none" }}>
                {LENGTHS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>

            {/* Voice */}
            <div style={{ marginBottom: 18 }}>
              <label style={{ display: "block", fontSize: "0.68rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#4a4a68", marginBottom: 7, fontWeight: 700 }}>Author Voice</label>
              <select value={voice} onChange={e => setVoice(e.target.value)}
                style={{ width: "100%", background: "#1a1a24", border: "1px solid #2a2a3a", color: "#e8e8f0", padding: "9px 12px", borderRadius: 9, fontSize: "0.83rem", outline: "none" }}>
                {VOICES.map(v => <option key={v.value} value={v.value}>{v.label}</option>)}
              </select>
            </div>

            <button onClick={generate} disabled={loading}
              style={{ width: "100%", background: loading ? "#4a2fa0" : "#7c4dff", color: "#fff", border: "none", padding: "13px 16px", borderRadius: 11, fontWeight: 800, fontSize: "0.88rem", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s", letterSpacing: "-0.01em" }}>
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "#fff", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                  {step === 1 ? "Scanning web…" : step === 2 ? "Analysing…" : step === 3 ? "Writing…" : "Finalising…"}
                </>
              ) : "⚡ Research & Generate"}
            </button>
          </div>
        </div>

        {/* Output */}
        <div style={{ background: "#111118", border: "1px solid #1e1e2e", borderRadius: 14, display: "flex", flexDirection: "column", minHeight: 500 }}>
          <div style={{ padding: "13px 18px", borderBottom: "1px solid #1e1e2e", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: "0.68rem", letterSpacing: "0.1em", textTransform: "uppercase", color: "#4a4a68", fontWeight: 700 }}>Article Output</span>
            {article && <span style={{ fontSize: "0.68rem", color: "#4a4a68" }}>{wordCount} words · ~{readTime} min read</span>}
          </div>

          {/* Progress */}
          {loading && (
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #1e1e2e" }}>
              {STEPS.map((s, idx) => {
                const stepNum = idx + 1;
                const isDone = step > stepNum;
                const isActive = step === stepNum;
                return (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8, fontSize: "0.75rem", opacity: isDone ? 1 : isActive ? 1 : 0.3, color: isDone ? "#00c896" : isActive ? "#00e5ff" : "#5a5a78", transition: "all 0.3s" }}>
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                    {isDone && <span style={{ marginLeft: "auto", color: "#00c896" }}>✓</span>}
                  </div>
                );
              })}
              <div style={{ height: 2, background: "#1e1e2e", borderRadius: 2, marginTop: 8, overflow: "hidden" }}>
                <div style={{ height: "100%", background: "linear-gradient(90deg, #7c4dff, #00e5ff)", width: `${((step - 1) / 3) * 100}%`, transition: "width 0.5s ease", borderRadius: 2 }} />
              </div>
            </div>
          )}

          {/* Content */}
          <div style={{ flex: 1, padding: article ? "24px 28px" : 0, overflowY: "auto", maxHeight: 480 }}>
            {!article && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: 400, gap: 12, textAlign: "center", padding: 24 }}>
                <span style={{ fontSize: "2.2rem", opacity: 0.25 }}>📡</span>
                <div style={{ fontWeight: 700, color: "#3a3a5a", fontSize: "1rem" }}>Ready to Research</div>
                <div style={{ color: "#3a3a5a", fontSize: "0.78rem", maxWidth: 260, lineHeight: 1.5, fontWeight: 300 }}>
                  Configure your settings and click Generate — the agent will research live trends and write your article.
                </div>
              </div>
            )}
            {article && <div>{parseArticle(article)}</div>}
          </div>

          {/* Toolbar */}
          <div style={{ padding: "11px 18px", borderTop: "1px solid #1e1e2e", display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => copyText(false)} disabled={!article}
              style={{ background: "#1a1a24", border: "1px solid #2a2a3a", color: copied === "raw" ? "#00c896" : "#5a5a78", padding: "7px 13px", borderRadius: 8, fontSize: "0.7rem", cursor: article ? "pointer" : "not-allowed", opacity: article ? 1 : 0.4, transition: "all 0.15s" }}>
              {copied === "raw" ? "✓ Copied!" : "📋 Copy"}
            </button>
            <button onClick={() => copyText(true)} disabled={!article}
              style={{ background: copied === "linkedin" ? "rgba(0,200,150,0.1)" : "#1a1a24", border: `1px solid ${copied === "linkedin" ? "rgba(0,200,150,0.3)" : "#2a2a3a"}`, color: copied === "linkedin" ? "#00c896" : "#5a5a78", padding: "7px 13px", borderRadius: 8, fontSize: "0.7rem", cursor: article ? "pointer" : "not-allowed", opacity: article ? 1 : 0.4, transition: "all 0.15s" }}>
              {copied === "linkedin" ? "✓ Copied!" : "🚀 Copy for LinkedIn"}
            </button>
            {article && (
              <button onClick={generate} disabled={loading}
                style={{ background: "#1a1a24", border: "1px solid #2a2a3a", color: "#5a5a78", padding: "7px 13px", borderRadius: 8, fontSize: "0.7rem", cursor: "pointer", marginLeft: "auto", transition: "all 0.15s" }}>
                🔄 Regenerate
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        select { cursor: pointer; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #2a2a3a; border-radius: 3px; }
      `}</style>
    </div>
  );
}
