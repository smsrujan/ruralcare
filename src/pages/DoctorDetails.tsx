import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, SlidersHorizontal, Stethoscope, Loader2 } from 'lucide-react';
import type { Doctor } from '../types/ruralcare';
import { useAuth } from '../context/AuthContext';
import { filterDoctorsDirectory } from '../utils/supabaseMappers';
import { DoctorCard } from '../components/DoctorCard';

export const DoctorDetails: React.FC = () => {
  const navigate = useNavigate();
  const { doctors, dataLoading } = useAuth();
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState('');
  const [specialization, setSpecialization] = useState('All');
  const [district, setDistrict] = useState('All');
  const [maxDistance, setMaxDistance] = useState<number | null>(null);
  const [onlyAvailableToday, setOnlyAvailableToday] = useState(false);

  const specializations = useMemo(() => {
    const unique = Array.from(
      new Set(doctors.map((d) => d.specialization).filter(Boolean))
    );
    return ['All', ...unique];
  }, [doctors]);

  const districts = useMemo(() => {
    const unique = Array.from(
      new Set(doctors.map((d) => d.district).filter(Boolean))
    );
    return ['All', ...unique];
  }, [doctors]);

  const filteredDoctors = useMemo(() => {
    return filterDoctorsDirectory(doctors, {
      searchQuery,
      specialization,
      district,
      maxDistanceKm: maxDistance,
      onlyAvailableToday,
    });
  }, [doctors, searchQuery, specialization, district, maxDistance, onlyAvailableToday]);

  const handleBookAppointment = (doctor: Doctor) => {
    navigate(`/appointments?doctorId=${encodeURIComponent(doctor.id)}`);
  };

  const handleConnectDoctor = (doctor: Doctor) => {
    navigate(`/connect-doctor?doctorId=${encodeURIComponent(doctor.id)}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{t('doctors.title')}</h1>
        <p className="text-sm text-slate-600 mt-1">{t('doctors.subtitle')}</p>
      </div>

      {/* Search and Filters */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('doctors.searchPlaceholder')}
              aria-label={t('doctors.searchDoctors')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={specialization}
              onChange={(e) => setSpecialization(e.target.value)}
              aria-label={t('doctors.specialization')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
            >
              {specializations.map((spec) => (
                <option key={spec} value={spec}>
                  {spec === 'All' ? t('doctors.allSpecializations') : spec}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3">
            <select
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              aria-label={t('doctors.districtFilter')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
            >
              {districts.map((dist) => (
                <option key={dist} value={dist}>
                  {dist === 'All' ? t('doctors.allDistricts') : dist}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={maxDistance === null ? 'all' : String(maxDistance)}
              onChange={(e) =>
                setMaxDistance(e.target.value === 'all' ? null : Number(e.target.value))
              }
              aria-label={t('doctors.anyDistance')}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
            >
              <option value="all">{t('doctors.anyDistance')}</option>
              <option value="5">{t('doctors.withinKm', { km: 5 })}</option>
              <option value="10">{t('doctors.withinKm', { km: 10 })}</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-sm">
          <label className="inline-flex items-center gap-2 text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyAvailableToday}
              onChange={(e) => setOnlyAvailableToday(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-[#198754]"
            />
            <span>{t('doctors.onlyAvailableToday')}</span>
          </label>

          <span className="text-xs text-slate-500 inline-flex items-center gap-1.5 tabular-nums">
            <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {t('doctors.showingCount', {
                shown: filteredDoctors.length,
                total: doctors.length,
              })}
            </span>
          </span>
        </div>
      </section>

      {/* Doctors Grid */}
      {dataLoading && doctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-2">
          <Loader2 className="w-8 h-8 animate-spin text-[#198754] mx-auto" aria-hidden="true" />
          <p className="text-sm text-slate-600">{t('common.loading')}</p>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t('doctors.noMatchesTitle')}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t('doctors.noDoctorsInSupabase')}
          </p>
        </div>
      ) : filteredDoctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center space-y-3">
          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto" aria-hidden="true" />
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {t('doctors.noMatchesTitle')}
          </h2>
          <p className="text-sm text-slate-600 max-w-md mx-auto">
            {t('doctors.noMatchesDesc')}
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSpecialization('All');
              setDistrict('All');
              setMaxDistance(null);
              setOnlyAvailableToday(false);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#198754] text-white text-sm font-semibold min-h-[44px]"
          >
            {t('doctors.resetFilters')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredDoctors.map((doc) => (
            <DoctorCard
              key={doc.id}
              doctor={doc}
              onBookAppointment={handleBookAppointment}
              onConnectDoctor={handleConnectDoctor}
            />
          ))}
        </div>
      )}
    </div>
  );
};
