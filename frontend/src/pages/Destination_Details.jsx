import React, { useEffect, useState, useRef } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLanguage, SUPPORTED_LANGUAGES } from "../context/LanguageContext";
import { chatWithAI, getDestinationDetailsApi } from "../services/api";

// Fix Leaflet marker icon asset paths
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Lightweight markdown renderer for clean AI responses
function formatMarkdown(text) {
  if (!text) return null;
  const lines = text.split("\n");
  const elements = [];
  let currentList = [];

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`ul-${elements.length}`} className="ai-formatted-ul">
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
      elements.push(<h3 key={`h3-${i}`} className="ai-heading-3">{parseInline(line.slice(4))}</h3>);
    } else if (line.startsWith("## ")) {
      flushList();
      elements.push(<h2 key={`h2-${i}`} className="ai-heading-2">{parseInline(line.slice(3))}</h2>);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      currentList.push(line.slice(2));
    } else {
      flushList();
      elements.push(<p key={`p-${i}`} className="ai-paragraph">{parseInline(line)}</p>);
    }
  }
  flushList();
  return elements;
}

function Destination_Details() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const querySlug = slug || searchParams.get("q") || searchParams.get("slug") || "";

  const {
    language,
    setLanguage,
    t,
    speak,
    pauseSpeech,
    resumeSpeech,
    stopSpeech,
    isSpeaking,
    isPaused,
    currentlySpeakingText,
    isSpeechSynthesisSupported,
    translateText,
    isListening,
    startVoiceSearch,
    stopVoiceSearch,
    isSpeechRecognitionSupported,
  } = useLanguage();

  const [destination, setDestination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Dynamic multilingual translation of overview
  const [translatedExtract, setTranslatedExtract] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [translationFallback, setTranslationFallback] = useState(false);

  // Multi-Attraction Selection for Shortest Route Navigation
  const [selectedAttractions, setSelectedAttractions] = useState([]);

  // Interactive Itinerary Generator state
  const [itineraryDays, setItineraryDays] = useState(3);

  // Lightbox state for photo gallery
  const [lightboxIndex, setLightboxIndex] = useState(null);

  // AI Assistant Chat State
  const [aiMessages, setAiMessages] = useState([]);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [activeSpeechMsgId, setActiveSpeechMsgId] = useState(null);

  // Map reference
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  // 1. Fetch destination details from backend
  useEffect(() => {
    if (!querySlug) {
      setError("No destination specified.");
      setLoading(false);
      return;
    }

    const fetchDetails = async () => {
      try {
        setLoading(true);
        setError("");
        setTranslatedExtract(null);

        const data = await getDestinationDetailsApi(querySlug);
        setDestination(data);
      } catch (err) {
        console.error("Fetch destination details error:", err);
        setError(err.message || "Failed to load destination details.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      stopSpeech();
    };
  }, [querySlug]);

  // 2. Handle Dynamic Translation when language changes
  useEffect(() => {
    if (!destination || !destination.extract) return;

    if (language === "en") {
      setTranslatedExtract(null);
      setTranslationFallback(false);
      return;
    }

    const performTranslation = async () => {
      setTranslating(true);
      try {
        const res = await translateText(destination.extract, language);
        if (res && res.translatedText) {
          setTranslatedExtract(res.translatedText);
          setTranslationFallback(Boolean(res.fallback));
        }
      } catch (e) {
        console.warn("Translation failed:", e);
      } finally {
        setTranslating(false);
      }
    };

    performTranslation();
  }, [language, destination]);

  // 3. Initialize Interactive Leaflet Map
  useEffect(() => {
    if (!destination || !mapContainerRef.current) return;

    const lat = destination.coordinates?.lat || 20.5937;
    const lon = destination.coordinates?.lon || 78.9629;

    // Clean up previous map if exists
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (mapContainerRef.current) {
      mapContainerRef.current._leaflet_id = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 12,
      scrollWheelZoom: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    // Main destination marker
    const mainIcon = L.divIcon({
      className: "destination-main-pin",
      html: `
        <div style="
          background: #174c3c;
          color: white;
          padding: 6px 12px;
          border-radius: 20px;
          border: 2px solid #f0c879;
          font-weight: bold;
          font-size: 13px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.35);
          white-space: nowrap;
          display: flex;
          align-items: center;
          gap: 6px;
          transform: translate(-50%, -100%);
        ">
          <span>${destination.icon || "📍"}</span>
          <span>${destination.title}</span>
        </div>
      `,
      iconSize: [0, 0],
      iconAnchor: [0, 0],
    });

    const mainMarker = L.marker([lat, lon], { icon: mainIcon }).addTo(map);
    mainMarker.bindPopup(`
      <div style="font-family: sans-serif; min-width: 180px;">
        <h4 style="margin: 0 0 4px 0; color: #174c3c;">${destination.title}</h4>
        <p style="margin: 0; font-size: 12px; color: #555;">${destination.subtitle || destination.type}</p>
      </div>
    `);

    // Attractions markers
    const bounds = L.latLngBounds([[lat, lon]]);

    if (Array.isArray(destination.attractions) && destination.attractions.length > 0) {
      destination.attractions.forEach((attraction) => {
        if (!attraction.coordinates?.lat || !attraction.coordinates?.lon) return;

        bounds.extend([attraction.coordinates.lat, attraction.coordinates.lon]);

        const poiIcon = L.divIcon({
          className: "attraction-poi-pin",
          html: `
            <div style="
              background: #b47a45;
              color: white;
              padding: 4px 8px;
              border-radius: 16px;
              border: 1px solid white;
              font-size: 11px;
              font-weight: 600;
              box-shadow: 0 2px 8px rgba(0,0,0,0.25);
              white-space: nowrap;
              transform: translate(-50%, -100%);
            ">
              🏛️ ${attraction.name.length > 18 ? attraction.name.slice(0, 16) + "..." : attraction.name}
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

        const marker = L.marker([attraction.coordinates.lat, attraction.coordinates.lon], {
          icon: poiIcon,
        }).addTo(map);

        const navUrl = `/navigate?lat=${attraction.coordinates.lat}&lng=${attraction.coordinates.lon}&name=${encodeURIComponent(attraction.name)}`;

        marker.bindPopup(`
          <div style="font-family: sans-serif; min-width: 200px;">
            <h4 style="margin: 0 0 4px 0; color: #174c3c;">${attraction.name}</h4>
            <p style="margin: 0 0 6px 0; font-size: 12px; color: #666;">Distance: ~${attraction.distanceKm} km</p>
            <a href="${navUrl}" style="
              display: inline-block;
              padding: 5px 10px;
              background: #174c3c;
              color: white;
              border-radius: 4px;
              text-decoration: none;
              font-size: 11px;
              font-weight: 600;
            ">🧭 Navigate Here</a>
          </div>
        `);
      });

      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }

    mapInstanceRef.current = map;

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (mapContainerRef.current) {
        mapContainerRef.current._leaflet_id = null;
      }
    };
  }, [destination]);

  // Multi-Attraction Selection Handlers for Shortest Route
  const toggleAttractionSelection = (item) => {
    setSelectedAttractions((prev) => {
      const exists = prev.some((a) => a.name === item.name);
      if (exists) {
        return prev.filter((a) => a.name !== item.name);
      } else {
        return [...prev, item];
      }
    });
  };

  const selectAllAttractions = () => {
    if (!destination?.attractions) return;
    setSelectedAttractions([...destination.attractions]);
  };

  const clearSelectedAttractions = () => {
    setSelectedAttractions([]);
  };

  const getMultiStopRouteUrl = () => {
    if (!destination) return "/navigate";
    const stops = [
      {
        name: destination.title,
        lat: destination.coordinates?.lat,
        lng: destination.coordinates?.lon,
        isHub: true,
      },
      ...selectedAttractions.map((a) => ({
        name: a.name,
        lat: a.coordinates?.lat,
        lng: a.coordinates?.lon,
      })),
    ];
    return `/navigate?destination=${encodeURIComponent(destination.title)}&stops=${encodeURIComponent(JSON.stringify(stops))}`;
  };

  // Structured Multi-Day Itinerary Generator
  const getGeneratedItinerary = (daysCount) => {
    if (!destination) return [];
    const attractions = destination.attractions || [];
    const thingsGroups = destination.thingsToDo || [];
    const allActivities = thingsGroups.flatMap((g) => g.items || []);

    const days = [];
    for (let d = 1; d <= daysCount; d++) {
      let title = "";
      const activities = [];

      if (d === 1) {
        title = `Iconic ${destination.title} Landmarks & Orientation`;
        activities.push(`Morning arrival and discovery of central ${destination.title}`);
        if (attractions[0]) {
          activities.push(`Tour of ${attractions[0].name} (approx. ${attractions[0].distanceKm} km away)`);
        }
        if (allActivities[0]) activities.push(allActivities[0]);
        activities.push(`Dinner at a renowned local restaurant sampling traditional specialties`);
      } else if (d === 2) {
        title = `Cultural Heritage, Historic Trails & Bazaars`;
        if (attractions[1]) {
          activities.push(`Morning excursion to ${attractions[1].name}`);
        }
        if (attractions[2]) {
          activities.push(`Afternoon exploration of ${attractions[2].name}`);
        }
        if (allActivities[1]) activities.push(allActivities[1]);
        if (allActivities[2]) activities.push(allActivities[2]);
        activities.push(`Evening heritage walk and traditional handicrafts shopping`);
      } else if (d === 3) {
        title = `Panoramic Viewpoints, Leisure & Culinary Tasting`;
        if (attractions[3]) {
          activities.push(`Scenic sightseeing around ${attractions[3].name}`);
        }
        if (allActivities[3]) activities.push(allActivities[3]);
        activities.push(`Photography session capturing authentic landscapes and architecture`);
        activities.push(`Sunset viewpoint relaxation and tea/culinary tasting experience`);
      } else if (d === 4) {
        title = `Architecture, Local Communities & Nature`;
        if (attractions[4]) {
          activities.push(`Visit to ${attractions[4].name}`);
        }
        activities.push(`Interactive artisan workshop or museum gallery exploration`);
        activities.push(`Guided local street food trail and market visit`);
      } else {
        title = `Regional Day Trips & Relaxed Departure`;
        activities.push(`Scenic day trip to outlying countryside or adjacent scenic preserves`);
        activities.push(`Last-minute souvenir acquisition and leisurely cafe stop`);
        activities.push(`Departure preparations and transit to transport terminal`);
      }

      days.push({
        day: d,
        title,
        activities,
      });
    }
    return days;
  };

  const getTripPlannerTransferUrl = () => {
    if (!destination) return "/trip-planner";
    const daysPlan = getGeneratedItinerary(itineraryDays);
    const itineraryData = daysPlan.map((d) => ({
      day: d.day,
      activities: d.activities,
    }));

    // Estimate budget based on standard tier
    let dailyBudget = 3500;
    if (destination.budget?.tiers?.[1]?.dailyEstimateINR) {
      const match = destination.budget.tiers[1].dailyEstimateINR.match(/\d[0-9,]*/);
      if (match) {
        dailyBudget = parseInt(match[0].replace(/,/g, ""), 10) || 3500;
      }
    }
    const totalBudget = dailyBudget * itineraryDays;

    const interests = destination.thingsToDo?.map((g) => g.category).join(", ") || "Heritage, Sightseeing, Food";

    // Include top waypoints for navigation linking
    const stops = [
      {
        name: destination.title,
        lat: destination.coordinates?.lat,
        lng: destination.coordinates?.lon,
      },
      ...(destination.attractions || []).slice(0, 4).map((a) => ({
        name: a.name,
        lat: a.coordinates?.lat,
        lng: a.coordinates?.lon,
      })),
    ];

    return `/trip-planner?destination=${encodeURIComponent(destination.title)}&duration=${itineraryDays}&budget=${totalBudget}&interests=${encodeURIComponent(interests)}&itinerary=${encodeURIComponent(JSON.stringify(itineraryData))}&stops=${encodeURIComponent(JSON.stringify(stops))}`;
  };

  // Audio Guide Handler
  const handleToggleAudio = () => {
    if (!destination) return;

    if (isSpeaking) {
      if (isPaused) {
        resumeSpeech();
      } else {
        pauseSpeech();
      }
    } else {
      const speechContent = `${destination.title}. ${destination.type}. ${
        translatedExtract || destination.extract || destination.subtitle
      }`;
      speak(speechContent, language);
    }
  };

  // Initialize AI assistant welcome message when destination loads
  useEffect(() => {
    if (destination) {
      setAiMessages([
        {
          id: "welcome",
          role: "assistant",
          text: `Hello explorer! 🌍 I am your **${destination.title} AI Travel Guide**. Ask me about the best 3-day itineraries, regional cuisine, weather packing tips, photography spots, or budget advice!`,
          isLiveAI: false,
          isGreeting: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    }
  }, [destination]);

  // Contextual Suggested Questions in Active Language
  const getContextualPrompts = () => {
    if (!destination) return [];
    const t = destination.title;
    if (language === "hi") {
      return [
        `${t} के लिए 3 दिन की यात्रा योजना बनाएं`,
        `${t} के प्रसिद्ध स्थानीय व्यंजन और भोजन`,
        `${t} के लिए मौसम अनुसार पैकिंग चेकलिस्ट`,
        `${t} के लिए सुरक्षा एवं परिवहन सुझाव`,
        `${t} का अनुमानित दैनिक यात्रा बजट`,
      ];
    }
    if (language === "bn") {
      return [
        `${t}-এর জন্য ৩ দিনের ভ্রমণ পরিকল্পনা তৈরি করুন`,
        `${t}-এর বিখ্যাত স্থানীয় খাবার ও মিষ্টি`,
        `${t}-এর জন্য প্যাকিং নির্দেশিকা`,
        `${t}-এর নিরাপত্তা ও যাতায়াতের নির্দেশাবলী`,
        `${t}-এর আনুমানিক দৈনিক ভ্রমণ বাজেট`,
      ];
    }
    if (language === "es") {
      return [
        `Planifica un itinerario de 3 días para ${t}`,
        `¿Cuáles son los platos locales típicos de ${t}?`,
        `Lista de equipaje recomendada para ${t}`,
        `Consejos de seguridad y transporte para ${t}`,
        `Presupuesto diario estimado para ${t}`,
      ];
    }
    if (language === "fr") {
      return [
        `Planifier un itinéraire de 3 jours à ${t}`,
        `Quels sont les plats et spécialités locales à ${t} ?`,
        `Que mettre dans sa valise pour ${t} ?`,
        `Conseils de sécurité et transports à ${t}`,
        `Budget journalier estimé pour ${t}`,
      ];
    }
    return [
      `Plan a 3-day itinerary for ${t}`,
      `Must-try local dishes and cuisine in ${t}`,
      `Travel packing checklist for ${t}`,
      `Safety tips & how to reach ${t}`,
      `Estimated daily budget and money-saving tips`,
    ];
  };

  // Send AI Question
  const handleSendAIQuestion = async (queryText) => {
    const textToSend = (queryText || aiInput).trim();
    if (!textToSend || aiLoading) return;

    const userMsg = {
      id: `user-${Date.now()}`,
      role: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const newHistory = [...aiMessages, userMsg];
    setAiMessages(newHistory);
    setAiInput("");
    setAiLoading(true);

    try {
      const historyPayload = newHistory.map((m) => ({ role: m.role, text: m.text }));
      const res = await chatWithAI(textToSend, historyPayload, destination, language);

      if (res && res.reply) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `ai-${Date.now()}`,
            role: "assistant",
            text: res.reply,
            isLiveAI: Boolean(res.isLiveAI),
            fallbackMode: Boolean(res.fallbackMode),
            note: res.note || null,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      } else {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `ai-err-${Date.now()}`,
            role: "assistant",
            text: `⚠️ **Travel Guide Notice**: ${res?.message || "AI response temporarily unavailable."}`,
            isError: true,
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
          },
        ]);
      }
    } catch (err) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `ai-err-${Date.now()}`,
          role: "assistant",
          text: `⚠️ **Service Error**: ${err.message || "Failed to reach AI service."}`,
          isError: true,
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // Toggle Text-to-speech for AI Message
  const handleToggleMessageSpeech = (msgId, text) => {
    if (activeSpeechMsgId === msgId) {
      if (isSpeaking) {
        if (isPaused) {
          resumeSpeech();
        } else {
          pauseSpeech();
        }
      } else {
        speak(text, language);
      }
    } else {
      speak(text, language);
      setActiveSpeechMsgId(msgId);
    }
  };

  const handleStopMessageSpeech = () => {
    stopSpeech();
    setActiveSpeechMsgId(null);
  };

  // Voice Search / STT for AI input
  const handleAIVoiceInput = () => {
    if (isListening) {
      stopVoiceSearch();
    } else {
      startVoiceSearch({
        onResult: (transcript) => {
          setAiInput(transcript);
        },
        onError: (err) => {
          console.warn("AI voice input error:", err);
        },
        langOverride: language,
      });
    }
  };

  // Lightbox key navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (lightboxIndex === null) return;
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight") {
        setLightboxIndex((prev) =>
          prev < (destination?.gallery?.length || 1) - 1 ? prev + 1 : 0
        );
      }
      if (e.key === "ArrowLeft") {
        setLightboxIndex((prev) =>
          prev > 0 ? prev - 1 : (destination?.gallery?.length || 1) - 1
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [lightboxIndex, destination]);

  if (loading) {
    return (
      <main className="destination-details-page loading-state">
        <div className="dest-loading-card">
          <div className="dest-spinner"></div>
          <h2>Discovering {querySlug.replace(/-/g, " ")}...</h2>
          <p>Gathering authentic facts, live weather, verified photographs, and nearby attractions.</p>
        </div>
      </main>
    );
  }

  if (error || !destination) {
    return (
      <main className="destination-details-page error-state">
        <div className="dest-error-card">
          <span className="dest-error-icon">📍</span>
          <h2>Destination Guide Unavailable</h2>
          <p>{error || `No destination dossier found for "${querySlug}".`}</p>
          <div className="dest-error-actions">
            <Link to="/explore" className="dest-btn-primary">
              ← Back to Explore
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const activeExtract = translatedExtract || destination.extract;

  return (
    <div className="destination-details-page">
      {/* 1. HERO BANNER */}
      <section
        className="dest-hero"
        style={{
          backgroundImage: destination.heroImage
            ? `linear-gradient(rgba(13, 52, 41, 0.72), rgba(13, 52, 41, 0.88)), url('${destination.heroImage}')`
            : "linear-gradient(135deg, #174c3c, #0d3429)",
        }}
      >
        <div className="dest-hero-inner">
          <div className="dest-hero-breadcrumbs">
            <Link to="/explore">Explore</Link>
            <span>/</span>
            <span>{destination.type || "Destination"}</span>
            <span>/</span>
            <span className="current">{destination.title}</span>
          </div>

          <div className="dest-hero-badge-row">
            <span className="dest-entity-badge">
              {destination.icon || "📍"} {destination.type}
            </span>
            {destination.coordinates && (
              <span className="dest-coords-badge">
                🌐 {destination.coordinates.lat.toFixed(4)}°, {destination.coordinates.lon.toFixed(4)}°
              </span>
            )}
          </div>

          <h1 className="dest-hero-title">{destination.title}</h1>
          <p className="dest-hero-subtitle">{destination.subtitle}</p>

          {/* Quick Action Toolbar */}
          <div className="dest-hero-actions">
            <button
              type="button"
              className={`dest-action-btn audio-btn ${isSpeaking ? "active" : ""}`}
              onClick={handleToggleAudio}
              disabled={!isSpeechSynthesisSupported}
              title={
                !isSpeechSynthesisSupported
                  ? t("not_supported_tts")
                  : isSpeaking
                  ? isPaused
                    ? t("resume")
                    : t("pause")
                  : t("listen_guide")
              }
            >
              <span>{isSpeaking ? (isPaused ? "▶️" : "⏸️") : "🔊"}</span>
              <span>
                {isSpeaking
                  ? isPaused
                    ? t("resume")
                    : t("pause")
                  : t("listen_guide")}
              </span>
            </button>

            {isSpeaking && (
              <button
                type="button"
                className="dest-action-btn stop-audio-btn"
                onClick={stopSpeech}
                title={t("stop")}
              >
                <span>⏹️</span>
                <span>{t("stop")}</span>
              </button>
            )}

            <Link
              to={`/trip-planner?destination=${encodeURIComponent(destination.title)}`}
              className="dest-action-btn plan-trip-btn"
            >
              <span>✈️</span>
              <span>{t("plan_trip")}</span>
            </Link>

            <a href="#dest-map-section" className="dest-action-btn map-scroll-btn">
              <span>🗺️</span>
              <span>{t("navigate")}</span>
            </a>
          </div>
        </div>
      </section>

      {/* 2. MAIN CONTENT CONTAINER */}
      <main className="dest-details-main">
        {/* Top Notification / Language Bar */}
        <div className="dest-lang-strip">
          <div className="dest-lang-status">
            <span>🌐 {t("language_select")}: <strong>{language.toUpperCase()}</strong></span>
            {translationFallback && (
              <span className="dest-fallback-pill">
                ℹ️ Standard Multilingual Mode
              </span>
            )}
            {translating && (
              <span className="dest-translating-pill">
                ⏳ Translating guide...
              </span>
            )}
          </div>

          <div className="dest-lang-pills">
            {SUPPORTED_LANGUAGES.map((l) => (
              <button
                key={l.code}
                type="button"
                className={`dest-lang-pill ${language === l.code ? "active" : ""}`}
                onClick={() => setLanguage(l.code)}
              >
                {l.flag} {l.nativeName}
              </button>
            ))}
          </div>
        </div>

        {/* 3. TWO-COLUMN GRID: OVERVIEW + WEATHER */}
        <div className="dest-grid-two">
          {/* Left Column: Overview & Heritage */}
          <section className="dest-card dest-overview-card">
            <div className="dest-card-header">
              <h2>🏛️ {t("overview_heading")}</h2>
              {destination.wikipediaUrl && (
                <a
                  href={destination.wikipediaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dest-source-link"
                >
                  Source: Wikipedia ↗
                </a>
              )}
            </div>

            <p className="dest-overview-text">
              {activeExtract || "Factual overview information is currently unavailable."}
            </p>

            <div className="dest-meta-chips">
              <span className="meta-chip">
                <strong>Type:</strong> {destination.type}
              </span>
              {destination.travelInfo?.recommendedDuration && (
                <span className="meta-chip">
                  <strong>{t("duration")}:</strong> {destination.travelInfo.recommendedDuration}
                </span>
              )}
              {destination.travelInfo?.bestTime && (
                <span className="meta-chip">
                  <strong>{t("best_time")}:</strong> {destination.travelInfo.bestTime}
                </span>
              )}
            </div>
          </section>

          {/* Right Column: Live Weather & Forecast */}
          <section className="dest-card dest-weather-card">
            <h2>🌤️ {t("weather_heading")}</h2>

            {destination.weather ? (
              <div className="dest-weather-content">
                <div className="dest-weather-primary">
                  <span className="dest-weather-icon">{destination.weather.icon}</span>
                  <div className="dest-weather-temp-wrap">
                    <span className="dest-weather-temp">{destination.weather.temperature}°C</span>
                    <span className="dest-weather-condition">{destination.weather.condition}</span>
                  </div>
                </div>

                <div className="dest-weather-metrics">
                  <div className="weather-metric">
                    <span className="metric-label">{t("humidity")}</span>
                    <span className="metric-value">{destination.weather.humidity}%</span>
                  </div>
                  <div className="weather-metric">
                    <span className="metric-label">{t("wind")}</span>
                    <span className="metric-value">{destination.weather.windSpeed} km/h</span>
                  </div>
                  <div className="weather-metric">
                    <span className="metric-label">High / Low</span>
                    <span className="metric-value">
                      {destination.weather.maxTemp}° / {destination.weather.minTemp}°
                    </span>
                  </div>
                </div>

                {destination.weather.advisory && (
                  <div className="dest-weather-advisory">
                    <strong>💡 {t("advisory")}:</strong> {destination.weather.advisory}
                  </div>
                )}
              </div>
            ) : (
              <div className="dest-weather-unavailable">
                <p>Live weather observation is temporarily unavailable for this exact coordinate.</p>
              </div>
            )}
          </section>
        </div>

        {/* 4. VERIFIED PHOTO GALLERY WITH FULLSCREEN LIGHTBOX */}
        <section className="dest-section dest-gallery-section">
          <div className="dest-section-header">
            <h2>📸 {t("gallery_heading")}</h2>
            <span className="dest-section-sub">
              Genuine licensed photography from Wikimedia Commons
            </span>
          </div>

          {Array.isArray(destination.gallery) && destination.gallery.length > 0 ? (
            <div className="dest-gallery-grid">
              {destination.gallery.map((photo, idx) => (
                <figure
                  key={idx}
                  className="dest-photo-card"
                  onClick={() => setLightboxIndex(idx)}
                >
                  <img
                    src={photo.url}
                    alt={photo.title || `${destination.title} photo`}
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <figcaption className="dest-photo-caption">
                    <span className="photo-title">{photo.title || destination.title}</span>
                    <span className="photo-attribution">© {photo.attribution}</span>
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : (
            <p className="dest-empty-text">No photographic gallery available for this destination.</p>
          )}
        </section>

        {/* 5. TOP NEARBY ATTRACTIONS */}
        <section className="dest-section dest-attractions-section">
          <div className="dest-section-header">
            <h2>🧭 {t("attractions_heading")}</h2>
            <span className="dest-section-sub">
              Notable points of interest within 10 km radius via geosearch
            </span>
          </div>

          {Array.isArray(destination.attractions) && destination.attractions.length > 0 && (
            <div className="dest-route-planner-bar">
              <div className="route-bar-info">
                <span className="route-bar-icon">🗺️</span>
                <div>
                  <strong>Multi-Stop Route Planner ({selectedAttractions.length} / {destination.attractions.length} Selected)</strong>
                  <p>Pick landmarks below to calculate the optimal shortest road route connecting them.</p>
                </div>
              </div>

              <div className="route-bar-buttons">
                {selectedAttractions.length < destination.attractions.length ? (
                  <button
                    type="button"
                    className="route-bar-btn outline"
                    onClick={selectAllAttractions}
                  >
                    Select All ({destination.attractions.length})
                  </button>
                ) : (
                  <button
                    type="button"
                    className="route-bar-btn outline"
                    onClick={clearSelectedAttractions}
                  >
                    Clear Selection
                  </button>
                )}

                {selectedAttractions.length > 0 && (
                  <Link to={getMultiStopRouteUrl()} className="route-bar-btn primary">
                    🧭 Calculate Route ({selectedAttractions.length + 1} Points) →
                  </Link>
                )}
              </div>
            </div>
          )}

          {Array.isArray(destination.attractions) && destination.attractions.length > 0 ? (
            <div className="dest-attractions-grid">
              {destination.attractions.map((item, idx) => {
                const isSelected = selectedAttractions.some((a) => a.name === item.name);
                const navUrl = `/navigate?lat=${item.coordinates?.lat}&lng=${item.coordinates?.lon}&name=${encodeURIComponent(item.name)}&destination=${encodeURIComponent(destination.title)}`;
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.name + " " + destination.title)}`;

                return (
                  <article key={idx} className={`dest-attraction-card ${isSelected ? "selected-card" : ""}`}>
                    {item.image && (
                      <div className="attraction-thumb-wrap">
                        <img
                          src={item.image}
                          alt={item.name}
                          loading="lazy"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                        <span className="attraction-dist-badge">
                          ~{item.distanceKm} km away
                        </span>
                        {isSelected && (
                          <span className="attraction-selected-badge">
                            ✓ In Route
                          </span>
                        )}
                      </div>
                    )}

                    <div className="attraction-body">
                      <h3 className="attraction-title">{item.name}</h3>
                      <p className="attraction-desc">{item.description}</p>

                      <div className="attraction-meta-row">
                        <span>🕒 {item.openingHours}</span>
                        <span>⏱️ {item.duration}</span>
                      </div>

                      <div className="attraction-actions">
                        <button
                          type="button"
                          className={`attraction-route-toggle-btn ${isSelected ? "active" : ""}`}
                          onClick={() => toggleAttractionSelection(item)}
                        >
                          {isSelected ? "✓ In Route" : "+ Add to Route"}
                        </button>
                        <Link to={navUrl} className="attraction-nav-btn">
                          🧭 {t("navigate")}
                        </Link>
                        <a
                          href={googleMapsUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="attraction-external-btn"
                          title="Open in Google Maps"
                        >
                          🗺️ {t("directions_google")}
                        </a>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="dest-empty-card">
              <p>No adjacent tourist landmarks cataloged within 10km.</p>
            </div>
          )}
        </section>

        {/* 6. CURATED THINGS TO DO */}
        {Array.isArray(destination.thingsToDo) && destination.thingsToDo.length > 0 && (
          <section className="dest-section dest-things-section">
            <div className="dest-section-header">
              <h2>🎒 {t("things_to_do")}</h2>
              <span className="dest-section-sub">
                Recommended activities and experiences in {destination.title}
              </span>
            </div>

            <div className="dest-things-grid">
              {destination.thingsToDo.map((group, idx) => (
                <div key={idx} className="dest-thing-card">
                  <div className="dest-thing-header">
                    <span className="thing-icon">{group.icon}</span>
                    <h3>{group.category}</h3>
                  </div>
                  <ul className="thing-list">
                    {group.items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 6B. STRUCTURED ITINERARY & TRIP PLANNER CROSS-LINKING */}
        <section className="dest-section dest-itinerary-section">
          <div className="dest-section-header">
            <h2>📅 Day-by-Day Travel Itinerary</h2>
            <span className="dest-section-sub">
              Pre-structured sightseeing schedule ready for 1-click transfer into your ExploreX Trip Planner
            </span>
          </div>

          <div className="itinerary-controls-bar">
            <div className="itinerary-duration-tabs">
              {[1, 2, 3, 5].map((d) => (
                <button
                  key={d}
                  type="button"
                  className={`duration-tab-btn ${itineraryDays === d ? "active" : ""}`}
                  onClick={() => setItineraryDays(d)}
                >
                  {d} {d === 1 ? "Day Express" : d === 2 ? "Days Weekend" : d === 3 ? "Days Explorer" : "Days Grand"}
                </button>
              ))}
            </div>

            <Link to={getTripPlannerTransferUrl()} className="itinerary-transfer-cta-btn">
              ✈️ Transfer {itineraryDays}-Day Itinerary to Trip Planner →
            </Link>
          </div>

          <div className="itinerary-days-grid">
            {getGeneratedItinerary(itineraryDays).map((dayPlan) => (
              <div key={dayPlan.day} className="itinerary-day-card">
                <div className="day-card-header">
                  <span className="day-badge">Day {dayPlan.day}</span>
                  <h4>{dayPlan.title}</h4>
                </div>
                <ul className="day-activities-list">
                  {dayPlan.activities.map((act, actIdx) => (
                    <li key={actIdx}>
                      <span className="act-bullet">📍</span>
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 7. TRAVEL ESSENTIALS & LOGISTICS */}
        {destination.travelInfo && (
          <section className="dest-section dest-essentials-section">
            <div className="dest-section-header">
              <h2>🧳 {t("travel_essentials")}</h2>
              <span className="dest-section-sub">
                Transit, local mobility, and traveler advisories
              </span>
            </div>

            <div className="dest-essentials-grid">
              <div className="essential-card transit-card">
                <h3>✈️ {t("how_to_reach")}</h3>
                <ul>
                  <li>
                    <strong>{t("air")}:</strong> {destination.travelInfo.howToReach?.air}
                  </li>
                  <li>
                    <strong>{t("rail")}:</strong> {destination.travelInfo.howToReach?.rail}
                  </li>
                  <li>
                    <strong>{t("road")}:</strong> {destination.travelInfo.howToReach?.road}
                  </li>
                </ul>
              </div>

              <div className="essential-card transport-card">
                <h3>🚕 {t("local_transport")}</h3>
                <p>{destination.travelInfo.localTransport}</p>

                <div className="ride-booking-quick-links">
                  <span>Quick Ride Booking:</span>
                  <div className="ride-pills">
                    <a
                      href="https://m.uber.com/looking"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ride-pill uber"
                    >
                      Uber ↗
                    </a>
                    <a
                      href="https://book.olacabs.com"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ride-pill ola"
                    >
                      Ola Cabs ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="essential-card safety-card">
                <h3>🛡️ Safety & Travel Tips</h3>
                <ul>
                  {destination.travelInfo.safetyTips?.map((tip, idx) => (
                    <li key={idx}>{tip}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        )}

        {/* 8. ESTIMATED BUDGET TIERS */}
        {destination.budget?.tiers && (
          <section className="dest-section dest-budget-section">
            <div className="dest-section-header">
              <h2>💰 {t("budget_heading")}</h2>
              <span className="dest-section-sub">
                Estimated daily expenditure guidelines (Seasonal rates may vary)
              </span>
            </div>

            <div className="dest-budget-grid">
              {destination.budget.tiers.map((tier, idx) => {
                const tierClass = idx === 0 ? "budget" : idx === 1 ? "standard" : "luxury";
                const tierIcon = idx === 0 ? "🎒" : idx === 1 ? "🏨" : "👑";

                return (
                  <div key={idx} className={`dest-budget-card ${tierClass}`}>
                    <div className="budget-card-header">
                      <span className="budget-icon">{tierIcon}</span>
                      <h3>{tier.tier}</h3>
                      <div className="budget-pricing">
                        <span className="price-inr">{tier.dailyEstimateINR}</span>
                        <span className="price-usd">({tier.dailyEstimateUSD})</span>
                      </div>
                    </div>

                    <ul className="budget-features">
                      <li>
                        <strong>Stay:</strong> {tier.stay}
                      </li>
                      <li>
                        <strong>Food:</strong> {tier.food}
                      </li>
                      <li>
                        <strong>Transit:</strong> {tier.transport}
                      </li>
                    </ul>

                    <div className="budget-card-footer">
                      <span className="budget-disclaimer">
                        *Realistic estimate per traveler per day
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 9. AUTHENTIC TRAVEL VIDEO GUIDE */}
        {(destination.videoEmbedUrl || destination.videoSearchUrl) && (
          <section className="dest-section dest-video-section">
            <div className="dest-section-header">
              <h2>🎥 {t("video_heading")}</h2>
              <span className="dest-section-sub">
                Curated travel guide and documentary visual tour for {destination.title}
              </span>
            </div>

            <div className="dest-video-card-wrap">
              {destination.videoEmbedUrl && (
                <div className="dest-video-container">
                  <iframe
                    title={`${destination.title} Travel Video Tour`}
                    src={destination.videoEmbedUrl}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  ></iframe>
                </div>
              )}

              <div className="dest-video-direct-bar">
                <div className="dest-video-direct-info">
                  <span>📹</span>
                  <span>Explore 4K travel documentaries, aerial tours, and local guides for {destination.title}</span>
                </div>
                <a
                  href={
                    destination.videoSearchUrl ||
                    `https://www.youtube.com/results?search_query=${encodeURIComponent(
                      destination.title + " travel guide 4k documentary"
                    )}`
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="dest-video-direct-btn"
                >
                  ▶ Watch on YouTube ↗
                </a>
              </div>
            </div>
          </section>
        )}

        {/* 10. CONTEXTUAL AI TRAVEL ASSISTANT & AUDIO GUIDE */}
        <section className="dest-section dest-ai-section">
          <div className="dest-section-header">
            <h2>🤖 AI Travel Assistant for {destination.title}</h2>
            <span className="dest-section-sub">
              Ask about history, customized itineraries, regional cuisine, packing checklists, or local safety
            </span>
          </div>

          <div className="dest-ai-container">
            {/* Suggested Prompt Chips */}
            <div className="dest-ai-prompt-chips">
              <span className="chips-label">💡 Suggested Questions:</span>
              <div className="chips-row">
                {getContextualPrompts().map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="ai-chip-btn"
                    onClick={() => handleSendAIQuestion(prompt)}
                    disabled={aiLoading}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Conversation Stream */}
            <div className="dest-ai-chat-box">
              {aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`dest-ai-msg ${msg.role === "user" ? "user-msg" : "ai-msg"}`}
                >
                  <div className="msg-header-row">
                    <span className="msg-author">
                      {msg.role === "user" ? "👤 You" : `🤖 ExploreX AI Guide`}
                    </span>
                    {msg.role === "assistant" && !msg.isGreeting && (
                      <span className={`msg-badge ${msg.isLiveAI ? "live-ai" : "dossier"}`}>
                        {msg.isLiveAI ? "✨ Live Gemini AI" : "📋 Verified Dossier Synthesis"}
                      </span>
                    )}
                    <span className="msg-time">{msg.time}</span>
                  </div>

                  <div className="msg-body">
                    {formatMarkdown(msg.text)}
                  </div>

                  {msg.role === "assistant" && !msg.isError && (
                    <div className="msg-audio-actions">
                      <button
                        type="button"
                        className={`msg-audio-btn ${activeSpeechMsgId === msg.id && isSpeaking ? "active" : ""}`}
                        onClick={() => handleToggleMessageSpeech(msg.id, msg.text)}
                        title={
                          activeSpeechMsgId === msg.id && isSpeaking
                            ? isPaused
                              ? "Resume Audio"
                              : "Pause Audio"
                            : "Listen to this answer"
                        }
                      >
                        <span>
                          {activeSpeechMsgId === msg.id && isSpeaking
                            ? isPaused
                              ? "▶️"
                              : "⏸️"
                            : "🔊"}
                        </span>
                        <span>
                          {activeSpeechMsgId === msg.id && isSpeaking
                            ? isPaused
                              ? "Resume"
                              : "Pause Audio"
                            : "Listen to Guide"}
                        </span>
                      </button>

                      {activeSpeechMsgId === msg.id && isSpeaking && (
                        <button
                          type="button"
                          className="msg-audio-stop-btn"
                          onClick={handleStopMessageSpeech}
                          title="Stop Audio"
                        >
                          ⏹️ Stop
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {aiLoading && (
                <div className="dest-ai-msg ai-msg loading-msg">
                  <div className="msg-header-row">
                    <span className="msg-author">🤖 ExploreX AI Guide</span>
                    <span className="msg-badge live-ai">Thinking...</span>
                  </div>
                  <div className="ai-typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              )}
            </div>

            {/* AI Input Form */}
            <form
              className="dest-ai-input-form"
              onSubmit={(e) => {
                e.preventDefault();
                handleSendAIQuestion();
              }}
            >
              <input
                type="text"
                className="dest-ai-input"
                placeholder={`Ask anything about ${destination.title} in ${language.toUpperCase()}...`}
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                disabled={aiLoading}
              />

              <button
                type="button"
                className={`ai-mic-btn ${isListening ? "listening" : ""}`}
                onClick={handleAIVoiceInput}
                disabled={!isSpeechRecognitionSupported || aiLoading}
                title={isListening ? "Listening..." : "Voice input"}
              >
                {isListening ? "🔴" : "🎙️"}
              </button>

              <button
                type="submit"
                className="dest-ai-send-btn"
                disabled={aiLoading || !aiInput.trim()}
              >
                ➤ Ask AI
              </button>
            </form>

            <div className="dest-ai-footer-links">
              <span>Need extended planning?</span>
              <Link
                to={`/ai-assistant?destination=${encodeURIComponent(destination.title)}`}
                className="dest-ai-fullscreen-link"
              >
                Open Fullscreen AI Tourist Assistant with {destination.title} Context ↗
              </Link>
            </div>
          </div>
        </section>

        {/* 11. INTERACTIVE LEAFLET MAP */}
        <section id="dest-map-section" className="dest-section dest-map-section">
          <div className="dest-section-header">
            <h2>🗺️ Interactive Map & Points of Interest</h2>
            <span className="dest-section-sub">
              Explore {destination.title} and surrounding attractions geographically
            </span>
          </div>

          <div className="dest-map-wrapper">
            <div ref={mapContainerRef} className="dest-leaflet-map"></div>
          </div>

          <div className="dest-map-footer">
            <Link
              to={
                selectedAttractions.length > 0
                  ? getMultiStopRouteUrl()
                  : `/navigate?lat=${destination.coordinates?.lat}&lng=${destination.coordinates?.lon}&name=${encodeURIComponent(destination.title)}`
              }
              className="dest-btn-primary"
            >
              🧭 {selectedAttractions.length > 0 ? `Calculate Route (${selectedAttractions.length + 1} Points)` : "Open in ExploreX Shortest Route Navigator"}
            </Link>
            <Link
              to={getTripPlannerTransferUrl()}
              className="dest-btn-secondary"
            >
              ✈️ Transfer {itineraryDays}-Day Itinerary to Trip Planner
            </Link>
          </div>
        </section>
      </main>

      {/* 11. FULLSCREEN LIGHTBOX MODAL */}
      {lightboxIndex !== null && destination.gallery?.[lightboxIndex] && (
        <div
          className="dest-lightbox-overlay"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-label="Image preview"
        >
          <div className="dest-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close image"
            >
              ✕
            </button>

            <button
              type="button"
              className="lightbox-nav-btn prev"
              onClick={() =>
                setLightboxIndex((prev) =>
                  prev > 0 ? prev - 1 : destination.gallery.length - 1
                )
              }
              aria-label="Previous photo"
            >
              ❮
            </button>

            <img
              src={destination.gallery[lightboxIndex].url}
              alt={destination.gallery[lightboxIndex].title}
              className="lightbox-img"
            />

            <button
              type="button"
              className="lightbox-nav-btn next"
              onClick={() =>
                setLightboxIndex((prev) =>
                  prev < destination.gallery.length - 1 ? prev + 1 : 0
                )
              }
              aria-label="Next photo"
            >
              ❯
            </button>

            <div className="lightbox-caption">
              <h4>{destination.gallery[lightboxIndex].title || destination.title}</h4>
              <p>© {destination.gallery[lightboxIndex].attribution}</p>
              <span className="lightbox-counter">
                {lightboxIndex + 1} / {destination.gallery.length}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Destination_Details;
