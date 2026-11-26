import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LANGUAGE_STORAGE_KEY,
  getInitialLanguage,
  type SupportedLanguage,
} from '../i18n';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<SupportedLanguage>(() => getInitialLanguage());

  useEffect(() => {
    if (i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
      // Ignore storage quota errors
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
    }
  }, [language, i18n]);

  const setLanguage = useCallback(
    (nextLang: SupportedLanguage) => {
      setLanguageState(nextLang);
      void i18n.changeLanguage(nextLang);
      try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLang);
      } catch {
        // Ignore storage errors
      }
      if (typeof document !== 'undefined') {
        document.documentElement.lang = nextLang;
      }
    },
    [i18n]
  );

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}
