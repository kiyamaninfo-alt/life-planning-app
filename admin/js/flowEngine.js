/**
 * FlowEngine - Modular Visual Conditional Flow & DAG Engine (Phase 2)
 * 
 * Strict Features:
 * 1. Per-Option Dynamic Scoring Matrix (supports positive integers, zero, and negative values)
 * 2. Negative Score Floor Safeguard (configurable Math.max(0, currentScore) clamping)
 * 3. Answer-Dependent Branching Logic & Multi-Route Resolution
 * 4. Graph Integrity & DAG Cycle Detection (DFS-based recursion stack)
 * 5. Orphan Node & Missing End Path Reachability Validation
 */

export class FlowEngine {
  /**
   * Normalizes any options array (legacy strings or key/label pairs)
   * into standard schema-driven JSONB structure:
   * [{ id: "opt_1", text_si: "...", text_en: "...", points: 10 }]
   */
  static normalizeOptions(rawOptions) {
    if (!Array.isArray(rawOptions)) return [];

    return rawOptions.map((opt, index) => {
      if (typeof opt === 'string') {
        return {
          id: `opt_${index + 1}`,
          text_si: opt,
          text_en: opt,
          points: 0
        };
      }

      if (opt && typeof opt === 'object') {
        const id = opt.id || opt.key || `opt_${index + 1}`;
        const text_si = opt.text_si || opt.label_si || opt.label || opt.text || '';
        const text_en = opt.text_en || opt.label_en || opt.label || opt.text || text_si;
        const points = typeof opt.points === 'number' ? opt.points : (Number(opt.points) || 0);

        return {
          id: String(id),
          text_si: String(text_si),
          text_en: String(text_en),
          points
        };
      }

      return {
        id: `opt_${index + 1}`,
        text_si: '',
        text_en: '',
        points: 0
      };
    });
  }

  /**
   * Validates Graph Integrity and DAG Properties:
   * 1. Detects cycles / infinite loops using DFS recursion stack.
   * 2. Detects orphan nodes (no incoming edges, except starting node).
   * 3. Detects dead-end nodes (nodes that cannot reach any 'end' node).
   */
  static validateGraph(flowData) {
    const nodes = flowData?.nodes || [];
    const edges = flowData?.edges || [];

    const errors = [];
    const warnings = [];

    if (!Array.isArray(nodes) || nodes.length === 0) {
      return {
        isValid: false,
        hasCycle: false,
        cyclePath: [],
        orphanNodes: [],
        deadEndNodes: [],
        errors: ['Flow contains no nodes.'],
        warnings: []
      };
    }

    // Build directed adjacency list
    const adj = {};
    const nodeMap = {};
    nodes.forEach(n => {
      adj[n.id] = [];
      nodeMap[n.id] = n;
    });

    edges.forEach(e => {
      if (adj[e.fromId] && nodeMap[e.toId]) {
        adj[e.fromId].push(e.toId);
      }
    });

    // 1. Cycle Detection (DFS)
    const visited = new Set();
    const recStack = new Set();
    let cycleFound = false;
    let cyclePath = [];

    const dfsCycle = (nodeId, path) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adj[nodeId] || [];
      for (const next of neighbors) {
        if (!visited.has(next)) {
          if (dfsCycle(next, path)) return true;
        } else if (recStack.has(next)) {
          // Cycle found
          const cycleStartIdx = path.indexOf(next);
          cyclePath = path.slice(cycleStartIdx).concat(next);
          return true;
        }
      }

      recStack.delete(nodeId);
      path.pop();
      return false;
    };

    for (const n of nodes) {
      if (!visited.has(n.id)) {
        if (dfsCycle(n.id, [])) {
          cycleFound = true;
          break;
        }
      }
    }

    if (cycleFound) {
      const pathTitles = cyclePath.map(id => {
        const node = nodeMap[id];
        return node ? (node.text_en || node.text_si || node.type || id) : id;
      });
      errors.push(`Infinite cycle detected: ${pathTitles.join(' ➔ ')}`);
    }

    // 2. Orphan Node Detection (nodes with no incoming edges)
    const incomingCounts = {};
    nodes.forEach(n => { incomingCounts[n.id] = 0; });
    edges.forEach(e => {
      if (incomingCounts[e.toId] !== undefined) {
        incomingCounts[e.toId]++;
      }
    });

    const orphanNodes = [];
    nodes.forEach((n, idx) => {
      // First node is allowed to be root/start
      if (idx > 0 && incomingCounts[n.id] === 0) {
        orphanNodes.push(n);
        warnings.push(`Orphan node: "${n.text_en || n.text_si || n.id}" has no incoming connections.`);
      }
    });

    // 3. Reachability to an 'End' Node
    const endNodeIds = new Set(nodes.filter(n => n.type === 'end').map(n => n.id));
    const deadEndNodes = [];

    if (endNodeIds.size === 0) {
      warnings.push('Flow has no "End" node. Flow execution will not have a designated termination point.');
    } else {
      // Find all nodes that can reach at least one end node using BFS backwards or DFS
      const canReachEnd = (startId) => {
        const q = [startId];
        const seen = new Set([startId]);

        while (q.length > 0) {
          const curr = q.shift();
          if (endNodeIds.has(curr)) return true;

          const neighbors = adj[curr] || [];
          for (const nb of neighbors) {
            if (!seen.has(nb)) {
              seen.add(nb);
              q.push(nb);
            }
          }
        }
        return false;
      };

      nodes.forEach(n => {
        if (n.type !== 'end' && !canReachEnd(n.id)) {
          deadEndNodes.push(n);
          warnings.push(`Dead-end: Node "${n.text_en || n.text_si || n.id}" cannot reach any "End" node.`);
        }
      });
    }

