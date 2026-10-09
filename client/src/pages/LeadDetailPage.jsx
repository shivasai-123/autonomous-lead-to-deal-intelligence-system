import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Users,
  Building2,
  Mail,
  Phone,
  Briefcase,
  Calendar,
  Clock,
  UserCheck,
  AlertTriangle,
  ShieldAlert,
  Plus,
  RefreshCw,
  PhoneCall,
  Video,
  Send,
  Eye,
  Monitor,
  FileText,
  Activity,
  CheckCircle2,
  Edit2,
  Trash2,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardHeader, CardContent } from '../components/common/Card';

const ACTIVITY_ICONS = {
  CALL: PhoneCall,
  MEETING: Video,
  DEMO_REQUEST: Monitor,
  EMAIL_REPLY: Send,
  EMAIL_OPEN: Eye,
  WEBSITE_VISIT: Activity,
  PRICING_PAGE_VIEW: FileText,
  BROCHURE_DOWNLOAD: FileText,
  FORM_SUBMISSION: CheckCircle2,
  OTHER: Activity,
};

const ACTIVITY_COLORS = {
  CALL: 'text-blue-600 bg-blue-50 border-blue-200',
  MEETING: 'text-purple-600 bg-purple-50 border-purple-200',
  DEMO_REQUEST: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  EMAIL_REPLY: 'text-indigo-600 bg-indigo-50 border-indigo-200',
  EMAIL_OPEN: 'text-cyan-600 bg-cyan-50 border-cyan-200',
  WEBSITE_VISIT: 'text-amber-600 bg-amber-50 border-amber-200',
  PRICING_PAGE_VIEW: 'text-orange-600 bg-orange-50 border-orange-200',
  BROCHURE_DOWNLOAD: 'text-teal-600 bg-teal-50 border-teal-200',
  FORM_SUBMISSION: 'text-emerald-600 bg-emerald-50 border-emerald-200',
  OTHER: 'text-slate-600 bg-slate-50 border-slate-200',
};

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

