import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import Gem3DViewer from "../components/3d/Gem3DViewer";
import {
  TajMahalModel,
  CharminarModel,
  RedFortModel,
  HawaMahalModel,
  IndiaGateModel,
  MysorePalaceModel,
  KonarkTempleModel,
  HotspotMarker,
} from "../components/3d/Monument3DModels";
import {
  getHiddenGems,
  getMyHiddenGems,
  submitHiddenGemWithPhotos,
  getHiddenGemStatus,
  retryHiddenGemReconstruction,
  getAllHiddenGemsAdmin,
  updateHiddenGemStatusAdmin,
} from "../services/api";

// 7 Famous Indian Destinations with verified architectural dossiers & hotspots
const FAMOUS_MONUMENTS = [
  {
    id: "taj-mahal",
    name: "Taj Mahal",
    city: "Agra",
    state: "Uttar Pradesh",
    country: "India",
    unesco: "UNESCO World Heritage Site (1983)",
    builtYear: "1632 – 1648 CE",
    architect: "Ustad Ahmad Lahori (Patron: Emperor Shah Jahan)",
    style: "Mughal Architecture (Indo-Islamic with Persian Influences)",
    material: "Makrana White Marble with Pietra Dura Semi-Precious Stone Inlays",
    coordinates: { lat: 27.1751, lng: 78.0421 },
    component: TajMahalModel,
    description:
      "Commissioned by Mughal Emperor Shah Jahan as a mausoleum for his favorite wife Mumtaz Mahal, the Taj Mahal represents the pinnacle of Mughal architectural symmetry, balance, and fine masonry craftsmanship.",
    hotspots: [
      {
        id: "dome",
        name: "Central Onion Dome",
        position: [0, 4.4, 0],
        description:
          "The crowning marble dome stands 35 meters tall upon a cylindrical drum. Its bulbous shape is accentuated by a lotus motif finial combining Hindu and Islamic decorative iconography.",
      },
      {
        id: "minarets",
        name: "Four Corner Minarets",
        position: [-3.4, 3.2, 3.4],
        description:
          "Each 40-meter minaret is engineered with three balconied tiers. Historically, they were deliberately tilted slightly outward so that in the event of an earthquake, they would collapse away from the central tomb.",
      },
      {
        id: "pishtaq",
        name: "Main Pishtaq (Iwan) Portal",
        position: [0, 1.8, 2.2],
        description:
          "The grand vaulted entrance archway is bordered by delicate black marble calligraphic inscriptions from the Quran and Pietra Dura floral borders that remain vibrant after nearly 400 years.",
      },
      {
        id: "charbagh",
        name: "Charbagh Reflecting Pool",
        position: [0, 0.4, 4.8],
        description:
          "The Persian four-quadrant garden symbolizes the gardens of Paradise, featuring a central raised marble water reservoir that produces the world-renowned perfect mirror reflection of the monument.",
      },
    ],
  },
  {
    id: "charminar",
    name: "Charminar",
    city: "Hyderabad",
    state: "Telangana",
    country: "India",
    unesco: "Tentative UNESCO World Heritage Site",
    builtYear: "1591 CE",
    architect: "Mir Momin Astarabadi (Patron: Sultan Muhammad Quli Qutb Shah)",
    style: "Indo-Islamic Qutb Shahi Architecture",
    material: "Granite, Limestone, Mortar, and Pulverized Marble",
    coordinates: { lat: 17.3616, lng: 78.4747 },
    component: CharminarModel,
    description:
      "Constructed to commemorate the end of a deadly plague and mark the founding of Hyderabad, Charminar is a square monument famous for its four grand arches facing cardinal directions and four soaring 56-meter minarets.",
    hotspots: [
      {
        id: "arches",
        name: "Four Grand Triumphal Arches",
        position: [0, 1.8, 2.7],
        description:
          "Four 11-meter wide pointed arches open onto cardinal historical royal avenues, creating dramatic ventilation corridors that naturally cool the central courtyard.",
      },
      {
        id: "minarets",
        name: "56-Meter Fluted Minarets",
        position: [2.4, 4.5, 2.4],
        description:
          "The four minarets contain 149 winding spiral stone steps leading to an upper open-air viewing gallery overlooking the historic Laad Bazaar and Mecca Masjid.",
      },
      {
        id: "balcony",
        name: "Ornate Stucco Balcony Gallery",
        position: [0, 3.8, 1.6],
        description:
          "The upper storey houses an ancient mosque at the western end and intricate plasterwork arabesques adorned with floral Qutb Shahi motifs.",
      },
    ],
  },
  {
    id: "red-fort",
    name: "Red Fort (Lal Qila)",
    city: "Delhi",
    state: "Delhi NCR",
    country: "India",
    unesco: "UNESCO World Heritage Site (2007)",
    builtYear: "1638 – 1648 CE",
    architect: "Ustad Ahmad Lahori (Patron: Emperor Shah Jahan)",
    style: "Mughal Palatial & Fortification Architecture",
    material: "Red Sandstone and White Marble",
    coordinates: { lat: 28.6562, lng: 77.241 },
    component: RedFortModel,
    description:
      "The fortified royal citadel of the Mughal capital Shahjahanabad. Enclosed by massive 2.5-kilometer red sandstone ramparts, it served as the center of Mughal governance and remains a sovereign symbol of modern India.",
    hotspots: [
      {
        id: "lahore-gate",
        name: "Lahore Gate Portal",
        position: [0, 2.0, 1.8],
        description:
          "The monumental public entrance facing the city of Lahore. On Independence Day, the Prime Minister of India unfurls the national flag from its ramparts.",
      },
      {
        id: "bastions",
        name: "Octagonal Defensive Bastions",
        position: [-2.2, 3.2, 1.4],
        description:
          "Towering octagonal bastions capped with marble chattris that protected the Mughal emperors against artillery fire during historical sieges.",
      },
      {
        id: "chattris",
        name: "Marble Kiosk Chattris",
        position: [0, 4.1, 1.4],
        description:
          "Seven domed white marble kiosks that provide architectural lightness to the otherwise foreboding military ramparts.",
      },
    ],
  },
  {
    id: "hawa-mahal",
    name: "Hawa Mahal (Palace of Winds)",
    city: "Jaipur",
    state: "Rajasthan",
    country: "India",
    unesco: "UNESCO World Heritage City (Jaipur)",
    builtYear: "1799 CE",
    architect: "Lal Chand Ustad (Patron: Maharaja Sawai Pratap Singh)",
    style: "Rajput Architecture with Islamic Mughal Accents",
    material: "Red and Pink Sandstone with White Lime Inlay",
    coordinates: { lat: 26.9239, lng: 75.8267 },
    component: HawaMahalModel,
    description:
      "A unique five-storey stepped pyramidal facade mimicking the crown of Lord Krishna. Featuring 953 intricately carved stone jharokhas, it allowed royal ladies to observe vibrant city life without violating strict purdah customs.",
    hotspots: [
      {
        id: "jharokhas",
        name: "953 Casement Jharokha Windows",
        position: [0, 2.4, 0.9],
        description:
          "Intricately carved sandstone projecting balconies featuring miniature fluted domelets and delicate filigree screens.",
      },
      {
        id: "venturi",
        name: "Venturi Effect Air Channels",
        position: [-0.9, 2.0, 0.8],
        description:
          "A masterpiece of passive environmental engineering: miniature breeze openings compress air passing through, dropping ambient temperatures during sweltering desert summers.",
      },
      {
        id: "crown",
        name: "Pyramidal Crown Roofline",
        position: [0, 5.2, -0.2],
        description:
          "The top three floors are just one room wide, forming an ultra-slender silhouette inspired by the jeweled crown of Hindu deity Krishna.",
      },
    ],
  },
  {
    id: "india-gate",
    name: "India Gate",
    city: "New Delhi",
    state: "Delhi NCR",
    country: "India",
    unesco: "National War Memorial Monument",
    builtYear: "1921 – 1931 CE",
    architect: "Sir Edwin Lutyens",
    style: "Neo-Classical Triumphal Arch",
    material: "Pale Red and Yellow Bharatpur Sandstone",
    coordinates: { lat: 28.6129, lng: 77.2295 },
    component: IndiaGateModel,
    description:
      "A solemn 42-meter triumphal arch memorial commemorating 84,000 soldiers of the British Indian Army who lost their lives in World War I and the Third Anglo-Afghan War, with over 13,000 soldier names inscribed on its walls.",
    hotspots: [
      {
        id: "arch",
        name: "Grand Memorial Archway",
        position: [0, 2.6, 0],
        description:
          "Standing 42 meters high, the central archway frames the Kartavya Path vista stretching to Rashtrapati Bhavan.",
      },
      {
        id: "attic",
        name: "Inscribed Cornice Attic",
        position: [0, 4.8, 1.4],
        description:
          "The upper frieze carries the bold inscription 'INDIA' flanked by the Roman dates MCMXIV (1914) and MCMXIX (1919).",
      },
      {
        id: "amar-jawan",
        name: "Amar Jawan Jyoti",
        position: [0, 0.9, 0],
        description:
          "A black marble cenotaph with an inverted L1A1 self-loading rifle crowned by a war helmet, guarded by an eternal flame symbolizing the immortal sacrifice of Indian soldiers.",
      },
    ],
  },
  {
    id: "mysore-palace",
    name: "Mysore Palace (Amba Vilas)",
    city: "Mysuru",
    state: "Karnataka",
    country: "India",
    unesco: "Heritage Palace of Karnataka",
    builtYear: "1897 – 1912 CE",
    architect: "Henry Irwin (Patron: Maharaja Krishnaraja Wadiyar IV)",
    style: "Indo-Saracenic (Hindu, Mughal, Rajput, and Gothic Blend)",
    material: "Fine Gray Granite with Deep Pink Marble Domes",
    coordinates: { lat: 12.3051, lng: 76.6551 },
    component: MysorePalaceModel,
    description:
      "The official residence of the Wadiyar royal dynasty. With over 97,000 electric bulbs illuminating its facade during the grand Dasara festival, it is one of the most visited monuments on the Indian subcontinent.",
    hotspots: [
      {
        id: "central-dome",
        name: "Central 145-Foot Gold-Finial Tower",
        position: [0, 5.6, 0],
        description:
          "A soaring five-tier central granite tower capped by a vibrant rose-pink marble dome with a towering gilded brass finial.",
      },
      {
        id: "durbar",
        name: "Durbar Hall Columned Arcade",
        position: [0, 1.8, 1.9],
        description:
          "Massive sculpted granite columns adorned with peacock motifs, Italian marble mosaic floors, and stained glass ceilings imported from Glasgow.",
      },
      {
        id: "corner-domes",
        name: "Octagonal Corner Pavilions",
        position: [4.1, 4.2, 1.6],
        description:
          "Four symmetrical corner towers blending gothic verticality with traditional Rajput chattris, crowned with deep crimson stone cupolas.",
      },
    ],
  },
  {
    id: "konark-temple",
    name: "Konark Sun Temple",
    city: "Konark",
    state: "Odisha",
    country: "India",
    unesco: "UNESCO World Heritage Site (1984)",
    builtYear: "c. 1250 CE",
    architect: "Bisu Maharana (Patron: King Narasimhadeva I)",
    style: "Kalinga Architectural Style (Orissan Rekha & Bhadra)",
    material: "Khondalite and Chlorite Stone",
    coordinates: { lat: 19.8876, lng: 86.0945 },
    component: KonarkTempleModel,
    description:
      "Conceived as a colossal stone chariot of the Sun God Surya, complete with 24 carved stone wheels serving as astronomical sundials and seven roaring horses surging towards the Bay of Bengal at sunrise.",
    hotspots: [
      {
        id: "jagamohana",
        name: "Stepped Pyramid Jagamohana",
        position: [0, 3.8, 0],
        description:
          "The 39-meter high audience sanctuary featuring three diminishing stepped tiers (Pidha Deula) crowned by a massive fluted disc (Amalaka).",
      },
      {
        id: "wheels",
        name: "24 Carved Sun Chariot Wheels",
        position: [2.2, 0.9, 3.8],
        description:
          "Each 3-meter wheel represents a fortnight of the Hindu calendar. The 8 spokes function as remarkably precise sundials predicting time to the exact minute by shadow position.",
      },
      {
        id: "horses",
        name: "Seven Galloping War Horses",
        position: [0, 1.1, 4.8],
        description:
          "Sculpted horses named after the seven meters of Sanskrit prosody (Gayatri, Ushnik, Anushtubh, Brihati, Pankti, Trishtubh, Jagati) drawing Surya across the cosmos.",
      },
    ],
  },
];

