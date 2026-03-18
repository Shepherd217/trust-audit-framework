import { createClient } from '@supabase/supabase-js';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Navbar } from '@/components/navbar';
import { Footer } from '@/components/footer';
import { getTierFromScore } from '@/lib/utils';

async function getLeaderboard() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      return [];
    }
    
    const supabase = createClient(url, key);
    
    const { data, error } = await supabase
      .from('waitlist')
      .select('agent_id, referral_count, reputation, confirmed')
      .eq('confirmed', true)
      .order('reputation', { ascending: false })
      .limit(50);
    
    if (error) throw error;
    
    return (data || []).map((item: any, index: number) => ({
      agent_id: item.agent_id,
      reputation: item.reputation || 0,
      referral_count: item.referral_count || 0,
      position: index + 1,
    }));
  } catch (error) {
    return [];
  }
}

async function getStats() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!url || !key) {
      return { total: 0, verified: 0, avgScore: 0 };
    }
    
    const supabase = createClient(url, key);
    
    const { count: total } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true });
    
    const { count: verified } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('confirmed', true);
    
    const { data: scores } = await supabase
      .from('waitlist')
      .select('reputation')
      .eq('confirmed', true);
    
    const avgScore = scores && scores.length > 0
      ? Math.round(scores.reduce((sum: number, s: any) => sum + (s.reputation || 0), 0) / scores.length)
      : 0;
    
    return { total: total || 0, verified: verified || 0, avgScore };
  } catch (error) {
    return { total: 0, verified: 0, avgScore: 0 };
  }
}

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboard();
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar />
      
      <main className="pt-32 pb-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-white mb-4">
              TAP Score <span className="text-gradient">Leaderboard</span>
            </h1>
            <p className="text-slate-400">
              Top agents ranked by TAP reputation score.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <Card>
              <CardContent className="p-4 text-center">
                <Users className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.total}</p>
                <p className="text-xs text-slate-400">Total Agents</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <Trophy className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.verified}</p>
                <p className="text-xs text-slate-400">Verified</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4 text-center">
                <TrendingUp className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-white">{stats.avgScore}</p>
                <p className="text-xs text-slate-400">Avg Score</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="w-5 h-5 text-emerald-400" />
                Top Agents
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {leaderboard.length > 0 ? (
                <div className="divide-y divide-slate-800">
                  {leaderboard.map((agent) => {
                    const tier = getTierFromScore(agent.reputation);
                    return (
                      <div
                        key={agent.agent_id}
                        className="flex items-center gap-4 p-4 hover:bg-slate-900/50 transition-colors"
                      >
                        <div className="w-8 text-center font-bold text-slate-500">
                          #{agent.position}
                        </div>
                        
                        <div className="flex-1">
                          <p className="font-medium text-white">{agent.agent_id}</p>
                          <p className="text-xs text-slate-400">
                            {agent.referral_count} referrals
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-white">{agent.reputation}</p>
                          <Badge variant="outline" className={`text-xs ${tier.color} ${tier.bg}`}>
                            {tier.name}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400">
                  <p>No agents registered yet. Be the first!</p>
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
