import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { getSignedUrl } from '../services/s3';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlinePlus,
    HiOutlineDocumentText,
    HiOutlineExclamationCircle,
    HiOutlineSearch,
    HiOutlineEye,
    HiOutlinePencil,
    HiOutlineTag,
    HiOutlineArrowLeft,
    HiOutlineClock,
    HiOutlineLightBulb,
    HiOutlinePhotograph,
    HiOutlineExternalLink,
    HiOutlineTrash,
} from 'react-icons/hi';
import TipTapEditor from '../components/editor/TipTapEditor';

const ARTICLE_TYPES = ['All', 'Headline', 'Business', 'News', 'Trending', 'Aerospace', 'Breaking'];

// ── Thumbnail that resolves an S3 key to a signed URL ────────────────────────
const SignedThumb = ({ s3Key, fallback }) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!s3Key) return;
        getSignedUrl(s3Key).then(setUrl).catch(() => setUrl(null));
    }, [s3Key]);
    if (!s3Key || !url) return fallback;
    return <img src={url} alt="" className="w-12 h-9 rounded-lg object-cover flex-shrink-0 border border-border" />;
};

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        DRAFT: { cls: 'bg-bg-tertiary border-border text-text-tertiary', label: 'Draft' },
        SUBMITTED: { cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400', label: 'Under Review' },
        NEEDS_CHANGES: { cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400', label: 'Revision' },
        PUBLISHED: { cls: 'bg-success/10 border-success/20 text-success', label: 'Published' },
    };
    const { cls, label } = map[status] || map.DRAFT;
    return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${cls}`}>{label}</span>;
};

// ── Article Reader Helpers ───────────────────────────────────────────────────

const useSignedUrl = (key) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!key) return;
        getSignedUrl(key).then(setUrl).catch(() => setUrl(key));
    }, [key]);
    return url;
};

const S3Image = ({ s3Key, alt, className }) => {
    const url = useSignedUrl(s3Key);
    if (!url) return <div className={`${className} bg-bg-primary border border-border rounded-xl animate-pulse`} />;
    return <img src={url} alt={alt || ''} className={className} />;
};

// ── Journalist Article Reader ────────────────────────────────────────────────
const JournalistArticleReader = ({ article, onBack }) => {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <button onClick={onBack}
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors bg-transparent border-none p-0">
                    <HiOutlineArrowLeft className="w-4 h-4" /> Back to List
                </button>
            </div>

            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                <div className="border-b border-border px-8 py-5 flex flex-wrap gap-4 text-sm text-text-secondary">
                    <span className="px-2.5 py-0.5 rounded-full bg-success/10 border border-success/20 text-success text-xs font-semibold">Published</span>
                    {article.type && (
                        <span className="px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">{article.type}</span>
                    )}
                    {article.timestampDate && (
                        <span className="flex items-center gap-1.5 text-text-tertiary text-xs">
                            <HiOutlineClock className="w-3.5 h-3.5" />
                            {new Date(article.timestampDate).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                    )}
                    {article.readTime && <span className="text-text-tertiary text-xs">{article.readTime} read</span>}
                    {article.tags?.length > 0 && (
                        <span className="flex items-center gap-1.5 text-text-tertiary text-xs">
                            <HiOutlineTag className="w-3.5 h-3.5" />
                            {article.tags.join(', ')}
                        </span>
                    )}
                    {article.views != null && <span className="text-text-tertiary text-xs">{article.views} views</span>}
                </div>

                <div className="px-8 py-8 space-y-7">
                    <h1 className="text-3xl font-bold text-text-primary leading-tight">{article.title}</h1>

                    {article.shortDescription && (
                        <p className="text-text-secondary text-base leading-relaxed border-l-4 border-accent/40 pl-4 italic">
                            {article.shortDescription}
                        </p>
                    )}

                    {article.mainImage && (
                        <S3Image s3Key={article.mainImage} alt="Cover"
                            className="w-full rounded-xl object-cover max-h-80" />
                    )}

                    {article.body ? (
                        <TipTapEditor content={article.body} editable={false} />
                    ) : (
                        <p className="text-text-tertiary italic text-sm">No body content.</p>
                    )}

                    {article.keyInsights?.length > 0 && (
                        <div className="bg-accent/5 border border-accent/15 rounded-xl p-5">
                            <p className="flex items-center gap-2 text-xs font-semibold text-accent uppercase tracking-wider mb-3">
                                <HiOutlineLightBulb className="w-4 h-4" /> Key Insights
                            </p>
                            <ul className="space-y-2">
                                {article.keyInsights.map((k, i) => (
                                    <li key={k.id} className="flex items-start gap-2.5 text-text-secondary text-sm">
                                        <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                                        {k.insightText}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {article.images?.length > 0 && (
                        <div>
                            <p className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                                <HiOutlinePhotograph className="w-4 h-4" /> Gallery ({article.images.length})
                            </p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {article.images.map(img => (
                                    <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border">
                                        <S3Image s3Key={img.src} alt={img.alt || ''}
                                            className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
                                        {(img.caption || img.alt) && (
                                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-3 py-1.5 text-white text-xs">{img.caption || img.alt}</div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {article.relatedNews?.length > 0 && (
                        <div>
                            <p className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                                <HiOutlineExternalLink className="w-4 h-4" /> Related News
                            </p>
                            <div className="space-y-2">
                                {article.relatedNews.map(n => (
                                    <div key={n.id} className="flex items-center gap-2 text-sm text-text-secondary">
                                        <span className="w-1 h-1 rounded-full bg-text-tertiary flex-shrink-0" />
                                        {n.newsUrl ? (
                                            <a href={n.newsUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{n.newsTitle}</a>
                                        ) : <span>{n.newsTitle}</span>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ── All Articles (read-only published) ───────────────────────────────────────
const AllArticlesTab = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [selected, setSelected] = useState(null);
    const [readerLoading, setReaderLoading] = useState(false);

    useEffect(() => {
        const fetch = async () => {
            setLoading(true);
            try {
                const params = { page, limit: 15 };
                if (search) params.search = search;
                if (typeFilter !== 'All') params.type = typeFilter;
                const res = await api.get('/api/articles', { params });
                setArticles(res.data.data || []);
                setTotalPages(res.data.pagination?.totalPages || 1);
            } catch { setArticles([]); }
            finally { setLoading(false); }
        };
        fetch();
    }, [page, search, typeFilter]);

    const openReader = async (articleId) => {
        setReaderLoading(true);
        try {
            const res = await api.get(`/api/articles/${articleId}`);
            setSelected(res.data);
        } catch { alert('Failed to load article.'); }
        finally { setReaderLoading(false); }
    };

    if (readerLoading) return <div className="flex justify-center py-24"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

    if (selected) return <JournalistArticleReader article={selected} onBack={() => setSelected(null)} />;

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                    <input type="text" placeholder="Search articles..." value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-4 py-2.5 bg-bg-primary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent text-sm transition-all" />
                </div>
                <div className="flex gap-2 flex-wrap">
                    {ARTICLE_TYPES.map(t => (
                        <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }}
                            className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all border
                                ${typeFilter === t ? 'bg-accent text-white border-accent' : 'bg-bg-primary border-border text-text-secondary hover:text-text-primary'}`}>
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                ) : articles.length === 0 ? (
                    <div className="text-center py-16 text-text-tertiary text-sm">No articles found.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {articles.map(a => (
                            <div key={a.id}
                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-primary/40 cursor-pointer group transition-colors"
                                onClick={() => openReader(a.id)}>
                                {a.mainImage ? (
                                    <img src={a.mainImage} alt="" className="w-12 h-9 rounded-lg object-cover flex-shrink-0 border border-border" />
                                ) : (
                                    <div className="w-12 h-9 rounded-lg bg-bg-primary border border-border flex items-center justify-center flex-shrink-0">
                                        <HiOutlineDocumentText className="w-4 h-4 text-text-tertiary" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">{a.title}</p>
                                    <p className="text-text-tertiary text-xs mt-0.5">
                                        {new Date(a.timestampDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {a.type && <> · <span className="text-text-secondary">{a.type}</span></>}
                                        {a.views != null && <> · {a.views} views</>}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-xs text-text-tertiary font-medium whitespace-nowrap">Read →</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {totalPages > 1 && (
                <div className="flex justify-center gap-2">
                    <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 transition-all text-text-secondary">Prev</button>
                    <span className="px-3 py-1.5 text-xs text-text-tertiary">{page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 transition-all text-text-secondary">Next</button>
                </div>
            )}
        </div>
    );
};

// ── Needs Changes tab ─────────────────────────────────────────────────────────
const NeedsChangesTab = ({ navigate }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/cms/staged/mine')
            .then(res => setArticles(res.data.filter(a => a.status === 'NEEDS_CHANGES')))
            .catch(() => setArticles([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

    return articles.length === 0 ? (
        <div className="text-center py-16">
            <HiOutlineExclamationCircle className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
            <p className="text-text-secondary text-sm font-medium">No change requests</p>
            <p className="text-text-tertiary text-xs mt-1">All your submissions are clear!</p>
        </div>
    ) : (
        <div className="space-y-3">
            {articles.map(a => (
                <div key={a.id}
                    className="bg-bg-secondary border border-amber-500/20 rounded-2xl p-5 cursor-pointer hover:border-amber-500/40 transition-all"
                    onClick={() => navigate(`/editor/${a.id}`)}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                        <h3 className="text-text-primary font-semibold text-sm">{a.title || 'Untitled'}</h3>
                        <StatusBadge status={a.status} />
                    </div>
                    {a.editorNote && (
                        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-3">
                            <HiOutlineExclamationCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-amber-300/80 text-sm leading-relaxed">{a.editorNote}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                        <HiOutlinePencil className="w-4 h-4 text-accent" />
                        <span className="text-accent text-xs font-semibold">Click to edit and resubmit</span>
                    </div>
                </div>
            ))}
        </div>
    );
};

// ── My Submissions tab ────────────────────────────────────────────────────────
const MySubmissionsTab = ({ navigate }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    const load = () => {
        setLoading(true);
        api.get('/cms/staged/mine')
            .then(res => setArticles(res.data))
            .catch(() => setArticles([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const handleDelete = async (e, id) => {
        e.stopPropagation();
        if (!window.confirm('Delete this draft? This cannot be undone and will remove uploaded images.')) return;
        setDeletingId(id);
        try {
            await api.delete(`/cms/staged/draft/${id}`);
            setArticles(prev => prev.filter(a => a.id !== id));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete draft.');
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

    return articles.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary text-sm">No articles yet. Start writing!</div>
    ) : (
        <div className="bg-bg-secondary border border-border rounded-2xl divide-y divide-border overflow-hidden">
            {articles.map(a => (
                <div key={a.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-primary/40 cursor-pointer group transition-colors"
                    onClick={() => navigate(`/editor/${a.id}`)}>
                    <SignedThumb
                        s3Key={a.mainImage}
                        fallback={
                            <div className="w-12 h-9 rounded-lg bg-bg-primary border border-border flex items-center justify-center flex-shrink-0">
                                <HiOutlineDocumentText className="w-4 h-4 text-text-tertiary" />
                            </div>
                        }
                    />
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">
                                {a.title || <em className="text-text-tertiary font-normal">Untitled</em>}
                            </span>
                            <StatusBadge status={a.status} />
                        </div>
                        <p className="text-text-tertiary text-xs">
                            Updated {new Date(a.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {a.tags?.length > 0 && <> · {a.tags.slice(0, 2).join(', ')}</>}
                        </p>
                    </div>
                    {a.editorNote && <HiOutlineExclamationCircle className="w-4 h-4 text-amber-400 flex-shrink-0" title="Has editor note" />}
                    {/* Delete button — only for actionable statuses */}
                    {['DRAFT', 'NEEDS_CHANGES'].includes(a.status) && (
                        <button
                            onClick={(e) => handleDelete(e, a.id)}
                            disabled={deletingId === a.id}
                            title="Delete draft"
                            className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all bg-transparent border-none opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-50"
                        >
                            {deletingId === a.id
                                ? <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                                : <HiOutlineTrash className="w-4 h-4" />}
                        </button>
                    )}
                </div>
            ))}
        </div>
    );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
const Dashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('my-submissions');
    const [counts, setCounts] = useState({ needsChanges: 0 });

    useEffect(() => {
        api.get('/cms/staged/mine')
            .then(res => {
                const data = res.data;
                setCounts({ needsChanges: data.filter(a => a.status === 'NEEDS_CHANGES').length });
            })
            .catch(() => { });
    }, []);

    useEffect(() => {
        if (activeTab === 'submissions' || activeTab === 'published') {
            navigate('/editor-dashboard');
        }
    }, [activeTab, navigate]);

    const renderTab = () => {
        switch (activeTab) {
            case 'all-articles': return <AllArticlesTab />;
            case 'needs-changes': return <NeedsChangesTab navigate={navigate} />;
            case 'my-submissions': return <MySubmissionsTab navigate={navigate} />;
            case 'write-new': return null; // navigates away
            default: return <MySubmissionsTab navigate={navigate} />;
        }
    };

    const tabTitles = {
        'all-articles': { title: 'All Articles', subtitle: 'Browse all published articles (read-only)' },
        'needs-changes': { title: 'Revision', subtitle: 'Articles sent back by the editor for revision' },
        'my-submissions': { title: 'My Submissions', subtitle: 'All your staged and published articles' },
    };
    const current = tabTitles[activeTab] || tabTitles['my-submissions'];

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

            {/* Main content */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
                    {/* Page header */}
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">{current.title}</h1>
                            <p className="text-text-secondary text-sm mt-1">{current.subtitle}</p>
                        </div>
                        <button onClick={() => navigate('/editor')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePlus className="w-4 h-4" /> New Article
                        </button>
                    </div>

                    {renderTab()}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
