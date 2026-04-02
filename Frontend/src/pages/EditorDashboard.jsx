import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { getSignedUrl } from '../services/s3';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlineDocumentText,
    HiOutlineSearch,
    HiOutlineCheckCircle,
    HiOutlineClock,
    HiOutlineUser,
    HiOutlineTag,
    HiOutlineArrowLeft,
    HiOutlineX,
    HiOutlineRefresh,
    HiOutlineLightBulb,
    HiOutlinePhotograph,
    HiOutlineExternalLink,
    HiOutlineChevronDown,
    HiOutlineTrash,
    HiOutlineExclamation,
} from 'react-icons/hi';

// ── Helpers ───────────────────────────────────────────────────────────────────
const isHTML = (str) => str && /<[a-z][\s\S]*>/i.test(str);

const BodyRenderer = ({ body }) => {
    if (!body) return <p className="text-text-tertiary italic text-sm">No body content.</p>;
    if (isHTML(body)) return <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed text-sm" dangerouslySetInnerHTML={{ __html: body }} />;
    return <div className="prose prose-invert max-w-none text-text-secondary leading-relaxed text-sm"><ReactMarkdown>{body}</ReactMarkdown></div>;
};

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

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        SUBMITTED:     { cls: 'bg-blue-500/10 border-blue-500/20 text-blue-400',    label: 'Submitted' },
        NEEDS_CHANGES: { cls: 'bg-amber-500/10 border-amber-500/20 text-amber-400', label: 'Changes Requested' },
    };
    const { cls, label } = map[status] || { cls: 'bg-bg-tertiary border-border text-text-tertiary', label: status };
    return <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${cls}`}>{label}</span>;
};

// ── Recall Modal ──────────────────────────────────────────────────────────────
const RecallModal = ({ article, onClose, onRecalled }) => {
    const [journalists, setJournalists] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get('/cms/staged/journalists')
            .then(res => setJournalists(res.data))
            .catch(() => {});
    }, []);

    const handleRecall = async () => {
        if (!selectedId) { setError('Please select a journalist.'); return; }
        setLoading(true); setError('');
        try {
            await api.post(`/cms/staged/recall/${article.id}`, {
                assignedToId: selectedId,
                editorNote: note.trim() || undefined,
            });
            onRecalled();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to recall article.');
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                    <div className="flex items-center gap-2">
                        <HiOutlineRefresh className="w-5 h-5 text-amber-400" />
                        <h3 className="text-text-primary font-bold text-lg">Recall Article</h3>
                    </div>
                    <button onClick={onClose} className="text-text-tertiary hover:text-text-primary bg-transparent border-none p-0">
                        <HiOutlineX className="w-5 h-5" />
                    </button>
                </div>

                <div className="px-6 py-5 space-y-4">
                    {/* Warning */}
                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-xs text-amber-300/80 leading-relaxed">
                        ⚠️ This will <strong>remove the article from the live database</strong> and create a staged version assigned to the selected journalist.
                    </div>

                    {/* Article title */}
                    <p className="text-text-secondary text-sm">
                        Recalling: <strong className="text-text-primary">"{article.title}"</strong>
                    </p>

                    {/* Journalist picker */}
                    <div>
                        <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                            Assign to journalist
                        </label>
                        <div className="relative">
                            <select
                                value={selectedId}
                                onChange={e => setSelectedId(e.target.value)}
                                className="w-full appearance-none bg-bg-primary border border-border rounded-xl px-4 py-2.5 pr-10 text-text-primary text-sm focus:outline-none focus:border-accent transition-all cursor-pointer"
                            >
                                <option value="">Select journalist...</option>
                                {journalists.map(j => (
                                    <option key={j.id} value={j.id}>{j.name} ({j.email})</option>
                                ))}
                            </select>
                            <HiOutlineChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                        </div>
                    </div>

                    {/* Note to journalist */}
                    <div>
                        <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                            Note to journalist (optional)
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            rows={3}
                            placeholder="e.g. Please update the statistics and add a new quote..."
                            className="w-full bg-bg-primary border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary text-sm resize-none focus:outline-none focus:border-accent transition-all"
                        />
                    </div>

                    {error && <p className="text-danger text-xs font-medium">{error}</p>}
                </div>

                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 text-text-secondary border border-border rounded-xl text-sm font-medium hover:text-text-primary transition-all">
                        Cancel
                    </button>
                    <button onClick={handleRecall} disabled={loading}
                        className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                        {loading ? 'Recalling...' : 'Recall & Assign'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Delete Confirm Modal ──────────────────────────────────────────────────────
const DeleteConfirmModal = ({ article, onClose, onDeleted }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleDelete = async () => {
        setLoading(true); setError('');
        try {
            await api.delete(`/cms/staged/article/${article.id}`);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete article.');
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
            <div className="bg-bg-secondary border border-danger/30 rounded-2xl w-full max-w-sm shadow-2xl">
                <div className="px-6 pt-6 pb-5 text-center">
                    <div className="w-12 h-12 rounded-full bg-danger/10 border border-danger/20 flex items-center justify-center mx-auto mb-4">
                        <HiOutlineExclamation className="w-6 h-6 text-danger" />
                    </div>
                    <h3 className="text-text-primary font-bold text-lg mb-2">Delete Article?</h3>
                    <p className="text-text-secondary text-sm mb-1">This will <strong>permanently delete</strong>:</p>
                    <p className="text-text-primary text-sm font-semibold truncate px-4">"{article.title}"</p>
                    <p className="text-text-tertiary text-xs mt-2">This cannot be undone. All comments, views, and history will also be deleted.</p>
                    {error && <p className="text-danger text-xs font-medium mt-3">{error}</p>}
                </div>
                <div className="flex gap-3 px-6 pb-6">
                    <button onClick={onClose}
                        className="flex-1 py-2.5 text-text-secondary border border-border rounded-xl text-sm font-medium hover:text-text-primary transition-all">
                        Cancel
                    </button>
                    <button onClick={handleDelete} disabled={loading}
                        className="flex-1 py-2.5 bg-danger hover:bg-danger/80 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                        {loading ? 'Deleting...' : 'Delete Permanently'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Article Reader Panel (editor-only full-page view) ─────────────────────────
const ArticleReader = ({ article, onBack, onRecall, onDelete }) => {
    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <button onClick={onBack}
                    className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors bg-transparent border-none p-0">
                    <HiOutlineArrowLeft className="w-4 h-4" /> Back to Published
                </button>
                <div className="flex items-center gap-2">
                    <button onClick={onDelete}
                        className="flex items-center gap-2 bg-danger/10 hover:bg-danger/20 text-danger border border-danger/20 px-4 py-2 rounded-xl text-sm font-semibold transition-all">
                        <HiOutlineTrash className="w-4 h-4" /> Delete
                    </button>
                    <button onClick={onRecall}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-amber-500/20">
                        <HiOutlineRefresh className="w-4 h-4" /> Recall for Editing
                    </button>
                </div>
            </div>

            {/* Article */}
            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                {/* Meta */}
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

                    <BodyRenderer body={article.body} />

                    {/* Key Insights */}
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

                    {/* Gallery */}
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

                    {/* Related News */}
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

// ── Submissions tab ───────────────────────────────────────────────────────────
const SubmissionsTab = ({ navigate }) => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('ALL');

    const load = () => {
        setLoading(true);
        api.get('/cms/staged')
            .then(res => setArticles(res.data))
            .catch(() => setArticles([]))
            .finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, []);

    const filtered = filter === 'ALL' ? articles : articles.filter(a => a.status === filter);

    if (loading) return <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>;

    return (
        <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
                {[['ALL', 'All'], ['SUBMITTED', 'New'], ['NEEDS_CHANGES', 'Changes Requested']].map(([val, label]) => (
                    <button key={val} onClick={() => setFilter(val)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                            ${filter === val ? 'bg-accent text-white border-accent' : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary'}`}>
                        {label}
                        {val !== 'ALL' && <span className="ml-1.5 opacity-70">({articles.filter(a => a.status === val).length})</span>}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="text-center py-16 bg-bg-secondary border border-border rounded-2xl">
                    <HiOutlineCheckCircle className="w-10 h-10 text-success mx-auto mb-3" />
                    <p className="text-text-secondary text-sm font-medium">All clear! No pending submissions.</p>
                </div>
            ) : (
                <div className="bg-bg-secondary border border-border rounded-2xl divide-y divide-border overflow-hidden">
                    {filtered.map(a => (
                        <div key={a.id}
                            className="flex items-center gap-4 px-5 py-4 hover:bg-bg-primary/40 cursor-pointer group transition-colors"
                            onClick={() => navigate(`/editor-review/${a.id}`)}>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                    <span className="text-text-primary text-sm font-semibold truncate group-hover:text-accent transition-colors">
                                        {a.title || <em className="font-normal text-text-tertiary">Untitled</em>}
                                    </span>
                                    <StatusBadge status={a.status} />
                                </div>
                                <div className="flex items-center gap-3 text-xs text-text-tertiary flex-wrap">
                                    <span className="flex items-center gap-1"><HiOutlineUser className="w-3.5 h-3.5" />{a.submittedBy?.name}</span>
                                    {a.submittedAt && <span className="flex items-center gap-1"><HiOutlineClock className="w-3.5 h-3.5" />{new Date(a.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>}
                                    {a.tags?.length > 0 && <span className="flex items-center gap-1"><HiOutlineTag className="w-3.5 h-3.5" />{a.tags.slice(0, 2).join(', ')}</span>}
                                </div>
                            </div>
                            <span className="text-text-tertiary text-xs flex-shrink-0">Review →</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ── Published tab — list + reader + recall ─────────────────────────────────────
const PublishedTab = () => {
    const [articles, setArticles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Article reader state
    const [selected, setSelected] = useState(null);   // article being read
    const [readerLoading, setReaderLoading] = useState(false);

    // Recall + delete modal state
    const [recallArticle, setRecallArticle] = useState(null);
    const [deleteArticleTarget, setDeleteArticleTarget] = useState(null);

    const loadList = async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (search) params.search = search;
            const res = await api.get('/api/articles', { params });
            setArticles(res.data.data || []);
            setTotalPages(res.data.pagination?.totalPages || 1);
        } catch { setArticles([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { loadList(); }, [page, search]);

    const openReader = async (articleId) => {
        setReaderLoading(true);
        try {
            const res = await api.get(`/api/articles/${articleId}`);
            setSelected(res.data);
        } catch { alert('Failed to load article.'); }
        finally { setReaderLoading(false); }
    };

    // After recall/delete, remove article from list and close reader
    const handleRecalled = () => {
        setArticles(prev => prev.filter(a => a.id !== recallArticle.id));
        setSelected(null);
    };

    const handleDeleted = () => {
        setArticles(prev => prev.filter(a => a.id !== deleteArticleTarget.id));
        setSelected(null);
    };

    // If an article is open, show the reader
    if (readerLoading) return (
        <div className="flex justify-center py-24">
            <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
    );

    if (selected) return (
        <>
            <ArticleReader
                article={selected}
                onBack={() => setSelected(null)}
                onRecall={() => setRecallArticle(selected)}
                onDelete={() => setDeleteArticleTarget(selected)}
            />
            {recallArticle && (
                <RecallModal
                    article={recallArticle}
                    onClose={() => setRecallArticle(null)}
                    onRecalled={handleRecalled}
                />
            )}
            {deleteArticleTarget && (
                <DeleteConfirmModal
                    article={deleteArticleTarget}
                    onClose={() => setDeleteArticleTarget(null)}
                    onDeleted={handleDeleted}
                />
            )}
        </>
    );

    return (
        <div className="space-y-4">
            <div className="relative">
                <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                <input type="text" placeholder="Search published articles..." value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1); }}
                    className="w-full pl-9 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent text-sm" />
            </div>

            <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                ) : articles.length === 0 ? (
                    <div className="text-center py-16 text-text-tertiary text-sm">No published articles found.</div>
                ) : (
                    <div className="divide-y divide-border">
                        {articles.map(a => (
                            <div key={a.id}
                                className="flex items-center gap-4 px-5 py-3.5 hover:bg-bg-primary/30 cursor-pointer group transition-colors"
                                onClick={() => openReader(a.id)}>
                                {a.mainImage ? (
                                    <S3Image s3Key={a.mainImage} alt="" className="w-12 h-9 rounded-lg object-cover flex-shrink-0 border border-border" />
                                ) : (
                                    <div className="w-12 h-9 rounded-lg bg-bg-primary border border-border flex items-center justify-center flex-shrink-0">
                                        <HiOutlineDocumentText className="w-4 h-4 text-text-tertiary" />
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-text-primary text-sm font-medium truncate group-hover:text-accent transition-colors">{a.title}</p>
                                    <p className="text-text-tertiary text-xs mt-0.5">
                                        {new Date(a.timestampDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                        {a.type && <> · {a.type}</>}
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
                        className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 text-text-secondary transition-all">Prev</button>
                    <span className="px-3 py-1.5 text-xs text-text-tertiary">{page} / {totalPages}</span>
                    <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 text-xs bg-bg-secondary border border-border rounded-lg hover:bg-bg-primary disabled:opacity-40 text-text-secondary transition-all">Next</button>
                </div>
            )}
        </div>
    );
};

// ── Main EditorDashboard ──────────────────────────────────────────────────────
const EditorDashboard = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('submissions');
    const [counts, setCounts] = useState({ submissions: 0 });

    useEffect(() => {
        api.get('/cms/staged')
            .then(res => setCounts({ submissions: res.data.length }))
            .catch(() => {});
    }, []);

    const tabTitles = {
        submissions: { title: 'Submissions Queue',  subtitle: 'Review and publish journalist articles' },
        published:   { title: 'Published Articles', subtitle: 'All live articles — click any to read or recall for editing' },
    };
    const current = tabTitles[activeTab] || tabTitles.submissions;

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab={activeTab} onTabChange={setActiveTab} counts={counts} />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary">{current.title}</h1>
                            <p className="text-text-secondary text-sm mt-1">{current.subtitle}</p>
                        </div>
                        <button onClick={() => navigate('/editor')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-accent/20">
                            <HiOutlinePencil className="w-4 h-4" /> New Article
                        </button>
                    </div>

                    {activeTab === 'submissions' && <SubmissionsTab navigate={navigate} />}
                    {activeTab === 'published'   && <PublishedTab />}
                </div>
            </main>
        </div>
    );
};

export default EditorDashboard;
