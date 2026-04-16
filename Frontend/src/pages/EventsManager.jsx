import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineSearch,
    HiOutlineGlobe, HiOutlineCalendar, HiOutlineLocationMarker,
    HiOutlineX, HiOutlinePhotograph, HiOutlineCheck,
} from 'react-icons/hi';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:5000';
const REGIONS = ['Asia', 'Gulf/Middle East', 'North America', 'South America', 'Europe', 'Africa', 'Oceania'];
const EVENT_TYPES = ['Conference', 'Expo', 'Webinar', 'Summit', 'Seminar', 'Workshop', 'Airshow', 'Other'];

const getLocalISOTime = (date) => {
    const d = date ? new Date(date) : new Date();
    if (isNaN(d.getTime())) return '';
    const tzoffset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
};

const EMPTY_FORM = {
    eventName: '', eventLink: '', venue: '', onlineOrOffline: 'Offline',
    freeOrPaid: 'Free', date: '', time: '', eventType: '',
    region: '', image: '', lat: '', lng: '', country: '',
    description: '', organizedBy: '', images: [],
};

// ── Image uploader component ──────────────────────────────────────────────────
const ImageUploader = ({ label, folder, onUploaded, currentKey, single = true }) => {
    const [uploading, setUploading] = useState(false);
    const [key, setKey] = useState(currentKey || '');

    const handleFile = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await api.post(`/api/cms/upload-public?folder=${folder}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setKey(res.data.key);
            onUploaded(res.data.key);
        } catch { alert('Upload failed.'); }
        finally { setUploading(false); }
    };

    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</label>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm font-medium">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {uploading ? 'Uploading…' : 'Choose File'}
                    <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                </label>
                {key && (
                    <span className="text-xs text-success flex items-center gap-1">
                        <HiOutlineCheck className="w-3.5 h-3.5" /> {key.split('/').pop()}
                    </span>
                )}
            </div>
        </div>
    );
};

// ── Event Form Field ────────────────────────────────────────────────────────
const FormField = ({ label, name, type = 'text', required, formData, onChange, ...rest }) => (
    <div>
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">{label}</label>
        <input
            type={type} required={required} value={formData[name] || ''}
            onChange={e => onChange(name, e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all"
            {...rest}
        />
    </div>
);

// ── Event Form Modal ──────────────────────────────────────────────────────────
const EventFormModal = ({ event, onClose, onSaved }) => {
    const [form, setForm] = useState(event ? {
        ...event,
        date: event.date ? getLocalISOTime(event.date) : '',
        images: event.images || [],
    } : { ...EMPTY_FORM });
    const [saving, setSaving] = useState(false);

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, lat: parseFloat(form.lat) || 0, lng: parseFloat(form.lng) || 0 };
            if (event?.id) {
                await api.put(`/cms/events/${event.id}`, payload);
            } else {
                await api.post('/cms/events', payload);
            }
            onSaved();
            onClose();
        } catch (err) {
            alert(err.response?.data?.message || 'Save failed.');
        } finally { setSaving(false); }
    };



    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-secondary z-10">
                    <h2 className="text-lg font-bold text-text-primary">{event ? 'Edit Event' : 'New Event'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none transition-all">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><FormField formData={form} onChange={set} label="Event Name" name="eventName" required /></div>
                        <FormField formData={form} onChange={set} label="Event Link (URL)" name="eventLink" type="url" />
                        <FormField formData={form} onChange={set} label="Organizer" name="organizedBy" />
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Region *</label>
                            <select value={form.region} onChange={e => set('region', e.target.value)} required
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all">
                                <option value="">Select region…</option>
                                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Event Type</label>
                            <select value={form.eventType} onChange={e => set('eventType', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all">
                                <option value="">Select type…</option>
                                {EVENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <FormField formData={form} onChange={set} label="Date & Time" name="date" type="datetime-local" required />
                        <FormField formData={form} onChange={set} label="Time (display)" name="time" placeholder="e.g. 10:00–18:00 (UTC+4)" />
                        <FormField formData={form} onChange={set} label="Venue" name="venue" />
                        <FormField formData={form} onChange={set} label="Country" name="country" />
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Online / Offline</label>
                            <select value={form.onlineOrOffline} onChange={e => set('onlineOrOffline', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all">
                                <option>Offline</option><option>Online</option>
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Free / Paid</label>
                            <select value={form.freeOrPaid} onChange={e => set('freeOrPaid', e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all">
                                <option>Free</option><option>Paid</option><option>Paid (trade) / Free (public)</option>
                            </select>
                        </div>
                        <FormField formData={form} onChange={set} label="Latitude" name="lat" type="number" step="any" />
                        <FormField formData={form} onChange={set} label="Longitude" name="lng" type="number" step="any" />
                        <div className="col-span-2">
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Description</label>
                            <textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3}
                                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" />
                        </div>
                    </div>

                    {/* Image uploads */}
                    <div className="border-t border-border pt-4 space-y-3">
                        <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Images</p>
                        <ImageUploader
                            label="Main Image"
                            folder={`Event/${form.region || 'uploads'}`}
                            currentKey={form.image}
                            onUploaded={key => set('image', key)}
                        />
                        {form.image && (
                            <p className="text-xs text-text-tertiary">Key: <code className="text-accent">{form.image}</code></p>
                        )}
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose}
                            className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary hover:text-text-primary bg-transparent text-sm font-semibold transition-all">
                            Cancel
                        </button>
                        <button type="submit" disabled={saving}
                            className="flex-1 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold transition-all disabled:opacity-60">
                            {saving ? 'Saving…' : event ? 'Save Changes' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Main Events Manager ───────────────────────────────────────────────────────
const EventsManager = () => {
    const navigate = useNavigate();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('');
    const [modal, setModal] = useState(null); // null | 'new' | event object

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { limit: 100 };
            if (regionFilter) params.region = regionFilter;
            const res = await api.get('/cms/events', { params });
            setEvents(res.data.events || []);
        } catch { setEvents([]); }
        finally { setLoading(false); }
    }, [regionFilter]);

    useEffect(() => { load(); }, [load]);

    const deleteEvent = async (id, name) => {
        if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
        try {
            await api.delete(`/cms/events/${id}`);
            setEvents(ev => ev.filter(e => e.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    const filtered = events.filter(e =>
        e.eventName.toLowerCase().includes(search.toLowerCase()) ||
        e.venue?.toLowerCase().includes(search.toLowerCase())
    );

    const S3_PUBLIC = 'https://avionyz-public-data.s3.ap-south-1.amazonaws.com/';

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="events" onTabChange={(tab) => {
                const routes = {
                    'events': '/admin/events', 'social-trends': '/admin/social-trends',
                    'experts': '/admin/experts', 'media': '/admin/media',
                    'analytical-articles': '/admin/analytical-articles',
                    'users': '/admin/users', 'airlines': '/admin/airlines',
                    'submissions': '/editor-dashboard', 'published': '/editor-dashboard',
                };
                if (routes[tab]) navigate(routes[tab]);
            }} counts={{}} />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Events</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage all aviation events</p>
                        </div>
                        <button onClick={() => setModal('new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add Event
                        </button>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                            <input type="text" placeholder="Search events…" value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-9 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent text-sm transition-all" />
                        </div>
                        <select value={regionFilter} onChange={e => setRegionFilter(e.target.value)}
                            className="px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-secondary text-sm focus:outline-none focus:border-accent transition-all">
                            <option value="">All Regions</option>
                            {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>

                    {/* Table */}
                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-20 text-text-tertiary">No events found.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {filtered.map(ev => (
                                    <div key={ev.id} className="flex items-center gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
                                        {/* Thumbnail */}
                                        <div className="w-16 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-bg-primary">
                                            {ev.image ? (
                                                <img src={`${S3_PUBLIC}${ev.image}`} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    <HiOutlineCalendar className="w-5 h-5 text-text-tertiary" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-text-primary font-semibold text-sm truncate">{ev.eventName}</p>
                                            <div className="flex items-center gap-3 mt-0.5 text-xs text-text-tertiary flex-wrap">
                                                <span className="flex items-center gap-1"><HiOutlineCalendar className="w-3 h-3" />{new Date(ev.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                <span className="flex items-center gap-1"><HiOutlineLocationMarker className="w-3 h-3" />{ev.venue || '—'}</span>
                                                <span className="flex items-center gap-1"><HiOutlineGlobe className="w-3 h-3" />{ev.region}</span>
                                                <span className={`px-2 py-0.5 rounded-full border text-xs font-medium ${new Date(ev.date) >= new Date() ? 'border-success/30 text-success bg-success/10' : 'border-border text-text-tertiary bg-bg-primary'}`}>
                                                    {new Date(ev.date) >= new Date() ? 'Upcoming' : 'Past'}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setModal(ev)}
                                                className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all">
                                                <HiOutlinePencil className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deleteEvent(ev.id, ev.eventName)}
                                                className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all">
                                                <HiOutlineTrash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {modal && (
                <EventFormModal
                    event={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
        </div>
    );
};

export default EventsManager;
