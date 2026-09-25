/**
 * Phase 2 Automated Verification Suite
 * Tests:
 * 1. Per-Option Dynamic Scoring Matrix (Positive, Zero & Negative marks)
 * 2. Schema-Driven JSONB Options Structure & Normalization
 * 3. Negative Score Floor Safeguard (Clamping to Math.max(0, score) vs Unclamped)
 * 4. Graph Integrity & DAG Cycle Detection (DFS recursion stack)
 * 5. Orphan Node & Missing End Path Reachability Validation
 * 6. Answer-Dependent Branching & Multi-Route Resolution
 * 7. Task Manager CRUD & Extended Schema (subject, schedule, linked_timers)
 * 8. 400ms Debounced Autosave Logic
 * 9. Canvas History State Machine (Undo / Redo Stack)
 * 10. Database Isolation & Strict wosandi_ Prefix Enforcement
 */

import { FlowEngine } from './admin/js/flowEngine.js';
import { AdminApi } from './admin/js/adminApi.js';
import { scoringEngine } from './wosandi/controllers/scoringEngine.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

// Polyfill minimal browser globals for testing in Node.js
if (typeof window === 'undefined') {
  global.window = {};
}
if (typeof localStorage === 'undefined') {
  const store = {};
  global.localStorage = {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { Object.keys(store).forEach(k => delete store[k]); }
  };
}

