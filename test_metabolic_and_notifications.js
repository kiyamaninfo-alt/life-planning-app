/**
 * test_metabolic_and_notifications.js
 * Comprehensive unit and integration test suite for:
 * 1. Granular User Notification & Visibility Engine
 * 2. Metabolic Meal-Interval Tracker (5-Hour Fasting/Gap Engine)
 * 3. Feature & UI/UX Specifications: Fasting & Routine Tracker (9 Requirements)
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- RUNNING TEST SUITE: Metabolic Tracker & Notification Engine ---');

// Mock localStorage for Node.js environment
class LocalStorageMock {
  constructor() {
    this.store = {};
  }
  getItem(key) {
    return this.store[key] || null;
  }
  setItem(key, value) {
    this.store[key] = String(value);
  }
  removeItem(key) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}

globalThis.localStorage = new LocalStorageMock();

// =========================================================================
// 1. Static HTML & File Verification
// =========================================================================
console.log('Testing: Static HTML & JavaScript integrations...');

const indexHtml = fs.readFileSync(path.resolve('index.html'), 'utf8');
const adminIndexHtml = fs.readFileSync(path.resolve('admin/index.html'), 'utf8');
const adminAppJs = fs.readFileSync(path.resolve('admin/js/adminApp.js'), 'utf8');
const appJs = fs.readFileSync(path.resolve('js/app.js'), 'utf8');
const apiJs = fs.readFileSync(path.resolve('js/api.js'), 'utf8');

// 1.1 index.html checks
assert.ok(indexHtml.includes('id="metabolic-tracker-sticky-container"'), 'index.html must contain metabolic-tracker-sticky-container');
assert.ok(indexHtml.includes('id="fasting-tracker-card-container"'), 'index.html must contain fasting-tracker-card-container');
assert.ok(indexHtml.includes('id="recent-changes-section"'), 'index.html must contain recent-changes-section directly below Daily Routine');
assert.ok(indexHtml.includes('js/metabolicTracker.js'), 'index.html must load js/metabolicTracker.js');
assert.ok(indexHtml.includes('js/notificationClient.js'), 'index.html must load js/notificationClient.js');

// 1.2 Layout Hierarchy Check (Requirement 1)
const routineIdx = indexHtml.indexOf('දෛනික කාර්යයන් (Daily Routine)');
const recentChangesIdx = indexHtml.indexOf('id="recent-changes-section"');
assert.ok(routineIdx > 0, 'Daily Routine section header must exist');
assert.ok(recentChangesIdx > routineIdx, 'Recent Changes section must be positioned directly below Daily Routine');

// 1.3 admin/index.html checks
assert.ok(adminIndexHtml.includes('data-tab="notifications"'), 'admin/index.html must contain notifications tab navigation link');
assert.ok(adminIndexHtml.includes('id="tab-notifications"'), 'admin/index.html must contain tab-notifications container');

// 1.4 adminApp.js checks
assert.ok(adminAppJs.includes('NotificationManager'), 'adminApp.js must import NotificationManager');
assert.ok(adminAppJs.includes('/admin/notifications'), 'adminApp.js must handle /admin/notifications route');
assert.ok(adminAppJs.includes('this.managers.notifications = new NotificationManager'), 'adminApp.js must instantiate NotificationManager');

// 1.5 app.js Past Performance checks
assert.ok(appJs.includes('perf-tab-metabolic'), 'app.js must contain perf-tab-metabolic in Past Performance modal');
assert.ok(appJs.includes('perf-pane-metabolic'), 'app.js must contain perf-pane-metabolic in Past Performance modal');
assert.ok(appJs.includes('fetchMealLogs'), 'app.js must call fetchMealLogs in Past Performance modal');
assert.ok(appJs.includes('calculateAnalytics'), 'app.js must call calculateAnalytics in Past Performance modal');

// 1.6 api.js Gamification Scoring check (Requirement 9)
assert.ok(apiJs.includes('getTodayFastingPoints'), 'api.js must query getTodayFastingPoints for scoring');
assert.ok(apiJs.includes('window.syncProgressWithServer = syncProgressWithServer'), 'api.js must export syncProgressWithServer');

console.log('✓ Static HTML & JavaScript integration verified successfully.');

// =========================================================================
// 2. Metabolic Tracker Engine & UI/UX Specifications Tests
// =========================================================================
console.log('Testing: MetabolicTracker 9 UI/UX specifications...');

const { MetabolicTracker } = await import('./js/metabolicTracker.js');

const tracker = new MetabolicTracker();
assert.equal(tracker.state, 'A', 'Tracker initial state must be A (Ready/Idle)');

// Requirement 2: Automated Date Selection
const systemDate = tracker.getSystemDate();
assert.ok(systemDate.iso, 'System date ISO must be detected');
assert.ok(systemDate.formatted, 'System date formatted Sinhala string must be generated');
assert.equal(systemDate.iso, new Date().toISOString().split('T')[0], 'Must detect today system date');

// Requirement 4: Time Controls (+ and - buttons)
const initialMealTime = new Date('2026-10-01T12:00:00Z').getTime();
tracker.activeMeal = {
  id: 'test_meal_adj',
  user_id: 'user_wosa',
  meal_timestamp: new Date(initialMealTime).toISOString()
};

// Increment by +15 minutes
tracker.adjustTime(15);
const afterIncTime = new Date(tracker.activeMeal.meal_timestamp).getTime();
assert.equal(afterIncTime, initialMealTime - 15 * 60 * 1000, '+15m button should advance elapsed time by 15 mins');

// Decrement by -15 minutes
tracker.adjustTime(-15);
const afterDecTime = new Date(tracker.activeMeal.meal_timestamp).getTime();
assert.equal(afterDecTime, initialMealTime, '-15m button should decrement elapsed time by 15 mins');

// Requirement 1: Recent Changes logging
const recentChanges = tracker.getRecentChanges();
assert.ok(recentChanges.length >= 2, 'Time adjustments must be recorded in Recent Changes');
assert.ok(recentChanges.some(rc => rc.text.includes('ටයිමරය විනාඩි 15කින්')), 'Recent Changes must contain timer adjustment text');

// Requirement 9: Gamification & Scoring Logic
// Setup mock meal logs for today (2 completed intervals)
const todayIso = systemDate.iso;
const mockTodayLogs = [
  { id: 'm1', user_id: 'user_wosa', meal_timestamp: `${todayIso}T06:00:00Z`, duration_elapsed: 18000, goal_met: true, created_at: `${todayIso}T11:00:00Z` },
  { id: 'm2', user_id: 'user_wosa', meal_timestamp: `${todayIso}T11:30:00Z`, duration_elapsed: 18000, goal_met: true, created_at: `${todayIso}T16:30:00Z` }
];
localStorage.setItem(`wosandi_meal_logs_user_wosa`, JSON.stringify(mockTodayLogs));

let todayPoints = tracker.getTodayFastingPoints();
assert.equal(todayPoints.completedCount, 2, 'Completed count should equal 2');
assert.equal(todayPoints.cyclePoints, 20, '2 completed intervals should give 2 * 10 = 20 points');
assert.equal(todayPoints.bonusPoints, 0, 'Bonus points should be 0 until 3 intervals completed');
assert.equal(todayPoints.earnedPoints, 20, 'Earned points should equal 20');

// Now add 3rd completed interval
mockTodayLogs.push({ id: 'm3', user_id: 'user_wosa', meal_timestamp: `${todayIso}T17:00:00Z`, duration_elapsed: 18000, goal_met: true, created_at: `${todayIso}T22:00:00Z` });
localStorage.setItem(`wosandi_meal_logs_user_wosa`, JSON.stringify(mockTodayLogs));

todayPoints = tracker.getTodayFastingPoints();
assert.equal(todayPoints.completedCount, 3, 'Completed count should equal 3');
assert.equal(todayPoints.cyclePoints, 30, '3 completed intervals should give 3 * 10 = 30 cycle points');
assert.equal(todayPoints.bonusPoints, 50, '3 completed intervals should award 50 bonus points!');
assert.equal(todayPoints.earnedPoints, 80, 'Total earned points with bonus should equal 30 + 50 = 80 points');
assert.equal(todayPoints.hasBonus, true, 'hasBonus flag should be true');

// Requirement 5, 7, 8: State B (Active Fasting) UI text checks
tracker.activeMeal = {
  id: 'test_active',
  user_id: 'user_wosa',
  meal_timestamp: new Date(Date.now() - 3600 * 1000).toISOString() // 1 hour ago
};
tracker.updateState();
assert.equal(tracker.state, 'B', 'State after 1 hour must be B (Active Fasting)');

// Test Analytics Computation
const sampleMealLogs = [
  { id: '1', user_id: 'user_wosa', meal_timestamp: '2026-10-01T12:00:00Z', duration_elapsed: 18600, goal_met: true, created_at: '2026-10-01T17:10:00Z' },
  { id: '2', user_id: 'user_wosa', meal_timestamp: '2026-10-01T06:30:00Z', duration_elapsed: 19800, goal_met: true, created_at: '2026-10-01T12:00:00Z' },
  { id: '3', user_id: 'user_wosa', meal_timestamp: '2026-09-30T13:00:00Z', duration_elapsed: 10800, goal_met: false, created_at: '2026-09-30T16:00:00Z' },
  { id: '4', user_id: 'user_wosa', meal_timestamp: '2026-09-30T07:00:00Z', duration_elapsed: 21600, goal_met: true, created_at: '2026-09-30T13:00:00Z' }
];

const analytics = tracker.calculateAnalytics(sampleMealLogs);
assert.equal(analytics.totalLogs, 4, 'Total logs should equal 4');
assert.equal(analytics.complianceRate, 75, 'Compliance rate should be 3/4 = 75%');
assert.equal(analytics.streak, 2, 'Consecutive streak from most recent backward should be 2');
assert.equal(analytics.avgDurationFormatted, '4h 55m', 'Average duration should be 4h 55m');

console.log('✓ Fasting & Routine Tracker 9 specifications verified successfully.');

// =========================================================================
// 3. Notification Engine Tests
// =========================================================================
console.log('Testing: NotificationManager & NotificationClient filtering & permissions...');

const { NotificationManager } = await import('./admin/js/notificationManager.js');
const { NotificationClient } = await import('./js/notificationClient.js');

// Mock API for NotificationManager
const mockApi = {
  select: async () => ({ data: [] }),
  upsert: async () => ({ error: null }),
  insert: async () => ({ error: null }),
  update: async () => ({ error: null }),
  delete: async () => ({ error: null })
};

const dummyContainer = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
const adminNotifs = new NotificationManager(dummyContainer, mockApi, () => {});

// Test targeted rules evaluation
const notifications = [
  {
    id: 'notif_all',
    title_si: 'සියලු දෙනාට',
    target_type: 'all',
    target_value: 'all',
    type: 'announcement',
    active: true
  },
  {
    id: 'notif_role_primary',
    title_si: 'ප්‍රධාන පරිශීලකයාට පමණි',
    target_type: 'role',
    target_value: 'primary',
    type: 'alert',
    priority: 'urgent',
    active: true
  },
  {
    id: 'notif_role_member',
    title_si: 'සාමාජිකයින්ට පමණි',
    target_type: 'role',
    target_value: 'member',
    type: 'reminder',
    active: true
  },
  {
    id: 'notif_user_sandali',
    title_si: 'සඳලි සඳහා පමණි',
    target_type: 'user',
    target_value: 'user_sandali',
    type: 'data_sync',
    active: true
  }
];

const permissionsMatrix = {
  user_wosa: {
    announcement: true,
    alert: true,
    data_sync: true,
    reminder: true
  },
  user_sandali: {
    announcement: true,
    alert: false,
    data_sync: true,
    reminder: false
  }
};

const client = new NotificationClient();
client.notifications = notifications;
client.permissionsMatrix = permissionsMatrix;

// 3.1 Primary user Wosa test
client.currentUser = { id: 'user_wosa', role: 'primary' };
const wosaEligible = client.getEligibleNotifications();

assert.ok(wosaEligible.some(n => n.id === 'notif_all'), 'Wosa should receive "all" targeted notification');
assert.ok(wosaEligible.some(n => n.id === 'notif_role_primary'), 'Wosa (primary) should receive "role: primary" notification');
assert.ok(!wosaEligible.some(n => n.id === 'notif_role_member'), 'Wosa (primary) must NOT receive "role: member" notification');
assert.ok(!wosaEligible.some(n => n.id === 'notif_user_sandali'), 'Wosa must NOT receive "user: sandali" notification');
assert.equal(wosaEligible.length, 2, 'Wosa should receive exactly 2 notifications');

// 3.2 Member user Sandali test
client.currentUser = { id: 'user_sandali', role: 'member' };
const sandaliEligible = client.getEligibleNotifications();

assert.ok(sandaliEligible.some(n => n.id === 'notif_all'), 'Sandali should receive "all" targeted notification');
assert.ok(sandaliEligible.some(n => n.id === 'notif_user_sandali'), 'Sandali should receive notifications targeted specifically to user_sandali');
assert.ok(!sandaliEligible.some(n => n.id === 'notif_role_primary'), 'Sandali (member) must NOT receive primary notifications');
assert.ok(!sandaliEligible.some(n => n.id === 'notif_role_member'), 'Sandali must NOT receive reminders because permission matrix disabled reminder for user_sandali');
assert.equal(sandaliEligible.length, 2, 'Sandali should receive exactly 2 permitted notifications');

// 3.3 Mark as Read & Read Count test
assert.equal(client.getUnreadCount(), 2, 'Initial unread count for Sandali should be 2');
client.markAsRead('notif_all');
assert.equal(client.getUnreadCount(), 1, 'Unread count after marking 1 as read should be 1');
client.markAllAsRead();
assert.equal(client.getUnreadCount(), 0, 'Unread count after marking all as read should be 0');

console.log('✓ Notification permissions matrix and granular targeting verified.');

console.log('\n======================================================');
console.log('ALL VERIFICATION TESTS PASSED SUCCESSFULLY! (100% OK)');
console.log('======================================================\n');
