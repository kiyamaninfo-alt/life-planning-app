const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

async function syncProgressWithServer(state) {
  if (typeof playChime === "function") playChime();

  const today = new Date().toISOString().split("T")[0];

  // ලකුණු ගණනය කිරීම (Study Tasks සඳහා වැඩි Weightage එකක් සහිතව)
  let earnedPoints = 0;
  const totalPossiblePoints = 140;

  if (state.wake_up === "05:00 - 05:30") earnedPoints += 10;
  else if (state.wake_up === "05:30 - 06:00") earnedPoints += 8;
  else if (state.wake_up) earnedPoints += 4;

  if (state.school_attended) earnedPoints += 5;
  if (state.school_subjects && typeof state.school_subjects === "object") {
    const count = Object.keys(state.school_subjects).length;
    earnedPoints += Math.min(25, count * 2.5);
  }
  if (state.maths_practice) earnedPoints += 20;
  if (state.gemini_english) earnedPoints += 15;
  if (state.vocab_words) earnedPoints += 15;
  if (state.dance_workout) earnedPoints += 15;
  if (state.exercise_schedule) earnedPoints += 15;
  if (state.clean_wardrobe) earnedPoints += 5;
  if (state.clean_room) earnedPoints += 5;
  if (state.water_plants) earnedPoints += 5;
  if (state.sweep_floor) earnedPoints += 5;
  if (state.dispose_garbage) earnedPoints += 5;

  const percentage = Math.min(100, Math.round((earnedPoints / totalPossiblePoints) * 100));

  let rank = "🌟 Rising Star";
  if (percentage >= 90) rank = "👑 Prima Ballerina & K-Pop Superstar";
  else if (percentage >= 75) rank = "✨ Stage Ready Idol";
  else if (percentage >= 50) rank = "🎀 Talented Trainee";

  // UI එක ක්ෂණිකව Update කිරීම
  updateUI(percentage, earnedPoints, totalPossiblePoints, rank);

  // සෘජුවම Supabase daily_logs වගුවට Save / Upsert කිරීම
  try {
    const logData = {
      log_date: today,
      completed_tasks: state,
      earned_points: earnedPoints,
      total_possible_points: totalPossiblePoints,
      percentage: percentage,
      is_fully_completed: percentage === 100,
      updated_at: new Date().toISOString(),
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates",
      },
      body: JSON.stringify(logData),
    });

    if (!res.ok) {
      console.error("Supabase Save Error:", await res.text());
    } else {
      console.log("Supabase Synced Successfully!");
    }
  } catch (err) {
    console.error("Network Error:", err);
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
  if (circle) {
    const offset = 264 - (percent / 100) * 264;
    circle.style.strokeDashoffset = offset;
  }
}
