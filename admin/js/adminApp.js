import { AdminAuth } from './adminAuth.js?v=20260926-v1';
import { AdminApi } from './adminApi.js?v=20260926-v1';
// These will be implemented by other agents
import { TaskManager } from './taskManager.js?v=20260926-v1';
import { TimerManager } from './timerManager.js?v=20260926-v1';
import { FlowBuilder } from './flowBuilder.js?v=20260926-v1';
import { UiConfigurator } from './uiConfigurator.js?v=20260926-v1';
import { PublishManager } from './publishManager.js?v=20260926-v1';

class AdminApp {
    constructor() {
        this.auth = new AdminAuth();
        this.api = new AdminApi();
        
        // DOM Elements
        this.loginModal = document.getElementById('login-modal');
        this.loginContainer = document.getElementById('login-container');
        this.appContainer = document.getElementById('app-container');
        this.toastContainer = document.getElementById('toast-container');
        
        this.managers = {};
    }

    init() {
        if (this.auth.isAuthenticated()) {
            this.showApp();
        } else {
            this.showLogin();
        }
    }

    showLogin() {
        this.loginModal.classList.remove('hidden');
        this.appContainer.classList.add('hidden');
        this.auth.renderLoginScreen(this.loginContainer, () => {
            this.loginModal.classList.add('hidden');
            this.showApp();
        });
    }

