/**
 * Daily Questionnaire & Task Flow Player (Front-Page Flow Runner)
 * Executes published flows from wosandi_flows on https://life-planning-app.pages.dev
 */
class FlowPlayer {
  constructor() {
    this.SUPABASE_URL = "https://rxwopsfjnlzlzzazgnvq.supabase.co";
    this.SUPABASE_ANON_KEY = "sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn";
    this.flow = null;
    this.currentNode = null;
    this.history = [];
    this.accumulatedScore = 0;
    this.containerEl = document.getElementById("flow-player-card");
    this.sectionEl = document.getElementById("published-flow-section");
  }

  async init() {
    this.containerEl = document.getElementById("flow-player-card");
    this.sectionEl = document.getElementById("published-flow-section");
    if (!this.containerEl || !this.sectionEl) return;
    await this.fetchPublishedFlow();
  }

  async fetchPublishedFlow() {
    let flowRecord = null;
    try {
      const res = await fetch(`${this.SUPABASE_URL}/rest/v1/wosandi_flows?status=eq.published&order=updated_at.desc&limit=1`, {
        headers: {
          apikey: this.SUPABASE_ANON_KEY,
          Authorization: `Bearer ${this.SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows.length > 0) {
          flowRecord = rows[0];
        }
      }
    } catch (e) {
      console.warn("Could not fetch published flow from Supabase, checking local storage", e);
    }

    if (!flowRecord) {
      // Local storage fallback for admin-published flows
      try {
        const local = localStorage.getItem("wosandi_admin_wosandi_flows");
        if (local) {
          const list = JSON.parse(local);
          flowRecord = list.find(f => f.status === 'published') || null;
        }
      } catch (e) {}
    }

    if (flowRecord && flowRecord.flow_data && Array.isArray(flowRecord.flow_data.nodes) && flowRecord.flow_data.nodes.length > 0) {
      this.flow = flowRecord;
      this.startFlow();
    } else {
      if (this.sectionEl) this.sectionEl.classList.add("hidden");
    }
  }

  startFlow() {
    if (!this.flow || !this.flow.flow_data) return;
    const nodes = this.flow.flow_data.nodes.filter(n => !n.disabled);
    if (nodes.length === 0) return;

    // Find start node: node with no incoming edges (or first question node)
    const incomingIds = new Set((this.flow.flow_data.edges || []).map(e => e.toId));
    let startNode = nodes.find(n => !incomingIds.has(n.id) && n.type !== 'end');
    if (!startNode) startNode = nodes[0];

    this.currentNode = startNode;
    this.history = [];
    this.accumulatedScore = 0;
    if (this.sectionEl) this.sectionEl.classList.remove("hidden");
    this.renderCurrentNode();
  }

  renderCurrentNode() {
    if (!this.currentNode || !this.containerEl) return;
    const node = this.currentNode;
    const isEnd = node.type === 'end';
    const isTask = node.type === 'task';
    const title = this.flow.title_si || this.flow.title_en || 'දෛනික ඇගයීම් චක්‍රය';
    const prompt = node.text_si || node.text_en || (isEnd ? 'දවසේ ඇගයීම සාර්ථකව අවසන් කළා!' : 'ප්‍රශ්නය');

    const options = (Array.isArray(node.options) ? node.options : []).filter(o => !o.disabled);

    let contentHtml = '';

    if (isEnd) {
      contentHtml = `
        <div class="text-center py-6 px-4">
          <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-3 shadow-inner">
            🏁
          </div>
          <h3 class="text-lg font-bold text-slate-800 font-['Noto_Sans_Sinhala'] mb-1">${prompt}</h3>
          <p class="text-xs text-slate-500 mb-4">ඔබ ප්‍රශ්නාවලිය සාර්ථකව සම්පූර්ණ කර ඇත!</p>
          <div class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-xl mb-4">
            <span class="text-xs font-bold text-slate-600 uppercase">එකතු කළ මුළු ලකුණු:</span>
            <span class="text-lg font-black text-pink-600">+${this.accumulatedScore} Pts</span>
          </div>
          <div class="flex justify-center gap-2">
            <button type="button" onclick="window.flowPlayer.restartFlow()" class="px-4 py-2 text-xs font-bold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition flex items-center gap-1.5 shadow-2xs">
              <i class="fa-solid fa-rotate-left"></i> නැවත ආරම්භ කරන්න
            </button>
          </div>
        </div>
      `;
    } else if (isTask) {
      contentHtml = `
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">📋 Task Step</span>
            <span class="ml-auto text-xs font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">+${node.points || 15} Pts</span>
          </div>
          <h4 class="text-sm font-bold text-slate-800 font-['Noto_Sans_Sinhala'] leading-snug">${prompt}</h4>
          ${node.task_payload?.schema_definition?.description ? `
            <div class="text-xs text-purple-900 bg-purple-50/70 p-2.5 rounded-xl border border-purple-100">
              <span class="font-semibold block mb-0.5">උපදෙස්:</span>
              <p>${node.task_payload.schema_definition.description}</p>
            </div>
          ` : ''}
          ${options.length > 0 ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              ${options.map(opt => `
                <button type="button" onclick="window.flowPlayer.handleAnswer('${opt.id}')" class="p-2.5 rounded-xl border border-purple-200 hover:border-purple-500 hover:bg-purple-50 text-left transition flex justify-between items-center bg-white shadow-2xs">
                  <span class="font-bold text-xs text-slate-700 font-['Noto_Sans_Sinhala']">${opt.text_si || opt.text_en}</span>
                  <span class="text-[11px] font-extrabold px-2 py-0.5 rounded-full ${opt.points < 0 ? 'bg-red-100 text-red-700' : (opt.points > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}">
                    ${opt.points > 0 ? '+' : ''}${opt.points || 0}
                  </span>
                </button>
              `).join('')}
            </div>
          ` : `
            <div class="flex justify-end pt-1">
              <button type="button" onclick="window.flowPlayer.handleTaskDone()" class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5">
                <i class="fa-solid fa-check"></i> සම්පූර්ණ කළා
              </button>
            </div>
          `}
        </div>
      `;
    } else {
      // Question Node
      contentHtml = `
        <div class="p-4 space-y-3">
          <div class="flex items-center gap-2">
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 uppercase">❓ Question</span>
            <span class="ml-auto text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">ලකුණු: +${this.accumulatedScore}</span>
          </div>
          <h4 class="text-sm font-bold text-slate-800 font-['Noto_Sans_Sinhala'] leading-snug">${prompt}</h4>
          
          ${options.length > 0 ? `
            <div class="space-y-2 pt-1">
              ${options.map(opt => `
                <button type="button" onclick="window.flowPlayer.handleAnswer('${opt.id}')" class="w-full p-3 rounded-xl border border-slate-200 hover:border-pink-500 hover:bg-pink-50/50 text-left transition flex justify-between items-center bg-white shadow-2xs group">
                  <span class="font-bold text-xs text-slate-800 group-hover:text-pink-600 font-['Noto_Sans_Sinhala'] transition">${opt.text_si || opt.text_en}</span>
                  <span class="text-xs font-extrabold px-2 py-0.5 rounded-full ${opt.points < 0 ? 'bg-red-100 text-red-700' : (opt.points > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600')}">
                    ${opt.points > 0 ? '+' : ''}${opt.points || 0} pts
                  </span>
                </button>
              `).join('')}
            </div>
          ` : `
            <div class="flex justify-end pt-1">
              <button type="button" onclick="window.flowPlayer.handleAnswer('next')" class="bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-xs transition flex items-center gap-1.5">
                ඉදිරියට <i class="fa-solid fa-arrow-right"></i>
              </button>
            </div>
          `}
        </div>
      `;
    }

    this.containerEl.innerHTML = `
      <div class="bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 p-3 text-white flex justify-between items-center">
        <div class="flex items-center gap-2">
          <i class="fa-solid fa-sparkles text-amber-300 text-xs"></i>
          <span class="text-xs font-extrabold tracking-wide uppercase font-['Noto_Sans_Sinhala']">${title}</span>
        </div>
        <span class="text-[10px] bg-white/20 backdrop-blur-xs px-2 py-0.5 rounded-full font-bold">Live Flow</span>
      </div>
      ${contentHtml}
    `;
  }

  handleAnswer(optId) {
    if (!this.currentNode) return;
    const node = this.currentNode;
    const options = Array.isArray(node.options) ? node.options : [];
    const selectedOpt = options.find(o => o.id === optId);

    const pts = selectedOpt ? (Number(selectedOpt.points) || 0) : (Number(node.points) || 0);
    this.accumulatedScore += pts;

    // Credit marks to the main front-page routine score!
    if (typeof state !== 'undefined') {
      state.flow_points = this.accumulatedScore;
      if (typeof syncProgressWithServer === 'function') {
        syncProgressWithServer(state);
      }
    }

    if (typeof playChime === 'function') playChime();

    // Resolve next node using edges
    const edges = this.flow.flow_data.edges || [];
    const outgoing = edges.filter(e => e.fromId === node.id);

    let nextEdge = outgoing.find(e => 
      e.condition_option_id === optId ||
      e.condition_value === optId ||
      e.condition === optId ||
      (selectedOpt?.text_en && e.condition === selectedOpt.text_en) ||
      (selectedOpt?.text_si && e.condition === selectedOpt.text_si)
    );

    if (!nextEdge) {
      // Default edge fallback
      nextEdge = outgoing.find(e => !e.condition && !e.condition_option_id) || outgoing[0];
    }

    if (nextEdge && nextEdge.toId) {
      const nextNode = (this.flow.flow_data.nodes || []).find(n => n.id === nextEdge.toId);
      if (nextNode) {
        this.currentNode = nextNode;
        this.renderCurrentNode();
        return;
      }
    }

    // If no next node, show completion
    this.currentNode = {
      type: 'end',
      text_si: 'දවසේ ඇගයීම සාර්ථකව අවසන් කළා!'
    };
    this.renderCurrentNode();
  }

  handleTaskDone() {
    const pts = Number(this.currentNode?.points) || 15;
    this.accumulatedScore += pts;
    if (typeof state !== 'undefined') {
      state.flow_points = this.accumulatedScore;
      if (typeof syncProgressWithServer === 'function') {
        syncProgressWithServer(state);
      }
    }
    if (typeof playChime === 'function') playChime();
    this.handleAnswer('opt_done');
  }

  restartFlow() {
    this.startFlow();
  }
}

// Global initialization
window.addEventListener('DOMContentLoaded', () => {
  window.flowPlayer = new FlowPlayer();
  window.flowPlayer.init();
});
