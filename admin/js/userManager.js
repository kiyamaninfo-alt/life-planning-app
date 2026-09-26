/**
 * UserManager - Isolated User Management Module for Life Planning Admin Panel
 * Manages users, PINs/passwords, roles, and points.
 * Top 5 active users are automatically presented on the login screen.
 * Default primary user is always "Wosa".
 */

export const DEFAULT_USERS = [
  {
    id: "user_wosa",
    username: "Wosa",
    display_name: "Wosa (වෝසා)",
    avatar: "🌸",
    pin: "1234",
    role: "primary",
    points: 120,
    is_active: true,
    is_default: true,
    created_at: "2026-09-26T22:45:00Z"
  },
  {
    id: "user_sandali",
    username: "Sandali",
    display_name: "Sandali (සඳලි)",
    avatar: "👧",
    pin: "1234",
    role: "member",
    points: 95,
    is_active: true,
    created_at: "2026-09-26T22:46:00Z"
  },
  {
    id: "user_kasun",
    username: "Kasun",
    display_name: "Kasun (කසුන්)",
    avatar: "🦁",
    pin: "1234",
    role: "member",
    points: 80,
    is_active: true,
    created_at: "2026-09-26T22:47:00Z"
  },
  {
    id: "user_nethmi",
    username: "Nethmi",
    display_name: "Nethmi (නෙත්මි)",
    avatar: "⭐",
    pin: "1234",
    role: "member",
    points: 70,
    is_active: true,
    created_at: "2026-09-26T22:48:00Z"
  },
  {
    id: "user_amaya",
    username: "Amaya",
    display_name: "Amaya (අමායා)",
    avatar: "🎨",
    pin: "1234",
    role: "member",
    points: 65,
    is_active: true,
    created_at: "2026-09-26T22:49:00Z"
  }
];

