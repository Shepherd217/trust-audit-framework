import type { taskCategory, coordinationType } from '@/types/committee-intelligence';
import { createClient } from '@supabase/supabase-js';

/**
 * Auto-classifies disputes by complexity using keyword matching + evidence analysis.
 * Addresses task difficulty bias identified by agent_anthropo.
 */

// Keyword lexicons by category (from research)
const CATEGORY_KEYWORDS: Record<string, { high: string[]; medium: string[] }> = {
  software: {
    high: ['bug fix', 'feature implementation', 'code review', 'refactor', 'test suite'],
    medium: ['API', 'function', 'class', 'module', 'library', 'framework', 'deploy']
  },
  infrastructure: {
    high: ['deploy', 'CI/CD', 'infrastructure', 'server provisioning', 'cloud migration'],
    medium: ['AWS', 'Docker', 'Kubernetes', 'pipeline', 'terraform', 'cloud', 'server']
  },
  data_analytics: {
    high: ['analysis', 'dataset', 'visualization', 'dashboard', 'ETL', 'ML model training'],
    medium: ['SQL', 'CSV', 'metrics', 'statistics', 'correlation', 'data pipeline']
  },
  creative: {
    high: ['design', 'logo', 'brand identity', 'creative direction', 'illustration'],
    medium: ['visual', 'aesthetic', 'style', 'composition', 'layout', 'UI', 'UX']
  },
  research: {
    high: ['market research', 'literature review', 'due diligence', 'competitive analysis'],
    medium: ['research', 'sources', 'citations', 'methodology', 'findings', 'report']
  },
  administrative: {
    high: ['data entry', 'transcription', 'scheduling', 'virtual assistant'],
    medium: ['coordination', 'support', 'management', 'organization', 'admin']
  }
};

// File extensions by category
const CATEGORY_EXTENSIONS: Record<string, string[]> = {
  software: ['.py', '.js', '.ts', '.sol', '.java', '.go', '.rs', '.cpp', '.c'],
  infrastructure: ['.yml', '.yaml', '.tf', '.json', '.sh', '.hcl'],
  data_analytics: ['.csv', '.sql', '.ipynb', '.parquet', '.xlsx', '.json'],
  creative: ['.psd', '.ai', '.fig', '.sketch', '.png', '.jpg', '.mp4', '.mov'],
  research: ['.pdf', '.docx', '.bib', '.tex'],
  administrative: ['.xlsx', '.docx', '.ics', '.csv']
};

// Evidence objectivity scores (higher = more objective)
const EVIDENCE_OBJECTIVITY: Record<string, number> = {
  'automated_test': 0.95,
  'ci_cd_logs': 0.90,
  'system_metrics': 0.88,
  'error_logs': 0.85,
  'git_commits': 0.80,
  'deployment_logs': 0.78,
  'performance_benchmarks': 0.75,
  'audit_trail': 0.70,
  'documentation': 0.60,
  'screenshots': 0.55,
  'communication_records': 0.50,
  'testimonials': 0.40,
  'subjective_assessment': 0.25
};

interface ClassificationInput {
  description: string;
  evidenceTypes: string[];
  stakeholderCount?: number;
  taskSteps?: number;
  hasAutomatedTests?: boolean;
  hasClearAcceptanceCriteria?: boolean;
}

interface ClassificationResult {
  primaryCategory: taskCategory;
  secondaryCategory: taskCategory | null;
  classificationConfidence: number;
  evidenceObjectivity: number;
  domainExpertiseRequired: number;
  specificationClarity: number;
  difficultyRating: number; // 1-5
  coordinationComplexity: coordinationType;
}

/**
 * Score text against keyword lexicon
 */
function scoreKeywords(text: string, keywords: { high: string[]; medium: string[] }): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  for (const kw of keywords.high) {
    if (lowerText.includes(kw.toLowerCase())) score += 3;
  }
  for (const kw of keywords.medium) {
    if (lowerText.includes(kw.toLowerCase())) score += 1;
  }
  
  return score;
}

/**
 * Detect category from description
 */
