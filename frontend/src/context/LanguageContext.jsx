import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import { TRANSLATIONS } from "../locales";

// Supported 9 Languages with native scripts, TTS/STT speech codes, and flags
export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", speechCode: "en-US", flag: "🇬🇧" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", speechCode: "hi-IN", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", speechCode: "bn-IN", flag: "🇮🇳" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", speechCode: "te-IN", flag: "🇮🇳" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", speechCode: "ta-IN", flag: "🇮🇳" },
  { code: "kn", name: "Kannada", nativeName: "ಕನ್ನಡ", speechCode: "kn-IN", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", nativeName: "മലയാളം", speechCode: "ml-IN", flag: "🇮🇳" },
  { code: "es", name: "Spanish", nativeName: "Español", speechCode: "es-ES", flag: "🇪🇸" },
  { code: "fr", name: "French", nativeName: "Français", speechCode: "fr-FR", flag: "🇫🇷" },
];

export { TRANSLATIONS };

const LanguageContext = createContext(null);

export const LanguageProvider = ({ children }) => {
  // 1. Language selection persisted in localStorage
  const [language, setLanguageState] = useState(() => {
    try {
      const saved = localStorage.getItem("explorex_language");
      return saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved) ? saved : "en";
    } catch (e) {
      return "en";
    }
  });

  const setLanguage = (langCode) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === langCode)) return;
    setLanguageState(langCode);
    try {
      localStorage.setItem("explorex_language", langCode);
    } catch (e) {
      console.warn("Could not persist language to localStorage:", e);
    }
    // Stop any speech when switching languages
    stopSpeech();
  };

  // Helper for translated UI terms with safe fallback & parameter interpolation
  const t = (key, params) => {
    let text = TRANSLATIONS[language]?.[key] ?? TRANSLATIONS.en?.[key] ?? key;
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([paramKey, paramValue]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
      });
    }
    return text;
  };

  const currentLangConfig =
    SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  // 2. Speech Synthesis (TTS) State & Controls
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentlySpeakingText, setCurrentlySpeakingText] = useState("");
  const isSpeechSynthesisSupported = typeof window !== "undefined" && "speechSynthesis" in window;

  const currentUtteranceRef = useRef(null);

  // Clean raw markdown/HTML for natural speech audio
  const sanitizeForSpeech = (rawText) => {
    if (!rawText) return "";
    return rawText
      .replace(/<[^>]*>/g, " ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[#*_`~>]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  };

  const speak = (text, langOverride) => {
    if (!isSpeechSynthesisSupported) {
      console.warn(t("not_supported_tts"));
      return false;
    }

    const cleanText = sanitizeForSpeech(text);
    if (!cleanText) return false;

    // Cancel existing utterance
    window.speechSynthesis.cancel();

    const targetLangCode = langOverride || language;
    const targetConfig =
      SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode) || currentLangConfig;

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = targetConfig.speechCode;
    utterance.rate = 0.95;
    utterance.pitch = 1.0;

    // Pick best matching system voice if available
    const voices = window.speechSynthesis.getVoices?.() || [];
    const matchedVoice =
      voices.find((v) => v.lang === targetConfig.speechCode) ||
      voices.find((v) => v.lang.startsWith(targetLangCode));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setCurrentlySpeakingText(cleanText);
    };

    utterance.onpause = () => {
      setIsPaused(true);
    };

    utterance.onresume = () => {
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentlySpeakingText("");
    };

    utterance.onerror = (err) => {
      // 'interrupted' is normal when user clicks Stop or switches page
      if (err.error !== "interrupted" && err.error !== "canceled") {
        console.warn("Speech synthesis error:", err);
      }
      setIsSpeaking(false);
      setIsPaused(false);
      setCurrentlySpeakingText("");
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    return true;
  };

  const pauseSpeech = () => {
    if (!isSpeechSynthesisSupported || !isSpeaking) return;
    window.speechSynthesis.pause();
    setIsPaused(true);
  };

  const resumeSpeech = () => {
    if (!isSpeechSynthesisSupported || !isSpeaking) return;
    window.speechSynthesis.resume();
    setIsPaused(false);
  };

  const stopSpeech = () => {
    if (!isSpeechSynthesisSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentlySpeakingText("");
  };

  // Clean up speech synthesis on unmount
  useEffect(() => {
    return () => {
      if (isSpeechSynthesisSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeechSynthesisSupported]);

  // 3. Speech Recognition (STT Voice Search) State & Controls
  const [isListening, setIsListening] = useState(false);
  const [recognitionError, setRecognitionError] = useState(null);
  const recognitionRef = useRef(null);

  const isSpeechRecognitionSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startVoiceSearch = ({ onResult, onError, onEnd, langOverride }) => {
    if (!isSpeechRecognitionSupported) {
      const err = t("not_supported_stt");
      setRecognitionError(err);
      onError?.(err);
      return false;
    }

    // Abort prior recognition if active
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    const SpeechRecClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecClass();

    const targetLangCode = langOverride || language;
    const targetConfig =
      SUPPORTED_LANGUAGES.find((l) => l.code === targetLangCode) || currentLangConfig;

    recognition.lang = targetConfig.speechCode;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setRecognitionError(null);
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript?.trim() || "";
      if (transcript && onResult) {
        onResult(transcript);
      }
    };

    recognition.onerror = (event) => {
      let message = "Voice input error.";
      if (event.error === "no-speech") {
        message = "No speech detected. Please try speaking again.";
      } else if (event.error === "not-allowed") {
        message = "Microphone access was denied. Please allow microphone permission in your browser.";
      } else if (event.error === "network") {
        message = "Network error during speech recognition.";
      }
      setRecognitionError(message);
      onError?.(message);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      onEnd?.();
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      return true;
    } catch (e) {
      console.warn("Could not start speech recognition:", e);
      setIsListening(false);
      return false;
    }
  };

  const stopVoiceSearch = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
      recognitionRef.current = null;
    }
    setIsListening(false);
  };

  // 4. Dynamic Multilingual Translation via Backend Gemini endpoint
  const translationCacheRef = useRef(new Map());

  const translateText = async (text, targetLang = language) => {
    if (!text || targetLang === "en") {
      return { translatedText: text, targetLang: "en" };
    }

    const cacheKey = `${targetLang}:${text.trim()}`;
    if (translationCacheRef.current.has(cacheKey)) {
      return { translatedText: translationCacheRef.current.get(cacheKey), targetLang };
    }

    try {
      const res = await fetch("http://localhost:5000/api/destinations/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLang }),
      });

      if (res.ok) {
        const data = await res.json();
        const result = data.translatedText || text;
        translationCacheRef.current.set(cacheKey, result);
        return { translatedText: result, targetLang, fallback: Boolean(data.fallback) };
      }
    } catch (err) {
      console.warn("Translation request failed, using original text:", err.message);
    }

    return { translatedText: text, targetLang, fallback: true };
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        currentLangConfig,
        SUPPORTED_LANGUAGES,
        t,
        // Speech Synthesis (Audio Guide)
        isSpeaking,
        isPaused,
        currentlySpeakingText,
        speak,
        pauseSpeech,
        resumeSpeech,
        stopSpeech,
        isSpeechSynthesisSupported,
        // Speech Recognition (Voice Search)
        isListening,
        recognitionError,
        startVoiceSearch,
        stopVoiceSearch,
        isSpeechRecognitionSupported,
        // Dynamic Translation
        translateText,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
