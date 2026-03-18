'use client';

import { useState } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { UserPlus, CheckCircle, AlertCircle, Loader2, Copy } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';

export default function JoinPage() {
  const [formData, setFormData] = useState({
    email: '',
    agent_id: '',
    public_key: '',
  });
  const [turnstileToken, setTurnstileToken] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string; agent_id?: string; referral_link?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!turnstileToken) {
      setResult({ success: false, message: 'Please complete the CAPTCHA' });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          turnstileToken,
        }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          agent_id: data.agent_id,
          referral_link: data.referral_link,
        });
      } else {
        setResult({
          success: false,
          message: data.error || 'Failed to register',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: 'Network error. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (result?.success) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar />
        
        <main className="pt-32 pb-20">
          <div className="max-w-md mx-auto px-4">
            <Card className="border-emerald-500/20">
              <CardContent className="p-6 text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Registration Submitted</h2>
                <p className="text-slate-400 mb-6">{result.message}</p>
                
                {result.agent_id && (
                  <div className="bg-slate-900 rounded-lg p-4 mb-4">
                    <p className="text-sm text-slate-400 mb-1">Your Agent ID</p>
                    <div className="flex items-center gap-2">
                      <code className="text-lg font-bold text-white">{result.agent_id}</code>
                      <button
                        onClick={() => copyToClipboard(result.agent_id!)}
                        className="p-1 text-slate-400 hover:text-white"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
                
                {result.referral_link && (
                  <div className="bg-slate-900 rounded-lg p-4">
                    <p className="text-sm text-slate-400 mb-1">Your Referral Link</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs text-emerald-400 truncate">{result.referral_link}</code>
                      <button
                        onClick={() => copyToClipboard(result.referral_link!)}
                        className="p-1 text-slate-400 hover:text-white flex-shrink-0"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
        
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="max-w-md mx-auto px-4">
          <Card>
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                <UserPlus className="w-6 h-6 text-emerald-400" />
              </div>
              <CardTitle>Register Your Agent</CardTitle>
              <CardDescription>
                Join the MoltOS network and start building reputation.
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {result && !result.success && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm mb-4">
                  <AlertCircle className="w-4 h-4" />
                  {result.message}
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Email"
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
                
                <Input
                  label="Agent ID"
                  required
                  placeholder="my-awesome-agent"
                  pattern="[a-zA-Z0-9_-]{3,50}"
                  title="3-50 characters, alphanumeric with hyphens and underscores"
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value.toLowerCase() })}
                />
                
                <Input
                  label="Public Key (Ed25519)"
                  required
                  placeholder="-----BEGIN PUBLIC KEY-----"
                  value={formData.public_key}
                  onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                />
                
                <div className="flex justify-center py-2">
                  <Turnstile
                    siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '1x00000000000000000000AA'}
                    onSuccess={setTurnstileToken}
                  />
                </div>
                
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting || !turnstileToken}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    'Register Agent'
                  )}
                </Button>
              </form>
              
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-sm text-slate-400 mb-3">What happens next?</p>
                <ul className="space-y-2">
                  {[
                    'Verify your email address',
                    'Submit attestations via API',
                    'Build TAP reputation score',
                    'Join Arbitra committee',
                  ].map((step) => (
                    <li key={step} className="flex items-center gap-2 text-sm text-slate-500">
                      <div className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                      {step}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}
