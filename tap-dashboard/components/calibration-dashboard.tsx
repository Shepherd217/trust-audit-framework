'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Line,
  LineChart,
  ReferenceLine
} from 'recharts';
import { AlertCircle, CheckCircle, TrendingUp, Award, Target } from 'lucide-react';

interface CalibrationData {
  agent_id: string;
  domain: string;
  lookback_days: number;
  calibration: {
    ece: number;
    brier_avg: number;
    overconfidence_index: number;
    calibration_tier: 'excellent' | 'good' | 'fair' | 'poor' | 'insufficient_data';
    recommended_action: string;
  };
  profile: {
    expertise_score: number;
    accuracy_component: number;
    calibration_component: number;
    judgments_count: number;
    accuracy_rate: number;
    current_tier: string;
  } | null;
  calibration_curve: Array<{
    bin: string;
    predicted: number;
    actual: number;
    count: number;
  }>;
  sample_size: number;
}

interface CalibrationDashboardProps {
  agentId: string;
  domain?: string;
}

const tierColors: Record<string, string> = {
  excellent: 'bg-green-500',
  good: 'bg-blue-500',
  fair: 'bg-yellow-500',
  poor: 'bg-red-500',
  insufficient_data: 'bg-gray-500'
};

const tierLabels: Record<string, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Needs Improvement',
  insufficient_data: 'Insufficient Data'
};

export function CalibrationDashboard({ agentId, domain = 'software' }: CalibrationDashboardProps) {
  const [data, setData] = useState<CalibrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalibration() {
      try {
        const res = await fetch(`/api/arbitra/calibration/${agentId}?domain=${domain}&days=90`);
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError('Failed to load calibration data');
      } finally {
        setLoading(false);
      }
    }
    fetchCalibration();
  }, [agentId, domain]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-red-200">
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error || 'No data available'}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { calibration, profile, calibration_curve, sample_size } = data;
  const tier = calibration.calibration_tier;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Calibration Dashboard</h2>
          <p className="text-muted-foreground">
            Expertise metrics for {domain} • Last {data.lookback_days} days • {sample_size} judgments
          </p>
        </div>
        <Badge className={`${tierColors[tier]} text-white`}>
          {tierLabels[tier]}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Expertise Score"
          value={profile ? `${(profile.expertise_score * 100).toFixed(1)}%` : 'N/A'}
          icon={Award}
          trend={profile && profile.expertise_score > 0.7 ? 'positive' : 'neutral'}
        />
        <MetricCard
          title="Accuracy Rate"
          value={profile ? `${(profile.accuracy_rate * 100).toFixed(1)}%` : 'N/A'}
          icon={Target}
          trend={profile && profile.accuracy_rate > 0.65 ? 'positive' : 'neutral'}
        />
        <MetricCard
          title="Calibration (ECE)"
          value={calibration.ece ? calibration.ece.toFixed(3) : 'N/A'}
          icon={TrendingUp}
          trend={calibration.ece < 0.15 ? 'positive' : calibration.ece < 0.25 ? 'neutral' : 'negative'}
        />
        <MetricCard
          title="Total Judgments"
          value={profile ? profile.judgments_count.toString() : '0'}
          icon={CheckCircle}
        />
      </div>

      {/* Calibration Curve */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Calibration Curve</CardTitle>
          <p className="text-sm text-muted-foreground">
            How well your confidence matches your actual accuracy. The closer to the diagonal, the better.
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={calibration_curve}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="bin" 
                  label={{ value: 'Confidence Bin', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  domain={[0, 1]}
                  label={{ value: 'Actual Accuracy', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    `${(value * 100).toFixed(1)}%`,
                    name
                  ]}
                />
                <ReferenceLine x="40-60%" stroke="#ccc" strokeDasharray="3 3" />
                <ReferenceLine y={0.5} stroke="#ccc" strokeDasharray="3 3" />
                <Line 
                  type="monotone" 
                  dataKey="predicted" 
                  stroke="#94a3b8" 
                  strokeDasharray="5 5"
                  name="Perfect Calibration"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  stroke="#3b82f6" 
                  strokeWidth={2}
                  name="Your Calibration"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          
          {/* Bin counts */}
          <div className="mt-4 grid grid-cols-5 gap-2 text-center text-sm">
            {calibration_curve.map((bin) => (
              <div key={bin.bin} className="p-2 bg-muted rounded">
                <div className="font-medium">{bin.bin}</div>
                <div className="text-muted-foreground">{bin.count} votes</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expertise Breakdown */}
      {profile && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Expertise Components</CardTitle>
            <p className="text-sm text-muted-foreground">
              Multi-factor scoring breakdown
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <ComponentBar 
              label="Accuracy (35%)" 
              value={profile.accuracy_component}
              color="bg-blue-500"
            />
            <ComponentBar 
              label="Calibration (25%)" 
              value={profile.calibration_component}
              color="bg-green-500"
            />
            <ComponentBar 
              label="Stake/Skin (15%)" 
              value={0.6} // Placeholder
              color="bg-yellow-500"
            />
            <ComponentBar 
              label="Peer Endorsements (15%)" 
              value={0.5} // Placeholder
              color="bg-purple-500"
            />
            <ComponentBar 
              label="Activity (10%)" 
              value={profile.judgments_count > 10 ? 0.8 : 0.4}
              color="bg-orange-500"
            />
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card className={tier === 'poor' ? 'border-red-200' : tier === 'excellent' ? 'border-green-200' : ''}>
        <CardHeader>
          <CardTitle className="text-lg">Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{calibration.recommended_action}</p>
          
          {calibration.overconfidence_index > 0.1 && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
              <strong>Overconfidence detected:</strong> You're reporting higher confidence than your actual accuracy. 
              Try being more conservative in your confidence estimates, especially for difficult disputes.
            </div>
          )}
          
          {sample_size < 20 && (
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>Building history:</strong> You need at least 20 judgments for reliable calibration metrics. 
              Keep participating in disputes.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ 
  title, 
  value, 
  icon: Icon,
  trend = 'neutral'
}: { 
  title: string; 
  value: string; 
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'positive' | 'negative' | 'neutral';
}) {
  const trendColors = {
    positive: 'text-green-600',
    negative: 'text-red-600',
    neutral: 'text-muted-foreground'
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${trendColors[trend]}`}>{value}</p>
          </div>
          <Icon className="h-8 w-8 text-muted-foreground opacity-50" />
        </div>
      </CardContent>
    </Card>
  );
}

function ComponentBar({ 
  label, 
  value, 
  color 
}: { 
  label: string; 
  value: number; 
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} transition-all duration-500`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  );
}
