/**
 * Dynamic Questionnaire & Task Adaptation Controller
 * Wosandi O/L Mission Control
 * 
 * Implements:
 * 3.2 Dynamic Questionnaire & Task Adaptation based on Grade, Active Subjects & Sub-Units
 * Real-time state mutations and event notification
 * Strict Namespace: wosandi_ol_*
 */

const STORAGE_KEY_STATE = 'wosandi_ol_questionnaire_state';

export const QUESTION_CATALOG = [
  // --- GRADE 11 CORE ---
  {
    id: 'q_g11_math_trig',
    grade: '11',
    subjectId: 'maths',
    unitName: 'ත්‍රිකෝණමිතිය',
    titleSi: 'ගණිතය: ත්‍රිකෝණමිතිය උන්නතාංශ හා අවනතාංශ අභ්‍යාස 10ක් විසඳීම',
    tier: 'core_academic',
    weight: 25
  },
  {
    id: 'q_g11_math_quad',
    grade: '11',
    subjectId: 'maths',
    unitName: 'වීජ ගණිතය',
    titleSi: 'ගණිතය: වර්ගජ සමීකරණ හා ප්‍රස්තාර ආදර්ශ ප්‍රශ්න පත්‍රය (Model Paper 1)',
    tier: 'core_academic',
    weight: 30
  },
  {
    id: 'q_g11_sci_bio',
    grade: '11',
    subjectId: 'science',
    unitName: 'ජීවී ලෝකය',
    titleSi: 'විද්‍යාව: සෛල විභේදනය හා ජාන විද්‍යාව කෙටි සටහන් සහ ප්‍රශ්න',
    tier: 'core_academic',
    weight: 25
  },
  {
    id: 'q_g11_sci_physics',
    grade: '11',
    subjectId: 'science',
    unitName: 'භෞතික පද්ධති',
    titleSi: 'විද්‍යාව: නිව්ටන්ගේ නියම හා චලිත සමීකරණ ගැටලු විසඳීම',
    tier: 'core_academic',
    weight: 25
  },
  {
    id: 'q_g11_sin_grammar',
    grade: '11',
    subjectId: 'sinhala',
    unitName: 'ව්‍යාකරණ',
    titleSi: 'සිංහල: සන්ධි හා සමාස විග්‍රහය සහ ගුත්තිල කාව්‍ය රසවින්දනය',
    tier: 'core_academic',
    weight: 20
  },
  {
    id: 'q_g11_eng_reading',
    grade: '11',
    subjectId: 'english',
    unitName: 'Language Skills',
    titleSi: 'English: Grammar, Essay Writing & Reading Comprehension Test',
    tier: 'core_academic',
    weight: 20
  },
  {
    id: 'q_g11_hist_anu',
    grade: '11',
    subjectId: 'history',
    unitName: 'ශ්‍රී ලංකා ඉතිහාසය',
    titleSi: 'ඉතිහාසය: අනුරාධපුර රාජධානියේ වාරි ශිෂ්ටාචාරය සහ සිතියම් ලකුණු කිරීම',
    tier: 'core_academic',
    weight: 20
  },
  {
    id: 'q_g11_rel_buddhism',
    grade: '11',
    subjectId: 'religion',
    unitName: 'ධර්ම කරුණු',
    titleSi: 'ආගම: චතුරාර්ය සත්‍යය හා බෞද්ධ සමාජ දර්ශනය පාඩම් කිරීම',
    tier: 'core_academic',
    weight: 20
  },

  // --- GRADE 11 BASKET & APPLIED ---
  {
    id: 'q_g11_comm_ledger',
    grade: '11',
    subjectId: 'commerce',
    unitName: 'ගිණුම්කරණය',
    titleSi: 'වාණිජ: මූලික ගිණුම්කරණ සමීකරණය හා ද්විත්ව සටහන් අභ්‍යාසය',
    tier: 'applied_basket',
    weight: 15
  },
  {
    id: 'q_g11_ict_py',
    grade: '11',
    subjectId: 'ict',
    unitName: 'ක්‍රමලේඛනය',
    titleSi: 'ICT: Python විචල්‍ය, කොන්දේසි හා ලූප් (Loops) ප්‍රායෝගික වැඩසටහන්',
    tier: 'applied_basket',
    weight: 15
  },
  {
    id: 'q_g11_mus_raga',
    grade: '11',
    subjectId: 'eastern_music',
    unitName: 'රාග හා තාල',
    titleSi: 'පෙරදිග සංගීතය: රාග ගායනා සහ තාල පුහුණුව (විනාඩි 20)',
    tier: 'applied_basket',
    weight: 15
  },
  {
    id: 'q_g11_civ_constitution',
    grade: '11',
    subjectId: 'civics',
    unitName: 'ආණ්ඩුක්‍රම',
    titleSi: 'පුරවැසි අධ්‍යාපනය: මූලික මිනිස් අයිතිවාසිකම් සහ ව්‍යවස්ථාව',
    tier: 'applied_basket',
    weight: 12
  },
  {
    id: 'q_g11_tam_speech',
    grade: '11',
    subjectId: 'tamil',
    unitName: 'දෙවන බස',
    titleSi: 'දෙමළ: දෛනික වචන 10ක් හා වාක්‍ය රටා අභ්‍යාසය',
    tier: 'applied_basket',
    weight: 12
  },

  // --- GRADE 10 MODULES ---
  {
    id: 'q_g10_math_area',
    grade: '10',
    subjectId: 'maths',
    unitName: 'පරිමිතිය හා වර්ගඵලය',
    titleSi: 'ගණිතය (Gr.10): ත්‍රිකෝණ වර්ගඵලය හා සමද්වීපාද ප්‍රමේයයන්',
    tier: 'core_academic',
    weight: 25
  },
  {
    id: 'q_g10_sci_atoms',
    grade: '10',
    subjectId: 'science',
    unitName: 'පදාර්ථයේ ව්‍යුහය',
    titleSi: 'විද්‍යාව (Gr.10): පරමාණුක ක්‍රමාංකය සහ ඉලෙක්ට්‍රෝන වින්‍යාසය',
    tier: 'core_academic',
    weight: 25
  },
  {
    id: 'q_g10_comm_env',
    grade: '10',
    subjectId: 'commerce',
    unitName: 'ව්‍යාපාර පරිසරය',
    titleSi: 'වාණිජ (Gr.10): ආර්ථික පරිසර සාධක සහ ව්‍යාපාර අවශ්‍යතා',
    tier: 'applied_basket',
    weight: 15
  },

  // --- GRADE 9 MODULES ---
  {
    id: 'q_g9_pts_tools',
    grade: '9',
    subjectId: 'pts',
    unitName: 'තාක්ෂණික නිපුණතා',
    titleSi: 'PTS (Gr.9): මූලික ලී වැඩ, කැපුම් මෙවලම් හා ආරක්ෂිත ක්‍රම',
    tier: 'applied_basket',
    weight: 15
  },
  {
    id: 'q_g9_hlth_diet',
    grade: '9',
    subjectId: 'health',
    unitName: 'සෞඛ්‍ය සම්පන්න දිවිය',
    titleSi: 'සෞඛ්‍යය (Gr.9): සමබල ආහාර වේල හා ක්‍රීඩා ශාරීරික යෝග්‍යතාව',
    tier: 'applied_basket',
    weight: 15
  },
  {
    id: 'q_g9_tam_vocab',
    grade: '9',
    subjectId: 'tamil',
    unitName: 'දෙවන බස ව්‍යවහාරය',
    titleSi: 'දෙමළ (Gr.9): මූලික වාක්‍ය රටා හා ලිවීමේ අභ්‍යාස',
    tier: 'applied_basket',
    weight: 12
  },

  // --- UNIVERSAL ROUTINE & HABITS (Tier 3) ---
  {
    id: 'q_univ_plan',
    isUniversal: true,
    titleSi: 'අද අධ්‍යයන කාලසටහන සහ ඉලක්කගත පාඩම් පෙර සැලසුම් කළාද?',
    tier: 'routine_baseline',
    weight: 5
  },
  {
    id: 'q_univ_desk',
    isUniversal: true,
    titleSi: 'පාඩම් කාමරය, පොත් මේසය සහ පසුගිය සටහන් පිළිවෙල කළාද?',
    tier: 'routine_baseline',
    weight: 5
  },
  {
    id: 'q_univ_sr',
    isUniversal: true,
    titleSi: 'අමතකවීමේ වක්‍රය (Spaced Repetition) Flashcards සමාලෝචනය කළාද?',
    tier: 'routine_baseline',
    weight: 8
  }
];

