import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus, HiOutlinePencil, HiOutlineTrash, HiOutlineX,
    HiOutlineDocumentText, HiOutlineChevronLeft, HiOutlineUpload,
    HiOutlinePhotograph, HiOutlineCheck,
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

// Auto-generate slug from first 4 words of title
const makeSlug = (title) =>
    title.split(/\s+/).slice(0, 4).join('-').replace(/[^a-zA-Z0-9-]/g, '').replace(/-+/g, '-');

// ── FAQ Builder ───────────────────────────────────────────────────────────────
const FaqBuilder = ({ value, onChange }) => {
    const items = Array.isArray(value) ? value : [];
    const add = () => onChange([...items, { question: '', answer: '' }]);
    const update = (i, k, v) => { const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next); };
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-3">
            {items.map((item, i) => (
                <div key={i} className="bg-bg-primary border border-border rounded-xl p-3 space-y-2 relative">
                    <button type="button" onClick={() => remove(i)} className="absolute top-2 right-2 p-1 text-text-tertiary hover:text-red-400 bg-transparent border-none"><HiOutlineX className="w-3.5 h-3.5" /></button>
                    <input placeholder="Question" value={item.question} onChange={e => update(i, 'question', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent" />
                    <textarea placeholder="Answer" value={item.answer} rows={2} onChange={e => update(i, 'answer', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent resize-none" />
                </div>
            ))}
            <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 bg-transparent border-none transition-all">
                <HiOutlinePlus className="w-3.5 h-3.5" /> Add Q&A
            </button>
        </div>
    );
};

// ── TOC Builder ───────────────────────────────────────────────────────────────
const TocBuilder = ({ value, onChange }) => {
    const items = Array.isArray(value) ? value : [];
    const add = () => onChange([...items, { title: '', link: '' }]);
    const update = (i, k, v) => { const next = [...items]; next[i] = { ...next[i], [k]: v }; onChange(next); };
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-2">
            {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-center">
                    <input placeholder="Section title" value={item.title} onChange={e => update(i, 'title', e.target.value)}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent" />
                    <input placeholder="#anchor" value={item.link} onChange={e => update(i, 'link', e.target.value)}
                        className="w-32 px-3 py-1.5 rounded-lg border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent" />
                    <button type="button" onClick={() => remove(i)} className="p-1 text-text-tertiary hover:text-red-400 bg-transparent border-none"><HiOutlineX className="w-3.5 h-3.5" /></button>
                </div>
            ))}
            <button type="button" onClick={add} className="flex items-center gap-1.5 text-xs text-accent hover:text-accent/80 bg-transparent border-none transition-all">
                <HiOutlinePlus className="w-3.5 h-3.5" /> Add Section
            </button>
        </div>
    );
};

