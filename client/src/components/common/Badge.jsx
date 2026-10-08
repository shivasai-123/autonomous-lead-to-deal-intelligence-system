import React from 'react';

const VARIANTS = {
  primary: 'bg-brand-50 text-brand-700 border-brand-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function Badge({ children, variant = 'neutral', className = '' }) {
  const variantClass = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${variantClass} ${className}`}
    >
      {children}
    </span>
  );
}

export default Badge;
