import assert from 'assert';
import { evaluateTaskScheduleAndMarks } from './js/api.js';
import { applyRoutineOrderAndDependencies } from './js/routineOrdering.js';

console.log('================================================================');
console.log('VERIFYING REQUIREMENTS 1, 2, AND 3');
console.log('================================================================');

// -----------------------------------------------------------------------------
// TEST 1: Scheduled Time Marks Calculation Logic (Requirement 3)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 1: Scheduled Marks & Display Lifecycle (Exact User Scenario) ---');

const musicTask = {
  id: 'task_music',
  title_si: 'සින්දු ඇසීම (Listen to music)',
  weight_points: 15,
  schema_definition: {
    schedule: { frequency: 'daily', time: 'anytime' } // whole day
  }
};

const cricketTask = {
  id: 'task_cricket',
  title_si: 'ක්‍රිකට් ක්‍රීඩා කිරීම (Play cricket)',
  weight_points: 20,
  schema_definition: {
    schedule: {
      frequency: 'daily',
      custom_time_from: '12:00',
      custom_time_to: '13:00'
    }
  }
};

const state = {};

// Scenario A: At 11:59 (before cricket start time)
const time1159 = new Date();
time1159.setHours(11, 59, 0, 0);

const musicAt1159 = evaluateTaskScheduleAndMarks(musicTask, state, time1159);
const cricketAt1159 = evaluateTaskScheduleAndMarks(cricketTask, state, time1159);

assert.strictEqual(musicAt1159.countInTotal, true, 'Whole-day music task counted in total at 11:59');
assert.strictEqual(musicAt1159.shouldDisplay, true, 'Whole-day music task displayed at 11:59');

assert.strictEqual(cricketAt1159.countInTotal, false, 'Cricket task NOT counted in total before start time (11:59)');
assert.strictEqual(cricketAt1159.shouldDisplay, false, 'Cricket task NOT active in checklist before 12:00');
assert.strictEqual(cricketAt1159.isUpcoming, true, 'Cricket task is marked as upcoming before 12:00');

let totalAt1159 = 0;
if (musicAt1159.countInTotal) totalAt1159 += musicAt1159.points;
if (cricketAt1159.countInTotal) totalAt1159 += cricketAt1159.points;
assert.strictEqual(totalAt1159, 15, 'Total points at 11:59 is 15 (music only)');
console.log('✓ At 11:59 -> Total points = 15, Cricket is upcoming');

// Scenario B: At 12:01 (cricket has started!)
const time1201 = new Date();
time1201.setHours(12, 1, 0, 0);

const musicAt1201 = evaluateTaskScheduleAndMarks(musicTask, state, time1201);
const cricketAt1201 = evaluateTaskScheduleAndMarks(cricketTask, state, time1201);

assert.strictEqual(musicAt1201.countInTotal, true, 'Music counted in total at 12:01');
assert.strictEqual(cricketAt1201.countInTotal, true, 'Cricket counted in total at 12:01 (start time 12:00 arrived)');
assert.strictEqual(cricketAt1201.shouldDisplay, true, 'Cricket is actively displayed in routine checklist at 12:01');

let totalAt1201 = 0;
if (musicAt1201.countInTotal) totalAt1201 += musicAt1201.points;
if (cricketAt1201.countInTotal) totalAt1201 += cricketAt1201.points;
assert.strictEqual(totalAt1201, 35, 'Total points at 12:01 is 15 + 20 = 35');
console.log('✓ At 12:01 -> Total points = 15 + 20 = 35, Cricket is active');

// Scenario C: At 13:01 (cricket ended at 13:00!)
const time1301 = new Date();
time1301.setHours(13, 1, 0, 0);

const musicAt1301 = evaluateTaskScheduleAndMarks(musicTask, state, time1301);
const cricketAt1301 = evaluateTaskScheduleAndMarks(cricketTask, state, time1301);

assert.strictEqual(musicAt1301.countInTotal, true, 'Music counted in total at 13:01');
assert.strictEqual(cricketAt1301.hasEnded, true, 'Cricket task hasEnded is true at 13:01 (> 13:00)');
assert.strictEqual(cricketAt1301.shouldDisplay, false, 'Cricket task does NOT display at 13:01 (ended at 13:00)');
assert.strictEqual(cricketAt1301.countInTotal, true, 'Cricket task marks REMAIN counted in day total even after ending');

let totalAt1301 = 0;
if (musicAt1301.countInTotal) totalAt1301 += musicAt1301.points;
if (cricketAt1301.countInTotal) totalAt1301 += cricketAt1301.points;
assert.strictEqual(totalAt1301, 35, 'Total points at 13:01 is STILL 35 even though cricket is not displayed');
console.log('✓ At 13:01 -> Total points STILL = 35, Cricket task is hidden from active list');

// -----------------------------------------------------------------------------
// TEST 2: Admin Profile Routines & Circular Ring Hidden (Requirement 1)
// -----------------------------------------------------------------------------
console.log('\n--- TEST 2: Admin Profile Clean-up Verification ---');

// Mock DOM elements
const mockSections = [
  { id: 'flow', hidden: false },
  { id: 'wake_up', hidden: false },
  { id: 'study', hidden: false },
  { id: 'fitness', hidden: false },
  { id: 'chores', hidden: false }
];

const mockElements = new Map();
mockSections.forEach(s => {
  mockElements.set(s.id, {
    classList: {
      add: (cls) => { if (cls === 'hidden') s.hidden = true; },
      remove: (cls) => { if (cls === 'hidden') s.hidden = false; },
      contains: (cls) => cls === 'hidden' ? s.hidden : false
    },
    getAttribute: (attr) => attr === 'data-section-id' ? s.id : null
  });
});

global.document = {
  getElementById: (id) => {
    if (id === 'routine-main-container') {
      return {
        querySelector: (sel) => {
          const match = sel.match(/data-section-id="([^"]+)"/);
          if (match) return mockElements.get(match[1]);
          return null;
        },
        querySelectorAll: () => [],
        appendChild: () => {}
      };
    }
    return null;
  },
  querySelectorAll: (sel) => {
    if (sel === '.routine-section') {
      return Array.from(mockElements.values());
    }
    if (sel === '.routine-lock-banner') {
      return [];
    }
    return [];
  },
  querySelector: () => null
};

// Admin profile active
global.window = {
  userManagerClient: {
    getCurrentUser: () => ({ id: 'user_admin', username: 'admin', role: 'admin' })
  }
};

applyRoutineOrderAndDependencies({});

mockSections.forEach(s => {
  assert.strictEqual(s.hidden, true, `Section ${s.id} is hidden for Admin profile`);
});
console.log('✓ All routine sections (wake_up, study, fitness, chores, flow) are strictly hidden for Admin profile');

console.log('\n================================================================');
console.log('ALL TESTS PASSED SUCCESSFULLY!');
console.log('================================================================');