export default function Explore_3D() {
  const { user } = useAuth();

  // Active top-level tab
  const [activeTab, setActiveTab] = useState("famous"); // "famous", "community", "upload", "admin"

  // Famous Monuments State
  const [selectedMonumentId, setSelectedMonumentId] = useState("taj-mahal");
  const [activeHotspotId, setActiveHotspotId] = useState(null);

  // Community Hidden Gems State
  const [communityGems, setCommunityGems] = useState([]);
  const [loadingGems, setLoadingGems] = useState(false);
  const [gemSearch, setGemSearch] = useState("");
  const [gemCategory, setGemCategory] = useState("All");
  const [selectedGemFor3D, setSelectedGemFor3D] = useState(null);
  const [viewMode, setViewMode] = useState("3d"); // "3d" or "photos"

  // User submissions & processing tracker
  const [mySubmissions, setMySubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  // Upload Photo-to-3D Form State
  const [uploadForm, setUploadForm] = useState({
    name: "",
    description: "",
    location: "",
    country: "India",
    state: "",
    category: "Nature",
    historyAndSignificance: "",
    latitude: "",
    longitude: "",
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [filePreviews, setFilePreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState("");
  const [uploadError, setUploadError] = useState("");

  // Admin Review State
  const [allSubmissions, setAllSubmissions] = useState([]);
  const [loadingAdmin, setLoadingAdmin] = useState(false);
  const [adminStatusFilter, setAdminStatusFilter] = useState("Pending");
  const [adminReviewGem, setAdminReviewGem] = useState(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");
  const [approve3DModelCheck, setApprove3DModelCheck] = useState(true);

  const selectedMonument =
    FAMOUS_MONUMENTS.find((m) => m.id === selectedMonumentId) || FAMOUS_MONUMENTS[0];
  const Monument3DComponent = selectedMonument.component;

  // Fetch Community Approved Gems
  const fetchCommunityGems = async () => {
    try {
      setLoadingGems(true);
      const data = await getHiddenGems();
      setCommunityGems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load community gems:", err);
    } finally {
      setLoadingGems(false);
    }
  };

  // Fetch User's Submissions with 3D Status
  const fetchMySubmissions = async () => {
    if (!user) return;
    try {
      setLoadingSubmissions(true);
      const data = await getMyHiddenGems();
      setMySubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch user submissions:", err);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  // Fetch All Submissions for Admin
  const fetchAdminSubmissions = async () => {
    if (user?.role !== "admin") return;
    try {
      setLoadingAdmin(true);
      const data = await getAllHiddenGemsAdmin();
      setAllSubmissions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch admin submissions:", err);
    } finally {
      setLoadingAdmin(false);
    }
  };

  useEffect(() => {
    fetchCommunityGems();
    if (user) {
      fetchMySubmissions();
      if (user.role === "admin") {
        fetchAdminSubmissions();
      }
    }
  }, [user]);

  // Periodic polling for active 3D reconstruction jobs
  useEffect(() => {
    const hasActiveJobs = mySubmissions.some((s) =>
      ["Uploaded", "Waiting for processing", "Processing"].includes(s.processingStatus)
    );

    if (!hasActiveJobs) return;

    const timer = setInterval(() => {
      fetchMySubmissions();
    }, 3000);

    return () => clearInterval(timer);
  }, [mySubmissions]);

  // File selection & preview generation
  const handleFileChange = (e) => {
    setUploadError("");
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    if (files.length > 10) {
      setUploadError("Maximum 10 photographs can be submitted at once.");
      return;
    }

    // Validate size and extensions
    const validFiles = [];
    const newPreviews = [];

    for (const f of files) {
      if (f.size > 10 * 1024 * 1024) {
        setUploadError(`File "${f.name}" exceeds the 10MB limit.`);
        return;
      }
      validFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    }

    setSelectedFiles(validFiles);
    setFilePreviews(newPreviews);
  };

  const removeSelectedFile = (index) => {
    const updatedFiles = selectedFiles.filter((_, i) => i !== index);
    const updatedPreviews = filePreviews.filter((_, i) => i !== index);
    setSelectedFiles(updatedFiles);
    setFilePreviews(updatedPreviews);
  };

  // Handle Photo-to-3D Submission
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    setUploadError("");
    setUploadSuccess("");

    if (!user) {
      setUploadError("Please login to submit a hidden gem.");
      return;
    }

    if (selectedFiles.length === 0) {
      setUploadError("Please upload at least 1 photograph (3+ recommended for 3D photogrammetry).");
      return;
    }

    const formData = new FormData();
    formData.append("name", uploadForm.name.trim());
    formData.append("description", uploadForm.description.trim());
    formData.append("location", uploadForm.location.trim());
    formData.append("country", uploadForm.country.trim());
    formData.append("state", uploadForm.state.trim());
    formData.append("category", uploadForm.category);
    formData.append("historyAndSignificance", uploadForm.historyAndSignificance.trim());
    if (uploadForm.latitude) formData.append("latitude", uploadForm.latitude);
    if (uploadForm.longitude) formData.append("longitude", uploadForm.longitude);

    selectedFiles.forEach((file) => {
      formData.append("photos", file);
    });

    try {
      setUploading(true);
      const res = await submitHiddenGemWithPhotos(formData);
      setUploadSuccess(res.message || "Submitted successfully! 3D reconstruction initiated.");

      // Reset form
      setUploadForm({
        name: "",
        description: "",
        location: "",
        country: "India",
        state: "",
        category: "Nature",
        historyAndSignificance: "",
        latitude: "",
        longitude: "",
      });
      setSelectedFiles([]);
      setFilePreviews([]);

      // Refresh list
      await fetchMySubmissions();
    } catch (err) {
      console.error("Submission error:", err);
      setUploadError(err.message || "Failed to submit photographs.");
    } finally {
      setUploading(false);
    }
  };

  // Retry Reconstruction
  const handleRetryJob = async (gemId) => {
    try {
      await retryHiddenGemReconstruction(gemId);
      await fetchMySubmissions();
    } catch (err) {
      alert(err.message || "Failed to retry reconstruction.");
    }
  };

  // Admin: Approve or Reject
  const handleAdminAction = async (status) => {
    if (!adminReviewGem) return;
    try {
      await updateHiddenGemStatusAdmin(adminReviewGem._id, {
        status,
        rejectionReason: rejectionReasonInput,
        approve3DModel: approve3DModelCheck,
      });
      setAdminReviewGem(null);
      setRejectionReasonInput("");
      await fetchAdminSubmissions();
      await fetchCommunityGems();
    } catch (err) {
      alert(err.message || "Failed to update review status.");
    }
  };

  // Filtered Community Gems
  const filteredGems = communityGems.filter((gem) => {
    const matchesSearch =
      gem.name.toLowerCase().includes(gemSearch.toLowerCase()) ||
      gem.location.toLowerCase().includes(gemSearch.toLowerCase());
    const matchesCategory = gemCategory === "All" || gem.category === gemCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <main className="explore-3d-page">
      {/* ================= PAGE HEADER ================= */}
      <div className="explore-3d-header">
        <span className="ai-header-badge">🏛️ {t("three_d_badge")}</span>
        <h1>{t("three_d_title")}</h1>
        <p>{t("three_d_subtitle")}</p>

        {/* Navigation Tabs */}
        <div className="explore-3d-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === "famous" ? "active" : ""}`}
            onClick={() => setActiveTab("famous")}
          >
            🏛️ {t("three_d_tab_monuments", { count: FAMOUS_MONUMENTS.length })}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "community" ? "active" : ""}`}
            onClick={() => setActiveTab("community")}
          >
            💎 {t("three_d_tab_gems", { count: communityGems.length })}
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === "upload" ? "active" : ""}`}
            onClick={() => setActiveTab("upload")}
          >
            📸 {t("three_d_tab_reconstruct")}
          </button>
          {user?.role === "admin" && (
            <button
              type="button"
              className={`tab-btn admin ${activeTab === "admin" ? "active" : ""}`}
              onClick={() => setActiveTab("admin")}
            >
              🛡️ {t("three_d_tab_admin")}
            </button>
          )}
        </div>
      </div>

      {/* =========================================================
          TAB 1: FAMOUS 3D MONUMENTS SHOWCASE
         ========================================================= */}
      {activeTab === "famous" && (
        <section className="famous-3d-section">
          {/* Monument Selector Carousel */}
          <div className="monument-pills-bar">
            {FAMOUS_MONUMENTS.map((m) => (
              <button
                key={m.id}
                type="button"
                className={`monument-pill ${selectedMonumentId === m.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedMonumentId(m.id);
                  setActiveHotspotId(null);
                }}
              >
                <strong>{m.name}</strong>
                <small>{m.city}</small>
              </button>
            ))}
          </div>

          {/* 3D Model Display Grid */}
          <div className="monument-viewer-layout">
            {/* Left: 3D Interactive Canvas */}
            <div className="monument-canvas-wrapper">
              <Gem3DViewer
                title={selectedMonument.name}
                customChildren={
                  <group>
                    <Monument3DComponent
                      activeHotspot={activeHotspotId}
                      onHotspotClick={() => {}}
                    />
                    {/* Render clickable 3D Hotspot pins in world space */}
                    {selectedMonument.hotspots.map((h) => (
                      <HotspotMarker
                        key={h.id}
                        position={h.position}
                        label={h.name}
                        isActive={activeHotspotId === h.id}
                        onClick={() =>
                          setActiveHotspotId(activeHotspotId === h.id ? null : h.id)
                        }
                      />
                    ))}
                  </group>
                }
              />

              {/* Active Hotspot Detail Card */}
              {activeHotspotId && (
                <div className="active-hotspot-card">
                  <div className="hotspot-header">
                    <h4>📍 Architectural Hotspot: {selectedMonument.hotspots.find((h) => h.id === activeHotspotId)?.name}</h4>
                    <button
                      type="button"
                      className="close-hotspot-btn"
                      onClick={() => setActiveHotspotId(null)}
                    >
                      ✕
                    </button>
                  </div>
                  <p>{selectedMonument.hotspots.find((h) => h.id === activeHotspotId)?.description}</p>
                </div>
              )}
            </div>

            {/* Right: Architectural Dossier Panel */}
            <aside className="monument-info-panel">
              <div className="monument-title-badge">
                <span className="heritage-badge">{selectedMonument.unesco}</span>
                <h2>{selectedMonument.name}</h2>
                <p className="monument-loc">
                  📍 {selectedMonument.city}, {selectedMonument.state}, {selectedMonument.country}
                </p>
              </div>

              <div className="monument-spec-grid">
                <div className="spec-item">
                  <span className="spec-label">Era / Year</span>
                  <strong>{selectedMonument.builtYear}</strong>
                </div>
                <div className="spec-item">
                  <span className="spec-label">Architectural Style</span>
                  <strong>{selectedMonument.style}</strong>
                </div>
                <div className="spec-item full">
                  <span className="spec-label">Architect & Patron</span>
                  <strong>{selectedMonument.architect}</strong>
                </div>
                <div className="spec-item full">
                  <span className="spec-label">Construction Material</span>
                  <strong>{selectedMonument.material}</strong>
                </div>
              </div>

              <div className="monument-desc-box">
                <h4>{t("three_d_historical_bg")}</h4>
                <p>{selectedMonument.description}</p>
              </div>

              {/* Hotspot quick selectors */}
              <div className="hotspot-selector-box">
                <h4>{t("three_d_hotspots_heading", { count: selectedMonument.hotspots.length })}</h4>
                <div className="hotspot-tags">
                  {selectedMonument.hotspots.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      className={`hotspot-tag-btn ${activeHotspotId === h.id ? "active" : ""}`}
                      onClick={() =>
                        setActiveHotspotId(activeHotspotId === h.id ? null : h.id)
                      }
                    >
                      {activeHotspotId === h.id ? "🎯" : "📍"} {h.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Integrated Actions */}
              <div className="monument-action-row">
                <Link
                  to={`/navigate?destination=${selectedMonument.id}`}
                  className="monument-btn primary"
                >
                  🗺️ Navigate Here
                </Link>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedMonument.coordinates.lat},${selectedMonument.coordinates.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="monument-btn secondary"
                >
                  📍 Google Maps
                </a>
                <a
                  href={`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${selectedMonument.coordinates.lat}&dropoff[longitude]=${selectedMonument.coordinates.lng}&dropoff[nickname]=${encodeURIComponent(selectedMonument.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="monument-btn uber"
                >
                  🚕 Book Ride
                </a>
              </div>
            </aside>
          </div>
        </section>
      )}

      {/* =========================================================
          TAB 2: COMMUNITY 3D HIDDEN GEMS GALLERY
         ========================================================= */}
      {activeTab === "community" && (
        <section className="community-3d-section">
          {/* Search & Filter Controls */}
          <div className="community-filter-row">
            <input
              type="text"
              placeholder="🔍 Search hidden gems by name or location..."
              value={gemSearch}
              onChange={(e) => setGemSearch(e.target.value)}
              className="community-search-input"
            />
            <div className="community-category-pills">
              {["All", "Nature", "Historical", "Adventure", "Religious", "Beach", "Cultural", "Other"].map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`gem-pill ${gemCategory === cat ? "active" : ""}`}
                    onClick={() => setGemCategory(cat)}
                  >
                    {cat}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Modal / Expanded 3D Viewer for selected Hidden Gem */}
          {selectedGemFor3D && (
            <div className="gem-3d-modal-backdrop" onClick={() => setSelectedGemFor3D(null)}>
              <div className="gem-3d-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="gem-modal-header">
                  <div>
                    <span className="badge-3d-method">
                      {selectedGemFor3D.reconstructionMethod === "photogrammetry"
                        ? "🛰️ Multi-View Photogrammetry"
                        : "🤖 AI Monocular Depth Approximation"}
                    </span>
                    <h2>{selectedGemFor3D.name}</h2>
                    <p style={{ margin: 0, color: "#666" }}>
                      📍 {selectedGemFor3D.location}, {selectedGemFor3D.country} • Contributed by{" "}
                      <strong>{selectedGemFor3D.submittedBy?.name || "Explorer"}</strong>
                    </p>
                  </div>

                  <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                    {/* Switch between 3D and original photos */}
                    <div className="view-mode-toggle">
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "3d" ? "active" : ""}`}
                        onClick={() => setViewMode("3d")}
                      >
                        🕹️ 3D Model
                      </button>
                      <button
                        type="button"
                        className={`mode-btn ${viewMode === "photos" ? "active" : ""}`}
                        onClick={() => setViewMode("photos")}
                      >
                        📸 Photos ({selectedGemFor3D.photos?.length || 1})
                      </button>
                    </div>

                    <button
                      type="button"
                      className="close-modal-btn"
                      onClick={() => setSelectedGemFor3D(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>

                <div className="gem-modal-body">
                  {viewMode === "3d" ? (
                    <Gem3DViewer
                      title={selectedGemFor3D.name}
                      modelUrl={selectedGemFor3D.model3DUrl}
                      method={selectedGemFor3D.reconstructionMethod}
                    />
                  ) : (
                    <div className="gem-photos-carousel">
                      {selectedGemFor3D.photos && selectedGemFor3D.photos.length > 0 ? (
                        selectedGemFor3D.photos.map((p, i) => (
                          <div key={i} className="gem-photo-slide">
                            <img src={p} alt={`${selectedGemFor3D.name} angle ${i + 1}`} />
                            <span className="photo-index-tag">Photo {i + 1} of {selectedGemFor3D.photos.length}</span>
                          </div>
                        ))
                      ) : (
                        <img src={selectedGemFor3D.image} alt={selectedGemFor3D.name} style={{ width: "100%", maxHeight: "400px", objectFit: "cover", borderRadius: "10px" }} />
                      )}
                    </div>
                  )}

                  {/* Gem metadata dossier */}
                  <div className="gem-modal-details">
                    <div>
                      <h4>Description</h4>
                      <p>{selectedGemFor3D.description}</p>
                    </div>

                    {selectedGemFor3D.historyAndSignificance && (
                      <div>
                        <h4>Historical & Cultural Significance</h4>
                        <p>{selectedGemFor3D.historyAndSignificance}</p>
                      </div>
                    )}

                    <div className="gem-modal-actions">
                      <Link
                        to={`/navigate?destination=${selectedGemFor3D._id}`}
                        className="monument-btn primary"
                      >
                        🗺️ Navigate to Gem
                      </Link>
                      {selectedGemFor3D.latitude && selectedGemFor3D.longitude && (
                        <>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&destination=${selectedGemFor3D.latitude},${selectedGemFor3D.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="monument-btn secondary"
                          >
                            📍 Google Maps
                          </a>
                          <a
                            href={`https://m.uber.com/ul/?action=setPickup&dropoff[latitude]=${selectedGemFor3D.latitude}&dropoff[longitude]=${selectedGemFor3D.longitude}&dropoff[nickname]=${encodeURIComponent(selectedGemFor3D.name)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="monument-btn uber"
                          >
                            🚕 Book Ride
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Gems Grid */}
          {loadingGems ? (
            <p style={{ textAlign: "center", padding: "40px" }}>Loading 3D community gems...</p>
          ) : filteredGems.length === 0 ? (
            <div className="empty-state-box">
              <h3>No 3D hidden gems found in this category</h3>
              <p>Be the first traveler to capture and submit photographs of an offbeat destination!</p>
              <button
                type="button"
                className="monument-btn primary"
                onClick={() => setActiveTab("upload")}
              >
                📸 Submit a Hidden Gem
              </button>
            </div>
          ) : (
            <div className="community-gems-grid">
              {filteredGems.map((gem) => (
                <div key={gem._id} className="community-gem-card">
                  <div className="gem-card-image-wrap">
                    <img
                      src={gem.image || gem.photos?.[0] || "/placeholder.jpg"}
                      alt={gem.name}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                    <span className="gem-badge-method">
                      {gem.reconstructionMethod === "photogrammetry" ? "🛰️ Photogrammetry 3D" : "🤖 AI 3D Mesh"}
                    </span>
                    <span className="gem-badge-category">{gem.category}</span>
                  </div>

                  <div className="gem-card-content">
                    <h3>{gem.name}</h3>
                    <p className="gem-card-loc">📍 {gem.location}, {gem.country}</p>
                    <p className="gem-card-desc">{gem.description.slice(0, 100)}...</p>

                    <div className="gem-card-footer">
                      <span className="gem-card-contributor">
                        By {gem.submittedBy?.name || "Explorer"}
                      </span>
                      <button
                        type="button"
                        className="gem-card-explore-btn"
                        onClick={() => {
                          setSelectedGemFor3D(gem);
                          setViewMode("3d");
                        }}
                      >
                        🕹️ Explore 3D →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* =========================================================
          TAB 3: SUBMIT PHOTO-TO-3D GEM & PROCESSING TRACKER
         ========================================================= */}
      {activeTab === "upload" && (
        <section className="upload-3d-section">
          {/* Photography Guidelines Banner */}
          <div className="photo-guidelines-banner">
            <h3>📸 Guidelines for Successful 3D Reconstruction</h3>
            <p>
              ExploreX converts your real-world photographs into interactive 3D digital models.
              Follow these best practices to ensure high-fidelity reconstruction:
            </p>
            <div className="guidelines-grid">
              <div className="guideline-item">
                <span className="g-icon">🔄</span>
                <div>
                  <strong>Multi-Angle Coverage</strong>
                  <p>Shoot the place from 360° or multiple perspectives, walking around the exterior.</p>
                </div>
              </div>
              <div className="guideline-item">
                <span className="g-icon">📐</span>
                <div>
                  <strong>Visual Overlap (&gt;60%)</strong>
                  <p>Neighboring photographs must share at least 60% of the same features for point cloud matching.</p>
                </div>
              </div>
              <div className="guideline-item">
                <span className="g-icon">☀️</span>
                <div>
                  <strong>Even Lighting</strong>
                  <p>Overcast daylight works best; avoid harsh lens flares, extreme shadows, or night darkness.</p>
                </div>
              </div>
              <div className="guideline-item">
                <span className="g-icon">🎯</span>
                <div>
                  <strong>Clear &amp; Sharp Focus</strong>
                  <p>Avoid motion blur or moving objects (cars, pedestrians) in the camera frame.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="upload-layout-grid">
            {/* Left: Upload Form */}
            <div className="upload-form-card">
              <h3>Submit a Hidden Gem for 3D Reconstruction</h3>

              {uploadError && <div className="error-message" style={{ marginBottom: "14px" }}>⚠️ {uploadError}</div>}
              {uploadSuccess && <div className="success-message" style={{ marginBottom: "14px" }}>✅ {uploadSuccess}</div>}

              <form onSubmit={handleUploadSubmit}>
                <div className="form-group">
                  <label>Destination Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gandikota Grand Canyon Fort"
                    value={uploadForm.name}
                    onChange={(e) => setUploadForm({ ...uploadForm, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Location / City *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kadapa District"
                      value={uploadForm.location}
                      onChange={(e) => setUploadForm({ ...uploadForm, location: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>State</label>
                    <input
                      type="text"
                      placeholder="e.g. Andhra Pradesh"
                      value={uploadForm.state}
                      onChange={(e) => setUploadForm({ ...uploadForm, state: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Country *</label>
                    <input
                      type="text"
                      required
                      value={uploadForm.country}
                      onChange={(e) => setUploadForm({ ...uploadForm, country: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Category *</label>
                    <select
                      value={uploadForm.category}
                      onChange={(e) => setUploadForm({ ...uploadForm, category: e.target.value })}
                    >
                      <option value="Nature">Nature</option>
                      <option value="Historical">Historical</option>
                      <option value="Adventure">Adventure</option>
                      <option value="Religious">Religious</option>
                      <option value="Beach">Beach</option>
                      <option value="Cultural">Cultural</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Description *</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Describe this hidden spot, terrain, natural features, and how to reach it..."
                    value={uploadForm.description}
                    onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Historical, Cultural, or Geological Significance (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Local folklore, dynasty history, or ecological importance..."
                    value={uploadForm.historyAndSignificance}
                    onChange={(e) => setUploadForm({ ...uploadForm, historyAndSignificance: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Latitude (Optional)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 14.8143"
                      value={uploadForm.latitude}
                      onChange={(e) => setUploadForm({ ...uploadForm, latitude: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Longitude (Optional)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 78.2862"
                      value={uploadForm.longitude}
                      onChange={(e) => setUploadForm({ ...uploadForm, longitude: e.target.value })}
                    />
                  </div>
                </div>

                {/* Multiple Photograph Upload Input */}
                <div className="form-group">
                  <label>
                    Upload Photographs (3–10 photos recommended for photogrammetry) *
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    onChange={handleFileChange}
                    className="file-upload-input"
                  />
                  <small style={{ color: "#666" }}>
                    Supported: JPG, JPEG, PNG, WEBP (Max 10MB per image, up to 10 images)
                  </small>
                </div>

                {/* Thumbnail Previews */}
                {filePreviews.length > 0 && (
                  <div className="photo-previews-container">
                    <p style={{ margin: "6px 0", fontSize: "12px", fontWeight: "bold" }}>
                      Selected Photographs ({filePreviews.length}):
                    </p>
                    <div className="previews-grid">
                      {filePreviews.map((url, idx) => (
                        <div key={idx} className="preview-thumb-wrap">
                          <img src={url} alt={`Preview ${idx + 1}`} />
                          <button
                            type="button"
                            className="remove-thumb-btn"
                            onClick={() => removeSelectedFile(idx)}
                            title="Remove photo"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading}
                  className="submit-3d-gem-btn"
                >
                  {uploading
                    ? "Uploading & Initiating 3D Engine..."
                    : `🚀 Submit & Launch 3D Reconstruction (${selectedFiles.length} photos)`}
                </button>
              </form>
            </div>

            {/* Right: User's Processing Status Tracker */}
            <div className="my-submissions-card">
              <h3>My 3D Reconstructions &amp; Submissions</h3>
              <p style={{ fontSize: "13px", color: "#666", marginBottom: "16px" }}>
                Live tracking of your photo-to-3D reconstruction jobs and admin review statuses.
              </p>

              {loadingSubmissions ? (
                <p>Loading your submissions...</p>
              ) : mySubmissions.length === 0 ? (
                <p style={{ color: "#777", fontSize: "14px" }}>
                  You have not submitted any hidden gems yet. Fill out the form to upload your first 3D destination!
                </p>
              ) : (
                <div className="submissions-status-list">
                  {mySubmissions.map((gem) => (
                    <div key={gem._id} className="submission-job-item">
                      <div className="job-item-header">
                        <strong>{gem.name}</strong>
                        <span className={`status-pill ${gem.status.toLowerCase()}`}>
                          {gem.status}
                        </span>
                      </div>

                      <p style={{ margin: "4px 0", fontSize: "12px", color: "#555" }}>
                        📍 {gem.location} • {gem.photos?.length || 1} Photo(s) •{" "}
                        {gem.reconstructionMethod === "photogrammetry"
                          ? "Multi-View Photogrammetry"
                          : "AI Approximation"}
                      </p>

                      {/* 3D Engine Lifecycle Status Bar */}
                      <div className="reconstruction-lifecycle-box">
                        <div className="lifecycle-top">
                          <span className="lifecycle-state">
                            ⚙️ <strong>3D Status:</strong> {gem.processingStatus}
                          </span>
                          <span className="lifecycle-pct">
                            {gem.processingProgress || 0}%
                          </span>
                        </div>

                        {/* Progress Bar */}
                        <div className="progress-bar-track">
                          <div
                            className={`progress-bar-fill ${gem.processingStatus === "Processing failed" ? "failed" : ""}`}
                            style={{ width: `${gem.processingProgress || 0}%` }}
                          />
                        </div>

                        {gem.processingStep && (
                          <p className="lifecycle-step-text">
                            ℹ️ {gem.processingStep}
                          </p>
                        )}

                        {gem.processingError && (
                          <div className="job-error-box">
                            ⚠️ {gem.processingError}
                            <button
                              type="button"
                              className="retry-job-btn"
                              onClick={() => handleRetryJob(gem._id)}
                            >
                              🔄 Retry Reconstruction
                            </button>
                          </div>
                        )}

                        {gem.model3DUrl && (
                          <div className="job-model-ready">
                            <span>✅ 3D Model Compiled!</span>
                            <button
                              type="button"
                              className="preview-my-3d-btn"
                              onClick={() => {
                                setSelectedGemFor3D(gem);
                                setActiveTab("community");
                              }}
                            >
                              👁️ View 3D Model
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* =========================================================
          TAB 4: ADMIN 3D REVIEW DASHBOARD
         ========================================================= */}
      {activeTab === "admin" && user?.role === "admin" && (
        <section className="admin-review-section">
          <div className="admin-header-row">
            <div>
              <h2>🛡️ Administrator 3D &amp; Hidden Gem Review Portal</h2>
              <p style={{ color: "#666" }}>
                Inspect submitted photographs, verify 3D reconstructions, and approve or reject community content.
              </p>
            </div>

            {/* Filter by review status */}
            <div className="admin-status-filters">
              {["Pending", "Approved", "Rejected"].map((st) => (
                <button
                  key={st}
                  type="button"
                  className={`admin-filter-btn ${adminStatusFilter === st ? "active" : ""}`}
                  onClick={() => setAdminStatusFilter(st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {loadingAdmin ? (
            <p>Loading submissions for review...</p>
          ) : (
            <div className="admin-submissions-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Gem Name</th>
                    <th>Contributor</th>
                    <th>Photos</th>
                    <th>3D Status</th>
                    <th>Method</th>
                    <th>Review Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allSubmissions
                    .filter((s) => s.status === adminStatusFilter)
                    .map((gem) => (
                      <tr key={gem._id}>
                        <td>
                          <strong>{gem.name}</strong>
                          <br />
                          <small style={{ color: "#666" }}>{gem.location}</small>
                        </td>
                        <td>{gem.submittedBy?.name || "Unknown"}</td>
                        <td>{gem.photos?.length || 1}</td>
                        <td>
                          <span className="mono-tag">{gem.processingStatus}</span>
                        </td>
                        <td>
                          <span className="mono-tag">
                            {gem.reconstructionMethod === "photogrammetry" ? "Photogrammetry" : "AI Relief"}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill ${gem.status.toLowerCase()}`}>
                            {gem.status}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-inspect-btn"
                            onClick={() => {
                              setAdminReviewGem(gem);
                              setRejectionReasonInput(gem.rejectionReason || "");
                              setApprove3DModelCheck(Boolean(gem.model3DUrl));
                            }}
                          >
                            🔍 Inspect &amp; Decide
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Admin Decision Modal */}
          {adminReviewGem && (
            <div className="gem-3d-modal-backdrop" onClick={() => setAdminReviewGem(null)}>
              <div className="gem-3d-modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="gem-modal-header">
                  <h3>Admin Review: {adminReviewGem.name}</h3>
                  <button type="button" className="close-modal-btn" onClick={() => setAdminReviewGem(null)}>
                    ✕
                  </button>
                </div>

                <div className="admin-modal-body">
                  {/* Model preview or photo preview */}
                  {adminReviewGem.model3DUrl ? (
                    <Gem3DViewer
                      title={adminReviewGem.name}
                      modelUrl={adminReviewGem.model3DUrl}
                      method={adminReviewGem.reconstructionMethod}
                    />
                  ) : (
                    <div className="gem-photos-carousel">
                      {adminReviewGem.photos?.map((p, i) => (
                        <div key={i} className="gem-photo-slide">
                          <img src={p} alt={`Angle ${i + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginTop: "16px" }}>
                    <h4>Submission Details</h4>
                    <p><strong>Description:</strong> {adminReviewGem.description}</p>
                    <p><strong>Location:</strong> {adminReviewGem.location}, {adminReviewGem.country}</p>
                    {adminReviewGem.historyAndSignificance && (
                      <p><strong>History:</strong> {adminReviewGem.historyAndSignificance}</p>
                    )}

                    {/* Admin Action Controls */}
                    <div className="admin-decision-controls">
                      <div className="checkbox-wrap" style={{ marginBottom: "12px" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={approve3DModelCheck}
                            onChange={(e) => setApprove3DModelCheck(e.target.checked)}
                          />
                          Approve 3D Model container (uncheck to reject 3D model while keeping place listing)
                        </label>
                      </div>

                      <div className="form-group">
                        <label>Rejection Reason (if rejecting):</label>
                        <input
                          type="text"
                          placeholder="e.g. Inappropriate content, insufficient photographic clarity, or copyright issue"
                          value={rejectionReasonInput}
                          onChange={(e) => setRejectionReasonInput(e.target.value)}
                        />
                      </div>

                      <div style={{ display: "flex", gap: "12px", marginTop: "14px" }}>
                        <button
                          type="button"
                          className="admin-btn-approve"
                          onClick={() => handleAdminAction("Approved")}
                        >
                          ✅ Approve &amp; Publish Gem
                        </button>
                        <button
                          type="button"
                          className="admin-btn-reject"
                          onClick={() => handleAdminAction("Rejected")}
                        >
                          ❌ Reject Submission
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
