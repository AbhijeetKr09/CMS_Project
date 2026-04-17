import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import api from '../services/api';
import { getSignedUrl, signBodyImageSrcs } from '../services/s3';
import TipTapEditor from '../components/editor/TipTapEditor';
import Navbar from '../components/common/Navbar';
import {
    HiOutlineArrowLeft,
    HiOutlineCheckCircle,
    HiOutlineExclamationCircle,
    HiOutlineX,
    HiOutlineClock,
    HiOutlineTag,
    HiOutlineUser,
    HiOutlineTrash,
    HiOutlineChatAlt2,
    HiOutlinePencil,
    HiOutlinePhotograph,
    HiOutlineLightBulb,
    HiOutlineExternalLink,
} from 'react-icons/hi';

// ── Hook: resolve an S3 key to a signed URL ──────────────────────────────────
const useSignedUrl = (key) => {
    const [url, setUrl] = useState(null);
    useEffect(() => {
        if (!key) return;
        getSignedUrl(key).then(setUrl).catch(() => setUrl(key));
    }, [key]);
    return url;
};

// ── Image that auto-resolves S3 key → signed URL ─────────────────────────────
const S3Image = ({ s3Key, alt, className }) => {
    const url = useSignedUrl(s3Key);
    if (!url) return <div className={`${className} bg-bg-primary border border-border rounded-xl animate-pulse`} />;
    return <img src={url} alt={alt || ''} className={className} />;
};

// ── Status badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
    const map = {
        SUBMITTED: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
        NEEDS_CHANGES: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
        DRAFT: 'bg-bg-tertiary border-border text-text-tertiary',
        PUBLISHED: 'bg-success/10 border-success/20 text-success',
    };
    const labels = {
        SUBMITTED: 'Submitted',
        NEEDS_CHANGES: 'Changes Requested',
        DRAFT: 'Draft',
        PUBLISHED: 'Published',
    };
    return (
        <span className={`inline-flex items-center px-3 py-1 rounded-lg border text-xs font-semibold ${map[status] || map.DRAFT}`}>
            {labels[status] || status}
        </span>
    );
};

