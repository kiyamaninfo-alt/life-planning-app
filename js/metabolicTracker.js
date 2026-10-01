/**
 * metabolicTracker.js - Metabolic Meal-Interval Tracker (5-Hour Fasting/Gap Engine)
 * 
 * Features & UI/UX Specifications:
 * 1. Layout Hierarchy: Position "Recent Changes" directly below "දෛනික කාර්යයන් (Daily Routine)".
 * 2. Automated Date Selection: Automatically detect and set current system date on initial load.
 * 3. Kid-Friendly Graphical Time Display: Stylized circular dial/clock designed for an 8th-grade student.
 * 4. Time Controls: Clearly visible '+' and '-' buttons to increment or decrement time/duration.
 * 5. Header Notice: Prominently and aesthetically centered prompt text: "කෑම කාලා පැය 5ක් නෑ, ආයෙත් කෑවද?"
 * 6. Responsive Timer Display: Countdown prominently scaled across desktop, tablet, and mobile screens.
 * 7. Status Label & Progress Bar: Directly underneath timer: "ආහාර විවේකය ක්රියාත්මකයි (X% සම්පූර්ණයි)"
 *    with animated progress bar immediately below.
 * 8. Tooltip Interactivity: Hover (desktop) or tap/hold (mobile) displays exact completion percentage in a clean tooltip.
 * 9. Gamification & Scoring Logic: 10 points per completed 5-hour interval, +50 bonus points for 3 daily intervals,
 *    dynamically credited to user's running total score.
 */

const FIVE_HOURS_SECONDS = 5 * 3600; // 18,000 seconds
const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

export class MetabolicTracker {
  constructor() {
    this.timerInterval = null;
    this.currentUser = this.getActiveUser();
    this.activeMeal = null; // { id, user_id, meal_timestamp, created_at, target_gap_seconds, goal_awarded }
    this.targetGapSeconds = FIVE_HOURS_SECONDS;
    this.state = 'A'; // 'A' (Ready/Idle) | 'B' (Active Fasting) | 'C' (Goal Met)
    this.isInitialized = false;
    this.systemDate = this.getSystemDate();
  }

  getTargetGapSeconds() {
    if (this.activeMeal && this.activeMeal.target_gap_seconds) {
      return Number(this.activeMeal.target_gap_seconds);
    }
    return this.targetGapSeconds || FIVE_HOURS_SECONDS;
  }

