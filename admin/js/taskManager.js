// taskManager.js - Task Management CRUD & Debounced Autosave (Phase 2)

export class TaskManager {
    constructor(containerEl, api, toastFn) {
        this.containerEl = containerEl;
        this.api = api;
        this.toastFn = toastFn;
        this.tableName = 'wosandi_tasks';
        this.timersTableName = 'wosandi_timers';
        this.tasks = [];
        this.availableTimers = [];
        this.debounceTimers = {};
        this.modalAutosaveTimer = null;
    }

    async render() {
        this.containerEl.innerHTML = `
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 font-['Noto_Sans_Sinhala']">
                <div>
                    <h2 class="text-2xl font-bold text-gray-800 flex items-center gap-2">
                        <i class="fas fa-tasks text-indigo-600"></i> කාර්යයන් කළමනාකරණය (Task Management)
                    </h2>
                    <p class="text-xs text-gray-500 mt-1">අධ්‍යයන ප්‍රමුඛතා, විෂයන්, ලකුණු, කාලසටහන් සහ Timers සකසන්න</p>
                </div>
                <button id="addTaskBtn" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm flex items-center gap-2 text-xs transition">
                    <i class="fas fa-plus"></i> නව කාර්යයක් එක් කරන්න (Add Task)
                </button>
            </div>
            <div class="flex flex-wrap gap-3 mb-6 font-['Noto_Sans_Sinhala']">
                <input type="text" id="taskSearch" placeholder="කාර්යයන් සොයන්න (Search tasks)..." class="flex-1 min-w-[200px] p-2.5 border rounded-xl shadow-2xs focus:ring-2 focus:ring-indigo-200 text-xs">
                <select id="taskSubjectFilter" class="p-2.5 border rounded-xl shadow-2xs text-xs bg-white">
                    <option value="">සියලුම විෂයන් (All Subjects)</option>
                    <option value="maths">ගණිතය (Mathematics)</option>
                    <option value="science">විද්‍යාව (Science)</option>
                    <option value="sinhala">සිංහල (Sinhala)</option>
                    <option value="english">ඉංග්‍රීසි (English)</option>
                    <option value="history">ඉතිහාසය (History)</option>
                    <option value="religion">බුද්ධාගම / ආගම (Religion)</option>
                    <option value="commerce">වාණිජ්‍ය (Commerce)</option>
                    <option value="ict">තොරතුරු තාක්ෂණය (ICT)</option>
                    <option value="general">සාමාන්‍ය පුරුදු (General / Habits)</option>
                </select>
                <select id="taskCategoryFilter" class="p-2.5 border rounded-xl shadow-2xs text-xs bg-white">
                    <option value="">සියලුම වර්ග (All Categories)</option>
                    <option value="academic">අධ්‍යාපනික (Academic)</option>
                    <option value="physical">ශාරීරික / නැටුම් (Physical)</option>
                    <option value="chores">ගෙදර දොර (Chores)</option>
                    <option value="habits">පුරුදු (Habits)</option>
                    <option value="creative">නිර්මාණශීලී (Creative)</option>
                    <option value="general">සාමාන්‍ය (General)</option>
                </select>
                <select id="taskStatusFilter" class="p-2.5 border rounded-xl shadow-2xs text-xs bg-white">
                    <option value="">සියලුම තත්ත්වයන් (All Statuses)</option>
                    <option value="draft">කටු කෙටුම්පත් (Draft)</option>
                    <option value="published">ප්‍රකාශිතයි (Published)</option>
                </select>
            </div>
            <div id="tasksTableContainer" class="bg-white rounded-xl shadow-xs overflow-x-auto border border-slate-200">
                <!-- Table will be rendered here -->
            </div>
            <div id="taskModalContainer"></div>
            <div id="deleteModalContainer"></div>
        `;

        document.getElementById('addTaskBtn').addEventListener('click', () => this.openAddModal());
        const searchInput = document.getElementById('taskSearch');
        const subjectFilter = document.getElementById('taskSubjectFilter');
        const categoryFilter = document.getElementById('taskCategoryFilter');
        const statusFilter = document.getElementById('taskStatusFilter');

        const reRenderTable = () => this.renderTable();
        searchInput.addEventListener('input', reRenderTable);
        subjectFilter.addEventListener('change', reRenderTable);
        categoryFilter.addEventListener('change', reRenderTable);
        statusFilter.addEventListener('change', reRenderTable);

        await this.loadData();
    }

