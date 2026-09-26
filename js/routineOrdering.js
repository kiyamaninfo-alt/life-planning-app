/**
 * routineOrdering.js - Daily Routine Arrangement & Progressive Task Unlocking Engine
 * Controls:
 * 1. Ordering of front-page cards/sections (what is 1st, 2nd, 3rd, etc.)
 * 2. Progressive unlocking rules (show sections/tasks only after completing prerequisite tasks)
 */

export const DEFAULT_ROUTINE_CONFIG = {
  display_mode: 'hidden', // 'hidden' or 'locked_banner'
  sections: [
    {
      id: 'flow',
      title_si: 'අන්තර්ක්‍රියාකාරී ප්‍රශ්නාවලිය (Published Flow)',
      icon: 'fa-solid fa-sparkles text-amber-500',
      order: 1,
      enabled: true,
      depends_on: 'none'
    },
    {
      id: 'wake_up',
      title_si: '1. අවදි වූ වේලාව (Wake-up Time)',
      icon: 'fa-regular fa-clock text-pink-500',
      order: 2,
      enabled: true,
      depends_on: 'none'
    },
    {
      id: 'school',
      title_si: '2. පාසල් පැමිණීම සහ විෂයන් (School & Subjects)',
      icon: 'fa-solid fa-school text-indigo-500',
      order: 3,
      enabled: true,
      depends_on: 'none'
    },
    {
      id: 'study',
      title_si: '3. අධ්‍යාපන කටයුතු (Study Tasks)',
      icon: 'fa-solid fa-book-open text-purple-500',
      order: 4,
      enabled: true,
      depends_on: 'none'
    },
    {
      id: 'fitness',
      title_si: '4. නැටුම් සහ ව්‍යායාම (Ballet & Fitness)',
      icon: 'fa-solid fa-music text-pink-500',
      order: 5,
      enabled: true,
      depends_on: 'none'
    },
    {
      id: 'chores',
      title_si: '5. නිවසේ සහ පෞද්ගලික වැඩ (Chores & Habits)',
      icon: 'fa-solid fa-house text-emerald-500',
      order: 6,
      enabled: true,
      depends_on: 'none'
    }
  ],
  tasks: [
    { id: 'maths_practice', title_si: 'දිනකට ගණන් 10ක් හැදුවාද?', section: 'study', depends_on: 'none', enabled: true },
    { id: 'gemini_english', title_si: 'ජෙමිනි සමඟ විනාඩි 10ක් ඉංග්‍රීසියෙන් කතා කළාද?', section: 'study', depends_on: 'none', enabled: true },
    { id: 'vocab_words', title_si: 'අලුත් ඉංග්‍රීසි වචන 5ක් පාඩම් කළාද?', section: 'study', depends_on: 'none', enabled: true },
    { id: 'dance_workout', title_si: 'සින්දුවක් දමාගෙන විනාඩි 10ක් නැටුවාද?', section: 'fitness', depends_on: 'none', enabled: true },
    { id: 'exercise_schedule', title_si: 'විනාඩි 20ක ව්‍යායාම / Gymnastics කළාද?', section: 'fitness', depends_on: 'none', enabled: true },
    { id: 'clean_room', title_si: 'කාමරය අස් කළාද?', section: 'chores', depends_on: 'none', enabled: true },
    { id: 'water_plants', title_si: 'පැල වලට වතුර දැම්මාද?', section: 'chores', depends_on: 'none', enabled: true },
    { id: 'sweep_floor', title_si: 'යට තට්ටුව අතු ගෑවාද?', section: 'chores', depends_on: 'none', enabled: true },
    { id: 'dispose_garbage', title_si: 'කුණු බාල්දි හිස් කර බඳුන් වලට දැම්මාද?', section: 'chores', depends_on: 'none', enabled: true },
    { id: 'hair_care', title_si: 'උකුණෝ පීරුවාද?', section: 'chores', depends_on: 'none', enabled: true },
    { id: 'clean_wardrobe', title_si: 'අල්මාරිය පිළිවෙල කළාද? (Weekly)', section: 'chores', depends_on: 'none', enabled: true }
  ]
};

