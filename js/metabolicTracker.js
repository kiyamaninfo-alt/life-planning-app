/**
 * metabolicTracker.js - Metabolic Meal-Interval Tracker (5-Hour Fasting/Gap Engine)
 * 
 * Enforces a healthy 5-hour metabolic resting window between meals to regulate
 * insulin levels and eliminate mindless snacking.
 * 
 * Features:
 * - Persistent sticky banner placed at the top of the main dashboard.
 * - Lightweight accessible HTML modal / dialog with HTML5 datetime-local input & "Right Now" button.
 * - Tri-state State Machine:
 *     State A (Idle / Ready): [✔] කෑම වේලක් ගත්තා දැන්
 *     State B (Active Countdown): [⚠️] කෑම කාලා පැය 5ක් නෑ, ආයිත් කෑවද? (with early break confirmation)
 *     State C (Completed / Fasting Goal Met): 00:00:00 visual success badge -> resets to State A.
 * - Data Persistence to meal_logs, wosandi_admin_config, and localStorage per active user.
 * - Analytics engine computing Average meal gap, weekly compliance score, consecutive streak,
 *   and chronological adherence history for the Past Performance modal.
 */

const FIVE_HOURS_SECONDS = 5 * 3600; // 18,000 seconds
const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

export class MetabolicTracker {
  constructor() {
    this.timerInterval = null;
    this.currentUser = this.getActiveUser();
    this.activeMeal = null; // { id, user_id, meal_timestamp, start_time_ms }
    this.state = 'A'; // 'A' | 'B' | 'C'
    this.isInitialized = false;
  }

