const subjects = [
  "සිංහල", "ගණිතය", "බුද්ධාගම", "විද්‍යාව", "නැටුම්", 
  "භූගෝල විද්‍යාව", "English", "දෙමළ", "සෞඛ්‍යය", "ICT", "PTS", "ඉතිහාසය"
];

let state = {
  wake_up: null,
  school_attended: false,
  school_subjects: {},
  maths_practice: false,
  gemini_english: false,
  vocab_words: false,
  dance_workout: false,
  exercise_schedule: false,
  clean_room: false,
  water_plants: false,
  sweep_floor: false,
  dispose_garbage: false,
  hair_care: false,
  clean_wardrobe: false
};
if (typeof window !== "undefined") window.state = state;

// =========================================================================
// Completion Protection: PIN Verification Controller
// =========================================================================
let pendingPinResolve = null;

function requestPasswordConfirmation(actionLabel = "මෙම කාර්යය වෙනස් කිරීම") {
  return new Promise((resolve) => {
    const modal = document.getElementById("change-pin-modal");
    const input = document.getElementById("change-pin-input");
    const desc = document.getElementById("change-pin-description");
    const errorEl = document.getElementById("change-pin-error");

    if (!modal || !input) {
      // Fallback for non-browser/headless environments or before modal DOM mounts
      if (typeof window !== 'undefined' && typeof window.prompt === 'function') {
        const answer = window.prompt(`${actionLabel} සඳහා කරුණාකර Admin PIN ඇතුළත් කරන්න:`);
        const validPin = (typeof localStorage !== 'undefined' ? localStorage.getItem("wosandi_admin_pin") : null) || "1234";
        resolve(answer === validPin);
      } else {
        resolve(false);
      }
      return;
    }

    pendingPinResolve = resolve;

    if (desc) {
      desc.innerText = `${actionLabel} සඳහා කරුණාකර Admin PIN ඇතුළත් කරන්න:`;
    }
    if (errorEl) errorEl.classList.add("hidden");
    input.value = "";

    modal.classList.remove("hidden");
    modal.classList.add("flex");
    setTimeout(() => {
      try { input.focus(); } catch (e) {}
    }, 60);
  });
}

function closePinModal(result = false) {
  const modal = document.getElementById("change-pin-modal");
  if (modal) {
    modal.classList.add("hidden");
    modal.classList.remove("flex");
  }
  if (pendingPinResolve) {
    const resolve = pendingPinResolve;
    pendingPinResolve = null;
    resolve(result);
  }
}

function verifyChangePin() {
  const input = document.getElementById("change-pin-input");
  const errorEl = document.getElementById("change-pin-error");
  const enteredPin = input ? input.value.trim() : "";
  const validPin = (typeof localStorage !== 'undefined' ? localStorage.getItem("wosandi_admin_pin") : null) || "1234";

  if (enteredPin === validPin) {
    closePinModal(true);
  } else {
    if (errorEl) {
      errorEl.classList.remove("hidden");
      errorEl.innerText = "මුරපදය වැරදියි! කරුණාකර නැවත උත්සාහ කරන්න.";
    }
    if (input) {
      input.value = "";
      try { input.focus(); } catch (e) {}
    }
  }
}

// =========================================================================
// Routine Section Completion & Auto-Collapsing Controller
// =========================================================================
const manualExpandedSections = new Set();

function isSectionCompleted(sectionId, stateObj = state) {
  if (!stateObj) return false;
  switch (sectionId) {
    case 'wake_up':
      return Boolean(stateObj.wake_up);
    case 'school':
      return Boolean(stateObj.school_attended);
    case 'study':
      return Boolean(stateObj.maths_practice && stateObj.gemini_english && stateObj.vocab_words);
    case 'fitness':
      return Boolean(stateObj.dance_workout && stateObj.exercise_schedule);
    case 'chores':
      return Boolean(stateObj.clean_room && stateObj.water_plants && stateObj.sweep_floor && stateObj.dispose_garbage && stateObj.hair_care && stateObj.clean_wardrobe);
    case 'flow':
      return Boolean(stateObj.flow_completed || (Number(stateObj.flow_points) > 0 && window.flowPlayer?.currentNode?.type === 'end'));
    default:
      return false;
  }
}

