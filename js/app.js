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
  const adminPin = (typeof localStorage !== 'undefined' ? localStorage.getItem("wosandi_admin_pin") : null) || "1234";
  const userPin = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser) ? window.userManagerClient.getCurrentUser()?.pin : null;

  if (enteredPin === adminPin || (userPin && enteredPin === userPin)) {
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

// Restore same-day state immediately from local storage for instant zero-reload delay
const todayDateStr = new Date().toISOString().split('T')[0];
try {
  const cached = localStorage.getItem('wosandi_routine_state_' + todayDateStr);
  if (cached) {
    Object.assign(state, JSON.parse(cached));
  }
} catch (e) {}

// =========================================================================
// Routine Section Completion & Auto-Collapsing Controller
// =========================================================================
const manualExpandedSections = new Set();

function isSectionCompleted(sectionId, stateObj = state) {
  if (!stateObj) return false;
  const today = new Date().toISOString().split('T')[0];

  switch (sectionId) {
    case 'wake_up':
      return Boolean(stateObj.wake_up);
    case 'school':
      return Boolean(stateObj.school_attended);
    case 'flow':
      return Boolean(
        stateObj.flow_completed || 
        (typeof localStorage !== 'undefined' && localStorage.getItem('wosandi_flow_completed_' + today) === 'true') ||
        (Number(stateObj.flow_points) > 0 && window.flowPlayer?.currentNode?.type === 'end')
      );
    case 'study': {
      if (typeof document !== 'undefined') {
        const list = document.getElementById('study-tasks-list');
        if (list) {
          const taskRows = list.querySelectorAll('[data-task-id]');
          if (taskRows.length > 0) {
            let allDone = true;
            taskRows.forEach(row => {
              const tid = row.getAttribute('data-task-id');
              if (tid && !stateObj[tid]) allDone = false;
            });
            return allDone;
          }
        }
      }
      const adminStudyTasks = (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks))
        ? window.publishedAdminTasks.filter(t => (t.category || '').toLowerCase() === 'study')
        : [];
      const adminStudyDone = adminStudyTasks.every(t => Boolean(stateObj[t.id]));
      return Boolean(stateObj.maths_practice && stateObj.gemini_english && stateObj.vocab_words) && adminStudyDone;
    }
    case 'fitness': {
      if (typeof document !== 'undefined') {
        const list = document.getElementById('fitness-tasks-list');
        if (list) {
          const taskRows = list.querySelectorAll('[data-task-id]');
          if (taskRows.length > 0) {
            let allDone = true;
            taskRows.forEach(row => {
              const tid = row.getAttribute('data-task-id');
              if (tid && !stateObj[tid]) allDone = false;
            });
            return allDone;
          }
        }
      }
      const adminFitTasks = (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks))
        ? window.publishedAdminTasks.filter(t => (t.category || '').toLowerCase() === 'fitness')
        : [];
      const adminFitDone = adminFitTasks.every(t => Boolean(stateObj[t.id]));
      return Boolean(stateObj.dance_workout && stateObj.exercise_schedule) && adminFitDone;
    }
    case 'chores': {
      if (typeof document !== 'undefined') {
        const list = document.getElementById('chores-tasks-list');
        if (list) {
          const taskRows = list.querySelectorAll('[data-task-id]');
          if (taskRows.length > 0) {
            let allDone = true;
            taskRows.forEach(row => {
              const tid = row.getAttribute('data-task-id');
              if (tid && !stateObj[tid]) allDone = false;
            });
            return allDone;
          }
        }
      }
      const adminChoresTasks = (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks))
        ? window.publishedAdminTasks.filter(t => (t.category || '').toLowerCase() === 'chores')
        : [];
      const adminChoresDone = adminChoresTasks.every(t => Boolean(stateObj[t.id]));
      return Boolean(stateObj.clean_room && stateObj.water_plants && stateObj.sweep_floor && stateObj.dispose_garbage && stateObj.hair_care && stateObj.clean_wardrobe) && adminChoresDone;
    }
    default:
      return Boolean(stateObj[sectionId]);
  }
}

// 3. Tick box tasks sent to bottom of their list when completed
function reorderTasksInList(container) {
  if (!container) return;
  const taskRows = Array.from(container.children || []).filter(el => Boolean(el.querySelector && el.querySelector('input[type="checkbox"]')));
  if (taskRows.length === 0) return;

  const active = [];
  const completed = [];

  taskRows.forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const isDone = cb ? cb.checked : false;
    if (isDone) {
      row.classList.add('task-is-completed', 'opacity-75', 'bg-emerald-50/40', 'border-emerald-200');
      completed.push(row);
    } else {
      row.classList.remove('task-is-completed', 'opacity-75', 'bg-emerald-50/40', 'border-emerald-200');
      active.push(row);
    }
  });

  // Re-append: unchecked at top, checked at bottom!
  [...active, ...completed].forEach(row => container.appendChild(row));
}

