export class DynamicRenderer {
  constructor(containerEl) {
    this.containerEl = containerEl;
    this.SUPABASE_URL = 'https://rxwopsfjnlzlzzazgnvq.supabase.co';
    this.ANON_KEY = 'sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn';
    this.widgets = [];
  }

  async loadAndRender() {
    try {
      let data = [];
      try {
        const response = await fetch(`${this.SUPABASE_URL}/rest/v1/wosandi_ui_schema?status=eq.published&order=sort_order.asc`, {
          headers: {
            'apikey': this.ANON_KEY,
            'Authorization': `Bearer ${this.ANON_KEY}`
          }
        });
        if (response.ok) {
          data = await response.json();
        }
      } catch (netErr) {
        console.warn('Supabase fetch failed, checking local storage:', netErr.message);
      }

      // If Supabase returned empty or failed, fallback to local storage
      if (!data || data.length === 0) {
        const stored = localStorage.getItem('wosandi_admin_wosandi_ui_schema');
        if (stored) {
          try {
            const allWidgets = JSON.parse(stored);
            data = allWidgets.filter(w => w.status === 'published');
          } catch (e) {}
        }
      }

      this.widgets = data || [];
      
      if (!this.containerEl || this.widgets.length === 0) {
        if (this.containerEl) this.containerEl.innerHTML = '';
        return;
      }

      // Group by section
      const sections = {};
      this.widgets.forEach(w => {
        const sec = w.section || 'General';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(w);
      });

      let html = '';
      for (const [sec, wList] of Object.entries(sections)) {
        html += `
          <div class="mb-6 wosandi-section">
            <h3 class="text-sm font-bold text-slate-700 mb-3 border-b border-pink-100 pb-1.5 flex items-center gap-2">
              <i class="fa-solid fa-shapes text-pink-500 text-xs"></i> ${sec}
            </h3>
            <div class="space-y-3">
              ${wList.map(w => this.renderWidget(w)).join('')}
            </div>
          </div>
        `;
      }
      
      this.containerEl.innerHTML = html;

      // Attach event listeners for widgets
      this.attachListeners();
      
    } catch (e) {
      console.error('Error loading dynamic UI:', e);
      if (this.containerEl) {
        this.containerEl.innerHTML = '';
      }
    }
  }

