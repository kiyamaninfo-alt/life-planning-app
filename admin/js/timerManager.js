// timerManager.js
export class TimerManager {
    constructor(containerEl, api, toastFn) {
        this.containerEl = containerEl;
        this.api = api;
        this.toastFn = toastFn;
        this.tableName = 'wosandi_timers';
        this.timers = [];
    }

    async render() {
        this.containerEl.innerHTML = `
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Timer Configuration</h2>
                <button id="addTimerBtn" class="bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded shadow">
                    <i class="fas fa-plus mr-2"></i> Add Timer
                </button>
            </div>
            <div id="timersGridContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Grid will be rendered here -->
            </div>
            <div id="timerModalContainer"></div>
        `;

        document.getElementById('addTimerBtn').addEventListener('click', () => this.openAddModal());
        await this.loadTimers();
    }

    async loadTimers() {
        try {
            const { data, error } = await this.api.select(this.tableName, {}, 'sort_order', true);
            if (error) throw new Error(error);
            this.timers = data || [];
            this.renderGrid();
        } catch (error) {
            console.error('Error loading timers:', error);
            this.toastFn('Failed to load timers', 'error');
        }
    }

    formatDuration(timerOrSeconds) {
        if (!timerOrSeconds) return '0s';
        let h = 0, m = 0, s = 0;
        if (typeof timerOrSeconds === 'object') {
            h = timerOrSeconds.duration_hours || 0;
            m = timerOrSeconds.duration_minutes || 0;
            s = timerOrSeconds.duration_seconds || 0;
        } else {
            h = Math.floor(timerOrSeconds / 3600);
            m = Math.floor((timerOrSeconds % 3600) / 60);
            s = timerOrSeconds % 60;
        }
        
        const parts = [];
        if (h > 0) parts.push(`${h}h`);
        if (m > 0) parts.push(`${m}m`);
        if (s > 0) parts.push(`${s}s`);
        
        return parts.length > 0 ? parts.join(' ') : '0s';
    }

