/**
 * Subject Manager - Wosandi O/L Mission Control
 * Comprehensive Catalog for Grade 9 to Grade 11
 * Strict Namespace: wosandi_ol_*
 */

const STORAGE_KEY_SUBJECTS = 'wosandi_ol_active_subjects';

export const DEFAULT_OL_SUBJECTS = [
  // 1. Core / Academic (6 Compulsory)
  { id: 'maths', name: 'Mathematics', code: 'MATH', category: 'core', isActive: true },
  { id: 'science', name: 'Science', code: 'SCI', category: 'core', isActive: true },
  { id: 'sinhala', name: 'Sinhala Language', code: 'SIN', category: 'core', isActive: true },
  { id: 'english', name: 'English', code: 'ENG', category: 'core', isActive: true },
  { id: 'history', name: 'History', code: 'HIST', category: 'core', isActive: true },
  { id: 'religion', name: 'Religion (Buddhism / Catholicism)', code: 'REL', category: 'core', isActive: true },

  // 2. Basket I / Social & Business
  { id: 'commerce', name: 'Commerce & Accounting', code: 'COMM', category: 'social_business', isActive: true },
  { id: 'geography', name: 'Geography', code: 'GEO', category: 'social_business', isActive: false },
  { id: 'civics', name: 'Civic Education', code: 'CIV', category: 'social_business', isActive: true },

  // 3. Basket II / Aesthetics
  { id: 'art', name: 'Art', code: 'ART', category: 'aesthetics', isActive: false },
  { id: 'eastern_music', name: 'Eastern Music', code: 'E-MUS', category: 'aesthetics', isActive: true },
  { id: 'western_music', name: 'Western Music', code: 'W-MUS', category: 'aesthetics', isActive: false },
  { id: 'dancing', name: 'Dancing', code: 'DNC', category: 'aesthetics', isActive: false },
  { id: 'drama', name: 'Drama & Theatre', code: 'DRM', category: 'aesthetics', isActive: false },

  // 4. Basket III / Technical & Applied
  { id: 'ict', name: 'Information & Comm. Tech', code: 'ICT', category: 'technical_applied', isActive: true },
  { id: 'agri', name: 'Agriculture & Food Tech', code: 'AGRI', category: 'technical_applied', isActive: false },
  { id: 'health', name: 'Health & Physical Education', code: 'HLTH', category: 'technical_applied', isActive: true },
  { id: 'pts', name: 'Practical & Technical Skills (PTS)', code: 'PTS', category: 'technical_applied', isActive: true },
  { id: 'home_economics', name: 'Home Economics', code: 'HEC', category: 'technical_applied', isActive: false },

  // 5. Additional / Languages
  { id: 'tamil', name: 'Second Language (Tamil)', code: 'TAM', category: 'additional_languages', isActive: true },
  { id: 'eng_lit', name: 'English Literature', code: 'LIT', category: 'additional_languages', isActive: false }
];

export class SubjectManager {
  constructor() {
    this.subjects = this.loadSubjects();
  }

  loadSubjects() {
    if (typeof localStorage === 'undefined') return DEFAULT_OL_SUBJECTS;
    const raw = localStorage.getItem(STORAGE_KEY_SUBJECTS);
    if (!raw) return DEFAULT_OL_SUBJECTS;
    try {
      const stored = JSON.parse(raw);
      if (!Array.isArray(stored)) return DEFAULT_OL_SUBJECTS;

      const storedMap = new Map(stored.map(s => [s.id, s]));
      return DEFAULT_OL_SUBJECTS.map(def => {
        const existing = storedMap.get(def.id);
        if (existing) {
          return {
            ...def,
            isActive: typeof existing.isActive === 'boolean' ? existing.isActive : def.isActive
          };
        }
        return def;
      });
    } catch (e) {
      return DEFAULT_OL_SUBJECTS;
    }
  }

  saveSubjects() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_SUBJECTS, JSON.stringify(this.subjects));
      } catch (e) {}
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('wosandi:subjectsChanged', {
        detail: { subjects: this.subjects }
      }));
    }
  }

  getActiveSubjects() {
    return this.subjects.filter(s => s.isActive);
  }

  toggleSubject(subjectId) {
    this.subjects = this.subjects.map(s => {
      if (s.id === subjectId) {
        return { ...s, isActive: !s.isActive };
      }
      return s;
    });
    this.saveSubjects();
  }
}

export const subjectManager = new SubjectManager();