function updateSectionCollapseStates(stateObj = state) {
  if (!stateObj || typeof document === 'undefined') return;

  const sections = document.querySelectorAll('.routine-section');
  sections.forEach(sec => {
    const secId = sec.getAttribute('data-section-id');
    if (!secId) return;

    const completed = isSectionCompleted(secId, stateObj);
    const badge = sec.querySelector('.completion-badge');

    if (completed) {
      sec.classList.add('is-completed');
      if (badge) badge.classList.remove('hidden');

      if (!manualExpandedSections.has(secId)) {
        sec.classList.add('is-collapsed');
      } else {
        sec.classList.remove('is-collapsed');
      }
    } else {
      sec.classList.remove('is-completed');
      if (badge) badge.classList.add('hidden');
      sec.classList.remove('is-collapsed');
      manualExpandedSections.delete(secId);
    }
  });
}

function toggleSectionCollapse(sectionId) {
  const sec = document.querySelector(`.routine-section[data-section-id="${sectionId}"]`);
  if (!sec) return;

  const currentlyCollapsed = sec.classList.contains('is-collapsed');
  if (currentlyCollapsed) {
    sec.classList.remove('is-collapsed');
    manualExpandedSections.add(sectionId);
  } else {
    sec.classList.add('is-collapsed');
    manualExpandedSections.delete(sectionId);
  }
}

// =========================================================================
// UI Synchronization from Current State
// =========================================================================
function syncStateToUI() {
  if (!state) return;

  // 1. Wake buttons
  document.querySelectorAll(".wake-btn").forEach(b => {
    const isSelected = b.dataset.val === state.wake_up;
    b.classList.toggle("bg-pink-500", isSelected);
    b.classList.toggle("text-white", isSelected);
    b.classList.toggle("border-pink-500", isSelected);
  });

  // 2. School attendance toggle
  const schoolToggle = document.getElementById("school-toggle");
  if (schoolToggle) {
    schoolToggle.checked = Boolean(state.school_attended);
  }
  const subjContainer = document.getElementById("subjects-container");
  if (subjContainer) {
    subjContainer.classList.toggle("hidden", !state.school_attended);
  }

  // 3. School subjects buttons
  const subGrid = document.getElementById("subjects-grid");
  if (subGrid && state.school_subjects) {
    subGrid.querySelectorAll("button").forEach(btn => {
      const sub = btn.innerText.trim();
      const isSelected = Boolean(state.school_subjects[sub]);
      btn.classList.toggle("bg-pink-500", isSelected);
      btn.classList.toggle("text-white", isSelected);
      btn.classList.toggle("border-pink-500", isSelected);
    });
  }

  // 4. Render homework details
  renderHomework();

  // 5. Individual task checkboxes
  Object.keys(state).forEach(key => {
    if (typeof state[key] === "boolean") {
      const taskEl = document.querySelector(`[data-task-id="${key}"] input[type="checkbox"]`);
      if (taskEl) {
        taskEl.checked = Boolean(state[key]);
      }
    }
  });

  // 6. Section Completion & Collapse State
  updateSectionCollapseStates(state);
}

// =========================================================================
// Event Listeners & Interaction Handlers
// =========================================================================
document.addEventListener("DOMContentLoaded", () => {
  // Render Subjects Buttons
  const subGrid = document.getElementById("subjects-grid");
  if (subGrid) {
    subGrid.innerHTML = "";
    subjects.forEach(sub => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "text-xs p-2 rounded-xl border border-slate-200 text-slate-600 transition text-center hover:border-pink-300";
      btn.innerText = sub;
      btn.onclick = () => toggleSubject(sub, btn);
      subGrid.appendChild(btn);
    });
  }

  // Change PIN Modal Event Listeners
  const closeBtn = document.getElementById("change-pin-close");
  const cancelBtn = document.getElementById("change-pin-cancel");
  const confirmBtn = document.getElementById("change-pin-confirm");
  const pinInput = document.getElementById("change-pin-input");

  if (closeBtn) closeBtn.onclick = () => closePinModal(false);
  if (cancelBtn) cancelBtn.onclick = () => closePinModal(false);
  if (confirmBtn) confirmBtn.onclick = () => verifyChangePin();
  if (pinInput) {
    pinInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") verifyChangePin();
      if (e.key === "Escape") closePinModal(false);
    });
  }

  // Routine Section Header & Toggle Click Listeners
  document.querySelectorAll('.routine-section').forEach(sec => {
    const secId = sec.getAttribute('data-section-id');
    const header = sec.querySelector('.section-header');
    if (header && secId) {
      header.addEventListener('click', (e) => {
        if (e.target.closest('button.collapse-toggle-btn') || !e.target.closest('button, input, label, a')) {
          toggleSectionCollapse(secId);
        }
      });
    }
    const btn = sec.querySelector('.collapse-toggle-btn');
    if (btn && secId) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSectionCollapse(secId);
      });
    }
  });

  // Sync loaded state to UI elements
  syncStateToUI();
});

