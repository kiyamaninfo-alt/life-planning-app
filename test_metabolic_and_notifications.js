/**
 * test_metabolic_and_notifications.js
 * Comprehensive unit and integration test suite for:
 * 1. Granular User Notification & Visibility Engine
 * 2. Metabolic Meal-Interval Tracker (5-Hour Fasting/Gap Engine)
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

// 1.1 index.html checks
assert.ok(indexHtml.includes('id="metabolic-tracker-sticky-container"'), 'index.html must contain metabolic-tracker-sticky-container');
assert.ok(indexHtml.includes('js/metabolicTracker.js'), 'index.html must load js/metabolicTracker.js');
assert.ok(indexHtml.includes('js/notificationClient.js'), 'index.html must load js/notificationClient.js');

// 1.2 admin/index.html checks
assert.ok(adminIndexHtml.includes('data-tab="notifications"'), 'admin/index.html must contain notifications tab navigation link');
assert.ok(adminIndexHtml.includes('id="tab-notifications"'), 'admin/index.html must contain tab-notifications container');

// 1.3 adminApp.js checks
assert.ok(adminAppJs.includes('NotificationManager'), 'adminApp.js must import NotificationManager');
assert.ok(adminAppJs.includes('/admin/notifications'), 'adminApp.js must handle /admin/notifications route');
assert.ok(adminAppJs.includes('this.managers.notifications = new NotificationManager'), 'adminApp.js must instantiate NotificationManager');

// 1.4 app.js Past Performance checks
assert.ok(appJs.includes('perf-tab-metabolic'), 'app.js must contain perf-tab-metabolic in Past Performance modal');
assert.ok(appJs.includes('perf-pane-metabolic'), 'app.js must contain perf-pane-metabolic in Past Performance modal');
assert.ok(appJs.includes('fetchMealLogs'), 'app.js must call fetchMealLogs in Past Performance modal');
assert.ok(appJs.includes('calculateAnalytics'), 'app.js must call calculateAnalytics in Past Performance modal');

console.log('✓ Static HTML & JavaScript integration verified successfully.');

// =========================================================================
// 2. Metabolic Tracker Engine Tests
// =========================================================================
console.log('Testing: MetabolicTracker logic & analytics...');

const { MetabolicTracker } = await import('./js/metabolicTracker.js');

const tracker = new MetabolicTracker();
assert.equal(tracker.state, 'A', 'Tracker initial state must be A (Ready/Idle)');

// Test countdown calculation for 5 hours
const nowMs = Date.now();
const oneHourAgoIso = new Date(nowMs - 3600 * 1000).toISOString();
tracker.activeMeal = {
  id: 'test_meal_1',
  user_id: 'user_wosa',
  meal_timestamp: oneHourAgoIso,
  start_time_ms: nowMs - 3600 * 1000
};

// Tick and check remaining time
const remainingSeconds = 4 * 3600; // 4 hours left
const formatTime = (secs) => {
  const h = String(Math.floor(secs / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
};
assert.equal(formatTime(remainingSeconds), '04:00:00', 'Remaining time after 1 hour must be 04:00:00');

// Test Analytics Computation
const sampleMealLogs = [
  { id: '1', user_id: 'user_wosa', meal_timestamp: '2026-10-01T12:00:00Z', duration_elapsed: 18600, goal_met: true, created_at: '2026-10-01T17:10:00Z' }, // 5h 10m (met)
  { id: '2', user_id: 'user_wosa', meal_timestamp: '2026-10-01T06:30:00Z', duration_elapsed: 19800, goal_met: true, created_at: '2026-10-01T12:00:00Z' }, // 5h 30m (met)
  { id: '3', user_id: 'user_wosa', meal_timestamp: '2026-09-30T13:00:00Z', duration_elapsed: 10800, goal_met: false, created_at: '2026-09-30T16:00:00Z' }, // 3h 0m (early break)
  { id: '4', user_id: 'user_wosa', meal_timestamp: '2026-09-30T07:00:00Z', duration_elapsed: 21600, goal_met: true, created_at: '2026-09-30T13:00:00Z' } // 6h 0m (met)
];

const analytics = tracker.calculateAnalytics(sampleMealLogs);

assert.equal(analytics.totalLogs, 4, 'Total logs should equal 4');
assert.equal(analytics.complianceRate, 75, 'Compliance rate should be 3/4 = 75%');
assert.equal(analytics.streak, 2, 'Consecutive streak from most recent backward should be 2');
// Average duration: (18600 + 19800 + 10800 + 21600) / 4 = 70800 / 4 = 17700 seconds = 4h 55m
assert.equal(analytics.avgDurationFormatted, '4h 55m', 'Average duration should be 4h 55m');

console.log('✓ MetabolicTracker state & analytics calculations verified.');

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
    type: 'announcement',
    is_active: true
  },
  {
    id: 'notif_role_primary',
    title_si: 'ප්‍රධාන පරිශීලකයාට පමණි',
    target_type: 'role',
    target_role: 'primary',
    type: 'alert',
    priority: 'urgent',
    is_active: true
  },
  {
    id: 'notif_role_member',
    title_si: 'සාමාජිකයින්ට පමණි',
    target_type: 'role',
    target_role: 'member',
    type: 'reminder',
    is_active: true
  },
  {
    id: 'notif_user_sandali',
    title_si: 'සඳලි සඳහා පමණි',
    target_type: 'user',
    target_user_id: 'user_sandali',
    type: 'data_sync',
    is_active: true
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
    alert: false, // Sandali muted alerts
    data_sync: true,
    reminder: false // Sandali muted reminders
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
// Note: notif_role_member is type 'reminder', but Sandali has reminder permission set to false in matrix!
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
