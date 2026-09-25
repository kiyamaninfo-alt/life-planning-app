/**
 * Admin Panel & Staging Engine Automated Verification Suite
 * Tests:
 * 1. Admin Authentication & Session Isolation
 * 2. Supabase Table Prefix Enforcement (Security Guard against tampering existing tables)
 * 3. Dual-Compatible AdminApi & Local Storage Fallback
 * 4. Task Management CRUD & Point Weight Structure
 * 5. Timer Presets & Granular Duration Hours/Minutes/Seconds
 * 6. Questionnaire Flow Builder DAG Nodes/Edges
 * 7. Dynamic UI Component Configurator (schema_definition & widgets)
 * 8. Staging & Draft/Publish State Machine
 * 9. Student-Side DynamicRenderer Widget Generation
 */

import { AdminAuth } from './admin/js/adminAuth.js';
import { AdminApi } from './admin/js/adminApi.js';
import { DynamicRenderer } from './js/dynamicRenderer.js';

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

// Polyfill minimal browser globals for testing in Node.js
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}
if (typeof sessionStorage === 'undefined') {
  const sStore = {};
  global.sessionStorage = {
    getItem: (k) => sStore[k] || null,
    setItem: (k, v) => { sStore[k] = String(v); },
    removeItem: (k) => { delete sStore[k]; },
    clear: () => { Object.keys(sStore).forEach(k => delete sStore[k]); }
  };
}

async function runTests() {
  console.log('=== TEST 1: Admin Authentication & Session Isolation ===');
  const auth = new AdminAuth();
  assert(auth.verifyPin('1234') === true, 'Default admin PIN 1234 verifies successfully');
  assert(auth.verifyPin('9999') === false, 'Invalid PIN is rejected');
  assert(auth.isAuthenticated() === false, 'Initially not authenticated');
  assert(auth.login('1234') === true, 'Login with 1234 succeeds');
  assert(auth.isAuthenticated() === true, 'Session authenticated after login');
  auth.logout();
  assert(auth.isAuthenticated() === false, 'Session cleared after logout');

  console.log('\n=== TEST 2: Security Guard: Strict wosandi_ Prefix Enforcement ===');
  const api = new AdminApi();
  let blockedExisting = false;
  try {
    await api.select('daily_logs');
  } catch (err) {
    blockedExisting = err.message.includes('Security Violation');
  }
  assert(blockedExisting, 'Access to production table "daily_logs" is strictly blocked');

  let blockedRoutine = false;
  try {
    await api.select('routine_tasks');
  } catch (err) {
    blockedRoutine = err.message.includes('Security Violation');
  }
  assert(blockedRoutine, 'Access to production table "routine_tasks" is strictly blocked');

  console.log('\n=== TEST 3: AdminApi Local Storage Fallback & Seed Data ===');
  const tasksResult = await api.select('wosandi_tasks');
  assert(Array.isArray(tasksResult) && tasksResult.length > 0, 'wosandi_tasks returns seeded array on fallback');
  assert(Array.isArray(tasksResult.data), 'Result supports destructuring { data }');
  assert(tasksResult.error === null, 'Result error is null');

  const timersResult = await api.select('wosandi_timers');
  assert(timersResult.length > 0, 'wosandi_timers returns seeded timers');

  const flowsResult = await api.select('wosandi_flows');
  assert(flowsResult.length > 0, 'wosandi_flows returns seeded flows');

  const uiResult = await api.select('wosandi_ui_schema');
  assert(uiResult.length > 0, 'wosandi_ui_schema returns seeded widgets');

  console.log('\n=== TEST 4: Task Manager CRUD & Schema Validation ===');
  const newTask = {
    title_si: 'නව ගණිත ගැටළු 5ක්',
    title_en: 'Solve 5 Math Problems',
    category: 'academic',
    tier: 'core_academic',
    weight_points: 30,
    icon: '📐',
    has_timer: true,
    timer_seconds: 1800,
    sort_order: 10,
    status: 'draft',
    schema_definition: { input_type: 'checkbox', linked_state_key: 'math_5_probs' }
  };

  const insertTaskRes = await api.insert('wosandi_tasks', newTask);
  assert(insertTaskRes && insertTaskRes.id, 'Task inserted successfully with UUID/ID');
  assert(insertTaskRes.weight_points === 30, 'Weight points saved correctly as 30');

  const updateTaskRes = await api.update('wosandi_tasks', insertTaskRes.id, { weight_points: 35 });
  assert(updateTaskRes.weight_points === 35, 'Task debounced point update verified');

  await api.publish('wosandi_tasks', insertTaskRes.id);
  const publishedTasks = await api.getPublished('wosandi_tasks');
  assert(publishedTasks.some(t => t.id === insertTaskRes.id), 'Task status toggled to published');

  console.log('\n=== TEST 5: Timer Presets & Granular Duration Support ===');
  const newTimer = {
    label_si: 'විද්‍යාව ප්‍රශ්න පත්‍රය',
    label_en: 'Science Unit Paper Timer',
    duration_hours: 1,
    duration_minutes: 15,
    duration_seconds: 0,
    icon: '🔬',
    sort_order: 5,
    status: 'draft',
    trigger_config: {
      auto_start: false,
      pause_on_blur: true,
      chime: true,
      chime_on_complete: true,
      alert_intervals: [300, 60],
      repeat_count: 1
    }
  };

  const insertTimerRes = await api.insert('wosandi_timers', newTimer);
  assert(insertTimerRes.duration_hours === 1, 'Duration hours saved as 1');
  assert(insertTimerRes.duration_minutes === 15, 'Duration minutes saved as 15');
  assert(insertTimerRes.trigger_config.alert_intervals.length === 2, 'Trigger config alert intervals saved');

  console.log('\n=== TEST 6: Flow Builder DAG Structure ===');
  const flow = flowsResult[0];
  assert(flow.flow_data && Array.isArray(flow.flow_data.nodes), 'Flow contains DAG nodes array');
  assert(Array.isArray(flow.flow_data.edges), 'Flow contains DAG edges array');
  assert(flow.flow_data.nodes.length >= 2, 'Flow has multiple sequential/branching questions');

  console.log('\n=== TEST 7: Dynamic UI Component Schema & Renderer ===');
  const mockContainer = { innerHTML: '' };
  const renderer = new DynamicRenderer(mockContainer);
  assert(typeof renderer.renderWidget === 'function', 'DynamicRenderer.renderWidget is a valid function');

  const testSwitchWidget = {
    id: 'w_test_1',
    widget_type: 'switch',
    label_si: 'අමතර පන්ති සහභාගීත්වය',
    label_en: 'Tuition Attended',
    schema_definition: { linked_state_key: 'tuition_attended', default_value: true }
  };
  const renderedSwitch = renderer.renderWidget(testSwitchWidget);
  assert(renderedSwitch.includes('data-widget-id="w_test_1"'), 'Rendered switch includes unique data attribute');
  assert(renderedSwitch.includes('tuition_attended'), 'Rendered switch binds linked_state_key');

  const testCheckboxWidget = {
    id: 'w_test_2',
    widget_type: 'checkbox',
    label_si: 'පොත් මේසය පිළියෙල කිරීම',
    schema_definition: { linked_state_key: 'clean_desk', point_value: 15, default_checked: false }
  };
  const renderedCheckbox = renderer.renderWidget(testCheckboxWidget);
  assert(renderedCheckbox.includes('+15 pts'), 'Rendered checkbox includes point badge');

  console.log('\n========================================');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
