const subjects = [
  "සිංහල", "ගණිතය", "බුද්ධාගම", "විද්‍යාව", "නැටුම්", 
  "භූගෝල විද්‍යාව", "English", "දෙමළ", "සෞඛ්‍යය", "ICT", "PTS", "ඉතිහාසය"
];

let state = {
  wake_up: null,
  school_attended: false,
  school_subjects: {},
  flow_completed: false,
  flow_points: 0
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
        ? window.publishedAdminTasks.filter(t => (t.category || '').toLowerCase() === 'study' || (t.category || '').toLowerCase() === 'academic')
        : [];
      if (adminStudyTasks.length > 0) {
        return adminStudyTasks.every(t => Boolean(stateObj[t.id] || (t.schema_definition?.linked_state_key && stateObj[t.schema_definition.linked_state_key])));
      }
      return false;
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
        ? window.publishedAdminTasks.filter(t => (t.category || '').toLowerCase() === 'fitness' || (t.category || '').toLowerCase() === 'physical')
        : [];
      if (adminFitTasks.length > 0) {
        return adminFitTasks.every(t => Boolean(stateObj[t.id] || (t.schema_definition?.linked_state_key && stateObj[t.schema_definition.linked_state_key])));
      }
      return false;
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
        ? window.publishedAdminTasks.filter(t => ['chores', 'habits', 'general'].includes((t.category || '').toLowerCase()))
        : [];
      if (adminChoresTasks.length > 0) {
        return adminChoresTasks.every(t => Boolean(stateObj[t.id] || (t.schema_definition?.linked_state_key && stateObj[t.schema_definition.linked_state_key])));
      }
      return false;
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

  window.publishedAdminTasks = [];

  const targetLists = {
    academic: document.getElementById('study-tasks-list'),
    study: document.getElementById('study-tasks-list'),
    physical: document.getElementById('fitness-tasks-list'),
    fitness: document.getElementById('fitness-tasks-list'),
    chores: document.getElementById('chores-tasks-list'),
    habits: document.getElementById('chores-tasks-list'),
    general: document.getElementById('chores-tasks-list')
  };

  // Clear task containers so only tasks from admin panel populate them
  if (targetLists.study) targetLists.study.innerHTML = '';
  if (targetLists.fitness) targetLists.fitness.innerHTML = '';
  if (targetLists.chores) targetLists.chores.innerHTML = '';

  const matchedTasks = [];

  if (Array.isArray(publishedTasks) && publishedTasks.length > 0) {
    publishedTasks.forEach(task => {
      // PROFILE TARGETING (Requirement: Only display to targeted profile (default), or show for all if global)
      const targetProfile = task.schema_definition?.target_profile || task.target_profile;
      const isGlobal = !targetProfile || targetProfile === 'global' || targetProfile === 'all';
      const isTargetUser = Boolean(
        currentUser && (
          targetProfile === currentUser.id ||
          targetProfile === currentUser.username ||
          ((currentUser.username === 'Wosa' || currentUser.username === 'Wosandi') && (targetProfile === 'user_wosa' || targetProfile === 'Wosa' || targetProfile === 'Wosandi')) ||
          (currentUser.id === 'user_wosa' && (targetProfile === 'Wosa' || targetProfile === 'Wosandi'))
        )
      );

      // If this item is assigned to one profile only and it doesn't match current user, do NOT display
      if (!isGlobal && !isTargetUser) {
        return;
      }

      matchedTasks.push(task);

      const cat = (task.category || 'general').toLowerCase();
      const container = targetLists[cat] || targetLists.general;
      if (!container) return;

      const key = task.schema_definition?.linked_state_key || task.id;
      if (state[task.id] === undefined) {
        state[task.id] = key && state[key] !== undefined ? Boolean(state[key]) : false;
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

      const isChecked = Boolean(state[task.id] || (key && state[key]));
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
  }

  // Set publishedAdminTasks to strictly the tasks matched for this user
  window.publishedAdminTasks = matchedTasks;

  // Placeholder indicators for empty sections
  const showEmptyNotice = (container, label) => {
    if (container && container.children.length === 0) {
      container.innerHTML = `<div class="p-3 text-center text-xs text-slate-400 italic font-['Noto_Sans_Sinhala']">${label}</div>`;
    }
  };
  showEmptyNotice(targetLists.study, "අධ්‍යාපනික කාර්යයන් සකසා නැත");
  showEmptyNotice(targetLists.fitness, "ශාරීරික කාර්යයන් සකසා නැත");
  showEmptyNotice(targetLists.chores, "දෛනික පුරුදු සකසා නැත");

  reorderAllTaskLists();
  syncStateToUI();
  if (typeof syncProgressWithServer === 'function') {
    syncProgressWithServer(state, true);
  }
}

// =========================================================================
// Quick Add Task from Dashboard (Similar/Same as Admin Panel > Task > New Task)
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

  let users = [];
  if (typeof window !== 'undefined' && window.userManagerClient?.users?.length > 0) {
    users = window.userManagerClient.users;
  } else {
    try {
      const cached = localStorage.getItem('wosandi_users_config');
      if (cached) users = JSON.parse(cached);
    } catch (e) {}
  }
  if (!Array.isArray(users) || users.length === 0) {
    users = [currentUser];
  }

  let modal = document.getElementById("quick-task-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "quick-task-modal";
    document.body.appendChild(modal);
  }

  modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']";
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <div class="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-2xs">
            <i class="fas fa-tasks text-indigo-600"></i>
          </span>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-gray-800">නව කාර්යයක් එක් කරන්න (Add New Task)</h3>
            <span class="text-[10px] text-gray-500">පරිපාලක පුවරුවට (Admin Panel) සහ ඩෑෂ්බෝඩ් එකට සෘජුවම එකතු වේ</span>
          </div>
        </div>
        <button type="button" id="close-quick-task-modal" class="text-gray-400 hover:text-gray-600 text-xl font-bold transition p-1">&times;</button>
      </div>

      <div class="p-5 sm:p-6 overflow-y-auto flex-1 space-y-4">
        <form id="quick-task-form" class="space-y-4">
          <!-- Titles -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">මාතෘකාව (සිංහලෙන්) *</label>
              <input type="text" id="qt-title-si" required placeholder="උදා: ගණිතය ප්‍රශ්න 5ක් විසඳීම" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala']">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">මාතෘකාව (English)</label>
              <input type="text" id="qt-title-en" placeholder="e.g. Solve 5 Math Problems" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200">
            </div>
          </div>

          <!-- Target Profile / Scope -->
          <div class="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
            <div class="flex items-center justify-between">
              <label class="block text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                <i class="fas fa-user-tag text-indigo-600"></i> අදාළ පැතිකඩ / පරිශීලකයා (Target Profile / Scope) *
              </label>
              <span class="text-[11px] text-indigo-600 font-bold bg-white px-2 py-0.5 rounded-full border border-indigo-200">
                පෙරනිමි: ඔබගේ පැතිකඩට පමණි
              </span>
            </div>
            <select id="qt-target-profile" class="w-full p-2.5 border border-indigo-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-indigo-200">
              <optgroup label="පැතිකඩ අනුව (Individual Profile - Default)">
                ${users.map(u => `
                  <option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>
                    ${u.avatar || '👤'} ${u.display_name || u.username} (මෙම පැතිකඩට පමණි)
                  </option>
                `).join('')}
              </optgroup>
              <optgroup label="පොදු / සියලු දෙනාට (Global)">
                <option value="global">🌐 සියලු දෙනාටම පෙන්වන්න (Global - All Profiles)</option>
              </optgroup>
            </select>
          </div>

          <!-- Subject, Category & Tier -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">විෂය (Subject)</label>
              <select id="qt-subject" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="maths">ගණිතය (Mathematics)</option>
                <option value="science">විද්‍යාව (Science)</option>
                <option value="sinhala">සිංහල (Sinhala)</option>
                <option value="english">ඉංග්‍රීසි (English)</option>
                <option value="history">ඉතිහාසය (History)</option>
                <option value="religion">බුද්ධාගම / ආගම (Religion)</option>
                <option value="commerce">වාණිජ්‍ය (Commerce)</option>
                <option value="ict">තොරතුරු තාක්ෂණය (ICT)</option>
                <option value="eastern_music">නැටුම් / සංගීතය</option>
                <option value="art">චිත්‍ර කලාව</option>
                <option value="civics">පුරවැසි අධ්‍යාපනය</option>
                <option value="tamil">දෙමළ (Tamil)</option>
                <option value="general" selected>සාමාන්‍ය පුරුදු (General)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">වර්ගය (Category)</label>
              <select id="qt-category" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="academic">අධ්‍යාපනික (Academic)</option>
                <option value="physical">ශාරීරික / නැටුම් (Physical)</option>
                <option value="chores" selected>ගෙදර දොර (Chores)</option>
                <option value="habits">පුරුදු (Habits)</option>
                <option value="creative">නිර්මාණශීලී (Creative)</option>
                <option value="general">සාමාන්‍ය (General)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">ප්‍රමුඛතා මට්ටම (Tier)</label>
              <select id="qt-tier" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                <option value="core_academic">ප්‍රධාන අධ්‍යාපනික (Core: 25-30 Pts)</option>
                <option value="applied_basket">අමතර විෂයයන් (Basket: 12-20 Pts)</option>
                <option value="routine_baseline" selected>දෛනික පුරුදු (Baseline: 5-10 Pts)</option>
              </select>
            </div>
          </div>

          <!-- Weight Points, Icon, Sort Order, Status -->
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">ලබාදෙන ලකුණු (Points)</label>
              <input type="number" id="qt-points" step="0.5" value="10" min="1" max="100" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-bold">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">සංකේතය (Icon)</label>
              <input type="text" id="qt-icon" value="📋" class="w-full p-2.5 border rounded-xl text-xs text-center text-lg focus:ring-2 focus:ring-indigo-200">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">පිළිවෙල අංකය (Order)</label>
              <input type="number" id="qt-sort-order" value="0" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200">
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">තත්ත්වය (Status)</label>
              <select id="qt-status" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white font-semibold">
                <option value="published" selected>ප්‍රකාශිතයි (Published)</option>
                <option value="draft">කටු කෙටුම්පත් (Draft)</option>
              </select>
            </div>
          </div>

          <!-- Schedule Settings -->
          <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <i class="far fa-calendar-check text-indigo-600"></i> කාලසටහන සහ පුනරාවර්තනය (Schedule)
            </h4>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-gray-600 mb-1">වාර ගණන (Frequency)</label>
                <select id="qt-frequency" class="w-full p-2 border rounded-lg text-xs bg-white">
                  <option value="daily" selected>දිනපතා (Daily)</option>
                  <option value="school_days">පාසල් දිනවල පමණක් (Mon - Fri)</option>
                  <option value="weekends">සතිඅන්තයේ පමණක් (Sat - Sun)</option>
                  <option value="custom">වෙනත් දිනයන් (Custom)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-gray-600 mb-1">සුදුසු වේලාව (Preferred Time)</label>
                <select id="qt-time" class="w-full p-2 border rounded-lg text-xs bg-white">
                  <option value="morning">උදෑසන (05:00 - 08:00)</option>
                  <option value="afternoon">දහවල් (12:00 - 16:00)</option>
                  <option value="evening">සවස / රාත්‍රිය (16:00 - 21:00)</option>
                  <option value="anytime" selected>ඕනෑම වේලාවක (Flexible)</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">විස්තරය සහ උපදෙස් (Description & Notes)</label>
            <textarea id="qt-description" rows="2" placeholder="අවශ්‍ය උපදෙස් සහ පාඩම් තොරතුරු..." class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala']"></textarea>
          </div>

          <!-- Linked Timer -->
          <div class="border border-purple-200 bg-purple-50/50 p-3.5 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
              <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" id="qt-has-timer" class="rounded text-purple-600 focus:ring focus:ring-purple-200">
                <span class="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                  <i class="fas fa-stopwatch text-purple-600"></i> වේලාව මනින Timer එකක් සම්බන්ධ කරන්න (Link Timer)
                </span>
              </label>
            </div>
            <div id="qt-timer-row" class="hidden pt-2 border-t border-purple-200/60 flex items-center gap-3">
              <label class="text-xs text-purple-900 font-medium">කාල සීමාව:</label>
              <select id="qt-timer-seconds" class="p-2 border border-purple-300 rounded-lg text-xs bg-white">
                <option value="300">⏱ විනාඩි 5 (300s)</option>
                <option value="600" selected>⏱ විනාඩි 10 (600s)</option>
                <option value="900">⏱ විනාඩි 15 (900s)</option>
                <option value="1200">⏱ විනාඩි 20 (1200s)</option>
                <option value="1800">⏱ විනාඩි 30 (1800s)</option>
                <option value="3600">⏱ පැය 1 (3600s)</option>
              </select>
            </div>
          </div>

          <!-- Footer Buttons -->
          <div class="px-2 py-3 border-t border-gray-200 flex justify-end gap-3 font-['Noto_Sans_Sinhala'] pt-4">
            <button type="button" id="cancel-quick-task" class="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition cursor-pointer">
              අවලංගු කරන්න (Cancel)
            </button>
            <button type="submit" class="px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-save"></i> කාර්යය සුරකින්න (Save Task)
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  const closeModal = () => modal.remove();
  modal.querySelector("#close-quick-task-modal").addEventListener("click", closeModal);
  modal.querySelector("#cancel-quick-task").addEventListener("click", closeModal);

  const hasTimerCheckbox = modal.querySelector("#qt-has-timer");
  const timerRow = modal.querySelector("#qt-timer-row");
  if (hasTimerCheckbox && timerRow) {
    hasTimerCheckbox.addEventListener("change", (e) => {
      timerRow.classList.toggle("hidden", !e.target.checked);
    });
  }

  modal.querySelector("#quick-task-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const titleSi = modal.querySelector("#qt-title-si").value.trim();
    if (!titleSi) return;

    const titleEn = modal.querySelector("#qt-title-en").value.trim();
    const targetProfile = modal.querySelector("#qt-target-profile").value;
    const subject = modal.querySelector("#qt-subject").value;
    const category = modal.querySelector("#qt-category").value;
    const tier = modal.querySelector("#qt-tier").value;
    const points = parseFloat(modal.querySelector("#qt-points").value) || 10;
    const icon = modal.querySelector("#qt-icon").value.trim() || '📋';
    const sortOrder = parseInt(modal.querySelector("#qt-sort-order").value) || 0;
    const status = modal.querySelector("#qt-status").value || 'published';
    const frequency = modal.querySelector("#qt-frequency").value;
    const time = modal.querySelector("#qt-time").value;
    const description = modal.querySelector("#qt-description").value.trim();
    const hasTimer = modal.querySelector("#qt-has-timer").checked;
    const timerSec = hasTimer ? (parseInt(modal.querySelector("#qt-timer-seconds").value) || 600) : null;

    // Use valid UUID for Supabase wosandi_tasks table
    const newTaskId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });

    const payload = {
      id: newTaskId,
      title_si: titleSi,
      title_en: titleEn || titleSi,
      category: category,
      tier: tier,
      weight_points: points,
      icon: icon,
      sort_order: sortOrder,
      status: status,
      has_timer: hasTimer,
      timer_seconds: timerSec,
      schema_definition: {
        subject: subject,
        schedule: {
          frequency: frequency,
          time: time
        },
        description: description,
        target_profile: targetProfile,
        created_by_user: currentUser.id
      }
    };

    const taskObj = {
      ...payload,
      target_profile: targetProfile
    };

    // Show loading state on submit button
    const submitBtn = modal.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-1"></i> සුරකිමින් පවතී...';
    }

    // Direct Supabase insert
    try {
      const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks", {
        method: "POST",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          Prefer: "return=representation"
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const savedRows = await res.json();
        if (Array.isArray(savedRows) && savedRows.length > 0) {
          taskObj.id = savedRows[0].id;
        }
      } else {
        const errText = await res.text();
        console.warn("Supabase returned error on save wosandi_tasks:", errText);
      }
    } catch (e) {
      console.warn("Could not save to Supabase wosandi_tasks, relying on local cache:", e);
    }

    // Update local cache
    try {
      let cached = [];
      const raw = localStorage.getItem('wosandi_admin_wosandi_tasks');
      if (raw) cached = JSON.parse(raw);
      if (!Array.isArray(cached)) cached = [];
      const existingIdx = cached.findIndex(t => t.id === taskObj.id);
      if (existingIdx >= 0) {
        cached[existingIdx] = taskObj;
      } else {
        cached.push(taskObj);
      }
      localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));
    } catch (err) {}

    closeModal();
    await loadPublishedTasksFromAdmin();
    if (typeof syncProgressWithServer === 'function') {
      syncProgressWithServer(state, true);
    }
    if (typeof playChime === "function") playChime();
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
      flow_completed: false,
      flow_points: 0
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
  if (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks)) {
    const matched = window.publishedAdminTasks.find(t => t.id === key);
    if (matched && matched.schema_definition?.linked_state_key) {
      state[matched.schema_definition.linked_state_key] = val;
    }
  }
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

