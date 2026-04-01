import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlinePhotograph, HiOutlineFilm, HiOutlineCheck, HiOutlineUpload,
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

// ── Media Form Modal ──────────────────────────────────────────────────────────
const MediaModal = ({ media, onClose, onSaved }) => {
    const isEdit = !!media?.id;
    const [form, setForm] = useState(isEdit ? {
        title: media.title || '', description: media.description || '',
        tags: (media.tags || []).join(', '), url: media.url || '', thumbnail: media.thumbnail || '',
        type: media.type || 'image',
    } : { title: '', description: '', tags: '', url: '', thumbnail: '', type: 'image' });

    const [saving, setSaving] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [uploadingThumb, setUploadingThumb] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [videoProgress, setVideoProgress] = useState('');
    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    const uploadImage = async (file, field, folder) => {
        const setU = field === 'url' ? setUploadingFile : setUploadingThumb;
        setU(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post(`/api/cms/upload-public?folder=${folder}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            set(field, res.data.key);
        } catch { alert('Upload failed.'); }
        finally { setU(false); }
    };

    const uploadVideo = async (file) => {
        setUploadingVideo(true);
        setVideoProgress('Uploading video to server…');
        try {
            // Step 1 — POST file to server (returns jobId immediately)
            const fd = new FormData();
            fd.append('video', file);
            const { data } = await api.post('/api/cms/upload-video', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
                timeout: 5 * 60 * 1000,
            });
            const jobId = data.jobId;
            if (!jobId) throw new Error('No jobId returned from server');
            setVideoProgress('Video received — processing in background…');

            // Step 2 — Poll for job status every 3 seconds
            await new Promise((resolve, reject) => {
                const poll = setInterval(async () => {
                    try {
                        const { data: job } = await api.get(`/api/cms/video-status/${jobId}`);
                        if (job.status === 'done') {
                            clearInterval(poll);
                            const hlsKey = job.key || job.url || '';
                            const filename = hlsKey.split('/').pop() || hlsKey;
                            set('url', hlsKey);
                            setVideoProgress(`✅ Uploaded: ${filename}`);
                            resolve();
                        } else if (job.status === 'failed') {
                            clearInterval(poll);
                            reject(new Error(job.error || 'Processing failed on server'));
                        } else {
                            const pct = job.progress || 0;
                            setVideoProgress(
                                job.status === 'queued'
                                    ? '⏳ Queued — waiting for worker…'
                                    : `⚙️ Processing… ${pct}%`
                            );
                        }
                    } catch (pollErr) {
                        clearInterval(poll);
                        reject(pollErr);
                    }
                }, 3000);
            });

        } catch (err) {
            setVideoProgress(`❌ ${err.response?.data?.message || err.message || 'Upload failed'}`);
        } finally {
            setUploadingVideo(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = { ...form, tags: form.tags.split(',').map(t => t.trim()).filter(Boolean) };
            if (isEdit) await api.put(`/cms/media/${media.id}`, payload);
            else await api.post('/cms/media', payload);
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
        finally { setSaving(false); }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-bg-secondary z-10">
                    <h2 className="text-lg font-bold text-text-primary">{isEdit ? 'Edit Media' : 'Add Media'}</h2>
                    <button onClick={onClose} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary bg-transparent border-none"><HiOutlineX className="w-5 h-5" /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Type selector */}
                    {!isEdit && (
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Type</label>
                            <div className="flex gap-2">
                                {['image', 'video'].map(t => (
                                    <button key={t} type="button" onClick={() => set('type', t)}
                                        className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold flex items-center justify-center gap-2 transition-all ${form.type === t ? 'bg-accent/10 border-accent/30 text-accent' : 'border-border text-text-tertiary hover:border-border/60'}`}>
                                        {t === 'image' ? <HiOutlinePhotograph className="w-4 h-4" /> : <HiOutlineFilm className="w-4 h-4" />}
                                        {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Title *</label>
                        <input type="text" required value={form.title} onChange={e => set('title', e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Description</label>
                        <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Tags (comma-separated)</label>
                        <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="aviation, cargo, Boeing"
                            className="w-full px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                    </div>

                    {/* File upload */}
                    {form.type === 'image' && !isEdit && (
                        <div>
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Image File</label>
                            <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm">
                                <HiOutlineUpload className="w-4 h-4" />
                                {uploadingFile ? 'Uploading…' : form.url ? `✅ ${form.url.split('/').pop()}` : 'Choose image'}
                                <input type="file" className="hidden" accept="image/*"
                                    onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'url', 'Media_images')} />
                            </label>
                        </div>
                    )}

                    {form.type === 'video' && !isEdit && (
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Video File (MP4)</label>

                            {/* Show uploaded key + replace option once a video is done */}
                            {form.url ? (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-green-500/30 bg-green-500/5 text-sm">
                                    <HiOutlineCheck className="w-4 h-4 text-green-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-green-400 font-semibold text-xs">Video uploaded</p>
                                        <p className="text-text-tertiary text-xs font-mono truncate">{form.url.split('/').pop()}</p>
                                    </div>
                                    {/* Allow replacing the video if not currently uploading */}
                                    {!uploadingVideo && (
                                        <button type="button"
                                            onClick={() => { set('url', ''); setVideoProgress(''); }}
                                            className="text-xs text-text-tertiary hover:text-red-400 bg-transparent border-none underline shrink-0">
                                            Replace
                                        </button>
                                    )}
                                </div>
                            ) : (
                                /* File picker — only shown when no video uploaded yet */
                                <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-primary cursor-pointer transition-all text-sm ${
                                    uploadingVideo ? 'text-accent border-accent/30 pointer-events-none' : 'text-text-secondary hover:border-accent hover:text-accent'
                                }`}>
                                    <HiOutlineFilm className="w-4 h-4" />
                                    {uploadingVideo ? 'Processing…' : 'Choose MP4'}
                                    <input type="file" className="hidden" accept="video/mp4"
                                        onChange={e => e.target.files[0] && uploadVideo(e.target.files[0])}
                                        disabled={uploadingVideo} />
                                </label>
                            )}

                            {/* Progress / status text */}
                            {videoProgress && (
                                <p className={`text-xs ${videoProgress.startsWith('❌') ? 'text-red-400' : videoProgress.startsWith('✅') ? 'text-green-400' : 'text-text-tertiary'}`}>
                                    {videoProgress}
                                </p>
                            )}
                        </div>
                    )}


                    {/* Thumbnail upload */}
                    <div>
                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Thumbnail</label>
                        <label className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-primary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm">
                            <HiOutlinePhotograph className="w-4 h-4" />
                            {uploadingThumb ? 'Uploading…' : form.thumbnail ? `✅ ${form.thumbnail.split('/').pop()}` : 'Choose thumbnail'}
                            <input type="file" className="hidden" accept="image/*"
                                onChange={e => e.target.files[0] && uploadImage(e.target.files[0], 'thumbnail', 'media/thumbnails')} />
                        </label>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">Cancel</button>
                        <button type="submit" disabled={saving || uploadingVideo}
                            className="flex-1 py-2.5 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60">
                            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Media'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Media Manager ─────────────────────────────────────────────────────────────
const MediaManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [media, setMedia] = useState([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [modal, setModal] = useState(null);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 24 };
            if (typeFilter) params.type = typeFilter;
            const res = await api.get('/cms/media', { params });
            setMedia(res.data.media || []);
            setTotalPages(res.data.totalPages || 1);
        } catch { setMedia([]); }
        finally { setLoading(false); }
    }, [page, typeFilter]);

    useEffect(() => { load(); }, [load]);

    const deleteMedia = async (id, title) => {
        if (!confirm(`Delete "${title}"?`)) return;
        try {
            await api.delete(`/cms/media/${id}`);
            setMedia(m => m.filter(x => x.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    const thumbUrl = (m) => {
        const key = m.thumbnail || (m.type === 'image' ? m.url : null);
        if (!key) return null;
        if (key.startsWith('http')) return key;
        return `${S3_PUBLIC}${key}`;
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="media" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Media</h1>
                            <p className="text-text-secondary text-sm mt-1">Manage images, videos, and other media</p>
                        </div>
                        <button onClick={() => setModal('new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> Add Media
                        </button>
                    </div>

                    {/* Type filter tabs */}
                    <div className="flex gap-2">
                        {[{ val: '', label: 'All' }, { val: 'image', label: '🖼 Images' }, { val: 'video', label: '🎬 Videos' }].map(t => (
                            <button key={t.val} onClick={() => { setTypeFilter(t.val); setPage(1); }}
                                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all border ${typeFilter === t.val ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'}`}>
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                    ) : media.length === 0 ? (
                        <div className="text-center py-20 text-text-tertiary">No media found.</div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                            {media.map(m => (
                                <div key={m.id} className="group bg-bg-secondary border border-border rounded-2xl overflow-hidden hover:border-accent/30 transition-all">
                                    <div className="aspect-video bg-bg-primary relative">
                                        {thumbUrl(m) ? (
                                            <img src={thumbUrl(m)} alt={m.title} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                {m.type === 'video' ? <HiOutlineFilm className="w-8 h-8 text-text-tertiary" /> : <HiOutlinePhotograph className="w-8 h-8 text-text-tertiary" />}
                                            </div>
                                        )}
                                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-xs font-medium capitalize">{m.type}</span>
                                    </div>
                                    <div className="p-3">
                                        <p className="text-text-primary text-xs font-semibold truncate">{m.title}</p>
                                        <p className="text-text-tertiary text-xs mt-0.5">{m.views} views</p>
                                        <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setModal(m)} className="flex-1 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all flex items-center justify-center gap-1"><HiOutlinePencil className="w-3.5 h-3.5" />Edit</button>
                                            <button onClick={() => deleteMedia(m.id, m.title)} className="flex-1 py-1.5 rounded-lg text-xs text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all flex items-center justify-center gap-1"><HiOutlineTrash className="w-3.5 h-3.5" />Delete</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2">
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                                className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 text-text-secondary">Prev</button>
                            <span className="px-3 py-1.5 text-xs text-text-tertiary">{page} / {totalPages}</span>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                                className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 text-text-secondary">Next</button>
                        </div>
                    )}
                </div>
            </main>

            {modal && <MediaModal media={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={load} />}
        </div>
    );
};

export default MediaManager;