const EditorReview = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    const [article, setArticle] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // Request Changes modal
    const [showChangesModal, setShowChangesModal] = useState(false);
    const [changesNote, setChangesNote] = useState('');
    const [submittingChanges, setSubmittingChanges] = useState(false);
    const [changesError, setChangesError] = useState('');

    // Publish
    const [showPublishConfirm, setShowPublishConfirm] = useState(false);
    const [publishing, setPublishing] = useState(false);
    const [publishSuccess, setPublishSuccess] = useState(null);

    // Inline note to journalist
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [noteSaved, setNoteSaved] = useState(false);

    // Comment moderation (published article's comments)
    const [comments, setComments] = useState([]);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [deletingCommentId, setDeletingCommentId] = useState(null);

    useEffect(() => {
        const fetchArticle = async () => {
            try {
                const res = await api.get(`/cms/staged/${id}`);
                const data = res.data;
                // Sign any inline S3 keys in the body so BodyRenderer shows real images
                if (data.body) {
                    data.body = await signBodyImageSrcs(data.body);
                }
                setArticle(data);
                setNoteText(data.editorNote || '');
                if (data.publishedArticleId) fetchComments(data.publishedArticleId);
            } catch {
                setError('Failed to load article.');
            } finally {
                setLoading(false);
            }
        };
        fetchArticle();
    }, [id]);

    const fetchComments = async (articleId) => {
        try {
            setCommentsLoading(true);
            const res = await api.get(`/cms/comments/${articleId}`);
            setComments(res.data);
        } catch { /* non-critical */ }
        finally { setCommentsLoading(false); }
    };

    const handleSaveNote = async () => {
        if (!noteText.trim()) return;
        try {
            setSavingNote(true);
            await api.put(`/cms/staged/${id}/note`, { note: noteText });
            setNoteSaved(true);
            setTimeout(() => setNoteSaved(false), 3000);
        } catch { alert('Failed to save note.'); }
        finally { setSavingNote(false); }
    };

    const handleRequestChanges = async () => {
        if (!changesNote.trim()) { setChangesError('Please write your feedback before sending.'); return; }
        try {
            setSubmittingChanges(true); setChangesError('');
            await api.put(`/cms/staged/${id}/request-changes`, { editorNote: changesNote });
            setShowChangesModal(false); setChangesNote('');
            navigate('/editor-dashboard');
        } catch (err) {
            setChangesError(err.response?.data?.message || 'Failed to send feedback.');
        } finally { setSubmittingChanges(false); }
    };

    const handlePublish = async () => {
        try {
            setPublishing(true);
            const res = await api.post(`/cms/staged/${id}/publish`);
            setPublishSuccess(res.data);
            setShowPublishConfirm(false);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to publish article.');
        } finally { setPublishing(false); }
    };

    const handleDeleteComment = async (commentId) => {
        if (!window.confirm('Remove this comment?')) return;
        try {
            setDeletingCommentId(commentId);
            await api.delete(`/cms/comments/${commentId}`);
            setComments(prev => prev.filter(c => c.id !== commentId));
        } catch { alert('Failed to remove comment.'); }
        finally { setDeletingCommentId(null); }
    };

    if (loading) return (
        <div className="min-h-screen bg-bg-primary"><Navbar />
            <div className="flex items-center justify-center py-32">
                <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
        </div>
    );
    if (error) return (
        <div className="min-h-screen bg-bg-primary"><Navbar />
            <div className="max-w-4xl mx-auto px-6 py-12 text-danger text-center">{error}</div>
        </div>
    );
    if (publishSuccess) return (
        <div className="min-h-screen bg-bg-primary flex items-center justify-center">
            <div className="text-center max-w-sm">
                <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
                    <HiOutlineCheckCircle className="w-10 h-10 text-success" />
                </div>
                <h2 className="text-2xl font-bold text-text-primary mb-2">Article Published!</h2>
                <p className="text-text-secondary text-sm mb-8">The article is now live in the main database.</p>
                <button onClick={() => navigate('/editor-dashboard')}
                    className="bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-semibold text-sm transition-all">
                    Back to Dashboard
                </button>
            </div>
        </div>
    );

    const isSubmitted = article.status === 'SUBMITTED';
    const relatedArticles = article ? [
        article.relatedArticle1,
        article.relatedArticle2,
        article.relatedArticle3,
        article.relatedArticle4
    ].filter(Boolean) : [];

    return (
        <div className="min-h-screen bg-bg-primary">
            <Navbar />

            <div className="max-w-4xl mx-auto px-6 lg:px-8 py-8 space-y-6">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <button onClick={() => navigate('/editor-dashboard')}
                        className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm font-medium transition-colors self-start">
                        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Submissions
                    </button>
                    <div className="flex items-center gap-3">
                        <StatusBadge status={article.status} />
                        {isSubmitted && (
                            <>
                                <button onClick={() => setShowChangesModal(true)}
                                    className="flex items-center gap-2 border border-amber-500/30 text-amber-400 hover:bg-amber-500/10 px-4 py-2 rounded-xl font-semibold text-sm transition-all">
                                    <HiOutlineExclamationCircle className="w-4 h-4" /> Request Changes
                                </button>
                                <button onClick={() => setShowPublishConfirm(true)}
                                    className="flex items-center gap-2 bg-success hover:bg-success/80 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-all shadow-lg shadow-success/20">
                                    <HiOutlineCheckCircle className="w-4 h-4" /> Publish
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Article card ── */}
                <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                    {/* Meta */}
                    <div className="border-b border-border px-8 py-5 flex flex-wrap gap-5 text-sm text-text-secondary">
                        <span className="flex items-center gap-2">
                            <HiOutlineUser className="w-4 h-4 text-text-tertiary" />
                            <strong className="text-text-primary">{article.submittedBy?.name}</strong>
                            <span className="text-text-tertiary">{article.submittedBy?.email}</span>
                        </span>
                        {article.submittedAt && (
                            <span className="flex items-center gap-2">
                                <HiOutlineClock className="w-4 h-4 text-text-tertiary" />
                                {new Date(article.submittedAt).toLocaleString('en-IN')}
                            </span>
                        )}
                        {article.readTime && (
                            <span className="text-text-tertiary">{article.readTime} read</span>
                        )}
                        {article.type && (
                            <span className="px-2.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent text-xs font-semibold">
                                {article.type}
                            </span>
                        )}
                        {article.tags?.length > 0 && (
                            <span className="flex items-center gap-2">
                                <HiOutlineTag className="w-4 h-4 text-text-tertiary" />
                                {article.tags.join(', ')}
                            </span>
                        )}
                    </div>

                    <div className="px-8 py-8 space-y-8">
                        {/* Title & Slug */}
                        <div className="space-y-2">
                            <h1 className="text-3xl font-bold text-text-primary leading-tight">
                                {article.title || <span className="text-text-tertiary italic">Untitled</span>}
                            </h1>
                            {article.slug && (
                                <p className="text-sm font-mono font-medium text-accent">/{article.slug}</p>
                            )}
                        </div>

                        {/* Short description */}
                        {article.shortDescription && (
                            <p className="text-text-secondary text-base leading-relaxed border-l-4 border-accent/40 pl-4 italic">
                                {article.shortDescription}
                            </p>
                        )}

                        {/* Main image */}
                        {article.mainImage && (
                            <S3Image s3Key={article.mainImage} alt="Cover"
                                className="w-full rounded-xl object-cover max-h-80" />
                        )}

                        {/* Body */}
                        {article.body ? (
                            <TipTapEditor content={article.body} editable={false} />
                        ) : (
                            <p className="text-text-tertiary italic">No body content yet.</p>
                        )}

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

                        {/* Gallery images */}
                        {article.images?.length > 0 && (
                            <div>
                                <p className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                                    <HiOutlinePhotograph className="w-4 h-4" /> Gallery ({article.images.length})
                                </p>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {article.images.map((img) => (
                                        <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border">
                                            <S3Image s3Key={img.src} alt={img.alt || ''}
                                                className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300" />
                                            {(img.caption || img.alt) && (
                                                <div className="absolute bottom-0 inset-x-0 bg-black/60 px-3 py-1.5 text-white text-xs">
                                                    {img.caption || img.alt}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Related Articles */}
                        {relatedArticles.length > 0 && (
                            <div>
                                <p className="flex items-center gap-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
                                    <HiOutlineExternalLink className="w-4 h-4" /> Related Articles
                                </p>
                                <div className="space-y-2">
                                    {relatedArticles.map(n => (
                                        <div key={n.id} className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer" onClick={() => window.open(`/article/${n.slug || n.id}`, '_blank')}>
                                            <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                                            <span className="underline decoration-border hover:decoration-accent/50 underline-offset-4">{n.title}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Note to Journalist ── */}
                <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                    <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                        <HiOutlinePencil className="w-5 h-5 text-amber-400" />
                        <h2 className="text-text-primary font-semibold text-sm">Note to Journalist</h2>
                        <span className="ml-auto text-xs text-text-tertiary">Visible to the journalist — does not change article status</span>
                    </div>
                    <div className="px-6 py-5">
                        {article.editorNote && !noteText && (
                            <div className="mb-3 flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                                <HiOutlineExclamationCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                                <p className="text-amber-300/80 text-sm">Current note: <em>{article.editorNote}</em></p>
                            </div>
                        )}
                        <textarea
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            rows={3}
                            placeholder="Write a note to the journalist (e.g. reminder, context, suggestion)..."
                            className="w-full bg-bg-primary border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary text-sm resize-none focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/10 transition-all mb-3"
                        />
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveNote}
                                disabled={savingNote || !noteText.trim()}
                                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                            >
                                {savingNote ? 'Saving...' : 'Save Note'}
                            </button>
                            {noteSaved && <span className="text-success text-xs font-medium">✓ Note saved — journalist will see it</span>}
                        </div>
                    </div>
                </div>

                {/* ── Comment Moderation ── */}
                {article.publishedArticleId && (
                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
                            <HiOutlineChatAlt2 className="w-5 h-5 text-text-tertiary" />
                            <h2 className="text-text-primary font-semibold text-sm">Comment Moderation</h2>
                            <span className="ml-auto text-xs text-text-tertiary font-medium bg-bg-primary px-2.5 py-1 rounded-full border border-border">
                                {comments.length} comment{comments.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                        {commentsLoading ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="py-10 text-center text-text-tertiary text-sm">No comments on this article yet.</div>
                        ) : (
                            <div className="divide-y divide-border">
                                {comments.map(comment => (
                                    <div key={comment.id} className="flex items-start gap-4 px-6 py-4 hover:bg-bg-primary/30 group transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                                            {comment.user?.profileImage
                                                ? <img src={comment.user.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
                                                : <HiOutlineUser className="w-4 h-4 text-accent" />
                                            }
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-text-primary text-sm font-medium">{comment.user?.name || 'Unknown'}</span>
                                                <span className="text-text-tertiary text-xs">{new Date(comment.createdAt).toLocaleString('en-IN')}</span>
                                            </div>
                                            <p className="text-text-secondary text-sm leading-relaxed">{comment.text}</p>
                                        </div>
                                        <button onClick={() => handleDeleteComment(comment.id)} disabled={deletingCommentId === comment.id}
                                            className="flex-shrink-0 p-1.5 text-text-tertiary hover:text-danger hover:bg-danger/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 bg-transparent border-none">
                                            {deletingCommentId === comment.id
                                                ? <div className="w-4 h-4 border-2 border-danger/30 border-t-danger rounded-full animate-spin" />
                                                : <HiOutlineTrash className="w-4 h-4" />}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* ── Request Changes Modal ── */}
            {showChangesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-lg shadow-2xl">
                        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
                            <h3 className="text-text-primary font-bold text-lg">Request Changes</h3>
                            <button onClick={() => { setShowChangesModal(false); setChangesError(''); setChangesNote(''); }}
                                className="text-text-tertiary hover:text-text-primary transition-colors bg-transparent border-none p-0">
                                <HiOutlineX className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="px-6 py-5">
                            <p className="text-text-secondary text-sm mb-4">
                                This will change the article status to <strong className="text-amber-400">Revision</strong> and notify the journalist.
                            </p>
                            <textarea value={changesNote} onChange={(e) => setChangesNote(e.target.value)} rows={5}
                                placeholder="e.g. The headline is misleading. Please revise the intro paragraph..."
                                className="w-full bg-bg-primary border border-border rounded-xl px-4 py-3 text-text-primary placeholder-text-tertiary text-sm resize-none focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all" />
                            {changesError && <p className="text-danger text-xs mt-2 font-medium">{changesError}</p>}
                        </div>
                        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border">
                            <button onClick={() => { setShowChangesModal(false); setChangesError(''); setChangesNote(''); }}
                                className="px-5 py-2.5 text-text-secondary hover:text-text-primary border border-border rounded-xl text-sm font-medium transition-all">
                                Cancel
                            </button>
                            <button onClick={handleRequestChanges} disabled={submittingChanges}
                                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                                {submittingChanges ? 'Sending...' : 'Send Feedback'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Publish Confirm Modal ── */}
            {showPublishConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
                    <div className="bg-bg-secondary border border-border rounded-2xl w-full max-w-md shadow-2xl">
                        <div className="px-6 py-8 text-center">
                            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                                <HiOutlineCheckCircle className="w-8 h-8 text-success" />
                            </div>
                            <h3 className="text-text-primary font-bold text-xl mb-2">Publish Article?</h3>
                            <p className="text-text-secondary text-sm leading-relaxed">
                                This copies the article to the live database. This action cannot be undone.
                            </p>
                        </div>
                        <div className="flex gap-3 px-6 pb-6">
                            <button onClick={() => setShowPublishConfirm(false)}
                                className="flex-1 py-3 text-text-secondary border border-border rounded-xl text-sm font-medium hover:text-text-primary transition-all">
                                Cancel
                            </button>
                            <button onClick={handlePublish} disabled={publishing}
                                className="flex-1 py-3 bg-success hover:bg-success/80 text-white rounded-xl text-sm font-semibold transition-all disabled:opacity-50">
                                {publishing ? 'Publishing...' : 'Yes, Publish'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EditorReview;