  getSystemDate() {
    const d = new Date();
    const iso = d.toISOString().split('T')[0];
    const dayNames = ["ඉරිදා", "සඳුදා", "අඟහරුවාදා", "බදාදා", "බ්‍රහස්පතින්දා", "සිකුරාදා", "සෙනසුරාදා"];
    const monthNames = ["ජනවාරි", "පෙබරවාරි", "මාර්තු", "අප්‍රේල්", "මැයි", "ජූනි", "ජූලි", "අගෝස්තු", "සැප්තැම්බර්", "ඔක්තෝබර්", "නොවැම්බර්", "දෙසැම්බර්"];
    const dayName = dayNames[d.getDay()];
    const monthName = monthNames[d.getMonth()];
    const formatted = `${d.getFullYear()} ${monthName} ${String(d.getDate()).padStart(2, '0')} (${dayName})`;
    return { date: d, iso, formatted, dayName };
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

  getRecentChangesStorageKey() {
    const uid = this.currentUser?.id || 'user_wosa';
    return `wosandi_recent_changes_${uid}`;
  }

  getLocalMealLogs() {
    try {
      const raw = localStorage.getItem(this.getLogsStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  getRecentChanges() {
    try {
      const raw = localStorage.getItem(this.getRecentChangesStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {}
    return [];
  }

  addRecentChange(text, type = 'info', points_delta = 0, icon = '📝') {
    const changes = this.getRecentChanges();
    const entry = {
      id: `rc_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: new Date().toISOString(),
      text,
      type,
      points_delta,
      icon
    };
    changes.unshift(entry);
    // Keep most recent 20 events
    const trimmed = changes.slice(0, 20);
    try {
      localStorage.setItem(this.getRecentChangesStorageKey(), JSON.stringify(trimmed));
    } catch (e) {}
    this.renderRecentChanges();
    this.saveRecentChangesToRemote(trimmed);
  }

  async saveRecentChangesToRemote(changes) {
    const uid = this.currentUser?.id || 'user_wosa';
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?on_conflict=config_key`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          config_key: `recent_changes_${uid}`,
          config_data: { changes },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }

  async loadRecentChanges() {
    const uid = this.currentUser?.id || 'user_wosa';
    const key = this.getRecentChangesStorageKey();
    let localChanges = this.getRecentChanges();
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.recent_changes_${uid}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.changes) {
          const remoteChanges = rows[0].config_data.changes;
          const seen = new Set();
          const merged = [];
          [...localChanges, ...remoteChanges].forEach(entry => {
            if (entry && entry.id && !seen.has(entry.id)) {
              seen.add(entry.id);
              merged.push(entry);
            }
          });
          merged.sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0));
          const trimmed = merged.slice(0, 20);
          localStorage.setItem(key, JSON.stringify(trimmed));
          this.renderRecentChanges();
          return trimmed;
        }
      }
    } catch (e) {}
    return localChanges;
  }

  async saveActiveMealToRemote(meal) {
    const uid = this.currentUser?.id || 'user_wosa';
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?on_conflict=config_key`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          config_key: `active_meal_${uid}`,
          config_data: meal,
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }

  async syncRemoteData() {
    try {
      await Promise.allSettled([
        this.loadActiveMeal(),
        this.fetchMealLogs(),
        this.loadRecentChanges()
      ]);
    } catch (e) {}
    this.updateState();
    this.renderAll();
    this.creditScore(true);
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // Detect system date on initial load (Requirement 2)
    this.systemDate = this.getSystemDate();

    // 1. Load local state & render immediately (zero delay)
    this.loadLocalMeal();
    this.renderAll();
    this.startTicker();

    // 2. Listen to user changes to isolate data per user
    if (typeof window !== 'undefined') {
      window.addEventListener('wosandi-user-changed', async (e) => {
        this.currentUser = e.detail || this.getActiveUser();
        this.systemDate = this.getSystemDate();
        this.loadLocalMeal();
        this.renderAll();
        await this.syncRemoteData();
      });
    }

    // 3. Background sync with remote database
    await this.syncRemoteData();
  }

  loadLocalMeal() {
    const key = this.getStorageKey();
    let localMeal = null;
    try {
      const raw = localStorage.getItem(key);
      if (raw) localMeal = JSON.parse(raw);
    } catch (e) {}
    this.activeMeal = localMeal;
    this.updateState();
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
          if (!localMeal || !localMeal.meal_timestamp || new Date(remoteMeal.meal_timestamp) >= new Date(localMeal.meal_timestamp)) {
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
      this.state = 'A'; // Ready / Idle
      return;
    }

    const mealTimeMs = new Date(this.activeMeal.meal_timestamp).getTime();
    const nowMs = Date.now();
    const elapsedSeconds = Math.max(0, Math.floor((nowMs - mealTimeMs) / 1000));
    const targetSeconds = this.getTargetGapSeconds();

    if (elapsedSeconds < targetSeconds) {
      this.state = 'B'; // Active Fasting Countdown
    } else {
      // Goal Met!
      this.state = 'C';
      
      // Auto-award 10 points when completing interval if not yet awarded
      if (this.activeMeal && !this.activeMeal.goal_awarded) {
        this.activeMeal.goal_awarded = true;
        this.activeMeal.goal_met = true;
        this.activeMeal.duration_elapsed = elapsedSeconds;
        localStorage.setItem(this.getStorageKey(), JSON.stringify(this.activeMeal));
        this.saveActiveMealToRemote(this.activeMeal);

        // Save completed log
        this.saveCompletedLog({
          id: this.activeMeal.id || `meal_${Date.now()}`,
          user_id: this.currentUser?.id || 'user_wosa',
          meal_timestamp: this.activeMeal.meal_timestamp,
          target_gap_seconds: targetSeconds,
          duration_elapsed: elapsedSeconds,
          goal_met: true,
          created_at: new Date().toISOString()
        });

        // Add Recent Changes log
        this.addRecentChange('පැය 5ක ආහාර විවේකය සාර්ථකව සම්පූර්ණයි (+10 ලකුණු)', 'goal', 10, '🏆');

        // Check if 3 intervals completed today for +50 bonus
        const pts = this.getTodayFastingPoints();
        if (pts.completedCount === 3) {
          this.addRecentChange('දෛනික ආහාර විවේක 3ම සම්පූර්ණයි (+50 බෝනස් ලකුණු!)', 'bonus', 50, '👑');
        }

        // Dynamically credit user's running total score
        this.creditScore();
      }
    }
  }

  creditScore(skipSave = false) {
    if (typeof window !== 'undefined') {
      if (typeof window.syncProgressWithServer === 'function' && typeof window.state !== 'undefined') {
        window.syncProgressWithServer(window.state, skipSave);
      }
    }
  }

  startTicker() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        console.error('MetabolicTracker tick error:', err);
      }
    }, 1000);
  }

  // Requirement 4: Time Controls (+ and - buttons)
  adjustTime(minutesDelta) {
    const now = Date.now();
    let currentMs = now;

    if (this.activeMeal && this.activeMeal.meal_timestamp) {
      currentMs = new Date(this.activeMeal.meal_timestamp).getTime();
    } else {
      // If idle, create an active meal right now
      this.activeMeal = {
        id: `meal_${Date.now()}`,
        user_id: this.currentUser?.id || 'user_wosa',
        meal_timestamp: new Date().toISOString(),
        created_at: new Date().toISOString()
      };
      currentMs = now;
    }

    // Increment or decrement the duration value:
    // +15m advances elapsed time (moves meal start time backward by 15 mins)
    // -15m decrements elapsed time (moves meal start time forward by 15 mins)
    const newMealTimeMs = currentMs - (minutesDelta * 60 * 1000);
    this.activeMeal.meal_timestamp = new Date(newMealTimeMs).toISOString();

    const uid = this.currentUser?.id || 'user_wosa';
    localStorage.setItem(this.getStorageKey(), JSON.stringify(this.activeMeal));
    this.saveActiveMealToRemote(this.activeMeal);

    // Log the adjustment to Recent Changes (Requirement 1 & 4)
    const actionDesc = minutesDelta > 0 
      ? `ටයිමරය විනාඩි ${Math.abs(minutesDelta)}කින් ඉදිරියට ගෙන යන ලදි (+)`
      : `ටයිමරය විනාඩි ${Math.abs(minutesDelta)}කින් ආපසු සකසන ලදි (-)`;
    this.addRecentChange(actionDesc, 'adjust', 0, minutesDelta > 0 ? '⏩' : '⏪');

    this.updateState();
    this.tick();
    this.renderRecentChanges();

    // Dynamically update server/localStorage state
    this.creditScore();
  }

  // Requirement 9: Gamification & Scoring Logic
  getTodayFastingPoints() {
    const today = this.getSystemDate().iso;
    const logs = this.getLocalMealLogs();

    // Count 5-hour intervals successfully completed today
    const todayCompleted = logs.filter(l => {
      const dStr = (l.meal_timestamp || l.created_at || '').split('T')[0];
      return dStr === today && l.goal_met === true;
    });

    const count = todayCompleted.length;
    // 10 points each time a 5-hour interval is successfully completed
    const cyclePoints = count * 10;
    // If all 3 daily intervals (3 x 5 hours) are completed in a single day, award an additional 50 bonus points
    const bonusPoints = (count >= 3) ? 50 : 0;
    const earnedPoints = cyclePoints + bonusPoints;
    const totalPossiblePoints = 80; // (3 intervals * 10) + 50 bonus points standard daily benchmark

    return {
      earnedPoints,
      totalPossiblePoints,
      completedCount: count,
      hasBonus: count >= 3,
      cyclePoints,
      bonusPoints
    };
  }

  renderAll() {
    this.renderBanner();
    this.renderDashboardCard();
    this.renderRecentChanges();
    this.tick();
  }

  // Requirement 1 & Dashboard Placement
  renderDashboardCard() {
    if (typeof document === 'undefined') return;

    let container = document.getElementById('fasting-tracker-card-container');
    if (!container) {
      const routineContainer = document.getElementById('routine-main-container');
      const quickTaskModal = document.getElementById('quick-task-modal-container');
      container = document.createElement('div');
      container.id = 'fasting-tracker-card-container';
      if (quickTaskModal && quickTaskModal.nextSibling) {
        routineContainer.insertBefore(container, quickTaskModal.nextSibling);
      } else if (routineContainer) {
        routineContainer.appendChild(container);
      }
    }

    if (!container) return;

    const dateInfo = this.getSystemDate();
    const pts = this.getTodayFastingPoints();

    container.innerHTML = `
      <section id="fasting-routine-tracker-card" class="bg-gradient-to-br from-white via-purple-50/40 to-pink-50/30 p-4 sm:p-5 rounded-3xl shadow-sm border border-purple-100 font-['Noto_Sans_Sinhala'] transition-all">
        
        <!-- Automated Date Selection (Requirement 2) & Header Status -->
        <div class="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-purple-100/80">
          <div class="flex items-center gap-1.5 text-xs font-bold text-indigo-700 bg-white px-3 py-1 rounded-full border border-indigo-100 shadow-2xs">
            <i class="fa-regular fa-calendar-check text-indigo-500"></i>
            <span id="fasting-auto-date">${dateInfo.formatted}</span>
          </div>
          <div class="flex items-center gap-1 text-[11px] font-black text-purple-700 bg-purple-100/70 px-2.5 py-1 rounded-full border border-purple-200 shadow-2xs">
            <i class="fa-solid fa-trophy text-amber-500"></i>
            <span id="fasting-card-pts">+${pts.earnedPoints} ලකුණු</span>
          </div>
        </div>

        <!-- Prominently Centered Header Notice (Requirement 5) -->
        <div class="text-center my-2">
          <div id="fasting-header-notice" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs sm:text-sm font-extrabold shadow-2xs transition-all ${this.state === 'B' ? 'animate-pulse' : ''}">
            <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
            <span>කෑම කාලා පැය 5ක් නෑ, ආයෙත් කෑවද?</span>
          </div>
        </div>

        <!-- Kid-Friendly Graphical Time Display (Requirement 3 & 6) -->
        <div class="py-2 flex items-center justify-center">
          <!-- Stylized Graphical Circular Dial for 8th Grader (Requirement 3) -->
          <div class="relative w-40 h-40 sm:w-48 sm:h-48 flex items-center justify-center select-none">
            <svg class="w-full h-full -rotate-90 drop-shadow-sm" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" stroke="#f1f5f9" stroke-width="8" fill="transparent" />
              <circle id="fasting-circle-dial" cx="50" cy="50" r="42" stroke="url(#fasting-dial-gradient)" stroke-width="8.5" fill="transparent" 
                      stroke-dasharray="264" stroke-dashoffset="264" stroke-linecap="round" class="transition-all duration-500" />
              <defs>
                <linearGradient id="fasting-dial-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#8b5cf6" />
                  <stop offset="50%" stop-color="#ec4899" />
                  <stop offset="100%" stop-color="#10b981" />
                </linearGradient>
              </defs>
            </svg>

            <!-- Responsive Timer Countdown in Dial Center (Requirement 6) -->
            <div class="absolute flex flex-col items-center justify-center text-center px-1">
              <span id="fasting-dial-center-icon" class="text-xl sm:text-2xl animate-bounce">⏱️</span>
              <span id="fasting-countdown-display" class="text-2xl sm:text-3xl md:text-4xl font-black font-mono tracking-tight text-slate-800 leading-none my-1">
                05:00:00
              </span>
              <span id="fasting-dial-subtext" class="text-[10px] font-extrabold text-purple-600 uppercase tracking-wider">
                5-Hour Gap
              </span>
            </div>
          </div>
        </div>

        <!-- Status Label & Progress Bar (Requirement 7) -->
        <div class="mt-1">
          <div id="fasting-status-label" class="text-xs sm:text-sm font-extrabold text-purple-700 text-center transition-all">
            ආහාර විවේකය ක්රියාත්මකයි (0% සම්පූර්ණයි)
          </div>

          <!-- Progress Bar & Tooltip Interactivity (Requirement 8) -->
          <div id="fasting-progress-wrapper" class="relative mt-2 w-full">
            <div id="fasting-progress-container" class="w-full bg-slate-100 hover:bg-slate-200/90 rounded-full h-3 sm:h-3.5 overflow-hidden relative cursor-pointer border border-slate-200/80 shadow-inner transition-colors">
              <div id="fasting-progress-bar-fill" class="h-full rounded-full bg-gradient-to-r from-violet-500 via-pink-500 to-emerald-400 transition-all duration-500 shadow-sm" style="width: 0%"></div>
            </div>

            <!-- Floating Interactive Tooltip (Requirement 8) -->
            <div id="fasting-tooltip" class="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] font-bold px-3 py-1 rounded-lg shadow-xl opacity-0 transition-opacity duration-200 z-30 whitespace-nowrap">
              <span id="fasting-tooltip-text">0.0% සම්පූර්ණයි • පැය 05:00 ඉතිරියි</span>
              <div class="w-2 h-2 bg-slate-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2"></div>
            </div>
          </div>
        </div>

        <!-- Action Button Trigger -->
        <div class="mt-3">
          <button id="fasting-card-action-btn" type="button" class="w-full py-2.5 px-4 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white">
            <i class="fa-solid fa-circle-check text-emerald-300"></i> [✔] කෑම වේලක් ගත්තා දැන්
          </button>
        </div>

        <!-- Gamification & Bonus Reward Matrix (Requirement 9) -->
        <div class="mt-3 pt-2.5 border-t border-purple-100 flex items-center justify-between text-[11px]">
          <div class="flex items-center gap-1.5 font-bold text-slate-600">
            <span>🎯 දෛනික චක්‍ර:</span>
            <span id="fasting-cycle-tracker" class="px-2 py-0.5 rounded-full font-black ${pts.completedCount >= 3 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-purple-100 text-purple-700'}">
              ${pts.completedCount}/3 සම්පූර්ණයි
            </span>
          </div>
          <div class="font-extrabold ${pts.hasBonus ? 'text-emerald-600' : 'text-slate-500'} flex items-center gap-1">
            <i class="fa-solid fa-star text-amber-400"></i>
            <span id="fasting-bonus-status">${pts.hasBonus ? '🏆 +50 බෝනස් ලකුණු ලැබුණි!' : '3ම සම්පූර්ණ කළ විට +50 බෝනස්'}</span>
          </div>
        </div>
      </section>
    `;

    // Bind Primary Action Button
    document.getElementById('fasting-card-action-btn')?.addEventListener('click', () => this.handleActionClick());

    // Bind Tooltip Events (Requirement 8)
    this.setupTooltipEvents();
  }

  // Requirement 8: Tooltip Interactivity on Desktop Hover & Mobile Touch
  setupTooltipEvents() {
    const container = document.getElementById('fasting-progress-container');
    const tooltip = document.getElementById('fasting-tooltip');
    if (!container || !tooltip) return;

    const showTooltip = (clientX) => {
      const rect = container.getBoundingClientRect();
      const pctPos = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      tooltip.style.left = `${pctPos * 100}%`;
      tooltip.style.opacity = '1';
    };

    const hideTooltip = () => {
      tooltip.style.opacity = '0';
    };

    container.addEventListener('mouseenter', (e) => showTooltip(e.clientX));
    container.addEventListener('mousemove', (e) => showTooltip(e.clientX));
    container.addEventListener('mouseleave', hideTooltip);

    // Mobile touch screens
    container.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches[0]) {
        showTooltip(e.touches[0].clientX);
      }
    }, { passive: true });

    container.addEventListener('touchend', () => {
      setTimeout(hideTooltip, 1500);
    });
  }

  // Requirement 1: Recent Changes Section Directly Below Daily Routine
  renderRecentChanges() {
    if (typeof document === 'undefined') return;

    let section = document.getElementById('recent-changes-section');
    if (!section) {
      const routineContainer = document.getElementById('routine-main-container');
      const cardContainer = document.getElementById('fasting-tracker-card-container');
      section = document.createElement('section');
      section.id = 'recent-changes-section';
      section.className = "bg-white p-4 rounded-2xl shadow-sm border border-purple-100 transition-all font-['Noto_Sans_Sinhala']";
      if (cardContainer && cardContainer.nextSibling) {
        routineContainer.insertBefore(section, cardContainer.nextSibling);
      } else if (routineContainer) {
        routineContainer.appendChild(section);
      }
    }

    if (!section) return;

    const changes = this.getRecentChanges();
    const countBadge = document.getElementById('recent-changes-count');
    if (countBadge) {
      countBadge.textContent = `${changes.length} සටහන්`;
    }

    const listEl = document.getElementById('recent-changes-list');
    if (!listEl) {
      section.innerHTML = `
        <div class="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
          <h3 class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid fa-clock-rotate-left text-indigo-500"></i> මෑත වෙනස්කම් (Recent Changes)
          </h3>
          <span id="recent-changes-count" class="text-[10px] font-semibold text-slate-400">${changes.length} සටහන්</span>
        </div>
        <div id="recent-changes-list" class="space-y-2"></div>
      `;
    }

    const targetList = document.getElementById('recent-changes-list');
    if (!targetList) return;

    if (changes.length === 0) {
      targetList.innerHTML = `
        <div class="p-3 text-center text-xs text-slate-400">
          <i class="fa-solid fa-check-double text-slate-300 mr-1"></i> අද දින මෑත වෙනස්කම් නොමැත.
        </div>
      `;
      return;
    }

    targetList.innerHTML = changes.slice(0, 8).map(c => {
      const d = new Date(c.timestamp);
      const timeStr = !isNaN(d.getTime()) 
        ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '';
      const isGoal = c.type === 'goal' || c.type === 'bonus';
      const isWarn = c.type === 'early_break';

      return `
        <div class="p-2 sm:p-2.5 rounded-xl border ${isGoal ? 'bg-emerald-50/70 border-emerald-200' : isWarn ? 'bg-amber-50/70 border-amber-200' : 'bg-slate-50 border-slate-200/70'} flex items-center justify-between gap-2 transition">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-sm shrink-0">${c.icon || '📝'}</span>
            <span class="text-xs font-semibold text-slate-700 truncate">${c.text}</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            ${c.points_delta > 0 ? `
              <span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                +${c.points_delta}
              </span>
            ` : ''}
            <span class="text-[10px] font-medium text-slate-400 font-mono">${timeStr}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  // Top Sticky Banner (Duplicate element removed; only single correct section under Daily Routine remains)
  renderBanner() {
    if (typeof document === 'undefined') return;
    const bannerContainer = document.getElementById('metabolic-tracker-sticky-container');
    if (bannerContainer) {
      if (typeof bannerContainer.remove === 'function') {
        bannerContainer.remove();
      } else if (bannerContainer.parentNode) {
        bannerContainer.parentNode.removeChild(bannerContainer);
      }
    }
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

  // Ticker execution (Synchronized across graphical dashboard card)
  tick() {
    if (typeof document === 'undefined') return;
    this.updateState();

    const targetGapSeconds = this.getTargetGapSeconds();

    // 1. Calculate time components
    let elapsedSeconds = 0;
    let remainingSeconds = targetGapSeconds;
    let pct = 0;

    if (this.activeMeal && this.activeMeal.meal_timestamp) {
      const mealTimeMs = new Date(this.activeMeal.meal_timestamp).getTime();
      elapsedSeconds = Math.max(0, Math.floor((Date.now() - mealTimeMs) / 1000));
      remainingSeconds = Math.max(0, targetGapSeconds - elapsedSeconds);
      pct = Math.min(100, Math.round((elapsedSeconds / targetGapSeconds) * 100));
    }

    const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, '0');
    const mins = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, '0');
    const secs = String(remainingSeconds % 60).padStart(2, '0');
    const timeDisplay = `${hours}:${mins}:${secs}`;
    const remH = Math.floor(remainingSeconds / 3600);
    const remM = Math.floor((remainingSeconds % 3600) / 60);

    // 2. Update Graphical Dashboard Card Elements (Requirements 3, 5, 6, 7, 8, 9)
    const cardDial = document.getElementById('fasting-circle-dial');
    const cardCountdown = document.getElementById('fasting-countdown-display');
    const cardStatusLabel = document.getElementById('fasting-status-label');
    const cardProgressBar = document.getElementById('fasting-progress-bar-fill');
    const cardActionBtn = document.getElementById('fasting-card-action-btn');
    const cardDialIcon = document.getElementById('fasting-dial-center-icon');
    const cardDialSubtext = document.getElementById('fasting-dial-subtext');
    const cardTooltipText = document.getElementById('fasting-tooltip-text');

    // Update Circular Dial Arc (Circumference: 264)
    if (cardDial) {
      const offset = 264 - (pct / 100) * 264;
      cardDial.style.strokeDashoffset = `${offset}`;
    }

    // Responsive Countdown Display (Requirement 6)
    if (cardCountdown) cardCountdown.textContent = timeDisplay;

    if (cardDialSubtext) {
      const targetHours = Math.round((targetGapSeconds / 3600) * 10) / 10;
      cardDialSubtext.textContent = targetHours === 5 ? '5-Hour Gap' : `${targetHours}h Gap`;
    }

    // Tooltip text (Requirement 8)
    if (cardTooltipText) {
      cardTooltipText.textContent = `${pct}% සම්පූර්ණයි • පැය ${remH}h ${mins}m ${secs}s ඉතිරියි`;
    }

    if (cardProgressBar) {
      cardProgressBar.style.width = `${pct}%`;
    }

    // Dynamic Gamification Badges Sync (Requirement 9)
    const pts = this.getTodayFastingPoints();
    const cardPtsEl = document.getElementById('fasting-card-pts');
    if (cardPtsEl) cardPtsEl.textContent = `+${pts.earnedPoints} ලකුණු`;
    const cycleTrackerEl = document.getElementById('fasting-cycle-tracker');
    if (cycleTrackerEl) {
      cycleTrackerEl.textContent = `${pts.completedCount}/3 සම්පූර්ණයි`;
      cycleTrackerEl.className = `px-2 py-0.5 rounded-full font-black ${pts.completedCount >= 3 ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-purple-100 text-purple-700'}`;
    }
    const bonusStatusEl = document.getElementById('fasting-bonus-status');
    if (bonusStatusEl) {
      bonusStatusEl.textContent = pts.hasBonus ? '🏆 +50 බෝනස් ලකුණු ලැබුණි!' : '3ම සම්පූර්ණ කළ විට +50 බෝනස්';
      if (bonusStatusEl.parentElement) {
        bonusStatusEl.parentElement.className = `font-extrabold ${pts.hasBonus ? 'text-emerald-600' : 'text-slate-500'} flex items-center gap-1`;
      }
    }

    // Dynamic State Rendering (Requirements 5 & 7)
    if (this.state === 'A') {
      // State A: Ready / Idle
      if (cardStatusLabel) {
        cardStatusLabel.textContent = 'විවේක කාලය නිමයි • කෑමට සූදානම්';
        cardStatusLabel.className = 'text-xs sm:text-sm font-extrabold text-emerald-600 text-center mt-1';
      }
      if (cardDialIcon) cardDialIcon.textContent = '🥪';
      if (cardActionBtn) {
        cardActionBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-300"></i> [✔] කෑම වේලක් ගත්තා දැන්';
        cardActionBtn.className = 'w-full py-2.5 px-4 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white';
      }
    } else if (this.state === 'B') {
      // State B: Active Fasting (Requirement 7)
      const statusText = `ආහාර විවේකය ක්රියාත්මකයි (${pct}% සම්පූර්ණයි)`;
      if (cardStatusLabel) {
        cardStatusLabel.textContent = statusText;
        cardStatusLabel.className = 'text-xs sm:text-sm font-extrabold text-amber-700 text-center mt-1';
      }
      if (cardDialIcon) cardDialIcon.textContent = '⏱️';
      if (cardActionBtn) {
        cardActionBtn.innerHTML = '<i class="fa-solid fa-triangle-exclamation text-amber-200 animate-pulse"></i> [⚠️] කෑම කාලා පැය 5ක් නෑ, ආයෙත් කෑවද?';
        cardActionBtn.className = 'w-full py-2.5 px-4 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 text-white';
      }
    } else if (this.state === 'C') {
      // State C: 5-Hour Goal Met
      if (cardStatusLabel) {
        cardStatusLabel.textContent = 'පැය 5ක ආහාර විවේකය සම්පූර්ණයි! (+10 ලකුණු) 🎯';
        cardStatusLabel.className = 'text-xs sm:text-sm font-extrabold text-emerald-600 text-center mt-1';
      }
      if (cardDialIcon) cardDialIcon.textContent = '🏆';
      if (cardActionBtn) {
        cardActionBtn.innerHTML = '<i class="fa-solid fa-circle-check text-emerald-300"></i> [✔] කෑම වේලක් ගත්තා දැන්';
        cardActionBtn.className = 'w-full py-2.5 px-4 text-xs font-black rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white';
      }
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

    const initialDate = prefillTimestamp ? new Date(prefillTimestamp) : new Date();
    const dateInfo = this.getSystemDate();

    let durationMinutes = Math.round((this.targetGapSeconds || FIVE_HOURS_SECONDS) / 60);

    modalContainer.innerHTML = `
      <dialog id="meal-logger-dialog" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 w-full h-full font-['Noto_Sans_Sinhala'] border-none" open>
        <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-5 sm:p-6 border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between pb-3 border-b border-slate-100">
            <div class="flex items-center gap-2">
              <span class="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-bold">🍽️</span>
              <h3 class="text-sm sm:text-base font-extrabold text-slate-800">කෑම වේලක් සහ ටයිමරය සැකසීම</h3>
            </div>
            <button type="button" id="close-meal-dialog" class="text-slate-400 hover:text-slate-600 text-lg cursor-pointer leading-none">&times;</button>
          </div>

          <form id="meal-logger-form" class="mt-4 space-y-3.5 text-xs">
            ${isEarlyBreak ? `
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-[11px] flex items-start gap-2 shadow-2xs">
                <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 shrink-0"></i>
                <div>
                  <strong>නියමිත කාලයට පෙර කෑමක්:</strong> මෙම කෑම වේල සටහන් කිරීමෙන් පසුගිය විවේක කාලය අවසන් වී නව ටයිමරයක් ආරම්භ වේ.
                </div>
              </div>
            ` : `
              <p class="text-slate-500 text-[11px] leading-relaxed">
                ආහාර ගත් වේලාව සහ විවේක කාල සීමාව පහතින් (+/- මගින්) සකසා ආරම්භ කළ හැක (දිනය ස්වයංක්‍රීයයි).
              </p>
            `}

            <!-- Automated System Date Selection (Date is set automatically) -->
            <div class="p-2.5 sm:p-3 bg-slate-50 border border-purple-100 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
              <div class="flex items-center gap-1.5 text-indigo-700 font-bold min-w-0 text-[11px] sm:text-xs">
                <i class="fa-regular fa-calendar-check text-indigo-500 text-sm shrink-0"></i>
                <span class="truncate">දිනය (ස්වයංක්‍රීයයි):</span>
              </div>
              <div class="text-right shrink-0">
                <span id="meal-auto-datetime-display" class="font-extrabold text-slate-700 font-mono text-[11px] sm:text-xs block">${dateInfo.formatted}</span>
                <span class="text-[9px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                  <i class="fa-solid fa-circle-check text-[8px]"></i> ස්වයංක්‍රීයව සටහන් වේ
                </span>
              </div>
            </div>

            <!-- Time Adjustment Controls (+ / - buttons, HH:MM no seconds, and separate AM/PM buttons) (Requirement 1) -->
            <div class="p-3 sm:p-3.5 bg-gradient-to-br from-purple-50/70 via-white to-pink-50/40 border border-purple-200/80 rounded-2xl shadow-2xs">
              <div class="flex items-center justify-between mb-2">
                <label class="text-[11px] font-black text-purple-900 uppercase tracking-wider flex items-center gap-1">
                  <i class="fa-regular fa-clock text-purple-600"></i> කෑම ගත් වේලාව (Meal Time)
                </label>
                <span class="text-[9px] font-semibold text-purple-600 bg-purple-100/70 px-2 py-0.5 rounded-full">තත්පර රහිතයි</span>
              </div>

              <div class="flex items-center justify-center gap-2 sm:gap-2.5">
                <!-- '-' Button (Requirement 1.1) -->
                <button type="button" id="meal-time-dec-btn" class="w-10 h-10 rounded-2xl bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-2xl flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer" title="විනාඩි 1ක් අඩු කරන්න (-1m)">
                  -
                </button>

                <!-- Time Input Display (HH:MM - Seconds not required, Requirement 1.2) -->
                <div class="flex items-center gap-1 bg-white border border-purple-200 rounded-2xl px-3 py-1.5 shadow-2xs">
                  <input type="number" id="meal-time-hour" min="1" max="12" class="w-9 sm:w-10 text-center font-mono font-black text-2xl text-purple-950 bg-transparent focus:outline-none focus:bg-purple-50 rounded" title="පැය (1-12)" />
                  <span class="font-mono font-black text-2xl text-purple-400 select-none pb-0.5">:</span>
                  <input type="number" id="meal-time-minute" min="0" max="59" class="w-9 sm:w-10 text-center font-mono font-black text-2xl text-purple-950 bg-transparent focus:outline-none focus:bg-purple-50 rounded" title="විනාඩි (00-59)" />
                </div>

                <!-- '+' Button (Requirement 1.1) -->
                <button type="button" id="meal-time-inc-btn" class="w-10 h-10 rounded-2xl bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-2xl flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer" title="විනාඩි 1ක් වැඩි කරන්න (+1m)">
                  +
                </button>

                <!-- Separate AM / PM Buttons (Requirement 1.3) -->
                <div class="flex flex-col rounded-xl p-1 bg-slate-100 border border-slate-200 gap-1 select-none">
                  <button type="button" id="meal-time-am-btn" class="px-2.5 py-1 text-[11px] font-black rounded-lg transition cursor-pointer">
                    AM
                  </button>
                  <button type="button" id="meal-time-pm-btn" class="px-2.5 py-1 text-[11px] font-black rounded-lg transition cursor-pointer">
                    PM
                  </button>
                </div>
              </div>
            </div>

            <!-- Timer Duration Setup Controls (+ and - buttons, no seconds) -->
            <div class="bg-gradient-to-br from-purple-50/80 via-indigo-50/50 to-pink-50/50 p-3.5 sm:p-4 rounded-2xl border border-purple-200/80 text-center shadow-2xs">
              <label class="block text-[11px] font-black text-purple-900 uppercase tracking-wider mb-2">
                ⏱️ විවේක කාල සීමාව (Rest Duration)
              </label>
              
              <div class="flex items-center justify-center gap-3 sm:gap-4 my-1">
                <!-- '-' Button -->
                <button type="button" id="modal-duration-dec" class="w-11 h-11 rounded-2xl bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-2xl flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer" title="විනාඩි 15ක් අඩු කරන්න (-15m)">
                  -
                </button>
                
                <!-- Display (Seconds not required, Requirement 1.2) -->
                <div class="px-4 py-2 bg-white rounded-2xl border border-purple-200 shadow-2xs min-w-[120px]">
                  <span id="modal-duration-display" class="text-2xl sm:text-3xl font-black font-mono tracking-tight text-purple-900 block leading-none">
                    05:00
                  </span>
                  <span id="modal-duration-label" class="text-[10px] font-extrabold text-purple-600 mt-1 block">
                    පැය 5ක පරිවෘත්තීය විවේකය
                  </span>
                </div>
                
                <!-- '+' Button -->
                <button type="button" id="modal-duration-inc" class="w-11 h-11 rounded-2xl bg-white hover:bg-purple-100 border border-purple-200 text-purple-700 font-black text-2xl flex items-center justify-center shadow-xs transition active:scale-90 cursor-pointer" title="විනාඩි 15ක් වැඩි කරන්න (+15m)">
                  +
                </button>
              </div>

              <div class="flex items-center justify-center gap-1.5 mt-2">
                <span class="text-[10px] text-slate-500 font-medium">නිරෝගී සම්මතය: <strong>පැය 5කි</strong></span>
                <button type="button" id="modal-duration-reset-btn" class="text-[10px] font-bold text-indigo-600 underline hover:text-indigo-800 ml-1 cursor-pointer">
                  පැය 5ට සකසන්න
                </button>
              </div>
            </div>

            <!-- Meal Type Dropdown (Requirement 2: Main Meal option removed) -->
            <div>
              <label class="block font-bold text-slate-700 uppercase tracking-wider mb-1">ආහාර වේල (Meal Type)</label>
              <select id="meal-type-select" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-purple-200 focus:outline-hidden">
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
                <i class="fa-solid fa-check"></i> ටයිමරය ආරම්භ කරන්න
              </button>
            </div>
          </form>
        </div>
      </dialog>
    `;

    const closeBtn = document.getElementById('close-meal-dialog');
    const cancelBtn = document.getElementById('cancel-meal-btn');
    const form = document.getElementById('meal-logger-form');
    const decBtn = document.getElementById('modal-duration-dec');
    const incBtn = document.getElementById('modal-duration-inc');
    const resetBtn = document.getElementById('modal-duration-reset-btn');
    const displayEl = document.getElementById('modal-duration-display');
    const labelEl = document.getElementById('modal-duration-label');

    // Time adjustment controls (Requirement 1.1, 1.2, 1.3)
    const hourInput = document.getElementById('meal-time-hour');
    const minuteInput = document.getElementById('meal-time-minute');
    const timeDecBtn = document.getElementById('meal-time-dec-btn');
    const timeIncBtn = document.getElementById('meal-time-inc-btn');
    const timeAmBtn = document.getElementById('meal-time-am-btn');
    const timePmBtn = document.getElementById('meal-time-pm-btn');
    const mealSelect = document.getElementById('meal-type-select');

    let currentHour24 = initialDate.getHours();
    let currentAmPm = currentHour24 >= 12 ? 'PM' : 'AM';
    let currentHour = currentHour24 % 12;
    if (currentHour === 0) currentHour = 12;
    let currentMinute = initialDate.getMinutes();

    // Smart default meal type based on hour
    if (mealSelect) {
      if (currentHour24 >= 4 && currentHour24 < 11) {
        mealSelect.value = 'breakfast';
      } else if (currentHour24 >= 11 && currentHour24 < 16) {
        mealSelect.value = 'lunch';
      } else if (currentHour24 >= 16 && currentHour24 < 22) {
        mealSelect.value = 'dinner';
      } else {
        mealSelect.value = 'snack';
      }
    }

    const updateTimeDisplay = () => {
      if (hourInput) hourInput.value = String(currentHour).padStart(2, '0');
      if (minuteInput) minuteInput.value = String(currentMinute).padStart(2, '0');

      if (timeAmBtn && timePmBtn) {
        if (currentAmPm === 'AM') {
          timeAmBtn.className = 'px-2.5 py-1 text-[11px] font-black rounded-lg transition cursor-pointer bg-purple-600 text-white shadow-xs';
          timePmBtn.className = 'px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer bg-transparent text-slate-500 hover:text-slate-800';
        } else {
          timePmBtn.className = 'px-2.5 py-1 text-[11px] font-black rounded-lg transition cursor-pointer bg-purple-600 text-white shadow-xs';
          timeAmBtn.className = 'px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer bg-transparent text-slate-500 hover:text-slate-800';
        }
      }
    };

    updateTimeDisplay();

    timeAmBtn?.addEventListener('click', () => {
      currentAmPm = 'AM';
      updateTimeDisplay();
    });

    timePmBtn?.addEventListener('click', () => {
      currentAmPm = 'PM';
      updateTimeDisplay();
    });

    timeDecBtn?.addEventListener('click', () => {
      currentMinute -= 1;
      if (currentMinute < 0) {
        currentMinute = 59;
        currentHour -= 1;
        if (currentHour < 1) currentHour = 12;
      }
      updateTimeDisplay();
    });

    timeIncBtn?.addEventListener('click', () => {
      currentMinute += 1;
      if (currentMinute > 59) {
        currentMinute = 0;
        currentHour += 1;
        if (currentHour > 12) currentHour = 1;
      }
      updateTimeDisplay();
    });

    hourInput?.addEventListener('input', () => {
      let val = parseInt(hourInput.value, 10);
      if (!isNaN(val) && val >= 1 && val <= 12) {
        currentHour = val;
      }
    });

    minuteInput?.addEventListener('input', () => {
      let val = parseInt(minuteInput.value, 10);
      if (!isNaN(val) && val >= 0 && val <= 59) {
        currentMinute = val;
      }
    });

    hourInput?.addEventListener('blur', () => {
      let val = parseInt(hourInput.value, 10);
      if (isNaN(val) || val < 1) currentHour = 12;
      else if (val > 12) currentHour = 12;
      else currentHour = val;
      updateTimeDisplay();
    });

    minuteInput?.addEventListener('blur', () => {
      let val = parseInt(minuteInput.value, 10);
      if (isNaN(val) || val < 0) currentMinute = 0;
      else if (val > 59) currentMinute = 59;
      else currentMinute = val;
      updateTimeDisplay();
    });

    const updateDisplay = () => {
      const h = Math.floor(durationMinutes / 60);
      const m = durationMinutes % 60;
      const hStr = String(h).padStart(2, '0');
      const mStr = String(m).padStart(2, '0');
      // Requirement 1.2: Seconds are not required
      if (displayEl) displayEl.textContent = `${hStr}:${mStr}`;
      if (labelEl) {
        if (h === 5 && m === 0) {
          labelEl.textContent = 'පැය 5ක පරිවෘත්තීය විවේකය';
        } else {
          labelEl.textContent = `පැය ${h}යි විනාඩි ${m}ක විවේකය (${hStr}h ${mStr}m)`;
        }
      }
    };

    updateDisplay();

    decBtn?.addEventListener('click', () => {
      if (durationMinutes > 15) {
        durationMinutes -= 15;
        updateDisplay();
      }
    });

    incBtn?.addEventListener('click', () => {
      if (durationMinutes < 1440) {
        durationMinutes += 15;
        updateDisplay();
      }
    });

    resetBtn?.addEventListener('click', () => {
      durationMinutes = 300; // 5 hours
      updateDisplay();
    });

    const closeDialog = () => {
      modalContainer.innerHTML = '';
    };

    closeBtn?.addEventListener('click', closeDialog);
    cancelBtn?.addEventListener('click', closeDialog);

    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      let typedH = parseInt(hourInput?.value, 10);
      if (!isNaN(typedH) && typedH >= 1 && typedH <= 12) currentHour = typedH;
      let typedM = parseInt(minuteInput?.value, 10);
      if (!isNaN(typedM) && typedM >= 0 && typedM <= 59) currentMinute = typedM;

      let h24 = currentHour;
      if (currentAmPm === 'AM') {
        if (h24 === 12) h24 = 0;
      } else {
        if (h24 < 12) h24 += 12;
      }

      // Date is automatically set from current system date (Requirement 1)
      const now = new Date();
      let mealDate = new Date();
      // If user kept the current hour & minute as now, preserve current seconds/ms so it starts immediately
      if (h24 === now.getHours() && currentMinute === now.getMinutes()) {
        mealDate.setSeconds(now.getSeconds(), now.getMilliseconds());
      } else {
        mealDate.setSeconds(0, 0);
      }
      if (mealDate > now) {
        mealDate = now;
      }

      const customDurationSeconds = durationMinutes * 60;
      const mealType = mealSelect?.value || 'dinner';
      try {
        await this.recordMeal(mealDate, customDurationSeconds, mealType);
      } finally {
        closeDialog();
      }
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
          <h3 class="text-base font-extrabold text-slate-800">කෑම කාලා පැය 5ක් නෑ, ආයෙත් කෑවද?</h3>
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

  async recordMeal(dateObj = new Date(), customDurationSeconds = null, mealType = null) {
    const isoString = dateObj.toISOString();
    const uid = this.currentUser?.id || 'user_wosa';
    const nowMs = dateObj.getTime();
    const targetGap = customDurationSeconds || this.targetGapSeconds || FIVE_HOURS_SECONDS;
    this.targetGapSeconds = targetGap;

    // 1. If there was a previous active meal, close its log entry with duration_elapsed & goal_met
    if (this.activeMeal && this.activeMeal.meal_timestamp) {
      const prevStartMs = new Date(this.activeMeal.meal_timestamp).getTime();
      const elapsedSeconds = Math.max(0, Math.floor((nowMs - prevStartMs) / 1000));
      const prevTargetGap = this.activeMeal.target_gap_seconds || FIVE_HOURS_SECONDS;
      const goalMet = elapsedSeconds >= prevTargetGap;

      const completedLog = {
        id: this.activeMeal.id || `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        user_id: uid,
        meal_timestamp: this.activeMeal.meal_timestamp,
        target_gap_seconds: prevTargetGap,
        duration_elapsed: elapsedSeconds,
        goal_met: goalMet,
        created_at: this.activeMeal.created_at || this.activeMeal.meal_timestamp
      };

      await this.saveCompletedLog(completedLog);

      if (goalMet) {
        this.addRecentChange('පැය 5ක ආහාර විවේකය සම්පූර්ණයි (+10 ලකුණු)', 'goal', 10, '🏆');
      } else {
        this.addRecentChange('නොමේරූ ආහාර ගැනීමක් සටහන් විය (පැය 5ට පෙර)', 'early_break', 0, '⚠️');
      }
    }

    // 2. Set new active meal
    const newMeal = {
      id: `meal_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      user_id: uid,
      meal_timestamp: isoString,
      meal_type: mealType || 'dinner',
      target_gap_seconds: targetGap,
      created_at: new Date().toISOString()
    };

    this.activeMeal = newMeal;
    localStorage.setItem(this.getStorageKey(), JSON.stringify(newMeal));

    const mealNames = {
      breakfast: 'උදෑසන ආහාරය',
      lunch: 'දිවා ආහාරය',
      dinner: 'රාත්‍රී ආහාරය',
      snack: 'සුළු ආහාරයක්'
    };
    const mealLabel = mealType ? (mealNames[mealType] || 'කෑම වේලක්') : 'ආහාර වේලක්';
    this.addRecentChange(`නව ${mealLabel} සටහන් විය (ටයිමරය ආරම්භ විය)`, 'meal', 0, '🍽️');

    // Save active meal to remote wosandi_admin_config
    await this.saveActiveMealToRemote(newMeal);

    this.updateState();
    this.renderAll();
    this.creditScore();
    this.startTicker();
  }

  async saveCompletedLog(log) {
    const key = this.getLogsStorageKey();
    let logs = [];
    try {
      const raw = localStorage.getItem(key);
      if (raw) logs = JSON.parse(raw);
    } catch (e) {}

    logs.unshift(log);
    logs = logs.slice(0, 100);
    localStorage.setItem(key, JSON.stringify(logs));

    // Try remote meal_logs table
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

    // Dual backup in wosandi_admin_config with on_conflict resolution
    try {
      const uid = this.currentUser?.id || 'user_wosa';
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?on_conflict=config_key`, {
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
          remoteLogs.forEach(r => {
            if (!logs.some(l => l.id === r.id || l.meal_timestamp === r.meal_timestamp)) {
              logs.push(r);
            }
          });
          localStorage.setItem(key, JSON.stringify(logs));
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

    const validDurations = logs.filter(l => Number(l.duration_elapsed) > 0);
    let avgSeconds = 0;
    if (validDurations.length > 0) {
      const sum = validDurations.reduce((acc, curr) => acc + Number(curr.duration_elapsed), 0);
      avgSeconds = Math.round(sum / validDurations.length);
    }
    const avgH = Math.floor(avgSeconds / 3600);
    const avgM = Math.floor((avgSeconds % 3600) / 60);

    const sevenDaysAgo = Date.now() - 7 * 24 * 3600 * 1000;
    const weeklyLogs = logs.filter(l => new Date(l.meal_timestamp).getTime() >= sevenDaysAgo);
    const targetSet = weeklyLogs.length > 0 ? weeklyLogs : logs;
    const compliantCount = targetSet.filter(l => l.goal_met === true).length;
    const complianceRate = Math.round((compliantCount / targetSet.length) * 100);

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
