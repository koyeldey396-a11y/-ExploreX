import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { getAIStatus, chatWithAI } from "../services/api";
import { useLanguage } from "../context/LanguageContext";

const QUICK_PROMPTS = [
  "Best historical destinations in India",
  "Plan a 3-day budget trip",
  "Best hill stations to visit",
  "Best beach getaways to explore",
  "Suggest hidden tourist destinations",
  "Travel packing checklist",
];

const RECOMMENDATION_CATEGORIES = [
  {
    label: "🏛️ Historical & Heritage",
    prompt:
      "Recommend the top 5 historical and heritage destinations in India. For each place, share key historical significance, architectural highlights, and the best time to visit.",
  },
  {
    label: "🌲 Nature & Wildlife",
    prompt:
      "Recommend 5 breathtaking nature and eco-tourism destinations with lush landscapes, national parks, and peaceful retreats.",
  },
  {
    label: "🏖️ Beaches & Coastal",
    prompt:
      "Suggest the best coastal and beach getaways, with tips on water sports, serene sunset spots, and local seafood.",
  },
  {
    label: "🧗 Adventure & Hill Stations",
    prompt:
      "Suggest exciting adventure and hill station destinations suitable for trekking, outdoor activities, and mountain views.",
  },
  {
    label: "💰 Budget Friendly Escapes",
    prompt:
      "Suggest top budget-friendly travel destinations with estimated daily expenses (food, stay, transport) and money-saving tips.",
  },
];

