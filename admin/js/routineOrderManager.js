import { DEFAULT_ROUTINE_CONFIG, PREREQUISITE_RULES, loadRoutineConfig, saveRoutineConfig } from '../../js/routineOrdering.js?v=20260926-v3';

export class RoutineOrderManager {
  constructor(containerEl, api, toastFn) {
    this.containerEl = containerEl;
    this.api = api;
    this.toast = toastFn;
    this.config = null;
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="p-6 max-w-4xl mx-auto space-y-6 font-['Noto_Sans_Sinhala']">
        <div class="flex justify-between items-center pb-4 border-b border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <i class="fas fa-sort-amount-down-alt text-indigo-600"></i> දින චර්යාවේ පිළිවෙල සහ අනුක්‍රමික විවෘත කිරීම
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              ප්‍රධාන පිටුවේ (<a href="../index.html" target="_blank" class="text-indigo-600 underline">life-planning-app.pages.dev</a>) 1 වන, 2 වන, 3 වන ආදී වශයෙන් දිස්වන අනුපිළිවෙල සකසන්න සහ පූර්ව කාර්යයන් සම්පූර්ණ කළ පසු පමණක් කාර්යයන් පෙන්වීමේ කොන්දේසි සකසන්න.
            </p>
          </div>
          <div class="flex items-center gap-2">
            <button id="rom-reset-btn" type="button" class="px-3 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition flex items-center gap-1.5">
              <i class="fas fa-rotate-left"></i> යථා තත්ත්වයට (Reset)
            </button>
            <button id="rom-save-btn" type="button" class="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition flex items-center gap-1.5">
              <i class="fas fa-save"></i> පිළිවෙල සුරකින්න (Save)
            </button>
          </div>
        </div>

        <div id="rom-content" class="text-center py-12 text-slate-400">සැකසුම් පූරණය වෙමින් පවතී...</div>
      </div>
    `;

    document.getElementById('rom-save-btn').addEventListener('click', () => this.save());
    document.getElementById('rom-reset-btn').addEventListener('click', () => this.resetDefaults());

    await this.load();
  }

  async load() {
    this.config = await loadRoutineConfig();
    this.renderForm();
  }

  renderForm() {
    const contentEl = document.getElementById('rom-content');
    if (!contentEl) return;

    const sections = [...(this.config.sections || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
    const tasks = this.config.tasks || [];
    const displayMode = this.config.display_mode || 'hidden';

    contentEl.className = 'space-y-6 text-left';
    contentEl.innerHTML = `
      <!-- 1. Display Mode Toggle -->
      <div class="bg-white p-4 rounded-xl shadow-xs border border-slate-200">
        <label class="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
          Locked Item Appearance (අගුළු දැමූ කාර්යයන් පෙන්වන ආකාරය)
        </label>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${displayMode === 'hidden' ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 font-semibold' : 'border-slate-200 text-slate-600'}">
            <input type="radio" name="rom-display-mode" value="hidden" ${displayMode === 'hidden' ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500">
            <div>
              <span class="text-xs font-bold block">1. සම්පූර්ණයෙන්ම සඟවන්න (Completely Hide)</span>
              <span class="text-[11px] text-slate-500">පූර්ව කාර්යයන් සම්පූර්ණ කරන තෙක් අගුළු දැමූ කාර්යයන් සම්පූර්ණයෙන්ම සැඟවී පවතී</span>
            </div>
          </label>
          <label class="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition ${displayMode === 'locked_banner' ? 'border-indigo-500 bg-indigo-50/40 text-indigo-900 font-semibold' : 'border-slate-200 text-slate-600'}">
            <input type="radio" name="rom-display-mode" value="locked_banner" ${displayMode === 'locked_banner' ? 'checked' : ''} class="text-indigo-600 focus:ring-indigo-500">
            <div>
              <span class="text-xs font-bold block">2. අගුළු දමා පෙන්වන්න (Show Locked Banner)</span>
              <span class="text-[11px] text-slate-500">අවශ්‍ය කාර්යය කුමක්දැයි පැහැදිලි කරමින් අගුළු දැමූ කාඩ්පතක් පෙන්වයි</span>
            </div>
          </label>
        </div>
      </div>

      <!-- 2. Section Ordering and Progressive Unlocking -->
      <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i class="fas fa-layer-group text-indigo-600"></i> ප්‍රධාන චර්යා කොටස් (1, 2, 3 පිළිවෙල)
            </h3>
            <p class="text-[11px] text-slate-500">මුල් පිටුවේ පිළිවෙල වෙනස් කිරීමට ඉහළට/පහළට ගෙනයන්න, සහ එක් එක් කොටස විවෘත වන අවස්ථාව තෝරන්න.</p>
          </div>
          <span class="text-xs font-mono font-bold bg-indigo-100 text-indigo-700 px-2.5 py-0.5 rounded-full">${sections.length} කොටස්</span>
        </div>

        <div id="rom-sections-list" class="divide-y divide-slate-100">
          ${sections.map((sec, idx) => {
            const isFirst = idx === 0;
            const isLast = idx === sections.length - 1;
            const ordinal = idx === 0 ? '1 වන' : (idx === 1 ? '2 වන' : (idx === 2 ? '3 වන' : `${idx + 1} වන`));
            const isFlow = sec.id === 'flow';

            return `
              <div class="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/80 transition rom-section-row" data-id="${sec.id}" data-order="${idx + 1}">
                <!-- Left: Rank Badge, Move Buttons, Title -->
                <div class="flex items-center gap-3">
                  <!-- Rank Badge -->
                  <div class="flex flex-col items-center">
                    <span class="w-8 h-8 rounded-full ${idx === 0 ? 'bg-amber-100 text-amber-800 border-amber-300 font-black' : 'bg-slate-100 text-slate-700 font-bold'} border flex items-center justify-center text-xs shadow-2xs">
                      ${idx + 1}
                    </span>
                    <span class="text-[9px] font-bold uppercase text-slate-400 mt-0.5">${ordinal}</span>
                  </div>

                  <!-- Move Up / Down Buttons -->
                  <div class="flex flex-col gap-1">
                    <button type="button" class="rom-move-up p-1 rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 text-xs transition disabled:opacity-30 disabled:cursor-not-allowed" data-id="${sec.id}" ${isFirst ? 'disabled' : ''} title="ඉහළට ගෙනයන්න (කලින් පෙන්වන්න)">
                      <i class="fas fa-chevron-up"></i>
                    </button>
                    <button type="button" class="rom-move-down p-1 rounded bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-500 text-xs transition disabled:opacity-30 disabled:cursor-not-allowed" data-id="${sec.id}" ${isLast ? 'disabled' : ''} title="පහළට ගෙනයන්න (පසුව පෙන්වන්න)">
                      <i class="fas fa-chevron-down"></i>
                    </button>
                  </div>

                  <!-- Section Title & Meta -->
                  <div>
                    <h4 class="text-sm font-bold text-slate-800 font-['Noto_Sans_Sinhala'] flex items-center gap-2">
                      <i class="${sec.icon || 'fas fa-circle text-slate-400'} text-xs"></i>
                      ${sec.title_si}
                    </h4>
                    <span class="text-[11px] font-mono text-slate-400">අංකය: ${sec.id}</span>
                  </div>
                </div>

                <!-- Right: Prerequisite Condition Dropdown & Enable/Disable -->
                <div class="flex items-center gap-3">
                  <div class="flex flex-col">
                    <label class="text-[10px] font-bold text-slate-500 mb-0.5">පෙන්වීමේ කොන්දේසිය (Show after completing):</label>
                    <select class="rom-depends-select text-xs border-slate-300 rounded-lg p-1.5 bg-white font-medium text-slate-700 focus:ring-indigo-500 focus:border-indigo-500" data-id="${sec.id}">
                      ${PREREQUISITE_RULES.map(rule => `
                        <option value="${rule.id}" ${sec.depends_on === rule.id ? 'selected' : ''}>
                          ${rule.label}
                        </option>
                      `).join('')}
                    </select>
                  </div>

                  <label class="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-700 select-none pt-4" title="ප්‍රධාන මුහුණතේ සක්‍රිය/අක්‍රිය කිරීම">
                    <input type="checkbox" class="rom-enabled-toggle rounded text-indigo-600 h-4 w-4" ${sec.enabled !== false ? 'checked' : ''} data-id="${sec.id}">
                    <span class="${sec.enabled !== false ? 'text-indigo-600 font-bold' : 'text-slate-400'}">${sec.enabled !== false ? 'සක්‍රියයි' : 'අක්‍රියයි'}</span>
                  </label>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 3. Task-Level Granular Dependencies -->
      <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
        <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <i class="fas fa-tasks text-purple-600"></i> කාර්ය මට්ටමේ කොන්දේසි (Task Dependencies)
            </h3>
            <p class="text-[11px] text-slate-500">පෙර කාර්යයන් අවසන් කළ පසු පමණක් නිශ්චිත කාර්යයන් පෙන්වීමට අවශ්‍ය නම් මෙහි සකසන්න.</p>
          </div>
          <span class="text-xs font-mono font-bold bg-purple-100 text-purple-700 px-2.5 py-0.5 rounded-full">${tasks.length} කාර්යයන්</span>
        </div>

        <div class="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          ${tasks.map(t => `
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
              <div class="flex justify-between items-start">
                <span class="text-xs font-bold text-slate-800 font-['Noto_Sans_Sinhala'] leading-tight">${t.title_si}</span>
                <span class="text-[10px] uppercase font-bold text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 ml-2">${t.section}</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-[10px] text-slate-500 whitespace-nowrap">පෙන්වන්නේ මින් පසු:</span>
                <select class="rom-task-depends-select flex-1 text-[11px] border-slate-300 rounded p-1 bg-white font-medium text-slate-700" data-task-id="${t.id}">
                  ${PREREQUISITE_RULES.map(rule => `
                    <option value="${rule.id}" ${t.depends_on === rule.id ? 'selected' : ''}>
                      ${rule.label}
                    </option>
                  `).join('')}
                </select>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    this.attachListeners();
  }

  attachListeners() {
    // 1. Move Up
    this.containerEl.querySelectorAll('.rom-move-up').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const sections = this.config.sections;
        const idx = sections.findIndex(s => s.id === id);
        if (idx > 0) {
          const temp = sections[idx];
          sections[idx] = sections[idx - 1];
          sections[idx - 1] = temp;
          this.reindexOrders();
          this.renderForm();
        }
      });
    });

    // 2. Move Down
    this.containerEl.querySelectorAll('.rom-move-down').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        const sections = this.config.sections;
        const idx = sections.findIndex(s => s.id === id);
        if (idx >= 0 && idx < sections.length - 1) {
          const temp = sections[idx];
          sections[idx] = sections[idx + 1];
          sections[idx + 1] = temp;
          this.reindexOrders();
          this.renderForm();
        }
      });
    });

    // 3. Section Prerequisite Select
    this.containerEl.querySelectorAll('.rom-depends-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const sec = this.config.sections.find(s => s.id === id);
        if (sec) {
          sec.depends_on = e.currentTarget.value;
        }
      });
    });

    // 4. Section Enabled Toggle
    this.containerEl.querySelectorAll('.rom-enabled-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const id = e.currentTarget.dataset.id;
        const sec = this.config.sections.find(s => s.id === id);
        if (sec) {
          sec.enabled = e.currentTarget.checked;
        }
      });
    });

    // 5. Display Mode Radio
    this.containerEl.querySelectorAll('input[name="rom-display-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.config.display_mode = e.currentTarget.value;
      });
    });

    // 6. Task-Level Prerequisite Select
    this.containerEl.querySelectorAll('.rom-task-depends-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const taskId = e.currentTarget.dataset.taskId;
        const task = (this.config.tasks || []).find(t => t.id === taskId);
        if (task) {
          task.depends_on = e.currentTarget.value;
        }
      });
    });
  }

  reindexOrders() {
    this.config.sections.forEach((sec, i) => {
      sec.order = i + 1;
    });
  }

  async save() {
    this.reindexOrders();
    await saveRoutineConfig(this.config);
    this.toast('දින චර්යාවේ පිළිවෙල සහ කොන්දේසි සාර්ථකව සුරකින ලදී!', 'success');
  }

  resetDefaults() {
    if (confirm('දින චර්යාවේ පිළිවෙල මුල් පෙරනිමි තත්ත්වයට පත් කිරීමට ඔබට අවශ්‍යද?')) {
      this.config = JSON.parse(JSON.stringify(DEFAULT_ROUTINE_CONFIG));
      this.renderForm();
      this.save();
    }
  }
}
