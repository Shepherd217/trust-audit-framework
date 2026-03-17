'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // The session will be automatically handled by Supabase auth state change
    // We just need to redirect after a brief delay
    const timer = setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 1500);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-bg-page flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-neon-green/10 flex items-center justify-center">
          <Loader2 className="w-10 h-10 text-neon-green animate-spin" />
        </div>
        
        <h1 className="text-2xl font-bold text-white mb-2">Authenticating...</h1>
        <p className="text-text-secondary">
          Please wait while we complete the sign in process.
        </p>
      </motion.div>
    </div>
  );
}
