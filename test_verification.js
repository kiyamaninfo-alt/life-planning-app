/**
 * Comprehensive Automated Verification Suite
 * Tests:
 * 1. Zero-Score Exclusion in Analytics and Streaks
 * 2. Multi-Source Activity Streak (Unit Papers, Full Papers, Space Repetition)
 * 3. Day-of-the-Week Target Estimation (Historical Seasonality Benchmark)
 * 4. Weighted Scoring (Academic Priority Schema)
 * 5. Defensive Zero / Division-by-Zero Guard
 * 6. Module imports and Schema isolation
 */

import { UnitAnalytics } from './wosandi/controllers/unitAnalytics.js';
import { ScoringEngine, scoringEngine } from './wosandi/controllers/scoringEngine.js';
import { QUESTION_CATALOG } from './wosandi/controllers/questionnaireController.js';
import { DEFAULT_OL_SUBJECTS } from './wosandi/controllers/subjectManager.js';
import { dataService } from './wosandi/controllers/dataService.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log('=== TEST 1: Zero-Score Exclusion Enforcement ===');
const testScores = [
  { sub_unit_name: 'Trig', marks: 80 },
  { sub_unit_name: 'Trig', marks: 0 },   // Must be excluded!
  { sub_unit_name: 'Trig', marks: 90 },
  { sub_unit_name: 'Algebra', marks: 0 } // Must be excluded!
];

const filtered = UnitAnalytics.filterZeroScores(testScores);
assert(filtered.length === 2, `filterZeroScores should exclude 0-score attempts. Expected 2, got ${filtered.length}`);
assert(filtered.every(x => x.marks > 0), 'All filtered attempts must have marks > 0');

const trigAverages = UnitAnalytics.calculateSubUnitAverages(testScores);
assert(trigAverages.length === 1, `Algebra had only 0 marks so only Trig should remain. Got ${trigAverages.length}`);
assert(trigAverages[0].average === 85, `Trig average should be (80+90)/2 = 85. Got ${trigAverages[0].average}`);
assert(trigAverages[0].attempts === 2, `Trig attempts should be 2. Got ${trigAverages[0].attempts}`);

console.log('\n=== TEST 2: Multi-Source Activity Streak ===');
const todayStr = new Date().toISOString().split('T')[0];
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
const yesterdayStr = yesterday.toISOString().split('T')[0];
const dayBefore = new Date();
dayBefore.setDate(dayBefore.getDate() - 2);
const dayBeforeStr = dayBefore.toISOString().split('T')[0];

const streak1 = UnitAnalytics.calculateStreak({
  unitPapers: [{ paper_no: 1, marks: 90, updated_at: todayStr }],
  fullPapers: [{ marks: 85, updated_at: yesterdayStr }],
  spaceRepetition: [{ completed_at: dayBeforeStr }]
});
assert(streak1 === 3, `Expected 3-day multi-source streak across UP, FP, and SR. Got ${streak1}`);

// Check that 0-mark attempt doesn't count towards streak
const streakWithZero = UnitAnalytics.calculateStreak({
  unitPapers: [{ paper_no: 1, marks: 0, updated_at: todayStr }], // 0-score, should not count!
  fullPapers: [{ marks: 85, updated_at: yesterdayStr }]
});
assert(streakWithZero === 1, `Unit paper with 0 marks should not count for today. Streak should fall back to 1 (yesterday). Got ${streakWithZero}`);

console.log('\n=== TEST 3: Day-of-Week Estimation (Historical Seasonality) ===');
const engine = new ScoringEngine();
// Monday is day 1
const mockHistoricalLogs = [
  { log_date: '2026-09-14', earned_points: 150 }, // previous Monday
  { log_date: '2026-09-07', earned_points: 160 }, // 2 weeks ago Monday
  { log_date: '2026-08-31', earned_points: 140 }, // 3 weeks ago Monday
  { log_date: '2026-09-13', earned_points: 120 }  // Sunday (different day)
];