function detectCategory(description: string): { category: taskCategory; confidence: number } {
  const scores: Record<string, number> = {};
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    scores[category] = scoreKeywords(description, keywords);
  }
  
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;
  
  // Confidence based on margin between top and second
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const margin = totalScore > 0 ? (top[1] - (second?.[1] || 0)) / totalScore : 0;
  const confidence = Math.min(0.95, 0.5 + margin * 0.5);
  
  return {
    category: top[0] as taskCategory,
    confidence: top[1] > 0 ? confidence : 0.5
  };
}

/**
 * Calculate evidence objectivity from evidence types
 */
function calculateEvidenceObjectivity(evidenceTypes: string[]): number {
  if (evidenceTypes.length === 0) return 0.5;
  
  const scores = evidenceTypes.map(type => EVIDENCE_OBJECTIVITY[type] || 0.5);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  
  // Boost if multiple high-objectivity pieces
  const highObjectivityCount = scores.filter(s => s > 0.8).length;
  const boost = Math.min(0.15, highObjectivityCount * 0.05);
  
  return Math.min(0.99, avg + boost);
}

/**
 * Estimate domain expertise required based on keywords
 */
function estimateDomainExpertise(description: string): number {
  const indicators = [
    'architecture', 'system design', 'protocol', 'cryptography', 'consensus',
    'compliance', 'regulatory', 'jurisdiction', 'securities law',
    'machine learning', 'neural network', 'statistical', 'algorithm',
    'smart contract', 'solidity', 'security audit', 'vulnerability'
  ];
  
  const lowerDesc = description.toLowerCase();
  const matches = indicators.filter(i => lowerDesc.includes(i)).length;
  
  return Math.min(0.95, 0.3 + matches * 0.15);
}

/**
 * Estimate specification clarity
 */
function estimateSpecificationClarity(
  description: string,
  hasAutomatedTests: boolean,
  hasClearAcceptanceCriteria: boolean
): number {
  let score = 0.5;
  
  // Boost for clear markers
  if (hasAutomatedTests) score += 0.2;
  if (hasClearAcceptanceCriteria) score += 0.2;
  
  // Check for ambiguity markers
  const ambiguityMarkers = [
    'unclear', 'ambiguous', 'not specified', 'TBD', 'to be determined',
    'subjective', 'at discretion', 'best effort'
  ];
  const lowerDesc = description.toLowerCase();
  const ambiguityCount = ambiguityMarkers.filter(m => lowerDesc.includes(m)).length;
  score -= ambiguityCount * 0.1;
  
  // Check for clear acceptance markers
  const clarityMarkers = [
    'acceptance criteria', 'definition of done', 'test cases',
    'measurable', 'quantifiable', 'objective criteria'
  ];
  const clarityCount = clarityMarkers.filter(m => lowerDesc.includes(m)).length;
  score += clarityCount * 0.05;
  
  return Math.max(0.1, Math.min(0.95, score));
}

/**
 * Determine coordination complexity
 */
function determineCoordinationComplexity(
  stakeholderCount: number,
  taskSteps: number
): coordinationType {
  if (stakeholderCount === 1 && taskSteps <= 2) return 'single';
  if (stakeholderCount <= 3 && taskSteps <= 5) return 'sequential';
  if (stakeholderCount > 3 || taskSteps > 8) return 'dynamic';
  return 'parallel';
}

/**
 * Calculate final difficulty rating (1-5 stars)
 */
function calculateDifficultyRating(
  evidenceObjectivity: number,
  domainExpertiseRequired: number,
  specificationClarity: number,
  stakeholderCount: number,
  coordinationComplexity: coordinationType
): number {
  // Base from evidence objectivity (inverted - low objectivity = high difficulty)
  let difficulty = (1 - evidenceObjectivity) * 2;
  
  // Domain expertise adds difficulty
  difficulty += domainExpertiseRequired * 0.5;
  
  // Specification clarity (inverted)
  difficulty += (1 - specificationClarity) * 1.5;
  
  // Stakeholder complexity
  if (stakeholderCount > 5) difficulty += 0.5;
  if (stakeholderCount > 3) difficulty += 0.3;
  
  // Coordination complexity
  const coordDifficulty = {
    single: 0,
    sequential: 0.2,
    parallel: 0.5,
    dynamic: 0.8
  };
  difficulty += coordDifficulty[coordinationComplexity];
  
  // Normalize to 1-5 scale
  return Math.min(5, Math.max(1, Math.round(difficulty)));
}

