/**
 * notificationManager.js - Granular User Notification & Visibility Engine (Admin Panel)
 * 
 * Features:
 * 1. Targeted Notification Rules: Broadcast announcements, alerts, or data sync notices
 *    targeted strictly to specific user roles or account IDs.
 * 2. Per-User Permissions Matrix: Management interface for granular control over which
 *    users have access to specific notifications, preventing notification fatigue
 *    and maintaining role-based data isolation.
 */

import { DEFAULT_USERS } from './userManager.js';

export const DEFAULT_NOTIFICATIONS = [
  {
    id: "notif_welcome_all",
    title_si: "සාදරයෙන් පිළිගනිමු!",
    title_en: "Welcome to Life Planning App!",
    message_si: "නව දින චර්යා සහ පරිවෘත්තීය කෑම පරතර (5-Hour Gap) ට්‍රැකරය දැන් සක්‍රීයයි.",
    message_en: "New daily routine layout and 5-Hour metabolic meal gap tracker are now active.",
    type: "announcement",
    target_type: "all",
    target_value: "all",
    priority: "normal",
    active: true,
    created_at: new Date().toISOString()
  },
  {
    id: "notif_wosa_academic",
    title_si: "වෝසා සඳහා විශේෂ අධ්‍යයන සිහිකැඳවීමක්",
    title_en: "Special Study Reminder for Wosa",
    message_si: "අද දින ගණිතය සහ විද්‍යාව විෂයයන් සම්පූර්ණ කර ලකුණු 150 ඉලක්කය සපුරා ගන්න.",
    message_en: "Complete Mathematics and Science tasks today to reach your 150 points goal.",
    type: "reminder",
    target_type: "user",
    target_value: "user_wosa",
    priority: "high",
    active: true,
    created_at: new Date().toISOString()
  }
];

export const NOTIFICATION_TYPES = [
  { id: "announcement", label_si: "පොදු නිවේදන (Announcements)", icon: "fa-bullhorn", color: "text-blue-600 bg-blue-50" },
  { id: "alert", label_si: "අනතුරු ඇඟවීම් (Alerts)", icon: "fa-triangle-exclamation", color: "text-rose-600 bg-rose-50" },
  { id: "data_sync", label_si: "දත්ත සමමුහුර්තකරණය (Data Sync)", icon: "fa-arrows-rotate", color: "text-emerald-600 bg-emerald-50" },
  { id: "reminder", label_si: "සිහිකැඳවීම් (Reminders)", icon: "fa-clock", color: "text-purple-600 bg-purple-50" }
];

