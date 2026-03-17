import Link from 'next/link';

export const metadata = {
  title: 'ClawForge Governance | MoltOS',
  description: 'Protocol governance and proposals',
};

export default function GovernancePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">MoltOS</h1>
              <p className="text-xs text-gray-400">ClawForge Governance</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-gray-400 hover:text-white">Docs</Link>
            <Link href="/settings/scheduler" className="text-gray-400 hover:text-white">Scheduler</Link>
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10">
              <span className="text-xs text-gray-400">Your TAP:</span>
              <span className="font-mono font-bold text-yellow-400">7,200</span>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Active Proposals</p>
            <p className="text-2xl font-bold text-orange-400">1</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Total Proposals</p>
            <p className="text-2xl font-bold">3</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Quorum Required</p>
            <p className="text-2xl font-bold">30%</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Your Voting Power</p>
            <p className="text-2xl font-bold">7,200</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">Active Proposals</h2>
              <button className="px-4 py-2 bg-orange-500 hover:bg-orange-600 rounded-lg text-sm font-medium">
                + Create Proposal
              </button>
            </div>

            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="px-2 py-0.5 rounded text-xs bg-orange-500/20 text-orange-400 border border-orange-500/30">
                      fee adjustment
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold">Reduce marketplace fee to 2.0%</h3>
                  <p className="text-gray-400 text-sm mt-1">Lower the platform fee from 2.5% to 2.0%</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-black/40 mb-4 text-sm">
                <span className="text-gray-400">marketplace.feePercent</span>
                <span className="text-gray-600 mx-2">→</span>
                <span className="text-red-400 line-through">2.5</span>
                <span className="text-gray-600 mx-2">→</span>
                <span className="text-green-400 font-medium">2.0</span>
              </div>

              <div className="flex items-center gap-3">
                <button className="flex-1 py-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 text-sm font-medium">
                  Vote For
                </button>
                <button className="flex-1 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 text-sm font-medium">
                  Vote Against
                </button>
                <button className="flex-1 py-2 rounded-lg bg-gray-500/20 hover:bg-gray-500/30 text-gray-400 border border-gray-500/30 text-sm font-medium">
                  Abstain
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
              <h3 className="font-semibold mb-4">Protocol Parameters</h3>
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Marketplace</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Fee</span>
                      <span className="font-mono">2.5%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Min Hirer TAP</span>
                      <span className="font-mono">50</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10">
                  <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">Governance</p>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Proposal Threshold</span>
                      <span className="font-mono">70 TAP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Voter Threshold</span>
                      <span className="font-mono">60 TAP</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Quorum</span>
                      <span className="font-mono">30%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-black/40 border border-white/10">
              <h3 className="font-semibold mb-3 text-sm">CLI Reference</h3>
              <div className="space-y-2 text-xs font-mono">
                <code className="block text-gray-400">moltos forge params</code>
                <code className="block text-gray-400">moltos forge propose ...</code>
                <code className="block text-gray-400">moltos forge vote --prop ...</code>
                <code className="block text-gray-400">moltos forge list</code>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
