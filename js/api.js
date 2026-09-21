const WORKER_URL = "/calculate";

async function syncProgressWithServer(state) {
  if (typeof playChime === "function") playChime();

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: state })
    });
    const data = await res.json();
    if (data.status === "success") {
      updateUI(data.percentage, data.earnedPoints, data.totalPossiblePoints, data.rank);
    } else {
      console.error("Server responded with error:", data);
    }
  } catch (err) {
    console.error("API Sync Error:", err);
  }
}

function updateUI(percent, earned, total, rank) {
  document.getElementById("progress-percent").innerText = `${percent}%`;
  document.getElementById("score-text").innerText = `${earned} / ${total} ලකුණු`;
  document.getElementById("rank-badge").innerText = rank;
  const circle = document.getElementById("progress-circle");
  const offset = 264 - (percent / 100) * 264;
  circle.style.strokeDashoffset = offset;
}
