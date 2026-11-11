import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { setCredentials, setAuthLoading, setAuthError } from '../../store/slices/authSlice.js';
import api from '../../services/api.js';
import ForgotPasswordModal from './ForgotPasswordModal.jsx';
import {
  ShieldCheck,
  Lock,
  Mail,
  ArrowRight,
  Loader2,
  GraduationCap,
  Sparkles,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

export default function LoginPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoading, error, isAuthenticated, role, token } = useSelector((state) => state.auth);

  React.useEffect(() => {
    if (isAuthenticated && token && role) {
      if (role === 'ADMIN' || role === 'SUPER_ADMIN' || role === 'DEPARTMENT_ADMIN') {
        navigate('/admin', { replace: true });
      } else if (role === 'FACULTY') {
        navigate('/faculty', { replace: true });
      } else if (role === 'STUDENT') {
        navigate('/student', { replace: true });
      }
    }
  }, [isAuthenticated, role, token, navigate]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);

  // Quick preset accounts for testing/evaluating in development environments
  const showDemoAccounts = !import.meta.env.PROD || import.meta.env.VITE_ENABLE_DEMO_ACCOUNTS === 'true';

  const demoAccounts = [
    {
      role: 'ADMIN',
      label: 'Admin Portal',
      email: 'admin@examsphere.io',
      pass: 'Admin@12345',
      badge: 'System Admin',
      color: 'bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30 text-blue-400',
    },
    {
      role: 'FACULTY',
      label: 'Faculty Portal',
      email: 'alan.turing@examsphere.io',
      pass: 'Faculty@12345',
      badge: 'Department Faculty',
      color: 'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400',
    },
    {
      role: 'STUDENT',
      label: 'Student Portal',
      email: 'john.doe@examsphere.io',
      pass: 'Student@12345',
      badge: 'Batch 2023 / A',
      color: 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    },
  ];

  const handleQuickFill = (acc) => {
    setEmail(acc.email);
    setPassword(acc.pass);
    setLocalError('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLocalError('');
    dispatch(setAuthError(null));

    if (!email || !password) {
      setLocalError('Please fill in both email and password');
      return;
    }

    dispatch(setAuthLoading(true));

    try {
      const response = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password,
      });

      if (response && response.data) {
        const { user, accessToken, refreshToken } = response.data;
        if (accessToken) {
          api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        }
        dispatch(
          setCredentials({
            user,
            token: accessToken,
            refreshToken,
          })
        );

        // Redirect strictly based on user's authorized role
        const getAuthorizedPortal = (userRole) => {
          switch (userRole) {
            case 'ADMIN':
            case 'SUPER_ADMIN':
            case 'DEPARTMENT_ADMIN':
              return '/admin';
            case 'FACULTY':
              return '/faculty';
            case 'STUDENT':
              return '/student';
            default:
              return '/';
          }
        };

        const isAuthorizedForPath = (path, userRole) => {
          if (!path || path === '/' || path.includes('/login')) return false;
          if (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN' || userRole === 'DEPARTMENT_ADMIN') {
            return path.startsWith('/admin') || path.startsWith('/notifications');
          }
          if (userRole === 'FACULTY') {
            return path.startsWith('/faculty') || path.startsWith('/notifications');
          }
          if (userRole === 'STUDENT') {
            return path.startsWith('/student') || path.startsWith('/notifications');
          }
          return false;
        };

        const intendedDestination = location.state?.from?.pathname;
        if (intendedDestination && isAuthorizedForPath(intendedDestination, user.role)) {
          navigate(intendedDestination, { replace: true });
        } else {
          navigate(getAuthorizedPortal(user.role), { replace: true });
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Login failed. Please verify credentials.';
      setLocalError(errMsg);
      dispatch(setAuthError(errMsg));
    } finally {
      dispatch(setAuthLoading(false));
    }
  };

  return (
    <div className="min-h-screen bg-deep-navy text-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative font-sans">
      <div className="relative z-10 sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center p-3.5 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl shadow-blue-500/25">
            <GraduationCap className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">
            ExamSphere
          </h1>
          <p className="text-xs text-slate-400">
            Cloud-Based Online Examination & Assessment Platform
          </p>
        </div>

        {/* Quick Demo Role Selector (Isolated to Development/Evaluation Environments) */}
        {showDemoAccounts && (
          <div className="mt-6 bg-[#0F172A] rounded-2xl p-4 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between text-xs text-slate-400 px-1 mb-2.5">
              <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Quick Demo Fill (Dev Mode):
              </span>
              <span className="text-[11px] text-slate-500">Click to autofill credentials</span>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              {demoAccounts.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => handleQuickFill(acc)}
                  className={`text-left p-3 rounded-xl border transition ${acc.color}`}
                >
                  <div className="text-xs font-bold">
                    {acc.label.split(' ')[0]}
                  </div>
                  <div className="text-[10px] opacity-80 truncate mt-0.5">{acc.badge}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Main Login Form Card */}
        <div className="mt-4 bg-[#0F172A] py-8 px-6 shadow-2xl rounded-2xl border border-slate-800 sm:px-10">
          {(localError || error) && (
            <div className="mb-6 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <div className="flex-1 font-medium">{localError || error}</div>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@examsphere.io"
                  className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotModal(true)}
                  className="text-xs text-blue-400 hover:text-blue-300 transition underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-10 pr-10 py-3 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 shadow-lg shadow-blue-500/25 active:scale-[0.99] transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <span>Sign In to ExamSphere</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Security Assurance Badge */}
          <div className="mt-6 pt-5 border-t border-slate-800 flex items-center justify-center gap-2 text-[11px] text-slate-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Role-Based Access Control • HttpOnly JWT Session</span>
          </div>
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
      />
    </div>
  );
}
