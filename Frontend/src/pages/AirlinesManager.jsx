import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineStar, HiOutlineChat,
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

// ── Star rating display ───────────────────────────────────────────────────────
const Stars = ({ rating }) => (
    <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map(i => (
            <HiOutlineStar key={i} className={`w-3.5 h-3.5 ${i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-border'}`} style={{ fill: i <= rating ? 'currentColor' : 'none' }} />
        ))}
    </div>
);

// ── Airline Modal ─────────────────────────────────────────────────────────────
const AirlineModal = ({ airline, onClose, onSaved }) => {
    const [name, setName] = useState(airline?.name || '');
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;
        setSaving(true);
        try {
            if (airline) await api.put(`/cms/airlines/${airline.id}`, { name });
            else await api.post('/cms/airlines', { name });
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-sm">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-bold text-text-primary">{airline ? 'Edit Airline' : 'Add Airline'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Airline Name</label>
                        <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. IndiGo"
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                    </div>
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60">
                            {saving ? 'Saving…' : airline ? 'Save' : 'Add Airline'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Airlines Manager ──────────────────────────────────────────────────────────
const AirlinesManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [tab, setTab] = useState('airlines');
    const [airlines, setAirlines] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [reviewTotal, setReviewTotal] = useState(0);
    const [reviewPage, setReviewPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);
    const [airlineFilter, setAirlineFilter] = useState('');

    const loadAirlines = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cms/airlines');
            setAirlines(res.data);
        } catch { setAirlines([]); }
        finally { setLoading(false); }
    }, []);

    const loadReviews = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page: reviewPage, limit: 30 };
            if (airlineFilter) params.airlineId = airlineFilter;
            const res = await api.get('/cms/flight-reviews', { params });
            setReviews(res.data.reviews || []);
            setReviewTotal(res.data.total || 0);
        } catch { setReviews([]); }
        finally { setLoading(false); }
    }, [reviewPage, airlineFilter]);

    useEffect(() => { if (tab === 'airlines') loadAirlines(); else loadReviews(); }, [tab, loadAirlines, loadReviews]);

    const deleteAirline = async (id, name) => {
        if (!confirm(`Delete "${name}"? Associated reviews will also be deleted.`)) return;
        try {
            await api.delete(`/cms/airlines/${id}`);
            setAirlines(as => as.filter(a => a.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="airlines" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Airlines & Reviews</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage airlines and view flight reviews</p>
                        </div>
                        {tab === 'airlines' && (
                            <button onClick={() => setModal('new')}
                                className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                                <HiOutlinePlus className="w-4 h-4" /> Add Airline
                            </button>
                        )}
                    </div>

                    {/* Sub tabs */}
                    <div className="flex gap-2">
                        {['airlines', 'reviews'].map(t => (
                            <button key={t} onClick={() => setTab(t)}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all border ${tab === t ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'}`}>
                                {t === 'airlines' ? '✈️ Airlines' : '⭐ Reviews'}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                    ) : tab === 'airlines' ? (
                        <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                            {airlines.length === 0 ? (
                                <div className="text-center py-20 text-text-tertiary">No airlines yet.</div>
                            ) : (
                                <div className="divide-y divide-border">
                                    {airlines.map(a => (
                                        <div key={a.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-text-primary font-semibold text-sm">{a.name}</p>
                                                <p className="text-text-tertiary text-xs mt-0.5">{a._count?.reviews ?? 0} reviews</p>
                                            </div>
                                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => setModal(a)} className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all"><HiOutlinePencil className="w-4 h-4" /></button>
                                                <button onClick={() => deleteAirline(a.id, a.name)} className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all"><HiOutlineTrash className="w-4 h-4" /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Airline filter */}
                            <select value={airlineFilter} onChange={e => { setAirlineFilter(e.target.value); setReviewPage(1); }}
                                className="px-3 py-2 rounded-xl border border-border bg-bg-secondary text-text-secondary text-sm focus:outline-none focus:border-accent transition-all">
                                <option value="">All Airlines</option>
                                {airlines.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                            </select>
                            <p className="text-xs text-text-tertiary">{reviewTotal} total reviews</p>
                            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                                {reviews.length === 0 ? (
                                    <div className="text-center py-20 text-text-tertiary">No reviews found.</div>
                                ) : (
                                    <div className="divide-y divide-border">
                                        {reviews.map(r => (
                                            <div key={r.id} className="flex items-start gap-4 px-5 py-4">
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-text-primary text-sm font-semibold">{r.airline?.name}</span>
                                                        <Stars rating={r.rating} />
                                                        <span className="text-text-tertiary text-xs">{r.rating}/5</span>
                                                    </div>
                                                    {r.experience && <p className="text-text-secondary text-sm flex items-start gap-1.5"><HiOutlineChat className="w-4 h-4 mt-0.5 flex-shrink-0 text-text-tertiary" />{r.experience}</p>}
                                                    <p className="text-text-tertiary text-xs mt-1">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {modal && (
                <AirlineModal
                    airline={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={loadAirlines}
                />
            )}
        </div>
    );
};

export default AirlinesManager;
