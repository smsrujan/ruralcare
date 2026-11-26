import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import enTranslation from './locales/en/translation.json';
import knTranslation from './locales/kn/translation.json';

export const LANGUAGE_STORAGE_KEY = 'ruralcare_language';
export type SupportedLanguage = 'en' | 'kn';

export function getInitialLanguage(): SupportedLanguage {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved === 'kn' || saved === 'en') {
      return saved;
    }
  } catch {
    // Ignore storage errors
  }
  return 'en';
}

const initialLanguage = getInitialLanguage();

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: enTranslation },
    kn: { translation: knTranslation },
  },
  lng: initialLanguage,
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = initialLanguage;
}

export default i18n;