// Lightweight markdown renderer for clean response display
function formatMarkdown(text) {
  if (!text) return null;

  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`}>
          {currentList.map((item, idx) => (
            <li key={idx}>{parseInline(item)}</li>
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const parseInline = (str) => {
    const parts = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
    let match;
    let lastIndex = 0;
    let keyIdx = 0;

    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.substring(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(<strong key={keyIdx++}>{token.slice(2, -2)}</strong>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        parts.push(<em key={keyIdx++}>{token.slice(1, -1)}</em>);
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(<code key={keyIdx++}>{token.slice(1, -1)}</code>);
      }
      lastIndex = regex.lastIndex;
    }
    if (lastIndex < str.length) {
      parts.push(str.substring(lastIndex));
    }
    return parts.length > 0 ? parts : str;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      flushList();
      continue;
    }

    if (line.startsWith("### ")) {
      flushList();
      elements.push(<h3 key={`h3-${i}`}>{parseInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={`h2-${i}`}>{parseInline(line.slice(3))}</h2>);
    } else if (line.startsWith("# ")) {
      flushList();
      elements.push(<h1 key={`h1-${i}`}>{parseInline(line.slice(2))}</h1>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      currentList.push(line.slice(2));
    } else if (/^\d+\.\s/.test(line)) {
      currentList.push(line.replace(/^\d+\.\s/, ""));
    } else {
      flushList();
      elements.push(<p key={`p-${i}`}>{parseInline(line)}</p>);
    }
  }

  flushList();
  return elements;
}

function AIAssistant() {
  const [searchParams] = useSearchParams();
  const requestedDestination = searchParams.get("destination");
  const [destinationContext, setDestinationContext] = useState(null);

  const {
    language,
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    isSpeaking,
    isPaused,
    startVoiceSearch,
    stopVoiceSearch,
    isListening,
    isSpeechRecognitionSupported,
  } = useLanguage();

  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState(null);

  const [activeTab, setActiveTab] = useState("chat"); // 'chat', 'recommend', 'itinerary'
  const [aiStatus, setAiStatus] = useState({ configured: false, provider: "Google Gemini" });
  const [messages, setMessages] = useState([
    {
      id: "welcome-1",
      role: "assistant",
      text: "Hello explorer! 🌍 I'm your ExploreX AI Tourist Assistant. Ask me about any destination, request custom itineraries, historical details, budget estimates, or packing checklists!",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");

  // Itinerary Generator form state
  const [itineraryForm, setItineraryForm] = useState({
    destination: "",
    duration: "3 days",
    style: "Budget Friendly",
    interests: "",
  });

  const chatEndRef = useRef(null);

  // Load destination context if provided in query
  useEffect(() => {
    if (requestedDestination) {
      fetch(`http://localhost:5000/api/destinations/details?q=${encodeURIComponent(requestedDestination)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.title) {
            setDestinationContext(data);
            setItineraryForm((prev) => ({ ...prev, destination: data.title }));
            setMessages([
              {
                id: "dest-welcome",
                role: "assistant",
                text: `Hello explorer! 🌍 I have loaded verified travel intelligence for **${data.title}** (${data.type}), including live weather (${data.weather ? `${data.weather.temperature}°C, ${data.weather.condition}` : "Seasonal"}), ${data.attractions?.length || 0} nearby attractions, and estimated budget tiers. Ask me anything!`,
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              },
            ]);
          }
        })
        .catch((err) => console.warn("Failed to load destination context:", err));
    }
  }, [requestedDestination]);

  // Check AI configuration on load
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const data = await getAIStatus();
        setAiStatus(data);
      } catch (err) {
        console.warn("Could not fetch AI status:", err);
      }
    };

    checkStatus();
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Send message to AI
  const handleSendMessage = async (textToSend) => {
    const messageContent = (textToSend || inputMessage).trim();
    if (!messageContent || loading) return;

    setErrorBanner("");

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      text: messageContent,
      time: now,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInputMessage("");
    setLoading(true);

    // Switch to chat tab so user sees their response
    if (activeTab !== "chat") {
      setActiveTab("chat");
    }

    try {
      const apiHistory = newHistory.map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await chatWithAI(messageContent, apiHistory, destinationContext, language);

      if (res.success && res.reply) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: res.reply,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        // Handled case where API key is not configured or error returned
        const warningMsg =
          res.message ||
          "Live AI response is unavailable. Please verify GEMINI_API_KEY configuration.";

        setMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            role: "assistant",
            isError: true,
            text: `⚠️ **Live AI Note**: ${warningMsg}`,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      console.error("Chat error:", err);
      setErrorBanner(err.message || "Failed to reach AI service.");
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: "assistant",
          isError: true,
          text: `⚠️ **Error**: ${err.message || "Unable to connect to AI Assistant. Please check if your backend is running."}`,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (window.confirm("Do you want to clear this chat session?")) {
      setMessages([
        {
          id: "welcome-reset",
          role: "assistant",
          text: "Chat cleared. What journey would you like to plan next? 🧭",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
      setErrorBanner("");
    }
  };

  const handleItinerarySubmit = (e) => {
    e.preventDefault();
    if (!itineraryForm.destination.trim()) {
      alert("Please enter a destination name.");
      return;
    }

    const promptText = `Generate a comprehensive day-by-day travel itinerary for ${itineraryForm.destination} (${itineraryForm.duration}, travel style: ${itineraryForm.style}). ${
      itineraryForm.interests ? `Special interests: ${itineraryForm.interests}.` : ""
    } Please structure it with Morning, Afternoon, and Evening activities for each day, estimated budget breakdown (stay, meals, transit), local foods to try, and must-know travel tips.`;

    handleSendMessage(promptText);
  };

  return (
    <main className="ai-assistant-page">
      <div className="ai-assistant-container">
        {/* Title Header */}
        <section>
          <div className="ai-header-badge">
            ✨ ExploreX Intelligent Guide • {aiStatus.provider || "Google Gemini"}
          </div>
          <h1>{t("ai_title")}</h1>
          <p>
            Your intelligent travel companion for destination discovery, personalized
            itineraries, budget breakdowns, and local cultural insights.
          </p>
        </section>

        {/* Live AI Configuration Status Banner */}
        {aiStatus.configured ? (
          <div className="ai-status-banner connected">
            🟢 <strong>Live AI Connected</strong>: Powered by Google Gemini. Ask any travel question for real-time recommendations and customized itineraries!
          </div>
        ) : (
          <div className="ai-status-banner warning">
            ⚙️ <strong>Live AI Configuration Notice</strong>: Real-time responses require a Google Gemini API key. Add <code>GEMINI_API_KEY=your_key</code> in <code>backend/.env</code> and restart the backend server.
          </div>
        )}

        {/* Active Destination Focus Banner */}
        {destinationContext && (
          <div className="ai-dest-focus-banner">
            <div className="dest-focus-info">
              <span className="dest-focus-pin">📍</span>
              <div>
                <strong>Active Destination Focus: {destinationContext.title}</strong> ({destinationContext.type})
                <span className="dest-focus-meta">
                  {destinationContext.weather ? ` • ${destinationContext.weather.icon} ${destinationContext.weather.temperature}°C` : ""}
                  {destinationContext.attractions?.length ? ` • ${destinationContext.attractions.length} verified attractions` : ""}
                </span>
              </div>
            </div>
            <Link to={`/destination/${destinationContext.slug}`} className="dest-focus-link">
              View Full Guide ↗
            </Link>
          </div>
        )}

        {/* Error notification if any */}
        {errorBanner && (
          <div className="ai-status-banner warning">
            ❌ <strong>Notice</strong>: {errorBanner}
          </div>
        )}

        {/* Feature Navigation Tabs */}
        <div className="ai-tools-nav">
          <button
            type="button"
            className={`ai-tab-btn ${activeTab === "chat" ? "active" : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            💬 {t("ai_chat_title")}
          </button>
          <button
            type="button"
            className={`ai-tab-btn ${activeTab === "recommend" ? "active" : ""}`}
            onClick={() => setActiveTab("recommend")}
          >
            🗺️ {t("ai_recs_title")}
          </button>
          <button
            type="button"
            className={`ai-tab-btn ${activeTab === "itinerary" ? "active" : ""}`}
            onClick={() => setActiveTab("itinerary")}
          >
            📅 {t("ai_itinerary_title")}
          </button>
        </div>

        {/* Destination Recommendations Panel */}
        {activeTab === "recommend" && (
          <section className="ai-tool-card">
            <h2>🗺️ {t("ai_recs_title")}</h2>
            <p>
              {t("ai_recs_subtitle")}
            </p>
            <div className="ai-category-chips">
              {RECOMMENDATION_CATEGORIES.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  className="ai-chip-btn"
                  onClick={() => handleSendMessage(cat.prompt)}
                  disabled={loading}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Travel Itinerary Generator Form Panel */}
        {activeTab === "itinerary" && (
          <section className="ai-tool-card">
            <h2>📅 {t("ai_itinerary_title")}</h2>
            <p>
              Provide your trip details below to have your AI assistant generate a structured, day-by-day journey plan:
            </p>

            <form onSubmit={handleItinerarySubmit}>
              <div className="ai-form-grid">
                <div className="ai-form-group">
                  <label>{t("ai_itinerary_dest")}</label>
                  <input
                    type="text"
                    placeholder="e.g. Goa, Manali, Kerala, Rajasthan"
                    value={itineraryForm.destination}
                    onChange={(e) =>
                      setItineraryForm({ ...itineraryForm, destination: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="ai-form-group">
                  <label>{t("ai_itinerary_days")}</label>
                  <select
                    value={itineraryForm.duration}
                    onChange={(e) =>
                      setItineraryForm({ ...itineraryForm, duration: e.target.value })
                    }
                  >
                    <option value="2 days (Weekend)">2 Days (Weekend Trip)</option>
                    <option value="3 days">3 Days (Short Escape)</option>
                    <option value="5 days">5 Days (Explore & Relax)</option>
                    <option value="7 days">7 Days (Full Adventure)</option>
                    <option value="10 days">10 Days (Comprehensive)</option>
                  </select>
                </div>

                <div className="ai-form-group">
                  <label>{t("ai_itinerary_budget")}</label>
                  <select
                    value={itineraryForm.style}
                    onChange={(e) =>
                      setItineraryForm({ ...itineraryForm, style: e.target.value })
                    }
                  >
                    <option value="Backpacker / Budget">Backpacker / Budget Friendly</option>
                    <option value="Moderate / Comfortable">Moderate / Family Friendly</option>
                    <option value="Luxury / Premium">Luxury / Premium Experience</option>
                  </select>
                </div>

                <div className="ai-form-group">
                  <label>{t("ai_itinerary_interests")}</label>
                  <input
                    type="text"
                    placeholder={t("ai_itinerary_interests_placeholder")}
                    value={itineraryForm.interests}
                    onChange={(e) =>
                      setItineraryForm({ ...itineraryForm, interests: e.target.value })
                    }
                  />
                </div>
              </div>

              <button
                type="submit"
                className="ai-send-btn"
                disabled={loading || !itineraryForm.destination.trim()}
              >
                {loading ? t("ai_btn_generating") : `🚀 ${t("ai_btn_generate")}`}
              </button>
            </form>
          </section>
        )}

        {/* Quick Prompts Bar */}
        <section className="ai-quick-prompts-section">
          <div className="ai-quick-prompts-title">
            💡 {t("ai_recs_title")}:
          </div>
          <div className="ai-quick-prompts-list">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="ai-prompt-pill"
                onClick={() => handleSendMessage(prompt)}
                disabled={loading}
              >
                {prompt}
              </button>
            ))}
          </div>
        </section>

        {/* Chat Window */}
        <section className="ai-chat-card">
          <div className="ai-chat-header">
            <h3>🤖 {t("ai_chat_title")}</h3>
            <button
              type="button"
              className="ai-clear-btn"
              onClick={handleClearChat}
              title="Clear conversation history"
            >
              {t("ai_btn_clear")}
            </button>
          </div>

          <div className="ai-messages-window">
            {messages.length === 0 ? (
              <div className="ai-empty-state">
                <div className="ai-empty-state-icon">🧭</div>
                <h3>{t("ai_title")}</h3>
                <p>{t("ai_subtitle")}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`ai-message-row ${msg.role}`}>
                  {msg.role === "assistant" && (
                    <div className="ai-avatar assistant">🤖</div>
                  )}

                  <div className="ai-message-body">
                    <div className="ai-message-meta">
                      {msg.role === "assistant" ? "ExploreX AI" : "You"} • {msg.time}
                    </div>
                    <div className={`ai-bubble ${msg.isError ? "error" : ""}`}>
                      {msg.role === "assistant" ? formatMarkdown(msg.text) : msg.text}
                    </div>

                    {msg.role === "assistant" && !msg.isError && (
                      <div className="ai-bubble-audio-actions">
                        <button
                          type="button"
                          className={`ai-speech-btn ${activeSpeechMsgId === msg.id && isSpeaking ? "active" : ""}`}
                          onClick={() => {
                            if (activeSpeechMsgId === msg.id && isSpeaking) {
                              if (isPaused) resumeSpeech();
                              else pauseSpeech();
                            } else {
                              speak(msg.text, language);
                              setActiveSpeechMsgId(msg.id);
                            }
                          }}
                          title={
                            activeSpeechMsgId === msg.id && isSpeaking
                              ? isPaused
                                ? "Resume audio"
                                : "Pause audio"
                              : "Listen to answer"
                          }
                        >
                          {activeSpeechMsgId === msg.id && isSpeaking
                            ? isPaused
                              ? "▶️ Resume"
                              : `⏸️ ${t("pause")}`
                            : `🔊 ${t("ai_btn_tts")}`}
                        </button>
                        {activeSpeechMsgId === msg.id && isSpeaking && (
                          <button
                            type="button"
                            className="ai-speech-stop"
                            onClick={() => {
                              stopSpeech();
                              setActiveSpeechMsgId(null);
                            }}
                          >
                            ⏹️ {t("ai_btn_tts_stop")}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {msg.role === "user" && <div className="ai-avatar user">👤</div>}
                </div>
              ))
            )}

            {/* Typing animation indicator */}
            {loading && (
              <div className="ai-message-row assistant">
                <div className="ai-avatar assistant">🤖</div>
                <div className="ai-message-body">
                  <div className="ai-message-meta">ExploreX AI is thinking...</div>
                  <div className="ai-typing-indicator">
                    <span />
                    <span />
                    <span />
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="ai-chat-input-area">
            <form
              className="ai-chat-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
            >
              <textarea
                className="ai-chat-textarea"
                rows={1}
                placeholder="Ask about tourist places, cultural history, packing tips, or plan an itinerary..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
              />
              <button
                type="button"
                className={`ai-mic-btn ${isListening ? "listening" : ""}`}
                onClick={() => {
                  if (isListening) {
                    stopVoiceSearch();
                  } else {
                    startVoiceSearch({
                      onResult: (transcript) => setInputMessage(transcript),
                      langOverride: language,
                    });
                  }
                }}
                disabled={!isSpeechRecognitionSupported || loading}
                title={isListening ? "Listening..." : "Voice input"}
              >
                {isListening ? "🔴" : "🎙️"}
              </button>

              <button
                type="submit"
                className="ai-send-btn"
                disabled={loading || !inputMessage.trim()}
              >
                {loading ? "Sending..." : "Send ✈️"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

export default AIAssistant;