function reorderAllTaskLists() {
  if (typeof document === 'undefined') return;
  ['study-tasks-list', 'fitness-tasks-list', 'chores-tasks-list'].forEach(id => {
    const el = document.getElementById(id);
    if (el) reorderTasksInList(el);
  });
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

  // Reorder tasks so ticked tasks go to the bottom of their list
  reorderAllTaskLists();

  // 6. Section Completion & Collapse State
  updateSectionCollapseStates(state);
}

// =========================================================================
// Dynamic Published Tasks from Admin Panel (wosandi_tasks)
// =========================================================================
async function loadPublishedTasksFromAdmin() {
  if (typeof document === 'undefined') return;

  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa' };

  let publishedTasks = [];
  try {
    const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks?status=eq.published&order=sort_order.asc", {
      headers: {
        apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
        Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
      }
    });
    if (res.ok) {
      publishedTasks = await res.json();
    }
  } catch (e) {
    console.warn("Could not fetch published tasks from Supabase, checking local cache", e);
  }

  if (!publishedTasks || publishedTasks.length === 0) {
    try {
      const cached = localStorage.getItem('wosandi_admin_wosandi_tasks');
      if (cached) {
        const list = JSON.parse(cached);
        publishedTasks = list.filter(t => t.status === 'published');
      }
    } catch(e) {}
  }

  // Remove previously injected dynamic tasks so profile switching or re-render is clean
  document.querySelectorAll('[data-is-dynamic-task="true"]').forEach(el => el.remove());

  if (!Array.isArray(publishedTasks) || publishedTasks.length === 0) return;
  window.publishedAdminTasks = publishedTasks;

  const targetLists = {
    academic: document.getElementById('study-tasks-list'),
    study: document.getElementById('study-tasks-list'),
    physical: document.getElementById('fitness-tasks-list'),
    fitness: document.getElementById('fitness-tasks-list'),
    chores: document.getElementById('chores-tasks-list'),
    habits: document.getElementById('chores-tasks-list'),
    general: document.getElementById('chores-tasks-list')
  };

  publishedTasks.forEach(task => {
    // PROFILE TARGETING (Requirement: Only display to targeted profile (default), or show for all if global)
    const targetProfile = task.schema_definition?.target_profile || task.target_profile;
    const isGlobal = !targetProfile || targetProfile === 'global' || targetProfile === 'all';
    const isTargetUser = Boolean(
      currentUser && (
        targetProfile === currentUser.id ||
        targetProfile === currentUser.username ||
        (currentUser.username === 'Wosa' && targetProfile === 'user_wosa') ||
        (currentUser.id === 'user_wosa' && targetProfile === 'Wosa')
      )
    );

    // If this item is assigned to one profile only and it doesn't match current user, do NOT display
    if (!isGlobal && !isTargetUser) {
      return;
    }

    const key = task.schema_definition?.linked_state_key || task.id;
    const existing = document.querySelector(`[data-task-id="${key}"]`) || document.querySelector(`[data-task-id="${task.id}"]`);
    if (existing) return;

    const cat = (task.category || 'general').toLowerCase();
    const container = targetLists[cat] || targetLists.general;
    if (!container) return;

    if (state[task.id] === undefined) {
      state[task.id] = false;
    }

    const row = document.createElement('label');
    row.setAttribute('data-task-id', task.id);
    row.setAttribute('data-is-dynamic-task', 'true');
    row.className = 'flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:bg-pink-50/50 cursor-pointer transition-all';
    const timerBtn = task.has_timer ? `
      <button type="button" onclick="startTimer(${task.timer_seconds || 600}, '${task.title_si || task.title_en || 'Timer'}')" class="text-[10px] text-pink-500 text-left font-bold underline mt-0.5">
        ⏱ විනාඩි ${Math.round((task.timer_seconds || 600) / 60)} Timer එක දමන්න
      </button>
    ` : '';

    const isChecked = Boolean(state[task.id]);
    const scopeBadge = isGlobal ? '' : `<span class="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 ml-1.5">🔒 Personal</span>`;

    row.innerHTML = `
      <div class="flex flex-col">
        <div class="flex items-center">
          <span class="text-xs font-semibold font-['Noto_Sans_Sinhala']">${task.icon || '📋'} ${task.title_si || task.title_en}</span>
          ${scopeBadge}
        </div>
        ${timerBtn}
      </div>
      <div class="flex items-center gap-2">
        <span class="text-[10px] font-bold text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded border border-pink-100">+${task.weight_points || 10}</span>
        <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleTask('${task.id}', this.checked, this)" class="w-5 h-5 accent-pink-500 rounded">
      </div>
    `;

    container.appendChild(row);
  });

  reorderAllTaskLists();
  syncStateToUI();
  if (typeof syncProgressWithServer === 'function') {
    syncProgressWithServer(state, true);
  }
}

