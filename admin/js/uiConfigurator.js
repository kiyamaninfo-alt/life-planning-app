export class UiConfigurator {
  constructor(containerEl, api, toastFn) {
    this.containerEl = containerEl;
    this.api = api;
    this.toast = toastFn;
    this.tableName = 'wosandi_ui_schema';
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-800">UI Component Manager</h2>
        <button id="ui-add-widget" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow">
          <i class="fas fa-plus mr-2"></i> Add Widget
        </button>
      </div>
      <div id="ui-widgets-list" class="space-y-6">
        <div class="text-center text-gray-500 py-10 w-full">Loading widgets...</div>
      </div>
      <!-- Modal Container -->
      <div id="ui-modal-container" class="fixed inset-0 bg-black bg-opacity-50 hidden z-50 flex justify-center items-center"></div>
    `;

    document.getElementById('ui-add-widget').addEventListener('click', () => this.openAddModal());
    this.loadWidgets();
  }

  async loadWidgets() {
    try {
      const { data, error } = await this.api.select(this.tableName, {}, 'sort_order', true);
      const listContainer = document.getElementById('ui-widgets-list');
      
      if (!data || data.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 py-10 w-full bg-white rounded shadow">No widgets configured yet.</div>';
        return;
      }

      // Group by section
      const sections = {};
      data.forEach(widget => {
        const sec = widget.section || 'General';
        if (!sections[sec]) sections[sec] = [];
        sections[sec].push(widget);
      });

      let html = '';
      for (const [sec, widgets] of Object.entries(sections)) {
        html += `
          <div class="bg-white rounded-lg shadow-sm overflow-hidden mb-6">
            <div class="bg-gray-100 px-4 py-2 border-b font-semibold text-gray-700 flex justify-between items-center">
              <span><i class="fas fa-layer-group mr-2 text-gray-500"></i> ${sec}</span>
              <span class="text-xs font-normal text-gray-500">${widgets.length} items</span>
            </div>
            <ul class="divide-y divide-gray-100">
              ${widgets.map(w => {
                let icon = 'cube';
                if (w.widget_type === 'switch' || w.widget_type === 'checkbox') icon = 'toggle-on';
                if (w.widget_type === 'dropdown' || w.widget_type === 'radio_group') icon = 'list-ul';
                if (w.widget_type === 'action_button') icon = 'hand-pointer';
                if (w.widget_type === 'text_input') icon = 'font';
                if (w.widget_type === 'number_input') icon = 'hashtag';
                
                return `
                <li class="p-4 hover:bg-gray-50 flex items-center justify-between transition-colors">
                  <div class="flex items-center space-x-4 w-1/3">
                    <div class="bg-blue-100 text-blue-600 p-2 rounded w-10 h-10 flex items-center justify-center">
                      <i class="fas fa-${icon}"></i>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-gray-800">${w.label_en || w.widget_type}</p>
                      <p class="text-xs text-gray-500 font-mono">${w.widget_type}</p>
                    </div>
                  </div>
                  
                  <div class="w-1/3 flex flex-col justify-center items-center">
                     ${w.dynamic_config?.linked_state_key ? `<span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono truncate max-w-full"><i class="fas fa-link"></i> ${w.dynamic_config.linked_state_key}</span>` : ''}
                  </div>

                  <div class="w-1/3 flex items-center justify-end space-x-4">
                    <span class="text-xs font-semibold px-2 py-1 rounded ${w.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}">
                      ${w.status === 'published' ? 'Published' : 'Draft'}
                    </span>
                    <button class="ui-edit-btn text-gray-400 hover:text-blue-600 transition" data-id="${w.id}" title="Edit"><i class="fas fa-edit"></i></button>
                    <button class="ui-delete-btn text-gray-400 hover:text-red-600 transition" data-id="${w.id}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                  </div>
                </li>
              `}).join('')}
            </ul>
          </div>
        `;
      }
      
      listContainer.innerHTML = html;

      document.querySelectorAll('.ui-edit-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.openEditModal(e.currentTarget.dataset.id));
      });
      document.querySelectorAll('.ui-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.deleteWidget(e.currentTarget.dataset.id));
      });

    } catch (e) {
      this.toast('Failed to load UI components', 'error');
    }
  }

  async openAddModal() {
    this.showModalForm({
      widget_type: 'switch',
      label_en: '',
      label_si: '',
      section: 'General',
      sort_order: 0,
      status: 'draft',
      dynamic_config: {}
    });
  }

  async openEditModal(widgetId) {
    try {
      const { data } = await this.api.selectById(this.tableName, widgetId);
      if (data) {
        this.showModalForm(data);
      }
    } catch (e) {
      this.toast('Error loading widget data', 'error');
    }
  }

  showModalForm(widget) {
    const modal = document.getElementById('ui-modal-container');
    
    // Helper to extract config defaults safely
    const dc = widget.schema_definition || widget.dynamic_config || {};

    const modalContent = `
      <div class="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div class="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
          <h3 class="text-lg font-bold text-gray-800">${widget.id ? 'Edit Widget' : 'Add New Widget'}</h3>
          <button id="ui-modal-close" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
        </div>
        
        <div class="flex flex-1 overflow-hidden">
          <!-- Form Section -->
          <div class="w-2/3 p-6 overflow-y-auto border-r border-gray-200">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Widget Type</label>
                <select id="mw-type" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                  ${['switch', 'checkbox', 'dropdown', 'action_button', 'number_input', 'text_input', 'radio_group'].map(t => 
                    `<option value="${t}" ${widget.widget_type === t ? 'selected' : ''}>${t.replace('_', ' ').toUpperCase()}</option>`
                  ).join('')}
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select id="mw-status" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500">
                  <option value="draft" ${widget.status === 'draft' ? 'selected' : ''}>Draft</option>
                  <option value="published" ${widget.status === 'published' ? 'selected' : ''}>Published</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Label (English)</label>
                <input type="text" id="mw-label-en" value="${widget.label_en || ''}" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Label (Sinhala)</label>
                <input type="text" id="mw-label-si" value="${widget.label_si || ''}" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Section (Grouping)</label>
                <input type="text" id="mw-section" value="${widget.section || ''}" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">Sort Order</label>
                <input type="number" id="mw-sort" value="${widget.sort_order || 0}" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500" />
              </div>
            </div>

            <h4 class="font-bold text-gray-800 border-b pb-2 mb-4">Dynamic Configuration</h4>
            <div id="mw-dynamic-fields" class="space-y-4">
              <!-- Dynamic fields injected here -->
            </div>

          </div>

          <!-- Preview Section -->
          <div class="w-1/3 bg-gray-50 p-6 flex flex-col">
            <h4 class="font-bold text-gray-700 mb-4 text-center">Live Preview</h4>
            <div class="flex-1 border-2 border-dashed border-gray-300 rounded-lg p-6 flex items-center justify-center bg-white" id="mw-preview-container">
              <!-- Preview injected here -->
            </div>
          </div>
        </div>
        
        <div class="px-6 py-4 border-t bg-gray-50 flex justify-end space-x-3">
          <button id="ui-modal-cancel" class="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-100">Cancel</button>
          <button id="ui-modal-save" class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium shadow-sm">Save Widget</button>
        </div>
      </div>
    `;

    modal.innerHTML = modalContent;
    modal.classList.remove('hidden');

    const closeFn = () => { modal.classList.add('hidden'); modal.innerHTML = ''; };
    document.getElementById('ui-modal-close').addEventListener('click', closeFn);
    document.getElementById('ui-modal-cancel').addEventListener('click', closeFn);

    const typeSelect = document.getElementById('mw-type');
    
    // Function to render dynamic config fields based on type
    const renderDynamicFields = (type) => {
      const container = document.getElementById('mw-dynamic-fields');
      let html = `
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Linked State Key (Variable Name)</label>
          <input type="text" id="dc-linked-key" value="${dc.linked_state_key || ''}" placeholder="e.g., enable_notifications" class="w-full border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 font-mono text-sm" />
        </div>
      `;

      if (type === 'switch') {
        html += `
          <div class="flex items-center mt-2 mb-4">
            <input type="checkbox" id="dc-default-bool" ${dc.default_value ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mr-2" />
            <label class="text-sm text-gray-700">Default to ON</label>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div><label class="block text-xs text-gray-500">On Label</label><input type="text" id="dc-on-label" value="${dc.on_label || 'On'}" class="w-full border-gray-300 rounded text-sm"/></div>
            <div><label class="block text-xs text-gray-500">Off Label</label><input type="text" id="dc-off-label" value="${dc.off_label || 'Off'}" class="w-full border-gray-300 rounded text-sm"/></div>
          </div>
        `;
      } else if (type === 'checkbox') {
        html += `
          <div class="flex items-center mt-2 space-x-6 mb-4">
            <div class="flex items-center">
              <input type="checkbox" id="dc-default-bool" ${dc.default_checked ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mr-2" />
              <label class="text-sm text-gray-700">Default Checked</label>
            </div>
            <div class="flex items-center">
              <input type="checkbox" id="dc-required" ${dc.required ? 'checked' : ''} class="rounded text-blue-600 focus:ring-blue-500 h-4 w-4 mr-2" />
              <label class="text-sm text-gray-700">Required</label>
            </div>
          </div>
          <div><label class="block text-xs text-gray-500">Point Value (Optional)</label><input type="number" id="dc-points" value="${dc.point_value || 0}" class="w-full border-gray-300 rounded text-sm"/></div>
        `;
      } else if (type === 'dropdown' || type === 'radio_group') {
        html += `
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Options (JSON Array of strings or {label, value} objects)</label>
            <textarea id="dc-options" rows="4" class="w-full border-gray-300 rounded text-sm font-mono">${JSON.stringify(dc.options || ['Option 1', 'Option 2'], null, 2)}</textarea>
          </div>
          <div class="mt-2"><label class="block text-xs text-gray-500">Default Selected Value</label><input type="text" id="dc-default-val" value="${dc.default_selected || ''}" class="w-full border-gray-300 rounded text-sm"/></div>
        `;
      } else if (type === 'action_button') {
        html += `
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-xs text-gray-500">Action Type</label>
              <select id="dc-action-type" class="w-full border-gray-300 rounded text-sm">
                <option value="submit" ${dc.action_type === 'submit' ? 'selected' : ''}>Submit</option>
                <option value="link" ${dc.action_type === 'link' ? 'selected' : ''}>Link/Navigate</option>
                <option value="modal" ${dc.action_type === 'modal' ? 'selected' : ''}>Open Modal</option>
              </select>
            </div>
            <div>
              <label class="block text-xs text-gray-500">Button Style</label>
              <select id="dc-btn-style" class="w-full border-gray-300 rounded text-sm">
                <option value="primary" ${dc.button_style === 'primary' ? 'selected' : ''}>Primary (Blue)</option>
                <option value="secondary" ${dc.button_style === 'secondary' ? 'selected' : ''}>Secondary (Gray)</option>
                <option value="danger" ${dc.button_style === 'danger' ? 'selected' : ''}>Danger (Red)</option>
              </select>
            </div>
          </div>
          <div class="mt-2"><label class="block text-xs text-gray-500">Action Target / URL</label><input type="text" id="dc-action-target" value="${dc.action_target || ''}" class="w-full border-gray-300 rounded text-sm"/></div>
        `;
      } else if (type === 'number_input') {
        html += `
          <div class="grid grid-cols-3 gap-4">
            <div><label class="block text-xs text-gray-500">Min</label><input type="number" id="dc-min" value="${dc.min ?? 0}" class="w-full border-gray-300 rounded text-sm"/></div>
            <div><label class="block text-xs text-gray-500">Max</label><input type="number" id="dc-max" value="${dc.max ?? 100}" class="w-full border-gray-300 rounded text-sm"/></div>
            <div><label class="block text-xs text-gray-500">Step</label><input type="number" id="dc-step" value="${dc.step ?? 1}" class="w-full border-gray-300 rounded text-sm"/></div>
          </div>
          <div class="mt-2"><label class="block text-xs text-gray-500">Default Value</label><input type="number" id="dc-default-num" value="${dc.default_value || 0}" class="w-full border-gray-300 rounded text-sm"/></div>
        `;
      } else if (type === 'text_input') {
        html += `
          <div><label class="block text-xs text-gray-500">Placeholder</label><input type="text" id="dc-placeholder" value="${dc.placeholder || ''}" class="w-full border-gray-300 rounded text-sm"/></div>
          <div class="mt-2"><label class="block text-xs text-gray-500">Max Length</label><input type="number" id="dc-maxlength" value="${dc.max_length || 255}" class="w-full border-gray-300 rounded text-sm"/></div>
        `;
      }

      container.innerHTML = html;
      
      // Attach listeners to form fields to trigger preview update
      container.querySelectorAll('input, select, textarea').forEach(el => {
        el.addEventListener('input', updatePreview);
      });
    };

    const updatePreview = () => {
      const type = document.getElementById('mw-type').value;
      const labelEn = document.getElementById('mw-label-en').value || 'Label';
      
      // Build temp config
      const tempConfig = { widget_type: type, label_en: labelEn, dynamic_config: {} };
      
      try {
        if (type === 'switch') {
          tempConfig.dynamic_config.on_label = document.getElementById('dc-on-label')?.value || 'On';
          tempConfig.dynamic_config.off_label = document.getElementById('dc-off-label')?.value || 'Off';
          tempConfig.dynamic_config.default_value = document.getElementById('dc-default-bool')?.checked;
        } else if (type === 'dropdown' || type === 'radio_group') {
          tempConfig.dynamic_config.options = JSON.parse(document.getElementById('dc-options')?.value || '[]');
        } else if (type === 'action_button') {
          tempConfig.dynamic_config.button_style = document.getElementById('dc-btn-style')?.value || 'primary';
        } else if (type === 'text_input') {
          tempConfig.dynamic_config.placeholder = document.getElementById('dc-placeholder')?.value || '';
        }
      } catch (e) {
        // ignore parsing errors during typing
      }

      const previewEl = document.getElementById('mw-preview-container');
      previewEl.innerHTML = this.renderWidgetPreview(tempConfig);
    };

    typeSelect.addEventListener('change', (e) => {
      renderDynamicFields(e.target.value);
      updatePreview();
    });

    document.getElementById('mw-label-en').addEventListener('input', updatePreview);

    renderDynamicFields(widget.widget_type);
    updatePreview();

    // Save Logic
    document.getElementById('ui-modal-save').addEventListener('click', () => {
      const type = document.getElementById('mw-type').value;
      const newConfig = {
        widget_type: type,
        label_en: document.getElementById('mw-label-en').value,
        label_si: document.getElementById('mw-label-si').value,
        section: document.getElementById('mw-section').value,
        sort_order: parseInt(document.getElementById('mw-sort').value) || 0,
        status: document.getElementById('mw-status').value,
        schema_definition: {
          linked_state_key: document.getElementById('dc-linked-key')?.value || ''
        }
      };

      const cfg = newConfig.schema_definition;

      if (type === 'switch') {
        cfg.default_value = document.getElementById('dc-default-bool')?.checked;
        cfg.on_label = document.getElementById('dc-on-label')?.value;
        cfg.off_label = document.getElementById('dc-off-label')?.value;
      } else if (type === 'checkbox') {
        cfg.default_checked = document.getElementById('dc-default-bool')?.checked;
        cfg.required = document.getElementById('dc-required')?.checked;
        cfg.point_value = parseInt(document.getElementById('dc-points')?.value) || 0;
      } else if (type === 'dropdown' || type === 'radio_group') {
        try {
          cfg.options = JSON.parse(document.getElementById('dc-options').value);
          cfg.default_selected = document.getElementById('dc-default-val')?.value;
        } catch (e) {
          this.toast('Invalid JSON for options', 'error'); return;
        }
      } else if (type === 'action_button') {
        cfg.action_type = document.getElementById('dc-action-type')?.value;
        cfg.button_style = document.getElementById('dc-btn-style')?.value;
        cfg.action_target = document.getElementById('dc-action-target')?.value;
      } else if (type === 'number_input') {
        cfg.min = Number(document.getElementById('dc-min')?.value);
        cfg.max = Number(document.getElementById('dc-max')?.value);
        cfg.step = Number(document.getElementById('dc-step')?.value);
        cfg.default_value = Number(document.getElementById('dc-default-num')?.value);
      } else if (type === 'text_input') {
        cfg.placeholder = document.getElementById('dc-placeholder')?.value;
        cfg.max_length = Number(document.getElementById('dc-maxlength')?.value);
      }

      this.saveWidget(newConfig, widget.id);
      closeFn();
    });
  }

  renderWidgetPreview(config) {
    const dc = config.schema_definition || config.dynamic_config || {};
    const label = config.label_en || 'Label';
    const type = config.widget_type;

    if (type === 'switch') {
      const isChecked = dc.default_value ? 'checked' : '';
      return `
        <div class="flex items-center justify-between w-full">
          <span class="text-sm font-medium text-gray-700">${label}</span>
          <div class="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
            <input type="checkbox" name="toggle" class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" ${isChecked}/>
            <label class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
          </div>
        </div>
        <style>
          .toggle-checkbox:checked { right: 0; border-color: #3B82F6; }
          .toggle-checkbox:checked + .toggle-label { background-color: #3B82F6; }
        </style>
      `;
    }
    if (type === 'checkbox') {
      return `
        <div class="flex items-start w-full">
          <div class="flex items-center h-5">
            <input type="checkbox" class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded" ${dc.default_checked ? 'checked':''}>
          </div>
          <div class="ml-3 text-sm">
            <label class="font-medium text-gray-700">${label}</label>
          </div>
        </div>
      `;
    }
    if (type === 'text_input') {
      return `
        <div class="w-full">
          <label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <input type="text" placeholder="${dc.placeholder || ''}" class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md">
        </div>
      `;
    }
    if (type === 'number_input') {
      return `
        <div class="w-full">
          <label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <input type="number" value="${dc.default_value||0}" class="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md">
        </div>
      `;
    }
    if (type === 'dropdown') {
      const opts = Array.isArray(dc.options) ? dc.options : [];
      return `
        <div class="w-full">
          <label class="block text-sm font-medium text-gray-700 mb-1">${label}</label>
          <select class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md">
            ${opts.map(o => `<option>${typeof o === 'string' ? o : o.label}</option>`).join('')}
          </select>
        </div>
      `;
    }
    if (type === 'radio_group') {
      const opts = Array.isArray(dc.options) ? dc.options : [];
      return `
        <div class="w-full">
          <label class="block text-sm font-medium text-gray-700 mb-2">${label}</label>
          <div class="space-y-2">
            ${opts.map((o, i) => `
              <div class="flex items-center">
                <input type="radio" name="preview-radio" class="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300" ${i===0?'checked':''}>
                <label class="ml-3 block text-sm font-medium text-gray-700">${typeof o === 'string' ? o : o.label}</label>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
    if (type === 'action_button') {
      let btnClass = 'bg-blue-600 hover:bg-blue-700 text-white';
      if (dc.button_style === 'secondary') btnClass = 'bg-gray-200 hover:bg-gray-300 text-gray-800';
      if (dc.button_style === 'danger') btnClass = 'bg-red-600 hover:bg-red-700 text-white';
      
      return `
        <button class="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${btnClass}">
          ${label}
        </button>
      `;
    }

    return `<div class="text-gray-500 italic">Preview not available</div>`;
  }

  async saveWidget(data, widgetId = null) {
    try {
      if (widgetId) {
        await this.api.update(this.tableName, widgetId, data);
        this.toast('Widget updated successfully', 'success');
      } else {
        await this.api.insert(this.tableName, data);
        this.toast('Widget created successfully', 'success');
      }
      this.loadWidgets();
    } catch (e) {
      this.toast('Error saving widget', 'error');
    }
  }

  async deleteWidget(widgetId) {
    if (confirm('Are you sure you want to delete this widget?')) {
      try {
        await this.api.delete(this.tableName, widgetId);
        this.toast('Widget deleted', 'success');
        this.loadWidgets();
      } catch (e) {
        this.toast('Error deleting widget', 'error');
      }
    }
  }
}
