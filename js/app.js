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
}

function checkAdminPin() {
  if (document.getElementById("admin-pin").value === "1234") {
    document.getElementById("admin-pin-screen").classList.add("hidden");
    document.getElementById("admin-content").classList.remove("hidden");
  } else {
    alert("මුරපදය වැරදියි!");
  }
}
