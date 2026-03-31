import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import {
    HiOutlineSearch, HiOutlineTrash, HiOutlineChat,
    HiOutlineUser, HiOutlineExternalLink, HiOutlineChevronLeft,
    HiOutlineChevronRight,
} from 'react-icons/hi';

const useSidebarNav = (navigate) => (tab) => {
    const routes = {
        'events': '/admin/events', 'social-trends': '/admin/social-trends',
        'experts': '/admin/experts', 'media': '/admin/media',
        'analytical-articles': '/admin/analytical-articles',
        'users': '/admin/users', 'airlines': '/admin/airlines',
        'comments': '/admin/comments',
        'submissions': '/editor-dashboard', 'published': '/editor-dashboard',
    };
    if (routes[tab]) navigate(routes[tab]);
};

// ── Time ago helper ───────────────────────────────────────────────────────────
const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins  = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days  = Math.floor(diff / 86400000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
};

// ── Comment row ───────────────────────────────────────────────────────────────
const CommentRow = ({ comment, onDelete }) => {
    const [deleting, setDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Delete this comment by "${comment.user?.name || 'Unknown'}"?\n\n"${comment.text.slice(0, 80)}${comment.text.length > 80 ? '…' : ''}"`)) return;
        setDeleting(true);
        try {
            await api.delete(`/cms/comments/${comment.id}`);
            onDelete(comment.id);
        } catch (err) {
            alert(err.response?.data?.message || 'Delete failed.');
            setDeleting(false);
        }
    };

    return (
        <div className="flex items-start gap-4 px-5 py-4 hover:bg-bg-primary/40 group transition-colors">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                {comment.user?.profileImage ? (
                    <img src={comment.user.profileImage} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                    <span className="text-accent text-xs font-bold uppercase">
                        {comment.user?.name?.[0] || '?'}
                    </span>
                )}
            </div>

            <div className="flex-1 min-w-0">
                {/* User + article */}
                <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-text-primary text-sm font-semibold">
                        {comment.user?.name || 'Unknown user'}
                    </span>
                    <span className="text-text-tertiary text-xs">·</span>
                    <span className="text-text-tertiary text-xs">{timeAgo(comment.createdAt)}</span>
                    {comment.article && (
                        <>
                            <span className="text-text-tertiary text-xs">on</span>
                            <a
                                href={`/article/${comment.article.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent text-xs hover:underline flex items-center gap-0.5 max-w-[200px] truncate"
                            >
                                {comment.article.title}
                                <HiOutlineExternalLink className="w-3 h-3 flex-shrink-0" />
                            </a>
                        </>
                    )}
                </div>

                {/* Comment text */}
                <p className="text-text-secondary text-sm leading-relaxed">{comment.text}</p>

                {/* User email */}
                {comment.user?.email && (
                    <p className="text-text-tertiary text-xs mt-0.5">{comment.user.email}</p>
                )}
            </div>

            {/* Delete button */}
            <button
                onClick={handleDelete}
                disabled={deleting}
                title="Delete comment"
                className="p-2 rounded-lg text-text-tertiary hover:text-red-400 hover:bg-red-500/10 bg-transparent border-none transition-all opacity-0 group-hover:opacity-100 flex-shrink-0 disabled:opacity-40"
            >
                <HiOutlineTrash className="w-4 h-4" />
            </button>
        </div>
    );
};

// ── Comments Manager ──────────────────────────────────────────────────────────
const CommentsManager = () => {
    const navigate = useNavigate();
    const handleNav = useSidebarNav(navigate);

    const [comments, setComments]     = useState([]);
    const [total, setTotal]           = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [page, setPage]             = useState(1);
    const [search, setSearch]         = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [loading, setLoading]       = useState(true);

    // Debounce search
    useEffect(() => {
        const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
        return () => clearTimeout(t);
    }, [search]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/cms/comments', {
                params: { page, limit: 30, search: debouncedSearch || undefined },
            });
            setComments(res.data.comments || []);
            setTotal(res.data.total || 0);
            setTotalPages(res.data.totalPages || 1);
        } catch {
            setComments([]);
        } finally {
            setLoading(false);
        }
    }, [page, debouncedSearch]);

    useEffect(() => { load(); }, [load]);

    const handleDelete = (id) => {
        setComments(c => c.filter(x => x.id !== id));
        setTotal(t => t - 1);
    };

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="comments" onTabChange={handleNav} counts={{}} />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">

                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                                <HiOutlineChat className="w-6 h-6 text-accent" />
                                Comment Moderation
                            </h1>
                            <p className="text-text-secondary text-sm mt-1">
                                {total > 0 ? `${total} comment${total !== 1 ? 's' : ''} total` : 'No comments found'}
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                        <input
                            type="text"
                            placeholder="Search comment text…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent text-sm transition-all"
                        />
                    </div>

                    {/* Comments list */}
                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : comments.length === 0 ? (
                            <div className="flex flex-col items-center py-20 gap-3 text-text-tertiary">
                                <HiOutlineChat className="w-10 h-10 opacity-30" />
                                <p className="text-sm">{debouncedSearch ? 'No comments match your search.' : 'No comments yet.'}</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-border">
                                {comments.map(c => (
                                    <CommentRow key={c.id} comment={c} onDelete={handleDelete} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-3">
                            <button
                                onClick={() => setPage(p => p - 1)}
                                disabled={page <= 1}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-secondary hover:bg-bg-primary disabled:opacity-40 transition-all"
                            >
                                <HiOutlineChevronLeft className="w-4 h-4" /> Prev
                            </button>
                            <span className="text-sm text-text-tertiary">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page >= totalPages}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-bg-secondary border border-border rounded-lg text-text-secondary hover:bg-bg-primary disabled:opacity-40 transition-all"
                            >
                                Next <HiOutlineChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}

                </div>
            </main>
        </div>
    );
};

export default CommentsManager;
