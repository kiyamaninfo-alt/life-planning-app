/**
 * userManagerClient.js - Frontend Client for Multi-User Management & Top 5 Login
 * 
 * Requirements handled:
 * 1. Top 5 users based on points displayed on the login / user selection page.
 * 2. When a user box is clicked, asks for that user's PIN/Password.
 * 3. Opens a separate, isolated dashboard for each user.
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

    return this.users;
  }

  getTop5Users() {
    const active = this.users.filter(u => u.is_active !== false);
    active.sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0));
    return active.slice(0, 5);
  }

  getCurrentUser() {
    if (this.currentUser) return this.currentUser;

    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem("wosandi_current_user");
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          if (parsed && parsed.id) {
            // Find latest data from users list
            const found = this.users.find(u => u.id === parsed.id || u.username === parsed.username);
            this.currentUser = found || parsed;
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

  setCurrentUser(user) {
    this.currentUser = user;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("wosandi_current_user", JSON.stringify(user));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("wosandi-user-changed", { detail: user }));
    }
    this.updateUserHeaderPill();
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

    if (avatarEl) avatarEl.innerText = user.avatar || "🌸";
    if (nameEl) nameEl.innerText = user.username || "Wosa";
    if (pointsEl) pointsEl.innerText = `${user.points || 0} pts`;
  }

  /**
   * Opens the Top 5 User Selection / Login Screen
   */
  openUserLoginModal(onSuccessCallback = null) {
    const top5 = this.getTop5Users();
    const currentUser = this.getCurrentUser();

    // Create or locate modal container
    let modal = document.getElementById("user-login-modal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "user-login-modal";
      document.body.appendChild(modal);
    }

    modal.className = "fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-['Poppins']";
    modal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
        <!-- Header -->
        <div class="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-6 text-white text-center relative">
          <button type="button" id="close-user-login-modal" class="absolute top-4 right-4 text-white/80 hover:text-white text-2xl font-bold transition">&times;</button>
          <div class="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center mx-auto mb-2 text-2xl border border-white/30 shadow-inner">
            ✨
          </div>
          <h2 class="text-xl font-extrabold tracking-tight font-['Noto_Sans_Sinhala']">පරිශීලකයා තෝරන්න (Select User)</h2>
          <p class="text-xs text-pink-100 mt-1 font-['Noto_Sans_Sinhala']">
            ඉහළම ලකුණු ලබා ඇති පරිශීලකයන් 5 දෙනා (Top 5 Profiles)
          </p>
        </div>

        <!-- Body: Top 5 User Cards -->
        <div class="p-6 space-y-4">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3" id="top5-users-grid">
            ${top5.map((user, idx) => {
              const isSelected = user.id === currentUser?.id || user.username === currentUser?.username;
              const rankMedal = idx === 0 ? '🥇 1st' : idx === 1 ? '🥈 2nd' : idx === 2 ? '🥉 3rd' : `#${idx + 1}`;
              const isPrimary = user.role === "primary" || user.username === "Wosa";

              return `
                <div class="user-select-card cursor-pointer group p-3.5 rounded-2xl border-2 transition-all duration-200 ${isSelected ? 'border-purple-500 bg-purple-50/50 shadow-md ring-2 ring-purple-200' : 'border-slate-200 hover:border-purple-300 hover:bg-slate-50'}" data-user-id="${user.id}">
                  <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-white shadow-xs border border-slate-100 flex items-center justify-center text-2xl group-hover:scale-105 transition transform">
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
                </div>
              `;
            }).join('')}
          </div>

          <p class="text-[11px] text-center text-slate-400 font-['Noto_Sans_Sinhala'] pt-2">
            <i class="fas fa-lock text-purple-400 mr-1"></i> පරිශීලක ගිණුම මත ක්ලික් කර ඔබගේ මුරපදය (PIN) ඇතුළත් කරන්න.
          </p>
        </div>
      </div>
    `;

    const closeModal = () => {
      modal.remove();
    };

    const closeBtn = modal.querySelector("#close-user-login-modal");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Card click: Ask for password (Requirement 2.1)
    modal.querySelectorAll(".user-select-card").forEach(card => {
      card.addEventListener("click", () => {
        const userId = card.dataset.userId;
        const targetUser = this.users.find(u => u.id === userId);
        if (!targetUser) return;
        this.promptUserPassword(targetUser, () => {
          closeModal();
          if (onSuccessCallback) onSuccessCallback(targetUser);
        });
      });
    });
  }

  /**
   * Prompts Password / PIN for selected user (Requirement 2.1)
   */
  promptUserPassword(user, onSuccess) {
    let pinModal = document.getElementById("user-pin-verify-modal");
    if (!pinModal) {
      pinModal = document.createElement("div");
      pinModal.id = "user-pin-verify-modal";
      document.body.appendChild(pinModal);
    }

    pinModal.className = "fixed inset-0 bg-slate-900/80 backdrop-blur-md z-60 flex items-center justify-center p-4 font-['Poppins']";
    pinModal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 text-center border border-purple-100 animate-in fade-in zoom-in-95 duration-200">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-purple-100 to-pink-100 text-3xl flex items-center justify-center mx-auto mb-3 shadow-inner border border-purple-200">
          ${user.avatar || '🔐'}
        </div>
        
        <h3 class="text-base font-bold text-slate-800">${user.username} සඳහා මුරපදය</h3>
        <p class="text-xs text-slate-400 font-['Noto_Sans_Sinhala'] mt-0.5">
          ${user.display_name} වෙත පිවිසීමට PIN අංකය ඇතුළත් කරන්න
        </p>

        <form id="user-pin-form" class="mt-5 space-y-4">
          <div>
            <input type="password" id="user-entered-pin" maxlength="12" placeholder="••••" autofocus required
              class="w-48 mx-auto text-center text-2xl font-mono tracking-widest py-2.5 px-4 border-2 border-purple-200 rounded-2xl focus:border-purple-600 focus:outline-hidden focus:ring-4 focus:ring-purple-100">
          </div>

          <div id="pin-error-msg" class="text-xs text-rose-500 font-bold hidden font-['Noto_Sans_Sinhala']">
            <i class="fas fa-exclamation-circle mr-1"></i> මුරපදය වැරදියි! නැවත උත්සාහ කරන්න.
          </div>

          <div class="grid grid-cols-2 gap-3 pt-2">
            <button type="button" id="cancel-user-pin" class="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition">
              අවලංගු කරන්න
            </button>
            <button type="submit" class="py-2.5 px-4 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center justify-center gap-1.5">
              <i class="fas fa-unlock-alt"></i> ඇතුළු වන්න (Login)
            </button>
          </div>
        </form>
      </div>
    `;

    const closePinModal = () => { pinModal.remove(); };
    pinModal.querySelector("#cancel-user-pin").addEventListener("click", closePinModal);

    const pinInput = pinModal.querySelector("#user-entered-pin");
    const errorMsg = pinModal.querySelector("#pin-error-msg");
    setTimeout(() => { try { pinInput.focus(); } catch (e) {} }, 50);

    pinModal.querySelector("#user-pin-form").addEventListener("submit", (e) => {
      e.preventDefault();
      const enteredPin = pinInput.value.trim();
      const validPin = user.pin || "1234";

      if (enteredPin === validPin) {
        // PIN verified! Switch user and open dashboard
        this.setCurrentUser(user);
        closePinModal();
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
