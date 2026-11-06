import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getTrips, createTrip, updateTrip, deleteTrip } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const emptyForm = {
  destination: "",
  startDate: "",
  endDate: "",
  duration: 1,
  budget: "",
  interests: "",
};

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function Trip_Planner() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  // Query parameters from Destination_Details cross-linking
  const queryDestination = searchParams.get("destination");
  const queryDuration = searchParams.get("duration");
  const queryBudget = searchParams.get("budget");
  const queryInterests = searchParams.get("interests");
  const queryItinerary = searchParams.get("itinerary");
  const queryStops = searchParams.get("stops");

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({ ...emptyForm });
  const [editingTripId, setEditingTripId] = useState(null);

  // Transferred itinerary state
  const [transferredItinerary, setTransferredItinerary] = useState(null);
  const [expandedTripId, setExpandedTripId] = useState(null);

  // Load trips belonging to the logged-in user
  const fetchTrips = async () => {
    if (!user) {
      setTrips([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await getTrips();
      setTrips(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Unable to load trips.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrips();
  }, [user]);

  // Handle incoming transferred itinerary or session storage restore
  useEffect(() => {
    let activeItinerary = null;
    let activeDest = queryDestination;
    let activeDuration = queryDuration;
    let activeBudget = queryBudget;
    let activeInterests = queryInterests;

    // 1. Try URL parameters first
    if (queryItinerary) {
      try {
        const parsed = JSON.parse(queryItinerary);
        if (Array.isArray(parsed) && parsed.length > 0) {
          activeItinerary = parsed;
          sessionStorage.setItem(
            "explorex_pending_itinerary",
            JSON.stringify({
              destination: queryDestination,
              duration: queryDuration,
              budget: queryBudget,
              interests: queryInterests,
              itinerary: parsed,
              stops: queryStops,
            })
          );
        }
      } catch (e) {
        console.warn("Failed to parse query itinerary:", e);
      }
    } else {
      // 2. Check pending itinerary from session storage
      const saved = sessionStorage.getItem("explorex_pending_itinerary");
      if (saved) {
        try {
          const parsedSaved = JSON.parse(saved);
          activeItinerary = parsedSaved.itinerary;
          activeDest = parsedSaved.destination;
          activeDuration = parsedSaved.duration;
          activeBudget = parsedSaved.budget;
          activeInterests = parsedSaved.interests;
        } catch (e) {
          console.warn("Failed to parse saved itinerary:", e);
        }
      }
    }

    if (activeItinerary) {
      setTransferredItinerary(activeItinerary);

      const daysCount = Number(activeDuration) || activeItinerary.length || 3;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endDate = new Date(tomorrow);
      endDate.setDate(endDate.getDate() + daysCount);

      setFormData((prev) => ({
        ...prev,
        destination: activeDest || prev.destination,
        duration: daysCount,
        budget: activeBudget || prev.budget,
        interests: activeInterests || prev.interests,
        startDate: formatDate(tomorrow),
        endDate: formatDate(endDate),
      }));
    } else if (activeDest) {
      setFormData((prev) => ({
        ...prev,
        destination: activeDest,
      }));
    }
  }, [queryDestination, queryDuration, queryBudget, queryInterests, queryItinerary, queryStops]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  // Populate form for editing
  const handleEdit = (trip) => {
    setEditingTripId(trip._id);
    setFormData({
      destination: trip.destination || "",
      startDate: trip.startDate ? trip.startDate.slice(0, 10) : "",
      endDate: trip.endDate ? trip.endDate.slice(0, 10) : "",
      duration: trip.duration || 1,
      budget: trip.budget || "",
      interests: Array.isArray(trip.interests)
        ? trip.interests.join(", ")
        : trip.interests || "",
    });
    window.scrollTo({ top: 300, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingTripId(null);
    setFormData({ ...emptyForm });
  };

  // Dismiss transferred itinerary preview
  const dismissTransferredItinerary = () => {
    setTransferredItinerary(null);
    sessionStorage.removeItem("explorex_pending_itinerary");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!user) {
      setError(t("trip_login_required"));
      return;
    }

    if (!formData.destination.trim()) {
      setError("Please provide a destination.");
      return;
    }

    if (!formData.startDate || !formData.endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    if (new Date(formData.endDate) < new Date(formData.startDate)) {
      setError("End date cannot be earlier than start date.");
      return;
    }

    const payload = {
      destination: formData.destination.trim(),
      startDate: formData.startDate,
      endDate: formData.endDate,
      duration: Number(formData.duration) || 1,
      budget: Number(formData.budget) || 0,
      interests: formData.interests
        ? formData.interests
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [],
    };

    // Attach transferred itinerary if available
    if (transferredItinerary) {
      payload.itinerary = transferredItinerary;
    }

    try {
      setSaving(true);

      if (editingTripId) {
        await updateTrip(editingTripId, payload);
        setMessage(t("trip_success_save"));
        setEditingTripId(null);
      } else {
        await createTrip(payload);
        setMessage(t("trip_success_save"));
        // Clear transferred itinerary once saved
        if (transferredItinerary) {
          dismissTransferredItinerary();
        }
      }

      setFormData({ ...emptyForm });
      fetchTrips();
    } catch (err) {
      setError(err.message || "Failed to save trip.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (tripId) => {
    if (!window.confirm(t("trip_delete_confirm"))) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await deleteTrip(tripId);
      setMessage(t("trip_success_delete"));
      fetchTrips();
    } catch (err) {
      setError(err.message || "Failed to delete trip.");
    }
  };

  return (
    <main className="trip-planner-page">
      <div className="trip-header">
        <span className="ai-header-badge">📅 {t("trip_badge")}</span>
        <h1>{t("trip_title")}</h1>
        <p>{t("trip_subtitle")}</p>
      </div>

      {/* ================= TRANSFERRED ITINERARY BANNER ================= */}
      {transferredItinerary && (
        <section className="transferred-itinerary-card">
          <div className="transferred-header-row">
            <div>
              <span className="transferred-pill">✨ {t("trip_transferred_title", { destination: formData.destination })}</span>
              <h2>
                {formData.destination} — {formData.duration || transferredItinerary.length} {t("common_days")}
              </h2>
              <p>
                {t("trip_budget_field")} ₹{Number(formData.budget || 0).toLocaleString()} • {t("trip_interests_field")} {formData.interests || t("trip_general_exploration")}
              </p>
            </div>
            <div className="transferred-actions-row">
              {user ? (
                <button
                  type="button"
                  className="transferred-save-btn"
                  onClick={handleSubmit}
                  disabled={saving}
                >
                  {saving ? t("trip_btn_saving") : `💾 ${t("trip_btn_create")}`}
                </button>
              ) : (
                <Link to="/login" className="transferred-save-btn">
                  🔑 {t("trip_login_btn")}
                </Link>
              )}
              {queryStops && (
                <Link
                  to={`/navigate?destination=${encodeURIComponent(formData.destination)}&stops=${encodeURIComponent(queryStops)}`}
                  className="transferred-nav-btn"
                >
                  🧭 {t("trip_btn_navigate")}
                </Link>
              )}
              <button
                type="button"
                className="transferred-dismiss-btn"
                onClick={dismissTransferredItinerary}
                title="Dismiss preview"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="transferred-days-list">
            {transferredItinerary.map((d) => (
              <div key={d.day} className="transferred-day-row">
                <span className="transferred-day-badge">{t("dest_day", { day: d.day })}</span>
                <div className="transferred-activities-wrap">
                  {Array.isArray(d.activities) ? (
                    d.activities.map((act, actIdx) => (
                      <span key={actIdx} className="activity-chip">
                        📍 {act}
                      </span>
                    ))
                  ) : (
                    <span>{d.activities}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!user ? (
        <section className="add-place-section" style={{ textAlign: "center", padding: "40px" }}>
          <h2>{t("trip_title")}</h2>
          <p>{t("trip_login_required")}</p>
          <Link to="/login" className="ai-send-btn" style={{ display: "inline-block", marginTop: "14px" }}>
            {t("trip_login_btn")}
          </Link>
        </section>
      ) : (
        <>
          <section className="add-place-section">
            <h2>{editingTripId ? t("trip_form_edit") : t("trip_form_create")}</h2>

            <form onSubmit={handleSubmit}>
              <input
                name="destination"
                placeholder={t("trip_dest_placeholder")}
                value={formData.destination}
                onChange={handleChange}
                required
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("trip_start_date")}
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    value={formData.startDate}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("trip_end_date")}
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    value={formData.endDate}
                    onChange={handleChange}
                    min={formData.startDate}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("trip_duration_days")} *
                  </label>
                  <input
                    type="number"
                    name="duration"
                    min="1"
                    placeholder={t("trip_duration_days")}
                    value={formData.duration}
                    onChange={handleChange}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: "bold", marginBottom: "4px" }}>
                    {t("trip_budget_label")}
                  </label>
                  <input
                    type="number"
                    name="budget"
                    min="0"
                    placeholder={t("trip_budget_placeholder")}
                    value={formData.budget}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <input
                name="interests"
                placeholder={t("trip_interests_placeholder")}
                value={formData.interests}
                onChange={handleChange}
              />

              <button type="submit" disabled={saving}>
                {saving
                  ? t("trip_btn_saving")
                  : editingTripId
                  ? t("trip_btn_save_changes")
                  : `${t("trip_btn_create")} ✈️`}
              </button>

              {editingTripId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  style={{ background: "#666", marginTop: "8px" }}
                >
                  {t("trip_btn_cancel")}
                </button>
              )}
            </form>

            {message && <p className="success-message" style={{ marginTop: "16px" }}>{message}</p>}
            {error && <p className="error-message" style={{ marginTop: "16px" }}>{error}</p>}
          </section>

          <section className="places-section">
            <h2>{t("trip_saved_heading", { count: trips.length })}</h2>

            {loading ? (
              <p>{t("common_loading")}</p>
            ) : trips.length === 0 ? (
              <div className="ai-tool-card" style={{ textAlign: "center", padding: "40px" }}>
                <h3>{t("trip_empty_heading")}</h3>
                <p>{t("trip_empty_desc")}</p>
              </div>
            ) : (
              <div className="places-grid">
                {trips.map((trip) => {
                  const hasItinerary = Array.isArray(trip.itinerary) && trip.itinerary.length > 0;
                  const isExpanded = expandedTripId === trip._id;

                  return (
                    <div className="place-card trip-itinerary-card" key={trip._id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <h3>{trip.destination}</h3>
                        <span
                          style={{
                            background: "#e4efe9",
                            color: "#174c3c",
                            padding: "3px 8px",
                            borderRadius: "10px",
                            fontSize: "12px",
                            fontWeight: "bold",
                          }}
                        >
                          {trip.status || t("trip_status_planning")}
                        </span>
                      </div>

                      <p>
                        <strong>📅 {t("trip_dates_label")}</strong>{" "}
                        {trip.startDate ? trip.startDate.slice(0, 10) : "TBD"} →{" "}
                        {trip.endDate ? trip.endDate.slice(0, 10) : "TBD"}
                      </p>
                      <p>
                        <strong>⏳ {t("trip_duration_label")}</strong> {trip.duration} {trip.duration === 1 ? t("common_day") : t("common_days")}
                      </p>
                      <p>
                        <strong>💰 {t("trip_budget_field")}</strong> ₹{trip.budget?.toLocaleString() || "0"}
                      </p>
                      <p>
                        <strong>🎯 {t("trip_interests_field")}</strong>{" "}
                        {trip.interests && trip.interests.length > 0
                          ? trip.interests.join(", ")
                          : t("trip_general_exploration")}
                      </p>

                      {/* Structured Itinerary Display */}
                      {hasItinerary && (
                        <div className="trip-saved-itinerary-box">
                          <div
                            className="itinerary-accordion-toggle"
                            onClick={() => setExpandedTripId(isExpanded ? null : trip._id)}
                          >
                            <span>
                              📋 {t("trip_schedule_toggle", { count: trip.itinerary.length, state: isExpanded ? t("common_hide") : t("common_view") })}
                            </span>
                            <span>{isExpanded ? "▲" : "▼"}</span>
                          </div>

                          {isExpanded && (
                            <div className="itinerary-accordion-content">
                              {trip.itinerary.map((dayItem) => (
                                <div key={dayItem.day} className="saved-day-block">
                                  <strong>{t("dest_day", { day: dayItem.day })}</strong>
                                  <ul>
                                    {Array.isArray(dayItem.activities) ? (
                                      dayItem.activities.map((act, i) => <li key={i}>{act}</li>)
                                    ) : (
                                      <li>{dayItem.activities}</li>
                                    )}
                                  </ul>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="place-actions" style={{ marginTop: "12px" }}>
                        <Link
                          to={`/navigate?destination=${encodeURIComponent(trip.destination)}`}
                          className="trip-nav-action-btn"
                          title="Open route on map"
                        >
                          🧭 {t("trip_btn_navigate")}
                        </Link>
                        <button
                          type="button"
                          style={{ background: "#24634d" }}
                          onClick={() => handleEdit(trip)}
                        >
                          ✏️ {t("trip_btn_edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(trip._id)}
                        >
                          🗑️ {t("trip_btn_delete")}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}

export default Trip_Planner;
