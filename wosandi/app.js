/**
 * Wosandi O/L Mission Control - Core Orchestrator
 * 
 * Strict Features Implemented:
 * 1. SVG Circular Progress Bar & Synchronized CountUp Animation (60fps hardware-accelerated)
 * 2. Dynamic Filter Reactivity & Zero / Division-by-Zero Guard
 * 3. Day-of-Week Estimation (Historical Seasonality) & Dynamic Weighted Scoring Engine
 * 4. Zero Interference with Existing Database Tables
 * 5. Strict Zero-Score Exclusion & Multi-Source Streak
 */

import { CircularGraph } from './ui/circularGraph.js';
import { SubjectDrawer } from './ui/subjectDrawer.js';
import { subjectManager } from './controllers/subjectManager.js';
import { scoringEngine } from './controllers/scoringEngine.js';
import { QuestionnaireController } from './controllers/questionnaireController.js';
import { GradeController } from './controllers/gradeController.js';
import { TodayPriorities } from './controllers/todayPriorities.js';
import { UnitAnalytics } from './controllers/unitAnalytics.js';
import { dataService } from './controllers/dataService.js';

class WosandiMissionControlApp {
  constructor() {
    this.currentGrade = localStorage.getItem('wosandi_ol_active_grade') || '11';
    this.activeAnalyticsTab = 'sub_unit'; // 'sub_unit' | 'unit_wise'
    this.cachedData = null;

    // 1. Initialize Circular Graph UI Engine
    this.circularGraph = new CircularGraph({
      circle: '#wosandiProgressCircle',
      percentEl: '#wosandiProgressPercent',
      scoreEl: '#wosandiScoreText',
      statusEl: '#wosandiRankBadge',
      duration: 600
    });

    // 2. Initialize Controllers & Components
    this.questionnaire = new QuestionnaireController('questionnaireContainer');
    this.priorities = new TodayPriorities('prioritiesContent');
    this.gradeController = new GradeController();
    this.subjectDrawer = new SubjectDrawer();

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.renderDashboard();
  }

  setupEventListeners() {
    // Grade Filter Mutation
    window.addEventListener('wosandi:gradeChanged', async (e) => {
      this.currentGrade = e.detail.gradeLevel;
      const filterBadge = document.getElementById('activeFiltersBadge');
      if (filterBadge) filterBadge.innerText = `Grade ${this.currentGrade}`;
      await this.renderDashboard();
    });

    // Subject Filter Mutation
    window.addEventListener('wosandi:subjectsChanged', async () => {
      await this.renderDashboard();
    });
  }

