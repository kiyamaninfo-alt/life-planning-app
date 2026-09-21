/**
 * ScoringEngine - Wosandi O/L Mission Control
 * 
 * Implements:
 * 3.1 Day-of-the-Week Target Estimation (Historical Seasonality)
 * 3.3 Weighted Scoring (Academic Priority Schema)
 * 2.2 Defensive Zero / Division-by-Zero Guard
 */

export const DOW_PROFILES = [
  { dayIndex: 0, nameSi: 'ඉරිදා', nameEn: 'Sunday', defaultBaseline: 120, description: 'සති අන්ත සමාලෝචන හා සැලසුම් දිනය' },
  { dayIndex: 1, nameSi: 'සඳුදා', nameEn: 'Monday', defaultBaseline: 155, description: 'සතියේ ආරම්භක අධ්‍යයන දිනය' },
  { dayIndex: 2, nameSi: 'අඟහරුවාදා', nameEn: 'Tuesday', defaultBaseline: 160, description: 'මූලික අධ්‍යයන හා පේපර් පුහුණු දිනය' },
  { dayIndex: 3, nameSi: 'බදාදා', nameEn: 'Wednesday', defaultBaseline: 160, description: 'මධ්‍ය සති ස්ථායීතා අධ්‍යයන දිනය' },
  { dayIndex: 4, nameSi: 'බ්‍රහස්පතින්දා', nameEn: 'Thursday', defaultBaseline: 150, description: 'විෂය සමීක්ෂණ හා ගැටලු විසඳීමේ දිනය' },
  { dayIndex: 5, nameSi: 'සිකුරාදා', nameEn: 'Friday', defaultBaseline: 140, description: 'සතිපතා ප්‍රශ්න පත්‍ර සාකච්ඡා දිනය' },
  { dayIndex: 6, nameSi: 'සෙනසුරාදා', nameEn: 'Saturday', defaultBaseline: 175, description: 'සම්පූර්ණ පේපර් (Full Papers) සහ ගැඹුරු අධ්‍යයන දිනය' }
];

export const SCORING_TIERS = {
  CORE_ACADEMIC: {
    id: 'core_academic',
    nameSi: 'ප්‍රධාන අධ්‍යයන (Core Academic)',
    baseWeight: 25,
    maxWeight: 30,
    color: '#2563eb'
  },
  APPLIED_BASKET: {
    id: 'applied_basket',
    nameSi: 'කාණ්ඩ විෂයයන් (Basket & Applied)',
    baseWeight: 15,
    maxWeight: 20,
    color: '#059669'
  },
  ROUTINE_BASELINE: {
    id: 'routine_baseline',
    nameSi: 'දෛනික පුරුදු (Routine Habits)',
    baseWeight: 5,
    maxWeight: 8,
    color: '#64748b'
  }
};

export class ScoringEngine {
  constructor() {
    this.dowProfiles = DOW_PROFILES;
  }

  /**
   * 3.1 Calculate Day-of-the-Week Target Benchmark (Historical Seasonality)
   * Aggregates points earned on that exact same day of the week across previous 3-4 weeks.
   * 
   * @param {number} dayOfWeek - 0 (Sun) to 6 (Sat)
   * @param {Array} historicalLogs - Array of previous log entries { log_date, earned_points }
   * @returns {Object} { benchmarkPoints, sampleWeeks, isEstimated, dayProfile }
   */
  calculateDayOfWeekBenchmark(dayOfWeek, historicalLogs = []) {
    const profile = this.dowProfiles.find(p => p.dayIndex === dayOfWeek) || this.dowProfiles[1];
    const todayStr = new Date().toISOString().split('T')[0];

    // Filter historical logs on the exact same weekday, excluding today and zero-score days
    const matchingLogs = (Array.isArray(historicalLogs) ? historicalLogs : [])
      .filter(log => {
        if (!log.log_date || log.log_date === todayStr) return false;
        const d = new Date(log.log_date);
        return d.getDay() === dayOfWeek && Number(log.earned_points || 0) > 0;
      })
      .slice(0, 4); // Aggregate last 3–4 same weekdays

    if (matchingLogs.length >= 1) {
      const sum = matchingLogs.reduce((acc, curr) => acc + Number(curr.earned_points || 0), 0);
      const avg = Math.round(sum / matchingLogs.length);
      return {
        benchmarkPoints: avg,
        sampleWeeks: matchingLogs.length,
        isEstimated: false,
        dayProfile: profile,
        details: `පසුගිය ${profile.nameSi} දින ${matchingLogs.length} ක සාමාන්‍යය`
      };
    }

    // Default baseline fallback for historical seasonality
    return {
      benchmarkPoints: profile.defaultBaseline,
      sampleWeeks: 0,
      isEstimated: true,
      dayProfile: profile,
      details: `${profile.nameSi} Seasonality Baseline (${profile.description})`
    };
  }

  /**
   * 3.3 Calculate Weighted Score based on Active Questionnaire Tasks
   * 
   * @param {Array} tasks - Questionnaire items with { id, tier, weight, completed, scoreRatio }
   * @returns {Object} { earnedPoints, totalObtainablePoints, percentage, tierBreakdown }
   */
  calculateWeightedScore(tasks = []) {
    let earnedPoints = 0;
    let totalObtainablePoints = 0;

    const tierBreakdown = {
      core_academic: { earned: 0, total: 0 },
      applied_basket: { earned: 0, total: 0 },
      routine_baseline: { earned: 0, total: 0 }
    };

    tasks.forEach(task => {
      const weight = Number(task.weight) || (
        task.tier === 'core_academic' ? 25 :
        task.tier === 'applied_basket' ? 15 : 5
      );

      totalObtainablePoints += weight;

      let taskEarned = 0;
      if (task.completed === true) {
        taskEarned = weight;
      } else if (typeof task.scoreRatio === 'number' && task.scoreRatio > 0) {
        taskEarned = Math.round(weight * Math.min(1, Math.max(0, task.scoreRatio)));
      }

      earnedPoints += taskEarned;

      const tierKey = task.tier || 'routine_baseline';
      if (tierBreakdown[tierKey]) {
        tierBreakdown[tierKey].earned += taskEarned;
        tierBreakdown[tierKey].total += weight;
      }
    });

    // 2.2 Defensive Zero / Division-by-Zero Guard
    const validTotal = totalObtainablePoints > 0 ? totalObtainablePoints : 0;
    const validEarned = earnedPoints > 0 ? earnedPoints : 0;
    const percentage = validTotal > 0 ? Math.min(100, Math.round((validEarned / validTotal) * 100)) : 0;

    return {
      earnedPoints: validEarned,
      totalObtainablePoints: validTotal,
      percentage,
      tierBreakdown
    };
  }
}

export const scoringEngine = new ScoringEngine();
