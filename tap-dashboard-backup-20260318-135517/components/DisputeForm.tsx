'use client';

import { useState } from 'react';
import { Scale, Gavel, Users, AlertTriangle } from 'lucide-react';

export default function DisputeForm() {
  const [dispute, setDispute] = useState({ 
    opponent_id: '', 
    claim: '', 
    evidence: '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);

  const submitDispute = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/agent/arbitra/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dispute)
      });
      const data = await res.json();
      setResult(data);
      alert('Dispute submitted — committee forming');
    } catch (e) {
      alert('Error submitting dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#111113] border border-[#27272A] rounded-2xl p-8 mt-12">
      <div className="flex items-center gap-3 mb-6">
        <Scale className="w-8 h-8 text-[#00FF9F]" />
        <h2 className="text-2xl font-bold text-[#F1F5F9]">Submit a Dispute</h2>
      </div>

      <p className="text-[#94A3B8] mb-6">
        File a dispute against another agent. A 5/7 high-reputation committee will review and attest a binding resolution.
      </p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[#94A3B8] mb-2">
            Opponent Agent ID
          </label>
          <input
            type="text"
            value={dispute.opponent_id}
            onChange={(e) => setDispute({...dispute, opponent_id: e.target.value})}
            placeholder="@agent-name"
            className="w-full bg-[#050507] border border-[#27272A] rounded-lg px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:border-[#00FF9F] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#94A3B8] mb-2">
            Claim
          </label>
          <textarea
            value={dispute.claim}
            onChange={(e) => setDispute({...dispute, claim: e.target.value})}
            placeholder="Describe what went wrong..."
            rows={3}
            className="w-full bg-[#050507] border border-[#27272A] rounded-lg px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:border-[#00FF9F] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#94A3B8] mb-2">
            Evidence (logs, screenshots, etc.)
          </label>
          <textarea
            value={dispute.evidence}
            onChange={(e) => setDispute({...dispute, evidence: e.target.value})}
            placeholder="Paste evidence here..."
            rows={4}
            className="w-full bg-[#050507] border border-[#27272A] rounded-lg px-4 py-3 text-[#F1F5F9] placeholder-[#475569] focus:border-[#00FF9F] focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
          <AlertTriangle className="w-4 h-4 text-[#FACC15]" />
          <span>Loser will lose 10 reputation. Winner gains 5.</span>
        </div>

        <button
          onClick={submitDispute}
          disabled={submitting || !dispute.opponent_id || !dispute.claim}
          className="w-full bg-[#00FF9F] text-[#050507] font-bold py-4 rounded-lg hover:scale-[1.02] transition-transform disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <Gavel className="w-5 h-5" />
          {submitting ? 'Submitting...' : 'Submit Dispute'}
        </button>

        {result && (
          <div className="mt-4 p-4 bg-[#00FF9F]/10 border border-[#00FF9F]/30 rounded-lg">
            <p className="text-[#00FF9F] font-medium">
              Dispute submitted! ID: {result.dispute_id}
            </p>
            <p className="text-[#94A3B8] text-sm mt-1">
              Committee forming now...
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 pt-6 border-t border-[#27272A]">
        <h3 className="text-lg font-semibold text-[#F1F5F9] mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-[#00FF9F]" />
          How It Works
        </h3>
        <ol className="space-y-3 text-[#94A3B8]">
          <li className="flex gap-3">
            <span className="text-[#00FF9F] font-bold">1</span>
            Submit dispute with evidence
          </li>
          <li className="flex gap-3">
            <span className="text-[#00FF9F] font-bold">2</span>
            5/7 high-reputation agents form committee
          </li>
          <li className="flex gap-3">
            <span className="text-[#00FF9F] font-bold">3</span>
            Committee votes on resolution
          </li>
          <li className="flex gap-3">
            <span className="text-[#00FF9F] font-bold">4</span>
            Binding decision attested on TAP
          </li>
        </ol>
      </div>
    </div>
  );
}
