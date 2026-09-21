/**
 * CircularGraph UI Component - Wosandi O/L Mission Control
 * Hardware-Accelerated SVG Arc & Synchronized CountUp Engine
 * 
 * Strict Features:
 * 1.1 SVG stroke-dasharray & stroke-dashoffset transition with 0.6s cubic-bezier(0.4, 0, 0.2, 1)
 * 1.2 Synchronized CountUp easing interpolation matching 60fps SVG arc fill
 * 2.1 Real-time filter reactivity binding
 * 2.2 Defensive Zero / Division-by-Zero Guard (total <= 0 -> 0%, no NaN%)
 */

export class CircularGraph {
  constructor(options = {}) {
    this.circle = typeof options.circle === 'string' ? document.querySelector(options.circle) : options.circle;
    this.percentEl = typeof options.percentEl === 'string' ? document.querySelector(options.percentEl) : options.percentEl;
    this.scoreEl = typeof options.scoreEl === 'string' ? document.querySelector(options.scoreEl) : options.scoreEl;
    this.statusEl = typeof options.statusEl === 'string' ? document.querySelector(options.statusEl) : options.statusEl;
    this.duration = options.duration || 600; // 0.6s

    // Calculate circumference dynamically
    let radius = 42;
    if (this.circle) {
      const rAttr = this.circle.getAttribute('r');
      if (rAttr) radius = parseFloat(rAttr);
      else if (this.circle.r && this.circle.r.baseVal) radius = this.circle.r.baseVal.value;
    }
    this.circumference = 2 * Math.PI * radius;

    if (this.circle) {
      this.circle.style.strokeDasharray = `${this.circumference}`;
      this.circle.style.strokeDashoffset = `${this.circumference}`;
      this.circle.style.transition = `stroke-dashoffset ${this.duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
      this.circle.style.willChange = 'stroke-dashoffset';
    }

    this.currentPercent = 0;
    this.currentEarned = 0;
    this.currentTotal = 0;
    this.activeRafId = null;
  }

  // Cubic bezier ease-out interpolation
  ease(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Update circular progress with defensive guards and CountUp interpolation
   * @param {number} earned - earned score points
   * @param {number} total - total available score points
   * @param {string} [statusText] - optional status or rank text
   */
  update(earned, total, statusText = '') {
    // 2.2 Zero / Division-by-Zero Guard
    const validTotal = (typeof total === 'number' && !isNaN(total) && total > 0) ? Math.round(total) : 0;
    const validEarned = (typeof earned === 'number' && !isNaN(earned) && earned > 0) ? Math.round(earned) : 0;

    const targetPercent = validTotal > 0 
      ? Math.min(100, Math.max(0, Math.round((validEarned / validTotal) * 100))) 
      : 0;

    // 1.1 Hardware-Accelerated SVG Arc Transition
    if (this.circle) {
      const targetOffset = this.circumference - (targetPercent / 100) * this.circumference;
      this.circle.style.strokeDashoffset = `${targetOffset}`;
    }

    // 1.2 Synchronized CountUp Interpolation
    if (this.activeRafId) {
      cancelAnimationFrame(this.activeRafId);
      this.activeRafId = null;
    }

    const startPercent = this.currentPercent;
    const startEarned = this.currentEarned;
    const startTotal = this.currentTotal;

    const diffPercent = targetPercent - startPercent;
    const diffEarned = validEarned - startEarned;
    const diffTotal = validTotal - startTotal;

    const startTime = performance.now();

    const frame = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / this.duration);
      const eased = this.ease(progress);

      this.currentPercent = Math.round(startPercent + diffPercent * eased);
      this.currentEarned = Math.round(startEarned + diffEarned * eased);
      this.currentTotal = Math.round(startTotal + diffTotal * eased);

      if (this.percentEl) {
        this.percentEl.innerText = `${this.currentPercent}%`;
      }
      if (this.scoreEl) {
        this.scoreEl.innerText = `${this.currentEarned} / ${this.currentTotal} pts`;
      }

      if (progress < 1) {
        this.activeRafId = requestAnimationFrame(frame);
      } else {
        this.currentPercent = targetPercent;
        this.currentEarned = validEarned;
        this.currentTotal = validTotal;
        if (this.percentEl) this.percentEl.innerText = `${targetPercent}%`;
        if (this.scoreEl) this.scoreEl.innerText = `${validEarned} / ${validTotal} pts`;
        this.activeRafId = null;
      }
    };

    this.activeRafId = requestAnimationFrame(frame);

    if (this.statusEl && statusText) {
      this.statusEl.innerText = statusText;
    }
  }
}
