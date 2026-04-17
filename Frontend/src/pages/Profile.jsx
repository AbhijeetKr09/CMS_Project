import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CmsSidebar from '../components/cms/CmsSidebar';
import { useAuth } from '../context/AuthContext';

const Profile = () => {
    const navigate = useNavigate();
    const { logout } = useAuth();
    const [profile, setProfile] = useState({ name: '', email: '' });
    const [passwords, setPasswords] = useState({ oldPassword: '', newPassword: '' });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const handleNav = (tab) => {
        const routes = {
            'dashboard': '/dashboard',
            'editor-dashboard': '/editor-dashboard',
            'users': '/admin/users'
        };
        if (routes[tab]) navigate(routes[tab]);
    };

    useEffect(() => {
        const loadProfile = async () => {
            try {
                const res = await api.get('/cms/users/me');
                setProfile({ name: res.data.name || '', email: res.data.email || '' });
            } catch (err) {
                setMessage({ text: 'Failed to load profile details.', type: 'error' });
            } finally {
                setLoading(false);
            }
        };
        loadProfile();
    }, []);

    const handleChangeProfile = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
    const handleChangePasswords = (e) => setPasswords({ ...passwords, [e.target.name]: e.target.value });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage({ text: '', type: '' });

        const payload = { ...profile };
        if (passwords.newPassword) {
            if (!passwords.oldPassword) {
                setMessage({ text: 'Old password is required to set a new password.', type: 'error' });
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

    return (
        <div className="flex h-screen bg-bg-primary overflow-hidden">
            <CmsSidebar activeTab="profile" onTabChange={handleNav} counts={{}} />
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary">Profile Settings</h1>
                        <p className="text-text-secondary text-sm mt-1">Manage your basic information and password</p>
                    </div>

                    <div className="bg-bg-secondary border border-border rounded-2xl overflow-hidden p-6">
                        {loading ? (
                            <div className="flex justify-center py-20"><div className="w-7 h-7 border-2 border-accent border-t-transparent rounded-full animate-spin" /></div>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-6">
                                {message.text && (
                                    <div className={`px-4 py-3 rounded-xl text-sm font-semibold border ${message.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-green-500/10 text-green-500 border-green-500/20'}`}>
                                        {message.text}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <h2 className="text-lg font-bold text-text-primary">Basic Information</h2>
                                    <div>
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Full Name</label>
                                        <input type="text" name="name" required value={profile.name} onChange={handleChangeProfile}
                                            className="w-full px-4 py-3 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Email Address</label>
                                        <input type="email" name="email" required value={profile.email} onChange={handleChangeProfile}
                                            className="w-full px-4 py-3 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" />
                                    </div>
                                </div>

                                <div className="space-y-4 pt-6 border-t border-border">
                                    <h2 className="text-lg font-bold text-text-primary">Change Password (Optional)</h2>
                                    <div>
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">Old Password</label>
                                        <input type="password" name="oldPassword" value={passwords.oldPassword} onChange={handleChangePasswords}
                                            className="w-full px-4 py-3 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" placeholder="Enter current password" />
                                    </div>
                                    <div>
                                        <label className="text-xs font-semibold text-text-secondary uppercase tracking-wider block mb-1">New Password</label>
                                        <input type="password" minLength={8} name="newPassword" value={passwords.newPassword} onChange={handleChangePasswords}
                                            className="w-full px-4 py-3 rounded-xl border border-border bg-bg-primary text-text-primary text-sm focus:outline-none focus:border-accent transition-all" placeholder="Make it at least 8 characters" />
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button type="submit" disabled={saving} className="px-6 py-3 rounded-xl bg-accent text-white text-sm font-semibold disabled:opacity-60 transition-all cursor-pointer">
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
