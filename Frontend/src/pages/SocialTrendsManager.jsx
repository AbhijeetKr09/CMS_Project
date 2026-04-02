import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineLink, HiOutlineHeart, HiOutlineEye,
} from 'react-icons/hi';

const PLATFORMS = ['linkedin', 'twitter', 'youtube'];
const PLATFORM_COLORS = { linkedin: 'bg-blue-600/10 border-blue-600/20 text-blue-400', twitter: 'bg-sky-500/10 border-sky-500/20 text-sky-400', youtube: 'bg-red-500/10 border-red-500/20 text-red-400' };

const useSidebarNav = (navigate) => (tab) => {
    const routes = {
        'events': '/admin/events', 'social-trends': '/admin/social-trends',
        'experts': '/admin/experts', 'media': '/admin/media',
        'analytical-articles': '/admin/analytical-articles',
        'users': '/admin/users', 'airlines': '/admin/airlines',
        'submissions': '/editor-dashboard', 'published': '/editor-dashboard',
    };
    if (routes[tab]) navigate(routes[tab]);
};

const EMPTY_FORM = { platform: 'linkedin', content: '', url: '', imageUrl: '', author: '', likes: '', isActive: true, date: '' };

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
    <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full border-none transition-all ${checked ? 'bg-accent' : 'bg-bg-primary border border-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
);

// ── Trend Form Field ─────────────────────────────────────────────────────────
const FormField = ({ label, name, type = 'text', placeholder, formData, onChange, ...rest }) => (
    <div>
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">{label}</label>
        <input type={type} value={formData[name] || ''} onChange={e => onChange(name, e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" {...rest} />
    </div>
);

// ── Trend Form Modal ──────────────────────────────────────────────────────────
const TrendModal = ({ trend, onClose, onSaved }) => {
    const [form, setForm] = useState(trend ? {
        ...trend, date: trend.date ? new Date(trend.date).toISOString().slice(0, 10) : '',
    } : { ...EMPTY_FORM, date: new Date().toISOString().slice(0, 10) });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (trend?.id) await api.put(`/cms/social-trends/${trend.id}`, form);
            else await api.post('/cms/social-trends', form);
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
        finally { setSaving(false); }
    };



    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-lg">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">{trend ? 'Edit Trend' : 'New Social Trend'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Platform *</label>
                        <div className="flex gap-2">
                            {PLATFORMS.map(p => (
                                <button key={p} type="button" onClick={() => set('platform', p)}
                                    className={`flex-1 py-2 rounded-xl border text-xs font-bold capitalize transition-all ${form.platform === p ? PLATFORM_COLORS[p] : 'border-border text-text-tertiary hover:border-border/60'}`}>
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Content / Title</label>
                        <textarea value={form.content || ''} onChange={e => set('content', e.target.value)} rows={3}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" />
                    </div>
                    <FormField formData={form} onChange={set} label="URL (post link) *" name="url" type="url" />
                    <FormField formData={form} onChange={set} label="Author / Channel" name="author" />
                    <FormField formData={form} onChange={set} label="Image URL (thumbnail)" name="imageUrl" type="url" />
                    <div className="grid grid-cols-2 gap-4">
                        <FormField formData={form} onChange={set} label="Likes (e.g. 25k)" name="likes" placeholder="25k" />
                        <FormField formData={form} onChange={set} label="Date" name="date" type="date" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Toggle checked={form.isActive} onChange={v => set('isActive', v)} />
                        <span className="text-sm text-text-secondary">{form.isActive ? 'Active (shown on site)' : 'Inactive (hidden)'}</span>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold transition-all">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold transition-all disabled:opacity-60">
                            {saving ? 'Saving…' : trend ? 'Save Changes' : 'Create Trend'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Social Trends Manager ─────────────────────────────────────────────────────
const SocialTrendsManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [trends, setTrends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [platform, setPlatform] = useState('');
    const [modal, setModal] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { limit: 100 };
            if (platform) params.platform = platform;
            const res = await api.get('/cms/social-trends', { params });
            setTrends(res.data.trends || []);
        } catch { setTrends([]); }
        finally { setLoading(false); }
    }, [platform]);

    useEffect(() => { load(); }, [load]);

    const toggleActive = async (trend) => {
        try {
            const res = await api.patch(`/cms/social-trends/${trend.id}/toggle`);
            setTrends(ts => ts.map(t => t.id === trend.id ? res.data : t));
        } catch (err) { alert(err.response?.data?.message || 'Toggle failed.'); }
    };

    const deleteTrend = async (id, content) => {
        if (!confirm(`Delete "${content?.slice(0, 40) || 'this trend'}"?`)) return;
        try {
            await api.delete(`/cms/social-trends/${id}`);
            setTrends(ts => ts.filter(t => t.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="social-trends" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Social Trends</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage trending social media posts</p>
                        </div>
                        <button onClick={() => setModal('new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add Trend
                        </button>
                    </div>

                    {/* Platform tabs */}
                    <div className="flex gap-2">
                        {['', ...PLATFORMS].map(p => (
                            <button key={p} onClick={() => setPlatform(p)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${platform === p ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'}`}>
                                {p || 'All'}
                            </button>
                        ))}
                    </div>

                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                        ) : trends.length === 0 ? (
                            <div className="text-center py-20 text-text-tertiary">No trends found.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {trends.map(t => (
                                    <div key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
                                        {t.imageUrl && <img src={t.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0 border border-border" />}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <span className={`px-2 py-0.5 rounded-full border text-xs font-bold capitalize ${PLATFORM_COLORS[t.platform]}`}>{t.platform}</span>
                                                <span className={`w-2 h-2 rounded-full ${t.isActive ? 'bg-success' : 'bg-border'}`} title={t.isActive ? 'Active' : 'Inactive'} />
                                            </div>
                                            <p className="text-text-primary text-sm font-medium line-clamp-2">{t.content || '(no content)'}</p>
                                            <div className="flex items-center gap-3 mt-1 text-xs text-text-tertiary">
                                                {t.author && <span>@{t.author}</span>}
                                                {t.likes && <span className="flex items-center gap-1"><HiOutlineHeart className="w-3 h-3" />{t.likes}</span>}
                                                {t.url && <a href={t.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-accent"><HiOutlineLink className="w-3 h-3" />Link</a>}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <Toggle checked={t.isActive} onChange={() => toggleActive(t)} />
                                            <button onClick={() => setModal(t)} className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all"><HiOutlinePencil className="w-4 h-4" /></button>
                                            <button onClick={() => deleteTrend(t.id, t.content)} className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all"><HiOutlineTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {modal && (
                <TrendModal
                    trend={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
        </div>
    );
};

export default SocialTrendsManager;
