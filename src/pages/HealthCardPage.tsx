import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Download,
  FileText,
  AlertCircle,
  HeartPulse,
  CheckCircle2,
  Plus,
  Trash2,
  Pencil,
  Upload,
  FileCheck2,
  Loader2,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { HealthCard } from '../components/HealthCard';
import { extractSupabaseErrorMessage } from '../utils/supabaseMappers';
import type { MedicalRecordItem, PatientProfile } from '../types/ruralcare';

export const HealthCardPage: React.FC = () => {
  const {
    patient,
    authorizedPatients,
    userRole,
    doctorAccount,
    dataLoading,
    fetchPatientHealthRecordsForView,
    addMedicalRecord,
    updateMedicalRecord,
    addAllergy,
    removeAllergy,
    uploadDiagnosticReportFile,
    getReportDownloadUrl,
  } = useAuth();
  const { language } = useLanguage();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialPatientId = searchParams.get('patientId');

  const isDoctor = userRole === 'doctor';

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || authorizedPatients[0]?.id || ''
  );
  const [viewedDoctorPatient, setViewedDoctorPatient] = useState<PatientProfile | null>(null);
  const [loadingPatientBundle, setLoadingPatientBundle] = useState(false);

  const [downloadNotice, setDownloadNotice] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Allergy form state (Patient-only per RLS)
  const [showAllergyForm, setShowAllergyForm] = useState(false);
  const [allergyName, setAllergyName] = useState('');
  const [allergyCategory, setAllergyCategory] = useState<'Allergy' | 'Chronic Condition'>('Allergy');
  const [allergySeverity, setAllergySeverity] = useState<'Mild' | 'Moderate' | 'Severe'>('Moderate');
  const [allergyNotes, setAllergyNotes] = useState('');
  const [savingAllergy, setSavingAllergy] = useState(false);

  // Medical record form state
  const [showRecordForm, setShowRecordForm] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MedicalRecordItem | null>(null);
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordTitle, setRecordTitle] = useState('');
  const [recordDoctor, setRecordDoctor] = useState(
    isDoctor ? doctorAccount.fullName : ''
  );
  const [recordFacility, setRecordFacility] = useState(
    isDoctor ? doctorAccount.hospital : ''
  );
  const [recordSummary, setRecordSummary] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Diagnostic report upload state
  const [showReportForm, setShowReportForm] = useState(false);
  const [labName, setLabName] = useState('');
  const [testName, setTestName] = useState('');
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportNotes, setReportNotes] = useState('');
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);
  const [downloadingReportId, setDownloadingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (isDoctor) {
      if (initialPatientId && authorizedPatients.some((p) => p.id === initialPatientId)) {
        setSelectedPatientId(initialPatientId);
      } else if (!selectedPatientId && authorizedPatients[0]?.id) {
        setSelectedPatientId(authorizedPatients[0].id);
      }
    }
  }, [isDoctor, initialPatientId, authorizedPatients, selectedPatientId]);

  const loadViewedPatientBundle = useCallback(
    async (targetId: string) => {
      if (!isDoctor || !targetId) return;
      setLoadingPatientBundle(true);
      setActionError(null);
      try {
        const fetched = await fetchPatientHealthRecordsForView(targetId);
        setViewedDoctorPatient(fetched);
      } catch (err) {
        setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
      } finally {
        setLoadingPatientBundle(false);
      }
    },
    [isDoctor, fetchPatientHealthRecordsForView, t]
  );

  useEffect(() => {
    if (isDoctor && selectedPatientId) {
      void loadViewedPatientBundle(selectedPatientId);
    }
  }, [isDoctor, selectedPatientId, loadViewedPatientBundle]);

  const activePatient: PatientProfile | null = isDoctor
    ? viewedDoctorPatient
    : patient.id
    ? patient
    : null;

  const showTransientSuccess = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  const handleDownloadCard = () => {
    if (!activePatient) return;
    const canvas = document.createElement('canvas');
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#198754';
    ctx.fillRect(0, 0, canvas.width, 108);

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText(t('healthCard.cardTitle'), 40, 52);
    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#D1FAE5';
    ctx.fillText(t('healthCard.cardSubtitle'), 40, 82);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(activePatient.healthId, 920, 65);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#0F172A';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(activePatient.fullName, 40, 170);

    ctx.fillStyle = '#475569';
    ctx.font = '20px sans-serif';
    ctx.fillText(
      `${activePatient.age} ${t('common.yrs')} · ${activePatient.gender} · ${activePatient.dateOfBirth}`,
      40,
      208
    );

    ctx.fillStyle = '#DC2626';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(`${t('profile.bloodGroup')}: ${activePatient.bloodGroup || '—'}`, 40, 260);

    ctx.fillStyle = '#1E293B';
    ctx.font = '20px sans-serif';
    ctx.fillText(`${t('profile.phoneNumber')}: ${activePatient.mobileNumber}`, 40, 305);
    ctx.fillText(
      `${activePatient.village}, ${activePatient.district}, ${activePatient.state} - ${activePatient.pinCode}`,
      40,
      345
    );
    ctx.fillText(
      `${t('profile.emergencyContact')}: ${activePatient.emergencyContactName} (${activePatient.emergencyContactNumber})`,
      40,
      385
    );
    ctx.fillText(
      `${t('healthCard.allergies')}: ${
        activePatient.allergies.length > 0 ? activePatient.allergies.join(', ') : 'None'
      }`,
      40,
      430
    );

    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    const link = document.createElement('a');
    link.download = `RuralCare-HealthCard-${activePatient.healthId}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();

    setDownloadNotice(true);
    setTimeout(() => setDownloadNotice(false), 4000);
  };

  const handleSaveAllergy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !allergyName.trim()) return;
    setSavingAllergy(true);
    setActionError(null);
    try {
      await addAllergy({
        patientId: activePatient.id,
        name: allergyName.trim(),
        category: allergyCategory,
        severity: allergySeverity,
        notes: allergyNotes.trim() || undefined,
      });
      setAllergyName('');
      setAllergyNotes('');
      setShowAllergyForm(false);
      showTransientSuccess(t('healthCard.recordSaved'));
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setSavingAllergy(false);
    }
  };

  const handleDeleteAllergy = async (allergyId: string) => {
    setActionError(null);
    try {
      await removeAllergy(allergyId);
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    }
  };

  const openCreateRecord = () => {
    setEditingRecord(null);
    setRecordDate(new Date().toISOString().slice(0, 10));
    setRecordTitle('');
    setRecordDoctor(isDoctor ? doctorAccount.fullName : '');
    setRecordFacility(isDoctor ? doctorAccount.hospital : '');
    setRecordSummary('');
    setShowRecordForm(true);
  };

  const openEditRecord = (rec: MedicalRecordItem) => {
    setEditingRecord(rec);
    setRecordDate(rec.date);
    setRecordTitle(rec.title);
    setRecordDoctor(rec.doctor);
    setRecordFacility(rec.facility);
    setRecordSummary(rec.summary);
    setShowRecordForm(true);
  };

  const handleSaveMedicalRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !recordTitle.trim() || !recordSummary.trim()) return;
    setSavingRecord(true);
    setActionError(null);
    try {
      if (editingRecord) {
        await updateMedicalRecord(editingRecord.id, {
          title: recordTitle.trim(),
          facilityName: recordFacility.trim(),
          summary: recordSummary.trim(),
        });
      } else {
        await addMedicalRecord({
          patientId: activePatient.id,
          recordDate,
          title: recordTitle.trim(),
          doctorName: recordDoctor.trim() || (isDoctor ? doctorAccount.fullName : 'Self Reported'),
          facilityName: recordFacility.trim() || (isDoctor ? doctorAccount.hospital : 'Community Clinic'),
          summary: recordSummary.trim(),
        });
      }
      if (isDoctor) {
        await loadViewedPatientBundle(activePatient.id);
      }
      setShowRecordForm(false);
      setEditingRecord(null);
      showTransientSuccess(t('healthCard.recordSaved'));
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setSavingRecord(false);
    }
  };

  const handleUploadReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePatient || !labName.trim() || !testName.trim()) return;
    setUploadingReport(true);
    setActionError(null);
    try {
      await uploadDiagnosticReportFile({
        patientId: activePatient.id,
        laboratoryName: labName.trim(),
        testName: testName.trim(),
        testDate,
        notes: reportNotes.trim() || undefined,
        file: reportFile,
      });
      if (isDoctor) {
        await loadViewedPatientBundle(activePatient.id);
      }
      setLabName('');
      setTestName('');
      setReportNotes('');
      setReportFile(null);
      setShowReportForm(false);
      showTransientSuccess(t('healthCard.reportUploaded'));
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setUploadingReport(false);
    }
  };

  const handleDownloadReportFile = async (reportId: string, filePath: string, fileName: string | null) => {
    setDownloadingReportId(reportId);
    setActionError(null);
    try {
      const signedUrl = await getReportDownloadUrl(filePath);
      const link = document.createElement('a');
      link.href = signedUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (fileName) {
        link.download = fileName;
      }
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setDownloadingReportId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {isDoctor ? t('healthCard.doctorTitle') : t('healthCard.title')}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {isDoctor ? t('healthCard.doctorSubtitle') : t('healthCard.subtitle')}
          </p>
        </div>

        {activePatient && (
          <button
            type="button"
            onClick={handleDownloadCard}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px]"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{t('healthCard.downloadBtn')}</span>
          </button>
        )}
      </div>

      {/* Doctor Patient Selector */}
      {isDoctor && (
        <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5">
          {authorizedPatients.length === 0 ? (
            <div className="flex items-start gap-3 text-sm text-slate-600">
              <Users className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{t('healthCard.noAuthorizedPatients')}</span>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label
                htmlFor="hc-patient-select"
                className="text-sm font-semibold text-slate-800 flex items-center gap-2"
              >
                <Users className="w-4 h-4 text-[#198754]" aria-hidden="true" />
                <span>{t('healthCard.selectPatientLabel')}</span>
              </label>
              <select
                id="hc-patient-select"
                value={selectedPatientId}
                onChange={(e) => setSelectedPatientId(e.target.value)}
                className="sm:min-w-[300px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
              >
                {authorizedPatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName} ({p.healthId}) · {p.village}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>
      )}

      {downloadNotice && activePatient && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-[#198754]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{t('healthCard.downloadedMsg', { healthId: activePatient.healthId })}</span>
        </div>
      )}

      {actionSuccess && (
        <div
          role="status"
          className="flex items-center gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm font-medium text-[#198754]"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
        >
          {actionError}
        </div>
      )}

      {(dataLoading || loadingPatientBundle) && !activePatient && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 flex items-center justify-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
          <span>{t('common.loading')}</span>
        </div>
      )}

      {activePatient && (
        <>
          {/* Primary Health Card Display */}
          <section className="flex justify-start">
            <HealthCard patient={activePatient} />
          </section>

          {/* Medical History, Allergies & Previous Records */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Allergies & Chronic Conditions */}
            <section className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-[#DC2626]" aria-hidden="true" />
                  <span>{t('healthCard.allergiesAndNotes')}</span>
                </h2>
                {!isDoctor && (
                  <button
                    type="button"
                    onClick={() => setShowAllergyForm((v) => !v)}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#198754] hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('healthCard.addAllergyBtn')}</span>
                  </button>
                )}
              </div>

              {!isDoctor && showAllergyForm && (
                <form
                  onSubmit={handleSaveAllergy}
                  className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.allergyName')}
                    </label>
                    <input
                      type="text"
                      value={allergyName}
                      onChange={(e) => setAllergyName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('healthCard.category')}
                      </label>
                      <select
                        value={allergyCategory}
                        onChange={(e) =>
                          setAllergyCategory(e.target.value as 'Allergy' | 'Chronic Condition')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="Allergy">{t('healthCard.categoryAllergy')}</option>
                        <option value="Chronic Condition">{t('healthCard.categoryChronic')}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('healthCard.severity')}
                      </label>
                      <select
                        value={allergySeverity}
                        onChange={(e) =>
                          setAllergySeverity(e.target.value as 'Mild' | 'Moderate' | 'Severe')
                        }
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      >
                        <option value="Mild">{t('healthCard.severityMild')}</option>
                        <option value="Moderate">{t('healthCard.severityModerate')}</option>
                        <option value="Severe">{t('healthCard.severitySevere')}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.notes')}
                    </label>
                    <input
                      type="text"
                      value={allergyNotes}
                      onChange={(e) => setAllergyNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAllergyForm(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={savingAllergy}
                      className="px-3.5 py-1.5 rounded-lg bg-[#198754] text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {savingAllergy ? t('common.saving') : t('common.add')}
                    </button>
                  </div>
                </form>
              )}

              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
                  {t('healthCard.allergies')}
                </h3>
                {(activePatient.allergyRecords ?? []).filter((a) => a.category === 'Allergy')
                  .length === 0 ? (
                  <p className="text-sm text-slate-500">{t('healthCard.noAllergies')}</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {(activePatient.allergyRecords ?? [])
                      .filter((a) => a.category === 'Allergy')
                      .map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-red-50/50 border border-red-100"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.name}{' '}
                              <span className="text-xs font-normal text-red-700">
                                ({item.severity})
                              </span>
                            </p>
                            {item.notes && (
                              <p className="text-xs text-slate-600 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                          {!isDoctor && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAllergy(item.id)}
                              aria-label={t('common.delete')}
                              className="p-1 text-slate-400 hover:text-[#DC2626]"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2 mb-2">
                  <HeartPulse className="w-4 h-4 text-[#198754]" aria-hidden="true" />
                  <span>{t('healthCard.medicalHistory')}</span>
                </h3>
                {(activePatient.allergyRecords ?? []).filter(
                  (a) => a.category === 'Chronic Condition'
                ).length === 0 ? (
                  <p className="text-sm text-slate-500">{t('healthCard.noChronicConditions')}</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-700">
                    {(activePatient.allergyRecords ?? [])
                      .filter((a) => a.category === 'Chronic Condition')
                      .map((item) => (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-2 p-2.5 rounded-xl bg-emerald-50/50 border border-emerald-100"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {item.name}{' '}
                              <span className="text-xs font-normal text-[#198754]">
                                ({item.severity})
                              </span>
                            </p>
                            {item.notes && (
                              <p className="text-xs text-slate-600 mt-0.5">{item.notes}</p>
                            )}
                          </div>
                          {!isDoctor && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAllergy(item.id)}
                              aria-label={t('common.delete')}
                              className="p-1 text-slate-400 hover:text-[#DC2626]"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                            </button>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </section>

            {/* Previous Medical Records */}
            <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-[#0D6EFD]" aria-hidden="true" />
                  <span>{t('healthCard.previousRecords')}</span>
                </h2>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {t('healthCard.recordsCount', { count: activePatient.medicalRecords.length })}
                  </span>
                  <button
                    type="button"
                    onClick={openCreateRecord}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#198754] hover:bg-[#146c43] text-white text-xs font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('healthCard.addMedicalRecord')}</span>
                  </button>
                </div>
              </div>

              {showRecordForm && (
                <form
                  onSubmit={handleSaveMedicalRecord}
                  className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 space-y-3"
                >
                  <h3 className="text-sm font-bold text-slate-900">
                    {editingRecord
                      ? t('healthCard.editMedicalRecord')
                      : t('healthCard.addMedicalRecord')}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {!editingRecord && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t('healthCard.recordDate')}
                        </label>
                        <input
                          type="date"
                          value={recordDate}
                          onChange={(e) => setRecordDate(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                      </div>
                    )}
                    <div className={editingRecord ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('healthCard.recordTitle')}
                      </label>
                      <input
                        type="text"
                        value={recordTitle}
                        onChange={(e) => setRecordTitle(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                    {!editingRecord && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          {t('healthCard.doctorName')}
                        </label>
                        <input
                          type="text"
                          value={recordDoctor}
                          onChange={(e) => setRecordDoctor(e.target.value)}
                          required
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {t('healthCard.facilityName')}
                      </label>
                      <input
                        type="text"
                        value={recordFacility}
                        onChange={(e) => setRecordFacility(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.recordSummary')}
                    </label>
                    <textarea
                      rows={3}
                      value={recordSummary}
                      onChange={(e) => setRecordSummary(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowRecordForm(false);
                        setEditingRecord(null);
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                    >
                      {t('common.cancel')}
                    </button>
                    <button
                      type="submit"
                      disabled={savingRecord}
                      className="px-4 py-1.5 rounded-lg bg-[#198754] text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {savingRecord ? t('common.saving') : t('healthCard.saveRecord')}
                    </button>
                  </div>
                </form>
              )}

              {activePatient.medicalRecords.length === 0 ? (
                <p className="text-sm text-slate-500 py-4">{t('healthCard.noRecords')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {activePatient.medicalRecords.map((rec) => {
                    const canEdit =
                      !isDoctor ||
                      (rec.recordedByDoctorId && rec.recordedByDoctorId === doctorAccount.id);
                    return (
                      <article key={rec.id} className="py-4 first:pt-0 last:pb-0 space-y-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-slate-900">
                            {language === 'kn' && rec.titleKn ? rec.titleKn : rec.title}
                          </h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-slate-500 tabular-nums">
                              {rec.date}
                            </span>
                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => openEditRecord(rec)}
                                aria-label={t('common.edit')}
                                className="p-1 text-slate-400 hover:text-[#0D6EFD]"
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-[#198754] font-medium">
                          {rec.doctor} · {rec.facility}
                        </p>
                        <p className="text-sm text-slate-600 leading-relaxed pt-1">
                          {language === 'kn' && rec.summaryKn ? rec.summaryKn : rec.summary}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Diagnostic & Lab Reports */}
          <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <FileCheck2 className="w-5 h-5 text-[#198754]" aria-hidden="true" />
                <span>{t('healthCard.diagnosticReports')}</span>
              </h2>
              <button
                type="button"
                onClick={() => setShowReportForm((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#198754] text-[#198754] hover:bg-emerald-50 text-xs sm:text-sm font-semibold"
              >
                <Upload className="w-4 h-4" aria-hidden="true" />
                <span>{t('healthCard.uploadReport')}</span>
              </button>
            </div>

            {showReportForm && (
              <form
                onSubmit={handleUploadReport}
                className="p-4 rounded-xl bg-[#F5F7FA] border border-slate-200 space-y-3"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.testName')}
                    </label>
                    <input
                      type="text"
                      value={testName}
                      onChange={(e) => setTestName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.laboratoryName')}
                    </label>
                    <input
                      type="text"
                      value={labName}
                      onChange={(e) => setLabName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.testDate')}
                    </label>
                    <input
                      type="date"
                      value={testDate}
                      onChange={(e) => setTestDate(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.selectFile')}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,image/*"
                      onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:text-[#198754] file:font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {t('healthCard.notes')}
                    </label>
                    <input
                      type="text"
                      value={reportNotes}
                      onChange={(e) => setReportNotes(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportForm(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={uploadingReport}
                    className="px-4 py-1.5 rounded-lg bg-[#198754] text-white text-xs font-semibold disabled:opacity-60"
                  >
                    {uploadingReport ? t('common.submitting') : t('healthCard.uploadReport')}
                  </button>
                </div>
              </form>
            )}

            {(activePatient.diagnosticReports ?? []).length === 0 ? (
              <p className="text-sm text-slate-500">{t('healthCard.noReports')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(activePatient.diagnosticReports ?? []).map((rep) => (
                  <article
                    key={rep.id}
                    className="p-4 rounded-xl border border-slate-200 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 space-y-1">
                      <h3 className="text-sm font-bold text-slate-900 truncate">{rep.testName}</h3>
                      <p className="text-xs text-slate-600">{rep.laboratoryName}</p>
                      <p className="text-xs font-mono text-slate-500 tabular-nums">
                        {rep.testDate} · {rep.reportStatus}
                      </p>
                      {rep.notes && <p className="text-xs text-slate-600 pt-1">{rep.notes}</p>}
                    </div>
                    {rep.reportFilePath && (
                      <button
                        type="button"
                        disabled={downloadingReportId === rep.id}
                        onClick={() =>
                          handleDownloadReportFile(rep.id, rep.reportFilePath!, rep.fileName)
                        }
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-[#198754] shrink-0"
                      >
                        {downloadingReportId === rep.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        ) : (
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{t('healthCard.downloadReport')}</span>
                      </button>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};
