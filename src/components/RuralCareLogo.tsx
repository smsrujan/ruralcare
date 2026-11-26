import React from 'react';

export const RuralCareLogo: React.FC<{ size?: 'sm' | 'md' | 'lg'; light?: boolean }> = ({
  size = 'md',
  light = false,
}) => {
  const iconDims = size === 'lg' ? 'w-11 h-11' : size === 'sm' ? 'w-8 h-8' : 'w-9 h-9';
  const titleSize = size === 'lg' ? 'text-2xl' : size === 'sm' ? 'text-base' : 'text-lg';

  return (
    <div className="inline-flex items-center gap-2.5 shrink-0">
      <div
        className={`${iconDims} rounded-xl flex items-center justify-center shrink-0 ${
          light ? 'bg-white text-[#198754]' : 'bg-[#198754] text-white'
        }`}
        aria-hidden="true"
      >
        <svg viewBox="0 0 32 32" className="w-6 h-6" fill="none">
          <path
            d="M14 6h4v8h8v4h-8v8h-4v-8H6v-4h8V6z"
            fill="currentColor"
          />
          <path
            d="M23.5 5.5c2.2 0 4 1.8 4 4-2.2 0-4-1.8-4-4z"
            fill="currentColor"
            opacity="0.7"
          />
        </svg>
      </div>
      <div className="leading-tight whitespace-nowrap">
        <span
          className={`font-display font-bold tracking-tight ${titleSize} ${
            light ? 'text-white' : 'text-slate-900'
          }`}
        >
          RuralCare
        </span>
      </div>
    </div>
  );
};
