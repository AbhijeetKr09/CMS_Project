import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlinePhotograph, HiOutlineCheck,
} from 'react-icons/hi';

const S3_PUBLIC = 'https://avionyz-public-data.s3.ap-south-1.amazonaws.com/';

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

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange }) => (
    <button type="button" onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full border-none transition-all ${checked ? 'bg-accent' : 'bg-bg-primary border border-border'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${checked ? 'left-5' : 'left-0.5'}`} />
    </button>
);

// ── Image Uploader ────────────────────────────────────────────────────────────
const ImageUploader = ({ label, folder, onUploaded, currentKey }) => {
    const [uploading, setUploading] = useState(false);
    const [savedKey, setSavedKey] = useState(currentKey || '');

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
            setSavedKey(res.data.key);
            onUploaded(res.data.key);
        } catch { alert('Upload failed.'); }
        finally { setUploading(false); }
    };

    return (
        <div className="space-y-2">
            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{label}</label>
            <div className="flex items-center gap-3">
                {savedKey && (
                    <img src={`${S3_PUBLIC}${savedKey}`} alt="" className="w-10 h-10 rounded-lg object-cover border border-border" />
                )}
                <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm font-medium">
                    <HiOutlinePhotograph className="w-4 h-4" />
                    {uploading ? 'Uploading…' : savedKey ? 'Change Photo' : 'Upload Photo'}
                    <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
                </label>
                {savedKey && <span className="text-xs text-success flex items-center gap-1"><HiOutlineCheck className="w-3.5 h-3.5" /> Saved</span>}
            </div>
        </div>
    );
};

// ── Expert Form Field ─────────────────────────────────────────────────────────
const FormField = ({ label, name, required, type = 'text', placeholder, multiline, formData, onChange, ...rest }) => (
    <div>
        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">{label}</label>
        {multiline ? (
            <textarea value={formData[name] || ''} onChange={e => onChange(name, e.target.value)} rows={4} placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" {...rest} />
        ) : (
            <input type={type} required={required} value={formData[name] || ''} onChange={e => onChange(name, e.target.value)} placeholder={placeholder}
                className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" {...rest} />
        )}
    </div>
);

// ── Expert Form Modal ─────────────────────────────────────────────────────────
const ExpertModal = ({ expert, onClose, onSaved }) => {
    const [form, setForm] = useState(expert ? { ...expert } : {
        name: '', role: '', company: '', image: '', quote: '', highlight: 'Expert of the Week', url: '', isActive: true,
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            if (expert?.id) await api.put(`/cms/experts/${expert.id}`, form);
            else await api.post('/cms/experts', form);
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
        finally { setSaving(false); }
    };



    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-secondary z-10">
                    <h2 className="text-lg font-bold text-text-primary">{expert ? 'Edit Expert' : 'New Expert'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <ImageUploader label="Profile Photo" folder="expert-image" currentKey={form.image}
                        onUploaded={key => set('image', key)} />
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2"><FormField formData={form} onChange={set} label="Full Name" name="name" required /></div>
                        <FormField formData={form} onChange={set} label="Job Title" name="role" required placeholder="CEO" />
                        <FormField formData={form} onChange={set} label="Company" name="company" required placeholder="United Airlines" />
                        <div className="col-span-2"><FormField formData={form} onChange={set} label="Quote" name="quote" required multiline placeholder="Featured quote shown in the widget…" /></div>
                        <FormField formData={form} onChange={set} label="Highlight Badge" name="highlight" placeholder="Expert of the Week" />
                        <FormField formData={form} onChange={set} label="Profile URL (LinkedIn)" name="url" type="url" />
                    </div>
                    <div className="flex items-center gap-3">
                        <Toggle checked={form.isActive} onChange={v => set('isActive', v)} />
                        <span className="text-sm text-text-secondary">{form.isActive ? 'Active (shown on homepage)' : 'Inactive (hidden)'}</span>
                    </div>
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60">
                            {saving ? 'Saving…' : expert ? 'Save Changes' : 'Add Expert'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Experts Manager ───────────────────────────────────────────────────────────
const ExpertsManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [experts, setExperts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modal, setModal] = useState(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cms/experts');
            setExperts(res.data);
        } catch { setExperts([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const toggleExpert = async (expert) => {
        try {
            const res = await api.patch(`/cms/experts/${expert.id}/toggle`);
            setExperts(es => es.map(e => e.id === expert.id ? res.data : e));
        } catch (err) { alert(err.response?.data?.message || 'Failed.'); }
    };

    const deleteExpert = async (id, name) => {
        if (!confirm(`Delete expert "${name}"?`)) return;
        try {
            await api.delete(`/cms/experts/${id}`);
            setExperts(es => es.filter(e => e.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="experts" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Experts</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage Expert of the Week — up to 4 active shown on homepage</p>
                        </div>
                        <button onClick={() => setModal('new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add Expert
                        </button>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                    ) : experts.length === 0 ? (
                        <div className="text-center py-20 text-text-tertiary">No experts yet.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {experts.map(ex => (
                                <div key={ex.id} className={`bg-bg-secondary border rounded-2xl p-5 transition-all ${ex.isActive ? 'border-border' : 'border-border/40 opacity-60'}`}>
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-14 h-14 rounded-xl overflow-hidden border border-border flex-shrink-0 bg-bg-primary">
                                            {ex.image ? (
                                                <img src={`${S3_PUBLIC}${ex.image}`} alt={ex.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-lg font-bold text-text-tertiary">
                                                    {ex.name?.[0]}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-text-primary font-semibold text-sm truncate">{ex.name}</p>
                                            <p className="text-text-tertiary text-xs truncate">{ex.role} · {ex.company}</p>
                                            {ex.highlight && (
                                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-medium">{ex.highlight}</span>
                                            )}
                                        </div>
                                    </div>
                                    <p className="text-text-secondary text-xs italic line-clamp-2 mb-3">"{ex.quote}"</p>
                                    <div className="flex items-center gap-2 justify-between">
                                        <Toggle checked={ex.isActive} onChange={() => toggleExpert(ex)} />
                                        <div className="flex gap-1">
                                            <button onClick={() => setModal(ex)} className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all"><HiOutlinePencil className="w-4 h-4" /></button>
                                            <button onClick={() => deleteExpert(ex.id, ex.name)} className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all"><HiOutlineTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {modal && (
                <ExpertModal
                    expert={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}
        </div>
    );
};

export default ExpertsManager;
