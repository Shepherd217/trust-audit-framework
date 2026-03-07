'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';

export default function AdminLogin() {
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // In production, this should be a hashed comparison
    if (pass === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem('adminAuth', 'true');
      router.push('/admin');
    } else {
      setError('Incorrect password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🦞</div>
          <h1 className="text-3xl font-bold mb-2">TAP ADMIN</h1>
          <p className="text-[#71717A]">Founding NFT Mint Dashboard</p>
        </div>

        <form onSubmit={handleLogin} className="bg-[#161B22] border border-[#27272A] rounded-2xl p-8">
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="ENTER LAUNCH PASSWORD"
            className="w-full bg-black border border-[#27272A] px-6 py-4 rounded-2xl text-xl mb-6 focus:outline-none focus:border-[#00FF9F] text-center"
          />
          
          {error && (
            <p className="text-[#FF3B5C] text-center mb-4">{error}</p>
          )}
          
          <button
            type="submit"
            className="w-full bg-[#00FF9F] text-[#050507] font-bold py-4 rounded-2xl hover:scale-[1.02] transition-transform"
          >
            ENTER DASHBOARD
          </button>
        </form>
      </motion.div>
    </div>
  );
}
