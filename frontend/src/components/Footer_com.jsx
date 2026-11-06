import { useLanguage } from "../context/LanguageContext";

function Footer() {
  const { t } = useLanguage();

  return (
    <footer>
      <p>{t("footer_tagline")}</p>
      <p>{t("footer_desc")}</p>
      <p>{t("footer_rights")}</p>
    </footer>
  );
}

export default Footer;
