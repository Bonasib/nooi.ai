import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import ar from "./locales/ar.json";
import { setI18nText, ui } from "./state";

i18n.use(initReactI18next).init({ resources: { en: { translation: en }, ar: { translation: ar } }, lng: ui.get().lang, fallbackLng: "en", interpolation: { escapeValue: false }, returnNull: false });
setI18nText((k) => i18n.t(k));
// the whole interface mirrors for Arabic; the timeline itself always runs left to right in time
export function applyLang(lang: "en" | "ar") {
  i18n.changeLanguage(lang); document.documentElement.lang = lang; document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
}
applyLang(ui.get().lang);
ui.subscribe(() => { const l = ui.get().lang; if (i18n.language !== l) applyLang(l); document.documentElement.dataset.theme = ui.get().theme; });
document.documentElement.dataset.theme = ui.get().theme;
export default i18n;
