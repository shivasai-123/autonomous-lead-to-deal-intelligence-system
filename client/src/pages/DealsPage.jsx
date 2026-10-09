import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Search,
  Filter,
  Plus,
  RefreshCw,
  Building2,
  User,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  Clock,
  History,
  MoveRight,
  ChevronLeft,
  ChevronRight,
  Eye,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export function DealsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Deals state
  const [deals, setDeals] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stageFilter, setStageFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [assigneeFilter, setAssigneeFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Metadata states
  const [stages, setStages] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);

  // Detail Modal State
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Transition form in detail modal
  const [targetStageId, setTargetStageId] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [transitionSubmitting, setTransitionSubmitting] = useState(false);

  // Create Deal Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    value: '',
    currency: 'USD',
    pipelineStageId: '',
    companyId: '',
    assignedToId: '',
    expectedCloseDate: '',
    description: ''
  });
  const [createErrors, setCreateErrors] = useState({});
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Load metadata once
  useEffect(() => {
    async function loadMetadata() {
      try {
        const [stagesRes, compRes, usersRes] = await Promise.all([
          crmService.getPipelineStages(),
          crmService.getCompanies({ limit: 100 }),
          crmService.getAssignableUsers()
        ]);
        setStages(stagesRes.data?.data?.stages || []);
        setCompanies(compRes.data?.data?.companies || []);
        setAssignableUsers(usersRes.data?.data?.users || []);
      } catch (e) {
        console.warn('Failed to load metadata:', e);
      }
    }
    loadMetadata();
  }, []);

  // Fetch deals
  const fetchDeals = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 10,
        sortBy,
        sortOrder
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter) params.status = statusFilter;
      if (stageFilter) params.pipelineStageId = stageFilter;
      if (companyFilter) params.companyId = companyFilter;
      if (assigneeFilter) params.assignedToId = assigneeFilter;

      const res = await crmService.getDeals(params);
      const data = res.data?.data;
      setDeals(data?.deals || []);
      setPagination(data?.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      console.error('Failed to fetch deals:', err);
      setError(err.response?.data?.message || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, stageFilter, companyFilter, assigneeFilter, sortBy, sortOrder]);

  useEffect(() => {
    fetchDeals(1);
  }, [fetchDeals]);

  // View Deal Detail
  const handleOpenDetail = async (dealId) => {
    try {
      setDetailLoading(true);
      const res = await crmService.getDeal(dealId);
      const deal = res.data?.data?.deal;
      setSelectedDeal(deal);
      setTargetStageId(deal.pipelineStageId);
      setTransitionNote('');
    } catch (err) {
      console.error('Failed to load deal detail:', err);
      setError(err.response?.data?.message || 'Failed to load deal details');
    } finally {
      setDetailLoading(false);
    }
  };

  // Submit stage transition from detail modal
  const handleTransitionSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDeal || !targetStageId || targetStageId === selectedDeal.pipelineStageId) return;

    try {
      setTransitionSubmitting(true);
      setError(null);

      const res = await crmService.transitionDealStage(selectedDeal.id, targetStageId, transitionNote);
      const updatedDeal = res.data?.data?.deal;

      setSelectedDeal(updatedDeal);
      setTransitionNote('');
      setSuccessMessage('Deal stage updated successfully');
      setTimeout(() => setSuccessMessage(null), 4000);

      // Refresh list
      fetchDeals(pagination.page);
    } catch (err) {
      console.error('Stage transition failed:', err);
      setError(err.response?.data?.message || 'Failed to transition stage');
    } finally {
      setTransitionSubmitting(false);
    }
  };

  // Submit Create Deal
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateErrors({});

    const errors = {};
    if (!createForm.title.trim()) errors.title = 'Title is required';
    if (!createForm.value || isNaN(Number(createForm.value)) || Number(createForm.value) < 0) {
      errors.value = 'Valid non-negative value is required';
    }
    if (!createForm.pipelineStageId) errors.pipelineStageId = 'Pipeline stage is required';

    if (Object.keys(errors).length > 0) {
      setCreateErrors(errors);
      return;
    }

    try {
      setCreateSubmitting(true);
      await crmService.createDeal({
        ...createForm,
        value: parseFloat(createForm.value),
        companyId: createForm.companyId || null,
        assignedToId: createForm.assignedToId || null,
        expectedCloseDate: createForm.expectedCloseDate || null
      });

      setCreateModalOpen(false);
      setCreateForm({
        title: '',
        value: '',
        currency: 'USD',
        pipelineStageId: stages[0]?.id || '',
        companyId: '',
        assignedToId: '',
        expectedCloseDate: '',
        description: ''
      });
      setSuccessMessage('Deal created successfully');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchDeals(1);
    } catch (err) {
      console.error('Create deal error:', err);
      if (err.response?.data?.errors) {
        setCreateErrors(err.response.data.errors);
      } else {
        setError(err.response?.data?.message || 'Failed to create deal');
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  const formatCurrency = (val, currency = 'USD') => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(num);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Deals & Opportunities</h1>
            <Badge variant="primary">Phase 5</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Track commercial contracts, sales outcomes, and chronological stage transition history
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/pipeline')}
            icon={MoveRight}
          >
            Kanban Board
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setCreateModalOpen(true);
              if (stages.length > 0 && !createForm.pipelineStageId) {
                setCreateForm((prev) => ({ ...prev, pipelineStageId: stages[0].id }));
              }
            }}
            icon={Plus}
          >
            New Deal
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-600 hover:text-rose-900">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filters Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search deals..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            {/* Status */}
            <div>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Statuses</option>
                <option value="OPEN">Open</option>
                <option value="WON">Won</option>
                <option value="LOST">Lost</option>
              </select>
            </div>

            {/* Stage */}
            <div>
              <select
                aria-label="Filter by pipeline stage"
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Stages</option>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.probability}%)
                  </option>
                ))}
              </select>
            </div>

            {/* Company */}
            <div>
              <select
                aria-label="Filter by company"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Companies</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div>
              <select
                aria-label="Filter by assignee"
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:outline-none"
              >
                <option value="">All Assignees</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.firstName} {u.lastName}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deals Data Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-4 py-3.5">Deal Title</th>
                <th className="px-4 py-3.5">Company</th>
                <th className="px-4 py-3.5">Stage</th>
                <th className="px-4 py-3.5">Value</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Assignee</th>
                <th className="px-4 py-3.5">Expected Close</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
                      <span>Loading deals...</span>
                    </div>
                  </td>
                </tr>
              ) : deals.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-4 py-12 text-center text-slate-500">
                    <Briefcase className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">No deals found</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Adjust your filters or create a new deal to get started.
                    </p>
                  </td>
                </tr>
              ) : (
                deals.map((deal) => {
                  return (
                    <tr
                      key={deal.id}
                      onClick={() => handleOpenDetail(deal.id)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-900 group-hover:text-brand-600 transition-colors">
                          {deal.title}
                        </div>
                        {deal.lead && (
                          <p className="text-[11px] text-slate-400">
                            Lead: {deal.lead.firstName} {deal.lead.lastName}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {deal.company?.name || '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-700">
                            {deal.pipelineStage?.name}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            ({deal.pipelineStage?.probability}%)
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-bold text-slate-900">
                        {formatCurrency(deal.value, deal.currency)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            deal.status === 'WON'
                              ? 'success'
                              : deal.status === 'LOST'
                              ? 'danger'
                              : 'primary'
                          }
                          className="text-[10px]"
                        >
                          {deal.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600">
                        {deal.assignedTo
                          ? `${deal.assignedTo.firstName} ${deal.assignedTo.lastName}`
                          : 'Unassigned'}
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 whitespace-nowrap">
                        {formatDate(deal.expectedCloseDate)}
                      </td>
                      <td className="px-4 py-3.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Eye}
                          onClick={() => handleOpenDetail(deal.id)}
                          className="text-slate-500 hover:text-brand-600"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <p>
              Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total deals)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                icon={ChevronLeft}
                disabled={pagination.page <= 1}
                onClick={() => fetchDeals(pagination.page - 1)}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                icon={ChevronRight}
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => fetchDeals(pagination.page + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Deal Detail & History Modal */}
      {selectedDeal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden animate-in fade-in max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">
                    {selectedDeal.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs font-bold text-slate-700">
                      {formatCurrency(selectedDeal.value, selectedDeal.currency)}
                    </span>
                    <span className="text-slate-300">&bull;</span>
                    <Badge
                      variant={
                        selectedDeal.status === 'WON'
                          ? 'success'
                          : selectedDeal.status === 'LOST'
                          ? 'danger'
                          : 'primary'
                      }
                      className="text-[10px]"
                    >
                      {selectedDeal.status}
                    </Badge>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeal(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              {/* Deal Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Company</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {selectedDeal.company?.name || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Current Stage</span>
                  <span className="font-semibold text-brand-700 mt-0.5 block">
                    {selectedDeal.pipelineStage?.name} ({selectedDeal.pipelineStage?.probability}%)
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Owner</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {selectedDeal.assignedTo
                      ? `${selectedDeal.assignedTo.firstName} ${selectedDeal.assignedTo.lastName}`
                      : 'Unassigned'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Expected Close</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatDate(selectedDeal.expectedCloseDate)}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Lead Origin</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block truncate">
                    {selectedDeal.lead
                      ? `${selectedDeal.lead.firstName} ${selectedDeal.lead.lastName}`
                      : 'Direct Creation'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block font-semibold uppercase text-[10px]">Closed Date</span>
                  <span className="font-semibold text-slate-800 mt-0.5 block">
                    {formatDate(selectedDeal.closedAt)}
                  </span>
                </div>
              </div>

              {selectedDeal.description && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
                  <p className="text-xs text-slate-700 bg-white border border-slate-200 p-3 rounded-lg leading-relaxed">
                    {selectedDeal.description}
                  </p>
                </div>
              )}

              {/* Stage Transition Control Box */}
              <div className="p-4 bg-brand-50/50 border border-brand-100 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <MoveRight className="w-4 h-4 text-brand-600" />
                  <h4 className="text-xs font-bold text-brand-900 uppercase tracking-wider">
                    Transition Stage
                  </h4>
                </div>

                <form onSubmit={handleTransitionSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Move to Target Stage
                      </label>
                      <select
                        value={targetStageId}
                        onChange={(e) => setTargetStageId(e.target.value)}
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      >
                        {stages.map((stg) => (
                          <option key={stg.id} value={stg.id}>
                            {stg.name} ({stg.probability}%)
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Transition Note (Optional)
                      </label>
                      <input
                        type="text"
                        value={transitionNote}
                        onChange={(e) => setTransitionNote(e.target.value)}
                        placeholder="e.g. Contract review passed..."
                        className="w-full text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      disabled={transitionSubmitting || targetStageId === selectedDeal.pipelineStageId}
                    >
                      {transitionSubmitting ? 'Updating...' : 'Apply Stage Transition'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Stage Transition History Timeline */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <History className="w-4 h-4 text-slate-500" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    Stage Transition History ({selectedDeal.stageHistory?.length || 0})
                  </h4>
                </div>

                {(!selectedDeal.stageHistory || selectedDeal.stageHistory.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">No transition events recorded.</p>
                ) : (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {selectedDeal.stageHistory.map((item) => (
                      <div key={item.id} className="relative text-xs">
                        {/* Dot */}
                        <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-brand-600 ring-4 ring-white" />

                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                            <span className="font-medium text-slate-700">
                              {item.user ? `${item.user.firstName} ${item.user.lastName}` : 'System'}
                            </span>
                            <span className="flex items-center gap-1 text-slate-400">
                              <Clock className="w-3 h-3" />
                              {formatDateTime(item.enteredAt)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 font-semibold text-slate-900">
                            {item.fromStage ? (
                              <>
                                <span>{item.fromStage.name}</span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                                <span className="text-brand-600">{item.toStage?.name}</span>
                              </>
                            ) : (
                              <span>Created in {item.toStage?.name}</span>
                            )}
                          </div>

                          {item.transitionNote && (
                            <p className="mt-1.5 text-slate-600 bg-white p-2 rounded border border-slate-100 text-[11px]">
                              "{item.transitionNote}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedDeal(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Deal Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-base">Create New Deal</h3>
              </div>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Deal Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.title}
                    onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                    placeholder="e.g. Enterprise Cloud Migration Contract"
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                  {createErrors.title && (
                    <p className="text-xs text-rose-600 mt-1">{createErrors.title}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Deal Value ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={createForm.value}
                      onChange={(e) => setCreateForm({ ...createForm, value: e.target.value })}
                      placeholder="50000"
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                    {createErrors.value && (
                      <p className="text-xs text-rose-600 mt-1">{createErrors.value}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Currency
                    </label>
                    <select
                      value={createForm.currency}
                      onChange={(e) => setCreateForm({ ...createForm, currency: e.target.value })}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    >
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Pipeline Stage *
                  </label>
                  <select
                    value={createForm.pipelineStageId}
                    onChange={(e) => setCreateForm({ ...createForm, pipelineStageId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {stages.map((stg) => (
                      <option key={stg.id} value={stg.id}>
                        {stg.name} ({stg.probability}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Associated Company
                  </label>
                  <select
                    value={createForm.companyId}
                    onChange={(e) => setCreateForm({ ...createForm, companyId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">-- No Company --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Assigned Owner
                  </label>
                  <select
                    value={createForm.assignedToId}
                    onChange={(e) => setCreateForm({ ...createForm, assignedToId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    <option value="">
                      {isManagement ? '-- Unassigned --' : `${user?.firstName} ${user?.lastName} (Self)`}
                    </option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Expected Close Date
                  </label>
                  <input
                    type="date"
                    value={createForm.expectedCloseDate}
                    onChange={(e) => setCreateForm({ ...createForm, expectedCloseDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Description
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Details about product scope, deliverables..."
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(false)}
                  disabled={createSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={createSubmitting}
                >
                  {createSubmitting ? 'Creating...' : 'Create Deal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default DealsPage;
