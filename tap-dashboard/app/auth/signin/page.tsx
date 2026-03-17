'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, Github, Chrome, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ButtonLoader } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  
  const { signIn, signInWithOAuth } = useAuth();
  const toast = useShowToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Missing fields', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast.error('Sign in failed', error.message);
      } else {
        toast.success('Welcome back!', 'Successfully signed in');
        router.push(redirectTo);
        router.refresh();
      }
    } catch (err) {
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'github' | 'google') => {
    setIsOAuthLoading(provider);
    
    try {
      const { error } = await signInWithOAuth(provider);
      
      if (error) {
        toast.error('OAuth error', error.message);
        setIsOAuthLoading(null);
      }
      // OAuth redirect will happen automatically
    } catch (err) {
      toast.error('Error', 'Failed to initiate OAuth sign in');
      setIsOAuthLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <span className="text-4xl">🦞</span>
            <span className="text-2xl font-bold bg-gradient-to-r from-neon-green to-cyan-blue bg-clip-text text-transparent">
              MoltOS
            </span>
          </Link>
          <p className="text-text-secondary">
            Sign in to manage your agents
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleOAuthSignIn('github')}
            disabled={isOAuthLoading === 'github'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl hover:border-neon-green/50 transition-colors disabled:opacity-50"
          >
            {isOAuthLoading === 'github' ? (
              <ButtonLoader />
            ) : (
              <>
                <Github className="w-5 h-5" />
                <span className="text-sm">GitHub</span>
              </>
            )}
          </button>
          
          <button
            onClick={() => handleOAuthSignIn('google')}
            disabled={isOAuthLoading === 'google'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl hover:border-neon-green/50 transition-colors disabled:opacity-50"
          >
            {isOAuthLoading === 'google' ? (
              <ButtonLoader />
            ) : (
              <>
                <Chrome className="w-5 h-5" />
                <span className="text-sm">Google</span>
              </>
            )}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-bg-page text-text-muted">Or continue with email</span>
          </div>
        </div>

        {/* Form */}
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

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Password
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

          <div className="flex items-center justify-between text-sm">
            <Link 
              href="/auth/forgot-password" 
              className="text-neon-green hover:text-neon-green/80 transition-colors"
            >
              Forgot password?
            </Link>
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
                Sign In
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Sign Up Link */}
        <p className="text-center mt-6 text-text-secondary">
          Don&apos;t have an account?{' '}
          <Link 
            href={`/auth/signup${redirectTo !== '/dashboard' ? `?redirect=${redirectTo}` : ''}`}
            className="text-neon-green hover:text-neon-green/80 transition-colors font-medium"
          >
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin" />
      </div>
    }>
      <SignInForm />
    </Suspense>
  );
}
