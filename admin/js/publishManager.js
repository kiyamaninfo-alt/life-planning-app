export class PublishManager {
  constructor(api, toastFn) {
    this.api = api;
    this.toast = toastFn;
    this.tables = ['wosandi_flows', 'wosandi_ui_schema', 'wosandi_tasks', 'wosandi_timers'];
  }

  async publishAll(table) {
    try {
      const { data } = await this.api.select(table, { status: 'draft' });
      if (!data || data.length === 0) {
        this.toast(`No drafts to publish in ${table}`, 'info');
        return;
      }
      
      await Promise.all(data.map(r => this.api.update(table, r.id, { status: 'published' })));
      this.toast(`Successfully published ${data.length} items in ${table}`, 'success');
    } catch (e) {
      this.toast(`Error publishing ${table}`, 'error');
    }
  }

  async unpublishAll(table) {
    try {
      const { data } = await this.api.select(table, { status: 'published' });
      if (!data || data.length === 0) return;
      await Promise.all(data.map(r => this.api.update(table, r.id, { status: 'draft' })));
      this.toast(`Successfully unpublished items in ${table}`, 'success');
    } catch (e) {
      this.toast(`Error unpublishing ${table}`, 'error');
    }
  }

  async publishById(table, id) {
    try {
      await this.api.update(table, id, { status: 'published' });
      this.toast('Published successfully', 'success');
    } catch (e) {
      this.toast('Error publishing', 'error');
    }
  }

  async unpublishById(table, id) {
    try {
      await this.api.update(table, id, { status: 'draft' });
      this.toast('Unpublished successfully', 'success');
    } catch (e) {
      this.toast('Error unpublishing', 'error');
    }
  }

  async getPublishSummary() {
    const summary = {};
    for (const table of this.tables) {
      try {
        const { data } = await this.api.select(table);
        const counts = { draft: 0, published: 0 };
        if (data) {
          data.forEach(r => {
            if (r.status === 'published') counts.published++;
            else counts.draft++;
          });
        }
        summary[table] = counts;
      } catch (e) {
        summary[table] = { draft: 0, published: 0, error: true };
      }
    }
    return summary;
  }

  async renderPublishPanel(containerEl) {
    containerEl.innerHTML = '<div class="p-8 text-center text-gray-500">Loading publish state...</div>';
    
    const summary = await this.getPublishSummary();
    
    const tableNamesFriendly = {
      'wosandi_flows': 'Questionnaire Flows',
      'wosandi_ui_schema': 'UI Components',
      'wosandi_tasks': 'Core Tasks',
      'wosandi_timers': 'Timers & Sessions'
    };

    let html = `
      <div class="max-w-4xl mx-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-gray-800">Publish Manager</h2>
          <button id="pm-refresh" class="text-gray-500 hover:text-blue-600"><i class="fas fa-sync-alt"></i> Refresh</button>
        </div>
        
        <div class="bg-white rounded-lg shadow overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Published</th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Drafts</th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    for (const [table, counts] of Object.entries(summary)) {
      const friendly = tableNamesFriendly[table] || table;
      html += `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${friendly} <span class="text-xs text-gray-400 block font-mono">${table}</span></td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${counts.published > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${counts.published}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${counts.draft > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}">
              ${counts.draft}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button class="pm-pub-all text-blue-600 hover:text-blue-900 mr-4 disabled:opacity-50" data-table="${table}" ${counts.draft === 0 ? 'disabled' : ''}>Publish All Drafts</button>
            <button class="pm-unpub-all text-red-600 hover:text-red-900 disabled:opacity-50" data-table="${table}" ${counts.published === 0 ? 'disabled' : ''}>Unpublish All</button>
          </td>
        </tr>
      `;
    }

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    containerEl.innerHTML = html;

    document.getElementById('pm-refresh').addEventListener('click', () => this.renderPublishPanel(containerEl));

    document.querySelectorAll('.pm-pub-all').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const table = e.currentTarget.dataset.table;
        if(confirm(`Are you sure you want to publish all drafts in ${table}?`)) {
          await this.publishAll(table);
          this.renderPublishPanel(containerEl);
        }
      });
    });

    document.querySelectorAll('.pm-unpub-all').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const table = e.currentTarget.dataset.table;
        if(confirm(`Are you sure you want to UNPUBLISH ALL live content in ${table}?`)) {
          await this.unpublishAll(table);
          this.renderPublishPanel(containerEl);
        }
      });
    });
  }

  openPreviewDrawer(table, id) {
    // Drawer implementation for previewing specific items.
    // In a real implementation this would slide out a panel showing the JSON or a rendered view.
    this.toast(`Preview for ${table} / ${id} not implemented in base manager`, 'info');
  }
}