export class NotificationManager {
  constructor(containerEl, api, toastFn) {
    this.containerEl = containerEl;
    this.api = api;
    this.toast = toastFn || console.log;
    this.notifications = [];
    this.users = [...DEFAULT_USERS];
    this.permissionsMatrix = {}; // { [userId]: { announcement: true, alert: true, data_sync: true, reminder: true } }
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="p-3 sm:p-6 max-w-6xl mx-auto space-y-6 font-['Noto_Sans_Sinhala']">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 class="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <i class="fas fa-bell text-amber-500"></i> නිවේදන සහ පරිශීලක අවසර පද්ධතිය (Notification & Visibility Engine)
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              ඉලක්කගත නිවේදන (Targeted Rules) සහ පරිශීලක අවසර අනුකෘතිය (Permissions Matrix) මඟින් නිවේදන කළමනාකරණය කරන්න.
            </p>
          </div>
          <button id="add-notif-btn" type="button" class="w-full sm:w-auto justify-center px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer">
            <i class="fas fa-plus"></i> නව නිවේදනයක් (Broadcast Notice)
          </button>
        </div>

        <!-- Section 1: Per-User Permissions Matrix -->
        <div class="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <i class="fas fa-table-cells text-indigo-600"></i> Per-User Permissions Matrix (පරිශීලක අවසර අනුකෘතිය)
              </h3>
              <p class="text-[11px] text-slate-500">එක් එක් පරිශීලකයාට ලැබෙන නිවේදන වර්ග පාලනය කරන්න (Role-based data isolation & fatigue prevention).</p>
            </div>
            <button id="save-matrix-btn" type="button" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer">
              <i class="fas fa-save"></i> අවසර සුරකින්න (Save Matrix)
            </button>
          </div>

          <div class="overflow-x-auto">
            <table class="w-full min-w-[650px] text-left border-collapse text-xs">
              <thead>
                <tr class="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                  <th class="p-3 w-48">පරිශීලකයා (User Account)</th>
                  <th class="p-3 w-28">කාර්යභාරය (Role)</th>
                  <th class="p-3 text-center">පොදු නිවේදන</th>
                  <th class="p-3 text-center">අනතුරු ඇඟවීම්</th>
                  <th class="p-3 text-center">දත්ත සමමුහුර්ත</th>
                  <th class="p-3 text-center">සිහිකැඳවීම්</th>
                  <th class="p-3 text-center">සක්‍රීය නිවේදන</th>
                </tr>
              </thead>
              <tbody id="permissions-matrix-tbody" class="divide-y divide-slate-100 font-medium">
                <!-- Dynamically rendered -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Section 2: Targeted Notification Rules List -->
        <div class="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
          <div class="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 class="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <i class="fas fa-bullhorn text-amber-500"></i> Targeted Notification Broadcasts (ක්‍රියාත්මක නිවේදන නීති)
              </h3>
              <p class="text-[11px] text-slate-500">භූමිකාව හෝ ගිණුම් අංකය අනුව පෙන්වන නිවේදන.</p>
            </div>
            <span id="notif-count-badge" class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
              0 නිවේදන
            </span>
          </div>

          <div id="notifications-table-container" class="overflow-x-auto">
            <!-- Dynamically rendered -->
          </div>
        </div>

        <!-- Modals -->
        <div id="notif-modal-container"></div>
      </div>
    `;

    document.getElementById('add-notif-btn').addEventListener('click', () => this.openAddModal());
    document.getElementById('save-matrix-btn').addEventListener('click', () => this.savePermissionsMatrix());

    await this.loadData();
  }

  async loadData() {
    // 1. Load users
    try {
      const cached = localStorage.getItem('wosandi_users_config');
      if (cached) this.users = JSON.parse(cached);
    } catch (e) {}

    // 2. Load notifications
    let loadedNotifs = null;
    try {
      const raw = localStorage.getItem('wosandi_admin_notifications');
      if (raw) loadedNotifs = JSON.parse(raw);
    } catch (e) {}

    try {
      const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.notifications_config", {
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.notifications) {
          loadedNotifs = rows[0].config_data.notifications;
          localStorage.setItem('wosandi_admin_notifications', JSON.stringify(loadedNotifs));
        }
      }
    } catch (e) {}

    this.notifications = Array.isArray(loadedNotifs) && loadedNotifs.length > 0 ? loadedNotifs : [...DEFAULT_NOTIFICATIONS];

    // 3. Load permissions matrix
    let loadedMatrix = null;
    try {
      const raw = localStorage.getItem('wosandi_notification_permissions');
      if (raw) loadedMatrix = JSON.parse(raw);
    } catch (e) {}

    try {
      const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.notification_permissions", {
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.config_data?.matrix) {
          loadedMatrix = rows[0].config_data.matrix;
          localStorage.setItem('wosandi_notification_permissions', JSON.stringify(loadedMatrix));
        }
      }
    } catch (e) {}

    // Initialize defaults if empty
    this.permissionsMatrix = loadedMatrix || {};
    this.users.forEach(u => {
      if (!this.permissionsMatrix[u.id]) {
        this.permissionsMatrix[u.id] = {
          announcement: true,
          alert: true,
          data_sync: u.role === 'primary',
          reminder: true
        };
      }
    });

    this.renderPermissionsMatrix();
    this.renderNotificationsTable();
  }

  renderPermissionsMatrix() {
    const tbody = document.getElementById('permissions-matrix-tbody');
    if (!tbody) return;

    tbody.innerHTML = this.users.map(u => {
      const p = this.permissionsMatrix[u.id] || { announcement: true, alert: true, data_sync: true, reminder: true };
      
      // Calculate active targeted notifications visible to this user
      const eligibleCount = this.notifications.filter(n => {
        if (!n.active) return false;
        if (!p[n.type]) return false; // Blocked by matrix
        if (n.target_type === 'all') return true;
        if (n.target_type === 'role') return n.target_value === u.role;
        if (n.target_type === 'user') return n.target_value === u.id || n.target_value === u.username;
        return false;
      }).length;

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="p-3">
            <div class="flex items-center gap-2">
              <span class="text-xl">${u.avatar || '👤'}</span>
              <div>
                <span class="font-bold text-slate-800 block">${u.display_name || u.username}</span>
                <span class="text-[10px] text-slate-400 font-mono">${u.id}</span>
              </div>
            </div>
          </td>
          <td class="p-3">
            <span class="px-2 py-0.5 rounded-full text-[11px] font-bold ${u.role === 'primary' ? 'bg-pink-100 text-pink-700' : 'bg-slate-100 text-slate-600'}">
              ${u.role || 'member'}
            </span>
          </td>
          <td class="p-3 text-center">
            <input type="checkbox" class="matrix-toggle w-4 h-4 text-indigo-600 rounded cursor-pointer" data-uid="${u.id}" data-type="announcement" ${p.announcement ? 'checked' : ''}>
          </td>
          <td class="p-3 text-center">
            <input type="checkbox" class="matrix-toggle w-4 h-4 text-rose-600 rounded cursor-pointer" data-uid="${u.id}" data-type="alert" ${p.alert ? 'checked' : ''}>
          </td>
          <td class="p-3 text-center">
            <input type="checkbox" class="matrix-toggle w-4 h-4 text-emerald-600 rounded cursor-pointer" data-uid="${u.id}" data-type="data_sync" ${p.data_sync ? 'checked' : ''}>
          </td>
          <td class="p-3 text-center">
            <input type="checkbox" class="matrix-toggle w-4 h-4 text-purple-600 rounded cursor-pointer" data-uid="${u.id}" data-type="reminder" ${p.reminder ? 'checked' : ''}>
          </td>
          <td class="p-3 text-center">
            <span class="px-2.5 py-1 rounded-full text-xs font-black ${eligibleCount > 0 ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-400'}">
              ${eligibleCount} notices
            </span>
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('.matrix-toggle').forEach(chk => {
      chk.addEventListener('change', (e) => {
        const uid = e.target.dataset.uid;
        const type = e.target.dataset.type;
        if (!this.permissionsMatrix[uid]) this.permissionsMatrix[uid] = {};
        this.permissionsMatrix[uid][type] = e.target.checked;
        this.renderPermissionsMatrix();
      });
    });
  }

  async savePermissionsMatrix() {
    localStorage.setItem('wosandi_notification_permissions', JSON.stringify(this.permissionsMatrix));
    try {
      await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config", {
        method: "POST",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          config_key: "notification_permissions",
          config_data: { matrix: this.permissionsMatrix },
          updated_at: new Date().toISOString()
        })
      });
      this.toast("පරිශීලක අවසර අනුකෘතිය සාර්ථකව සුරකින ලදී!", "success");
    } catch (e) {
      this.toast("දේශීයව සුරකින ලදී", "info");
    }
  }

  renderNotificationsTable() {
    const container = document.getElementById('notifications-table-container');
    const badge = document.getElementById('notif-count-badge');
    if (!container) return;

    if (badge) badge.textContent = `${this.notifications.length} නිවේදන`;

    if (this.notifications.length === 0) {
      container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">කිසිදු නිවේදනයක් සකසා නැත. "නව නිවේදනයක්" ක්ලික් කරන්න.</div>`;
      return;
    }