// School Toggle Handler with Password Verification
async function toggleSchool(val, el = null) {
  // If school was ALREADY completed (true) and user tries to turn off (false):
  if (state.school_attended === true && val === false) {
    const ok = await requestPasswordConfirmation("පාසල් පැමිණීම ඉවත් කිරීම");
    if (!ok) {
      const toggle = el || document.getElementById("school-toggle");
      if (toggle) toggle.checked = true;
      return;
    }
  }

  state.school_attended = val;
  const container = document.getElementById("subjects-container");
  if (container) container.classList.toggle("hidden", !val);
  syncProgressWithServer(state);
}

// School Subject Button Toggle with Password Verification
async function toggleSubject(sub, btn) {
  if (state.school_subjects && state.school_subjects[sub]) {
    // Subject is already selected/completed. Trying to uncheck it:
    const ok = await requestPasswordConfirmation(`"${sub}" විෂය ඉවත් කිරීම`);
    if (!ok) return;
    delete state.school_subjects[sub];
    btn.classList.remove("bg-pink-500", "text-white", "border-pink-500");
  } else {
    if (!state.school_subjects) state.school_subjects = {};
    state.school_subjects[sub] = { homework: false, studied: false };
    btn.classList.add("bg-pink-500", "text-white", "border-pink-500");
  }
  renderHomework();
  syncProgressWithServer(state);
}

// Homework / Studied Checkbox Toggle with Password Verification
async function toggleSubjectDetail(sub, type, val, el = null) {
  const currentVal = Boolean(state.school_subjects?.[sub]?.[type]);
  if (currentVal === true && val === false) {
    const label = type === 'homework' ? 'Homework' : 'පාඩම් කිරීම';
    const ok = await requestPasswordConfirmation(`"${sub} - ${label}" ඉවත් කිරීම`);
    if (!ok) {
      if (el) el.checked = true;
      return;
    }
  }
  if (!state.school_subjects) state.school_subjects = {};
  if (!state.school_subjects[sub]) state.school_subjects[sub] = {};
  state.school_subjects[sub][type] = val;
  syncProgressWithServer(state);
}

function renderHomework() {
  const container = document.getElementById("homework-details");
  if (!container) return;
  container.innerHTML = "";
  if (!state.school_subjects) return;

  Object.keys(state.school_subjects).forEach(sub => {
    const div = document.createElement("div");
    div.className = "p-2 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100";
    const hwChecked = Boolean(state.school_subjects[sub]?.homework);
    const stChecked = Boolean(state.school_subjects[sub]?.studied);

    div.innerHTML = `
      <div class="font-bold text-slate-700">${sub}</div>
      <div class="flex gap-4">
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" ${hwChecked ? 'checked' : ''} onchange="toggleSubjectDetail('${sub}', 'homework', this.checked, this)"> Homework කළාද?
        </label>
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" ${stChecked ? 'checked' : ''} onchange="toggleSubjectDetail('${sub}', 'studied', this.checked, this)"> පාඩම් කළාද?
        </label>
      </div>
    `;
    container.appendChild(div);
  });
}

// Wake Time Selection with Password Verification
async function setWakeTime(slot) {
  // If wake-up time was ALREADY set and user tries to switch to a different slot:
  if (state.wake_up && state.wake_up !== slot) {
    const ok = await requestPasswordConfirmation(`අවදි වූ වේලාව (${state.wake_up} ➔ ${slot}) වෙනස් කිරීම`);
    if (!ok) return;
  }

  state.wake_up = slot;
  document.querySelectorAll(".wake-btn").forEach(b => {
    const isSelected = b.dataset.val === slot;
    b.classList.toggle("bg-pink-500", isSelected);
    b.classList.toggle("text-white", isSelected);
    b.classList.toggle("border-pink-500", isSelected);
  });
  syncProgressWithServer(state);
}

