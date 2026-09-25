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
  const dayOfWeek = today.getDay();
  const meta = DOW_META[dayOfWeek];
  const dowEl = document.getElementById("dow-benchmark");

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs?select=log_date,earned_points,total_possible_points&order=log_date.desc&limit=35`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`
      }
    });

    if (res.ok) {
      const logs = await res.json();
      const todayStr = today.toISOString().split("T")[0];

      // Filter historical logs matching exact same day of week (excluding today and zero-scores)
      const sameDowLogs = (Array.isArray(logs) ? logs : []).filter(log => {
        if (!log.log_date || log.log_date === todayStr) return false;
        const d = new Date(log.log_date);
        return d.getDay() === dayOfWeek && Number(log.earned_points) > 0;
      }).slice(0, 4); // Take last 3-4 same days of week

      if (sameDowLogs.length >= 1) {
        const sum = sameDowLogs.reduce((acc, curr) => acc + Number(curr.earned_points), 0);
        currentDayBenchmark = Math.round(sum / sameDowLogs.length);
        if (dowEl) {
          dowEl.innerText = `🎯 ${meta.name} ඉලක්කය: ${currentDayBenchmark} ලකුණු (${sameDowLogs.length} සති සාමාන්‍යය)`;
        }
        return;
      }
    }
  } catch (e) {
    console.warn("Could not query historical day-of-week seasonality, using baseline", e);
  }

  // Fallback to day of week seasonal baseline
  currentDayBenchmark = meta.defaultTarget;
  if (dowEl) {
    dowEl.innerText = `🎯 ${meta.name} ඉලක්කය: ${currentDayBenchmark} ලකුණු (Seasonality Baseline)`;
  }
}

// 1. පිටුව Refresh කළ විට අද දවසේ දත්ත ලබා ගැනීම
async function loadTodayData() {
  initCircularGraph();
  await estimateDayOfWeekBenchmark();

  const today = new Date().toISOString().split("T")[0];
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
      syncProgressWithServer(state, true); // UI පමණක් යාවත්කාලීන කරයි
    } else {
      syncProgressWithServer(state, true);
    }
  } catch (err) {
    console.error("දත්ත ලබා ගැනීමේ දෝෂයක්:", err);
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
  
  // 3.3 Weighted Scoring (Academic Priority Schema)
  // Base total for routine & habits
  let totalPossiblePoints = 120; 

  // සතියේ දිනක් නම් පාසල සඳහා (පාසලට 5 + විෂයන් සඳහා උපරිම 25) අමතර ලකුණු 30ක් එකතු කරයි
  if (!isWeekend) {
    totalPossiblePoints += 30; 
  } else {
    // සතිඅන්තයේ වුවද පාසල් ගොස් ඇත්නම් හෝ විෂයන් තෝරා ඇත්නම් එම ප්‍රමාණය මුළු ලකුණු ඇස්තමේන්තුවට එකතු කරයි
    if (state.school_attended) totalPossiblePoints += 5;
    if (state.school_subjects && Object.keys(state.school_subjects).length > 0) {
       totalPossiblePoints += Math.min(25, Object.keys(state.school_subjects).length * 2.5);
    }
  }

  // Routine Wake up (Tier 3 Routine)
  if (state.wake_up === "05:00 - 05:30") earnedPoints += 10;
  else if (state.wake_up === "05:30 - 06:00") earnedPoints += 8;
  else if (state.wake_up) earnedPoints += 4;

  // School Attendance & Subjects (Tier 1 Core Academic)
  if (state.school_attended) earnedPoints += 5;
  if (state.school_subjects && typeof state.school_subjects === "object") {
    earnedPoints += Math.min(25, Object.keys(state.school_subjects).length * 2.5);
  }

  // High Academic Priority Tier (20 & 15 points)
  if (state.maths_practice) earnedPoints += 20;
  if (state.gemini_english) earnedPoints += 15;
  if (state.vocab_words) earnedPoints += 15;

  // Ballet & Physical Arts Tier (15 points)
  if (state.dance_workout) earnedPoints += 15;
  if (state.exercise_schedule) earnedPoints += 15;

  // Secondary Chores & Habits Tier (5 points)
  if (state.hair_care) earnedPoints += 5;
  if (state.clean_wardrobe) earnedPoints += 5;
  if (state.clean_room) earnedPoints += 5;
  if (state.water_plants) earnedPoints += 5;
  if (state.sweep_floor) earnedPoints += 5;
  if (state.dispose_garbage) earnedPoints += 5;

  // 2.2 Defensive Zero / Division-by-Zero Guard
  const validTotal = (totalPossiblePoints > 0) ? totalPossiblePoints : 0;
  const validEarned = (earnedPoints > 0) ? earnedPoints : 0;
  const percentage = validTotal > 0 ? Math.min(100, Math.round((validEarned / validTotal) * 100)) : 0;

  let rank = "🌟 Rising Star";
  if (percentage >= 90) rank = "👑 Prima Ballerina & K-Pop Superstar";
  else if (percentage >= 75) rank = "✨ Stage Ready Idol";
  else if (percentage >= 50) rank = "🎀 Talented Trainee";

  updateUI(percentage, validEarned, validTotal, rank);

  if (!skipSave) {
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
          completed_tasks: state,
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
