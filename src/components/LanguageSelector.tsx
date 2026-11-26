import React, { useState, useRef, useEffect } from 'react';
import { Languages, ChevronDown, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../context/LanguageContext';
import type { SupportedLanguage } from '../i18n';

interface LanguageSelectorProps {
  compact?: boolean;
}

const OPTIONS: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'kn', label: 'ಕನ್ನಡ', flag: '🇮🇳' },
];

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const currentOption = OPTIONS.find((opt) => opt.code === language) ?? OPTIONS[0];

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('common.languageLabel')}: ${currentOption.label}`}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[40px]"
      >
        <Languages className="w-4 h-4 text-[#198754] shrink-0" aria-hidden="true" />
        {!compact && (
          <span className="hidden sm:inline text-slate-500">{t('common.languageLabel')}:</span>
        )}
        <span className="font-semibold text-slate-900">
          {currentOption.flag} {currentOption.label}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label={t('common.languageLabel')}
          className="absolute right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-lg py-1.5 z-50"
        >
          {OPTIONS.map((opt) => {
            const selected = opt.code === language;
            return (
              <li key={opt.code} role="option" aria-selected={selected}>
                <button
                  type="button"
                  onClick={() => {
                    setLanguage(opt.code);
                    setOpen(false);
                  }}
                  className={`w-full px-3.5 py-2.5 text-left text-sm flex items-center justify-between gap-2 transition-colors min-h-[40px] ${
                    selected
                      ? 'bg-emerald-50 text-[#198754] font-semibold'
                      : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span aria-hidden="true">{opt.flag}</span>
                    <span>{opt.code === 'en' ? 'English' : 'ಕನ್ನಡ (Kannada)'}</span>
                  </span>
                  {selected && <Check className="w-4 h-4 shrink-0" aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