  async renderDashboard() {
    try {
      // Fetch scoped data strictly using wosandi_* queries or mock db
      const data = await dataService.getScopedData(this.currentGrade);
      this.cachedData = data;

      // Update Filter Badge
      const filterBadge = document.getElementById('activeFiltersBadge');
      if (filterBadge) {
        const activeCount = subjectManager.getActiveSubjects().length;
        filterBadge.innerText = `Grade ${this.currentGrade} (${activeCount} විෂයන්)`;
      }

      // 0. Last Updated Timestamp
      const lastUpdatedBadge = document.getElementById('lastUpdatedBadge');
      if (lastUpdatedBadge && data.lastUpdated) {
        lastUpdatedBadge.textContent = `යාවත්කාලීන විය: ${data.lastUpdated}`;
      }

      // 3.1 Day-of-the-Week Target Estimation (Historical Seasonality)
      const today = new Date();
      const currentDow = today.getDay();
      const dowBenchmark = scoringEngine.calculateDayOfWeekBenchmark(currentDow, data.dailyLogs);

      const benchmarkBadge = document.getElementById('dowBenchmarkBadge');
      const benchmarkDesc = document.getElementById('dowBenchmarkDesc');
      if (benchmarkBadge) {
        benchmarkBadge.innerText = `🎯 අද (${dowBenchmark.dayProfile.nameSi}) ඉලක්කය: ${dowBenchmark.benchmarkPoints} pts`;
      }
      if (benchmarkDesc) {
        benchmarkDesc.innerText = dowBenchmark.details;
      }

      // 3.2 Dynamic Adaptive Questionnaire & Real-Time Recalculation
      this.questionnaire.render(this.currentGrade, data.activeSubjects, (activeQuestions) => {
        // Real-time calculation callback whenever questionnaire mutates
        const scoreResult = scoringEngine.calculateWeightedScore(activeQuestions);

        let rankText = '🌟 Target Ready';
        if (scoreResult.percentage >= 90) rankText = '👑 Master Scholar';
        else if (scoreResult.percentage >= 75) rankText = '✨ High Achiever';
        else if (scoreResult.percentage >= 50) rankText = '🎀 Active Learner';

        // 1.1 & 1.2 Smooth 60fps Hardware-Accelerated SVG Arc & Synchronized CountUp
        this.circularGraph.update(scoreResult.earnedPoints, scoreResult.totalObtainablePoints, rankText);
      });

      // 1. Render Top Priorities (6 Actionable Priority Rules)
      this.priorities.render({
        urgentModelPapers: data.urgentModelPapers,
        spacedRepetition: data.spaceRepetition,
        lastFullPaperDate: data.lastFullPaperDate,
        lastUnitPaperDate: data.lastUnitPaperDate,
        lessons: data.lessons,
        subUnits: data.subUnits
      });

      // 2. Render Multi-Source Activity Streak (Strictly excluding 0-scores)
      const streakDays = UnitAnalytics.calculateStreak({
        unitPapers: data.unitPaperMarks,
        fullPapers: data.fullPapers,
        spaceRepetition: data.spaceRepetition
      });
      const streakContainer = document.getElementById('streakContent');
      if (streakContainer) {
        streakContainer.innerHTML = `
          <div style="font-size: 1.45rem; font-weight: 800; color: #ea580c; display: flex; align-items: center; gap: 8px;">
            <span>🔥</span>
            <span>දින ${streakDays} ක අඛණ්ඩ අධ්‍යයනයක්</span>
          </div>
          <p style="font-size: 0.84rem; color: #64748b; margin: 6px 0 0 0;">
            (Unit Papers, Full Papers හෝ Spaced Repetition මත පදනම් වූ Unified Multi-Source Streak)
          </p>
        `;
      }

      // 3. Render Pending Test Papers Filter
      const pendingPapers = UnitAnalytics.filterPendingTestPapers(data.lessons);
      const pendingBadge = document.getElementById('pendingPapersBadge');
      if (pendingBadge) {
        pendingBadge.textContent = `${pendingPapers.length} ක් සූදානම්`;
      }

      const pendingContainer = document.getElementById('pendingPapersContent');
      if (pendingContainer) {
        if (pendingPapers.length === 0) {
          pendingContainer.innerHTML = '<p style="color: #64748b; font-size: 0.88rem; margin: 0;">මෙම මොහොතේ විසඳීමට නියමිත නව Test Papers නොමැත. විශිෂ්ටයි! 🎉</p>';
        } else {
          pendingContainer.innerHTML = pendingPapers.map(p => {
            const paperNo = p.unit_paper ? p.unit_paper.paper_no : 1;
            const ts = p.updated_at ? new Date(p.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'දැන්';
            return `
              <div class="pending-paper-item">
                <div>
                  <strong style="display: block; font-size: 0.92rem; color: #0f172a;">${p.lesson_name || p.sub_unit_name}</strong>
                  <span style="font-size: 0.78rem; color: #64748b;">යාවත්කාලීන කළේ: ${ts}</span>
                </div>
                <span style="font-size: 0.75rem; padding: 4px 10px; border-radius: 9999px; background: #e0f2fe; color: #0369a1; font-weight: 700; white-space: nowrap;">
                  Paper ${paperNo} සූදානම්
                </span>
              </div>
            `;
          }).join('');
        }
      }

      // 4. Render Dual-Tab Analytics (Zero-Score Exclusion strictly enforced)
      this.renderAnalytics(data.unitPaperMarks);

    } catch (error) {
      console.error('Error during Wosandi dashboard execution:', error);
    }
  }

  renderAnalytics(records = []) {
    const btnSubUnit = document.getElementById('tabSubUnit');
    const btnUnitWise = document.getElementById('tabUnitWise');
    const container = document.getElementById('analyticsContent');
    if (!container) return;

    if (btnSubUnit && !btnSubUnit.dataset.tabBound) {
      btnSubUnit.dataset.tabBound = 'true';
      btnSubUnit.addEventListener('click', () => {
        this.activeAnalyticsTab = 'sub_unit';
        this.renderAnalytics(this.cachedData ? this.cachedData.unitPaperMarks : []);
      });
    }
    if (btnUnitWise && !btnUnitWise.dataset.tabBound) {
      btnUnitWise.dataset.tabBound = 'true';
      btnUnitWise.addEventListener('click', () => {
        this.activeAnalyticsTab = 'unit_wise';
        this.renderAnalytics(this.cachedData ? this.cachedData.unitPaperMarks : []);
      });
    }

    if (btnSubUnit) btnSubUnit.className = `tab-btn ${this.activeAnalyticsTab === 'sub_unit' ? 'active' : ''}`;
    if (btnUnitWise) btnUnitWise.className = `tab-btn ${this.activeAnalyticsTab === 'unit_wise' ? 'active' : ''}`;

    const isSubUnit = this.activeAnalyticsTab === 'sub_unit';
    const averages = isSubUnit 
      ? UnitAnalytics.calculateSubUnitAverages(records)
      : UnitAnalytics.calculateUnitWiseAverages(records);

    if (averages.length === 0) {
      container.innerHTML = '<p style="color: #64748b; font-size: 0.88rem; margin: 0;">වලංගු Unit Paper දත්ත නොමැත (ලකුණු 0 বাদදී ඇත).</p>';
      return;
    }

    const rowsHtml = averages.map(row => {
      let pillClass = 'score-low';
      if (row.average >= 75) pillClass = 'score-high';
      else if (row.average >= 50) pillClass = 'score-mid';

      return `
        <tr>
          <td style="font-weight: 500;">${row.name}</td>
          <td style="text-align: center; color: #64748b;">${row.attempts}</td>
          <td style="text-align: right;">
            <span class="score-pill ${pillClass}">${row.average}%</span>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="analytics-table">
          <thead>
            <tr>
              <th>${isSubUnit ? 'Sub-Unit මාතෘකාව' : 'ප්‍රධාන ඒකකය (Unit)'}</th>
              <th style="text-align: center; width: 110px;">Attempts</th>
              <th style="text-align: right; width: 120px;">සාමාන්‍යය</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.wosandiApp = new WosandiMissionControlApp();
});