export class QuestionnaireController {
  constructor(containerId = 'questionnaireContainer') {
    this.container = typeof document !== 'undefined' ? document.getElementById(containerId) : null;
    this.state = this.loadState();
    this.activeGrade = '11';
    this.activeSubjectIds = new Set();
    this.onStateMutatedCallback = null;
  }

  loadState() {
    if (typeof localStorage === 'undefined') return {};
    try {
      const saved = localStorage.getItem(STORAGE_KEY_STATE);
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  }

  saveState() {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_STATE, JSON.stringify(this.state));
      } catch (e) {}
    }
  }

  /**
   * Filter questions dynamically based on active grade and active subjects
   */
  getFilteredQuestions(grade, activeSubjects = []) {
    this.activeGrade = String(grade);
    this.activeSubjectIds = new Set(activeSubjects.map(s => s.id));

    return QUESTION_CATALOG.filter(q => {
      // Universal routine tasks always appear
      if (q.isUniversal) return true;

      // Grade must match
      if (q.grade !== this.activeGrade) return false;

      // Subject must be active
      return this.activeSubjectIds.has(q.subjectId);
    }).map(q => ({
      ...q,
      completed: !!this.state[q.id]
    }));
  }

  /**
   * Renders the dynamic adaptive questionnaire
   */
  render(grade, activeSubjects = [], onMutation) {
    if (onMutation) this.onStateMutatedCallback = onMutation;
    if (!this.container) return;

    const questions = this.getFilteredQuestions(grade, activeSubjects);

    if (questions.length === 0) {
      this.container.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #64748b;">
          <p style="margin: 0; font-size: 0.95rem;">තෝරාගත් ශ්‍රේණිය (${grade}) සඳහා සක්‍රිය විෂයයන් නොමැත.</p>
          <span style="font-size: 0.8rem;">ඉහත "📚 විෂයයන් තෝරන්න" මඟින් විෂයයන් සක්‍රිය කරන්න.</span>
        </div>
      `;
      if (this.onStateMutatedCallback) {
        this.onStateMutatedCallback([]);
      }
      return;
    }

    const html = questions.map(q => {
      const isChecked = !!this.state[q.id];
      const tierBadgeClass = 
        q.tier === 'core_academic' ? 'tier-core' :
        q.tier === 'applied_basket' ? 'tier-applied' : 'tier-routine';
      const tierLabel = 
        q.tier === 'core_academic' ? 'Core Academic' :
        q.tier === 'applied_basket' ? 'Basket / Applied' : 'Daily Habit';

      return `
        <label class="q-item ${isChecked ? 'completed' : ''}" data-qid="${q.id}">
          <div style="display: flex; gap: 10px; align-items: flex-start; flex: 1;">
            <input type="checkbox" class="q-checkbox" data-qid="${q.id}" ${isChecked ? 'checked' : ''} style="margin-top: 3px; cursor: pointer;">
            <div style="flex: 1;">
              <span class="q-title">${q.titleSi}</span>
              <div style="display: flex; gap: 6px; align-items: center; margin-top: 4px;">
                <span class="q-tier-badge ${tierBadgeClass}">${tierLabel}</span>
                <span class="q-points-badge">+${q.weight} pts</span>
              </div>
            </div>
          </div>
        </label>
      `;
    }).join('');

    this.container.innerHTML = html;

    // Attach event listeners for real-time reactivity
    this.container.querySelectorAll('.q-checkbox').forEach(input => {
      input.addEventListener('change', (e) => {
        const qid = e.target.dataset.qid;
        this.state[qid] = e.target.checked;
        this.saveState();

        const label = e.target.closest('.q-item');
        if (label) {
          label.classList.toggle('completed', e.target.checked);
        }

        // Notify parent of updated questions
        const updatedQuestions = this.getFilteredQuestions(this.activeGrade, activeSubjects);
        if (this.onStateMutatedCallback) {
          this.onStateMutatedCallback(updatedQuestions);
        }
      });
    });

    // Notify initial state
    if (this.onStateMutatedCallback) {
      this.onStateMutatedCallback(questions);
    }
  }
}
