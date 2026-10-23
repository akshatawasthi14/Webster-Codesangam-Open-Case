import React, { useState } from 'react';
import { Shield, UserPlus, Lock, Mail, User, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export function RegisterPage({ onNavigate }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 10) {
      setError('Password must be at least 10 characters long.');
      return;
    }

    setLoading(true);
    try {
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      onNavigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please check your credentials.');
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
          Student Self-Registration
        </h1>
        <p className="text-xs text-silver-600">
          Create your verified student account to file named petitions.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-silver-300 p-6 sm:p-8 shadow-sm space-y-6">
        {error && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-900 text-xs rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegisterSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="reg-name" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-silver-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Maya Patel"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-email" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Institutional Student Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-silver-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                className="w-full pl-10 pr-4 py-2.5 text-xs bg-silver-50 border border-silver-300 rounded-xl focus:border-marigold-500 focus:bg-white text-silver-900"
              />
            </div>
            <span className="text-[10px] text-silver-500">
              Only authorized institutional college email domains are accepted.
            </span>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="reg-password" className="block text-xs font-bold text-silver-800 uppercase tracking-wider">
              Password (min 10 characters)
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-silver-400 absolute left-3.5 top-3.5" />
              <input
                id="reg-password"
                type="password"
                required
                minLength={10}
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
            <UserPlus className="w-4 h-4 text-marigold-400" />
            <span>{loading ? 'Registering Account...' : 'Create Student Account'}</span>
          </button>
        </form>
      </div>

      <div className="text-center text-xs text-silver-600">
        Already have a registered account?{' '}
        <button
          type="button"
          onClick={() => onNavigate('/login')}
          className="font-bold text-aubergine-800 hover:text-aubergine-950 underline"
        >
          Sign In Here
        </button>
      </div>
    </div>
  );
}

