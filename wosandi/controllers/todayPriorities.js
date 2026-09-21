/**
 * Today's Priorities Controller - Wosandi O/L Mission Control
 * Strict Table Prefix: wosandi_*
 */

export class TodayPriorities {
  constructor(containerId = 'prioritiesContent') {
    this.container = document.getElementById(containerId);
  }

  calculateDaysElapsed(dateString) {
    if (!dateString) return null;
    const target = new Date(dateString);
    const today = new Date();
    const diffTime = Math.abs(today - target);
    return Math.floor(diffTime / (1000 * 60 * 60 * 24));
  }

  evaluatePriorities(data = {}) {
    const {
      urgentModelPapers = [],
      spacedRepetition = [],
      lastFullPaperDate = null,
      lastUnitPaperDate = null,
      lessons = [],
      subUnits = []
    } = data;

    const priorities = [];

    // 1. Urgent Model Paper Target
    const urgentTarget = urgentModelPapers.find(p => p.needs_model_paper_1);
    if (urgentTarget) {
      priorities.push({
        icon: '⚡',
        title: 'වහාම Model Paper 1 කළ යුතු පාඩම',
        desc: `${urgentTarget.lesson_name || urgentTarget.sub_unit_name || 'පාඩම හඳුනාගෙන නැත'} (Urgent Radar)`,
        badge: 'Urgent',
        badgeClass: 'badge-urgent'
      });
    }

    // 2. Spaced Repetition Review Target
    const pendingReviews = spacedRepetition.filter(item => !item.completed_at && item.due_today);
    if (pendingReviews.length > 0) {
      priorities.push({
        icon: '🧠',
        title: 'අමතකවීමේ වක්‍රය - Spaced Repetition',
        desc: `අද සමාලෝචනය කළ යුතු මාතෘකා ${pendingReviews.length}ක් ඇත.`,
        badge: 'Review',
        badgeClass: 'badge-review'
      });
    }

    // 3. Full Paper Recency Counter
    const fullPaperDays = this.calculateDaysElapsed(lastFullPaperDate);
    priorities.push({
      icon: '📝',
      title: 'Full Paper Recency',
      desc: fullPaperDays !== null ? `අවසන් Full Paper එක කර දින ${fullPaperDays}ක් ගතවී ඇත.` : 'තවමත් Full Paper එකක් කර නොමැත.',
      badge: fullPaperDays > 7 ? 'Attention' : 'Normal',
      badgeClass: fullPaperDays > 7 ? 'badge-attention' : 'badge-normal'
    });

    // 4. Unit Paper Recency Counter
    const unitPaperDays = this.calculateDaysElapsed(lastUnitPaperDate);
    priorities.push({
      icon: '📑',
      title: 'Unit Paper Recency',
      desc: unitPaperDays !== null ? `අවසන් Unit Paper එක කර දින ${unitPaperDays}ක් ගතවී ඇත.` : 'තවමත් Unit Paper එකක් කර නොමැත.',
      badge: unitPaperDays > 3 ? 'Attention' : 'Normal',
      badgeClass: unitPaperDays > 3 ? 'badge-attention' : 'badge-normal'
    });

    // 5. Untested Completed Lessons Alert
    const untestedLessons = lessons.filter(l => l.lesson_done === true && (l.attempts === 0 || !l.attempts));
    if (untestedLessons.length > 0) {
      priorities.push({
        icon: '⚠️',
        title: 'උගන්වා අවසන්, නමුත් Paper නොකළ පාඩම්',
        desc: `${untestedLessons.length} කට තවමත් පේපර් කර නොමැත.`,
        badge: 'Action Needed',
        badgeClass: 'badge-attention'
      });
    }

    // 6. Least-Practiced Sub-Unit Detector
    const leastPracticed = subUnits
      .filter(su => su.lesson_done === true && su.hw_done === true)
      .sort((a, b) => (a.activity_count || 0) - (b.activity_count || 0))[0];
    if (leastPracticed) {
      priorities.push({
        icon: '🎯',
        title: 'අවම පුහුණුවක් ලැබූ Sub-Unit එක',
        desc: `${leastPracticed.name} (ක්‍රියාකාරකම්: ${leastPracticed.activity_count || 0})`,
        badge: 'Focus',
        badgeClass: 'badge-focus'
      });
    }

    return priorities;
  }

  render(data = {}) {
    if (!this.container) return;
    const items = this.evaluatePriorities(data);

    if (items.length === 0) {
      this.container.innerHTML = '<p style="color: #64748b; font-size: 0.9rem;">අද දිනට නියමිත විශේෂ ප්‍රමුඛතා නොමැත. විශිෂ්ටයි! 🎉</p>';
      return;
    }

    const html = items.map(item => `
      <div class="priority-item">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.3rem;">${item.icon}</span>
          <div>
            <strong style="display: block; font-size: 0.92rem; color: #0f172a;">${item.title}</strong>
            <span style="font-size: 0.82rem; color: #64748b;">${item.desc}</span>
          </div>
        </div>
        <span class="badge ${item.badgeClass}">${item.badge}</span>
      </div>
    `).join('');

    this.container.innerHTML = html;
  }
}