export const PREREQUISITE_RULES = [
  { id: 'none', label: '-- සැමවිටම පෙන්වන්න (Always Visible) --' },
  { id: 'wake_up', label: '1. අවදි වූ වේලාව තේරූ පසු (After Wake-up Time is selected)' },
  { id: 'school', label: '2. පාසල් ගියාද යන්න සලකුණු කළ පසු (After School is marked)' },
  { id: 'flow', label: 'ප්‍රශ්නාවලිය (Flow) කළ පසු (After Flow questionnaire)' },
  { id: 'study', label: '3. අධ්‍යාපන කටයුතු කළ පසු (After Study tasks)' },
  { id: 'maths_practice', label: 'ගණන් 10ක් හැදූ පසු (After Maths Practice)' },
  { id: 'gemini_english', label: 'ජෙමිනි English කළ පසු (After Gemini English)' },
  { id: 'vocab_words', label: 'අලුත් වචන 5ක් පාඩම් කළ පසු (After Vocab Words)' },
  { id: 'fitness', label: '4. නැටුම් හෝ ව්‍යායාම කළ පසු (After Ballet/Fitness)' },
  { id: 'dance_workout', label: 'නැටුම් විනාඩි 10 කළ පසු (After Dance Workout)' },
  { id: 'clean_room', label: 'කාමරය අස් කළ පසු (After Clean Room)' }
];

const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

/**
 * Checks if a given prerequisite condition is satisfied based on current state
 */
export function isConditionSatisfied(prereqId, state) {
  if (!prereqId || prereqId === 'none') return true;
  if (!state) return false;

  switch (prereqId) {
    case 'wake_up':
      return Boolean(state.wake_up);
    case 'school':
    case 'school_attended':
      return Boolean(state.school_attended);
    case 'flow':
    case 'flow_completed':
      return Number(state.flow_points) > 0 || state.flow_completed === true;
    case 'study':
      return Boolean(state.maths_practice || state.gemini_english || state.vocab_words);
    case 'maths_practice':
      return Boolean(state.maths_practice);
    case 'gemini_english':
      return Boolean(state.gemini_english);
    case 'vocab_words':
      return Boolean(state.vocab_words);
    case 'fitness':
      return Boolean(state.dance_workout || state.exercise_schedule);
    case 'dance_workout':
      return Boolean(state.dance_workout);
    case 'exercise_schedule':
      return Boolean(state.exercise_schedule);
    case 'clean_room':
      return Boolean(state.clean_room);
    case 'water_plants':
      return Boolean(state.water_plants);
    case 'sweep_floor':
      return Boolean(state.sweep_floor);
    case 'dispose_garbage':
      return Boolean(state.dispose_garbage);
    case 'hair_care':
      return Boolean(state.hair_care);
    case 'clean_wardrobe':
      return Boolean(state.clean_wardrobe);
    default:
      return Boolean(state[prereqId]);
  }
}

/**
 * Loads current routine config from localStorage or Supabase
 */
