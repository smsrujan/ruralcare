import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Phone, MapPin, Droplets, ShieldCheck, User } from 'lucide-react';
import type { PatientProfile } from '../types/ruralcare';
import { generateQrMatrix } from '../utils/healthUtils';

interface HealthCardProps {
  patient: PatientProfile;
  compact?: boolean;
  cardRef?: React.RefObject<HTMLDivElement | null>;
}

export const HealthCard: React.FC<HealthCardProps> = ({
  patient,
  compact = false,
  cardRef,
}) => {
  const [imgError, setImgError] = useState(false);
  const { t } = useTranslation();

  const qrPayload = `${patient.healthId}|${patient.fullName}|${patient.bloodGroup}|${patient.village},${patient.district}`;
  const qrMatrix = useMemo(() => generateQrMatrix(qrPayload), [qrPayload]);

  const genderLabel =
    patient.gender === 'Male' ||
    patient.gender === 'Female' ||
    patient.gender === 'Other' ||
    patient.gender === 'Prefer not to say'
      ? t(`register.genders.${patient.gender}`)
      : patient.gender;

  return (
    <div
      ref={cardRef}
      className="bg-white border border-slate-200 rounded-2xl overflow-hidden max-w-2xl w-full"
    >
      {/* Green Header Strip */}
      <div className="bg-[#198754] text-white px-5 py-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <ShieldCheck className="w-5 h-5 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-display text-sm sm:text-base font-bold tracking-tight truncate">
              {t('healthCard.cardTitle')}
            </p>
            <p className="text-xs text-emerald-100 truncate">
              {t('healthCard.cardSubtitle')}
            </p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] text-emerald-100">{t('common.healthId')}</p>
          <p className="font-mono text-sm sm:text-base font-semibold tabular-nums">
            {patient.healthId}
          </p>
        </div>
      </div>

      {/* Card Body */}
      <div className={`p-5 ${compact ? 'sm:p-5' : 'sm:p-6'} flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between`}>
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {!imgError ? (
            <img
              src={patient.avatarUrl}
              alt={patient.fullName}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`${
                compact ? 'w-16 h-16' : 'w-20 h-20'
              } rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0`}
            />
          ) : (
            <div
              className={`${
                compact ? 'w-16 h-16' : 'w-20 h-20'
              } rounded-xl bg-emerald-50 border border-slate-200 flex items-center justify-center text-[#198754] shrink-0`}
            >
              <User className="w-8 h-8" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 space-y-1.5">
            <h3 className="font-display text-lg font-bold text-slate-900 truncate">
              {patient.fullName}
            </h3>
            <p className="text-sm text-slate-600 tabular-nums">
              {patient.age} {t('common.yrs')} · {genderLabel} · {patient.dateOfBirth}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-1.5 pt-1 text-xs sm:text-sm text-slate-700">
              <div className="flex items-center gap-1.5">
                <Droplets className="w-4 h-4 text-[#DC2626] shrink-0" aria-hidden="true" />
                <span>
                  {t('profile.bloodGroup')}:{' '}
                  <strong className="font-semibold text-slate-900">{patient.bloodGroup}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 tabular-nums">
                <Phone className="w-4 h-4 text-[#198754] shrink-0" aria-hidden="true" />
                <span>{patient.mobileNumber}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:col-span-2">
                <MapPin className="w-4 h-4 text-[#0D6EFD] shrink-0" aria-hidden="true" />
                <span className="truncate">
                  {patient.village}, {patient.district}, {patient.state} – {patient.pinCode}
                </span>
              </div>
            </div>

            {!compact && (
              <p className="text-xs text-slate-600 pt-1">
                {t('profile.emergencyContact')}:{' '}
                <strong className="text-slate-800">{patient.emergencyContactName}</strong> ({patient.emergencyContactNumber})
              </p>
            )}
          </div>
        </div>

        {/* QR Code Representation */}
        <div className="flex flex-col items-center shrink-0 self-center sm:self-auto bg-[#F5F7FA] p-2.5 rounded-xl border border-slate-200">
          <svg
            viewBox="0 0 21 21"
            className={compact ? 'w-20 h-20' : 'w-24 h-24'}
            role="img"
            aria-label={`QR ${patient.healthId}`}
          >
            <rect width="21" height="21" fill="#ffffff" />
            {qrMatrix.map((row, rIdx) =>
              row.map((cell, cIdx) =>
                cell ? (
                  <rect
                    key={`${rIdx}-${cIdx}`}
                    x={cIdx}
                    y={rIdx}
                    width="1"
                    height="1"
                    fill="#0F172A"
                  />
                ) : null
              )
            )}
          </svg>
          <span className="font-mono text-[10px] text-slate-500 mt-1 tabular-nums">
            {patient.healthId}
          </span>
        </div>
      </div>
    </div>
  );
};
