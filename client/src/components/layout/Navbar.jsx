import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Layers, Activity, CheckCircle2, AlertCircle, LogOut, User as UserIcon } from 'lucide-react';
import { useHealthCheck } from '../../hooks/useHealthCheck';
import { useAuth } from '../../context/AuthContext';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

export function Navbar() {
  const { loading: healthLoading, error: healthError } = useHealthCheck();
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleVariant = (role) => {
    switch (role) {
      case 'ADMIN':
        return 'danger';
      case 'SALES_MANAGER':
        return 'warning';
      default:
        return 'primary';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-700 to-brand-500 flex items-center justify-center text-white shadow-sm shadow-brand-500/20 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <span className="font-bold text-slate-900 text-base leading-tight block">
                  Lead-to-Deal
                </span>
                <span className="text-[10px] uppercase tracking-wider font-semibold text-brand-600 block">
                  Intelligence System
                </span>
              </div>
            </Link>
            <span className="ml-2 px-2 py-0.5 text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 rounded">
              Phase 3
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
            >
              Overview
            </Link>
            <Link
              to="/dashboard"
              className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors"
            >
              Dashboard
            </Link>
          </nav>

          {/* Right section: Health status & Auth controls */}
          <div className="flex items-center gap-3">
            {/* Backend Health Badge */}
            {healthLoading ? (
              <Badge variant="neutral" className="gap-1.5 py-1 hidden sm:inline-flex">
                <Activity className="w-3.5 h-3.5 animate-pulse text-slate-400" />
                <span className="text-xs text-slate-500">Checking API...</span>
              </Badge>
            ) : healthError ? (
              <Badge variant="danger" className="gap-1.5 py-1 hidden sm:inline-flex">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                <span className="text-xs text-rose-700">API Offline</span>
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1.5 py-1 hidden sm:inline-flex">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs text-emerald-700">API Connected</span>
              </Badge>
            )}

            {/* Auth Controls */}
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 leading-tight">
                    {user?.firstName} {user?.lastName}
                  </div>
                  <Badge variant={getRoleVariant(user?.role)} className="text-[10px] py-0 px-1.5 mt-0.5">
                    {user?.role?.replace('_', ' ')}
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  title="Sign out of CRM session"
                  icon={LogOut}
                >
                  <span className="hidden sm:inline">Sign Out</span>
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm" icon={UserIcon}>
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="primary" size="sm">
                    Register
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
