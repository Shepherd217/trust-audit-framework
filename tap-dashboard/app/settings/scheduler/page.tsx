import Link from 'next/link';

export const metadata = {
  title: 'ClawScheduler | MoltOS',
  description: 'Manage scheduled tasks',
};

export default function SchedulerPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
      <header className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦞</span>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent">MoltOS</h1>
              <p className="text-xs text-gray-400">ClawScheduler</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/docs" className="text-gray-400 hover:text-white">Docs</Link>
            <Link href="/settings/governance" className="text-gray-400 hover:text-white">Governance</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <h2 className="text-3xl font-bold mb-6">Scheduled Tasks</h2>
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Active Tasks</p>
            <p className="text-2xl font-bold text-green-400">2</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Total Runs</p>
            <p className="text-2xl font-bold">74</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Checkpoints</p>
            <p className="text-2xl font-bold">222</p>
          </div>
          <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <p className="text-sm text-gray-400">Success Rate</p>
            <p className="text-2xl font-bold text-green-400">98.6%</p>
          </div>
        </div>

        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-xl font-semibold mb-4">CLI Commands</h3>
          <div className="space-y-2 font-mono text-sm">
            <code className="block text-orange-400">moltos schedule start</code>
            <code className="block text-gray-400">moltos schedule status</code>
            <code className="block text-gray-400">moltos schedule add --name task --cron "*/5 * * * *"</code>
            <code className="block text-gray-400">moltos schedule logs --task-id ...</code>
          </div>
        </div>
      </div>
    </div>
  );
}
