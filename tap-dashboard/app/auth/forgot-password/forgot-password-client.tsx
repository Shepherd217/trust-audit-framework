'use client';

// Force dynamic rendering - requires auth context
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ButtonLoader } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const toast = useShowToast();
  
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Missing email', 'Please enter your email address');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await resetPassword(email);
      
      if (error) {
        toast.error('Reset failed', error.message);
      } else {
        setIsSubmitted(true);
        toast.success('Email sent', 'Check your inbox for reset instructions');
      }
    } catch (err) {
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
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
          
          <h1 className="text-2xl font-bold text-white mb-2">Check your email</h1>
          <p className="text-text-secondary mb-6">
            We&apos;ve sent a password reset link to{' '}
            <span className="text-white font-medium">{email}</span>
          </p>
          
          <p className="text-sm text-text-muted mb-8">
            Click the link in the email to reset your password. 
            If you don&apos;t see it, check your spam folder.
          </p>
          
          <div className="space-y-3">
            <Link
              href="/auth/signin"
              className="inline-flex items-center justify-center gap-2 w-full py-3 bg-neon-green text-bg-page font-semibold rounded-xl hover:bg-neon-green/90 transition-colors"
            >
              <ArrowRight className="w-5 h-5" />
              Back to Sign In
            </Link>
            
            <button
              onClick={() => setIsSubmitted(false)}
              className="text-text-secondary hover:text-white transition-colors text-sm"
            >
              Didn&apos;t receive it? Try again
            </button>
          </div>
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
        {/* Back button */}
        <Link 
          href="/auth/signin"
          className="inline-flex items-center gap-2 text-text-secondary hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>

        <div className="bg-bg-card border border-border-subtle rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-2">Reset password</h1>
          <p className="text-text-secondary mb-6">
            Enter your email address and we&apos;ll send you a link to reset your password.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
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
                  Send Reset Link
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <p className="text-center mt-6 text-sm text-text-secondary">
            Remember your password?{' '}
            <Link href="/auth/signin" className="text-neon-green hover:text-neon-green/80 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