  getActiveUser() {
    try {
      if (typeof window !== 'undefined' && window.userManagerClient && window.userManagerClient.getCurrentUser) {
        return window.userManagerClient.getCurrentUser();
      }
      const raw = localStorage.getItem('wosandi_current_user');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { id: 'user_wosa', username: 'Wosa', display_name: 'Wosa (වෝසා)', role: 'primary' };
  }

  getStorageKey() {
    const uid = this.currentUser?.id || 'user_wosa';
    return `wosandi_active_meal_${uid}`;
  }

  getLogsStorageKey() {
    const uid = this.currentUser?.id || 'user_wosa';
    return `wosandi_meal_logs_${uid}`;
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Listen to user changes to isolate data per user
    if (typeof window !== 'undefined') {
      window.addEventListener('wosandi-user-changed', (e) => {
        this.currentUser = e.detail || this.getActiveUser();
        this.loadActiveMeal();
        this.renderBanner();
      });
    }

    await this.loadActiveMeal();
    this.renderBanner();
    this.startTicker();
  }

  async loadActiveMeal() {
    const key = this.getStorageKey();
    let localMeal = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localMeal = JSON.parse(raw);
    } catch (e) {}

    // Check remote wosandi_admin_config for user's latest meal state
    try {
      const uid = this.currentUser?.id || 'user_wosa';
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.active_meal_${uid}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.config_data) {
          const remoteMeal = rows[0].config_data;
          if (!localMeal || new Date(remoteMeal.meal_timestamp) > new Date(localMeal.meal_timestamp)) {
            localMeal = remoteMeal;
            localStorage.setItem(key, JSON.stringify(localMeal));
          }
        }
      }
    } catch (e) {}

    this.activeMeal = localMeal;
    this.updateState();
  }

  updateState() {
    if (!this.activeMeal || !this.activeMeal.meal_timestamp) {
      this.state = 'A';
      return;
    }

    const mealTimeMs = new Date(this.activeMeal.meal_timestamp).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - mealTimeMs) / 1000));

    if (elapsedSeconds < FIVE_HOURS_SECONDS) {
      this.state = 'B';
    } else {
      // 5-Hour Goal Met!
      this.state = 'C';
    }
  }

  startTicker() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  }

  tick() {
    if (typeof document === 'undefined') return;
    this.updateState();

    const bannerCountdownEl = document.getElementById('metabolic-countdown-display');
    const bannerStatusEl = document.getElementById('metabolic-status-label');
    const bannerActionBtn = document.getElementById('metabolic-action-btn');
    const bannerRingEl = document.getElementById('metabolic-progress-bar');
    const bannerBadgeContainer = document.getElementById('metabolic-badge-container');

    if (!bannerCountdownEl) return;

    if (this.state === 'A') {
      bannerCountdownEl.textContent = '05:00:00';
      if (bannerStatusEl) {
        bannerStatusEl.textContent = 'විවේක කාලය නිමයි • කෑමට සූදානම්';
        bannerStatusEl.className = 'text-[11px] font-semibold text-emerald-700';
      }
      if (bannerActionBtn) {
        bannerActionBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-500 mr-1.5"></i> [✔] කෑම වේලක් ගත්තා දැන්';
        bannerActionBtn.className = 'w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer';
      }
      if (bannerRingEl) bannerRingEl.style.width = '0%';
      if (bannerBadgeContainer) bannerBadgeContainer.innerHTML = '';
    } else if (this.state === 'B') {
      const mealTimeMs = new Date(this.activeMeal.meal_timestamp).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((Date.now() - mealTimeMs) / 1000));
      const remainingSeconds = Math.max(0, FIVE_HOURS_SECONDS - elapsedSeconds);

      const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
      const mins = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
      const secs = String(remainingSeconds % 60).padStart(2, '0');
      bannerCountdownEl.textContent = `${hours}:${mins}:${secs}`;

      const pct = Math.min(100, Math.round((elapsedSeconds / FIVE_HOURS_SECONDS) * 100));
      if (bannerRingEl) bannerRingEl.style.width = `${pct}%`;

      if (bannerStatusEl) {
        bannerStatusEl.textContent = `පරිවෘත්තීය විවේකය ක්‍රියාත්මකයි (${pct}% සම්පූර්ණයි)`;
        bannerStatusEl.className = 'text-[11px] font-semibold text-amber-700';
      }
      if (bannerActionBtn) {
        bannerActionBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-300 mr-1.5 animate-pulse"></i> [⚠️] කෑම කාලා පැය 5ක් නෑ, ආයිත් කෑවද?';
        bannerActionBtn.className = 'w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer';
      }
      if (bannerBadgeContainer) {
        bannerBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300 shadow-2xs">
            <i class="fa-solid fa-fire text-amber-500 text-[9px]"></i> 5h Fasting
          </span>
        `;
      }
    } else if (this.state === 'C') {
      bannerCountdownEl.textContent = '00:00:00';
      if (bannerRingEl) bannerRingEl.style.width = '100%';

      if (bannerStatusEl) {
        bannerStatusEl.textContent = 'පැය 5ක පරිවෘත්තීය විවේකය සාර්ථකව සම්පූර්ණයි! 🎯';
        bannerStatusEl.className = 'text-[11px] font-extrabold text-emerald-600 flex items-center gap-1';
      }
      if (bannerActionBtn) {
        bannerActionBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-300 mr-1.5"></i> [✔] කෑම වේලක් ගත්තා දැන්';
        bannerActionBtn.className = 'w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center cursor-pointer';
      }
      if (bannerBadgeContainer) {
        bannerBadgeContainer.innerHTML = `
          <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs animate-bounce">
            <i class="fa-solid fa-trophy text-emerald-600 text-[10px]"></i> 5-Hour Goal Achieved
          </span>
        `;
      }
    }
  }

  renderBanner() {
    if (typeof document === 'undefined') return;
    let bannerContainer = document.getElementById('metabolic-tracker-sticky-container');
    if (!bannerContainer) {
      bannerContainer = document.createElement('div');
      bannerContainer.id = 'metabolic-tracker-sticky-container';
      bannerContainer.className = 'sticky top-0 z-40 w-full backdrop-blur-md bg-white/95 border-b border-indigo-100 shadow-xs transition-all';
      
      const body = document.body;
      if (body) {
        body.insertBefore(bannerContainer, body.firstChild);
      }
    }

    bannerContainer.innerHTML = `
      <div class="max-w-md mx-auto px-3 py-2 sm:px-4 sm:py-2.5 font-['Noto_Sans_Sinhala']">
        <div class="flex items-center justify-between gap-2">
          <!-- Left: Title, Live Digital Countdown, Status -->
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-base sm:text-lg shadow-inner shrink-0">
              ⏱️
            </div>
            <div class="min-w-0">
              <div class="flex items-center gap-1.5 flex-wrap">
                <span class="text-xs sm:text-sm font-extrabold text-slate-800 font-mono tracking-tight" id="metabolic-countdown-display">05:00:00</span>
                <span id="metabolic-badge-container"></span>
              </div>
              <div id="metabolic-status-label" class="text-[11px] font-semibold text-slate-500 truncate max-w-[200px] sm:max-w-none">
                පරිවෘත්තීය කෑම පරතර ට්‍රැකරය (5-Hour Fasting Gap)
              </div>
            </div>
          </div>

          <!-- Right: Trigger Action Button -->
          <div class="shrink-0">
            <button id="metabolic-action-btn" type="button" class="px-3 py-1.5 sm:px-4 sm:py-2 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer">
              <!-- Dynamically populated by tick() -->
              [✔] කෑම වේලක් ගත්තා දැන්
            </button>
          </div>
        </div>

        <!-- Metabolic Resting Progress Bar -->
        <div class="w-full bg-slate-100 rounded-full h-1.5 mt-1.5 overflow-hidden">
          <div id="metabolic-progress-bar" class="h-1.5 rounded-full bg-gradient-to-r from-amber-400 via-purple-500 to-emerald-500 transition-all duration-500" style="width: 0%"></div>
        </div>
      </div>
    `;

    const actionBtn = document.getElementById('metabolic-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        this.handleActionClick();
      });
    }

    this.tick();
  }

  handleActionClick() {
    if (this.state === 'B') {
      // Early break warning prompt
      this.openEarlyBreakConfirmation();
    } else {
      // Idle or Completed: Open Meal Logger Dialog
      this.openMealLoggerModal();
    }
  }

  openMealLoggerModal(prefillTimestamp = null, isEarlyBreak = false) {
    if (typeof document === 'undefined') return;

    let modalContainer = document.getElementById('meal-logger-dialog-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'meal-logger-dialog-container';
      document.body.appendChild(modalContainer);
    }

    // Format current date-time for datetime-local (YYYY-MM-DDTHH:mm)
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const localIso = prefillTimestamp || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;

    modalContainer.innerHTML = `
      <dialog id="meal-logger-dialog" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 w-full h-full font-['Noto_Sans_Sinhala'] border-none" open>
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">🍽️</span>
              <h3 class="text-sm sm:text-base font-extrabold text-slate-800">කෑම වේලක් සටහන් කිරීම</h3>
            </div>
            <button type="button" id="close-meal-dialog" class="text-slate-400 hover:text-slate-600 text-lg cursor-pointer">&times;</button>
          </div>

          <form id="meal-logger-form" class="mt-4 space-y-4 text-xs">
            ${isEarlyBreak ? `
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-start gap-2">
                <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0"></i>
                <div>
                  <strong>නියමිත පැය 5ට පෙර කෑමක්:</strong> මෙම කෑම වේල සටහන් කිරීමෙන් පසුගිය විවේක කාලය අවසන් වී නව පැය 5ක ටයිමරයක් ආරම්භ වේ.
                </div>
              </div>
            ` : `
              <p class="text-slate-500 text-[11px]">
                ආහාර ගත් වේලාව සටහන් කරන්න. එතැන් සිට පැය 5ක පරිවෘත්තීය විවේක කාලයක් (Metabolic Rest Window) ගණනය කෙරේ.
              </p>
            `}

            <div>
              <label class="block font-bold text-slate-700 uppercase tracking-wider mb-1">කෑම ගත් වේලාව (Meal Timestamp)</label>
              <div class="flex gap-2">
                <input type="datetime-local" id="meal-timestamp-input" value="${localIso}" required class="flex-1 p-2.5 border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-purple-200 focus:outline-hidden">
                <button type="button" id="meal-now-btn" class="px-3 py-2 bg-slate-100 hover:bg-purple-100 text-purple-700 font-bold rounded-xl border border-slate-200 text-xs transition cursor-pointer" title="දැන්ම (Right Now)">
                  <i class="fa-solid fa-clock mr-1"></i>දැන්
                </button>
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 uppercase tracking-wider mb-1">ආහාර වේල (Meal Type)</label>
              <select id="meal-type-select" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-purple-200 focus:outline-hidden">
                <option value="main">ප්‍රධාන කෑම වේලක් (Main Meal)</option>
                <option value="breakfast">උදෑසන ආහාරය (Breakfast)</option>
                <option value="lunch">දිවා ආහාරය (Lunch)</option>
                <option value="dinner">රාත්‍රී ආහාරය (Dinner)</option>
                <option value="snack">සුළු ආහාරයක් (Light Snack)</option>
              </select>
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="cancel-meal-btn" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer">
                අවලංගු කරන්න (Cancel)
              </button>
              <button type="submit" id="confirm-meal-btn" class="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                <i class="fa-solid fa-check"></i> තහවුරු කරන්න (Confirm)
              </button>
            </div>
          </form>
        </div>
      </dialog>
    `;

    const dialog = document.getElementById('meal-logger-dialog');
    const closeBtn = document.getElementById('close-meal-dialog');
    const cancelBtn = document.getElementById('cancel-meal-btn');
    const nowBtn = document.getElementById('meal-now-btn');
    const form = document.getElementById('meal-logger-form');
    const input = document.getElementById('meal-timestamp-input');

    const closeDialog = () => {
      modalContainer.innerHTML = '';
    };

    closeBtn.addEventListener('click', closeDialog);
    cancelBtn.addEventListener('click', closeDialog);

    nowBtn.addEventListener('click', () => {
      const cur = new Date();
      input.value = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}T${pad(cur.getHours())}:${pad(cur.getMinutes())}`;
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = input.value;
      if (!val) return;
      const selectedDate = new Date(val);
      await this.recordMeal(selectedDate);
      closeDialog();
    });
  }

  openEarlyBreakConfirmation() {
    if (typeof document === 'undefined') return;

    let modalContainer = document.getElementById('meal-logger-dialog-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'meal-logger-dialog-container';
      document.body.appendChild(modalContainer);
    }

    const mealTimeMs = new Date(this.activeMeal.meal_timestamp).getTime();
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - mealTimeMs) / 1000));
    const h = Math.floor(elapsedSeconds / 3600);
    const m = Math.floor((elapsedSeconds % 3600) / 60);

    modalContainer.innerHTML = `
      <dialog id="early-break-dialog" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 w-full h-full font-['Noto_Sans_Sinhala'] border-none" open>
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 sm:p-6 border border-slate-100 text-center animate-in fade-in zoom-in-95 duration-200">
          <div class="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center text-2xl mx-auto mb-3 border border-amber-200 shadow-inner">
            ⚠️
          </div>
          <h3 class="text-base font-extrabold text-slate-800">කෑම කාලා පැය 5ක් නෑ, ආයිත් කෑවද?</h3>
          <p class="text-xs text-slate-500 mt-2 leading-relaxed">
            ඔබ අවසන් වරට ආහාර ගෙන දැනට ගතව ඇත්තේ <strong>${h}h ${m}m</strong> පමණි.
          </p>
          <div class="p-3 my-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 text-left font-medium">
            <i class="fa-solid fa-info-circle text-amber-600 mr-1"></i>
            <em>"Are you recording an early meal? This will log a break and reset the timer."</em>
            <div class="mt-1 text-[10px] text-slate-500">
              මෙය නොමේරූ කෑම ගැනීමක් (Early Break) ලෙස සටහන් කර නව පැය 5ක කාලසීමාව ආරම්භ කෙරේ.
            </div>
          </div>

          <div class="flex flex-col-reverse sm:flex-row justify-center gap-2 pt-2">
            <button type="button" id="abort-early-meal-btn" class="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">
              නැත, කෑවේ නෑ (Keep Fasting)
            </button>
            <button type="button" id="proceed-early-meal-btn" class="w-full sm:w-auto px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer">
              ඔව්, සටහන් කරන්න (Confirm Early Meal)
            </button>
          </div>
        </div>
      </dialog>
    `;

    const abortBtn = document.getElementById('abort-early-meal-btn');
    const proceedBtn = document.getElementById('proceed-early-meal-btn');

    abortBtn.addEventListener('click', () => {
      modalContainer.innerHTML = '';
    });

    proceedBtn.addEventListener('click', () => {
      modalContainer.innerHTML = '';
      this.openMealLoggerModal(null, true);
    });
  }

  async recordMeal(dateObj = new Date()) {
    const isoString = dateObj.toISOString();
    const uid = this.currentUser?.id || 'user_wosa';
    const nowMs = dateObj.getTime();

    // 1. If there was a previous active meal, close its log entry with duration_elapsed & goal_met
    if (this.activeMeal && this.activeMeal.meal_timestamp) {
      const prevStartMs = new Date(this.activeMeal.meal_timestamp).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((nowMs - prevStartMs) / 1000));
      const goalMet = elapsedSeconds >= FIVE_HOURS_SECONDS;

      const completedLog = {
        id: this.activeMeal.id || `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user_id: uid,
        meal_timestamp: this.activeMeal.meal_timestamp,
        duration_elapsed: elapsedSeconds,
        goal_met: goalMet,
        created_at: this.activeMeal.created_at || this.activeMeal.meal_timestamp
      };

      await this.saveCompletedLog(completedLog);
    }

    // 2. Set new active meal
    const newMeal = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: uid,
      meal_timestamp: isoString,
      created_at: new Date().toISOString()
    };

    this.activeMeal = newMeal;
    localStorage.setItem(this.getStorageKey(), JSON.stringify(newMeal));

    // Save active meal to remote wosandi_admin_config
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          config_key: `active_meal_${uid}`,
          config_data: newMeal,
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}

    this.updateState();
    this.tick();
  }

  async saveCompletedLog(log) {
    const key = this.getLogsStorageKey();
    let logs = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) logs = JSON.parse(raw);
    } catch (e) {}

    logs.unshift(log);
    // Keep last 100 meals
    logs = logs.slice(0, 100);
    localStorage.setItem(key, JSON.stringify(logs));

    // 1. Try remote meal_logs table
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/meal_logs`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(log)
      });
    } catch (e) {}

    // 2. Dual backup in wosandi_admin_config for 100% reliability
    try {
      const uid = this.currentUser?.id || 'user_wosa';
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          config_key: `meal_logs_${uid}`,
          config_data: { logs },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }

  async fetchMealLogs() {
    const uid = this.currentUser?.id || 'user_wosa';
    const key = this.getLogsStorageKey();
    let logs = [];

    // LocalStorage first
    try {
      const raw = localStorage.getItem(key);
      if (raw) logs = JSON.parse(raw);
    } catch (e) {}

    // Fetch from Supabase
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.meal_logs_${uid}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.logs) {
          const remoteLogs = rows[0].config_data.logs;
          // Merge unique logs
          remoteLogs.forEach(r => {
            if (!logs.some(l => l.id === r.id || l.meal_timestamp === r.meal_timestamp)) {
              logs.push(r);
            }
          });
          localStorage.setItem(key, JSON.stringify(logs));
        }
      }
    } catch (e) {}

    // Also check if meal_logs table has items
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/meal_logs?user_id=eq.${uid}&order=meal_timestamp.desc&limit=50`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows)) {
          rows.forEach(r => {
            if (!logs.some(l => l.id === r.id)) logs.push(r);
          });
        }
      }
    } catch (e) {}

    logs.sort((a, b) => new Date(b.meal_timestamp || 0) - new Date(a.meal_timestamp || 0));
    return logs;
  }

  calculateAnalytics(logs) {
    if (!logs || logs.length === 0) {
      return {
        avgDurationFormatted: '0h 0m',
        complianceRate: 0,
        complianceLabel: '0%',
        streak: 0,
        totalLogs: 0
      };
    }

    // 1. Average gap duration
    const validDurations = logs.filter(l => Number(l.duration_elapsed) > 0);
    let avgSeconds = 0;
    if (validDurations.length > 0) {
      const sum = validDurations.reduce((acc, curr) => acc + Number(curr.duration_elapsed), 0);
      avgSeconds = Math.round(sum / validDurations.length);
    }
    const avgH = Math.floor(avgSeconds / 3600);
    const avgM = Math.floor((avgSeconds % 3600) / 60);

    // 2. Weekly compliance score (last 7 days or all recent)
    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weeklyLogs = logs.filter(l => new Date(l.meal_timestamp).getTime() >= sevenDaysAgo);
    const targetSet = weeklyLogs.length > 0 ? weeklyLogs : logs;
    const compliantCount = targetSet.filter(l => l.goal_met === true).length;
    const complianceRate = Math.round((compliantCount / targetSet.length) * 100);

    // 3. Consecutive streak (from most recent backward)
    let streak = 0;
    for (const log of logs) {
      if (log.goal_met === true) {
        streak++;
      } else {
        break;
      }
    }

    return {
      avgDurationFormatted: `${avgH}h ${avgM}m`,
      complianceRate,
      complianceLabel: `${complianceRate}% (${compliantCount}/${targetSet.length})`,
      streak,
      totalLogs: logs.length
    };
  }
}

// Global Singleton Instance
export const metabolicTracker = new MetabolicTracker();

if (typeof window !== 'undefined') {
  window.metabolicTracker = metabolicTracker;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => metabolicTracker.init());
  } else {
    metabolicTracker.init();
  }
}