export function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // Lead State
  const [lead, setLead] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  // Activities State
  const [activities, setActivities] = useState([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);

  // New Activity Form State
  const [activityForm, setActivityForm] = useState({
    type: 'CALL',
    description: '',
    occurredAt: new Date().toISOString().slice(0, 16),
  });
  const [activityFormError, setActivityFormError] = useState(null);
  const [activitySubmitting, setActivitySubmitting] = useState(false);

  // Edit Lead Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({});
  const [companies, setCompanies] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [editLoading, setEditLoading] = useState(false);

  // Convert Lead to Deal Modal State (Phase 5)
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [convertFormData, setConvertFormData] = useState({
    title: '',
    value: '',
    currency: 'USD',
    pipelineStageId: '',
    expectedCloseDate: '',
    description: '',
  });
  const [pipelineStages, setPipelineStages] = useState([]);
  const [convertLoading, setConvertLoading] = useState(false);
  const [convertError, setConvertError] = useState(null);

  // Fetch Lead & Activities
  const fetchLeadDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await crmService.getLead(id);
      if (res?.data?.lead) {
        setLead(res.data.lead);
        setActivities(res.data.lead.activities || []);
      }
    } catch (err) {
      setError(err.message || 'Failed to retrieve lead record');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLeadDetails();
  }, [fetchLeadDetails]);

  // Fetch reference data for Edit Modal
  const loadReferenceData = async () => {
    try {
      const compRes = await crmService.getCompanies({ limit: 100 });
      if (compRes?.data?.companies) setCompanies(compRes.data.companies);
      if (isManagement) {
        const uRes = await crmService.getAssignableUsers();
        if (uRes?.data?.users) setUsersList(uRes.data.users);
      }
    } catch {
      // Ignore reference fetch error
    }
  };

  const handleOpenEdit = () => {
    if (!lead) return;
    loadReferenceData();
    setEditFormData({
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      phone: lead.phone || '',
      jobTitle: lead.jobTitle || '',
      status: lead.status || 'NEW',
      priority: lead.priority || 'MEDIUM',
      companyId: lead.companyId || '',
      assignedToId: lead.assignedToId || '',
    });
    setIsEditModalOpen(true);
  };

  const handleOpenConvert = async () => {
    if (!lead) return;
    setIsConvertModalOpen(true);
    setConvertError(null);
    try {
      const res = await crmService.getPipelineStages();
      const stages = res.data?.data?.stages || [];
      setPipelineStages(stages);
      setConvertFormData({
        title: `${lead.firstName} ${lead.lastName} - Opportunity`,
        value: '50000',
        currency: 'USD',
        pipelineStageId: stages[0]?.id || '',
        expectedCloseDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: `Opportunity converted from lead ${lead.firstName} ${lead.lastName}${lead.jobTitle ? ` (${lead.jobTitle})` : ''}`,
      });
    } catch (e) {
      console.warn('Failed to load stages for convert modal:', e);
    }
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertFormData.value || isNaN(Number(convertFormData.value)) || Number(convertFormData.value) < 0) {
      setConvertError('Please enter a valid non-negative deal value');
      return;
    }
    try {
      setConvertLoading(true);
      setConvertError(null);
      await crmService.convertLeadToDeal(lead.id, {
        ...convertFormData,
        value: parseFloat(convertFormData.value),
      });
      setSuccessMessage('Lead successfully converted to commercial opportunity deal!');
      setIsConvertModalOpen(false);
      fetchLeadDetails();
    } catch (err) {
      setConvertError(err.response?.data?.message || err.message || 'Failed to convert lead');
    } finally {
      setConvertLoading(false);
    }
  };

  const handleUpdateLeadSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    try {
      const payload = {
        firstName: editFormData.firstName,
        lastName: editFormData.lastName,
        email: editFormData.email,
        phone: editFormData.phone || null,
        jobTitle: editFormData.jobTitle || null,
        status: editFormData.status,
        priority: editFormData.priority,
        companyId: editFormData.companyId || null,
        ...(isManagement ? { assignedToId: editFormData.assignedToId || null } : {}),
      };
      await crmService.updateLead(id, payload);
      setIsEditModalOpen(false);
      setSuccessMessage('Lead details updated successfully!');
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchLeadDetails();
    } catch (err) {
      alert(err.message || 'Failed to update lead');
    } finally {
      setEditLoading(false);
    }
  };

  // Submit New Activity
  const handleCreateActivity = async (e) => {
    e.preventDefault();
    setActivityFormError(null);
    setActivitySubmitting(true);

    try {
      const payload = {
        type: activityForm.type,
        description: activityForm.description.trim() || null,
        occurredAt: activityForm.occurredAt
          ? new Date(activityForm.occurredAt).toISOString()
          : new Date().toISOString(),
      };

      const res = await crmService.createLeadActivity(id, payload);
      if (res?.data?.activity) {
        setActivities([res.data.activity, ...activities]);
        setActivityForm({
          type: 'CALL',
          description: '',
          occurredAt: new Date().toISOString().slice(0, 16),
        });
        setSuccessMessage('Activity event logged successfully!');
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err) {
      setActivityFormError(err.message || 'Failed to record activity');
    } finally {
      setActivitySubmitting(false);
    }
  };

  // Archive Lead
  const handleArchiveLead = async () => {
    if (!window.confirm('Are you sure you want to archive this lead? Historical activities will be preserved.')) return;
    try {
      await crmService.archiveLead(id);
      navigate('/leads');
    } catch (err) {
      alert(err.message || 'Failed to archive lead');
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-brand-600 mb-3" />
        <p className="text-slate-500 font-medium text-sm">Loading lead file and history...</p>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-2xl mx-auto py-16 text-center space-y-4">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Lead Not Accessible</h2>
        <p className="text-sm text-slate-500">{error || 'Lead could not be loaded.'}</p>
        <div className="pt-2">
          <Link to="/leads">
            <Button variant="outline" size="sm" icon={ArrowLeft}>
              Back to Leads Directory
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link to="/leads">
            <Button variant="outline" size="sm" icon={ArrowLeft}>
              Back
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">
                {lead.firstName} {lead.lastName}
              </h1>
              <Badge variant={STATUS_VARIANTS[lead.status] || 'neutral'}>
                {lead.status}
              </Badge>
              <Badge variant={PRIORITY_VARIANTS[lead.priority] || 'neutral'}>
                {lead.priority} Priority
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {lead.jobTitle ? `${lead.jobTitle} · ` : ''}
              {lead.company ? lead.company.name : 'Individual Prospect'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {lead.status !== 'CONVERTED' ? (
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenConvert}
              icon={Briefcase}
            >
              Convert to Deal
            </Button>
          ) : (
            <Link to="/deals">
              <Button
                variant="outline"
                size="sm"
                icon={Briefcase}
                className="text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100"
              >
                View Deal
              </Button>
            </Link>
          )}
          <Button variant="outline" size="sm" onClick={handleOpenEdit} icon={Edit2}>
            Edit Lead
          </Button>
          {isManagement && (
            <Button
              variant="danger"
              size="sm"
              onClick={handleArchiveLead}
              icon={Trash2}
            >
              Archive
            </Button>
          )}
        </div>
      </div>

      {/* Global Notification */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-emerald-800 text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Intelligence Signals Warning Banner */}
      {(lead.isDuplicate || lead.isSuspicious) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Lead Intelligence Notice</span>
          </div>
          <div className="space-y-1 text-xs text-amber-700">
            {lead.isDuplicate && (
              <p>• Duplicate contact signal detected (email or phone matches another lead in the system).</p>
            )}
            {lead.isSuspicious && (
              <p>• Suspicious contact pattern flagged: {lead.suspiciousReason || 'Flagged for review'}.</p>
            )}
          </div>
        </div>
      )}

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lead Information & Company (1 Col) */}
        <div className="space-y-6 lg:col-span-1">
          {/* Contact Details Card */}
          <Card>
            <CardHeader title="Contact Information" />
            <CardContent className="space-y-3.5 text-sm">
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <span className="text-xs text-slate-400 block">Email Address</span>
                  <a
                    href={`mailto:${lead.email}`}
                    className="font-medium text-slate-900 hover:text-brand-600 truncate block"
                  >
                    {lead.email}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Phone className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 block">Phone Number</span>
                  <span className="font-medium text-slate-900">
                    {lead.phone || <span className="text-slate-400 italic">Not provided</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Briefcase className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 block">Job Title</span>
                  <span className="font-medium text-slate-900">
                    {lead.jobTitle || <span className="text-slate-400 italic">Not provided</span>}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 block">Lead Source</span>
                  <span className="font-medium text-slate-900">{lead.source || 'Manual Entry'}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <span className="text-xs text-slate-400 block">Created On</span>
                  <span className="font-medium text-slate-900">
                    {new Date(lead.createdAt).toLocaleDateString()} at{' '}
                    {new Date(lead.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Lead Score</span>
                <span className="px-2.5 py-0.5 bg-brand-50 text-brand-700 font-bold rounded-lg text-sm border border-brand-200">
                  {lead.score ?? 0}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Company Card */}
          <Card>
            <CardHeader
              title="Company Association"
              action={
                lead.company ? (
                  <Link to="/companies" className="text-xs text-brand-600 hover:underline">
                    View Companies
                  </Link>
                ) : null
              }
            />
            <CardContent className="space-y-3 text-sm">
              {lead.company ? (
                <>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-semibold text-slate-900 text-base">{lead.company.name}</span>
                  </div>
                  {lead.company.industry && (
                    <p className="text-xs text-slate-500">Industry: {lead.company.industry}</p>
                  )}
                  {lead.company.website && (
                    <p className="text-xs">
                      <a
                        href={lead.company.website}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-600 hover:underline truncate block"
                      >
                        {lead.company.website}
                      </a>
                    </p>
                  )}
                  {(lead.company.city || lead.company.country) && (
                    <p className="text-xs text-slate-500">
                      {[lead.company.city, lead.company.country].filter(Boolean).join(', ')}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-400 italic">No company linked to this lead contact.</p>
              )}
            </CardContent>
          </Card>

          {/* Assigned Salesperson Card */}
          <Card>
            <CardHeader title="Sales Assignment" />
            <CardContent className="text-sm">
              {lead.assignedTo ? (
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-xs">
                    {lead.assignedTo.firstName?.[0] || 'U'}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{lead.assignedTo.email}</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">Currently unassigned to any sales representative.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Activity Timeline & Logging (2 Cols) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Log Activity Form Card */}
          <Card>
            <CardHeader title="Log Engagement Activity" description="Record customer conversations, meetings, and key touchpoints." />
            <CardContent>
              <form onSubmit={handleCreateActivity} className="space-y-4">
                {activityFormError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                    {activityFormError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Activity Type</label>
                    <select
                      value={activityForm.type}
                      onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                    >
                      <option value="CALL">Call</option>
                      <option value="MEETING">Meeting</option>
                      <option value="DEMO_REQUEST">Demo Session</option>
                      <option value="EMAIL_REPLY">Email Reply</option>
                      <option value="EMAIL_OPEN">Email Sent / Outreach</option>
                      <option value="FORM_SUBMISSION">Form Submission</option>
                      <option value="WEBSITE_VISIT">Website Visit</option>
                      <option value="OTHER">Other Interaction</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Occurred At</label>
                    <input
                      type="datetime-local"
                      value={activityForm.occurredAt}
                      onChange={(e) => setActivityForm({ ...activityForm, occurredAt: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Notes / Description</label>
                  <textarea
                    rows={3}
                    placeholder="Enter conversation notes, client feedback, or outcome..."
                    value={activityForm.description}
                    onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end">
                  <Button type="submit" variant="primary" size="sm" disabled={activitySubmitting} icon={Plus}>
                    {activitySubmitting ? 'Recording...' : 'Log Activity'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Activity Timeline Card */}
          <Card>
            <CardHeader
              title="Engagement Timeline"
              description={`Chronological record of ${activities.length} interactions`}
            />
            <CardContent>
              {activities.length === 0 ? (
                <div className="py-10 text-center">
                  <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-slate-500 text-sm font-medium">No activity recorded yet</p>
                  <p className="text-xs text-slate-400 mt-1">Log a call, email, or meeting above to begin the timeline.</p>
                </div>
              ) : (
                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {activities.map((act) => {
                    const Icon = ACTIVITY_ICONS[act.type] || Activity;
                    const colorClass = ACTIVITY_COLORS[act.type] || ACTIVITY_COLORS.OTHER;
                    const dateObj = new Date(act.occurredAt);

                    return (
                      <div key={act.id} className="relative group">
                        {/* Timeline Icon Node */}
                        <div
                          className={`absolute -left-6 top-1 w-5 h-5 rounded-full border flex items-center justify-center ${colorClass}`}
                        >
                          <Icon className="w-2.5 h-2.5" />
                        </div>

                        {/* Timeline Content */}
                        <div className="bg-slate-50/60 p-4 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 text-xs tracking-wide">
                                {act.type.replace('_', ' ')}
                              </span>
                              {act.createdBy && (
                                <span className="text-[11px] text-slate-500">
                                  by {act.createdBy.firstName} {act.createdBy.lastName}
                                </span>
                              )}
                            </div>
                            <time className="text-[11px] text-slate-400 font-mono">
                              {dateObj.toLocaleDateString()} {dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </time>
                          </div>

                          {act.description ? (
                            <p className="text-xs text-slate-700 mt-2 leading-relaxed whitespace-pre-wrap">
                              {act.description}
                            </p>
                          ) : (
                            <p className="text-xs text-slate-400 italic mt-1">No notes recorded.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Lead Modal */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Edit Lead Record</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateLeadSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.firstName}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editFormData.lastName}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={editFormData.email}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
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
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="LOW">LOW</option>
                    <option value="MEDIUM">MEDIUM</option>
                    <option value="HIGH">HIGH</option>
                    <option value="URGENT">URGENT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                <select
                  value={editFormData.companyId}
                  onChange={(e) => setEditFormData({ ...editFormData, companyId: e.target.value })}
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

              {isManagement && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Salesperson</label>
                  <select
                    value={editFormData.assignedToId}
                    onChange={(e) => setEditFormData({ ...editFormData, assignedToId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
                  >
                    <option value="">-- Unassigned --</option>
                    {usersList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={editLoading}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Convert Lead to Deal Modal (Phase 5) */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-brand-600" />
                <h3 className="font-bold text-slate-900 text-base">Convert Lead to Opportunity</h3>
              </div>
              <button
                onClick={() => setIsConvertModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConvertSubmit}>
              <div className="p-6 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto">
                {convertError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{convertError}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Deal Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={convertFormData.title}
                    onChange={(e) => setConvertFormData({ ...convertFormData, title: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Estimated Deal Value ($) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={convertFormData.value}
                      onChange={(e) => setConvertFormData({ ...convertFormData, value: e.target.value })}
                      className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Currency
                    </label>
                    <select
                      value={convertFormData.currency}
                      onChange={(e) => setConvertFormData({ ...convertFormData, currency: e.target.value })}
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
                    Target Pipeline Stage *
                  </label>
                  <select
                    value={convertFormData.pipelineStageId}
                    onChange={(e) => setConvertFormData({ ...convertFormData, pipelineStageId: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  >
                    {pipelineStages.map((stg) => (
                      <option key={stg.id} value={stg.id}>
                        {stg.name} ({stg.probability}%)
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
                    value={convertFormData.expectedCloseDate}
                    onChange={(e) => setConvertFormData({ ...convertFormData, expectedCloseDate: e.target.value })}
                    className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Description & Deal Scope
                  </label>
                  <textarea
                    rows={2}
                    value={convertFormData.description}
                    onChange={(e) => setConvertFormData({ ...convertFormData, description: e.target.value })}
                    className="w-full text-xs border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-brand-500 focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                  <p className="font-semibold">Conversion Effects:</p>
                  <p className="mt-0.5">• Lead status will automatically be set to <span className="font-bold">CONVERTED</span>.</p>
                  <p>• A new deal opportunity will be created in the selected pipeline stage.</p>
                  <p>• Initial stage transition history and audit logs will be permanently recorded.</p>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsConvertModalOpen(false)}
                  disabled={convertLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={convertLoading}
                >
                  {convertLoading ? 'Converting...' : 'Convert to Deal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeadDetailPage;
