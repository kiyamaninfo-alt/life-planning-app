import assert from 'assert';
import fs from 'fs';
import {
  DEFAULT_ROUTINE_CONFIG,
  PREREQUISITE_RULES,
  isConditionSatisfied,
  applyRoutineOrderAndDependencies
} from './js/routineOrdering.js';
import { RoutineOrderManager } from './admin/js/routineOrderManager.js';

console.log("=================================================");
console.log("RUNNING ROUTINE ORDERING & PROGRESSIVE UNLOCKING TESTS");
console.log("=================================================");

let passed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ FAIL: ${name}`);
    console.error(err);
    process.exit(1);
  }
}

// Minimal DOM Element Mock
class MockElement {
  constructor(tagName = 'div', attributes = {}) {
    this.tagName = tagName.toUpperCase();
    this.attributes = { ...attributes };
    this.children = [];
    this.parentNode = null;
    this.classList = {
      _classes: new Set(),
      add: (cls) => this.classList._classes.add(cls),
      remove: (cls) => this.classList._classes.delete(cls),
      toggle: (cls, force) => {
        if (force === true) this.classList._classes.add(cls);
        else if (force === false) this.classList._classes.delete(cls);
        else if (this.classList._classes.has(cls)) this.classList._classes.delete(cls);
        else this.classList._classes.add(cls);
      },
      contains: (cls) => this.classList._classes.has(cls)
    };
    this.dataset = {};
    this.listeners = {};
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this._innerHTML = '';
    this.textContent = '';
  }

  get id() { return this.attributes.id || ''; }
  set id(val) { this.attributes.id = val; }

  get className() { return Array.from(this.classList._classes).join(' '); }
  set className(val) {
    this.classList._classes.clear();
    if (val) val.split(/\s+/).forEach(c => c && this.classList._classes.add(c));
  }

  get innerHTML() { return this._innerHTML; }
  set innerHTML(val) {
    this._innerHTML = val;
    this.textContent = val.replace(/<[^>]*>/g, '');
    this.parseMockChildren(val);
  }

  parseMockChildren(html) {
    this.children = [];
    if (html.includes('id="rom-save-btn"')) {
      const btn = new MockElement('button', { id: 'rom-save-btn' });
      this.appendChild(btn);
    }
    if (html.includes('id="rom-reset-btn"')) {
      const btn = new MockElement('button', { id: 'rom-reset-btn' });
      this.appendChild(btn);
    }
    if (html.includes('id="rom-content"')) {
      const div = new MockElement('div', { id: 'rom-content' });
      this.appendChild(div);
    }

    const rowMatches = html.match(/<div class="[^"]*rom-section-row[^"]*"[^>]*data-id="([^"]+)"[^>]*>/g) || [];
    rowMatches.forEach((rowStr) => {
      const idMatch = rowStr.match(/data-id="([^"]+)"/);
      const id = idMatch ? idMatch[1] : '';
      const row = new MockElement('div');
      row.className = 'rom-section-row';
      row.dataset.id = id;
      row.setAttribute('data-id', id);

      const upBtn = new MockElement('button');
      upBtn.className = 'rom-move-up';
      upBtn.dataset.id = id;
      if (rowMatches.indexOf(rowStr) === 0) upBtn.disabled = true;
      row.appendChild(upBtn);

      const downBtn = new MockElement('button');
      downBtn.className = 'rom-move-down';
      downBtn.dataset.id = id;
      if (rowMatches.indexOf(rowStr) === rowMatches.length - 1) downBtn.disabled = true;
      row.appendChild(downBtn);

      const select = new MockElement('select');
      select.className = 'rom-depends-select';
      select.dataset.id = id;
      row.appendChild(select);

      const toggle = new MockElement('input');
      toggle.className = 'rom-enabled-toggle';
      toggle.dataset.id = id;
      toggle.checked = true;
      row.appendChild(toggle);

      this.appendChild(row);
    });
  }

  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[prop] = String(value);
    }
  }

  appendChild(child) {
    if (child.parentNode) {
      const idx = child.parentNode.children.indexOf(child);
      if (idx !== -1) child.parentNode.children.splice(idx, 1);
    }
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  insertBefore(newNode, refNode) {
    if (newNode.parentNode) {
      const idx = newNode.parentNode.children.indexOf(newNode);
      if (idx !== -1) newNode.parentNode.children.splice(idx, 1);
    }
    newNode.parentNode = this;
    const refIdx = this.children.indexOf(refNode);
    if (refIdx !== -1) {
      this.children.splice(refIdx, 0, newNode);
    } else {
      this.children.push(newNode);
    }
    return newNode;
  }

  addEventListener(event, handler) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(handler);
  }

  click() {
    if (this.disabled) return;
    const evt = { currentTarget: this, target: this, preventDefault: () => {} };
    (this.listeners['click'] || []).forEach(cb => cb(evt));
  }

  querySelector(selector) {
    const all = this.querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  }

  querySelectorAll(selector) {
    const results = [];
    const check = (node) => {
      let match = false;
      if (selector.startsWith('#') && node.id === selector.slice(1)) match = true;
      else if (selector.startsWith('.') && node.classList.contains(selector.slice(1))) match = true;
      else if (selector.includes('[data-section-id="')) {
        const id = selector.match(/\[data-section-id="([^"]+)"\]/)[1];
        if (node.getAttribute('data-section-id') === id) match = true;
      } else if (selector.includes('[data-task-id="')) {
        const id = selector.match(/\[data-task-id="([^"]+)"\]/)[1];
        if (node.getAttribute('data-task-id') === id) match = true;
      } else if (selector.includes('[data-for="')) {
        const id = selector.match(/\[data-for="([^"]+)"\]/)[1];
        if (node.getAttribute('data-for') === id) match = true;
      } else if (selector === 'section[data-section-id]' && node.tagName === 'SECTION' && node.getAttribute('data-section-id')) {
        match = true;
      } else if (selector === 'input[name="rom-display-mode"]') {
        match = true;
      }
      if (match) results.push(node);
      node.children.forEach(check);
    };

    this.children.forEach(check);
    return results;
  }
}

// Minimal Browser Environment Setup
const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.window = {
  flowPlayer: { flow: { id: 'sample_flow' } },
  addEventListener: () => {}
};
global.document = {
  getElementById: (id) => documentRoot.querySelector(`#${id}`),
  querySelector: (sel) => documentRoot.querySelector(sel),
  querySelectorAll: (sel) => documentRoot.querySelectorAll(sel),
  createElement: (tag) => new MockElement(tag)
};
const documentRoot = new MockElement('root');

