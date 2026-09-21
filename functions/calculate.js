const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

export async function onRequest(context) {
  const { request } = context;
  const today = new Date().toISOString().split("T")[0];

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  try {
    if (request.method === "POST") {
      const body = await request.json();
      const answers = body.answers || {};

      // 1. Supabase වෙතින් tasks වල ලකුණු ලබා ගැනීම
      const res = await fetch(`${SUPABASE_URL}/rest/v1/routine_tasks?is_active=eq.true`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      const tasks = await res.json();

      let earnedPoints = 0;
      let totalPossiblePoints = 0;

      if (Array.isArray(tasks)) {
        tasks.forEach((task) => {
          totalPossiblePoints += task.points;
          const userAns = answers[task.id];

          if (userAns !== undefined && userAns !== null && userAns !== false) {
            if (task.id === "wake_up") {
              if (userAns === "05:00 - 05:30") earnedPoints += task.points;
              else if (userAns === "05:30 - 06:00") earnedPoints += task.points * 0.8;
              else earnedPoints += task.points * 0.4;
            } else if (task.type === "subject_checklist" && typeof userAns === "object") {
              const selectedCount = Object.keys(userAns).length;
              if (selectedCount > 0) {
                earnedPoints += Math.min(task.points, selectedCount * 2.5);
              }
            } else if (userAns === true) {
              earnedPoints += task.points;
            }
          }
        });
      }

      const percentage = totalPossiblePoints > 0 
        ? Math.round((earnedPoints / totalPossiblePoints) * 100) 
        : 0;

      let rank = "🌟 Rising Star";
      if (percentage >= 90) rank = "👑 Prima Ballerina & K-Pop Superstar";
      else if (percentage >= 75) rank = "✨ Stage Ready Idol";
      else if (percentage >= 50) rank = "🎀 Talented Trainee";

      // 2. Supabase හි daily_logs වගුවට Save / Upsert කිරීම
      const logData = {
        log_date: today,
        completed_tasks: answers,
        earned_points: earnedPoints,
        total_possible_points: totalPossiblePoints,
        percentage: percentage,
        is_fully_completed: percentage === 100,
        updated_at: new Date().toISOString(),
      };

      const saveRes = await fetch(`${SUPABASE_URL}/rest/v1/daily_logs`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(logData),
      });

      if (!saveRes.ok) {
        const errDetail = await saveRes.text();
        return new Response(
          JSON.stringify({ status: "error", message: "Supabase Error: " + errDetail }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          status: "success",
          earnedPoints,
          totalPossiblePoints,
          percentage,
          rank,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ status: "online", message: "Pages Function is active." }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: "error", message: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