export class UserManager {
  constructor(containerEl, api, toastFn) {
    this.containerEl = containerEl;
    this.api = api;
    this.toast = toastFn || console.log;
    this.users = [];
    this.searchQuery = "";
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="p-6 max-w-6xl mx-auto space-y-6 font-['Noto_Sans_Sinhala']">
        <!-- Header -->
        <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 class="text-2xl font-bold text-slate-800 flex items-center gap-2.5">
              <i class="fas fa-users text-indigo-600"></i> පරිශීලක කළමනාකරණය (User Management)
            </h2>
            <p class="text-xs text-slate-500 mt-1">
              පරිශීලකයන්, මුරපද (PIN) සහ ලකුණු කළමනාකරණය කරන්න. ඉහළම පරිශීලකයන් 5 දෙනා (<span class="font-bold text-indigo-600">Top 5</span>) පිවිසුම් පිටුවේ (Login Page) සෘජුවම දිස්වේ.
            </p>
          </div>
          <div class="flex items-center gap-2.5">
            <button id="add-user-btn" type="button" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-2">
              <i class="fas fa-user-plus"></i> නව පරිශීලකයෙක් එක් කරන්න (+ Add User)
            </button>
          </div>
        </div>

        <!-- Metric Badges -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span class="text-slate-400 text-xs font-semibold block uppercase">මුළු පරිශීලකයන්</span>
            <span id="metric-total-users" class="text-xl font-bold text-slate-800 mt-1 block">...</span>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span class="text-slate-400 text-xs font-semibold block uppercase">සක්‍රීය පරිශීලකයන්</span>
            <span id="metric-active-users" class="text-xl font-bold text-emerald-600 mt-1 block">...</span>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span class="text-slate-400 text-xs font-semibold block uppercase">ප්‍රධාන පරිශීලකයා</span>
            <span id="metric-primary-user" class="text-xl font-bold text-pink-600 mt-1 block">🌸 Wosa</span>
          </div>
          <div class="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
            <span class="text-slate-400 text-xs font-semibold block uppercase">පිවිසුම් පිටුවේ පෙන්වන ගණන</span>
            <span class="text-xl font-bold text-indigo-600 mt-1 block">Top 5</span>
          </div>
        </div>

        <!-- Filter bar -->
        <div class="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white p-3 rounded-xl border border-slate-200">
          <div class="relative w-full sm:w-80">
            <i class="fas fa-search absolute left-3 top-3 text-slate-400 text-xs"></i>
            <input type="text" id="user-search-input" placeholder="පරිශීලක නාමයෙන් සොයන්න..." class="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg border border-slate-200 focus:outline-hidden focus:border-indigo-500">
          </div>
          <div class="text-xs text-slate-500 flex items-center gap-2">
            <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>ලකුණු අනුව පිළිවෙල (Ranked by Points)</span>
          </div>
        </div>

        <!-- Table Container -->
        <div id="users-table-container" class="bg-white rounded-xl shadow-xs overflow-x-auto border border-slate-200">
          <div class="p-8 text-center text-slate-400 text-xs">පරිශීලක දත්ත පූරණය වෙමින් පවතී...</div>
        </div>

        <!-- Modals -->
        <div id="user-modal-container"></div>
        <div id="user-delete-modal-container"></div>
      </div>
    `;

    document.getElementById("add-user-btn").addEventListener("click", () => this.openAddModal());
    document.getElementById("user-search-input").addEventListener("input", (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderTable();
    });

    await this.loadUsers();
  }

  async loadUsers() {
    try {
      // 1. Try Supabase wosandi_admin_config
      const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.users_config", {
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
        }
      });

      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].config_data && Array.isArray(rows[0].config_data.users)) {
          this.users = rows[0].config_data.users;
          localStorage.setItem("wosandi_users_config", JSON.stringify(this.users));
        }
      }
    } catch (e) {
      console.warn("Supabase fetch failed for users, falling back to local cache:", e);
    }

    // 2. LocalStorage Fallback if empty
    if (!this.users || this.users.length === 0) {
      const cached = localStorage.getItem("wosandi_users_config");
      if (cached) {
        try {
          this.users = JSON.parse(cached);
        } catch (e) {}
      }
    }

    // 3. Seed default users if still empty
    if (!this.users || this.users.length === 0) {
      this.users = [...DEFAULT_USERS];
      await this.persistUsers();
    }

    // Ensure Wosa exists as primary
    if (!this.users.some(u => u.username === "Wosa" || u.id === "user_wosa")) {
      this.users.unshift(DEFAULT_USERS[0]);
      await this.persistUsers();
    }

    this.updateMetrics();
    this.renderTable();
  }

  updateMetrics() {
    if (typeof document === "undefined") return;
    const totalEl = document.getElementById("metric-total-users");
    const activeEl = document.getElementById("metric-active-users");
    const primaryEl = document.getElementById("metric-primary-user");

    const total = this.users.length;
    const active = this.users.filter(u => u.is_active).length;
    const primary = this.users.find(u => u.role === "primary") || this.users[0];

    if (totalEl) totalEl.innerText = total;
    if (activeEl) activeEl.innerText = active;
    if (primaryEl && primary) primaryEl.innerText = `${primary.avatar || '🌸'} ${primary.username}`;
  }

  renderTable() {
    if (typeof document === "undefined") return;
    const container = document.getElementById("users-table-container");
    if (!container) return;

    let filtered = [...this.users];
    if (this.searchQuery) {
      filtered = filtered.filter(u => 
        (u.username && u.username.toLowerCase().includes(this.searchQuery)) ||
        (u.display_name && u.display_name.toLowerCase().includes(this.searchQuery)) ||
        (u.role && u.role.toLowerCase().includes(this.searchQuery))
      );
    }

    // Sort by points descending so ranking is clear
    filtered.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="p-8 text-center text-slate-400 text-xs">
          කිසිදු පරිශීලකයෙක් හමු නොවීය. "නව පරිශීලකයෙක් එක් කරන්න" ක්ලික් කරන්න.
        </div>
      `;
      return;
    }

