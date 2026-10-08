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
  Clock
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Overview', to: '/', icon: Home, enabled: true },
  { label: 'System Dashboard', to: '/dashboard', icon: LayoutDashboard, enabled: true },
  { label: 'Leads Management', to: '/leads', icon: Users, enabled: false, phase: 'Phase 4' },
  { label: 'Companies', to: '/companies', icon: Building2, enabled: false, phase: 'Phase 4' },
  { label: 'Sales Pipeline', to: '/pipeline', icon: GitBranch, enabled: false, phase: 'Phase 5' },
  { label: 'Deals & Revenue', to: '/deals', icon: Briefcase, enabled: false, phase: 'Phase 5' },
  { label: 'Next-Best-Action', to: '/recommendations', icon: Sparkles, enabled: false, phase: 'Phase 7' },
];

export function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex md:flex-col min-h-[calc(100vh-4rem)]">
      <div className="p-4 flex-1">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-3 mb-2">
          Navigation
        </p>
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
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

      <div className="p-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>SaaS Foundation v1.0.0</span>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
