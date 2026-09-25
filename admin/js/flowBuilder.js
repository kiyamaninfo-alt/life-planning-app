import { FlowEngine } from './flowEngine.js';

export class FlowBuilder {
  constructor(containerEl, api, toastFn) {
    this.containerEl = containerEl;
    this.api = api;
    this.toast = toastFn;
    this.tableName = 'wosandi_flows';
    this.currentFlow = null;
    this.selectedNodeId = null;
    this.svgWidth = 800;
    this.svgHeight = 600;

    // Cross-module active tasks cache (Section 2.2)
    this.activeTasks = [];

    // History stack for Undo / Redo (Section 3.4)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistory = 30;

    // Interactive canvas drag state
    this.isDragging = false;
    this.dragNode = null;
    this.dragOffset = { x: 0, y: 0 };
    this.dragStartPos = { x: 0, y: 0 };
    this._hasDragged = false;

    // Bound keyboard shortcut listener
    this._handleKeyDown = this.handleKeyDown.bind(this);
  }

  /**
   * Internal API / State Selector (Section 2.2):
   * Fetches active tasks from wosandi_tasks for embedding into Flow Builder nodes
   */
  async loadActiveTasks() {
    try {
      if (typeof this.api.getActiveTasks === 'function') {
        this.activeTasks = await this.api.getActiveTasks();
      } else {
        const res = await this.api.select('wosandi_tasks');
        this.activeTasks = res.data || (Array.isArray(res) ? res : []);
      }
    } catch (e) {
      console.warn('Could not load active tasks for flow builder:', e);
      this.activeTasks = [];
    }
  }

