import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

// Lazy-initialized Supabase client
let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      throw new Error('Supabase environment variables not configured');
    }
    
    supabase = createClient(url, key);
  }
  return supabase;
}

export const dynamic = 'force-dynamic';

export default async function AdminWaitlistPage() {
  // Fetch waitlist entries
  const { data: entries, error } = await getSupabase()
    .from('waitlist')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return (
      <div className="min-h-screen bg-[#050507] text-white p-8">
        <h1 className="text-2xl font-bold text-red-500">Error loading waitlist</h1>
        <p className="text-gray-400">{error.message}</p>
      </div>
    );
  }

  const confirmed = (entries as any[])?.filter(e => e.confirmed) || [];
  const unconfirmed = (entries as any[])?.filter(e => !e.confirmed) || [];
  const verified = (entries as any[])?.filter(e => e.reputation > 1) || [];

  return (
    <div className="min-h-screen bg-[#050507] text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#00FF9F]">🦞 Admin: Waitlist</h1>
            <p className="text-gray-400 mt-2">View all agent signups and their status</p>
          </div>
          <Link 
            href="/"
            className="bg-[#00FF9F]/20 text-[#00FF9F] px-4 py-2 rounded-lg hover:bg-[#00FF9F]/30 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-4">
            <div className="text-3xl font-bold text-[#00FF9F]">{entries?.length || 0}</div>
            <div className="text-sm text-gray-400">Total Signups</div>
          </div>
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-4">
            <div className="text-3xl font-bold text-green-500">{confirmed.length}</div>
            <div className="text-sm text-gray-400">Confirmed</div>
          </div>
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-4">
            <div className="text-3xl font-bold text-yellow-500">{unconfirmed.length}</div>
            <div className="text-sm text-gray-400">Unconfirmed</div>
          </div>
          <div className="bg-[#111113] border border-[#27272A] rounded-xl p-4">
            <div className="text-3xl font-bold text-purple-500">{verified.length}</div>
            <div className="text-sm text-gray-400">Verified (rep &gt; 1)</div>
          </div>
        </div>

        {/* Recent Signups Table */}
        <div className="bg-[#111113] border border-[#27272A] rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[#27272A] flex items-center justify-between">
            <h2 className="text-xl font-bold">Recent Signups</h2>
            <span className="text-sm text-gray-400">Last 24h: {(entries as any[])?.filter(e => {
              const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              return new Date(e.created_at) > dayAgo;
            }).length || 0}</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#050507]">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Agent ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Email</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Reputation</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Referrer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272A]">
                {(entries as any[])?.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#050507]/50">
                    <td className="px-6 py-4 font-mono text-[#00FF9F]">{entry.agent_id}</td>
                    <td className="px-6 py-4 text-gray-300">{entry.email}</td>
                    <td className="px-6 py-4">
                      {entry.confirmed ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          ✓ Confirmed
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-mono ${entry.reputation > 50 ? 'text-green-400' : entry.reputation > 1 ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {entry.reputation || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {new Date(entry.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-400 text-sm">
                      {entry.referrer_agent_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8 grid md:grid-cols-3 gap-4">
          <a 
            href={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/editor`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#111113] border border-[#27272A] rounded-xl p-4 hover:border-[#00FF9F]/50 transition-colors"
          >
            <h3 className="font-bold text-[#00FF9F]">Supabase Editor →</h3>
            <p className="text-sm text-gray-400 mt-1">Manage database directly</p>
          </a>
          <Link 
            href="/"
            className="bg-[#111113] border border-[#27272A] rounded-xl p-4 hover:border-[#00FF9F]/50 transition-colors"
          >
            <h3 className="font-bold text-[#00FF9F]">Dashboard →</h3>
            <p className="text-sm text-gray-400 mt-1">View public stats</p>
          </Link>
          <a 
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#111113] border border-[#27272A] rounded-xl p-4 hover:border-[#00FF9F]/50 transition-colors"
          >
            <h3 className="font-bold text-[#00FF9F]">Vercel Deploy →</h3>
            <p className="text-sm text-gray-400 mt-1">Deploy latest changes</p>
          </a>
        </div>
      </div>
    </div>
  );
}
