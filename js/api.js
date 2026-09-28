const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

// Day of week metadata (Sinhala day names and seasonal baseline fallbacks)
const DOW_META = [
  { name: "ඉරිදා", defaultTarget: 120 },     // 0 = Sunday
  { name: "සඳුදා", defaultTarget: 150 },     // 1 = Monday
  { name: "අඟහරුවාදා", defaultTarget: 150 }, // 2 = Tuesday
  { name: "බදාදා", defaultTarget: 145 },     // 3 = Wednesday
  { name: "බ්‍රහස්පතින්දා", defaultTarget: 145 }, // 4 = Thursday
  { name: "සිකුරාදා", defaultTarget: 135 },   // 5 = Friday
  { name: "සෙනසුරාදා", defaultTarget: 160 }  // 6 = Saturday
];

// Circular progress instance with hardware-accelerated SVG Arc & synchronized CountUp
let circularGraph = null;
let currentDayBenchmark = 140;

function initCircularGraph() {
  const Cls = typeof CircularProgress === 'function' ? CircularProgress : (typeof window !== 'undefined' ? window.CircularProgress : null);
  if (Cls) {
    circularGraph = new Cls({
      circle: '#progress-circle',
      percentEl: '#progress-percent',
      scoreEl: '#score-text',
      duration: 600,
      scoreFormatter: (earned, total) => `${earned} / ${total} ලකුණු`
    });
  }
}

/**
 * 3.1 Day-of-the-Week Target Estimation (Historical Seasonality)
 * Aggregates historical points earned on that exact same day of the week
 * across previous weeks (e.g. average of last 3-4 Mondays)
 */
async function estimateDayOfWeekBenchmark() {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const dayOfWeek = today.getDay();
  const meta = DOW_META[dayOfWeek];
  const dowEl = document.getElementById("dow-benchmark");

  // Cache in localStorage — skip Supabase fetch if already computed today
  try {
    const cached = localStorage.getItem('wosandi_dow_benchmark_' + todayStr);
    if (cached) {
      const parsed = JSON.parse(cached);
      currentDayBenchmark = parsed.benchmark || meta.defaultTarget;
      if (dowEl && parsed.label) dowEl.innerText = parsed.label;
      return;
    }
  } catch (e) {}

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?select=log_date,earned_points&order=log_date.desc&limit=35`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      const logs = await res.json();
      const sameDowLogs = (Array.isArray(logs) ? logs : []).filter(log => {
        if (!log.log_date || log.log_date === todayStr) return false;
        const d = new Date(log.log_date);
        return d.getDay() === dayOfWeek && Number(log.earned_points) > 0;
      }).slice(0, 4);

      if (sameDowLogs.length >= 1) {
        const sum = sameDowLogs.reduce((acc, curr) => acc + Number(curr.earned_points), 0);
        currentDayBenchmark = Math.round(sum / sameDowLogs.length);
        const label = `🎯 ${meta.name} ඉලක්කය: ${currentDayBenchmark} ලකුණු (${sameDowLogs.length} සති සාමාන්‍යය)`;
        if (dowEl) dowEl.innerText = label;
        try { localStorage.setItem('wosandi_dow_benchmark_' + todayStr, JSON.stringify({ benchmark: currentDayBenchmark, label })); } catch (e) {}
        return;
      }
    }
  } catch (e) {}

  currentDayBenchmark = meta.defaultTarget;
  if (dowEl) dowEl.innerText = `🎯 ${meta.name} දෛනික ඉලක්කය: ගණනය වෙමින්...`;
}

// 1. පිටුව Refresh කළ විට අද දවසේ දත්ත ලබා ගැනීම
async function loadTodayData() {
  initCircularGraph();
  await estimateDayOfWeekBenchmark();

  const today = new Date().toISOString().split("T")[0];
  const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
    ? window.userManagerClient.getCurrentUser()
    : { id: 'user_wosa', username: 'Wosa' };
  const isPrimaryUser = !currentUser || currentUser.username === 'Wosa' || currentUser.id === 'user_wosa';

  const userKey = (typeof window !== 'undefined' && window.userManagerClient?.getRoutineStateKey)
    ? window.userManagerClient.getRoutineStateKey(today)
    : ('wosandi_routine_state_' + today);

  // Instant zero-flicker restoration from same-day local cache
  try {
    const cached = isPrimaryUser
      ? (localStorage.getItem(userKey) || localStorage.getItem('wosandi_routine_state_' + today))
      : localStorage.getItem(userKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      Object.assign(state, parsed);
      if (typeof syncStateToUI === 'function') syncStateToUI();
    }
  } catch (e) {}

  if (isPrimaryUser) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?select=*&log_date=eq.${today}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      const data = await res.json();
      
      if (data && data.length > 0) {
        const dbState = data[0].completed_tasks;
        Object.assign(state, dbState);
        try {
          localStorage.setItem('wosandi_routine_state_' + today, JSON.stringify(state));
          localStorage.setItem(userKey, JSON.stringify(state));
        } catch (e) {}
        if (typeof syncStateToUI === 'function') syncStateToUI();
        syncProgressWithServer(state, true); // UI පමණක් යාවත්කාලීන කරයි
      } else {
        if (typeof syncStateToUI === 'function') syncStateToUI();
        syncProgressWithServer(state, true);
      }
    } catch (err) {
      console.error("දත්ත ලබා ගැනීමේ දෝෂයක්:", err);
      if (typeof syncStateToUI === 'function') syncStateToUI();
      syncProgressWithServer(state, true);
    }
  } else {
    // Non-primary user: fetch their specific log from wosandi_admin_config
    try {
      const userConfigKey = `user_log_${currentUser.id}_${today}`;
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.${userConfigKey}`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].config_data?.completed_tasks) {
          const dbState = rows[0].config_data.completed_tasks;
          Object.assign(state, dbState);
          try {
            localStorage.setItem(userKey, JSON.stringify(state));
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("User log fetch error:", err);
    }
    if (typeof syncStateToUI === 'function') syncStateToUI();
    syncProgressWithServer(state, true);
  }
}

