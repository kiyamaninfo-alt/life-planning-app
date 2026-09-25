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
  }

  async render() {
    this.containerEl.innerHTML = `
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-2xl font-bold text-gray-800">Questionnaire Flows</h2>
        <button id="fb-new-flow" class="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded shadow">
          <i class="fas fa-plus mr-2"></i> New Flow
        </button>
      </div>
      <div id="fb-flows-list" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="text-center text-gray-500 py-10 w-full col-span-full">Loading...</div>
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
        const isPublished = flow.status === 'published';
        const flowTitle = flow.title_si || flow.title || 'Untitled Flow';
        const flowType = flow.flow_type || flow.type || 'questionnaire';
        return `
          <div class="bg-white rounded-lg shadow-md p-5 border-t-4 border-blue-500 cursor-pointer hover:shadow-lg transition-shadow" data-id="${flow.id}">
            <div class="flex justify-between items-start mb-2">
              <h3 class="text-lg font-bold text-gray-800">${flowTitle}</h3>
              <span class="text-xs font-semibold px-2 py-1 rounded ${isPublished ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                ${isPublished ? 'Published' : 'Draft'}
              </span>
            </div>
            <p class="text-sm text-gray-600 mb-4 capitalize">Type: ${flowType}</p>
            <div class="flex justify-between items-center text-sm text-gray-500">
              <span><i class="fas fa-project-diagram mr-1"></i> ${nodeCount} Nodes</span>
            </div>
          </div>
        `;
      }).join('');

      listContainer.querySelectorAll('div[data-id]').forEach(el => {
        el.addEventListener('click', () => this.openFlowEditor(el.dataset.id));
      });
    } catch (e) {
      this.toast('Error loading flows', 'error');
    }
  }

  async openFlowEditor(flowId = null) {
    if (flowId) {
      try {
        const { data } = await this.api.selectById(this.tableName, flowId);
        if (data) {
          this.currentFlow = data;
          this.currentFlow.title = data.title_si || data.title || 'Untitled Flow';
          this.currentFlow.type = data.flow_type || data.type || 'questionnaire';
          if (!this.currentFlow.flow_data) {
            this.currentFlow.flow_data = { nodes: [], edges: [] };
          }
        }
      } catch (e) {
        this.toast('Error loading flow', 'error');
        return;
      }
    } else {
      this.currentFlow = {
        title: 'New Flow',
        type: 'standard',
        status: 'draft',
        flow_data: { nodes: [], edges: [] }
      };
    }

    this.selectedNodeId = null;

    this.containerEl.innerHTML = `
      <div class="flex flex-col h-full bg-gray-50">
        <!-- Top Bar -->
        <div class="bg-white border-b px-6 py-3 flex justify-between items-center shadow-sm">
          <div class="flex items-center space-x-4">
            <button id="fb-back" class="text-gray-500 hover:text-gray-800">
              <i class="fas fa-arrow-left"></i>
            </button>
            <input type="text" id="fb-title" value="${this.currentFlow.title || ''}" placeholder="Flow Title" class="font-bold text-lg border-none focus:ring-0 bg-transparent" />
            <select id="fb-type" class="text-sm border-gray-300 rounded shadow-sm focus:ring-blue-500 focus:border-blue-500">
              <option value="standard" ${this.currentFlow.type === 'standard' ? 'selected' : ''}>Standard</option>
              <option value="assessment" ${this.currentFlow.type === 'assessment' ? 'selected' : ''}>Assessment</option>
            </select>
            <span class="text-xs font-semibold px-2 py-1 rounded ${this.currentFlow.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${this.currentFlow.status === 'published' ? 'Published' : 'Draft'}
            </span>
          </div>
          <div class="flex items-center space-x-2">
            ${flowId ? `<button id="fb-delete" class="text-red-600 hover:bg-red-50 px-3 py-1.5 rounded transition"><i class="fas fa-trash-alt mr-1"></i> Delete</button>` : ''}
            <button id="fb-save" class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-1.5 rounded transition"><i class="fas fa-save mr-1"></i> Save</button>
            <button id="fb-publish" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded transition"><i class="fas fa-paper-plane mr-1"></i> Publish</button>
          </div>
        </div>

        <!-- Split Layout -->
        <div class="flex flex-1 overflow-hidden">
          <!-- LEFT: SVG Graph -->
          <div class="w-3/5 bg-gray-100 overflow-auto relative border-r flex flex-col">
            <div class="p-2 bg-white border-b flex justify-between">
              <button id="fb-add-question" class="bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1 text-sm rounded"><i class="fas fa-plus mr-1"></i> Add Question</button>
              <button id="fb-add-branch" class="bg-amber-100 text-amber-700 hover:bg-amber-200 px-3 py-1 text-sm rounded"><i class="fas fa-code-branch mr-1"></i> Add Branch</button>
              <button id="fb-add-end" class="bg-green-100 text-green-700 hover:bg-green-200 px-3 py-1 text-sm rounded"><i class="fas fa-flag-checkered mr-1"></i> Add End</button>
            </div>
            <div id="fb-svg-container" class="flex-1 w-full h-full p-4 min-w-[800px] min-h-[600px] overflow-auto">
              <!-- SVG will be injected here -->
            </div>
          </div>
          
          <!-- RIGHT: Node Editor -->
          <div class="w-2/5 bg-white overflow-y-auto" id="fb-node-editor">
            <div class="p-8 text-center text-gray-400 mt-20">
              <i class="fas fa-mouse-pointer text-4xl mb-4"></i>
              <p>Select a node to edit its properties</p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById('fb-back').addEventListener('click', () => this.render());
    document.getElementById('fb-save').addEventListener('click', () => this.saveFlow());
    document.getElementById('fb-publish').addEventListener('click', () => {
      this.currentFlow.status = 'published';
      this.saveFlow();
    });
    if (flowId) {
      document.getElementById('fb-delete').addEventListener('click', () => this.deleteFlow(flowId));
    }

    document.getElementById('fb-add-question').addEventListener('click', () => this.addNode('question'));
    document.getElementById('fb-add-branch').addEventListener('click', () => this.addNode('branch'));
    document.getElementById('fb-add-end').addEventListener('click', () => this.addNode('end'));

    document.getElementById('fb-title').addEventListener('change', (e) => this.currentFlow.title = e.target.value);
    document.getElementById('fb-type').addEventListener('change', (e) => this.currentFlow.type = e.target.value);

    this.updateGraph();
  }

  updateGraph() {
    const container = document.getElementById('fb-svg-container');
    if (!container) return;
    
    // Auto layout
    const nodes = this.currentFlow.flow_data.nodes;
    const edges = this.currentFlow.flow_data.edges;
    
    const levels = {};
    const processed = new Set();
    
    // Simple topological sort / leveling
    const getLevel = (nodeId) => {
      if (levels[nodeId] !== undefined) return levels[nodeId];
      const incomingEdges = edges.filter(e => e.toId === nodeId);
      if (incomingEdges.length === 0) return 0;
      
      // Prevent infinite loops
      if (processed.has(nodeId)) return 0;
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
      
      const width = 160;
      const height = 60;
      const hGap = 200;
      const vGap = 120;
      
      const countInLevel = levelCounts[l];
      const idx = levelIndex[l] - 1;
      
      const totalWidth = countInLevel * hGap;
      const startX = (this.svgWidth / 2) - (totalWidth / 2) + (hGap / 2);
      
      return {
        ...n,
        x: startX + (idx * hGap) - (width/2),
        y: 40 + (l * vGap),
        width,
        height
      };
    });

    this.svgWidth = Math.max(800, ...layoutNodes.map(n => n.x + n.width + 100));
    this.svgHeight = Math.max(600, ...layoutNodes.map(n => n.y + n.height + 100));

    container.innerHTML = this.renderFlowGraph(layoutNodes, edges);
    
    // Add click listeners to SVG nodes
    setTimeout(() => {
      const gNodes = container.querySelectorAll('.fb-node');
      gNodes.forEach(g => {
        g.addEventListener('click', (e) => {
          this.selectedNodeId = g.dataset.id;
          this.updateGraph();
          this.renderNodeEditor(nodes.find(n => n.id === this.selectedNodeId));
        });
      });
    }, 0);
  }

  renderFlowGraph(nodes, edges) {
    const defs = `
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
        </marker>
        <marker id="arrow-selected" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#3B82F6" />
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

      // Bezier curve
      const path = `M ${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 - 40}, ${x2} ${y2}`;
      
      const isSelected = this.selectedNodeId === from.id || this.selectedNodeId === to.id;
      const color = isSelected ? '#3B82F6' : '#9CA3AF';
      const marker = isSelected ? 'url(#arrow-selected)' : 'url(#arrow)';

      let labelHtml = '';
      if (edge.condition) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        labelHtml = `
          <rect x="${mx - 30}" y="${my - 10}" width="60" height="20" fill="white" rx="4" stroke="${color}" stroke-width="1"/>
          <text x="${mx}" y="${my + 4}" font-size="10" fill="${color}" text-anchor="middle" font-family="sans-serif">${edge.condition}</text>
        `;
      }

      return `
        <path d="${path}" fill="none" stroke="${color}" stroke-width="2" marker-end="${marker}" />
        ${labelHtml}
      `;
    };

    const renderNode = (node) => {
      const isSelected = node.id === this.selectedNodeId;
      let bgColor = '#EFF6FF'; // question
      let strokeColor = '#3B82F6';
      let icon = '❓';

      if (node.type === 'branch') {
        bgColor = '#FFFBEB';
        strokeColor = '#F59E0B';
        icon = '🔀';
      } else if (node.type === 'end') {
        bgColor = '#F0FDF4';
        strokeColor = '#10B981';
        icon = '🏁';
      }

      const strokeWidth = isSelected ? '3' : '1';
      const shadow = isSelected ? 'filter="drop-shadow(0px 4px 6px rgba(0,0,0,0.1))"' : '';

      // Text truncation
      const text = node.text_en || node.text_si || node.type;
      const truncated = text.length > 20 ? text.substring(0, 17) + '...' : text;

      return `
        <g class="fb-node cursor-pointer" data-id="${node.id}" transform="translate(${node.x}, ${node.y})">
          <rect width="${node.width}" height="${node.height}" rx="6" fill="${bgColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" ${shadow} />
          <text x="10" y="22" font-size="12" font-weight="bold" fill="#374151" font-family="sans-serif">${icon} ${node.type.toUpperCase()}</text>
          <text x="10" y="42" font-size="11" fill="#4B5563" font-family="sans-serif">${truncated}</text>
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

  renderNodeEditor(node) {
    const editorEl = document.getElementById('fb-node-editor');
    if (!node) {
      editorEl.innerHTML = `
        <div class="p-8 text-center text-gray-400 mt-20">
          <i class="fas fa-mouse-pointer text-4xl mb-4"></i>
          <p>Select a node to edit its properties</p>
        </div>
      `;
      return;
    }

    let specificFields = '';

    if (node.type === 'question') {
      specificFields = `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Input Type</label>
          <select id="ne-input-type" class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">
            <option value="choice" ${node.input_type === 'choice' ? 'selected' : ''}>Multiple Choice</option>
            <option value="text" ${node.input_type === 'text' ? 'selected' : ''}>Text Input</option>
            <option value="scale" ${node.input_type === 'scale' ? 'selected' : ''}>Scale (1-10)</option>
            <option value="boolean" ${node.input_type === 'boolean' ? 'selected' : ''}>Yes/No</option>
          </select>
        </div>
        ${node.input_type === 'choice' ? `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Options (JSON Array of strings)</label>
          <textarea id="ne-options" rows="3" class="w-full border-gray-300 rounded-md shadow-sm">${JSON.stringify(node.options || [])}</textarea>
        </div>
        ` : ''}
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Points Value</label>
          <input type="number" id="ne-points" value="${node.points || 0}" class="w-full border-gray-300 rounded-md shadow-sm" />
        </div>
      `;
    }

    const availableNodes = this.currentFlow.flow_data.nodes.filter(n => n.id !== node.id);
    const outgoingEdges = this.currentFlow.flow_data.edges.filter(e => e.fromId === node.id);

    const edgesHtml = `
      <div class="mt-6 border-t pt-4">
        <h4 class="font-bold text-gray-700 mb-2">Outgoing Edges</h4>
        ${outgoingEdges.map((e, idx) => `
          <div class="flex items-center space-x-2 mb-2 p-2 bg-gray-50 rounded border">
            <input type="text" placeholder="Condition" value="${e.condition || ''}" class="edge-condition w-1/3 text-xs border-gray-300 rounded" data-to="${e.toId}" />
            <span class="text-gray-500 text-xs">→</span>
            <span class="text-xs truncate flex-1">${availableNodes.find(n=>n.id===e.toId)?.text_en || e.toId}</span>
            <button class="text-red-500 hover:text-red-700 edge-remove" data-to="${e.toId}"><i class="fas fa-times"></i></button>
          </div>
        `).join('')}
        
        <div class="flex space-x-2 mt-2">
          <select id="ne-new-edge-to" class="flex-1 text-sm border-gray-300 rounded shadow-sm">
            <option value="">Select target node...</option>
            ${availableNodes.map(n => `<option value="${n.id}">${n.type.toUpperCase()}: ${n.text_en ? n.text_en.substring(0,20) : n.id}</option>`).join('')}
          </select>
          <button id="ne-add-edge" class="bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded text-sm font-medium text-gray-700">Add</button>
        </div>
      </div>
    `;

    editorEl.innerHTML = `
      <div class="p-6">
        <div class="flex justify-between items-center mb-6">
          <h3 class="text-lg font-bold text-gray-800">Edit Node</h3>
          <span class="text-xs text-gray-400 font-mono">${node.id}</span>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Type</label>
          <input type="text" disabled value="${node.type.toUpperCase()}" class="w-full bg-gray-100 border-gray-300 rounded-md shadow-sm text-gray-500 font-semibold" />
        </div>

        ${node.type !== 'end' ? `
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Question/Text (Sinhala)</label>
          <textarea id="ne-text-si" rows="2" class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">${node.text_si || ''}</textarea>
        </div>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-1">Question/Text (English)</label>
          <textarea id="ne-text-en" rows="2" class="w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500">${node.text_en || ''}</textarea>
        </div>
        ` : ''}

        ${specificFields}
        ${node.type !== 'end' ? edgesHtml : ''}

        <div class="mt-8 pt-4 border-t flex justify-end">
          <button id="ne-delete" class="text-red-600 hover:text-red-800 font-medium text-sm flex items-center">
            <i class="fas fa-trash-alt mr-1"></i> Delete Node
          </button>
        </div>
      </div>
    `;

    // Attach Listeners
    if (document.getElementById('ne-text-si')) {
      document.getElementById('ne-text-si').addEventListener('change', (e) => { node.text_si = e.target.value; this.updateGraph(); });
      document.getElementById('ne-text-en').addEventListener('change', (e) => { node.text_en = e.target.value; this.updateGraph(); });
    }
    
    if (document.getElementById('ne-input-type')) {
      document.getElementById('ne-input-type').addEventListener('change', (e) => { 
        node.input_type = e.target.value; 
        this.renderNodeEditor(node); 
      });
    }

    if (document.getElementById('ne-options')) {
      document.getElementById('ne-options').addEventListener('change', (e) => {
        try { node.options = JSON.parse(e.target.value); } catch(err) { this.toast('Invalid JSON for options', 'error'); }
      });
    }

    if (document.getElementById('ne-points')) {
      document.getElementById('ne-points').addEventListener('change', (e) => { node.points = Number(e.target.value); });
    }

    document.querySelectorAll('.edge-condition').forEach(el => {
      el.addEventListener('change', (e) => {
        const toId = e.target.dataset.to;
        const edge = this.currentFlow.flow_data.edges.find(ed => ed.fromId === node.id && ed.toId === toId);
        if (edge) { edge.condition = e.target.value; this.updateGraph(); }
      });
    });

    document.querySelectorAll('.edge-remove').forEach(el => {
      el.addEventListener('click', (e) => {
        const toId = e.currentTarget.dataset.to;
        this.removeEdge(node.id, toId);
        this.updateGraph();
        this.renderNodeEditor(node);
      });
    });

    if (document.getElementById('ne-add-edge')) {
      document.getElementById('ne-add-edge').addEventListener('click', () => {
        const toId = document.getElementById('ne-new-edge-to').value;
        if (toId) {
          this.addEdge(node.id, toId);
          this.updateGraph();
          this.renderNodeEditor(node);
        }
      });
    }

    document.getElementById('ne-delete').addEventListener('click', () => {
      this.removeNode(node.id);
      this.selectedNodeId = null;
      this.updateGraph();
      this.renderNodeEditor(null);
    });
  }

  addNode(type = 'question') {
    const id = 'node_' + Math.random().toString(36).substr(2, 9);
    const newNode = {
      id,
      type,
      text_en: `New ${type}`,
      text_si: '',
      input_type: type === 'question' ? 'text' : null
    };
    this.currentFlow.flow_data.nodes.push(newNode);
    this.selectedNodeId = id;
    this.updateGraph();
    this.renderNodeEditor(newNode);
  }

  removeNode(nodeId) {
    this.currentFlow.flow_data.nodes = this.currentFlow.flow_data.nodes.filter(n => n.id !== nodeId);
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => e.fromId !== nodeId && e.toId !== nodeId);
  }

  addEdge(fromId, toId, condition = null) {
    // Check if exists
    const exists = this.currentFlow.flow_data.edges.find(e => e.fromId === fromId && e.toId === toId);
    if (!exists) {
      this.currentFlow.flow_data.edges.push({ fromId, toId, condition });
    }
  }

  removeEdge(fromId, toId) {
    this.currentFlow.flow_data.edges = this.currentFlow.flow_data.edges.filter(e => !(e.fromId === fromId && e.toId === toId));
  }

  async saveFlow() {
    try {
      const payload = {
        title_si: this.currentFlow.title || this.currentFlow.title_si || 'Untitled Flow',
        title_en: this.currentFlow.title_en || '',
        flow_type: this.currentFlow.flow_type || this.currentFlow.type || 'questionnaire',
        status: this.currentFlow.status || 'draft',
        flow_data: this.currentFlow.flow_data || { nodes: [], edges: [] }
      };

      if (this.currentFlow.id) {
        await this.api.update(this.tableName, this.currentFlow.id, payload);
        this.toast('Flow updated successfully', 'success');
      } else {
        const res = await this.api.insert(this.tableName, payload);
        if (res && res[0]) {
          this.currentFlow.id = res[0].id;
        } else if (res && res.id) {
          this.currentFlow.id = res.id;
        }
        this.toast('Flow created successfully', 'success');
      }
      this.render(); // Go back to list
    } catch (e) {
      this.toast('Error saving flow', 'error');
    }
  }

  async deleteFlow(flowId) {
    if (confirm('Are you sure you want to delete this flow? This cannot be undone.')) {
      try {
        await this.api.delete(this.tableName, flowId);
        this.toast('Flow deleted', 'success');
        this.render();
      } catch (e) {
        this.toast('Error deleting flow', 'error');
      }
    }
  }
}
