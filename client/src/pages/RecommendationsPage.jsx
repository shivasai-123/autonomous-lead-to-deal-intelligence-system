import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  ArrowRight,
  Search,
  Filter,
  RefreshCw,
  Check,
  X,
  PhoneCall,
  Send,
  Video,
  Building2,
  UserCheck,
  TrendingUp,
  ExternalLink,
  ChevronRight,
  Flame,
  Zap,
  Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardContent } from '../components/common/Card';
import { AiExplanationModal } from '../components/ai/AiExplanationModal';

const TYPE_CONFIG = {
  SCHEDULE_DEMO: {
    label: 'Schedule Demo',
    icon: Video,
    color: 'text-purple-700 bg-purple-50 border-purple-200',
    badgeVariant: 'primary'
  },
  REVIEW_STALLED_LEAD: {
    label: 'Review Stalled Lead',
    icon: AlertTriangle,
    color: 'text-amber-700 bg-amber-50 border-amber-200',
    badgeVariant: 'warning'
  },
  CONTACT_LEAD: {
    label: 'Contact Lead',
    icon: PhoneCall,
    color: 'text-blue-700 bg-blue-50 border-blue-200',
    badgeVariant: 'primary'
  },
  SEND_FOLLOW_UP: {
    label: 'Send Follow-Up',
    icon: Send,
    color: 'text-cyan-700 bg-cyan-50 border-cyan-200',
    badgeVariant: 'primary'
  },
  OTHER: {
    label: 'Pipeline Action',
    icon: Sparkles,
    color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    badgeVariant: 'success'
  }
};

const STATUS_TABS = [
  { id: 'PENDING', label: 'Pending Actions' },
  { id: 'ACCEPTED', label: 'In Progress / Accepted' },
  { id: 'EXECUTED', label: 'Executed' },
  { id: 'DISMISSED', label: 'Dismissed' },
  { id: 'ALL', label: 'All Recommendations' }
];