    container.innerHTML = `
      <table class="w-full min-w-[750px] text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-50/60 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
            <th class="p-3">මාතෘකාව සහ පණිවිඩය (Notice)</th>
            <th class="p-3 w-32">වර්ගය (Type)</th>
            <th class="p-3 w-40">ඉලක්කගත පැවරුම (Target)</th>
            <th class="p-3 w-24">ප්‍රමුඛතාව</th>
            <th class="p-3 w-24 text-center">තත්ත්වය</th>
            <th class="p-3 w-28 text-right">ක්‍රියාමාර්ග</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 font-medium">
          ${this.notifications.map(n => {
            const typeObj = NOTIFICATION_TYPES.find(t => t.id === n.type) || NOTIFICATION_TYPES[0];
            
            // Format target badge
            let targetLabel = '<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">🌐 All Users</span>';
            if (n.target_type === 'role') {
              targetLabel = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Role: ${n.target_value}</span>`;
            } else if (n.target_type === 'user') {
              const matchedUser = this.users.find(u => u.id === n.target_value || u.username === n.target_value);
              targetLabel = `<span class="px-2 py-0.5 rounded-full text-[11px] font-bold bg-pink-50 text-pink-700 border border-pink-200">${matchedUser?.avatar || '👤'} ${matchedUser?.display_name || n.target_value}</span>`;
            }

            return `
              <tr class="hover:bg-slate-50/80 transition">
                <td class="p-3">
                  <div class="font-bold text-slate-800 text-sm">${n.title_si || n.title_en}</div>
                  <div class="text-[11px] text-slate-500 mt-0.5">${n.message_si || n.message_en}</div>
                  <span class="text-[10px] text-slate-400 font-mono">${new Date(n.created_at).toLocaleDateString()}</span>
                </td>
                <td class="p-3">
                  <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${typeObj.color}">
                    <i class="fas ${typeObj.icon}"></i> ${n.type}
                  </span>
                </td>
                <td class="p-3">
                  ${targetLabel}
                </td>
                <td class="p-3">
                  <span class="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${n.priority === 'urgent' ? 'bg-rose-100 text-rose-800' : (n.priority === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600')}">
                    ${n.priority || 'normal'}
                  </span>
                </td>
                <td class="p-3 text-center">
                  <button type="button" class="toggle-notif-active text-xs font-bold px-2 py-0.5 rounded-full cursor-pointer ${n.active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-500'}" data-id="${n.id}">
                    ${n.active ? 'සක්‍රීයයි' : 'අක්‍රීයයි'}
                  </button>
                </td>
                <td class="p-3 text-right space-x-1.5">
                  <button type="button" class="edit-notif-btn p-1.5 text-indigo-600 hover:bg-indigo-50 rounded cursor-pointer" data-id="${n.id}" title="සංස්කරණය">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button type="button" class="delete-notif-btn p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer" data-id="${n.id}" title="ඉවත් කරන්න">
                    <i class="fas fa-trash-alt"></i>
                  </button>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.querySelectorAll('.toggle-notif-active').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        const target = this.notifications.find(n => n.id === id);
        if (target) {
          target.active = !target.active;
          await this.persistNotifications();
          this.renderNotificationsTable();
          this.renderPermissionsMatrix();
        }
      });
    });

    container.querySelectorAll('.edit-notif-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const target = this.notifications.find(n => n.id === id);
        if (target) this.openEditModal(target);
      });
    });

    container.querySelectorAll('.delete-notif-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm("මෙම නිවේදනය ඉවත් කිරීමට අවශ්‍ය බව තහවුරු කරන්න?")) {
          this.notifications = this.notifications.filter(n => n.id !== id);
          await this.persistNotifications();
          this.renderNotificationsTable();
          this.renderPermissionsMatrix();
          this.toast("නිවේදනය ඉවත් කරන ලදී", "info");
        }
      });
    });
  }

  async persistNotifications() {
    localStorage.setItem('wosandi_admin_notifications', JSON.stringify(this.notifications));
    try {
      await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config", {
        method: "POST",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          "Prefer": "resolution=merge-duplicates"
        },
        body: JSON.stringify({
          config_key: "notifications_config",
          config_data: { notifications: this.notifications },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {}
  }

  openAddModal() {
    this.openEditModal(null);
  }

  openEditModal(notif = null) {
    const isEdit = Boolean(notif);
    const modalContainer = document.getElementById('notif-modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-4 font-['Noto_Sans_Sinhala']">
        <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-100">
          <div class="px-5 py-4 bg-gradient-to-r from-amber-500 to-indigo-600 text-white flex justify-between items-center shrink-0">
            <h3 class="font-bold text-sm flex items-center gap-2">
              <i class="fas ${isEdit ? 'fa-pen-to-square' : 'fa-bullhorn'}"></i>
              ${isEdit ? 'නිවේදනය සංස්කරණය (Edit Broadcast)' : 'නව නිවේදනයක් විකාශනය කරන්න (New Broadcast)'}
            </h3>
            <button type="button" id="close-notif-modal-btn" class="text-white/80 hover:text-white text-lg cursor-pointer">&times;</button>
          </div>

          <form id="notif-form" class="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">මාතෘකාව (සිංහලෙන්) *</label>
                <input type="text" id="notif-title-si" value="${notif?.title_si || ''}" required placeholder="උදා: අද දින විශේෂ නිවේදනය" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
              </div>
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">මාතෘකාව (English)</label>
                <input type="text" id="notif-title-en" value="${notif?.title_en || ''}" placeholder="e.g. Special Announcement" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 uppercase mb-1">පණිවිඩය (සිංහලෙන්) *</label>
              <textarea id="notif-msg-si" rows="2" required placeholder="නිවේදනයේ සම්පූර්ණ විස්තරය..." class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">${notif?.message_si || ''}</textarea>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">නිවේදන වර්ගය (Type)</label>
                <select id="notif-type" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
                  <option value="announcement" ${notif?.type === 'announcement' ? 'selected' : ''}>📢 පොදු නිවේදනයක් (Announcement)</option>
                  <option value="alert" ${notif?.type === 'alert' ? 'selected' : ''}>⚠️ අනතුරු ඇඟවීමක් (Urgent Alert)</option>
                  <option value="data_sync" ${notif?.type === 'data_sync' ? 'selected' : ''}>🔄 දත්ත සමමුහුර්ත (Data Sync)</option>
                  <option value="reminder" ${notif?.type === 'reminder' ? 'selected' : ''}>⏰ සිහිකැඳවීමක් (Daily Reminder)</option>
                </select>
              </div>
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">ප්‍රමුඛතාව (Priority)</label>
                <select id="notif-priority" class="w-full p-2.5 border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
                  <option value="normal" ${notif?.priority === 'normal' ? 'selected' : ''}>සාමාන්‍ය (Normal)</option>
                  <option value="high" ${notif?.priority === 'high' ? 'selected' : ''}>ඉහළ (High)</option>
                  <option value="urgent" ${notif?.priority === 'urgent' ? 'selected' : ''}>හදිසි (Urgent Banner)</option>
                </select>
              </div>
            </div>

            <!-- Targeted Notification Rules (Target Audience) -->
            <div class="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-2">
              <label class="block font-bold text-indigo-900 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <i class="fas fa-bullseye text-indigo-600"></i> ඉලක්කගත නීතිය (Targeted Audience Rule) *
              </label>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label class="block text-slate-600 text-[10px] uppercase font-bold mb-1">ඉලක්ක වර්ගය</label>
                  <select id="notif-target-type" class="w-full p-2.5 border border-indigo-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-indigo-300">
                    <option value="all" ${notif?.target_type === 'all' ? 'selected' : ''}>🌐 සියලු දෙනාට (All Users)</option>
                    <option value="role" ${notif?.target_type === 'role' ? 'selected' : ''}>👥 භූමිකාව අනුව (By Role)</option>
                    <option value="user" ${notif?.target_type === 'user' ? 'selected' : ''}>👤 එක් පරිශීලකයෙකුට පමණි (Specific User)</option>
                  </select>
                </div>
                <div id="target-value-container">
                  <label class="block text-slate-600 text-[10px] uppercase font-bold mb-1">තේරීම (Target Value)</label>
                  <select id="notif-target-value" class="w-full p-2.5 border border-indigo-300 rounded-xl bg-white text-xs focus:ring-2 focus:ring-indigo-300">
                    <!-- Populated dynamically -->
                  </select>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2 pt-2">
              <input type="checkbox" id="notif-active" ${notif ? (notif.active ? 'checked' : '') : 'checked'} class="w-4 h-4 text-indigo-600 rounded">
              <label for="notif-active" class="font-bold text-slate-700 cursor-pointer">වහාම විකාශනය සක්‍රීය කරන්න (Active Broadcast)</label>
            </div>

            <div class="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" id="cancel-notif-btn" class="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition cursor-pointer">
                අවලංගු කරන්න
              </button>
              <button type="submit" class="w-full sm:w-auto px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
                <i class="fas fa-paper-plane"></i> සුරකින්න සහ විකාශනය කරන්න (Save & Broadcast)
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeBtn = document.getElementById('close-notif-modal-btn');
    const cancelBtn = document.getElementById('cancel-notif-btn');
    const targetTypeSelect = document.getElementById('notif-target-type');
    const targetValueSelect = document.getElementById('notif-target-value');
    const form = document.getElementById('notif-form');

    const updateTargetValues = () => {
      const type = targetTypeSelect.value;
      if (type === 'all') {
        targetValueSelect.innerHTML = `<option value="all">සියලුම පරිශීලකයින් (All Users)</option>`;
      } else if (type === 'role') {
        targetValueSelect.innerHTML = `
          <option value="primary" ${notif?.target_value === 'primary' ? 'selected' : ''}>ප්‍රධාන පරිශීලක (Primary - Wosa)</option>
          <option value="member" ${notif?.target_value === 'member' ? 'selected' : ''}>සාමාන්‍ය සාමාජික (Members)</option>
        `;
      } else if (type === 'user') {
        targetValueSelect.innerHTML = this.users.map(u => `
          <option value="${u.id}" ${notif?.target_value === u.id || notif?.target_value === u.username ? 'selected' : ''}>
            ${u.avatar || '👤'} ${u.display_name || u.username} (${u.id})
          </option>
        `).join('');
      }
    };

    targetTypeSelect.addEventListener('change', updateTargetValues);
    updateTargetValues();

    const closeModal = () => { modalContainer.innerHTML = ''; };
    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        id: notif?.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        title_si: document.getElementById('notif-title-si').value.trim(),
        title_en: document.getElementById('notif-title-en').value.trim(),
        message_si: document.getElementById('notif-msg-si').value.trim(),
        type: document.getElementById('notif-type').value,
        priority: document.getElementById('notif-priority').value,
        target_type: targetTypeSelect.value,
        target_value: targetValueSelect.value,
        active: document.getElementById('notif-active').checked,
        created_at: notif?.created_at || new Date().toISOString()
      };

      if (isEdit) {
        const idx = this.notifications.findIndex(n => n.id === notif.id);
        if (idx >= 0) this.notifications[idx] = payload;
      } else {
        this.notifications.unshift(payload);
      }

      await this.persistNotifications();
      this.toast(isEdit ? "නිවේදනය යාවත්කාලීන කරන ලදී!" : "නව නිවේදනය සාර්ථකව විකාශනය කරන ලදී!", "success");
      closeModal();
      this.renderNotificationsTable();
      this.renderPermissionsMatrix();
    });
  }
}
