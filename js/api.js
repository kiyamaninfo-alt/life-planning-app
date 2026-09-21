const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

// 1. පිටුව Refresh කළ විට අද දවසේ දත්ත ලබා ගැනීම
async function loadTodayData() {
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
    }
  } catch (err) {
    console.error("දත්ත ලබා ගැනීමේ දෝෂයක්:", err);
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
  
  // දිනපතා අනිවාර්ය කාර්යයන් සඳහා මූලික ඇස්තමේන්තුව (Base Total)
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

  // ලබාගත් ලකුණු ගණනය කිරීම
  if (state.wake_up === "05:00 - 05:30") earnedPoints += 10;
  else if (state.wake_up === "05:30 - 06:00") earnedPoints += 8;
  else if (state.wake_up) earnedPoints += 4;

  if (state.school_attended) earnedPoints += 5;
  if (state.school_subjects && typeof state.school_subjects === "object") {
    earnedPoints += Math.min(25, Object.keys(state.school_subjects).length * 2.5);
  }

  if (state.maths_practice) earnedPoints += 20;
  if (state.gemini_english) earnedPoints += 15;
  if (state.vocab_words) earnedPoints += 15;
  if (state.dance_workout) earnedPoints += 15;
  if (state.exercise_schedule) earnedPoints += 15;
  if (state.hair_care) earnedPoints += 5; // එකතු කළා
  if (state.clean_wardrobe) earnedPoints += 5;
  if (state.clean_room) earnedPoints += 5;
  if (state.water_plants) earnedPoints += 5;
  if (state.sweep_floor) earnedPoints += 5;
  if (state.dispose_garbage) earnedPoints += 5;

  // ප්‍රතිශතය ගණනය කිරීම (ලබාගත් / මුළු ලකුණු * 100)
  const percentage = Math.min(100, Math.round((earnedPoints / totalPossiblePoints) * 100));

  let rank = "🌟 Rising Star";
  if (percentage >= 90) rank = "👑 Prima Ballerina & K-Pop Superstar";
  else if (percentage >= 75) rank = "✨ Stage Ready Idol";
  else if (percentage >= 50) rank = "🎀 Talented Trainee";

  updateUI(percentage, earnedPoints, totalPossiblePoints, rank);

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
          earned_points: earnedPoints,
          total_possible_points: totalPossiblePoints,
          percentage: percentage,
          is_fully_completed: percentage === 100,
          updated_at: new Date().toISOString()
        })
      });
      if (!res.ok) console.error("Supabase Save Error");
    } catch (err) {}
  }
}

function updateUI(percent, earned, total, rank) {
  const percentEl = document.getElementById("progress-percent");
  const scoreEl = document.getElementById("score-text");
  const rankEl = document.getElementById("rank-badge");
  const circle = document.getElementById("progress-circle");

  if (percentEl) percentEl.innerText = `${percent}%`;
  if (scoreEl) scoreEl.innerText = `${earned} / ${total} ලකුණු`;
  if (rankEl) rankEl.innerText = rank;
  
  // Graph එක නිවැරදිව පිරවීම සඳහා setAttribute භාවිතය
  if (circle) {
    const offset = 264 - (percent / 100) * 264;
    circle.setAttribute('stroke-dashoffset', offset);
  }
}

// පිටුව Load වන විට දත්ත කැඳවීම
document.addEventListener("DOMContentLoaded", () => {
  loadTodayData();
});
