import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [profile, setProfile] = useState({ name: '', email: '', bio: '' });
    const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleNav = (tab) => {
        const routes = {
            'dashboard': '/dashboard',
            'editor-dashboard': '/editor-dashboard',
            'users': '/admin/users',
        };
        if (routes[tab]) navigate(routes[tab]);
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await api.get('/cms/users/me');
                setProfile({
                    name: res.data.name || '',
                    email: res.data.email || '',
                    bio: res.data.bio || '',
                });
            } catch {
                setMessage({ text: 'Failed to load profile details.', type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, []);

    const handleChangeProfile = (e) =>
        setProfile((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleChangePasswords = (e) =>
        setPasswords((prev) => ({ ...prev, [e.target.name]: e.target.value }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });

        const payload = { ...profile };

        if (passwords.newPassword) {
            if (!passwords.oldPassword) {
                setMessage({ text: 'Current password is required to set a new password.', type: 'error' });
                setSaving(false);
                return;
            }
            if (passwords.newPassword.length < 8) {
                setMessage({ text: 'New password must be at least 8 characters.', type: 'error' });
                setSaving(false);
                return;
            }
            payload.oldPassword = passwords.oldPassword;
            payload.newPassword = passwords.newPassword;
        }

        try {
            const res = await api.put('/cms/users/me', payload);
            setMessage({ text: res.data.message || 'Profile updated successfully.', type: 'success' });
            setPasswords({ oldPassword: '', newPassword: '' });
        } catch (err) {
            setMessage({ text: err.response?.data?.message || 'Failed to update profile.', type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    const inputCls =
        'w-full px-4 py-3 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all';

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="profile" onTabChange={handleNav} counts={{}} />

            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">

                    {/* Header */}
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Profile Settings</h1>
                        <p className="text-text-secondary text-sm mt-1">
                            Manage your name, contact, about section, and password
                        </p>
                    </div>

                    <div className="bg-bg-secondary border border-border rounded-2xl p-6">
                        {loading ? (
                            <div className="flex justify-center py-20">
                                <div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-8">

                                {/* Status message */}
                                {message.text && (
                                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${
                                        message.type === 'error'
                                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                                            : 'bg-green-500/10 text-green-400 border-green-500/20'
                                    }`}>
                                        {message.text}
                                    </div>
                                )}

                                {/* ── Basic Info ── */}
                                <div className="space-y-4">
                                    <h2 className="text-base font-bold text-text-primary">Basic Information</h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                                                Full Name
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={profile.name}
                                                onChange={handleChangeProfile}
                                                className={inputCls}
                                                placeholder="Your full name"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                                                Email Address
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                value={profile.email}
                                                onChange={handleChangeProfile}
                                                className={inputCls}
                                                placeholder="you@example.com"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── About / Bio ── */}
                                <div className="space-y-3 pt-6 border-t border-border">
                                    <div>
                                        <h2 className="text-base font-bold text-text-primary">About You</h2>
                                        <p className="text-text-tertiary text-xs mt-0.5">
                                            Visible to editors — describe your beat, background, and expertise.
                                        </p>
                                    </div>
                                    <textarea
                                        name="bio"
                                        rows={6}
                                        maxLength={1000}
                                        value={profile.bio}
                                        onChange={handleChangeProfile}
                                        placeholder="e.g. Aviation journalist with 8 years covering MRO, sustainability, and commercial aircraft trends. Previously at Flight Global and ATW..."
                                        className={`${inputCls} resize-none placeholder-text-tertiary leading-relaxed`}
                                    />
                                    <p className="text-text-tertiary text-xs text-right">
                                        {profile.bio.length} / 1000
                                    </p>
                                </div>

                                {/* ── Change Password ── */}
                                <div className="space-y-4 pt-6 border-t border-border">
                                    <div>
                                        <h2 className="text-base font-bold text-text-primary">
                                            Change Password{' '}
                                            <span className="text-sm font-normal text-text-tertiary">(optional)</span>
                                        </h2>
                                        <p className="text-text-tertiary text-xs mt-0.5">
                                            Leave blank if you don't want to change your password.
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                                                Current Password
                                            </label>
                                            <input
                                                type="password"
                                                name="oldPassword"
                                                value={passwords.oldPassword}
                                                onChange={handleChangePasswords}
                                                className={inputCls}
                                                placeholder="Enter current password"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1.5">
                                                New Password
                                            </label>
                                            <input
                                                type="password"
                                                name="newPassword"
                                                minLength={8}
                                                value={passwords.newPassword}
                                                onChange={handleChangePasswords}
                                                className={inputCls}
                                                placeholder="At least 8 characters"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Save ── */}
                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="px-6 py-3 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold disabled:opacity-60 transition-all cursor-pointer"
                                    >
                                        {saving ? 'Saving...' : 'Save Profile Changes'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Profile;
