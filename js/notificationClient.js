/**
 * notificationClient.js - Granular User Notification & Visibility Engine (Client / Dashboard)
 * 
 * Enforces targeted notification rules & per-user permissions matrix on the student dashboard:
 * - Administrators can broadcast announcements, alerts, or data sync notices targeted strictly
 *   to specific user roles or account IDs.
 * - Per-User Permissions Matrix ensures users only receive notifications they have permission for,
 *   preventing notification fatigue and maintaining role-based data isolation.
 */

const SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";

export class NotificationClient {
  constructor() {
    this.notifications = [];
    this.permissionsMatrix = {};
    this.currentUser = this.getActiveUser();
    this.isInitialized = false;
  }

  getActiveUser() {
    try {
      if (typeof window !== 'undefined' && window.userManagerClient && window.userManagerClient.getCurrentUser) {
        return window.userManagerClient.getCurrentUser();
      }
      const raw = localStorage.getItem('wosandi_current_user');
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { id: 'user_wosa', username: 'Wosa', display_name: 'Wosa (වෝසා)', role: 'primary' };
  }

  getReadStorageKey() {
    const uid = this.currentUser?.id || 'user_wosa';
    return `wosandi_read_notifs_${uid}`;
  }

  getReadNotificationIds() {
    try {
      const raw = localStorage.getItem(this.getReadStorageKey());
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  markAsRead(notifId) {
    const ids = this.getReadNotificationIds();
    if (!ids.includes(notifId)) {
      ids.push(notifId);
      localStorage.setItem(this.getReadStorageKey(), JSON.stringify(ids));
      this.render();
    }
  }

  markAllAsRead() {
    const eligible = this.getEligibleNotifications();
    const ids = eligible.map(n => n.id);
    localStorage.setItem(this.getReadStorageKey(), JSON.stringify(ids));
    this.render();
  }

  getUnreadNotifications() {
    const eligible = this.getEligibleNotifications();
    const readIds = this.getReadNotificationIds();
    return eligible.filter(n => !readIds.includes(n.id));
  }

  getUnreadCount() {
    return this.getUnreadNotifications().length;
  }

  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (typeof window !== 'undefined') {
      window.addEventListener('wosandi-user-changed', (e) => {
        this.currentUser = e.detail || this.getActiveUser();
        this.render();
      });
    }

    await this.fetchNotificationsAndPermissions();
    this.render();
  }

  async fetchNotificationsAndPermissions() {
    // 1. LocalStorage Cache first
    try {
      const rawNotifs = localStorage.getItem('wosandi_admin_notifications');
      if (rawNotifs) this.notifications = JSON.parse(rawNotifs);
      const rawMatrix = localStorage.getItem('wosandi_notification_permissions');
      if (rawMatrix) this.permissionsMatrix = JSON.parse(rawMatrix);
    } catch (e) {}

    // 2. Fetch from Supabase wosandi_admin_config
    try {
      const [resNotifs, resMatrix] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.notifications_config`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        }),
        fetch(`${SUPABASE_URL}/rest/v1/wosandi_admin_config?config_key=eq.notification_permissions`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        })
      ]);

      if (resNotifs.ok) {
        const rows = await resNotifs.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.notifications) {
          this.notifications = rows[0].config_data.notifications;
          localStorage.setItem('wosandi_admin_notifications', JSON.stringify(this.notifications));
        }
      }

      if (resMatrix.ok) {
        const rows = await resMatrix.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.matrix) {
          this.permissionsMatrix = rows[0].config_data.matrix;
          localStorage.setItem('wosandi_notification_permissions', JSON.stringify(this.permissionsMatrix));
        }
      }
    } catch (e) {}
  }

  getEligibleNotifications() {
    const user = this.currentUser || this.getActiveUser();
    const uid = user?.id || 'user_wosa';
    const role = user?.role || 'primary';
    const permissions = this.permissionsMatrix[uid] || { announcement: true, alert: true, data_sync: true, reminder: true };

    return this.notifications.filter(n => {
      // 1. Must be active
      const isActive = n.active !== undefined ? n.active : (n.is_active !== undefined ? n.is_active : true);
      if (!isActive) return false;

      // 2. Must be allowed by Per-User Permissions Matrix
      if (permissions[n.type] === false) return false;

      // 3. Target rule check
      if (n.target_type === 'all') return true;
      if (n.target_type === 'role') {
        const val = n.target_value || n.target_role;
        return val === role;
      }
      if (n.target_type === 'user') {
        const val = n.target_value || n.target_user_id;
        return val === uid || val === user?.username;
      }

      return false;
    });
  }

  render() {
    if (typeof document === 'undefined') return;

    const eligible = this.getEligibleNotifications();
    const readIds = this.getReadNotificationIds();
    const unread = eligible.filter(n => !readIds.includes(n.id));

    // 1. Render / Update Header Notification Bell
    this.renderHeaderBell(unread.length);

    // 2. Render Urgent Banner if there is an unread urgent alert
    this.renderUrgentBanner(unread);
  }

  renderHeaderBell(unreadCount) {
    let bellContainer = document.getElementById('notification-bell-container');
    if (!bellContainer) {
      // Find the top header button group in index.html
      const headerBtns = document.querySelector('header .flex.justify-between .flex.items-center.gap-1\\.5') ||
                         document.querySelector('header .flex.justify-between');
      if (headerBtns) {
        bellContainer = document.createElement('div');
        bellContainer.id = 'notification-bell-container';
        bellContainer.className = 'relative inline-block';
        headerBtns.insertBefore(bellContainer, headerBtns.firstChild);
      }
    }

    if (!bellContainer) return;

    bellContainer.innerHTML = `
      <button id="notification-bell-btn" type="button" class="relative p-2 text-slate-600 hover:text-indigo-600 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-2xs transition cursor-pointer" title="නිවේදන සහ පණිවිඩ (Notifications)">
        <i class="fa-solid fa-bell text-sm"></i>
        ${unreadCount > 0 ? `
          <span class="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse shadow-xs">
            ${unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ` : ''}
      </button>
    `;

    const btn = document.getElementById('notification-bell-btn');
    if (btn) {
      btn.addEventListener('click', () => this.openNotificationModal());
    }
  }

  renderUrgentBanner(unreadList) {
    let bannerEl = document.getElementById('urgent-notification-banner');
    const urgentNotifs = unreadList.filter(n => n.priority === 'urgent' || n.type === 'alert');

    if (urgentNotifs.length === 0) {
      if (bannerEl) bannerEl.remove();
      return;
    }

    const topNotice = urgentNotifs[0];

    if (!bannerEl) {
      bannerEl = document.createElement('div');
      bannerEl.id = 'urgent-notification-banner';
      bannerEl.className = 'bg-rose-500 text-white text-xs font-semibold px-4 py-2 shadow-sm flex items-center justify-between gap-3 sticky top-0 z-50 font-[\'Noto_Sans_Sinhala\']';
      
      const body = document.body;
      if (body) body.insertBefore(bannerEl, body.firstChild);
    }

    bannerEl.innerHTML = `
      <div class="max-w-md mx-auto w-full flex items-center justify-between gap-2">
        <div class="flex items-center gap-2 truncate">
          <i class="fa-solid fa-triangle-exclamation text-amber-300 text-sm animate-bounce shrink-0"></i>
          <span class="font-bold shrink-0">${topNotice.title_si || topNotice.title_en}:</span>
          <span class="truncate text-[11px] opacity-90">${topNotice.message_si || topNotice.message_en}</span>
        </div>
        <button type="button" id="dismiss-urgent-banner" class="text-white/80 hover:text-white text-sm font-bold px-2 py-0.5 rounded cursor-pointer" title="ඉවත් කරන්න">&times;</button>
      </div>
    `;

    const dismissBtn = document.getElementById('dismiss-urgent-banner');
    if (dismissBtn) {
      dismissBtn.addEventListener('click', () => {
        this.markAsRead(topNotice.id);
        bannerEl.remove();
      });
    }
  }

  openNotificationModal() {
    if (typeof document === 'undefined') return;

    let modalContainer = document.getElementById('client-notif-modal-container');
    if (!modalContainer) {
      modalContainer = document.createElement('div');
      modalContainer.id = 'client-notif-modal-container';
      document.body.appendChild(modalContainer);
    }

    const eligible = this.getEligibleNotifications();
    const readIds = this.getReadNotificationIds();

    modalContainer.innerHTML = `
      <div id="client-notif-modal" class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] flex flex-col overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div class="px-5 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center shrink-0">
            <div class="flex items-center gap-2">
              <i class="fa-solid fa-bell text-amber-300"></i>
              <h3 class="font-bold text-sm">නිවේදන පුවරුව (Notifications)</h3>
            </div>
            <div class="flex items-center gap-2">
              ${eligible.length > 0 ? `
                <button type="button" id="mark-all-read-btn" class="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2.5 py-1 rounded-lg transition font-medium cursor-pointer">
                  සියල්ල කියවූ ලෙස
                </button>
              ` : ''}
              <button type="button" id="close-client-notif-modal" class="text-white/80 hover:text-white text-lg cursor-pointer">&times;</button>
            </div>
          </div>

          <div class="p-4 overflow-y-auto space-y-3 flex-1 text-xs">
            ${eligible.length === 0 ? `
              <div class="p-8 text-center text-slate-400 space-y-2">
                <i class="fa-solid fa-bell-slash text-3xl text-slate-300 block mb-2"></i>
                <span class="font-bold block">ඔබට නව නිවේදන නොමැත</span>
                <span class="text-[11px]">පරිපාලක විසින් එවන නිවේදන මෙහි දිස්වේ.</span>
              </div>
            ` : eligible.map(n => {
              const isRead = readIds.includes(n.id);
              let icon = 'fa-bullhorn';
              let badgeColor = 'bg-blue-100 text-blue-700';
              if (n.type === 'alert') { icon = 'fa-triangle-exclamation'; badgeColor = 'bg-rose-100 text-rose-700'; }
              if (n.type === 'data_sync') { icon = 'fa-arrows-rotate'; badgeColor = 'bg-emerald-100 text-emerald-700'; }
              if (n.type === 'reminder') { icon = 'fa-clock'; badgeColor = 'bg-purple-100 text-purple-700'; }

              return `
                <div class="p-3.5 rounded-xl border transition-all ${isRead ? 'bg-slate-50 border-slate-200 opacity-75' : 'bg-white border-indigo-200 shadow-xs ring-1 ring-indigo-50'}">
                  <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-lg ${badgeColor} flex items-center justify-center text-xs shrink-0">
                        <i class="fa-solid ${icon}"></i>
                      </span>
                      <h4 class="font-bold text-slate-800 text-xs">${n.title_si || n.title_en}</h4>
                    </div>
                    ${!isRead ? `
                      <span class="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" title="නොකියවූ"></span>
                    ` : ''}
                  </div>
                  <p class="text-slate-600 text-[11px] mt-2 leading-relaxed">${n.message_si || n.message_en}</p>
                  <div class="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                    <span>${new Date(n.created_at).toLocaleDateString()}</span>
                    ${!isRead ? `
                      <button type="button" class="mark-single-read text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer" data-id="${n.id}">
                        කියවූ ලෙස සලකුණු කරන්න ✓
                      </button>
                    ` : '<span class="text-slate-400">කියවන ලදී</span>'}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    document.getElementById('close-client-notif-modal').addEventListener('click', closeModal);

    const markAllBtn = document.getElementById('mark-all-read-btn');
    if (markAllBtn) {
      markAllBtn.addEventListener('click', () => {
        this.markAllAsRead();
        this.openNotificationModal(); // refresh
      });
    }

    modalContainer.querySelectorAll('.mark-single-read').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.markAsRead(id);
        this.openNotificationModal(); // refresh
      });
    });
  }
}

// Global Singleton Instance
export const notificationClient = new NotificationClient();

if (typeof window !== 'undefined') {
  window.notificationClient = notificationClient;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => notificationClient.init());
  } else {
    notificationClient.init();
  }
}
