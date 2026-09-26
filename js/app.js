const subjects = [
  "සිංහල", "ගණිතය", "බුද්ධාගම", "විද්‍යාව", "නැටුම්", 
  "භූගෝල විද්‍යාව", "English", "දෙමළ", "සෞඛ්‍යය", "ICT", "PTS", "ඉතිහාසය"
];

let state = {
  wake_up: null,
  school_attended: false,
  school_subjects: {},
  maths_practice: false,
  gemini_english: false,
  vocab_words: false,
  dance_workout: false,
  exercise_schedule: false,
  clean_room: false,
  water_plants: false,
  sweep_floor: false,
  dispose_garbage: false,
  hair_care: false,
  clean_wardrobe: false
};
if (typeof window !== "undefined") window.state = state;

// Subjects Buttons සකස් කිරීම
document.addEventListener("DOMContentLoaded", () => {
  const subGrid = document.getElementById("subjects-grid");
  if (!subGrid) return;
  
  subjects.forEach(sub => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "text-xs p-2 rounded-xl border border-slate-200 text-slate-600 transition text-center hover:border-pink-300";
    btn.innerText = sub;
    btn.onclick = () => toggleSubject(sub, btn);
    subGrid.appendChild(btn);
  });
});

function toggleSchool(val) {
  state.school_attended = val;
  document.getElementById("subjects-container").classList.toggle("hidden", !val);
  syncProgressWithServer(state);
}

function toggleSubject(sub, btn) {
  if (state.school_subjects[sub]) {
    delete state.school_subjects[sub];
    btn.classList.remove("bg-pink-500", "text-white", "border-pink-500");
  } else {
    state.school_subjects[sub] = { homework: false, studied: false };
    btn.classList.add("bg-pink-500", "text-white", "border-pink-500");
  }
  renderHomework();
  syncProgressWithServer(state);
}

function renderHomework() {
  const container = document.getElementById("homework-details");
  container.innerHTML = "";
  Object.keys(state.school_subjects).forEach(sub => {
    const div = document.createElement("div");
    div.className = "p-2 bg-slate-50 rounded-xl text-xs space-y-1 border border-slate-100";
    div.innerHTML = `
      <div class="font-bold text-slate-700">${sub}</div>
      <div class="flex gap-4">
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" onchange="state.school_subjects['${sub}'].homework=this.checked; syncProgressWithServer(state);"> Homework කළාද?
        </label>
        <label class="flex items-center gap-1 cursor-pointer">
          <input type="checkbox" onchange="state.school_subjects['${sub}'].studied=this.checked; syncProgressWithServer(state);"> පාඩම් කළාද?
        </label>
      </div>
    `;
    container.appendChild(div);
  });
}

function setWakeTime(slot) {
  state.wake_up = slot;
  document.querySelectorAll(".wake-btn").forEach(b => {
    b.classList.toggle("bg-pink-500", b.dataset.val === slot);
    b.classList.toggle("text-white", b.dataset.val === slot);
  });
  syncProgressWithServer(state);
}

function toggleTask(key, val) {
  state[key] = val;
  syncProgressWithServer(state);
}

// Admin Panel Dialog
function openAdminModal() {
  document.getElementById("admin-modal").classList.remove("hidden");
  document.getElementById("admin-modal").classList.add("flex");
}

function closeAdminModal() {
  document.getElementById("admin-modal").classList.add("hidden");
  document.getElementById("admin-modal").classList.remove("flex");
  // Reset PIN state so re-opening requires PIN again
  document.getElementById("admin-pin-screen").classList.remove("hidden");
  document.getElementById("admin-content").classList.add("hidden");
  document.getElementById("admin-pin").value = "";
}

function checkAdminPin() {
  if (document.getElementById("admin-pin").value === "1234") {
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
    // Reset ALL state keys including string and object types
    state.wake_up = null;
    state.school_attended = false;
    state.school_subjects = {};
    Object.keys(state).forEach(key => {
      if (typeof state[key] === "boolean") state[key] = false;
    });

    // Uncheck all UI checkboxes and reset school toggle
    document.querySelectorAll("input[type='checkbox']").forEach(cb => cb.checked = false);

    // Reset wake time button UI
    document.querySelectorAll(".wake-btn").forEach(b => {
      b.classList.remove("bg-pink-500", "text-white", "border-pink-500");
    });

    // Hide subjects container and clear homework details
    const subjectsContainer = document.getElementById("subjects-container");
    if (subjectsContainer) subjectsContainer.classList.add("hidden");

    const homeworkDetails = document.getElementById("homework-details");
    if (homeworkDetails) homeworkDetails.innerHTML = "";

    // Reset subject buttons
    const subjectsGrid = document.getElementById("subjects-grid");
    if (subjectsGrid) {
      subjectsGrid.querySelectorAll("button").forEach(btn => {
        btn.classList.remove("bg-pink-500", "text-white", "border-pink-500");
      });
    }

    // Sync reset state to Supabase via existing sync function
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
    // Call the actual data loading function from api.js
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
