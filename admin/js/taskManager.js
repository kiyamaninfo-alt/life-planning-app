// taskManager.js
export class TaskManager {
    constructor(containerEl, api, toastFn) {
        this.containerEl = containerEl;
        this.api = api;
        this.toastFn = toastFn;
        this.tableName = 'wosandi_tasks';
        this.tasks = [];
        this.debounceTimers = {};
    }

    async render() {
        this.containerEl.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Task Management</h2>
                <button id="addTaskBtn" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow">
                    <i class="fas fa-plus mr-2"></i> Add Task
                </button>
            </div>
            <div class="flex gap-4 mb-6">
                <input type="text" id="taskSearch" placeholder="Search tasks..." class="flex-1 p-2 border rounded shadow-sm focus:ring focus:ring-blue-200">
                <select id="taskCategoryFilter" class="p-2 border rounded shadow-sm">
                    <option value="">All Categories</option>
                    <option value="academic">Academic</option>
                    <option value="physical">Physical</option>
                    <option value="chores">Chores</option>
                    <option value="habits">Habits</option>
                    <option value="creative">Creative</option>
                    <option value="general">General</option>
                </select>
                <select id="taskStatusFilter" class="p-2 border rounded shadow-sm">
                    <option value="">All Statuses</option>
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                </select>
            </div>
            <div id="tasksTableContainer" class="bg-white rounded shadow overflow-x-auto">
                <!-- Table will be rendered here -->
            </div>
            <div id="taskModalContainer"></div>
        `;

        document.getElementById('addTaskBtn').addEventListener('click', () => this.openAddModal());
        const searchInput = document.getElementById('taskSearch');
        const categoryFilter = document.getElementById('taskCategoryFilter');
        const statusFilter = document.getElementById('taskStatusFilter');

        const reRenderTable = () => this.renderTable();
        searchInput.addEventListener('input', reRenderTable);
        categoryFilter.addEventListener('change', reRenderTable);
        statusFilter.addEventListener('change', reRenderTable);

        await this.loadTasks();
    }

    async loadTasks() {
        try {
            const { data, error } = await this.api.select(this.tableName, {}, 'sort_order', true);
            if (error) throw new Error(error);
            this.tasks = data || [];
            this.renderTable();
        } catch (error) {
            console.error('Error loading tasks:', error);
            this.toastFn('Failed to load tasks', 'error');
        }
    }

    renderTable() {
        const tableContainer = document.getElementById('tasksTableContainer');
        const searchQuery = document.getElementById('taskSearch').value.toLowerCase();
        const categoryFilter = document.getElementById('taskCategoryFilter').value;
        const statusFilter = document.getElementById('taskStatusFilter').value;

        const filteredTasks = this.tasks.filter(task => {
            const matchesSearch = (task.title_si && task.title_si.toLowerCase().includes(searchQuery)) || 
                                  (task.title_en && task.title_en.toLowerCase().includes(searchQuery));
            const matchesCategory = categoryFilter ? task.category === categoryFilter : true;
            const matchesStatus = statusFilter ? task.status === statusFilter : true;
            return matchesSearch && matchesCategory && matchesStatus;
        });

        if (filteredTasks.length === 0) {
            tableContainer.innerHTML = `<div class="p-8 text-center text-gray-500">No tasks found.</div>`;
            return;
        }

        let tableHtml = `
            <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                    <tr>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title (Si)</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Points</th>
                        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                        <th class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
        `;

        filteredTasks.forEach(task => {
            const statusColor = task.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            tableHtml += `
                <tr>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <div class="flex items-center">
                            <span class="text-xl mr-2">${task.icon || '📝'}</span>
                            <div class="text-sm font-medium text-gray-900">${task.title_si || ''}</div>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${task.category || '-'}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">${(task.tier || '-').replace('_', ' ')}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div class="flex items-center gap-2 relative">
                            <input type="number" step="0.5" value="${task.weight_points || 0}" 
                                class="w-20 p-1 border rounded task-point-input" data-id="${task.id}">
                            <span id="save-indicator-${task.id}" class="text-xs text-gray-400 absolute -right-14 opacity-0 transition-opacity">Saved ✓</span>
                        </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">
                            ${task.status || 'draft'}
                        </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button class="text-indigo-600 hover:text-indigo-900 mx-1 edit-task-btn" data-id="${task.id}"><i class="fas fa-edit"></i></button>
                        <button class="text-red-600 hover:text-red-900 mx-1 delete-task-btn" data-id="${task.id}"><i class="fas fa-trash"></i></button>
                        <button class="text-gray-600 hover:text-gray-900 mx-1 toggle-publish-btn" data-id="${task.id}" data-status="${task.status}">
                            <i class="fas ${task.status === 'published' ? 'fa-eye-slash' : 'fa-eye'}"></i>
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
            btn.addEventListener('click', (e) => this.deleteTask(e.currentTarget.dataset.id));
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
            indicator.className = 'text-xs text-blue-500 absolute -right-16 opacity-100 transition-opacity';
        }

