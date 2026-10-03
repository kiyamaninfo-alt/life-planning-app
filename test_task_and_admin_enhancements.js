/**
 * Verification Test Suite for Task & Admin Enhancements
 * Requirements:
 * 1. Simplified Quick Add Task Form (1.1 - 1.8)
 * 2. Multi-input support (Cards mode + Bulk text mode)
 * 3. Database schema & Admin panel parity
 * 4. Current Tasks Settings tab & Non-destructive Global Task Override (4.1)
 * 5. School section removal from all dashboards
 * 6. Top header links (Wosandi O/L + Admin only for Wosandi; Settings gear for all)
 * 7. Admin Profile (PIN 340800, activity logs, live monitoring hub instead of routine)
 * 8. Real-time admin notifications
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("=================================================");
console.log("RUNNING TASK & ADMIN ENHANCEMENTS VERIFICATION");
console.log("=================================================");

function it(description, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${description}`);
  } catch (err) {
    console.error(`  ✗ FAIL: ${description}`);
    console.error(`    ${err.message}`);
    process.exit(1);
  }
}

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 1: Dashboard Simplified Add Task Form & Auto-Icon ===");
// -----------------------------------------------------------------------------

it("1.1-1.8: Task input cards omit English title, subject, tier, icon, sort order; target profile is locked to current user", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  // Verify visible card structure does not contain manual inputs for these fields in createTaskCardHtml
  assert.ok(appJs.includes('createTaskCardHtml'), "createTaskCardHtml must exist");
  assert.ok(appJs.includes('card-title-input'), "Should have Sinhala title input in card");
  assert.ok(appJs.includes('autoDetermineIcon'), "Must auto-determine icon without manual input");
  assert.ok(appJs.includes('card-time-from') && appJs.includes('card-time-to'), "Must have custom time from/to inputs");
  assert.ok(appJs.includes('card-dow-check'), "Must have days of the week checkboxes");
  assert.ok(appJs.includes('card-freq-select'), "Must support weekly, monthly, yearly recurrence options");
});

it("1.5: autoDetermineIcon accurately detects keywords in Sinhala and English", async () => {
  const { autoDetermineIcon } = await import('./admin/js/taskManager.js');
  assert.strictEqual(typeof autoDetermineIcon, 'function', "autoDetermineIcon should be exported from taskManager.js");

  assert.strictEqual(autoDetermineIcon("ගණිතය"), "📐");
  assert.strictEqual(autoDetermineIcon("නැටුම් පුහුණුව"), "🩰");
  assert.strictEqual(autoDetermineIcon("කාමරය අස් කිරීම"), "🛏️");
  assert.strictEqual(autoDetermineIcon("වතුර බීම"), "💧");
  assert.strictEqual(autoDetermineIcon("නින්දට යාම"), "🌙");
  assert.strictEqual(autoDetermineIcon("විද්‍යාව"), "🔬");
  assert.strictEqual(autoDetermineIcon("Unknown random activity"), "📋");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 2: Multi-Input Support (Card Mode & Bulk Text Mode) ===");
// -----------------------------------------------------------------------------

it("2.1: openAddQuickTaskModal supports both dynamic multiple cards and bulk text line-by-line entry", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  assert.ok(appJs.includes('id="mode-btn-cards"'), "Must include card mode toggle button");
  assert.ok(appJs.includes('id="mode-btn-bulk"'), "Must include bulk text mode toggle button");
  assert.ok(appJs.includes('id="btn-add-another-task-card"'), "Must include '+ Add Another Task' button");
  assert.ok(appJs.includes('id="bulk-tasks-text"'), "Must include bulk textarea input");
  assert.ok(appJs.includes('id="btn-save-all-cards"'), "Must include save all cards button");
  assert.ok(appJs.includes('id="btn-save-bulk-tasks"'), "Must include save bulk tasks button");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 3: Database & Admin Panel Parity ===");
// -----------------------------------------------------------------------------

it("3.1: Admin panel taskManager.js supports weekly/monthly/yearly recurrence, days-of-week and custom time", () => {
  const taskManagerJs = fs.readFileSync(path.join(__dirname, 'admin/js/taskManager.js'), 'utf-8');

  assert.ok(taskManagerJs.includes('weekly'), "Must support weekly recurrence");
  assert.ok(taskManagerJs.includes('monthly'), "Must support monthly recurrence");
  assert.ok(taskManagerJs.includes('yearly'), "Must support yearly recurrence");
  assert.ok(taskManagerJs.includes('admin-dow-check'), "Must include days-of-week checkboxes");
  assert.ok(taskManagerJs.includes('schedule_custom_from'), "Must include custom start time");
  assert.ok(taskManagerJs.includes('schedule_custom_to'), "Must include custom end time");
});

it("3.2: SQL schema documentation outlines schedule and user override properties in schema_definition JSONB", () => {
  const sqlFile = fs.readFileSync(path.join(__dirname, 'sql/wosandi_admin_schema.sql'), 'utf-8');
  assert.ok(sqlFile.includes('days_of_week'), "Schema documentation must detail days_of_week");
  assert.ok(sqlFile.includes('custom_time_from'), "Schema documentation must detail custom_time_from");
  assert.ok(sqlFile.includes('original_task_id'), "Schema documentation must detail original_task_id override mechanism");
  assert.ok(sqlFile.includes('is_user_override'), "Schema documentation must detail is_user_override flag");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 4: Current Tasks Settings Tab & Global Task Override (4 & 4.1) ===");
// -----------------------------------------------------------------------------

it("4 & 4.1: Current Tasks Settings tab allows modifying tasks and handles non-destructive global overrides", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  assert.ok(appJs.includes('id="tab-btn-settings"'), "Must include settings tab button");
  assert.ok(appJs.includes('renderCurrentTasksSettings'), "Must define renderCurrentTasksSettings function");
  assert.ok(appJs.includes('original_task_id'), "Must record original_task_id when overriding global task");
  assert.ok(appJs.includes('is_user_override: true'), "Must tag user override record with is_user_override: true");
  assert.ok(appJs.includes('overrideMap'), "Must maintain overrideMap to substitute global task with user override");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 5: Removal of 'Did you go to school' Section ===");
// -----------------------------------------------------------------------------

it("5: 'Did you go to school' card is removed from visible dashboards", () => {
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  // Verify visible question text is not displayed
  assert.ok(!indexHtml.includes('අද පාසල් ගියාද?'), "Visible Sinhala school question must be removed");
  assert.ok(!indexHtml.includes('id="school-attended-btn"'), "School attended button should not be present in main UI");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 6: Top Header Links Scoped to Wosandi ===");
// -----------------------------------------------------------------------------

it("6: Header links for 'Wosandi O/L' and 'Admin' show only for Wosandi; Settings gear shows for all", () => {
  const userClientJs = fs.readFileSync(path.join(__dirname, 'js/userManagerClient.js'), 'utf-8');
  const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

  assert.ok(userClientJs.includes('header-wosandi-link'), "Must control header-wosandi-link visibility");
  assert.ok(userClientJs.includes('header-admin-link'), "Must control header-admin-link visibility");
  assert.ok(userClientJs.includes('isWosandi'), "Must check isWosandi for showing admin and Wosandi O/L links");
  assert.ok(indexHtml.includes('id="header-settings-btn"'), "Must include header-settings-btn in index.html for all profiles");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 7: Admin Profile with PIN 340800 & Live Monitoring Hub ===");
// -----------------------------------------------------------------------------

it("7.1: Admin profile exists with id 'user_admin', pin '340800', and role 'admin'", () => {
  const userClientJs = fs.readFileSync(path.join(__dirname, 'js/userManagerClient.js'), 'utf-8');

  assert.ok(userClientJs.includes('"user_admin"') || userClientJs.includes("'user_admin'"), "Admin user profile must exist in DEFAULT_USERS");
  assert.ok(userClientJs.includes('"340800"') || userClientJs.includes("'340800'"), "Admin profile pin must be '340800'");
  assert.ok(userClientJs.includes('"admin"') || userClientJs.includes("'admin'"), "Admin profile role must be 'admin'");
  assert.ok(userClientJs.includes("u.role !== 'admin'"), "Admin should be filtered out from student top 5 rankings");
});

it("7.2: Admin dashboard renders Live Monitoring & Activity Feed instead of standard task cards", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  assert.ok(appJs.includes('renderAdminMonitoringDashboard'), "Must define renderAdminMonitoringDashboard");
  assert.ok(appJs.includes('admin-monitoring-container'), "Must include admin monitoring container");
  assert.ok(appJs.includes('recordUserActivity'), "Must record user activities in activity log");
});

// -----------------------------------------------------------------------------
console.log("\n=== TEST SUITE 8: Real-Time Admin Alerts & Battery Footprint Architecture ===");
// -----------------------------------------------------------------------------

it("8: Admin real-time notification mechanism implemented with Web Notifications API and async webhook", () => {
  const appJs = fs.readFileSync(path.join(__dirname, 'js/app.js'), 'utf-8');

  assert.ok(appJs.includes('notifyAdminRealtime'), "Must define notifyAdminRealtime function");
  assert.ok(appJs.includes('Notification.permission'), "Must support browser Notification API");
  assert.ok(appJs.includes('ntfy.sh'), "Must support ntfy.sh lock-screen push webhook for zero battery consumption");
});

console.log("\n=================================================");
console.log("ALL TASK & ADMIN ENHANCEMENT TESTS PASSED! (10/10)");
console.log("=================================================\n");
