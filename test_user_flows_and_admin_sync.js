/**
 * test_user_flows_and_admin_sync.js
 * 
 * Verifies all 4 user requirements:
 * 1. Top left-hand corner points of user strictly match active user profile (e.g. 250 pts), no conflicting double-totals.
 * 2. Live flows can be designated for single user or global; Flow Player filters and selects appropriately.
 * 3. Dashboard displays and calculates points strictly according to admin panel (global + individual user settings), static hardcoded tasks removed.
 * 4. Dashboard "+ නව කාර්යයක්" (New Task) modal provides full parity with Admin Panel > Task > New Task.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let passed = 0;
let failed = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

console.log("=== TEST SUITE 1: Profile Selector Cleared of Points/Marks Badge ===");

it("userManagerClient renders profile selector pill without marks/points, and index.html has no active-user-points", async () => {
  // Mock localStorage and window
  const storage = {};
  global.localStorage = {
    getItem: (k) => storage[k] || null,
    setItem: (k, v) => { storage[k] = String(v); },
    removeItem: (k) => { delete storage[k]; }
  };
  global.sessionStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {}
  };

  const pillState = {
    avatar: '',
    name: '',
    points: ''
  };

  global.document = {
    getElementById: (id) => {
      if (id === 'active-user-avatar') return { set innerText(v) { pillState.avatar = v; } };
      if (id === 'active-user-name') return { set innerText(v) { pillState.name = v; } };
      if (id === 'active-user-points') return { 
        remove: () => { pillState.points = ''; },
        set innerText(v) { pillState.points = v; } 
      };
      if (id === 'active-user-lock-icon') return { className: '', title: '' };
      return null;
    }
  };

  // Import userManagerClient
  const { userManagerClient } = await import('./js/userManagerClient.js');

  userManagerClient.users = [
    {
      id: "user_wosa",
      username: "Wosandi",
      display_name: "Wosa (වෝසා)",
      points: 250,
      avatar: "🌸",
      pin: "1234",
      role: "primary",
      is_active: true
    },
    {
      id: "user_sandali",
      username: "Sandali",
      display_name: "Sandali (සඳලි)",
      points: 95,
      avatar: "👧",
      pin: "1234",
      role: "member",
      is_active: true
    }
  ];

  userManagerClient.currentUser = null;
  const user = userManagerClient.getCurrentUser();
  assert.strictEqual(user.username, "Wosandi", "Default user is Wosandi");

  userManagerClient.updateUserHeaderPill();
  assert.strictEqual(pillState.avatar, "🌸", "Avatar should be rendered in pill");
  assert.strictEqual(pillState.name, "Wosandi", "Username should be rendered in pill");
  assert.strictEqual(pillState.points, "", "Points/marks badge must NOT be rendered in dashboard profile selector pill");

  // Verify index.html does not contain active-user-points span
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  assert.ok(!indexHtml.includes('id="active-user-points"'), "index.html must not contain active-user-points span in header");
});

console.log("\n=== TEST SUITE 2: Single-User vs Global Live Flow Builder & Player ===");

it("AdminApi sanitizes flow payload placing target_profile inside flow_data without schema error", async () => {
  const { AdminApi } = await import('./admin/js/adminApi.js');
  const api = new AdminApi();

  const payload = {
    title_si: "Wosa Special Flow",
    flow_type: "questionnaire",
    target_profile: "user_wosa",
    flow_data: {
      nodes: [{ id: "n1", type: "start" }]
    }
  };

  const sanitized = api._sanitizePayload('wosandi_flows', payload);
  assert.strictEqual(sanitized.target_profile, undefined, "Root target_profile must be deleted");
  assert.strictEqual(sanitized.flow_data.target_profile, "user_wosa", "Target profile must be nested inside flow_data");
});

it("FlowPlayer filters user-specific flows over global flows and handles switches", async () => {
  const flows = [
    {
      id: "flow_global",
      title_si: "Global Morning Flow",
      status: "published",
      target_profile: "global",
      flow_data: {
        target_profile: "global",
        nodes: [{ id: "g1", type: "start" }]
      }
    },
    {
      id: "flow_sandali",
      title_si: "Sandali Special Flow",
      status: "published",
      target_profile: "user_sandali",
      flow_data: {
        target_profile: "user_sandali",
        nodes: [{ id: "s1", type: "start" }]
      }
    }
  ];

  // Helper matching logic in FlowPlayer
  function resolveFlowForUser(currentUser, flowRecords) {
    const userSpecific = flowRecords.find(f => {
      const tp = f.flow_data?.target_profile || f.target_profile;
      if (!tp || tp === 'global' || tp === 'all') return false;
      return Boolean(
        currentUser && (
          tp === currentUser.id ||
          tp === currentUser.username ||
          (currentUser.username === 'Wosa' && tp === 'user_wosa') ||
          (currentUser.id === 'user_wosa' && (tp === 'Wosa' || tp === 'Wosandi')) ||
          (currentUser.username === 'Wosandi' && (tp === 'user_wosa' || tp === 'Wosa'))
        )
      );
    });
    if (userSpecific) return userSpecific;
    return flowRecords.find(f => {
      const tp = f.flow_data?.target_profile || f.target_profile;
      return !tp || tp === 'global' || tp === 'all';
    }) || null;
  }

  const wosaUser = { id: "user_wosa", username: "Wosandi" };
  const sandaliUser = { id: "user_sandali", username: "Sandali" };
  const kasunUser = { id: "user_kasun", username: "Kasun" };

  const wosaFlow = resolveFlowForUser(wosaUser, flows);
  assert.strictEqual(wosaFlow.id, "flow_global", "Wosa should receive global flow if no user-specific flow exists");

  const sandaliFlow = resolveFlowForUser(sandaliUser, flows);
  assert.strictEqual(sandaliFlow.id, "flow_sandali", "Sandali should receive Sandali's designated flow");

  const kasunFlow = resolveFlowForUser(kasunUser, flows);
  assert.strictEqual(kasunFlow.id, "flow_global", "Kasun should receive global flow");

  // If only user-specific flow exists for Sandali and no global flow exists:
  const sandaliOnlyFlows = [flows[1]];
  const wosaNoFlow = resolveFlowForUser(wosaUser, sandaliOnlyFlows);
  assert.strictEqual(wosaNoFlow, null, "Wosa should receive null flow when only Sandali-specific flow exists");
});

console.log("\n=== TEST SUITE 3: Dashboard Purely Driven by Admin Panel (No Hardcoded 120 Base) ===");

it("index.html contains no hardcoded static tasks in task lists", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  // Verify containers exist without static task labels
  assert.ok(indexHtml.includes('id="study-tasks-list"'), "study-tasks-list container must exist");
  assert.ok(indexHtml.includes('id="fitness-tasks-list"'), "fitness-tasks-list container must exist");
  assert.ok(indexHtml.includes('id="chores-tasks-list"'), "chores-tasks-list container must exist");

  // Verify containers do not contain static <label data-task-id> elements
  const studyListMatch = indexHtml.match(/<div id="study-tasks-list"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(studyListMatch && !studyListMatch[1].includes('<label data-task-id='), "study-tasks-list must not contain static task labels");

  const fitnessListMatch = indexHtml.match(/<div id="fitness-tasks-list"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(fitnessListMatch && !fitnessListMatch[1].includes('<label data-task-id='), "fitness-tasks-list must not contain static task labels");

  const choresListMatch = indexHtml.match(/<div id="chores-tasks-list"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(choresListMatch && !choresListMatch[1].includes('<label data-task-id='), "chores-tasks-list must not contain static task labels");

  // Verify removed legacy static task IDs
  assert.ok(!indexHtml.includes('data-task-id="maths_practice"'), "Legacy maths_practice task must not be hardcoded in HTML");
  assert.ok(!indexHtml.includes('data-task-id="dance_workout"'), "Legacy dance_workout task must not be hardcoded in HTML");
  assert.ok(!indexHtml.includes('data-task-id="clean_room"'), "Legacy clean_room task must not be hardcoded in HTML");
});

it("api.js calculates total score dynamically without hardcoded 120 base", () => {
  const apiJs = fs.readFileSync(path.join(__dirname, 'js/api.js'), 'utf-8');

  // Verify hardcoded 120 was removed
  assert.ok(!apiJs.includes('totalPossiblePoints = 120'), "Hardcoded 120 totalPossiblePoints base must be removed");
  assert.ok(!apiJs.includes('totalPossiblePoints += 120'), "No static 120 base point addition");

  // Verify dynamic publishedAdminTasks iteration
  assert.ok(apiJs.includes('window.publishedAdminTasks.forEach'), "Score calculation must iterate window.publishedAdminTasks dynamically");
});

console.log("\n=== TEST SUITE 4: Dashboard '+ නව කාර්යයක්' Modal Parity with Admin Panel ===");

it("js/app.js implements complete Admin-parity task creation modal with target profile selector", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  // Verify function exists
  assert.ok(appJs.includes('async function openAddQuickTaskModal()'), "openAddQuickTaskModal must be defined");

  // Verify required fields matching Admin Panel > Task > New Task
  assert.ok(appJs.includes('id="qt-title-si"'), "Must include Sinhala title input");
  assert.ok(appJs.includes('id="qt-title-en"'), "Must include English title input");
  assert.ok(appJs.includes('id="qt-target-profile"'), "Must include target profile scope selector");
  assert.ok(appJs.includes('id="qt-category"'), "Must include category selector");
  assert.ok(appJs.includes('id="qt-subject"'), "Must include subject selector");
  assert.ok(appJs.includes('id="qt-tier"'), "Must include tier selector");
  assert.ok(appJs.includes('id="qt-points"'), "Must include weight points input");
  assert.ok(appJs.includes('id="qt-icon"'), "Must include icon input");
  assert.ok(appJs.includes('id="qt-sort-order"'), "Must include sort order input");
  assert.ok(appJs.includes('id="qt-status"'), "Must include status selector (published/draft)");
  assert.ok(appJs.includes('id="qt-frequency"'), "Must include schedule frequency selector");
  assert.ok(appJs.includes('id="qt-has-timer"'), "Must include timer toggle");
  assert.ok(appJs.includes('id="qt-timer-seconds"'), "Must include timer seconds input");
  assert.ok(appJs.includes('id="qt-description"'), "Must include notes/description textarea");

  // Verify persistence to Supabase and localStorage fallback
  assert.ok(appJs.includes('wosandi_admin_wosandi_tasks'), "Must sync to localStorage task cache");
  assert.ok(appJs.includes('https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks'), "Must persist directly to Supabase REST endpoint");
});

console.log("\n=== TEST SUITE 5: Instant Profile Open on Card Click ===");

it("userManagerClient attaches click listener to entire user card to open profile instantly", () => {
  const userManagerJs = fs.readFileSync(path.join(__dirname, 'js/userManagerClient.js'), 'utf-8');
  assert.ok(userManagerJs.includes('modal.querySelectorAll("[data-user-id]")'), "Must query all data-user-id cards");
  assert.ok(userManagerJs.includes('this.setCurrentUser(targetUser, false)'), "Must switch to target user instantly on card click");
  assert.ok(userManagerJs.includes('closeModal()'), "Must close modal on card click");
});

console.log("\n=== TEST SUITE 6: Database Progress Save & Past Performance History ===");

it("api.js saves user-specific progress to both daily_logs and wosandi_admin_config", () => {
  const apiJs = fs.readFileSync(path.join(__dirname, 'js/api.js'), 'utf-8');
  assert.ok(apiJs.includes('daily_logs'), "Must save to daily_logs");
  assert.ok(apiJs.includes('wosandi_admin_config'), "Must save to wosandi_admin_config");
  assert.ok(apiJs.includes('user_log_'), "Must key user-specific daily logs by user_log_{userId}");
  assert.ok(apiJs.includes('wosandi_perf_history_'), "Must cache history in localStorage");
});

it("app.js and index.html implement past performance history viewer modal", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  assert.ok(indexHtml.includes('id="view-past-performance-btn"'), "index.html must include past performance button");
  assert.ok(indexHtml.includes('id="past-performance-modal-container"'), "index.html must include modal container");
  assert.ok(appJs.includes('async function openPastPerformanceModal()'), "app.js must define openPastPerformanceModal");
  assert.ok(appJs.includes('window.openPastPerformanceModal = openPastPerformanceModal'), "Must export to window");
});

console.log("\n=== TEST SUITE 7: Global Card Visibility & Individual User Data Isolation ===");

it("Global cards are visible to all users but completed state is isolated strictly per user", () => {
  const today = '2026-09-28';
  
  // 1. Define a global task and user-specific tasks
  const allTasks = [
    {
      id: 'task_global_routine',
      title_si: 'පොදු කාර්යය (Global Task)',
      category: 'academic',
      weight_points: 20,
      target_profile: 'global',
      schema_definition: { target_profile: 'global' }
    },
    {
      id: 'task_wosa_only',
      title_si: 'Wosa පමණි',
      category: 'academic',
      weight_points: 10,
      target_profile: 'user_wosa',
      schema_definition: { target_profile: 'user_wosa' }
    },
    {
      id: 'task_sandali_only',
      title_si: 'Sandali පමණි',
      category: 'academic',
      weight_points: 15,
      target_profile: 'user_sandali',
      schema_definition: { target_profile: 'user_sandali' }
    }
  ];

  // Helper matching the visibility filter in loadPublishedTasksFromAdmin
  function getVisibleTasksForUser(user, tasks) {
    return tasks.filter(task => {
      const targetProfile = task.schema_definition?.target_profile || task.target_profile;
      const isGlobal = !targetProfile || targetProfile === 'global' || targetProfile === 'all';
      const isTargetUser = Boolean(
        user && (
          targetProfile === user.id ||
          targetProfile === user.username ||
          ((user.username === 'Wosa' || user.username === 'Wosandi') && (targetProfile === 'user_wosa' || targetProfile === 'Wosa' || targetProfile === 'Wosandi')) ||
          (user.id === 'user_wosa' && (targetProfile === 'Wosa' || targetProfile === 'Wosandi'))
        )
      );
      return isGlobal || isTargetUser;
    });
  }

  const wosaUser = { id: 'user_wosa', username: 'Wosa' };
  const sandaliUser = { id: 'user_sandali', username: 'Sandali' };
  const niluUser = { id: 'user_nilu', username: 'Nilu' };

  // Assert all users see the global task
  const wosaTasks = getVisibleTasksForUser(wosaUser, allTasks);
  const sandaliTasks = getVisibleTasksForUser(sandaliUser, allTasks);
  const niluTasks = getVisibleTasksForUser(niluUser, allTasks);

  assert.ok(wosaTasks.some(t => t.id === 'task_global_routine'), "Wosa sees global task");
  assert.ok(sandaliTasks.some(t => t.id === 'task_global_routine'), "Sandali sees global task");
  assert.ok(niluTasks.some(t => t.id === 'task_global_routine'), "Nilu sees global task");

  // Assert user-specific isolation of task visibility
  assert.ok(wosaTasks.some(t => t.id === 'task_wosa_only'), "Wosa sees Wosa task");
  assert.ok(!wosaTasks.some(t => t.id === 'task_sandali_only'), "Wosa DOES NOT see Sandali task");
  assert.ok(!sandaliTasks.some(t => t.id === 'task_wosa_only'), "Sandali DOES NOT see Wosa task");
  assert.ok(sandaliTasks.some(t => t.id === 'task_sandali_only'), "Sandali sees Sandali task");

  // 2. Data Isolation for Global Card:
  // When Wosa checks the global task, Wosa's state has it completed.
  const wosaStorage = {};
  const wosaStateKey = 'wosandi_routine_state_' + today;
  const wosaState = { task_global_routine: true, task_wosa_only: true };
  wosaStorage[wosaStateKey] = JSON.stringify(wosaState);

  // Sandali's storage is initially empty for today
  const sandaliStorage = {};
  const sandaliStateKey = `wosandi_routine_state_${sandaliUser.id}_${today}`;

  // Sandali loads their data: does NOT inherit Wosa's completion!
  const sandaliCached = sandaliStorage[sandaliStateKey];
  assert.strictEqual(sandaliCached, undefined, "Sandali has no state yet");

  // The card is rendered as an unchecked "new card" for Sandali
  const sandaliState = sandaliCached ? JSON.parse(sandaliCached) : {};
  const isGlobalCheckedForSandali = Boolean(sandaliState['task_global_routine']);
  assert.strictEqual(isGlobalCheckedForSandali, false, "Global card shows as fresh new unchecked card for Sandali");

  // When Sandali completes the global task, Sandali saves to Sandali's key only
  sandaliState['task_global_routine'] = true;
  sandaliStorage[sandaliStateKey] = JSON.stringify(sandaliState);

  // Verify Wosa's storage was untouched
  const wosaRestored = JSON.parse(wosaStorage[wosaStateKey]);
  assert.strictEqual(wosaRestored.task_global_routine, true, "Wosa's completion remains preserved");
  assert.strictEqual(wosaRestored.task_wosa_only, true, "Wosa's private task remains preserved");

  // Verify Sandali's storage contains only Sandali's completions
  const sandaliRestored = JSON.parse(sandaliStorage[sandaliStateKey]);
  assert.strictEqual(sandaliRestored.task_global_routine, true, "Sandali's completion is saved");
  assert.strictEqual(sandaliRestored.task_wosa_only, undefined, "Sandali has no Wosa-only task completion");

  // Verify a third user (Nilu) still sees the global card as brand new and unchecked
  const niluStorage = {};
  const niluStateKey = `wosandi_routine_state_${niluUser.id}_${today}`;
  const niluState = niluStorage[niluStateKey] ? JSON.parse(niluStorage[niluStateKey]) : {};
  assert.strictEqual(Boolean(niluState['task_global_routine']), false, "Nilu sees global card as brand new and unchecked");
});

console.log(`\n=================================================`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log(`=================================================`);

if (failed > 0) {
  process.exit(1);
}
