import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getFavorites, removeFavorite } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";

function Favorites() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchFavorites = async () => {
      if (!user) {
        setFavorites([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getFavorites();
        setFavorites(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || "Unable to load favorites.");
      } finally {
        setLoading(false);
      }
    };

    fetchFavorites();
  }, [user]);

  const handleRemove = async (favoriteId) => {
    try {
      setError("");
      setMessage("");

      await removeFavorite(favoriteId);

      setFavorites((previous) =>
        previous.filter((item) => item._id !== favoriteId)
      );

      setMessage(t("fav_removed_success"));
    } catch (err) {
      setError(err.message || "Unable to remove favorite.");
    }
  };

  if (!user) {
    return (
      <main className="favorites-page">
        <div className="favorites-header">
          <span className="ai-header-badge">❤️ {t("fav_badge")}</span>
          <h1>{t("fav_title")}</h1>
          <p>{t("fav_login_required")}</p>
        </div>
        <div style={{ textAlign: "center", marginTop: "24px" }}>
          <Link to="/login" className="home-btn primary" style={{ display: "inline-block" }}>
            {t("fav_login_btn")}
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="favorites-page">
      <div className="favorites-header">
        <span className="ai-header-badge">❤️ {t("fav_badge")}</span>
        <h1>{t("fav_title")}</h1>
        <p>{t("fav_subtitle")}</p>
      </div>

      {message && <p className="success-message">{message}</p>}
      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <p>{t("fav_loading")}</p>
      ) : favorites.length === 0 ? (
        <div className="ai-tool-card" style={{ textAlign: "center", padding: "40px" }}>
          <h3>{t("fav_empty_title")}</h3>
          <p>{t("fav_empty_subtitle")}</p>
          <Link
            to="/explore"
            className="home-btn primary"
            style={{ display: "inline-block", marginTop: "16px" }}
          >
            {t("fav_explore_btn")}
          </Link>
        </div>
      ) : (
        <section className="places-section">
          <h2>{t("fav_saved_heading", { count: favorites.length })}</h2>
          <div className="places-grid">
            {favorites.map((favorite) => {
              const place = favorite.place;
              if (!place) return null;

              return (
                <div className="place-card" key={favorite._id}>
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
                  <p>{place.description}</p>
                  <p>
                    📍 {[place.city, place.state, place.country].filter(Boolean).join(", ")}
                  </p>
                  <span className="category-tag">{place.category || "General"}</span>

                  <div className="place-actions">
                    <button
                      type="button"
                      onClick={() => handleRemove(favorite._id)}
                    >
                      ❤️ {t("fav_remove_btn")}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}

export default Favorites;
