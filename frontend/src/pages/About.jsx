import { Link } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";

function About() {
  const { t } = useLanguage();

  return (
    <main className="about-page">
      <div className="about-header">
        <span className="ai-header-badge">📋 {t("about_badge")}</span>
        <h1>{t("about_title")}</h1>
        <p className="about-lead">
          <strong>{t("about_lead")}</strong>
        </p>
      </div>

      <section className="about-card">
        <h2>🎯 {t("about_mission_title")}</h2>
        <p>{t("about_mission_p1")}</p>
        <p>{t("about_mission_p2")}</p>
      </section>

      <section className="about-card">
        <h2>⚡ {t("about_core_title")}</h2>
        <div className="about-grid">
          <div className="about-item">
            <h3>🌐 {t("about_c1_title")}</h3>
            <p>{t("about_c1_desc")}</p>
          </div>

          <div className="about-item">
            <h3>🤖 {t("about_c2_title")}</h3>
            <p>{t("about_c2_desc")}</p>
          </div>

          <div className="about-item">
            <h3>💎 {t("about_c3_title")}</h3>
            <p>{t("about_c3_desc")}</p>
          </div>

          <div className="about-item">
            <h3>⭐ {t("about_c4_title")}</h3>
            <p>{t("about_c4_desc")}</p>
          </div>

          <div className="about-item">
            <h3>📅 {t("about_c5_title")}</h3>
            <p>{t("about_c5_desc")}</p>
          </div>

          <div className="about-item">
            <h3>❤️ {t("about_c6_title")}</h3>
            <p>{t("about_c6_desc")}</p>
          </div>
        </div>
      </section>

      <section className="about-card">
        <h2>🛠️ {t("about_tech_title")}</h2>
        <ul className="about-tech-list">
          <li><strong>Frontend:</strong> React 19, Vite, React Router DOM 7, Modern CSS Design System</li>
          <li><strong>Backend:</strong> Node.js, Express 5 REST API</li>
          <li><strong>Database:</strong> MongoDB & Mongoose ODM</li>
          <li><strong>Authentication:</strong> JSON Web Tokens (JWT) & bcryptjs Password Hashing</li>
          <li><strong>Artificial Intelligence:</strong> Google Gemini API (gemini-1.5-flash)</li>
        </ul>
      </section>

      <div style={{ textAlign: "center", marginTop: "30px" }}>
        <Link to="/explore" className="home-btn primary" style={{ display: "inline-block", marginRight: "12px" }}>
          {t("about_btn_explore")}
        </Link>
        <Link to="/ai-assistant" className="home-btn secondary" style={{ display: "inline-block" }}>
          {t("about_btn_ai")}
        </Link>
      </div>
    </main>
  );
}

export default About;