// =========================================================================
// Past Performance History Viewer (Requirement 4: See past performance)
// =========================================================================
async function openPastPerformanceModal() {
  if (typeof document === 'undefined') return;
  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa', display_name: 'Wosa (වෝසා)', avatar: '🌸' };

  let modal = document.getElementById("past-performance-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "past-performance-modal";
    document.body.appendChild(modal);
  }

  modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-['Poppins']";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-indigo-100 animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 p-5 text-white text-center relative shrink-0">
        <button type="button" id="close-past-performance-modal" class="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold transition cursor-pointer">&times;</button>
        <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2 text-2xl border border-white/30 shadow-inner">
          📊
        </div>
        <h2 class="text-lg sm:text-xl font-extrabold tracking-tight font-['Noto_Sans_Sinhala']">
          පසුගිය ප්‍රගතිය (Past Performance)
        </h2>
        <p class="text-xs text-indigo-100 mt-1 font-['Noto_Sans_Sinhala'] flex items-center justify-center gap-1.5">
          <span>${currentUser.avatar || '👤'}</span>
          <span><strong>${currentUser.display_name || currentUser.username}</strong> ගේ දෛනික වාර්තා</span>
        </p>
      </div>

      <!-- Content -->
      <div id="perf-modal-content" class="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 font-['Noto_Sans_Sinhala']">
        <div class="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
          <i class="fas fa-spinner fa-spin text-xl text-indigo-500"></i>
          <span>දත්ත ලබා ගනිමින් පවතී...</span>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => modal.remove();
  modal.querySelector("#close-past-performance-modal").addEventListener("click", closeModal);

  const contentEl = modal.querySelector("#perf-modal-content");
  let performanceLogs = [];

  // 1. Fetch from Supabase daily_logs
  try {
    const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/daily_logs?order=log_date.desc&limit=30", {
      headers: {
        apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
        Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (Array.isArray(rows)) {
        performanceLogs = rows;
      }
    }
  } catch (e) {
    console.warn("Could not fetch daily_logs from Supabase:", e);
  }

  // 2. Fetch user-specific config logs from wosandi_admin_config
  try {
    const res2 = await fetch(`https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=like.user_log_${currentUser.id}_*&order=created_at.desc&limit=30`, {
      headers: {
        apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
        Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
      }
    });
    if (res2.ok) {
      const userRows = await res2.json();
      if (Array.isArray(userRows)) {
        userRows.forEach(r => {
          if (r.config_data && r.config_data.log_date) {
            const exists = performanceLogs.findIndex(p => p.log_date === r.config_data.log_date);
            if (exists >= 0) {
              performanceLogs[exists] = { ...performanceLogs[exists], ...r.config_data };
            } else {
              performanceLogs.push(r.config_data);
            }
          }
        });
      }
    }
  } catch (e) {}

  // 3. Fallback to localStorage history
  try {
    const cachedHist = localStorage.getItem(`wosandi_perf_history_${currentUser.id}`);
    if (cachedHist) {
      const parsed = JSON.parse(cachedHist);
      if (Array.isArray(parsed)) {
        parsed.forEach(p => {
          if (!performanceLogs.some(existing => existing.log_date === p.log_date)) {
            performanceLogs.push(p);
          }
        });
      }
    }
  } catch (e) {}

  // Sort logs by date descending
  performanceLogs.sort((a, b) => new Date(b.log_date || 0) - new Date(a.log_date || 0));

  // Compute metrics
  const totalDays = performanceLogs.length;
  const totalEarned = performanceLogs.reduce((acc, curr) => acc + (Number(curr.earned_points) || 0), 0);
  const avgPercent = totalDays > 0 ? Math.round(performanceLogs.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0) / totalDays) : 0;

  if (totalDays === 0) {
    contentEl.innerHTML = `
      <div class="p-8 text-center text-slate-400 text-xs space-y-2">
        <i class="fas fa-calendar-xmark text-3xl text-slate-300 block mb-2"></i>
        <span class="font-bold text-slate-600 block">පසුගිය දත්ත කිසිවක් හමු නොවීය</span>
        <span>අද දින කාර්යයන් සම්පූර්ණ කිරීමෙන් ප්‍රගති සටහන ආරම්භ කරන්න.</span>
      </div>
    `;
    return;
  }

  // Render performance cards
  contentEl.innerHTML = `
    <!-- Summary Stats -->
    <div class="grid grid-cols-3 gap-2.5 pb-2">
      <div class="bg-indigo-50 border border-indigo-100 p-3 rounded-2xl text-center">
        <span class="text-[10px] uppercase font-bold text-indigo-500 block">සක්‍රීය දින</span>
        <span class="text-lg font-black text-indigo-900">${totalDays}</span>
      </div>
      <div class="bg-purple-50 border border-purple-100 p-3 rounded-2xl text-center">
        <span class="text-[10px] uppercase font-bold text-purple-500 block">මුළු ලකුණු</span>
        <span class="text-lg font-black text-purple-900">${Math.round(totalEarned)}</span>
      </div>
      <div class="bg-pink-50 border border-pink-100 p-3 rounded-2xl text-center">
        <span class="text-[10px] uppercase font-bold text-pink-500 block">සාමාන්‍යය</span>
        <span class="text-lg font-black text-pink-900">${avgPercent}%</span>
      </div>
    </div>

    <!-- Daily Log Entries List -->
    <div class="space-y-2.5 pt-1">
      ${performanceLogs.map(log => {
        const dateObj = new Date(log.log_date);
        const dayNames = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
        const dayName = !isNaN(dateObj.getDay()) ? dayNames[dateObj.getDay()] : "";
        const earned = Math.round(Number(log.earned_points) || 0);
        const total = Math.round(Number(log.total_possible_points) || 0);
        const pct = Math.min(100, Math.round(Number(log.percentage) || 0));
        const isFull = pct >= 90 || log.is_fully_completed === true;

        return `
          <div class="p-3.5 bg-white border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-xs transition flex flex-col gap-2">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2">
                <span class="w-8 h-8 rounded-xl ${isFull ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'} flex items-center justify-center text-sm font-bold shrink-0">
                  ${isFull ? '👑' : '📅'}
                </span>
                <div>
                  <span class="font-bold text-slate-800 text-xs block">${log.log_date} (${dayName})</span>
                  <span class="text-[11px] text-slate-500 font-semibold">${earned} / ${total} ලකුණු</span>
                </div>
              </div>
              <span class="px-2.5 py-1 rounded-full text-xs font-black ${isFull ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}">
                ${pct}%
              </span>
            </div>
            <!-- Progress Bar -->
            <div class="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
              <div class="bg-gradient-to-r from-pink-500 to-indigo-600 h-2 rounded-full transition-all duration-300" style="width: ${pct}%"></div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
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
  window.openPastPerformanceModal = openPastPerformanceModal;
}
