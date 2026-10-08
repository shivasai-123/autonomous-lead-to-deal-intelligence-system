import React from 'react';

export function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={`px-6 py-4 border-b border-slate-100 flex items-center justify-between ${className}`}>
      <div>
        {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

export function CardContent({ children, className = '' }) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

export function CardFooter({ children, className = '' }) {
  return (
    <div className={`px-6 py-3 bg-slate-50/70 border-t border-slate-100 text-xs text-slate-500 ${className}`}>
      {children}
    </div>
  );
}

export default Card;