    const html = `
      <table class="w-full text-left border-collapse text-xs">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
            <th class="p-3 w-14 text-center">Rank</th>
            <th class="p-3">පරිශීලකයා (User)</th>
            <th class="p-3">කාර්යභාරය (Role)</th>
            <th class="p-3">මුරපදය (PIN)</th>
            <th class="p-3 text-center">ලකුණු (Points)</th>
            <th class="p-3 text-center">පිවිසුම් පිටුව (Login Top 5)</th>
            <th class="p-3 text-center">තත්ත්වය (Status)</th>
            <th class="p-3 text-right">ක්‍රියාමාර්ග (Actions)</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${filtered.map((user, idx) => {
            const isTop5 = idx < 5 && user.is_active;
            const rankMedal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;
            const isPrimary = user.role === "primary" || user.username === "Wosa" || user.id === "user_wosa";

            return `
              <tr class="hover:bg-slate-50 transition-colors ${isTop5 ? 'bg-indigo-50/20' : ''}">
                <td class="p-3 text-center font-bold text-slate-700 text-sm">
                  ${rankMedal}
                </td>
                <td class="p-3">
                  <div class="flex items-center gap-3">
                    <span class="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-lg shadow-xs border border-slate-200">
                      ${user.avatar || '👤'}
                    </span>
                    <div>
                      <span class="font-bold text-slate-800 text-sm block">${user.display_name || user.username}</span>
                      <span class="text-slate-400 text-[11px]">@${user.username}</span>
                    </div>
                  </div>
                </td>
                <td class="p-3">
                  <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${isPrimary ? 'bg-pink-100 text-pink-700 border border-pink-200' : 'bg-slate-100 text-slate-700'}">
                    ${isPrimary ? '🌸 ප්‍රධාන (Primary)' : 'සාමාජික (Member)'}
                  </span>
                </td>
                <td class="p-3 font-mono">
                  <div class="flex items-center gap-2">
                    <span class="user-pin-val" data-pin="${user.pin || '1234'}">••••</span>
                    <button type="button" class="text-slate-400 hover:text-slate-600 toggle-pin-btn" title="Show/Hide PIN">
                      <i class="fas fa-eye text-xs"></i>
                    </button>
                  </div>
                </td>
                <td class="p-3 text-center">
                  <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                    🏆 ${user.points || 0} pts
                  </span>
                </td>
                <td class="p-3 text-center">
                  ${isTop5 ? `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200">
                      <i class="fas fa-check-circle"></i> පෙන්වයි (Active Top 5)
                    </span>
                  ` : `
                    <span class="text-slate-400 text-[11px]">ඉහළ 5ට නැත</span>
                  `}
                </td>
                <td class="p-3 text-center">
                  <button type="button" class="toggle-status-btn px-2.5 py-1 rounded-full text-[11px] font-bold transition ${user.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}" data-id="${user.id}">
                    ${user.is_active ? 'සක්‍රීයයි' : 'අක්‍රීයයි'}
                  </button>
                </td>
                <td class="p-3 text-right">
                  <div class="flex items-center justify-end gap-1.5">
                    <button type="button" class="edit-user-btn p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition" data-id="${user.id}" title="සංස්කරණය">
                      <i class="fas fa-edit"></i>
                    </button>
                    ${!isPrimary ? `
                      <button type="button" class="delete-user-btn p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition" data-id="${user.id}" title="මකාදමන්න">
                        <i class="fas fa-trash-alt"></i>
                      </button>
                    ` : `
                      <span class="p-1.5 text-slate-300 cursor-not-allowed" title="ප්‍රධාන පරිශීලකයා මකා දැමිය නොහැක"><i class="fas fa-lock"></i></span>
                    `}
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    container.innerHTML = html;