/**
 * Main classification function
 */
export function classifyDispute(input: ClassificationInput): ClassificationResult {
  const {
    description,
    evidenceTypes,
    stakeholderCount = 2,
    taskSteps = 3,
    hasAutomatedTests = false,
    hasClearAcceptanceCriteria = false
  } = input;
  
  // Detect category
  const { category: primaryCategory, confidence: classificationConfidence } = detectCategory(description);
  
  // Calculate complexity dimensions
  const evidenceObjectivity = calculateEvidenceObjectivity(evidenceTypes);
  const domainExpertiseRequired = estimateDomainExpertise(description);
  const specificationClarity = estimateSpecificationClarity(
    description,
    hasAutomatedTests,
    hasClearAcceptanceCriteria
  );
  
  // Determine coordination complexity
  const coordinationComplexity = determineCoordinationComplexity(stakeholderCount, taskSteps);
  
  // Calculate final difficulty
  const difficultyRating = calculateDifficultyRating(
    evidenceObjectivity,
    domainExpertiseRequired,
    specificationClarity,
    stakeholderCount,
    coordinationComplexity
  );
  
  // Secondary category (if scores are close)
  const secondaryCategory = null; // Could implement if needed
  
  return {
    primaryCategory,
    secondaryCategory,
    classificationConfidence,
    evidenceObjectivity,
    domainExpertiseRequired,
    specificationClarity,
    difficultyRating,
    coordinationComplexity
  };
}

/**
 * Save classification to database
 */
export async function saveClassification(
  supabase: ReturnType<typeof createClient>,
  disputeId: string,
  classification: ClassificationResult,
  classifiedBy: string | null = null
): Promise<void> {
  const { error } = await supabase
    .from('dispute_complexity_scores')
    .upsert({
      dispute_id: disputeId,
      primary_category: classification.primaryCategory,
      secondary_category: classification.secondaryCategory,
      classification_confidence: classification.classificationConfidence,
      evidence_objectivity: classification.evidenceObjectivity,
      domain_expertise_required: classification.domainExpertiseRequired,
      specification_clarity: classification.specificationClarity,
      stakeholder_count: 2, // TODO: pass from input
      task_decomposition_depth: 3, // TODO: pass from input
      coordination_complexity: classification.coordinationComplexity,
      difficulty_rating: classification.difficultyRating,
      classification_method: classifiedBy ? 'hybrid' : 'auto',
      classified_by: classifiedBy,
      classified_at: new Date().toISOString()
    }, {
      onConflict: 'dispute_id'
    });
  
  if (error) throw error;
}

/**
 * Batch classify pending disputes without complexity scores
 */
export async function batchClassifyPendingDisputes(
  supabase: ReturnType<typeof createClient>
): Promise<number> {
  // Get disputes without classification
  const { data: disputes, error } = await supabase
    .from('disputes')
    .select('id, description, evidence_types, created_at')
    .not('id', 'in', supabase
      .from('dispute_complexity_scores')
      .select('dispute_id')
    )
    .order('created_at', { ascending: false })
    .limit(100);
  
  if (error) throw error;
  if (!disputes || disputes.length === 0) return 0;
  
  let classified = 0;
  
  for (const dispute of disputes) {
    try {
      const classification = classifyDispute({
        description: dispute.description || '',
        evidenceTypes: dispute.evidence_types || [],
        stakeholderCount: 2,
        hasAutomatedTests: false,
        hasClearAcceptanceCriteria: false
      });
      
      await saveClassification(supabase, dispute.id, classification);
      classified++;
    } catch (err) {
      console.error(`Failed to classify dispute ${dispute.id}:`, err);
    }
  }
  
  return classified;
}

// Export for API route
export { taskCategory, coordinationType };
