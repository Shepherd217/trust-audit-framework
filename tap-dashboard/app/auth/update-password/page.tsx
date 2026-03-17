'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, ArrowRight, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ButtonLoader } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';

function UpdatePasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { updatePassword } = useAuth();
  const toast = useShowToast();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Check if we have the access token in URL
  const hasAccessToken = searchParams.has('access_token') || searchParams.has('code');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      toast.error('Missing fields', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Password mismatch', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Weak password', 'Password must be at least 8 characters');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await updatePassword(password);
      
      if (error) {
        toast.error('Update failed', error.message);
      } else {
        setIsSuccess(true);
        toast.success('Success', 'Your password has been updated');
        
        // Redirect after success
        setTimeout(() => {
          router.push('/auth/signin');
        }, 2000);
      }
    } catch (err) {
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!hasAccessToken) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-error/10 flex items-center justify-center">
            <Lock className="w-10 h-10 text-error" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Invalid or expired link</h1>
          <p className="text-text-secondary mb-6">
            The password reset link is invalid or has expired. 
            Please request a new one.
          </p>
          
          <Link
            href="/auth/forgot-password"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors"
          >
            Request New Link
            <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md text-center"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-neon-green/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-neon-green" />
          </div>
          
          <h1 className="text-2xl font-bold text-white mb-2">Password updated!</h1>
          <p className="text-text-secondary mb-6">
            Your password has been successfully updated. 
            Redirecting you to sign in...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-bg-card border border-border-subtle rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Create new password</h1>
          <p className="text-text-secondary mb-6">
            Enter a new password for your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-12 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-white transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <ButtonLoader className="border-bg-page" />
              ) : (
                <>
                  Update Password
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}

export default function UpdatePasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin" />
      </div>
    }>
      <UpdatePasswordForm />
    </Suspense>
  );
}