    // PIN toggle visibility
    container.querySelectorAll(".toggle-pin-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const row = e.target.closest("td");
        const pinSpan = row.querySelector(".user-pin-val");
        const icon = btn.querySelector("i");
        if (pinSpan.innerText === "••••") {
          pinSpan.innerText = pinSpan.dataset.pin;
          icon.className = "fas fa-eye-slash text-xs";
        } else {
          pinSpan.innerText = "••••";
          icon.className = "fas fa-eye text-xs";
        }
      });
    });

    // Toggle active status
    container.querySelectorAll(".toggle-status-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        const target = this.users.find(u => u.id === id);
        if (target) {
          target.is_active = !target.is_active;
          await this.persistUsers();
          this.toast(`පරිශීලක තත්ත්වය ${target.is_active ? 'සක්‍රීය' : 'අක්‍රීය'} කරන ලදී`, 'success');
          this.updateMetrics();
          this.renderTable();
        }
      });
    });

    // Edit User
    container.querySelectorAll(".edit-user-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        this.openEditModal(id);
      });
    });

    // Delete User
    container.querySelectorAll(".delete-user-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        this.openDeleteModal(id);
      });
    });
  }

  openAddModal() {
    this.openModal(null);
  }

  openEditModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;
    this.openModal(user);
  }

  openModal(user = null) {
    const isEdit = Boolean(user);
    const modalContainer = document.getElementById("user-modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
          <div class="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white flex justify-between items-center">
            <h3 class="font-bold text-sm flex items-center gap-2">
              <i class="fas ${isEdit ? 'fa-user-edit' : 'fa-user-plus'}"></i>
              ${isEdit ? 'පරිශීලක සංස්කරණය (Edit User)' : 'නව පරිශීලකයෙක් එක් කරන්න (Add New User)'}
            </h3>
            <button type="button" class="close-user-modal text-white/80 hover:text-white text-lg">&times;</button>
          </div>

          <form id="user-form" class="p-6 space-y-4 text-xs">
            <div class="flex gap-4">
              <div class="w-20">
                <label class="block font-bold text-slate-700 uppercase mb-1">Avatar</label>
                <input type="text" id="form-avatar" value="${user?.avatar || '👧'}" maxlength="4" class="w-full text-center text-2xl p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
              </div>
              <div class="flex-1">
                <label class="block font-bold text-slate-700 uppercase mb-1">පරිශීලක නාමය (Username)</label>
                <input type="text" id="form-username" value="${user?.username || ''}" placeholder="e.g. Kasun" required class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
              </div>
            </div>

            <div>
              <label class="block font-bold text-slate-700 uppercase mb-1">ප්‍රදර්ශන නාමය (Display Name)</label>
              <input type="text" id="form-display-name" value="${user?.display_name || ''}" placeholder="e.g. Kasun (කසුන්)" required class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden">
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">මුරපදය / PIN (Password)</label>
                <input type="password" id="form-pin" value="${user?.pin || '1234'}" placeholder="e.g. 1234" required class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden font-mono text-center">
              </div>
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">ලකුණු (Initial Points)</label>
                <input type="number" id="form-points" value="${user?.points !== undefined ? user.points : 50}" min="0" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden text-center">
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block font-bold text-slate-700 uppercase mb-1">කාර්යභාරය (Role)</label>
                <select id="form-role" class="w-full p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-300 focus:outline-hidden bg-white">
                  <option value="member" ${user?.role === 'member' ? 'selected' : ''}>සාමාජික (Member)</option>
                  <option value="primary" ${user?.role === 'primary' ? 'selected' : ''}>ප්‍රධාන (Primary)</option>
                </select>
              </div>
              <div class="flex items-center pt-5">
                <label class="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="form-active" ${user ? (user.is_active ? 'checked' : '') : 'checked'} class="w-4 h-4 text-indigo-600 rounded">
                  <span class="font-bold text-slate-700">සක්‍රීයයි (Active)</span>
                </label>
              </div>
            </div>

            <div class="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-800 text-[11px]">
              <i class="fas fa-info-circle text-amber-600 mr-1"></i>
              සක්‍රීය පරිශීලකයන් අතරින් වැඩිම ලකුණු ලබා ඇති ඉහළම 5 දෙනා (<span class="font-bold">Top 5</span>) මුල් පිවිසුම් පිටුවේ (Login Screen) දිස්වේ.
            </div>

            <div class="flex justify-end gap-2 pt-3 border-t border-slate-200">
              <button type="button" class="close-user-modal px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition">
                අවලංගු කරන්න
              </button>
              <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5">
                <i class="fas fa-save"></i> සුරකින්න (Save)
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelectorAll(".close-user-modal").forEach(b => b.addEventListener("click", closeModal));

    document.getElementById("user-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const username = document.getElementById("form-username").value.trim();
      const displayName = document.getElementById("form-display-name").value.trim() || username;
      const avatar = document.getElementById("form-avatar").value.trim() || '👤';
      const pin = document.getElementById("form-pin").value.trim() || '1234';
      const points = Number(document.getElementById("form-points").value) || 0;
      const role = document.getElementById("form-role").value;
      const isActive = document.getElementById("form-active").checked;

      if (!username) {
        alert("කරුණාකර පරිශීලක නාමය ඇතුළත් කරන්න");
        return;
      }

      if (isEdit) {
        user.username = username;
        user.display_name = displayName;
        user.avatar = avatar;
        user.pin = pin;
        user.points = points;
        user.role = role;
        user.is_active = isActive;
        user.updated_at = new Date().toISOString();
      } else {
        const newId = "user_" + Math.random().toString(36).substring(2, 9);
        this.users.push({
          id: newId,
          username,
          display_name: displayName,
          avatar,
          pin,
          points,
          role,
          is_active: isActive,
          created_at: new Date().toISOString()
        });
      }

      await this.persistUsers();
      closeModal();
      this.toast(isEdit ? "පරිශීලකයා යාවත්කාලීන කරන ලදී" : "නව පරිශීලකයා සාර්ථකව එක් කරන ලදී", "success");
      this.updateMetrics();
      this.renderTable();
    });
  }

  openDeleteModal(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    if (user.role === "primary" || user.username === "Wosa" || user.id === "user_wosa") {
      this.toast("ප්‍රධාන පරිශීලකයා (Wosa) මකා දැමිය නොහැක!", "error");
      return;
    }

    const modalContainer = document.getElementById("user-delete-modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 text-center border border-slate-100">
          <div class="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto mb-3 text-xl">
            <i class="fas fa-exclamation-triangle"></i>
          </div>
          <h3 class="text-base font-bold text-slate-800 mb-1">පරිශීලකයා මකා දැමීම තහවුරු කරන්න</h3>
          <p class="text-xs text-slate-500 mb-6">
            ඔබට "${user.display_name || user.username}" ගිණුම ස්ථිරවම මකා දැමීමට අවශ්‍ය බව සහතිකද?
          </p>
          <div class="flex justify-center gap-3">
            <button type="button" class="close-del-modal px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition">
              අවලංගු කරන්න
            </button>
            <button type="button" id="confirm-del-btn" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition">
              මකා දමන්න
            </button>
          </div>
        </div>
      </div>
    `;

    const closeModal = () => { modalContainer.innerHTML = ''; };
    modalContainer.querySelectorAll(".close-del-modal").forEach(b => b.addEventListener("click", closeModal));

    document.getElementById("confirm-del-btn").addEventListener("click", async () => {
      this.users = this.users.filter(u => u.id !== userId);
      await this.persistUsers();
      closeModal();
      this.toast("පරිශීලකයා සාර්ථකව මකා දමන ලදී", "success");
      this.updateMetrics();
      this.renderTable();
    });
  }

  async persistUsers() {
    // 1. Save to local storage
    localStorage.setItem("wosandi_users_config", JSON.stringify(this.users));

    // 2. Sync to Supabase wosandi_admin_config
    try {
      await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.users_config", {
        method: "PATCH",
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          "Content-Type": "application/json",
          Prefer: "return=minimal"
        },
        body: JSON.stringify({
          config_data: {
            users: this.users
          },
          updated_at: new Date().toISOString()
        })
      });
    } catch (e) {
      console.warn("Could not sync users to Supabase:", e);
    }
  }
}
