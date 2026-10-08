import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  Zap,
  TrendingUp,
  BrainCircuit,
  Database,
  Server,
  Monitor
} from 'lucide-react';
import { Card, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export function HomePage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-indigo-50/40 p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="primary">Finathon CRM-02 Platform</Badge>
            <Badge variant="neutral">Phase 1 Foundation</Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 tracking-tight">
            Autonomous Lead-to-Deal <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-600 to-indigo-600">
              Intelligence System
            </span>
          </h1>
          <p className="text-base text-slate-600 leading-relaxed">
            A production-style SaaS CRM platform empowering sales teams with autonomous qualification,
            predictive lead scoring, next-best-action recommendations, and seamless deal progression.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link to="/dashboard">
              <Button variant="primary" icon={ArrowRight}>
                Enter System Dashboard
              </Button>
            </Link>
            <a
              href="#architecture"
              className="inline-flex items-center"
            >
              <Button variant="outline">
                View Architecture
              </Button>
            </a>
          </div>
        </div>
      </div>

      {/* Feature Highlights Grid */}
      <div>
        <h2 className="text-lg font-bold text-slate-900 mb-4">Core Platform Pillars</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="hover:border-slate-300 transition-colors">
            <CardContent className="space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-indigo-50 text-brand-600 flex items-center justify-center">
                <BrainCircuit className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Autonomous Intelligence</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Deterministic and AI-driven scoring engine continuously tracks lead engagement and surfaces next best actions.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-slate-300 transition-colors">
            <CardContent className="space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Pipeline Acceleration</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Detects stalled opportunities, classifies hot/warm/cold leads, and auto-progresses qualified leads into deals.
              </p>
            </CardContent>
          </Card>

          <Card className="hover:border-slate-300 transition-colors">
            <CardContent className="space-y-2.5">
              <div className="w-10 h-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900 text-base">Enterprise Hygiene</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Duplicate & suspicious lead detection, audit logging, role-based security, and strict data integrity.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* System Architecture Section */}
      <div id="architecture" className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">Architecture Foundation (Phase 1)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-brand-600" />
                <h4 className="font-semibold text-slate-900 text-sm">Frontend Layer</h4>
              </div>
              <p className="text-xs text-slate-600">
                React + Vite client with Tailwind CSS, React Router v6, Axios API abstraction, and modular component hierarchy.
              </p>
              <Badge variant="success">Operational</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-brand-600" />
                <h4 className="font-semibold text-slate-900 text-sm">API Backend Layer</h4>
              </div>
              <p className="text-xs text-slate-600">
                Node.js + Express REST API with layered architecture (Routes &rarr; Controllers &rarr; Services), centralized error handling, and health diagnostics.
              </p>
              <Badge variant="success">Operational</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-brand-600" />
                <h4 className="font-semibold text-slate-900 text-sm">Database & ORM Layer</h4>
              </div>
              <p className="text-xs text-slate-600">
                PostgreSQL schema foundation configured via Prisma ORM client generator and high-level architectural models.
              </p>
              <Badge variant="neutral">Prepared for Phase 2</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
