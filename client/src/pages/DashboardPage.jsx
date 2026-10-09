import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  DollarSign,
  Users,
  AlertTriangle,
  Briefcase,
  Target,
  Clock,
  Sparkles,
  Flame,
  ArrowRight,
  RefreshCw,
  Award,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { crmService } from '../services/crm';
import { useAuth } from '../context/AuthContext';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

const DATE_RANGES = [
  { id: '7d', label: 'Last 7 Days' },
  { id: '30d', label: 'Last 30 Days' },
  { id: '90d', label: 'Last 90 Days' },
  { id: 'month', label: 'This Month' },
  { id: 'all', label: 'All Time' }
];

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

export function DashboardPage() {
  const { user } = useAuth();
  const isManagerOrAdmin = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Active view tab: 'overview' or 'workspace'
  const [activeTab, setActiveTab] = useState(isManagerOrAdmin ? 'overview' : 'workspace');
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Overview data
  const [overview, setOverview] = useState(null);
  const [funnelData, setFunnelData] = useState([]);
  const [pipelineDist, setPipelineDist] = useState([]);
  const [salesTrends, setSalesTrends] = useState([]);
  const [leadSources, setLeadSources] = useState([]);
  const [repPerformance, setRepPerformance] = useState([]);

  // Workspace data (sales rep)
  const [workspace, setWorkspace] = useState(null);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val || 0);
  };

  const loadDashboardData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      if (activeTab === 'overview') {
        const [
          overviewRes,
          funnelRes,
          distRes,
          trendsRes,
          sourcesRes,
          repRes
        ] = await Promise.all([
          crmService.getAnalyticsOverview({ range: dateRange }),
          crmService.getConversionFunnel({ range: dateRange }),
          crmService.getPipelineDistribution({ range: dateRange }),
          crmService.getSalesTrends({ range: dateRange }),
          crmService.getLeadSources({ range: dateRange }),
          isManagerOrAdmin
            ? crmService.getSalesRepPerformance({ range: dateRange }).catch(() => ({ data: { performance: [] } }))
            : Promise.resolve({ data: { performance: [] } })
        ]);

        setOverview(overviewRes.data?.data || overviewRes.data?.metrics || null);
        setFunnelData(funnelRes.data?.data?.funnel || funnelRes.data?.funnel || []);
        setPipelineDist(distRes.data?.data?.distribution || distRes.data?.distribution || []);
        setSalesTrends(trendsRes.data?.data?.trends || trendsRes.data?.trends || []);
        setLeadSources(sourcesRes.data?.data?.sources || sourcesRes.data?.sources || []);
        setRepPerformance(repRes.data?.data?.performance || repRes.data?.performance || []);
      } else {
        const wsRes = await crmService.getSalesRepWorkspace();
        setWorkspace(wsRes.data?.data || wsRes.data || null);
      }
    } catch (err) {
      console.error('Failed to load dashboard analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, dateRange, isManagerOrAdmin]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Sales Intelligence & Executive Analytics
            </h1>
            <Badge variant="primary" className="text-[11px] py-0.5">
              Live PostgreSQL
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Real-time commercial pipeline metrics, revenue forecasts, and salesperson workspace
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2.5">
          {/* Tab Switcher */}
          <div className="bg-slate-100 p-1 rounded-lg flex items-center">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'overview'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Executive Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                activeTab === 'workspace'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              My Workspace
            </button>
          </div>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadDashboardData(true)}
            disabled={loading || refreshing}
            icon={RefreshCw}
            className={refreshing ? 'animate-spin' : ''}
          >
            {refreshing ? 'Updating...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Date Range Selector for Overview */}
      {activeTab === 'overview' && (
        <div className="flex items-center justify-between bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <Calendar className="w-4 h-4 text-slate-500" />
            <span>Time Horizon:</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {DATE_RANGES.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setDateRange(r.id)}
                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                  dateRange === r.id
                    ? 'bg-brand-600 text-white font-semibold shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state skeleton */}
      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
          <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
          <span className="text-sm font-medium">Aggregating PostgreSQL CRM intelligence...</span>
        </div>
      ) : activeTab === 'overview' ? (
        /* ========================================================================= */
        /* EXECUTIVE OVERVIEW VIEW                                                   */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* 8 Primary KPI Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Active Leads */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Active Leads
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.leads?.activeLeads || 0}
                  </span>
                  <span className="text-xs text-blue-600 font-medium">
                    +{overview?.leads?.newLeadsInPeriod || 0} in period
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
                  <span>🔥 {overview?.leads?.hotLeads || 0} Hot</span>
                  <span>&bull;</span>
                  <span>⚡ {overview?.leads?.warmLeads || 0} Warm</span>
                </div>
              </CardContent>
            </Card>

            {/* 2. Stalled Leads */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Stalled Leads
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-amber-600">
                    {overview?.leads?.stalledLeads || 0}
                  </span>
                  <Badge variant={overview?.leads?.stalledLeads > 0 ? 'warning' : 'success'} className="text-[10px]">
                    {overview?.leads?.stalledLeads > 0 ? '>14d Inactive' : 'Clear'}
                  </Badge>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Leads with zero contact for &ge; 14 days
                </p>
              </CardContent>
            </Card>

            {/* 3. Open Deals */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Open Deals
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Briefcase className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.deals?.openDeals || 0}
                  </span>
                  <span className="text-xs text-indigo-600 font-medium">
                    {overview?.deals?.totalDealsInPeriod || 0} total deals
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Active opportunities in commercial pipeline
                </p>
              </CardContent>
            </Card>

            {/* 4. Open Pipeline Value */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Open Pipeline
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-purple-700">
                    {formatCurrency(overview?.deals?.openPipelineValue)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Gross unweighted pipeline potential
                </p>
              </CardContent>
            </Card>

            {/* 5. Weighted Pipeline Value */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Weighted Pipeline
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Target className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(overview?.deals?.weightedPipelineValue)}
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Probability-adjusted revenue expectation
                </p>
              </CardContent>
            </Card>

            {/* 6. Won Deal Value */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Closed-Won Revenue
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <Award className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {formatCurrency(overview?.deals?.wonDealValue)}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">
                    {overview?.deals?.wonDeals || 0} won
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Realized revenue within selected period
                </p>
              </CardContent>
            </Card>

            {/* 7. Win Rate */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Win Rate
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-blue-600">
                    {overview?.deals?.winRate || 0}%
                  </span>
                  <span className="text-xs text-slate-500">
                    {overview?.deals?.wonDeals || 0}W / {overview?.deals?.lostDeals || 0}L
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Formula: Won / (Won + Lost)
                </p>
              </CardContent>
            </Card>

            {/* 8. Avg Sales Cycle */}
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Avg Sales Cycle
                  </span>
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {overview?.deals?.avgSalesCycleDays || 0}
                    <span className="text-sm font-normal text-slate-500 ml-1">days</span>
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Average duration from creation to close-won
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 1: Sales Trends & Pipeline Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 6-Month Sales Trend Area Chart */}
            <Card>
              <CardHeader
                title="Historical Revenue Trends"
                description="Monthly closed-won revenue performance over 6 months"
              />
              <CardContent>
                <div className="h-72 w-full">
                  {salesTrends.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={salesTrends}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis
                          stroke="#94a3b8"
                          fontSize={11}
                          tickLine={false}
                          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                        />
                        <Tooltip
                          formatter={(value) => [formatCurrency(value), 'Won Revenue']}
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderRadius: '8px',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12px'
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="revenue"
                          stroke="#3b82f6"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#revenueGrad)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No trend data available for selected horizon
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Pipeline Stage Distribution Bar Chart */}
            <Card>
              <CardHeader
                title="Pipeline Stage Distribution"
                description="Active deal count and dollar volume across workflow stages"
              />
              <CardContent>
                <div className="h-72 w-full">
                  {pipelineDist.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={pipelineDist}
                        margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="stageName" stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} />
                        <Tooltip
                          formatter={(value, name) => [
                            name === 'value' ? formatCurrency(value) : value,
                            name === 'value' ? 'Pipeline Value' : 'Deals Count'
                          ]}
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderRadius: '8px',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12px'
                          }}
                        />
                        <Bar dataKey="dealCount" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Deals Count" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-slate-400">
                      No deals currently in pipeline stages
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row 2: Conversion Funnel & Lead Source Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversion Funnel */}
            <Card>
              <CardHeader
                title="Commercial Conversion Funnel"
                description="Progression from raw inbound leads to closed-won opportunities"
              />
              <CardContent>
                <div className="space-y-4 py-2">
                  {funnelData.map((step, idx) => {
                    const maxCount = funnelData[0]?.count || 1;
                    const pctOfTop = Math.round((step.count / maxCount) * 100);

                    return (
                      <div key={step.stage} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-800 flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                              {idx + 1}
                            </span>
                            {step.stage}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900">{step.count}</span>
                            <span className="text-[11px] text-slate-400">
                              ({step.conversionRate}% conversion)
                            </span>
                          </div>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-brand-600 to-indigo-500"
                            style={{ width: `${Math.max(5, pctOfTop)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Lead Sources Donut Chart */}
            <Card>
              <CardHeader
                title="Lead Acquisition Channels"
                description="Origin distribution of leads recorded in the system"
              />
              <CardContent>
                <div className="h-72 w-full flex items-center justify-center">
                  {leadSources.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={leadSources}
                          dataKey="count"
                          nameKey="source"
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={95}
                          paddingAngle={3}
                        >
                          {leadSources.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip
                          formatter={(value, name, props) => [
                            `${value} leads (${props.payload?.percentage}%)`,
                            name
                          ]}
                          contentStyle={{
                            backgroundColor: '#1e293b',
                            borderRadius: '8px',
                            color: '#fff',
                            border: 'none',
                            fontSize: '12px'
                          }}
                        />
                        <Legend verticalAlign="bottom" height={36} iconSize={10} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="text-xs text-slate-400">No lead sources recorded</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Manager/Admin Rep Leaderboard */}
          {isManagerOrAdmin && repPerformance.length > 0 && (
            <Card>
              <CardHeader
                title="Sales Representative Performance Leaderboard"
                description="Comparative commercial output and conversion efficiency by team member"
              />
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                      <tr>
                        <th className="py-3 px-4">Sales Representative</th>
                        <th className="py-3 px-4 text-center">Assigned Leads</th>
                        <th className="py-3 px-4 text-center">Won Deals</th>
                        <th className="py-3 px-4 text-right">Won Revenue</th>
                        <th className="py-3 px-4 text-right">Win Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {repPerformance.map((rep, idx) => (
                        <tr key={rep.id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 flex items-center gap-2.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                              idx === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                            }`}>
                              {idx + 1}
                            </span>
                            <div>
                              <span>{rep.name}</span>
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {rep.email}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-center text-slate-700 font-medium">
                            {rep.assignedLeads}
                          </td>
                          <td className="py-3.5 px-4 text-center font-semibold text-emerald-600">
                            {rep.wonDeals}
                          </td>
                          <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                            {formatCurrency(rep.wonRevenue)}
                          </td>
                          <td className="py-3.5 px-4 text-right font-semibold text-blue-600">
                            {rep.winRate}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        /* ========================================================================= */
        /* SALESPERSON PERSONAL WORKSPACE VIEW                                       */
        /* ========================================================================= */
        <div className="space-y-6">
          {/* Summary Workspace KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-blue-100 bg-gradient-to-tr from-blue-50/30 to-white">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  My Active Leads
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-slate-900">
                    {workspace?.metrics?.assignedLeads || 0}
                  </span>
                  <Badge variant="primary" className="text-xs">
                    🔥 {workspace?.metrics?.hotLeads || 0} Hot
                  </Badge>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  {workspace?.metrics?.stalledLeads || 0} stalled leads requiring contact
                </p>
              </CardContent>
            </Card>

            <Card className="border-indigo-100 bg-gradient-to-tr from-indigo-50/30 to-white">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  My Open Pipeline
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-indigo-700">
                    {formatCurrency(workspace?.metrics?.openPipelineValue)}
                  </span>
                  <span className="text-xs text-indigo-600 font-semibold">
                    {workspace?.metrics?.openDeals || 0} deals
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Active opportunities currently assigned to me
                </p>
              </CardContent>
            </Card>

            <Card className="border-emerald-100 bg-gradient-to-tr from-emerald-50/30 to-white">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  My Won Revenue
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-emerald-700">
                    {formatCurrency(workspace?.metrics?.wonRevenue)}
                  </span>
                  <span className="text-xs text-emerald-600 font-semibold">
                    {workspace?.metrics?.wonDeals || 0} won
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Closed-won commercial bookings
                </p>
              </CardContent>
            </Card>

            <Card className="border-purple-100 bg-gradient-to-tr from-purple-50/30 to-white">
              <CardContent className="p-5">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  My Win Rate
                </span>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-purple-700">
                    {workspace?.metrics?.winRate || 0}%
                  </span>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Calculated against closed opportunities
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Action Columns: Hot Leads & Stalled Leads */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hot Leads Table */}
            <Card>
              <CardHeader
                title="🔥 Priority Hot Leads"
                description="Leads with engagement score >= 70 primed for immediate conversion"
                action={
                  <Link to="/leads?classification=HOT">
                    <Button variant="ghost" size="sm" icon={ArrowRight}>
                      All Hot Leads
                    </Button>
                  </Link>
                }
              />
              <CardContent className="p-0">
                {workspace?.hotLeads?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {workspace.hotLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 rounded">
                              {lead.score} pts
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {lead.company?.name || 'No company'} &bull; {lead.jobTitle || 'Lead'}
                          </p>
                        </div>
                        <Link to={`/leads/${lead.id}`}>
                          <Button variant="outline" size="sm" icon={ChevronRight}>
                            Engage
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No hot leads currently assigned. High activity drives leads into hot status!
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stalled Leads Alerts */}
            <Card>
              <CardHeader
                title="⏳ Stalled Leads (Action Required)"
                description="Assigned leads with no engagement activity recorded for 14+ days"
                action={
                  <Link to="/leads?isStalled=true">
                    <Button variant="ghost" size="sm" icon={ArrowRight}>
                      All Stalled Leads
                    </Button>
                  </Link>
                }
              />
              <CardContent className="p-0">
                {workspace?.stalledLeads?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {workspace.stalledLeads.map((lead) => (
                      <div
                        key={lead.id}
                        className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {lead.firstName} {lead.lastName}
                            </span>
                            <Badge variant="warning" className="text-[10px]">
                              {lead.daysSinceLastActivity}d inactive
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            {lead.company?.name || 'No company'} &bull; Last touch:{' '}
                            {lead.lastActivityAt
                              ? new Date(lead.lastActivityAt).toLocaleDateString()
                              : 'Never'}
                          </p>
                        </div>
                        <Link to={`/leads/${lead.id}`}>
                          <Button variant="outline" size="sm">
                            Follow Up
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    🎉 Excellent! You have no stalled leads in your assigned pipeline.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Action Columns: Deals Closing Soon & Next-Best-Actions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Deals Closing Soon */}
            <Card>
              <CardHeader
                title="🎯 Deals Closing Soon"
                description="Open opportunities with close dates within the next 14 days"
                action={
                  <Link to="/pipeline">
                    <Button variant="ghost" size="sm" icon={ArrowRight}>
                      Pipeline Board
                    </Button>
                  </Link>
                }
              />
              <CardContent className="p-0">
                {workspace?.dealsClosingSoon?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {workspace.dealsClosingSoon.map((deal) => (
                      <div
                        key={deal.id}
                        className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div>
                          <span className="font-semibold text-slate-900 text-xs block">
                            {deal.title}
                          </span>
                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                            <span className="font-bold text-slate-800">
                              {formatCurrency(deal.value)}
                            </span>
                            <span>&bull;</span>
                            <span className="text-brand-600 font-medium">
                              {deal.pipelineStage?.name}
                            </span>
                            <span>&bull;</span>
                            <span className="text-rose-600 font-medium">
                              Due {deal.expectedCloseDate ? new Date(deal.expectedCloseDate).toLocaleDateString() : 'Soon'}
                            </span>
                          </div>
                        </div>
                        <Link to={`/deals/${deal.id}`}>
                          <Button variant="outline" size="sm">
                            Manage
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No open deals scheduled to close in the next 14 days.
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Next-Best-Actions */}
            <Card>
              <CardHeader
                title="⚡ Pending Next-Best-Actions"
                description="Algorithmically recommended next actions for assigned leads"
                action={
                  <Link to="/recommendations">
                    <Button variant="ghost" size="sm" icon={ArrowRight}>
                      View All
                    </Button>
                  </Link>
                }
              />
              <CardContent className="p-0">
                {workspace?.recommendations?.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {workspace.recommendations.map((rec) => (
                      <div
                        key={rec.id}
                        className="p-4 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 text-xs">
                              {rec.title}
                            </span>
                            <Badge variant="neutral" className="text-[10px]">
                              {rec.type}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            Lead: {rec.lead?.firstName} {rec.lead?.lastName} &bull; {rec.explanation}
                          </p>
                        </div>
                        <Link to={`/leads/${rec.leadId}`}>
                          <Button variant="outline" size="sm" icon={Sparkles}>
                            Execute
                          </Button>
                        </Link>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400">
                    No pending recommended actions at this time.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
