import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HiOutlineMail, HiOutlineLockClosed, HiOutlineEye, HiOutlineEyeOff, HiOutlineUser } from 'react-icons/hi';

const Signup = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { signup } = useAuth();

    const handleSignup = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await signup(name, email, password);
            navigate('/dashboard');
        } catch (err) {
            setError(err.response?.data?.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen w-full">
            {/* Left branding panel */}
            <div className="hidden lg:flex flex-1 relative overflow-hidden bg-bg-secondary">
                <div className="absolute inset-0">
                    <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
                    <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl -translate-x-1/4 translate-y-1/4" />
                    <div className="absolute top-1/3 left-1/3 w-72 h-72 bg-indigo-500/5 rounded-full blur-3xl" />
                </div>
                <div className="relative z-10 flex flex-col justify-between p-12 w-full">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                                <span className="text-white font-bold text-lg">A</span>
                            </div>
                            <span className="text-text-primary font-bold text-xl tracking-tight">Avionyz</span>
                        </div>
                    </div>
                    <div className="max-w-md">
                        <h1 className="text-5xl font-extrabold text-text-primary leading-tight mb-4">
                            Join the<br />
                            <span className="bg-gradient-to-r from-success to-emerald-400 bg-clip-text text-transparent">
                                Editorial Team
                            </span>
                        </h1>
                        <p className="text-text-secondary text-lg leading-relaxed">
                            Get access to powerful publishing tools. Write, edit, and publish your stories to the world with ease.
                        </p>
                    </div>
                    <div className="flex items-center gap-6 text-text-tertiary text-sm">
                        <span>© 2026 Avionyz</span>
                        <span className="w-1 h-1 rounded-full bg-text-tertiary" />
                        <span>Content Management System</span>
                    </div>
                </div>
            </div>

            {/* Right signup form */}
            <div className="w-full lg:w-[520px] flex items-center justify-center bg-bg-primary p-8">
                <div className="w-full max-w-sm">
                    <div className="lg:hidden flex items-center gap-3 mb-10">
                        <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                            <span className="text-white font-bold text-lg">A</span>
                        </div>
                        <span className="text-text-primary font-bold text-xl tracking-tight">Avionyz CMS</span>
                    </div>

                    <h2 className="text-3xl font-bold text-text-primary mb-2">Create account</h2>
                    <p className="text-text-secondary mb-8">Start publishing in minutes</p>

                    {error && (
                        <div className="bg-danger/10 border border-danger/20 text-danger rounded-xl px-4 py-3 mb-6 text-sm font-medium flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Full Name
                            </label>
                            <div className="relative">
                                <HiOutlineUser className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    placeholder="John Doe"
                                    className="w-full pl-12 pr-4 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Email Address
                            </label>
                            <div className="relative">
                                <HiOutlineMail className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    placeholder="editor@avionyz.com"
                                    className="w-full pl-12 pr-4 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Password
                            </label>
                            <div className="relative">
                                <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="Min 6 characters"
                                    className="w-full pl-12 pr-12 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary transition-colors bg-transparent border-none p-0"
                                >
                                    {showPassword ? <HiOutlineEyeOff className="w-5 h-5" /> : <HiOutlineEye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                                Confirm Password
                            </label>
                            <div className="relative">
                                <HiOutlineLockClosed className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary w-5 h-5" />
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-12 pr-4 py-3.5 bg-bg-secondary border border-border rounded-xl text-text-primary placeholder-text-tertiary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 transition-all text-sm"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3.5 bg-accent hover:bg-accent-hover text-white font-semibold rounded-xl transition-all duration-200 shadow-lg shadow-accent/25 hover:shadow-accent/40 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-accent/25 text-sm mt-2"
                        >
                            {loading ? (
                                <span className="flex items-center justify-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating Account...
                                </span>
                            ) : 'Create Account'}
                        </button>
                    </form>

                    <p className="mt-8 text-center text-text-secondary text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-accent hover:text-accent-hover font-semibold transition-colors">
                            Sign In
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Signup;