// 2. ඔබගේ ගතික (Dynamic) ලකුණු ගණනය කිරීමේ ක්‍රියාවලිය
async function syncProgressWithServer(state, skipSave = false) {
  if (!skipSave && typeof playChime === "function") playChime();

  const todayObj = new Date();
  const todayDate = todayObj.toISOString().split("T")[0];
  const dayOfWeek = todayObj.getDay(); // 0 = ඉරිදා, 1 = සඳුදා ... 6 = සෙනසුරාදා
  const isWeekend = (dayOfWeek === 0 || dayOfWeek === 6);

  let earnedPoints = 0;
  let totalPossiblePoints = 0;

  // 1. Core Routine Wake Up
  const wakeEl = (typeof document !== 'undefined') ? document.querySelector('[data-section-id="wake_up"]') : null;
  const isWakeActive = wakeEl ? !wakeEl.classList.contains('hidden') : true;
  if (isWakeActive) {
    totalPossiblePoints += 10;
    if (state.wake_up === "05:00 - 05:30") earnedPoints += 10;
    else if (state.wake_up === "05:30 - 06:00") earnedPoints += 8;
    else if (state.wake_up) earnedPoints += 4;
  }

  // 2. Core School Attendance & Subjects
  const schoolEl = (typeof document !== 'undefined') ? document.querySelector('[data-section-id="school"]') : null;
  const isSchoolActive = schoolEl ? !schoolEl.classList.contains('hidden') : true;
  if (isSchoolActive) {
    if (!isWeekend) {
      totalPossiblePoints += 30;
    } else {
      if (state.school_attended) totalPossiblePoints += 5;
      if (state.school_subjects && Object.keys(state.school_subjects).length > 0) {
        totalPossiblePoints += Math.min(25, Object.keys(state.school_subjects).length * 2.5);
      }
    }
    if (state.school_attended) earnedPoints += 5;
    if (state.school_subjects && typeof state.school_subjects === "object") {
      earnedPoints += Math.min(25, Object.keys(state.school_subjects).length * 2.5);
    }
  }

  // 3. Dynamic Published Tasks from Admin Panel (wosandi_tasks: global + user-specific)
  if (typeof window !== 'undefined' && Array.isArray(window.publishedAdminTasks)) {
    window.publishedAdminTasks.forEach(task => {
      const pts = Number(task.weight_points) || 10;
      totalPossiblePoints += pts;
      const key = task.schema_definition?.linked_state_key || task.id;
      if (state[task.id] === true || (key && state[key] === true)) {
        earnedPoints += pts;
      }
    });
  }

  // Published Flow Points from Flow Player
  if (state.flow_points && !isNaN(state.flow_points)) {
    earnedPoints += Number(state.flow_points);
  }
  if (state.flow_total_points && !isNaN(state.flow_total_points)) {
    totalPossiblePoints += Number(state.flow_total_points);
  }

  // Save same-day state to localStorage immediately for zero reload delay
  try {
    const userSaveKey = (typeof window !== 'undefined' && window.userManagerClient?.getRoutineStateKey)
      ? window.userManagerClient.getRoutineStateKey(todayDate)
      : ('wosandi_routine_state_' + todayDate);
    localStorage.setItem(userSaveKey, JSON.stringify(state));
    // For Wosa, ensure canonical fallback key is also maintained
    const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser) ? window.userManagerClient.getCurrentUser() : null;
    if (!currentUser || currentUser.username === 'Wosa' || currentUser.id === 'user_wosa') {
      localStorage.setItem('wosandi_routine_state_' + todayDate, JSON.stringify(state));
    }
  } catch (e) {}

  // 2.2 Defensive Zero / Division-by-Zero Guard
  const validTotal = (totalPossiblePoints > 0) ? totalPossiblePoints : 0;
  const validEarned = (earnedPoints > 0) ? earnedPoints : 0;
  const percentage = validTotal > 0 ? Math.min(100, Math.round((validEarned / validTotal) * 100)) : 0;

  let rank = "🌟 Rising Star";
  if (percentage >= 90) rank = "👑 Prima Ballerina & K-Pop Superstar";
  else if (percentage >= 75) rank = "✨ Stage Ready Idol";
  else if (percentage >= 50) rank = "🎀 Talented Trainee";

  updateUI(percentage, validEarned, validTotal, rank);

  // Update day benchmark to today's dynamic routine total
  const dowMeta = DOW_META[dayOfWeek];
  const dowEl = (typeof document !== 'undefined') ? document.getElementById("dow-benchmark") : null;
  if (dowEl && validTotal > 0) {
    dowEl.innerText = `🎯 ${dowMeta.name} ඉලක්කය: ${validTotal} ලකුණු`;
  }

  // Keep active user header pill in sync
  if (typeof window !== 'undefined' && window.userManagerClient?.updateUserHeaderPill) {
    window.userManagerClient.updateUserHeaderPill();
  }

  // Apply routine ordering and progressive unlocking rules based on current state
  if (typeof window !== 'undefined' && window.routineOrdering && typeof window.routineOrdering.applyRoutineOrderAndDependencies === 'function') {
    window.routineOrdering.applyRoutineOrderAndDependencies(state);
  }

  // Update routine sections auto-collapse state
  if (typeof updateSectionCollapseStates === 'function') {
    updateSectionCollapseStates(state);
  }

  if (!skipSave) {
    const currentUser = (typeof window !== 'undefined' && window.userManagerClient?.getCurrentUser)
      ? window.userManagerClient.getCurrentUser()
      : { id: 'user_wosa', username: 'Wosa' };
    const isPrimaryUser = !currentUser || currentUser.username === 'Wosa' || currentUser.id === 'user_wosa';

    // 1. Primary Supabase daily_logs save ONLY for primary user
    if (isPrimaryUser) {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs`, {
          method: "POST",
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            "Content-Type": "application/json",
            Prefer: "resolution=merge-duplicates"
          },
          body: JSON.stringify({
            log_date: todayDate,
            completed_tasks: {
              ...state,
              _user_id: currentUser.id,
              _username: currentUser.username
            },
            earned_points: validEarned,
            total_possible_points: validTotal,
            percentage: percentage,
            is_fully_completed: percentage === 100,
            updated_at: new Date().toISOString()
          })
        });
        if (!res.ok) console.error("Supabase Save Error");
      } catch (err) {}
    }

    // 2. User-specific performance save in wosandi_admin_config
    try {
      const userConfigKey = `user_log_${currentUser.id}_${todayDate}`;
      await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          config_key: userConfigKey,
          config_data: {
            user_id: currentUser.id,
            username: currentUser.username,
            log_date: todayDate,
            earned_points: validEarned,
            total_possible_points: validTotal,
            percentage: percentage,
            is_fully_completed: percentage === 100,
            completed_tasks: state,
            updated_at: new Date().toISOString()
          },
          description: `Daily performance log for ${currentUser.username} on ${todayDate}`
        })
      });
    } catch (err) {}

    // 3. User performance history cache in localStorage
    try {
      const historyKey = `wosandi_perf_history_${currentUser.id}`;
      let history = [];
      const cached = localStorage.getItem(historyKey);
      if (cached) {
        try { history = JSON.parse(cached); } catch (e) {}
      }
      if (!Array.isArray(history)) history = [];
      const entry = {
        user_id: currentUser.id,
        username: currentUser.username,
        log_date: todayDate,
        earned_points: validEarned,
        total_possible_points: validTotal,
        percentage: percentage,
        is_fully_completed: percentage === 100,
        updated_at: new Date().toISOString()
      };
      const idx = history.findIndex(h => h.log_date === todayDate);
      if (idx >= 0) {
        history[idx] = entry;
      } else {
        history.unshift(entry);
      }
      localStorage.setItem(historyKey, JSON.stringify(history.slice(0, 30)));
    } catch (e) {}
  }
}

/**
 * 1.1 Hardware-Accelerated SVG Arc & 1.2 Synchronized CountUp Animation
 */
function updateUI(percent, earned, total, rank) {
  const rankEl = document.getElementById("rank-badge");
  if (rankEl) rankEl.innerText = rank;

  if (circularGraph) {
    circularGraph.update(earned, total);
  } else {
    // Fallback if circularGraph not yet instantiated
    const percentEl = document.getElementById("progress-percent");
    const scoreEl = document.getElementById("score-text");
    const circle = document.getElementById("progress-circle");
    if (percentEl) percentEl.innerText = `${percent}%`;
    if (scoreEl) scoreEl.innerText = `${earned} / ${total} ලකුණු`;
    if (circle) {
      const offset = 264 - (percent / 100) * 264;
      circle.style.strokeDashoffset = `${offset}`;
    }
  }
}

// පිටුව Load වන විට දත්ත කැඳවීම
document.addEventListener("DOMContentLoaded", () => {
  loadTodayData();
});
