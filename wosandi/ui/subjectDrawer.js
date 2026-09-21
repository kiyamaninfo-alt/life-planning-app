/**
 * Subject Drawer / Modal Component - Wosandi O/L Mission Control
 * Strict Namespace: wosandi_ol_*
 */

import { subjectManager } from '../controllers/subjectManager.js';

const CATEGORIES = [
  {
    id: 'core',
    titleEn: 'Core / Academic',
    titleSi: 'ප්‍රධාන / අධ්‍යයන විෂයයන් (Core)',
    descSi: 'ගණිතය, විද්‍යාව, සිංහල, ඉංග්‍රීසි, ඉතිහාසය, ආගම',
    badgeColor: '#2563eb'
  },
  {
    id: 'social_business',
    titleEn: 'Basket I / Social & Business',
    titleSi: 'කාණ්ඩ I / සමාජීය හා වාණිජ (Social & Business)',
    descSi: 'ව්‍යාපාර හා ගිණුම්කරණය, භූගෝල විද්‍යාව, පුරවැසි අධ්‍යාපනය',
    badgeColor: '#059669'
  },
  {
    id: 'aesthetics',
    titleEn: 'Basket II / Aesthetics',
    titleSi: 'කාණ්ඩ II / සෞන්දර්ය විෂයයන් (Aesthetics)',
    descSi: 'චිත්‍ර, පෙරදිග සංගීතය, බටහිර සංගීතය, නර්තනය, නාට්‍ය හා රංග කලාව',
    badgeColor: '#7c3aed'
  },
  {
    id: 'technical_applied',
    titleEn: 'Basket III / Technical & Applied',
    titleSi: 'කාණ්ඩ III / තාක්ෂණික හා කුසලතා (Technical & Applied)',
    descSi: 'තොරතුරු තාක්ෂණය (ICT), කෘෂිකර්මය, සෞඛ්‍ය, PTS, ගෘහ ආර්ථික විද්‍යාව',
    badgeColor: '#d97706'
  },
  {
    id: 'additional_languages',
    titleEn: 'Additional / Languages',
    titleSi: 'අමතර / භාෂා විෂයයන් (Additional & Languages)',
    descSi: 'දෙවන බස දෙමළ, ඉංග්‍රීසි සාහිත්‍යය',
    badgeColor: '#db2777'
  }
];

export class SubjectDrawer {
  constructor() {
    this.isOpen = false;
    this.drawerEl = null;
    this.overlayEl = null;
    this.init();
  }

  init() {
    this.createDrawerDOM();
    this.bindGlobalEvents();
  }

  createDrawerDOM() {
    // Overlay
    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'wosandi-drawer-overlay hidden';
    this.overlayEl.id = 'wosandiSubjectDrawerOverlay';

    // Drawer container
    this.drawerEl = document.createElement('div');
    this.drawerEl.className = 'wosandi-drawer';
    this.drawerEl.id = 'wosandiSubjectDrawer';

    this.overlayEl.appendChild(this.drawerEl);
    document.body.appendChild(this.overlayEl);

    this.overlayEl.addEventListener('click', (e) => {
      if (e.target === this.overlayEl) this.close();
    });
  }

  bindGlobalEvents() {
    const triggerBtn = document.getElementById('btnOpenSubjectDrawer');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => this.open());
    }
  }

  open() {
    this.render();
    this.overlayEl.classList.remove('hidden');
    this.isOpen = true;
  }

  close() {
    this.overlayEl.classList.add('hidden');
    this.isOpen = false;
  }

  render() {
    const allSubjects = subjectManager.subjects;

    const sectionsHtml = CATEGORIES.map(cat => {
      const catSubjects = allSubjects.filter(s => s.category === cat.id);
      if (catSubjects.length === 0) return '';

      const itemsHtml = catSubjects.map(sub => `
        <label class="drawer-subject-item ${sub.isActive ? 'active' : ''}">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" class="drawer-checkbox" data-id="${sub.id}" ${sub.isActive ? 'checked' : ''}>
            <div>
              <strong style="display: block; font-size: 0.9rem;">${sub.name}</strong>
              <span style="font-size: 0.75rem; color: #64748b;">${sub.code}</span>
            </div>
          </div>
          <span style="font-size: 0.7rem; font-weight: 700; color: ${sub.isActive ? '#16a34a' : '#94a3b8'};">
            ${sub.isActive ? 'සක්‍රියයි' : 'අක්‍රියයි'}
          </span>
        </label>
      `).join('');

      return `
        <div style="margin-bottom: 16px;">
          <h4 style="margin: 0 0 4px 0; font-size: 0.9rem; color: ${cat.badgeColor}; font-weight: 700;">
            ${cat.titleSi}
          </h4>
          <p style="margin: 0 0 8px 0; font-size: 0.75rem; color: #64748b;">${cat.descSi}</p>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');

    this.drawerEl.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0; margin-bottom: 16px;">
        <h3 style="margin: 0; font-size: 1.15rem; font-weight: bold; color: #0f172a;">📚 විෂයයන් තේරීම (Active Subjects)</h3>
        <button id="btnCloseDrawer" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: #64748b;">&times;</button>
      </div>
      <div style="overflow-y: auto; max-height: calc(85vh - 100px);">
        ${sectionsHtml}
      </div>
    `;

    // Attach events
    this.drawerEl.querySelector('#btnCloseDrawer').addEventListener('click', () => this.close());

    this.drawerEl.querySelectorAll('.drawer-checkbox').forEach(box => {
      box.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        subjectManager.toggleSubject(id);
        this.render();
      });
    });
  }
}
