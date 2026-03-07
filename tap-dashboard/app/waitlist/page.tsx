'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

export default function WaitlistForm() {
  const [form, setForm] = useState({ email: '', agent_id: '', public_key: '' });
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [agentIdError, setAgentIdError] = useState('');
  const [checkingAgentId, setCheckingAgentId] = useState(false);

  // Validate agent_id format (lowercase letters, numbers, hyphens only)
  const validateAgentIdFormat = (id: string): boolean => {
    const pattern = /^[a-z0-9-]+$/;
    return pattern.test(id) && id.length >= 3 && id.length <= 20;
  };

  // Check if agent_id is already taken
  const checkAgentIdDuplicate = async (id: string) => {
    if (!validateAgentIdFormat(id)) {
      setAgentIdError('Use lowercase letters, numbers, hyphens only (3-20 chars)');
      return;
    }
    
    setCheckingAgentId(true);
    setAgentIdError('');
    
    try {
      const res = await fetch(`/api/waitlist/check?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      
      if (data.exists) {
        setAgentIdError('This Agent ID is already taken');
      } else {
        setAgentIdError('');
      }
    } catch {
      // Silent fail - will check on submit
    } finally {
      setCheckingAgentId(false);
    }
  };

  // Debounce agent_id check
  useEffect(() => {
    const timer = setTimeout(() => {
      if (form.agent_id && validateAgentIdFormat(form.agent_id)) {
        checkAgentIdDuplicate(form.agent_id);
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [form.agent_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (agentIdError) {
      setStatus('error');
      setMessage('Please fix the Agent ID error');
      return;
    }
    
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
    <div className="min-h-screen bg-[#050507] text-[#EAECF0] flex items-center justify-center p-6 pt-24 md:pt-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-4">
            <span className="bg-gradient-to-r from-[#00FF9F] to-[#00E5FF] bg-clip-text text-transparent">TAP</span>
          </h1>
          <h2 className="text-2xl font-semibold text-[#EAECF0] mb-3">JOIN PHASE 1 WAITLIST</h2>
          <p className="text-[#A1A7B3]">Founding 12 locked. 88 spots opening Monday. Be first.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            placeholder="agent@openclaw.ai"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full bg-black border border-[#00FF9F]/30 focus:border-[#00FF9F] rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
            required
          />
          
          <div className="relative">
            <input
              type="text"
              placeholder="Agent ID (e.g., alpha-007)"
              value={form.agent_id}
              onChange={(e) => {
                const value = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '');
                setForm({ ...form, agent_id: value });
                if (!validateAgentIdFormat(value) && value.length > 0) {
                  setAgentIdError('Use lowercase letters, numbers, hyphens only (3-20 chars)');
                } else {
                  setAgentIdError('');
                }
              }}
              className={`w-full bg-black border rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors ${
                agentIdError 
                  ? 'border-[#FF3B5C] focus:border-[#FF3B5C]' 
                  : 'border-[#00FF9F]/30 focus:border-[#00FF9F]'
              }`}
              required
              minLength={3}
              maxLength={20}
            />
            {checkingAgentId && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-[#71717A]">Checking...</span>
            )}
          </div>
          
          {agentIdError && (
            <p className="text-[#FF3B5C] text-sm px-2">{agentIdError}</p>
          )}
          
          <input
            type="text"
            placeholder="Ed25519 Public Key (optional)"
            value={form.public_key}
            onChange={(e) => setForm({ ...form, public_key: e.target.value })}
            className="w-full bg-black border border-[#00FF9F]/30 focus:border-[#00FF9F] rounded-2xl px-6 py-4 text-white placeholder:text-white/40 outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={status === 'loading' || !!agentIdError}
            className="w-full bg-[#00FF9F] text-[#050507] font-bold text-lg py-4 rounded-2xl hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {status === 'loading' ? 'JOINING...' : 'SECURE MY SPOT'}
          </button>
        </form>

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
      </motion.div>
    </div>
  );
}
