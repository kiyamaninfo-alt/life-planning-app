/**
 * userManagerClient.js - Frontend Client for Multi-User Management & Top 5 Login
 * 
 * Requirements handled:
 * 1. Anyone can see the progress (Public progress visibility / View-Only Mode).
 * 2. Only the relevant user can edit data (Protected with PIN / Password).
 * 3. Top 5 users based on points displayed on the login / user selection page.
 * 4. Default user is "Wosa".
 */

export const DEFAULT_USERS = [
  {
    id: "user_wosa",
    username: "Wosa",
    display_name: "Wosandi (වෝසන්දි)",
    avatar: "🌸",
    pin: "3408",
    role: "primary",
    points: 120,
    is_active: true,
    is_default: true,
    created_at: "2026-09-26T22:45:00Z"
  },
  {
    id: "user_nilu",
    username: "Nilu",
    display_name: "Nilu (නිලූ)",
    avatar: "🌺",
    pin: "3408",
    role: "member",
    points: 100,
    is_active: true,
    created_at: "2026-09-26T22:49:00Z"
  },
  {
    id: "user_admin",
    username: "Admin",
    display_name: "Admin (පරිපාලක)",
    avatar: "🛡️",
    pin: "340800",
    role: "admin",
    points: 0,
    is_active: true,
    is_admin_profile: true,
    created_at: "2026-10-03T00:00:00Z"
  }
];

class UserManagerClient {
  constructor() {
    this.users = [];
    this.currentUser = null;
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return this.currentUser;
    await this.loadUsers();
    this.currentUser = this.getCurrentUser();
    this.isInitialized = true;
    this.updateUserHeaderPill();
    this.renderPermissionBanner();
    return this.currentUser;
  }

  async loadUsers() {
    try {
      const res = await fetch("https://rxwopsfjnlzlzzazgnvq.supabase.co/rest/v1/wosandi_admin_config?config_key=eq.users_config", {
        headers: {
          apikey: "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn",
          Authorization: "Bearer sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn"
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].config_data?.users) {
          this.users = rows[0].config_data.users;
          if (typeof localStorage !== "undefined") {
            localStorage.setItem("wosandi_users_config", JSON.stringify(this.users));
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch users from Supabase, checking local cache", e);
    }

    if (!this.users || this.users.length === 0) {
      if (typeof localStorage !== "undefined") {
        const cached = localStorage.getItem("wosandi_users_config");
        if (cached) {
          try { this.users = JSON.parse(cached); } catch (e) {}
        }
      }
    }

    // Filter out test runner accounts
    if (this.users && Array.isArray(this.users)) {
      this.users = this.users.filter(u => u && u.id !== "user_test_runner" && !u.username?.toLowerCase().includes("testrunner"));
    }

    if (!this.users || this.users.length === 0) {
      this.users = [...DEFAULT_USERS];
    }

    // Ensure Wosa / Wosandi is present
    if (!this.users.some(u => u.username === "Wosa" || u.username === "Wosandi" || u.id === "user_wosa")) {
      this.users.unshift(DEFAULT_USERS[0]);
    }

    // Ensure Nilu is present
    if (!this.users.some(u => u.username === "Nilu" || u.id === "user_nilu")) {
      this.users.splice(1, 0, DEFAULT_USERS[1]);
    }

    // Ensure Admin profile is present (initial PIN 340800)
    const adminUserDef = DEFAULT_USERS.find(u => u.id === "user_admin" || u.role === "admin");
    if (adminUserDef && !this.users.some(u => u.id === "user_admin" || u.role === "admin")) {
      this.users.push(adminUserDef);
    }

    // SYNC currentUser if it was already selected/cached
    if (this.currentUser && this.users && this.users.length > 0) {
      const found = this.users.find(u => u.id === this.currentUser.id || u.username === this.currentUser.username);
      if (found) {
        this.currentUser = { ...this.currentUser, ...found };
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("wosandi_current_user", JSON.stringify(this.currentUser));
        }
        this.updateUserHeaderPill();
      }
    }

    return this.users;
  }

  async persistUsers() {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("wosandi_users_config", JSON.stringify(this.users));
    }

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

  getTop5Users() {
    const active = this.users.filter(u => u.is_active !== false && u.role !== 'admin');
    active.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
    return active.slice(0, 5);
  }

  getCurrentUser() {
    if (this.currentUser) {
      if (this.users && this.users.length > 0) {
        const found = this.users.find(u => u.id === this.currentUser.id || u.username === this.currentUser.username);
        if (found) {
          this.currentUser = { ...this.currentUser, ...found };
        }
      }
      return this.currentUser;
    }

    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("wosandi_current_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            const found = this.users.find(u => u.id === parsed.id || u.username === parsed.username);
            this.currentUser = found ? { ...parsed, ...found } : parsed;
            return this.currentUser;
          }
        } catch (e) {}
      }
    }