// Task Checkbox Toggle with Password Verification
async function toggleTask(key, val, el = null) {
  // If task is ALREADY completed (true) and user tries to uncheck it (false):
  if (state[key] === true && val === false) {
    const taskRow = el?.closest('[data-task-id]') || document.querySelector(`[data-task-id="${key}"]`);
    const taskLabel = taskRow?.querySelector('span')?.textContent?.trim() || key;
    const ok = await requestPasswordConfirmation(`"${taskLabel}" කාර්යය ඉවත් කිරීම`);
    if (!ok) {
      // Revert checkbox state in UI
      const targetInput = el || taskRow?.querySelector('input[type="checkbox"]');
      if (targetInput) targetInput.checked = true;
      return;
    }
  }

  state[key] = val;
  syncProgressWithServer(state);
}

// =========================================================================
// Admin Panel Dialog
// =========================================================================
function openAdminModal() {
  document.getElementById("admin-modal").classList.remove("hidden");
  document.getElementById("admin-modal").classList.add("flex");
}

function closeAdminModal() {
  document.getElementById("admin-modal").classList.add("hidden");
  document.getElementById("admin-modal").classList.remove("flex");
  document.getElementById("admin-pin-screen").classList.remove("hidden");
  document.getElementById("admin-content").classList.add("hidden");
  document.getElementById("admin-pin").value = "";
}

function checkAdminPin() {
  const enteredPin = document.getElementById("admin-pin").value;
  const validPin = (typeof localStorage !== 'undefined' ? localStorage.getItem("wosandi_admin_pin") : null) || "1234";

  if (enteredPin === validPin) {
    document.getElementById("admin-pin-screen").classList.add("hidden");
    document.getElementById("admin-content").classList.remove("hidden");
  } else {
    alert("මුරපදය වැරදියි!");
  }
}

// Admin Panel Actions
async function adminResetToday() {
  if (!confirm("අද දින සියලුම කාර්යයන් සහ ලකුණු Reset කිරීමට අවශ්‍ය බව තහවුරු කරන්නද?")) return;
  
  try {
    state.wake_up = null;
    state.school_attended = false;
    state.school_subjects = {};
    Object.keys(state).forEach(key => {
      if (typeof state[key] === "boolean") state[key] = false;
    });

    document.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);

    document.querySelectorAll(".wake-btn").forEach(b => {
      b.classList.remove("bg-pink-500", "text-white", "border-pink-500");
    });

    const subjectsContainer = document.getElementById("subjects-container");
    if (subjectsContainer) subjectsContainer.classList.add("hidden");

    const homeworkDetails = document.getElementById("homework-details");
    if (homeworkDetails) homeworkDetails.innerHTML = "";

    const subjectsGrid = document.getElementById("subjects-grid");
    if (subjectsGrid) {
      subjectsGrid.querySelectorAll("button").forEach(btn => {
        btn.classList.remove("bg-pink-500", "text-white", "border-pink-500");
      });
    }

    if (typeof syncProgressWithServer === "function") {
      await syncProgressWithServer(state);
    }

    alert("අද දින දත්ත සාර්ථකව Reset කරන ලදී!");
    closeAdminModal();
  } catch (err) {
    console.error("Reset error:", err);
    alert("Reset කිරීමේදී දෝෂයක් ඇති විය: " + err.message);
  }
}

async function adminReloadData() {
  try {
    if (typeof loadTodayData === "function") {
      await loadTodayData();
    }
    alert("දත්ත සාර්ථකව නැවත Sync විය!");
    closeAdminModal();
  } catch (err) {
    console.error("Sync error:", err);
    alert("දත්ත Sync කිරීමේදී දෝෂයක් ඇති විය: " + err.message);
  }
}

// Expose functions globally for HTML event attributes and tests
if (typeof window !== "undefined") {
  window.requestPasswordConfirmation = requestPasswordConfirmation;
  window.verifyChangePin = verifyChangePin;
  window.closePinModal = closePinModal;
  window.syncStateToUI = syncStateToUI;
  window.toggleSchool = toggleSchool;
  window.toggleSubject = toggleSubject;
  window.toggleSubjectDetail = toggleSubjectDetail;
  window.setWakeTime = setWakeTime;
  window.toggleTask = toggleTask;
  window.openAdminModal = openAdminModal;
  window.closeAdminModal = closeAdminModal;
  window.checkAdminPin = checkAdminPin;
  window.adminResetToday = adminResetToday;
  window.adminReloadData = adminReloadData;
  window.isSectionCompleted = isSectionCompleted;
  window.updateSectionCollapseStates = updateSectionCollapseStates;
  window.toggleSectionCollapse = toggleSectionCollapse;
}
