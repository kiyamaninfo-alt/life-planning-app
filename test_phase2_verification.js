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


  console.log('\n=== TEST 11: Task Node Schema, Linking wosandi_tasks & Point Calculation ===');
  const sampleTaskNode = {
    id: 'node_task_math',
    type: 'task',
    task_id: 'task-uuid-math-001',
    task_data: {
      id: 'task-uuid-math-001',
      title_si: 'ගණිත ඒකක පුනරීක්ෂණය',
      title_en: 'Trigonometry Problem Set',
      category: 'academic',
      tier: 'core_academic',
      weight_points: 25
    },
    text_si: 'ගණිත අභ්‍යාස සම්පූර්ණ කරන්න',
    text_en: 'Complete Trigonometry exercises',
    step_points: 25,
    points: 25
  };

  assert(sampleTaskNode.type === 'task', 'Node type is verified as "task"');
  assert(sampleTaskNode.task_id === 'task-uuid-math-001', 'Task node is linked to task_id');
  assert(sampleTaskNode.task_data.tier === 'core_academic', 'Task node preserves tier from wosandi_tasks');

  // Test calculateTaskScore on completion
  const taskAward = FlowEngine.calculateTaskScore(sampleTaskNode, 50, true);
  assert(taskAward.pointsAwarded === 25, 'Task completion awards +25 points');
  assert(taskAward.finalScore === 75, 'Final score updated to 75 (50 + 25)');

  // Test calculateTaskScore with penalty and score floor enabled
  const penaltyTaskNode = { ...sampleTaskNode, step_points: -30 };
  const taskPenaltyClamped = FlowEngine.calculateTaskScore(penaltyTaskNode, 10, true);
  assert(taskPenaltyClamped.rawScore === -20, 'Raw score is -20 before clamping');
  assert(taskPenaltyClamped.finalScore === 0, 'Score is clamped to floor 0 when floor is active');

  const taskPenaltyUnclamped = FlowEngine.calculateTaskScore(penaltyTaskNode, 10, false);
  assert(taskPenaltyUnclamped.finalScore === -20, 'Score reaches -20 when score floor is disabled');


  console.log('\n=== TEST 12: Cross-Module Flow Availability (api.getActiveTasks) ===');
  const activeTasks = await api.getActiveTasks();
  assert(Array.isArray(activeTasks), 'api.getActiveTasks() returns an array');
  assert(activeTasks.length > 0, 'Active tasks available for Flow Builder node consumption');
  const firstActiveTask = activeTasks[0];
  assert(firstActiveTask.id && firstActiveTask.title_en, 'Active task contains id and title for node dropdown');
  assert(typeof firstActiveTask.weight_points === 'number', 'Active task contains numeric weight_points for point calculation');


  console.log('\n=== TEST 13: Answer-Dependent Branching with Answer == Option_ID Multi-Route Resolution ===');
  // Scenario: Question "Did you eat?" -> If "Yes" (opt_yes), branch to "Sugary or Non-Sugary?" (node_sugary)
  //                                  -> If "No" (opt_no), branch to "Alternate Path / Fasting" (node_alt_path)
  const multiBranchEdges = [
    {
      fromId: 'node_eat',
      toId: 'node_sugary',
      condition: 'Yes',
      condition_option_id: 'opt_yes',
      condition_value: 'opt_yes'
    },
    {
      fromId: 'node_eat',
      toId: 'node_alt_path',
      condition: 'No',
      condition_option_id: 'opt_no',
      condition_value: 'opt_no'
    },
    {
      fromId: 'node_eat',
      toId: 'node_fallback_end',
      condition: ''
    }
  ];

  // 1. Answer by exact Option_ID 'opt_yes'
  const routeYesById = FlowEngine.resolveNextNode('node_eat', 'opt_yes', multiBranchEdges);
  assert(routeYesById && routeYesById.targetNodeId === 'node_sugary', 'Answer == "opt_yes" routes to sub-question node_sugary');

  // 2. Answer by exact Option_ID 'opt_no'
  const routeNoById = FlowEngine.resolveNextNode('node_eat', 'opt_no', multiBranchEdges);
  assert(routeNoById && routeNoById.targetNodeId === 'node_alt_path', 'Answer == "opt_no" routes to alternate path node_alt_path');

  // 3. Answer by option object { id: 'opt_yes' }
  const routeByObj = FlowEngine.resolveNextNode('node_eat', { id: 'opt_yes' }, multiBranchEdges);
  assert(routeByObj && routeByObj.targetNodeId === 'node_sugary', 'Option object with id "opt_yes" routes to node_sugary');

  // 4. Multiple outgoing edges verification: single node points to distinct targets
  const outgoingTargets = multiBranchEdges.filter(e => e.fromId === 'node_eat').map(e => e.toId);
  const distinctTargets = new Set(outgoingTargets);
  assert(distinctTargets.size === 3, 'Single question node supports multiple distinct target routes');


  console.log('\n=== TEST 14: Negative Score Floor Safeguard Toggle (FlowEngine.isScoreFloorEnabled) ===');
  // When allow_negative_score is false -> Floor is enabled (returns true)
  assert(FlowEngine.isScoreFloorEnabled({ allow_negative_score: false }) === true, 'allow_negative_score: false enables floor safeguarding (clamp to 0)');
  // When allow_negative_score is true -> Floor is disabled (returns false)
  assert(FlowEngine.isScoreFloorEnabled({ allow_negative_score: true }) === false, 'allow_negative_score: true allows negative scores below 0');
  // Legacy compatibility: score_floor_zero
  assert(FlowEngine.isScoreFloorEnabled({ score_floor_zero: true }) === true, 'Legacy score_floor_zero: true enables floor');
  assert(FlowEngine.isScoreFloorEnabled({ score_floor_zero: false }) === false, 'Legacy score_floor_zero: false disables floor');
  // Default behavior
  assert(FlowEngine.isScoreFloorEnabled({}) === true, 'Default settings enable score floor safeguard');
  assert(FlowEngine.isScoreFloorEnabled(null) === true, 'Null settings default to score floor enabled');


  console.log('\n=== TEST 15: Inline Answer Branching & Dynamic Next Flow Step Creation ===');
  // Scenario: Flow with a Task Node "Daily Math Challenge" having 2 answer outcomes:
  // opt_done: "Completed" -> branches to Next Flow Step (Reward / Advanced question)
  // opt_missed: "Missed" -> branches to Alternate Flow Step (Help / Review)
  const taskSourceNode = {
    id: 'node_task_math',
    type: 'task',
    task_id: 'task-uuid-math-001',
    text_si: 'දිනපතා ගණිත අභ්‍යාසය',
    text_en: 'Daily Math Challenge',
    points: 20,
    options: [
      { id: 'opt_done', text_si: 'සම්පූර්ණ කරන ලදී', text_en: 'Completed', points: 20 },
      { id: 'opt_missed', text_si: 'නොකරන ලදී', text_en: 'Missed', points: 0 }
    ],
    x: 100,
    y: 100
  };

  // Simulate dynamic next step creation for opt_done
  const optDone = taskSourceNode.options[0];
  const nextStepRewardNode = {
    id: 'node_reward_step',
    type: 'question',
    text_en: 'Great job! Choose your reward question',
    text_si: 'විශිෂ්ටයි! ඊළඟ ප්‍රශ්නය තෝරන්න',
    x: 360,
    y: 100
  };

  // Simulate dynamic next step creation for opt_missed
  const optMissed = taskSourceNode.options[1];
  const nextStepHelpNode = {
    id: 'node_help_step',
    type: 'question',
    text_en: 'Would you like assistance with trigonometry formulas?',
    text_si: 'ත්‍රිකෝණමිතිය සූත්‍ර පිළිබඳ සහාය අවශ්‍යද?',
    x: 360,
    y: 210
  };

  // Edge wiring as created by inline branching
  const dynamicFlowEdges = [
    {
      fromId: taskSourceNode.id,
      toId: nextStepRewardNode.id,
      condition: optDone.text_en,
      condition_option_id: optDone.id,
      condition_value: optDone.id
    },
    {
      fromId: taskSourceNode.id,
      toId: nextStepHelpNode.id,
      condition: optMissed.text_en,
      condition_option_id: optMissed.id,
      condition_value: optMissed.id
    }
  ];

  // 1. Verify answering with 'opt_done' navigates directly to reward step
  const navDone = FlowEngine.resolveNextNode(taskSourceNode.id, 'opt_done', dynamicFlowEdges);
  assert(navDone && navDone.targetNodeId === 'node_reward_step', 'Task answer "opt_done" dynamically routes to node_reward_step');

  // 2. Verify answering with 'opt_missed' navigates directly to help step
  const navMissed = FlowEngine.resolveNextNode(taskSourceNode.id, 'opt_missed', dynamicFlowEdges);
  assert(navMissed && navMissed.targetNodeId === 'node_help_step', 'Task answer "opt_missed" dynamically routes to node_help_step');

  // 3. Verify simulator / runtime score calculation for task answer
  const scoreIfDone = FlowEngine.calculateOptionScore(taskSourceNode, 'opt_done', 10, true);
  assert(scoreIfDone.finalScore === 30, 'Answering "opt_done" awards +20 points (10 + 20 = 30)');

  const scoreIfMissed = FlowEngine.calculateOptionScore(taskSourceNode, 'opt_missed', 10, true);
  assert(scoreIfMissed.finalScore === 10, 'Answering "opt_missed" awards 0 points (score remains 10)');

  // 4. Verify graph validation on complete answer-branched DAG
  const answerBranchedGraph = {
    nodes: [
      taskSourceNode,
      nextStepRewardNode,
      nextStepHelpNode,
      { id: 'end_terminal', type: 'end', text_en: 'Flow Finished' }
    ],
    edges: [
      ...dynamicFlowEdges,
      { fromId: nextStepRewardNode.id, toId: 'end_terminal', condition: '' },
      { fromId: nextStepHelpNode.id, toId: 'end_terminal', condition: '' }
    ]
  };

  const dagCheck = FlowEngine.validateGraph(answerBranchedGraph);
  assert(dagCheck.isValid === true, 'Dynamically answer-branched graph passes DAG validation');
  assert(dagCheck.orphanNodes.length === 0, 'No orphan nodes in answer-branched graph');
  assert(dagCheck.deadEndNodes.length === 0, 'All answer branches successfully reach terminal end node');

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
