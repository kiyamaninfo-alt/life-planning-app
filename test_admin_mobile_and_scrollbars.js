// test_admin_mobile_and_scrollbars.js
import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log("=== Running Admin Mobile & Scrollbar Verification Tests ===");

// 1. Verify admin.css scrollbar styling and responsive media queries
const adminCss = fs.readFileSync(path.resolve('./admin/css/admin.css'), 'utf-8');

assert.ok(adminCss.includes('scrollbar-width: thin'), "admin.css contains standard CSS scrollbar-width for modern browsers");
assert.ok(adminCss.includes('scrollbar-color: #6366f1'), "admin.css contains high-contrast scrollbar-color");
assert.ok(adminCss.includes('::-webkit-scrollbar'), "admin.css contains WebKit scrollbar rules");
assert.ok(adminCss.includes('::-webkit-scrollbar-thumb'), "admin.css defines custom scrollbar thumb");
assert.ok(adminCss.includes('::-webkit-scrollbar-track'), "admin.css defines visible scrollbar track");
assert.ok(adminCss.includes('@media (max-width: 1024px)'), "admin.css contains @media (max-width: 1024px) for tablet/smaller screen scrollbars");
assert.ok(adminCss.includes('@media (max-width: 768px)'), "admin.css contains @media (max-width: 768px) breakpoint for mobile");
assert.ok(adminCss.includes('-webkit-overflow-scrolling: touch'), "admin.css has smooth touch scrolling enabled");
assert.ok(adminCss.includes('touch-action: manipulation'), "admin.css eliminates tap delays on mobile touch targets");
assert.ok(adminCss.includes('.table-scroll-hint'), "admin.css defines .table-scroll-hint display rules");
console.log("  ✓ PASS: admin.css universal & mobile scrollbar styling verified");

// 2. Verify admin/index.html mobile friendliness
const adminHtml = fs.readFileSync(path.resolve('./admin/index.html'), 'utf-8');

assert.ok(adminHtml.includes('h-[100dvh]'), "admin/index.html uses dynamic viewport height (100dvh) for mobile browser address bar safety");
assert.ok(adminHtml.includes('overflow-x-auto'), "admin/index.html main-content supports horizontal scrolling for smaller screens");
assert.ok(adminHtml.includes('grid-cols-1 sm:grid-cols-2'), "admin/index.html quick actions are responsive on small screens");
assert.ok(adminHtml.includes('id="close-sidebar"'), "admin/index.html includes mobile close-sidebar button");
assert.ok(adminHtml.includes('id="open-sidebar"'), "admin/index.html includes hamburger open-sidebar button");
console.log("  ✓ PASS: admin/index.html mobile layout & dynamic viewport verified");

// 3. Verify taskManager.js responsive controls & table scrollability
const taskManagerJs = fs.readFileSync(path.resolve('./admin/js/taskManager.js'), 'utf-8');

assert.ok(taskManagerJs.includes('overflow-x-auto'), "taskManager.js wraps task table in overflow-x-auto container");
assert.ok(taskManagerJs.includes('min-w-[850px]'), "taskManager.js ensures task table has minimum width for clean column layout");
assert.ok(taskManagerJs.includes('table-scroll-hint'), "taskManager.js includes mobile scroll hint for 8 columns");
assert.ok(taskManagerJs.includes('flex flex-col sm:flex-row'), "taskManager.js uses responsive flex layouts for headers and filters");
console.log("  ✓ PASS: taskManager.js responsive controls & scrollable table verified");

// 4. Verify userManager.js responsive controls & table scrollability
const userManagerJs = fs.readFileSync(path.resolve('./admin/js/userManager.js'), 'utf-8');

assert.ok(userManagerJs.includes('overflow-x-auto'), "userManager.js wraps users table in overflow-x-auto container");
assert.ok(userManagerJs.includes('min-w-[650px]'), "userManager.js ensures user table has minimum width");
assert.ok(userManagerJs.includes('table-scroll-hint'), "userManager.js includes mobile scroll hint");
console.log("  ✓ PASS: userManager.js responsive layout & scrollable table verified");

// 5. Verify publishManager.js table scrollability
const publishManagerJs = fs.readFileSync(path.resolve('./admin/js/publishManager.js'), 'utf-8');

assert.ok(publishManagerJs.includes('overflow-x-auto'), "publishManager.js wraps publish table in overflow-x-auto container");
assert.ok(publishManagerJs.includes('min-w-[620px]'), "publishManager.js ensures table has minimum width for mobile scrolling");
console.log("  ✓ PASS: publishManager.js scrollable table verified");

// 6. Verify flowBuilder.js mobile canvas and controls
const flowBuilderJs = fs.readFileSync(path.resolve('./admin/js/flowBuilder.js'), 'utf-8');

assert.ok(flowBuilderJs.includes('flex-wrap'), "flowBuilder.js canvas toolbar and buttons wrap gracefully on small screens");
assert.ok(flowBuilderJs.includes('flow-graph-container'), "flowBuilder.js uses flow-graph-container with scrollbars");
console.log("  ✓ PASS: flowBuilder.js mobile canvas & toolbars verified");

console.log("\n=================================================");
console.log("ALL ADMIN MOBILE & SCROLLBAR TESTS PASSED!");
console.log("=================================================");
