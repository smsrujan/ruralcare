import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertTriangle,
  MapPin,
  PhoneCall,
  ShieldAlert,
  Ambulance,
  Clock,
  Info,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { extractSupabaseErrorMessage } from '../utils/supabaseMappers';

export const EmergencyAlert: React.FC = () => {
  const {
    patient,
    doctorAccount,
    userRole,
    emergencies,
    dataLoading,
    logEmergencyEvent,
    updateEmergencyStatus,
  } = useAuth();
  const { t } = useTranslation();

  const isDoctor = userRole === 'doctor';

  const [locationState, setLocationState] = useState<
    'idle' | 'requesting' | 'shared' | 'unavailable'
  >('idle');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [coordinates, setCoordinates] = useState<string | null>(null);
  const [locationErrorType, setLocationErrorType] = useState<'denied' | 'unavailable' | null>(null);

  const [emergencyDescription, setEmergencyDescription] = useState('');
  const [confirmSosOpen, setConfirmSosOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sosError, setSosError] = useState<string | null>(null);
  const [sosOutcomeCoords, setSosOutcomeCoords] = useState<string | null | undefined>(undefined);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const locationMessage =
    locationState === 'requesting'
      ? t('emergency.gpsRequesting')
      : locationState === 'shared' && coordinates
      ? t('emergency.gpsCaptured', { coords: coordinates })
      : locationState === 'unavailable'
      ? locationErrorType === 'denied'
        ? t('emergency.gpsDenied')
        : t('emergency.gpsUnavailable')
      : t('emergency.gpsIdle');

  const requestGpsLocation = () => {
    if (!('geolocation' in navigator)) {
      setLocationState('unavailable');
      setLocationErrorType('unavailable');
      setCoordinates(null);
      setLatitude(null);
      setLongitude(null);
      return;
    }

    setLocationState('requesting');
    setLocationErrorType(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lon = Number(position.coords.longitude.toFixed(6));
        setLatitude(lat);
        setLongitude(lon);
        setCoordinates(`${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`);
        setLocationState('shared');
        setLocationErrorType(null);
      },
      (err) => {
        setLocationState('unavailable');
        setLatitude(null);
        setLongitude(null);
        setCoordinates(null);
        setLocationErrorType(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleConfirmSos = async () => {
    setIsSubmitting(true);
    setSosError(null);
    const hasCoords = locationState === 'shared' && coordinates !== null;

    try {
      await logEmergencyEvent({
        emergencyDescription:
          emergencyDescription.trim() ||
          `Urgent medical assistance requested from ${patient.village}, ${patient.district}`,
        locationLabel: `${patient.village || doctorAccount.district || 'Rural Area'}, ${
          patient.district || doctorAccount.district || ''
        }`.replace(/,\s*$/, ''),
        latitude: hasCoords ? latitude : null,
        longitude: hasCoords ? longitude : null,
        locationSharingStatus: hasCoords ? 'Shared' : 'Unavailable',
      });

      setConfirmSosOpen(false);
      setEmergencyDescription('');
      setSosOutcomeCoords(hasCoords ? coordinates : null);
    } catch (err) {
      setSosError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
      setConfirmSosOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDoctorAlertStatus = async (
    alertId: string,
    nextStatus: 'Acknowledged' | 'Resolved',
    patientId?: string
  ) => {
    setUpdatingId(alertId);
    setSosError(null);
    try {
      await updateEmergencyStatus(alertId, nextStatus, patientId);
    } catch (err) {
      setSosError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setUpdatingId(null);
    }
  };

  const sosOutcomeMessage =
    sosOutcomeCoords === undefined
      ? null
      : sosOutcomeCoords !== null
      ? t('emergency.outcomeWithGps', { coords: sosOutcomeCoords })
      : t('emergency.outcomeWithoutGps');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {t('emergency.title')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">{t('emergency.subtitle')}</p>
      </div>

      {/* Honest System Capability Banner */}
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-950 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" aria-hidden="true" />
        <span>{t('emergency.honestNotice')}</span>
      </div>

      {sosError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
        >
          {sosError}
        </div>
      )}

      {/* Prominent SOS Action Section (Patients) */}
      {!isDoctor && (
        <section className="bg-white border border-red-200 rounded-2xl p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl flex-1">
            <div className="inline-flex items-center gap-2 text-sm font-bold text-[#DC2626]">
              <ShieldAlert className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{t('emergency.urgentHeading')}</span>
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900">
              {t('emergency.urgentTitle', {
                village: patient.village || '—',
                district: patient.district || '—',
              })}
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">{t('emergency.urgentDesc')}</p>

            <div>
              <label
                htmlFor="sos-description"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                {t('emergency.descriptionLabel')}
              </label>
              <textarea
                id="sos-description"
                rows={2}
                value={emergencyDescription}
                onChange={(e) => setEmergencyDescription(e.target.value)}
                placeholder={t('emergency.descriptionPlaceholder')}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setConfirmSosOpen(true)}
              className="inline-flex items-center justify-center gap-2.5 px-7 py-4 rounded-2xl bg-[#DC2626] hover:bg-red-700 text-white text-base font-bold transition-colors whitespace-nowrap min-h-[56px]"
            >
              <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
              <span>{t('emergency.sosButton')}</span>
            </button>

            <button
              type="button"
              onClick={requestGpsLocation}
              disabled={locationState === 'requesting'}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
            >
              {locationState === 'requesting' ? (
                <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
              ) : (
                <MapPin className="w-4 h-4 text-[#0D6EFD] shrink-0" aria-hidden="true" />
              )}
              <span>{t('emergency.shareLocation')}</span>
            </button>
          </div>
        </section>
      )}

      {/* Outcome Notice */}
      {sosOutcomeMessage && (
        <div
          role="status"
          className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-[#198754] flex items-start gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{sosOutcomeMessage}</span>
        </div>
      )}

      {/* GPS Location Status + Contacts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* GPS Location Sharing Card */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900">
            <MapPin className="w-5 h-5 text-[#0D6EFD]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold">{t('emergency.gpsTitle')}</h3>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed">{locationMessage}</p>
          <div className="pt-2 border-t border-slate-100 text-xs text-slate-500 space-y-1">
            <p>
              {t('emergency.registeredVillage')}:{' '}
              <strong className="text-slate-800">
                {isDoctor
                  ? `${doctorAccount.hospital}, ${doctorAccount.district}`
                  : `${patient.village}, ${patient.district}`}
              </strong>
            </p>
            <p>
              {t('emergency.locationStatus')}:{' '}
              <strong
                className={
                  locationState === 'shared'
                    ? 'text-[#198754]'
                    : locationState === 'unavailable'
                    ? 'text-[#DC2626]'
                    : 'text-slate-700'
                }
              >
                {locationState === 'shared'
                  ? t('emergency.statusReady')
                  : locationState === 'unavailable'
                  ? t('emergency.statusUnavailable')
                  : t('emergency.statusNotRequested')}
              </strong>
            </p>
          </div>
        </section>

        {/* Registered Emergency Contact */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900">
            <PhoneCall className="w-5 h-5 text-[#198754]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold">
              {t('emergency.emergencyContact')}
            </h3>
          </div>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-slate-500">{t('emergency.primaryContact')}</dt>
              <dd className="font-semibold text-slate-900">
                {isDoctor ? doctorAccount.hospital : patient.emergencyContactName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">{t('emergency.contactNumber')}</dt>
              <dd className="font-mono font-semibold text-[#198754] tabular-nums">
                {isDoctor ? doctorAccount.phone : patient.emergencyContactNumber || '—'}
              </dd>
            </div>
            {!isDoctor && (
              <div>
                <dt className="text-xs text-slate-500">{t('emergency.patientBloodGroup')}</dt>
                <dd className="font-bold text-[#DC2626]">{patient.bloodGroup || '—'}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* Ambulance Contact Information */}
        <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-slate-900">
            <Ambulance className="w-5 h-5 text-[#DC2626]" aria-hidden="true" />
            <h3 className="font-display text-base font-bold">
              {t('emergency.ambulanceContact')}
            </h3>
          </div>
          <ul className="divide-y divide-slate-100 text-sm">
            <li className="py-2 flex items-center justify-between gap-2">
              <span className="text-slate-700">{t('emergency.ambulance108')}</span>
              <a
                href="tel:108"
                className="font-mono font-bold text-[#DC2626] hover:underline tabular-nums"
              >
                108
              </a>
            </li>
            <li className="py-2 flex items-center justify-between gap-2">
              <span className="text-slate-700">{t('emergency.ambulance102')}</span>
              <a
                href="tel:102"
                className="font-mono font-bold text-[#198754] hover:underline tabular-nums"
              >
                102
              </a>
            </li>
            <li className="py-2 flex items-center justify-between gap-2">
              <span className="text-slate-700">{t('emergency.national112')}</span>
              <a
                href="tel:112"
                className="font-mono font-bold text-slate-900 hover:underline tabular-nums"
              >
                112
              </a>
            </li>
          </ul>
        </section>
      </div>

      {/* Emergency History */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-500" aria-hidden="true" />
            <span>{t('emergency.emergencyHistory')}</span>
          </h2>
          <span className="text-xs text-slate-500 tabular-nums">
            {t('emergency.eventsCount', { count: emergencies.length })}
          </span>
        </div>

        {dataLoading && emergencies.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
            <span>{t('common.loading')}</span>
          </div>
        ) : emergencies.length === 0 ? (
          <p className="text-sm text-slate-500">{t('emergency.noAlerts')}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {emergencies.map((item) => {
              const statusStyle =
                item.status === 'Resolved'
                  ? 'bg-emerald-50 text-[#198754] border-emerald-200'
                  : item.status === 'Acknowledged'
                  ? 'bg-blue-50 text-[#0D6EFD] border-blue-200'
                  : 'bg-red-50 text-[#DC2626] border-red-200';
              return (
                <article key={item.id} className="py-4 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900">
                        {item.patientName ? `${item.patientName} — ` : ''}
                        {item.locationLabel}{' '}
                        {item.coordinates && (
                          <span className="font-mono text-xs font-normal text-slate-500">
                            ({item.coordinates})
                          </span>
                        )}
                      </p>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${statusStyle}`}
                      >
                        {t(`emergency.status.${item.status}`)}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-slate-500 tabular-nums">
                      {item.triggeredAt}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600">
                    {t('emergency.locationStatus')}: <strong>{item.locationStatus}</strong> ·{' '}
                    {t('emergency.emergencyContact')}: {item.contactNotified}
                    {item.patientBloodGroup ? ` · ${item.patientBloodGroup}` : ''}
                  </p>
                  {item.notes && <p className="text-xs text-slate-600">{item.notes}</p>}

                  {isDoctor && item.status !== 'Resolved' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {item.status === 'Logged' && (
                        <button
                          type="button"
                          disabled={updatingId === item.id}
                          onClick={() =>
                            handleDoctorAlertStatus(item.id, 'Acknowledged', item.patientId)
                          }
                          className="px-3 py-1.5 rounded-lg bg-[#0D6EFD] hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
                        >
                          {t('emergency.acknowledgeBtn')}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={updatingId === item.id}
                        onClick={() =>
                          handleDoctorAlertStatus(item.id, 'Resolved', item.patientId)
                        }
                        className="px-3 py-1.5 rounded-lg bg-[#198754] hover:bg-[#146c43] text-white text-xs font-semibold disabled:opacity-60"
                      >
                        {t('emergency.resolveBtn')}
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* SOS Confirmation Dialog */}
      {confirmSosOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sos-confirm-title"
        >
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-[#DC2626] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h3 id="sos-confirm-title" className="font-display text-lg font-bold text-slate-900">
                  {t('emergency.confirmTitle')}
                </h3>
                <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                  {t('emergency.confirmDesc', {
                    contact: patient.emergencyContactName || 'Primary Contact',
                    phone: patient.emergencyContactNumber || '108',
                    location:
                      locationState === 'shared' && coordinates
                        ? coordinates
                        : t('emergency.statusUnavailable'),
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setConfirmSosOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 min-h-[44px]"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSos}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-red-700 text-white text-sm font-semibold min-h-[44px] disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
                <span>{t('emergency.confirmBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
