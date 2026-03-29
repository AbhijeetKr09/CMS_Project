import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { HiOutlinePlus, HiOutlineLogout, HiOutlineUser } from 'react-icons/hi';

const Navbar = () => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();
    const [showDropdown, setShowDropdown] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const displayName = user?.name || user?.email || 'Admin';
    const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

    return (
        <header className="sticky top-0 z-50 bg-bg-secondary/80 backdrop-blur-xl border-b border-border">
            <div className="max-w-7xl mx-auto px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* Logo */}
                    <div
                        className="flex items-center gap-3 cursor-pointer group"
                        onClick={() => navigate('/dashboard')}
                    >
                        <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center group-hover:scale-105 transition-transform p-1.5">
                            <img src="/icon.svg" alt="Avionyz" className="w-full h-full" style={{ filter: 'brightness(0) invert(1)' }} />
                        </div>
                        <span className="text-text-primary font-bold text-lg tracking-tight">
                            Avionyz <span className="text-text-tertiary font-normal text-sm">CMS</span>
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/editor')}
                            className="flex items-center gap-2 bg-accent hover:bg-accent-hover text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-all duration-200 shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:-translate-y-0.5"
                        >
                            <HiOutlinePlus className="w-4 h-4" />
                            New Article
                        </button>

                        {/* User dropdown */}
                        <div className="relative" ref={dropdownRef}>
                            <button
                                onClick={() => setShowDropdown(!showDropdown)}
                                className="w-9 h-9 rounded-full bg-bg-tertiary border-2 border-border hover:border-accent/50 flex items-center justify-center transition-all text-sm font-semibold text-text-secondary"
                            >
                                {initials}
                            </button>

                            {showDropdown && (
                                <div className="absolute right-0 mt-2 w-56 bg-bg-secondary border border-border rounded-xl shadow-2xl shadow-black/40 py-2 animate-in fade-in slide-in-from-top-2">
                                    <div className="px-4 py-3 border-b border-border">
                                        <p className="text-sm font-medium text-text-primary truncate">{displayName}</p>
                                        <p className="text-xs text-text-tertiary truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-secondary hover:text-danger hover:bg-danger/5 transition-colors bg-transparent border-none text-left"
                                    >
                                        <HiOutlineLogout className="w-4 h-4" />
                                        Sign Out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
