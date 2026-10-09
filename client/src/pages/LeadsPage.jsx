import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Search,
  Filter,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit2,
  Trash2,
  AlertTriangle,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  Building2,
  Mail,
  Phone,
  UserCheck,
  X,
  CheckCircle2,
  Info,
  Clock,
  Flame,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardContent } from '../components/common/Card';

const STATUS_VARIANTS = {
  NEW: 'primary',
  CONTACTED: 'warning',
  QUALIFIED: 'success',
  UNQUALIFIED: 'neutral',
  CONVERTED: 'success',
  LOST: 'danger',
};

const PRIORITY_VARIANTS = {
  LOW: 'neutral',
  MEDIUM: 'primary',
  HIGH: 'warning',
  URGENT: 'danger',
};

const CLASSIFICATION_CONFIG = {
  HOT: {
    label: 'HOT',
    icon: '🔥',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  },
  WARM: {
    label: 'WARM',
    icon: '☀️',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  COLD: {
    label: 'COLD',
    icon: '❄️',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200'
  }
};

export function LeadsPage() {
  const { user } = useAuth();
  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // State
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [assignedFilter, setAssignedFilter] = useState('');
  const [classificationFilter, setClassificationFilter] = useState('');
  const [stalledFilter, setStalledFilter] = useState('');
  const [recalculating, setRecalculating] = useState(false);

  // Dropdown reference data
  const [companies, setCompanies] = useState([]);
  const [usersList, setUsersList] = useState([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState(null);

  // Add / Edit Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    jobTitle: '',
    source: 'Website',
    status: 'NEW',
    priority: 'MEDIUM',
    companyId: '',
    assignedToId: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Duplicate Warning State inside Add Modal
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [forceSubmit, setForceSubmit] = useState(false);

  // Fetch reference dropdown options (companies & assignable users)
  const fetchReferenceData = useCallback(async () => {
    try {
      const compRes = await crmService.getCompanies({ limit: 100 });
      if (compRes?.data?.companies) {
        setCompanies(compRes.data.companies);
      }
      if (isManagement) {
        const usersRes = await crmService.getAssignableUsers();
        if (usersRes?.data?.users) {
          setUsersList(usersRes.data.users);
        }
      }
    } catch {
      // Non-critical reference fetch fallback
    }
  }, [isManagement]);

  // Fetch leads
  const fetchLeads = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const params = {
          page,
          limit: pagination.limit,
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          priority: priorityFilter || undefined,
          assignedToId: assignedFilter || undefined,
          classification: classificationFilter || undefined,
          isStalled: stalledFilter !== '' ? stalledFilter : undefined,
        };
        const res = await crmService.getLeads(params);
        if (res?.data) {
          setLeads(res.data.leads || []);
          setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        }
      } catch (err) {
        setError(err.message || 'Failed to load leads from CRM server');
      } finally {
        setLoading(false);
      }
    },
    [search, statusFilter, priorityFilter, assignedFilter, classificationFilter, stalledFilter, pagination.limit]
  );

  useEffect(() => {
    fetchReferenceData();
  }, [fetchReferenceData]);

  useEffect(() => {
    fetchLeads(1);
  }, [fetchLeads]);

  // Handle Search Input Debounce
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setPriorityFilter('');
    setAssignedFilter('');
    setClassificationFilter('');
    setStalledFilter('');
  };

  // Batch Recalculate Scores (Admin / Manager)
  const handleBatchRecalculate = async () => {
    try {
      setRecalculating(true);
      setError(null);
      const res = await crmService.batchRecalculateScores();
      const stats = res?.data?.data || res?.data || {};
      setSuccessMessage(
        `Batch recalculation complete: ${stats.totalProcessed ?? 0} leads processed (${stats.updatedCount ?? 0} updated, ${stats.unchangedCount ?? 0} unchanged).`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
      fetchLeads(pagination.page);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to recalculate lead scores');
    } finally {
      setRecalculating(false);
    }
  };

  // Open Add Lead Modal
  const handleOpenAddModal = () => {
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      jobTitle: '',
      source: 'Website',
      status: 'NEW',
      priority: 'MEDIUM',
      companyId: '',
      assignedToId: isManagement ? '' : user?.id || '',
    });
    setFormErrors({});
    setDuplicateWarning(null);
    setForceSubmit(false);
    setIsAddModalOpen(true);
  };

  // Open Edit Lead Modal
  const handleOpenEditModal = (lead) => {
    setSelectedLead(lead);
    setFormData({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      jobTitle: lead.jobTitle || '',
      source: lead.source || 'Website',
      status: lead.status || 'NEW',
      priority: lead.priority || 'MEDIUM',
      companyId: lead.companyId || '',
      assignedToId: lead.assignedToId || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Open Archive Confirmation Modal
  const handleOpenArchiveModal = (lead) => {
    setSelectedLead(lead);
    setIsArchiveModalOpen(true);
  };

  // On-blur duplicate check in Add Modal
  const checkDuplicatesOnBlur = async () => {
    if (!formData.email && !formData.phone) return;
    try {
      const res = await crmService.checkDuplicates({
        email: formData.email,
        phone: formData.phone,
      });
      if (res?.data && (res.data.isDuplicate || (res.data.domainMatches && res.data.domainMatches.length > 0))) {
        setDuplicateWarning(res.data);
      } else {
        setDuplicateWarning(null);
      }
    } catch {
      // Ignore background check errors
    }
  };

  // Handle Add Lead Submit
  const handleCreateLead = async (e, force = false) => {
    if (e) e.preventDefault();
    setFormErrors({});
    setFormLoading(true);

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        jobTitle: formData.jobTitle || null,
        source: formData.source || null,
        status: formData.status,
        priority: formData.priority,
        companyId: formData.companyId || null,
        assignedToId: formData.assignedToId || null,
      };

      const res = await crmService.createLead(payload, force);
      setIsAddModalOpen(false);
      setSuccessMessage(`Lead "${formData.firstName} ${formData.lastName}" created successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchLeads(pagination.page);
    } catch (err) {
      if (err.status === 409 && err.data?.errors?.isDuplicate) {
        setDuplicateWarning(err.data.errors);
        setForceSubmit(true);
      } else if (err.errors) {
        setFormErrors(err.errors);
      } else {
        setFormErrors({ general: err.message || 'Failed to create lead' });
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Edit Lead Submit
  const handleUpdateLead = async (e) => {
    e.preventDefault();
    if (!selectedLead) return;
    setFormErrors({});
    setFormLoading(true);

    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone || null,
        jobTitle: formData.jobTitle || null,
        source: formData.source || null,
        status: formData.status,
        priority: formData.priority,
        companyId: formData.companyId || null,
        ...(isManagement ? { assignedToId: formData.assignedToId || null } : {}),
      };

      await crmService.updateLead(selectedLead.id, payload);
      setIsEditModalOpen(false);
      setSuccessMessage(`Lead "${formData.firstName} ${formData.lastName}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchLeads(pagination.page);
    } catch (err) {
      if (err.errors) {
        setFormErrors(err.errors);
      } else {
        setFormErrors({ general: err.message || 'Failed to update lead' });
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Archive Confirm
  const handleConfirmArchive = async () => {
    if (!selectedLead) return;
    setFormLoading(true);
    try {
      await crmService.archiveLead(selectedLead.id);
      setIsArchiveModalOpen(false);
      setSuccessMessage(`Lead "${selectedLead.firstName} ${selectedLead.lastName}" archived successfully.`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchLeads(pagination.page);
    } catch (err) {
      setError(err.message || 'Failed to archive lead');
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Leads Management</h1>
            <Badge variant="primary" className="text-xs">
              Phase 4 Core
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Capture, qualify, and track prospective customer relationships across your pipeline.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManagement && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleBatchRecalculate}
              disabled={loading || recalculating}
              loading={recalculating}
              icon={Zap}
              title="Recalculate lead scores and engagement intelligence across all active leads"
            >
              Recalculate Scores
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLeads(pagination.page)}
            disabled={loading}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenAddModal} icon={Plus}>
            Add Lead
          </Button>
        </div>
      </div>

      {/* Global Alerts */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between text-rose-800 text-sm">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="sm:col-span-2 relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search leads by name or email..."
                value={search}
                onChange={handleSearchChange}
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Statuses</option>
                <option value="NEW">New</option>
                <option value="CONTACTED">Contacted</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="UNQUALIFIED">Unqualified</option>
                <option value="CONVERTED">Converted</option>
                <option value="LOST">Lost</option>
              </select>
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Priorities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>

            {/* Engagement Temperature Filter (Phase 6) */}
            <div>
              <select
                value={classificationFilter}
                onChange={(e) => setClassificationFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Temperatures</option>
                <option value="HOT">🔥 HOT (70–100)</option>
                <option value="WARM">☀️ WARM (40–69)</option>
                <option value="COLD">❄️ COLD (0–39)</option>
              </select>
            </div>

            {/* Activity Status Filter (Phase 6) */}
            <div>
              <select
                value={stalledFilter}
                onChange={(e) => setStalledFilter(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
              >
                <option value="">All Touchpoints</option>
                <option value="true">⏳ Stalled (≥14d)</option>
                <option value="false">⚡ Active</option>
              </select>
            </div>
          </div>

          {/* Sub-row: Assignee and Clear Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-slate-100">
            {isManagement ? (
              <div className="w-full sm:w-64">
                <select
                  value={assignedFilter}
                  onChange={(e) => setAssignedFilter(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="">All Sales Representatives</option>
                  {usersList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName}
                    </option>
                  ))}
                </select>
              </div>
            ) : <div />}

            {(search || statusFilter || priorityFilter || assignedFilter || classificationFilter || stalledFilter) && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear All Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Lead Contact</th>
                <th className="px-6 py-3 font-semibold">Company</th>
                <th className="px-6 py-3 font-semibold">Status</th>
                <th className="px-6 py-3 font-semibold">Priority</th>
                <th className="px-6 py-3 font-semibold">Assigned Rep</th>
                <th className="px-6 py-3 font-semibold">Signals & Activity</th>
                <th className="px-6 py-3 font-semibold">Temperature & Score</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading leads data...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center">
                    <Users className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No leads found</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {search || statusFilter || priorityFilter
                        ? 'Try adjusting your search filters.'
                        : 'Get started by creating your first sales lead.'}
                    </p>
                    <div className="mt-4">
                      <Button size="sm" onClick={handleOpenAddModal} icon={Plus}>
                        Add New Lead
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Contact Name & Details */}
                    <td className="px-6 py-4">
                      <div>
                        <Link
                          to={`/leads/${lead.id}`}
                          className="font-semibold text-slate-900 hover:text-brand-600 flex items-center gap-1.5"
                        >
                          {lead.firstName} {lead.lastName}
                        </Link>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {lead.email}
                          </span>
                          {lead.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {lead.phone}
                            </span>
                          )}
                        </div>
                        {lead.jobTitle && (
                          <span className="text-[11px] text-slate-400 block mt-0.5">{lead.jobTitle}</span>
                        )}
                      </div>
                    </td>

                    {/* Company */}
                    <td className="px-6 py-4">
                      {lead.company ? (
                        <div className="flex items-center gap-1.5 text-slate-800">
                          <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium truncate max-w-[140px]">{lead.company.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      <Badge variant={STATUS_VARIANTS[lead.status] || 'neutral'}>
                        {lead.status}
                      </Badge>
                    </td>

                    {/* Priority */}
                    <td className="px-6 py-4">
                      <Badge variant={PRIORITY_VARIANTS[lead.priority] || 'neutral'}>
                        {lead.priority}
                      </Badge>
                    </td>

                    {/* Assigned Sales Rep */}
                    <td className="px-6 py-4">
                      {lead.assignedTo ? (
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>
                            {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    {/* Intelligence Signals & Activity */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {lead.isStalled && (
                          <Badge
                            variant="warning"
                            className="text-[10px] gap-1 py-0.5 px-1.5 bg-amber-50 text-amber-800 border-amber-200"
                            title={`No qualifying activity in ${lead.daysSinceLastActivity ?? 14} days`}
                          >
                            <Clock className="w-2.5 h-2.5" />
                            Stalled ({lead.daysSinceLastActivity ?? 14}d)
                          </Badge>
                        )}
                        {lead.isDuplicate && (
                          <Badge variant="warning" className="text-[10px] gap-1 py-0 px-1.5" title="Duplicate detected">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            Duplicate
                          </Badge>
                        )}
                        {lead.isSuspicious && (
                          <Badge
                            variant="danger"
                            className="text-[10px] gap-1 py-0 px-1.5"
                            title={lead.suspiciousReason || 'Suspicious contact flagged'}
                          >
                            <ShieldAlert className="w-2.5 h-2.5" />
                            Suspicious
                          </Badge>
                        )}
                        {!lead.isStalled && !lead.isDuplicate && !lead.isSuspicious && (
                          <span className="text-xs text-slate-400 font-medium">⚡ Active</span>
                        )}
                      </div>
                    </td>

                    {/* Temperature & Score */}
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                          CLASSIFICATION_CONFIG[lead.classification]?.badgeClass ||
                          (lead.score >= 70
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : lead.score >= 40
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-sky-50 text-sky-700 border-sky-200')
                        }`}
                      >
                        <span>
                          {CLASSIFICATION_CONFIG[lead.classification]?.icon ||
                            (lead.score >= 70 ? '🔥' : lead.score >= 40 ? '☀️' : '❄️')}
                        </span>
                        <span>{lead.classification || (lead.score >= 70 ? 'HOT' : lead.score >= 40 ? 'WARM' : 'COLD')}</span>
                        <span className="font-extrabold text-slate-900 ml-0.5">({lead.score ?? 0})</span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link to={`/leads/${lead.id}`}>
                          <Button variant="ghost" size="sm" title="View Lead Details" icon={ExternalLink}>
                            View
                          </Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(lead)}
                          title="Edit Lead"
                          icon={Edit2}
                        />
                        {isManagement && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                            onClick={() => handleOpenArchiveModal(lead)}
                            title="Archive Lead"
                            icon={Trash2}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination.totalPages > 1 && (
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold">{(pagination.page - 1) * pagination.limit + 1}</span> to{' '}
              <span className="font-semibold">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{' '}
              of <span className="font-semibold">{pagination.total}</span> leads
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLeads(pagination.page - 1)}
                disabled={pagination.page <= 1 || loading}
                icon={ChevronLeft}
              >
                Prev
              </Button>
              <span className="px-2 font-medium">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchLeads(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages || loading}
                icon={ChevronRight}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ======================================================== */}
      {/* ADD LEAD MODAL */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Sales Lead</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter prospect contact details and link to an account organization.
                </p>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={(e) => handleCreateLead(e, false)} className="p-6 space-y-4">
              {/* Duplicate / Domain Match Warning Banner */}
              {duplicateWarning && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Potential Duplicate or Correlated Lead Detected</span>
                  </div>
                  {duplicateWarning.reasons && (
                    <ul className="text-xs text-amber-700 list-disc list-inside space-y-0.5">
                      {duplicateWarning.reasons.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}
                  {duplicateWarning.duplicateMatches && duplicateWarning.duplicateMatches.length > 0 && (
                    <div className="mt-2 text-xs text-slate-700 bg-white/80 p-2.5 rounded-lg border border-amber-200">
                      <p className="font-semibold text-slate-900 mb-1">Existing Matched Leads:</p>
                      {duplicateWarning.duplicateMatches.map((m) => (
                        <div key={m.id} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                          <div>
                            <span className="font-medium">{m.firstName} {m.lastName}</span> ({m.email})
                            {m.company && <span className="text-slate-500 ml-1">· {m.company.name}</span>}
                          </div>
                          <Link
                            to={`/leads/${m.id}`}
                            target="_blank"
                            className="text-brand-600 hover:underline flex items-center gap-1 font-medium text-[11px]"
                          >
                            Inspect <ExternalLink className="w-3 h-3" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                  {forceSubmit && (
                    <div className="pt-2 flex items-center justify-between">
                      <p className="text-xs text-amber-800">
                        Do you want to create this lead anyway as a distinct record?
                      </p>
                      <Button
                        type="button"
                        variant="warning"
                        size="sm"
                        onClick={() => handleCreateLead(null, true)}
                        disabled={formLoading}
                      >
                        Force Create Lead
                      </Button>
                    </div>
                  )}
                </div>
              )}

              {/* General Form Error */}
              {formErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {formErrors.general}
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    First Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Jordan"
                  />
                  {formErrors.firstName && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.firstName}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Last Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Taylor"
                  />
                  {formErrors.lastName && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.lastName}</p>
                  )}
                </div>
              </div>

              {/* Contact Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onBlur={checkDuplicatesOnBlur}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. jordan@example.com"
                  />
                  {formErrors.email && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.email}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onBlur={checkDuplicatesOnBlur}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. +1 555 123 4567"
                  />
                  {formErrors.phone && (
                    <p className="text-xs text-rose-600 mt-1">{formErrors.phone}</p>
                  )}
                </div>
              </div>

              {/* Job Title & Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Job Title
                  </label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Director of Infrastructure"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Company / Organization
                  </label>
                  <select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">-- No Company Association --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.industry ? `(${c.industry})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lead Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="UNQUALIFIED">UNQUALIFIED</option>
                    <option value="CONVERTED">CONVERTED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              {/* Assignee (Management only) */}
              {isManagement && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign to Sales Representative
                  </label>
                  <select
                    value={formData.assignedToId}
                    onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={formLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={formLoading}>
                  {formLoading ? 'Creating Lead...' : 'Save Lead'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT LEAD MODAL */}
      {/* ======================================================== */}
      {isEditModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Lead: {selectedLead.firstName} {selectedLead.lastName}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update qualification status, contact info, and company links.</p>
              </div>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLead} className="p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {formErrors.general}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={formData.jobTitle}
                    onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <select
                    value={formData.companyId}
                    onChange={(e) => setFormData({ ...formData, companyId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">-- No Company Association --</option>
                    {companies.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="NEW">NEW</option>
                    <option value="CONTACTED">CONTACTED</option>
                    <option value="QUALIFIED">QUALIFIED</option>
                    <option value="UNQUALIFIED">UNQUALIFIED</option>
                    <option value="CONVERTED">CONVERTED</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              {/* Reassignment (Management only) */}
              {isManagement && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assigned Representative
                  </label>
                  <select
                    value={formData.assignedToId}
                    onChange={(e) => setFormData({ ...formData, assignedToId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditModalOpen(false)}
                  disabled={formLoading}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Update Lead'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* ARCHIVE CONFIRMATION MODAL */}
      {/* ======================================================== */}
      {isArchiveModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Archive Lead?</h3>
                <p className="text-xs text-slate-500">Soft-delete archival preservation</p>
              </div>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              Are you sure you want to archive lead{' '}
              <strong className="text-slate-900">{selectedLead.firstName} {selectedLead.lastName}</strong>?
              This lead will be hidden from active lists, but historical activities, scoring logs, and audit entries
              will remain intact.
            </p>

            <div className="pt-2 flex items-center justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsArchiveModalOpen(false)}
                disabled={formLoading}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmArchive}
                disabled={formLoading}
              >
                {formLoading ? 'Archiving...' : 'Yes, Archive Lead'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadsPage;