        this.debounceTimers[taskId] = setTimeout(async () => {
            try {
                await this.api.update(this.tableName, taskId, { weight_points: parseFloat(newValue) });
                if (indicator) {
                    indicator.textContent = 'Saved ✓';
                    indicator.className = 'text-xs text-green-500 absolute -right-16 opacity-100 transition-opacity';
                    setTimeout(() => {
                        indicator.className = 'text-xs text-green-500 absolute -right-16 opacity-0 transition-opacity';
                    }, 2000);
                }
                const task = this.tasks.find(t => t.id === taskId);
                if (task) task.weight_points = parseFloat(newValue);
            } catch (error) {
                console.error('Error auto-saving points:', error);
                if (indicator) {
                    indicator.textContent = 'Error!';
                    indicator.className = 'text-xs text-red-500 absolute -right-12 opacity-100 transition-opacity';
                }
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
        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-xl font-bold text-gray-800">${isEdit ? 'Edit Task' : 'Add Task'}</h3>
                        <button type="button" class="text-gray-400 hover:text-gray-600 close-modal-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto flex-1">
                        <form id="taskForm" class="space-y-4">
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Title (Sinhala) *</label>
                                    <input type="text" id="title_si" value="${task?.title_si || ''}" required class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Title (English)</label>
                                    <input type="text" id="title_en" value="${task?.title_en || ''}" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select id="category" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                        <option value="academic" ${task?.category === 'academic' ? 'selected' : ''}>Academic</option>
                                        <option value="physical" ${task?.category === 'physical' ? 'selected' : ''}>Physical</option>
                                        <option value="chores" ${task?.category === 'chores' ? 'selected' : ''}>Chores</option>
                                        <option value="habits" ${task?.category === 'habits' ? 'selected' : ''}>Habits</option>
                                        <option value="creative" ${task?.category === 'creative' ? 'selected' : ''}>Creative</option>
                                        <option value="general" ${task?.category === 'general' ? 'selected' : ''}>General</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Tier</label>
                                    <select id="tier" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                        <option value="routine_baseline" ${task?.tier === 'routine_baseline' ? 'selected' : ''}>Routine Baseline</option>
                                        <option value="core_academic" ${task?.tier === 'core_academic' ? 'selected' : ''}>Core Academic</option>
                                        <option value="applied_basket" ${task?.tier === 'applied_basket' ? 'selected' : ''}>Applied Basket</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Weight Points</label>
                                    <input type="number" id="weight_points" step="0.5" value="${task?.weight_points || 0}" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                                    <input type="text" id="icon" value="${task?.icon || ''}" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                                    <input type="number" id="sort_order" value="${task?.sort_order || 0}" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select id="status" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                        <option value="draft" ${task?.status === 'draft' ? 'selected' : ''}>Draft</option>
                                        <option value="published" ${task?.status === 'published' ? 'selected' : ''}>Published</option>
                                    </select>
                                </div>
                            </div>
                            <div class="border-t pt-4">
                                <label class="flex items-center space-x-2">
                                    <input type="checkbox" id="has_timer" ${task?.has_timer ? 'checked' : ''} class="rounded text-blue-600 focus:ring focus:ring-blue-200">
                                    <span class="text-sm font-medium text-gray-700">Has Timer</span>
                                </label>
                                <div id="timerSecondsContainer" class="${task?.has_timer ? '' : 'hidden'} mt-2">
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Timer Seconds</label>
                                    <input type="number" id="timer_seconds" value="${task?.timer_seconds || 0}" class="w-full p-2 border rounded focus:ring focus:ring-blue-200">
                                </div>
                            </div>
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-1">Schema Definition (JSON)</label>
                                <textarea id="schema_definition" rows="3" class="w-full p-2 border rounded focus:ring focus:ring-blue-200 font-mono text-sm">${task?.schema_definition ? JSON.stringify(task.schema_definition, null, 2) : ''}</textarea>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 close-modal-btn">Cancel</button>
                        <button type="button" id="saveTaskBtn" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('taskModalContainer');
        modalContainer.innerHTML = modalHtml;

        const hasTimerCheckbox = document.getElementById('has_timer');
        const timerSecondsContainer = document.getElementById('timerSecondsContainer');
        
        hasTimerCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                timerSecondsContainer.classList.remove('hidden');
            } else {
                timerSecondsContainer.classList.add('hidden');
            }
        });

