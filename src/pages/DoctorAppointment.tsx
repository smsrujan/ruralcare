import React, { useMemo, useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CheckCircle2, Search, Loader2, Clock, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AppointmentCard } from '../components/AppointmentCard';
import { extractSupabaseErrorMessage, isAppointmentSlotTaken } from '../utils/supabaseMappers';
import type { AppointmentStatus, ConsultationType } from '../types/ruralcare';

export const DoctorAppointment: React.FC = () => {
  const {
    doctors,
    appointments,
    doctorAvailability,
    dataLoading,
    bookAppointment,
    updateAppointmentStatus,
    addAvailabilitySlot,
    toggleAvailabilitySlot,
    removeAvailabilitySlot,
    userRole,
  } = useAuth();
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const preselectedDoctorId = searchParams.get('doctorId');
  const isDoctor = userRole === 'doctor';

  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(preselectedDoctorId || '');
  const [appointmentDate, setAppointmentDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [consultationType, setConsultationType] = useState<ConsultationType>('In-Person');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bookingConfirmation, setBookingConfirmation] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'All' | AppointmentStatus>('All');

  // Doctor Availability Manager form state
  const [slotDay, setSlotDay] = useState('Mon');
  const [slotDate, setSlotDate] = useState('');
  const [startTime, setStartTime] = useState('09:30');
  const [endTime, setEndTime] = useState('10:30');
  const [slotLabel, setSlotLabel] = useState('09:30 AM');
  const [savingSlot, setSavingSlot] = useState(false);
  const [slotNotice, setSlotNotice] = useState<string | null>(null);
  const [slotError, setSlotError] = useState<string | null>(null);

  useEffect(() => {
    if (preselectedDoctorId && doctors.some((d) => d.id === preselectedDoctorId)) {
      setSelectedDoctorId(preselectedDoctorId);
    } else if (!selectedDoctorId && doctors[0]?.id) {
      setSelectedDoctorId(doctors[0].id);
    }
  }, [preselectedDoctorId, doctors, selectedDoctorId]);

  const filteredDoctorOptions = useMemo(() => {
    const q = doctorSearch.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.specialization.toLowerCase().includes(q) ||
        d.hospital.toLowerCase().includes(q) ||
        d.district.toLowerCase().includes(q)
    );
  }, [doctors, doctorSearch]);

  const selectedDoctor = useMemo(
    () => doctors.find((d) => d.id === selectedDoctorId) ?? doctors[0] ?? null,
    [doctors, selectedDoctorId]
  );

  useEffect(() => {
    if (!selectedDoctor) {
      setSelectedSlot('');
      return;
    }
    const availableSlots = selectedDoctor.consultationSlots.filter(
      (slot) => !isAppointmentSlotTaken(appointments, selectedDoctor.id, appointmentDate, slot)
    );
    if (!availableSlots.includes(selectedSlot)) {
      setSelectedSlot(availableSlots[0] ?? '');
    }
  }, [selectedDoctor, appointments, appointmentDate, selectedSlot]);

  const filteredAppointments = useMemo(() => {
    if (statusFilter === 'All') return appointments;
    return appointments.filter((a) => a.status === statusFilter);
  }, [appointments, statusFilter]);

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBookingConfirmation(null);

    if (!selectedDoctor) {
      setFormError(t('appointments.noDoctorsAvailable'));
      return;
    }
    if (!appointmentDate) {
      setFormError(t('appointments.dateRequired'));
      return;
    }
    if (!selectedSlot || isAppointmentSlotTaken(appointments, selectedDoctor.id, appointmentDate, selectedSlot)) {
      setFormError(t('appointments.slotRequired'));
      return;
    }
    if (!reason.trim()) {
      setFormError(t('appointments.reasonRequired'));
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await bookAppointment({
        doctorId: selectedDoctor.id,
        date: appointmentDate,
        timeSlot: selectedSlot,
        consultationType,
        reason: reason.trim(),
      });

      setReason('');
      setBookingConfirmation(
        t('appointments.bookedSuccess', {
          name: created.doctorName,
          date: created.date,
          time: created.timeSlot,
        })
      );
    } catch (err) {
      setFormError(extractSupabaseErrorMessage(err, t('supabase.slotUnavailableError')));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddAvailabilitySlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slotLabel.trim()) return;
    setSavingSlot(true);
    setSlotError(null);
    setSlotNotice(null);
    try {
      await addAvailabilitySlot({
        availableDate: slotDate || null,
        availableDay: slotDay,
        startTime,
        endTime,
        slotLabel: slotLabel.trim(),
        status: 'Available',
      });
      setSlotNotice(t('appointments.slotAdded'));
      setTimeout(() => setSlotNotice(null), 3500);
    } catch (err) {
      setSlotError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setSavingSlot(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          {isDoctor ? t('appointments.doctorTitle') : t('appointments.title')}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {isDoctor ? t('appointments.doctorSubtitle') : t('appointments.subtitle')}
        </p>
      </div>

      {/* Doctor Availability Slot Manager (Doctor Flow) */}
      {isDoctor && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#198754]" aria-hidden="true" />
                <span>{t('appointments.availabilityManagerTitle')}</span>
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {t('appointments.availabilityManagerDesc')}
              </p>
            </div>
          </div>

          {slotNotice && (
            <div
              role="status"
              className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-medium text-[#198754]"
            >
              {slotNotice}
            </div>
          )}

          {slotError && (
            <div
              role="alert"
              className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-[#DC2626]"
            >
              {slotError}
            </div>
          )}

          <form
            onSubmit={handleAddAvailabilitySlot}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end p-4 rounded-xl bg-[#F5F7FA] border border-slate-200"
          >
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('appointments.dayOfWeek')}
              </label>
              <select
                value={slotDay}
                onChange={(e) => setSlotDay(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              >
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('appointments.availableDateOptional')}
              </label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('appointments.startTime')}
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('appointments.endTime')}
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {t('appointments.slotLabel')}
              </label>
              <input
                type="text"
                value={slotLabel}
                onChange={(e) => setSlotLabel(e.target.value)}
                placeholder="09:30 AM"
                required
                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={savingSlot}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-[#198754] hover:bg-[#146c43] text-white text-xs sm:text-sm font-semibold min-h-[38px] disabled:opacity-60"
            >
              <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('appointments.addSlot')}</span>
            </button>
          </form>

          {doctorAvailability.length === 0 ? (
            <p className="text-xs text-slate-500">{t('appointments.noSlotsConfigured')}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {doctorAvailability.map((slot) => (
                <div
                  key={slot.id}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                    slot.status === 'Available'
                      ? 'bg-emerald-50 border-emerald-200 text-[#198754]'
                      : 'bg-slate-100 border-slate-200 text-slate-600'
                  }`}
                >
                  <span>
                    {slot.availableDay}
                    {slot.availableDate ? ` (${slot.availableDate})` : ''}: {slot.slotLabel}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      void toggleAvailabilitySlot(
                        slot.id,
                        slot.status === 'Available' ? 'Unavailable' : 'Available'
                      )
                    }
                    className="underline font-semibold"
                  >
                    {slot.status === 'Available' ? t('common.available') : t('common.unavailable')}
                  </button>
                  <button
                    type="button"
                    onClick={() => void removeAvailabilitySlot(slot.id)}
                    aria-label={t('common.delete')}
                    className="text-slate-400 hover:text-[#DC2626]"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Booking Form (Patient Flow) */}
      {!isDoctor && (
        <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div className="flex items-center gap-2 text-slate-900">
            <CalendarCheck className="w-5 h-5 text-[#198754]" aria-hidden="true" />
            <h2 className="font-display text-lg font-bold">{t('appointments.bookTitle')}</h2>
          </div>

          {dataLoading && doctors.length === 0 ? (
            <div className="py-6 flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="w-4 h-4 animate-spin text-[#198754]" aria-hidden="true" />
              <span>{t('common.loading')}</span>
            </div>
          ) : !selectedDoctor ? (
            <p className="text-sm text-slate-600">{t('appointments.noDoctorsAvailable')}</p>
          ) : (
            <>
              {bookingConfirmation && (
                <div
                  role="status"
                  className="flex items-start gap-2.5 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-[#198754]"
                >
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{bookingConfirmation}</span>
                </div>
              )}

              {formError && (
                <div
                  role="alert"
                  className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-[#DC2626]"
                >
                  {formError}
                </div>
              )}

              <form onSubmit={handleConfirmBooking} noValidate className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Search Doctor Filter */}
                  <div>
                    <label
                      htmlFor="apt-doc-search"
                      className="block text-sm font-medium text-slate-800 mb-1"
                    >
                      {t('appointments.searchDoctors')}
                    </label>
                    <div className="relative">
                      <Search
                        className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                        aria-hidden="true"
                      />
                      <input
                        id="apt-doc-search"
                        type="search"
                        value={doctorSearch}
                        onChange={(e) => {
                          setDoctorSearch(e.target.value);
                          const q = e.target.value.toLowerCase();
                          const nextList = doctors.filter(
                            (d) =>
                              d.name.toLowerCase().includes(q) ||
                              d.specialization.toLowerCase().includes(q) ||
                              d.district.toLowerCase().includes(q)
                          );
                          if (nextList.length > 0 && !nextList.some((d) => d.id === selectedDoctorId)) {
                            setSelectedDoctorId(nextList[0].id);
                          }
                        }}
                        placeholder={t('appointments.searchPlaceholder')}
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                      />
                    </div>
                  </div>

                  {/* Select Doctor */}
                  <div>
                    <label
                      htmlFor="apt-doc-select"
                      className="block text-sm font-medium text-slate-800 mb-1"
                    >
                      {t('appointments.selectDoctor')}
                    </label>
                    <select
                      id="apt-doc-select"
                      value={selectedDoctor.id}
                      onChange={(e) => setSelectedDoctorId(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
                    >
                      {filteredDoctorOptions.length === 0 ? (
                        <option value={selectedDoctor.id}>{t('doctors.noMatchesTitle')}</option>
                      ) : (
                        filteredDoctorOptions.map((doc) => (
                          <option key={doc.id} value={doc.id}>
                            {doc.name} ({doc.specialization})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {/* Select Date */}
                  <div>
                    <label
                      htmlFor="apt-date"
                      className="block text-sm font-medium text-slate-800 mb-1"
                    >
                      {t('appointments.selectDate')}
                    </label>
                    <input
                      id="apt-date"
                      type="date"
                      min={new Date().toISOString().slice(0, 10)}
                      value={appointmentDate}
                      onChange={(e) => setAppointmentDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px] tabular-nums"
                    />
                  </div>

                  {/* Consultation Type */}
                  <div>
                    <label
                      htmlFor="apt-type"
                      className="block text-sm font-medium text-slate-800 mb-1"
                    >
                      {t('appointments.consultationType')}
                    </label>
                    <select
                      id="apt-type"
                      value={consultationType}
                      onChange={(e) => setConsultationType(e.target.value as ConsultationType)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-sm min-h-[44px]"
                    >
                      <option value="In-Person">{t('appointments.inPerson')}</option>
                      <option value="Teleconsultation">{t('appointments.teleconsultation')}</option>
                    </select>
                  </div>
                </div>

                {/* Available Time Slots */}
                <div>
                  <p className="text-sm font-medium text-slate-800 mb-2">
                    {t('appointments.availableSlotsFor', {
                      name: selectedDoctor.name,
                      hospital: selectedDoctor.hospital,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-2.5">
                    {selectedDoctor.consultationSlots.map((slot) => {
                      const taken = isAppointmentSlotTaken(
                        appointments,
                        selectedDoctor.id,
                        appointmentDate,
                        slot
                      );
                      const active = !taken && selectedSlot === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          disabled={taken}
                          onClick={() => setSelectedSlot(slot)}
                          className={`px-4 py-2 rounded-xl border text-sm font-medium tabular-nums transition-colors min-h-[42px] ${
                            taken
                              ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed line-through'
                              : active
                              ? 'bg-[#198754] border-[#198754] text-white'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {slot}
                          {taken ? ` (${t('appointments.slotBooked')})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Reason */}
                <div>
                  <label
                    htmlFor="apt-reason"
                    className="block text-sm font-medium text-slate-800 mb-1"
                  >
                    {t('appointments.reasonLabel')}
                  </label>
                  <input
                    id="apt-reason"
                    type="text"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={t('appointments.reasonPlaceholder')}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm min-h-[44px]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#198754] hover:bg-[#146c43] text-white text-sm font-semibold transition-colors min-h-[46px] disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />
                  ) : (
                    <CalendarCheck className="w-4 h-4 shrink-0" aria-hidden="true" />
                  )}
                  <span>{t('appointments.confirmAppointment')}</span>
                </button>
              </form>
            </>
          )}
        </section>
      )}

      {/* Appointment Status & History */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-lg font-bold text-slate-900">
            {t('appointments.historyTitle')}
          </h2>

          <div
            className="flex flex-wrap gap-1.5"
            role="tablist"
            aria-label={t('appointments.historyTitle')}
          >
            {(['All', 'Pending', 'Accepted', 'Completed', 'Rejected', 'Cancelled'] as const).map(
              (tab) => {
                const active = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[36px] ${
                      active
                        ? 'bg-[#198754] text-white'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t(`appointments.status.${tab}`)}
                  </button>
                );
              }
            )}
          </div>
        </div>

        {filteredAppointments.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
            <p className="text-sm text-slate-600">
              {t('appointments.noAppointments', {
                status: t(`appointments.status.${statusFilter}`),
              })}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAppointments.map((apt) => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                onUpdateStatus={updateAppointmentStatus}
                isDoctorView={isDoctor}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
