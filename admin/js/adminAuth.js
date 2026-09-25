export class AdminAuth {
    constructor() {
        this.sessionKey = 'wosandi_admin_session';
        // Simple fallback PIN, in a real app this should be verified server-side
        this.defaultPin = '1234';
    }

    verifyPin(pin) {
        const storedPin = localStorage.getItem('wosandi_admin_pin') || this.defaultPin;
        return pin === storedPin;
    }

    isAuthenticated() {
        return sessionStorage.getItem(this.sessionKey) === 'true';
    }

    login(pin) {
        if (this.verifyPin(pin)) {
            sessionStorage.setItem(this.sessionKey, 'true');
            return true;
        }
        return false;
    }

    logout() {
        sessionStorage.removeItem(this.sessionKey);
    }

    renderLoginScreen(containerEl, onSuccess) {
        containerEl.innerHTML = `
            <div class="mb-6">
                <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                    <i class="fas fa-lock"></i>
                </div>
                <h2 class="text-2xl font-bold text-slate-800">Admin Access</h2>
                <p class="text-sm text-slate-500 mt-2">Enter your PIN to continue</p>
            </div>
            
            <form id="login-form" class="space-y-4">
                <div>
                    <input type="password" id="pin-input" 
                        class="w-full text-center text-2xl tracking-[0.5em] py-3 px-4 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" 
                        placeholder="••••" 
                        maxlength="4" 
                        autocomplete="off" 
                        required>
                </div>
                <div id="login-error" class="text-red-500 text-sm hidden">Invalid PIN. Please try again.</div>
                <button type="submit" 
                    class="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                    Unlock
                </button>
            </form>
        `;

        const form = containerEl.querySelector('#login-form');
        const pinInput = containerEl.querySelector('#pin-input');
        const errorEl = containerEl.querySelector('#login-error');

        // Focus input after render
        setTimeout(() => pinInput.focus(), 100);

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const pin = pinInput.value;
            
            if (this.login(pin)) {
                errorEl.classList.add('hidden');
                onSuccess();
            } else {
                errorEl.classList.remove('hidden');
                pinInput.value = '';
                pinInput.focus();
                
                // Shake effect
                containerEl.classList.add('animate-shake');
                setTimeout(() => containerEl.classList.remove('animate-shake'), 500);
            }
        });
    }
}
