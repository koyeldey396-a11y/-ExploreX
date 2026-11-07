import { useEffect, useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  getPlaces,
  createPlace,
  updatePlace,
  deletePlace,
  getFavorites,
  addFavorite,
  removeFavorite,
  getReviews,
  addReview,
  deleteReview,
  searchDestinationsApi,
} from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const CATEGORIES = [
  "Historical",
  "Nature",
  "Adventure",
  "Religious",
  "Beach",
  "Other",
];

const emptyForm = {
  name: "",
  description: "",
  category: "Historical",
  country: "",
  state: "",
  city: "",
  address: "",
  image: "",
  historicalInfo: "",
  latitude: "",
  longitude: "",
};

function Explore() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const {
    t,
    isListening,
    recognitionError,
    startVoiceSearch,
    stopVoiceSearch,
    isSpeechRecognitionSupported,
  } = useLanguage();

  const [places, setPlaces] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [editingId, setEditingId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [favoriteLoading, setFavoriteLoading] = useState(null);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Search, Filter & Sort State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [sortBy, setSortBy] = useState("newest"); // 'newest', 'name-asc', 'name-desc', 'highest-rated', 'most-reviews'

  // Global Destination Search & Autocomplete State
  const [searchQuery, setSearchQuery] = useState("");
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [globalDiscoveryList, setGlobalDiscoveryList] = useState([]);
  const searchWrapRef = useRef(null);

  // Review Modal State
  const [reviewModalPlace, setReviewModalPlace] = useState(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [commentInput, setCommentInput] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [reviewSuccess, setReviewSuccess] = useState("");

  // ================= FETCH DATA =================

  const fetchPlaces = async () => {
    try {
      const data = await getPlaces();
      setPlaces(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch places error:", err);
      setError(err.message || "Unable to load destinations.");
    }
  };

  const fetchFavorites = async () => {
    if (!user) {
      setFavorites([]);
      return;
    }
    try {
      const data = await getFavorites();
      setFavorites(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch favorites error:", err);
    }
  };

  const fetchAllReviews = async () => {
    try {
      const data = await getReviews();
      setReviews(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch reviews error:", err);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchPlaces(), fetchFavorites(), fetchAllReviews()]);
      setLoading(false);
    };
    loadData();
  }, [user]);

  // ================= GLOBAL SEARCH & AUTOCOMPLETE DEBOUNCE =================

  useEffect(() => {
    const query = searchQuery.trim();
    setSearchTerm(query);

    if (query.length < 2) {
      setAutocompleteResults([]);
      setGlobalDiscoveryList([]);
      setShowDropdown(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setSearchingGlobal(true);
        const list = await searchDestinationsApi(query);
        const items = Array.isArray(list) ? list : [];
        setAutocompleteResults(items);
        setGlobalDiscoveryList(items.filter((item) => !item.isLocal));
        setShowDropdown(items.length > 0);
      } catch (err) {
        console.warn("Global autocomplete error:", err);
      } finally {
        setSearchingGlobal(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Voice Search Handler
  const handleMicClick = () => {
    if (isListening) {
      stopVoiceSearch();
    } else {
      startVoiceSearch({
        onResult: (transcript) => {
          setSearchQuery(transcript);
          setSearchTerm(transcript);
        },
        onError: (err) => {
          setError(err);
        },
      });
    }
  };

  // Clear search input
  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchTerm("");
    setAutocompleteResults([]);
    setGlobalDiscoveryList([]);
    setShowDropdown(false);
  };

  // Select item from Autocomplete (both local and global open travel guide)
  const handleSelectAutocomplete = (item) => {
    setShowDropdown(false);
    const targetSlug = item.slug || item.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    navigate(`/destination/${targetSlug}`);
  };

  // Submit search query (Enter key or Search button)
  const handleSearchSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setShowDropdown(false);

    // If autocomplete suggestions exist, pick exact match or top candidate
    if (autocompleteResults.length > 0) {
      const queryLower = query.toLowerCase();
      const exactMatch = autocompleteResults.find(
        (item) => item.name.toLowerCase() === queryLower
      );
      const chosen = exactMatch || autocompleteResults[0];
      const targetSlug = chosen.slug || chosen.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      navigate(`/destination/${targetSlug}`);
      return;
    }

    // Direct navigation attempting destination discovery using entered query
    const directSlug = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    navigate(`/destination/${directSlug}`);
  };

  // ================= REVIEWS COMPUTATION =================

  const getPlaceReviews = (placeId) => {
    return reviews.filter((r) => {
      const pId = typeof r.place === "object" ? r.place?._id : r.place;
      return String(pId) === String(placeId);
    });
  };

  const getPlaceRatingStats = (placeId) => {
    const placeRev = getPlaceReviews(placeId);
    if (placeRev.length === 0) return { avg: null, count: 0 };
    const sum = placeRev.reduce((acc, curr) => acc + Number(curr.rating || 0), 0);
    return {
      avg: (sum / placeRev.length).toFixed(1),
      count: placeRev.length,
    };
  };

  // ================= CHECK FAVORITE =================

  const isFavorite = (placeId) => {
    return favorites.some((favorite) => {
      const favoritePlaceId =
        typeof favorite.place === "object"
          ? favorite.place?._id
          : favorite.place;
      return String(favoritePlaceId) === String(placeId);
    });
  };

  // ================= HANDLE FORM INPUT =================

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  // ================= ADD / UPDATE PLACE =================

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = { ...formData };
      if (payload.latitude === "" || payload.latitude === undefined || payload.latitude === null) {
        delete payload.latitude;
      } else {
        payload.latitude = Number(payload.latitude);
      }

      if (payload.longitude === "" || payload.longitude === undefined || payload.longitude === null) {
        delete payload.longitude;
      } else {
        payload.longitude = Number(payload.longitude);
      }

      if (editingId) {
        await updatePlace(editingId, payload);
        setMessage("Destination updated successfully!");
      } else {
        await createPlace(payload);
        setMessage("Destination added successfully!");
      }

      setFormData({ ...emptyForm });
      setEditingId(null);
      await fetchPlaces();
    } catch (err) {
      console.error("Place save error:", err);
      setError(err.message || "Unable to save destination.");
    }
  };

  // ================= EDIT PLACE =================

  const handleEdit = (place) => {
    setEditingId(place._id);
    setFormData({
      name: place.name || "",
      description: place.description || "",
      category: place.category || "Historical",
      country: place.country || "",
      state: place.state || "",
      city: place.city || "",
      address: place.address || "",
      image: place.image || "",
      historicalInfo: place.historicalInfo || "",
      latitude: place.latitude != null ? place.latitude : "",
      longitude: place.longitude != null ? place.longitude : "",
    });

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setMessage("");
    setError("");
  };

  // ================= DELETE PLACE =================

  const handleDelete = async (id) => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this destination?"
    );
    if (!confirmed) return;

    try {
      setMessage("");
      setError("");

      await deletePlace(id);
      setMessage("Destination deleted successfully!");

      if (editingId === id) {
        cancelEdit();
      }

      await fetchPlaces();
      await fetchFavorites();
    } catch (err) {
      console.error("Delete place error:", err);
      setError(err.message || "Unable to delete destination.");
    }
  };

  // ================= ADD / REMOVE FAVORITE =================

  const handleFavorite = async (placeId) => {
    if (!user) {
      setError("Please login to save your favorite destinations.");
      setMessage("");
      return;
    }

    if (favoriteLoading === placeId) return;

    setFavoriteLoading(placeId);
    setMessage("");
    setError("");

    try {
      const existingFavorite = favorites.find((favorite) => {
        const favoritePlaceId =
          typeof favorite.place === "object"
            ? favorite.place?._id
            : favorite.place;
        return String(favoritePlaceId) === String(placeId);
      });

      if (existingFavorite) {
        await removeFavorite(existingFavorite._id);
        setMessage("Removed from your favorites successfully!");
      } else {
        await addFavorite(placeId);
        setMessage("Added to your favorites successfully!");
      }

      await fetchFavorites();
    } catch (err) {
      console.error("Favorite operation error:", err);
      setError(err.message || "Unable to update favorites.");
    } finally {
      setFavoriteLoading(null);
    }
  };

  // ================= REVIEW SUBMISSION =================

  const openReviewModal = (place) => {
    setReviewModalPlace(place);
    setRatingInput(5);
    setCommentInput("");
    setReviewError("");
    setReviewSuccess("");
  };

  const closeReviewModal = () => {
    setReviewModalPlace(null);
    setReviewError("");
    setReviewSuccess("");
  };

  const handleAddReview = async (e) => {
    e.preventDefault();
    setReviewError("");
    setReviewSuccess("");

    if (!user) {
      setReviewError("Please login before posting a review.");
      return;
    }

    if (!commentInput.trim()) {
      setReviewError("Review comment cannot be empty.");
      return;
    }

    try {
      setReviewSubmitting(true);
      await addReview({
        place: reviewModalPlace._id,
        rating: ratingInput,
        comment: commentInput.trim(),
      });

      setReviewSuccess("Review submitted successfully! Thank you for sharing your experience.");
      setCommentInput("");
      await fetchAllReviews();
    } catch (err) {
      setReviewError(err.message || "Unable to submit review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("Are you sure you want to delete this review?")) return;
    try {
      await deleteReview(reviewId);
      await fetchAllReviews();
    } catch (err) {
      alert(err.message || "Failed to delete review");
    }
  };

  // ================= SEARCH, FILTER & SORT (LOCAL PLACES) =================

  const filteredPlaces = places
    .filter((p) => {
      const matchesCategory =
        selectedCategory === "All" ||
        (p.category && p.category.toLowerCase() === selectedCategory.toLowerCase());

      const q = searchTerm.toLowerCase();
      const matchesSearch =
        !searchTerm.trim() ||
        p.name?.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        p.city?.toLowerCase().includes(q) ||
        p.state?.toLowerCase().includes(q) ||
        p.country?.toLowerCase().includes(q);

      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      if (sortBy === "name-desc") return b.name.localeCompare(a.name);
      if (sortBy === "highest-rated") {
        const rateA = Number(getPlaceRatingStats(a._id).avg || 0);
        const rateB = Number(getPlaceRatingStats(b._id).avg || 0);
        return rateB - rateA;
      }
      if (sortBy === "most-reviews") {
        const countA = getPlaceRatingStats(a._id).count;
        const countB = getPlaceRatingStats(b._id).count;
        return countB - countA;
      }
      // default: newest
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });

  return (
    <main className="explore-page">
      <div className="explore-header-section">
        <h1>{t("explore_title")}</h1>
        <p className="explore-header-tagline">
          {t("explore_subtitle")}
        </p>
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}
      {recognitionError && <p className="error-message">🎙️ {recognitionError}</p>}

      {/* ================= 1. GLOBAL DESTINATION SEARCH BAR WITH AUTOCOMPLETE & VOICE ================= */}
      <section className="explore-global-search-section">
        <div className="global-search-card" ref={searchWrapRef}>
          <form
            className="global-search-form"
            onSubmit={handleSearchSubmit}
            role="search"
            aria-label="Global destination search"
          >
            <div className="global-search-input-wrap">
              <span className="search-lead-icon" aria-hidden="true">🔍</span>
              <input
                type="text"
                className="global-search-input"
                placeholder={t("search_placeholder") || "Search any destination, city, state, country, monument or attraction..."}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => {
                  if (autocompleteResults.length > 0) setShowDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleSearchSubmit(e);
                  }
                }}
                aria-label="Search destinations globally"
              />

              {searchingGlobal && (
                <span className="search-inline-spinner" title="Searching globally..."></span>
              )}

              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-icon-btn"
                  onClick={handleClearSearch}
                  title="Clear Search"
                  aria-label="Clear Search"
                >
                  ✕
                </button>
              )}

              <button
                type="button"
                className={`search-mic-action-btn ${isListening ? "listening" : ""}`}
                onClick={handleMicClick}
                disabled={!isSpeechRecognitionSupported}
                title={
                  !isSpeechRecognitionSupported
                    ? t("not_supported_stt")
                    : isListening
                    ? t("stop_listening")
                    : t("voice_search")
                }
                aria-label="Voice Search"
              >
                <span>{isListening ? "🔴" : "🎙️"}</span>
                <span className="mic-label-text">
                  {isListening ? t("listening") : t("voice_search")}
                </span>
              </button>

              <button
                type="submit"
                className="search-submit-btn"
                title="Search Destination"
                aria-label="Search Destination"
              >
                <span>Search</span>
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>

          {/* Autocomplete Suggestions Dropdown */}
          {showDropdown && autocompleteResults.length > 0 && (
            <div className="autocomplete-dropdown">
              <div className="autocomplete-header">
                <span>Matching Destinations ({autocompleteResults.length})</span>
                <small>Select to open travel guide or view records</small>
              </div>
              <ul className="autocomplete-list">
                {autocompleteResults.map((item) => (
                  <li
                    key={item.id}
                    className="autocomplete-item"
                    onClick={() => handleSelectAutocomplete(item)}
                  >
                    <div className="autocomplete-item-left">
                      <span className="autocomplete-icon-badge" title={item.type}>
                        {item.icon || (item.isLocal ? "🏛️" : "📍")}
                      </span>
                      {item.image && (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="autocomplete-thumb"
                          onError={(e) => {
                            e.target.style.display = "none";
                          }}
                        />
                      )}
                      <div className="autocomplete-info">
                        <span className="autocomplete-name">{item.name}</span>
                        <span className="autocomplete-subtitle">
                          {item.subtitle || item.description}
                        </span>
                      </div>
                    </div>

                    <div className="autocomplete-item-right">
                      <span className={`autocomplete-tag ${item.isLocal ? "local" : "global"}`}>
                        {item.isLocal ? "ExploreX Record" : item.type}
                      </span>
                      <span className="autocomplete-arrow">→</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="search-quick-hints">
            <span>Try searching:</span>
            <button type="button" onClick={() => setSearchQuery("Kashmir")}>Kashmir</button>
            <button type="button" onClick={() => setSearchQuery("Hyderabad")}>Hyderabad</button>
            <button type="button" onClick={() => setSearchQuery("Taj Mahal")}>Taj Mahal</button>
            <button type="button" onClick={() => setSearchQuery("Gulmarg")}>Gulmarg</button>
            <button type="button" onClick={() => setSearchQuery("Eiffel Tower")}>Eiffel Tower</button>
            <button type="button" onClick={() => setSearchQuery("Switzerland")}>Switzerland</button>
          </div>
        </div>
      </section>

      {/* ================= 2. GLOBAL DISCOVERY RESULTS CARDS ================= */}
      {globalDiscoveryList.length > 0 && searchQuery.trim() && (
        <section className="explore-global-discovery-section">
          <div className="global-discovery-header">
            <h2>🌐 {t("explore_global_results", { query: searchQuery })}</h2>
            <span className="global-discovery-count">
              Found {globalDiscoveryList.length} global geographic destinations
            </span>
          </div>

          <div className="global-discovery-grid">
            {globalDiscoveryList.map((item) => (
              <div key={item.id} className="global-discovery-card">
                {item.image ? (
                  <div className="global-card-image-wrap">
                    <img
                      src={item.image}
                      alt={item.name}
                      loading="lazy"
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                    <span className="global-card-badge">
                      {item.icon || "📍"} {item.type}
                    </span>
                  </div>
                ) : (
                  <div className="global-card-placeholder">
                    <span className="placeholder-icon">{item.icon || "🌐"}</span>
                    <span className="global-card-badge">{item.type}</span>
                  </div>
                )}

                <div className="global-card-body">
                  <h3 className="global-card-title">{item.name}</h3>
                  <p className="global-card-subtitle">{item.subtitle}</p>
                  <p className="global-card-desc">{item.description}</p>

                  <div className="global-card-actions">
                    <Link
                      to={`/destination/${item.slug}`}
                      className="global-view-guide-btn"
                    >
                      🧭 {t("explore_view_guide")}
                    </Link>
                    {item.coordinates && (
                      <Link
                        to={`/navigate?lat=${item.coordinates.lat}&lng=${item.coordinates.lon}&name=${encodeURIComponent(item.name)}`}
                        className="global-nav-btn"
                      >
                        🗺️ Shortest Route
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ================= 3. LOCAL DESTINATIONS FILTER & SORT CONTROLS ================= */}
      <section className="explore-controls-card">
        <div className="explore-filter-row">
          <div className="explore-category-pills">
            <button
              type="button"
              className={`explore-pill ${selectedCategory === "All" ? "active" : ""}`}
              onClick={() => setSelectedCategory("All")}
            >
              {t("explore_cat_all")}
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`explore-pill ${selectedCategory === cat ? "active" : ""}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="explore-sort-wrapper">
            <label htmlFor="sortBy">Sort by:</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="newest">Newest Added</option>
              <option value="name-asc">Name (A → Z)</option>
              <option value="name-desc">Name (Z → A)</option>
              <option value="highest-rated">Highest Rated ⭐</option>
              <option value="most-reviews">Most Reviews 💬</option>
            </select>
          </div>
        </div>
      </section>

      {/* ================= 4. ADD / EDIT DESTINATION FORM ================= */}
      <section className="add-place-section">
        <h2>{editingId ? t("explore_edit_title") : t("explore_add_title")}</h2>

        <form onSubmit={handleSubmit}>
          <input
            name="name"
            placeholder="Destination Name *"
            value={formData.name}
            onChange={handleChange}
            required
          />

          <textarea
            name="description"
            placeholder="Description *"
            value={formData.description}
            onChange={handleChange}
            required
          />

          <select
            name="category"
            value={formData.category}
            onChange={handleChange}
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <input
            name="country"
            placeholder="Country"
            value={formData.country}
            onChange={handleChange}
          />

          <input
            name="state"
            placeholder="State / Province"
            value={formData.state}
            onChange={handleChange}
          />

          <input
            name="city"
            placeholder="City"
            value={formData.city}
            onChange={handleChange}
          />

          <input
            name="address"
            placeholder="Street Address / Landmark"
            value={formData.address}
            onChange={handleChange}
          />

          <input
            name="image"
            placeholder="Image URL (https://...)"
            value={formData.image}
            onChange={handleChange}
          />

          <textarea
            name="historicalInfo"
            placeholder="Historical Context or Cultural Background"
            value={formData.historicalInfo}
            onChange={handleChange}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <input
              name="latitude"
              type="number"
              step="any"
              placeholder="Latitude (e.g. 27.1751)"
              value={formData.latitude}
              onChange={handleChange}
            />

            <input
              name="longitude"
              type="number"
              step="any"
              placeholder="Longitude (e.g. 78.0421)"
              value={formData.longitude}
              onChange={handleChange}
            />
          </div>

          <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
            <button type="submit" style={{ flex: 1 }}>
              {editingId ? t("common_save") : t("explore_btn_add")}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={cancelEdit}
                style={{ background: "#888", color: "white" }}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      {/* ================= 5. LOCAL DESTINATIONS GRID ================= */}
      <section className="places-list-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px" }}>
          <h2>
            Curated Database Destinations ({filteredPlaces.length})
          </h2>

          {(searchTerm || selectedCategory !== "All") && (
            <button
              type="button"
              className="ai-clear-btn"
              style={{ color: "#174c3c", borderColor: "#174c3c" }}
              onClick={() => {
                setSearchQuery("");
                setSearchTerm("");
                setSelectedCategory("All");
              }}
            >
              Reset Filters
            </button>
          )}
        </div>

        {loading ? (
          <p>Loading destinations...</p>
        ) : filteredPlaces.length === 0 ? (
          <div className="ai-tool-card" style={{ textAlign: "center", padding: "40px" }}>
            <h3>{t("explore_no_match")}</h3>
            <p>{t("explore_no_match_sub")}</p>
          </div>
        ) : (
          <div className="places-grid">
            {filteredPlaces.map((place) => {
              const { avg, count } = getPlaceRatingStats(place._id);
              const destinationSlug = place.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

              return (
                <div className="place-card" key={place._id}>
                  {place.image ? (
                    <img
                      src={place.image}
                      alt={place.name}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        height: "180px",
                        background: "#174c3c",
                        color: "white",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "36px",
                        borderRadius: "8px",
                      }}
                    >
                      🏛️
                    </div>
                  )}

                  <h3>{place.name}</h3>

                  {/* Rating Badge */}
                  <div className="place-rating-badge">
                    {count > 0 ? (
                      <span>
                        <strong style={{ color: "#b47a45" }}>★ {avg}</strong> ({count} {count === 1 ? "review" : "reviews"})
                      </span>
                    ) : (
                      <span style={{ color: "#888", fontSize: "13px" }}>★ No reviews yet</span>
                    )}
                  </div>

                  <p>{place.description}</p>

                  <p>
                    📍 {[place.city, place.state, place.country].filter(Boolean).join(", ")}
                  </p>

                  <span className="category-tag">{place.category || "Other"}</span>

                  <div className="place-actions">
                    {/* VIEW DETAILS GUIDE BUTTON */}
                    <Link
                      to={`/destination/${destinationSlug}`}
                      className="place-guide-btn"
                      title="View Complete Travel Guide"
                    >
                      🧭 Travel Guide
                    </Link>

                    {/* FAVORITE BUTTON */}
                    <button
                      type="button"
                      onClick={() => handleFavorite(place._id)}
                      disabled={favoriteLoading === place._id}
                    >
                      {favoriteLoading === place._id
                        ? "Please wait..."
                        : isFavorite(place._id)
                        ? ("❤️ " + t("fav_remove_btn"))
                        : ("🤍 " + t("explore_btn_add_fav"))}
                    </button>

                    {/* NAVIGATE BUTTON */}
                    <Link
                      to={`/navigate?destination=${place._id}`}
                      className="place-navigate-btn"
                    >
                      🗺️ Navigate
                    </Link>

                    {/* REVIEWS BUTTON */}
                    <button
                      type="button"
                      style={{ background: "#24634d" }}
                      onClick={() => openReviewModal(place)}
                    >
                      💬 Reviews ({count})
                    </button>

                    {/* EDIT BUTTON */}
                    <button type="button" onClick={() => handleEdit(place)}>
                      Edit
                    </button>

                    {/* DELETE BUTTON */}
                    <button type="button" onClick={() => handleDelete(place._id)}>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ================= 6. REVIEWS MODAL / DIALOG ================= */}
      {reviewModalPlace && (
        <div className="review-modal-backdrop" onClick={closeReviewModal}>
          <div className="review-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="review-modal-header">
              <h2>{t("explore_reviews_for", { name: reviewModalPlace.name })}</h2>
              <button
                type="button"
                className="review-modal-close"
                onClick={closeReviewModal}
              >
                ✕
              </button>
            </div>

            {/* Average Rating Summary */}
            {(() => {
              const { avg, count } = getPlaceRatingStats(reviewModalPlace._id);
              return (
                <div className="review-summary-box">
                  <div className="review-summary-score">
                    {count > 0 ? avg : "--"}
                  </div>
                  <div>
                    <div style={{ color: "#b47a45", fontSize: "18px" }}>
                      {"★".repeat(Math.round(Number(avg || 0))) +
                        "☆".repeat(5 - Math.round(Number(avg || 0)))}
                    </div>
                    <div style={{ fontSize: "13px", color: "#666" }}>
                      Based on {count} {count === 1 ? "review" : "reviews"}
                    </div>
                  </div>
                </div>
              );
            })()}

            {reviewSuccess && <p className="success-message">{reviewSuccess}</p>}
            {reviewError && <p className="error-message">{reviewError}</p>}

            {/* Add Review Form */}
            <div className="review-write-section">
              <h3>{t("explore_leave_review")}</h3>
              {!user ? (
                <p>
                  Please <Link to="/login" style={{ color: "#b47a45", fontWeight: "bold" }}>Login</Link> to rate and review this destination.
                </p>
              ) : (
                <form onSubmit={handleAddReview}>
                  <div style={{ marginBottom: "12px" }}>
                    <label style={{ display: "block", marginBottom: "6px", fontWeight: "bold" }}>
                      {t("explore_rating_label")}
                    </label>
                    <div className="star-rating-picker">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className="star-btn"
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRatingInput(star)}
                        >
                          <span
                            style={{
                              color:
                                (hoverRating || ratingInput) >= star
                                  ? "#b47a45"
                                  : "#ccc",
                              fontSize: "26px",
                            }}
                          >
                            ★
                          </span>
                        </button>
                      ))}
                      <span style={{ marginLeft: "10px", fontWeight: "bold", color: "#174c3c" }}>
                        {ratingInput} out of 5 stars
                      </span>
                    </div>
                  </div>

                  <textarea
                    placeholder={t("explore_comment_placeholder")}
                    value={commentInput}
                    onChange={(e) => setCommentInput(e.target.value)}
                    rows={3}
                    required
                    style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #ccc", boxSizing: "border-box" }}
                  />

                  <button
                    type="submit"
                    className="ai-send-btn"
                    style={{ marginTop: "10px" }}
                    disabled={reviewSubmitting || !commentInput.trim()}
                  >
                    {reviewSubmitting ? t("explore_submitting_review") : t("explore_btn_submit_review")}
                  </button>
                </form>
              )}
            </div>

            {/* List of Reviews */}
            <div className="review-list-section">
              <h3>{t("explore_feedback_heading", { count: getPlaceReviews(reviewModalPlace._id).length })}</h3>

              {getPlaceReviews(reviewModalPlace._id).length === 0 ? (
                <p style={{ color: "#777", fontStyle: "italic" }}>
                  No reviews yet. Be the first to review {reviewModalPlace.name}!
                </p>
              ) : (
                getPlaceReviews(reviewModalPlace._id).map((r) => {
                  const isAuthor = user && (r.user?._id === user.id || r.user === user.id);
                  return (
                    <div className="review-item-card" key={r._id}>
                      <div className="review-item-header">
                        <strong>{r.user?.name || "Traveler"}</strong>
                        <span style={{ color: "#b47a45" }}>
                          {"★".repeat(r.rating) + "☆".repeat(5 - r.rating)}
                        </span>
                      </div>
                      <p className="review-item-comment">{r.comment}</p>
                      <div className="review-item-footer">
                        <small style={{ color: "#888" }}>
                          {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}
                        </small>
                        {isAuthor && (
                          <button
                            type="button"
                            className="review-delete-btn"
                            onClick={() => handleDeleteReview(r._id)}
                          >
                            Delete My Review
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default Explore;
