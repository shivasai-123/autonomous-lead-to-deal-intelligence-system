import React from 'react';
import {
  Server,
  Activity,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Layers,
  Database
} from 'lucide-react';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export function DashboardPage() {
  const { health, loading, error, refetch } = useHealthCheck();

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">System Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            Phase 1 Foundation &bull; Real-time infrastructure diagnostics & service status
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refetch}
          disabled={loading}
          icon={RefreshCw}
          className={loading ? 'animate-spin' : ''}
        >
          {loading ? 'Checking...' : 'Refresh API Status'}
        </Button>
      </div>

      {/* Service Health Card */}
      <Card>
        <CardHeader
          title="Backend API Connectivity"
          description="Live diagnostic probe targeting Express API endpoint /api/health"
          action={
            error ? (
              <Badge variant="danger" className="gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Offline
              </Badge>
            ) : (
              <Badge variant="success" className="gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Healthy
              </Badge>
            )
          }
        />
        <CardContent>
          {loading ? (
            <div className="py-8 flex items-center justify-center text-slate-400 gap-2">
              <Activity className="w-5 h-5 animate-spin" />
              <span className="text-sm">Connecting to backend service...</span>
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-lg p-4 text-rose-800 text-sm space-y-2">
              <p className="font-semibold">Unable to connect to backend server</p>
              <p className="text-xs text-rose-600">{error}</p>
              <p className="text-xs text-slate-600 mt-2">
                Make sure the Express backend server is running on port 5000.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                  Status
                </span>
                <span className="text-lg font-bold text-emerald-600 mt-1 block">
                  {health?.data?.status?.toUpperCase() || 'OK'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                  Environment
                </span>
                <span className="text-lg font-bold text-slate-800 mt-1 block">
                  {health?.data?.environment || 'development'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                  Uptime
                </span>
                <span className="text-lg font-bold text-slate-800 mt-1 block">
                  {health?.data?.uptimeSeconds !== undefined
                    ? `${health.data.uptimeSeconds}s`
                    : 'Active'}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider block">
                  API Version
                </span>
                <span className="text-lg font-bold text-slate-800 mt-1 block">
                  {health?.data?.version || '1.0.0'}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modules Roadmap Grid */}
      <div>
        <h2 className="text-base font-bold text-slate-900 mb-3">CRM Architecture Modules</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card className="border-brand-200 bg-brand-50/20">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-brand-700">PHASE 1</span>
                <Badge variant="success">Completed</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">Architecture & Foundation</h4>
              <p className="text-xs text-slate-600">
                Monorepo skeleton, React client, Express API, Prisma foundation, standardized documentation.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-90">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PHASE 2</span>
                <Badge variant="neutral">Upcoming</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">Database & Prisma Setup</h4>
              <p className="text-xs text-slate-500">
                PostgreSQL schema, relations (Users, Leads, Companies, Deals, Activities), migrations & seeding.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-90">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PHASE 3</span>
                <Badge variant="neutral">Upcoming</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">Auth & User Management</h4>
              <p className="text-xs text-slate-500">
                JWT tokens, bcrypt password hashing, role-based authorization (Admin, Manager, Rep).
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-90">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PHASE 4</span>
                <Badge variant="neutral">Upcoming</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">CRM Core Management</h4>
              <p className="text-xs text-slate-500">
                Lead capture, company records, engagement activity tracking, deduplication filters.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-90">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PHASE 5</span>
                <Badge variant="neutral">Upcoming</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">Pipeline & Deals</h4>
              <p className="text-xs text-slate-500">
                Sales stages (New, Qualified, Proposal, Won, Lost), deal creation, conversion tracking.
              </p>
            </CardContent>
          </Card>

          <Card className="opacity-90">
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">PHASE 6-8</span>
                <Badge variant="neutral">Upcoming</Badge>
              </div>
              <h4 className="font-semibold text-slate-900 text-sm">Intelligence & AI Engine</h4>
              <p className="text-xs text-slate-500">
                Hot/warm/cold classification, Next-Best-Action recommendations, OpenAI explanations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
