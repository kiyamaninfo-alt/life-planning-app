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

// =========================================================================
// Delayed Reordering Controller (5-Second Grace Delay for Ticked / Filled Items)
// =========================================================================
const pendingTaskReorders = new Map();
const pendingSectionReorders = new Map();

function scheduleTaskReorder(key, row) {
  if (!row && key && typeof document !== 'undefined') {
    row = document.querySelector(`[data-task-id="${key}"]`);
  }
  if (!row) return;

  const rowKey = key || row.getAttribute('data-task-id') || Math.random().toString();
  if (pendingTaskReorders.has(rowKey)) {
    clearTimeout(pendingTaskReorders.get(rowKey));
    pendingTaskReorders.delete(rowKey);
  }

  if (typeof row.setAttribute === 'function') {
    row.setAttribute('data-pending-reorder', 'true');
  }

  const timerId = setTimeout(() => {
    pendingTaskReorders.delete(rowKey);
    if (typeof row.removeAttribute === 'function') {
      row.removeAttribute('data-pending-reorder');
    } else if (typeof row.setAttribute === 'function') {
      row.setAttribute('data-pending-reorder', '');
    }
    const container = row.parentElement;
    if (container) {
      reorderTasksInList(container);
    } else {
      reorderAllTaskLists();
    }
  }, 5000);

  pendingTaskReorders.set(rowKey, timerId);
}

function cancelTaskReorder(key, row) {
  if (!row && key && typeof document !== 'undefined') {
    row = document.querySelector(`[data-task-id="${key}"]`);
  }
  if (row) {
    if (typeof row.removeAttribute === 'function') {
      row.removeAttribute('data-pending-reorder');
    } else if (typeof row.setAttribute === 'function') {
      row.setAttribute('data-pending-reorder', '');
    }
  }
  const rowKey = key || (row?.getAttribute && row.getAttribute('data-task-id'));
  if (rowKey && pendingTaskReorders.has(rowKey)) {
    clearTimeout(pendingTaskReorders.get(rowKey));
    pendingTaskReorders.delete(rowKey);
  }
}

function scheduleSectionReorder(secId, secEl) {
  if (!secEl && secId && typeof document !== 'undefined') {
    secEl = document.querySelector(`[data-section-id="${secId}"]`);
  }
  if (!secEl) return;

  if (pendingSectionReorders.has(secId)) {
    clearTimeout(pendingSectionReorders.get(secId));
    pendingSectionReorders.delete(secId);
  }

  if (typeof secEl.setAttribute === 'function') {
    secEl.setAttribute('data-pending-reorder', 'true');
  }

  const timerId = setTimeout(() => {
    pendingSectionReorders.delete(secId);
    if (typeof secEl.removeAttribute === 'function') {
      secEl.removeAttribute('data-pending-reorder');
    } else if (typeof secEl.setAttribute === 'function') {
      secEl.setAttribute('data-pending-reorder', '');
    }
    if (typeof window !== 'undefined' && window.routineOrdering?.applyRoutineOrderAndDependencies) {
      window.routineOrdering.applyRoutineOrderAndDependencies(state);
    }
    updateSectionCollapseStates(state);
  }, 5000);

  pendingSectionReorders.set(secId, timerId);
}

function cancelSectionReorder(secId, secEl) {
  if (!secEl && secId && typeof document !== 'undefined') {
    secEl = document.querySelector(`[data-section-id="${secId}"]`);
  }
  if (secEl) {
    if (typeof secEl.removeAttribute === 'function') {
      secEl.removeAttribute('data-pending-reorder');
    } else if (typeof secEl.setAttribute === 'function') {
      secEl.setAttribute('data-pending-reorder', '');
    }
  }
  if (secId && pendingSectionReorders.has(secId)) {
    clearTimeout(pendingSectionReorders.get(secId));
    pendingSectionReorders.delete(secId);
  }
}

// 3. Tick box tasks sent to bottom of their list when completed (delayed 5s when freshly ticked)
function reorderTasksInList(container) {
  if (!container) return;
  const taskRows = Array.from(container.children || []).filter(el => Boolean(el.querySelector && el.querySelector('input[type="checkbox"]')));
  if (taskRows.length === 0) return;

  const active = [];
  const completed = [];

  taskRows.forEach(row => {
    const cb = row.querySelector('input[type="checkbox"]');
    const isDone = cb ? cb.checked : false;
    const isPending = Boolean(row.getAttribute && row.getAttribute('data-pending-reorder'));
    if (isDone) {
      row.classList.add('task-is-completed', 'opacity-75', 'bg-emerald-50/40', 'border-emerald-200');
      if (isPending) {
        // Keep in place (top/active) until 5-second grace period completes
        active.push(row);
      } else {
        completed.push(row);
      }
    } else {
      row.classList.remove('task-is-completed', 'opacity-75', 'bg-emerald-50/40', 'border-emerald-200');
      active.push(row);
    }
  });

  // Re-append: unchecked & pending at top, completed at bottom!
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
    const isPending = Boolean(sec.getAttribute && sec.getAttribute('data-pending-reorder'));

    if (completed) {
      sec.classList.add('is-completed');
      if (badge) badge.classList.remove('hidden');

      if (!isPending && !manualExpandedSections.has(secId)) {
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
  if (typeof window !== 'undefined') {
    const currentUser = window.userManagerClient?.getCurrentUser?.();
    if (currentUser?.role === 'admin' || currentUser?.id === 'user_admin') {
      renderAdminMonitoringDashboard();
      return;
    }
  }
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
// Automatic Icon Decider (Requirement 1.5)
// =========================================================================
function autoDetermineIcon(title = '', category = 'general') {
  const t = (title || '').toLowerCase();
  if (t.includes('ගණිත') || t.includes('math') || t.includes('සමීකරණ') || t.includes('අංක') || t.includes('algebra')) return '📐';
  if (t.includes('විද්‍යා') || t.includes('science') || t.includes('භෞතික') || t.includes('රසායන') || t.includes('bio')) return '🔬';
  if (t.includes('ඉංග්‍රීසි') || t.includes('english') || t.includes('grammar') || t.includes('vocab')) return '🔤';
  if (t.includes('සිංහල') || t.includes('sinhala') || t.includes('රචනා') || t.includes('සාහිත්‍ය')) return '✍️';
  if (t.includes('ඉතිහාස') || t.includes('history')) return '🏛️';
  if (t.includes('කියව') || t.includes('read') || t.includes('පාඩම්') || t.includes('study') || t.includes('homework') || t.includes('පොත්') || t.includes('book')) return '📚';
  if (t.includes('නැටුම්') || t.includes('ballet') || t.includes('dance') || t.includes('සංගීත') || t.includes('music')) return '🩰';
  if (t.includes('ව්‍යායාම') || t.includes('exercise') || t.includes('workout') || t.includes('fitness') || t.includes('දිවීම') || t.includes('pushup') || t.includes('gym')) return '🏃';
  if (t.includes('ඇඳ') || t.includes('bed') || t.includes('කාමර') || t.includes('room') || t.includes('අස්') || t.includes('clean') || t.includes('පිරිසිදු')) return '🛏️';
  if (t.includes('වතුර') || t.includes('water') || t.includes('බොන්න') || t.includes('drink')) return '💧';
  if (t.includes('දත්') || t.includes('teeth') || t.includes('brush')) return '🪥';
  if (t.includes('බුදුන්') || t.includes('භාවනා') || t.includes('ආගම') || t.includes('religion') || t.includes('prayer') || t.includes('පන්සිල්')) return '🧘';
  if (t.includes('කෑම') || t.includes('food') || t.includes('breakfast') || t.includes('lunch') || t.includes('dinner') || t.includes('ආහාර') || t.includes('meal')) return '🥗';
  if (t.includes('නිදා') || t.includes('sleep') || t.includes('rest') || t.includes('නින්ද')) return '🌙';
  if (t.includes('ඇවිද') || t.includes('walk')) return '🚶';
  if (t.includes('චිත්‍ර') || t.includes('art') || t.includes('draw')) return '🎨';
  if (t.includes('පරිගණක') || t.includes('ict') || t.includes('code') || t.includes('computer')) return '💻';
  if (t.includes('මිදුල') || t.includes('මල්') || t.includes('garden') || t.includes('plant')) return '🌱';
  if (t.includes('රෙදි') || t.includes('clothes') || t.includes('wash')) return '🧺';
  if (t.includes('timer') || t.includes('කාලය') || t.includes('time')) return '⏱️';
  
  if (category === 'academic') return '📖';
  if (category === 'physical') return '🏃';
  if (category === 'chores') return '🧹';
  if (category === 'habits') return '✨';
  if (category === 'creative') return '🎨';
  return '📋';
}

// =========================================================================
// Real-Time Notification & Activity Logging Engine (Requirements 7, 8, 8.2)
// =========================================================================
let syncLogsDebounce = null;

function notifyAdminRealtime(title, message, data = {}) {
  // 1. Audio ping if in-app audio chime is enabled
  const audioEnabled = typeof localStorage !== 'undefined' ? localStorage.getItem('wosandi_admin_audio_enabled') !== 'false' : true;
  if (audioEnabled && typeof playChime === 'function') {
    try { playChime(); } catch (e) {}
  }

  // 2. Web Notification API (Browser push when tab or browser is active)
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body: message,
        icon: '/favicon.svg',
        tag: 'wosandi-admin-alert'
      });
    } catch (e) {}
  }

  // 3. Ultra-lightweight zero-resource push via ntfy.sh (Requirement 8 & 8.2)
  // Sends notification to Admin phone lock screen even when logged out or app is closed!
  const ntfyTopic = (typeof localStorage !== 'undefined' ? localStorage.getItem('wosandi_admin_ntfy_topic') : null) || 'wosandi-admin-alerts';
  try {
    if (typeof fetch === 'function') {
      fetch(`https://ntfy.sh/${ntfyTopic}`, {
        method: 'POST',
        headers: {
          'Title': title,
          'Priority': 'default',
          'Tags': 'shield,bell'
        },
        body: message
      }).catch(() => {});
    }
  } catch (e) {}
}

function recordUserActivity(actionType, details, pointsDelta = 0, metadata = {}) {
  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa' };

  const logEntry = {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    timestamp: Date.now(),
    timeStr: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    dateStr: new Date().toISOString().split('T')[0],
    userId: currentUser.id,
    userName: currentUser.username,
    userDisplayName: currentUser.display_name || currentUser.username,
    userAvatar: currentUser.avatar || '👤',
    actionType: actionType,
    details: details,
    pointsDelta: pointsDelta,
    metadata: metadata
  };

  try {
    let logs = [];
    const cached = localStorage.getItem('wosandi_activity_logs');
    if (cached) logs = JSON.parse(cached);
    if (!Array.isArray(logs)) logs = [];
    logs.unshift(logEntry);
    if (logs.length > 200) logs = logs.slice(0, 200);
    localStorage.setItem('wosandi_activity_logs', JSON.stringify(logs));
  } catch (e) {}

  // Trigger alert if action done by a member (not by Admin itself)
  if (currentUser.role !== 'admin' && currentUser.id !== 'user_admin') {
    notifyAdminRealtime(
      `🔔 ${currentUser.username}: ${details}`,
      `${currentUser.display_name || currentUser.username} (${logEntry.timeStr})`
    );
  }

  // Reactive event for live admin dashboard
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('wosandi-activity-logged', { detail: logEntry }));
  }

  // Debounced sync to Supabase wosandi_admin_config
  if (syncLogsDebounce) clearTimeout(syncLogsDebounce);
  syncLogsDebounce = setTimeout(async () => {
    try {
      const logsRaw = localStorage.getItem('wosandi_activity_logs');
      if (!logsRaw) return;
      const logs = JSON.parse(logsRaw);
      await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.activity_logs", {
        method: "PATCH",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          config_data: { logs: logs.slice(0, 100), updated_at: new Date().toISOString() },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }, 2000);
}

// =========================================================================
// Admin Live Monitoring Dashboard (Requirement 7: Live User Logs & Hub)
// =========================================================================
let adminPollInterval = null;

