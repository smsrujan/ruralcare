import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, type LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  subtitle: string;
  icon: LucideIcon;
  to: string;
  actionLabel: string;
  accent?: 'green' | 'blue' | 'red';
}

export const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  to,
  actionLabel,
  accent = 'green',
}) => {
  const iconColors =
    accent === 'red'
      ? 'bg-red-50 text-[#DC2626]'
      : accent === 'blue'
      ? 'bg-blue-50 text-[#0D6EFD]'
      : 'bg-emerald-50 text-[#198754]';

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-slate-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="font-display text-2xl font-bold text-slate-900 mt-1 tabular-nums truncate">
            {value}
          </p>
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${iconColors}`}>
          <Icon className="w-5 h-5" aria-hidden="true" />
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <span className="text-xs text-slate-500 leading-snug min-w-0">{subtitle}</span>
        <Link
          to={to}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#198754] hover:text-[#146c43] whitespace-nowrap shrink-0"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
};