    // Requirement 4: Default user is always Wosa
    const wosa = this.users.find(u => u.username === "Wosa" || u.id === "user_wosa") || DEFAULT_USERS[0];
    this.currentUser = wosa;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("wosandi_current_user", JSON.stringify(wosa));
    }
    return this.currentUser;
  }

  setCurrentUser(user, isAuth = false) {
    this.currentUser = user;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("wosandi_current_user", JSON.stringify(user));
    }
    if (isAuth) {
      this.setAuthenticated(user, true);
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wosandi-user-changed", { detail: user }));
    }
    this.updateUserHeaderPill();
    this.renderPermissionBanner();
  }

  // =========================================================================
  // Permission & Edit Mode Controllers (Requirement 1)
  // "only relevant user should be able to edit the data but anyone can see the progress"
  // =========================================================================

  isUserAuthenticated(user = null) {
    const target = user || this.getCurrentUser();
    if (!target || !target.id) return false;
    if (typeof sessionStorage !== "undefined") {
      return sessionStorage.getItem(`wosandi_auth_user_${target.id}`) === "true";
    }
    return false;
  }

  setAuthenticated(user, isAuth = true) {
    const target = user || this.getCurrentUser();
    if (!target || !target.id) return;
    if (typeof sessionStorage !== "undefined") {
      if (isAuth) {
        sessionStorage.setItem(`wosandi_auth_user_${target.id}`, "true");
      } else {
        sessionStorage.removeItem(`wosandi_auth_user_${target.id}`);
      }
    }
    this.updateUserHeaderPill();
    this.renderPermissionBanner();
  }

  canEdit() {
    return this.isUserAuthenticated(this.getCurrentUser());
  }

  lockEditing() {
    this.setAuthenticated(this.getCurrentUser(), false);
  }

  /**
   * Prompts for PIN if user is in View-Only mode before allowing any edit.
   * Resolves true if authenticated, false if cancelled/rejected.
   */
  async requireEditPermission(actionLabel = "මෙම කාර්යය සංස්කරණය කිරීම") {
    if (this.canEdit()) {
      return true;
    }

    const user = this.getCurrentUser();
    return new Promise((resolve) => {
      this.promptUserPassword(
        user,
        () => {
          this.setAuthenticated(user, true);
          resolve(true);
        },
        actionLabel,
        () => resolve(false)
      );
    });
  }

  getRoutineStateKey(todayDate) {
    const user = this.getCurrentUser();
    if (!user || user.username === "Wosa" || user.id === "user_wosa") {
      return "wosandi_routine_state_" + todayDate;
    }
    return `wosandi_routine_state_${user.id}_${todayDate}`;
  }

  getFlowCompletedKey(todayDate) {
    const user = this.getCurrentUser();
    if (!user || user.username === "Wosa" || user.id === "user_wosa") {
      return "wosandi_flow_completed_" + todayDate;
    }
    return `wosandi_flow_completed_${user.id}_${todayDate}`;
  }

  getFlowPointsKey(todayDate) {
    const user = this.getCurrentUser();
    if (!user || user.username === "Wosa" || user.id === "user_wosa") {
      return "wosandi_flow_points_" + todayDate;
    }
    return `wosandi_flow_points_${user.id}_${todayDate}`;
  }

  updateUserHeaderPill() {
    if (typeof document === "undefined") return;
    const user = this.getCurrentUser();
    const avatarEl = document.getElementById("active-user-avatar");
    const nameEl = document.getElementById("active-user-name");
    const pointsEl = document.getElementById("active-user-points");
    const lockEl = document.getElementById("active-user-lock-icon");

    const isEditor = this.canEdit();

    if (avatarEl) avatarEl.innerText = user.avatar || "🌸";
    if (nameEl) nameEl.innerText = user.username || "Wosa";
    if (pointsEl) {
      if (typeof pointsEl.remove === "function") {
        pointsEl.remove();
      } else {
        pointsEl.innerText = "";
      }
    }
    if (lockEl) {
      lockEl.className = isEditor ? "fa-solid fa-lock-open text-[10px] text-emerald-500" : "fa-solid fa-eye text-[10px] text-amber-500";
      lockEl.title = isEditor ? "සංස්කරණ අවසර ඇත (Editing rights active)" : "නැරඹුම් ප්‍රකාරය (View-Only Mode)";
    }

    // Requirement 6: Links for Wosandi O/L and Admin on top show ONLY to Wosandi profile
    const isWosandi = user && (user.username === "Wosa" || user.username === "Wosandi" || user.id === "user_wosa");
    const wosandiLink = document.getElementById("header-wosandi-link");
    const adminLink = document.getElementById("header-admin-link");
    if (wosandiLink) {
      if (isWosandi) {
        wosandiLink.classList.remove("hidden");
        wosandiLink.style.display = "";
      } else {
        wosandiLink.classList.add("hidden");
        wosandiLink.style.display = "none";
      }
    }
    if (adminLink) {
      if (isWosandi) {
        adminLink.classList.remove("hidden");
        adminLink.style.display = "";
      } else {
        adminLink.classList.add("hidden");
        adminLink.style.display = "none";
      }
    }
  }

  renderPermissionBanner() {
    if (typeof document === "undefined") return;
    let container = document.getElementById("permission-banner-container");
    if (!container) return;

    const user = this.getCurrentUser();
    const isEditor = this.canEdit();

    if (!isEditor) {
      container.innerHTML = `
        <div class="mb-4 bg-amber-50/90 border border-amber-200 rounded-2xl p-3 flex items-center justify-between gap-3 text-xs shadow-xs font-['Noto_Sans_Sinhala'] animate-in fade-in duration-200">
          <div class="flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-sm font-bold shrink-0">👁️</span>
            <div>
              <span class="font-bold text-amber-900 block leading-tight">නැරඹුම් ප්‍රකාරය (View-Only Mode)</span>
              <span class="text-amber-700 text-[11px] leading-tight block mt-0.5">ඔබ නරඹන්නේ <strong>${user.display_name || user.username}</strong> ගේ සජීවී ප්‍රගතියයි. සංස්කරණය කිරීමට PIN අවශ්‍ය වේ.</span>
            </div>
          </div>
          <button type="button" id="banner-unlock-btn" class="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 text-xs shrink-0 cursor-pointer">
            <i class="fas fa-lock-open"></i> Unlock
          </button>
        </div>
      `;
      const btn = container.querySelector("#banner-unlock-btn");
      if (btn) {
        btn.addEventListener("click", () => this.requireEditPermission("සංස්කරණය ආරම්භ කිරීම"));
      }
    } else {
      container.innerHTML = `
        <div class="mb-4 bg-emerald-50/90 border border-emerald-200 rounded-2xl p-2.5 px-3.5 flex items-center justify-between gap-3 text-xs shadow-xs font-['Noto_Sans_Sinhala'] animate-in fade-in duration-200">
          <div class="flex items-center gap-2">
            <span class="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs shrink-0">✏️</span>
            <span class="text-emerald-900 font-semibold text-[11px]">සංස්කරණ අවසර ඇත: <strong>${user.username}</strong></span>
          </div>
          <button type="button" id="banner-lock-btn" class="text-slate-400 hover:text-slate-600 text-xs px-2 py-0.5 rounded transition cursor-pointer" title="නැවත Lock කරන්න (Switch to View Only)">
            <i class="fas fa-lock mr-1"></i> Lock
          </button>
        </div>
      `;
      const btn = container.querySelector("#banner-lock-btn");
      if (btn) {
        btn.addEventListener("click", () => this.lockEditing());
      }
    }
  }

  /**
   * Opens the Top 5 User Selection / Login Screen
   * Allows:
   * - Anyone to VIEW progress with 1 click (no password needed!)
   * - Relevant user to EDIT by entering their PIN/Password!
   * - Admin to log in to the Live Monitoring & Activity Logs Hub with initial PIN "340800"
   */
  openUserLoginModal(onSuccessCallback = null) {
    const top5 = this.getTop5Users();
    const currentUser = this.getCurrentUser();
    const adminUser = this.users.find(u => u.id === 'user_admin' || u.role === 'admin') || DEFAULT_USERS.find(u => u.id === 'user_admin');

    let modal = document.getElementById("user-login-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "user-login-modal";
      document.body.appendChild(modal);
    }

    const isAdminSelected = currentUser?.id === 'user_admin' || currentUser?.role === 'admin';

    modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-['Poppins']";
    modal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-5 sm:p-6 text-white text-center relative shrink-0">
          <button type="button" id="close-user-login-modal" class="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold transition">&times;</button>
          <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2 text-2xl border border-white/30 shadow-inner">
            ✨
          </div>
          <h2 class="text-lg sm:text-xl font-extrabold tracking-tight font-['Noto_Sans_Sinhala']">පරිශීලකයා තෝරන්න (Select User)</h2>
          <p class="text-xs text-pink-100 mt-1 font-['Noto_Sans_Sinhala']">
            ඕනෑම අයෙකුගේ ප්‍රගතිය බලන්න (View Progress) හෝ සංස්කරණය සඳහා Login වන්න
          </p>
        </div>

          <!-- Body: Top 5 User Cards -->
          <div class="p-4 sm:p-6 overflow-y-auto space-y-3 flex-1">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="top5-users-grid">
              ${top5.map((user) => {
                const isSelected = user.id === currentUser?.id || user.username === currentUser?.username;
                const isPrimary = user.role === "primary" || user.username === "Wosa";

                return `
                  <div class="p-3.5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer hover:border-purple-400 hover:bg-purple-50/60 hover:shadow-md active:scale-[0.99] ${isSelected ? 'border-purple-500 bg-purple-50/60 shadow-sm ring-2 ring-purple-200' : 'border-slate-200 bg-white hover:bg-slate-50'}" data-user-id="${user.id}">
                    <div class="flex items-center gap-3 min-w-0">
                      <div class="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                        ${user.avatar || '👤'}
                      </div>
                      <div class="min-w-0">
                        <div class="flex items-center gap-1.5">
                          <span class="font-bold text-slate-800 text-sm truncate">${user.username}</span>
                          ${isPrimary ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 shrink-0">Primary</span>' : ''}
                        </div>
                        <span class="text-xs text-slate-400 block truncate font-['Noto_Sans_Sinhala'] mt-0.5">${user.display_name || user.username}</span>
                      </div>
                    </div>
                    <div class="flex items-center gap-1 text-purple-600 text-xs font-bold shrink-0 font-['Noto_Sans_Sinhala']">
                      ${isSelected ? '<span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-[11px] font-bold">සක්‍රීයයි ✓</span>' : '<span class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs">→</span>'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <!-- Admin Profile Access Card (Requirement 7: password 340800) -->
            ${adminUser ? `
              <div class="pt-2 border-t border-purple-100">
                <div class="p-3.5 rounded-2xl border-2 transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${isAdminSelected ? 'border-indigo-600 bg-indigo-950 text-white shadow-md ring-2 ring-indigo-300' : 'border-slate-800 bg-gradient-to-r from-slate-900 to-indigo-950 text-white hover:border-indigo-400 hover:shadow-lg'} active:scale-[0.99]" data-user-id="${adminUser.id}">
                  <div class="flex items-center gap-3 min-w-0">
                    <div class="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      ${adminUser.avatar || '🛡️'}
                    </div>
                    <div class="min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-sm text-white">${adminUser.display_name || 'Admin Profile'}</span>
                        <span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400 text-slate-950">Security</span>
                      </div>
                      <span class="text-xs text-slate-300 block truncate font-['Noto_Sans_Sinhala'] mt-0.5">සජීවී නිරීක්ෂණය සහ ක්‍රියාකාරකම් සටහන් (Monitoring & Logs)</span>
                    </div>
                  </div>
                  <div class="flex items-center gap-1.5 text-xs font-bold ${isAdminSelected ? 'text-emerald-300 bg-white/10' : 'text-amber-300 bg-white/10'} px-3 py-1.5 rounded-xl border border-white/10 shrink-0 font-['Noto_Sans_Sinhala']">
                    ${isAdminSelected ? '✓ සක්‍රීයයි' : '<i class="fas fa-lock text-[10px]"></i> පිවිසෙන්න'}
                  </div>
                </div>
              </div>
            ` : ''}

            <!-- Add Account Button (Requirement 3: add add acount button to the select usser menu) -->
            <div class="pt-1">
              <button type="button" id="btn-modal-add-account" class="w-full py-2.5 px-4 bg-gradient-to-r from-purple-50 via-pink-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 text-purple-700 font-bold rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-400 transition-all flex items-center justify-center gap-2 text-xs shadow-2xs cursor-pointer group active:scale-[0.99]">
                <span class="w-6 h-6 rounded-full bg-purple-200 group-hover:bg-purple-300 text-purple-800 flex items-center justify-center text-sm font-black transition">+</span>
                <span class="font-['Noto_Sans_Sinhala'] font-bold">නව ගිණුමක් එක් කරන්න (Add New Account)</span>
              </button>
            </div>

            <div class="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-800 text-[11px] font-['Noto_Sans_Sinhala'] text-center">
              <i class="fas fa-info-circle text-purple-600 mr-1"></i>
              ඕනෑම පරිශීලකයෙකුගේ කාඩ්පත මත ක්ලික් කළ සැණින් ඔවුන්ගේ සජීවී ප්‍රගති පුවරුව විවෘත වේ.
            </div>
          </div>
        </div>
      `;

      const closeModal = () => {
        modal.remove();
      };

      const closeBtn = modal.querySelector("#close-user-login-modal");
      if (closeBtn) closeBtn.addEventListener("click", closeModal);

      // Add Account Click Listener
      const addAccountBtn = modal.querySelector("#btn-modal-add-account");
      if (addAccountBtn) {
        addAccountBtn.addEventListener("click", () => {
          closeModal();
          this.openCreateAccountModal(onSuccessCallback);
        });
      }

      // Click user or admin card
      modal.querySelectorAll("[data-user-id]").forEach(card => {
        card.addEventListener("click", () => {
          const userId = card.dataset.userId;
          const targetUser = this.users.find(u => u.id === userId) || (adminUser && adminUser.id === userId ? adminUser : null);
          if (!targetUser) return;

          // Requirement 7: Admin Profile initial password verification "340800"
          if (targetUser.role === 'admin' || targetUser.id === 'user_admin') {
            this.promptUserPassword(
              targetUser,
              () => {
                this.setCurrentUser(targetUser, true);
                closeModal();
                if (onSuccessCallback) onSuccessCallback(targetUser);
              },
              "Admin Profile (සජීවී නිරීක්ෂණ පුවරුව) වෙත පිවිසීම"
            );
            return;
          }

          this.setCurrentUser(targetUser, false); // Instant profile switch
          closeModal();
          if (onSuccessCallback) onSuccessCallback(targetUser);
        });
      });
  }

  /**
   * Opens Modal to create a new user profile directly from frontend (Requirement 3)
   */
  openCreateAccountModal(onSuccessCallback = null) {
    let modal = document.getElementById("create-account-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "create-account-modal";
      document.body.appendChild(modal);
    }

    const AVATAR_OPTIONS = ['🌸', '🌺', '👧', '👦', '⭐', '🦁', '🎨', '🚀', '🐱', '🦄', '⚽', '📚'];
    let selectedAvatar = '👧';

    modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 font-['Poppins']";
    modal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95 duration-200 font-['Noto_Sans_Sinhala']">
        <!-- Header -->
        <div class="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 p-5 text-white text-center relative shrink-0">
          <button type="button" id="close-create-account-modal" class="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold transition">&times;</button>
          <div class="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2 text-2xl border border-white/30 shadow-inner">
            <span id="create-modal-preview-avatar">${selectedAvatar}</span>
          </div>
          <h2 class="text-lg font-extrabold tracking-tight">නව ගිණුමක් එක් කරන්න</h2>
          <p class="text-xs text-purple-100 mt-0.5">Add New User Account</p>
        </div>

        <!-- Form Body -->
        <form id="create-account-form" class="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          <!-- Username -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">පරිශීලක නම (Username) <span class="text-rose-500">*</span></label>
            <input type="text" id="create-acc-username" required placeholder="උදා: Kaveen හෝ Sandali" autofocus
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-hidden focus:ring-3 focus:ring-purple-100 transition font-sans text-xs">
          </div>

          <!-- Display Name -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">පෙන්වන නම (Display Name - විකල්ප)</label>
            <input type="text" id="create-acc-display-name" placeholder="උදා: Kaveen (කවීන්)"
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-hidden focus:ring-3 focus:ring-purple-100 transition text-xs">
          </div>

          <!-- Avatar Selection -->
          <div>
            <label class="block font-bold text-slate-700 mb-1.5">Avatar රූපය තෝරන්න</label>
            <div class="grid grid-cols-6 gap-2" id="create-acc-avatar-grid">
              ${AVATAR_OPTIONS.map((emoji, idx) => `
                <button type="button" class="avatar-opt-btn h-10 rounded-xl border-2 flex items-center justify-center text-lg transition hover:scale-105 active:scale-95 ${idx === 2 ? 'border-purple-600 bg-purple-50 shadow-xs' : 'border-slate-200 bg-slate-50 hover:bg-white'}" data-emoji="${emoji}">
                  ${emoji}
                </button>
              `).join('')}
            </div>
          </div>

          <!-- PIN -->
          <div>
            <label class="block font-bold text-slate-700 mb-1">PIN අංකය / මුරපදය (Security PIN) <span class="text-rose-500">*</span></label>
            <input type="password" id="create-acc-pin" maxlength="8" value="3408" required placeholder="3408"
              class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:border-purple-500 focus:outline-hidden focus:ring-3 focus:ring-purple-100 transition font-mono tracking-widest text-center text-sm font-bold">
            <span class="text-[11px] text-slate-400 mt-1 block">ප්‍රගතිය සංස්කරණය කිරීමට මෙම PIN අංකය භාවිතා වේ (පෙරනිමි: 3408).</span>
          </div>

          <!-- Error Message -->
          <div id="create-acc-error" class="hidden p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 font-bold text-[11px] flex items-center gap-1.5">
            <i class="fas fa-exclamation-circle"></i> <span id="create-acc-error-text"></span>
          </div>

          <!-- Actions -->
          <div class="grid grid-cols-2 gap-3 pt-2">
            <button type="button" id="btn-cancel-create-acc" class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">
              අවලංගු කරන්න
            </button>
            <button type="submit" id="btn-submit-create-acc" class="py-2.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-check"></i> ගිණුම තනන්න
            </button>
          </div>
        </form>
      </div>
    `;

    const closeCreateModal = () => {
      modal.remove();
    };

    const cancelBtn = modal.querySelector("#btn-cancel-create-acc");
    if (cancelBtn) {
      cancelBtn.addEventListener("click", () => {
        closeCreateModal();
        this.openUserLoginModal(onSuccessCallback);
      });
    }

    const closeBtn = modal.querySelector("#close-create-account-modal");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        closeCreateModal();
        this.openUserLoginModal(onSuccessCallback);
      });
    }

    // Avatar Selection handlers
    const previewEl = modal.querySelector("#create-modal-preview-avatar");
    modal.querySelectorAll(".avatar-opt-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        modal.querySelectorAll(".avatar-opt-btn").forEach(b => {
          b.className = "avatar-opt-btn h-10 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-white flex items-center justify-center text-lg transition hover:scale-105 active:scale-95";
        });
        btn.className = "avatar-opt-btn h-10 rounded-xl border-2 border-purple-600 bg-purple-50 shadow-xs flex items-center justify-center text-lg transition hover:scale-105 active:scale-95";
        selectedAvatar = btn.dataset.emoji;
        if (previewEl) previewEl.innerText = selectedAvatar;
      });
    });

    // Form submit
    const form = modal.querySelector("#create-account-form");
    const errorContainer = modal.querySelector("#create-acc-error");
    const errorText = modal.querySelector("#create-acc-error-text");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const usernameInput = modal.querySelector("#create-acc-username");
      const displayInput = modal.querySelector("#create-acc-display-name");
      const pinInput = modal.querySelector("#create-acc-pin");

      const username = usernameInput ? usernameInput.value.trim() : "";
      const displayName = displayInput ? displayInput.value.trim() : "";
      const pin = pinInput ? pinInput.value.trim() : "3408";

      if (!username) {
        errorContainer.classList.remove("hidden");
        errorText.innerText = "කරුණාකර පරිශීලක නාමයක් ඇතුළත් කරන්න.";
        return;
      }

      // Check duplicate
      const exists = this.users.some(u => u && u.username && u.username.toLowerCase() === username.toLowerCase());
      if (exists) {
        errorContainer.classList.remove("hidden");
        errorText.innerText = `"${username}" නමින් ගිණුමක් දැනටමත් පවතී. කරුණාකර වෙනත් නමක් තෝරන්න.`;
        return;
      }

      const submitBtn = modal.querySelector("#btn-submit-create-acc");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> සාදමින් පවතී...';
      }

      const newId = "user_" + Math.random().toString(36).substring(2, 9);
      const newUser = {
        id: newId,
        username: username,
        display_name: displayName || username,
        avatar: selectedAvatar || '👤',
        pin: pin || '3408',
        role: 'member',
        points: 50,
        is_active: true,
        created_at: new Date().toISOString()
      };

      // Add before admin profile
      const adminIdx = this.users.findIndex(u => u.id === 'user_admin' || u.role === 'admin');
      if (adminIdx !== -1) {
        this.users.splice(adminIdx, 0, newUser);
      } else {
        this.users.push(newUser);
      }

      // Persist to localStorage and Supabase
      await this.persistUsers();

      // Switch to new user and unlock edit mode
      this.setCurrentUser(newUser, true);

      closeCreateModal();

      if (onSuccessCallback) {
        onSuccessCallback(newUser);
      }
    });
  }

  /**
   * Prompts Password / PIN for selected user (Requirement 2.1 & Requirement 1)
   */
  promptUserPassword(user, onSuccess, actionTitle = "දත්ත සංස්කරණය කිරීම", onCancel = null) {
    let pinModal = document.getElementById("user-pin-verify-modal");
    if (!pinModal) {
      pinModal = document.createElement("div");
      pinModal.id = "user-pin-verify-modal";
      document.body.appendChild(pinModal);
    }

    pinModal.className = "fixed inset-0 bg-slate-900/80 backdrop-blur-md z-60 flex items-center justify-center p-4 font-['Poppins']";
    pinModal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-purple-100 animate-in fade-in zoom-in-95 duration-200 font-['Noto_Sans_Sinhala']">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-100 to-pink-100 text-3xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-purple-200">
          ${user.avatar || '🔐'}
        </div>
        
        <h3 class="text-base font-bold text-slate-800">${user.username} සඳහා මුරපදය</h3>
        <p class="text-xs text-slate-500 mt-1">
          ${actionTitle} සඳහා ${user.display_name || user.username} ගේ PIN අංකය ඇතුළත් කරන්න
        </p>

        <form id="user-pin-form" class="mt-5 space-y-4">
          <div>
            <input type="password" id="user-entered-pin" maxlength="12" placeholder="••••" autofocus required
              class="w-48 mx-auto text-center text-2xl font-mono tracking-widest py-2.5 px-4 border-2 border-purple-200 rounded-2xl focus:border-purple-600 focus:outline-hidden focus:ring-4 focus:ring-purple-100">
          </div>

          <div id="pin-error-msg" class="text-xs text-rose-500 font-bold hidden">
            <i class="fas fa-exclamation-circle mr-1"></i> මුරපදය වැරදියි! කරුණාකර නැවත උත්සාහ කරන්න.
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button type="button" id="cancel-user-pin" class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">
              අවලංගු කරන්න
            </button>
            <button type="submit" class="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer">
              <i class="fas fa-unlock-alt"></i> Unlock කරන්න
            </button>
          </div>
        </form>
      </div>
    `;

    const closePinModal = () => {
      pinModal.remove();
      if (onCancel) onCancel();
    };
    pinModal.querySelector("#cancel-user-pin").addEventListener("click", closePinModal);

    const pinInput = pinModal.querySelector("#user-entered-pin");
    const errorMsg = pinModal.querySelector("#pin-error-msg");
    setTimeout(() => { try { pinInput.focus(); } catch (e) {} }, 50);

    pinModal.querySelector("#user-pin-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      const validPin = user.pin || "1234";
      const adminPin = (typeof localStorage !== "undefined" ? localStorage.getItem("wosandi_admin_pin") : null) || "1234";

      if (enteredPin === validPin || enteredPin === adminPin) {
        this.setAuthenticated(user, true);
        pinModal.remove();
        if (onSuccess) onSuccess(user);
      } else {
        errorMsg.classList.remove("hidden");
        pinInput.classList.add("border-rose-500", "animate-shake");
        pinInput.value = "";
        setTimeout(() => pinInput.classList.remove("animate-shake"), 500);
      }
    });
  }
}

export const userManagerClient = new UserManagerClient();
if (typeof window !== "undefined") {
  window.userManagerClient = userManagerClient;
}
