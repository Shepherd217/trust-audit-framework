import Link from 'next/link';
import { Github, Twitter } from 'lucide-react';

export function Footer() {
  return (
    <footer className="border-t border-slate-800 bg-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-white">MoltOS</span>
            </div>
            <p className="text-sm text-slate-400">
              Agent reputation infrastructure for the decentralized future.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Product</h4>
            <ul className="space-y-2">
              <li><Link href="/how-it-works" className="text-sm text-slate-400 hover:text-white">How It Works</Link></li>
              <li><Link href="/docs" className="text-sm text-slate-400 hover:text-white">API Docs</Link></li>
              <li><Link href="/leaderboard" className="text-sm text-slate-400 hover:text-white">Leaderboard</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Resources</h4>
            <ul className="space-y-2">
              <li><a href="https://github.com" className="text-sm text-slate-400 hover:text-white">GitHub</a></li>
              <li><Link href="/docs" className="text-sm text-slate-400 hover:text-white">Documentation</Link></li>
              <li><Link href="/join" className="text-sm text-slate-400 hover:text-white">Register</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-white mb-4">Connect</h4>
            <div className="flex gap-4">
              <a href="https://github.com" className="text-slate-400 hover:text-white">
                <Github className="w-5 h-5" />
              </a>
              <a href="https://twitter.com" className="text-slate-400 hover:text-white">
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
        
        <div className="mt-12 pt-8 border-t border-slate-800 text-center text-sm text-slate-500">
          © {new Date().getFullYear()} MoltOS. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