  async render() {
    this.detachKeyboardShortcuts();
    await this.loadActiveTasks();

    this.containerEl.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <div>
          <h2 class="text-2xl font-bold text-gray-800">Questionnaire Flows & Visual Branching Engine</h2>
          <p class="text-sm text-gray-500 mt-1">Design DAG flows with per-option scoring, negative marks, and conditional routing</p>
        </div>
        <button id="fb-new-flow" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow flex items-center gap-2">
          <i class="fas fa-plus"></i> New Flow
        </button>
      </div>
      <div id="fb-flows-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="text-center text-gray-500 py-10 w-full col-span-full">Loading flows...</div>
      </div>
    `;

    document.getElementById('fb-new-flow').addEventListener('click', () => this.openFlowEditor());

    try {
      const { data, error } = await this.api.select(this.tableName);
      const listContainer = document.getElementById('fb-flows-list');
      
      if (!data || data.length === 0) {
        listContainer.innerHTML = '<div class="text-center text-gray-500 py-10 w-full col-span-full">No flows found. Create one!</div>';
        return;
      }

      listContainer.innerHTML = data.map(flow => {
        const nodeCount = flow.flow_data?.nodes?.length || 0;
        const edgeCount = flow.flow_data?.edges?.length || 0;
        const isPublished = flow.status === 'published';
        const flowTitle = flow.title_si || flow.title || 'Untitled Flow';
        const flowType = flow.flow_type || flow.type || 'questionnaire';
        const scoreFloorZero = flow.flow_data?.settings?.score_floor_zero !== false && flow.flow_data?.settings?.allow_negative_score !== true;

        return `
          <div class="bg-white rounded-lg shadow-md p-5 border-t-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow" data-id="${flow.id}">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-lg font-bold text-gray-800">${flowTitle}</h3>
              <span class="text-xs font-semibold px-2 py-1 rounded ${isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                ${isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-3 capitalize">Type: ${flowType}</p>
            <div class="flex items-center gap-2 mb-4">
              <span class="text-xs px-2 py-0.5 rounded-full ${scoreFloorZero ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}">
                ${scoreFloorZero ? '🛡️ Floor ≥ 0' : '⚠️ Negative Score Allowed'}
              </span>
            </div>
            <div class="flex justify-between items-center text-sm text-gray-500 border-t pt-3">
              <span><i class="fas fa-project-diagram mr-1 text-blue-500"></i> ${nodeCount} Nodes</span>
              <span><i class="fas fa-random mr-1 text-indigo-500"></i> ${edgeCount} Connectors</span>
            </div>
          </div>
        `;
      }).join('');

      listContainer.querySelectorAll('div[data-id]').forEach(el => {
        el.addEventListener('click', () => this.openFlowEditor(el.dataset.id));
      });
    } catch (e) {
      console.error(e);
      this.toast('Error loading flows', 'error');
    }
  }

  async openFlowEditor(flowId = null) {
    await this.loadActiveTasks();

    if (flowId) {
      try {
        const { data } = await this.api.selectById(this.tableName, flowId);
        if (data) {
          this.currentFlow = data;
          this.currentFlow.title = data.title_si || data.title || 'Untitled Flow';
          this.currentFlow.type = data.flow_type || data.type || 'questionnaire';
          if (!this.currentFlow.flow_data) {
            this.currentFlow.flow_data = { nodes: [], edges: [], settings: { score_floor_zero: true, allow_negative_score: false } };
          } else {
            if (!this.currentFlow.flow_data.nodes) this.currentFlow.flow_data.nodes = [];
            if (!this.currentFlow.flow_data.edges) this.currentFlow.flow_data.edges = [];
            if (!this.currentFlow.flow_data.settings) {
              this.currentFlow.flow_data.settings = { score_floor_zero: true, allow_negative_score: false };
            }
          }
        }
      } catch (e) {
        this.toast('Error loading flow', 'error');
        return;
      }
    } else {
      this.currentFlow = {
        title: 'New Flow',
        type: 'questionnaire',
        status: 'draft',
        flow_data: {
          nodes: [
            {
              id: 'node_' + Math.random().toString(36).substr(2, 9),
              type: 'question',
              text_si: 'අද උදෑසන අවදි වූයේ කීයටද?',
              text_en: 'What time did you wake up this morning?',
              input_type: 'time-range',
              options: [
                { id: 'opt_1', text_si: '05:30ට පෙර', text_en: 'Before 05:30', points: 20 },
                { id: 'opt_2', text_si: '06:00ට පෙර', text_en: 'Before 06:00', points: 15 },
                { id: 'opt_3', text_si: '06:30ට පෙර', text_en: 'Before 06:30', points: 10 },
                { id: 'opt_4', text_si: '06:30ට පසු',  text_en: 'After 06:30',  points: -20 }
              ]
            },
            {
              id: 'node_' + Math.random().toString(36).substr(2, 9),
              type: 'end',
              text_si: 'දවසේ ඇගයීම සාර්ථකයි!',
              text_en: 'Assessment Complete!'
            }
          ],
          edges: [],
          settings: {
            score_floor_zero: true,
            allow_negative_score: false
          }
        }
      };

      // Connect initial nodes
      if (this.currentFlow.flow_data.nodes.length >= 2) {
        this.currentFlow.flow_data.edges.push({
          fromId: this.currentFlow.flow_data.nodes[0].id,
          toId: this.currentFlow.flow_data.nodes[1].id,
          condition: '',
          condition_option_id: ''
        });
      }
    }

    // Reset history
    this.history = [];
    this.historyIndex = -1;
    this.pushHistory('Initial load');

    this.selectedNodeId = null;

    const allowNegativeScore = this.currentFlow.flow_data.settings?.allow_negative_score === true;
    const scoreFloorZero = !allowNegativeScore;

    this.containerEl.innerHTML = `
      <div class="flex flex-col h-full bg-gray-50 relative">
        <!-- Top Bar -->
        <div class="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm z-20">
          <div class="flex items-center space-x-3">
            <button id="fb-back" class="text-gray-500 hover:text-gray-800 p-1.5 rounded hover:bg-gray-100 transition">
              <i class="fas fa-arrow-left"></i>
            </button>
            <input type="text" id="fb-title" value="${this.currentFlow.title || ''}" placeholder="Flow Title (Sinhala/English)" class="font-bold text-lg border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:ring-0 bg-transparent px-1 py-0.5" />
            <select id="fb-type" class="text-sm border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500">
              <option value="questionnaire" ${this.currentFlow.type === 'questionnaire' ? 'selected' : ''}>Questionnaire</option>
              <option value="assessment" ${this.currentFlow.type === 'assessment' ? 'selected' : ''}>Assessment</option>
              <option value="survey" ${this.currentFlow.type === 'survey' ? 'selected' : ''}>Survey</option>
              <option value="checklist" ${this.currentFlow.type === 'checklist' ? 'selected' : ''}>Checklist</option>
            </select>
            <span class="text-xs font-semibold px-2 py-1 rounded ${this.currentFlow.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${this.currentFlow.status === 'published' ? 'Published' : 'Draft'}
            </span>

            <!-- Section 4.3: Negative Score Floor Safeguard Toggle: "Allow Negative Total Score" -->
            <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg border border-slate-300 select-none ml-2" title="Toggle negative total score. When disabled, runtime calculator clamps final score at 0: Final Score = max(0, Total Points)">
              <input type="checkbox" id="fb-allow-negative-toggle" ${allowNegativeScore ? 'checked' : ''} class="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4">
              <span id="fb-score-floor-label">${allowNegativeScore ? '⚠️ Negative Score Allowed' : '🛡️ Score Floor ≥ 0'}</span>
            </label>
          </div>

          <div class="flex items-center space-x-2">
            <!-- Undo / Redo Toolbar -->
            <button id="fb-undo-btn" class="px-2.5 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed" title="Undo (Ctrl+Z)">
              <i class="fas fa-undo"></i>
            </button>
            <button id="fb-redo-btn" class="px-2.5 py-1.5 text-sm rounded border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed" title="Redo (Ctrl+Y)">
              <i class="fas fa-redo"></i>
            </button>
            
            <button id="fb-simulate-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 text-sm font-medium rounded shadow-sm transition flex items-center gap-1.5">
              <i class="fas fa-play"></i> Simulate Flow
            </button>

            ${flowId ? `<button id="fb-delete" class="text-red-600 hover:bg-red-50 px-3 py-1.5 text-sm rounded transition"><i class="fas fa-trash-alt mr-1"></i> Delete</button>` : ''}
            <button id="fb-save" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 text-sm font-medium rounded shadow-sm transition"><i class="fas fa-save mr-1"></i> Save</button>
            <button id="fb-publish" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-sm font-medium rounded shadow-sm transition"><i class="fas fa-paper-plane mr-1"></i> Publish</button>
          </div>
        </div>

        <!-- Split Layout -->
        <div class="flex flex-1 overflow-hidden relative">
          <!-- LEFT: SVG Canvas -->
          <div class="w-3/5 bg-slate-100 overflow-auto relative border-r flex flex-col">
            <div class="p-2.5 bg-white border-b flex items-center justify-between shadow-xs">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold text-gray-500 uppercase tracking-wider mr-1">Add Nodes:</span>
                <button id="fb-add-question" class="bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 px-3 py-1 text-xs font-semibold rounded shadow-xs flex items-center gap-1" title="Input-driven question node">
                  <i class="fas fa-question-circle"></i> Question
                </button>
                <button id="fb-add-task" class="bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 px-3 py-1 text-xs font-semibold rounded shadow-xs flex items-center gap-1" title="Task node linked to wosandi_tasks">
                  <i class="fas fa-tasks"></i> Task
                </button>
                <button id="fb-add-branch" class="bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 px-3 py-1 text-xs font-semibold rounded shadow-xs flex items-center gap-1" title="Conditional routing splitter">
                  <i class="fas fa-code-branch"></i> Branch
                </button>
                <button id="fb-add-end" class="bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 px-3 py-1 text-xs font-semibold rounded shadow-xs flex items-center gap-1" title="Flow completion terminal">
                  <i class="fas fa-flag-checkered"></i> End
                </button>
              </div>

              <!-- Integrity Indicator -->
              <div id="fb-dag-status" class="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-green-100 text-green-800 font-semibold cursor-pointer" title="Click to view DAG validation report">
                <i class="fas fa-check-circle"></i> DAG Valid
              </div>
            </div>

            <div id="fb-svg-container" class="flex-1 w-full h-full p-4 min-w-[800px] min-h-[600px] overflow-auto flow-graph-container select-none">
              <!-- SVG will be injected here -->
            </div>
          </div>
          
          <!-- RIGHT: Node Editor Sidebar -->
          <div class="w-2/5 bg-white overflow-y-auto border-l shadow-sm" id="fb-node-editor">
            <div class="p-8 text-center text-gray-400 mt-20">
              <i class="fas fa-mouse-pointer text-4xl mb-4 text-gray-300"></i>
              <p class="font-medium">Select a node on the canvas to configure options, scoring, and conditional branching</p>
            </div>
          </div>
        </div>

        <!-- Simulator Modal Container -->
        <div id="fb-simulator-modal-container"></div>
        <!-- DAG Report Modal Container -->
        <div id="fb-dag-modal-container"></div>
      </div>
    `;

    this.attachEventListeners(flowId);
    this.attachKeyboardShortcuts();
    this.updateGraph();
    this.updateDagStatusBadge();
    this.updateUndoRedoButtons();
  }

  attachEventListeners(flowId) {
    document.getElementById('fb-back').addEventListener('click', () => this.render());
    document.getElementById('fb-save').addEventListener('click', () => this.saveFlow(false));
    document.getElementById('fb-publish').addEventListener('click', () => this.saveFlow(true));
    
    if (flowId) {
      document.getElementById('fb-delete').addEventListener('click', () => this.deleteFlow(flowId));
    }

    document.getElementById('fb-undo-btn').addEventListener('click', () => this.undo());
    document.getElementById('fb-redo-btn').addEventListener('click', () => this.redo());
    document.getElementById('fb-simulate-btn').addEventListener('click', () => this.openSimulatorModal());
    document.getElementById('fb-dag-status').addEventListener('click', () => this.openDagReportModal());

    document.getElementById('fb-add-question').addEventListener('click', () => this.addNode('question'));
    document.getElementById('fb-add-task')?.addEventListener('click', () => this.addNode('task'));
    document.getElementById('fb-add-branch').addEventListener('click', () => this.addNode('branch'));
    document.getElementById('fb-add-end').addEventListener('click', () => this.addNode('end'));

    document.getElementById('fb-title').addEventListener('change', (e) => {
      this.currentFlow.title = e.target.value;
      this.currentFlow.title_si = e.target.value;
    });

    document.getElementById('fb-type').addEventListener('change', (e) => {
      this.currentFlow.type = e.target.value;
      this.currentFlow.flow_type = e.target.value;
    });

    document.getElementById('fb-allow-negative-toggle')?.addEventListener('change', (e) => {
      if (!this.currentFlow.flow_data.settings) this.currentFlow.flow_data.settings = {};
      const allowNeg = e.target.checked;
      this.currentFlow.flow_data.settings.allow_negative_score = allowNeg;
      this.currentFlow.flow_data.settings.score_floor_zero = !allowNeg;
      const labelEl = document.getElementById('fb-score-floor-label');
      if (labelEl) {
        labelEl.textContent = allowNeg ? '⚠️ Negative Score Allowed' : '🛡️ Score Floor ≥ 0';
      }
      this.pushHistory(`Toggle Allow Negative Score: ${allowNeg ? 'Enabled' : 'Disabled'}`);
      this.toast(`Score floor safeguard: ${allowNeg ? 'Negative scores permitted' : 'Clamped to 0 minimum'}`, 'info');
    });
  }

  attachKeyboardShortcuts() {
    window.addEventListener('keydown', this._handleKeyDown);
  }

  detachKeyboardShortcuts() {
    window.removeEventListener('keydown', this._handleKeyDown);
  }

  handleKeyDown(e) {
    // Only handle if in flow builder view
    if (!document.getElementById('fb-svg-container')) return;

    // Check if user is typing in an input or textarea
    const activeEl = document.activeElement;
    const isTyping = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    if (isTyping) return;

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (e.shiftKey) {
        e.preventDefault();
        this.redo();
      } else {
        e.preventDefault();
        this.undo();
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      this.redo();
    }
  }

  pushHistory(description = '') {
    const snapshot = JSON.parse(JSON.stringify(this.currentFlow.flow_data));

    // If we've undone steps, truncate future history
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push({ snapshot, description, timestamp: Date.now() });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      const state = this.history[this.historyIndex];
      this.currentFlow.flow_data = JSON.parse(JSON.stringify(state.snapshot));
      this.updateGraph();
      if (this.selectedNodeId) {
        const node = this.currentFlow.flow_data.nodes.find(n => n.id === this.selectedNodeId);
        this.renderNodeEditor(node);
      }
      this.updateUndoRedoButtons();
      this.updateDagStatusBadge();
      this.toast(`Undo: ${state.description || 'Action reversed'}`, 'info');
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      const state = this.history[this.historyIndex];
      this.currentFlow.flow_data = JSON.parse(JSON.stringify(state.snapshot));
      this.updateGraph();
      if (this.selectedNodeId) {
        const node = this.currentFlow.flow_data.nodes.find(n => n.id === this.selectedNodeId);
        this.renderNodeEditor(node);
      }
      this.updateUndoRedoButtons();
      this.updateDagStatusBadge();
      this.toast(`Redo: ${state.description || 'Action restored'}`, 'info');
    }
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('fb-undo-btn');
    const redoBtn = document.getElementById('fb-redo-btn');
    if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;
  }

  updateDagStatusBadge() {
    const badge = document.getElementById('fb-dag-status');
    if (!badge) return;

    const validation = FlowEngine.validateGraph(this.currentFlow.flow_data);

    if (!validation.isValid) {
      badge.className = 'flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-red-100 text-red-800 font-semibold cursor-pointer';
      badge.innerHTML = `<i class="fas fa-exclamation-triangle"></i> Cycle Detected (${validation.errors.length})`;
    } else if (validation.warnings.length > 0) {
      badge.className = 'flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-amber-100 text-amber-800 font-semibold cursor-pointer';
      badge.innerHTML = `<i class="fas fa-info-circle"></i> ${validation.warnings.length} Warnings`;
    } else {
      badge.className = 'flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-green-100 text-green-800 font-semibold cursor-pointer';
      badge.innerHTML = `<i class="fas fa-check-circle"></i> DAG Valid`;
    }
  }

  updateGraph() {
    const container = document.getElementById('fb-svg-container');
    if (!container) return;
    
    const nodes = this.currentFlow.flow_data.nodes;
    const edges = this.currentFlow.flow_data.edges;
    
    const levels = {};
    const processed = new Set();
    
    // Topological / Level calculation
    const getLevel = (nodeId) => {
      if (levels[nodeId] !== undefined) return levels[nodeId];
      const incomingEdges = edges.filter(e => e.toId === nodeId);
      if (incomingEdges.length === 0) return 0;
      
      if (processed.has(nodeId)) return 0; // Prevent infinite loop while rendering
      processed.add(nodeId);
      
      const maxIncomingLevel = Math.max(...incomingEdges.map(e => getLevel(e.fromId)));
      const level = maxIncomingLevel + 1;
      levels[nodeId] = level;
      return level;
    };

    nodes.forEach(n => getLevel(n.id));
    processed.clear();

    const levelCounts = {};
    nodes.forEach(n => {
      const l = levels[n.id] || 0;
      levelCounts[l] = (levelCounts[l] || 0) + 1;
    });

    const levelIndex = {};
    const layoutNodes = nodes.map(n => {
      const l = levels[n.id] || 0;
      levelIndex[l] = (levelIndex[l] || 0) + 1;
      
      const width = 175;
      const height = 68;
      const hGap = 210;
      const vGap = 130;
      
      const countInLevel = levelCounts[l];
      const idx = levelIndex[l] - 1;
      
      const totalWidth = countInLevel * hGap;
      const startX = (this.svgWidth / 2) - (totalWidth / 2) + (hGap / 2);
      
      const posX = (n.x !== undefined && n.x !== null) ? n.x : Math.max(20, startX + (idx * hGap) - (width / 2));
      const posY = (n.y !== undefined && n.y !== null) ? n.y : (40 + (l * vGap));
      n.x = posX;
      n.y = posY;

      return {
        ...n,
        x: posX,
        y: posY,
        width,
        height
      };
    });

    this.svgWidth = Math.max(850, ...layoutNodes.map(n => n.x + n.width + 100));
    this.svgHeight = Math.max(650, ...layoutNodes.map(n => n.y + n.height + 100));

    container.innerHTML = this.renderFlowGraph(layoutNodes, edges);
    
    setTimeout(() => {
      const gNodes = container.querySelectorAll('.fb-node');
      gNodes.forEach(g => {
        const nodeId = g.dataset.id;
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;

        // Selection click
        g.addEventListener('click', (e) => {
          if (this._hasDragged) return;
          this.selectedNodeId = nodeId;
          this.updateGraph();
          this.renderNodeEditor(node);
        });

        // Interactive Drag-and-drop repositioning (Section 3.4)
        g.addEventListener('mousedown', (e) => {
          if (e.button !== 0) return; // Primary button only
          this.isDragging = true;
          this.dragNode = node;
          this._hasDragged = false;
          
          const svgEl = container.querySelector('svg');
          if (!svgEl) return;
          const svgRect = svgEl.getBoundingClientRect();
          this.dragOffset = {
            x: (e.clientX - svgRect.left) - node.x,
            y: (e.clientY - svgRect.top) - node.y
          };
          this.dragStartPos = { x: node.x, y: node.y };

          const onMouseMove = (moveEvt) => {
            if (!this.isDragging || !this.dragNode) return;
            const curX = (moveEvt.clientX - svgRect.left) - this.dragOffset.x;
            const curY = (moveEvt.clientY - svgRect.top) - this.dragOffset.y;

            const dx = Math.abs(curX - this.dragStartPos.x);
            const dy = Math.abs(curY - this.dragStartPos.y);
            if (dx > 4 || dy > 4) {
              this._hasDragged = true;
            }

            this.dragNode.x = Math.max(10, Math.round(curX));
            this.dragNode.y = Math.max(10, Math.round(curY));

            container.innerHTML = this.renderFlowGraph(nodes, edges);
          };

          const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            if (this.isDragging && this.dragNode) {
              if (this._hasDragged) {
                this.pushHistory(`Reposition ${this.dragNode.type} node`);
              }
              this.isDragging = false;
              this.dragNode = null;
              this.updateGraph();
            }
          };

          window.addEventListener('mousemove', onMouseMove);
          window.addEventListener('mouseup', onMouseUp);
        });
      });
    }, 0);

    this.updateDagStatusBadge();
  }

  renderFlowGraph(nodes, edges) {
    const validation = FlowEngine.validateGraph(this.currentFlow.flow_data);

    const defs = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#94A3B8" />
        </marker>
        <marker id="arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#4F46E5" />
        </marker>
        <marker id="arrow-yes" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#16A34A" />
        </marker>
        <marker id="arrow-no" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#EA580C" />
        </marker>
        <marker id="arrow-slate" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
        </marker>
      </defs>
    `;

    const renderEdge = (edge) => {
      const from = nodes.find(n => n.id === edge.fromId);
      const to = nodes.find(n => n.id === edge.toId);
      if (!from || !to) return '';

      const x1 = from.x + from.width / 2;
      const y1 = from.y + from.height;
      const x2 = to.x + to.width / 2;
      const y2 = to.y;

      const path = `M ${x1} ${y1} C ${x1} ${y1 + 45}, ${x2} ${y2 - 45}, ${x2} ${y2}`;
      
      const isSelected = this.selectedNodeId === from.id || this.selectedNodeId === to.id;

      // Section 3.3 Visual Condition Badges on Canvas (Color-coded)
      const cond = (edge.condition || '').trim().toLowerCase();
      const condOpt = (edge.condition_option_id || '').trim().toLowerCase();

      let color = isSelected ? '#4F46E5' : '#94A3B8';
      let marker = isSelected ? 'url(#arrow-selected)' : 'url(#arrow)';
      let badgeBg = '#F1F5F9';
      let badgeStroke = '#64748B';
      let badgeText = '#334155';

      if (cond === 'yes' || cond.includes('yes') || condOpt === 'opt_yes' || cond === 'opt_yes' || cond === 'true' || cond === 'ඔව්') {
        color = '#16A34A';
        marker = 'url(#arrow-yes)';
        badgeBg = '#DCFCE7';
        badgeStroke = '#16A34A';
        badgeText = '#15803D';
      } else if (cond === 'no' || cond.includes('no') || condOpt === 'opt_no' || cond === 'opt_no' || cond === 'false' || cond === 'නැත') {
        color = '#EA580C';
        marker = 'url(#arrow-no)';
        badgeBg = '#FFEDD5';
        badgeStroke = '#EA580C';
        badgeText = '#C2410C';
      } else if (edge.condition || edge.condition_option_id) {
        // Slate pill for specific multi-choice values
        color = isSelected ? '#4F46E5' : '#64748B';
        marker = isSelected ? 'url(#arrow-selected)' : 'url(#arrow-slate)';
        badgeBg = '#F1F5F9';
        badgeStroke = '#64748B';
        badgeText = '#334155';
      }

      let labelHtml = '';
      const displayCondition = edge.condition || edge.condition_option_id;
      if (displayCondition && displayCondition.trim() !== '') {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const labelText = displayCondition.trim();
        const pillWidth = Math.max(54, labelText.length * 7.5 + 18);
        const pillHeight = 22;

        labelHtml = `
          <g transform="translate(${mx - pillWidth / 2}, ${my - pillHeight / 2})">
            <rect width="${pillWidth}" height="${pillHeight}" rx="11" fill="${badgeBg}" stroke="${badgeStroke}" stroke-width="1.5" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.06))"/>
            <text x="${pillWidth / 2}" y="15" font-size="10.5" font-weight="bold" fill="${badgeText}" text-anchor="middle" font-family="'Poppins', sans-serif">${labelText}</text>
          </g>
        `;
      }

      return `
        <g class="fb-edge-group">
          <path d="${path}" fill="none" stroke="${color}" stroke-width="${isSelected ? '2.5' : '1.8'}" marker-end="${marker}" />
          ${labelHtml}
        </g>
      `;
    };

    const renderNode = (node) => {
      const isSelected = node.id === this.selectedNodeId;
      let bgColor = '#EFF6FF';
      let strokeColor = '#3B82F6';
      let icon = '❓';
      let typeLabel = 'QUESTION';

      // 4 Core Node Types (Section 3.1)
      if (node.type === 'task') {
        bgColor = '#FAF5FF';
        strokeColor = '#8B5CF6';
        icon = '📋';
        typeLabel = 'TASK';
      } else if (node.type === 'branch') {
        bgColor = '#FFFBEB';
        strokeColor = '#F59E0B';
        icon = '🔀';
        typeLabel = 'BRANCH';
      } else if (node.type === 'end') {
        bgColor = '#F0FDF4';
        strokeColor = '#10B981';
        icon = '🏁';
        typeLabel = 'END';
      }

      // Section 3.5 Canvas Linter Warnings (Orphan & Dead-End reachability)
      const isOrphan = validation.orphanNodes.some(on => on.id === node.id);
      const isDeadEnd = validation.deadEndNodes.some(den => den.id === node.id);

      let linterBadge = '';
      if (isOrphan) {
        strokeColor = '#EF4444';
        linterBadge = `
          <g transform="translate(10, ${node.height - 18})">
            <rect width="84" height="13" rx="3" fill="#FEF2F2" stroke="#EF4444" stroke-width="0.8"/>
            <text x="42" y="9.5" font-size="8" font-weight="bold" fill="#DC2626" text-anchor="middle" font-family="'Poppins', sans-serif">⚠️ Disconnected</text>
          </g>
        `;
      } else if (isDeadEnd) {
        strokeColor = '#F59E0B';
        linterBadge = `
          <g transform="translate(10, ${node.height - 18})">
            <rect width="78" height="13" rx="3" fill="#FFFBEB" stroke="#F59E0B" stroke-width="0.8"/>
            <text x="39" y="9.5" font-size="8" font-weight="bold" fill="#D97706" text-anchor="middle" font-family="'Poppins', sans-serif">⚠️ No End Path</text>
          </g>
        `;
      }

      const strokeWidth = isSelected ? '3' : '1.5';
      const strokeDash = (isOrphan || isDeadEnd) && !isSelected ? 'stroke-dasharray="4,3"' : '';
      const shadow = isSelected ? 'filter="drop-shadow(0px 4px 8px rgba(79, 70, 229, 0.25))"' : 'filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.05))"';

      const text = node.text_en || node.text_si || node.type;
      const truncated = text.length > 22 ? text.substring(0, 19) + '...' : text;

      // Calculate option summary if matrix exists
      let pointsBadge = '';
      if (node.type === 'question') {
        if (Array.isArray(node.options) && node.options.length > 0) {
          const pts = node.options.map(o => Number(o.points) || 0);
          const minPt = Math.min(...pts);
          const maxPt = Math.max(...pts);
          pointsBadge = minPt === maxPt ? `${minPt} pts` : `${minPt} to ${maxPt > 0 ? '+' : ''}${maxPt} pts`;
        } else if (typeof node.points === 'number') {
          pointsBadge = `${node.points} pts`;
        }
      } else if (node.type === 'task') {
        pointsBadge = `+${node.points || 0} pts`;
      }

      return `
        <g class="fb-node cursor-grab transition-transform" data-id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <rect width="${node.width}" height="${node.height}" rx="8" fill="${bgColor}" stroke="${isSelected ? '#4F46E5' : strokeColor}" stroke-width="${strokeWidth}" ${strokeDash} ${shadow} />
          <text x="12" y="24" font-size="11.5" font-weight="bold" fill="#1E293B" font-family="'Poppins', sans-serif">${icon} ${typeLabel}</text>
          ${pointsBadge ? `<text x="${node.width - 12}" y="24" font-size="9.5" font-weight="bold" fill="#64748B" text-anchor="end" font-family="'Poppins', sans-serif">${pointsBadge}</text>` : ''}
          <text x="12" y="${linterBadge ? 42 : 47}" font-size="11" fill="#475569" font-family="'Noto Sans Sinhala', 'Poppins', sans-serif">${truncated}</text>
          ${linterBadge}
        </g>
      `;
    };

    return `
      <svg width="${this.svgWidth}" height="${this.svgHeight}" style="background-color: transparent;">
        ${defs}
        ${edges.map(renderEdge).join('')}
        ${nodes.map(renderNode).join('')}
      </svg>
    `;
  }