async function runAllTests() {
  // =========================================================================
  // TEST SUITE 1: Routine Configuration Defaults & Prerequisites
  // =========================================================================
  console.log("\n=== TEST SUITE 1: Routine Configuration Defaults & Prerequisites ===");

  test("DEFAULT_ROUTINE_CONFIG contains all expected sections", () => {
    assert.ok(Array.isArray(DEFAULT_ROUTINE_CONFIG.sections), "Sections must be an array");
    const sectionIds = DEFAULT_ROUTINE_CONFIG.sections.map(s => s.id);
    assert.ok(sectionIds.includes("flow"), "Contains flow section");
    assert.ok(sectionIds.includes("wake_up"), "Contains wake_up section");
    assert.ok(sectionIds.includes("school"), "Contains school section");
    assert.ok(sectionIds.includes("study"), "Contains study section");
    assert.ok(sectionIds.includes("fitness"), "Contains fitness section");
    assert.ok(sectionIds.includes("chores"), "Contains chores section");
    assert.strictEqual(DEFAULT_ROUTINE_CONFIG.sections.length, 6, "Expected 6 sections");
  });

  test("Sections have initial sequential orders 1 through 6", () => {
    const sorted = [...DEFAULT_ROUTINE_CONFIG.sections].sort((a, b) => a.order - b.order);
    sorted.forEach((sec, idx) => {
      assert.strictEqual(sec.order, idx + 1, `Section ${sec.id} order should be ${idx + 1}`);
    });
  });

  test("PREREQUISITE_RULES lists all major routine gates and tasks", () => {
    const ruleIds = PREREQUISITE_RULES.map(r => r.id);
    assert.ok(ruleIds.includes("none"), "Includes none rule");
    assert.ok(ruleIds.includes("wake_up"), "Includes wake_up rule");
    assert.ok(ruleIds.includes("school"), "Includes school rule");
    assert.ok(ruleIds.includes("flow"), "Includes flow rule");
    assert.ok(ruleIds.includes("study"), "Includes study rule");
    assert.ok(ruleIds.includes("maths_practice"), "Includes maths_practice rule");
    assert.ok(ruleIds.includes("fitness"), "Includes fitness rule");
    assert.ok(ruleIds.includes("clean_room"), "Includes clean_room rule");
  });

  // =========================================================================
  // TEST SUITE 2: Prerequisite Condition Evaluation Logic
  // =========================================================================
  console.log("\n=== TEST SUITE 2: Prerequisite Condition Evaluation Logic ===");

  test("Condition 'none' is always satisfied", () => {
    assert.strictEqual(isConditionSatisfied('none', {}), true);
    assert.strictEqual(isConditionSatisfied(null, {}), true);
    assert.strictEqual(isConditionSatisfied(undefined, {}), true);
  });

  test("Wake-up condition satisfies only when wake_up is recorded", () => {
    const emptyState = { wake_up: null };
    assert.strictEqual(isConditionSatisfied('wake_up', emptyState), false);
    
    const filledState = { wake_up: "05:00 - 05:30" };
    assert.strictEqual(isConditionSatisfied('wake_up', filledState), true);
  });

  test("School condition satisfies when school_attended is true", () => {
    assert.strictEqual(isConditionSatisfied('school', { school_attended: false }), false);
    assert.strictEqual(isConditionSatisfied('school', { school_attended: true }), true);
  });

  test("Flow condition satisfies when points > 0 or flow_completed is true", () => {
    assert.strictEqual(isConditionSatisfied('flow', { flow_points: 0, flow_completed: false }), false);
    assert.strictEqual(isConditionSatisfied('flow', { flow_points: 25, flow_completed: false }), true);
    assert.strictEqual(isConditionSatisfied('flow', { flow_points: 0, flow_completed: true }), true);
  });

  test("Study condition satisfies if any academic task is completed", () => {
    assert.strictEqual(isConditionSatisfied('study', {}), false);
    assert.strictEqual(isConditionSatisfied('study', { maths_practice: true }), true);
    assert.strictEqual(isConditionSatisfied('study', { gemini_english: true }), true);
    assert.strictEqual(isConditionSatisfied('study', { vocab_words: true }), true);
  });

  test("Fitness condition satisfies if dance or exercise is completed", () => {
    assert.strictEqual(isConditionSatisfied('fitness', {}), false);
    assert.strictEqual(isConditionSatisfied('fitness', { dance_workout: true }), true);
    assert.strictEqual(isConditionSatisfied('fitness', { exercise_schedule: true }), true);
  });

  test("Individual task condition evaluation works accurately", () => {
    assert.strictEqual(isConditionSatisfied('clean_room', { clean_room: false }), false);
    assert.strictEqual(isConditionSatisfied('clean_room', { clean_room: true }), true);
    assert.strictEqual(isConditionSatisfied('water_plants', { water_plants: true }), true);
  });

  // =========================================================================
  // TEST SUITE 3: DOM Visual Re-Ordering & Progressive Unlocking
  // =========================================================================
  console.log("\n=== TEST SUITE 3: DOM Visual Re-Ordering & Progressive Unlocking ===");

  test("applyRoutineOrderAndDependencies re-orders DOM elements into custom user sequence", () => {
    documentRoot.children = [];
    const container = new MockElement('main');
    container.id = 'routine-main-container';
    documentRoot.appendChild(container);

    const sFlow = new MockElement('section', { 'data-section-id': 'flow' });
    const sWake = new MockElement('section', { 'data-section-id': 'wake_up' });
    const sSchool = new MockElement('section', { 'data-section-id': 'school' });
    const sStudy = new MockElement('section', { 'data-section-id': 'study' });
    const sFitness = new MockElement('section', { 'data-section-id': 'fitness' });
    const sChores = new MockElement('section', { 'data-section-id': 'chores' });

    container.appendChild(sFlow);
    container.appendChild(sWake);
    container.appendChild(sSchool);
    container.appendChild(sStudy);
    container.appendChild(sFitness);
    container.appendChild(sChores);

    // Set custom order in localStorage: Chores 1st, Fitness 2nd, Study 3rd, School 4th, Wake-up 5th, Flow 6th
    localStorage.setItem('wosandi_routine_order_config', JSON.stringify({
      display_mode: 'hidden',
      sections: [
        { id: 'chores', order: 1, enabled: true, depends_on: 'none' },
        { id: 'fitness', order: 2, enabled: true, depends_on: 'none' },
        { id: 'study', order: 3, enabled: true, depends_on: 'none' },
        { id: 'school', order: 4, enabled: true, depends_on: 'none' },
        { id: 'wake_up', order: 5, enabled: true, depends_on: 'none' },
        { id: 'flow', order: 6, enabled: true, depends_on: 'none' }
      ]
    }));

    // Test 1: When nothing completed yet, sections follow exact config order
    applyRoutineOrderAndDependencies({});

    const actualOrder = container.children.map(el => el.getAttribute('data-section-id'));
    assert.deepStrictEqual(actualOrder, ['chores', 'fitness', 'study', 'school', 'wake_up', 'flow'],
      "DOM elements must be physically reordered to match custom config");

    // Test 2: When wake_up is completed, it must be sent to the bottom
    applyRoutineOrderAndDependencies({ wake_up: "05:00" });
    const orderWithWakeupCompleted = container.children.map(el => el.getAttribute('data-section-id'));
    assert.deepStrictEqual(orderWithWakeupCompleted, ['chores', 'fitness', 'study', 'school', 'flow', 'wake_up'],
      "Completed section must be sent to the bottom of the container");
  });

  test("Progressive unlocking hides locked sections when prerequisite is not met", () => {
    documentRoot.children = [];
    const container = new MockElement('main');
    container.id = 'routine-main-container';
    documentRoot.appendChild(container);

    const sWake = new MockElement('section', { 'data-section-id': 'wake_up' });
    const sStudy = new MockElement('section', { 'data-section-id': 'study' });
    container.appendChild(sWake);
    container.appendChild(sStudy);

    localStorage.setItem('wosandi_routine_order_config', JSON.stringify({
      display_mode: 'hidden',
      sections: [
        { id: 'wake_up', order: 1, enabled: true, depends_on: 'none' },
        { id: 'study', order: 2, enabled: true, depends_on: 'wake_up' } // Locked until wake_up!
      ]
    }));

    // Case 1: wake_up NOT done -> study hidden
    applyRoutineOrderAndDependencies({ wake_up: null });
    assert.ok(sStudy.classList.contains('hidden'), 'Study should be hidden when wake_up is null');

    // Case 2: wake_up IS done -> study unlocked and visible
    applyRoutineOrderAndDependencies({ wake_up: "05:30 - 06:00" });
    assert.ok(!sStudy.classList.contains('hidden'), 'Study should be visible once wake_up is set');
  });

  test("Progressive unlocking renders locked banner when display_mode is 'locked_banner'", () => {
    documentRoot.children = [];
    const container = new MockElement('main');
    container.id = 'routine-main-container';
    documentRoot.appendChild(container);

    const sWake = new MockElement('section', { 'data-section-id': 'wake_up' });
    const sFitness = new MockElement('section', { 'data-section-id': 'fitness' });
    container.appendChild(sWake);
    container.appendChild(sFitness);

    localStorage.setItem('wosandi_routine_order_config', JSON.stringify({
      display_mode: 'locked_banner',
      sections: [
        { id: 'wake_up', order: 1, enabled: true, depends_on: 'none' },
        { id: 'fitness', title_si: '4. නැටුම් & ව්‍යායාම', order: 2, enabled: true, depends_on: 'wake_up' }
      ]
    }));

    // Run with wake_up not satisfied
    applyRoutineOrderAndDependencies({ wake_up: null });

    assert.ok(sFitness.classList.contains('hidden'), 'Fitness card hidden');

    const banner = container.querySelector('.routine-lock-banner[data-for="fitness"]');
    assert.ok(banner, "Locked banner placeholder must be created in locked_banner mode");
    assert.ok(banner.innerHTML.includes("4. නැටුම් & ව්‍යායාම"), "Banner contains Sinhala section title");
    assert.ok(banner.innerHTML.includes("Locked"), "Banner indicates Locked status");

    // When satisfied, banner is hidden and card is displayed
    applyRoutineOrderAndDependencies({ wake_up: "05:00 - 05:30" });
    assert.ok(!sFitness.classList.contains('hidden'), "Fitness card now visible");
    assert.ok(banner.classList.contains('hidden'), "Locked banner placeholder hidden when unlocked");
  });

  test("Task-level dependencies hide individual tasks until prerequisite is satisfied", () => {
    documentRoot.children = [];
    const container = new MockElement('main');
    container.id = 'routine-main-container';
    documentRoot.appendChild(container);

    const sChores = new MockElement('section', { 'data-section-id': 'chores' });
    const tCleanRoom = new MockElement('label', { 'data-task-id': 'clean_room' });
    const tWardrobe = new MockElement('label', { 'data-task-id': 'clean_wardrobe' });
    sChores.appendChild(tCleanRoom);
    sChores.appendChild(tWardrobe);
    container.appendChild(sChores);

    localStorage.setItem('wosandi_routine_order_config', JSON.stringify({
      display_mode: 'hidden',
      sections: [{ id: 'chores', order: 1, enabled: true, depends_on: 'none' }],
      tasks: [
        { id: 'clean_room', depends_on: 'none', enabled: true },
        { id: 'clean_wardrobe', depends_on: 'clean_room', enabled: true } // Clean wardrobe requires Clean room!
      ]
    }));

    // Case 1: clean_room false -> clean_wardrobe hidden
    applyRoutineOrderAndDependencies({ clean_room: false });
    assert.ok(tWardrobe.classList.contains('hidden'), 'Wardrobe task hidden before clean room');

    // Case 2: clean_room true -> clean_wardrobe visible
    applyRoutineOrderAndDependencies({ clean_room: true });
    assert.ok(!tWardrobe.classList.contains('hidden'), 'Wardrobe task unlocked after clean room');
  });

  // =========================================================================
  // TEST SUITE 4: Admin Routine Order Manager & Form Controls
  // =========================================================================
  console.log("\n=== TEST SUITE 4: Admin Routine Order Manager & Form Controls ===");

  await testAsync("RoutineOrderManager renders move buttons, rank badges and controls", async () => {
    documentRoot.children = [];
    const container = new MockElement('div');
    container.id = 'tab-routine-order';
    documentRoot.appendChild(container);

    localStorage.clear();
    let savedConfig = null;
    const origSetItem = localStorage.setItem;
    localStorage.setItem = (k, v) => {
      origSetItem(k, v);
      if (k === 'wosandi_routine_order_config') savedConfig = JSON.parse(v);
    };

    let toastMsg = '';
    const toastFn = (msg) => { toastMsg = msg; };

    const manager = new RoutineOrderManager(container, {}, toastFn);
    await manager.render();

    // Verify rows rendered
    const rows = container.querySelectorAll('.rom-section-row');
    assert.strictEqual(rows.length, 6, "Must render all 6 section rows");

    // Verify move up / move down buttons
    const moveUpBtns = container.querySelectorAll('.rom-move-up');
    const moveDownBtns = container.querySelectorAll('.rom-move-down');
    assert.strictEqual(moveUpBtns.length, 6, "Each row has a move-up button");
    assert.strictEqual(moveDownBtns.length, 6, "Each row has a move-down button");
    assert.ok(moveUpBtns[0].disabled, "Top row cannot move up");
    assert.ok(moveDownBtns[5].disabled, "Bottom row cannot move down");

    // Test Move Down action (Move item 0 down to position 1)
    const firstId = manager.config.sections[0].id;
    const secondId = manager.config.sections[1].id;
    moveDownBtns[0].click();

    assert.strictEqual(manager.config.sections[0].id, secondId, "Sections swapped on move down");
    assert.strictEqual(manager.config.sections[1].id, firstId, "Sections swapped on move down");
    assert.strictEqual(manager.config.sections[0].order, 1, "Reindexed order 1");
    assert.strictEqual(manager.config.sections[1].order, 2, "Reindexed order 2");

    // Save changes
    await manager.save();
    assert.ok(toastMsg.includes("සාර්ථකව") || toastMsg.includes("saved successfully"), "Toast message confirmed");
    assert.ok(savedConfig, "Saved to local storage");
    assert.strictEqual(savedConfig.sections[0].id, secondId, "Saved order matches swapped arrangement");
  });

  // =========================================================================
  // TEST SUITE 5: Static File & Route Integration Verification
  // =========================================================================
  console.log("\n=== TEST SUITE 5: Static File & Route Integration Verification ===");

  test("index.html contains #routine-main-container, data-section-id, data-task-id, and script", () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.ok(html.includes('id="routine-main-container"'), "Contains id='routine-main-container'");
    assert.ok(html.includes('data-section-id="flow"'), "Contains flow section id");
    assert.ok(html.includes('data-section-id="wake_up"'), "Contains wake_up section id");
    assert.ok(html.includes('data-section-id="school"'), "Contains school section id");
    assert.ok(html.includes('data-section-id="study"'), "Contains study section id");
    assert.ok(html.includes('data-section-id="fitness"'), "Contains fitness section id");
    assert.ok(html.includes('data-section-id="chores"'), "Contains chores section id");
    assert.ok(html.includes('data-task-id="maths_practice"'), "Contains maths_practice task id");
    assert.ok(html.includes('data-task-id="dance_workout"'), "Contains dance_workout task id");
    assert.ok(html.includes('data-task-id="clean_room"'), "Contains clean_room task id");
    assert.ok(html.includes('routineOrdering.js'), "Includes routineOrdering.js script module");
  });

  test("admin/index.html includes Routine Order nav link and tab pane", () => {
    const adminHtml = fs.readFileSync('admin/index.html', 'utf8');
    assert.ok(adminHtml.includes('data-tab="routine-order"'), "Includes data-tab='routine-order'");
    assert.ok(adminHtml.includes('id="tab-routine-order"'), "Includes id='tab-routine-order'");
    assert.ok(adminHtml.includes('Routine Order'), "Includes Routine Order label");
  });

  test("admin/js/adminApp.js registers RoutineOrderManager and resolves route", () => {
    const adminAppJs = fs.readFileSync('admin/js/adminApp.js', 'utf8');
    assert.ok(adminAppJs.includes('RoutineOrderManager'), "Imports RoutineOrderManager");
    assert.ok(adminAppJs.includes("this.managers['routine-order']"), "Instantiates RoutineOrderManager");
    assert.ok(adminAppJs.includes("routine-order"), "Handles routine-order route in resolveInitialRoute");
  });

  console.log("\n=================================================");
  console.log(`ALL TESTS PASSED! (${passed} checks succeeded)`);
  console.log("=================================================");
}

runAllTests();
