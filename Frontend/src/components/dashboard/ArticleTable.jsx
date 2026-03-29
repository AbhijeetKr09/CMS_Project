import React from 'react';
import { format } from 'date-fns';
import { HiOutlinePencil, HiOutlineTrash, HiOutlinePhotograph } from 'react-icons/hi';

const ArticleTable = ({ articles, onEdit, onDelete }) => {
    if (!articles || articles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-text-tertiary">
                <svg className="w-16 h-16 mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
                <p className="text-lg font-medium">No articles found</p>
                <p className="text-sm mt-1">Create your first article to get started</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border">
                        <th className="text-left py-4 px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Article</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider hidden md:table-cell">Type</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider hidden sm:table-cell">Date</th>
                        <th className="text-left py-4 px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider hidden lg:table-cell">Tags</th>
                        <th className="text-right py-4 px-4 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                    {articles.map((article) => (
                        <tr
                            key={article.id}
                            className="group hover:bg-bg-tertiary/30 transition-colors cursor-pointer"
                            onClick={() => onEdit(article.id)}
                        >
                            <td className="py-4 px-4">
                                <div className="flex items-center gap-4">
                                    {article.mainImageUrl ? (
                                        <img
                                            src={article.mainImageUrl}
                                            alt=""
                                            className="w-12 h-12 rounded-lg object-cover border border-border flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-bg-tertiary border border-border flex items-center justify-center flex-shrink-0">
                                            <HiOutlinePhotograph className="w-5 h-5 text-text-tertiary" />
                                        </div>
                                    )}
                                    <div className="min-w-0">
                                        <p className="font-medium text-text-primary truncate max-w-xs group-hover:text-accent transition-colors">
                                            {article.title}
                                        </p>
                                        {article.shortDescription && (
                                            <p className="text-xs text-text-tertiary truncate max-w-xs mt-0.5">
                                                {article.shortDescription}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="py-4 px-4 hidden md:table-cell">
                                {article.type ? (
                                    <span className="inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                                        {article.type}
                                    </span>
                                ) : (
                                    <span className="text-text-tertiary text-sm">—</span>
                                )}
                            </td>
                            <td className="py-4 px-4 hidden sm:table-cell">
                                <span className="text-sm text-text-secondary">
                                    {article.timestampDate
                                        ? format(new Date(article.timestampDate), 'dd MMM, yyyy')
                                        : '—'}
                                </span>
                            </td>
                            <td className="py-4 px-4 hidden lg:table-cell">
                                <div className="flex flex-wrap gap-1.5 max-w-[200px]">
                                    {(article.tags || []).slice(0, 3).map((tag) => (
                                        <span key={tag} className="inline-flex px-2 py-0.5 rounded-md text-xs bg-bg-tertiary text-text-secondary border border-border">
                                            {tag}
                                        </span>
                                    ))}
                                    {(article.tags || []).length > 3 && (
                                        <span className="text-xs text-text-tertiary">+{article.tags.length - 3}</span>
                                    )}
                                </div>
                            </td>
                            <td className="py-4 px-4">
                                <div className="flex items-center justify-end gap-1.5">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onEdit(article.id); }}
                                        className="p-2 rounded-lg text-text-tertiary hover:text-accent hover:bg-accent/10 transition-all bg-transparent border-none"
                                        title="Edit"
                                    >
                                        <HiOutlinePencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                                        className="p-2 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all bg-transparent border-none"
                                        title="Delete"
                                    >
                                        <HiOutlineTrash className="w-4 h-4" />
                                    </button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ArticleTable;
