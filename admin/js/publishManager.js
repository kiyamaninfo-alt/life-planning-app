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
        this.toast(`ප්‍රකාශයට පත් කිරීමට කෙටුම්පත් නොමැත (${table})`, 'info');
        return;
      }
      
      await Promise.all(data.map(r => this.api.update(table, r.id, { status: 'published' })));
      this.toast(`අයිතම ${data.length}ක් සාර්ථකව ප්‍රකාශයට පත් කරන ලදී!`, 'success');
    } catch (e) {
      this.toast(`ප්‍රකාශයට පත් කිරීමේ දෝෂයකි (${table})`, 'error');
    }
  }

  async unpublishAll(table) {
    try {
      const { data } = await this.api.select(table, { status: 'published' });
      if (!data || data.length === 0) return;
      await Promise.all(data.map(r => this.api.update(table, r.id, { status: 'draft' })));
      this.toast(`සාර්ථකව ප්‍රකාශනයෙන් ඉවත් කරන ලදී (${table})`, 'success');
    } catch (e) {
      this.toast(`ප්‍රකාශනයෙන් ඉවත් කිරීමේ දෝෂයකි (${table})`, 'error');
    }
  }

  async publishById(table, id) {
    try {
      await this.api.update(table, id, { status: 'published' });
      this.toast('සාර්ථකව ප්‍රකාශයට පත් කරන ලදී', 'success');
    } catch (e) {
      this.toast('ප්‍රකාශයට පත් කිරීමේ දෝෂයකි', 'error');
    }
  }

  async unpublishById(table, id) {
    try {
      await this.api.update(table, id, { status: 'draft' });
      this.toast('සාර්ථකව ප්‍රකාශනයෙන් ඉවත් කරන ලදී', 'success');
    } catch (e) {
      this.toast('ඉවත් කිරීමේ දෝෂයකි', 'error');
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
    containerEl.innerHTML = '<div class="p-8 text-center text-gray-500 font-[\'Noto_Sans_Sinhala\']">ප්‍රකාශන තත්ත්වය පූරණය වෙමින් පවතී...</div>';
    
    const summary = await this.getPublishSummary();
    
    const tableNamesFriendly = {
      'wosandi_flows': 'ප්‍රශ්නාවලී චක්‍ර (Flows)',
      'wosandi_ui_schema': 'මුහුණත සංරචක (UI)',
      'wosandi_tasks': 'ප්‍රධාන කාර්යයන් (Tasks)',
      'wosandi_timers': 'වේලාවන් සහ සැසි (Timers)'
    };

    let html = `
      <div class="max-w-4xl mx-auto font-['Noto_Sans_Sinhala']">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold text-gray-800 flex items-center gap-2">
            <i class="fas fa-paper-plane text-indigo-600"></i> ප්‍රකාශන කළමනාකරණය (Publish Manager)
          </h2>
          <button id="pm-refresh" class="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition flex items-center gap-1.5">
            <i class="fas fa-sync-alt"></i> නැවුම් කරන්න (Refresh)
          </button>
        </div>
        
        <div class="bg-white rounded-xl shadow-xs border border-slate-200 overflow-hidden">
          <table class="min-w-full divide-y divide-gray-200">
            <thead class="bg-gray-50">
              <tr>
                <th scope="col" class="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">මොඩියුලය (Module)</th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">ප්‍රකාශිතයි (Published)</th>
                <th scope="col" class="px-6 py-3 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">කෙටුම්පත් (Drafts)</th>
                <th scope="col" class="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">ක්‍රියාමාර්ග (Actions)</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    for (const [table, counts] of Object.entries(summary)) {
      const friendly = tableNamesFriendly[table] || table;
      html += `
        <tr>
          <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">${friendly} <span class="text-xs text-gray-400 block font-mono">${table}</span></td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${counts.published > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${counts.published}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-center text-sm">
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${counts.draft > 0 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-800'}">
              ${counts.draft}
            </span>
          </td>
          <td class="px-6 py-4 whitespace-nowrap text-right text-xs font-medium">
            <button class="pm-pub-all text-indigo-600 hover:text-indigo-900 font-bold mr-4 disabled:opacity-30 disabled:cursor-not-allowed" data-table="${table}" ${counts.draft === 0 ? 'disabled' : ''}>
              සියලු කෙටුම්පත් ප්‍රකාශයට පත් කරන්න
            </button>
            <button class="pm-unpub-all text-red-600 hover:text-red-900 font-bold disabled:opacity-30 disabled:cursor-not-allowed" data-table="${table}" ${counts.published === 0 ? 'disabled' : ''}>
              ප්‍රකාශනයෙන් ඉවත් කරන්න
            </button>
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
        if(confirm(`මෙම මොඩියුලයේ (${table}) සියලු කෙටුම්පත් ප්‍රකාශයට පත් කිරීමට ඔබට සහතිකද?`)) {
          await this.publishAll(table);
          this.renderPublishPanel(containerEl);
        }
      });
    });

    document.querySelectorAll('.pm-unpub-all').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const table = e.currentTarget.dataset.table;
        if(confirm(`මෙම මොඩියුලයේ (${table}) සජීවී අන්තර්ගත සියල්ල ප්‍රකාශනයෙන් ඉවත් කිරීමට ඔබට සහතිකද?`)) {
          await this.unpublishAll(table);
          this.renderPublishPanel(containerEl);
        }
      });
    });
  }

  openPreviewDrawer(table, id) {
    this.toast(`පෙරදසුන සූදානම් කරමින් පවතී (${table} / ${id})`, 'info');
  }
}

