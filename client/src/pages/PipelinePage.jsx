import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitBranch,
  DollarSign,
  TrendingUp,
  Award,
  AlertCircle,
  Plus,
  RefreshCw,
  Clock,
  Building2,
  User,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MoveRight,
  Filter,
  Calendar,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';

export function PipelinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Data states
  const [stages, setStages] = useState([]);
  const [deals, setDeals] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Drag and drop states
  const [draggedDeal, setDraggedDeal] = useState(null);
  const [dragOverStageId, setDragOverStageId] = useState(null);

  // Transition Note Modal State
  const [transitionModal, setTransitionModal] = useState({
    isOpen: false,
    deal: null,
    targetStage: null,
    note: ''
  });
  const [transitioning, setTransitioning] = useState(false);

  // Create Deal Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [companies, setCompanies] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
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

  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Load all pipeline data
  const loadPipelineData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [stagesRes, dealsRes, metricsRes] = await Promise.all([
        crmService.getPipelineStages(),
        crmService.getDeals({ limit: 100 }),
        crmService.getPipelineMetrics()
      ]);

      const fetchedStages = stagesRes.data?.data?.stages || [];
      const fetchedDeals = dealsRes.data?.data?.deals || [];
      const fetchedMetrics = metricsRes.data?.data || null;

      setStages(fetchedStages);
      setDeals(fetchedDeals);
      setMetrics(fetchedMetrics);
    } catch (err) {
      console.error('Failed to load pipeline data:', err);
      setError(err.response?.data?.message || 'Failed to load pipeline data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPipelineData();
  }, [loadPipelineData]);

  // Load dropdown metadata when modal opens
  const openCreateModal = async () => {
    setCreateModalOpen(true);
    setCreateErrors({});
    if (stages.length > 0 && !createForm.pipelineStageId) {
      setCreateForm((prev) => ({ ...prev, pipelineStageId: stages[0].id }));
    }

    try {
      const [compRes, usersRes] = await Promise.all([
        crmService.getCompanies({ limit: 100 }),
        crmService.getAssignableUsers()
      ]);
      setCompanies(compRes.data?.data?.companies || []);
      setAssignableUsers(usersRes.data?.data?.users || []);
    } catch (e) {
      console.warn('Failed to load companies or users for deal modal:', e);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, deal) => {
    setDraggedDeal(deal);
    e.dataTransfer.setData('text/plain', deal.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDragLeave = (e, stageId) => {
    if (dragOverStageId === stageId) {
      setDragOverStageId(null);
    }
  };

  const handleDrop = async (e, targetStageId) => {
    e.preventDefault();
    setDragOverStageId(null);

    if (!draggedDeal || draggedDeal.pipelineStageId === targetStageId) {
      setDraggedDeal(null);
      return;
    }

    const targetStage = stages.find((s) => s.id === targetStageId);
    if (!targetStage) {
      setDraggedDeal(null);
      return;
    }

    // If moving to Won or Lost or reopening, prompt with transition modal for optional note
    if (targetStage.name === 'Won' || targetStage.name === 'Lost' || draggedDeal.status !== 'OPEN') {
      setTransitionModal({
        isOpen: true,
        deal: draggedDeal,
        targetStage,
        note: ''
      });
      setDraggedDeal(null);
      return;
    }

    // Direct move for standard intermediate stages
    await executeStageTransition(draggedDeal.id, targetStage.id, '');
    setDraggedDeal(null);
  };

  const executeStageTransition = async (dealId, stageId, note) => {
    try {
      setTransitioning(true);
      setError(null);

      await crmService.transitionDealStage(dealId, stageId, note);

      setActionSuccess('Deal stage updated successfully');
      setTimeout(() => setActionSuccess(null), 4000);

      // Reload pipeline
      await loadPipelineData();
    } catch (err) {
      console.error('Transition failed:', err);
      setError(err.response?.data?.message || 'Failed to update deal stage');
    } finally {
      setTransitioning(false);
      setTransitionModal({ isOpen: false, deal: null, targetStage: null, note: '' });
    }
  };

  // Create Deal handler
  const handleCreateDealSubmit = async (e) => {
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
      setActionSuccess('Deal created successfully');
      setTimeout(() => setActionSuccess(null), 4000);
      await loadPipelineData();
    } catch (err) {
      console.error('Failed to create deal:', err);
      if (err.response?.data?.errors) {
        setCreateErrors(err.response.data.errors);
      } else {
        setError(err.response?.data?.message || 'Failed to create deal');
      }
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Format currency
  const formatCurrency = (val, currency = 'USD') => {
    const num = Number(val || 0);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      maximumFractionDigits: 0
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Sales Pipeline</h1>
            <Badge variant="primary">Phase 5</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Visual opportunity lifecycle &bull; Drag and drop deals across stages to track velocity and revenue
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={loadPipelineData}
            disabled={loading}
            icon={RefreshCw}
            className={loading ? 'animate-spin' : ''}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={openCreateModal}
            icon={Plus}
          >
            New Deal
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{actionSuccess}</span>
          </div>
          <button onClick={() => setActionSuccess(null)} className="text-emerald-600 hover:text-emerald-900">
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

      {/* Pipeline Analytics & Health KPI Banner */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Open Pipeline</p>
                <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {formatCurrency(metrics.totalOpenPipelineValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {metrics.totalOpenDeals} active {metrics.totalOpenDeals === 1 ? 'deal' : 'deals'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Weighted Value</p>
                <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-indigo-600 mt-2">
                {formatCurrency(metrics.weightedPipelineValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Factoring stage probability
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Win Rate</p>
                <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Award className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-emerald-600 mt-2">
                {metrics.winRate}%
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {metrics.wonDealsCount} Won / {metrics.lostDealsCount} Lost
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Avg Deal Value</p>
                <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {formatCurrency(metrics.averageDealValue)}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Active & won contracts
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm col-span-2 md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Closed Deals</p>
                <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-2">
                {metrics.wonDealsCount + metrics.lostDealsCount}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Total commercial decisions
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Kanban Board Container */}
      {loading ? (
        <div className="flex items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading pipeline board...</p>
          </div>
        </div>
      ) : stages.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-slate-200">
          <GitBranch className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-800">No Pipeline Stages Found</h3>
          <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">
            Pipeline stages have not been initialized yet. Check your database seed.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-6">
          <div className="flex gap-4 min-w-max">
            {stages.map((stage) => {
              const stageDeals = deals.filter((d) => d.pipelineStageId === stage.id);
              const stageTotal = stageDeals.reduce((sum, d) => sum + Number(d.value || 0), 0);
              const isOver = dragOverStageId === stage.id;
              const isTerminalWon = stage.name === 'Won';
              const isTerminalLost = stage.name === 'Lost';

              return (
                <div
                  key={stage.id}
                  onDragOver={(e) => handleDragOver(e, stage.id)}
                  onDragLeave={(e) => handleDragLeave(e, stage.id)}
                  onDrop={(e) => handleDrop(e, stage.id)}
                  className={`w-72 flex-shrink-0 flex flex-col rounded-xl border transition-colors ${
                    isOver
                      ? 'border-brand-500 bg-brand-50/40 ring-2 ring-brand-500/20'
                      : isTerminalWon
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isTerminalLost
                      ? 'border-rose-200 bg-rose-50/20'
                      : 'border-slate-200 bg-slate-50/60'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3.5 border-b border-slate-200/80 bg-white rounded-t-xl">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900">
                          {stage.name}
                        </span>
                        <span className="px-1.5 py-0.5 text-[11px] font-bold rounded bg-slate-100 text-slate-600">
                          {stageDeals.length}
                        </span>
                      </div>
                      <Badge
                        variant={
                          isTerminalWon
                            ? 'success'
                            : isTerminalLost
                            ? 'danger'
                            : stage.probability >= 70
                            ? 'primary'
                            : 'neutral'
                        }
                        className="text-[10px]"
                      >
                        {stage.probability}%
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400">Total Value:</span>
                      <span className="font-bold text-slate-700">
                        {formatCurrency(stageTotal)}
                      </span>
                    </div>
                  </div>

                  {/* Deals Column Body */}
                  <div className="p-2.5 flex-1 space-y-2.5 min-h-[480px] max-h-[calc(100vh-280px)] overflow-y-auto">
                    {stageDeals.length === 0 ? (
                      <div className="h-32 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3 text-center">
                        <p className="text-xs text-slate-400">
                          Drag deals here
                        </p>
                      </div>
                    ) : (
                      stageDeals.map((deal) => (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal)}
                          className={`bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm hover:shadow hover:border-slate-300 transition-all cursor-grab active:cursor-grabbing group ${
                            draggedDeal?.id === deal.id ? 'opacity-40 scale-95' : ''
                          }`}
                        >
                          {/* Deal Header */}
                          <div className="flex items-start justify-between gap-2">
                            <h4
                              onClick={() => navigate('/deals')}
                              className="font-semibold text-xs text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 cursor-pointer"
                            >
                              {deal.title}
                            </h4>
                            <span className="text-xs font-bold text-slate-900 whitespace-nowrap">
                              {formatCurrency(deal.value, deal.currency)}
                            </span>
                          </div>

                          {/* Company / Account */}
                          {deal.company && (
                            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-slate-600">
                              <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">{deal.company.name}</span>
                            </div>
                          )}

                          {/* Lead Origin */}
                          {deal.lead && (
                            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                              <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="truncate">
                                {deal.lead.firstName} {deal.lead.lastName}
                              </span>
                            </div>
                          )}

                          {/* Footer with Assignee & Actions */}
                          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center text-[10px] font-bold">
                                {deal.assignedTo?.firstName?.[0] || 'U'}
                              </div>
                              <span className="truncate max-w-[90px]">
                                {deal.assignedTo
                                  ? `${deal.assignedTo.firstName}`
                                  : 'Unassigned'}
                              </span>
                            </div>

                            {/* Stage move quick selector */}
                            <select
                              aria-label="Move deal stage"
                              value={deal.pipelineStageId}
                              onChange={(e) => {
                                const newStageId = e.target.value;
                                if (newStageId !== deal.pipelineStageId) {
                                  const targetStg = stages.find((s) => s.id === newStageId);
                                  if (targetStg?.name === 'Won' || targetStg?.name === 'Lost' || deal.status !== 'OPEN') {
                                    setTransitionModal({
                                      isOpen: true,
                                      deal,
                                      targetStage: targetStg,
                                      note: ''
                                    });
                                  } else {
                                    executeStageTransition(deal.id, newStageId, '');
                                  }
                                }
                              }}
                              className="text-[11px] bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-slate-700 focus:outline-none focus:ring-1 focus:ring-brand-500"
                            >
                              {stages.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Transition Note Modal */}
      {transitionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MoveRight className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-base">Stage Transition</h3>
              </div>
              <button
                onClick={() => setTransitionModal({ isOpen: false, deal: null, targetStage: null, note: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Deal</p>
                <p className="text-sm font-bold text-slate-900 mt-0.5">{transitionModal.deal?.title}</p>
                <p className="text-xs text-slate-500">
                  Value: {formatCurrency(transitionModal.deal?.value, transitionModal.deal?.currency)}
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">From:</span>
                  <span className="font-semibold text-slate-700">
                    {stages.find((s) => s.id === transitionModal.deal?.pipelineStageId)?.name || 'Current'}
                  </span>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
                <div>
                  <span className="text-slate-400 block font-medium">To:</span>
                  <span className={`font-bold ${
                    transitionModal.targetStage?.name === 'Won'
                      ? 'text-emerald-600'
                      : transitionModal.targetStage?.name === 'Lost'
                      ? 'text-rose-600'
                      : 'text-brand-600'
                  }`}>
                    {transitionModal.targetStage?.name} ({transitionModal.targetStage?.probability}%)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Transition Note / Outcome Rationale
                </label>
                <textarea
                  rows={3}
                  value={transitionModal.note}
                  onChange={(e) => setTransitionModal((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder="Record why this stage transition occurred (e.g. Contract signed, Competitor selected)..."
                  className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransitionModal({ isOpen: false, deal: null, targetStage: null, note: '' })}
                disabled={transitioning}
              >
                Cancel
              </Button>
              <Button
                variant={
                  transitionModal.targetStage?.name === 'Won'
                    ? 'success'
                    : transitionModal.targetStage?.name === 'Lost'
                    ? 'danger'
                    : 'primary'
                }
                size="sm"
                onClick={() => executeStageTransition(transitionModal.deal.id, transitionModal.targetStage.id, transitionModal.note)}
                disabled={transitioning}
              >
                {transitioning ? 'Updating...' : `Confirm Move to ${transitionModal.targetStage?.name}`}
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

            <form onSubmit={handleCreateDealSubmit}>
              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Title */}
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

                {/* Value & Currency */}
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

                {/* Pipeline Stage */}
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

                {/* Company Account */}
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

                {/* Assigned Sales Representative */}
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

                {/* Expected Close Date */}
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

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Description & Scope
                  </label>
                  <textarea
                    rows={2}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Details about product requirements, deal terms, decision-makers..."
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

export default PipelinePage;