// =========================================================================
// Quick Add Task from Dashboard (Default: Profile only; Option: Global)
// =========================================================================
async function openAddQuickTaskModal() {
  if (typeof document === 'undefined') return;

  // Requirement 1: Only relevant user can edit / add data
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission("නව කාර්යයක් එක් කිරීම");
    if (!permitted) return;
  }

  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa' };

  let modal = document.getElementById("quick-task-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quick-task-modal";
    document.body.appendChild(modal);
  }

  modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 sm:p-6 border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
      <div class="flex justify-between items-center mb-4 pb-3 border-b border-slate-100">
        <div class="flex items-center gap-2">
          <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">✨</span>
          <h3 class="text-sm font-bold text-slate-800">නව කාර්යයක් එක් කරන්න</h3>
        </div>
        <button type="button" id="close-quick-task-modal" class="text-slate-400 hover:text-slate-600 text-xl font-bold transition">&times;</button>
      </div>

      <form id="quick-task-form" class="space-y-3.5">
        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">කාර්යයේ නම (Task Title) *</label>
          <input type="text" id="qt-title" required placeholder="උදා: සවස පොතක් කියවීම"
            class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-purple-200 focus:outline-hidden font-['Noto_Sans_Sinhala']">
        </div>

        <div class="grid grid-cols-2 gap-2.5">
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">කොටස (Category)</label>
            <select id="qt-category" class="w-full p-2 border rounded-xl text-xs bg-white">
              <option value="study">📚 අධ්‍යාපනය (Study)</option>
              <option value="fitness">🏃 ව්‍යායාම (Fitness)</option>
              <option value="chores" selected>🏡 පුරුදු (Chores/Habits)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 mb-1">ලකුණු (Points)</label>
            <input type="number" id="qt-points" value="10" min="1" max="100"
              class="w-full p-2 border rounded-xl text-xs font-bold text-slate-800">
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 mb-1">Timer එකක් අවශ්‍යද? (විකල්ප)</label>
          <select id="qt-timer" class="w-full p-2 border rounded-xl text-xs bg-white">
            <option value="0">Timer නැත</option>
            <option value="300">⏱ විනාඩි 5 (5 min)</option>
            <option value="600">⏱ විනාඩි 10 (10 min)</option>
            <option value="900">⏱ විනාඩි 15 (15 min)</option>
            <option value="1200">⏱ විනාඩි 20 (20 min)</option>
            <option value="1800">⏱ විනාඩි 30 (30 min)</option>
          </select>
        </div>

        <!-- Scope: Default to profile only, or Global -->
        <div class="p-3 bg-purple-50 rounded-2xl border border-purple-200 space-y-2">
          <label class="block text-[11px] font-bold text-purple-900">පැවරුම / දිස්වන ආකාරය (Scope):</label>
          <div class="space-y-1.5 text-xs">
            <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input type="radio" name="qt-scope" value="profile" checked class="accent-purple-600">
              <span>🔒 <strong>${currentUser.display_name || currentUser.username}</strong> ට පමණි (Default)</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
              <input type="radio" name="qt-scope" value="global" class="accent-purple-600">
              <span>🌐 සියලු දෙනාටම පෙන්වන්න (Global)</span>
            </label>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-2 pt-2">
          <button type="button" id="cancel-quick-task" class="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-xl transition cursor-pointer">
            අවලංගු කරන්න
          </button>
          <button type="submit" class="py-2 px-3 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-700 hover:to-pink-600 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1 cursor-pointer">
            <i class="fa-solid fa-check"></i> සුරකින්න
          </button>
        </div>
      </form>
    </div>
  `;

  const closeModal = () => modal.remove();
  modal.querySelector("#close-quick-task-modal").addEventListener("click", closeModal);
  modal.querySelector("#cancel-quick-task").addEventListener("click", closeModal);

  modal.querySelector("#quick-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = modal.querySelector("#qt-title").value.trim();
    if (!title) return;

    const category = modal.querySelector("#qt-category").value;
    const points = parseFloat(modal.querySelector("#qt-points").value) || 10;
    const timerSec = parseInt(modal.querySelector("#qt-timer").value) || 0;
    const isGlobal = modal.querySelector('input[name="qt-scope"]:checked')?.value === 'global';

    const targetProfile = isGlobal ? 'global' : currentUser.id;
    const newTaskId = 'task_' + Date.now();

    const taskObj = {
      id: newTaskId,
      title_si: title,
      title_en: title,
      category: category,
      tier: 'routine_baseline',
      weight_points: points,
      icon: category === 'study' ? '📖' : category === 'fitness' ? '🏃' : '✨',
      sort_order: 100,
      status: 'published',
      has_timer: timerSec > 0,
      timer_seconds: timerSec > 0 ? timerSec : null,
      target_profile: targetProfile,
      schema_definition: {
        target_profile: targetProfile,
        created_by_user: currentUser.id
      }
    };

    // Update local cache immediately
    try {
      let cached = [];
      const raw = localStorage.getItem('wosandi_admin_wosandi_tasks');
      if (raw) cached = JSON.parse(raw);
      if (!Array.isArray(cached)) cached = [];
      cached.push(taskObj);
      localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));
    } catch (err) {}

    // Background Supabase push
    try {
      const payload = { ...taskObj };
      delete payload.target_profile; // PostgREST safe
      fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks", {
        method: "POST",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(payload)
      }).catch(e => console.warn("Supabase background save warning", e));
    } catch (e) {}

    closeModal();
    await loadPublishedTasksFromAdmin();
  });
}
if (typeof window !== "undefined") {
  window.openAddQuickTaskModal = openAddQuickTaskModal;
}

// =========================================================================
// Event Listeners & Interaction Handlers
// =========================================================================
document.addEventListener("DOMContentLoaded", async () => {
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

  // Load published tasks from Admin panel
  await loadPublishedTasksFromAdmin();

  // Initialize Multi-User Management (Default: Wosa)
  if (typeof window !== "undefined" && window.userManagerClient) {
    await window.userManagerClient.init();
    window.userManagerClient.updateUserHeaderPill();
  }
});

// Multi-User Switch Handler (Requirement 3: Separate dashboard for each user)
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("wosandi-user-changed", async (e) => {
    const newUser = e.detail;
    // Reset state to empty base
    const defaultState = {
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
    Object.keys(state).forEach(k => delete state[k]);
    Object.assign(state, defaultState);

    // Load today's data for this user
    if (typeof loadTodayData === "function") {
      await loadTodayData();
    }
    if (typeof syncStateToUI === "function") {
      syncStateToUI();
    }
    if (typeof syncProgressWithServer === "function") {
      syncProgressWithServer(state, true);
    }
    // Reload profile-specific & global published tasks for this user
    if (typeof loadPublishedTasksFromAdmin === "function") {
      await loadPublishedTasksFromAdmin();
    }
    if (typeof window.routineOrdering?.applyRoutineOrderAndDependencies === "function") {
      window.routineOrdering.applyRoutineOrderAndDependencies(state);
    }
    if (typeof reorderAllTaskLists === "function") {
      reorderAllTaskLists();
    }
  });
}

// School Toggle Handler with Password Verification
async function toggleSchool(val, el = null) {
  // Requirement 1: Only relevant user can edit data (Public can only view progress)
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission("පාසල් පැමිණීම වෙනස් කිරීම");
    if (!permitted) {
      const toggle = el || document.getElementById("school-toggle");
      if (toggle) toggle.checked = !val;
      return;
    }
  }

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
  // Requirement 1: Only relevant user can edit data
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission(`"${sub}" විෂය වෙනස් කිරීම`);
    if (!permitted) return;
  }

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
  // Requirement 1: Only relevant user can edit data
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission(`"${sub}" විස්තර වෙනස් කිරීම`);
    if (!permitted) {
      if (el) el.checked = !val;
      return;
    }
  }

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
  // Requirement 1: Only relevant user can edit data
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission("අවදි වූ වේලාව සැකසීම");
    if (!permitted) return;
  }

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
  const taskRow = el?.closest('[data-task-id]') || document.querySelector(`[data-task-id="${key}"]`);
  const taskLabel = taskRow?.querySelector('span')?.textContent?.trim() || key;

  // Requirement 1: Only relevant user can edit data (Public can only view progress)
  if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
    const permitted = await window.userManagerClient.requireEditPermission(`"${taskLabel}" සලකුණු කිරීම`);
    if (!permitted) {
      const targetInput = el || taskRow?.querySelector('input[type="checkbox"]');
      if (targetInput) targetInput.checked = !val;
      return;
    }
  }

  // If task is ALREADY completed (true) and user tries to uncheck it (false):
  if (state[key] === true && val === false) {
    const ok = await requestPasswordConfirmation(`"${taskLabel}" කාර්යය ඉවත් කිරීම`);
    if (!ok) {
      // Revert checkbox state in UI
      const targetInput = el || taskRow?.querySelector('input[type="checkbox"]');
      if (targetInput) targetInput.checked = true;
      return;
    }
  }

  state[key] = val;
  reorderAllTaskLists();
  updateSectionCollapseStates(state);
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
  window.reorderTasksInList = reorderTasksInList;
  window.reorderAllTaskLists = reorderAllTaskLists;
  window.loadPublishedTasksFromAdmin = loadPublishedTasksFromAdmin;
}
