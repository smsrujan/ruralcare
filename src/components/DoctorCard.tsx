import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MapPin, Clock, Phone, Calendar, MessageSquare, Stethoscope, CheckCircle2, IndianRupee } from 'lucide-react';
import type { Doctor } from '../types/ruralcare';

interface DoctorCardProps {
  doctor: Doctor;
  onBookAppointment: (doctor: Doctor) => void;
  onConnectDoctor: (doctor: Doctor) => void;
}

export const DoctorCard: React.FC<DoctorCardProps> = ({
  doctor,
  onBookAppointment,
  onConnectDoctor,
}) => {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4">
      <div>
        <div className="flex items-start gap-4">
          {!imgError ? (
            <img
              src={doctor.photoUrl}
              alt={doctor.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-emerald-50 border border-slate-200 flex items-center justify-center text-[#198754] shrink-0">
              <Stethoscope className="w-7 h-7" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base font-bold text-slate-900 truncate">
              {doctor.name}
            </h3>
            <p className="text-sm font-medium text-[#198754]">{doctor.specialization}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
              <span>{doctor.qualifications}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {t('doctors.experienceYears', { years: doctor.experienceYears })}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              <strong className="font-medium text-slate-800">{doctor.hospital}</strong> ·{' '}
              {doctor.district || doctor.location}{' '}
              <span className="text-slate-500 tabular-nums">
                ({doctor.distanceKm} {t('common.kmAway')})
              </span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{doctor.timings}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
              <span className="tabular-nums">{doctor.phone}</span>
            </div>
            {doctor.consultationFee != null && (
              <div className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                <IndianRupee className="w-3.5 h-3.5 text-[#198754] shrink-0" aria-hidden="true" />
                <span>
                  {t('doctors.consultationFee')}: ₹{doctor.consultationFee}
                </span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs pt-1">
            {doctor.availableToday ? (
              <span className="inline-flex items-center gap-1.5 font-semibold text-[#198754]">
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('doctors.availableToday')}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{t('doctors.scheduledDays')}</span>
              </span>
            )}
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="text-slate-500">
              {t('doctors.speaks')}: {doctor.languages.join(', ')}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          onClick={() => onBookAppointment(doctor)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors min-h-[44px]"
        >
          <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('doctors.bookAppointment')}</span>
        </button>
        <button
          type="button"
          onClick={() => onConnectDoctor(doctor)}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors min-h-[44px]"
        >
          <MessageSquare className="w-4 h-4 shrink-0 text-[#0D6EFD]" aria-hidden="true" />
          <span>{t('doctors.consultOnline')}</span>
        </button>
      </div>
    </article>
  );
};
