import React, { useEffect, useState } from 'react';
import { ToggleLeft, ToggleRight, UserPlus, Check, X, Clock, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { LoadingSpinner, PageHeader, Modal } from '../../components/shared';
import { formatDate } from '../../utils/helpers';
import toast from 'react-hot-toast';
import { TablePageSkeleton } from '../../components/shared/Skeletons';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');
  const [pendingOnly, setPendingOnly] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '', role: 'client' });
  const [actingOn, setActingOn] = useState(null); // user id currently being approved/rejected
  const [deletingUser, setDeletingUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetch = async () => {
    const params = roleFilter !== 'all' ? { role: roleFilter } : {};
    const { data } = await api.get('/users', { params });
    setUsers(data.users); setLoading(false);
  };
  useEffect(() => { fetch(); }, [roleFilter]);

  const create = async (e) => {
    e.preventDefault();
    try {
      await api.post('/users', form);
      toast.success('User created!');
      setShowModal(false); fetch();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  // Previously this had no error handling, so any failure (wrong route/method,
  // 403, 404, 500) was swallowed and the button just looked like it did nothing.
  const toggle = async (user) => {
    setActingOn(user._id);
    try {
      await api.put(`/users/${user._id}/toggle-status`);
      toast.success(user.isActive ? 'Account deactivated' : 'Account activated');
      await fetch();
    } catch (err) {
      console.error('toggle-status failed:', err.response?.status, err.response?.data || err.message);
      toast.error(err.response?.data?.message || `Failed to update account (${err.response?.status || 'network error'})`);
    } finally {
      setActingOn(null);
    }
  };

  const decide = async (id, approve) => {
    setActingOn(id);
    try {
      await api.put(`/auth/approve/${id}`, { approve });
      toast.success(approve ? 'Freelancer approved' : 'Freelancer rejected');
      fetch();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setActingOn(null);
    }
  };

  const confirmDelete = async () => {
    if (!deletingUser) return;
    setDeleting(true);
    try {
      await api.delete(`/users/${deletingUser._id}`);
      toast.success('User deleted');
      setDeletingUser(null);
      await fetch();
    } catch (err) {
      console.error('delete user failed:', err.response?.status, err.response?.data || err.message);
      toast.error(err.response?.data?.message || `Failed to delete user (${err.response?.status || 'network error'})`);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <TablePageSkeleton />;

  const pendingCount = users.filter(u => u.role === 'freelancer' && u.accountStatus === 'pending').length;
  const displayedUsers = pendingOnly
    ? users.filter(u => u.role === 'freelancer' && u.accountStatus === 'pending')
    : users;

  return (
    <div className="space-y-5 animate-fade-in">
      <PageHeader title="Users" subtitle={`${displayedUsers.length} users`}
        action={
          <button onClick={() => setShowModal(true)} className="btn-primary w-full sm:w-auto justify-center">
            <UserPlus className="w-4 h-4" /> <span className="sm:hidden">Add</span><span className="hidden sm:inline">Add User</span>
          </button>
        } />

      {pendingCount > 0 && !pendingOnly && (
        <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-yellow-500/10 border-yellow-500/20">
          <div className="flex items-center gap-2 text-yellow-400 text-sm font-medium">
            <Clock className="w-4 h-4 flex-shrink-0" />
            {pendingCount} freelancer{pendingCount > 1 ? 's' : ''} waiting for approval
          </div>
          <button onClick={() => { setRoleFilter('freelancer'); setPendingOnly(true); }}
            className="text-yellow-400 text-sm font-semibold hover:text-yellow-300 transition-colors flex-shrink-0">
            Review →
          </button>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
        {['all','admin','client','freelancer'].map(r => (
          <button key={r} onClick={() => setRoleFilter(r)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors whitespace-nowrap flex-shrink-0 ${roleFilter === r ? 'bg-primary text-white' : 'bg-white/10 text-white/60 hover:text-white'}`}>
            {r}
          </button>
        ))}
        <button onClick={() => setPendingOnly(p => !p)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${pendingOnly ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-white/60 hover:text-white'}`}>
          Pending Approval{pendingCount > 0 ? ` (${pendingCount})` : ''}
        </button>
      </div>

      {/* Mobile: card list */}
      <div className="md:hidden space-y-3">
        {displayedUsers.map(u => {
          const isPending = u.role === 'freelancer' && u.accountStatus === 'pending';
          const isRejected = u.role === 'freelancer' && u.accountStatus === 'rejected';
          return (
            <div key={u._id} className="card space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">{u.name[0]}</div>
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{u.name}</p>
                    <p className="text-white/50 text-xs truncate">{u.email}</p>
                  </div>
                </div>
                <span className={`badge capitalize text-xs flex-shrink-0 ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : u.role === 'freelancer' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>{u.role}</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/50">{u.phone || '—'}</span>
                <span className="text-white/40">{formatDate(u.createdAt)}</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                {isPending ? (
                  <span className="badge bg-yellow-500/20 text-yellow-400 text-xs">Pending Approval</span>
                ) : isRejected ? (
                  <span className="badge bg-red-500/20 text-red-400 text-xs">Rejected</span>
                ) : (
                  <span className={`badge text-xs ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                )}

                <div className="flex items-center gap-4">
                {isPending ? (
                  <div className="flex items-center gap-3">
                    <button onClick={() => decide(u._id, true)} disabled={actingOn === u._id}
                      className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-40" title="Approve">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => decide(u._id, false)} disabled={actingOn === u._id}
                      className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-40" title="Reject">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => toggle(u)} disabled={actingOn === u._id}
                    title={u.isActive ? 'Deactivate account' : 'Activate account'}
                    className="text-white/40 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-wait">
                    {u.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                  </button>
                )}
                <button onClick={() => setDeletingUser(u)} disabled={actingOn === u._id}
                  className="text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                  title="Delete user" aria-label="Delete user">
                  <Trash2 className="w-4 h-4" />
                </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop/tablet: table */}
      <div className="hidden md:block card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-white/40 text-xs border-b border-white/10">
              {['Name','Email','Role','Phone','Joined','Status','Actions'].map(h => (
                <th key={h} className="text-left py-3 pr-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayedUsers.map(u => {
              const isPending = u.role === 'freelancer' && u.accountStatus === 'pending';
              const isRejected = u.role === 'freelancer' && u.accountStatus === 'rejected';
              return (
                <tr key={u._id} className="table-row">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">{u.name[0]}</div>
                      <span className="text-white font-medium">{u.name}</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-white/60">{u.email}</td>
                  <td className="py-3 pr-4"><span className={`badge capitalize ${u.role === 'admin' ? 'bg-purple-500/20 text-purple-400' : u.role === 'freelancer' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'}`}>{u.role}</span></td>
                  <td className="py-3 pr-4 text-white/50">{u.phone || '—'}</td>
                  <td className="py-3 pr-4 text-white/40 text-xs">{formatDate(u.createdAt)}</td>
                  <td className="py-3 pr-4">
                    {isPending ? (
                      <span className="badge bg-yellow-500/20 text-yellow-400">Pending Approval</span>
                    ) : isRejected ? (
                      <span className="badge bg-red-500/20 text-red-400">Rejected</span>
                    ) : (
                      <span className={`badge ${u.isActive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>{u.isActive ? 'Active' : 'Inactive'}</span>
                    )}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-4">
                    {isPending ? (
                      <div className="flex items-center gap-3">
                        <button onClick={() => decide(u._id, true)} disabled={actingOn === u._id}
                          className="text-green-400 hover:text-green-300 transition-colors disabled:opacity-40" title="Approve">
                          <Check className="w-5 h-5" />
                        </button>
                        <button onClick={() => decide(u._id, false)} disabled={actingOn === u._id}
                          className="text-red-400 hover:text-red-300 transition-colors disabled:opacity-40" title="Reject">
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => toggle(u)} disabled={actingOn === u._id}
                    title={u.isActive ? 'Deactivate account' : 'Activate account'}
                    className="text-white/40 hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-wait">
                        {u.isActive ? <ToggleRight className="w-5 h-5 text-green-400" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                    )}
                    <button onClick={() => setDeletingUser(u)} disabled={actingOn === u._id}
                      className="text-red-400/70 hover:text-red-400 transition-colors disabled:opacity-40"
                      title="Delete user" aria-label="Delete user">
                      <Trash2 className="w-4 h-4" />
                    </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!deletingUser} onClose={() => !deleting && setDeletingUser(null)} title="Delete User">
        <div className="space-y-4">
          <p className="text-white/60 text-sm">
            Permanently delete <span className="text-white font-medium">{deletingUser?.name}</span>
            {deletingUser?.email ? <span className="text-white/40"> ({deletingUser.email})</span> : null}?
            They'll lose access immediately and this can't be undone. If you only want to block sign-in, use the deactivate toggle instead.
          </p>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="button" onClick={() => setDeletingUser(null)} disabled={deleting} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={deleting}
              className="btn-primary flex-1 justify-center bg-red-500/90 hover:bg-red-500 disabled:opacity-50">
              {deleting ? 'Deleting...' : 'Delete User'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create User">
        <form onSubmit={create} className="space-y-4">
          <div><label className="label">Full Name</label><input className="input" value={form.name} onChange={e => setForm({...form,name:e.target.value})} required /></div>
          <div><label className="label">Email</label><input type="email" className="input" value={form.email} onChange={e => setForm({...form,email:e.target.value})} required /></div>
          <div><label className="label">Password</label><input type="password" className="input" value={form.password} onChange={e => setForm({...form,password:e.target.value})} required /></div>
          <div><label className="label">Phone</label><input className="input" value={form.phone} onChange={e => setForm({...form,phone:e.target.value})} /></div>
          <div><label className="label">Role</label>
            <select className="input" value={form.role} onChange={e => setForm({...form,role:e.target.value})}>
              <option value="client" className="bg-[#1a1a2e] text-white">Client</option>
              <option value="freelancer" className="bg-[#1a1a2e] text-white">Freelancer</option>
              <option value="admin" className="bg-[#1a1a2e] text-white">Admin</option>
            </select>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button type="submit" className="btn-primary flex-1 justify-center">Create User</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}