/**
 * KSA Zonhoven - Mobile Web App Controller
 * Logic for navigation tabs, group switching, countdown, lightbox & filters.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
  initGroupTabs();
  initMobileCountdown();
  initCalendarFilters();
  initPaspoortModal();
});

/* ==========================================================================
   1. BOTTOM NAV & TAB SWITCHING
   ========================================================================== */
function initMobileNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  function activateTab(tabId) {
    if (!tabId) tabId = 'intro';
    
    // Clean tabId if it includes #
    tabId = tabId.replace('#', '');

    // Map common aliases
    if (tabId === 'home') tabId = 'intro';
    if (tabId === 'kalender') tabId = 'agenda';

    let found = false;
    tabPanes.forEach(pane => {
      if (pane.id === `tab-${tabId}`) {
        pane.classList.add('active');
        found = true;
      } else {
        pane.classList.remove('active');
      }
    });

    if (!found) {
      // Default to intro
      const defaultPane = document.getElementById('tab-intro');
      if (defaultPane) defaultPane.classList.add('active');
      tabId = 'intro';
    }

    navItems.forEach(item => {
      const target = item.getAttribute('data-tab');
      if (target === tabId) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll back to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Update URL hash cleanly
    if (history.replaceState) {
      history.replaceState(null, null, `#${tabId}`);
    }
  }

  // Bind click on bottom dock
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = item.getAttribute('data-tab');
      activateTab(tabId);
    });
  });

  // Bind any in-page trigger buttons (e.g. data-switch-tab="agenda")
  document.querySelectorAll('[data-switch-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const target = btn.getAttribute('data-switch-tab');
      activateTab(target);
    });
  });

  // Check URL hash on initial load
  const initialHash = window.location.hash;
  if (initialHash) {
    activateTab(initialHash);
  }

  // Expose global helper
  window.switchMobileTab = activateTab;
}

/* ==========================================================================
   2. GROEPEN SELECTOR (AGE GROUPS DATA)
   ========================================================================== */
const mobileGroupData = {
  kabouters: {
    name: 'KABOUTERS',
    age: '6 - 8 jaar (1ste & 2de leerjaar)',
    image: 'images/kabouters.jpg',
    tagline: 'Spelen, ontdekken & oneindig veel fantasie!',
    desc: 'Bij de kabouters stappen de allerjongste meisjes binnen in een magische wereld vol plezier. Van tikkertje in het gras en verkleedpartijtjes tot het bouwen van reusachtige zandkastelen.',
    tags: ['✨ Pleinspelen', '🎨 Knutselen', '🏰 Korte namiddagkampjes', '🌈 Verkleedkist'],
    leaders: 'Cara & Nore',
    leaderTarget: 'kabouters'
  },
  sloebers: {
    name: 'SLOEBERS',
    age: '8 - 10 jaar (3de & 4de leerjaar)',
    image: 'images/sloebers.jpg',
    tagline: 'Vol energie, actie en onvermoeibare speurneuzen!',
    desc: 'Sloebers zitten boordevol energie! We bouwen geheime forten in het bos, spelen spannende smokkelspelen en leren samenwerken in de leukste teamuitdagingen.',
    tags: ['🏃 Estafettes & sport', '🌲 Forten bouwen', '🎯 Bosspelen', '🎪 Sfeer & plezier'],
    leaders: 'Lien & Lies',
    leaderTarget: 'sloebers'
  },
  roodkapjes: {
    name: 'ROODKAPJES',
    age: '10 - 12 jaar (5de & 6de leerjaar)',
    image: 'assets/images/real_leiding_roodkappen.jpg',
    tagline: 'Samenwerken, grote bosspelen en echte vriendschap!',
    desc: 'De oudste meisjes van de lagere school! We duiken dieper het bos in met strategische spellen, koken op houtvuur en beleven de leukste avonturen op kamp.',
    tags: ['🏕️ Strategische bosspelen', '🔥 Kampvuur', '🗺️ Geheimschrift & tochten', '👭 Hechte groep'],
    leaders: 'Lotte & Lina\'s',
    leaderTarget: 'jim'
  },
  jim: {
    name: 'JIM',
    age: '12 - 14 jaar (1ste & 2de middelbaar)',
    image: 'images/jim.jpg',
    tagline: 'Avontuurlijk, hechte vriendinnen en dorpsspelen!',
    desc: 'Als Jim-meisje ontdek je meer zelfstandigheid. Gezellige avonden, grote stads- en dorpsspelen, hikes en onvergetelijke zomers.',
    tags: ['🧭 Hikes & tochten', '🚴 Dorpsspelen', '🍳 Koken op kamp', '✨ Vriendschap voor het leven'],
    leaders: 'Lotte, Lina B. & Lina S.',
    leaderTarget: 'jim'
  },
  sim: {
    name: 'SIM',
    age: '14 - 16 jaar (3de & 4de middelbaar)',
    image: 'images/sim.jpg',
    tagline: 'Grensverleggend, dropping en knotsgekke uitdagingen!',
    desc: 'Simmers gaan tot het uiterste! Droppings in het donker, vlotten bouwen, een 24-uurs spel en samen herinneringen smeden die je nooit meer vergeet.',
    tags: ['🌌 Dropping & nachtspel', '🛶 Grensverleggend', '⛺ 10 dagen vol tentenkamp', '🔥 Pure sfeer'],
    leaders: 'Kato & Fien',
    leaderTarget: 'sim'
  },
  kim: {
    name: 'KIM (+16)',
    age: '16 - 17+ jaar (5de & 6de middelbaar)',
    image: 'images/Oonah.jpg',
    tagline: 'Toekomstige leiding, leefweek & onvergetelijke feesten!',
    desc: 'De oudste groep vooraleer je leidster wordt. Samen op leefweek, triptrap, zelf activiteiten ineenboksen en de KSA-spirit doorgeven.',
    tags: ['👑 Klaarstomen voor leiding', '🎉 Feesten & leefweek', '🎒 Triptrap', '❤️ Hart voor KSA'],
    leaders: 'Oonah (Begeleiding)',
    leaderTarget: 'kim'
  }
};