  renderWidget(config) {
    const dc = config.schema_definition || config.dynamic_config || {};
    const label = config.label_si || config.label_en || 'Label';
    const type = config.widget_type;
    const id = config.id;
    const linkedKey = dc.linked_state_key || `widget_${id}`;

    let inputHtml = '';

    if (type === 'switch') {
      const isChecked = dc.default_value ? 'checked' : '';
      inputHtml = `
        <div class="flex items-center justify-between w-full">
          <span class="text-sm font-medium text-gray-700">${label}</span>
          <div class="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
            <input type="checkbox" id="widget-${id}" data-key="${linkedKey}" class="wosandi-widget-input toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer" ${isChecked}/>
            <label for="widget-${id}" class="toggle-label block overflow-hidden h-6 rounded-full bg-gray-300 cursor-pointer"></label>
          </div>
        </div>
      `;
    } else if (type === 'checkbox') {
      const isChecked = dc.default_checked ? 'checked' : '';
      const badge = dc.point_value ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">+${dc.point_value} pts</span>` : '';
      inputHtml = `
        <div class="flex items-start">
          <div class="flex items-center h-5">
            <input type="checkbox" id="widget-${id}" data-key="${linkedKey}" class="wosandi-widget-input focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded" ${isChecked}>
          </div>
          <div class="ml-3 text-sm">
            <label for="widget-${id}" class="font-medium text-gray-700">${label} ${badge}</label>
          </div>
        </div>
      `;
    } else if (type === 'text_input') {
      inputHtml = `
        <div>
          <label for="widget-${id}" class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <input type="text" id="widget-${id}" data-key="${linkedKey}" placeholder="${dc.placeholder || ''}" class="wosandi-widget-input shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
        </div>
      `;
    } else if (type === 'number_input') {
      inputHtml = `
        <div>
          <label for="widget-${id}" class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <input type="number" id="widget-${id}" data-key="${linkedKey}" value="${dc.default_value||0}" min="${dc.min||0}" max="${dc.max||100}" step="${dc.step||1}" class="wosandi-widget-input shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border">
        </div>
      `;
    } else if (type === 'dropdown') {
      const opts = Array.isArray(dc.options) ? dc.options : [];
      inputHtml = `
        <div>
          <label for="widget-${id}" class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <select id="widget-${id}" data-key="${linkedKey}" class="wosandi-widget-input mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md border">
            ${opts.map(o => {
              const val = typeof o === 'string' ? o : o.value || o.label;
              const text = typeof o === 'string' ? o : o.label;
              const sel = dc.default_selected === val ? 'selected' : '';
              return `<option value="${val}" ${sel}>${text}</option>`;
            }).join('')}
          </select>
        </div>
      `;
    } else if (type === 'radio_group') {
      const opts = Array.isArray(dc.options) ? dc.options : [];
      inputHtml = `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">${label}</label>
          <div class="space-y-2">
            ${opts.map((o, i) => {
              const val = typeof o === 'string' ? o : o.value || o.label;
              const text = typeof o === 'string' ? o : o.label;
              const sel = (dc.default_selected === val || (!dc.default_selected && i === 0)) ? 'checked' : '';
              return `
              <div class="flex items-center">
                <input type="radio" id="widget-${id}-${i}" name="widget-${id}" value="${val}" data-key="${linkedKey}" class="wosandi-widget-input focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" ${sel}>
                <label for="widget-${id}-${i}" class="ml-3 block text-sm font-medium text-gray-700">${text}</label>
              </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (type === 'action_button') {
      let btnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
      if (dc.button_style === 'secondary') btnClass = 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      if (dc.button_style === 'danger') btnClass = 'bg-red-600 hover:bg-red-700 text-white';
      
      inputHtml = `
        <button id="widget-${id}" data-action="${dc.action_type}" data-target="${dc.action_target}" class="wosandi-widget-btn w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${btnClass}">
          ${label}
        </button>
      `;
    }

    return `<div class="bg-white p-4 rounded-lg shadow-sm border border-gray-100" data-widget-id="${id}">${inputHtml}</div>`;
  }

  attachListeners() {
    // Inputs change event
    const inputs = this.containerEl.querySelectorAll('.wosandi-widget-input');
    inputs.forEach(input => {
      input.addEventListener('change', (e) => {
        const key = e.target.dataset.key;
        let value = e.target.value;
        
        if (e.target.type === 'checkbox') {
          value = e.target.checked;
        } else if (e.target.type === 'number') {
          value = Number(value);
        }

        // Dispatch custom event
        const event = new CustomEvent('wosandi:widgetChanged', {
          detail: { key, value, elementId: e.target.id }
        });
        document.dispatchEvent(event);
      });
    });

    // Buttons click event
    const btns = this.containerEl.querySelectorAll('.wosandi-widget-btn');
    btns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = e.currentTarget.dataset.action;
        const target = e.currentTarget.dataset.target;
        
        if (action === 'link' && target) {
          window.location.href = target;
        } else {
          const event = new CustomEvent('wosandi:widgetAction', {
            detail: { action, target, elementId: e.currentTarget.id }
          });
          document.dispatchEvent(event);
        }
      });
    });
  }

  getWidgetValue(widgetId) {
    const el = document.getElementById(`widget-${widgetId}`);
    if (!el) {
      // Could be a radio group
      const checkedRadio = document.querySelector(`input[name="widget-${widgetId}"]:checked`);
      if (checkedRadio) return checkedRadio.value;
      return null;
    }
    
    if (el.type === 'checkbox') return el.checked;
    if (el.type === 'number') return Number(el.value);
    return el.value;
  }

  getAllValues() {
    const values = {};
    const inputs = this.containerEl.querySelectorAll('.wosandi-widget-input');
    inputs.forEach(el => {
      const key = el.dataset.key;
      if (!key) return;
      
      if (el.type === 'radio') {
        if (el.checked) values[key] = el.value;
      } else if (el.type === 'checkbox') {
        values[key] = el.checked;
      } else if (el.type === 'number') {
        values[key] = Number(el.value);
      } else {
        values[key] = el.value;
      }
    });
    return values;
  }
}
