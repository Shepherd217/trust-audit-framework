'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Check, Github, Chrome } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { ButtonLoader } from '@/components/ui/skeletons';
import { useShowToast } from '@/components/ui/toast';

function SignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  
  const { signUp, signInWithOAuth } = useAuth();
  const toast = useShowToast();
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<string | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const validatePassword = (password: string) => {
    const checks = {
      minLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
    };
    return checks;
  };

  const passwordChecks = validatePassword(formData.password);
  const allChecksPassed = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.username || !formData.email || !formData.password) {
      toast.error('Missing fields', 'Please fill in all required fields');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Password mismatch', 'Passwords do not match');
      return;
    }

    if (!allChecksPassed) {
      toast.error('Weak password', 'Please meet all password requirements');
      return;
    }

    if (!agreedToTerms) {
      toast.error('Terms required', 'Please agree to the terms of service');
      return;
    }

    setIsLoading(true);
    
    try {
      const { error, user } = await signUp(formData.email, formData.password, formData.username);
      
      if (error) {
        toast.error('Sign up failed', error.message);
      } else if (user) {
        toast.success(
          'Account created!', 
          'Please check your email to verify your account'
        );
        router.push('/auth/signin?verified=pending');
      }
    } catch (err) {
      toast.error('Error', 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignUp = async (provider: 'github' | 'google') => {
    setIsOAuthLoading(provider);
    
    try {
      const { error } = await signInWithOAuth(provider);
      
      if (error) {
        toast.error('OAuth error', error.message);
        setIsOAuthLoading(null);
      }
    } catch (err) {
      toast.error('Error', 'Failed to initiate OAuth sign up');
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
            Create your account to get started
          </p>
        </div>

        {/* OAuth Buttons */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={() => handleOAuthSignUp('github')}
            disabled={isOAuthLoading === 'github'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl hover:border-neon-green/50 transition-colors disabled:opacity-50"
          >
            {isOAuthLoading === 'github' ? <ButtonLoader /> : <><Github className="w-5 h-5" /><span className="text-sm">GitHub</span></>}
          </button>
          
          <button
            onClick={() => handleOAuthSignUp('google')}
            disabled={isOAuthLoading === 'google'}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl hover:border-neon-green/50 transition-colors disabled:opacity-50"
          >
            {isOAuthLoading === 'google' ? <ButtonLoader /> : <><Chrome className="w-5 h-5" /><span className="text-sm">Google</span></>}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border-subtle" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-bg-page text-text-muted">Or sign up with email</span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="johndoe"
                className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
            
            {/* Password requirements */}
            <div className="mt-3 space-y-2">
              {[
                { label: 'At least 8 characters', check: passwordChecks.minLength },
                { label: 'One uppercase letter', check: passwordChecks.hasUppercase },
                { label: 'One lowercase letter', check: passwordChecks.hasLowercase },
                { label: 'One number', check: passwordChecks.hasNumber },
              ].map((req) => (
                <div key={req.label} className="flex items-center gap-2 text-xs">
                  <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
                    req.check ? 'bg-neon-green/20 text-neon-green' : 'bg-border-subtle text-text-muted'
                  }`}>
                    <Check className="w-3 h-3" />
                  </div>
                  <span className={req.check ? 'text-neon-green' : 'text-text-muted'}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-3 bg-bg-elevated border border-border-subtle rounded-xl focus:border-neon-green focus:outline-none transition-colors text-white placeholder:text-text-muted"
                required
              />
            </div>
          </div>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="terms"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-border-subtle bg-bg-elevated text-neon-green focus:ring-neon-green"
            />
            <label htmlFor="terms" className="text-sm text-text-secondary">
              I agree to the{' '}
              <Link href="/terms" className="text-neon-green hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link href="/privacy" className="text-neon-green hover:underline">Privacy Policy</Link>
            </label>
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
                Create Account
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
        </form>

        {/* Sign In Link */}
        <p className="text-center mt-6 text-text-secondary">
          Already have an account?{' '}
          <Link 
            href={`/auth/signin${redirectTo !== '/dashboard' ? `?redirect=${redirectTo}` : ''}`}
            className="text-neon-green hover:text-neon-green/80 transition-colors font-medium"
          >
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-neon-green/20 border-t-neon-green rounded-full animate-spin" />
      </div>
    }>
      <SignUpForm />
    </Suspense>
  );
}
