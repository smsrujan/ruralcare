import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Hospital,
  Pill,
  Ambulance,
  FlaskConical,
  Tent,
  Syringe,
  Landmark,
  BookOpen,
  Phone,
  Clock,
  MapPin,
  Search,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { HealthcareService, ServiceCategory } from '../types/ruralcare';

const CANONICAL_CATEGORIES: ServiceCategory[] = [
  'Nearby Hospitals',
  'Pharmacy Services',
  'Ambulance Services',
  'Laboratory Services',
  'Health Camps',
  'Vaccination Information',
  'Government Healthcare Schemes',
  'Health Awareness',
];

const CATEGORY_ICONS: Record<
  HealthcareService['category'],
  React.ComponentType<{ className?: string }>
> = {
  'Nearby Hospitals': Hospital,
  'Pharmacy Services': Pill,
  'Ambulance Services': Ambulance,
  'Laboratory Services': FlaskConical,
  'Health Camps': Tent,
  'Vaccination Information': Syringe,
  'Government Healthcare Schemes': Landmark,
  'Health Awareness': BookOpen,
};

export const Services: React.FC = () => {
  const { services, dataLoading } = useAuth();
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const isKn = language === 'kn';

  const categories = useMemo(
    () => ['All', ...CANONICAL_CATEGORIES],
    []
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return services.filter((srv) => {
      const matchesCat =
        selectedCategory === 'All' || srv.category === selectedCategory;
      const localizedCat = t(`services.categories.${srv.category}`).toLowerCase();
      const matchesQ =
        !q ||
        srv.title.toLowerCase().includes(q) ||
        (srv.titleKn ?? '').toLowerCase().includes(q) ||
        srv.category.toLowerCase().includes(q) ||
        localizedCat.includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        srv.descriptionKn.toLowerCase().includes(q) ||
        srv.facilityName.toLowerCase().includes(q) ||
        srv.facilityNameKn.toLowerCase().includes(q);
      return matchesCat && matchesQ;
    });
  }, [services, searchQuery, selectedCategory, t]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {t('services.title')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{t('services.subtitle')}</p>
      </div>

      {/* Search & Category Filter Tabs */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="relative max-w-md">
          <Search
            className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('services.searchPlaceholder')}
            aria-label={t('services.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
          />
        </div>

        <div className="flex flex-wrap gap-2" role="tablist" aria-label={t('services.title')}>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[38px] ${
                  active
                    ? 'bg-[#198754] text-white'
                    : 'bg-[#F5F7FA] text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {t(`services.categories.${cat}`)}
              </button>
            );
          })}
        </div>
      </section>

      {/* Individual Service Cards */}
      {dataLoading && services.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
          <span>{t('common.loading')}</span>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <p className="text-base font-semibold text-slate-900">
            {services.length === 0 ? t('services.noServicesInDb') : t('services.noMatches')}
          </p>
          {services.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="px-4 py-2 rounded-xl bg-[#198754] text-white text-sm font-semibold min-h-[40px]"
            >
              {t('services.showAll')}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredServices.map((srv) => {
            const Icon = CATEGORY_ICONS[srv.category] ?? Hospital;
            const isAmbulance = srv.category === 'Ambulance Services';
            const title = isKn && srv.titleKn ? srv.titleKn : srv.title;
            const facilityName = isKn ? srv.facilityNameKn : srv.facilityName;
            const description = isKn ? srv.descriptionKn : srv.description;
            const highlights = isKn ? srv.highlightsKn : srv.highlights;
            const distance = isKn ? srv.distanceKn : srv.distance;
            const timings = isKn ? srv.timingsKn : srv.timings;

            return (
              <article
                key={srv.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-[#0D6EFD]">
                        {t(`services.categories.${srv.category}`)}
                      </p>
                      <h2 className="font-display text-lg font-bold text-slate-900">{title}</h2>
                      <p className="text-xs text-slate-500">{facilityName}</p>
                    </div>
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        isAmbulance
                          ? 'bg-red-50 text-[#DC2626]'
                          : 'bg-emerald-50 text-[#198754]'
                      }`}
                    >
                      <Icon className="w-5 h-5" aria-hidden="true" />
                    </div>
                  </div>

                  <p className="text-sm text-slate-600 leading-relaxed">{description}</p>

                  {highlights.length > 0 && (
                    <p className="text-xs text-slate-600 pt-1">{highlights.join(' · ')}</p>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-700">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="truncate">{distance}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
                    <span className="truncate tabular-nums">{timings}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-semibold text-[#198754] tabular-nums">
                    <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>{srv.contact}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