const mondayBench = engine.calculateDayOfWeekBenchmark(1, mockHistoricalLogs);
assert(mondayBench.benchmarkPoints === 150, `Monday benchmark should be (150+160+140)/3 = 150. Got ${mondayBench.benchmarkPoints}`);
assert(mondayBench.sampleWeeks === 3, `Sample weeks should be 3. Got ${mondayBench.sampleWeeks}`);
assert(mondayBench.isEstimated === false, `isEstimated should be false when historical logs exist`);

// Test fallback when no logs exist for Saturday (day 6)
const satBench = engine.calculateDayOfWeekBenchmark(6, []);
assert(satBench.isEstimated === true, 'isEstimated should be true when no historical logs exist');
assert(satBench.benchmarkPoints === 175, `Saturday default seasonality baseline should be 175. Got ${satBench.benchmarkPoints}`);

console.log('\n=== TEST 4: Weighted Scoring (Academic Priority Schema) ===');
const sampleTasks = [
  { id: 'math', tier: 'core_academic', weight: 25, completed: true },
  { id: 'science', tier: 'core_academic', weight: 25, completed: true },
  { id: 'commerce', tier: 'applied_basket', weight: 15, completed: true },
  { id: 'habit_desk', tier: 'routine_baseline', weight: 5, completed: true }
];

const scoreRes = engine.calculateWeightedScore(sampleTasks);
assert(scoreRes.earnedPoints === 70, `Earned points should be 25+25+15+5 = 70. Got ${scoreRes.earnedPoints}`);
assert(scoreRes.totalObtainablePoints === 70, `Total points should be 70. Got ${scoreRes.totalObtainablePoints}`);
assert(scoreRes.percentage === 100, `Percentage should be 100%. Got ${scoreRes.percentage}%`);

// Partial completion
const partialTasks = [
  { id: 'math', tier: 'core_academic', weight: 25, completed: true },
  { id: 'science', tier: 'core_academic', weight: 25, completed: false }, // 0
  { id: 'commerce', tier: 'applied_basket', weight: 15, completed: false }, // 0
  { id: 'habit_desk', tier: 'routine_baseline', weight: 5, completed: true }
];
const partialRes = engine.calculateWeightedScore(partialTasks);
assert(partialRes.earnedPoints === 30, `Earned points should be 25+5 = 30. Got ${partialRes.earnedPoints}`);
assert(partialRes.totalObtainablePoints === 70, `Total points should be 70. Got ${partialRes.totalObtainablePoints}`);
assert(partialRes.percentage === 43, `Percentage should be (30/70)*100 = 43%. Got ${partialRes.percentage}%`);

console.log('\n=== TEST 5: Defensive Zero / Division-by-Zero Guard ===');
const zeroTasks = [];
const zeroRes = engine.calculateWeightedScore(zeroTasks);
assert(zeroRes.totalObtainablePoints === 0, `Total points should be 0. Got ${zeroRes.totalObtainablePoints}`);
assert(zeroRes.earnedPoints === 0, `Earned points should be 0. Got ${zeroRes.earnedPoints}`);
assert(zeroRes.percentage === 0, `Percentage must be 0% (no NaN). Got ${zeroRes.percentage}`);
assert(!isNaN(zeroRes.percentage), 'Percentage must NOT be NaN');

console.log('\n=== TEST 6: Scoped Data Isolation & wosandi_ Prefix Verification ===');
const scoped = await dataService.getScopedData('11');
assert(scoped.grade === '11', 'Scoped data should return grade 11');
assert(scoped.unitPaperMarks.length > 0, 'Scoped unit papers should not be empty');
assert(scoped.fullPapers.length > 0, 'Scoped full papers should not be empty');
assert(scoped.spaceRepetition.length > 0, 'Scoped space repetition should not be empty');
assert(scoped.dailyLogs.length > 0, 'Scoped daily logs should not be empty');

console.log(`\n========================================`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log(`========================================`);

if (failed > 0) {
  process.exit(1);
}
