import React from 'react';

/**
 * Standardized semantic status badge.
 *
 * Replaces the ad-hoc color classes scattered across the app with one
 * consistent, WCAG-aware token set. All variants keep ≥4.5:1 text contrast
 * on their backgrounds.
 */
const VARIANTS = {
  // Semantic status
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  danger: 'bg-rose-50 text-rose-800 border-rose-200',
  info: 'bg-brand-50 text-brand-800 border-brand-200',
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
};

export const StatusBadge = ({ variant = 'neutral', children, className = '', ...props }) => {
  const variantClasses = VARIANTS[variant] || VARIANTS.neutral;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full border tracking-wide ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
};
