/**
 * Grade Controller - Wosandi O/L Mission Control
 * Strict Namespace: wosandi_ol_*
 */

const STORAGE_KEY_GRADE = 'wosandi_ol_active_grade';
const DEFAULT_GRADE = '11';

export class GradeController {
  constructor() {
    this.activeGrade = (typeof localStorage !== 'undefined' && localStorage.getItem(STORAGE_KEY_GRADE)) || DEFAULT_GRADE;
    this.gradeButtons = typeof document !== 'undefined' ? document.querySelectorAll('.grade-btn') : [];
    
    this.handleGradeClick = this.handleGradeClick.bind(this);
    if (typeof window !== 'undefined') {
      this.init();
    }
  }

  init() {
    this.updateActiveUI(this.activeGrade);
    this.bindEvents();
    this.dispatchGradeChangeEvent(this.activeGrade);
  }

  bindEvents() {
    this.gradeButtons.forEach(btn => {
      btn.addEventListener('click', this.handleGradeClick);
    });
  }

  handleGradeClick(event) {
    const selectedGrade = event.currentTarget.getAttribute('data-grade');
    if (!selectedGrade || selectedGrade === this.activeGrade) return;

    this.activeGrade = selectedGrade;
    try {
      localStorage.setItem(STORAGE_KEY_GRADE, selectedGrade);
    } catch (e) {}
    this.updateActiveUI(selectedGrade);
    this.dispatchGradeChangeEvent(selectedGrade);
  }

  updateActiveUI(grade) {
    this.gradeButtons.forEach(btn => {
      if (btn.getAttribute('data-grade') === grade) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  dispatchGradeChangeEvent(grade) {
    window.dispatchEvent(new CustomEvent('wosandi:gradeChanged', {
      detail: { gradeLevel: grade }
    }));
  }
}
