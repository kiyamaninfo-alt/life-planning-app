import assert from 'assert';
import fs from 'fs';

console.log("=================================================");
console.log("RUNNING COMPLETION PROTECTION & PASSWORD VERIFICATION TESTS");
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

// Minimal Browser Environment
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
    if (attributes.class) {
      attributes.class.split(/\s+/).forEach(c => c && this.classList.add(c));
    }
    this.dataset = {};
    Object.keys(attributes).forEach(k => {
      if (k.startsWith('data-')) {
        const prop = k.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
        this.dataset[prop] = String(attributes[k]);
      }
    });
    this.listeners = {};
    this.checked = false;
    this.disabled = false;
    this.value = '';
    this.innerText = '';
    this.textContent = '';
  }

  get id() { return this.attributes.id || ''; }
  set id(val) { this.attributes.id = val; }

  getAttribute(name) { return this.attributes[name] ?? null; }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) {
      const prop = name.slice(5).replace(/-([a-z])/g, (_, l) => l.toUpperCase());
      this.dataset[prop] = String(value);
    }
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  closest(selector) {
    let curr = this;
    while (curr) {
      if (selector.includes('[data-task-id]') && curr.getAttribute('data-task-id')) {
        return curr;
      }
      curr = curr.parentNode;
    }
    return null;
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
      else if (selector.includes('[data-task-id="')) {
        const id = selector.match(/\[data-task-id="([^"]+)"\]/)[1];
        if (node.getAttribute('data-task-id') === id) match = true;
      } else if (selector.includes('[data-val="')) {
        const val = selector.match(/\[data-val="([^"]+)"\]/)[1];
        if (node.getAttribute('data-val') === val) match = true;
      } else if (selector === 'input[type="checkbox"]' && node.tagName === 'INPUT') match = true;
      else if (selector === 'span' && node.tagName === 'SPAN') match = true;
      else if (selector === 'button' && node.tagName === 'BUTTON') match = true;

      if (match) results.push(node);
      node.children.forEach(check);
    };
    this.children.forEach(check);
    return results;
  }

  focus() {}
}

const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};

const docRoot = new MockElement('root');
global.document = {
  getElementById: (id) => {
    if (id === 'root') return docRoot;
    return docRoot.querySelector(`#${id}`);
  },
  querySelector: (sel) => docRoot.querySelector(sel),
  querySelectorAll: (sel) => docRoot.querySelectorAll(sel),
  createElement: (tag) => new MockElement(tag),
  addEventListener: () => {}
};

global.window = {
  document: global.document,
  localStorage: global.localStorage,
  addEventListener: () => {}
};

// Global dummy sync function
global.syncProgressWithServer = () => {};

// Read and evaluate app.js in this sandbox
const appJsCode = fs.readFileSync('js/app.js', 'utf8');
const runInScope = new Function('window', 'document', 'localStorage', 'syncProgressWithServer', appJsCode);
runInScope(global.window, global.document, global.localStorage, global.syncProgressWithServer);

// Extract app.js functions
const {
  state,
  requestPasswordConfirmation,
  verifyChangePin,
  closePinModal,
  toggleTask,
  setWakeTime,
  toggleSchool,
  toggleSubject,
  toggleSubjectDetail,
  syncStateToUI
} = global.window;

// Setup Mock DOM elements for tests
function setupDOM() {
  docRoot.children = [];

  // Change PIN modal elements
  const modal = new MockElement('div', { id: 'change-pin-modal' });
  modal.classList.add('hidden');
  const input = new MockElement('input', { id: 'change-pin-input' });
  const desc = new MockElement('p', { id: 'change-pin-description' });
  const err = new MockElement('p', { id: 'change-pin-error' });
  const confirmBtn = new MockElement('button', { id: 'change-pin-confirm' });
  const cancelBtn = new MockElement('button', { id: 'change-pin-cancel' });
  const closeBtn = new MockElement('button', { id: 'change-pin-close' });

  modal.appendChild(input);
  modal.appendChild(desc);
  modal.appendChild(err);
  modal.appendChild(confirmBtn);
  modal.appendChild(cancelBtn);
  modal.appendChild(closeBtn);
  docRoot.appendChild(modal);

  // Wake buttons
  const b1 = new MockElement('button', { class: 'wake-btn', 'data-val': '05:00 - 05:30' });
  const b2 = new MockElement('button', { class: 'wake-btn', 'data-val': '05:30 - 06:00' });
  const b3 = new MockElement('button', { class: 'wake-btn', 'data-val': '06:00 න් පසු' });
  docRoot.appendChild(b1);
  docRoot.appendChild(b2);
  docRoot.appendChild(b3);

  // School toggle & container
  const sToggle = new MockElement('input', { id: 'school-toggle' });
  const sContainer = new MockElement('div', { id: 'subjects-container' });
  const sGrid = new MockElement('div', { id: 'subjects-grid' });
  const hwDetails = new MockElement('div', { id: 'homework-details' });
  docRoot.appendChild(sToggle);
  docRoot.appendChild(sContainer);
  docRoot.appendChild(sGrid);
  docRoot.appendChild(hwDetails);

  // Task rows
  const taskIds = ['clean_room', 'maths_practice', 'gemini_english', 'water_plants'];
  taskIds.forEach(tid => {
    const row = new MockElement('label', { 'data-task-id': tid });
    const span = new MockElement('span');
    span.textContent = tid;
    const cb = new MockElement('input');
    cb.setAttribute('type', 'checkbox');
    row.appendChild(span);
    row.appendChild(cb);
    docRoot.appendChild(row);
  });
}

