import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
  Edit2,
  Users,
  Briefcase,
  Mail,
  Phone,
  Globe,
  MapPin,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { crmService } from '../services/crm';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card, CardContent } from '../components/common/Card';

export function CompaniesPage() {
  const { user } = useAuth();
  const isManagement = user?.role === 'ADMIN' || user?.role === 'SALES_MANAGER';

  // State
  const [companies, setCompanies] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [search, setSearch] = useState('');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    industry: '',
    website: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [formLoading, setFormLoading] = useState(false);

  // Fetch Companies
  const fetchCompanies = useCallback(
    async (page = 1) => {
      setLoading(true);
      setError(null);
      try {
        const res = await crmService.getCompanies({
          page,
          limit: pagination.limit,
          search: search.trim() || undefined,
        });
        if (res?.data) {
          setCompanies(res.data.companies || []);
          setPagination(res.data.pagination || { page: 1, limit: 10, total: 0, totalPages: 1 });
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch companies');
      } finally {
        setLoading(false);
      }
    },
    [search, pagination.limit]
  );

  useEffect(() => {
    fetchCompanies(1);
  }, [fetchCompanies]);

  // Open Add Modal
  const handleOpenAddModal = () => {
    setFormData({
      name: '',
      industry: '',
      website: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      country: '',
    });
    setFormErrors({});
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (company) => {
    setSelectedCompany(company);
    setFormData({
      name: company.name || '',
      industry: company.industry || '',
      website: company.website || '',
      phone: company.phone || '',
      email: company.email || '',
      address: company.address || '',
      city: company.city || '',
      country: company.country || '',
    });
    setFormErrors({});
    setIsEditModalOpen(true);
  };

  // Open View Details Drawer
  const handleViewDetails = async (company) => {
    setSelectedCompany(company);
    setIsDetailModalOpen(true);
    setDetailLoading(true);
    try {
      const res = await crmService.getCompany(company.id);
      if (res?.data?.company) {
        setSelectedCompany(res.data.company);
      }
    } catch {
      // Keep basic data
    } finally {
      setDetailLoading(false);
    }
  };

  // Create Company Submit
  const handleCreateCompany = async (e) => {
    e.preventDefault();
    setFormErrors({});
    setFormLoading(true);
    try {
      await crmService.createCompany(formData);
      setIsAddModalOpen(false);
      setSuccessMessage(`Company "${formData.name}" added successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCompanies(pagination.page);
    } catch (err) {
      if (err.status === 409) {
        setFormErrors({ name: err.message });
      } else if (err.errors) {
        setFormErrors(err.errors);
      } else {
        setFormErrors({ general: err.message || 'Failed to create company' });
      }
    } finally {
      setFormLoading(false);
    }
  };

  // Update Company Submit
  const handleUpdateCompany = async (e) => {
    e.preventDefault();
    if (!selectedCompany) return;
    setFormErrors({});
    setFormLoading(true);
    try {
      await crmService.updateCompany(selectedCompany.id, formData);
      setIsEditModalOpen(false);
      setSuccessMessage(`Company "${formData.name}" updated successfully!`);
      setTimeout(() => setSuccessMessage(null), 4000);
      fetchCompanies(pagination.page);
    } catch (err) {
      if (err.errors) {
        setFormErrors(err.errors);
      } else {
        setFormErrors({ general: err.message || 'Failed to update company' });
      }
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
            <h1 className="text-2xl font-bold text-slate-900">Companies Directory</h1>
            <Badge variant="primary" className="text-xs">
              Phase 4 Core
            </Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage target accounts, corporate relationships, and organizational contacts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchCompanies(pagination.page)}
            disabled={loading}
            icon={RefreshCw}
          >
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={handleOpenAddModal} icon={Plus}>
            Add Company
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

      {/* Search Input */}
      <Card>
        <CardContent className="p-4">
          <div className="relative max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search companies by name, industry, or city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Companies Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-700">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 font-semibold">Company Name</th>
                <th className="px-6 py-3 font-semibold">Industry</th>
                <th className="px-6 py-3 font-semibold">Website</th>
                <th className="px-6 py-3 font-semibold">Location</th>
                <th className="px-6 py-3 font-semibold text-center">Active Leads</th>
                <th className="px-6 py-3 font-semibold text-center">Deals</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                    Loading companies...
                  </td>
                </tr>
              ) : companies.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center">
                    <Building2 className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="text-slate-600 font-medium">No companies found</p>
                    <p className="text-xs text-slate-400 mt-1">Add account organizations to link your leads.</p>
                    <div className="mt-4">
                      <Button size="sm" onClick={handleOpenAddModal} icon={Plus}>
                        Add Company
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                companies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Name */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold text-xs shrink-0">
                          {c.name?.[0] || 'C'}
                        </div>
                        <div>
                          <button
                            onClick={() => handleViewDetails(c)}
                            className="font-semibold text-slate-900 hover:text-brand-600 text-left"
                          >
                            {c.name}
                          </button>
                          {c.email && (
                            <span className="text-xs text-slate-400 block">{c.email}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Industry */}
                    <td className="px-6 py-4">
                      {c.industry ? (
                        <Badge variant="neutral" className="text-xs">
                          {c.industry}
                        </Badge>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Not set</span>
                      )}
                    </td>

                    {/* Website */}
                    <td className="px-6 py-4">
                      {c.website ? (
                        <a
                          href={c.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-600 hover:underline flex items-center gap-1 text-xs truncate max-w-[150px]"
                        >
                          <Globe className="w-3 h-3 shrink-0" />
                          <span>{c.website.replace(/^https?:\/\//, '')}</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Location */}
                    <td className="px-6 py-4">
                      {c.city || c.country ? (
                        <div className="flex items-center gap-1 text-xs text-slate-600">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{[c.city, c.country].filter(Boolean).join(', ')}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">-</span>
                      )}
                    </td>

                    {/* Leads count */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <Users className="w-3 h-3" />
                        {c._count?.leads ?? 0}
                      </span>
                    </td>

                    {/* Deals count */}
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                        <Briefcase className="w-3 h-3" />
                        {c._count?.deals ?? 0}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(c)}
                          title="View Company Details"
                          icon={ExternalLink}
                        >
                          Details
                        </Button>
                        {isManagement && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditModal(c)}
                            title="Edit Company"
                            icon={Edit2}
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
              of <span className="font-semibold">{pagination.total}</span> companies
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchCompanies(pagination.page - 1)}
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
                onClick={() => fetchCompanies(pagination.page + 1)}
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
      {/* ADD COMPANY MODAL */}
      {/* ======================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Add Company</h3>
                <p className="text-xs text-slate-500 mt-0.5">Create a new corporate account record.</p>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCompany} className="p-6 space-y-4">
              {formErrors.general && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {formErrors.general}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Company Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="e.g. Apex Global Enterprises"
                />
                {formErrors.name && <p className="text-xs text-rose-600 mt-1">{formErrors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="e.g. Fintech"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="https://example.com"
                  />
                  {formErrors.website && <p className="text-xs text-rose-600 mt-1">{formErrors.website}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="contact@example.com"
                  />
                  {formErrors.email && <p className="text-xs text-rose-600 mt-1">{formErrors.email}</p>}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="+1 555 0192"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="San Francisco"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    placeholder="United States"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Create Company'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT COMPANY MODAL */}
      {/* ======================================================== */}
      {isEditModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit Company: {selectedCompany.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Update corporate account details.</p>
              </div>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateCompany} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Website</label>
                  <input
                    type="text"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={formLoading}>
                  {formLoading ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* COMPANY DETAIL & ASSOCIATED LEADS MODAL */}
      {/* ======================================================== */}
      {isDetailModalOpen && selectedCompany && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedCompany.name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{selectedCompany.industry || 'Account Overview'}</p>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {detailLoading ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-brand-600" />
                  Loading company details and leads...
                </div>
              ) : (
                <>
                  {/* Company Summary Info */}
                  <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                      <span className="text-slate-400 block">Website</span>
                      <span className="font-medium text-slate-800">
                        {selectedCompany.website || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Contact Email</span>
                      <span className="font-medium text-slate-800">
                        {selectedCompany.email || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Phone</span>
                      <span className="font-medium text-slate-800">
                        {selectedCompany.phone || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Location</span>
                      <span className="font-medium text-slate-800">
                        {[selectedCompany.city, selectedCompany.country].filter(Boolean).join(', ') || '-'}
                      </span>
                    </div>
                  </div>

                  {/* Associated Leads Section */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-600" />
                      Associated Active Leads ({selectedCompany.leads?.length || 0})
                    </h4>

                    {selectedCompany.leads?.length === 0 ? (
                      <p className="text-xs text-slate-400 italic bg-slate-50/50 p-4 rounded-lg text-center">
                        No active leads are currently linked to this company.
                      </p>
                    ) : (
                      <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                        {selectedCompany.leads?.map((l) => (
                          <div key={l.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                            <div>
                              <p className="text-xs font-semibold text-slate-900">
                                {l.firstName} {l.lastName}
                              </p>
                              <p className="text-[11px] text-slate-500">{l.email}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="primary" className="text-[10px]">
                                {l.status}
                              </Badge>
                              <Link
                                to={`/leads/${l.id}`}
                                onClick={() => setIsDetailModalOpen(false)}
                                className="text-brand-600 hover:text-brand-800 text-xs font-medium flex items-center gap-1"
                              >
                                View <ExternalLink className="w-3 h-3" />
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <div className="pt-2 flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setIsDetailModalOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CompaniesPage;
