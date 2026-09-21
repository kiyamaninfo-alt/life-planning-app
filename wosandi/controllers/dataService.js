/**
 * Data Service - Wosandi O/L Mission Control
 * Scoped data fetchers strictly querying wosandi_* schemas with realistic fallback data.
 * Filters data by active grade (9, 10, 11) and active subjects from subjectManager.
 * Enforces 0-mark exclusions, 6 priority rules, and multi-source streak.
 * 
 * Strict Constraints:
 * - Table Prefix: wosandi_*
 * - Storage Namespace: wosandi_ol_*
 * - ZERO INTERFERENCE with existing tables (daily_logs, etc.)
 */

import { subjectManager } from './subjectManager.js';

const STORAGE_LAST_UPDATED = 'wosandi_ol_last_updated';
const SUPABASE_URL = 'https://rxwopsfjnlzlzzazgnvq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_T_OzlimdV3-2UhuHSvj5kA_GFTH9nbn';

function getLocalDateString(daysAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getLocalTimestamp(daysAgo = 0, hoursAgo = 0) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

/**
 * Builds realistic scoped mock dataset for Grade 9, 10, and 11
 * Includes historical daily logs across previous weeks for Day-of-Week estimation
 */
function buildMockDatabase() {
  const todayStr = getLocalDateString(0);
  const yesterdayStr = getLocalDateString(1);
  const day2AgoStr = getLocalDateString(2);
  const day3AgoStr = getLocalDateString(3);
  const day7AgoStr = getLocalDateString(7);
  const day8AgoStr = getLocalDateString(8);
  const day14AgoStr = getLocalDateString(14);
  const day21AgoStr = getLocalDateString(21);
  const day28AgoStr = getLocalDateString(28);

  // 1. wosandi_daily_logs (Historical seasonality dataset)
  const dailyLogs = [
    { log_date: day7AgoStr, earned_points: 155, total_possible_points: 175, percentage: 89 },
    { log_date: day14AgoStr, earned_points: 145, total_possible_points: 170, percentage: 85 },
    { log_date: day21AgoStr, earned_points: 160, total_possible_points: 180, percentage: 89 },
    { log_date: day28AgoStr, earned_points: 150, total_possible_points: 175, percentage: 86 },
    { log_date: yesterdayStr, earned_points: 135, total_possible_points: 160, percentage: 84 },
    { log_date: day2AgoStr, earned_points: 140, total_possible_points: 165, percentage: 85 },
    { log_date: day3AgoStr, earned_points: 0, total_possible_points: 150, percentage: 0 } // 0-score to test exclusion
  ];

  // 2. wosandi_unit_Paper_marks (Includes 0-score attempts to test zero exclusion)
  const unitPaperMarks = [
    // Mathematics
    { id: 'up_m1', grade: '11', subject_id: 'maths', unit_name: 'ත්‍රිකෝණමිතිය', sub_unit_name: '1.1 සෘජුකෝණී ත්‍රිකෝණ අනුපාත', paper_no: 1, marks: 85, updated_at: getLocalTimestamp(0, 3) },
    { id: 'up_m2', grade: '11', subject_id: 'maths', unit_name: 'ත්‍රිකෝණමිතිය', sub_unit_name: '1.1 සෘජුකෝණී ත්‍රිකෝණ අනුපාත', paper_no: 2, marks: 0, updated_at: getLocalTimestamp(0, 2) }, // 0-score to exclude
    { id: 'up_m3', grade: '11', subject_id: 'maths', unit_name: 'ත්‍රිකෝණමිතිය', sub_unit_name: '1.1 සෘජුකෝණී ත්‍රිකෝණ අනුපාත', paper_no: 3, marks: 95, updated_at: getLocalTimestamp(0, 1) },
    { id: 'up_m4', grade: '11', subject_id: 'maths', unit_name: 'වීජ ගණිතය', sub_unit_name: '2.1 වර්ගජ සමීකරණ', paper_no: 1, marks: 78, updated_at: getLocalTimestamp(1, 4) },
    { id: 'up_m5', grade: '11', subject_id: 'maths', unit_name: 'වීජ ගණිතය', sub_unit_name: '2.1 වර්ගජ සමීකරණ', paper_no: 2, marks: 88, updated_at: getLocalTimestamp(1, 2) },

    // Science
    { id: 'up_s1', grade: '11', subject_id: 'science', unit_name: 'ජීවී ලෝකය', sub_unit_name: '1.1 සෛල විභේදනය හා ජාන', paper_no: 1, marks: 90, updated_at: getLocalTimestamp(2, 5) },
    { id: 'up_s2', grade: '11', subject_id: 'science', unit_name: 'ජීවී ලෝකය', sub_unit_name: '1.1 සෛල විභේදනය හා ජාන', paper_no: 2, marks: 0, updated_at: getLocalTimestamp(2, 3) }, // 0-score to exclude
    { id: 'up_s3', grade: '11', subject_id: 'science', unit_name: 'භෞතික පද්ධති', sub_unit_name: '2.1 නිව්ටන්ගේ නියම හා ඝර්ෂණය', paper_no: 1, marks: 82, updated_at: getLocalTimestamp(3, 6) },

    // Sinhala
    { id: 'up_sin1', grade: '11', subject_id: 'sinhala', unit_name: 'ව්‍යාකරණ', sub_unit_name: '1.1 සන්ධි හා සමාස විග්‍රහය', paper_no: 1, marks: 92, updated_at: getLocalTimestamp(0, 4) },

    // History
    { id: 'up_h1', grade: '11', subject_id: 'history', unit_name: 'ශ්‍රී ලංකා ඉතිහාසය', sub_unit_name: '1.1 අනුරාධපුර රාජධානිය', paper_no: 1, marks: 88, updated_at: getLocalTimestamp(1, 5) },

    // Commerce
    { id: 'up_c1', grade: '11', subject_id: 'commerce', unit_name: 'ගිණුම්කරණය', sub_unit_name: '1.1 මූලික ගිණුම්කරණ සමීකරණය', paper_no: 1, marks: 94, updated_at: getLocalTimestamp(2, 2) },

    // ICT
    { id: 'up_ict1', grade: '11', subject_id: 'ict', unit_name: 'පරිගණක වැඩසටහන්කරණය', sub_unit_name: '1.1 Python මූලික සංකල්ප', paper_no: 1, marks: 96, updated_at: getLocalTimestamp(3, 4) },
    { id: 'up_ict2', grade: '11', subject_id: 'ict', unit_name: 'පරිගණක වැඩසටහන්කරණය', sub_unit_name: '1.1 Python මූලික සංකල්ප', paper_no: 2, marks: 0, updated_at: getLocalTimestamp(3, 2) }, // 0-score to exclude

    // Grade 10 Items
    { id: 'up_g10_1', grade: '10', subject_id: 'maths', unit_name: 'පරිමිතිය හා වර්ගඵලය', sub_unit_name: '1.1 ත්‍රිකෝණ වර්ගඵලය', paper_no: 1, marks: 88, updated_at: getLocalTimestamp(0, 2) },
    { id: 'up_g10_2', grade: '10', subject_id: 'science', unit_name: 'පදාර්ථයේ ව්‍යුහය', sub_unit_name: '1.1 පරමාණුක ව්‍යුහය', paper_no: 1, marks: 92, updated_at: getLocalTimestamp(1, 3) },
    { id: 'up_g10_3', grade: '10', subject_id: 'commerce', unit_name: 'ව්‍යාපාර පරිසරය', sub_unit_name: '1.1 ආර්ථික පසුබිම', paper_no: 1, marks: 86, updated_at: getLocalTimestamp(2, 1) },

    // Grade 9 Items (PTS, Health, Tamil)
    { id: 'up_g9_1', grade: '9', subject_id: 'pts', unit_name: 'තාක්ෂණික නිපුණතා', sub_unit_name: '1.1 මූලික ලී වැඩ හා මෙවලම්', paper_no: 1, marks: 90, updated_at: getLocalTimestamp(0, 3) },
    { id: 'up_g9_2', grade: '9', subject_id: 'health', unit_name: 'සෞඛ්‍ය සම්පන්න දිවිය', sub_unit_name: '1.1 සමබල ආහාර වේල', paper_no: 1, marks: 84, updated_at: getLocalTimestamp(1, 2) },
    { id: 'up_g9_3', grade: '9', subject_id: 'tamil', unit_name: 'දෙවන බස ව්‍යවහාරය', sub_unit_name: '1.1 මූලික වාක්‍ය රටා', paper_no: 1, marks: 88, updated_at: getLocalTimestamp(2, 4) }
  ];

  // 3. wosandi_full_papers (Includes exam_date and timestamps)
  const fullPapers = [
    { id: 'fp_1', grade: '11', subject_id: 'science', marks: 86, exam_date: day2AgoStr, updated_at: getLocalTimestamp(2, 6) },
    { id: 'fp_2', grade: '11', subject_id: 'maths', marks: 92, exam_date: day8AgoStr, updated_at: getLocalTimestamp(8, 2) },
    { id: 'fp_3', grade: '11', subject_id: 'history', marks: 0, exam_date: day3AgoStr, updated_at: getLocalTimestamp(3, 1) }, // 0-score
    { id: 'fp_g10', grade: '10', subject_id: 'maths', marks: 85, exam_date: day8AgoStr, updated_at: getLocalTimestamp(8, 4) },
    { id: 'fp_g9', grade: '9', subject_id: 'science', marks: 88, exam_date: day8AgoStr, updated_at: getLocalTimestamp(8, 5) }
  ];

  // 4. wosandi_space_repetition (Spaced Repetition items for Priority 2 & Streak)
  const spaceRepetition = [
    {
      id: 'sr_1',
      grade: '11',
      subject_id: 'history',
      unit_name: 'ශ්‍රී ලංකා ඉතිහාසය',
      sub_unit_name: 'අනුරාධපුර රාජධානියේ වාරි කර්මාන්තය',
      stage: 3,
      due_today: true,
      completed_at: null,
      updated_at: getLocalTimestamp(0, 1)
    },
    {
      id: 'sr_2',
      grade: '11',
      subject_id: 'sinhala',
      unit_name: 'සාහිත්‍යය',
      sub_unit_name: 'ගුත්තිල කාව්‍ය රසවින්දනය',
      stage: 1,
      due_today: true,
      completed_at: null,
      updated_at: getLocalTimestamp(0, 2)
    },
    {
      id: 'sr_3',
      grade: '11',
      subject_id: 'maths',
      unit_name: 'ජ්‍යාමිතිය',
      sub_unit_name: 'වෘත්ත ප්‍රමේයයන්',
      stage: 2,
      due_today: false,
      completed_at: getLocalTimestamp(1, 5),
      updated_at: getLocalTimestamp(1, 5)
    },
    {
      id: 'sr_g10',
      grade: '10',
      subject_id: 'science',
      unit_name: 'රසායන විද්‍යාව',
      sub_unit_name: 'රසායනික බන්ධන',
      stage: 2,
      due_today: true,
      completed_at: null,
      updated_at: getLocalTimestamp(0, 2)
    },
    {
      id: 'sr_g9',
      grade: '9',
      subject_id: 'pts',
      unit_name: 'තාක්ෂණික ඇඳීම',
      sub_unit_name: 'ජ්‍යාමිතික හැඩතල',
      stage: 1,
      due_today: true,
      completed_at: null,
      updated_at: getLocalTimestamp(0, 1)
    }
  ];

  // 5. wosandi_lessons (Satisfies Priorities 1, 5, 6, and Pending Test Papers Filter)
  const lessons = [
    {
      id: 'les_1',
      grade: '11',
      subject_id: 'maths',
      unit_name: 'ත්‍රිකෝණමිතිය',
      sub_unit_name: 'උන්නතාංශ හා අවනතාංශ කෝණ',
      lesson_name: 'ගණිතය: උන්නතාංශ හා අවනතාංශ කෝණ',
      lesson_done: true,
      hw_done: true,
      hw_days: 0,
      attempts: 0,
      needs_model_paper_1: true,
      unit_paper: null,
      updated_at: getLocalTimestamp(0, 2)
    },
    {
      id: 'les_2',
      grade: '11',
      subject_id: 'science',
      unit_name: 'භෞතික පද්ධති',
      sub_unit_name: 'චලිත ප්‍රස්ථාර හා සමීකරණ',
      lesson_name: 'විද්‍යාව: චලිත ප්‍රස්ථාර හා සමීකරණ',
      lesson_done: true,
      hw_done: true,
      hw_days: 0,
      attempts: 1,
      needs_model_paper_1: false,
      unit_paper: { paper_no: 1, marks: 88 },
      updated_at: getLocalTimestamp(0, 3)
    },
    {
      id: 'les_3',
      grade: '11',
      subject_id: 'commerce',
      unit_name: 'ගිණුම්කරණය',
      sub_unit_name: 'ද්විත්ව සටහන් මූලධර්මය',
      lesson_name: 'වාණිජ: ද්විත්ව සටහන් මූලධර්මය',
      lesson_done: true,
      hw_done: true,
      hw_days: 0,
      attempts: 2,
      needs_model_paper_1: false,
      unit_paper: { paper_no: 2, marks: 92 },
      updated_at: getLocalTimestamp(0, 1)
    },
    {
      id: 'les_4',
      grade: '11',
      subject_id: 'science',
      unit_name: 'ආලෝකය',
      sub_unit_name: 'ආලෝකයේ වර්තනය හා කාච',
      lesson_name: 'විද්‍යාව: ආලෝකයේ වර්තනය හා කාච',
      lesson_done: true,
      hw_done: false,
      hw_days: 4,
      attempts: 0,
      needs_model_paper_1: false,
      unit_paper: null,
      updated_at: getLocalTimestamp(4, 0)
    },
    {
      id: 'les_5',
      grade: '11',
      subject_id: 'history',
      unit_name: 'විදේශ ආක්‍රමණ',
      sub_unit_name: 'පෘතුගීසි පාලනය ලංකාවට බලපෑ අයුරු',
      lesson_name: 'ඉතිහාසය: පෘතුගීසි පාලනය',
      lesson_done: true,
      hw_done: false,
      hw_days: 5,
      attempts: 0,
      needs_model_paper_1: false,
      unit_paper: null,
      updated_at: getLocalTimestamp(5, 0)
    },
    {
      id: 'les_g10_1',
      grade: '10',
      subject_id: 'maths',
      unit_name: 'ජ්‍යාමිතිය',
      sub_unit_name: 'ත්‍රිකෝණ අනුරූපතාව',
      lesson_name: 'ගණිතය: ත්‍රිකෝණ අනුරූපතාව',
      lesson_done: true,
      hw_done: true,
      hw_days: 0,
      attempts: 0,
      needs_model_paper_1: true,
      unit_paper: null,
      updated_at: getLocalTimestamp(0, 2)
    },
    {
      id: 'les_g9_1',
      grade: '9',
      subject_id: 'pts',
      unit_name: 'තාක්ෂණික නිපුණතා',
      sub_unit_name: 'විදුලි පරිපථ හා රැහැන් ඇදීම',
      lesson_name: 'PTS: විදුලි පරිපථ හා රැහැන් ඇදීම',
      lesson_done: true,
      hw_done: true,
      hw_days: 0,
      attempts: 0,
      needs_model_paper_1: true,
      unit_paper: null,
      updated_at: getLocalTimestamp(0, 3)
    }
  ];

  // 6. subUnits (Satisfies Priority 6: Least-Practiced Sub-Unit Detector)
  const subUnits = [
    {
      id: 'su_1',
      grade: '11',
      subject_id: 'maths',
      name: 'ගණිතය: වර්ගජ සමීකරණ හා ප්‍රස්තාර',
      lesson_done: true,
      hw_done: true,
      activity_count: 1
    },
    {
      id: 'su_2',
      grade: '11',
      subject_id: 'science',
      name: 'විද්‍යාව: සෛල විභේදනය හා ජාන විද්‍යාව',
      lesson_done: true,
      hw_done: true,
      activity_count: 5
    },
    {
      id: 'su_3',
      grade: '11',
      subject_id: 'history',
      name: 'ඉතිහාසය: පුරාවිද්‍යා මූලාශ්‍ර හා සාහිත්‍යය',
      lesson_done: true,
      hw_done: true,
      activity_count: 8
    },
    {
      id: 'su_g10',
      grade: '10',
      subject_id: 'maths',
      name: 'ගණිතය: ලඝුගණක හා දර්ශක',
      lesson_done: true,
      hw_done: true,
      activity_count: 1
    },
    {
      id: 'su_g9',
      grade: '9',
      subject_id: 'pts',
      name: 'PTS: ලී වැඩ මෙවලම් හා ආරක්ෂිත ක්‍රම',
      lesson_done: true,
      hw_done: true,
      activity_count: 1
    }
  ];

  return { dailyLogs, unitPaperMarks, fullPapers, spaceRepetition, lessons, subUnits };
}

export class DataService {
  constructor() {
    this.mockDb = buildMockDatabase();
  }

  /**
   * Attempts live query strictly on tables with wosandi_* prefix
   */
  async querySupabaseTable(tableName, grade, activeSubjectIds) {
    if (!tableName.startsWith('wosandi_')) {
      console.warn(`Blocked non-wosandi table query: ${tableName}`);
      return null;
    }

    try {
      const url = `${SUPABASE_URL}/rest/v1/${tableName}?grade=eq.${grade}&select=*`;
      const resp = await fetch(url, {
        headers: {
          'apikey': SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.filter(item => !item.subject_id || activeSubjectIds.has(item.subject_id));
        }
      }
    } catch (e) {}
    return null;
  }

  /**
   * Primary scoped fetcher: aggregates data for active grade & active subjects
   */
  async getScopedData(grade = '11') {
    const activeSubjects = subjectManager.getActiveSubjects();
    const activeSubjectIds = new Set(activeSubjects.map(s => s.id));

    // Try live wosandi_* queries in parallel
    const [liveUP, liveFP, liveSR, liveLessons, liveLogs] = await Promise.all([
      this.querySupabaseTable('wosandi_unit_paper_marks', grade, activeSubjectIds),
      this.querySupabaseTable('wosandi_full_papers', grade, activeSubjectIds),
      this.querySupabaseTable('wosandi_space_repetition', grade, activeSubjectIds),
      this.querySupabaseTable('wosandi_lessons', grade, activeSubjectIds),
      this.querySupabaseTable('wosandi_daily_logs', grade, activeSubjectIds)
    ]);

    const scopedUP = (liveUP || this.mockDb.unitPaperMarks).filter(
      item => item.grade === String(grade) && activeSubjectIds.has(item.subject_id)
    );
    const scopedFP = (liveFP || this.mockDb.fullPapers).filter(
      item => item.grade === String(grade) && activeSubjectIds.has(item.subject_id)
    );
    const scopedSR = (liveSR || this.mockDb.spaceRepetition).filter(
      item => item.grade === String(grade) && activeSubjectIds.has(item.subject_id)
    );
    const scopedLessons = (liveLessons || this.mockDb.lessons).filter(
      item => item.grade === String(grade) && activeSubjectIds.has(item.subject_id)
    );
    const scopedSubUnits = this.mockDb.subUnits.filter(
      item => item.grade === String(grade) && activeSubjectIds.has(item.subject_id)
    );
    const scopedDailyLogs = liveLogs || this.mockDb.dailyLogs;

    // Calculate recency dates for Priority 3 & 4 (strictly excluding 0-scores)
    const validFP = scopedFP.filter(p => p.marks !== null && p.marks !== undefined && Number(p.marks) > 0);
    const validUP = scopedUP.filter(p => p.marks !== null && p.marks !== undefined && Number(p.marks) > 0);

    const lastFullPaperDate = validFP.length > 0 
      ? validFP.map(p => p.exam_date || p.updated_at).sort().reverse()[0]
      : getLocalDateString(8);

    const lastUnitPaperDate = validUP.length > 0
      ? validUP.map(p => p.updated_at).sort().reverse()[0]
      : getLocalDateString(1);

    const urgentModelPapers = scopedLessons.filter(l => l.needs_model_paper_1);

    const now = new Date();
    const timestampStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const lastUpdated = `${getLocalDateString(0)} ${timestampStr}`;

    try {
      localStorage.setItem(STORAGE_LAST_UPDATED, lastUpdated);
    } catch (e) {}

    return {
      grade,
      activeSubjects,
      unitPaperMarks: scopedUP,
      fullPapers: scopedFP,
      spaceRepetition: scopedSR,
      lessons: scopedLessons,
      subUnits: scopedSubUnits,
      dailyLogs: scopedDailyLogs,
      urgentModelPapers,
      lastFullPaperDate,
      lastUnitPaperDate,
      lastUpdated
    };
  }
}

export const dataService = new DataService();
