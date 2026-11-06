/**
 * KSA Zonhoven - Mobile Web App Controller
 * Logic for navigation tabs, group switching, countdown, lightbox, filters & PWA install.
 */

/* ==========================================================================
   0. SERVICE WORKER & AUTOMATISCHE PWA APP UPDATES
   ========================================================================== */
let refreshing = false;

function showAppUpdateNotification(reg) {
  if (document.getElementById('ksaPwaUpdateToast')) return;

  const toast = document.createElement('div');
  toast.id = 'ksaPwaUpdateToast';
  toast.className = 'pwa-update-toast';
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="pwa-update-toast-content">
      <div class="pwa-update-icon">✨</div>
      <div class="pwa-update-text">
        <strong>Nieuwe versie beschikbaar!</strong>
        <span>Tik om direct bij te werken</span>
      </div>
      <button type="button" class="pwa-update-btn" id="pwaUpdateBtn">Vernieuwen</button>
      <button type="button" class="pwa-update-close" id="pwaUpdateClose" aria-label="Sluiten">✕</button>
    </div>
  `;

  document.body.appendChild(toast);

  const updateBtn = document.getElementById('pwaUpdateBtn');
  const closeBtn = document.getElementById('pwaUpdateClose');

  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      updateBtn.disabled = true;
      updateBtn.textContent = 'Bezig...';
      if (reg && reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      toast.remove();
    });
  }
}

function registerServiceWorkerWithAutoUpdate() {
  if (!('serviceWorker' in navigator)) return;

  // Luister naar controllerwisseling (nieuwe service worker is geactiveerd) -> herlaad de app één keer
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker geregistreerd:', reg.scope);

        // 1. Controleer of er al een nieuwe worker in de wachtrij staat
        if (reg.waiting) {
          showAppUpdateNotification(reg);
        }

        // 2. Ontdek nieuwe versies op de achtergrond
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showAppUpdateNotification(reg);
            }
          });
        });

        // 3. Proactief direct controleren op updates bij openen
        reg.update().catch(() => {});

        // 4. Controleer op updates zodra de gebruiker terugkeert naar de app
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            reg.update().catch(() => {});
          }
        });

        // 5. Periodieke updatecheck elke 15 minuten als de app open blijft staan
        setInterval(() => {
          reg.update().catch(() => {});
        }, 15 * 60 * 1000);
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registratie mislukt:', err);
      });
  });
}

registerServiceWorkerWithAutoUpdate();

document.addEventListener('DOMContentLoaded', () => {
  initMobileNavigation();
  initGroupTabs();
  initGroupSwipe();
  initMobileCountdown();
  initCalendarFilters();
  initMobileCalendarDownload();
  initPaspoortModal();
  initPwaInstall();
  initPrivacyModal();
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

  // Bind in-page trigger buttons (e.g. data-switch-tab="agenda" of shortcut data-href) via event delegation
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-switch-tab], .shortcut-tile[data-href]');
    if (!btn) return;
    if (document.body.classList.contains('ksa-edit-mode-active')) {
      // In Edit Mode: voorkom actie zodat knoppen en teksten bewerkt kunnen worden
      return;
    }
    const href = btn.getAttribute('data-href');
    if (href) {
      e.preventDefault();
      if (href.startsWith('#')) {
        activateTab(href.replace('#', ''));
      } else {
        window.open(href, href.startsWith('http') ? '_blank' : '_self');
      }
      return;
    }
    const target = btn.getAttribute('data-switch-tab');
    if (target) {
      e.preventDefault();
      activateTab(target);
    }
  });

  // Check URL parameter (?tab=) or hash (#...) on initial load
  const urlParams = new URLSearchParams(window.location.search);
  const initialTab = urlParams.get('tab') || window.location.hash || '';
  if (initialTab) {
    activateTab(initialTab);
  }

  // Listen to browser back/forward or hash change
  window.addEventListener('hashchange', () => {
    const hash = window.location.hash;
    if (hash) {
      activateTab(hash);
    }
  });

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
      btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    });
  });

  // Initialize with first group
  renderGroup('kabouters');
  initGroupSwipe();
  window.mobileGroupData = mobileGroupData;
  window.renderMobileGroup = renderGroup;
  window.initPaspoortModal = initPaspoortModal;
}

/* ==========================================================================
   2b. GROEPEN SWIPE / DRAG OP AFBEELDING
   ========================================================================== */
function initGroupSwipe() {
  const wrap = document.querySelector('.group-image-wrap');
  const imgEl = document.getElementById('mGroupImg');
  if (!wrap || !imgEl) return;
  if (wrap.dataset.swipeInitialized) return;
  wrap.dataset.swipeInitialized = '1';

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let isDragging = false;
  let isHorizontalSwipe = false;
  let hasMoved = false;

  function getVisibleButtons() {
    return Array.from(document.querySelectorAll('.group-select-btn')).filter(b => {
      return window.getComputedStyle(b).display !== 'none';
    });
  }

  function switchToGroup(direction) {
    const buttons = getVisibleButtons();
    if (buttons.length <= 1) return;

    const currentIdx = buttons.findIndex(b => b.classList.contains('active'));
    let newIdx = 0;
    if (direction === 'next') {
      newIdx = (currentIdx + 1) % buttons.length;
    } else {
      newIdx = (currentIdx - 1 + buttons.length) % buttons.length;
    }

    const nextBtn = buttons[newIdx];
    if (nextBtn) {
      // Vloeiende overgangsanimatie
      imgEl.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
      imgEl.style.transform = direction === 'next' ? 'translateX(-80px)' : 'translateX(80px)';
      imgEl.style.opacity = '0.35';

      setTimeout(() => {
        nextBtn.click();
        imgEl.style.transform = direction === 'next' ? 'translateX(80px)' : 'translateX(-80px)';

        requestAnimationFrame(() => {
          imgEl.style.transition = 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease';
          imgEl.style.transform = 'translateX(0)';
          imgEl.style.opacity = '1';
        });
      }, 150);
    }
  }

  // Touch Events (Smartphones & Tablets)
  wrap.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    isDragging = true;
    isHorizontalSwipe = false;
    hasMoved = false;
    imgEl.style.transition = 'none';
  }, { passive: true });

  wrap.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const diffX = currentX - startX;
    const diffY = currentY - startY;

    if (!hasMoved) {
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 8) {
        isHorizontalSwipe = true;
        hasMoved = true;
      } else if (Math.abs(diffY) > 8) {
        isDragging = false;
        return;
      }
    }

    if (isHorizontalSwipe) {
      if (e.cancelable) e.preventDefault();
      const clampedX = Math.sign(diffX) * Math.min(Math.abs(diffX), 130);
      imgEl.style.transform = `translateX(${clampedX}px)`;
      imgEl.style.opacity = `${1 - Math.min(Math.abs(clampedX) / 250, 0.55)}`;
    }
  }, { passive: false });

  const onTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;

    const diffX = currentX - startX;
    if (isHorizontalSwipe && Math.abs(diffX) > 40) {
      switchToGroup(diffX < 0 ? 'next' : 'prev');
    } else {
      imgEl.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.22s ease';
      imgEl.style.transform = 'translateX(0)';
      imgEl.style.opacity = '1';
    }
  };

  wrap.addEventListener('touchend', onTouchEnd, { passive: true });
  wrap.addEventListener('touchcancel', onTouchEnd, { passive: true });

  // Muis drag support (Desktop testen / laptop)
  let mouseStartX = 0;
  let isMouseDown = false;
  let mouseMoved = false;

  wrap.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (document.body.classList.contains('ksa-edit-mode-active')) return;

    mouseStartX = e.clientX;
    isMouseDown = true;
    mouseMoved = false;
    imgEl.style.transition = 'none';
  });

  window.addEventListener('mousemove', (e) => {
    if (!isMouseDown) return;
    const diffX = e.clientX - mouseStartX;
    if (Math.abs(diffX) > 6) mouseMoved = true;
    const clampedX = Math.sign(diffX) * Math.min(Math.abs(diffX), 130);
    imgEl.style.transform = `translateX(${clampedX}px)`;
    imgEl.style.opacity = `${1 - Math.min(Math.abs(clampedX) / 250, 0.55)}`;
  });

  window.addEventListener('mouseup', (e) => {
    if (!isMouseDown) return;
    isMouseDown = false;
    const diffX = e.clientX - mouseStartX;
    if (mouseMoved && Math.abs(diffX) > 40) {
      switchToGroup(diffX < 0 ? 'next' : 'prev');
    } else {
      imgEl.style.transition = 'transform 0.22s ease, opacity 0.22s ease';
      imgEl.style.transform = 'translateX(0)';
      imgEl.style.opacity = '1';
    }
  });

  // Navigatie-pijlen over de afbeelding
  if (!wrap.querySelector('.group-swipe-arrow')) {
    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'group-swipe-arrow group-swipe-prev';
    prevBtn.setAttribute('aria-label', 'Vorige groep');
    prevBtn.innerHTML = '‹';
    prevBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchToGroup('prev');
    };

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'group-swipe-arrow group-swipe-next';
    nextBtn.setAttribute('aria-label', 'Volgende groep');
    nextBtn.innerHTML = '›';
    nextBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      switchToGroup('next');
    };

    wrap.appendChild(prevBtn);
    wrap.appendChild(nextBtn);
  }
}

/* ==========================================================================
   3. HALLOKIEN COUNTDOWN TIMER (17 OKTOBER 2026)
   ========================================================================== */
function initMobileCountdown() {
  const now = new Date();
  const workYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const targetDate = new Date(workYearStart, 9, 17, 19, 30, 0, 0);

  const dEl = document.getElementById('mDays');
  const hEl = document.getElementById('mHours');
  const mEl = document.getElementById('mMinutes');
  const sEl = document.getElementById('mSeconds');

  function update() {
    const activeTarget = window.ksaCountdownTargetDate || targetDate;
    const now = Date.now();
    const diff = activeTarget.getTime() - now;

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

  function applyFilter(filter) {
    const items = document.querySelectorAll('.cal-card-item');
    items.forEach(item => {
      const cat = (item.getAttribute('data-category') || '').toLowerCase();
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
  }

  window.filterMobileCalendar = applyFilter;

  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const filter = chip.getAttribute('data-filter') || 'all';
      applyFilter(filter);
    });
  });
}

/* ==========================================================================
   4b. DYNAMIC CALENDAR DOWNLOAD (ACTUELE HIGH-RES JPG EXPORT)
   ========================================================================== */
function initMobileCalendarDownload() {
  const btn = document.getElementById('mobileCalDownloadBtn');
  if (!btn) return;

  btn.addEventListener('click', async (e) => {
    const board = document.getElementById('mobile-kalender-board') || document.querySelector('.cal-list');
    if (!board || typeof html2canvas !== 'function') {
      // Laat de directe href-download doorgaan naar assets/images/real_agenda.jpg
      return;
    }

    e.preventDefault();
    const originalText = btn.innerHTML;

    try {
      btn.innerHTML = '<span>⏳ Genereren...</span>';

      // Zorg dat alle kalenderitems tijdelijk zichtbaar zijn tijdens export
      const allItems = board.querySelectorAll('.cal-card-item');
      const prevDisplays = [];
      allItems.forEach((it, idx) => {
        prevDisplays[idx] = it.style.display;
        it.style.display = 'flex';
      });

      const canvas = await html2canvas(board, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Herstel de filterweergave
      allItems.forEach((it, idx) => {
        it.style.display = prevDisplays[idx];
      });

      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas blob failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'KSA_Zonhoven_Kalender.jpg';
        document.body.appendChild(link);
        link.click();
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }, 2000);

        btn.innerHTML = '<span>✓ Gedownload!</span>';
        setTimeout(() => {
          btn.innerHTML = originalText;
        }, 2500);
      }, 'image/jpeg', 0.95);
    } catch (err) {
      console.warn('Fout bij exporteren mobiele kalender via canvas:', err);
      window.location.href = 'assets/images/real_agenda.jpg';
      btn.innerHTML = originalText;
    }
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

  document.addEventListener('click', (e) => {
    if (document.body.classList.contains('ksa-edit-mode-active')) return;
    const trigger = e.target.closest('[data-paspoort], .paspoort-card, .gallery-item');
    if (!trigger) return;
    if (e.target.closest('.ksa-card-edit-tools')) return;

    const src = trigger.getAttribute('data-paspoort') || trigger.querySelector('img')?.src;
    if (!src) return;
    const name = trigger.getAttribute('data-name') || trigger.querySelector('.paspoort-card-badge')?.textContent || trigger.getAttribute('title') || 'Leidingspaspoort';
    openModal(src, name);
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

/* ==========================================================================
   6. PWA INSTALL BANNER & PROMPTS
   ========================================================================== */
function initPwaInstall() {
  let deferredPrompt = null;
  const banner = document.getElementById('pwaInstallBanner');
  const bannerInstallBtn = document.getElementById('pwaBannerInstallBtn');
  const bannerCloseBtn = document.getElementById('pwaBannerCloseBtn');
  const manualInstallBtn = document.getElementById('pwaManualInstallBtn');
  const infoCard = document.getElementById('pwaInstallInfoCard');
  const iosModal = document.getElementById('pwaIosModal');
  const iosCloseBtn = document.getElementById('pwaIosCloseBtn');

  function checkIsAppInstalled() {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
    if (window.navigator.standalone === true) return true;
    if (document.referrer && document.referrer.includes('android-app://')) return true;
    if (localStorage.getItem('ksa_app_installed') === '1') return true;
    return false;
  }

  function hideAllInstallPrompts() {
    if (banner) banner.style.display = 'none';
    if (infoCard) infoCard.style.display = 'none';
    document.documentElement.classList.add('ksa-standalone-mode');
  }

  // Als de app al geopend is als geïnstalleerde standalone app, verberg alle installatie-elementen
  if (checkIsAppInstalled()) {
    hideAllInstallPrompts();
    return;
  }

  // Detecteer iOS
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  // Android / Chrome: capture beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const dismissedUntil = localStorage.getItem('ksa_pwa_dismissed');
    if (!dismissedUntil || Date.now() > parseInt(dismissedUntil, 10)) {
      if (banner && !checkIsAppInstalled()) banner.style.display = 'block';
    }
  });

  async function triggerInstallFlow() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('ksa_app_installed', '1');
        hideAllInstallPrompts();
      }
      deferredPrompt = null;
    } else if (isIos) {
      if (iosModal) iosModal.classList.add('active');
    } else {
      alert("Tik in het menu van je browser (⋮ of Deel) op 'Toevoegen aan startscherm' of 'App installeren'.");
    }
  }

  if (bannerInstallBtn) {
    bannerInstallBtn.addEventListener('click', triggerInstallFlow);
  }

  if (manualInstallBtn) {
    manualInstallBtn.addEventListener('click', triggerInstallFlow);
  }

  if (bannerCloseBtn) {
    bannerCloseBtn.addEventListener('click', () => {
      if (banner) banner.style.display = 'none';
      localStorage.setItem('ksa_pwa_dismissed', (Date.now() + 7 * 24 * 60 * 60 * 1000).toString());
    });
  }

  if (iosCloseBtn && iosModal) {
    iosCloseBtn.addEventListener('click', () => {
      iosModal.classList.remove('active');
    });
    iosModal.addEventListener('click', (e) => {
      if (e.target === iosModal) iosModal.classList.remove('active');
    });
  }

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('ksa_app_installed', '1');
    hideAllInstallPrompts();
  });
}

/* --------------------------------------------------------------------------
   8. Privacy & Cookies Modal Popup
   -------------------------------------------------------------------------- */
function initPrivacyModal() {
  const modal = document.getElementById('ksaPrivacyModalBackdrop');
  if (!modal) return;

  function openModal(e) {
    if (e) e.preventDefault();
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.topbar-privacy-trigger, .footer-privacy-trigger, .ksa-privacy-trigger, [data-action="privacy"]');
    if (trigger) {
      e.preventDefault();
      openModal();
      return;
    }

    if (e.target === modal || e.target.closest('#ksaClosePrivacyModalBtn') || e.target.closest('#ksaAcceptPrivacyModalBtn')) {
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.style.display === 'flex') {
      closeModal();
    }
  });
}