    async loadData() {
        try {
            // Load tasks and available timers in parallel
            const [tasksRes, timersRes] = await Promise.all([
                this.api.select(this.tableName, {}, 'sort_order', true),
                this.api.select(this.timersTableName, {}, 'sort_order', true)
            ]);

            this.tasks = tasksRes.data || tasksRes || [];
            this.availableTimers = timersRes.data || timersRes || [];

            // Cache to localStorage for offline access and instant sync with student dashboard
            try {
                localStorage.setItem('wosandi_admin_wosandi_tasks', JSON.stringify(this.tasks));
            } catch (e) {}

            this.renderTable();
        } catch (error) {
            console.error('Error loading tasks:', error);
            try {
                const cached = localStorage.getItem('wosandi_admin_wosandi_tasks');
                if (cached) {
                    this.tasks = JSON.parse(cached);
                    this.renderTable();
                    return;
                }
            } catch (e) {}
            this.toastFn('කාර්යයන් ලබා ගැනීම අසාර්ථක විය', 'error');
        }
    }

    renderTable() {
        const tableContainer = document.getElementById('tasksTableContainer');
        const searchQuery = document.getElementById('taskSearch').value.toLowerCase();
        const subjectFilter = document.getElementById('taskSubjectFilter').value;
        const categoryFilter = document.getElementById('taskCategoryFilter').value;
        const statusFilter = document.getElementById('taskStatusFilter').value;

        const filteredTasks = this.tasks.filter(task => {
            const matchesSearch = (task.title_si && task.title_si.toLowerCase().includes(searchQuery)) || 
                                  (task.title_en && task.title_en.toLowerCase().includes(searchQuery));
            const taskSubject = task.schema_definition?.subject || '';
            const matchesSubject = subjectFilter ? taskSubject === subjectFilter : true;
            const matchesCategory = categoryFilter ? task.category === categoryFilter : true;
            const matchesStatus = statusFilter ? task.status === statusFilter : true;
            return matchesSearch && matchesSubject && matchesCategory && matchesStatus;
        });

        if (filteredTasks.length === 0) {
            tableContainer.innerHTML = `<div class="p-8 text-center text-gray-500 font-['Noto_Sans_Sinhala'] text-xs">කිසිදු කාර්යයක් හමු නොවීය. නව කාර්යයක් සෑදීමට "නව කාර්යයක් එක් කරන්න" ක්ලික් කරන්න.</div>`;
            return;
        }

        let tableHtml = `
            <table class="min-w-full divide-y divide-gray-200 font-['Noto_Sans_Sinhala']">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">කාර්යය (Task)</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">විෂය සහ වර්ගය</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">මට්ටම (Tier)</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">කාලසටහන / Timer</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">ලකුණු (Points)</th>
                        <th class="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">තත්ත්වය (Status)</th>
                        <th class="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">ක්‍රියාමාර්ග (Actions)</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
        `;

        filteredTasks.forEach(task => {
            const statusColor = task.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            const subject = task.schema_definition?.subject || '-';
            const schedule = task.schema_definition?.schedule;
            let scheduleStr = 'Daily';
            if (schedule) {
                if (typeof schedule === 'object') {
                    scheduleStr = schedule.frequency || schedule.days?.join(', ') || 'Daily';
                    if (schedule.time) scheduleStr += ` (${schedule.time})`;
                } else {
                    scheduleStr = String(schedule);
                }
            }

            const linkedTimer = this.availableTimers.find(t => t.id === task.schema_definition?.linked_timer_id);
            const timerLabel = linkedTimer ? (linkedTimer.label_en || linkedTimer.label_si) : (task.timer_seconds ? `${Math.round(task.timer_seconds / 60)}m` : null);

            tableHtml += `
                <tr class="hover:bg-slate-50 transition-colors">
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <span class="text-2xl mr-3">${task.icon || '📋'}</span>
                            <div>
                                <div class="text-sm font-bold text-gray-900 font-['Noto_Sans_Sinhala']">${task.title_si || ''}</div>
                                <div class="text-xs text-gray-500">${task.title_en || ''}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <div class="font-medium text-slate-800 capitalize">${subject}</div>
                        <div class="text-xs text-slate-400 capitalize">${task.category || 'general'}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span class="text-xs px-2 py-0.5 rounded font-medium ${task.tier === 'core_academic' ? 'bg-blue-100 text-blue-800' : (task.tier === 'applied_basket' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700')}">
                            ${(task.tier || 'routine_baseline').replace(/_/g, ' ')}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-xs text-gray-600">
                        <div class="flex items-center gap-1">
                            <i class="far fa-calendar-alt text-slate-400"></i> ${scheduleStr}
                        </div>
                        ${timerLabel ? `
                            <div class="flex items-center gap-1 text-purple-600 mt-1 font-semibold">
                                <i class="fas fa-stopwatch text-[11px]"></i> ${timerLabel}
                            </div>
                        ` : ''}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div class="flex items-center gap-2 relative">
                            <input type="number" step="0.5" value="${task.weight_points || 0}" 
                                class="w-20 p-1.5 border rounded text-xs font-bold text-slate-800 task-point-input" data-id="${task.id}" title="Edit points (auto-saves)">
                            <span id="save-indicator-${task.id}" class="text-[11px] text-gray-400 absolute -right-16 opacity-0 transition-opacity">Saved ✓</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2.5 py-1 inline-flex text-xs leading-4 font-semibold rounded-full ${statusColor}">
                            ${task.status || 'draft'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-indigo-600 hover:text-indigo-900 p-1.5 rounded hover:bg-indigo-50 edit-task-btn" data-id="${task.id}" title="Edit Task">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="text-red-600 hover:text-red-900 p-1.5 rounded hover:bg-red-50 delete-task-btn" data-id="${task.id}" title="Delete Task">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                        <button class="text-gray-600 hover:text-gray-900 p-1.5 rounded hover:bg-gray-100 toggle-publish-btn" data-id="${task.id}" data-status="${task.status}" title="${task.status === 'published' ? 'Unpublish' : 'Publish'}">
                            <i class="fas ${task.status === 'published' ? 'fa-eye-slash text-amber-600' : 'fa-eye text-green-600'}"></i>
                        </button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;
        tableContainer.innerHTML = tableHtml;

        // Attach event listeners
        tableContainer.querySelectorAll('.edit-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openEditModal(e.currentTarget.dataset.id));
        });
        tableContainer.querySelectorAll('.delete-task-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openDeleteModal(e.currentTarget.dataset.id));
        });
        tableContainer.querySelectorAll('.toggle-publish-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePublish(e.currentTarget.dataset.id, e.currentTarget.dataset.status));
        });
        tableContainer.querySelectorAll('.task-point-input').forEach(input => {
            input.addEventListener('input', (e) => this.handlePointEdit(e.target.dataset.id, e.target.value));
        });
    }

    handlePointEdit(taskId, newValue) {
        if (this.debounceTimers[taskId]) {
            clearTimeout(this.debounceTimers[taskId]);
        }

        const indicator = document.getElementById(`save-indicator-${taskId}`);
        if (indicator) {
            indicator.textContent = 'Saving...';
            indicator.className = 'text-[11px] text-blue-500 absolute -right-16 opacity-100 transition-opacity font-semibold';
        }

        // 2.2 400ms debounced autosave
        this.debounceTimers[taskId] = setTimeout(async () => {
            try {
                const parsedVal = parseFloat(newValue) || 0;
                await this.api.update(this.tableName, taskId, { weight_points: parsedVal });
                if (indicator) {
                    indicator.textContent = 'Saved ✓';
                    indicator.className = 'text-[11px] text-green-600 absolute -right-16 opacity-100 transition-opacity font-semibold';
                    setTimeout(() => {
                        indicator.className = 'text-[11px] text-green-600 absolute -right-16 opacity-0 transition-opacity';
                    }, 2000);
                }
                const task = this.tasks.find(t => t.id === taskId);
                if (task) task.weight_points = parsedVal;
                this.toastFn('Task points autosaved', 'info');
            } catch (error) {
                console.error('Error auto-saving points:', error);
                if (indicator) {
                    indicator.textContent = 'Error!';
                    indicator.className = 'text-[11px] text-red-500 absolute -right-16 opacity-100 transition-opacity font-semibold';
                }
                this.toastFn('Failed to autosave points', 'error');
            }
        }, 400);
    }

    async openAddModal() {
        this.renderModal();
    }

    async openEditModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (task) this.renderModal(task);
    }

    renderModal(task = null) {
        const isEdit = !!task;
        const schema = task?.schema_definition || {};
        const currentSubject = schema.subject || (task?.category === 'academic' ? 'maths' : 'general');
        const currentSchedule = schema.schedule || { frequency: 'daily', time: 'morning' };
        const currentDescription = schema.description || '';
        const currentLinkedTimerId = schema.linked_timer_id || '';

        const modalHtml = `
            <div class="fixed inset-0 bg-slate-900 bg-opacity-60 flex items-center justify-center z-50 p-4 font-['Noto_Sans_Sinhala']">
                <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                    <div class="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-slate-50">
                        <div class="flex items-center gap-3">
                            <h3 class="text-base font-bold text-gray-800">${isEdit ? 'කාර්යය සංස්කරණය (Edit Task)' : 'නව කාර්යයක් එක් කරන්න (Add New Task)'}</h3>
                            ${isEdit ? `
                                <span id="modal-save-indicator" class="text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600 transition-all">
                                    ස්වයංක්‍රීයව සුරැකේ
                                </span>
                            ` : ''}
                        </div>
                        <button type="button" class="text-gray-400 hover:text-gray-600 close-modal-btn">
                            <i class="fas fa-times text-lg"></i>
                        </button>
                    </div>

                    <div class="p-6 overflow-y-auto flex-1 space-y-4">
                        <form id="taskForm" class="space-y-4">
                            <!-- Titles -->
                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">මාතෘකාව (සිංහලෙන්) *</label>
                                    <input type="text" id="title_si" value="${task?.title_si || ''}" required placeholder="උදා: ගණිතය ප්‍රශ්න 5ක් විසඳීම" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala']">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">මාතෘකාව (English)</label>
                                    <input type="text" id="title_en" value="${task?.title_en || ''}" placeholder="e.g. Solve 5 Math Problems" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200">
                                </div>
                            </div>

                            <!-- Subject, Category & Tier -->
                            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">විෂය (Subject)</label>
                                    <select id="task_subject" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                                        <option value="maths" ${currentSubject === 'maths' ? 'selected' : ''}>ගණිතය (Mathematics)</option>
                                        <option value="science" ${currentSubject === 'science' ? 'selected' : ''}>විද්‍යාව (Science)</option>
                                        <option value="sinhala" ${currentSubject === 'sinhala' ? 'selected' : ''}>සිංහල (Sinhala)</option>
                                        <option value="english" ${currentSubject === 'english' ? 'selected' : ''}>ඉංග්‍රීසි (English)</option>
                                        <option value="history" ${currentSubject === 'history' ? 'selected' : ''}>ඉතිහාසය (History)</option>
                                        <option value="religion" ${currentSubject === 'religion' ? 'selected' : ''}>බුද්ධාගම / ආගම (Religion)</option>
                                        <option value="commerce" ${currentSubject === 'commerce' ? 'selected' : ''}>වාණිජ්‍ය (Commerce)</option>
                                        <option value="ict" ${currentSubject === 'ict' ? 'selected' : ''}>තොරතුරු තාක්ෂණය (ICT)</option>
                                        <option value="eastern_music" ${currentSubject === 'eastern_music' ? 'selected' : ''}>නැටුම් / සංගීතය</option>
                                        <option value="art" ${currentSubject === 'art' ? 'selected' : ''}>චිත්‍ර කලාව</option>
                                        <option value="civics" ${currentSubject === 'civics' ? 'selected' : ''}>පුරවැසි අධ්‍යාපනය</option>
                                        <option value="tamil" ${currentSubject === 'tamil' ? 'selected' : ''}>දෙමළ (Tamil)</option>
                                        <option value="general" ${currentSubject === 'general' ? 'selected' : ''}>සාමාන්‍ය පුරුදු (General)</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">වර්ගය (Category)</label>
                                    <select id="category" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                                        <option value="academic" ${task?.category === 'academic' ? 'selected' : ''}>අධ්‍යාපනික (Academic)</option>
                                        <option value="physical" ${task?.category === 'physical' ? 'selected' : ''}>ශාරීරික / නැටුම් (Physical)</option>
                                        <option value="chores" ${task?.category === 'chores' ? 'selected' : ''}>ගෙදර දොර (Chores)</option>
                                        <option value="habits" ${task?.category === 'habits' ? 'selected' : ''}>පුරුදු (Habits)</option>
                                        <option value="creative" ${task?.category === 'creative' ? 'selected' : ''}>නිර්මාණශීලී (Creative)</option>
                                        <option value="general" ${task?.category === 'general' ? 'selected' : ''}>සාමාන්‍ය (General)</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">ප්‍රමුඛතා මට්ටම (Tier)</label>
                                    <select id="tier" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                                        <option value="core_academic" ${task?.tier === 'core_academic' ? 'selected' : ''}>ප්‍රධාන අධ්‍යාපනික (Core: 25-30 Pts)</option>
                                        <option value="applied_basket" ${task?.tier === 'applied_basket' ? 'selected' : ''}>අමතර විෂයයන් (Basket: 12-20 Pts)</option>
                                        <option value="routine_baseline" ${task?.tier === 'routine_baseline' ? 'selected' : ''}>දෛනික පුරුදු (Baseline: 5-10 Pts)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Weight Points, Icon, Sort Order, Status -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">ලබාදෙන ලකුණු (Points)</label>
                                    <input type="number" id="weight_points" step="0.5" value="${task?.weight_points !== undefined ? task.weight_points : 10}" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">සංකේතය (Icon/Emoji)</label>
                                    <input type="text" id="icon" value="${task?.icon || '📋'}" class="w-full p-2.5 border rounded-xl text-xs text-center text-lg focus:ring-2 focus:ring-indigo-200">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">පිළිවෙල අංකය (Order)</label>
                                    <input type="number" id="sort_order" value="${task?.sort_order || 0}" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">තත්ත්වය (Status)</label>
                                    <select id="status" class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 bg-white">
                                        <option value="draft" ${task?.status === 'draft' ? 'selected' : ''}>කටු කෙටුම්පත් (Draft)</option>
                                        <option value="published" ${task?.status === 'published' ? 'selected' : ''}>ප්‍රකාශිතයි (Published)</option>
                                    </select>
                                </div>
                            </div>

                            <!-- Schedule Settings -->
                            <div class="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="far fa-calendar-check text-indigo-600"></i> කාලසටහන සහ පුනරාවර්තනය (Schedule)
                                </h4>
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">නිතර සිදුවන වාර ගණන (Frequency)</label>
                                        <select id="schedule_frequency" class="w-full p-2 border rounded-lg text-xs bg-white">
                                            <option value="daily" ${currentSchedule.frequency === 'daily' ? 'selected' : ''}>දිනපතා (Daily)</option>
                                            <option value="school_days" ${currentSchedule.frequency === 'school_days' ? 'selected' : ''}>පාසල් දිනවල පමණක් (Mon - Fri)</option>
                                            <option value="weekends" ${currentSchedule.frequency === 'weekends' ? 'selected' : ''}>සතිඅන්තයේ පමණක් (Sat - Sun)</option>
                                            <option value="custom" ${currentSchedule.frequency === 'custom' ? 'selected' : ''}>වෙනත් දිනයන් (Custom)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label class="block text-xs text-gray-600 mb-1">සුදුසු වේලාව (Preferred Time)</label>
                                        <select id="schedule_time" class="w-full p-2 border rounded-lg text-xs bg-white">
                                            <option value="morning" ${currentSchedule.time === 'morning' ? 'selected' : ''}>උදෑසන (05:00 - 08:00)</option>
                                            <option value="afternoon" ${currentSchedule.time === 'afternoon' ? 'selected' : ''}>දහවල් (12:00 - 16:00)</option>
                                            <option value="evening" ${currentSchedule.time === 'evening' ? 'selected' : ''}>සවස / රාත්‍රිය (16:00 - 21:00)</option>
                                            <option value="anytime" ${currentSchedule.time === 'anytime' ? 'selected' : ''}>ඕනෑම වේලාවක (Flexible)</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <!-- Description -->
                            <div>
                                <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">විස්තරය සහ උපදෙස් (Description & Notes)</label>
                                <textarea id="task_description" rows="2" placeholder="ශිෂ්‍යයාට අවශ්‍ය උපදෙස් සහ පාඩම් තොරතුරු..." class="w-full p-2.5 border rounded-xl text-xs focus:ring-2 focus:ring-indigo-200 font-['Noto_Sans_Sinhala']">${currentDescription}</textarea>
                            </div>

                            <!-- Linked Timers -->
                            <div class="border border-purple-200 bg-purple-50/50 p-3.5 rounded-xl space-y-3">
                                <div class="flex items-center justify-between">
                                    <label class="flex items-center space-x-2 cursor-pointer">
                                        <input type="checkbox" id="has_timer" ${task?.has_timer ? 'checked' : ''} class="rounded text-purple-600 focus:ring focus:ring-purple-200">
                                        <span class="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                                            <i class="fas fa-stopwatch text-purple-600"></i> වේලාව මනින Timer එකක් සම්බන්ධ කරන්න (Link Timer)
                                        </span>
                                    </label>
                                    <span class="text-[11px] text-purple-600 font-medium">ස්වයංක්‍රීය Timer එකක් ක්‍රියාත්මක කරයි</span>
                                </div>

                                <div id="timerControlsContainer" class="${task?.has_timer ? '' : 'hidden'} space-y-3 pt-2 border-t border-purple-200/60">
                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label class="block text-xs text-purple-900 mb-1 font-medium">සකසන ලද Timer එකක් තෝරන්න:</label>
                                            <select id="linked_timer_id" class="w-full p-2 border border-purple-300 rounded-lg text-xs bg-white">
                                                <option value="">-- වෙනත් කාලයක් යොදන්න --</option>
                                                ${this.availableTimers.map(t => {
                                                    const duration = `${t.duration_hours || 0}h ${t.duration_minutes || 0}m`;
                                                    return `<option value="${t.id}" ${currentLinkedTimerId === t.id ? 'selected' : ''}>${t.label_si || t.label_en} (${duration})</option>`;
                                                }).join('')}
                                            </select>
                                        </div>
                                        <div>
                                            <label class="block text-xs text-purple-900 mb-1 font-medium">කාල සීමාව (තත්පර වලින්):</label>
                                            <input type="number" id="timer_seconds" value="${task?.timer_seconds || 1800}" class="w-full p-2 border border-purple-300 rounded-lg text-xs bg-white">
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Advanced Schema Definition (Collapsible) -->
                            <details class="text-xs text-gray-500">
                                <summary class="cursor-pointer font-semibold text-gray-600 hover:text-gray-900 select-none">
                                    උසස් JSON Schema සැකසුම් (Advanced JSON)
                                </summary>
                                <textarea id="schema_definition" rows="3" class="w-full p-2 border rounded font-mono text-xs mt-2 bg-slate-50">${JSON.stringify(task?.schema_definition || {}, null, 2)}</textarea>
                            </details>
                        </form>
                    </div>

                    <div class="px-6 py-3 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 font-['Noto_Sans_Sinhala']">
                        <button type="button" class="px-4 py-2 bg-gray-200 text-gray-800 text-xs font-bold rounded-xl hover:bg-gray-300 close-modal-btn">අවලංගු කරන්න (Cancel)</button>
                        <button type="button" id="saveTaskBtn" class="px-5 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl hover:bg-indigo-700 shadow-sm flex items-center gap-1.5">
                            <i class="fas fa-save"></i> කාර්යය සුරකින්න (Save Task)
                        </button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('taskModalContainer');
        modalContainer.innerHTML = modalHtml;

        const hasTimerCheckbox = document.getElementById('has_timer');
        const timerControlsContainer = document.getElementById('timerControlsContainer');
        const linkedTimerSelect = document.getElementById('linked_timer_id');
        const timerSecondsInput = document.getElementById('timer_seconds');

        hasTimerCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                timerControlsContainer.classList.remove('hidden');
            } else {
                timerControlsContainer.classList.add('hidden');
            }
        });

