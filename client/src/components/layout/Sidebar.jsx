import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Building2,
  GitBranch,
  Briefcase,
  Sparkles,
  Home,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export function Sidebar() {
  const { user, isAuthenticated } = useAuth();

  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  const navItems = [
    { label: 'Overview', to: '/', icon: Home, enabled: true },
    { label: 'System Dashboard', to: '/dashboard', icon: LayoutDashboard, enabled: true },
    ...(isManagement
      ? [{ label: 'User Directory', to: '/users', icon: ShieldCheck, enabled: true, highlight: true }]
      : []),
    { label: 'Leads Management', to: '/leads', icon: Users, enabled: false, phase: 'Phase 4' },
    { label: 'Companies', to: '/companies', icon: Building2, enabled: false, phase: 'Phase 4' },
    { label: 'Sales Pipeline', to: '/pipeline', icon: GitBranch, enabled: false, phase: 'Phase 5' },
    { label: 'Deals & Revenue', to: '/deals', icon: Briefcase, enabled: false, phase: 'Phase 5' },
    { label: 'Next-Best-Action', to: '/recommendations', icon: Sparkles, enabled: false, phase: 'Phase 7' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex md:flex-col min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Navigation
        </p>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            if (!item.enabled) {
              return (
                <div
                  key={item.label}
                  className="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-400 rounded-lg cursor-not-allowed group hover:bg-slate-50"
                  title={`${item.label} (${item.phase})`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-4 h-4 text-slate-300" />
                    <span>{item.label}</span>
                  </div>
                  <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-mono">
                    {item.phase}
                  </span>
                </div>
              );
            }

            return (
              <NavLink
                key={item.label}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {isAuthenticated && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold text-xs">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-[10px] text-slate-500 truncate capitalize">
                {user?.role?.toLowerCase()?.replace('_', ' ')}
              </p>
            </div>
            <UserCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          </div>
        </div>
      )}
    </aside>
  );
}

export default Sidebar;
