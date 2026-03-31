import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    HiOutlineNewspaper,
    HiOutlinePencil,
    HiOutlineDocumentAdd,
    HiOutlineClipboardList,
    HiOutlineChevronLeft,
    HiOutlineChevronRight,
    HiOutlineLogout,
    HiOutlineExclamationCircle,
    HiOutlineCheckCircle,
    HiOutlineCalendar,
    HiOutlineTrendingUp,
    HiOutlineUser,
    HiOutlineFilm,
    HiOutlineChartBar,
    HiOutlineUsers,
    HiOutlinePaperAirplane,
    HiOutlineAnnotation,
} from 'react-icons/hi';

const CmsSidebar = ({ activeTab, onTabChange, counts = {} }) => {
    const [collapsed, setCollapsed] = useState(false);
    const navigate = useNavigate();
    const { user, role, logout } = useAuth();

    const journalistTabs = [
        {
            id: 'all-articles',
            label: 'All Articles',
            icon: HiOutlineNewspaper,
            description: 'Published articles (read-only)',
        },
        {
            id: 'needs-changes',
            label: 'Needs Changes',
            icon: HiOutlineExclamationCircle,
            description: 'Sent back by editor',
            badge: counts.needsChanges,
            badgeColor: 'bg-amber-500',
        },
        {
            id: 'my-submissions',
            label: 'My Submissions',
            icon: HiOutlineClipboardList,
            description: 'All my staged articles',
        },
        {
            id: 'write-new',
            label: 'Write New',
            icon: HiOutlineDocumentAdd,
            description: 'Start a new article',
            action: () => navigate('/editor'),
        },
    ];

    const editorTabs = [
        {
            id: 'submissions',
            label: 'Submissions',
            icon: HiOutlineClipboardList,
            description: 'Articles pending review',
            badge: counts.submissions,
            badgeColor: 'bg-blue-500',
        },
        {
            id: 'published',
            label: 'Published',
            icon: HiOutlineCheckCircle,
            description: 'Live articles',
        },
    ];

    // Management tabs visible to EDITOR + ADMIN only
    const manageTabs = [
        { id: 'events',               label: 'Events',              icon: HiOutlineCalendar,      action: () => navigate('/admin/events') },
        { id: 'social-trends',        label: 'Social Trends',       icon: HiOutlineTrendingUp,    action: () => navigate('/admin/social-trends') },
        { id: 'experts',              label: 'Experts',             icon: HiOutlineUser,          action: () => navigate('/admin/experts') },
        { id: 'media',                label: 'Media',               icon: HiOutlineFilm,          action: () => navigate('/admin/media') },
        { id: 'analytical-articles',  label: 'Analytical Articles', icon: HiOutlineChartBar,      action: () => navigate('/admin/analytical-articles') },
        { id: 'users',                label: 'Users',               icon: HiOutlineUsers,         action: () => navigate('/admin/users') },
        { id: 'airlines',             label: 'Airlines & Reviews',  icon: HiOutlinePaperAirplane, action: () => navigate('/admin/airlines') },
        { id: 'comments',             label: 'Comments',            icon: HiOutlineAnnotation,    action: () => navigate('/admin/comments') },
    ];

    const tabs = role === 'EDITOR' || role === 'ADMIN' ? editorTabs : journalistTabs;
    const isEditorOrAdmin = role === 'EDITOR' || role === 'ADMIN';

    const handleTabClick = (tab) => {
        if (tab.action) {
            tab.action();
        } else {
            onTabChange(tab.id);
        }
    };


    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside
            className="flex flex-col h-screen bg-bg-secondary border-r border-border flex-shrink-0 transition-all duration-300 ease-in-out"
            style={{ width: collapsed ? '72px' : '240px' }}
        >
            {/* Logo + collapse toggle */}
            <div className="flex items-center justify-between px-4 py-5 border-b border-border min-h-[72px]">
                {!collapsed && (
                    <div className="flex items-center gap-2.5 overflow-hidden">
                        <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0 p-1.5">
                            <img src="/icon.svg" alt="Avionyz" className="w-full h-full" style={{ filter: 'brightness(0) invert(1)' }} />
                        </div>
                        <div className="leading-tight overflow-hidden">
                            <p className="text-text-primary font-bold text-sm truncate">CMS</p>
                            <p className="text-text-tertiary text-xs capitalize truncate">{role?.toLowerCase()}</p>
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mx-auto p-1.5">
                        <img src="/icon.svg" alt="Avionyz" className="w-full h-full" style={{ filter: 'brightness(0) invert(1)' }} />
                    </div>
                )}
                {!collapsed && (
                    <button
                        onClick={() => setCollapsed(true)}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-primary transition-all bg-transparent border-none flex-shrink-0"
                    >
                        <HiOutlineChevronLeft className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Expand button when collapsed */}
            {collapsed && (
                <button
                    onClick={() => setCollapsed(false)}
                    className="mx-auto mt-3 p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-primary transition-all bg-transparent border-none"
                >
                    <HiOutlineChevronRight className="w-4 h-4" />
                </button>
            )}

            {/* Navigation tabs */}
            <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
                {/* Article workflow tabs */}
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => handleTabClick(tab)}
                            title={collapsed ? tab.label : undefined}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all bg-transparent border-none text-left relative
                                ${isActive
                                    ? 'bg-accent/10 text-accent'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
                                }
                                ${collapsed ? 'justify-center' : ''}
                            `}
                        >
                            <Icon className="w-5 h-5 flex-shrink-0" />
                            {!collapsed && (
                                <span className="flex-1 truncate">{tab.label}</span>
                            )}
                            {!collapsed && tab.badge > 0 && (
                                <span className={`${tab.badgeColor} text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center`}>
                                    {tab.badge}
                                </span>
                            )}
                            {collapsed && tab.badge > 0 && (
                                <span className={`absolute top-1 right-1 w-2 h-2 rounded-full ${tab.badgeColor}`} />
                            )}
                        </button>
                    );
                })}

                {/* Manage Content section (EDITOR + ADMIN only) */}
                {isEditorOrAdmin && (
                    <>
                        <div className={`${collapsed ? 'mx-2 my-2' : 'mx-1 my-2'} border-t border-border`} />
                        {!collapsed && (
                            <p className="px-3 py-1 text-xs font-bold text-text-tertiary uppercase tracking-wider">Manage Content</p>
                        )}
                        {manageTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => handleTabClick(tab)}
                                    title={collapsed ? tab.label : undefined}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all bg-transparent border-none text-left relative
                                        ${isActive
                                            ? 'bg-accent/10 text-accent'
                                            : 'text-text-secondary hover:text-text-primary hover:bg-bg-primary'
                                        }
                                        ${collapsed ? 'justify-center' : ''}
                                    `}
                                >
                                    <Icon className="w-5 h-5 flex-shrink-0" />
                                    {!collapsed && <span className="flex-1 truncate">{tab.label}</span>}
                                </button>
                            );
                        })}
                    </>
                )}
            </nav>


            {/* User footer */}
            <div className="border-t border-border px-2 py-3">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${collapsed ? 'justify-center flex-col' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                        <span className="text-accent text-xs font-bold uppercase">
                            {user?.name?.[0] || '?'}
                        </span>
                    </div>
                    {!collapsed && (
                        <div className="flex-1 min-w-0">
                            <p className="text-text-primary text-xs font-semibold truncate">{user?.name}</p>
                            <p className="text-text-tertiary text-xs truncate">{user?.email}</p>
                        </div>
                    )}
                    <button
                        onClick={handleLogout}
                        title="Logout"
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all bg-transparent border-none flex-shrink-0"
                    >
                        <HiOutlineLogout className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default CmsSidebar;