function initGroupTabs() {
  const buttons = document.querySelectorAll('.group-select-btn');
  const imgEl = document.getElementById('mGroupImg');
  const nameEl = document.getElementById('mGroupName');
  const ageEl = document.getElementById('mGroupAge');
  const taglineEl = document.getElementById('mGroupTagline');
  const descEl = document.getElementById('mGroupDesc');
  const tagsEl = document.getElementById('mGroupTags');
  const leadersEl = document.getElementById('mGroupLeaders');
  const viewLeadersBtn = document.getElementById('mViewLeadersBtn');

  if (!buttons.length) return;

  function renderGroup(groupKey) {
    const data = mobileGroupData[groupKey];
    if (!data) return;

    if (imgEl) imgEl.src = data.image;
    if (nameEl) nameEl.textContent = data.name;
    if (ageEl) ageEl.textContent = data.age;
    if (taglineEl) taglineEl.textContent = data.tagline;
    if (descEl) descEl.textContent = data.desc;
    if (leadersEl) leadersEl.textContent = data.leaders;

    if (tagsEl) {
      tagsEl.innerHTML = data.tags.map(t => `<span class="group-tag">${t}</span>`).join('');
    }

    if (viewLeadersBtn) {
      viewLeadersBtn.onclick = () => {
        if (window.switchMobileTab) {
          window.switchMobileTab('leiding');
          const targetSection = document.getElementById(`leader-sec-${data.leaderTarget}`);
          if (targetSection) {
            setTimeout(() => {
              targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 100);
          }
        }
      };
    }
  }

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const groupKey = btn.getAttribute('data-group');
      renderGroup(groupKey);
    });
  });

  // Initialize with first group
  renderGroup('kabouters');
}

/* ==========================================================================
   3. HALLOKIEN COUNTDOWN TIMER (17 OKTOBER 2026)
   ========================================================================== */
function initMobileCountdown() {
  const targetDate = new Date();
  targetDate.setMonth(9); // Oktober (0-indexed)
  targetDate.setDate(17);
  targetDate.setHours(19, 30, 0, 0);

  if (targetDate.getTime() < Date.now()) {
    targetDate.setFullYear(targetDate.getFullYear() + 1);
  }

  const dEl = document.getElementById('mDays');
  const hEl = document.getElementById('mHours');
  const mEl = document.getElementById('mMinutes');
  const sEl = document.getElementById('mSeconds');

  function update() {
    const now = Date.now();
    const diff = targetDate.getTime() - now;

    if (diff <= 0) {
      if (dEl) dEl.innerText = '00';
      if (hEl) hEl.innerText = '00';
      if (mEl) mEl.innerText = '00';
      if (sEl) sEl.innerText = '00';
      return;
    }

    const d = Math.floor(diff / (1000 * 60 * 60 * 24));
    const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const s = Math.floor((diff % (1000 * 60)) / 1000);

    if (dEl) dEl.innerText = String(d).padStart(2, '0');
    if (hEl) hEl.innerText = String(h).padStart(2, '0');
    if (mEl) mEl.innerText = String(m).padStart(2, '0');
    if (sEl) sEl.innerText = String(s).padStart(2, '0');
  }

  update();
  setInterval(update, 1000);
}

/* ==========================================================================
   4. CALENDAR FILTER CHIPS
   ========================================================================== */
function initCalendarFilters() {
  const chips = document.querySelectorAll('.cal-filter-chip');
  const items = document.querySelectorAll('.cal-card-item');

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      const filter = chip.getAttribute('data-filter');

      items.forEach(item => {
        const cat = item.getAttribute('data-category') || '';
        const isPast = item.classList.contains('is-past');

        if (filter === 'all') {
          item.style.display = 'flex';
        } else if (filter === 'upcoming') {
          item.style.display = !isPast ? 'flex' : 'none';
        } else if (filter === 'ksa') {
          item.style.display = cat.includes('ksa') ? 'flex' : 'none';
        } else if (filter === 'special') {
          item.style.display = cat.includes('special') ? 'flex' : 'none';
        }
      });
    });
  });
}

/* ==========================================================================
   5. PASPOORT LIGHTBOX MODAL
   ========================================================================== */
function initPaspoortModal() {
  const modal = document.getElementById('paspoortModal');
  const modalImg = document.getElementById('modalPaspoortImg');
  const modalTitle = document.getElementById('modalPaspoortTitle');
  const closeBtn = document.getElementById('modalCloseBtn');

  if (!modal || !modalImg) return;

  function openModal(imgSrc, titleText) {
    modalImg.src = imgSrc;
    if (modalTitle) modalTitle.textContent = titleText || 'Leidingspaspoort';
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  document.querySelectorAll('[data-paspoort]').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const src = trigger.getAttribute('data-paspoort');
      const name = trigger.getAttribute('data-name');
      openModal(src, name);
    });
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
  }

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
}