  renderOptionRowHtml(node, opt, idx, availableNodes, outgoingEdges) {
    const currentEdge = outgoingEdges.find(e => 
      e.condition_option_id === opt.id || 
      e.condition_value === opt.id ||
      e.condition === opt.id ||
      (opt.text_en && e.condition === opt.text_en) ||
      (opt.text_si && e.condition === opt.text_si)
    );
    const linkedTargetNode = currentEdge ? availableNodes.find(n => n.id === currentEdge.toId) : null;
    const targetLabel = linkedTargetNode 
      ? `[${linkedTargetNode.type.toUpperCase()}] ${linkedTargetNode.text_en || linkedTargetNode.text_si || linkedTargetNode.id}`
      : (currentEdge ? `[NODE] ${currentEdge.toId}` : '');

    return `
      <div class="p-3 bg-white rounded-lg border ${currentEdge ? 'border-indigo-300 shadow-xs' : 'border-slate-200 shadow-2xs'} option-row flex flex-col gap-2 hover:border-slate-300 transition" data-idx="${idx}" data-opt-id="${opt.id}">
        <!-- Row 1: Index, Sinhala Label, Points, Delete -->
        <div class="flex items-center gap-2">
          <span class="text-xs font-mono font-bold text-slate-400 w-5">#${idx + 1}</span>
          <input type="text" placeholder="Sinhala Label (e.g. ඔව් / 05:30ට පෙර / සම්පූර්ණයි)" value="${opt.text_si || ''}" class="opt-text-si flex-1 text-xs border-gray-300 rounded p-1.5 focus:border-indigo-500 font-['Noto_Sans_Sinhala']" />
          <div class="flex items-center gap-1">
            <span class="text-[10px] text-gray-400 font-medium">Pts:</span>
            <input type="number" placeholder="Points" value="${opt.points !== undefined ? opt.points : 0}" class="opt-points w-16 text-xs font-bold border-gray-300 rounded p-1.5 ${opt.points < 0 ? 'text-red-600 bg-red-50' : (opt.points > 0 ? 'text-green-600' : 'text-gray-700')}" />
          </div>
          <button type="button" class="opt-delete text-gray-400 hover:text-red-600 p-1 text-xs transition" title="Remove Option">
            <i class="fas fa-trash-alt"></i>
          </button>
        </div>

        <!-- Row 2: English Label & Option ID -->
        <div class="flex items-center gap-2 pl-7">
          <input type="text" placeholder="English Label (e.g. Yes / Before 05:30 / Completed)" value="${opt.text_en || ''}" class="opt-text-en flex-1 text-xs border-gray-200 rounded p-1 text-gray-600 focus:border-indigo-500" />
          <span class="text-[10px] text-gray-400 font-mono bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">ID: ${opt.id}</span>
        </div>

        <!-- Row 3: Step 1 - Direct Inline Branching for this Answer -->
        <div class="mt-1 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 pl-7 ${currentEdge ? 'bg-indigo-50/70 border border-indigo-100' : 'bg-slate-50/70'} p-2 rounded-md">
          <div class="flex items-center gap-1.5 flex-1 min-w-[210px]">
            <span class="text-[11px] font-semibold text-slate-700 flex items-center gap-1 whitespace-nowrap">
              <i class="fas fa-code-branch text-indigo-500"></i> Flow for this answer:
            </span>
            <select class="opt-branch-select text-xs border-gray-300 rounded px-2 py-1 bg-white font-medium text-slate-800 focus:ring-indigo-500 focus:border-indigo-500 flex-1 min-w-[140px]" data-opt-id="${opt.id}" data-opt-label="${opt.text_en || opt.text_si || opt.id}">
              <option value="">-- No Branch / End of Flow --</option>
              ${availableNodes.map(an => `
                <option value="${an.id}" ${currentEdge?.toId === an.id ? 'selected' : ''}>
                  ${an.type.toUpperCase()}: ${(an.text_en || an.text_si || an.id).substring(0, 22)}
                </option>
              `).join('')}
              <optgroup label="Create & Branch">
                <option value="__NEW_QUESTION__">+ Create Next Question Step...</option>
                <option value="__NEW_TASK__">+ Create Next Task Step...</option>
                <option value="__NEW_END__">+ Create Next End Step...</option>
              </optgroup>
            </select>
          </div>

          <div class="flex items-center gap-1.5">
            ${currentEdge ? `
              <span class="text-[10px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300 flex items-center gap-1" title="${targetLabel}">
                <i class="fas fa-check text-[9px]"></i> Connected: ${linkedTargetNode ? (linkedTargetNode.text_en || linkedTargetNode.type).substring(0, 16) : currentEdge.toId}
              </span>
              <button type="button" class="opt-disconnect-btn text-xs text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded" data-opt-id="${opt.id}" title="Disconnect Branch">
                <i class="fas fa-unlink"></i>
              </button>
            ` : `
              <button type="button" class="opt-add-step-btn text-[11px] bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-2.5 py-1 rounded shadow-2xs flex items-center gap-1 transition" data-opt-id="${opt.id}" data-opt-label="${opt.text_en || opt.text_si || opt.id}">
                <i class="fas fa-plus-circle text-xs"></i> + Create Next Flow Step
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }

