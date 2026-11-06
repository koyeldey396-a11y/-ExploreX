import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import heroImg from "../assets/hero.png";

function Home() {
  const { t } = useLanguage();

  return (
    <main className="home-page">
      {/* ================= HERO SECTION ================= */}
      <section className="home-hero-card">
        <div className="home-hero-content">
          <span className="ai-header-badge">✨ {t("home_badge")}</span>
          <h1>{t("home_hero_title")}</h1>
          <p className="home-hero-subtitle">
            {t("home_hero_subtitle")}
          </p>

          <div className="home-hero-actions">
            <Link to="/explore-3d" className="home-btn primary" style={{ background: "#b47a45" }}>
              🏛️ {t("home_btn_3d")}
            </Link>
            <Link to="/explore" className="home-btn secondary">
              🧭 {t("home_btn_explore")}
            </Link>
            <Link to="/ai-assistant" className="home-btn secondary">
              🤖 {t("home_btn_ai")}
            </Link>
            <Link to="/trip-planner" className="home-btn outline">
              📅 {t("home_btn_planner")}
            </Link>
          </div>
        </div>

        <div className="home-hero-image-wrapper">
          <img
            src={heroImg}
            alt="ExploreX Tourism Showcase"
            className="home-hero-img"
          />
        </div>
      </section>

      {/* ================= PLATFORM HIGHLIGHTS ================= */}
      <section className="home-features-section">
        <h2 style={{ textAlign: "center", marginBottom: "8px" }}>
          {t("home_features_title")}
        </h2>
        <p style={{ textAlign: "center", color: "#666", marginBottom: "32px" }}>
          {t("home_features_subtitle")}
        </p>

        <div className="home-features-grid">
          <div className="home-feature-card">
            <div className="home-feature-icon">🏛️</div>
            <h3>{t("home_f1_title")}</h3>
            <p>{t("home_f1_desc")}</p>
            <Link to="/explore-3d" className="home-feature-link">
              {t("home_f1_link")}
            </Link>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-icon">🧭</div>
            <h3>{t("home_f2_title")}</h3>
            <p>{t("home_f2_desc")}</p>
            <Link to="/explore" className="home-feature-link">
              {t("home_f2_link")}
            </Link>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-icon">📍</div>
            <h3>{t("home_f3_title")}</h3>
            <p>{t("home_f3_desc")}</p>
            <Link to="/navigate" className="home-feature-link">
              {t("home_f3_link")}
            </Link>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-icon">🤖</div>
            <h3>{t("home_f4_title")}</h3>
            <p>{t("home_f4_desc")}</p>
            <Link to="/ai-assistant" className="home-feature-link">
              {t("home_f4_link")}
            </Link>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-icon">💎</div>
            <h3>{t("home_f5_title")}</h3>
            <p>{t("home_f5_desc")}</p>
            <Link to="/hidden-gems" className="home-feature-link">
              {t("home_f5_link")}
            </Link>
          </div>

          <div className="home-feature-card">
            <div className="home-feature-icon">📅</div>
            <h3>{t("home_f6_title")}</h3>
            <p>{t("home_f6_desc")}</p>
            <Link to="/trip-planner" className="home-feature-link">
              {t("home_f6_link")}
            </Link>
          </div>
        </div>
      </section>

      {/* ================= CTA BANNER ================= */}
      <section className="home-cta-banner">
        <h2>{t("home_cta_title")}</h2>
        <p>{t("home_cta_subtitle")}</p>
        <div style={{ display: "flex", gap: "16px", justifyContent: "center", flexWrap: "wrap", marginTop: "18px" }}>
          <Link to="/register" className="home-btn primary">
            {t("home_cta_register")}
          </Link>
          <Link to="/explore" className="home-btn outline-light">
            {t("home_cta_explore")}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default Home;
