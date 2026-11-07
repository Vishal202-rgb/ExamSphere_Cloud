import React, { useState } from 'react';
import Modal from '../../components/common/Modal.jsx';
import api from '../../services/api.js';
import { Mail, KeyRound, CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';

export default function ForgotPasswordModal({ isOpen, onClose }) {
  const [step, setStep] = useState(1); // 1: Request Token, 2: Reset Password
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!email) {
      setError('Please enter your account email address');
      return;
    }
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res?.data?.resetToken) {
        setToken(res.data.resetToken);
        setSuccessMsg('Security reset token generated! Proceed to enter your new password.');
        setStep(2);
      } else {
        setSuccessMsg('If an account exists with this email, a reset token has been issued.');
        setStep(2);
      }
    } catch (err) {
      setError(err?.message || 'Failed to request password reset');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Reset token is required');
      return;
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
      });
      setSuccessMsg('Password updated successfully! You can now log in with your new password.');
      setTimeout(() => {
        onClose();
        setStep(1);
        setEmail('');
        setToken('');
        setNewPassword('');
        setConfirmPassword('');
        setSuccessMsg('');
      }, 2500);
    } catch (err) {
      setError(err?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setStep(1);
      setError('');
      setSuccessMsg('');
    }, 200);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 1 ? 'Forgot Password' : 'Set New Password'}
      subtitle={
        step === 1
          ? 'Enter your registered email to receive a password recovery token'
          : 'Provide your recovery token and choose a secure new password'
      }
    >
      {error && (
        <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mb-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleRequestReset} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Account Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. admin@examsphere.io"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Generate Recovery Token
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Reset Security Token
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                required
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste the hex token provided"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder:text-slate-500 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              New Password (min. 8 characters)
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              Confirm New Password
            </label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-between items-center pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-blue-400 hover:text-blue-300 underline transition"
            >
              Back to Request Token
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-blue-500/25 transition disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Reset
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
}