        linkedTimerSelect.addEventListener('change', (e) => {
            const timerId = e.target.value;
            const timer = this.availableTimers.find(t => t.id === timerId);
            if (timer) {
                const totalSec = (timer.duration_hours || 0) * 3600 + (timer.duration_minutes || 0) * 60 + (timer.duration_seconds || 0);
                timerSecondsInput.value = totalSec;
            }
        });

        const closeModal = () => { modalContainer.innerHTML = ''; };
        modalContainer.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        // 2.2 Debounced Autosave on Task Edit Modal (400ms)
        if (isEdit && task.id) {
            const triggerAutosave = () => {
                const indicator = document.getElementById('modal-save-indicator');
                if (indicator) {
                    indicator.textContent = 'Saving...';
                    indicator.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-blue-100 text-blue-700 animate-pulse';
                }

                if (this.modalAutosaveTimer) clearTimeout(this.modalAutosaveTimer);

                this.modalAutosaveTimer = setTimeout(async () => {
                    const updatedPayload = this.collectFormData();
                    if (!updatedPayload.title_si) return;

                    try {
                        await this.api.update(this.tableName, task.id, updatedPayload);
                        if (indicator) {
                            indicator.textContent = 'Saved ✓';
                            indicator.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-700';
                            setTimeout(() => {
                                if (indicator) {
                                    indicator.textContent = 'All changes saved';
                                    indicator.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-slate-200 text-slate-600';
                                }
                            }, 2000);
                        }
                        this.toastFn('Task changes autosaved', 'info');
                        // Update local cache without closing modal
                        const tIdx = this.tasks.findIndex(t => t.id === task.id);
                        if (tIdx >= 0) this.tasks[tIdx] = { ...this.tasks[tIdx], ...updatedPayload };
                    } catch (err) {
                        console.error('Modal autosave error:', err);
                        if (indicator) {
                            indicator.textContent = 'Autosave error';
                            indicator.className = 'text-xs font-semibold px-2 py-0.5 rounded bg-red-100 text-red-700';
                        }
                    }
                }, 400);
            };

            const formInputs = modalContainer.querySelectorAll('input, select, textarea');
            formInputs.forEach(input => {
                input.addEventListener('input', triggerAutosave);
                input.addEventListener('change', triggerAutosave);
            });
        }