// ── Article Form (full page editor UI) ───────────────────────────────────────
const ArticleEditor = ({ article, onClose, onSaved }) => {
    const isEdit = !!article?.id;
    const [step, setStep]   = useState(0);
    const [saving, setSaving] = useState(false);
    const [uploadingData, setUploadingData] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    const [form, setForm] = useState(isEdit ? {
        title:             article.title || '',
        id:                article.id    || '',
        headingDescription: article.headingDescription || '',
        shortDescription:  article.shortDescription || '',
        readTime:          article.readTime || '',
        mainImage:         article.mainImage || '',
        body:              article.body || '',
        tags:              (article.tags || []).join(', '),
        dataKey:           article.dataKey || '',
        tableOfContents:   article.tableOfContents || [],
        faq:               article.faq || [],
        advertisement:     article.advertisement || ['', '', '', ''],
        images:            article.images || [],
    } : {
        title: '', id: '', headingDescription: '', shortDescription: '',
        readTime: '', mainImage: '', body: '', tags: '', dataKey: '',
        tableOfContents: [], faq: [], advertisement: ['', '', '', ''], images: [],
    });

    const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

    // Auto-generate slug from title (only when not editing)
    const handleTitleChange = (v) => {
        set('title', v);
        if (!isEdit) set('id', makeSlug(v));
    };

    const uploadData = async (file) => {
        if (!form.id) { alert('Title/ID is required before uploading data file.'); return; }
        setUploadingData(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post(
                `/api/cms/upload-private?folder=analytics/${form.id}/data&filename=data.xlsx`, fd,
                { headers: { 'Content-Type': 'multipart/form-data' } }
            );
            set('dataKey', res.data.key);
        } catch { alert('Data file upload failed.'); }
        finally { setUploadingData(false); }
    };

    const uploadBodyImage = async (file) => {
        if (!form.id) { alert('Title/ID is required before uploading images.'); return; }
        setUploadingImage(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post(`/api/cms/upload-private?folder=analytics/${form.id}/images`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const newImages = [...(form.images || []), res.data.key];
            set('images', newImages);
        } catch { alert('Image upload failed.'); }
        finally { setUploadingImage(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            const payload = {
                ...form,
                tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
                advertisement: form.advertisement,
            };
            if (isEdit) await api.put(`/cms/analytical-articles/${article.id}`, payload);
            else await api.post('/cms/analytical-articles', payload);
            onSaved(); onClose();
        } catch (err) { alert(err.response?.data?.message || 'Save failed.'); }
        finally { setSaving(false); }
    };

    const STEPS = ['Meta', 'Body & Images', 'Data File', 'TOC & FAQ', 'Ads'];

    return (
        <div className="fixed inset-0 z-[9999] bg-bg-primary overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={onClose} className="p-2 rounded-xl text-text-tertiary hover:text-text-primary hover:bg-bg-secondary bg-transparent border-none transition-all">
                        <HiOutlineChevronLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">{isEdit ? `Edit: ${article.title}` : 'New Analytical Article'}</h1>
                        {!isEdit && form.id && <p className="text-xs text-text-tertiary mt-0.5">ID/Slug: <code className="text-accent">{form.id}</code></p>}
                    </div>
                </div>

                {/* Step tabs */}
                <div className="flex gap-1 mb-8 bg-bg-secondary p-1 rounded-xl border border-border">
                    {STEPS.map((s, i) => (
                        <button key={s} type="button" onClick={() => setStep(i)}
                            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all border-none ${step === i ? 'bg-accent text-white' : 'bg-transparent text-text-secondary hover:text-text-primary'}`}>
                            {s}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {step === 0 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Title *</label>
                                <input type="text" required value={form.title} onChange={e => handleTitleChange(e.target.value)}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                                    Slug / ID {isEdit ? '(read-only)' : '(auto-generated, editable)'}
                                </label>
                                <input type="text" value={form.id} onChange={e => !isEdit && set('id', e.target.value)}
                                    disabled={isEdit}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all disabled:opacity-50 font-mono" />
                                {!isEdit && <p className="text-xs text-text-tertiary mt-1">⚠️ Cannot be changed after creation — it determines the S3 folder path.</p>}
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Heading Description</label>
                                <textarea value={form.headingDescription} onChange={e => set('headingDescription', e.target.value)} rows={2}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Short Description</label>
                                <textarea value={form.shortDescription} onChange={e => set('shortDescription', e.target.value)} rows={2}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all resize-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Read Time</label>
                                    <input type="text" value={form.readTime} onChange={e => set('readTime', e.target.value)} placeholder="15 min read"
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Tags</label>
                                    <input type="text" value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="aviation, data, India"
                                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Main Image S3 Key</label>
                                <input type="text" value={form.mainImage} onChange={e => set('mainImage', e.target.value)} placeholder="analytics/My-Article/images/cover.webp"
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary font-mono text-sm focus:outline-none focus:border-accent transition-all" />
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">
                                    Article Body (Markdown)
                                </label>
                                <p className="text-xs text-text-tertiary mb-2">Use <code className="text-accent">[IMAGE]</code> as placeholder where images should appear. Use <code className="text-accent">[Advertisement]</code> for ad slots.</p>
                                <textarea value={form.body} onChange={e => set('body', e.target.value)} rows={18}
                                    className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary font-mono text-sm focus:outline-none focus:border-accent transition-all resize-none"
                                    spellCheck={false} />
                                <div className="flex gap-2 mt-2">
                                    <button type="button" onClick={() => set('body', form.body + '\n[IMAGE]')}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-tertiary hover:text-accent hover:border-accent/30 bg-transparent transition-all">
                                        Insert [IMAGE]
                                    </button>
                                    <button type="button" onClick={() => set('body', form.body + '\n[Advertisement]')}
                                        className="px-3 py-1.5 text-xs rounded-lg border border-border text-text-tertiary hover:text-accent hover:border-accent/30 bg-transparent transition-all">
                                        Insert [Advertisement]
                                    </button>
                                </div>
                            </div>

                            {/* Body images (ordered, mapped to [IMAGE] placeholders) */}
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-2">
                                    Body Images (ordered — first image fills first [IMAGE])
                                </label>
                                <div className="space-y-2">
                                    {(form.images || []).map((key, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-bg-primary border border-border rounded-lg px-3 py-2">
                                            <span className="text-xs text-text-tertiary w-5">{i + 1}.</span>
                                            <span className="flex-1 text-xs font-mono text-text-secondary truncate">{key}</span>
                                            <button type="button" onClick={() => set('images', form.images.filter((_, idx) => idx !== i))}
                                                className="p-1 text-text-tertiary hover:text-red-400 bg-transparent border-none"><HiOutlineX className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                    <label className={`flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-bg-secondary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm ${!form.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <HiOutlinePhotograph className="w-4 h-4" />
                                        {uploadingImage ? 'Uploading…' : 'Upload body image'}
                                        <input type="file" className="hidden" accept="image/*" disabled={!form.id || uploadingImage}
                                            onChange={e => e.target.files[0] && uploadBodyImage(e.target.files[0])} />
                                    </label>
                                    {!form.id && <p className="text-xs text-amber-400">⚠️ Set title/ID on Meta tab first.</p>}
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Data File (.xlsx)</label>
                                <p className="text-xs text-text-tertiary mb-2">Will be stored at <code className="text-accent">analytics/{form.id || '<id>'}/data/data.xlsx</code> in the private bucket.</p>
                                <label className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-secondary hover:border-accent hover:text-accent cursor-pointer transition-all text-sm ${!form.id ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                    <HiOutlineUpload className="w-4 h-4" />
                                    {uploadingData ? 'Uploading…' : form.dataKey ? `✅ ${form.dataKey.split('/').pop()}` : 'Choose .xlsx file'}
                                    <input type="file" className="hidden" accept=".xlsx,.xls" disabled={!form.id || uploadingData}
                                        onChange={e => e.target.files[0] && uploadData(e.target.files[0])} />
                                </label>
                                {form.dataKey && (
                                    <p className="text-xs text-text-tertiary mt-1">Key: <code className="text-accent">{form.dataKey}</code></p>
                                )}
                                {!form.id && <p className="text-xs text-amber-400 mt-1">⚠️ Set title/ID on Meta tab first.</p>}
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-2">Table of Contents</label>
                                <TocBuilder value={form.tableOfContents} onChange={v => set('tableOfContents', v)} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-2">FAQ</label>
                                <FaqBuilder value={form.faq} onChange={v => set('faq', v)} />
                            </div>
                        </div>
                    )}

                    {step === 4 && (
                        <div className="space-y-3">
                            <p className="text-xs text-text-tertiary">4 rotating advertisement descriptions. These appear where <code className="text-accent">[Advertisement]</code> is placed in the body.</p>
                            {[0, 1, 2, 3].map(i => (
                                <div key={i}>
                                    <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Ad {i + 1}</label>
                                    <input type="text" value={(form.advertisement || [])[i] || ''} onChange={e => {
                                        const adv = [...(form.advertisement || ['', '', '', ''])];
                                        adv[i] = e.target.value;
                                        set('advertisement', adv);
                                    }} className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg-secondary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Navigation + save */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        {step > 0 && (
                            <button type="button" onClick={() => setStep(s => s - 1)}
                                className="px-4 py-2.5 rounded-xl border border-border text-text-secondary bg-transparent text-sm font-semibold">
                                ← Back
                            </button>
                        )}
                        <div className="flex-1" />
                        {step < STEPS.length - 1 ? (
                            <button type="button" onClick={() => setStep(s => s + 1)}
                                className="px-4 py-2.5 rounded-xl bg-bg-secondary border border-border text-text-primary text-sm font-semibold hover:bg-bg-primary transition-all">
                                Next →
                            </button>
                        ) : null}
                        <button type="submit" disabled={saving}
                            className="px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold disabled:opacity-60 transition-all">
                            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Article'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Analytical Article Manager (list view) ────────────────────────────────────
const AnalyticalArticleManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editor, setEditor] = useState(null); // null | 'new' | article object

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cms/analytical-articles');
            setArticles(res.data);
        } catch { setArticles([]); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { load(); }, [load]);

    const deleteArticle = async (id, title) => {
        if (!confirm(`Delete "${title}"? This cannot be undone and will not remove S3 files.`)) return;
        try {
            await api.delete(`/cms/analytical-articles/${id}`);
            setArticles(a => a.filter(x => x.id !== id));
        } catch (err) { alert(err.response?.data?.message || 'Delete failed.'); }
    };

    if (editor) {
        return (
            <ArticleEditor
                article={editor === 'new' ? null : editor}
                onClose={() => setEditor(null)}
                onSaved={load}
            />
        );
    }

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="analytical-articles" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">Analytical Articles</h1>
                            <p className="text-text-secondary text-sm mt-1">Data-driven deep-dive articles</p>
                        </div>
                        <button onClick={() => setEditor('new')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent/90 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> New Article
                        </button>
                    </div>

                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                        ) : articles.length === 0 ? (
                            <div className="text-center py-20 text-text-tertiary">No analytical articles yet.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {articles.map(a => (
                                    <div key={a.id} className="flex items-start gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-text-primary font-semibold text-sm">{a.title}</p>
                                            <p className="text-text-tertiary text-xs mt-0.5 font-mono">{a.id}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {(a.tags || []).slice(0, 4).map(tag => (
                                                    <span key={tag} className="px-2 py-0.5 rounded-full bg-bg-primary border border-border text-text-tertiary text-xs">{tag}</span>
                                                ))}
                                            </div>
                                            <p className="text-text-tertiary text-xs mt-1">{new Date(a.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity mt-1">
                                            <button onClick={() => setEditor(a)} className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 bg-transparent border-none transition-all"><HiOutlinePencil className="w-4 h-4" /></button>
                                            <button onClick={() => deleteArticle(a.id, a.title)} className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all"><HiOutlineTrash className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default AnalyticalArticleManager;
