/**
 * @fileoverview ClawFS Stats API
 * @description GET /api/claw/fs/stats - Storage statistics and health
 * @version 1.0.0
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getClawFS, 
  ClawFSError 
} from '@/lib/claw/fs';

// ============================================================================
// TYPES
// ============================================================================

interface StatsResponse {
  success: boolean;
  stats?: {
    global: {
      totalFiles: number;
      totalSize: number;
      totalSizeFormatted: string;
    };
    byTier: {
      hot: TierStats;
      warm: TierStats;
      cold: TierStats;
    };
    byOwner: Array<{
      owner: string;
      files: number;
      size: number;
      sizeFormatted: string;
    }>;
    health: {
      status: 'healthy' | 'degraded' | 'critical';
      issues: string[];
    };
  };
  maintenance?: {
    promoted: number;
    demoted: number;
    cleaned: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

interface TierStats {
  files: number;
  size: number;
  sizeFormatted: string;
  percentage: number;
}

// ============================================================================
// MAIN HANDLER - GET /api/claw/fs/stats
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const runMaintenance = searchParams.get('maintenance') === 'true';

    const clawfs = getClawFS();
    
    // Get base stats
    const stats = await clawfs.getStats();

    // Format stats
    const formattedStats = {
      global: {
        totalFiles: stats.totalFiles,
        totalSize: stats.totalSize,
        totalSizeFormatted: formatBytes(stats.totalSize),
      },
      byTier: {
        hot: {
          files: stats.byTier.hot.files,
          size: stats.byTier.hot.size,
          sizeFormatted: formatBytes(stats.byTier.hot.size),
          percentage: stats.totalSize > 0 
            ? Math.round((stats.byTier.hot.size / stats.totalSize) * 100) 
            : 0,
        },
        warm: {
          files: stats.byTier.warm.files,
          size: stats.byTier.warm.size,
          sizeFormatted: formatBytes(stats.byTier.warm.size),
          percentage: stats.totalSize > 0 
            ? Math.round((stats.byTier.warm.size / stats.totalSize) * 100) 
            : 0,
        },
        cold: {
          files: stats.byTier.cold.files,
          size: stats.byTier.cold.size,
          sizeFormatted: formatBytes(stats.byTier.cold.size),
          percentage: stats.totalSize > 0 
            ? Math.round((stats.byTier.cold.size / stats.totalSize) * 100) 
            : 0,
        },
      },
      byOwner: Object.entries(stats.byOwner)
        .map(([owner, data]) => ({
          owner,
          files: data.files,
          size: data.size,
          sizeFormatted: formatBytes(data.size),
        }))
        .sort((a, b) => b.size - a.size),
      health: analyzeHealth(stats),
    };

    const response: StatsResponse = {
      success: true,
      stats: formattedStats,
    };

    // Run maintenance if requested
    if (runMaintenance) {
      const maintenance = await clawfs.runMaintenance();
      response.maintenance = maintenance;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('[ClawFS Stats Error]:', error);
    
    if (error instanceof ClawFSError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }, { status: 500 });
  }
}

// ============================================================================
// POST /api/claw/fs/stats
// Run maintenance operations
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json().catch(() => ({}));
    const operation = body.operation || 'maintenance';

    const clawfs = getClawFS();

    switch (operation) {
      case 'maintenance': {
        const result = await clawfs.runMaintenance();
        return NextResponse.json({
          success: true,
          operation: 'maintenance',
          result,
          message: `Maintenance complete: ${result.promoted} promoted, ${result.demoted} demoted, ${result.cleaned} cleaned`,
        });
      }

      case 'tier-migration': {
        const { identifier, newTier, owner } = body;
        if (!identifier || !newTier || !owner) {
          return NextResponse.json({
            success: false,
            error: {
              code: 'PARAMS_REQUIRED',
              message: 'identifier, newTier, and owner are required',
            },
          }, { status: 400 });
        }

        const metadata = await clawfs.migrateTier(identifier, newTier, owner);
        return NextResponse.json({
          success: true,
          operation: 'tier-migration',
          file: {
            cid: metadata.cid,
            path: metadata.path,
            newTier: metadata.tier,
          },
          message: `File migrated to ${newTier} tier`,
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: {
            code: 'INVALID_OPERATION',
            message: `Unknown operation: ${operation}`,
          },
        }, { status: 400 });
    }

  } catch (error) {
    console.error('[ClawFS Stats Operation Error]:', error);
    
    if (error instanceof ClawFSError) {
      return NextResponse.json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      },
    }, { status: 500 });
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + units[i];
}

function analyzeHealth(stats: {
  totalFiles: number;
  totalSize: number;
  byTier: Record<string, { files: number; size: number }>;
}): { status: 'healthy' | 'degraded' | 'critical'; issues: string[] } {
  const issues: string[] = [];
  
  // Check if hot tier is overloaded
  const hotRatio = stats.totalSize > 0 ? stats.byTier.hot.size / stats.totalSize : 0;
  if (hotRatio > 0.5) {
    issues.push('Hot tier size exceeds 50% of total storage');
  }

  // Check for cold tier usage (files should be in hot/warm ideally)
  const coldRatio = stats.totalSize > 0 ? stats.byTier.cold.size / stats.totalSize : 0;
  if (coldRatio > 0.8) {
    issues.push('High cold tier utilization - consider storage cleanup');
  }

  // Determine health status
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (issues.length >= 2) {
    status = 'critical';
  } else if (issues.length >= 1) {
    status = 'degraded';
  }

  return { status, issues };
}