    renderGrid() {
        const gridContainer = document.getElementById('timersGridContainer');

        if (this.timers.length === 0) {
            gridContainer.innerHTML = `<div class="col-span-full p-8 text-center text-gray-500 bg-white rounded shadow">No timers configured.</div>`;
            return;
        }

        let gridHtml = '';

        this.timers.forEach(timer => {
            const statusColor = timer.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800';
            const durationStr = this.formatDuration(timer);
            
            // Generate summary string
            let configSummary = [];
            const trigger = timer.trigger_config || {};
            if (trigger.auto_start) configSummary.push('Auto-start');
            if (trigger.pause_on_blur) configSummary.push('Pause on blur');
            if (trigger.chime) configSummary.push('Chime');
            if (trigger.repeat_count > 1) configSummary.push(`Repeat x${trigger.repeat_count}`);
            const configStr = configSummary.length ? configSummary.join(' • ') : 'Basic timer';

            gridHtml += `
                <div class="bg-white rounded-lg shadow border border-gray-100 overflow-hidden flex flex-col">
                    <div class="p-4 border-b border-gray-100 flex justify-between items-start">
                        <div class="flex items-center gap-3">
                            <div class="text-3xl bg-gray-50 w-12 h-12 flex items-center justify-center rounded-lg shadow-sm">
                                ${timer.icon || '⏱️'}
                            </div>
                            <div>
                                <h3 class="font-bold text-gray-800 text-lg">${timer.label_si || 'Unnamed Timer'}</h3>
                                <p class="text-xs text-gray-500">${timer.label_en || ''}</p>
                            </div>
                        </div>
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColor}">
                            ${timer.status || 'draft'}
                        </span>
                    </div>
                    
                    <div class="p-4 flex-1">
                        <div class="flex items-center justify-center py-4">
                            <div class="text-3xl font-mono text-gray-700 tracking-wider">
                                ${durationStr}
                            </div>
                        </div>
                        <div class="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded">
                            <p class="truncate" title="${configStr}"><i class="fas fa-cog text-gray-400 mr-2"></i> ${configStr}</p>
                            ${trigger.linked_task_id ? `<p class="mt-1 truncate text-xs"><i class="fas fa-link text-gray-400 mr-2"></i> Linked Task</p>` : ''}
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 p-3 border-t border-gray-100 flex justify-end gap-2">
                        <button class="px-3 py-1 text-sm bg-white border border-gray-300 rounded hover:bg-gray-50 text-gray-700 toggle-publish-btn" data-id="${timer.id}" data-status="${timer.status}">
                            ${timer.status === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        <button class="px-3 py-1 text-sm bg-blue-50 text-blue-600 border border-blue-200 rounded hover:bg-blue-100 edit-timer-btn" data-id="${timer.id}">
                            Edit
                        </button>
                        <button class="px-3 py-1 text-sm bg-red-50 text-red-600 border border-red-200 rounded hover:bg-red-100 delete-timer-btn" data-id="${timer.id}">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });

        gridContainer.innerHTML = gridHtml;

        // Attach event listeners
        gridContainer.querySelectorAll('.edit-timer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.openEditModal(e.currentTarget.dataset.id));
        });
        gridContainer.querySelectorAll('.delete-timer-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteTimer(e.currentTarget.dataset.id));
        });
        gridContainer.querySelectorAll('.toggle-publish-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.togglePublish(e.currentTarget.dataset.id, e.currentTarget.dataset.status));
        });
    }

    async openAddModal() {
        this.renderModal();
    }

    async openEditModal(timerId) {
        const timer = this.timers.find(t => t.id === timerId);
        if (timer) this.renderModal(timer);
    }

    renderModal(timer = null) {
        const isEdit = !!timer;
        
        let h = 0, m = 0, s = 0;
        if (timer && timer.duration_seconds) {
            h = Math.floor(timer.duration_seconds / 3600);
            m = Math.floor((timer.duration_seconds % 3600) / 60);
            s = timer.duration_seconds % 60;
        }

        const trigger = timer?.trigger_config || {};
        const autoStart = trigger.auto_start || false;
        const pauseOnBlur = trigger.pause_on_blur !== undefined ? trigger.pause_on_blur : true;
        const chime = trigger.chime !== undefined ? trigger.chime : true;
        const alertIntervals = trigger.alert_intervals ? trigger.alert_intervals.join(',') : '';
        const repeatCount = trigger.repeat_count || 1;
        const linkedTask = trigger.linked_task_id || '';

        const modalHtml = `
            <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                    <div class="p-6 border-b border-gray-200 flex justify-between items-center">
                        <h3 class="text-xl font-bold text-gray-800">${isEdit ? 'Edit Timer' : 'Add Timer'}</h3>
                        <button type="button" class="text-gray-400 hover:text-gray-600 close-modal-btn">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="p-6 overflow-y-auto flex-1">
                        <form id="timerForm" class="space-y-6">
                            <!-- Basic Info -->
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Label (Sinhala) *</label>
                                    <input type="text" id="label_si" value="${timer?.label_si || ''}" required class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Label (English)</label>
                                    <input type="text" id="label_en" value="${timer?.label_en || ''}" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                </div>
                            </div>
                            
                            <!-- Duration -->
                            <div>
                                <label class="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                                <div class="flex gap-4 items-center">
                                    <div class="flex flex-col">
                                        <input type="number" id="dur_h" min="0" max="23" value="${h}" class="w-20 p-2 text-center border rounded focus:ring focus:ring-purple-200">
                                        <span class="text-xs text-gray-500 text-center mt-1">Hours</span>
                                    </div>
                                    <span class="text-xl font-bold text-gray-400">:</span>
                                    <div class="flex flex-col">
                                        <input type="number" id="dur_m" min="0" max="59" value="${m}" class="w-20 p-2 text-center border rounded focus:ring focus:ring-purple-200">
                                        <span class="text-xs text-gray-500 text-center mt-1">Mins</span>
                                    </div>
                                    <span class="text-xl font-bold text-gray-400">:</span>
                                    <div class="flex flex-col">
                                        <input type="number" id="dur_s" min="0" max="59" value="${s}" class="w-20 p-2 text-center border rounded focus:ring focus:ring-purple-200">
                                        <span class="text-xs text-gray-500 text-center mt-1">Secs</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Display & Status -->
                            <div class="grid grid-cols-3 gap-4 border-t pt-4">
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Icon (Emoji)</label>
                                    <input type="text" id="icon" value="${timer?.icon || '⏱️'}" class="w-full p-2 border rounded focus:ring focus:ring-purple-200 text-center">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                                    <input type="number" id="sort_order" value="${timer?.sort_order || 0}" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                </div>
                                <div>
                                    <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                    <select id="status" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                        <option value="draft" ${timer?.status === 'draft' ? 'selected' : ''}>Draft</option>
                                        <option value="published" ${timer?.status === 'published' ? 'selected' : ''}>Published</option>
                                    </select>
                                </div>
                            </div>
                            
                            <!-- Trigger Configuration -->
                            <div class="border-t pt-4">
                                <h4 class="font-semibold text-gray-800 mb-4">Trigger Configuration</h4>
                                
                                <div class="grid grid-cols-2 gap-4 mb-4">
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-3 rounded">
                                        <input type="checkbox" id="auto_start" ${autoStart ? 'checked' : ''} class="w-5 h-5 rounded text-purple-600 focus:ring focus:ring-purple-200">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-medium text-gray-700">Auto Start</span>
                                            <span class="text-xs text-gray-500">Start immediately when loaded</span>
                                        </div>
                                    </label>
                                    
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-3 rounded">
                                        <input type="checkbox" id="pause_on_blur" ${pauseOnBlur ? 'checked' : ''} class="w-5 h-5 rounded text-purple-600 focus:ring focus:ring-purple-200">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-medium text-gray-700">Pause on Tab Blur</span>
                                            <span class="text-xs text-gray-500">Pause when user switches tabs</span>
                                        </div>
                                    </label>
                                    
                                    <label class="flex items-center space-x-3 cursor-pointer bg-gray-50 p-3 rounded">
                                        <input type="checkbox" id="chime" ${chime ? 'checked' : ''} class="w-5 h-5 rounded text-purple-600 focus:ring focus:ring-purple-200">
                                        <div class="flex flex-col">
                                            <span class="text-sm font-medium text-gray-700">Chime on Complete</span>
                                            <span class="text-xs text-gray-500">Play sound when finished</span>
                                        </div>
                                    </label>
                                </div>
                                
                                <div class="grid grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Alert Intervals (seconds)</label>
                                        <input type="text" id="alert_intervals" value="${alertIntervals}" placeholder="e.g. 300, 60" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                        <p class="text-xs text-gray-500 mt-1">Comma-separated seconds</p>
                                    </div>
                                    <div>
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Repeat Count</label>
                                        <input type="number" id="repeat_count" min="1" value="${repeatCount}" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                    </div>
                                    <div class="col-span-2">
                                        <label class="block text-sm font-medium text-gray-700 mb-1">Linked Task ID (UUID)</label>
                                        <input type="text" id="linked_task_id" value="${linkedTask}" placeholder="Optional task UUID" class="w-full p-2 border rounded focus:ring focus:ring-purple-200">
                                    </div>
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="p-6 border-t border-gray-200 bg-gray-50 flex justify-end gap-3 rounded-b-lg">
                        <button type="button" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 close-modal-btn">Cancel</button>
                        <button type="button" id="saveTimerBtn" class="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Save</button>
                    </div>
                </div>
            </div>
        `;

        const modalContainer = document.getElementById('timerModalContainer');
        modalContainer.innerHTML = modalHtml;

        const closeModal = () => modalContainer.innerHTML = '';
        
        modalContainer.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', closeModal);
        });

        document.getElementById('saveTimerBtn').addEventListener('click', async () => {
            const h = parseInt(document.getElementById('dur_h').value) || 0;
            const m = parseInt(document.getElementById('dur_m').value) || 0;
            const s = parseInt(document.getElementById('dur_s').value) || 0;
            const totalSeconds = (h * 3600) + (m * 60) + s;

            const intervalsStr = document.getElementById('alert_intervals').value.trim();
            const alertIntervals = intervalsStr ? intervalsStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n)) : [];

            const formData = {
                label_si: document.getElementById('label_si').value,
                label_en: document.getElementById('label_en').value,
                duration_hours: h,
                duration_minutes: m,
                duration_seconds: s,
                icon: document.getElementById('icon').value,
                sort_order: parseInt(document.getElementById('sort_order').value) || 0,
                status: document.getElementById('status').value,
                trigger_config: {
                    auto_start: document.getElementById('auto_start').checked,
                    pause_on_blur: document.getElementById('pause_on_blur').checked,
                    chime: document.getElementById('chime').checked,
                    chime_on_complete: document.getElementById('chime').checked,
                    alert_intervals: alertIntervals,
                    repeat_count: parseInt(document.getElementById('repeat_count').value) || 1,
                    linked_task_id: document.getElementById('linked_task_id').value.trim() || null
                }
            };

            if (!formData.label_si) {
                this.toastFn('Sinhala label is required', 'error');
                return;
            }

            if (totalSeconds <= 0) {
                this.toastFn('Duration must be greater than 0', 'error');
                return;
            }

            await this.saveTimer(formData, timer?.id);
            closeModal();
        });
    }

    async saveTimer(timerData, timerId = null) {
        try {
            if (timerId) {
                await this.api.update(this.tableName, timerId, timerData);
                this.toastFn('Timer updated successfully', 'success');
            } else {
                await this.api.insert(this.tableName, timerData);
                this.toastFn('Timer added successfully', 'success');
            }
            await this.loadTimers();
        } catch (error) {
            console.error('Error saving timer:', error);
            this.toastFn('Failed to save timer', 'error');
        }
    }

    async deleteTimer(timerId) {
        if (confirm('Are you sure you want to delete this timer?')) {
            try {
                await this.api.delete(this.tableName, timerId);
                this.toastFn('Timer deleted successfully', 'success');
                await this.loadTimers();
            } catch (error) {
                console.error('Error deleting timer:', error);
                this.toastFn('Failed to delete timer', 'error');
            }
        }
    }

    async togglePublish(timerId, currentStatus) {
        try {
            const newStatus = currentStatus === 'published' ? 'draft' : 'published';
            if (newStatus === 'published') {
                await this.api.publish(this.tableName, timerId);
            } else {
                await this.api.unpublish(this.tableName, timerId);
            }
            this.toastFn(`Timer ${newStatus === 'published' ? 'published' : 'unpublished'} successfully`, 'success');
            await this.loadTimers();
        } catch (error) {
            console.error('Error toggling publish status:', error);
            this.toastFn('Failed to update status', 'error');
        }
    }
}