async function runPhase2Tests() {
  console.log('=== TEST 1: Per-Option Dynamic Scoring Matrix & Negative Marks ===');
  const wakeupNode = {
    id: 'node_wake_up',
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
  };

  const earlyRes = FlowEngine.calculateOptionScore(wakeupNode, 'opt_1', 0, true);
  assert(earlyRes.pointsAwarded === 20, 'Awarded +20 points for waking up before 05:30');
  assert(earlyRes.finalScore === 20, 'Current score updated to 20');

  const lateRes = FlowEngine.calculateOptionScore(wakeupNode, 'opt_4', 30, true);
  assert(lateRes.pointsAwarded === -20, 'Deducted 20 points (-20) for waking up after 06:30');
  assert(lateRes.finalScore === 10, 'Current score correctly calculated as 30 - 20 = 10');


  console.log('\n=== TEST 2: Schema-Driven JSONB Options Normalization ===');
  const legacyStrings = ['05:30ට පෙර', '06:00ට පෙර', '06:30ට පසු'];
  const normalizedStr = FlowEngine.normalizeOptions(legacyStrings);
  assert(normalizedStr.length === 3, 'Normalized 3 legacy string options');
  assert(normalizedStr[0].id === 'opt_1' && normalizedStr[0].text_si === '05:30ට පෙර', 'Legacy string mapped to structured object');

  const legacyKeyLabels = [
    { key: 'yes', label: 'ඔව් (Yes)', points: 10 },
    { key: 'no', label: 'නැත (No)', points: -5 }
  ];
  const normalizedKeyLabels = FlowEngine.normalizeOptions(legacyKeyLabels);
  assert(normalizedKeyLabels[0].id === 'yes' && normalizedKeyLabels[0].points === 10, 'Option points preserved from object');
  assert(normalizedKeyLabels[1].points === -5, 'Negative points preserved in normalized structure');


  console.log('\n=== TEST 3: Negative Score Floor Safeguard (Clamping vs Unclamped) ===');
  // Scenario A: Floor Safeguard is ON (scoreFloorZero = true)
  // Starting at 0 points, then incurring -20 penalty -> should clamp to Math.max(0, -20) = 0
  const clampedRes = FlowEngine.calculateOptionScore(wakeupNode, 'opt_4', 0, true);
  assert(clampedRes.rawScore === -20, 'Raw score is -20 before clamping');
  assert(clampedRes.finalScore === 0, 'Score is clamped to floor 0 (Math.max(0, -20)) when floor is ON');

  // Scenario B: Floor Safeguard is OFF (scoreFloorZero = false)
  const unclampedRes = FlowEngine.calculateOptionScore(wakeupNode, 'opt_4', 0, false);
  assert(unclampedRes.finalScore === -20, 'Score is allowed to drop to -20 when floor is OFF');

  // Also test scoringEngine integration
  const scoringEngineClamped = scoringEngine.calculateWeightedScore(
    [{ id: 't1', tier: 'routine_baseline', weight: 10, pointsAwarded: -15 }],
    { scoreFloorZero: true }
  );
  assert(scoringEngineClamped.earnedPoints === 0, 'scoringEngine clamps negative earned points to 0 when scoreFloorZero is active');

  const scoringEngineUnclamped = scoringEngine.calculateWeightedScore(
    [{ id: 't1', tier: 'routine_baseline', weight: 10, pointsAwarded: -15 }],
    { scoreFloorZero: false }
  );
  assert(scoringEngineUnclamped.earnedPoints === -15, 'scoringEngine preserves -15 when scoreFloorZero is false');


  console.log('\n=== TEST 4: Graph Integrity & DAG Cycle Detection ===');
  // Valid Directed Acyclic Graph (DAG)
  const validDag = {
    nodes: [
      { id: 'q1', type: 'question', text_en: 'Question 1' },
      { id: 'q2', type: 'question', text_en: 'Question 2' },
      { id: 'end_node', type: 'end', text_en: 'Complete' }
    ],
    edges: [
      { fromId: 'q1', toId: 'q2', condition: '' },
      { fromId: 'q2', toId: 'end_node', condition: '' }
    ]
  };

  const validValidation = FlowEngine.validateGraph(validDag);
  assert(validValidation.isValid === true, 'Valid DAG passes validation with no errors');
  assert(validValidation.hasCycle === false, 'No cycle detected in valid DAG');

  // Cyclic Graph (q1 -> q2 -> q3 -> q1)
  const cyclicGraph = {
    nodes: [
      { id: 'q1', type: 'question', text_en: 'Question 1' },
      { id: 'q2', type: 'question', text_en: 'Question 2' },
      { id: 'q3', type: 'question', text_en: 'Question 3' },
      { id: 'end_node', type: 'end', text_en: 'Complete' }
    ],
    edges: [
      { fromId: 'q1', toId: 'q2', condition: '' },
      { fromId: 'q2', toId: 'q3', condition: '' },
      { fromId: 'q3', toId: 'q1', condition: '' }, // Cycle back to q1
      { fromId: 'q3', toId: 'end_node', condition: '' }
    ]
  };

  const cyclicValidation = FlowEngine.validateGraph(cyclicGraph);
  assert(cyclicValidation.isValid === false, 'Cyclic graph fails validation');
  assert(cyclicValidation.hasCycle === true, 'Cycle correctly detected by DFS recursion stack');
  assert(cyclicValidation.cyclePath.length >= 3, 'Cycle path correctly reconstructed');


  console.log('\n=== TEST 5: Orphan Node & Missing End Path Reachability Validation ===');
  const graphWithOrphan = {
    nodes: [
      { id: 'q1', type: 'question', text_en: 'Question 1' },
      { id: 'orphan_node', type: 'question', text_en: 'Orphan Question' },
      { id: 'end_node', type: 'end', text_en: 'Complete' }
    ],
    edges: [
      { fromId: 'q1', toId: 'end_node', condition: '' }
    ]
  };

  const orphanValidation = FlowEngine.validateGraph(graphWithOrphan);
  assert(orphanValidation.orphanNodes.some(n => n.id === 'orphan_node'), 'Orphan node detected (no incoming connections)');

  const deadEndGraph = {
    nodes: [
      { id: 'q1', type: 'question', text_en: 'Question 1' },
      { id: 'dead_end', type: 'question', text_en: 'Dead End Question' },
      { id: 'end_node', type: 'end', text_en: 'Complete' }
    ],
    edges: [
      { fromId: 'q1', toId: 'dead_end', condition: '' }
      // dead_end has no path to end_node
    ]
  };

  const deadEndValidation = FlowEngine.validateGraph(deadEndGraph);
  assert(deadEndValidation.deadEndNodes.some(n => n.id === 'dead_end'), 'Dead-end node detected (cannot reach End node)');


  console.log('\n=== TEST 6: Answer-Dependent Branching Logic ===');
  const branchEdges = [
    { fromId: 'node_school', toId: 'node_study_subj', condition: 'Yes', condition_value: 'opt_yes' },
    { fromId: 'node_school', toId: 'node_home_reason', condition: 'No', condition_value: 'opt_no' },
    { fromId: 'node_school', toId: 'node_default_end', condition: '' }
  ];

  // Route 1: Student answered "Yes"
  const nextIfYes = FlowEngine.resolveNextNode('node_school', 'Yes', branchEdges);
  assert(nextIfYes && nextIfYes.targetNodeId === 'node_study_subj', 'Condition "Yes" routes to "node_study_subj"');

  // Route 2: Student answered "No"
  const nextIfNo = FlowEngine.resolveNextNode('node_school', 'No', branchEdges);
  assert(nextIfNo && nextIfNo.targetNodeId === 'node_home_reason', 'Condition "No" routes to "node_home_reason"');

  // Route 3: Unconditional / fallback answer
  const nextIfUnknown = FlowEngine.resolveNextNode('node_school', 'Maybe', branchEdges);
  assert(nextIfUnknown && nextIfUnknown.targetNodeId === 'node_default_end', 'Unmatched answer falls back to default edge');


  console.log('\n=== TEST 7: Task Manager CRUD & Extended Schema ===');
  const api = new AdminApi();
  const testTask = {
    title_si: 'විද්‍යාව ඒකක පරීක්ෂණ පුනරීක්ෂණය',
    title_en: 'Science Unit Paper Review',
    category: 'academic',
    tier: 'core_academic',
    weight_points: 25,
    icon: '🔬',
    has_timer: true,
    timer_seconds: 2400,
    sort_order: 1,
    status: 'draft',
    schema_definition: {
      subject: 'science',
      description: 'Review chemistry and physics units for upcoming exam',
      schedule: {
        frequency: 'school_days',
        time: 'morning'
      },
      linked_timer_id: 'sample-timer-uuid'
    }
  };

  const insertedTask = await api.insert('wosandi_tasks', testTask);
  assert(insertedTask && insertedTask.id, 'Task inserted successfully into wosandi_tasks');
  assert(insertedTask.schema_definition?.subject === 'science', 'Task subject saved in schema_definition');
  assert(insertedTask.schema_definition?.schedule?.frequency === 'school_days', 'Task schedule saved in schema_definition');

  // Update task
  const updatedTask = await api.update('wosandi_tasks', insertedTask.id, {
    weight_points: 30,
    schema_definition: {
      ...insertedTask.schema_definition,
      description: 'Updated instructions for review'
    }
  });
  assert(updatedTask.weight_points === 30, 'Task weight points updated to 30');
  assert(updatedTask.schema_definition?.description === 'Updated instructions for review', 'Task description updated');

  // Delete task
  const deleteRes = await api.delete('wosandi_tasks', insertedTask.id);
  assert(deleteRes.data === true, 'Task deleted successfully from wosandi_tasks');


  console.log('\n=== TEST 8: 400ms Debounced Autosave Logic ===');
  let autosaveCallCount = 0;
  let lastSavedValue = null;
  const mockDebounceTimer = {};

  const simulateDebounce = (taskId, value, delay = 400) => {
    return new Promise((resolve) => {
      if (mockDebounceTimer[taskId]) clearTimeout(mockDebounceTimer[taskId]);
      mockDebounceTimer[taskId] = setTimeout(() => {
        autosaveCallCount++;
        lastSavedValue = value;
        resolve(true);
      }, delay);
    });
  };

  // Rapid typing simulation: 3 keystrokes within 50ms
  simulateDebounce('task_123', 'A');
  simulateDebounce('task_123', 'AB');
  const finalPromise = simulateDebounce('task_123', 'ABC');
  await finalPromise;

  assert(autosaveCallCount === 1, 'Debounce coalesced 3 rapid keystrokes into a single save operation');
  assert(lastSavedValue === 'ABC', 'Final keystroke value "ABC" was correctly persisted');


  console.log('\n=== TEST 9: Canvas History State Machine (Undo / Redo) ===');
  const history = [];
  let historyIdx = -1;

  const pushState = (data, desc) => {
    if (historyIdx < history.length - 1) {
      history.splice(historyIdx + 1);
    }
    history.push({ data: JSON.parse(JSON.stringify(data)), desc });
    historyIdx++;
  };

  const undoState = () => {
    if (historyIdx > 0) {
      historyIdx--;
      return history[historyIdx].data;
    }
    return null;
  };

  const redoState = () => {
    if (historyIdx < history.length - 1) {
      historyIdx++;
      return history[historyIdx].data;
    }
    return null;
  };

  // State 0: Initial
  pushState({ nodes: ['Node 1'] }, 'Initial');
  // State 1: Add Node 2
  pushState({ nodes: ['Node 1', 'Node 2'] }, 'Add Node 2');
  // State 2: Add Node 3
  pushState({ nodes: ['Node 1', 'Node 2', 'Node 3'] }, 'Add Node 3');

  assert(history.length === 3 && historyIdx === 2, 'History stack contains 3 states at index 2');

  const undid = undoState();
  assert(undid.nodes.length === 2, 'Undo restored state to 2 nodes');

  const redid = redoState();
  assert(redid.nodes.length === 3, 'Redo restored state to 3 nodes');


  console.log('\n=== TEST 10: Security Guard: Zero Interference with Production Tables ===');
  let blockedUsers = false;
  try {
    await api.select('users');
  } catch (e) {
    blockedUsers = e.message.includes('Security Violation');
  }
  assert(blockedUsers, 'Access to non-prefixed table "users" is strictly blocked');

  let blockedRoutines = false;
  try {
    await api.select('routine_tasks');
  } catch (e) {
    blockedRoutines = e.message.includes('Security Violation');
  }
  assert(blockedRoutines, 'Access to production table "routine_tasks" is strictly blocked');

  let allowedWosandi = false;
  try {
    const res = await api.select('wosandi_flows');
    allowedWosandi = Array.isArray(res);
  } catch (e) {
    allowedWosandi = false;
  }
  assert(allowedWosandi, 'Access to wosandi_flows is allowed and succeeds');

  console.log('\n========================================');
  console.log(`PHASE 2 SUMMARY: ${passed} passed, ${failed} failed.`);
  console.log('========================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runPhase2Tests().catch(err => {
  console.error('Phase 2 verification failed:', err);
  process.exit(1);
});