  createNextStepForOption(sourceNode, opt, stepType = 'question') {
    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    
    // Position intelligently: offset from current node
    const sourceX = (sourceNode.x !== undefined && sourceNode.x !== null) ? sourceNode.x : 100;
    const sourceY = (sourceNode.y !== undefined && sourceNode.y !== null) ? sourceNode.y : 100;
    
    const optIdx = (sourceNode.options || []).findIndex(o => o.id === opt.id);
    const fanIndex = optIdx >= 0 ? optIdx : 0;
    const posX = sourceX + 260;
    const posY = Math.max(20, sourceY + (fanIndex * 110) - 30);

    let newNode = null;
    if (stepType === 'task') {
      const firstTask = this.activeTasks && this.activeTasks.length > 0 ? this.activeTasks[0] : null;
      newNode = {
        id,
        type: 'task',
        x: posX,
        y: posY,
        task_id: firstTask ? firstTask.id : null,
        text_en: `Task for "${opt.text_en || opt.id}"`,
        text_si: `කාර්යය (${opt.text_si || opt.id} සඳහා)`,
        points: firstTask ? (firstTask.weight_points || 15) : 15,
        options: [
          { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: firstTask ? (firstTask.weight_points || 15) : 15 },
          { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
        ],
        task_payload: firstTask ? {
          id: firstTask.id,
          title_si: firstTask.title_si,
          title_en: firstTask.title_en,
          category: firstTask.category,
          tier: firstTask.tier,
          weight_points: firstTask.weight_points,
          schema_definition: firstTask.schema_definition
        } : null
      };
    } else if (stepType === 'end') {
      newNode = {
        id,
        type: 'end',
        x: posX,
        y: posY,
        text_en: `End: Complete after "${opt.text_en || opt.id}"`,
        text_si: `අවසන්: ${opt.text_si || opt.id} පසු අවසන්`
      };
    } else {
      newNode = {
        id,
        type: 'question',
        x: posX,
        y: posY,
        text_en: `Question for "${opt.text_en || opt.id}"`,
        text_si: `ප්‍රශ්නය (${opt.text_si || opt.id} සඳහා)`,
        input_type: 'choice',
        options: [
          { id: 'opt_1', text_si: 'ඔව්', text_en: 'Yes', points: 10 },
          { id: 'opt_2', text_si: 'නැත', text_en: 'No',  points: 0 }
        ]
      };
    }

    this.currentFlow.flow_data.nodes.push(newNode);

    // Remove any existing edge for this option from this sourceNode
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => 
      !(e.fromId === sourceNode.id && (
        e.condition_option_id === opt.id || 
        e.condition_value === opt.id || 
        e.condition === opt.id || 
        (opt.text_en && e.condition === opt.text_en) ||
        (opt.text_si && e.condition === opt.text_si)
      ))
    );

    // Create edge bound to this option
    this.currentFlow.flow_data.edges.push({
      fromId: sourceNode.id,
      toId: newNode.id,
      condition: opt.text_en || opt.text_si || opt.id,
      condition_option_id: opt.id,
      condition_value: opt.id
    });

    this.pushHistory(`Add ${stepType} branch for answer "${opt.text_en || opt.id}"`);
    this.updateGraph();
    this.renderNodeEditor(sourceNode);
    this.toast(`Added new ${stepType} node branched from "${opt.text_en || opt.id}"`, 'success');
  }

  handleBranchSelect(sourceNode, opt, targetVal) {
    if (targetVal === '__NEW_QUESTION__') {
      this.createNextStepForOption(sourceNode, opt, 'question');
      return;
    }
    if (targetVal === '__NEW_TASK__') {
      this.createNextStepForOption(sourceNode, opt, 'task');
      return;
    }
    if (targetVal === '__NEW_END__') {
      this.createNextStepForOption(sourceNode, opt, 'end');
      return;
    }

    // Remove existing edge for this option
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => 
      !(e.fromId === sourceNode.id && (
        e.condition_option_id === opt.id || 
        e.condition_value === opt.id || 
        e.condition === opt.id || 
        (opt.text_en && e.condition === opt.text_en) ||
        (opt.text_si && e.condition === opt.text_si)
      ))
    );

    if (targetVal) {
      this.currentFlow.flow_data.edges.push({
        fromId: sourceNode.id,
        toId: targetVal,
        condition: opt.text_en || opt.text_si || opt.id,
        condition_option_id: opt.id,
        condition_value: opt.id
      });
      this.pushHistory(`Branch answer "${opt.text_en || opt.id}" to node`);
      this.toast(`Connected answer "${opt.text_en || opt.id}" to target node`, 'success');
    } else {
      this.pushHistory(`Disconnect branch for answer "${opt.text_en || opt.id}"`);
      this.toast(`Disconnected branch for "${opt.text_en || opt.id}"`, 'info');
    }

