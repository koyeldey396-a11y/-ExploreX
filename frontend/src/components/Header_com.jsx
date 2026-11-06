import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage, SUPPORTED_LANGUAGES } from "../context/LanguageContext";

function Header_com() {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <div className="nav-logo">
        <Link to="/">ExploreX</Link>
      </div>

      <nav className="nav-links">
        <Link to="/">{t("nav_home")}</Link>
        <Link to="/explore">{t("nav_explore")}</Link>
        <Link to="/explore-3d">{t("nav_explore_3d")}</Link>
        <Link to="/navigate">{t("nav_navigate")}</Link>
        <Link to="/favorites">{t("nav_favorites")}</Link>
        <Link to="/hidden-gems">{t("nav_hidden_gems")}</Link>
        <Link to="/ai-assistant">{t("nav_ai_assistant")}</Link>
        <Link to="/trip-planner">{t("nav_trip_planner")}</Link>
        <Link to="/about">{t("nav_about")}</Link>
      </nav>

      <div className="auth-links">
        <div className="language-selector-wrap" title={t("nav_select_lang")}>
          <span className="lang-icon" aria-hidden="true">🌐</span>
          <select
            className="language-select"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label={t("nav_lang_label")}
          >
            {SUPPORTED_LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.flag} {l.nativeName} ({l.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>

        {user ? (
          <>
            <span className="user-name">
              {t("nav_hi_user", { name: user.name })}
            </span>

            <button
              type="button"
              className="logout-btn"
              onClick={handleLogout}
            >
              {t("nav_logout")}
            </button>
          </>
        ) : (
          <>
            <Link to="/login">{t("nav_login")}</Link>
            <Link to="/register" className="register-btn">
              {t("nav_register")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export default Header_com;