export function RecommendationsPage() {
  const { user } = useAuth();
  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  const [recommendations, setRecommendations] = useState([]);
  const [metrics, setMetrics] = useState({
    totalPending: 0,
    totalAccepted: 0,
    totalExecuted: 0,
    totalDismissed: 0,
    highConfidenceCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });

  // Action state
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Dismiss Modal State
  const [dismissModal, setDismissModal] = useState({
    isOpen: false,
    recommendationId: null,
    reason: ''
  });
  const [selectedRecForAi, setSelectedRecForAi] = useState(null);

  const fetchRecommendations = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const params = {
        page,
        limit: 20,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        type: typeFilter || undefined,
        search: search.trim() || undefined
      };

      const res = await crmService.getRecommendations(params);
      const { data, pagination: pag, metrics: met } = res.data.data;
      setRecommendations(data || []);
      setPagination(pag || { total: 0, totalPages: 1 });
      if (met) setMetrics(met);
    } catch (err) {
      console.error('Failed to load recommendations:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to load recommendations.'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter, typeFilter, search]);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  const handleStatusUpdate = async (id, newStatus, reason = null) => {
    setActionLoadingId(id);
    try {
      await crmService.updateRecommendationStatus(id, newStatus, reason);
      setNotification({
        type: 'success',
        message: `Recommendation marked as ${newStatus.toLowerCase()}.`
      });
      // Refetch data silently
      fetchRecommendations(true);
    } catch (err) {
      console.error('Failed to update recommendation status:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to update recommendation status.'
      });
    } finally {
      setActionLoadingId(null);
      if (dismissModal.isOpen) {
        setDismissModal({ isOpen: false, recommendationId: null, reason: '' });
      }
    }
  };

  const handleBatchRefresh = async () => {
    setBatchLoading(true);
    try {
      const res = await crmService.batchRefreshRecommendations();
      setNotification({
        type: 'success',
        message: res.data?.message || 'Batch recommendation evaluation completed successfully.'
      });
      fetchRecommendations(true);
    } catch (err) {
      console.error('Batch refresh failed:', err);
      setNotification({
        type: 'error',
        message: err.response?.data?.message || 'Failed to run batch recommendation evaluation.'
      });
    } finally {
      setBatchLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Next-Best-Action Intelligence</h1>
            <Badge variant="primary" className="text-xs bg-indigo-100 text-indigo-800 border-indigo-200">
              Deterministic NBA
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Rule-driven recommendation engine synthesizing live engagement, score velocity, and pipeline status into prioritized actions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isManagement && (
            <Button
              variant="outline"
              size="sm"
              icon={Sparkles}
              loading={batchLoading}
              disabled={batchLoading}
              onClick={handleBatchRefresh}
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
            >
              Batch Recalculate
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            icon={RefreshCw}
            loading={refreshing}
            disabled={refreshing}
            onClick={() => fetchRecommendations(true)}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Global Notification Banner */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border flex items-center justify-between text-sm ${
            notification.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'error' ? (
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            )}
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Pending Actions</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{metrics.totalPending}</div>
          <p className="text-[11px] text-slate-400">Awaiting sales rep action</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>High Confidence</span>
            <Zap className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{metrics.highConfidenceCount}</div>
          <p className="text-[11px] text-slate-400">Confidence rating &ge; 85%</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>In Progress</span>
            <UserCheck className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-blue-600">{metrics.totalAccepted}</div>
          <p className="text-[11px] text-slate-400">Accepted by sales rep</p>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Completed Actions</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{metrics.totalExecuted}</div>
          <p className="text-[11px] text-slate-400">Executed successfully</p>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
        {/* Status Tabs */}
        <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 pb-3">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Search & Action Type Filters */}
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by action title, lead contact name, or company..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">All Action Types</option>
              <option value="SCHEDULE_DEMO">Schedule Demo</option>
              <option value="REVIEW_STALLED_LEAD">Review Stalled Lead</option>
              <option value="CONTACT_LEAD">Contact Lead</option>
              <option value="SEND_FOLLOW_UP">Send Follow-Up</option>
              <option value="OTHER">Pipeline Action</option>
            </select>

            {(search || typeFilter || statusFilter !== 'PENDING') && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setTypeFilter('');
                  setStatusFilter('PENDING');
                  setPage(1);
                }}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Reset
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Recommendations Feed */}
      {loading ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <RefreshCw className="w-6 h-6 text-brand-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-500">Evaluating CRM Next-Best-Actions...</p>
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200 space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6 text-emerald-500" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Recommendations Found</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            {statusFilter === 'PENDING'
              ? 'Great work! All active leads have been addressed or no pending recommendations match your current filter.'
              : 'No recommendations match the selected filter criteria.'}
          </p>
          {isManagement && (
            <Button
              variant="outline"
              size="sm"
              icon={Sparkles}
              onClick={handleBatchRefresh}
              loading={batchLoading}
              className="mt-2"
            >
              Trigger System-Wide Recalculation
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const config = TYPE_CONFIG[rec.type] || TYPE_CONFIG.OTHER;
            const TypeIcon = config.icon;
            const isLoading = actionLoadingId === rec.id;

            const confidencePct = Math.round((rec.confidence || 0.8) * 100);

            return (
              <div
                key={rec.id}
                className={`bg-white rounded-xl border transition-all p-5 shadow-sm hover:shadow-md space-y-4 ${
                  rec.status === 'PENDING'
                    ? 'border-slate-200'
                    : rec.status === 'ACCEPTED'
                    ? 'border-blue-200 bg-blue-50/10'
                    : rec.status === 'EXECUTED'
                    ? 'border-emerald-200 bg-emerald-50/10'
                    : 'border-slate-200 opacity-75'
                }`}
              >
                {/* Header row: Action Type, Confidence, Status Badge, Timestamp */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.color}`}
                    >
                      <TypeIcon className="w-3.5 h-3.5" />
                      {config.label}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        confidencePct >= 90
                          ? 'bg-emerald-100 text-emerald-800'
                          : confidencePct >= 80
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {confidencePct}% Confidence
                    </span>

                    {rec.status !== 'PENDING' && (
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                          rec.status === 'ACCEPTED'
                            ? 'bg-blue-100 text-blue-800'
                            : rec.status === 'EXECUTED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rec.status}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Generated {new Date(rec.createdAt).toLocaleDateString()} at{' '}
                    {new Date(rec.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>

                {/* Recommendation Title & Explanation */}
                <div className="space-y-1.5">
                  <h3 className="text-base font-bold text-slate-900">{rec.title}</h3>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 leading-relaxed">
                    <span className="font-semibold text-slate-900 block mb-0.5">Why this action:</span>
                    {rec.explanation}
                  </div>
                </div>

                {/* Grounding Context: Lead Profile, Company, Score, Priority, Assignee */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex flex-wrap items-center gap-3">
                    {/* Lead Contact Link */}
                    {rec.lead && (
                      <Link
                        to={`/leads/${rec.lead.id}`}
                        className="font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1 hover:underline"
                      >
                        {rec.lead.firstName} {rec.lead.lastName}
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    )}

                    {/* Company */}
                    {rec.lead?.company?.name && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        <span>{rec.lead.company.name}</span>
                      </div>
                    )}

                    {/* Lead Score & Priority */}
                    {rec.lead && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-bold px-1.5 py-0.2 rounded text-[10px] ${
                            rec.lead.score >= 70
                              ? 'bg-rose-100 text-rose-800'
                              : rec.lead.score >= 40
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          Score: {rec.lead.score}
                        </span>

                        <span
                          className={`text-[10px] font-semibold uppercase px-1.5 py-0.2 rounded ${
                            rec.lead.priority === 'URGENT'
                              ? 'bg-rose-100 text-rose-800'
                              : rec.lead.priority === 'HIGH'
                              ? 'bg-orange-100 text-orange-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {rec.lead.priority}
                        </span>
                      </div>
                    )}

                    {/* Assigned Rep */}
                    {rec.assignedTo && (
                      <div className="flex items-center gap-1 text-slate-500">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {rec.assignedTo.firstName} {rec.assignedTo.lastName}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      icon={Sparkles}
                      onClick={() => setSelectedRecForAi(rec)}
                      className="text-xs border-purple-200 text-purple-700 hover:bg-purple-50"
                    >
                      Explain with AI
                    </Button>

                    {rec.status === 'PENDING' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={Check}
                          loading={isLoading}
                          disabled={isLoading}
                          onClick={() => handleStatusUpdate(rec.id, 'ACCEPTED')}
                          className="text-xs"
                        >
                          Accept
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          icon={CheckCircle2}
                          loading={isLoading}
                          disabled={isLoading}
                          onClick={() => handleStatusUpdate(rec.id, 'EXECUTED')}
                          className="text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        >
                          Mark Executed
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          loading={isLoading}
                          disabled={isLoading}
                          onClick={() =>
                            setDismissModal({
                              isOpen: true,
                              recommendationId: rec.id,
                              reason: ''
                            })
                          }
                          className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                          Dismiss
                        </Button>
                      </>
                    )}

                    {rec.status === 'ACCEPTED' && (
                      <>
                        <Button
                          variant="primary"
                          size="sm"
                          icon={CheckCircle2}
                          loading={isLoading}
                          disabled={isLoading}
                          onClick={() => handleStatusUpdate(rec.id, 'EXECUTED')}
                          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                          Complete Action
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          icon={X}
                          loading={isLoading}
                          disabled={isLoading}
                          onClick={() =>
                            setDismissModal({
                              isOpen: true,
                              recommendationId: rec.id,
                              reason: ''
                            })
                          }
                          className="text-xs text-rose-600 hover:bg-rose-50"
                        >
                          Dismiss
                        </Button>
                      </>
                    )}

                    {rec.status === 'DISMISSED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        icon={RefreshCw}
                        loading={isLoading}
                        disabled={isLoading}
                        onClick={() => handleStatusUpdate(rec.id, 'PENDING')}
                        className="text-xs text-slate-600 hover:bg-slate-50"
                      >
                        Reopen
                      </Button>
                    )}

                    {rec.lead && (
                      <Link to={`/leads/${rec.lead.id}`}>
                        <Button variant="ghost" size="sm" className="text-xs text-slate-500">
                          View Lead
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dismiss Modal */}
      {dismissModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Dismiss Recommendation</h3>
              <button
                onClick={() => setDismissModal({ isOpen: false, recommendationId: null, reason: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Please specify an optional reason why this recommended action is being dismissed.
            </p>

            <textarea
              rows={3}
              placeholder="e.g., Prospect unresponsive, already contacted offline, or not relevant right now..."
              value={dismissModal.reason}
              onChange={(e) =>
                setDismissModal({ ...dismissModal, reason: e.target.value })
              }
              className="w-full p-2.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />

            <div className="flex items-center justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissModal({ isOpen: false, recommendationId: null, reason: '' })}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() =>
                  handleStatusUpdate(
                    dismissModal.recommendationId,
                    'DISMISSED',
                    dismissModal.reason
                  )
                }
              >
                Confirm Dismiss
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Phase 8 AI Recommendation Explanation Modal */}
      <AiExplanationModal
        isOpen={!!selectedRecForAi}
        onClose={() => setSelectedRecForAi(null)}
        recommendation={selectedRecForAi}
      />
    </div>
  );
}

export default RecommendationsPage;
