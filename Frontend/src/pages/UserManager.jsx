import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineUsers, HiOutlineKey, HiOutlineShieldCheck,
} from 'react-icons/hi';

const useSidebarNav = (navigate) => (tab) => {
    const routes = {
        'events': '/admin/events', 'social-trends': '/admin/social-trends',
        'experts': '/admin/experts', 'media': '/admin/media',
        'analytical-articles': '/admin/analytical-articles',
        'users': '/admin/users', 'airlines': '/admin/airlines',
        'submissions': '/editor-dashboard',
    };
    if (routes[tab]) navigate(routes[tab]);
};

const ROLE_COLORS = {
    JOURNALIST: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    EDITOR:     'bg-accent/10 border-accent/20 text-accent',
    ADMIN:      'bg-orange-500/10 border-orange-500/20 text-orange-400',
};

// ── Create User Modal ─────────────────────────────────────────────────────────
const CreateUserModal = ({ onClose, onSaved }) => {
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'JOURNALIST' });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.post('/cms/users', form);
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Failed to create user.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">Add User</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {[
                        { label: 'Full Name', name: 'name', type: 'text', required: true },
                        { label: 'Email', name: 'email', type: 'email', required: true },
                        { label: 'Temporary Password', name: 'password', type: 'password', required: true },
                    ].map(f => (
                        <div key={f.name}>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">{f.label}</label>
                            <input type={f.type} required={f.required} value={form[f.name] || ''}
                                onChange={e => set(f.name, e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                        </div>
                    ))}
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Role</label>
                        <div className="flex gap-2">
                            {['JOURNALIST', 'EDITOR'].map(r => (
                                <button key={r} type="button" onClick={() => set('role', r)}
                                    className={`flex-1 py-2 rounded-xl border text-xs font-bold transition-all ${form.role === r ? ROLE_COLORS[r] : 'border-border text-text-tertiary'}`}>
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60">
                            {saving ? 'Creating…' : 'Create User'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Reset Password Modal ──────────────────────────────────────────────────────
const ResetPasswordModal = ({ user, onClose }) => {
    const [newPassword, setNewPassword] = useState('');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (newPassword.length < 8) { alert('Password must be at least 8 characters.'); return; }
        setSaving(true);
        try {
            await api.post(`/cms/users/${user.id}/reset-password`, { newPassword });
            alert(`Password reset for ${user.name}.`);
            onClose();
        } catch (err) { alert(err.response?.data?.message || 'Reset failed.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">Reset Password</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <p className="text-text-secondary text-sm">Setting new password for <strong className="text-text-primary">{user.name}</strong></p>
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">New Password</label>
                        <input type="password" required minLength={8} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60">
                            {saving ? 'Resetting…' : 'Reset Password'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── User Manager ──────────────────────────────────────────────────────────────
const UserManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [createModal, setCreateModal] = useState(false);
    const [resetModal, setResetModal] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cms/users');
            setUsers(res.data);
        } catch { setUsers([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const changeRole = async (user, newRole) => {
        if (!confirm(`Change ${user.name}'s role to ${newRole}?`)) return;
        try {
            const res = await api.put(`/cms/users/${user.id}/role`, { role: newRole });
            setUsers(us => us.map(u => u.id === user.id ? { ...u, ...res.data } : u));
        } catch (err) { alert(err.response?.data?.message || 'Failed to change role.'); }
    };

    const deleteUser = async (id, name) => {
        if (!confirm(`Permanently delete user "${name}"? All their staged articles will remain.`)) return;
        try {
            await api.delete(`/cms/users/${id}`);
            setUsers(us => us.filter(u => u.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="users" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">CMS Users</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage journalist and editor accounts</p>
                        </div>
                        <button onClick={() => setCreateModal(true)}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add User
                        </button>
                    </div>

                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-20 text-text-tertiary">No users found.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {users.map(u => (
                                    <div key={u.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
                                        <div className="w-9 h-9 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                                            <span className="text-accent text-sm font-bold uppercase">{u.name?.[0] || '?'}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-text-primary font-semibold text-sm">{u.name}</p>
                                                <span className={`px-2 py-0.5 rounded-full border text-xs font-bold ${ROLE_COLORS[u.role]}`}>{u.role}</span>
                                            </div>
                                            <p className="text-text-tertiary text-xs mt-0.5">{u.email}</p>
                                            <p className="text-text-tertiary text-xs">Joined {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {/* Role toggle */}
                                            {u.role !== 'ADMIN' && (
                                                <select
                                                    value={u.role}
                                                    onChange={e => changeRole(u, e.target.value)}
                                                    onClick={e => e.stopPropagation()}
                                                    className="px-2 py-1.5 rounded-lg border border-border bg-bg-primary text-text-secondary text-xs focus:outline-none focus:border-accent transition-all">
                                                    <option value="JOURNALIST">Journalist</option>
                                                    <option value="EDITOR">Editor</option>
                                                </select>
                                            )}
                                            <button onClick={() => setResetModal(u)} title="Reset Password"
                                                className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all">
                                                <HiOutlineKey className="w-4 h-4" />
                                            </button>
                                            {u.role !== 'ADMIN' && (
                                                <button onClick={() => deleteUser(u.id, u.name)} title="Delete User"
                                                    className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all">
                                                    <HiOutlineTrash className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {createModal && <CreateUserModal onClose={() => setCreateModal(false)} onSaved={load} />}
            {resetModal && <ResetPasswordModal user={resetModal} onClose={() => setResetModal(null)} />}
        </div>
    );
};

export default UserManager;
