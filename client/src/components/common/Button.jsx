import React from 'react';

const VARIANTS = {
  primary: 'bg-brand-600 hover:bg-brand-700 text-white shadow-sm focus:ring-brand-500',
  secondary: 'bg-slate-100 hover:bg-slate-200 text-slate-800 focus:ring-slate-400',
  outline: 'border border-slate-300 hover:bg-slate-50 text-slate-700 focus:ring-slate-400',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:ring-rose-500',
  ghost: 'hover:bg-slate-100 text-slate-600 hover:text-slate-900 focus:ring-slate-300',
};

const SIZES = {
  sm: 'px-2.5 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  type = 'button',
  icon: Icon,
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {Icon && <Icon className="w-4 h-4 mr-2" />}
      {children}
    </button>
  );
}

export default Button;
