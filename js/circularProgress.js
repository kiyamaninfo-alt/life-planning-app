/**
 * CircularProgress - Hardware-Accelerated SVG Arc & Synchronized CountUp Engine
 * 
 * Features:
 * - 60fps hardware-accelerated SVG stroke-dasharray & stroke-dashoffset transition
 * - Synchronized easing interpolation (CountUp effect) matching 0.6s cubic-bezier(0.4, 0, 0.2, 1)
 * - Defensive zero / division-by-zero guard (totalPoints <= 0 -> smoothly animates to 0%)
 * - Safe cancellation of active requestAnimationFrame on rapid filter changes to prevent desync
 */

export class CircularProgress {
  constructor(options = {}) {
    this.circle = typeof options.circle === 'string' ? document.querySelector(options.circle) : options.circle;
    this.percentEl = typeof options.percentEl === 'string' ? document.querySelector(options.percentEl) : options.percentEl;
    this.scoreEl = typeof options.scoreEl === 'string' ? document.querySelector(options.scoreEl) : options.scoreEl;
    this.scoreFormatter = options.scoreFormatter || ((earned, total) => `${earned} / ${total} ලකුණු`);
    this.duration = options.duration || 600; // 0.6s matching CSS easing

    // Calculate circumference from circle radius or fallback to 264 (r=42)
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

    // Current state values
    this.currentPercent = 0;
    this.currentEarned = 0;
    this.currentTotal = 0;
    this.animationFrameId = null;
  }

  // Cubic-bezier(0.4, 0, 0.2, 1) approximate easing evaluator
  ease(t) {
    // Fast cubic easing providing identical acceleration & deceleration
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Updates progress state with real-time recalculation, zero guards, and synchronized CountUp
   * @param {number} earned - earned points
   * @param {number} total - total possible points
   */
  update(earned, total) {
    // Defensive Zero / Division-by-Zero Guard
    const validTotal = (typeof total === 'number' && !isNaN(total) && total > 0) ? Math.round(total) : 0;
    const validEarned = (typeof earned === 'number' && !isNaN(earned) && earned > 0) ? Math.round(earned) : 0;
    
    // Percentage calculation with zero-division guard
    const targetPercent = validTotal > 0 
      ? Math.min(100, Math.max(0, Math.round((validEarned / validTotal) * 100))) 
      : 0;

    // 1.1 Hardware-Accelerated SVG Arc Transition
    if (this.circle) {
      const targetOffset = this.circumference - (targetPercent / 100) * this.circumference;
      this.circle.style.strokeDashoffset = `${targetOffset}`;
    }

    // 1.2 Synchronized CountUp Interpolation
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    const startPercent = this.currentPercent;
    const startEarned = this.currentEarned;
    const startTotal = this.currentTotal;

    const diffPercent = targetPercent - startPercent;
    const diffEarned = validEarned - startEarned;
    const diffTotal = validTotal - startTotal;

    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / this.duration);
      const easedProgress = this.ease(progress);

      this.currentPercent = Math.round(startPercent + diffPercent * easedProgress);
      this.currentEarned = Math.round(startEarned + diffEarned * easedProgress);
      this.currentTotal = Math.round(startTotal + diffTotal * easedProgress);

      if (this.percentEl) {
        this.percentEl.innerText = `${this.currentPercent}%`;
      }
      if (this.scoreEl) {
        this.scoreEl.innerText = this.scoreFormatter(this.currentEarned, this.currentTotal);
      }

      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        // Guarantee exact final values
        this.currentPercent = targetPercent;
        this.currentEarned = validEarned;
        this.currentTotal = validTotal;
        if (this.percentEl) this.percentEl.innerText = `${targetPercent}%`;
        if (this.scoreEl) this.scoreEl.innerText = this.scoreFormatter(validEarned, validTotal);
        this.animationFrameId = null;
      }
    };

    this.animationFrameId = requestAnimationFrame(animate);
  }
}

// Global fallback if not using ES modules
if (typeof window !== 'undefined') {
  window.CircularProgress = CircularProgress;
}
