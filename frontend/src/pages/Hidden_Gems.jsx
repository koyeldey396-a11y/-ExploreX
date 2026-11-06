import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getHiddenGems, getMyHiddenGems, submitHiddenGem } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

const CATEGORIES = [
  "Nature",
  "Historical",
  "Adventure",
  "Religious",
  "Beach",
  "Cultural",
  "Other",
];

const emptyForm = {
  name: "",
  description: "",
  location: "",
  country: "",
  state: "",
  category: "Nature",
  image: "",
};

function HiddenGems() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [approvedGems, setApprovedGems] = useState([]);
  const [myGems, setMyGems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("explore"); // 'explore', 'submit', 'my-submissions'

  // Fetch approved gems for public display
  const fetchApprovedGems = async () => {
    try {
      const data = await getHiddenGems();
      setApprovedGems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching approved hidden gems:", err);
    }
  };

  // Fetch user's submitted gems
  const fetchMyGems = async () => {
    if (!user) {
      setMyGems([]);
      return;
    }
    try {
      const data = await getMyHiddenGems();
      setMyGems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching user gems:", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([fetchApprovedGems(), fetchMyGems()]);
      setLoading(false);
    };
    loadAll();
  }, [user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    if (!user) {
      setError(t("gems_login_required"));
      return;
    }

    if (
      !formData.name.trim() ||
      !formData.description.trim() ||
      !formData.location.trim() ||
      !formData.country.trim()
    ) {
      setError(t("gems_fields_required"));
      return;
    }

    // Validate image URL format if provided
    if (formData.image.trim() && !/^https?:\/\/.+/i.test(formData.image.trim())) {
      setError(t("gems_url_error"));
      return;
    }

    try {
      setSubmitting(true);
      const res = await submitHiddenGem({
        name: formData.name.trim(),
        description: formData.description.trim(),
        location: formData.location.trim(),
        country: formData.country.trim(),
        state: formData.state.trim(),
        category: formData.category,
        image: formData.image.trim(),
      });

      setMessage(res.message || t("gems_submit_success"));
      setFormData({ ...emptyForm });
      await fetchMyGems();
      setActiveTab("my-submissions");
    } catch (err) {
      setError(err.message || "Failed to submit hidden gem.");
    } finally {
      setSubmitting(false);
    }
  };

  const getCategoryLabel = (cat) => {
    switch (cat) {
      case "Nature": return t("gems_cat_nature");
      case "Historical": return t("gems_cat_historical");
      case "Adventure": return t("gems_cat_adventure");
      case "Religious": return t("gems_cat_religious");
      case "Beach": return t("gems_cat_beach");
      case "Cultural": return t("gems_cat_cultural");
      case "Other": return t("gems_cat_other");
      default: return cat;
    }
  };

  return (
    <main className="hidden-gems-page">
      <div className="hidden-gems-header">
        <span className="ai-header-badge">💎 {t("gems_badge")}</span>
        <h1>{t("gems_title")}</h1>
        <p>{t("gems_subtitle")}</p>
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {/* Tabs */}
      <div className="ai-tools-nav">
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === "explore" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("explore");
            setMessage("");
            setError("");
          }}
        >
          🧭 {t("gems_tab_explore", { count: approvedGems.length })}
        </button>
        <button
          type="button"
          className={`ai-tab-btn ${activeTab === "submit" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("submit");
            setMessage("");
            setError("");
          }}
        >
          ✍️ {t("gems_tab_submit")}
        </button>
        {user && (
          <button
            type="button"
            className={`ai-tab-btn ${activeTab === "my-submissions" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("my-submissions");
              setMessage("");
              setError("");
            }}
          >
            📋 {t("gems_tab_my", { count: myGems.length })}
          </button>
        )}
      </div>

      {/* ================= TAB 1: EXPLORE APPROVED GEMS ================= */}
      {activeTab === "explore" && (
        <section className="places-section">
          <h2>{t("gems_title")}</h2>
          {loading ? (
            <p>{t("common_loading")}</p>
          ) : approvedGems.length === 0 ? (
            <div className="ai-tool-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <h3>{t("gems_my_empty")}</h3>
              <p>{t("gems_subtitle")}</p>
              <button
                type="button"
                className="ai-send-btn"
                onClick={() => setActiveTab("submit")}
              >
                {t("gems_submit_first")}
              </button>
            </div>
          ) : (
            <div className="places-grid">
              {approvedGems.map((gem) => (
                <div className="place-card" key={gem._id}>
                  {gem.image ? (
                    <img
                      src={gem.image}
                      alt={gem.name}
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
                      💎
                    </div>
                  )}

                  <h3>{gem.name}</h3>
                  <p>{gem.description}</p>
                  <p>
                    <strong>📍 Location:</strong>{" "}
                    {[gem.location, gem.state, gem.country].filter(Boolean).join(", ")}
                  </p>
                  <span className="category-tag">{getCategoryLabel(gem.category || "Nature")}</span>

                  {gem.submittedBy?.name && (
                    <p style={{ fontSize: "12px", color: "#666", marginTop: "10px" }}>
                      Shared by: <em>{gem.submittedBy.name}</em>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ================= TAB 2: SUBMIT A HIDDEN GEM ================= */}
      {activeTab === "submit" && (
        <section className="add-place-section">
          <h2>{t("gems_form_title")}</h2>
          <p style={{ textAlign: "center", marginBottom: "20px", color: "#555" }}>
            {t("gems_form_desc")}
          </p>

          {!user ? (
            <div style={{ textAlign: "center", padding: "20px" }}>
              <p>{t("gems_login_required")}</p>
              <Link to="/login" className="ai-send-btn" style={{ display: "inline-block", marginTop: "10px" }}>
                {t("nav_login")}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <input
                name="name"
                placeholder={t("gems_name_placeholder")}
                value={formData.name}
                onChange={handleChange}
                required
              />

              <textarea
                name="description"
                placeholder={t("gems_desc_placeholder")}
                value={formData.description}
                onChange={handleChange}
                required
              />

              <select name="category" value={formData.category} onChange={handleChange}>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {getCategoryLabel(cat)}
                  </option>
                ))}
              </select>

              <input
                name="location"
                placeholder={t("gems_location_placeholder")}
                value={formData.location}
                onChange={handleChange}
                required
              />

              <input
                name="country"
                placeholder={t("gems_country_placeholder")}
                value={formData.country}
                onChange={handleChange}
                required
              />

              <input
                name="state"
                placeholder={t("gems_state_placeholder")}
                value={formData.state}
                onChange={handleChange}
              />

              <input
                name="image"
                type="url"
                placeholder={t("gems_image_placeholder")}
                value={formData.image}
                onChange={handleChange}
              />

              <button type="submit" disabled={submitting}>
                {submitting ? t("gems_btn_submitting") : t("gems_btn_submit")}
              </button>
            </form>
          )}
        </section>
      )}

      {/* ================= TAB 3: USER'S SUBMISSIONS ================= */}
      {activeTab === "my-submissions" && user && (
        <section className="places-section">
          <h2>{t("gems_my_title")}</h2>
          <p>{t("gems_my_subtitle")}</p>

          {myGems.length === 0 ? (
            <div className="ai-tool-card" style={{ textAlign: "center", padding: "30px" }}>
              <p>{t("gems_my_empty")}</p>
              <button
                type="button"
                className="ai-send-btn"
                onClick={() => setActiveTab("submit")}
              >
                {t("gems_submit_first")}
              </button>
            </div>
          ) : (
            <div className="places-grid">
              {myGems.map((gem) => (
                <div className="place-card" key={gem._id}>
                  {gem.image && (
                    <img
                      src={gem.image}
                      alt={gem.name}
                      onError={(e) => {
                        e.target.style.display = "none";
                      }}
                    />
                  )}
                  <h3>{gem.name}</h3>
                  <p>{gem.description}</p>
                  <p>
                    📍 {[gem.location, gem.state, gem.country].filter(Boolean).join(", ")}
                  </p>
                  <p>
                    Category: <strong>{getCategoryLabel(gem.category || "Nature")}</strong>
                  </p>

                  <div style={{ marginTop: "14px" }}>
                    {t("common_status")}:{" "}
                    {gem.status === "Approved" ? (
                      <span
                        style={{
                          background: "#e6f7ec",
                          color: "#0f5127",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        🟢 {t("gems_status_approved")}
                      </span>
                    ) : gem.status === "Rejected" ? (
                      <span
                        style={{
                          background: "#fde8e8",
                          color: "#9b1c1c",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        🔴 {t("gems_status_rejected")}
                      </span>
                    ) : (
                      <span
                        style={{
                          background: "#fff8e6",
                          color: "#7a4f01",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          fontWeight: "bold",
                          fontSize: "12px",
                        }}
                      >
                        🟡 {t("gems_status_pending")}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}

export default HiddenGems;
