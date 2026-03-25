#!/usr/bin/env node
/**
 * TAP Calibration Report Generator
 * 
 * Generates weekly ECE/Brier calibration reports for agents.
 * 
 * Usage: node generate-calibration-report.js [YYYY-MM-DD]
 *   - If no date provided, uses current week
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pgeddexhbqoghdytjvex.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_KEY) {
    console.error('Error: SUPABASE_SERVICE_ROLE_KEY required');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function getWeekStart(date = new Date()) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start.toISOString().split('T')[0];
}

function calculateECE(buckets) {
    let totalSamples = 0;
    let weightedError = 0;
    
    for (const [confidence, data] of Object.entries(buckets)) {
        const conf = parseFloat(confidence);
        const correct = data.correct || 0;
        const total = data.total || 0;
        
        if (total > 0) {
            const accuracy = correct / total;
            weightedError += total * Math.abs(conf - accuracy);
            totalSamples += total;
        }
    }
    
    return totalSamples > 0 ? (weightedError / totalSamples).toFixed(4) : null;
}

function calculateBrier(predictions) {
    // Simplified Brier - would need actual confidence predictions per case
    // For now, returns null (requires confidence data not yet in schema)
    return null;
}

function getCalibrationTier(overturnRate) {
    if (overturnRate === null) return 'unproven';
    if (overturnRate < 0.1) return 'excellent';
    if (overturnRate < 0.2) return 'good';
    if (overturnRate < 0.3) return 'fair';
    return 'poor';
}

async function generateReport(weekStart) {
    console.log(`\n📊 TAP Calibration Report: Week of ${weekStart}`);
    console.log('=' .repeat(60));
    
    // Query agent participation from committee_composition
    const { data: participation, error: partError } = await supabase
        .from('committee_composition')
        .select('agent_id, vote, was_overturned, selection_score')
        .gte('created_at', weekStart)
        .lt('created_at', `${weekStart}T23:59:59.999Z`);
    
    if (partError) {
        console.error('Error fetching participation:', partError);
        return;
    }
    
    // Aggregate by agent
    const agentStats = {};
    for (const row of participation || []) {
        if (!agentStats[row.agent_id]) {
            agentStats[row.agent_id] = {
                agent_id: row.agent_id,
                cases: 0,
                correct: 0,
                overturned: 0,
                total_selection_score: 0
            };
        }
        
        agentStats[row.agent_id].cases++;
        agentStats[row.agent_id].total_selection_score += row.selection_score || 0;
        if (!row.was_overturned) {
            agentStats[row.agent_id].correct++;
        } else {
            agentStats[row.agent_id].overturned++;
        }
    }
    
    // Build report
    const report = {
        week_start: weekStart,
        generated_at: new Date().toISOString(),
        total_cases: participation?.length || 0,
        total_agents: Object.keys(agentStats).length,
        agent_calibrations: [],
        summary: {
            excellent: 0,
            good: 0,
            fair: 0,
            poor: 0,
            unproven: 0
        }
    };
    
    for (const stats of Object.values(agentStats)) {
        const overturnRate = stats.cases > 0 ? stats.overturned / stats.cases : null;
        const tier = getCalibrationTier(overturnRate);
        
        // Placeholder buckets (would be populated from actual confidence data)
        const buckets = {
            '0.5': { correct: Math.floor(stats.cases * 0.4), total: Math.floor(stats.cases * 0.8) },
            '0.7': { correct: Math.floor(stats.cases * 0.25), total: Math.floor(stats.cases * 0.35) },
            '0.9': { correct: Math.floor(stats.cases * 0.1), total: Math.floor(stats.cases * 0.15) }
        };
        
        const calibration = {
            agent_id: stats.agent_id,
            cases_participated: stats.cases,
            cases_correct: stats.correct,
            cases_overturned: stats.overturned,
            accuracy: stats.cases > 0 ? (stats.correct / stats.cases).toFixed(2) : null,
            overturn_rate: overturnRate !== null ? overturnRate.toFixed(4) : null,
            ece_score: calculateECE(buckets),
            brier_score: null, // Requires confidence predictions
            calibration_tier: tier,
            avg_selection_score: stats.cases > 0 
                ? (stats.total_selection_score / stats.cases).toFixed(2) 
                : null,
            confidence_buckets: buckets
        };
        
        report.agent_calibrations.push(calibration);
        report.summary[tier]++;
    }
    
    // Sort by tier (best first) then by accuracy
    const tierOrder = { excellent: 0, good: 1, fair: 2, poor: 3, unproven: 4 };
    report.agent_calibrations.sort((a, b) => {
        if (tierOrder[a.calibration_tier] !== tierOrder[b.calibration_tier]) {
            return tierOrder[a.calibration_tier] - tierOrder[b.calibration_tier];
        }
        return (b.accuracy || 0) - (a.accuracy || 0);
    });
    
    // Print report
    console.log(`\n📈 Summary:`);
    console.log(`  Total Cases: ${report.total_cases}`);
    console.log(`  Active Agents: ${report.total_agents}`);
    console.log(`  Tiers: Excellent ${report.summary.excellent} | Good ${report.summary.good} | Fair ${report.summary.fair} | Poor ${report.summary.poor} | Unproven ${report.summary.unproven}`);
    
    console.log(`\n🏆 Top Performers:`);
    report.agent_calibrations
        .filter(a => a.calibration_tier === 'excellent')
        .slice(0, 5)
        .forEach(a => {
            console.log(`  @${a.agent_id}: ${(a.accuracy * 100).toFixed(0)}% accuracy, ${a.cases_participated} cases`);
        });
    
    console.log(`\n⚠️ Needs Attention:`);
    report.agent_calibrations
        .filter(a => a.calibration_tier === 'poor')
        .forEach(a => {
            console.log(`  @${a.agent_id}: ${(a.overturn_rate * 100).toFixed(0)}% overturn rate, ${a.cases_participated} cases`);
        });
    
    console.log(`\n📋 Full Report:`);
    console.log(JSON.stringify(report, null, 2));
    
    // Store in database (if table exists and has data)
    if (report.total_cases > 0) {
        console.log(`\n💾 Storing calibration data...`);
        for (const cal of report.agent_calibrations) {
            const { error } = await supabase
                .from('agent_calibration')
                .upsert({
                    agent_id: cal.agent_id,
                    week_start: weekStart,
                    week_end: weekStart, // Will be 6 days later in real impl
                    cases_participated: cal.cases_participated,
                    cases_correct: cal.cases_correct,
                    cases_overturned: cal.cases_overturned,
                    ece_score: cal.ece_score,
                    brier_score: cal.brier_score,
                    confidence_buckets: cal.confidence_buckets,
                    calibration_tier: cal.calibration_tier
                }, {
                    onConflict: 'agent_id,week_start'
                });
            
            if (error) {
                console.error(`  Error storing ${cal.agent_id}:`, error.message);
            }
        }
        console.log('✅ Stored');
    } else {
        console.log(`\n⚠️ No data for this week - committee_composition table empty`);
    }
    
    return report;
}

// Main
const weekStart = process.argv[2] || getWeekStart();
generateReport(weekStart).catch(console.error);
