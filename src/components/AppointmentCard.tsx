import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  Hourglass,
  XCircle,
  Ban,
  CheckCheck,
  Video,
  UserCheck,
  Loader2,
} from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../types/ruralcare';
import { extractSupabaseErrorMessage } from '../utils/supabaseMappers';

interface AppointmentCardProps {
  appointment: Appointment;
  onUpdateStatus: (
    id: string,
    nextStatus: AppointmentStatus,
    rejectionReason?: string
  ) => Promise<void>;
  isDoctorView?: boolean;
}

export const AppointmentCard: React.FC<AppointmentCardProps> = ({
  appointment,
  onUpdateStatus,
  isDoctorView = false,
}) => {
  const { t } = useTranslation();
  const [updating, setUpdating] = useState(false);
  const [rejectPromptOpen, setRejectPromptOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const statusMeta: Record<
    AppointmentStatus,
    { icon: React.ComponentType<{ className?: string }>; textColor: string; label: string }
  > = {
    Pending: {
      icon: Hourglass,
      textColor: 'text-amber-700',
      label: t('common.pending'),
    },
    Accepted: {
      icon: CheckCircle2,
      textColor: 'text-[#198754]',
      label: t('common.accepted'),
    },
    Rejected: {
      icon: XCircle,
      textColor: 'text-[#DC2626]',
      label: t('common.rejected'),
    },
    Cancelled: {
      icon: Ban,
      textColor: 'text-slate-500',
      label: t('common.cancelled'),
    },
    Completed: {
      icon: CheckCheck,
      textColor: 'text-[#0D6EFD]',
      label: t('common.completed'),
    },
  };

  const statusInfo = statusMeta[appointment.status];
  const StatusIcon = statusInfo.icon;

  const triggerUpdate = async (nextStatus: AppointmentStatus, reason?: string) => {
    if (updating) return;
    setUpdating(true);
    setActionError(null);
    try {
      await onUpdateStatus(appointment.id, nextStatus, reason);
      setRejectPromptOpen(false);
      setRejectionReason('');
    } catch (err) {
      setActionError(extractSupabaseErrorMessage(err, t('common.errorGeneric')));
    } finally {
      setUpdating(false);
    }
  };

  return (
    <article className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h3 className="font-display text-base font-bold text-slate-900">
              {isDoctorView && appointment.patientName
                ? `${appointment.patientName} → ${appointment.doctorName}`
                : appointment.doctorName}
            </h3>
            <span className="text-xs text-slate-500">{appointment.specialization}</span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-[11px] font-medium text-slate-700">
              {appointment.consultationType === 'Teleconsultation' ? (
                <Video className="w-3 h-3 text-[#0D6EFD]" aria-hidden="true" />
              ) : (
                <UserCheck className="w-3 h-3 text-[#198754]" aria-hidden="true" />
              )}
              <span>
                {appointment.consultationType === 'Teleconsultation'
                  ? t('appointments.teleconsultation')
                  : t('appointments.inPerson')}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600">
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Calendar className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>{appointment.date}</span>
            </span>
            <span className="inline-flex items-center gap-1.5 tabular-nums">
              <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>{appointment.timeSlot}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" aria-hidden="true" />
              <span>{appointment.hospital}</span>
            </span>
          </div>

          <p className="text-sm text-slate-700">
            <span className="text-slate-500">{t('appointments.reasonPrefix')}</span>{' '}
            {appointment.reason}
          </p>

          {appointment.rejectionReason && (
            <p className="text-xs text-[#DC2626] bg-red-50 px-3 py-1.5 rounded-lg inline-block">
              {t('appointments.rejectionReasonLabel')}: {appointment.rejectionReason}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:items-end gap-2.5 shrink-0 pt-3 sm:pt-0 border-t sm:border-t-0 border-slate-100">
          <div className={`inline-flex items-center gap-1.5 text-sm font-semibold ${statusInfo.textColor}`}>
            <StatusIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{statusInfo.label}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isDoctorView && appointment.status === 'Pending' && (
              <>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => void triggerUpdate('Accepted')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-200 text-xs font-semibold text-[#198754] hover:bg-emerald-50 disabled:opacity-60 transition-colors min-h-[36px]"
                >
                  {updating && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                  <span>{t('common.accept')}</span>
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => setRejectPromptOpen((prev) => !prev)}
                  className="px-3 py-1.5 rounded-lg border border-red-200 text-xs font-semibold text-[#DC2626] hover:bg-red-50 disabled:opacity-60 transition-colors min-h-[36px]"
                >
                  {t('common.reject')}
                </button>
              </>
            )}

            {isDoctorView && appointment.status === 'Accepted' && (
              <button
                type="button"
                disabled={updating}
                onClick={() => void triggerUpdate('Completed')}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-blue-200 text-xs font-semibold text-[#0D6EFD] hover:bg-blue-50 disabled:opacity-60 transition-colors min-h-[36px]"
              >
                {updating && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                <span>{t('appointments.markCompleted')}</span>
              </button>
            )}

            {!isDoctorView &&
              (appointment.status === 'Pending' || appointment.status === 'Accepted') && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => void triggerUpdate('Cancelled')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60 transition-colors min-h-[36px]"
                >
                  {updating && <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />}
                  <span>{t('appointments.cancelAppointment')}</span>
                </button>
              )}
          </div>
        </div>
      </div>

      {rejectPromptOpen && (
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
          <input
            type="text"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder={t('appointments.rejectionReasonPlaceholder')}
            className="flex-1 px-3.5 py-2 rounded-lg border border-slate-300 text-xs min-h-[38px]"
          />
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={updating}
              onClick={() => void triggerUpdate('Rejected', rejectionReason.trim() || undefined)}
              className="px-3.5 py-2 rounded-lg bg-[#DC2626] hover:bg-red-700 text-white text-xs font-semibold min-h-[38px]"
            >
              {t('appointments.confirmRejection')}
            </button>
            <button
              type="button"
              onClick={() => setRejectPromptOpen(false)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 min-h-[38px]"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {actionError && (
        <p role="alert" className="text-xs text-[#DC2626]">
          {actionError}
        </p>
      )}
    </article>
  );
};