async function runTests() {
  // =========================================================================
  // TEST SUITE 1: Task Checkbox Completion & Protection
  // =========================================================================
  console.log("\n=== TEST SUITE 1: Task Checkbox Completion & Protection ===");

  await testAsync("Completing an unchecked task requires NO password (checking allowed freely)", async () => {
    setupDOM();
    state.clean_room = false;
    const cb = docRoot.querySelector('[data-task-id="clean_room"] input[type="checkbox"]');
    cb.checked = true;

    // Check task: value true
    await toggleTask('clean_room', true, cb);

    assert.strictEqual(state.clean_room, true, "State clean_room updated to true");
    assert.strictEqual(cb.checked, true, "Checkbox remains checked");
    assert.ok(document.getElementById('change-pin-modal').classList.contains('hidden'), "Modal stayed closed");
  });

  await testAsync("Trying to uncheck a completed task asks for password and rejects on wrong PIN", async () => {
    setupDOM();
    state.clean_room = true;
    const cb = docRoot.querySelector('[data-task-id="clean_room"] input[type="checkbox"]');
    cb.checked = false; // User clicked to uncheck!

    // Initiate uncheck (returns Promise waiting for PIN verification)
    const togglePromise = toggleTask('clean_room', false, cb);

    // Modal should be visible now!
    const modal = document.getElementById('change-pin-modal');
    assert.ok(!modal.classList.contains('hidden'), "PIN modal is displayed");
    assert.ok(modal.classList.contains('flex'), "Modal has flex display");

    // Enter WRONG PIN "9999" and trigger verification
    const pinInput = document.getElementById('change-pin-input');
    pinInput.value = "9999";
    verifyChangePin();

    const err = document.getElementById('change-pin-error');
    assert.ok(!err.classList.contains('hidden'), "Error message displayed for invalid PIN");

    // Cancel modal
    closePinModal(false);
    await togglePromise;

    // State and UI must remain COMPLETED!
    assert.strictEqual(state.clean_room, true, "State clean_room protected (still true)");
    assert.strictEqual(cb.checked, true, "Checkbox was reverted back to checked=true");
  });

  await testAsync("Entering correct PIN (1234) allows unchecking a completed task", async () => {
    setupDOM();
    state.clean_room = true;
    const cb = docRoot.querySelector('[data-task-id="clean_room"] input[type="checkbox"]');
    cb.checked = false;

    const togglePromise = toggleTask('clean_room', false, cb);

    // Enter correct PIN
    const pinInput = document.getElementById('change-pin-input');
    pinInput.value = "1234";
    verifyChangePin();

    await togglePromise;

    // Allowed to uncheck
    assert.strictEqual(state.clean_room, false, "State clean_room uncompleted after correct PIN");
    assert.strictEqual(cb.checked, false, "Checkbox successfully unchecked");
  });

  // =========================================================================
  // TEST SUITE 2: Wake-up Time Completion & Protection
  // =========================================================================
  console.log("\n=== TEST SUITE 2: Wake-up Time Completion & Protection ===");

  await testAsync("Setting wake-up time first time requires NO password", async () => {
    setupDOM();
    state.wake_up = null;

    await setWakeTime('05:00 - 05:30');

    assert.strictEqual(state.wake_up, '05:00 - 05:30', "Wake-up time set");
    assert.ok(document.getElementById('change-pin-modal').classList.contains('hidden'), "Modal stayed closed");
  });

  await testAsync("Switching already completed wake-up time asks for password and rejects on cancel", async () => {
    setupDOM();
    state.wake_up = '05:00 - 05:30';

    const setPromise = setWakeTime('06:00 න් පසු');

    const modal = document.getElementById('change-pin-modal');
    assert.ok(!modal.classList.contains('hidden'), "PIN modal opened when trying to change completed wake time");

    // Cancel without entering password
    closePinModal(false);
    await setPromise;

    assert.strictEqual(state.wake_up, '05:00 - 05:30', "Wake time protected and preserved");
  });

  await testAsync("Entering correct password allows changing already completed wake-up time", async () => {
    setupDOM();
    state.wake_up = '05:00 - 05:30';

    const setPromise = setWakeTime('05:30 - 06:00');

    const pinInput = document.getElementById('change-pin-input');
    pinInput.value = '1234';
    verifyChangePin();

    await setPromise;

    assert.strictEqual(state.wake_up, '05:30 - 06:00', "Wake time changed after correct PIN entered");
  });

  // =========================================================================
  // TEST SUITE 3: School Attendance & Subjects Protection
  // =========================================================================
  console.log("\n=== TEST SUITE 3: School Attendance & Subjects Protection ===");

  await testAsync("Checking school attendance is allowed freely", async () => {
    setupDOM();
    state.school_attended = false;
    const sToggle = document.getElementById('school-toggle');
    sToggle.checked = true;

    await toggleSchool(true, sToggle);

    assert.strictEqual(state.school_attended, true, "School attended marked true");
  });

  await testAsync("Unchecking completed school attendance requires password and reverts on failure", async () => {
    setupDOM();
    state.school_attended = true;
    const sToggle = document.getElementById('school-toggle');
    sToggle.checked = false;

    const togglePromise = toggleSchool(false, sToggle);

    closePinModal(false); // Reject/cancel PIN
    await togglePromise;

    assert.strictEqual(state.school_attended, true, "School attended remains true");
    assert.strictEqual(sToggle.checked, true, "School toggle reverted to true");
  });

  await testAsync("Deselecting an already completed school subject asks for password", async () => {
    setupDOM();
    state.school_subjects = { 'ගණිතය': { homework: true, studied: true } };
    const btn = new MockElement('button');
    btn.innerText = 'ගණිතය';

    const togglePromise = toggleSubject('ගණිතය', btn);

    closePinModal(false);
    await togglePromise;

    assert.ok(state.school_subjects['ගණිතය'], "Subject remained in state");
  });

  await testAsync("Unchecking completed homework asks for password", async () => {
    setupDOM();
    state.school_subjects = { 'ගණිතය': { homework: true, studied: true } };
    const cb = new MockElement('input');
    cb.checked = false;

    const togglePromise = toggleSubjectDetail('ගණිතය', 'homework', false, cb);

    closePinModal(false);
    await togglePromise;

    assert.strictEqual(state.school_subjects['ගණිතය'].homework, true, "Homework remains true");
    assert.strictEqual(cb.checked, true, "Homework checkbox reverted to true");
  });

  // =========================================================================
  // TEST SUITE 4: UI Synchronization & Static File Structure
  // =========================================================================
  console.log("\n=== TEST SUITE 4: UI Synchronization & Static File Structure ===");

  test("syncStateToUI synchronizes all checkboxes and wake buttons from state", () => {
    setupDOM();
    state.wake_up = '05:30 - 06:00';
    state.school_attended = true;
    state.clean_room = true;
    state.water_plants = false;

    syncStateToUI();

    const b2 = docRoot.querySelector('[data-val="05:30 - 06:00"]');
    assert.ok(b2.classList.contains('bg-pink-500'), "Wake button for 05:30 is highlighted");

    const sToggle = document.getElementById('school-toggle');
    assert.strictEqual(sToggle.checked, true, "School toggle checked");

    const cleanRoomCb = docRoot.querySelector('[data-task-id="clean_room"] input[type="checkbox"]');
    assert.strictEqual(cleanRoomCb.checked, true, "Clean room checkbox checked");

    const waterPlantsCb = docRoot.querySelector('[data-task-id="water_plants"] input[type="checkbox"]');
    assert.strictEqual(waterPlantsCb.checked, false, "Water plants checkbox unchecked");
  });

  test("index.html contains #change-pin-modal, #change-pin-input, and modal controls", () => {
    const html = fs.readFileSync('index.html', 'utf8');
    assert.ok(html.includes('id="change-pin-modal"'), "Contains #change-pin-modal");
    assert.ok(html.includes('id="change-pin-input"'), "Contains #change-pin-input");
    assert.ok(html.includes('id="change-pin-confirm"'), "Contains #change-pin-confirm");
    assert.ok(html.includes('id="change-pin-cancel"'), "Contains #change-pin-cancel");
    assert.ok(html.includes('id="change-pin-error"'), "Contains #change-pin-error");
  });

  console.log("\n=================================================");
  console.log(`ALL TESTS PASSED! (${passed} checks succeeded)`);
  console.log("=================================================");
}

runTests();
