/**
 * test_collapse_and_flow_workspace.js
 * Automated Verification Test Suite for:
 * 1. Routine Section Auto-Collapse on Completion and Manual Expand/Collapse Toggle
 * 2. Browser Tab Favicon in index.html, admin/index.html, and wosandi/index.html
 * 3. Flow Page Canvas Scrollbars, Expansive Floor Size, and Collapsible Sidebars
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';

console.log("=================================================");
console.log("RUNNING COLLAPSE, FAVICON & FLOW WORKSPACE TESTS");
console.log("=================================================\n");

let passed = 0;
function it(desc, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${desc}`);
    console.error(`    Error: ${err.message}`);
    process.exit(1);
  }
}

// =========================================================================
// TEST SUITE 1: Browser Tab Icon (Favicon) Assets and Links
// =========================================================================
console.log("=== TEST SUITE 1: Browser Tab Icon (Favicon) ===");

it("favicon.svg exists and is valid SVG vector asset", () => {
  const faviconPath = path.resolve('favicon.svg');
  assert.ok(fs.existsSync(faviconPath), "favicon.svg must exist in root");
  const content = fs.readFileSync(faviconPath, 'utf8');
  assert.ok(content.includes('<svg'), "favicon.svg must have <svg tag");
  assert.ok(content.includes('viewBox="0 0 64 64"'), "favicon.svg should be 64x64 vector");
});

it("index.html contains favicon link tag", () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="favicon.svg">'), "index.html must link favicon.svg");
});

it("admin/index.html contains favicon link tag", () => {
  const html = fs.readFileSync(path.resolve('admin/index.html'), 'utf8');
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="../favicon.svg">'), "admin/index.html must link ../favicon.svg");
});

it("wosandi/index.html contains favicon link tag", () => {
  const html = fs.readFileSync(path.resolve('wosandi/index.html'), 'utf8');
  assert.ok(html.includes('<link rel="icon" type="image/svg+xml" href="../favicon.svg">'), "wosandi/index.html must link ../favicon.svg");
});

// =========================================================================
// TEST SUITE 2: Routine Section Structure in index.html and style.css
// =========================================================================
console.log("\n=== TEST SUITE 2: Section Structure & CSS Rules ===");

it("index.html includes .routine-section, .section-header, .section-body, and .completion-badge", () => {
  const html = fs.readFileSync(path.resolve('index.html'), 'utf8');
  assert.ok(html.includes('data-section-id="wake_up"'), "wake_up section exists");
  assert.ok(html.includes('data-section-id="school"'), "school section exists");
  assert.ok(html.includes('data-section-id="study"'), "study section exists");
  assert.ok(html.includes('data-section-id="fitness"'), "fitness section exists");
  assert.ok(html.includes('data-section-id="chores"'), "chores section exists");
  assert.ok(html.includes('class="section-header'), "section-header class present");
  assert.ok(html.includes('class="section-body'), "section-body class present");
  assert.ok(html.includes('class="completion-badge'), "completion-badge class present");
  assert.ok(html.includes('class="collapse-toggle-btn'), "collapse-toggle-btn class present");
});

it("style.css includes .routine-section.is-completed and .routine-section.is-collapsed", () => {
  const css = fs.readFileSync(path.resolve('css/style.css'), 'utf8');
  assert.ok(css.includes('.routine-section.is-completed'), "CSS contains .routine-section.is-completed");
  assert.ok(css.includes('.routine-section.is-collapsed .section-body'), "CSS contains .routine-section.is-collapsed .section-body");
  assert.ok(css.includes('display: none !important;'), "Collapsed section-body is hidden");
  assert.ok(css.includes('transform: rotate(-90deg);'), "Collapsed toggle chevron rotated");
});

// =========================================================================
// TEST SUITE 3: Section Completion Logic & Auto-Collapse Mechanics
// =========================================================================
console.log("\n=== TEST SUITE 3: Section Completion & Collapse Controller ===");

// Mock a lightweight DOM environment
class MockClassList {
  constructor() {
    this.classes = new Set();
  }
  add(...cls) { cls.forEach(c => this.classes.add(c)); }
  remove(...cls) { cls.forEach(c => this.classes.delete(c)); }
  toggle(cls, force) {
    if (force !== undefined) {
      if (force) this.classes.add(cls);
      else this.classes.delete(cls);
      return force;
    }
    if (this.classes.has(cls)) {
      this.classes.delete(cls);
      return false;
    } else {
      this.classes.add(cls);
      return true;
    }
  }
  contains(cls) { return this.classes.has(cls); }
}

class MockElement {
  constructor(tag, id = '', attrs = {}) {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.attrs = { ...attrs };
    this.classList = new MockClassList();
    this.children = [];
    this.parentElement = null;
    this.listeners = {};
  }
  getAttribute(name) { return this.attrs[name] || null; }
  setAttribute(name, val) { this.attrs[name] = val; }
  querySelector(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.children.find(c => c.classList.contains(cls)) || null;
    }
    return null;
  }
  querySelectorAll(sel) {
    if (sel.startsWith('.')) {
      const cls = sel.slice(1);
      return this.children.filter(c => c.classList.contains(cls));
    }
    return [];
  }
  addEventListener(evt, fn) {
    if (!this.listeners[evt]) this.listeners[evt] = [];
    this.listeners[evt].push(fn);
  }
}

// Build mock document with 5 routine sections
const mockDoc = {
  elements: [],
  querySelectorAll(sel) {
    if (sel === '.routine-section') {
      return this.elements.filter(e => e.classList.contains('routine-section'));
    }
    return [];
  },
  querySelector(sel) {
    const match = sel.match(/\.routine-section\[data-section-id="([^"]+)"\]/);
    if (match) {
      const secId = match[1];
      return this.elements.find(e => e.classList.contains('routine-section') && e.getAttribute('data-section-id') === secId) || null;
    }
    return null;
  },
  getElementById(id) {
    return this.elements.find(e => e.id === id) || null;
  },
  addEventListener(evt, fn) {}
};

['wake_up', 'school', 'study', 'fitness', 'chores', 'flow'].forEach(id => {
  const sec = new MockElement('section', '', { 'data-section-id': id });
  sec.classList.add('routine-section');
  const badge = new MockElement('span');
  badge.classList.add('completion-badge', 'hidden');
  const body = new MockElement('div');
  body.classList.add('section-body');
  sec.children.push(badge, body);
  mockDoc.elements.push(sec);
});

// Load app.js logic into test sandbox
const appCode = fs.readFileSync(path.resolve('js/app.js'), 'utf8');
const sandbox = {
  window: {},
  document: mockDoc,
  localStorage: { getItem: () => null, setItem: () => {} },
  syncProgressWithServer: () => {}
};

const runInScope = new Function('window', 'document', 'localStorage', 'syncProgressWithServer', appCode);
runInScope(sandbox.window, sandbox.document, sandbox.localStorage, sandbox.syncProgressWithServer);

const isSectionCompleted = sandbox.window.isSectionCompleted;
const updateSectionCollapseStates = sandbox.window.updateSectionCollapseStates;
const toggleSectionCollapse = sandbox.window.toggleSectionCollapse;

it("isSectionCompleted accurately verifies wake-up section", () => {
  assert.strictEqual(isSectionCompleted('wake_up', { wake_up: null }), false);
  assert.strictEqual(isSectionCompleted('wake_up', { wake_up: '05:00 - 05:30' }), true);
});

it("isSectionCompleted accurately verifies school section", () => {
  assert.strictEqual(isSectionCompleted('school', { school_attended: false }), false);
  assert.strictEqual(isSectionCompleted('school', { school_attended: true }), true);
});

it("isSectionCompleted accurately verifies study section (all 3 tasks required)", () => {
  assert.strictEqual(isSectionCompleted('study', { maths_practice: true, gemini_english: false, vocab_words: true }), false);
  assert.strictEqual(isSectionCompleted('study', { maths_practice: true, gemini_english: true, vocab_words: true }), true);
});

it("isSectionCompleted accurately verifies fitness section (all 2 tasks required)", () => {
  assert.strictEqual(isSectionCompleted('fitness', { dance_workout: true, exercise_schedule: false }), false);
  assert.strictEqual(isSectionCompleted('fitness', { dance_workout: true, exercise_schedule: true }), true);
});

it("isSectionCompleted accurately verifies chores section (all 6 tasks required)", () => {
  const stateChores = {
    clean_room: true,
    water_plants: true,
    sweep_floor: true,
    dispose_garbage: true,
    hair_care: true,
    clean_wardrobe: false
  };
  assert.strictEqual(isSectionCompleted('chores', stateChores), false);
  stateChores.clean_wardrobe = true;
  assert.strictEqual(isSectionCompleted('chores', stateChores), true);
});

it("updateSectionCollapseStates automatically collapses completed sections and displays badge", () => {
  const testState = {
    wake_up: '05:30 - 06:00',
    school_attended: false,
    maths_practice: true,
    gemini_english: true,
    vocab_words: true
  };

  updateSectionCollapseStates(testState);

  const wakeEl = mockDoc.querySelector('.routine-section[data-section-id="wake_up"]');
  const schoolEl = mockDoc.querySelector('.routine-section[data-section-id="school"]');
  const studyEl = mockDoc.querySelector('.routine-section[data-section-id="study"]');

  assert.ok(wakeEl.classList.contains('is-completed'), "wake_up is marked completed");
  assert.ok(wakeEl.classList.contains('is-collapsed'), "wake_up is collapsed by default to save space");
  assert.ok(!wakeEl.querySelector('.completion-badge').classList.contains('hidden'), "wake_up badge is visible");

  assert.ok(!schoolEl.classList.contains('is-completed'), "school is not completed");
  assert.ok(!schoolEl.classList.contains('is-collapsed'), "school remains expanded");

  assert.ok(studyEl.classList.contains('is-completed'), "study is completed");
  assert.ok(studyEl.classList.contains('is-collapsed'), "study is collapsed");
});

it("toggleSectionCollapse expands a collapsed section and re-collapses on second click", () => {
  const wakeEl = mockDoc.querySelector('.routine-section[data-section-id="wake_up"]');
  assert.ok(wakeEl.classList.contains('is-collapsed'), "wake_up starts collapsed");

  // User taps header to expand
  toggleSectionCollapse('wake_up');
  assert.ok(!wakeEl.classList.contains('is-collapsed'), "wake_up is now expanded");

  // User taps header again to re-collapse
  toggleSectionCollapse('wake_up');
  assert.ok(wakeEl.classList.contains('is-collapsed'), "wake_up is collapsed again");
});

// =========================================================================
// TEST SUITE 4: Flow Builder Canvas Scrollbars & Collapsible Sidebars
// =========================================================================
console.log("\n=== TEST SUITE 4: Flow Builder Canvas & Space-Saving Layout ===");

it("admin.css contains prominent, visible scrollbar styles for .flow-graph-container", () => {
  const css = fs.readFileSync(path.resolve('admin/css/admin.css'), 'utf8');
  assert.ok(css.includes('.flow-graph-container {'), "flow-graph-container rule exists");
  assert.ok(css.includes('overflow: auto !important;'), "overflow: auto enabled");
  assert.ok(css.includes('.flow-graph-container::-webkit-scrollbar'), "custom webkit scrollbars defined");
  assert.ok(css.includes('#sidebar.sidebar-collapsed'), "#sidebar.sidebar-collapsed rule defined");
  assert.ok(css.includes('#fb-node-editor.editor-collapsed'), "#fb-node-editor.editor-collapsed rule defined");
  assert.ok(css.includes('#fb-canvas-wrapper.canvas-full-width'), "#fb-canvas-wrapper.canvas-full-width rule defined");
});

it("admin/index.html includes desktop sidebar toggle button", () => {
  const html = fs.readFileSync(path.resolve('admin/index.html'), 'utf8');
  assert.ok(html.includes('id="open-sidebar"'), "open-sidebar button exists");
  assert.ok(!html.includes('class="md:hidden text-slate-500 hover:text-indigo-600"'), "open-sidebar is not restricted to md:hidden");
});

it("flowBuilder.js expands canvas floor to minimum 2600x1800 for true scrollability", () => {
  const js = fs.readFileSync(path.resolve('admin/js/flowBuilder.js'), 'utf8');
  assert.ok(js.includes('Math.max(2600,'), "canvas width floor is at least 2600px");
  assert.ok(js.includes('Math.max(1800,'), "canvas height floor is at least 1800px");
});

it("flowBuilder.js includes Full Workspace, Properties Toggle, and Reset View controls", () => {
  const js = fs.readFileSync(path.resolve('admin/js/flowBuilder.js'), 'utf8');
  assert.ok(js.includes('id="fb-maximize-workspace"'), "Full Workspace button in toolbar");
  assert.ok(js.includes('id="fb-toggle-props-top"'), "Properties toggle button in top bar");
  assert.ok(js.includes('id="fb-toggle-properties-canvas"'), "Properties toggle button on canvas header");
  assert.ok(js.includes('id="fb-scroll-top-left"'), "Scroll to origin (Reset View) button");
  assert.ok(js.includes('id="fb-floating-props-btn"'), "Floating properties button when collapsed");
  assert.ok(js.includes('id="fb-collapse-props-btn"'), "Collapse button inside node editor");
  assert.ok(js.includes('togglePropertiesPanel('), "togglePropertiesPanel method implemented");
  assert.ok(js.includes('toggleFullWorkspace('), "toggleFullWorkspace method implemented");
});

console.log("\n=================================================");
console.log(`ALL NEW VERIFICATION TESTS PASSED! (${passed} checks succeeded)`);
console.log("=================================================");
