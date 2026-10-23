import React, { useState } from 'react';
import {
  FilePlus2,
  Search,
  BarChart3,
  LayoutDashboard,
  LogOut,
  LogIn,
  UserPlus,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { NotificationDropdown } from './NotificationDropdown.jsx';
import { ROLE_LABELS } from '../utils/constants.js';

export function Navbar({ currentPath, onNavigate }) {
  const { user, isAuthenticated, logout, isStudent, isOfficer, isAdmin } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { id: 'home', label: 'HOME', path: '/' },
    ...(!isOfficer && !isAdmin
      ? [{ id: 'submit', label: 'SUBMIT', path: '/file' }]
      : []),
    { id: 'track', label: 'TRACK', path: '/track' },
    { id: 'transparency', label: 'TRANSPARENCY', path: '/transparency' },
  ];

  if (isAuthenticated) {
    if (isStudent) {
      navLinks.push({ id: 'dashboard', label: 'MY CASES', path: '/dashboard' });
    } else if (isOfficer) {
      navLinks.push({ id: 'officer', label: 'OFFICER QUEUE', path: '/officer' });
    } else if (isAdmin) {
      navLinks.push({ id: 'admin', label: 'ADMIN CONSOLE', path: '/admin' });
    }
  }

  const handleNav = (path) => {
    onNavigate(path);
    setMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#EBEAE5]/95 backdrop-blur-md border-b border-aubergine-900/15 text-aubergine-950 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18 py-3.5">
          {/* Logo & Brand in wide-spaced editorial style */}
          <div
            onClick={() => handleNav('/')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            <div className="flex flex-col">
              <span className="font-extrabold text-lg sm:text-xl tracking-[0.25em] text-aubergine-950 group-hover:text-marigold-600 transition-colors uppercase font-display">
                O P E N &nbsp; C A S E
              </span>
              <span className="text-[9px] tracking-[0.2em] uppercase text-aubergine-900/60 font-semibold font-mono">
                Institutional Redressal
              </span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 lg:gap-9">
            {navLinks.map((link) => {
              const isActive = currentPath === link.path;
              return (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.path)}
                  className={`relative text-[11px] font-bold tracking-[0.22em] transition-all py-1 ${
                    isActive
                      ? 'text-aubergine-950 font-extrabold'
                      : 'text-aubergine-900/70 hover:text-aubergine-950'
                  }`}
                >
                  <span>{link.label}</span>
                  {isActive && (
                    <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-marigold-500 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User actions / auth */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <NotificationDropdown onSelectTicket={(id) => handleNav(`/tickets/${id}`)} />

                {/* User badge */}
                <div className="flex items-center gap-2 pl-3 border-l border-aubergine-900/15">
                  <div className="w-8 h-8 rounded-full bg-aubergine-900 text-marigold-400 flex items-center justify-center text-xs font-bold border border-marigold-500/30">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-aubergine-950 leading-none">
                      {user?.name}
                    </p>
                    <span className="text-[9px] font-bold tracking-wider uppercase text-marigold-700">
                      {ROLE_LABELS[user?.role] || user?.role}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    logout();
                    handleNav('/');
                  }}
                  className="p-2 rounded-lg text-aubergine-900/70 hover:text-rose-700 hover:bg-aubergine-900/5 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleNav('/login')}
                  className="text-[11px] font-bold tracking-[0.2em] text-aubergine-900 hover:text-marigold-700 transition-colors uppercase px-2 py-1"
                >
                  LOGIN
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/register')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-[10px] font-bold tracking-[0.18em] uppercase bg-aubergine-950 hover:bg-aubergine-900 text-silver-100 hover:text-white rounded-lg transition-all shadow-sm border border-aubergine-800"
                >
                  <UserPlus className="w-3 h-3 text-marigold-400" />
                  <span>REGISTER</span>
                </button>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center gap-2 md:hidden">
            {isAuthenticated && (
              <NotificationDropdown onSelectTicket={(id) => handleNav(`/tickets/${id}`)} />
            )}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-aubergine-950 hover:bg-aubergine-900/10 focus:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-aubergine-950" />
              ) : (
                <div className="flex flex-col gap-1.5 w-6 items-end">
                  <span className="h-[2px] w-6 bg-aubergine-950 block rounded-full" />
                  <span className="h-[2px] w-4 bg-aubergine-950 block rounded-full" />
                  <span className="h-[2px] w-5 bg-aubergine-950 block rounded-full" />
                </div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#EBEAE5] border-b border-aubergine-900/15 px-4 pt-2 pb-5 space-y-2">
          {navLinks.map((link) => {
            const isActive = currentPath === link.path;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.path)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-bold tracking-[0.2em] uppercase transition-colors ${
                  isActive
                    ? 'bg-aubergine-900 text-marigold-400'
                    : 'text-aubergine-900 hover:bg-aubergine-900/10'
                }`}
              >
                <span>{link.label}</span>
                {isActive && <span className="w-1.5 h-1.5 rounded-full bg-marigold-400" />}
              </button>
            );
          })}

          <div className="pt-3 border-t border-aubergine-900/15 space-y-2">
            {isAuthenticated ? (
              <div className="flex items-center justify-between pt-1 px-1">
                <div>
                  <p className="text-xs font-bold text-aubergine-950">{user?.name}</p>
                  <p className="text-[10px] font-semibold text-marigold-700 uppercase tracking-wider">
                    {ROLE_LABELS[user?.role] || user?.role}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    handleNav('/');
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-rose-700 border border-rose-300 bg-rose-50 rounded-lg"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => handleNav('/login')}
                  className="py-2.5 text-center text-xs font-bold tracking-[0.15em] uppercase bg-white border border-aubergine-900/20 text-aubergine-950 rounded-lg shadow-sm"
                >
                  LOGIN
                </button>
                <button
                  type="button"
                  onClick={() => handleNav('/register')}
                  className="py-2.5 text-center text-xs font-bold tracking-[0.15em] uppercase bg-marigold-500 text-aubergine-950 rounded-lg shadow-sm"
                >
                  REGISTER
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
