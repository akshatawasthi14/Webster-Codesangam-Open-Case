import React, { useState } from 'react';
import { Shield, LogIn, Lock, Mail, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function LoginPage({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login({ email: email.trim(), password });
      if (user.role === 'STUDENT') onNavigate('/dashboard');
      else if (user.role === 'GRIEVANCE_OFFICER') onNavigate('/officer');
      else if (user.role === 'ADMINISTRATOR') onNavigate('/admin');
      else onNavigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 sm:py-24 space-y-8">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-2xl bg-aubergine-800 text-marigold-400 flex items-center justify-center mx-auto shadow-md border border-marigold-500/30">
          <Shield className="w-6 h-6" />
        </div>
        <h1 className="text-2xl font-extrabold text-aubergine-900 tracking-tight">
          Sign In to Open Case
        </h1>
        <p className="text-xs text-silver-600">
          Access your petitions, assigned review queues, or administrative dashboard.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLoginSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Institutional Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-silver-400 absolute left-3.5 top-3.5" />
              <input
                id="login-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="login-password" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-silver-400 absolute left-3.5 top-3.5" />
              <input
                id="login-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-aubergine-800 hover:bg-aubergine-900 active:bg-aubergine-950 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4 text-marigold-400" />
            <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
          </button>
        </form>

        <div className="pt-4 border-t border-silver-200">
          <div className="p-3 bg-silver-50 rounded-xl border border-silver-200 text-xs text-silver-600 flex items-start gap-2">
            <Info className="w-4 h-4 text-silver-400 flex-shrink-0 mt-0.5" />
            <span>
              Staff accounts (Officers and Administrators) are provisioned by institution administrators. Students can self-register with their college email.
            </span>
          </div>
        </div>
      </div>

      <div className="text-center text-xs text-silver-600">
        Enrolled student without an account?{' '}
        <button
          type="button"
          onClick={() => onNavigate('/register')}
          className="font-bold text-aubergine-800 hover:text-aubergine-950 underline"
        >
          Register with College Email
        </button>
      </div>
    </div>
  );
}
