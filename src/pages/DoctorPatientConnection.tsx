import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Search,
  Send,
  MapPin,
  Clock,
  CheckCircle2,
  MessageSquare,
  UserCheck,
  XCircle,
  Check,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DEFAULT_PATIENT_AVATAR,
  extractSupabaseErrorMessage,
  filterDoctorsDirectory,
} from '../utils/supabaseMappers';
import type { ConnectionStatus } from '../types/ruralcare';

export const DoctorPatientConnection: React.FC = () => {
  const {
    doctors,
    consultations,
    sendConsultationMessage,
    updateConnectionStatus,
    patient,
    userId,
    userRole,
    doctorAccount,
    dataLoading,
  } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialDocId = searchParams.get('doctorId');
  const initialThreadId = searchParams.get('threadId');
  const isDoctor = userRole === 'doctor';

  const [specFilter, setSpecFilter] = useState('All');
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(initialDocId || '');
  const [selectedThreadId, setSelectedThreadId] = useState<string>(initialThreadId || '');

  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isDoctor) {
      if (initialDocId && doctors.some((d) => d.id === initialDocId)) {
        setSelectedDoctorId(initialDocId);
      } else if (!selectedDoctorId && doctors[0]?.id) {
        setSelectedDoctorId(doctors[0].id);
      }
    } else {
      if (initialThreadId && consultations.some((c) => c.id === initialThreadId)) {
        setSelectedThreadId(initialThreadId);
      } else if (!selectedThreadId && consultations[0]?.id) {
        setSelectedThreadId(consultations[0].id);
      }
    }
  }, [isDoctor, initialDocId, initialThreadId, doctors, consultations, selectedDoctorId, selectedThreadId]);

  const specializations = useMemo(
    () => ['All', ...Array.from(new Set(doctors.map((d) => d.specialization)))],
    [doctors]
  );

  const matchingDoctors = useMemo(
    () =>
      filterDoctorsDirectory(doctors, {
        searchQuery,
        specialization: specFilter,
        maxDistanceKm: nearbyOnly ? 6 : null,
      }),
    [doctors, searchQuery, specFilter, nearbyOnly]
  );

  const matchingThreadsForDoctor = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return consultations;
    return consultations.filter(
      (th) =>
        (th.patientName ?? '').toLowerCase().includes(q) ||
        th.doctorName.toLowerCase().includes(q) ||
        th.specialization.toLowerCase().includes(q)
    );
  }, [consultations, searchQuery]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? doctors[0] ?? null,
    [doctors, selectedDoctorId]
  );

  const activeThread = useMemo(() => {
    if (isDoctor) {
      return consultations.find((c) => c.id === selectedThreadId) ?? consultations[0] ?? null;
    }
    if (!selectedDoctor) return null;
    return consultations.find((tItem) => tItem.doctorId === selectedDoctor.id) ?? null;
  }, [isDoctor, consultations, selectedThreadId, selectedDoctor]);

  const threadClosed =
    activeThread != null &&
    (activeThread.status === 'Rejected' ||
      activeThread.status === 'Cancelled' ||
      activeThread.status === 'Completed');

  const showTransientNotice = (msg: string) => {
    setRequestNotice(msg);
    setTimeout(() => setRequestNotice(null), 3500);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim() || threadClosed) return;

    const targetDoctorId = isDoctor ? doctorAccount.id : selectedDoctor?.id;
    const targetPatientId = isDoctor ? activeThread?.patientId : userId;

    if (!targetDoctorId || !targetPatientId) return;

    setSending(true);
    setActionError(null);
    try {
      await sendConsultationMessage(
        targetDoctorId,
        targetPatientId,
        messageInput.trim(),
        isDoctor ? 'doctor' : 'patient',
        selectedDoctor?.userId,
        selectedDoctor?.name
      );
      setMessageInput('');
      showTransientNotice(
        t('connectDoctor.messageSent', {
          name: isDoctor
            ? activeThread?.patientName || 'Patient'
            : selectedDoctor?.name || 'Doctor',
        })
      );
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setSending(false);
    }
  };

  const handleQuickConsultRequest = async () => {
    if (!selectedDoctor || !userId || threadClosed) return;
    setSending(true);
    setActionError(null);
    try {
      const defaultNote = `Hello ${selectedDoctor.name}, I am ${patient.fullName} from ${patient.village} (${patient.district}). I would like to request a medical consultation.`;
      await sendConsultationMessage(
        selectedDoctor.id,
        userId,
        defaultNote,
        'patient',
        selectedDoctor.userId,
        selectedDoctor.name
      );
      showTransientNotice(t('connectDoctor.requestSent', { name: selectedDoctor.name }));
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setSending(false);
    }
  };

  const handleUpdateStatus = async (nextStatus: ConnectionStatus) => {
    if (!activeThread) return;
    setUpdatingStatus(true);
    setActionError(null);
    try {
      await updateConnectionStatus(activeThread.id, nextStatus, activeThread.patientId);
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {isDoctor ? t('connectDoctor.doctorTitle') : t('connectDoctor.title')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isDoctor ? t('connectDoctor.doctorSubtitle') : t('connectDoctor.subtitle')}
        </p>
      </div>

      {/* Filter Bar */}
      <section className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="flex-1 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('connectDoctor.searchPlaceholder')}
              aria-label={t('connectDoctor.searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
            />
          </div>

          {!isDoctor && (
            <select
              value={specFilter}
              onChange={(e) => setSpecFilter(e.target.value)}
              aria-label={t('doctors.specialization')}
              className="px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
            >
              {specializations.map((s) => (
                <option key={s} value={s}>
                  {s === 'All' ? t('doctors.allSpecializations') : s}
                </option>
              ))}
            </select>
          )}
        </div>

        {!isDoctor && (
          <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none shrink-0">
            <input
              type="checkbox"
              checked={nearbyOnly}
              onChange={(e) => setNearbyOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 accent-[#198754]"
            />
            <span>{t('connectDoctor.nearbyOnly')}</span>
          </label>
        )}
      </section>

      {actionError && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm font-medium text-[#DC2626]"
        >
          {actionError}
        </div>
      )}

      {/* Main Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <aside className="lg:col-span-5 space-y-4">
          {!isDoctor ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {t('connectDoctor.availableDoctors')}
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {t('connectDoctor.foundCount', { count: matchingDoctors.length })}
                </span>
              </div>

              {dataLoading && doctors.length === 0 ? (
                <div className="p-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
                  <span>{t('common.loading')}</span>
                </div>
              ) : matchingDoctors.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">
                  {doctors.length === 0
                    ? t('doctors.noDoctorsInSupabase')
                    : t('connectDoctor.noDoctorsFilter')}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[380px] overflow-y-auto">
                  {matchingDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;
                    return (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setSelectedDoctorId(doc.id)}
                        className={`w-full text-left p-4 flex items-start gap-3 transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={doc.photoUrl}
                          alt={doc.name}
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">{doc.name}</p>
                            <span className="text-xs text-slate-500 tabular-nums shrink-0">
                              {doc.distanceKm} km
                            </span>
                          </div>
                          <p className="text-xs font-medium text-[#198754]">{doc.specialization}</p>
                          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
                            {doc.availableToday ? (
                              <span className="text-[#198754] font-medium">
                                {t('doctors.availableToday')}
                              </span>
                            ) : (
                              <span className="text-amber-700">{t('doctors.scheduledDays')}</span>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{doc.hospital}</span>
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-display text-base font-bold text-slate-900">
                  {t('connectDoctor.patientRequests')}
                </h2>
                <span className="text-xs text-slate-500 tabular-nums">
                  {t('connectDoctor.foundCount', { count: matchingThreadsForDoctor.length })}
                </span>
              </div>

              {dataLoading && matchingThreadsForDoctor.length === 0 ? (
                <div className="p-6 flex items-center justify-center gap-2 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
                  <span>{t('common.loading')}</span>
                </div>
              ) : matchingThreadsForDoctor.length === 0 ? (
                <p className="p-6 text-sm text-slate-500 text-center">
                  {t('connectDoctor.noThreads')}
                </p>
              ) : (
                <div className="divide-y divide-slate-100 max-h-[420px] overflow-y-auto">
                  {matchingThreadsForDoctor.map((thread) => {
                    const isSelected = activeThread?.id === thread.id;
                    return (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => setSelectedThreadId(thread.id)}
                        className={`w-full text-left p-4 flex items-start gap-3 transition-colors ${
                          isSelected ? 'bg-emerald-50/70' : 'hover:bg-slate-50'
                        }`}
                      >
                        <img
                          src={DEFAULT_PATIENT_AVATAR}
                          alt={thread.patientName || 'Patient'}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-slate-900 truncate">
                              {thread.patientName || 'RuralCare Patient'}
                            </p>
                            <span className="text-xs font-semibold text-[#198754]">
                              {t(`connectDoctor.status.${thread.status}`)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {t('connectDoctor.messagesCount', { count: thread.messages.length })} ·{' '}
                            {thread.lastUpdated}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Consultation History (Patient view) */}
          {!isDoctor && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-[#0D6EFD]" aria-hidden="true" />
                <span>{t('connectDoctor.consultationHistory')}</span>
              </h2>
              {consultations.length === 0 ? (
                <p className="text-sm text-slate-500">{t('connectDoctor.noThreads')}</p>
              ) : (
                <div className="divide-y divide-slate-100">
                  {consultations.map((thread) => (
                    <button
                      key={thread.id}
                      type="button"
                      onClick={() => setSelectedDoctorId(thread.doctorId)}
                      className="w-full text-left py-2.5 first:pt-0 last:pb-0 hover:bg-slate-50 rounded-lg px-2 -mx-2 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {thread.doctorName}
                        </p>
                        <span className="text-xs font-medium text-[#198754]">
                          {t(`connectDoctor.status.${thread.status}`)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {t('connectDoctor.messagesCount', { count: thread.messages.length })} ·{' '}
                        {thread.lastUpdated}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Right Chat & Consultation Interface */}
        <section className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden min-h-[540px]">
          {(isDoctor && !activeThread) || (!isDoctor && !selectedDoctor) ? (
            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center space-y-2">
              <MessageSquare className="w-10 h-10 text-slate-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-800">
                {t('connectDoctor.selectDoctorPrompt')}
              </p>
            </div>
          ) : (
            <>
              {/* Selected Header */}
              <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 min-w-0">
                  <img
                    src={isDoctor ? DEFAULT_PATIENT_AVATAR : selectedDoctor!.photoUrl}
                    alt={isDoctor ? activeThread?.patientName || 'Patient' : selectedDoctor!.name}
                    referrerPolicy="no-referrer"
                    className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <h2 className="font-display text-base font-bold text-slate-900 truncate">
                      {isDoctor
                        ? `${activeThread?.patientName || 'Patient'} ↔ ${doctorAccount.fullName}`
                        : selectedDoctor!.name}
                    </h2>
                    <p className="text-xs text-[#198754] font-medium">
                      {isDoctor
                        ? `${doctorAccount.specialization} · ${t(`connectDoctor.status.${activeThread!.status}`)}`
                        : `${selectedDoctor!.specialization} · ${selectedDoctor!.hospital}`}
                    </p>
                    {!isDoctor && selectedDoctor && (
                      <div className="flex flex-wrap items-center gap-x-3 text-xs text-slate-500 mt-0.5">
                        <span className="inline-flex items-center gap-1 tabular-nums">
                          <MapPin className="w-3 h-3" aria-hidden="true" />
                          {selectedDoctor.distanceKm} {t('common.kmAway')}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          {selectedDoctor.timings}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isDoctor && (!activeThread || activeThread.status === 'Pending') && (
                    <button
                      type="button"
                      disabled={sending || threadClosed}
                      onClick={handleQuickConsultRequest}
                      className="px-4 py-2 rounded-xl border border-[#198754] text-[#198754] hover:bg-emerald-50 text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap min-h-[40px] disabled:opacity-60"
                    >
                      {t('connectDoctor.consultationRequest')}
                    </button>
                  )}

                  {!isDoctor &&
                    activeThread &&
                    (activeThread.status === 'Pending' || activeThread.status === 'Accepted') && (
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus('Cancelled')}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold min-h-[40px]"
                      >
                        {t('connectDoctor.cancelRequest')}
                      </button>
                    )}

                  {isDoctor && activeThread && activeThread.status === 'Pending' && (
                    <>
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus('Accepted')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-xs font-semibold min-h-[40px]"
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t('connectDoctor.acceptRequest')}</span>
                      </button>
                      <button
                        type="button"
                        disabled={updatingStatus}
                        onClick={() => handleUpdateStatus('Rejected')}
                        className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-red-200 text-[#DC2626] hover:bg-red-50 text-xs font-semibold min-h-[40px]"
                      >
                        <XCircle className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t('connectDoctor.rejectRequest')}</span>
                      </button>
                    </>
                  )}

                  {isDoctor && activeThread && activeThread.status === 'Accepted' && (
                    <button
                      type="button"
                      disabled={updatingStatus}
                      onClick={() => handleUpdateStatus('Completed')}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl border border-[#0D6EFD] text-[#0D6EFD] hover:bg-blue-50 text-xs font-semibold min-h-[40px]"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t('connectDoctor.markCompleted')}</span>
                    </button>
                  )}
                </div>
              </div>

              {requestNotice && (
                <div
                  role="status"
                  className="mx-5 mt-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#198754] flex items-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{requestNotice}</span>
                </div>
              )}

              {/* Chat Thread */}
              <div className="flex-1 p-5 space-y-3 overflow-y-auto bg-[#F5F7FA]/60 max-h-[380px]">
                {!activeThread || activeThread.messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center py-12 space-y-2">
                    <MessageSquare className="w-10 h-10 text-slate-300" aria-hidden="true" />
                    <p className="text-sm font-semibold text-slate-800">
                      {t('connectDoctor.startTitle', {
                        name: isDoctor
                          ? activeThread?.patientName || 'Patient'
                          : selectedDoctor?.name || 'Doctor',
                      })}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm">
                      {t('connectDoctor.startDesc')}
                    </p>
                  </div>
                ) : (
                  activeThread.messages.map((msg) => {
                    const isOwnMessage = isDoctor ? msg.sender === 'doctor' : msg.sender === 'patient';
                    return (
                      <div
                        key={msg.id}
                        className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                            isOwnMessage
                              ? 'bg-[#198754] text-white'
                              : 'bg-white border border-slate-200 text-slate-800'
                          }`}
                        >
                          <p>{msg.text}</p>
                        </div>
                        <span className="text-[11px] text-slate-500 mt-1 px-1 tabular-nums">
                          {msg.sender === 'patient'
                            ? activeThread.patientName || patient.fullName
                            : isDoctor
                            ? doctorAccount.fullName
                            : selectedDoctor?.name || activeThread.doctorName}{' '}
                          · {msg.timestamp}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Message Input */}
              <form
                onSubmit={handleSendMessage}
                className="p-4 border-t border-slate-200 bg-white flex items-center gap-3"
              >
                <input
                  type="text"
                  value={messageInput}
                  disabled={sending || threadClosed}
                  onChange={(e) => setMessageInput(e.target.value)}
                  placeholder={
                    threadClosed && activeThread
                      ? t(`connectDoctor.status.${activeThread.status}`)
                      : isDoctor
                      ? t('connectDoctor.doctorReplyPlaceholder', {
                          name: activeThread?.patientName || 'Patient',
                        })
                      : t('connectDoctor.messagePlaceholder', {
                          name: selectedDoctor?.name || 'Doctor',
                        })
                  }
                  aria-label={t('connectDoctor.chatWithDoctor')}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] disabled:bg-slate-100"
                />
                <button
                  type="submit"
                  disabled={sending || threadClosed}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors whitespace-nowrap min-h-[44px] disabled:opacity-60"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  ) : (
                    <Send className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{t('connectDoctor.send')}</span>
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
};