        const closeModal = () => modalContainer.innerHTML = '';
        
        modalContainer.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        document.getElementById('saveTaskBtn').addEventListener('click', async () => {
            const formData = {
                title_si: document.getElementById('title_si').value,
                title_en: document.getElementById('title_en').value,
                category: document.getElementById('category').value,
                tier: document.getElementById('tier').value,
                weight_points: parseFloat(document.getElementById('weight_points').value) || 0,
                icon: document.getElementById('icon').value,
                sort_order: parseInt(document.getElementById('sort_order').value) || 0,
                status: document.getElementById('status').value,
                has_timer: document.getElementById('has_timer').checked,
                timer_seconds: document.getElementById('has_timer').checked ? (parseInt(document.getElementById('timer_seconds').value) || 0) : null
            };

            const schemaStr = document.getElementById('schema_definition').value.trim();
            if (schemaStr) {
                try {
                    formData.schema_definition = JSON.parse(schemaStr);
                } catch (e) {
                    this.toastFn('Invalid JSON in schema definition', 'error');
                    return;
                }
            } else {
                formData.schema_definition = {};
            }

            if (!formData.title_si) {
                this.toastFn('Sinhala title is required', 'error');
                return;
            }

            await this.saveTask(formData, task?.id);
            closeModal();
        });
    }

    async saveTask(taskData, taskId = null) {
        try {
            if (taskId) {
                await this.api.update(this.tableName, taskId, taskData);
                this.toastFn('Task updated successfully', 'success');
            } else {
                await this.api.insert(this.tableName, taskData);
                this.toastFn('Task added successfully', 'success');
            }
            await this.loadTasks();
        } catch (error) {
            console.error('Error saving task:', error);
            this.toastFn('Failed to save task', 'error');
        }
    }

    async deleteTask(taskId) {
        if (confirm('Are you sure you want to delete this task?')) {
            try {
                await this.api.delete(this.tableName, taskId);
                this.toastFn('Task deleted successfully', 'success');
                await this.loadTasks();
            } catch (error) {
                console.error('Error deleting task:', error);
                this.toastFn('Failed to delete task', 'error');
            }
        }
    }

    async togglePublish(taskId, currentStatus) {
        try {
            const newStatus = currentStatus === 'published' ? 'draft' : 'published';
            if (newStatus === 'published') {
                await this.api.publish(this.tableName, taskId);
            } else {
                await this.api.unpublish(this.tableName, taskId);
            }
            this.toastFn(`Task ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`, 'success');
            await this.loadTasks();
        } catch (error) {
            console.error('Error toggling publish status:', error);
            this.toastFn('Failed to update status', 'error');
        }
    }
}
