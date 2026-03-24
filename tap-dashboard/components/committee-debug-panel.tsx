'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Hammer, 
  Users, 
  Search, 
  Play, 
  CheckCircle, 
  AlertCircle,
  Brain,
  Target
} from 'lucide-react';

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: string;
}

export function CommitteeDebugPanel() {
  const [activeTab, setActiveTab] = useState<'classify' | 'select' | 'calibration'>('classify');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);

  // Classification form state
  const [description, setDescription] = useState('');
  const [evidenceTypes, setEvidenceTypes] = useState('');
  
  // Committee selection form state
  const [disputeId, setDisputeId] = useState('');
  const [committeeSize, setCommitteeSize] = useState('7');
  const [targetDomain, setTargetDomain] = useState('');
  
  // Calibration form state
  const [agentId, setAgentId] = useState('');
  const [domain, setDomain] = useState('software');

  const runClassification = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arbitra/disputes/${disputeId || 'test'}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          evidence_types: evidenceTypes.split(',').map(s => s.trim()).filter(Boolean),
          stakeholder_count: 2,
          task_steps: 3,
          has_automated_tests: evidenceTypes.includes('test'),
          has_clear_acceptance_criteria: true
        })
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        data,
        error: res.ok ? undefined : data.error,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setResult({
        success: false,
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const runCommitteeSelection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/arbitra/committee/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dispute_id: disputeId || '00000000-0000-0000-0000-000000000000',
          committee_size: parseInt(committeeSize),
          target_domain: targetDomain || undefined
        })
      });
      const data = await res.json();
      setResult({
        success: res.ok,
        data,
        error: res.ok ? undefined : data.error,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setResult({
        success: false,
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  const runCalibration = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/arbitra/calibration/${agentId || 'test'}?domain=${domain}&days=90`);
      const data = await res.json();
      setResult({
        success: res.ok,
        data,
        error: res.ok ? undefined : data.error,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      setResult({
        success: false,
        error: (err as Error).message,
        timestamp: new Date().toISOString()
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Hammer className="h-6 w-6" />
            Committee Intelligence Debug Panel
          </h1>
          <p className="text-muted-foreground">Test classification, committee selection, and calibration APIs</p>
        </div>
        <Badge variant="outline">Admin Only</Badge>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'classify' ? 'default' : 'outline'}
          onClick={() => setActiveTab('classify')}
          className="flex items-center gap-2"
        >
          <Brain className="h-4 w-4" />
          Classify Dispute
        </Button>
        <Button
          variant={activeTab === 'select' ? 'default' : 'outline'}
          onClick={() => setActiveTab('select')}
          className="flex items-center gap-2"
        >
          <Users className="h-4 w-4" />
          Select Committee
        </Button>
        <Button
          variant={activeTab === 'calibration' ? 'default' : 'outline'}
          onClick={() => setActiveTab('calibration')}
          className="flex items-center gap-2"
        >
          <Target className="h-4 w-4" />
          Calibration
        </Button>
      </div>

      {/* Classification Form */}
      {activeTab === 'classify' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Classification</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Dispute Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the dispute (e.g., 'Bug fix in payment processing module with failing tests...')"
                className="mt-1"
                rows={4}
              />
            </div>
            
            <div>
              <label className="text-sm font-medium">Evidence Types (comma-separated)</label>
              <Input
                value={evidenceTypes}
                onChange={(e) => setEvidenceTypes(e.target.value)}
                placeholder="automated_test, git_commits, logs"
                className="mt-1"
              />
            </div>

            <Button 
              onClick={runClassification} 
              disabled={loading || !description}
              className="w-full"
            >
              <Play className="h-4 w-4 mr-2" />
              {loading ? 'Classifying...' : 'Run Classification'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Committee Selection Form */}
      {activeTab === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Committee Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Dispute ID (optional)</label>
              <Input
                value={disputeId}
                onChange={(e) => setDisputeId(e.target.value)}
                placeholder="uuid or leave empty for test"
                className="mt-1"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Committee Size</label>
                <Select value={committeeSize} onValueChange={setCommitteeSize}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3 (Minimum)</SelectItem>
                    <SelectItem value="5">5 (Standard)</SelectItem>
                    <SelectItem value="7">7 (Complex)</SelectItem>
                    <SelectItem value="9">9 (High Stakes)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium">Target Domain (optional)</label>
                <Select value={targetDomain} onValueChange={setTargetDomain}>
                  <SelectTrigger>
                    <SelectValue placeholder="Auto-detect" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Auto-detect</SelectItem>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="data_analytics">Data Analytics</SelectItem>
                    <SelectItem value="creative">Creative</SelectItem>
                    <SelectItem value="technical_architecture">Technical Architecture</SelectItem>
                    <SelectItem value="legal_compliance">Legal Compliance</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={runCommitteeSelection} 
              disabled={loading}
              className="w-full"
            >
              <Users className="h-4 w-4 mr-2" />
              {loading ? 'Selecting...' : 'Select Committee'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Calibration Form */}
      {activeTab === 'calibration' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Test Calibration Lookup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Agent ID</label>
                <Input
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="Agent UUID"
                  className="mt-1"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium">Domain</label>
                <Select value={domain} onValueChange={setDomain}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="software">Software</SelectItem>
                    <SelectItem value="infrastructure">Infrastructure</SelectItem>
                    <SelectItem value="data_analytics">Data Analytics</SelectItem>
                    <SelectItem value="technical_architecture">Technical Architecture</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button 
              onClick={runCalibration} 
              disabled={loading}
              className="w-full"
            >
              <Search className="h-4 w-4 mr-2" />
              {loading ? 'Fetching...' : 'Get Calibration'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className={result.success ? 'border-green-200' : 'border-red-200'}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {result.success ? (
                <><CheckCircle className="h-5 w-5 text-green-500" /> Success</>
              ) : (
                <><AlertCircle className="h-5 w-5 text-red-500" /> Error</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {result.error && (
              <Alert variant="destructive">
                <AlertDescription>{result.error}</AlertDescription>
              </Alert>
            )}
            
            {result.data && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Response data:</p>
                <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-96">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            )}
            
            <p className="text-xs text-muted-foreground">
              Timestamp: {result.timestamp}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