    showApp() {
        this.appContainer.classList.remove('hidden');
        this.initManagers();
        this.setupNavigation();
        
        // Logout handler
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.auth.logout();
            window.location.reload();
        });
    }

    setupNavigation() {
        const tabs = document.querySelectorAll('.tab-link');
        const panes = document.querySelectorAll('.tab-pane');
        const headerTitle = document.getElementById('header-title');
        const sidebar = document.getElementById('sidebar');
        const mobileOverlay = document.getElementById('mobile-overlay');
        const openSidebarBtn = document.getElementById('open-sidebar');
        const closeSidebarBtn = document.getElementById('close-sidebar');

        const toggleSidebar = () => {
            sidebar.classList.toggle('-translate-x-full');
            mobileOverlay.classList.toggle('hidden');
        };

        openSidebarBtn.addEventListener('click', toggleSidebar);
        closeSidebarBtn.addEventListener('click', toggleSidebar);
        mobileOverlay.addEventListener('click', toggleSidebar);

        const switchTab = (tabId, updateUrl = true) => {
            const targetTab = document.querySelector(`.tab-link[data-tab="${tabId}"]`);
            if (!targetTab) return;

            // Remove active class from all tabs
            tabs.forEach(t => {
                t.classList.remove('active', 'bg-indigo-600', 'text-white');
            });

            // Add active class to clicked tab
            targetTab.classList.add('active', 'bg-indigo-600', 'text-white');

            // Hide all panes
            panes.forEach(pane => pane.classList.add('hidden'));

            // Show targeted pane
            const paneEl = document.getElementById(`tab-${tabId}`);
            if (paneEl) paneEl.classList.remove('hidden');

            // Update header title
            headerTitle.textContent = targetTab.textContent.trim();

            // Push clean URL for Cloudflare Pages routing (/admin/flows, /admin/tasks, etc.)
            if (updateUrl && window.history && window.history.pushState) {
                const targetUrl = tabId === 'overview' ? '/admin' : `/admin/${tabId}`;
                if (window.location.pathname !== targetUrl) {
                    window.history.pushState({ tab: tabId }, '', targetUrl);
                }
            }

            // Close sidebar on mobile after selection
            if (window.innerWidth < 768 && !sidebar.classList.contains('-translate-x-full')) {
                toggleSidebar();
            }

            // Render manager content if applicable
            this.renderTabContent(tabId);
        };

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const tabId = tab.getAttribute('data-tab');
                switchTab(tabId, true);
            });
        });

        // Route resolution for clean URLs (/admin/flows, /admin/tasks, etc.)
        const resolveInitialRoute = () => {
            const pathname = window.location.pathname || '';
            const hash = (window.location.hash || '').replace('#', '');
            const params = new URLSearchParams(window.location.search || '');
            const queryTab = params.get('tab');

            if (pathname.includes('/admin/flows') || hash === 'flows' || queryTab === 'flows') {
                return 'flows';
            }
            if (pathname.includes('/admin/tasks') || hash === 'tasks' || queryTab === 'tasks') {
                return 'tasks';
            }
            if (pathname.includes('/admin/timers') || hash === 'timers' || queryTab === 'timers') {
                return 'timers';
            }
            if (pathname.includes('/admin/widgets') || hash === 'widgets' || queryTab === 'widgets') {
                return 'widgets';
            }
            if (pathname.includes('/admin/settings') || hash === 'settings' || queryTab === 'settings') {
                return 'settings';
            }
            return 'overview';
        };

        const initialTab = resolveInitialRoute();
        switchTab(initialTab, false);

        window.addEventListener('popstate', (e) => {
            const tabToLoad = e.state?.tab || resolveInitialRoute();
            switchTab(tabToLoad, false);
        });
    }

    initManagers() {
        const toastFn = this.showToast.bind(this);
        
        try {
            this.managers.tasks = new TaskManager(document.getElementById('tab-tasks'), this.api, toastFn);
            this.managers.timers = new TimerManager(document.getElementById('tab-timers'), this.api, toastFn);
            this.managers.flows = new FlowBuilder(document.getElementById('tab-flows'), this.api, toastFn);
            this.managers.widgets = new UiConfigurator(document.getElementById('tab-widgets'), this.api, toastFn);
            this.managers.publish = new PublishManager(this.api, toastFn);
        } catch (e) {
            console.warn('Some managers could not be initialized:', e);
        }
    }

    async renderTabContent(tabId) {
        if (tabId === 'overview') {
            this.loadOverview();
        } else if (tabId === 'settings') {
            // PublishManager uses renderPublishPanel(containerEl), not render()
            const pc = document.getElementById('publish-container');
            if (pc && this.managers.publish) {
                await this.managers.publish.renderPublishPanel(pc);
            }
        } else if (this.managers[tabId] && typeof this.managers[tabId].render === 'function') {
            try {
                await this.managers[tabId].render();
            } catch (error) {
                console.error(`Error rendering ${tabId}:`, error);
                this.showToast(`Failed to load ${tabId} content`, 'error');
            }
        }
    }

    async loadOverview() {
        try {
            const fetchCount = async (table) => {
                const { data } = await this.api.select(table, {}, 'id', false);
                return data ? data.length : 0;
            };

            const fetchStatusCount = async (table, status) => {
                const { data } = await this.api.select(table, { status }, 'id', false);
                return data ? data.length : 0;
            };

            // Assuming standard tables will be created
            // Try/catch for each to not break if table doesn't exist yet
            let tasksCount = 0, timersCount = 0, flowsCount = 0, publishedCount = 0;
            
            try { tasksCount = await fetchCount('wosandi_tasks'); } catch(e){}
            try { timersCount = await fetchCount('wosandi_timers'); } catch(e){}
            try { flowsCount = await fetchCount('wosandi_flows'); } catch(e){}
            
            try {
                const pubTasks = await fetchStatusCount('wosandi_tasks', 'published');
                const pubTimers = await fetchStatusCount('wosandi_timers', 'published');
                const pubFlows = await fetchStatusCount('wosandi_flows', 'published');
                publishedCount = pubTasks + pubTimers + pubFlows;
            } catch(e){}

            document.getElementById('stat-tasks').textContent = tasksCount;
            document.getElementById('stat-timers').textContent = timersCount;
            document.getElementById('stat-flows').textContent = flowsCount;
            document.getElementById('stat-published').textContent = publishedCount;
            
        } catch (error) {
            console.error('Failed to load overview stats', error);
        }
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        
        let bgColor = 'bg-white';
        let iconColor = 'text-green-500';
        let iconClass = 'fa-check-circle';
        
        if (type === 'error') {
            iconColor = 'text-red-500';
            iconClass = 'fa-exclamation-circle';
        } else if (type === 'info') {
            iconColor = 'text-blue-500';
            iconClass = 'fa-info-circle';
        }

        toast.className = `flex items-center gap-3 px-4 py-3 bg-white border border-slate-200 rounded-lg shadow-lg mb-2 toast-enter-active z-50`;
        toast.innerHTML = `
            <i class="fas ${iconClass} ${iconColor} text-xl"></i>
            <span class="text-slate-700 font-medium text-sm">${message}</span>
        `;

        this.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('toast-exit-active');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', () => {
    window.adminApp = new AdminApp();
    window.adminApp.init();
});
