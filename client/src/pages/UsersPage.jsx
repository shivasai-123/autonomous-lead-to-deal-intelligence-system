import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth';
import { Users, Shield, RefreshCw, CheckCircle, XCircle, Search, AlertCircle } from 'lucide-react';
import { Card, CardHeader, CardContent } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

export function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionMessage, setActionMessage] = useState(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (roleFilter) params.role = roleFilter;
      const res = await authService.listUsers(params);
      setUsers(res?.data?.users || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch user directory');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleToggleStatus = async (targetUser) => {
    if (targetUser.id === currentUser?.id) {
      alert('You cannot deactivate your own administrative account.');
      return;
    }
    try {
      await authService.updateUserStatus(targetUser.id, !targetUser.isActive);
      setActionMessage(`Updated status for ${targetUser.firstName} ${targetUser.lastName}`);
      fetchUsers();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update user status');
    }
  };

  const handleChangeRole = async (targetUser, newRole) => {
    if (targetUser.id === currentUser?.id && newRole !== 'ADMIN') {
      alert('You cannot demote your own administrative account.');
      return;
    }
    try {
      await authService.updateUserRole(targetUser.id, newRole);
      setActionMessage(`Updated role for ${targetUser.firstName} to ${newRole}`);
      fetchUsers();
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to update user role');
    }
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

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">User Administration</h1>
            <Badge variant="primary">Phase 3</Badge>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Manage system access, team roles, and account statuses
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchUsers}
          disabled={loading}
          icon={RefreshCw}
          className={loading ? 'animate-spin' : ''}
        >
          {loading ? 'Refreshing...' : 'Refresh List'}
        </Button>
      </div>

      {actionMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{actionMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div className="w-full sm:w-48">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="w-full px-3 py-1.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 bg-white"
            >
              <option value="">All Roles</option>
              <option value="ADMIN">Admin</option>
              <option value="SALES_MANAGER">Sales Manager</option>
              <option value="SALES_REPRESENTATIVE">Sales Representative</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader
          title="Team Directory"
          description={`Showing ${users.length} registered system accounts`}
        />
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-3">User</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3">Created</th>
                {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="px-6 py-8 text-center text-slate-400">
                    No users matching criteria.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {u.firstName} {u.lastName}
                        {u.id === currentUser?.id && (
                          <span className="ml-2 text-[10px] text-brand-600 font-semibold bg-brand-50 px-1.5 py-0.5 rounded">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">{u.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      {isAdmin && u.id !== currentUser?.id ? (
                        <select
                          value={u.role}
                          onChange={(e) => handleChangeRole(u, e.target.value)}
                          className="text-xs font-semibold px-2 py-1 rounded border border-slate-300 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="ADMIN">ADMIN</option>
                          <option value="SALES_MANAGER">SALES_MANAGER</option>
                          <option value="SALES_REPRESENTATIVE">SALES_REPRESENTATIVE</option>
                        </select>
                      ) : (
                        <Badge variant={getRoleVariant(u.role)}>
                          {u.role.replace('_', ' ')}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {u.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-medium">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-rose-700 font-medium">
                          <XCircle className="w-3.5 h-3.5 text-rose-500" /> Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    {isAdmin && (
                      <td className="px-6 py-4 text-right">
                        {u.id !== currentUser?.id && (
                          <Button
                            variant={u.isActive ? 'outline' : 'secondary'}
                            size="sm"
                            className="text-xs"
                            onClick={() => handleToggleStatus(u)}
                          >
                            {u.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

export default UsersPage;
