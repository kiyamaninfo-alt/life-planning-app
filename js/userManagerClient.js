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

    if (!this.users || this.users.length === 0) {
      this.users = [...DEFAULT_USERS];
    }

    // Ensure Wosa is present
    if (!this.users.some(u => u.username === "Wosa" || u.id === "user_wosa")) {
      this.users.unshift(DEFAULT_USERS[0]);
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

  getTop5Users() {
    const active = this.users.filter(u => u.is_active !== false);
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
    if (pointsEl) pointsEl.innerText = `${user.points || 0} pts`;
    if (lockEl) {
      lockEl.className = isEditor ? "fa-solid fa-lock-open text-[10px] text-emerald-500" : "fa-solid fa-eye text-[10px] text-amber-500";
      lockEl.title = isEditor ? "සංස්කරණ අවසර ඇත (Editing rights active)" : "නැරඹුම් ප්‍රකාරය (View-Only Mode)";
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
   */
  openUserLoginModal(onSuccessCallback = null) {
    const top5 = this.getTop5Users();
    const currentUser = this.getCurrentUser();

    let modal = document.getElementById("user-login-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "user-login-modal";
      document.body.appendChild(modal);
    }

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
            ${top5.map((user, idx) => {
              const isSelected = user.id === currentUser?.id || user.username === currentUser?.username;
              const rankMedal = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`;
              const isPrimary = user.role === "primary" || user.username === "Wosa";

              return `
                <div class="p-3.5 rounded-2xl border-2 transition-all duration-200 flex flex-col justify-between gap-3 ${isSelected ? 'border-purple-500 bg-purple-50/50 shadow-md ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}" data-user-id="${user.id}">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-2xl shrink-0">
                      ${user.avatar || '👤'}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-1.5">
                        <span class="font-bold text-slate-800 text-sm truncate">${user.username}</span>
                        ${isPrimary ? '<span class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600">Primary</span>' : ''}
                      </div>
                      <span class="text-[11px] text-slate-400 block truncate font-['Noto_Sans_Sinhala']">${user.display_name || user.username}</span>
                      <div class="flex items-center justify-between mt-1">
                        <span class="text-[11px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md">
                          🏆 ${user.points || 0} pts
                        </span>
                        <span class="text-[10px] font-semibold text-slate-400">${rankMedal}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Action Buttons: View Progress vs Edit/Unlock -->
                  <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 font-['Noto_Sans_Sinhala']">
                    <button type="button" class="view-user-progress-btn py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-xl transition flex items-center justify-center gap-1" data-user-id="${user.id}">
                      <i class="fas fa-eye text-slate-500"></i> ප්‍රගතිය බලන්න
                    </button>
                    <button type="button" class="login-edit-user-btn py-1.5 px-2 bg-purple-600 hover:bg-purple-700 text-white text-[11px] font-bold rounded-xl transition shadow-xs flex items-center justify-center gap-1" data-user-id="${user.id}">
                      <i class="fas fa-lock"></i> Edit කරන්න
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>

          <div class="p-3 bg-purple-50 rounded-xl border border-purple-200 text-purple-800 text-[11px] font-['Noto_Sans_Sinhala'] text-center">
            <i class="fas fa-info-circle text-purple-600 mr-1"></i>
            ඕනෑම අයෙකුට සියලු පරිශීලකයන්ගේ ප්‍රගතිය (Progress) නැරඹිය හැකි අතර, දත්ත සංස්කරණය කළ හැක්කේ අදාළ පරිශීලකයාගේ මුරපදය (PIN) ඇතුළත් කළ පසු පමණි.
          </div>
        </div>
      </div>
    `;

    const closeModal = () => {
      modal.remove();
    };

    const closeBtn = modal.querySelector("#close-user-login-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // 1. "ප්‍රගතිය බලන්න (View Progress)" - Anyone can see progress without password!
    modal.querySelectorAll(".view-user-progress-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const userId = btn.dataset.userId;
        const targetUser = this.users.find(u => u.id === userId);
        if (!targetUser) return;
        this.setCurrentUser(targetUser, false); // View-only
        closeModal();
        if (onSuccessCallback) onSuccessCallback(targetUser);
      });
    });

    // 2. "Edit කරන්න" - Asks password to unlock editing rights for relevant user!
    modal.querySelectorAll(".login-edit-user-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const userId = btn.dataset.userId;
        const targetUser = this.users.find(u => u.id === userId);
        if (!targetUser) return;
        this.promptUserPassword(
          targetUser,
          () => {
            this.setCurrentUser(targetUser, true); // Authenticated editor
            closeModal();
            if (onSuccessCallback) onSuccessCallback(targetUser);
          },
          "දත්ත සංස්කරණය කිරීම සඳහා Login වීම"
        );
      });
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