    return {
      isValid: errors.length === 0,
      hasCycle: cycleFound,
      cyclePath,
      orphanNodes,
      deadEndNodes,
      errors,
      warnings
    };
  }

  /**
   * Helper to check if score floor (clamp >= 0) is active
   * Section 4.3: Toggle "Allow Negative Total Score" (allow_negative_score).
   * When disabled, score clamps at 0: Final Score = max(0, Total Points).
   */
  static isScoreFloorEnabled(flowSettingsOrFlow) {
    const settings = flowSettingsOrFlow?.settings || flowSettingsOrFlow?.flow_data?.settings || flowSettingsOrFlow || {};
    if (settings.allow_negative_score !== undefined) {
      return !settings.allow_negative_score;
    }
    if (settings.score_floor_zero !== undefined) {
      return settings.score_floor_zero;
    }
    return true;
  }

  /**
   * Resolves the selected option and calculates points, applying
   * the negative score floor safeguard if enabled.
   */
  static calculateOptionScore(node, selectedAnswer, currentScore = 0, scoreFloorZero = true) {
    let pointsAwarded = 0;
    let selectedOption = null;

    if (node && Array.isArray(node.options) && node.options.length > 0) {
      const normalizedOpts = FlowEngine.normalizeOptions(node.options);
      
      // Match by id, value, or text
      selectedOption = normalizedOpts.find(opt => 
        opt.id === selectedAnswer ||
        opt.id?.toLowerCase() === String(selectedAnswer).toLowerCase() ||
        opt.text_en?.toLowerCase() === String(selectedAnswer).toLowerCase() ||
        opt.text_si === selectedAnswer ||
        opt.text_en === selectedAnswer
      );

      if (selectedOption) {
        pointsAwarded = selectedOption.points;
      } else if (typeof selectedAnswer === 'number' && normalizedOpts[selectedAnswer]) {
        selectedOption = normalizedOpts[selectedAnswer];
        pointsAwarded = selectedOption.points;
      }
    } else if (node && typeof node.points === 'number') {
      pointsAwarded = node.points;
    }

    const rawScore = currentScore + pointsAwarded;
    const finalScore = scoreFloorZero ? Math.max(0, rawScore) : rawScore;

    return {
      selectedOption,
      pointsAwarded,
      rawScore,
      finalScore
    };
  }

  /**
   * Calculates points for a Task Node (linked to wosandi_tasks)
   */
  static calculateTaskScore(node, currentScore = 0, scoreFloorZero = true) {
    const pointsAwarded = Number(node?.step_points ?? node?.points ?? node?.task_payload?.weight_points ?? node?.task_data?.weight_points ?? 0);
    const rawScore = currentScore + pointsAwarded;
    const finalScore = scoreFloorZero ? Math.max(0, rawScore) : rawScore;

    return {
      pointsAwarded,
      rawScore,
      finalScore
    };
  }

  /**
   * Evaluates conditional branching based on the user's selected answer.
   * Section 3.2: Supports condition-based binding where edge executes only if Answer == Option_ID.
   * Also supports multiple outgoing conditional edges pointing to distinct target nodes.
   */
  static resolveNextNode(currentNodeId, selectedAnswer, edges = []) {
    const outgoing = edges.filter(e => e.fromId === currentNodeId);
    if (outgoing.length === 0) return null;

    // 1. Try to find a matching conditional edge
    if (selectedAnswer !== undefined && selectedAnswer !== null) {
      let answerStr = '';
      let answerId = '';
      let answerTextEn = '';
      let answerTextSi = '';

      if (typeof selectedAnswer === 'object' && selectedAnswer !== null) {
        answerId = selectedAnswer.id ? String(selectedAnswer.id).trim().toLowerCase() : '';
        answerTextEn = selectedAnswer.text_en ? String(selectedAnswer.text_en).trim().toLowerCase() : '';
        answerTextSi = selectedAnswer.text_si ? String(selectedAnswer.text_si).trim().toLowerCase() : '';
        answerStr = answerId || answerTextEn || answerTextSi;
      } else {
        answerStr = String(selectedAnswer).trim().toLowerCase();
        answerId = answerStr;
      }

      for (const edge of outgoing) {
        if (!edge.condition && !edge.condition_option_id && !edge.condition_value) continue;

        const condStr = edge.condition ? String(edge.condition).trim().toLowerCase() : '';
        const condVal = edge.condition_value ? String(edge.condition_value).trim().toLowerCase() : '';
        const condOptId = edge.condition_option_id ? String(edge.condition_option_id).trim().toLowerCase() : '';

        // Match Option_ID or condition text
        if (
          (condOptId && (condOptId === answerId || condOptId === answerStr)) ||
          (condVal && (condVal === answerId || condVal === answerStr)) ||
          (condStr && (condStr === answerStr || condStr === answerId || answerStr.includes(condStr) || condStr.includes(answerStr))) ||
          (answerTextEn && condStr === answerTextEn) ||
          (answerTextSi && condStr === answerTextSi)
        ) {
          return {
            targetNodeId: edge.toId,
            matchedEdge: edge,
            isConditional: true
          };
        }
      }
    }

    // 2. Fall back to unconditional / default edge
    const defaultEdge = outgoing.find(e => (!e.condition || e.condition.trim() === '') && !e.condition_option_id);
    if (defaultEdge) {
      return {
        targetNodeId: defaultEdge.toId,
        matchedEdge: defaultEdge,
        isConditional: false
      };
    }

    // 3. Fallback to first outgoing edge if no explicit default
    return {
      targetNodeId: outgoing[0].toId,
      matchedEdge: outgoing[0],
      isConditional: false
    };
  }
}
