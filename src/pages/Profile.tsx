import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User,
  Phone,
  MapPin,
  Droplets,
  ShieldAlert,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Save,
  X,
  Stethoscope,
  Camera,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateProfileEdit } from '../utils/validation';
import { extractSupabaseErrorMessage } from '../utils/supabaseMappers';

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'];
const GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'] as const;

export const Profile: React.FC = () => {
  const {
    userRole,
    patient,
    doctorAccount,
    updatePatientProfile,
    updateDoctorProfile,
    uploadAvatar,
  } = useAuth();
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    fullName: patient.fullName,
    age: String(patient.age),
    gender: patient.gender,
    mobileNumber: patient.mobileNumber,
    email: patient.email,
    village: patient.village,
    district: patient.district,
    state: patient.state,
    address: patient.address,
    pinCode: patient.pinCode,
    bloodGroup: patient.bloodGroup,
    emergencyContactName: patient.emergencyContactName,
    emergencyContactNumber: patient.emergencyContactNumber,
  });

  const [docForm, setDocForm] = useState({
    hospital: doctorAccount.hospital,
    timings: doctorAccount.timings,
    phone: doctorAccount.phone,
    location: doctorAccount.location,
    district: doctorAccount.district,
    availableToday: doctorAccount.availableToday,
  });

  useEffect(() => {
    setForm({
      fullName: patient.fullName,
      age: String(patient.age),
      gender: patient.gender,
      mobileNumber: patient.mobileNumber,
      email: patient.email,
      village: patient.village,
      district: patient.district,
      state: patient.state,
      address: patient.address,
      pinCode: patient.pinCode,
      bloodGroup: patient.bloodGroup,
      emergencyContactName: patient.emergencyContactName,
      emergencyContactNumber: patient.emergencyContactNumber,
    });
  }, [patient]);

  useEffect(() => {
    setDocForm({
      hospital: doctorAccount.hospital,
      timings: doctorAccount.timings,
      phone: doctorAccount.phone,
      location: doctorAccount.location,
      district: doctorAccount.district,
      availableToday: doctorAccount.availableToday,
    });
  }, [doctorAccount]);

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);
    setSavedNotice(null);
    setIsUploadingAvatar(true);
    try {
      await uploadAvatar(file);
      setSavedNotice(t('profile.uploadPhotoSuccess'));
      setTimeout(() => setSavedNotice(null), 3500);
    } catch (err) {
      setSaveError(
        extractSupabaseErrorMessage(err, t('profile.uploadPhotoError'))
      );
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSaveDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(null);
    setSavedNotice(null);
    setIsSaving(true);
    try {
      await updateDoctorProfile({
        hospital: docForm.hospital.trim() || doctorAccount.hospital,
        timings: docForm.timings.trim() || doctorAccount.timings,
        phone: docForm.phone.trim() || doctorAccount.phone,
        location: docForm.location.trim() || doctorAccount.location,
        district: docForm.district.trim() || doctorAccount.district,
        availableToday: docForm.availableToday,
      });
      setIsEditing(false);
      setSavedNotice(t('profile.doctorUpdatedSuccess'));
      setTimeout(() => setSavedNotice(null), 3500);
    } catch (err) {
      setSaveError(extractSupabaseErrorMessage(err, t('profile.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  if (userRole === 'doctor') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-slate-900">
              {t('profile.doctorTitle')}
            </h1>
            <p className="text-sm text-slate-600 mt-1">{t('profile.doctorSubtitle')}</p>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(true);
                setSavedNotice(null);
                setSaveError(null);
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
            >
              <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('profile.editProfile')}</span>
            </button>
          )}
        </div>

        {savedNotice && (
          <div
            role="status"
            className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-[#198754]"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{savedNotice}</span>
          </div>
        )}

        {saveError && (
          <div
            role="alert"
            className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{saveError}</span>
          </div>
        )}

        <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <img
              src={doctorAccount.photoUrl}
              alt={doctorAccount.fullName}
              referrerPolicy="no-referrer"
              className="w-20 h-20 rounded-2xl object-cover border border-slate-200 shrink-0"
            />
            <div className="space-y-1">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {doctorAccount.fullName}
              </h2>
              <p className="text-sm text-[#198754] font-medium">
                {doctorAccount.specialization} · {doctorAccount.qualifications}
              </p>
              <p className="text-xs font-mono text-slate-500">
                {doctorAccount.registrationNumber} ·{' '}
                {doctorAccount.availableToday ? t('common.available') : t('common.unavailable')}
              </p>
            </div>
          </div>

          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => void handleAvatarSelected(e)}
              className="hidden"
              id="doctor-avatar-upload"
            />
            <button
              type="button"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 min-h-[40px]"
            >
              {isUploadingAvatar ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Camera className="w-4 h-4 text-[#198754]" aria-hidden="true" />
              )}
              <span>
                {isUploadingAvatar ? t('supabase.uploadingPhoto') : t('supabase.uploadPhoto')}
              </span>
            </button>
          </div>
        </section>

        {isEditing ? (
          <form
            onSubmit={(e) => void handleSaveDoctor(e)}
            className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="doc-hosp" className="block text-sm font-medium text-slate-800 mb-1">
                  {t('profile.hospitalName')}
                </label>
                <input
                  id="doc-hosp"
                  type="text"
                  value={docForm.hospital}
                  onChange={(e) => setDocForm((p) => ({ ...p, hospital: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="doc-timings" className="block text-sm font-medium text-slate-800 mb-1">
                  {t('profile.availableTimings')}
                </label>
                <input
                  id="doc-timings"
                  type="text"
                  value={docForm.timings}
                  onChange={(e) => setDocForm((p) => ({ ...p, timings: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="doc-phone" className="block text-sm font-medium text-slate-800 mb-1">
                  {t('profile.phoneNumber')}
                </label>
                <input
                  id="doc-phone"
                  type="tel"
                  value={docForm.phone}
                  onChange={(e) => setDocForm((p) => ({ ...p, phone: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="doc-loc" className="block text-sm font-medium text-slate-800 mb-1">
                  {t('profile.location')}
                </label>
                <input
                  id="doc-loc"
                  type="text"
                  value={docForm.location}
                  onChange={(e) => setDocForm((p) => ({ ...p, location: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                />
              </div>
              <div>
                <label htmlFor="doc-district" className="block text-sm font-medium text-slate-800 mb-1">
                  {t('profile.district')}
                </label>
                <input
                  id="doc-district"
                  type="text"
                  value={docForm.district}
                  onChange={(e) => setDocForm((p) => ({ ...p, district: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                />
              </div>
              <div className="flex items-end pb-2">
                <label className="inline-flex items-center gap-2 text-sm text-slate-800 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={docForm.availableToday}
                    onChange={(e) =>
                      setDocForm((p) => ({ ...p, availableToday: e.target.checked }))
                    }
                    className="w-4 h-4 rounded border-slate-300 accent-[#198754]"
                  />
                  <span>{t('doctors.availableToday')}</span>
                </label>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-sm font-semibold min-h-[44px]"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4" aria-hidden="true" />
                )}
                <span>{isSaving ? t('common.saving') : t('profile.saveChanges')}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold min-h-[44px]"
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </form>
        ) : (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <Stethoscope className="w-5 h-5 text-[#198754]" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold">{t('profile.personalContact')}</h3>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.specialization')}</dt>
                <dd className="font-medium text-slate-900 text-right">{doctorAccount.specialization}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.qualification')}</dt>
                <dd className="font-medium text-slate-900 text-right">{doctorAccount.qualifications}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.experience')}</dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">
                  {t('doctors.experienceYears', { years: doctorAccount.experienceYears })}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.hospitalName')}</dt>
                <dd className="font-medium text-slate-900 text-right">{doctorAccount.hospital}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.district')}</dt>
                <dd className="font-medium text-slate-900 text-right">{doctorAccount.district || '—'}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.availableTimings')}</dt>
                <dd className="font-medium text-slate-900 text-right">{doctorAccount.timings}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.phoneNumber')}</dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">{doctorAccount.phone}</dd>
              </div>
            </dl>
          </section>
        )}
      </div>
    );
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    setSaveError(null);
    setSavedNotice(null);

    const numericAge = Number(form.age);
    const validationErrors = validateProfileEdit(
      {
        fullName: form.fullName,
        age: numericAge,
        gender: form.gender,
        mobileNumber: form.mobileNumber,
        village: form.village,
        district: form.district,
        address: form.address,
        bloodGroup: form.bloodGroup,
        emergencyContactName: form.emergencyContactName,
        emergencyContactNumber: form.emergencyContactNumber,
      },
      t
    );

    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    setIsSaving(true);
    try {
      await updatePatientProfile({
        fullName: form.fullName.trim(),
        age: numericAge,
        gender: form.gender,
        mobileNumber: form.mobileNumber.trim(),
        village: form.village.trim(),
        district: form.district.trim(),
        state: form.state.trim(),
        address: form.address.trim(),
        pinCode: form.pinCode.trim(),
        bloodGroup: form.bloodGroup,
        emergencyContactName: form.emergencyContactName.trim(),
        emergencyContactNumber: form.emergencyContactNumber.trim(),
      });

      setIsEditing(false);
      setSavedNotice(t('profile.updatedSuccess'));
      setTimeout(() => setSavedNotice(null), 3500);
    } catch (err) {
      setSaveError(extractSupabaseErrorMessage(err, t('profile.saveError')));
    } finally {
      setIsSaving(false);
    }
  };

  const genderDisplay =
    patient.gender === 'Male' ||
    patient.gender === 'Female' ||
    patient.gender === 'Other' ||
    patient.gender === 'Prefer not to say'
      ? t(`register.genders.${patient.gender}`)
      : patient.gender;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">{t('profile.title')}</h1>
          <p className="text-sm text-slate-600 mt-1">{t('profile.subtitle')}</p>
        </div>

        {!isEditing && (
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              setSavedNotice(null);
              setSaveError(null);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
          >
            <Edit3 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('profile.editProfile')}</span>
          </button>
        )}
      </div>

      {savedNotice && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-[#198754]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{savedNotice}</span>
        </div>
      )}

      {saveError && (
        <div
          role="alert"
          className="flex items-center gap-2.5 p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
        >
          <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Profile Header Summary */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <img
            src={patient.avatarUrl}
            alt={patient.fullName}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover border border-slate-200 bg-slate-100 shrink-0"
          />
          <div className="space-y-1 min-w-0">
            <h2 className="font-display text-xl font-bold text-slate-900">{patient.fullName}</h2>
            <p className="text-sm text-slate-600">
              {t('common.healthId')}:{' '}
              <span className="font-mono font-semibold text-[#198754]">{patient.healthId}</span> ·{' '}
              <span className="tabular-nums">
                {patient.age} {t('common.years')}
              </span>{' '}
              · {genderDisplay}
            </p>
            <p className="text-sm text-slate-500">
              {patient.village}, {patient.district}, {patient.state} – {patient.pinCode}
            </p>
          </div>
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={(e) => void handleAvatarSelected(e)}
            className="hidden"
            id="patient-avatar-upload"
          />
          <button
            type="button"
            disabled={isUploadingAvatar}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs sm:text-sm font-semibold text-slate-700 min-h-[40px]"
          >
            {isUploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <Camera className="w-4 h-4 text-[#198754]" aria-hidden="true" />
            )}
            <span>
              {isUploadingAvatar ? t('supabase.uploadingPhoto') : t('supabase.uploadPhoto')}
            </span>
          </button>
        </div>
      </section>

      {isEditing ? (
        <form
          onSubmit={(e) => void handleSave(e)}
          className="bg-white border border-slate-200 rounded-2xl p-6 space-y-6"
          noValidate
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label htmlFor="prof-name" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.fullName')}
              </label>
              <input
                id="prof-name"
                type="text"
                value={form.fullName}
                onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
              {errors.fullName && <p className="text-xs text-[#DC2626] mt-1">{errors.fullName}</p>}
            </div>

            <div>
              <label htmlFor="prof-age" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.age')}
              </label>
              <input
                id="prof-age"
                type="number"
                min={0}
                max={125}
                value={form.age}
                onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] tabular-nums"
              />
              {errors.age && <p className="text-xs text-[#DC2626] mt-1">{errors.age}</p>}
            </div>

            <div>
              <label htmlFor="prof-gender" className="block text-sm font-medium text-slate-800 mb-1">
                {t('register.gender')}
              </label>
              <select
                id="prof-gender"
                value={form.gender}
                onChange={(e) => setForm((p) => ({ ...p, gender: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
              >
                {GENDERS.map((g) => (
                  <option key={g} value={g}>
                    {t(`register.genders.${g}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prof-phone" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.phoneNumber')}
              </label>
              <input
                id="prof-phone"
                type="tel"
                value={form.mobileNumber}
                onChange={(e) => setForm((p) => ({ ...p, mobileNumber: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] tabular-nums"
              />
              {errors.mobileNumber && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.mobileNumber}</p>
              )}
            </div>

            <div>
              <label htmlFor="prof-blood" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.bloodGroup')}
              </label>
              <select
                id="prof-blood"
                value={form.bloodGroup}
                onChange={(e) => setForm((p) => ({ ...p, bloodGroup: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
              >
                {BLOOD_GROUPS.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="prof-village" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.village')}
              </label>
              <input
                id="prof-village"
                type="text"
                value={form.village}
                onChange={(e) => setForm((p) => ({ ...p, village: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
              {errors.village && <p className="text-xs text-[#DC2626] mt-1">{errors.village}</p>}
            </div>

            <div>
              <label htmlFor="prof-district" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.district')}
              </label>
              <input
                id="prof-district"
                type="text"
                value={form.district}
                onChange={(e) => setForm((p) => ({ ...p, district: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
              {errors.district && <p className="text-xs text-[#DC2626] mt-1">{errors.district}</p>}
            </div>

            <div>
              <label htmlFor="prof-state" className="block text-sm font-medium text-slate-800 mb-1">
                {t('register.state')}
              </label>
              <input
                id="prof-state"
                type="text"
                value={form.state}
                onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
            </div>

            <div>
              <label htmlFor="prof-pin" className="block text-sm font-medium text-slate-800 mb-1">
                {t('register.pinCode')}
              </label>
              <input
                id="prof-pin"
                type="text"
                maxLength={6}
                value={form.pinCode}
                onChange={(e) => setForm((p) => ({ ...p, pinCode: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] tabular-nums"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label htmlFor="prof-address" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.fullAddress')}
              </label>
              <input
                id="prof-address"
                type="text"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
              {errors.address && <p className="text-xs text-[#DC2626] mt-1">{errors.address}</p>}
            </div>

            <div>
              <label htmlFor="prof-emg-name" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.emergencyContactName')}
              </label>
              <input
                id="prof-emg-name"
                type="text"
                value={form.emergencyContactName}
                onChange={(e) =>
                  setForm((p) => ({ ...p, emergencyContactName: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
              />
              {errors.emergencyContactName && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.emergencyContactName}</p>
              )}
            </div>

            <div>
              <label htmlFor="prof-emg-phone" className="block text-sm font-medium text-slate-800 mb-1">
                {t('profile.emergencyContactNumber')}
              </label>
              <input
                id="prof-emg-phone"
                type="tel"
                value={form.emergencyContactNumber}
                onChange={(e) =>
                  setForm((p) => ({ ...p, emergencyContactNumber: e.target.value }))
                }
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] tabular-nums"
              />
              {errors.emergencyContactNumber && (
                <p className="text-xs text-[#DC2626] mt-1">{errors.emergencyContactNumber}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] disabled:opacity-70 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="w-4 h-4" aria-hidden="true" />
              )}
              <span>{isSaving ? t('common.saving') : t('profile.saveChanges')}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setErrors({});
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition-colors min-h-[44px]"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>{t('common.cancel')}</span>
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <User className="w-5 h-5 text-[#198754]" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold">{t('profile.personalContact')}</h3>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.fullName')}</dt>
                <dd className="font-medium text-slate-900 text-right">{patient.fullName}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.ageGender')}</dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">
                  {patient.age} {t('common.years')} · {genderDisplay}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.dob')}</dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">
                  {patient.dateOfBirth}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('profile.phoneNumber')}</span>
                </dt>
                <dd className="font-medium text-slate-900 tabular-nums text-right">
                  {patient.mobileNumber}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.emailAddress')}</dt>
                <dd className="font-medium text-slate-900 text-right">{patient.email}</dd>
              </div>
            </dl>
          </section>

          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-slate-900">
              <MapPin className="w-5 h-5 text-[#0D6EFD]" aria-hidden="true" />
              <h3 className="font-display text-lg font-bold">{t('profile.villageAddressSection')}</h3>
            </div>
            <dl className="divide-y divide-slate-100 text-sm">
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.village')}</dt>
                <dd className="font-medium text-slate-900 text-right">{patient.village}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.districtState')}</dt>
                <dd className="font-medium text-slate-900 text-right">
                  {patient.district}, {patient.state}
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500">{t('profile.addressPin')}</dt>
                <dd className="font-medium text-slate-900 text-right max-w-xs">
                  {patient.address} ({patient.pinCode})
                </dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                  <span>{t('profile.bloodGroup')}</span>
                </dt>
                <dd className="font-bold text-[#DC2626] text-right">{patient.bloodGroup}</dd>
              </div>
              <div className="py-2.5 flex justify-between gap-4">
                <dt className="text-slate-500 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-[#DC2626]" aria-hidden="true" />
                  <span>{t('profile.emergencyContact')}</span>
                </dt>
                <dd className="font-medium text-slate-900 text-right tabular-nums">
                  {patient.emergencyContactName} ({patient.emergencyContactNumber})
                </dd>
              </div>
            </dl>
          </section>
        </div>
      )}
    </div>
  );
};
