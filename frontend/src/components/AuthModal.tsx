import React, { useState } from 'react';
import { supabase } from '../supabase';
import { X, Mail, Lock, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (email: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!supabase) {
      setError(
        'Supabase keys are not set in frontend/.env. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable real user authentication. Guest demo mode remains 100% operational.'
      );
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpErr) throw signUpErr;

        // Check if user already exists (Supabase returns empty identities array when email is taken with confirm-email on)
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError(
            'This email is already registered. Please click "Sign In" below or check your inbox if you need to confirm your email.'
          );
          return;
        }

        if (data.session) {
          onAuthSuccess(data.user?.email || email);
          onClose();
        } else if (data.user) {
          // Email confirmation is enabled in Supabase Dashboard
          setMessage(
            'Account created! "Confirm email" is currently ON in your Supabase project. Please check your inbox to confirm your email, or disable "Confirm email" in Supabase Dashboard -> Authentication -> Providers -> Email to sign in directly.'
          );
        }
      } else {
        const { data, error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInErr) throw signInErr;

        if (data.session) {
          onAuthSuccess(data.user?.email || email);
          onClose();
        }
      }
    } catch (err: any) {
      // Extract the most descriptive error message from Supabase AuthApiError
      const errorMsg =
        err?.error_description ||
        err?.message ||
        (typeof err === 'string' ? err : 'Authentication failed. Please verify your credentials.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }

  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-md p-6 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white rounded-lg"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mb-6">
          <h3 className="text-xl font-bold text-white">
            {isSignUp ? 'Create Brand Account' : 'Sign in to BrandGate'}
          </h3>
          <p className="text-xs text-zinc-400 mt-1">
            Optional real account login. Guest demo mode is always available with no sign-in required.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-950/40 border border-red-900 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {message && (
          <div className="mb-4 p-3 rounded-xl bg-teal-950/40 border border-teal-900 text-teal-400 text-xs flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Email address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 bg-black border border-zinc-700 rounded-xl text-white text-sm focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-black font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 pt-4 border-t border-zinc-900 text-center text-xs text-zinc-400">
          {isSignUp ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(false)}
                className="text-teal-400 hover:underline font-medium"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              Need an account?{' '}
              <button
                type="button"
                onClick={() => setIsSignUp(true)}
                className="text-teal-400 hover:underline font-medium"
              >
                Sign Up
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