export async function loadRoutineConfig() {
  let config = null;

  // 1. Instant local storage retrieval
  try {
    const raw = localStorage.getItem('wosandi_routine_order_config');
    if (raw) config = JSON.parse(raw);
  } catch (e) {}

  // 2. Network sync if not found
  if (!config) {
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.routine_layout_config`, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (rows && rows[0]?.config_data) {
          config = rows[0].config_data;
          try {
            localStorage.setItem('wosandi_routine_order_config', JSON.stringify(config));
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn("Could not fetch routine config from Supabase:", e);
    }
  }

  // Deep clone default if still null
  if (!config || !Array.isArray(config.sections)) {
    config = JSON.parse(JSON.stringify(DEFAULT_ROUTINE_CONFIG));
  } else {
    // Ensure all default sections exist
    DEFAULT_ROUTINE_CONFIG.sections.forEach(defSec => {
      const found = config.sections.find(s => s.id === defSec.id);
      if (!found) {
        config.sections.push({ ...defSec, order: config.sections.length + 1 });
      }
    });
  }

  return config;
}

/**
 * Saves routine configuration to localStorage and Supabase
 */
export async function saveRoutineConfig(config) {
  if (!config) return;

  // Save to local storage immediately
  try {
    localStorage.setItem('wosandi_routine_order_config', JSON.stringify(config));
  } catch (e) {}

  // Save to Supabase wosandi_admin_config
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify({
        config_key: 'routine_layout_config',
        config_data: config,
        description: 'Daily routine section ordering and progressive unlocking dependency rules',
        updated_at: new Date().toISOString()
      })
    });
  } catch (e) {
    console.warn("Could not persist routine config to Supabase:", e);
  }
}

/**
 * Re-orders front-page sections according to config and enforces progressive unlocking
 */
export function applyRoutineOrderAndDependencies(stateObj) {
  const container = document.getElementById("routine-main-container") || document.querySelector("main.space-y-4");
  if (!container) return;

  let config = null;
  try {
    const raw = localStorage.getItem('wosandi_routine_order_config');
    if (raw) config = JSON.parse(raw);
  } catch (e) {}
  if (!config) config = DEFAULT_ROUTINE_CONFIG;

  const sortedSections = [...config.sections].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  // Partition into active (uncompleted) and completed sections
  // Completed cards (including live flow) are automatically sent to the bottom!
  const isSecDone = (secId) => {
    if (typeof window !== 'undefined' && typeof window.isSectionCompleted === 'function') {
      return window.isSectionCompleted(secId, stateObj);
    }
    if (!stateObj) return false;
    if (secId === 'flow') return Boolean(stateObj.flow_completed || (Number(stateObj.flow_points) > 0 && window.flowPlayer?.currentNode?.type === 'end'));
    if (secId === 'wake_up') return Boolean(stateObj.wake_up);
    if (secId === 'school') return Boolean(stateObj.school_attended);
    if (secId === 'study') return Boolean(stateObj.maths_practice && stateObj.gemini_english && stateObj.vocab_words);
    if (secId === 'fitness') return Boolean(stateObj.dance_workout && stateObj.exercise_schedule);
    if (secId === 'chores') return Boolean(stateObj.clean_room && stateObj.water_plants && stateObj.sweep_floor && stateObj.dispose_garbage && stateObj.hair_care && stateObj.clean_wardrobe);
    return Boolean(stateObj[secId]);
  };

  const activeSections = [];
  const completedSections = [];
  sortedSections.forEach(sec => {
    if (isSecDone(sec.id)) {
      completedSections.push(sec);
    } else {
      activeSections.push(sec);
    }
  });

  const finalOrderedSections = [...activeSections, ...completedSections];

  finalOrderedSections.forEach(sec => {
    const el = container.querySelector(`[data-section-id="${sec.id}"]`);
    if (!el) return;

    // 1. Move element to bottom of container in partitioned order (uncompleted first, completed to bottom!)
    container.appendChild(el);

    // 2. Evaluate progressive unlocking condition
    const isUnlocked = isConditionSatisfied(sec.depends_on, stateObj);

    if (sec.enabled === false) {
      el.classList.add("hidden");
    } else if (sec.id === 'flow' && (!window.flowPlayer || !window.flowPlayer.flow)) {
      // Flow only shows if a published flow exists
      el.classList.add("hidden");
    } else if (!isUnlocked) {
      if (config.display_mode === 'locked_banner') {
        el.classList.add("hidden");
        let placeholder = container.querySelector(`.routine-lock-banner[data-for="${sec.id}"]`);
        if (!placeholder) {
          placeholder = document.createElement('div');
          placeholder.className = 'routine-lock-banner p-3.5 bg-slate-50/90 rounded-2xl border border-dashed border-purple-200 flex items-center justify-between text-xs text-purple-700 shadow-2xs transition-all';
          placeholder.setAttribute('data-for', sec.id);
          const prereqObj = PREREQUISITE_RULES.find(d => d.id === sec.depends_on);
          const prereqLabel = prereqObj ? prereqObj.label.replace(/^-- | --$/g, '') : sec.depends_on;
          placeholder.innerHTML = `
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs">🔒</span>
              <div>
                <span class="font-bold text-slate-700 block">${sec.title_si}</span>
                <span class="text-[11px] text-slate-500">විවෘත වන්නේ: ${prereqLabel}</span>
              </div>
            </div>
            <span class="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Locked</span>
          `;
          container.insertBefore(placeholder, el);
        } else {
          placeholder.classList.remove('hidden');
          container.insertBefore(placeholder, el);
        }
      } else {
        el.classList.add("hidden");
        const placeholder = container.querySelector(`.routine-lock-banner[data-for="${sec.id}"]`);
        if (placeholder) placeholder.classList.add("hidden");
      }
    } else {
      el.classList.remove("hidden");
      const placeholder = container.querySelector(`.routine-lock-banner[data-for="${sec.id}"]`);
      if (placeholder) placeholder.classList.add("hidden");
    }
  });

  // 3. Task-level dependencies inside sections
  if (Array.isArray(config.tasks)) {
    config.tasks.forEach(t => {
      const taskEl = document.querySelector(`[data-task-id="${t.id}"]`);
      if (!taskEl) return;
      const isTaskUnlocked = isConditionSatisfied(t.depends_on, stateObj);
      if (t.enabled === false || !isTaskUnlocked) {
        taskEl.classList.add("hidden");
      } else {
        taskEl.classList.remove("hidden");
      }
    });
  }
}

// Global initialization
if (typeof window !== 'undefined') {
  window.routineOrdering = {
    loadRoutineConfig,
    saveRoutineConfig,
    applyRoutineOrderAndDependencies,
    isConditionSatisfied,
    PREREQUISITE_RULES,
    DEFAULT_ROUTINE_CONFIG
  };

  window.addEventListener('DOMContentLoaded', async () => {
    await loadRoutineConfig();
    const currentState = (typeof state !== 'undefined' ? state : (typeof window !== 'undefined' ? window.state : null));
    if (currentState) {
      applyRoutineOrderAndDependencies(currentState);
    }
  });
}