        document.getElementById('saveTaskBtn').addEventListener('click', async () => {
            const formData = this.collectFormData();

            if (!formData.title_si) {
                this.toastFn('Sinhala title is required', 'error');
                return;
            }

            await this.saveTask(formData, task?.id);
            closeModal();
        });
    }

    collectFormData() {
        const hasTimer = document.getElementById('has_timer').checked;
        const timerSeconds = hasTimer ? (parseInt(document.getElementById('timer_seconds').value) || 0) : null;
        const linkedTimerId = hasTimer ? document.getElementById('linked_timer_id').value : null;

        let schemaDef = {};
        const rawSchemaStr = document.getElementById('schema_definition')?.value?.trim();
        if (rawSchemaStr) {
            try { schemaDef = JSON.parse(rawSchemaStr); } catch (e) { schemaDef = {}; }
        }

        // Merge custom form fields into schema_definition
        schemaDef.subject = document.getElementById('task_subject').value;
        schemaDef.description = document.getElementById('task_description').value;
        schemaDef.schedule = {
            frequency: document.getElementById('schedule_frequency').value,
            time: document.getElementById('schedule_time').value
        };
        if (linkedTimerId) {
            schemaDef.linked_timer_id = linkedTimerId;
        } else {
            delete schemaDef.linked_timer_id;
        }

        return {
            title_si: document.getElementById('title_si').value.trim(),
            title_en: document.getElementById('title_en').value.trim(),
            category: document.getElementById('category').value,
            tier: document.getElementById('tier').value,
            weight_points: parseFloat(document.getElementById('weight_points').value) || 0,
            icon: document.getElementById('icon').value.trim() || '📋',
            sort_order: parseInt(document.getElementById('sort_order').value) || 0,
            status: document.getElementById('status').value,
            has_timer: hasTimer,
            timer_seconds: timerSeconds,
            schema_definition: schemaDef
        };
    }

    async saveTask(taskData, taskId = null) {
        try {
            if (taskId) {
                await this.api.update(this.tableName, taskId, taskData);
                this.toastFn('කාර්යය සාර්ථකව යාවත්කාලීන විය', 'success');
            } else {
                await this.api.insert(this.tableName, taskData);
                this.toastFn('නව කාර්යය සාර්ථකව සාදන ලදී', 'success');
            }
            await this.loadData();
        } catch (error) {
            console.error('Error saving task:', error);
            this.toastFn('කාර්යය සුරැකීම අසාර්ථක විය', 'error');
        }
    }

    // 2.1 Delete Confirmation Modal (Rich UI)
    openDeleteModal(taskId) {
        const task = this.tasks.find(t => t.id === taskId);
        if (!task) return;

        const deleteContainer = document.getElementById('deleteModalContainer');
        deleteContainer.innerHTML = `
            <div class="fixed inset-0 bg-slate-900 bg-opacity-70 flex items-center justify-center z-50 p-4 font-['Noto_Sans_Sinhala']">
                <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
                    <div class="p-6 text-center">
                        <div class="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-2xl mx-auto mb-4 shadow-inner">
                            <i class="fas fa-trash-alt"></i>
                        </div>
                        <h3 class="text-base font-bold text-gray-900 mb-2">කාර්යය මකාදැමීම තහවුරු කරන්න (Delete Confirmation)</h3>
                        <p class="text-xs text-gray-600 mb-4">
                            ඔබට <strong class="text-gray-900 font-bold">"${task.title_si || task.title_en}"</strong> කාර්යය ස්ථිරවම මකා දැමීමට අවශ්‍ය බව තහවුරු කරන්නද?
                        </p>
                        <div class="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 text-left mb-4">
                            <i class="fas fa-exclamation-circle mr-1"></i> මෙම ක්‍රියාව ආපසු හැරවිය නොහැක. කාර්යය සහ ඊට අදාළ දත්ත සම්පූර්ණයෙන්ම ඉවත් කෙරේ.
                        </div>
                        <div class="flex justify-center gap-3">
                            <button id="cancelDeleteBtn" type="button" class="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-bold rounded-xl transition">
                                අවලංගු කරන්න (Cancel)
                            </button>
                            <button id="confirmDeleteBtn" type="button" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center gap-1.5">
                                <i class="fas fa-trash-alt"></i> ස්ථිරවම මකන්න (Delete)
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            deleteContainer.innerHTML = '';
        });

        document.getElementById('confirmDeleteBtn').addEventListener('click', async () => {
            try {
                await this.api.delete(this.tableName, taskId);
                deleteContainer.innerHTML = '';
                this.toastFn('කාර්යය ස්ථිරවම මකා දමන ලදී', 'success');
                await this.loadData();
            } catch (error) {
                console.error('Error deleting task:', error);
                this.toastFn('කාර්යය මැකීම අසාර්ථක විය', 'error');
            }
        });
    }

    async togglePublish(taskId, currentStatus) {
        try {
            const newStatus = currentStatus === 'published' ? 'draft' : 'published';
            if (newStatus === 'published') {
                await this.api.publish(this.tableName, taskId);
            } else {
                await this.api.unpublish(this.tableName, taskId);
            }
            this.toastFn(`කාර්යය සාර්ථකව ${newStatus === 'published' ? 'ප්‍රකාශයට පත් කරන ලදී' : 'කටු කෙටුම්පතක් කරන ලදී'}`, 'success');
            await this.loadData();
        } catch (error) {
            console.error('Error toggling publish status:', error);
            this.toastFn('තත්ත්වය වෙනස් කිරීම අසාර්ථක විය', 'error');
        }
    }
}