    this.updateGraph();
    this.renderNodeEditor(sourceNode);
  }

  disconnectOptionBranch(sourceNode, opt) {
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => 
      !(e.fromId === sourceNode.id && (
        e.condition_option_id === opt.id || 
        e.condition_value === opt.id || 
        e.condition === opt.id || 
        (opt.text_en && e.condition === opt.text_en) ||
        (opt.text_si && e.condition === opt.text_si)
      ))
    );
    this.pushHistory(`Disconnect branch for answer "${opt.text_en || opt.id}"`);
    this.updateGraph();
    this.renderNodeEditor(sourceNode);
    this.toast(`Disconnected branch for "${opt.text_en || opt.id}"`, 'info');
  }

  renderNodeEditor(node) {
    const editorEl = document.getElementById('fb-node-editor');
    if (!node) {
      editorEl.innerHTML = `
        <div class="p-8 text-center text-gray-400 mt-20">
          <i class="fas fa-mouse-pointer text-4xl mb-4 text-gray-300"></i>
          <p class="font-medium">Select a node on the canvas to configure options, scoring, and conditional branching</p>
        </div>
      `;
      return;
    }

    const availableNodes = this.currentFlow.flow_data.nodes.filter(n => n.id !== node.id);
    const outgoingEdges = this.currentFlow.flow_data.edges.filter(e => e.fromId === node.id);

    const isOptionInput = ['choice', 'select', 'radio', 'time-range', 'boolean'].includes(node.input_type);
    const normalizedOptions = FlowEngine.normalizeOptions(node.options);

    let specificFields = '';

    // Task Node Configuration (Section 2.2 & 3.1 + Task Answers Branching)
    if (node.type === 'task') {
      const activeTasks = this.activeTasks || [];
      const currentTask = activeTasks.find(t => t.id === node.task_id);

      // Default task options/outcomes if not initialized
      if (!Array.isArray(node.options) || node.options.length === 0) {
        node.options = [
          { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: node.points || (currentTask?.weight_points || 15) },
          { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
        ];
      }
      const taskOptions = FlowEngine.normalizeOptions(node.options);

      specificFields = `
        <div class="mb-5 bg-purple-50 p-3.5 rounded-lg border border-purple-200">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-bold text-purple-900 uppercase tracking-wider"><i class="fas fa-tasks mr-1"></i> Link to wosandi_tasks Record</span>
          </div>
          <p class="text-xs text-purple-700 mb-3">Embed active task from wosandi_tasks as an actionable step or assignment payload in this flow</p>
          
          <div class="mb-3">
            <label class="block text-xs font-semibold text-slate-700 mb-1">Select Active Task</label>
            <select id="ne-task-selector" class="w-full text-xs border-purple-300 rounded shadow-xs focus:ring-purple-500 focus:border-purple-500 bg-white">
              <option value="">-- Choose Task from wosandi_tasks --</option>
              ${activeTasks.map(t => `
                <option value="${t.id}" ${node.task_id === t.id ? 'selected' : ''}>
                  [${t.category || 'General'}] ${t.title_en || t.title_si} (+${t.weight_points || 0} pts)
                </option>
              `).join('')}
            </select>
          </div>

          ${currentTask ? `
            <div class="p-2.5 bg-white rounded border border-purple-200 text-xs space-y-1.5 shadow-2xs">
              <div class="flex justify-between">
                <span class="text-slate-500 font-medium">Category / Tier:</span>
                <span class="font-semibold text-slate-800 uppercase">${currentTask.category || 'academic'} (${currentTask.tier || 'core'})</span>
              </div>
              <div class="flex justify-between">
                <span class="text-slate-500 font-medium">Weight Points:</span>
                <span class="font-bold text-green-600">+${currentTask.weight_points || 0} pts</span>
              </div>
              ${currentTask.schema_definition?.description ? `
                <div class="pt-1 border-t border-purple-100">
                  <span class="text-slate-500 block text-[11px]">Instructions:</span>
                  <p class="text-slate-700 text-[11px]">${currentTask.schema_definition.description}</p>
                </div>
              ` : ''}
              ${currentTask.has_timer ? `
                <div class="flex items-center gap-1.5 text-indigo-600 font-medium text-[11px]">
                  <i class="fas fa-stopwatch"></i> Timer: ${Math.round((currentTask.timer_seconds || 0) / 60)} mins
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="mt-3">
            <label class="block text-xs font-semibold text-slate-700 mb-1">Step Completion Points</label>
            <input type="number" id="ne-points" value="${node.points !== undefined ? node.points : (currentTask?.weight_points || 15)}" class="w-full text-xs border-purple-300 rounded shadow-xs font-bold text-purple-900" />
          </div>
        </div>

        <!-- Task Answer Responses / Outcomes & Flow Branching (Step 1) -->
        <div class="mb-5 bg-purple-50/50 p-3.5 rounded-lg border border-purple-200">
          <div class="flex justify-between items-center mb-2.5">
            <div>
              <h4 class="text-xs font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1">
                <i class="fas fa-code-branch text-purple-600"></i> Task Answers & Flow Branching
              </h4>
              <p class="text-xs text-purple-700">Add a flow branch for each answer/outcome of this task (e.g. Completed vs Incomplete)</p>
            </div>
            <button type="button" id="ne-add-option-btn" class="text-xs bg-purple-100 hover:bg-purple-200 text-purple-800 border border-purple-300 px-2.5 py-1 rounded font-semibold transition flex items-center gap-1">
              <i class="fas fa-plus text-[10px]"></i> Add Task Answer
            </button>
          </div>

          <!-- Presets -->
          <div class="mb-3 flex items-center gap-2">
            <span class="text-[11px] text-purple-700 font-medium">Presets:</span>
            <button type="button" id="ne-task-preset-done-missed" class="text-[11px] px-2 py-0.5 rounded bg-white border border-purple-200 text-purple-800 hover:bg-purple-100">
              Completed / Missed
            </button>
            <button type="button" id="ne-task-preset-tiers" class="text-[11px] px-2 py-0.5 rounded bg-white border border-purple-200 text-purple-800 hover:bg-purple-100">
              Done / Partial / Missed
            </button>
          </div>

          <div id="ne-options-matrix-container" class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            ${taskOptions.map((opt, idx) => this.renderOptionRowHtml(node, opt, idx, availableNodes, outgoingEdges)).join('')}
          </div>
        </div>
      `;
    } else if (node.type === 'question') {
      specificFields = `
        <div class="mb-5">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">Input Type</label>
          <select id="ne-input-type" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="choice" ${node.input_type === 'choice' ? 'selected' : ''}>Multiple Choice (Options Matrix)</option>
            <option value="select" ${node.input_type === 'select' ? 'selected' : ''}>Select Dropdown (Options Matrix)</option>
            <option value="radio" ${node.input_type === 'radio' ? 'selected' : ''}>Radio Buttons (Options Matrix)</option>
            <option value="time-range" ${node.input_type === 'time-range' ? 'selected' : ''}>Time Range (Options Matrix)</option>
            <option value="boolean" ${node.input_type === 'boolean' ? 'selected' : ''}>Yes / No (Options Matrix)</option>
            <option value="text" ${node.input_type === 'text' ? 'selected' : ''}>Text Input (Static Points)</option>
            <option value="scale" ${node.input_type === 'scale' ? 'selected' : ''}>Scale 1-10 (Static Points)</option>
          </select>
        </div>

        ${isOptionInput ? `
          <!-- Section 4.1 & 4.2 Per-Option Dynamic Scoring Matrix & Step 1 Direct Inline Branching -->
          <div class="mb-5 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div class="flex justify-between items-center mb-2.5">
              <div>
                <h4 class="text-xs font-bold text-slate-800 uppercase tracking-wider">Per-Option Scoring Matrix & Flow Branching</h4>
                <p class="text-xs text-slate-500">Define answer options, assign points, and branch next flow step for each answer</p>
              </div>
              <button type="button" id="ne-add-option-btn" class="text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded font-semibold transition flex items-center gap-1">
                <i class="fas fa-plus text-[10px]"></i> Add Option
              </button>
            </div>

            <!-- Presets -->
            <div class="mb-3 flex items-center gap-2">
              <span class="text-[11px] text-gray-500 font-medium">Presets:</span>
              <button type="button" id="ne-preset-morning" class="text-[11px] px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">
                Wakeup (-20 After 6:30)
              </button>
              <button type="button" id="ne-preset-yesno" class="text-[11px] px-2 py-0.5 rounded bg-white border border-gray-300 text-gray-700 hover:bg-gray-100">
                Yes (+10) / No (0)
              </button>
            </div>

            <div id="ne-options-matrix-container" class="space-y-2.5 max-h-80 overflow-y-auto pr-1">
              ${normalizedOptions.map((opt, idx) => this.renderOptionRowHtml(node, opt, idx, availableNodes, outgoingEdges)).join('')}
            </div>
          </div>
        ` : `
          <!-- Static Points Input -->
          <div class="mb-5">
            <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Static Points Value</label>
            <input type="number" id="ne-points" value="${node.points || 0}" class="w-full text-sm border-gray-300 rounded-md shadow-sm" />
          </div>
        `}
      `;
    }

    // Section 3.2: Multi-Branch Conditional Routing & Option_ID Binding
    const edgesHtml = `
      <div class="mt-6 border-t pt-4">
        <div class="flex justify-between items-center mb-2">
          <h4 class="text-xs font-bold text-gray-700 uppercase tracking-wider">Outgoing Connectors & Conditions</h4>
          <span class="text-xs text-gray-400">${outgoingEdges.length} active</span>
        </div>
        <p class="text-xs text-gray-500 mb-3">Multi-branch conditional routing: edge executes when Answer == Option_ID. A single question/task can branch to distinct target nodes.</p>

        <div class="space-y-2.5 mb-3">
          ${outgoingEdges.map((e, idx) => {
            const targetNode = availableNodes.find(n => n.id === e.toId);
            const allOpts = FlowEngine.normalizeOptions(node.options);
            return `
              <div class="p-2.5 bg-gray-50 rounded border border-gray-200 shadow-2xs space-y-2">
                <div class="flex items-center justify-between gap-2">
                  <span class="text-xs font-bold text-slate-700">Connector #${idx + 1}</span>
                  <button type="button" class="text-red-500 hover:text-red-700 edge-remove p-1 text-xs" data-to="${e.toId}" title="Remove Connector">
                    <i class="fas fa-times mr-1"></i> Remove
                  </button>
                </div>

                <!-- Condition Binding -->
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-gray-500 w-16">Condition:</span>
                  ${allOpts.length > 0 ? `
                    <select class="edge-condition-picker flex-1 text-xs border-gray-300 rounded p-1 font-semibold" data-to="${e.toId}">
                      <option value="" ${!e.condition && !e.condition_option_id ? 'selected' : ''}>Default / Unconditional</option>
                      ${allOpts.map(opt => `
                        <option value="${opt.id}" data-text="${opt.text_en || opt.text_si}" ${(e.condition_option_id === opt.id || e.condition === (opt.text_en || opt.text_si) || e.condition === opt.id) ? 'selected' : ''}>
                          [${opt.id}] ${opt.text_en || opt.text_si} (${opt.points > 0 ? '+' : ''}${opt.points} pts)
                        </option>
                      `).join('')}
                    </select>
                  ` : `
                    <input type="text" placeholder="Condition text" value="${e.condition || ''}" class="edge-condition flex-1 text-xs border-gray-300 rounded p-1 font-semibold" data-to="${e.toId}" />
                  `}
                </div>

                <!-- Re-linking Target Node (Section 3.4) -->
                <div class="flex items-center gap-2">
                  <span class="text-[11px] text-gray-500 w-16">Routes to:</span>
                  <select class="edge-relink-target flex-1 text-xs border-gray-300 rounded p-1 font-semibold text-indigo-700 bg-white" data-from="${node.id}" data-current-to="${e.toId}">
                    ${availableNodes.map(an => `
                      <option value="${an.id}" ${an.id === e.toId ? 'selected' : ''}>
                        ${an.type.toUpperCase()}: ${an.text_en ? an.text_en.substring(0, 24) : an.id}
                      </option>
                    `).join('')}
                  </select>
                </div>
              </div>
            `;
          }).join('')}
        </div>
        
        <!-- Add New Edge Controls -->
        <div class="p-2.5 bg-slate-50 border border-slate-200 rounded-md">
          <span class="block text-xs font-bold text-gray-600 mb-1.5">Add Outgoing Connector</span>
          <div class="space-y-2">
            ${FlowEngine.normalizeOptions(node.options).length > 0 ? `
              <div>
                <label class="block text-[11px] text-gray-500 mb-1">Bind Condition (Answer == Option_ID):</label>
                <select id="ne-option-condition-picker" class="w-full text-xs border-gray-300 rounded shadow-xs">
                  <option value="">Default / Unconditional Path</option>
                  ${FlowEngine.normalizeOptions(node.options).map(opt => `
                    <option value="${opt.id}" data-text="${opt.text_en || opt.text_si}">
                      [${opt.id}] ${opt.text_en || opt.text_si} (${opt.points > 0 ? '+' : ''}${opt.points} pts)
                    </option>
                  `).join('')}
                </select>
              </div>
            ` : ''}

            <div class="flex gap-2">
              <select id="ne-new-edge-to" class="flex-1 text-xs border-gray-300 rounded shadow-xs">
                <option value="">Select Target Node...</option>
                ${availableNodes.map(n => `<option value="${n.id}">${n.type.toUpperCase()}: ${n.text_en ? n.text_en.substring(0, 24) : n.id}</option>`).join('')}
              </select>
              <button id="ne-add-edge" type="button" class="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded text-xs font-medium shadow-xs">Connect</button>
            </div>
          </div>
        </div>
      </div>
    `;

    editorEl.innerHTML = `
      <div class="p-6">
        <div class="flex justify-between items-center mb-5 pb-3 border-b">
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-gray-800">Configure Node</span>
            <span class="text-xs px-2 py-0.5 rounded font-mono font-semibold uppercase bg-slate-100 text-slate-700">${node.type}</span>
          </div>
          <span class="text-xs text-gray-400 font-mono">${node.id}</span>
        </div>

        ${node.type !== 'end' ? `
        <div class="mb-4">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Prompt / Question / Task (Sinhala)</label>
          <textarea id="ne-text-si" rows="2" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 font-['Noto_Sans_Sinhala']">${node.text_si || ''}</textarea>
        </div>
        
        <div class="mb-4">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Prompt / Question / Task (English)</label>
          <textarea id="ne-text-en" rows="2" class="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">${node.text_en || ''}</textarea>
        </div>
        ` : `
        <div class="mb-4">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Completion Message (Sinhala)</label>
          <input type="text" id="ne-text-si" value="${node.text_si || ''}" class="w-full text-sm border-gray-300 rounded-md shadow-sm font-['Noto_Sans_Sinhala']" />
        </div>
        <div class="mb-4">
          <label class="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">Completion Message (English)</label>
          <input type="text" id="ne-text-en" value="${node.text_en || ''}" class="w-full text-sm border-gray-300 rounded-md shadow-sm" />
        </div>
        `}

        ${specificFields}
        ${node.type !== 'end' ? edgesHtml : ''}

        <div class="mt-8 pt-4 border-t flex justify-end">
          <button id="ne-delete" type="button" class="text-red-600 hover:text-red-800 font-medium text-xs flex items-center gap-1.5 p-2 rounded hover:bg-red-50 transition">
            <i class="fas fa-trash-alt"></i> Delete Node
          </button>
        </div>
      </div>
    `;

    this.attachNodeEditorListeners(node);
  }

  attachNodeEditorListeners(node) {
    if (document.getElementById('ne-text-si')) {
      document.getElementById('ne-text-si').addEventListener('input', (e) => {
        node.text_si = e.target.value;
        this.updateGraph();
      });
      document.getElementById('ne-text-si').addEventListener('change', () => {
        this.pushHistory('Update node Sinhala text');
      });
    }

    if (document.getElementById('ne-text-en')) {
      document.getElementById('ne-text-en').addEventListener('input', (e) => {
        node.text_en = e.target.value;
        this.updateGraph();
      });
      document.getElementById('ne-text-en').addEventListener('change', () => {
        this.pushHistory('Update node English text');
      });
    }

    // Task Node Selector Listener (Section 2.2)
    if (document.getElementById('ne-task-selector')) {
      document.getElementById('ne-task-selector').addEventListener('change', (e) => {
        const taskId = e.target.value;
        const task = (this.activeTasks || []).find(t => t.id === taskId);
        if (task) {
          node.task_id = task.id;
          node.text_si = task.title_si || node.text_si || '';
          node.text_en = task.title_en || node.text_en || '';
          node.points = task.weight_points !== undefined ? task.weight_points : 15;
          node.task_payload = {
            id: task.id,
            title_si: task.title_si,
            title_en: task.title_en,
            category: task.category,
            tier: task.tier,
            weight_points: task.weight_points,
            schema_definition: task.schema_definition
          };
          if (!Array.isArray(node.options) || node.options.length === 0) {
            node.options = [
              { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: task.weight_points || 15 },
              { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
            ];
          } else {
            const doneOpt = node.options.find(o => o.id === 'opt_done');
            if (doneOpt && task.weight_points !== undefined) {
              doneOpt.points = task.weight_points;
            }
          }
          this.pushHistory(`Link task "${task.title_en || task.id}" to node`);
          this.renderNodeEditor(node);
          this.updateGraph();
        } else {
          node.task_id = null;
          node.task_payload = null;
          this.pushHistory('Unlink task from node');
          this.renderNodeEditor(node);
          this.updateGraph();
        }
      });
    }
    
    if (document.getElementById('ne-input-type')) {
      document.getElementById('ne-input-type').addEventListener('change', (e) => { 
        node.input_type = e.target.value;
        if (['choice', 'select', 'radio', 'time-range', 'boolean'].includes(node.input_type)) {
          if (!Array.isArray(node.options) || node.options.length === 0) {
            node.options = [
              { id: 'opt_1', text_si: 'විකල්පය 1', text_en: 'Option 1', points: 10 },
              { id: 'opt_2', text_si: 'විකල්පය 2', text_en: 'Option 2', points: 0 }
            ];
          }
        }
        this.pushHistory(`Change input type to ${node.input_type}`);
        this.renderNodeEditor(node); 
        this.updateGraph();
      });
    }

    if (document.getElementById('ne-points')) {
      document.getElementById('ne-points').addEventListener('change', (e) => {
        node.points = Number(e.target.value) || 0;
        this.pushHistory('Update static points');
        this.updateGraph();
      });
    }

    // Options Matrix Listeners (Section 4.1 & 4.2)
    const saveOptionsFromDom = () => {
      const rows = document.querySelectorAll('.option-row');
      const updated = [];
      rows.forEach((row, i) => {
        const optId = row.dataset.optId || `opt_${i + 1}`;
        const textSi = row.querySelector('.opt-text-si')?.value || '';
        const textEn = row.querySelector('.opt-text-en')?.value || '';
        const pts = parseFloat(row.querySelector('.opt-points')?.value) || 0;
        updated.push({
          id: optId,
          text_si: textSi,
          text_en: textEn,
          points: pts
        });
      });
      node.options = updated;
      this.updateGraph();
    };

    document.querySelectorAll('.opt-text-si, .opt-text-en, .opt-points').forEach(input => {
      input.addEventListener('input', () => {
        saveOptionsFromDom();
      });
      input.addEventListener('change', () => {
        this.pushHistory('Edit option matrix');
      });
    });

    document.querySelectorAll('.opt-delete').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const row = e.target.closest('.option-row');
        if (row) {
          const optId = row.dataset.optId;
          if (optId) {
            this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(ed => 
              !(ed.fromId === node.id && (
                ed.condition_option_id === optId || 
                ed.condition_value === optId || 
                ed.condition === optId
              ))
            );
          }
          row.remove();
          saveOptionsFromDom();
          this.pushHistory('Remove option');
          this.renderNodeEditor(node);
          this.updateGraph();
        }
      });
    });

    // Step 1: Direct Inline Branching Listeners on Each Option Row
    document.querySelectorAll('.opt-branch-select').forEach(sel => {
      sel.addEventListener('change', (e) => {
        const optId = e.target.dataset.optId;
        const opt = (node.options || []).find(o => o.id === optId) || { id: optId, text_en: e.target.dataset.optLabel };
        this.handleBranchSelect(node, opt, e.target.value);
      });
    });

    document.querySelectorAll('.opt-add-step-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const optId = e.currentTarget.dataset.optId;
        const opt = (node.options || []).find(o => o.id === optId) || { id: optId, text_en: e.currentTarget.dataset.optLabel };
        this.createNextStepForOption(node, opt, 'question');
      });
    });

    document.querySelectorAll('.opt-disconnect-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const optId = e.currentTarget.dataset.optId;
        const opt = (node.options || []).find(o => o.id === optId) || { id: optId };
        this.disconnectOptionBranch(node, opt);
      });
    });

    if (document.getElementById('ne-add-option-btn')) {
      document.getElementById('ne-add-option-btn').addEventListener('click', () => {
        const current = FlowEngine.normalizeOptions(node.options);
        current.push({
          id: `opt_${current.length + 1}`,
          text_si: `විකල්පය ${current.length + 1}`,
          text_en: `Option ${current.length + 1}`,
          points: 10
        });
        node.options = current;
        this.pushHistory('Add option to matrix');
        this.renderNodeEditor(node);
        this.updateGraph();
      });
    }

    // Presets for Questions
    if (document.getElementById('ne-preset-morning')) {
      document.getElementById('ne-preset-morning').addEventListener('click', () => {
        node.options = [
          { id: 'opt_1', text_si: '05:30ට පෙර', text_en: 'Before 05:30', points: 20 },
          { id: 'opt_2', text_si: '06:00ට පෙර', text_en: 'Before 06:00', points: 15 },
          { id: 'opt_3', text_si: '06:30ට පෙර', text_en: 'Before 06:30', points: 10 },
          { id: 'opt_4', text_si: '06:30ට පසු',  text_en: 'After 06:30',  points: -20 }
        ];
        this.pushHistory('Apply Wakeup preset');
        this.renderNodeEditor(node);
        this.updateGraph();
      });
    }

    if (document.getElementById('ne-preset-yesno')) {
      document.getElementById('ne-preset-yesno').addEventListener('click', () => {
        node.options = [
          { id: 'opt_yes', text_si: 'ඔව්', text_en: 'Yes', points: 10 },
          { id: 'opt_no',  text_si: 'නැත', text_en: 'No',  points: 0 }
        ];
        this.pushHistory('Apply Yes/No preset');
        this.renderNodeEditor(node);
        this.updateGraph();
      });
    }

    // Presets for Tasks
    if (document.getElementById('ne-task-preset-done-missed')) {
      document.getElementById('ne-task-preset-done-missed').addEventListener('click', () => {
        node.options = [
          { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: node.points || 15 },
          { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
        ];
        this.pushHistory('Apply Completed/Missed preset for task');
        this.renderNodeEditor(node);
        this.updateGraph();
      });
    }

    if (document.getElementById('ne-task-preset-tiers')) {
      document.getElementById('ne-task-preset-tiers').addEventListener('click', () => {
        const fullPts = node.points || 20;
        node.options = [
          { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී (100%)', text_en: 'Completed (100%)', points: fullPts },
          { id: 'opt_partial', text_si: 'අර්ධ වශයෙන් (50%)', text_en: 'Partially Done (50%)', points: Math.round(fullPts / 2) },
          { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
        ];
        this.pushHistory('Apply 3-Tier Done/Partial/Missed preset for task');
        this.renderNodeEditor(node);
        this.updateGraph();
      });
    }

    // Section 3.2 & 3.4: Edge condition picker & relinking listeners
    document.querySelectorAll('.edge-condition-picker').forEach(el => {
      el.addEventListener('change', (e) => {
        const toId = e.target.dataset.to;
        const optId = e.target.value;
        const optText = e.target.selectedOptions[0]?.dataset?.text || optId;
        const edge = this.currentFlow.flow_data.edges.find(ed => ed.fromId === node.id && ed.toId === toId);
        if (edge) {
          edge.condition_option_id = optId;
          edge.condition_value = optId;
          edge.condition = optText;
          this.pushHistory(`Bind condition ${optId || 'Default'} to edge`);
          this.updateGraph();
          this.renderNodeEditor(node);
        }
      });
    });

    document.querySelectorAll('.edge-condition').forEach(el => {
      el.addEventListener('change', (e) => {
        const toId = e.target.dataset.to;
        const edge = this.currentFlow.flow_data.edges.find(ed => ed.fromId === node.id && ed.toId === toId);
        if (edge) {
          edge.condition = e.target.value;
          this.pushHistory(`Set condition on edge to ${toId}`);
          this.updateGraph();
          this.renderNodeEditor(node);
        }
      });
    });

    // Re-link target node (Section 3.4)
    document.querySelectorAll('.edge-relink-target').forEach(el => {
      el.addEventListener('change', (e) => {
        const fromId = e.target.dataset.from;
        const currentToId = e.target.dataset.currentTo;
        const newToId = e.target.value;

        const edge = this.currentFlow.flow_data.edges.find(ed => ed.fromId === fromId && ed.toId === currentToId);
        if (edge && newToId) {
          edge.toId = newToId;
          this.pushHistory(`Relink edge from ${fromId} to ${newToId}`);
          this.updateGraph();
          this.renderNodeEditor(node);
        }
      });
    });

    document.querySelectorAll('.edge-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        const toId = e.currentTarget.dataset.to;
        this.removeEdge(node.id, toId);
        this.pushHistory(`Remove edge to ${toId}`);
        this.updateGraph();
        this.renderNodeEditor(node);
      });
    });

    if (document.getElementById('ne-add-edge')) {
      document.getElementById('ne-add-edge').addEventListener('click', () => {
        const toId = document.getElementById('ne-new-edge-to').value;
        const picker = document.getElementById('ne-option-condition-picker');
        let conditionOptionId = '';
        let conditionText = '';

        if (picker) {
          conditionOptionId = picker.value;
          conditionText = picker.selectedOptions[0]?.dataset?.text || picker.value;
        }

        if (toId) {
          this.addEdge(node.id, toId, conditionText, conditionOptionId);
          this.pushHistory(`Add edge from ${node.id} to ${toId}`);
          this.updateGraph();
          this.renderNodeEditor(node);
        } else {
          this.toast('Please select a target node to connect', 'info');
        }
      });
    }

    document.getElementById('ne-delete').addEventListener('click', () => {
      this.removeNode(node.id);
      this.selectedNodeId = null;
      this.pushHistory(`Delete node ${node.id}`);
      this.updateGraph();
      this.renderNodeEditor(null);
    });
  }

  addNode(type = 'question') {
    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    let newNode = null;

    if (type === 'task') {
      const firstTask = this.activeTasks && this.activeTasks.length > 0 ? this.activeTasks[0] : null;
      newNode = {
        id,
        type: 'task',
        task_id: firstTask ? firstTask.id : null,
        text_en: firstTask ? (firstTask.title_en || firstTask.title_si) : 'New Task Assignment Step',
        text_si: firstTask ? (firstTask.title_si || firstTask.title_en) : 'නව කාර්ය පැවරුම් පියවර',
        points: firstTask ? (firstTask.weight_points || 15) : 15,
        options: [
          { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: firstTask ? (firstTask.weight_points || 15) : 15 },
          { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed / Incomplete', points: 0 }
        ],
        task_payload: firstTask ? {
          id: firstTask.id,
          title_si: firstTask.title_si,
          title_en: firstTask.title_en,
          category: firstTask.category,
          tier: firstTask.tier,
          weight_points: firstTask.weight_points,
          schema_definition: firstTask.schema_definition
        } : null
      };
    } else {
      newNode = {
        id,
        type,
        text_en: `New ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        text_si: '',
        input_type: type === 'question' ? 'choice' : null,
        options: type === 'question' ? [
          { id: 'opt_1', text_si: 'ඔව්', text_en: 'Yes', points: 10 },
          { id: 'opt_2', text_si: 'නැත', text_en: 'No',  points: 0 }
        ] : []
      };
    }

    this.currentFlow.flow_data.nodes.push(newNode);
    this.selectedNodeId = id;
    this.pushHistory(`Add ${type} node`);
    this.updateGraph();
    this.renderNodeEditor(newNode);
  }

  removeNode(nodeId) {
    this.currentFlow.flow_data.nodes = this.currentFlow.flow_data.nodes.filter(n => n.id !== nodeId);
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => e.fromId !== nodeId && e.toId !== nodeId);
  }

  addEdge(fromId, toId, condition = '', conditionOptionId = '') {
    const exists = this.currentFlow.flow_data.edges.find(e => e.fromId === fromId && e.toId === toId);
    if (!exists) {
      this.currentFlow.flow_data.edges.push({
        fromId,
        toId,
        condition,
        condition_option_id: conditionOptionId || '',
        condition_value: conditionOptionId || ''
      });
    } else {
      exists.condition = condition;
      exists.condition_option_id = conditionOptionId || '';
      exists.condition_value = conditionOptionId || '';
    }
  }

  removeEdge(fromId, toId) {
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => !(e.fromId === fromId && e.toId === toId));
  }

  async saveFlow(isPublish = false) {
    // 3.4 Graph Integrity & DAG Validation
    const validation = FlowEngine.validateGraph(this.currentFlow.flow_data);

    if (!validation.isValid) {
      this.openDagReportModal(validation, () => {
        // Blocked because cycle exists
      });
      return;
    }

    if (validation.warnings.length > 0 && isPublish) {
      const proceed = confirm(`Publish Warning:\n${validation.warnings.join('\n')}\n\nDo you want to publish anyway?`);
      if (!proceed) return;
    }

    try {
      const payload = {
        title_si: this.currentFlow.title || this.currentFlow.title_si || 'Untitled Flow',
        title_en: this.currentFlow.title_en || '',
        flow_type: this.currentFlow.flow_type || this.currentFlow.type || 'questionnaire',
        status: isPublish ? 'published' : (this.currentFlow.status || 'draft'),
        flow_data: this.currentFlow.flow_data || { nodes: [], edges: [], settings: { score_floor_zero: true, allow_negative_score: false } }
      };

      if (this.currentFlow.id) {
        await this.api.update(this.tableName, this.currentFlow.id, payload);
        this.toast(`Flow ${isPublish ? 'published' : 'saved'} successfully!`, 'success');
      } else {
        const res = await this.api.insert(this.tableName, payload);
        if (res && res.id) {
          this.currentFlow.id = res.id;
        } else if (res && res[0]?.id) {
          this.currentFlow.id = res[0].id;
        }
        this.toast(`Flow ${isPublish ? 'published' : 'created'} successfully!`, 'success');
      }

      this.render();
    } catch (e) {
      console.error(e);
      this.toast(`Error ${isPublish ? 'publishing' : 'saving'} flow`, 'error');
    }
  }

  async deleteFlow(flowId) {
    if (confirm('Are you sure you want to delete this flow? This cannot be undone.')) {
      try {
        await this.api.delete(this.tableName, flowId);
        this.toast('Flow deleted successfully', 'success');
        this.render();
      } catch (e) {
        this.toast('Error deleting flow', 'error');
      }
    }
  }

  openDagReportModal(customValidation = null, onProceed = null) {
    const modalContainer = document.getElementById('fb-dag-modal-container');
    if (!modalContainer) return;

    const validation = customValidation || FlowEngine.validateGraph(this.currentFlow.flow_data);

    modalContainer.innerHTML = `
      <div class="fixed inset-0 bg-slate-900 bg-opacity-60 flex items-center justify-center z-50 p-4">
        <div class="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col">
          <div class="px-6 py-4 border-b flex justify-between items-center ${validation.isValid ? 'bg-slate-50' : 'bg-red-50'}">
            <h3 class="font-bold text-base flex items-center gap-2 ${validation.isValid ? 'text-slate-800' : 'text-red-700'}">
              <i class="fas ${validation.isValid ? 'fa-shield-alt text-green-600' : 'fa-exclamation-triangle text-red-600'}"></i>
              Graph Integrity & DAG Report
            </h3>
            <button class="close-dag-modal text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
          </div>
          <div class="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
            <div>
              <span class="text-xs font-bold uppercase text-gray-500 tracking-wider">Status:</span>
              <p class="font-semibold text-sm mt-0.5 ${validation.isValid ? 'text-green-700' : 'text-red-600'}">
                ${validation.isValid ? '✓ Valid Directed Acyclic Graph (No Infinite Loops)' : '✗ Cycle Detected (Infinite Loop Violation)'}
              </p>
            </div>

            ${validation.errors.length > 0 ? `
              <div class="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 space-y-1">
                <span class="font-bold block">Critical Errors:</span>
                ${validation.errors.map(err => `<p class="flex items-center gap-1.5"><i class="fas fa-ban text-red-500"></i> ${err}</p>`).join('')}
              </div>
            ` : ''}

            ${validation.warnings.length > 0 ? `
              <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 space-y-1">
                <span class="font-bold block">Advisory Warnings:</span>
                ${validation.warnings.map(w => `<p class="flex items-center gap-1.5"><i class="fas fa-info-circle text-amber-500"></i> ${w}</p>`).join('')}
              </div>
            ` : `
              <p class="text-xs text-green-700 bg-green-50 p-2.5 rounded border border-green-200">
                All nodes are properly connected, lead to termination endpoints, and adhere to DAG constraints.
              </p>
            `}
          </div>
          <div class="px-6 py-3 border-t bg-gray-50 flex justify-end gap-2">
            <button class="close-dag-modal px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded">Close</button>
            ${validation.isValid && onProceed ? `<button id="fb-dag-proceed" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded">Proceed</button>` : ''}
          </div>
        </div>
      </div>
    `;

    modalContainer.querySelectorAll('.close-dag-modal').forEach(btn => {
      btn.addEventListener('click', () => { modalContainer.innerHTML = ''; });
    });

    if (document.getElementById('fb-dag-proceed')) {
      document.getElementById('fb-dag-proceed').addEventListener('click', () => {
        modalContainer.innerHTML = '';
        if (onProceed) onProceed();
      });
    }
  }

  openSimulatorModal() {
    const modalContainer = document.getElementById('fb-simulator-modal-container');
    if (!modalContainer) return;

    const flowData = this.currentFlow.flow_data;
    const nodes = flowData.nodes || [];
    const edges = flowData.edges || [];
    const scoreFloorZero = FlowEngine.isScoreFloorEnabled(flowData);

    if (nodes.length === 0) {
      this.toast('Cannot simulate empty flow', 'info');
      return;
    }

    // Determine start node (node with 0 incoming edges, or first node)
    const incomingCounts = {};
    nodes.forEach(n => incomingCounts[n.id] = 0);
    edges.forEach(e => { if (incomingCounts[e.toId] !== undefined) incomingCounts[e.toId]++; });
    const startNode = nodes.find(n => incomingCounts[n.id] === 0) || nodes[0];

    let currentNode = startNode;
    let accumulatedScore = 0;
    const pathHistory = [];

    const renderSimulatorState = () => {
      const isEnd = currentNode.type === 'end';
      const isTask = currentNode.type === 'task';
      const normalizedOpts = FlowEngine.normalizeOptions(currentNode.options);

      modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900 bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div class="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col">
            <!-- Modal Header -->
            <div class="px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex justify-between items-center">
              <div>
                <span class="text-xs uppercase tracking-wider text-blue-200 font-bold">Interactive Flow Simulator</span>
                <h3 class="font-bold text-lg leading-tight">${this.currentFlow.title || 'Flow Simulation'}</h3>
              </div>
              <button class="close-sim-modal text-blue-200 hover:text-white text-lg"><i class="fas fa-times"></i></button>
            </div>

            <!-- Score Banner -->
            <div class="px-6 py-3 bg-slate-100 border-b flex justify-between items-center text-sm">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-slate-700">Accumulated Score:</span>
                <span class="text-lg font-extrabold ${accumulatedScore < 0 ? 'text-red-600' : 'text-blue-700'}">${accumulatedScore > 0 ? '+' : ''}${accumulatedScore} pts</span>
              </div>
              <span class="text-xs font-semibold px-2 py-0.5 rounded ${scoreFloorZero ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}">
                Floor: ${scoreFloorZero ? '≥ 0 Clamp ON' : 'Negative Marks Allowed'}
              </span>
            </div>

            <!-- Main Body -->
            <div class="p-6 overflow-y-auto max-h-[60vh]">
              ${isEnd ? `
                <div class="text-center py-6">
                  <div class="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    🏁
                  </div>
                  <h4 class="text-xl font-bold text-gray-800 mb-1 font-['Noto_Sans_Sinhala']">${currentNode.text_si || 'දවසේ ඇගයීම සාර්ථකයි!'}</h4>
                  <p class="text-sm text-gray-500 mb-4">${currentNode.text_en || 'Assessment completed successfully!'}</p>
                  <div class="inline-block p-4 bg-slate-50 border rounded-lg text-center">
                    <span class="text-xs font-semibold text-gray-500 uppercase">Final Consolidated Score</span>
                    <p class="text-3xl font-extrabold text-indigo-600 mt-1">${accumulatedScore} pts</p>
                  </div>
                </div>
              ` : (isTask ? `
                <!-- Task Node Actionable Step -->
                <div class="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="w-7 h-7 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">📋</span>
                    <span class="text-xs font-bold text-purple-800 uppercase tracking-wider">Actionable Task Step</span>
                    <span class="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-bold">+${currentNode.points || 0} pts</span>
                  </div>
                  <h4 class="text-base font-bold text-slate-800 font-['Noto_Sans_Sinhala']">${currentNode.text_si || ''}</h4>
                  <p class="text-xs text-slate-600">${currentNode.text_en || ''}</p>
                  
                  ${currentNode.task_payload?.schema_definition?.description ? `
                    <div class="text-xs text-purple-900 bg-white p-2.5 rounded border border-purple-100 mt-2.5">
                      <span class="font-semibold block mb-0.5 text-purple-800">Task Instructions:</span>
                      ${currentNode.task_payload.schema_definition.description}
                    </div>
                  ` : ''}

                  ${normalizedOpts.length > 0 ? `
                    <div class="mt-4 space-y-2">
                      <span class="text-xs font-bold text-purple-900 uppercase">Select Task Outcome:</span>
                      <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${normalizedOpts.map(opt => `
                          <button type="button" class="sim-option-btn p-2.5 rounded-lg border border-purple-200 hover:border-purple-500 hover:bg-purple-100 text-left transition flex justify-between items-center bg-white" data-opt-id="${opt.id}" data-opt-en="${opt.text_en}" data-opt-si="${opt.text_si}">
                            <div>
                              <div class="font-bold text-xs text-slate-800">${opt.text_si || opt.text_en}</div>
                              ${opt.text_si && opt.text_en ? `<div class="text-[10px] text-slate-500">${opt.text_en}</div>` : ''}
                            </div>
                            <span class="text-xs font-bold px-2 py-0.5 rounded-full ${opt.points < 0 ? 'bg-red-100 text-red-700' : (opt.points > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700')}">
                              ${opt.points > 0 ? '+' : ''}${opt.points} pts
                            </span>
                          </button>
                        `).join('')}
                      </div>
                    </div>
                  ` : `
                    <div class="mt-4 flex justify-end">
                      <button type="button" id="sim-task-complete-btn" class="bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-1.5 transition">
                        <i class="fas fa-check"></i> Complete Task & Advance
                      </button>
                    </div>
                  `}
                </div>
              ` : `
                <div class="mb-4">
                  <span class="text-xs font-bold text-indigo-600 uppercase tracking-wider">${currentNode.type}</span>
                  <h4 class="text-lg font-bold text-gray-800 mt-1 font-['Noto_Sans_Sinhala']">${currentNode.text_si || ''}</h4>
                  <p class="text-sm text-gray-500">${currentNode.text_en || ''}</p>
                </div>

                <!-- Answer Options -->
                ${normalizedOpts.length > 0 ? `
                  <div class="space-y-2 mt-4">
                    <span class="text-xs font-bold text-gray-500 uppercase">Choose an option to advance:</span>
                    ${normalizedOpts.map(opt => `
                      <button type="button" class="sim-option-btn w-full p-3 rounded-lg border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50 text-left transition flex justify-between items-center" data-opt-id="${opt.id}" data-opt-en="${opt.text_en}" data-opt-si="${opt.text_si}">
                        <div>
                          <div class="font-bold text-sm text-slate-800">${opt.text_si || opt.text_en}</div>
                          ${opt.text_si && opt.text_en ? `<div class="text-xs text-slate-500">${opt.text_en}</div>` : ''}
                        </div>
                        <span class="text-xs font-extrabold px-2.5 py-1 rounded-full ${opt.points < 0 ? 'bg-red-100 text-red-700' : (opt.points > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-700')}">
                          ${opt.points > 0 ? '+' : ''}${opt.points} pts
                        </span>
                      </button>
                    `).join('')}
                  </div>
                ` : `
                  <div class="mt-4 p-4 bg-slate-50 border rounded-lg flex justify-between items-center">
                    <div>
                      <span class="text-sm font-semibold text-slate-800">Static Points:</span>
                      <span class="text-xs text-slate-500 ml-1">+${currentNode.points || 0} pts</span>
                    </div>
                    <button type="button" id="sim-static-advance-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 py-2 rounded">
                      Proceed ➔
                    </button>
                  </div>
                `}
              `)}

              <!-- Traversal Breadcrumb Path -->
              ${pathHistory.length > 0 ? `
                <div class="mt-6 border-t pt-4">
                  <span class="text-xs font-bold text-gray-500 uppercase">Path Traversed:</span>
                  <div class="flex flex-wrap items-center gap-1.5 mt-2">
                    ${pathHistory.map((step, idx) => `
                      <span class="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                        ${step.nodeTitle} ${step.answer ? `(${step.answer})` : ''}
                      </span>
                      ${idx < pathHistory.length - 1 ? '<span class="text-gray-400 text-xs">➔</span>' : ''}
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>

            <!-- Modal Footer -->
            <div class="px-6 py-3 border-t bg-gray-50 flex justify-between items-center">
              <button id="sim-restart-btn" class="text-xs font-semibold text-gray-600 hover:text-gray-900 flex items-center gap-1">
                <i class="fas fa-redo"></i> Restart
              </button>
              <button class="close-sim-modal px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded">Done</button>
            </div>
          </div>
        </div>
      `;

      modalContainer.querySelectorAll('.close-sim-modal').forEach(btn => {
        btn.addEventListener('click', () => { modalContainer.innerHTML = ''; });
      });

      document.getElementById('sim-restart-btn')?.addEventListener('click', () => {
        currentNode = startNode;
        accumulatedScore = 0;
        pathHistory.length = 0;
        renderSimulatorState();
      });

      // Question Option Click (Section 3.2: Option_ID based conditional routing)
      document.querySelectorAll('.sim-option-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const optId = btn.dataset.optId;
          const optEn = btn.dataset.optEn;
          const optSi = btn.dataset.optSi;

          const scoring = FlowEngine.calculateOptionScore(currentNode, optId, accumulatedScore, scoreFloorZero);
          accumulatedScore = scoring.finalScore;

          pathHistory.push({
            nodeTitle: currentNode.text_en || currentNode.text_si || currentNode.id,
            answer: optEn || optSi || optId,
            points: scoring.pointsAwarded
          });

          // Branch based on condition / Option_ID
          const nextRes = FlowEngine.resolveNextNode(currentNode.id, optId, edges);
          if (nextRes && nextRes.targetNodeId) {
            const nextNode = nodes.find(n => n.id === nextRes.targetNodeId);
            if (nextNode) {
              currentNode = nextNode;
              renderSimulatorState();
              return;
            }
          }

          // Fallback check with option label
          const nextResByLabel = FlowEngine.resolveNextNode(currentNode.id, optEn || optSi, edges);
          if (nextResByLabel && nextResByLabel.targetNodeId) {
            const nextNode = nodes.find(n => n.id === nextResByLabel.targetNodeId);
            if (nextNode) {
              currentNode = nextNode;
              renderSimulatorState();
              return;
            }
          }

          this.toast('Flow path reached end of outgoing connectors', 'info');
        });
      });

      // Task Completion Click
      document.getElementById('sim-task-complete-btn')?.addEventListener('click', () => {
        const scoring = FlowEngine.calculateTaskScore(currentNode, accumulatedScore, scoreFloorZero);
        accumulatedScore = scoring.finalScore;

        pathHistory.push({
          nodeTitle: currentNode.text_en || currentNode.text_si || currentNode.id,
          answer: 'Task Completed',
          points: scoring.pointsAwarded
        });

        const nextRes = FlowEngine.resolveNextNode(currentNode.id, null, edges);
        if (nextRes && nextRes.targetNodeId) {
          const nextNode = nodes.find(n => n.id === nextRes.targetNodeId);
          if (nextNode) {
            currentNode = nextNode;
            renderSimulatorState();
            return;
          }
        }

        this.toast('Flow path reached end of outgoing connectors', 'info');
      });

      document.getElementById('sim-static-advance-btn')?.addEventListener('click', () => {
        const pts = currentNode.points || 0;
        const raw = accumulatedScore + pts;
        accumulatedScore = scoreFloorZero ? Math.max(0, raw) : raw;

        pathHistory.push({
          nodeTitle: currentNode.text_en || currentNode.text_si || currentNode.id,
          answer: 'Completed',
          points: pts
        });

        const nextRes = FlowEngine.resolveNextNode(currentNode.id, null, edges);
        if (nextRes && nextRes.targetNodeId) {
          const nextNode = nodes.find(n => n.id === nextRes.targetNodeId);
          if (nextNode) {
            currentNode = nextNode;
            renderSimulatorState();
          }
        }
      });
    };

    renderSimulatorState();
  }
}

