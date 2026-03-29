import React from 'react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';

const Pagination = ({ page, totalPages, setPage }) => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages = [];
        const maxVisible = 5;
        let start = Math.max(1, page - Math.floor(maxVisible / 2));
        let end = Math.min(totalPages, start + maxVisible - 1);
        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        return pages;
    };

    return (
        <div className="flex items-center justify-between py-4">
            <span className="text-sm text-text-tertiary">
                Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-1.5">
                <button
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <HiChevronLeft className="w-4 h-4" />
                </button>

                {getPageNumbers().map(num => (
                    <button
                        key={num}
                        onClick={() => setPage(num)}
                        className={`min-w-[36px] h-9 rounded-lg text-sm font-medium transition-all border ${num === page
                                ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20'
                                : 'bg-bg-secondary border-border text-text-secondary hover:text-text-primary hover:border-accent/50'
                            }`}
                    >
                        {num}
                    </button>
                ))}

                <button
                    disabled={page >= totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 rounded-lg bg-bg-secondary border border-border text-text-secondary hover:text-text-primary hover:border-accent/50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                    <HiChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default Pagination;
