/**
 * Test Suite for CircularProgress and CircularGraph components
 */

import { CircularProgress } from './js/circularProgress.js';
import { CircularGraph } from './wosandi/ui/circularGraph.js';

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

console.log('=== TEST: CircularProgress Arc & CountUp Math ===');

// Mock DOM elements
class MockElement {
  constructor(tag = 'div') {
    this.innerText = '';
    this.textContent = '';
    this.style = {};
    this.tag = tag;
  }
  getAttribute(name) {
    if (name === 'r') return '42';
    return null;
  }
}

const mockCircle = new MockElement('circle');
const mockPercent = new MockElement('span');
const mockScore = new MockElement('span');

// Global mocks for Node environment
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (fn) => setTimeout(() => fn(Date.now()), 16);
global.cancelAnimationFrame = (id) => clearTimeout(id);

const progress = new CircularProgress({
  circle: mockCircle,
  percentEl: mockPercent,
  scoreEl: mockScore,
  duration: 600
});

assert(Math.round(progress.circumference) === 264, `Circumference should be ~264 for r=42. Got ${progress.circumference}`);
assert(mockCircle.style.willChange === 'stroke-dashoffset', 'willChange must be stroke-dashoffset');
assert(mockCircle.style.transition.includes('cubic-bezier(0.4, 0, 0.2, 1)'), 'CSS transition must use cubic-bezier(0.4, 0, 0.2, 1)');

// Update with 50/100 points
progress.update(50, 100);
const expectedHalfOffset = progress.circumference - 0.5 * progress.circumference;
assert(mockCircle.style.strokeDashoffset === `${expectedHalfOffset}`, `50% offset should be ${expectedHalfOffset}. Got ${mockCircle.style.strokeDashoffset}`);

// Test Zero / Division-by-Zero Guard
progress.update(0, 0);
assert(mockCircle.style.strokeDashoffset === `${progress.circumference}`, `Zero total should reset offset to ${progress.circumference}. Got ${mockCircle.style.strokeDashoffset}`);

// Test negative or NaN inputs
progress.update(-10, -50);
assert(mockCircle.style.strokeDashoffset === `${progress.circumference}`, 'Negative numbers should be protected to 0%');

progress.update(NaN, undefined);
assert(mockCircle.style.strokeDashoffset === `${progress.circumference}`, 'NaN/undefined should be protected to 0%');

console.log('\n=== TEST: CircularGraph (Wosandi UI Component) ===');
const mockWosandiCircle = new MockElement('circle');
const mockWosandiPercent = new MockElement('span');
const mockWosandiScore = new MockElement('span');
const mockWosandiStatus = new MockElement('span');

const wosandiGraph = new CircularGraph({
  circle: mockWosandiCircle,
  percentEl: mockWosandiPercent,
  scoreEl: mockWosandiScore,
  statusEl: mockWosandiStatus,
  duration: 600
});

assert(mockWosandiCircle.style.willChange === 'stroke-dashoffset', 'willChange must be stroke-dashoffset');
assert(mockWosandiCircle.style.transition.includes('600ms cubic-bezier(0.4, 0, 0.2, 1)'), 'CSS transition must be 600ms cubic-bezier(0.4, 0, 0.2, 1)');

wosandiGraph.update(120, 150, '✨ High Achiever');
const expected80Offset = wosandiGraph.circumference - 0.8 * wosandiGraph.circumference;
assert(Math.abs(parseFloat(mockWosandiCircle.style.strokeDashoffset) - expected80Offset) < 0.001, '80% offset calculation matches SVG arc');
assert(mockWosandiStatus.innerText === '✨ High Achiever', 'Status updated correctly');

// Zero guard
wosandiGraph.update(0, 0, 'No Tasks');
assert(mockWosandiCircle.style.strokeDashoffset === `${wosandiGraph.circumference}`, 'Zero guard smoothly un-fills circle to 0%');

console.log(`\n========================================`);
console.log(`SUMMARY: ${passed} passed, ${failed} failed.`);
console.log(`========================================`);
