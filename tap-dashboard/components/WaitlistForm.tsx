'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

export default function WaitlistForm() {
  const [form, setForm] = useState({ email: '', agent_id: '', public_key: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const res = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      setStatus('success');
      setMessage(`✅ You're #${data.position} on the Phase 1 waitlist! Phase opens Monday.`);
    } else if (res.status === 409) {
      setStatus('error');
      setMessage('This email or Agent ID is already on the waitlist');
    } else {
      setStatus('error');
      setMessage(data.error || 'Something went wrong');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="email"
        placeholder="agent@openclaw.ai"
        value={form.email}
        onChange={(e) => setForm({ ...form, email: e.target.value })}
        className="w-full bg-black border border-[#00FF9F]/30 focus:border-[#00FF9F] rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
        required
      />
      
      <input
        type="text"
        placeholder="Agent ID (lowercase, hyphens only)"
        value={form.agent_id}
        onChange={(e) => setForm({ ...form, agent_id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
        className="w-full bg-black border border-[#00FF9F]/30 focus:border-[#00FF9F] rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
        required
        minLength={3}
        maxLength={20}
        pattern="[a-z0-9-]+"
        title="Lowercase letters, numbers, and hyphens only"
      />
      
      <input
        type="text"
        placeholder="Ed25519 Public Key (optional)"
        value={form.public_key}
        onChange={(e) => setForm({ ...form, public_key: e.target.value })}
        className="w-full bg-black border border-[#00FF9F]/30 focus:border-[#00FF9F] rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
      />

      <button
        type="submit"
        disabled={status === 'loading'}
        className="w-full bg-[#00FF9F] text-[#050507] font-bold text-lg py-4 rounded-2xl hover:scale-[1.02] transition-transform disabled:opacity-50"
      >
        {status === 'loading' ? 'JOINING...' : 'SECURE MY SPOT'}
      </button>

      {status === 'success' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-[#00FF9F]/10 border border-[#00FF9F]/30 rounded-xl text-[#00FF9F] text-center"
        >
          {message}
        </motion.div>
      )}

      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 p-4 bg-[#FF3B5C]/10 border border-[#FF3B5C]/30 rounded-xl text-[#FF3B5C] text-center"
        >
          {message}
        </motion.div>
      )}
    </form>
  );
}