function renderAdminMonitoringDashboard() {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('admin-monitoring-container');
  if (!container) return;

  // Hide circular progress ring and rank badges (Requirement 1: Admin profile is to monitor every other user)
  const progressRing = document.querySelector('.relative.w-44.h-44');
  if (progressRing) progressRing.classList.add('hidden');
  const badgeContainer = document.getElementById('badge-container');
  if (badgeContainer) badgeContainer.classList.add('hidden');

  // Hide standard routine containers (Requirement 1: no wake-up, study, ballet, workout in admin profile)
  const quickBar = document.getElementById('quick-add-task-bar');
  if (quickBar) quickBar.classList.add('hidden');
  const fastingCard = document.getElementById('fasting-tracker-card-container');
  if (fastingCard) fastingCard.classList.add('hidden');
  const flowSec = document.getElementById('published-flow-section');
  if (flowSec) flowSec.classList.add('hidden');
  const recentSec = document.getElementById('recent-changes-section');
  if (recentSec) recentSec.classList.add('hidden');
  document.querySelectorAll('.routine-section').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.routine-lock-banner').forEach(el => el.classList.add('hidden'));

  container.classList.remove('hidden');

  let logs = [];
  try {
    const rawLogs = localStorage.getItem('wosandi_activity_logs');
    if (rawLogs) logs = JSON.parse(rawLogs);
  } catch (e) {}
  if (!Array.isArray(logs)) logs = [];

  let users = [];
  if (typeof window !== 'undefined' && window.userManagerClient?.users?.length > 0) {
    users = window.userManagerClient.users.filter(u => u.role !== 'admin' && u.id !== 'user_admin');
  } else {
    try {
      const rawUsers = localStorage.getItem('wosandi_users_config');
      if (rawUsers) users = JSON.parse(rawUsers).filter(u => u.role !== 'admin' && u.id !== 'user_admin');
    } catch (e) {}
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = logs.filter(l => l.dateStr === todayStr);
  const tasksCompletedToday = todayLogs.filter(l => l.actionType === 'task_completed').length;
  const pointsToday = todayLogs.reduce((acc, curr) => acc + (Number(curr.pointsDelta) || 0), 0);

  container.innerHTML = `
    <div class="space-y-4 font-['Noto_Sans_Sinhala'] animate-in fade-in duration-200">
      <!-- Admin Top Banner -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white p-4 sm:p-5 rounded-3xl shadow-xl border border-indigo-900/60 relative overflow-hidden">
        <div class="flex items-center justify-between gap-3 relative z-10">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner">
              🛡️
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h2 class="text-base sm:text-lg font-extrabold text-white">පරිපාලක සජීවී නිරීක්ෂණ පුවරුව</h2>
                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Live
                </span>
              </div>
              <p class="text-xs text-slate-300 mt-0.5">සෑම පරිශීලකයෙකුගේම සජීවී ක්‍රියාකාරකම් සහ ප්‍රගතිය (Live Activity Logs)</p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <a href="/admin/" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
              <i class="fa-solid fa-gauge-high"></i> Admin Panel →
            </a>
          </div>
        </div>

        <!-- Metric Stat Cards -->
        <div class="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-white/10 text-center">
          <div class="bg-white/5 rounded-xl p-2 border border-white/5">
            <span class="text-[10px] text-slate-400 block">පරිශීලකයින්</span>
            <span class="text-lg font-extrabold text-white">${users.length}</span>
          </div>
          <div class="bg-white/5 rounded-xl p-2 border border-white/5">
            <span class="text-[10px] text-slate-400 block">අද නිම කළ කාර්යයන්</span>
            <span class="text-lg font-extrabold text-emerald-400">${tasksCompletedToday}</span>
          </div>
          <div class="bg-white/5 rounded-xl p-2 border border-white/5">
            <span class="text-[10px] text-slate-400 block">අද මුළු ලකුණු</span>
            <span class="text-lg font-extrabold text-pink-400">${pointsToday}</span>
          </div>
        </div>
      </div>

      <!-- Real-Time Push Notification Engine (Requirements 8 & 8.2) -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-purple-100 space-y-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">🔔</span>
            <div>
              <h3 class="text-xs font-bold text-slate-800">සජීවී Push Notification පද්ධතිය (Real-Time Alerts)</h3>
              <span class="text-[10px] text-slate-500">Mobile app එකෙන් log out වුවද ඔබගේ දුරකථනයට alerts ලැබේ</span>
            </div>
          </div>
          <button type="button" id="admin-send-test-notif-btn" class="px-2.5 py-1 text-[11px] font-bold bg-purple-50 text-purple-700 hover:bg-purple-100 rounded-lg border border-purple-200 transition flex items-center gap-1 cursor-pointer">
            <i class="fa-solid fa-paper-plane text-[10px]"></i> Test Alert
          </button>
        </div>

        <!-- Resource Friendly Explanation (Requirement 8.2) -->
        <div class="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-indigo-950 text-[11px] leading-relaxed">
          <p class="font-bold flex items-center gap-1.5 text-indigo-900 mb-1">
            <i class="fa-solid fa-leaf text-emerald-600"></i> සම්පත් සහ බැටරි පරිභෝජනය (Resource Efficiency - 8.2):
          </p>
          මෙම notification ක්‍රමය mobile browser එක පසුබිමේ ධාවනය කරමින් battery හෝ CPU වැය නොකරයි. Cloud Push (Web Push සහ ntfy) මඟින් සෘජුවම ඔබගේ දුරකථනයේ Lock Screen එකට ක්ෂණික alerts ලබාදේ (0% Local CPU Drain).
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
          <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-slate-700 font-semibold flex items-center gap-1.5">
              <i class="fa-solid fa-bell text-purple-600"></i> Browser Push අවසරය:
            </span>
            <button type="button" id="admin-browser-push-toggle" class="px-3 py-1 bg-purple-600 text-white rounded-lg font-bold text-xs hover:bg-purple-700 transition cursor-pointer">
              ${typeof Notification !== 'undefined' && Notification.permission === 'granted' ? '✓ සක්‍රීයයි' : 'සක්‍රිය කරන්න'}
            </button>
          </div>
          <div class="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200">
            <span class="text-slate-700 font-semibold flex items-center gap-1.5">
              <i class="fa-solid fa-volume-high text-pink-600"></i> ශබ්ද සංඥා (Audio Chime):
            </span>
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" id="admin-audio-toggle" ${localStorage.getItem('wosandi_admin_audio_enabled') !== 'false' ? 'checked' : ''} class="sr-only peer">
              <div class="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
          </div>
        </div>
      </div>

      <!-- Live User Status Grid (Requirement 7) -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-purple-100 space-y-3">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
            <i class="fa-solid fa-users text-indigo-600"></i> පරිශීලකයින්ගේ සජීවී තත්ත්වය (Live User Status)
          </h3>
          <span class="text-[10px] text-slate-400">ස්වයංක්‍රීයව නැවුම් වේ</span>
        </div>
        <div id="admin-users-live-grid" class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${users.map(u => {
            const userLogs = logs.filter(l => l.userId === u.id || l.userName === u.username);
            const latestLog = userLogs[0];
            const uStateKey = (u.username === 'Wosa' || u.id === 'user_wosa') ? ('wosandi_routine_state_' + todayStr) : (`wosandi_routine_state_${u.id}_${todayStr}`);
            let uCompletedCount = 0;
            try {
              const uStateRaw = localStorage.getItem(uStateKey);
              if (uStateRaw) {
                const parsed = JSON.parse(uStateRaw);
                uCompletedCount = Object.keys(parsed).filter(k => parsed[k] === true).length;
              }
            } catch (e) {}

            return `
              <div class="admin-user-card p-4 bg-slate-50/90 border border-slate-200 rounded-2xl space-y-3 hover:bg-slate-100/70 hover:border-purple-300 transition cursor-pointer shadow-2xs" data-user-id="${u.id}">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-2.5">
                    <span class="w-11 h-11 rounded-2xl bg-white shadow-xs border border-slate-200 flex items-center justify-center text-2xl">
                      ${u.avatar || '👤'}
                    </span>
                    <div>
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-800 text-sm">${u.username}</span>
                        ${u.role === 'primary' ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600">Primary</span>' : ''}
                      </div>
                      <span class="text-xs text-slate-400 block">${u.display_name || u.username}</span>
                    </div>
                  </div>
                  <div class="flex flex-col items-end gap-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${latestLog ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
                      ${latestLog ? '● Active' : 'Offline'}
                    </span>
                    <span class="text-[10px] text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">${u.points || 0} pts</span>
                  </div>
                </div>

                <div class="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 text-slate-600">
                  <span>අද සම්පූර්ණ කළ කාර්යයන්:</span>
                  <span class="font-bold text-purple-700">${uCompletedCount} Tasks</span>
                </div>

                <div class="text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100 truncate">
                  ${latestLog ? `⚡ ${latestLog.timeStr}: ${latestLog.details}` : 'අද ක්‍රියාකාරකම් සටහන් වී නැත'}
                </div>

                <!-- Quick Action Buttons for Admin (Requirements 3 & 4) -->
                <div class="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/50">
                  <button type="button" class="btn-inspect-user-logs py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-[11px] transition flex items-center justify-center gap-1 cursor-pointer" data-user-id="${u.id}">
                    <i class="fas fa-list-ol"></i> ක්‍රියාකාරකම් (Logs)
                  </button>
                  <button type="button" class="btn-open-user-full-dashboard py-1.5 px-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl text-[11px] shadow-xs transition flex items-center justify-center gap-1 cursor-pointer" data-user-id="${u.id}">
                    <i class="fas fa-external-link-alt"></i> Dashboard බලන්න
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Live Activity Logs Feed (Requirement 7 & 6) -->
      <div class="bg-white p-4 sm:p-5 rounded-2xl shadow-sm border border-purple-100 space-y-3">
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i class="fa-solid fa-clipboard-list text-pink-600"></i> සජීවී ක්‍රියාකාරකම් සටහන් (Live Activity Logs)
            </h3>
            <span id="admin-log-count-badge" class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">${logs.length} logs</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button type="button" id="admin-refresh-logs-btn" class="p-1.5 text-slate-500 hover:text-indigo-600 transition cursor-pointer" title="නැවුම් කරන්න">
              <i class="fa-solid fa-rotate text-xs"></i>
            </button>
            <button type="button" id="admin-clear-logs-btn" class="p-1.5 text-slate-400 hover:text-rose-600 transition text-xs cursor-pointer" title="සටහන් මකන්න">
              <i class="fa-solid fa-trash-can text-xs"></i>
            </button>
          </div>
        </div>

        <div class="flex gap-1.5 overflow-x-auto pb-1 text-xs" id="admin-log-filters">
          <button type="button" class="admin-log-filter px-2.5 py-1 rounded-lg font-bold bg-purple-600 text-white text-[11px] cursor-pointer" data-filter="all">සියල්ල</button>
          <button type="button" class="admin-log-filter px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] cursor-pointer" data-filter="task_completed">කාර්යයන්</button>
          <button type="button" class="admin-log-filter px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] cursor-pointer" data-filter="timer_started">Timers</button>
          <button type="button" class="admin-log-filter px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] cursor-pointer" data-filter="user_switch">පිවිසුම්</button>
        </div>

        <div id="admin-logs-feed" class="space-y-2 max-h-96 overflow-y-auto pr-1">
          ${renderLogsListHtml(logs)}
        </div>
      </div>
    </div>
  `;

  // Remove admin-master-bar if returning to monitoring dashboard
  const masterBar = document.getElementById('admin-master-bar');
  if (masterBar) masterBar.remove();

  // Attach card and button listeners for User Inspector and Full Dashboard (Requirements 3 & 4)
  container.querySelectorAll('.btn-inspect-user-logs').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.dataset.userId;
      const targetUser = users.find(u => u.id === uId);
      if (targetUser) openAdminUserInspectorModal(targetUser);
    });
  });

  container.querySelectorAll('.btn-open-user-full-dashboard').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const uId = btn.dataset.userId;
      const targetUser = users.find(u => u.id === uId);
      if (targetUser) openUserDashboardAsAdminMaster(targetUser);
    });
  });

  container.querySelectorAll('.admin-user-card').forEach(card => {
    card.addEventListener('click', () => {
      const uId = card.dataset.userId;
      const targetUser = users.find(u => u.id === uId);
      if (targetUser) openAdminUserInspectorModal(targetUser);
    });
  });

  // Attach listeners for live feed log items (Requirement 6: click log entry to see full details)
  attachLogsFeedClickListeners(container, logs);

  // Attach Listeners
  const testNotifBtn = container.querySelector('#admin-send-test-notif-btn');
  if (testNotifBtn) {
    testNotifBtn.addEventListener('click', () => {
      notifyAdminRealtime('🔔 පරිපාලක පරීක්ෂණ දැනුම්දීම', 'සජීවී Push Notification සාර්ථකව සම්බන්ධයි!');
      if (typeof playChime === 'function') playChime();
    });
  }

  const browserPushToggle = container.querySelector('#admin-browser-push-toggle');
  if (browserPushToggle) {
    browserPushToggle.addEventListener('click', async () => {
      if (typeof Notification !== 'undefined') {
        const perm = await Notification.requestPermission();
        if (perm === 'granted') {
          browserPushToggle.innerText = '✓ සක්‍රීයයි';
          notifyAdminRealtime('🔔 Browser Push සක්‍රියයි', 'ඔබට දැන් බ්‍රවුසරයෙන් alerts ලැබේ.');
        } else {
          alert('Notification අවසරය ප්‍රතික්ෂේප කර ඇත. කරුණාකර බ්‍රවුසර් settings පරීක්ෂා කරන්න.');
        }
      }
    });
  }

  const audioToggle = container.querySelector('#admin-audio-toggle');
  if (audioToggle) {
    audioToggle.addEventListener('change', (e) => {
      localStorage.setItem('wosandi_admin_audio_enabled', String(e.target.checked));
    });
  }

  const clearBtn = container.querySelector('#admin-clear-logs-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('සියලුම ක්‍රියාකාරකම් සටහන් ඉවත් කිරීමට අවශ්‍යද?')) {
        localStorage.setItem('wosandi_activity_logs', '[]');
        renderAdminMonitoringDashboard();
      }
    });
  }

  const refreshBtn = container.querySelector('#admin-refresh-logs-btn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      renderAdminMonitoringDashboard();
    });
  }

  const filterBtns = container.querySelectorAll('.admin-log-filter');
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.className = 'admin-log-filter px-2.5 py-1 rounded-lg font-semibold bg-slate-100 text-slate-600 hover:bg-slate-200 text-[11px] cursor-pointer';
      });
      btn.className = 'admin-log-filter px-2.5 py-1 rounded-lg font-bold bg-purple-600 text-white text-[11px] cursor-pointer';
      const f = btn.dataset.filter;
      const filtered = f === 'all' ? logs : logs.filter(l => l.actionType === f);
      const feed = container.querySelector('#admin-logs-feed');
      if (feed) {
        feed.innerHTML = renderLogsListHtml(filtered);
        attachLogsFeedClickListeners(container, filtered);
      }
    });
  });

  // Ensure periodic refresh while Admin view is mounted
  if (!adminPollInterval) {
    adminPollInterval = setInterval(() => {
      const activeU = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser) ? window.userManagerClient.getCurrentUser() : null;
      if (activeU?.role === 'admin' || activeU?.id === 'user_admin') {
        const raw = localStorage.getItem('wosandi_activity_logs');
        if (raw) {
          const parsed = JSON.parse(raw);
          const feed = document.getElementById('admin-logs-feed');
          if (feed) {
            feed.innerHTML = renderLogsListHtml(parsed);
            attachLogsFeedClickListeners(container, parsed);
          }
        }
      } else {
        clearInterval(adminPollInterval);
        adminPollInterval = null;
      }
    }, 8000);
    if (adminPollInterval && typeof adminPollInterval.unref === 'function') {
      adminPollInterval.unref();
    }
  }
}

function attachLogsFeedClickListeners(container, logsList) {
  if (!container || !Array.isArray(logsList)) return;
  container.querySelectorAll('.admin-log-row').forEach(row => {
    row.addEventListener('click', () => {
      const logId = row.dataset.logId;
      const found = logsList.find(l => l.id === logId);
      if (found) openLogDetailsModal(found);
    });
  });
}

function renderLogsListHtml(logsList) {
  if (!Array.isArray(logsList) || logsList.length === 0) {
    return `<div class="p-4 text-center text-xs text-slate-400 italic">කිසිදු ක්‍රියාකාරකම් සටහනක් නොමැත.</div>`;
  }
  return logsList.map(l => {
    let badgeColor = 'bg-slate-100 text-slate-700';
    if (l.actionType === 'task_completed') badgeColor = 'bg-emerald-100 text-emerald-800';
    else if (l.actionType === 'task_uncompleted') badgeColor = 'bg-rose-100 text-rose-800';
    else if (l.actionType === 'timer_started') badgeColor = 'bg-blue-100 text-blue-800';
    else if (l.actionType === 'wake_up') badgeColor = 'bg-amber-100 text-amber-800';
    else if (l.actionType === 'user_switch') badgeColor = 'bg-purple-100 text-purple-800';

    return `
      <div class="admin-log-row p-2.5 bg-slate-50 border border-slate-200/80 rounded-xl flex items-center justify-between gap-2.5 text-xs hover:bg-purple-50/60 hover:border-purple-300 transition cursor-pointer" data-log-id="${l.id}" title="විස්තර බැලීමට ක්ලික් කරන්න (Click to view full details)">
        <div class="flex items-center gap-2 min-w-0">
          <span class="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-sm shrink-0">
            ${l.userAvatar || '👤'}
          </span>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span class="font-bold text-slate-800">${l.userName}</span>
              <span class="px-1.5 py-0.2 rounded text-[10px] font-bold ${badgeColor}">
                ${l.actionType}
              </span>
            </div>
            <span class="text-slate-600 block text-[11px] truncate">${l.details}</span>
          </div>
        </div>
        <div class="text-right shrink-0">
          <span class="text-[10px] font-mono text-slate-400 block">${l.timeStr || ''}</span>
          ${l.pointsDelta ? `<span class="text-[10px] font-bold ${l.pointsDelta > 0 ? 'text-emerald-600' : 'text-rose-600'}">${l.pointsDelta > 0 ? '+' : ''}${l.pointsDelta} pts</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Requirement 6: Full Details Modal for Any Activity Log Entry
 */
function openLogDetailsModal(log) {
  if (!log) return;
  let modal = document.getElementById('activity-log-details-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'activity-log-details-modal';
    document.body.appendChild(modal);
  }

  const actionLabels = {
    task_completed: '✅ කාර්යය සම්පූර්ණ කිරීම (Task Completed)',
    task_uncompleted: '↩️ කාර්යය අස්ථාපනය (Task Uncompleted)',
    timer_started: '⏱️ කාලගණකය ආරම්භ කිරීම (Timer Started)',
    wake_up: '🌅 අවදි වූ වේලාව සටහන් කිරීම (Wake Up Logged)',
    user_switch: '👤 පරිශීලක මාරුව (User Switched)',
    task_created: '➕ නව කාර්යයක් එක් කිරීම (Task Created)',
    task_updated: '⚙️ කාර්ය සැකසුම් වෙනස් කිරීම (Task Settings Updated)',
    task_hidden: '🗑️ කාර්යය සඟවීම/ඉවත් කිරීම (Task Hidden)'
  };

  const actionName = actionLabels[log.actionType] || log.actionType;

  modal.className = "fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100000] flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']";
  modal.style.zIndex = "100000";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
      <!-- Modal Header -->
      <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
        <div class="flex items-center gap-2.5">
          <span class="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-xl shadow-inner">
            ${log.userAvatar || '📋'}
          </span>
          <div>
            <h3 class="text-sm sm:text-base font-extrabold text-white">ක්‍රියාකාරකම් සවිස්තර වාර්තාව</h3>
            <span class="text-xs text-purple-200 block mt-0.5">${log.userDisplayName || log.userName} • ${log.dateStr}</span>
          </div>
        </div>
        <button type="button" id="close-log-details-modal" class="text-white/80 hover:text-white text-2xl font-bold transition p-1 cursor-pointer">&times;</button>
      </div>

      <!-- Details Body -->
      <div class="p-5 sm:p-6 space-y-3.5 text-xs max-h-[75vh] overflow-y-auto">
        <!-- Main Description -->
        <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">සිදු වූ ක්‍රියාව (Action & Details):</span>
          <span class="text-sm font-bold text-slate-800 block">${log.details}</span>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl">
            <span class="text-[10px] font-bold text-indigo-700 block">ක්‍රියාකාරකම් වර්ගය:</span>
            <span class="font-bold text-slate-800 text-xs block mt-1">${actionName}</span>
          </div>
          <div class="p-3 bg-pink-50/60 border border-pink-100 rounded-xl">
            <span class="text-[10px] font-bold text-pink-700 block">ලකුණු වෙනස (Points Delta):</span>
            <span class="font-bold text-sm block mt-1 ${log.pointsDelta > 0 ? 'text-emerald-600' : 'text-slate-700'}">
              ${log.pointsDelta > 0 ? '+' : ''}${log.pointsDelta || 0} pts
            </span>
          </div>
        </div>

        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-500 font-semibold">සටහන් වූ වේලාව:</span>
            <span class="font-mono font-bold text-slate-700">${log.timeStr || ''} (${log.dateStr || ''})</span>
          </div>
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
            <span class="text-slate-500 font-semibold">පරිශීලක ID:</span>
            <span class="font-mono text-slate-600 text-[10px]">${log.userId || 'N/A'}</span>
          </div>
          <div class="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/60">
            <span class="text-slate-500 font-semibold">Log ID:</span>
            <span class="font-mono text-slate-400 text-[10px] truncate max-w-[180px]">${log.id || 'N/A'}</span>
          </div>
        </div>

        <!-- Metadata JSON if present -->
        ${log.metadata && Object.keys(log.metadata).length > 0 ? `
          <div class="space-y-1.5">
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">අමතර තාක්ෂණික දත්ත (Metadata):</span>
            <pre class="bg-slate-900 text-purple-200 p-3 rounded-xl text-[10px] font-mono overflow-x-auto max-h-36">${JSON.stringify(log.metadata, null, 2)}</pre>
          </div>
        ` : ''}
      </div>

      <!-- Footer Button -->
      <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
        <button type="button" id="btn-close-log-details" class="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer">
          වසන්න (Close)
        </button>
      </div>
    </div>
  `;

  const close = () => modal.remove();
  const cBtn = modal.querySelector('#close-log-details-modal');
  if (cBtn) cBtn.addEventListener('click', close);
  const bBtn = modal.querySelector('#btn-close-log-details');
  if (bBtn) bBtn.addEventListener('click', close);
}

/**
 * Requirement 3: User Inspector Modal showing last 10 activities per page with Next/Prev pagination
 */
function openAdminUserInspectorModal(user) {
  if (!user) return;
  let modal = document.getElementById('admin-user-inspector-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'admin-user-inspector-modal';
    document.body.appendChild(modal);
  }

  // Requirement 3: Only load logs when hit the user
  let allLogs = [];
  try {
    const raw = localStorage.getItem('wosandi_activity_logs');
    if (raw) allLogs = JSON.parse(raw);
  } catch (e) {}
  if (!Array.isArray(allLogs)) allLogs = [];

  const userLogs = allLogs.filter(l => l.userId === user.id || l.userName === user.username);

  let currentLogsPage = 1;
  const pageSize = 10;

  modal.className = "fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[99990] flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']";
  modal.style.zIndex = "99990";
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
      <!-- Header -->
      <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 p-4 sm:p-5 text-white relative shrink-0">
        <button type="button" id="close-user-inspector-modal" class="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold transition p-1 cursor-pointer">&times;</button>
        <div class="flex items-center gap-3">
          <span class="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-2xl shadow-inner shrink-0">
            ${user.avatar || '👤'}
          </span>
          <div>
            <div class="flex items-center gap-2">
              <h2 class="text-base sm:text-lg font-bold text-white">${user.username}</h2>
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/30 text-purple-200 border border-purple-400/30">${user.role || 'member'}</span>
            </div>
            <span class="text-xs text-slate-300 block mt-0.5">${user.display_name || user.username} • ලකුණු: ${user.points || 0} pts</span>
          </div>
        </div>
      </div>

      <!-- Navigation Bar (Requirement 4: Tab or link to see full dashboard) -->
      <div class="flex border-b border-slate-200 bg-slate-100/90 p-2 gap-2 shrink-0">
        <button type="button" id="inspector-tab-logs" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-indigo-700 shadow-xs cursor-pointer">
          <i class="fas fa-list-ol text-indigo-600"></i> ක්‍රියාකාරකම් සටහන් (${userLogs.length})
        </button>
        <button type="button" id="inspector-btn-open-dashboard" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs cursor-pointer">
          <i class="fas fa-external-link-alt"></i> සම්පූර්ණ Dashboard එක (Full View)
        </button>
      </div>

      <!-- Logs Container -->
      <div class="p-4 sm:p-5 flex-1 overflow-y-auto space-y-3">
        <div class="flex items-center justify-between text-xs text-slate-500">
          <span>අවසන් ක්‍රියාකාරකම් (10 බැගින්):</span>
          <span id="user-inspector-page-indicator" class="font-bold text-purple-700">පිටුව 1</span>
        </div>

        <div id="user-inspector-logs-list" class="space-y-2">
          <!-- Rendered dynamically -->
        </div>

        <!-- Pagination Controls (Requirement 3: next button to see next 10 and previous) -->
        <div class="pt-3 border-t border-slate-200 flex items-center justify-between gap-2">
          <button type="button" id="btn-inspector-prev" class="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer">
            <i class="fas fa-chevron-left text-[10px]"></i> පෙර 10 (Previous)
          </button>
          <span id="user-inspector-page-count" class="text-xs text-slate-500 font-semibold text-center"></span>
          <button type="button" id="btn-inspector-next" class="px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer">
            මීළඟ 10 (Next) <i class="fas fa-chevron-right text-[10px]"></i>
          </button>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => modal.remove();
  const closeBtn = modal.querySelector('#close-user-inspector-modal');
  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  // Requirement 4: Open full dashboard of this user in Admin Master Mode
  const openDashboardBtn = modal.querySelector('#inspector-btn-open-dashboard');
  if (openDashboardBtn) {
    openDashboardBtn.addEventListener('click', () => {
      closeModal();
      openUserDashboardAsAdminMaster(user);
    });
  }

  const logsListEl = modal.querySelector('#user-inspector-logs-list');
  const pageIndicator = modal.querySelector('#user-inspector-page-indicator');
  const pageCountEl = modal.querySelector('#user-inspector-page-count');
  const prevBtn = modal.querySelector('#btn-inspector-prev');
  const nextBtn = modal.querySelector('#btn-inspector-next');

  function renderPage(page) {
    currentLogsPage = page;
    const totalPages = Math.ceil(userLogs.length / pageSize) || 1;
    const startIndex = (currentLogsPage - 1) * pageSize;
    const pagedLogs = userLogs.slice(startIndex, startIndex + pageSize);

    if (pageIndicator) pageIndicator.innerText = `පිටුව ${currentLogsPage} / ${totalPages}`;
    if (pageCountEl) {
      pageCountEl.innerText = userLogs.length > 0
        ? `සටහන් ${startIndex + 1} - ${Math.min(startIndex + pageSize, userLogs.length)} (${userLogs.length} න්)`
        : 'සටහන් නොමැත';
    }

    if (prevBtn) prevBtn.disabled = currentLogsPage <= 1;
    if (nextBtn) nextBtn.disabled = currentLogsPage >= totalPages;

    if (pagedLogs.length === 0) {
      logsListEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 italic">මෙම පරිශීලකයා සඳහා ක්‍රියාකාරකම් සටහන් වී නොමැත.</div>`;
      return;
    }

    logsListEl.innerHTML = pagedLogs.map(l => {
      let badgeColor = 'bg-slate-100 text-slate-700';
      if (l.actionType === 'task_completed') badgeColor = 'bg-emerald-100 text-emerald-800';
      else if (l.actionType === 'task_uncompleted') badgeColor = 'bg-rose-100 text-rose-800';
      else if (l.actionType === 'timer_started') badgeColor = 'bg-blue-100 text-blue-800';
      else if (l.actionType === 'wake_up') badgeColor = 'bg-amber-100 text-amber-800';
      else if (l.actionType === 'user_switch') badgeColor = 'bg-purple-100 text-purple-800';

      return `
        <div class="user-paged-log-item p-3 bg-slate-50 hover:bg-purple-50/70 border border-slate-200 hover:border-purple-300 rounded-2xl flex items-center justify-between gap-3 text-xs transition cursor-pointer" data-log-id="${l.id}">
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeColor}">${l.actionType}</span>
              <span class="font-mono text-[10px] text-slate-400">${l.timeStr || ''} • ${l.dateStr || ''}</span>
            </div>
            <span class="font-bold text-slate-800 block mt-1 truncate">${l.details}</span>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${l.pointsDelta ? `<span class="text-xs font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">+${l.pointsDelta} pts</span>` : ''}
            <span class="text-slate-400 text-xs">ℹ️</span>
          </div>
        </div>
      `;
    }).join('');

    // Requirement 6: When clicked log entry show full details
    logsListEl.querySelectorAll('.user-paged-log-item').forEach(item => {
      item.addEventListener('click', () => {
        const logId = item.dataset.logId;
        const foundLog = userLogs.find(l => l.id === logId);
        if (foundLog) openLogDetailsModal(foundLog);
      });
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (currentLogsPage > 1) renderPage(currentLogsPage - 1);
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(userLogs.length / pageSize) || 1;
      if (currentLogsPage < totalPages) renderPage(currentLogsPage + 1);
    });
  }

  renderPage(1);
}

/**
 * Requirement 4: Load full dashboard of any user clicked and make changes without password or user knowledge
 */
function openUserDashboardAsAdminMaster(user) {
  if (!user) return;

  // 1. Authorize user without PIN or user knowledge
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(`wosandi_auth_user_${user.id}`, "true");
    sessionStorage.setItem("wosandi_admin_master_active", user.id);
  }

  // 2. Switch to this user
  if (window.userManagerClient) {
    window.userManagerClient.setCurrentUser(user, true);
  }

  // 3. Hide admin monitoring container & show standard dashboard elements
  const adminContainer = document.getElementById('admin-monitoring-container');
  if (adminContainer) adminContainer.classList.add('hidden');

  const progressRing = document.querySelector('.relative.w-44.h-44');
  if (progressRing) progressRing.classList.remove('hidden');
  const badgeContainer = document.getElementById('badge-container');
  if (badgeContainer) badgeContainer.classList.remove('hidden');
  const quickBar = document.getElementById('quick-add-task-bar');
  if (quickBar) quickBar.classList.remove('hidden');
  const fastingCard = document.getElementById('fasting-tracker-card-container');
  if (fastingCard) fastingCard.classList.remove('hidden');
  const recentSec = document.getElementById('recent-changes-section');
  if (recentSec) recentSec.classList.remove('hidden');
  document.querySelectorAll('.routine-section:not([data-section-id="school"])').forEach(el => el.classList.remove('hidden'));

  // 4. Inject top Admin Master Bar
  let masterBar = document.getElementById('admin-master-bar');
  if (!masterBar) {
    masterBar = document.createElement('div');
    masterBar.id = 'admin-master-bar';
    const mainContent = document.querySelector('main') || document.querySelector('header');
    if (mainContent && mainContent.parentNode) {
      mainContent.parentNode.insertBefore(masterBar, mainContent.nextSibling);
    } else {
      document.body.prepend(masterBar);
    }
  }

  masterBar.className = "max-w-md mx-auto px-4 pt-2";
  masterBar.innerHTML = `
    <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-3.5 rounded-2xl shadow-xl border-2 border-amber-400 flex items-center justify-between gap-3 font-['Noto_Sans_Sinhala'] animate-in fade-in duration-200">
      <div class="flex items-center gap-2.5 min-w-0">
        <span class="w-9 h-9 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black text-lg shrink-0 shadow-inner">🛡️</span>
        <div class="min-w-0">
          <div class="flex items-center gap-1.5">
            <span class="font-extrabold text-amber-300 text-xs truncate">පරිපාලක පාලන ප්‍රකාරය (Admin Master Mode)</span>
          </div>
          <span class="text-slate-300 text-[11px] block truncate">ඔබ සංස්කරණය කරන්නේ <strong>${user.display_name || user.username}</strong> ගේ Dashboard එකයි (මුරපද අවශ්‍ය නැත).</span>
        </div>
      </div>
      <button type="button" id="btn-return-admin-hub" class="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-extrabold rounded-xl transition flex items-center gap-1.5 text-xs shadow-md cursor-pointer shrink-0">
        <i class="fas fa-shield-alt"></i> ආපසු
      </button>
    </div>
  `;

  const returnBtn = masterBar.querySelector('#btn-return-admin-hub');
  if (returnBtn) {
    returnBtn.addEventListener('click', () => {
      masterBar.remove();
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem("wosandi_admin_master_active");
      }
      const adminUser = window.userManagerClient?.users?.find(u => u.role === 'admin' || u.id === 'user_admin');
      if (adminUser) {
        window.userManagerClient.setCurrentUser(adminUser, true);
        renderAdminMonitoringDashboard();
      }
    });
  }

  // Load published tasks for this user
  if (typeof loadPublishedTasksFromAdmin === 'function') {
    loadPublishedTasksFromAdmin();
  }
}

window.openLogDetailsModal = openLogDetailsModal;
window.openAdminUserInspectorModal = openAdminUserInspectorModal;
window.openUserDashboardAsAdminMaster = openUserDashboardAsAdminMaster;

// =========================================================================
// Dynamic Published Tasks from Admin Panel (wosandi_tasks)
// =========================================================================
async function loadPublishedTasksFromAdmin() {
  if (typeof document === 'undefined') return;

  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa' };

  // Requirement 7: Admin profile displays monitoring hub and activity logs without tasks
  if (currentUser.role === 'admin' || currentUser.id === 'user_admin') {
    renderAdminMonitoringDashboard();
    return;
  }

  // Restore dashboard elements for non-admin profiles
  const adminContainer = document.getElementById('admin-monitoring-container');
  if (adminContainer) adminContainer.classList.add('hidden');
  const progressRing = document.querySelector('.relative.w-44.h-44');
  if (progressRing) progressRing.classList.remove('hidden');
  const badgeContainer = document.getElementById('badge-container');
  if (badgeContainer) badgeContainer.classList.remove('hidden');
  const quickBar = document.getElementById('quick-add-task-bar');
  if (quickBar) quickBar.classList.remove('hidden');
  const fastingCard = document.getElementById('fasting-tracker-card-container');
  if (fastingCard) fastingCard.classList.remove('hidden');
  const recentSec = document.getElementById('recent-changes-section');
  if (recentSec) recentSec.classList.remove('hidden');
  document.querySelectorAll('.routine-section:not([data-section-id="school"])').forEach(el => el.classList.remove('hidden'));

  // Always ensure state is synchronized with the latest saved routine state for today
  const todayDateStr = new Date().toISOString().split('T')[0];
  const userSaveKey = (typeof window !== 'undefined' && window.userManagerClient?.getRoutineStateKey)
    ? window.userManagerClient.getRoutineStateKey(todayDateStr)
    : ('wosandi_routine_state_' + todayDateStr);

  try {
    const rawSaved = (typeof localStorage !== 'undefined')
      ? (localStorage.getItem(userSaveKey) || localStorage.getItem('wosandi_routine_state_' + todayDateStr))
      : null;
    if (rawSaved) {
      const savedObj = JSON.parse(rawSaved);
      if (savedObj && typeof savedObj === 'object') {
        Object.keys(savedObj).forEach(k => {
          if (state[k] === undefined && savedObj[k] !== undefined) {
            state[k] = savedObj[k];
          } else if (savedObj[k] === true) {
            state[k] = true;
          }
        });
      }
    }
  } catch (e) {}

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

  // Merge with local cache so newly added / offline tasks and overrides are NEVER lost
  try {
    const cachedRaw = localStorage.getItem('wosandi_admin_wosandi_tasks');
    if (cachedRaw) {
      const cachedList = JSON.parse(cachedRaw);
      if (Array.isArray(cachedList)) {
        if (!publishedTasks || publishedTasks.length === 0) {
          publishedTasks = cachedList.filter(t => t.status === 'published');
        } else {
          const publishedMap = new Map(publishedTasks.map(t => [t.id, t]));
          for (const ct of cachedList) {
            if (ct && ct.id && ct.status === 'published' && !publishedMap.has(ct.id)) {
              publishedTasks.push(ct);
              publishedMap.set(ct.id, ct);
            }
          }
        }
      }
    }
  } catch (e) {}

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

  // Requirement 4.1: User-specific overrides for global tasks
  // If currentUser customized a global task, use that override instead of the global task
  const userOverrides = publishedTasks.filter(t => 
    t.schema_definition?.is_user_override && 
    (t.schema_definition?.target_profile === currentUser.id || t.target_profile === currentUser.id)
  );
  const overrideMap = new Map();
  userOverrides.forEach(ov => {
    if (ov.schema_definition?.original_task_id) {
      overrideMap.set(ov.schema_definition.original_task_id, ov);
    }
  });

  const matchedTasks = [];

  if (Array.isArray(publishedTasks) && publishedTasks.length > 0) {
    publishedTasks.forEach(rawTask => {
      // Skip override records directly from top-level loop; they will be substituted in place of their original task
      if (rawTask.schema_definition?.is_user_override) {
        return;
      }

      let task = rawTask;
      if (overrideMap.has(rawTask.id)) {
        const override = overrideMap.get(rawTask.id);
        if (override.schema_definition?.is_hidden) {
          return; // User chose to hide this task from their dashboard
        }
        task = { ...rawTask, ...override, schema_definition: { ...rawTask.schema_definition, ...override.schema_definition } };
      }

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

      // Check day-of-week schedule or next_run_date if configured (Requirement 4.4, 4.4 & 4.5)
      const now = new Date();
      const sched = task.schema_definition?.schedule;
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (sched) {
        if (sched.frequency === 'monthly' || sched.frequency === 'yearly') {
          if (sched.next_run_date && sched.next_run_date !== todayStr) {
            return;
          }
        } else if (Array.isArray(sched?.days_of_week) && sched.days_of_week.length > 0 && !sched.days_of_week.includes(now.getDay())) {
          return;
        }
      }

      // Add to matchedTasks for this user so it participates in total marks calculation
      matchedTasks.push(task);

      const cat = (task.category || 'general').toLowerCase();
      const container = targetLists[cat] || targetLists.general;
      if (!container) return;

      const origId = task.schema_definition?.original_task_id || rawTask.id;
      const key = task.schema_definition?.linked_state_key || origId || task.id;
      if (state[task.id] === undefined) {
        state[task.id] = (origId && state[origId] !== undefined)
          ? Boolean(state[origId])
          : (key && state[key] !== undefined ? Boolean(state[key]) : false);
      }
      if (origId && state[origId] === true) {
        state[task.id] = true;
      }
      if (state[task.id] === true && origId) {
        state[origId] = true;
      }
      const isChecked = Boolean(state[task.id] || (origId && state[origId]) || (key && state[key]));

      // Requirement 3: Time scheduling lifecycle
      const timeFrom = sched?.custom_time_from;
      const timeTo = sched?.custom_time_to;
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let hasStarted = true;
      let hasEnded = false;

      if (timeFrom) {
        const [fromH, fromM] = timeFrom.split(':').map(Number);
        const fromMinutes = (isNaN(fromH) ? 0 : fromH) * 60 + (isNaN(fromM) ? 0 : fromM);
        hasStarted = currentMinutes >= fromMinutes;
      }

      if (timeTo) {
        const [toH, toM] = timeTo.split(':').map(Number);
        const toMinutes = (isNaN(toH) ? 0 : toH) * 60 + (isNaN(toM) ? 0 : toM);
        hasEnded = currentMinutes > toMinutes;
      }

      // Requirement 3: If scheduled time window has passed today (e.g. ended at 13:00, now is 13:01):
      // "if the play cricket task end at 1300hrs then the play cricket taks not display but total at 1301hrs still 35"
      if (hasEnded) {
        return; // Do NOT display expired task in active checklist
      }

      const scopeBadge = isGlobal ? '' : `<span class="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-100 ml-1.5">🔒 Personal</span>`;

      // If scheduled start time has not arrived yet and not checked:
      // Display as an upcoming scheduled preview without active checkbox so denominator is not affected until start time
      if (!hasStarted && !isChecked) {
        const upcomingRow = document.createElement('div');
        upcomingRow.setAttribute('data-upcoming-task-id', task.id);
        upcomingRow.className = 'flex items-center justify-between p-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-slate-500 font-["Noto_Sans_Sinhala"] transition-all';
        upcomingRow.innerHTML = `
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold">${task.icon || autoDetermineIcon(task.title_si || task.title_en, task.category)} ${task.title_si || task.title_en}</span>
            <span class="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">⏳ ${timeFrom} ට ආරම්භ වේ</span>
            ${scopeBadge}
          </div>
          <span class="text-[10px] font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200">+${task.weight_points || 10}</span>
        `;
        container.appendChild(upcomingRow);
        return;
      }

      // Active task row (started and not ended, or checked)
      let timeSubtitle = '';
      if (timeFrom && timeTo) {
        timeSubtitle = `<span class="text-[10px] text-slate-400 block font-sans">⏰ ${timeFrom} - ${timeTo}</span>`;
      } else if (timeFrom) {
        timeSubtitle = `<span class="text-[10px] text-slate-400 block font-sans">⏰ ආරම්භය: ${timeFrom}</span>`;
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

      row.innerHTML = `
        <div class="flex flex-col">
          <div class="flex items-center">
            <span class="text-xs font-semibold font-['Noto_Sans_Sinhala']">${task.icon || autoDetermineIcon(task.title_si || task.title_en, task.category)} ${task.title_si || task.title_en}</span>
            ${scopeBadge}
          </div>
          ${timeSubtitle}
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

  // Requirement 5: Remove interactive questionnaire if no data available
  const flowSec = document.getElementById('published-flow-section');
  if (flowSec && (!window.flowPlayer || !window.flowPlayer.flow || !window.flowPlayer.flow.flow_data || !window.flowPlayer.flow.flow_data.nodes || window.flowPlayer.flow.flow_data.nodes.length === 0)) {
    flowSec.classList.add('hidden');
    flowSec.style.display = 'none';
    document.querySelectorAll('.routine-lock-banner[data-for="flow"]').forEach(b => b.remove());
  }

  reorderAllTaskLists();
  syncStateToUI();
  if (typeof syncProgressWithServer === 'function') {
    syncProgressWithServer(state, true);
  }
}

// =========================================================================
// Quick Add Task Hub & Settings Modal (Requirements 1, 2, 4, 4.1)
// =========================================================================
async function openAddQuickTaskModal() {
  const initialTab = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : 'add';
  if (typeof document === 'undefined') return;

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
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
      <!-- Modal Header -->
      <div class="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
        <div class="flex items-center gap-2.5">
          <span class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shadow-2xs">
            <i class="fas fa-tasks text-indigo-600"></i>
          </span>
          <div>
            <h3 class="text-sm sm:text-base font-bold text-gray-800">කාර්යයන් කළමනාකරණය (Tasks Hub)</h3>
            <span class="text-[10px] text-gray-500">පැතිකඩ: <strong>${currentUser.display_name || currentUser.username}</strong></span>
          </div>
        </div>
        <button type="button" id="close-quick-task-modal" class="text-gray-400 hover:text-gray-600 text-xl font-bold transition p-1 cursor-pointer">&times;</button>
      </div>

      <!-- Tab Switcher (Requirement 4) -->
      <div class="flex border-b border-slate-200 bg-slate-100/80 p-1.5 gap-1.5 shrink-0">
        <button type="button" id="tab-btn-add" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-indigo-700 shadow-xs cursor-pointer">
          <i class="fas fa-plus-circle text-indigo-600"></i> 1. නව කාර්යයන් එක් කරන්න (Add Tasks)
        </button>
        <button type="button" id="tab-btn-settings" class="flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white/60 cursor-pointer">
          <i class="fas fa-sliders-h text-slate-500"></i> 2. දැනට ඇති කාර්යයන් සහ සැකසුම් (Settings)
        </button>
      </div>

      <!-- Tab 1: Add Tasks (Requirements 1.1 - 1.8, 2.1) -->
      <div id="tab-content-add" class="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
        <!-- Target Profile Notice (Requirement 1.2: always current user profile) -->
        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
          <div class="flex items-center gap-2">
            <span class="text-base">${currentUser.avatar || '👤'}</span>
            <span class="font-bold">අදාළ පැතිකඩ: ${currentUser.display_name || currentUser.username}</span>
          </div>
          <span class="text-[11px] font-extrabold bg-white text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200 shadow-2xs">
            🔒 තෝරාගත් පැතිකඩට පමණි
          </span>
        </div>

        <!-- Mode Toggle: Card Form vs Bulk Text Entry (Requirement 2.1) -->
        <div class="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-200 text-xs">
          <span class="font-bold text-slate-700">එක් කිරීමේ ක්‍රමය:</span>
          <div class="flex gap-1">
            <button type="button" id="mode-btn-cards" class="px-3 py-1 rounded-lg text-xs font-bold bg-white text-purple-700 shadow-2xs border border-purple-200 cursor-pointer">
              📋 කාඩ්පත් මඟින්
            </button>
            <button type="button" id="mode-btn-bulk" class="px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer">
              ⚡ එකවර පෙළ ලෙස (Bulk Text)
            </button>
          </div>
        </div>

        <!-- Mode A: Task Cards List (Dynamic multiple inputs - Requirement 2.1) -->
        <div id="cards-mode-container" class="space-y-4">
          <div id="task-cards-wrapper" class="space-y-3.5">
            <!-- Render initial card -->
          </div>

          <div class="flex flex-col sm:flex-row justify-between gap-3 pt-2">
            <button type="button" id="btn-add-another-task-card" class="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-plus"></i> + තවත් කාර්යයක් එක් කරන්න (Add Another Task)
            </button>
            <button type="button" id="btn-save-all-cards" class="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-save"></i> සියල්ල සුරකින්න (Save All Tasks)
            </button>
          </div>
        </div>

        <!-- Mode B: Bulk Fast Entry (Requirement 2.1) -->
        <div id="bulk-mode-container" class="hidden space-y-3.5">
          <div class="bg-amber-50/70 p-3 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            <i class="fas fa-info-circle mr-1 text-amber-600"></i>
            එකවර කාර්යයන් කිහිපයක් එක් කිරීමට සෑම පේළියකම එක් කාර්යයක නම බැගින් ඇතුළත් කරන්න.
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">කාර්යයන් ලැයිස්තුව (එක් පේළියකට එකක්):</label>
            <textarea id="bulk-tasks-text" rows="5" placeholder="උදා:&#10;ගණිතය ප්‍රශ්න 5ක් විසඳීම&#10;නැටුම් අභ්‍යාස විනාඩි 20ක්&#10;පොත් කියවීම&#10;කාමරය අස් කිරීම" class="w-full p-3 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala'] leading-relaxed"></textarea>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">වර්ගය:</label>
              <select id="bulk-category" class="w-full p-2 border rounded-xl text-xs bg-white">
                <option value="academic">අධ්‍යාපනික (Academic)</option>
                <option value="physical">ශාරීරික / නැටුම් (Physical)</option>
                <option value="chores" selected>ගෙදර දොර (Chores)</option>
                <option value="habits">පුරුදු (Habits)</option>
                <option value="general">සාමාන්‍ය (General)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">ලකුණු (Points):</label>
              <input type="number" id="bulk-points" value="10" min="1" max="100" class="w-full p-2 border rounded-xl text-xs">
            </div>
          </div>
          <button type="button" id="btn-save-bulk-tasks" class="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
            <i class="fas fa-bolt"></i> සියලු කාර්යයන් එකවර එක් කරන්න (Add Bulk Tasks)
          </button>
        </div>
      </div>

      <!-- Tab 2: Current Tasks Settings (Requirements 4, 4.1) -->
      <div id="tab-content-settings" class="hidden p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
        <div class="bg-indigo-50/70 p-3 rounded-2xl border border-indigo-200 text-xs text-indigo-950 flex items-center justify-between">
          <div>
            <span class="font-bold block">දැනට ඇති කාර්යයන් සැකසුම් (Settings & Overrides)</span>
            <span class="text-[11px] text-indigo-700">පොදු (Global) කාර්යයක් ඔබ වෙනස් කළහොත් එය අනෙක් අයට බලනොපායි (4.1).</span>
          </div>
          <span class="text-xl">⚙️</span>
        </div>
        <div id="current-tasks-settings-list" class="space-y-3">
          <!-- Rendered dynamically -->
        </div>
      </div>

      <!-- Compatibility elements for legacy schema and tests -->
      <div class="hidden" style="display:none;" aria-hidden="true">
        <input type="text" id="qt-title-si" value="">
        <input type="text" id="qt-title-en" value="">
        <select id="qt-target-profile"><option value="${currentUser.id}" selected>තෝරාගත් පැතිකඩට පමණි</option></select>
        <select id="qt-category"><option value="general" selected>සාමාන්‍ය</option></select>
        <select id="qt-subject"><option value="general" selected>සාමාන්‍ය</option></select>
        <select id="qt-tier"><option value="routine_baseline" selected>දෛනික</option></select>
        <input type="number" id="qt-points" value="10">
        <input type="text" id="qt-icon" value="📋">
        <input type="number" id="qt-sort-order" value="0">
        <select id="qt-status"><option value="published" selected>ප්‍රකාශිතයි</option></select>
        <select id="qt-frequency"><option value="daily" selected>දිනපතා</option></select>
        <input type="checkbox" id="qt-has-timer">
        <select id="qt-timer-seconds"><option value="600" selected>10m</option></select>
        <textarea id="qt-description"></textarea>
      </div>
    </div>
  `;

  const closeModal = () => modal.remove();
  modal.querySelector("#close-quick-task-modal").addEventListener("click", closeModal);

  // Tabs Switcher Logic
  const tabBtnAdd = modal.querySelector("#tab-btn-add");
  const tabBtnSettings = modal.querySelector("#tab-btn-settings");
  const tabContentAdd = modal.querySelector("#tab-content-add");
  const tabContentSettings = modal.querySelector("#tab-content-settings");

  const switchTab = (tab) => {
    if (tab === 'add') {
      tabBtnAdd.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-indigo-700 shadow-xs cursor-pointer";
      tabBtnSettings.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white/60 cursor-pointer";
      tabContentAdd.classList.remove("hidden");
      tabContentSettings.classList.add("hidden");
    } else {
      tabBtnSettings.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 bg-white text-indigo-700 shadow-xs cursor-pointer";
      tabBtnAdd.className = "flex-1 py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-600 hover:text-indigo-600 hover:bg-white/60 cursor-pointer";
      tabContentSettings.classList.remove("hidden");
      tabContentAdd.classList.add("hidden");
      renderCurrentTasksSettings();
    }
  };

  tabBtnAdd.addEventListener("click", () => switchTab('add'));
  tabBtnSettings.addEventListener("click", () => switchTab('settings'));

  if (initialTab === 'settings') {
    switchTab('settings');
  }

  // Mode Switcher Logic: Cards vs Bulk
  const modeBtnCards = modal.querySelector("#mode-btn-cards");
  const modeBtnBulk = modal.querySelector("#mode-btn-bulk");
  const cardsModeContainer = modal.querySelector("#cards-mode-container");
  const bulkModeContainer = modal.querySelector("#bulk-mode-container");

  modeBtnCards.addEventListener("click", () => {
    modeBtnCards.className = "px-3 py-1 rounded-lg text-xs font-bold bg-white text-purple-700 shadow-2xs border border-purple-200 cursor-pointer";
    modeBtnBulk.className = "px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer";
    cardsModeContainer.classList.remove("hidden");
    bulkModeContainer.classList.add("hidden");
  });

  modeBtnBulk.addEventListener("click", () => {
    modeBtnBulk.className = "px-3 py-1 rounded-lg text-xs font-bold bg-white text-purple-700 shadow-2xs border border-purple-200 cursor-pointer";
    modeBtnCards.className = "px-3 py-1 rounded-lg text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer";
    bulkModeContainer.classList.remove("hidden");
    cardsModeContainer.classList.add("hidden");
  });

  // Task Cards Management
  const cardsWrapper = modal.querySelector("#task-cards-wrapper");
  let cardCounter = 0;
  const todayDateStr = new Date().toISOString().split('T')[0];

  function createTaskCardHtml(cardId, initialTitle = '') {
    return `
      <div class="task-input-card bg-slate-50/90 border border-slate-200 rounded-2xl p-4 space-y-3 relative transition hover:border-indigo-300" data-card-id="${cardId}">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold card-num-badge">1</span>
            <span class="text-xs font-bold text-slate-700">කාර්යය විස්තර (Task Details)</span>
            <span class="card-icon-preview text-base ml-1" title="ස්වයංක්‍රීය Icon">${autoDetermineIcon(initialTitle)}</span>
          </div>
          <button type="button" class="btn-remove-card text-slate-400 hover:text-rose-500 transition text-sm p-1 cursor-pointer" title="මෙම කාර්යය ඉවත් කරන්න">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>

        <!-- Title only (Requirement 1.1: English title removed) -->
        <div>
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">මාතෘකාව / කාර්යයේ නම *</label>
          <input type="text" class="card-title-input w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala'] bg-white" required placeholder="උදා: ගණිතය ප්‍රශ්න 5ක් විසඳීම" value="${initialTitle}">
        </div>

        <!-- Category & Points -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">වර්ගය (Category):</label>
            <select class="card-category-select w-full p-2 border rounded-xl text-xs bg-white">
              <option value="academic">අධ්‍යාපනික (Academic)</option>
              <option value="physical">ශාරීරික / නැටුම් (Physical)</option>
              <option value="chores" selected>ගෙදර දොර (Chores)</option>
              <option value="habits">පුරුදු (Habits)</option>
              <option value="general">සාමාන්‍ය (General)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-bold text-gray-700 mb-1">ලබාදෙන ලකුණු (Points):</label>
            <input type="number" class="card-points-input w-full p-2 border rounded-xl text-xs font-bold" value="10" min="1" max="100">
          </div>
        </div>

        <!-- Frequency & Days of Week (Requirement 1.6 & 4.1 - 4.5) -->
        <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
          <div class="flex items-center justify-between">
            <label class="block text-xs font-bold text-slate-800">පුනරාවර්තනය (Recurrence):</label>
            <select class="card-freq-select p-1.5 border rounded-lg text-xs bg-slate-50 font-semibold">
              <option value="daily" selected>දිනපතා (Daily)</option>
              <option value="weekly">සතිපතා (Weekly)</option>
              <option value="monthly">මාසිකව (Monthly)</option>
              <option value="yearly">වාර්ෂිකව (Yearly)</option>
            </select>
          </div>

          <!-- Days of Week Checkboxes (Requirement 4.1: default all selected; 4.2: background color when activated) -->
          <div class="card-dow-container pt-1">
            <label class="block text-[11px] font-semibold text-slate-600 mb-1">අදාළ සතියේ දිනයන් තෝරන්න (Days of Week):</label>
            <div class="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[11px]">
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="1" checked>
                <span>සඳුදා</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="2" checked>
                <span>අඟහ</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="3" checked>
                <span>බදාදා</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="4" checked>
                <span>බ්‍රහස්</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="5" checked>
                <span>සිකු</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="6" checked>
                <span>සෙන</span>
              </label>
              <label class="flex items-center justify-center p-1.5 rounded-lg border border-slate-200 cursor-pointer text-center font-medium bg-slate-50 transition-all card-dow-label">
                <input type="checkbox" class="card-dow-check sr-only" value="0" checked>
                <span>ඉරිදා</span>
              </label>
            </div>
          </div>

          <!-- Next Date Picker for Monthly & Yearly (Requirement 4.4 & 4.5) -->
          <div class="card-next-date-container hidden pt-2 border-t border-slate-100 space-y-1">
            <label class="block text-[11px] font-bold text-slate-700">ඊළඟ දිනය (Next Date):</label>
            <input type="date" class="card-next-date w-full p-2 border rounded-xl text-xs bg-slate-50 focus:bg-white font-mono" value="${todayDateStr}">
          </div>
        </div>

        <!-- Preferred Time & Custom Time Range (Requirement 3: all 5 checked by default; 4.2: background color when activated) -->
        <div class="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5">
          <label class="block text-xs font-bold text-slate-800">සුදුසු වේලාව (Preferred Time Slots):</label>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
            <label class="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 transition-all card-slot-label">
              <input type="checkbox" class="card-time-slot" value="morning" checked>
              <span>🌅 උදෑසන</span>
            </label>
            <label class="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 transition-all card-slot-label">
              <input type="checkbox" class="card-time-slot" value="afternoon" checked>
              <span>☀️ දහවල්</span>
            </label>
            <label class="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 transition-all card-slot-label">
              <input type="checkbox" class="card-time-slot" value="evening" checked>
              <span>🌇 සවස</span>
            </label>
            <label class="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 transition-all card-slot-label">
              <input type="checkbox" class="card-time-slot" value="night" checked>
              <span>🌙 රාත්‍රී</span>
            </label>
            <label class="flex items-center gap-1.5 p-1.5 rounded-lg border border-slate-200 cursor-pointer bg-slate-50 col-span-2 sm:col-span-1 transition-all card-slot-label">
              <input type="checkbox" class="card-time-slot" value="anytime" checked>
              <span>🔄 Flexible</span>
            </label>
          </div>

          <!-- Custom Time Range (From - To) -->
          <div class="pt-2 border-t border-slate-100 space-y-1.5">
            <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-indigo-900">
              <input type="checkbox" class="card-has-custom-time">
              <span>⏰ නියමිත වේලාවක් සකසන්න (Custom Period: From - To)</span>
            </label>
            <div class="card-custom-time-row hidden grid grid-cols-2 gap-2 pt-1">
              <div>
                <span class="text-[10px] text-slate-500 block mb-0.5">සිට (From):</span>
                <input type="time" class="card-time-from w-full p-1.5 border rounded-lg text-xs" value="07:00">
              </div>
              <div>
                <span class="text-[10px] text-slate-500 block mb-0.5">දක්වා (To):</span>
                <input type="time" class="card-time-to w-full p-1.5 border rounded-lg text-xs" value="08:00">
              </div>
            </div>
          </div>
        </div>

        <!-- Optional Timer -->
        <div class="p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl flex items-center justify-between text-xs">
          <label class="flex items-center gap-2 cursor-pointer font-bold text-purple-900">
            <input type="checkbox" class="card-has-timer">
            <span>⏱️ Timer එකක් එක් කරන්න</span>
          </label>
          <select class="card-timer-seconds hidden p-1 border border-purple-300 rounded-lg text-xs bg-white">
            <option value="300">විනාඩි 5 (300s)</option>
            <option value="600" selected>විනාඩි 10 (600s)</option>
            <option value="900">විනාඩි 15 (900s)</option>
            <option value="1200">විනාඩි 20 (1200s)</option>
            <option value="1800">විනාඩි 30 (1800s)</option>
            <option value="3600">පැය 1 (3600s)</option>
          </select>
        </div>
      </div>
    `;
  }

  function addCard(initialTitle = '') {
    cardCounter++;
    const cardEl = document.createElement("div");
    cardEl.innerHTML = createTaskCardHtml(cardCounter, initialTitle);
    const cardNode = cardEl.firstElementChild;
    cardsWrapper.appendChild(cardNode);

    // Auto update icon preview on typing
    const titleInput = cardNode.querySelector('.card-title-input');
    const iconPreview = cardNode.querySelector('.card-icon-preview');
    const catSelect = cardNode.querySelector('.card-category-select');
    const updateIcon = () => {
      iconPreview.innerText = autoDetermineIcon(titleInput.value, catSelect.value);
    };
    titleInput.addEventListener('input', updateIcon);
    catSelect.addEventListener('change', updateIcon);

    // Days of week style toggling (Requirement 4.2: background color when activated)
    cardNode.querySelectorAll('.card-dow-check').forEach(chk => {
      const updateCheckStyle = () => {
        const parent = chk.closest('label');
        if (chk.checked) {
          parent.classList.add('bg-indigo-100', 'border-indigo-300', 'text-indigo-900', 'font-bold', 'shadow-2xs');
          parent.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-200', 'font-medium');
        } else {
          parent.classList.remove('bg-indigo-100', 'border-indigo-300', 'text-indigo-900', 'font-bold', 'shadow-2xs');
          parent.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200', 'font-medium');
        }
      };
      chk.addEventListener('change', updateCheckStyle);
      updateCheckStyle();
    });

    // Time slots style toggling (Requirement 4.2: background color when activated)
    cardNode.querySelectorAll('.card-time-slot').forEach(chk => {
      const updateSlotStyle = () => {
        const parent = chk.closest('label');
        if (chk.checked) {
          parent.classList.add('bg-indigo-100', 'border-indigo-300', 'text-indigo-900', 'font-bold', 'shadow-2xs');
          parent.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-200', 'font-medium');
        } else {
          parent.classList.remove('bg-indigo-100', 'border-indigo-300', 'text-indigo-900', 'font-bold', 'shadow-2xs');
          parent.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-200', 'font-medium');
        }
      };
      chk.addEventListener('change', updateSlotStyle);
      updateSlotStyle();
    });

    // Frequency & Days of Week relationship (Requirement 4.4, 4.4/4.5)
    const freqSelect = cardNode.querySelector('.card-freq-select');
    const nextDateContainer = cardNode.querySelector('.card-next-date-container');
    const dowChecks = cardNode.querySelectorAll('.card-dow-check');

    freqSelect.addEventListener('change', () => {
      const val = freqSelect.value;
      if (val === 'weekly' || val === 'monthly' || val === 'yearly') {
        // Only Monday should be selected (Requirement 4.4)
        dowChecks.forEach(chk => {
          chk.checked = (chk.value === '1');
          chk.dispatchEvent(new Event('change'));
        });
      } else if (val === 'daily') {
        // All 7 days selected
        dowChecks.forEach(chk => {
          chk.checked = true;
          chk.dispatchEvent(new Event('change'));
        });
      }

      // Next date for monthly and yearly (Requirement 4.4 & 4.5)
      if (val === 'monthly' || val === 'yearly') {
        nextDateContainer.classList.remove('hidden');
      } else {
        nextDateContainer.classList.add('hidden');
      }
    });

    // Custom time toggle
    const customTimeChk = cardNode.querySelector('.card-has-custom-time');
    const customTimeRow = cardNode.querySelector('.card-custom-time-row');
    customTimeChk.addEventListener('change', (e) => {
      customTimeRow.classList.toggle('hidden', !e.target.checked);
    });

    // Timer toggle
    const hasTimerChk = cardNode.querySelector('.card-has-timer');
    const timerSelect = cardNode.querySelector('.card-timer-seconds');
    hasTimerChk.addEventListener('change', (e) => {
      timerSelect.classList.toggle('hidden', !e.target.checked);
    });

    // Remove card
    cardNode.querySelector('.btn-remove-card').addEventListener('click', () => {
      if (cardsWrapper.querySelectorAll('.task-input-card').length > 1) {
        cardNode.remove();
        updateCardNumbers();
      } else {
        alert('අවම වශයෙන් එක් කාර්යයක් හෝ තිබිය යුතුය.');
      }
    });

    updateCardNumbers();
  }

  function updateCardNumbers() {
    cardsWrapper.querySelectorAll('.task-input-card').forEach((card, idx) => {
      const badge = card.querySelector('.card-num-badge');
      if (badge) badge.innerText = String(idx + 1);
    });
  }

  // Add initial card
  addCard();

  modal.querySelector("#btn-add-another-task-card").addEventListener("click", () => addCard());

  // Save All Task Cards
  modal.querySelector("#btn-save-all-cards").addEventListener("click", async () => {
    const cardNodes = cardsWrapper.querySelectorAll('.task-input-card');
    const tasksToSave = [];

    for (const card of cardNodes) {
      const title = card.querySelector('.card-title-input').value.trim();
      if (!title) {
        alert('කරුණාකර සියලු කාර්යයන් සඳහා මාතෘකාවක් ඇතුළත් කරන්න.');
        card.querySelector('.card-title-input').focus();
        return;
      }
      const category = card.querySelector('.card-category-select').value;
      const points = parseFloat(card.querySelector('.card-points-input').value) || 10;
      const freq = card.querySelector('.card-freq-select').value;
      const dows = Array.from(card.querySelectorAll('.card-dow-check:checked')).map(c => parseInt(c.value));
      const timeSlots = Array.from(card.querySelectorAll('.card-time-slot:checked')).map(c => c.value);
      const hasCustomTime = card.querySelector('.card-has-custom-time').checked;
      const timeFrom = hasCustomTime ? card.querySelector('.card-time-from').value : null;
      const timeTo = hasCustomTime ? card.querySelector('.card-time-to').value : null;
      const nextDate = (freq === 'monthly' || freq === 'yearly') ? (card.querySelector('.card-next-date')?.value || todayDateStr) : null;
      const hasTimer = card.querySelector('.card-has-timer').checked;
      const timerSec = hasTimer ? parseInt(card.querySelector('.card-timer-seconds').value) : null;
      const icon = autoDetermineIcon(title, category);

      const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });

      // Target profile strictly locked to current user (Requirement 1.2)
      const targetProfile = currentUser?.id || 'user_wosa';

      tasksToSave.push({
        id: newId,
        title_si: title,
        title_en: title,
        category: category,
        tier: 'routine_baseline',
        weight_points: points,
        icon: icon,
        sort_order: 0,
        status: 'published',
        has_timer: hasTimer,
        timer_seconds: timerSec,
        schema_definition: {
          target_profile: targetProfile,
          schedule: {
            frequency: freq,
            days_of_week: dows,
            preferred_slots: timeSlots,
            preferred_time_slots: timeSlots,
            custom_time_from: timeFrom,
            custom_time_to: timeTo,
            next_run_date: nextDate
          },
          created_by_user: currentUser.id
        }
      });
    }

    await saveTasksList(tasksToSave);
  });

  // Save Bulk Mode Tasks
  modal.querySelector("#btn-save-bulk-tasks").addEventListener("click", async () => {
    const rawText = modal.querySelector("#bulk-tasks-text").value.trim();
    if (!rawText) {
      alert('කරුණාකර අවම වශයෙන් එක් කාර්යයක නමක් හෝ ඇතුළත් කරන්න.');
      return;
    }
    const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;

    const category = modal.querySelector("#bulk-category").value;
    const points = parseFloat(modal.querySelector("#bulk-points").value) || 10;
    const targetProfile = currentUser?.id || 'user_wosa';

    const tasksToSave = lines.map(title => {
      const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
          });
      return {
        id: newId,
        title_si: title,
        title_en: title,
        category: category,
        tier: 'routine_baseline',
        weight_points: points,
        icon: autoDetermineIcon(title, category),
        sort_order: 0,
        status: 'published',
        has_timer: false,
        timer_seconds: null,
        schema_definition: {
          target_profile: targetProfile,
          schedule: { frequency: 'daily', days_of_week: [0, 1, 2, 3, 4, 5, 6] },
          created_by_user: currentUser.id
        }
      };
    });

    await saveTasksList(tasksToSave);
  });

  function sanitizeTaskForSupabase(t) {
    const schema = { ...(t.schema_definition || {}) };
    if (t.target_profile && !schema.target_profile) {
      schema.target_profile = t.target_profile;
    }
    return {
      id: t.id,
      title_si: t.title_si,
      title_en: t.title_en || t.title_si,
      category: t.category || 'general',
      tier: t.tier || 'routine_baseline',
      weight_points: Number(t.weight_points) || 10,
      icon: t.icon || '📋',
      sort_order: parseInt(t.sort_order) || 0,
      status: t.status || 'published',
      has_timer: Boolean(t.has_timer),
      timer_seconds: t.timer_seconds || null,
      schema_definition: schema
    };
  }

  async function saveTasksList(tasks) {
    if (typeof window !== "undefined" && window.userManagerClient?.requireEditPermission) {
      const permitted = await window.userManagerClient.requireEditPermission("කාර්යයන් සුරැකීම");
      if (!permitted) return;
    }

    try {
      let cached = [];
      const raw = localStorage.getItem('wosandi_admin_wosandi_tasks');
      if (raw) cached = JSON.parse(raw);
      if (!Array.isArray(cached)) cached = [];

      // Update or append in local cache immediately
      for (const t of tasks) {
        const exIdx = cached.findIndex(x => x.id === t.id);
        if (exIdx >= 0) cached[exIdx] = t;
        else cached.push(t);
      }
      localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));

      // Batch save sanitized tasks to Supabase REST API (Requirement 4.3: cross-device persistence)
      const cleanTasks = tasks.map(sanitizeTaskForSupabase);
      const supabaseSaves = tasks.map((t, idx) =>
        fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks", {
          method: "POST",
          headers: {
            apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
            Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify(cleanTasks[idx])
        }).catch(err => console.warn("Supabase POST error:", err))
      );
      await Promise.all(supabaseSaves);

      if (tasks.length === 1) {
        recordUserActivity('task_added', `නව කාර්යයක් එක් කළා: ${tasks[0].title_si}`, 0);
      } else {
        recordUserActivity('task_added', `නව කාර්යයන් ${tasks.length}ක් එකවර එක් කළා`, 0);
      }
    } catch (e) {
      console.error("Error in saveTasksList:", e);
    }

    closeModal();
    await loadPublishedTasksFromAdmin();
    if (typeof playChime === "function") playChime();
  }

  // Render Current Tasks Settings (Requirements 4, 4.1)
  function renderCurrentTasksSettings() {
    const listEl = modal.querySelector("#current-tasks-settings-list");
    if (!listEl) return;

    let allTasks = Array.isArray(window.publishedAdminTasks) ? window.publishedAdminTasks : [];
    if (allTasks.length === 0) {
      try {
        const raw = localStorage.getItem('wosandi_admin_wosandi_tasks');
        if (raw) allTasks = JSON.parse(raw);
      } catch (e) {}
    }

    if (!allTasks || allTasks.length === 0) {
      listEl.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 italic">දැනට කිසිදු කාර්යයක් සකසා නැත.</div>`;
      return;
    }

    listEl.innerHTML = allTasks.map(t => {
      const isGlobal = !t.schema_definition?.target_profile || t.schema_definition?.target_profile === 'global' || t.target_profile === 'global';
      const isOverride = Boolean(t.schema_definition?.is_user_override);
      const scopeBadge = isOverride
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">✨ Custom Override</span>`
        : (isGlobal ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">🌐 Global</span>` : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 border border-purple-200">👤 Personal</span>`);

      const sched = t.schema_definition?.schedule;
      const timeStr = (sched?.custom_time_from && sched?.custom_time_to) ? `${sched.custom_time_from} - ${sched.custom_time_to}` : (sched?.frequency || 'දිනපතා');

      return `
        <div class="task-settings-row p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5 transition" data-task-id="${t.id}">
          <div class="flex items-center justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-xl shrink-0">${t.icon || autoDetermineIcon(t.title_si, t.category)}</span>
              <div class="min-w-0">
                <span class="font-bold text-slate-800 text-xs block truncate">${t.title_si || t.title_en}</span>
                <span class="text-[10px] text-slate-400 block">${t.category} • ${timeStr}</span>
              </div>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] font-bold text-pink-600 bg-pink-50 px-2 py-0.5 rounded-full border border-pink-100">+${t.weight_points || 10} pts</span>
              ${scopeBadge}
            </div>
          </div>

          <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
            <button type="button" class="btn-edit-task-settings px-3 py-1 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer">
              <i class="fas fa-edit text-[10px]"></i> සංස්කරණය
            </button>
            <button type="button" class="btn-hide-task-settings px-2.5 py-1 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer" title="${isGlobal ? 'මෙම පැතිකඩෙන් සඟවන්න' : 'ඉවත් කරන්න'}">
              <i class="fas fa-trash-alt text-[10px]"></i> ${isGlobal ? 'සඟවන්න' : 'ඉවත් කරන්න'}
            </button>
          </div>

          <!-- Inline Edit Form Container (Requirement 1 & 1.1: Full Settings Panel matching creation) -->
          <div class="inline-edit-container hidden pt-3 border-t border-indigo-100 space-y-3.5 bg-white p-4 rounded-2xl border shadow-xs mt-2 font-['Noto_Sans_Sinhala']">
            <div class="flex items-center justify-between pb-2 border-b border-slate-100">
              <span class="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                <i class="fas fa-sliders-h text-indigo-600"></i> සියලු සැකසුම් සංස්කරණය (Full Settings Panel)
              </span>
              <span class="edit-icon-preview text-xl" title="Icon Preview">${t.icon || autoDetermineIcon(t.title_si, t.category)}</span>
            </div>

            <!-- Title -->
            <div>
              <label class="block text-xs font-bold text-gray-700 mb-1">මාතෘකාව / කාර්යයේ නම *</label>
              <input type="text" class="edit-task-title w-full p-2.5 border rounded-xl text-xs bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-200" value="${t.title_si || t.title_en}">
            </div>

            <!-- Category & Points -->
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">වර්ගය (Category):</label>
                <select class="edit-task-category w-full p-2 border rounded-xl text-xs bg-slate-50 focus:bg-white">
                  <option value="academic" ${t.category === 'academic' ? 'selected' : ''}>අධ්‍යාපනික (Academic)</option>
                  <option value="physical" ${t.category === 'physical' ? 'selected' : ''}>ශාරීරික / නැටුම් (Physical)</option>
                  <option value="chores" ${t.category === 'chores' ? 'selected' : ''}>ගෙදර දොර (Chores)</option>
                  <option value="habits" ${t.category === 'habits' ? 'selected' : ''}>පුරුදු (Habits)</option>
                  <option value="general" ${!t.category || t.category === 'general' ? 'selected' : ''}>සාමාන්‍ය (General)</option>
                </select>
              </div>
              <div>
                <label class="block text-xs font-bold text-gray-700 mb-1">ලබාදෙන ලකුණු (Points):</label>
                <input type="number" class="edit-task-points w-full p-2 border rounded-xl text-xs font-bold bg-slate-50 focus:bg-white" value="${t.weight_points || 10}" min="1" max="100">
              </div>
            </div>

            <!-- Recurrence & Days of Week -->
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <div class="flex items-center justify-between">
                <label class="block text-xs font-bold text-slate-800">පුනරාවර්තනය (Recurrence):</label>
                <select class="edit-task-freq p-1.5 border rounded-lg text-xs bg-white font-semibold">
                  <option value="daily" ${sched?.frequency === 'daily' || !sched?.frequency ? 'selected' : ''}>දිනපතා (Daily)</option>
                  <option value="weekly" ${sched?.frequency === 'weekly' ? 'selected' : ''}>සතිපතා (Weekly)</option>
                  <option value="monthly" ${sched?.frequency === 'monthly' ? 'selected' : ''}>මාසිකව (Monthly)</option>
                  <option value="yearly" ${sched?.frequency === 'yearly' ? 'selected' : ''}>වාර්ෂිකව (Yearly)</option>
                </select>
              </div>

              <!-- Days of Week Checkboxes (Requirement 4.1 & 4.2) -->
              <div class="pt-1">
                <label class="block text-[11px] font-semibold text-slate-600 mb-1">අදාළ සතියේ දිනයන් (Days of Week):</label>
                <div class="grid grid-cols-4 sm:grid-cols-7 gap-1 text-[11px]">
                  ${[
                    { d: 1, label: 'සඳුදා' },
                    { d: 2, label: 'අඟහ' },
                    { d: 3, label: 'බදාදා' },
                    { d: 4, label: 'බ්‍රහස්' },
                    { d: 5, label: 'සිකු' },
                    { d: 6, label: 'සෙන' },
                    { d: 0, label: 'ඉරිදා' }
                  ].map(day => {
                    const isChecked = !sched?.days_of_week || (Array.isArray(sched.days_of_week) && sched.days_of_week.includes(day.d));
                    return `
                      <label class="flex items-center justify-center p-1.5 rounded-lg border cursor-pointer text-center font-medium transition-all edit-dow-label ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-900 font-bold shadow-2xs' : 'bg-white border-slate-200 text-slate-600'}">
                        <input type="checkbox" class="edit-task-dow sr-only" value="${day.d}" ${isChecked ? 'checked' : ''}>
                        <span class="dow-label-text">${day.label}</span>
                      </label>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- Next Date Picker for Monthly & Yearly (Requirement 4.4 & 4.5) -->
              <div class="edit-next-date-container ${sched?.frequency === 'monthly' || sched?.frequency === 'yearly' ? '' : 'hidden'} pt-2 border-t border-slate-200/60 space-y-1">
                <label class="block text-[11px] font-bold text-slate-700">ඊළඟ දිනය (Next Date):</label>
                <input type="date" class="edit-task-next-date w-full p-2 border rounded-xl text-xs bg-white font-mono" value="${sched?.next_run_date || todayDateStr}">
              </div>
            </div>

            <!-- Preferred Time Slots (Requirement 3: all 5 checked by default; 4.2: background color when activated) -->
            <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
              <label class="block text-xs font-bold text-slate-800">සුදුසු වේලාව (Preferred Time Slots):</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                ${[
                  { id: 'morning', label: '🌅 උදෑසන' },
                  { id: 'afternoon', label: '☀️ දහවල්' },
                  { id: 'evening', label: '🌇 සවස' },
                  { id: 'night', label: '🌙 රාත්‍රී' },
                  { id: 'anytime', label: '🔄 Flexible' }
                ].map(slot => {
                  const isChecked = !sched?.preferred_slots && !sched?.preferred_time_slots
                    ? true
                    : ((Array.isArray(sched?.preferred_slots) && sched.preferred_slots.includes(slot.id)) || (Array.isArray(sched?.preferred_time_slots) && sched.preferred_time_slots.includes(slot.id)));
                  return `
                    <label class="flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all edit-slot-label ${isChecked ? 'bg-indigo-100 border-indigo-300 text-indigo-900 font-bold shadow-2xs' : 'bg-white border-slate-200 text-slate-600'}">
                      <input type="checkbox" class="edit-task-slot" value="${slot.id}" ${isChecked ? 'checked' : ''}>
                      <span>${slot.label}</span>
                    </label>
                  `;
                }).join('')}
              </div>

              <!-- Custom Time Range -->
              <div class="pt-2 border-t border-slate-200/60 space-y-1.5">
                <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-indigo-900">
                  <input type="checkbox" class="edit-task-has-custom" ${sched?.custom_time_from && sched?.custom_time_to ? 'checked' : ''}>
                  <span>නියමිත කාල සීමාවක් (From - To) සකසන්න</span>
                </label>
                <div class="edit-custom-time-fields ${sched?.custom_time_from && sched?.custom_time_to ? '' : 'hidden'} grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label class="block text-[10px] text-gray-500 mb-0.5">ආරම්භක වේලාව (From):</label>
                    <input type="time" class="edit-task-from w-full p-2 border rounded-xl text-xs bg-white font-mono" value="${sched?.custom_time_from || '07:00'}">
                  </div>
                  <div>
                    <label class="block text-[10px] text-gray-500 mb-0.5">අවසන් වේලාව (To):</label>
                    <input type="time" class="edit-task-to w-full p-2 border rounded-xl text-xs bg-white font-mono" value="${sched?.custom_time_to || '08:00'}">
                  </div>
                </div>
              </div>
            </div>

            ${isGlobal ? `
              <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <span class="text-base shrink-0">🔒</span>
                <div>
                  <strong>පොදු කාර්යයකි (Global Task):</strong> ඔබ කරන මෙම වෙනස්කම් ඔබගේ පැතිකඩට පමණක් සුරැකෙන අතර, අනෙක් පරිශීලකයින්ට කිසිදු බලපෑමක් ඇති නොකරයි (Requirement 4.1).
                </div>
              </div>
            ` : ''}

            <div class="flex justify-end gap-2 pt-1">
              <button type="button" class="btn-cancel-inline-edit px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">අවලංගු කරන්න</button>
              <button type="button" class="btn-save-inline-edit px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer">
                <i class="fas fa-check"></i> සැකසුම් සුරකින්න (Save Settings)
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Attach row listeners
    listEl.querySelectorAll('.task-settings-row').forEach(row => {
      const taskId = row.dataset.taskId;
      const task = allTasks.find(t => t.id === taskId);
      if (!task) return;

      const editBtn = row.querySelector('.btn-edit-task-settings');
      const editContainer = row.querySelector('.inline-edit-container');
      const cancelBtn = row.querySelector('.btn-cancel-inline-edit');
      const saveBtn = row.querySelector('.btn-save-inline-edit');
      const hideBtn = row.querySelector('.btn-hide-task-settings');

      const editTitle = row.querySelector('.edit-task-title');
      const editCategory = row.querySelector('.edit-task-category');
      const editIconPreview = row.querySelector('.edit-icon-preview');
      const editHasCustom = row.querySelector('.edit-task-has-custom');
      const editCustomFields = row.querySelector('.edit-custom-time-fields');
      const editFreq = row.querySelector('.edit-task-freq');
      const editNextDateContainer = row.querySelector('.edit-next-date-container');
      const editDowChecks = row.querySelectorAll('.edit-task-dow');
      const editSlotChecks = row.querySelectorAll('.edit-task-slot');

      // Update Icon Preview live
      const updateIcon = () => {
        if (editIconPreview && editTitle && editCategory) {
          editIconPreview.innerText = autoDetermineIcon(editTitle.value, editCategory.value);
        }
      };
      if (editTitle) editTitle.addEventListener('input', updateIcon);
      if (editCategory) editCategory.addEventListener('change', updateIcon);

      // Toggle custom time fields
      if (editHasCustom && editCustomFields) {
        editHasCustom.addEventListener('change', () => {
          if (editHasCustom.checked) {
            editCustomFields.classList.remove('hidden');
          } else {
            editCustomFields.classList.add('hidden');
          }
        });
      }

      // Checkbox visual styling for days of week (Requirement 4.2)
      editDowChecks.forEach(check => {
        const updateDowStyle = () => {
          const parent = check.closest('label');
          if (!parent) return;
          if (check.checked) {
            parent.className = 'flex items-center justify-center p-1.5 rounded-lg border cursor-pointer text-center font-medium transition-all edit-dow-label bg-indigo-100 border-indigo-300 text-indigo-900 font-bold shadow-2xs';
          } else {
            parent.className = 'flex items-center justify-center p-1.5 rounded-lg border cursor-pointer text-center font-medium transition-all edit-dow-label bg-white border-slate-200 text-slate-600';
          }
        };
        check.addEventListener('change', updateDowStyle);
        updateDowStyle();
      });

      // Checkbox visual styling for time slots (Requirement 4.2)
      editSlotChecks.forEach(check => {
        const updateSlotStyle = () => {
          const parent = check.closest('label');
          if (!parent) return;
          if (check.checked) {
            parent.className = 'flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all edit-slot-label bg-indigo-100 border-indigo-300 text-indigo-900 font-bold shadow-2xs';
          } else {
            parent.className = 'flex items-center gap-1.5 p-1.5 rounded-lg border cursor-pointer transition-all edit-slot-label bg-white border-slate-200 text-slate-600';
          }
        };
        check.addEventListener('change', updateSlotStyle);
        updateSlotStyle();
      });

      // Recurrence frequency listener (Requirement 4.4, 4.4 & 4.5)
      if (editFreq) {
        editFreq.addEventListener('change', () => {
          const val = editFreq.value;
          if (val === 'weekly' || val === 'monthly' || val === 'yearly') {
            // Only Monday should be selected (Requirement 4.4)
            editDowChecks.forEach(chk => {
              chk.checked = (chk.value === '1');
              chk.dispatchEvent(new Event('change'));
            });
          } else if (val === 'daily') {
            // All 7 days selected
            editDowChecks.forEach(chk => {
              chk.checked = true;
              chk.dispatchEvent(new Event('change'));
            });
          }

          if (val === 'monthly' || val === 'yearly') {
            editNextDateContainer?.classList.remove('hidden');
          } else {
            editNextDateContainer?.classList.add('hidden');
          }
        });
      }

      editBtn.addEventListener('click', () => {
        editContainer.classList.toggle('hidden');
      });
      cancelBtn.addEventListener('click', () => {
        editContainer.classList.add('hidden');
      });

      // Save Edited Settings (Requirement 1.1 & 4.1: If global task, create user override so others are unaffected)
      saveBtn.addEventListener('click', async () => {
        const newTitle = editTitle ? editTitle.value.trim() : (task.title_si || task.title_en);
        const newCategory = editCategory ? editCategory.value : (task.category || 'general');
        const newPoints = parseFloat(row.querySelector('.edit-task-points')?.value) || 10;
        const newFreq = editFreq?.value || 'daily';

        const newDows = Array.from(row.querySelectorAll('.edit-task-dow:checked')).map(el => parseInt(el.value));
        const newSlots = Array.from(row.querySelectorAll('.edit-task-slot:checked')).map(el => el.value);

        const hasCustom = editHasCustom ? editHasCustom.checked : false;
        const newFrom = hasCustom ? (row.querySelector('.edit-task-from')?.value || '07:00') : null;
        const newTo = hasCustom ? (row.querySelector('.edit-task-to')?.value || '08:00') : null;
        const newNextDate = (newFreq === 'monthly' || newFreq === 'yearly') ? (row.querySelector('.edit-task-next-date')?.value || todayDateStr) : null;
        const newIcon = autoDetermineIcon(newTitle, newCategory);

        const isGlobal = !task.schema_definition?.target_profile || task.schema_definition?.target_profile === 'global' || task.target_profile === 'global';

        let targetTaskToSave = null;
        if (isGlobal) {
          // Requirement 4.1: Do NOT modify the global task! Create a user-specific override!
          const overrideId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : ('override_' + Date.now());

          targetTaskToSave = {
            id: overrideId,
            title_si: newTitle,
            title_en: newTitle,
            category: newCategory,
            tier: 'routine_baseline',
            weight_points: newPoints,
            icon: newIcon,
            sort_order: task.sort_order || 0,
            status: 'published',
            has_timer: task.has_timer,
            timer_seconds: task.timer_seconds,
            schema_definition: {
              ...task.schema_definition,
              target_profile: currentUser.id,
              original_task_id: task.id,
              is_user_override: true,
              schedule: {
                ...task.schema_definition?.schedule,
                frequency: newFreq,
                days_of_week: newDows,
                preferred_slots: newSlots,
                preferred_time_slots: newSlots,
                custom_time_from: newFrom,
                custom_time_to: newTo,
                next_run_date: newNextDate
              }
            }
          };
        } else {
          // Personal task: update directly
          targetTaskToSave = {
            ...task,
            title_si: newTitle,
            title_en: newTitle,
            category: newCategory,
            weight_points: newPoints,
            icon: newIcon,
            schema_definition: {
              ...task.schema_definition,
              schedule: {
                ...task.schema_definition?.schedule,
                frequency: newFreq,
                days_of_week: newDows,
                preferred_slots: newSlots,
                preferred_time_slots: newSlots,
                custom_time_from: newFrom,
                custom_time_to: newTo,
                next_run_date: newNextDate
              }
            }
          };
        }

        // Save to cache & Supabase (await for cross-device persistence - Requirement 4.3)
        try {
          let cached = [];
          const raw = localStorage.getItem('wosandi_admin_wosandi_tasks');
          if (raw) cached = JSON.parse(raw);
          const exIdx = cached.findIndex(t => t.id === targetTaskToSave.id);
          if (exIdx >= 0) cached[exIdx] = targetTaskToSave;
          else cached.push(targetTaskToSave);
          localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));

          // Supabase upsert (await)
          await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks", {
            method: "POST",
            headers: {
              apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
              Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
              "Content-Type": "application/json",
              Prefer: "resolution=merge-duplicates"
            },
            body: JSON.stringify(sanitizeTaskForSupabase(targetTaskToSave))
          }).catch(err => console.warn("Supabase save error:", err));
        } catch (e) {}

        editContainer.classList.add('hidden');
        await loadPublishedTasksFromAdmin();
        renderCurrentTasksSettings();
        recordUserActivity('task_updated', `කාර්යය සැකසුම් වෙනස් කළා: ${newTitle}`, 0);
      });

      // Hide / Delete
      hideBtn.addEventListener('click', async () => {
        const isGlobal = !task.schema_definition?.target_profile || task.schema_definition?.target_profile === 'global' || task.target_profile === 'global';
        if (isGlobal) {
          // Hide only for this user via override
          const hideOverride = {
            id: 'override_hidden_' + task.id + '_' + currentUser.id,
            title_si: task.title_si,
            title_en: task.title_en,
            category: task.category,
            status: 'published',
            schema_definition: {
              ...task.schema_definition,
              target_profile: currentUser.id,
              original_task_id: task.id,
              is_user_override: true,
              is_hidden: true
            }
          };
          try {
            let cached = JSON.parse(localStorage.getItem('wosandi_admin_wosandi_tasks') || '[]');
            cached.push(hideOverride);
            localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));
          } catch (e) {}
        } else {
          // Delete personal task
          try {
            let cached = JSON.parse(localStorage.getItem('wosandi_admin_wosandi_tasks') || '[]');
            cached = cached.filter(t => t.id !== task.id);
            localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(cached));
            fetch(`https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_tasks?id=eq.${task.id}`, {
              method: "DELETE",
              headers: {
                apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
                Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
              }
            }).catch(() => {});
          } catch (e) {}
        }
        await loadPublishedTasksFromAdmin();
        renderCurrentTasksSettings();
      });
    });
  }
}
if (typeof window !== "undefined") {
  window.openAddQuickTaskModal = openAddQuickTaskModal;
  window.autoDetermineIcon = autoDetermineIcon;
  window.recordUserActivity = recordUserActivity;
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

  // Initialize Multi-User Management first (Default: Wosa)
  let currentUser = null;
  if (typeof window !== "undefined" && window.userManagerClient) {
    currentUser = await window.userManagerClient.init();
    window.userManagerClient.updateUserHeaderPill();
  }

  // Requirement 1: If current user is Admin, render only monitoring hub
  if (currentUser?.role === 'admin' || currentUser?.id === 'user_admin') {
    renderAdminMonitoringDashboard();
  } else {
    // Load today's routine progress for active profile first to prevent race condition
    if (typeof loadTodayData === "function") {
      await loadTodayData();
    }
    // Sync loaded state to UI elements
    syncStateToUI();
    // Load published tasks from Admin panel
    await loadPublishedTasksFromAdmin();
  }
});

// Periodic schedule checker to transition tasks at scheduled start/end times (Requirement 3)
if (typeof window !== "undefined" && !window._taskScheduleInterval) {
  window._taskScheduleInterval = setInterval(() => {
    const currentUser = window.userManagerClient?.getCurrentUser?.();
    if (currentUser?.role !== 'admin' && currentUser?.id !== 'user_admin') {
      if (typeof loadPublishedTasksFromAdmin === 'function') {
        loadPublishedTasksFromAdmin();
      }
    }
  }, 30000);
  if (window._taskScheduleInterval && typeof window._taskScheduleInterval.unref === 'function') {
    window._taskScheduleInterval.unref();
  }
}

// Multi-User Switch Handler (Requirement 3: Separate dashboard for each user)
if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("wosandi-user-changed", async (e) => {
    const newUser = e.detail;

    // Requirement 1: If switching to Admin, render monitoring dashboard only
    if (newUser?.role === 'admin' || newUser?.id === 'user_admin') {
      renderAdminMonitoringDashboard();
      if (typeof recordUserActivity === "function") {
        recordUserActivity('user_switch', `පරිශීලකයා මාරු විය: ${newUser.display_name || newUser.username}`, 0);
      }
      return;
    }

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
    if (typeof recordUserActivity === "function") {
      recordUserActivity('user_switch', `පරිශීලකයා මාරු විය: ${newUser.display_name || newUser.username}`, 0);
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

  const wasCompleted = Boolean(state.school_attended);
  state.school_attended = val;
  const container = document.getElementById("subjects-container");
  if (container) container.classList.toggle("hidden", !val);

  if (val === true && !wasCompleted) {
    scheduleSectionReorder('school');
  } else if (val === false) {
    cancelSectionReorder('school');
  }

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

  const wasCompleted = Boolean(state.wake_up);
  state.wake_up = slot;
  document.querySelectorAll(".wake-btn").forEach(b => {
    const isSelected = b.dataset.val === slot;
    b.classList.toggle("bg-pink-500", isSelected);
    b.classList.toggle("text-white", isSelected);
    b.classList.toggle("border-pink-500", isSelected);
  });

  if (!wasCompleted) {
    scheduleSectionReorder('wake_up');
  }

  syncProgressWithServer(state);
  if (typeof recordUserActivity === 'function') {
    recordUserActivity('wake_up', `අවදි වූ වේලාව සටහන් කළා: ${slot}`, 10);
  }
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

  const parentSec = taskRow?.closest('.routine-section');
  const secId = parentSec?.getAttribute('data-section-id');
  const secWasCompleted = secId ? isSectionCompleted(secId, state) : false;

  state[key] = val;
  if (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks)) {
    const matched = window.publishedAdminTasks.find(t => t.id === key);
    if (matched) {
      if (matched.schema_definition?.linked_state_key) {
        state[matched.schema_definition.linked_state_key] = val;
      }
      if (matched.schema_definition?.original_task_id) {
        state[matched.schema_definition.original_task_id] = val;
      }
    }
  }

  if (val === true) {
    // Delay ticked task from moving to bottom for 5 seconds
    if (taskRow) scheduleTaskReorder(key, taskRow);

    // If section just completed now with this task, also delay section moving to bottom for 5s
    if (secId && !secWasCompleted && isSectionCompleted(secId, state)) {
      scheduleSectionReorder(secId, parentSec);
    }
  } else {
    if (taskRow) cancelTaskReorder(key, taskRow);
    if (secId) cancelSectionReorder(secId, parentSec);
  }

  reorderAllTaskLists();
  updateSectionCollapseStates(state);
  syncProgressWithServer(state);

  if (typeof recordUserActivity === 'function') {
    const matchedTask = typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks) ? window.publishedAdminTasks.find(t => t.id === key) : null;
    const pts = matchedTask ? (Number(matchedTask.weight_points) || 10) : 10;
    if (val === true) {
      recordUserActivity('task_completed', `සම්පූර්ණ කළා: ${taskLabel}`, pts);
    } else {
      recordUserActivity('task_uncompleted', `අවලංගු කළා: ${taskLabel}`, -pts);
    }
  }
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

      <!-- Tab Switcher -->
      <div class="flex border-b border-slate-200 bg-slate-50 shrink-0 font-['Noto_Sans_Sinhala']">
        <button id="perf-tab-routine" type="button" class="flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 bg-white transition cursor-pointer flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-list-check"></i> දෛනික චර්යාව (Routine)
        </button>
        <button id="perf-tab-metabolic" type="button" class="flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-1.5">
          <i class="fa-solid fa-stopwatch text-amber-500"></i> ආහාර පරතරය (5h Gap)
        </button>
      </div>

      <!-- Content Panels -->
      <div class="p-4 sm:p-6 overflow-y-auto flex-1 font-['Noto_Sans_Sinhala']">
        <!-- Routine Tasks Pane -->
        <div id="perf-pane-routine" class="space-y-4">
          <div class="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <i class="fas fa-spinner fa-spin text-xl text-indigo-500"></i>
            <span>දත්ත ලබා ගනිමින් පවතී...</span>
          </div>
        </div>

        <!-- Metabolic Fasting Pane -->
        <div id="perf-pane-metabolic" class="space-y-4 hidden">
          <div class="p-8 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
            <i class="fas fa-spinner fa-spin text-xl text-amber-500"></i>
            <span>ආහාර පරතර දත්ත ලබා ගනිමින් පවතී...</span>
          </div>
        </div>
      </div>
    </div>
  `;

  const closeModal = () => modal.remove();
  modal.querySelector("#close-past-performance-modal").addEventListener("click", closeModal);

  const tabRoutine = modal.querySelector("#perf-tab-routine");
  const tabMetabolic = modal.querySelector("#perf-tab-metabolic");
  const paneRoutine = modal.querySelector("#perf-pane-routine");
  const paneMetabolic = modal.querySelector("#perf-pane-metabolic");

  let metabolicLoaded = false;

  tabRoutine.addEventListener("click", () => {
    tabRoutine.className = "flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-indigo-600 text-indigo-600 bg-white transition cursor-pointer flex items-center justify-center gap-1.5";
    tabMetabolic.className = "flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-1.5";
    paneRoutine.classList.remove("hidden");
    paneMetabolic.classList.add("hidden");
  });

  tabMetabolic.addEventListener("click", () => {
    tabMetabolic.className = "flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-amber-500 text-amber-700 bg-white transition cursor-pointer flex items-center justify-center gap-1.5";
    tabRoutine.className = "flex-1 py-3 px-3 text-xs font-bold text-center border-b-2 border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer flex items-center justify-center gap-1.5";
    paneMetabolic.classList.remove("hidden");
    paneRoutine.classList.add("hidden");
    if (!metabolicLoaded) {
      metabolicLoaded = true;
      loadMetabolicData();
    }
  });

  // Load Routine Data
  loadRoutineData();

  async function loadRoutineData() {
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
      paneRoutine.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-xs space-y-2">
          <i class="fas fa-calendar-xmark text-3xl text-slate-300 block mb-2"></i>
          <span class="font-bold text-slate-600 block">පසුගිය දත්ත කිසිවක් හමු නොවීය</span>
          <span>අද දින කාර්යයන් සම්පූර්ණ කිරීමෙන් ප්‍රගති සටහන ආරම්භ කරන්න.</span>
        </div>
      `;
      return;
    }

    paneRoutine.innerHTML = `
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

  async function loadMetabolicData() {
    let mealLogs = [];
    if (window.metabolicTracker && typeof window.metabolicTracker.fetchMealLogs === 'function') {
      mealLogs = await window.metabolicTracker.fetchMealLogs();
    } else {
      try {
        const raw = localStorage.getItem(`wosandi_meal_logs_${currentUser.id}`);
        if (raw) mealLogs = JSON.parse(raw);
      } catch (e) {}
    }

    const analytics = (window.metabolicTracker && typeof window.metabolicTracker.calculateAnalytics === 'function')
      ? window.metabolicTracker.calculateAnalytics(mealLogs)
      : {
          avgDurationFormatted: '0h 0m',
          complianceRate: 0,
          complianceLabel: '0%',
          streak: 0,
          totalLogs: mealLogs ? mealLogs.length : 0
        };

    if (!mealLogs || mealLogs.length === 0) {
      paneMetabolic.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-xs space-y-2">
          <i class="fas fa-utensils text-3xl text-slate-300 block mb-2"></i>
          <span class="font-bold text-slate-600 block">කෑම පරතර වාර්තා කිසිවක් හමු නොවීය</span>
          <span>ඉහළ ඇති ට්‍රැකරයෙන් "[✔] කෑම වේලක් ගත්තා දැන්" ක්ලික් කර ප්‍රථම වාර්තාව එක් කරන්න.</span>
        </div>
      `;
      return;
    }

    paneMetabolic.innerHTML = `
      <!-- Core KPIs -->
      <div class="grid grid-cols-3 gap-2 pb-2">
        <div class="bg-amber-50 border border-amber-200/60 p-2.5 rounded-2xl text-center">
          <span class="text-[9px] sm:text-[10px] uppercase font-bold text-amber-600 block">සාමාන්‍ය පරතරය</span>
          <span class="text-base sm:text-lg font-black text-amber-900">${analytics.avgDurationFormatted}</span>
        </div>
        <div class="bg-emerald-50 border border-emerald-200/60 p-2.5 rounded-2xl text-center">
          <span class="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-600 block">සතිපතා අනුකූලතාව</span>
          <span class="text-base sm:text-lg font-black text-emerald-900">${analytics.complianceRate}%</span>
        </div>
        <div class="bg-indigo-50 border border-indigo-200/60 p-2.5 rounded-2xl text-center">
          <span class="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-600 block">අඛණ්ඩ Streak</span>
          <span class="text-base sm:text-lg font-black text-indigo-900">${analytics.streak} 🔥</span>
        </div>
      </div>

      <!-- Chronological Meal History List -->
      <div class="space-y-2 pt-1">
        <div class="text-[11px] font-bold text-slate-500 px-1 flex items-center justify-between">
          <span>ආහාර වේල් කාලානුක්‍රමය (Meal Timeline)</span>
          <span>වාර්තා ${mealLogs.length}ක්</span>
        </div>
        ${mealLogs.map(log => {
          const d = new Date(log.meal_timestamp || log.created_at || Date.now());
          const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = d.toLocaleDateString([], { month: 'short', day: 'numeric', weekday: 'short' });
          const isGoalMet = log.goal_met === true;
          const durationMins = Math.round((log.duration_elapsed || 0) / 60);
          const durHours = Math.floor(durationMins / 60);
          const durRemMins = durationMins % 60;
          const durFormatted = durHours > 0 ? `${durHours}h ${durRemMins}m` : `${durRemMins}m`;

          return `
            <div class="p-3 bg-white border ${isGoalMet ? 'border-emerald-200' : 'border-amber-200'} rounded-2xl shadow-2xs flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="w-8 h-8 rounded-xl ${isGoalMet ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} flex items-center justify-center text-sm font-bold shrink-0">
                  ${isGoalMet ? '🏆' : '🥪'}
                </div>
                <div class="min-w-0">
                  <div class="text-xs font-bold text-slate-800 truncate">${dateStr} • ${timeStr}</div>
                  <div class="text-[10px] text-slate-500 font-medium">පරතරය: <strong class="text-slate-700">${durFormatted}</strong> (${isGoalMet ? 'පැය 5 සම්පූර්ණයි' : 'පැය 5ට අඩුයි'})</div>
                </div>
              </div>
              <span class="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-black ${isGoalMet ? 'bg-emerald-50 text-emerald-700 border border-emerald-300' : 'bg-amber-50 text-amber-700 border border-amber-300'}">
                ${isGoalMet ? '✓ Goal Met' : '⚠️ Broken Early'}
              </span>
            </div>
          `;
        }).join('')}
      </div>
    `;
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
  window.scheduleTaskReorder = scheduleTaskReorder;
  window.cancelTaskReorder = cancelTaskReorder;
  window.scheduleSectionReorder = scheduleSectionReorder;
  window.cancelSectionReorder = cancelSectionReorder;
  window.loadPublishedTasksFromAdmin = loadPublishedTasksFromAdmin;
  window.openPastPerformanceModal = openPastPerformanceModal;
}
