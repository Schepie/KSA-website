/**
 * ============================================================================
 * ✏️ KSA ZONHOVEN - VISUELE "EDIT MODE" MET RECHTSTREEKSE GITHUB OPSLAG
 * ============================================================================
 * Mogelijkheden (100% zonder Google Sheets of Google Forms):
 * 1. Automatische datumcontrole bij elk bezoek: gepasseerde kalenderdata,
 *    evenementen en aftelbanners springen automatisch op 'Voorbij'.
 * 2. Klik onderaan de website op "✏️ Bewerk Website" (pincode: ksa2026) om
 *    de pagina in Edit Mode te zetten.
 * 3. Pas elke tekst, titel, datum, leeftijdgroep, knop of link rechtstreeks
 *    op de pagina aan.
 * 4. Klik op eender welke foto om een nieuwe foto van je PC of GSM te kiezen.
 *    Foto's die op meerdere plekken voorkomen (bv. leidster-icoon + paspoort +
 *    mobiele site) worden automatisch overal tegelijk bijgewerkt!
 * 5. Directe weergave via de GitHub API & Raw fallback zodat nieuwe foto's en
 *    teksten binnen 1 seconde live zichtbaar zijn op elk toestel!
 * ============================================================================
 */

const KSA_GITHUB_EDITOR_CONFIG = {
  defaultPin: 'ksa2026',
  repoOwner: 'Schepie',
  repoName: 'KSA-website',
  defaultBranch: 'main',
  contentFilePath: 'data/site-content.json',
  storageKey: 'ksa_website_github_edits_v2'
};

(function initKsaVisualEditor() {
  let isEditMode = false;
  let currentLinkTarget = null;
  let currentImageTarget = null;
  let pendingImageUploads = {}; // { key: { selector, origSrc, groupKey, base64, fileName, dataUrl } }

  // Bewaar bij het opstarten van de pagina op elke <img> de originele src (bv. "images/cara.jpg")
  // zodat we bij het vervangen van een foto ook dezelfde foto in het paspoort-overzicht en op mobiel kunnen vervangen!
  function tagOriginalImageSources() {
    document.querySelectorAll('img').forEach(img => {
      if (!img.getAttribute('data-orig-src')) {
        const rawSrc = img.getAttribute('src') || '';
        if (rawSrc && !rawSrc.startsWith('data:')) {
          img.setAttribute('data-orig-src', rawSrc);
        }
      }
    });
  }

  // --------------------------------------------------------------------------
  // 1. AUTOMATISCHE DATUMCONTROLE ('VOORBIJ' OP BASIS VAN HUIDIGE DATUM)
  // --------------------------------------------------------------------------
  function parseKsaActivityEndDate(datumStr) {
    if (!datumStr) return null;
    const raw = String(datumStr).trim();
    if (!raw) return null;

    const now = new Date();
    const workYearStart = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;

    let day = null;
    let month = null; // 1-12
    let explicitYear = null;

    const yearMatch = raw.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      explicitYear = parseInt(yearMatch[1], 10);
    }

    if (raw.includes('/')) {
      const slashParts = raw.split('/');
      const dayNums = slashParts[0].trim().match(/\d+/g);
      const monthNums = slashParts[1].trim().match(/\d+/g);
      if (dayNums && dayNums.length > 0) day = parseInt(dayNums[dayNums.length - 1], 10);
      if (monthNums && monthNums.length > 0) month = parseInt(monthNums[0], 10);
    } else {
      const nlMonths = {
        jan: 1, feb: 2, mrt: 3, maa: 3, apr: 4, mei: 5, jun: 6,
        jul: 7, aug: 8, sep: 9, okt: 10, oct: 10, nov: 11, dec: 12
      };
      const lower = raw.toLowerCase();
      for (const [mKey, mVal] of Object.entries(nlMonths)) {
        if (lower.includes(mKey)) {
          month = mVal;
          break;
        }
      }
      const cleaned = raw.replace(/\b20\d{2}\b/g, '').replace(/\d{1,2}\s*[uU:]\s*\d{2}/g, '');
      const dayNums = cleaned.match(/\d+/g);
      if (dayNums && dayNums.length > 0) day = parseInt(dayNums[dayNums.length - 1], 10);
    }

    if (!day || !month || isNaN(day) || isNaN(month) || month < 1 || month > 12) return null;
    const year = explicitYear || (month >= 9 ? workYearStart : workYearStart + 1);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
  }

  function autoUpdateDatesToPast() {
    const nowMs = Date.now();

    // A. Desktop Kalender (.cal-grid .cal-item)
    const calItems = document.querySelectorAll('.cal-grid .cal-item');
    let foundCurrent = false;
    calItems.forEach(item => {
      const dateEl = item.querySelector('.cal-date');
      const cardEl = item.querySelector('.cal-card');
      if (!dateEl || !cardEl) return;

      const rawDate = dateEl.textContent.replace('!', '').trim();
      const endDate = parseKsaActivityEndDate(rawDate);
      if (!endDate) return;

      if (nowMs > endDate.getTime()) {
        item.classList.add('is-past');
        item.classList.remove('is-current');
        dateEl.querySelector('.cal-excl')?.remove();
        cardEl.querySelector('.cal-pill-now')?.remove();
        if (!cardEl.textContent.includes('(Voorbij)')) {
          const pastSpan = document.createElement('span');
          pastSpan.className = 'ksa-past-label';
          pastSpan.style.cssText = 'font-size:0.75rem; color:#888; margin-top:2px;';
          pastSpan.textContent = '(Voorbij)';
          cardEl.appendChild(pastSpan);
        }
      } else if (!foundCurrent) {
        foundCurrent = true;
        item.classList.add('is-current');
        item.classList.remove('is-past');
        if (!dateEl.querySelector('.cal-excl')) {
          dateEl.innerHTML = `<span class="cal-excl">!</span> ${rawDate}`;
        }
        if (!cardEl.querySelector('.cal-pill-now')) {
          const pill = document.createElement('span');
          pill.className = 'cal-pill-now';
          pill.textContent = 'Binnenkort!';
          cardEl.appendChild(pill);
        }
      } else {
        item.classList.remove('is-current');
        dateEl.querySelector('.cal-excl')?.remove();
        cardEl.querySelector('.cal-pill-now')?.remove();
      }
    });

    // B. Mobiele Kalender (.cal-list .cal-card-item)
    const mobCalItems = document.querySelectorAll('.cal-list .cal-card-item');
    let foundMobCurrent = false;
    mobCalItems.forEach(item => {
      const dayEl = item.querySelector('.cal-day-num');
      const monthEl = item.querySelector('.cal-month-str');
      if (!dayEl || !monthEl) return;
      const rawDate = `${dayEl.textContent.trim()} ${monthEl.textContent.trim()}`;
      const endDate = parseKsaActivityEndDate(rawDate);
      if (!endDate) return;

      if (nowMs > endDate.getTime()) {
        if (!isEditMode) item.style.display = 'none';
        item.classList.add('is-past');
        item.classList.remove('is-current');
      } else if (!foundMobCurrent) {
        foundMobCurrent = true;
        item.classList.add('is-current');
      } else {
        item.classList.remove('is-current');
      }
    });

    // C. Nieuws & Evenementen (.news-grid .news-card)
    document.querySelectorAll('.news-grid .news-card').forEach(card => {
      const dateEl = card.querySelector('.news-date');
      if (!dateEl) return;
      const rawDate = dateEl.textContent.replace(/\(.*\)/, '').trim();
      const endDate = parseKsaActivityEndDate(rawDate);
      if (endDate && nowMs > endDate.getTime()) {
        card.classList.add('is-past');
        const badgeEl = card.querySelector('.news-badge');
        if (badgeEl) {
          badgeEl.className = 'news-badge';
          badgeEl.style.cssText = 'background-color:#555e68; color:#fff;';
          badgeEl.textContent = '🏁 Reeds voorbij';
        }
        dateEl.style.backgroundColor = 'rgba(40,40,40,0.85)';
        if (!dateEl.textContent.includes('Voorbij')) {
          dateEl.textContent = `${rawDate} (Voorbij)`;
        }
        const titleEl = card.querySelector('.news-card-title');
        if (titleEl) titleEl.style.color = '#4a5568';
        const ticketBtn = card.querySelector('.news-actions .btn-primary');
        if (ticketBtn && !isEditMode) ticketBtn.style.display = 'none';
      }
    });

    // D. Countdown Banner
    const bannerTarget = window.ksaCountdownTargetDate;
    const staticBanner = document.querySelector('.countdown-banner-wrap .ksa-event-banner');
    if (staticBanner) {
      const descEl = staticBanner.querySelector('.event-banner-desc');
      const tagEl = staticBanner.querySelector('.event-banner-tag');
      const endDate = bannerTarget || (descEl ? parseKsaActivityEndDate(descEl.textContent) : null);
      if (endDate && nowMs > endDate.getTime()) {
        if (tagEl && !tagEl.textContent.includes('VOORBIJ')) {
          tagEl.textContent = '🏁 EVENEMENT VOORBIJ';
        }
        if (descEl && !descEl.textContent.includes('(Voorbij)')) {
          descEl.textContent = `${descEl.textContent} (Voorbij)`;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 2. LAAD OPGESLAGEN INHOUD DIRECT VANAF GITHUB (ZONDER 60s CACHE VERTRAGING)
  // --------------------------------------------------------------------------
  async function fetchLatestGithubState() {
    const owner = localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner;
    const repo = localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName;
    const branch = localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch;
    const path = KSA_GITHUB_EDITOR_CONFIG.contentFilePath;

    let candidates = [];

    // 1. Probeer rechtstreeks via GitHub Raw / API (0 seconden vertraging!)
    try {
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}?t=${Date.now()}`;
      const resRaw = await fetch(rawUrl, { cache: 'no-store' });
      if (resRaw.ok) {
        const s = await resRaw.json();
        if (s && s.updatedAt) candidates.push(s);
      }
    } catch (e) {}

    // 2. Probeer het lokale pad op de server (data/site-content.json)
    try {
      const resLocal = await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' });
      if (resLocal.ok) {
        const s = await resLocal.json();
        if (s && s.updatedAt) candidates.push(s);
      }
    } catch (e) {}

    // 3. Check localStorage (alleen als deze nieuwer is dan GitHub!)
    try {
      const localRaw = localStorage.getItem(KSA_GITHUB_EDITOR_CONFIG.storageKey);
      if (localRaw) {
        const s = JSON.parse(localRaw);
        if (s && s.updatedAt) candidates.push(s);
      }
    } catch (e) {}

    if (candidates.length === 0) return null;

    // Sorteer op updatedAt (nieuwste eerst!) zodat oude localStorage NOOIT een nieuwere GitHub-versie overschrijft!
    candidates.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return candidates[0];
  }

  async function loadAndApplySiteContent() {
    tagOriginalImageSources();
    const bestState = await fetchLatestGithubState();
    if (bestState) {
      applyStateToDom(bestState);
      // Synchroniseer ook localStorage met de nieuwste status
      localStorage.setItem(KSA_GITHUB_EDITOR_CONFIG.storageKey, JSON.stringify(bestState));
    }
    autoUpdateDatesToPast();
  }

  /**
   * Zet een afbeeldingspad veilig op een <img> element.
   * Als een pas geüploade foto in 'images/uploads/...' op GitHub Pages nog aan het bouwen is (eerste 45 sec),
   * valt de afbeelding automatisch terug op de directe raw.githubusercontent.com link zodat hij METEEN zichtbaar is!
   */
  function setSmartImageSrc(img, src) {
    if (!img || !src) return;
    const owner = localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner;
    const repo = localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName;
    const branch = localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch;

    if (src.startsWith('images/uploads/') || src.startsWith('data:')) {
      // Verwijder de paspoort-zoom crop (scale 2.8x rechtsboven) zodra een eigen foto is gekozen!
      img.classList.remove('paspoort-avatar-crop', 'paspoort-face-focus');
    }

    if (src.startsWith('images/uploads/')) {
      img.onerror = function() {
        this.onerror = null;
        this.src = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${src}`;
      };
    }
    img.src = src;
  }

  function querySmartSelector(selector) {
    if (!selector) return null;
    let el = document.querySelector(selector);
    if (!el && selector.includes('#mainContent > div:nth-of-type(2)') && !document.getElementById('ksaBannerControlBar')) {
      el = document.querySelector(selector.replace('#mainContent > div:nth-of-type(2)', '#mainContent > div:nth-of-type(1)'));
    }
    return el;
  }

  function isGroupManagedSelector(selector) {
    return typeof selector === 'string' && (selector.startsWith('#groupResult') || selector.startsWith('#mGroup'));
  }

  function applyStateToDom(state) {
    if (!state || typeof state !== 'object') return;
    const isMobilePage = window.location.pathname.includes('mobile.html');
    const pageKey = isMobilePage ? 'mobile' : 'desktop';
    const pageData = state[pageKey] || {};

    // 1. Leeftijdsgroepen data (Kabouters, Sloebers, Roodkapjes, JIM, SIM, KIM)
    if (state.groups && typeof state.groups === 'object') {
      Object.entries(state.groups).forEach(([grpKey, gVal]) => {
        if (window.groupData && window.groupData[grpKey]) {
          Object.assign(window.groupData[grpKey], gVal);
        }
        if (window.mobileGroupData && window.mobileGroupData[grpKey]) {
          if (gVal.name) window.mobileGroupData[grpKey].name = gVal.name;
          if (gVal.ageRange) window.mobileGroupData[grpKey].age = gVal.ageRange;
          if (gVal.tagline) window.mobileGroupData[grpKey].tagline = gVal.tagline;
          if (gVal.desc) window.mobileGroupData[grpKey].desc = gVal.desc;
          if (gVal.image) window.mobileGroupData[grpKey].image = gVal.image;
          if (gVal.perks) window.mobileGroupData[grpKey].tags = gVal.perks.map(p => p.startsWith('✨') ? p : `✨ ${p}`);
        }
      });
      const activeDesktopPill = document.querySelector('.quiz-pill-btn.active, .quiz-age-pill.active');
      if (activeDesktopPill) {
        const activeKey = activeDesktopPill.getAttribute('data-group') || 'kabouters';
        const g = window.groupData && window.groupData[activeKey];
        if (g) {
          const nameEl = document.getElementById('groupResultName');
          const ageEl = document.getElementById('groupResultAge');
          const tagEl = document.getElementById('groupResultTagline');
          const descEl = document.getElementById('groupResultDesc');
          const imgEl = document.getElementById('groupResultImg');
          if (nameEl && g.name) nameEl.textContent = g.name;
          if (ageEl && g.ageRange) ageEl.textContent = g.ageRange;
          if (tagEl && g.tagline) tagEl.textContent = g.tagline;
          if (descEl && g.desc) descEl.textContent = g.desc;
          if (imgEl && g.image) setSmartImageSrc(imgEl, g.image);
        }
        activeDesktopPill.click();
      }
      const activeMobBtn = document.querySelector('.group-select-btn.active');
      if (activeMobBtn && typeof window.renderMobileGroup === 'function') {
        window.renderMobileGroup(activeMobBtn.getAttribute('data-group') || 'kabouters');
      }
    }

    // 2. Sectie-containers (Kalender, Nieuws, Paspoortjes)
    if (pageData.containers) {
      Object.entries(pageData.containers).forEach(([selector, html]) => {
        const el = querySmartSelector(selector);
        if (el && html) {
          el.innerHTML = html;
          // Zorg dat buiten Edit Mode geen contenteditable achterblijft
          if (!isEditMode) {
            el.querySelectorAll('[contenteditable]').forEach(c => c.removeAttribute('contenteditable'));
            el.querySelectorAll('.ksa-editable-img').forEach(c => c.classList.remove('ksa-editable-img'));
          }
        }
      });
    }

    tagOriginalImageSources();

    // 3. Tekst-elementen
    if (pageData.texts) {
      Object.entries(pageData.texts).forEach(([selector, html]) => {
        if (isGroupManagedSelector(selector)) return;
        const el = querySmartSelector(selector);
        if (el && html !== undefined) el.innerHTML = html;
      });
    }

    // 4. Foto's per selector
    if (pageData.images) {
      Object.entries(pageData.images).forEach(([selector, src]) => {
        if (isGroupManagedSelector(selector)) return;
        const img = querySmartSelector(selector);
        if (img && src) {
          setSmartImageSrc(img, src);
        }
      });
    }

    // 5. Globale Foto-vervangingen (imageMap: bv. "images/cara.jpg" -> "images/uploads/...")
    //    Hiermee worden paspoortjes onderaan én de mobiele site automatisch mee bijgewerkt!
    if (state.imageMap && typeof state.imageMap === 'object') {
      document.querySelectorAll('img').forEach(img => {
        if (img.id === 'groupResultImg' || img.id === 'mGroupImg') return;
        const orig = img.getAttribute('data-orig-src') || img.getAttribute('src') || '';
        if (orig && state.imageMap[orig]) {
          setSmartImageSrc(img, state.imageMap[orig]);
        }
      });
      // Ook op mobiele data-paspoort attributen toepassen
      document.querySelectorAll('[data-paspoort]').forEach(card => {
        const origP = card.getAttribute('data-paspoort') || '';
        if (origP && state.imageMap[origP]) {
          card.setAttribute('data-paspoort', state.imageMap[origP]);
        }
      });
    }

    // 6. Knoppen & Links
    if (pageData.links) {
      Object.entries(pageData.links).forEach(([selector, info]) => {
        const a = querySmartSelector(selector);
        if (!a || !info) return;
        if (info.href !== undefined) a.setAttribute('href', info.href);
        if (info.hidden !== undefined) a.style.display = info.hidden ? 'none' : '';
      });
    }

    // 7. Event Banner zichtbaarheid & aftelklok datum
    if (state.banner) {
      const b = state.banner;
      const desktopWrap = document.querySelector('.countdown-banner-wrap');
      const mobileCard = document.querySelector('.mobile-event-card');
      if (b.hidden !== undefined) {
        if (desktopWrap) desktopWrap.style.display = b.hidden ? 'none' : '';
        if (mobileCard) mobileCard.style.display = b.hidden ? 'none' : '';
      }
      if (b.targetIso) {
        const d = new Date(b.targetIso);
        if (!isNaN(d.getTime())) {
          window.ksaCountdownTargetDate = d;
        }
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3. UNIEKE CSS-SELECTOR GENERATOR
  // --------------------------------------------------------------------------
  function getUniqueSelector(el) {
    if (!el || el.nodeType !== 1) return '';
    if (el.id) return `#${CSS.escape(el.id)}`;

    const path = [];
    let curr = el;
    while (curr && curr.nodeType === 1 && curr !== document.body) {
      let selector = curr.nodeName.toLowerCase();
      if (curr.id) {
        selector = `#${CSS.escape(curr.id)}`;
        path.unshift(selector);
        break;
      } else {
        let sib = curr;
        let nth = 1;
        while ((sib = sib.previousElementSibling)) {
          // Negeer tijdelijke editor-balken bij het tellen zodat selectors 100% stabiel blijven!
          if (sib.id === 'ksaBannerControlBar' || sib.classList.contains('ksa-card-edit-tools')) {
            continue;
          }
          if (sib.nodeName.toLowerCase() === selector) nth++;
        }
        selector += `:nth-of-type(${nth})`;
      }
      path.unshift(selector);
      curr = curr.parentElement;
    }
    return path.join(' > ');
  }

  // --------------------------------------------------------------------------
  // 4. INJECTEER DE "✏️ BEWERK WEBSITE"-KNOP & EDITOR WERKBALK
  // --------------------------------------------------------------------------
  function injectEditorUI() {
    const style = document.createElement('style');
    style.id = 'ksa-visual-editor-styles';
    style.textContent = `
      .ksa-edit-trigger-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #0055a5;
        color: #ffffff !important;
        padding: 8px 16px;
        border-radius: 999px;
        font-size: 0.85rem;
        font-weight: 700;
        border: none;
        cursor: pointer;
        text-decoration: none !important;
        box-shadow: 0 3px 10px rgba(0,85,165,0.25);
        transition: all 0.2s ease;
      }
      .ksa-edit-trigger-btn:hover {
        background: #e3001b;
        transform: translateY(-1px);
      }

      body.ksa-edit-mode-active {
        padding-bottom: 90px !important;
      }
      body.ksa-edit-mode-active [contenteditable="true"] {
        outline: 1.5px dashed rgba(0, 85, 165, 0.5);
        outline-offset: 3px;
        border-radius: 4px;
        transition: outline 0.15s, background-color 0.15s;
        cursor: text;
      }
      body.ksa-edit-mode-active [contenteditable="true"]:hover,
      body.ksa-edit-mode-active [contenteditable="true"]:focus {
        outline: 2px solid #e3001b;
        background-color: rgba(254, 243, 199, 0.4);
      }
      body.ksa-edit-mode-active img.ksa-editable-img {
        outline: 2.5px dashed #0055a5;
        outline-offset: 2px;
        cursor: pointer !important;
        transition: filter 0.2s, outline 0.2s;
      }
      body.ksa-edit-mode-active img.ksa-editable-img:hover {
        filter: brightness(0.85);
        outline: 3px solid #e3001b;
      }

      .ksa-card-edit-tools {
        display: none;
        gap: 6px;
        margin-top: 8px;
        padding: 6px;
        background: #f8fafc;
        border: 1px solid #cbd5e1;
        border-radius: 8px;
        justify-content: center;
        flex-wrap: wrap;
        z-index: 20;
        position: relative;
      }
      body.ksa-edit-mode-active .ksa-card-edit-tools {
        display: flex;
      }
      .ksa-mini-btn {
        background: #ffffff;
        border: 1px solid #94a3b8;
        color: #1e293b;
        font-size: 11px;
        font-weight: 700;
        padding: 4px 8px;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.15s;
      }
      .ksa-mini-btn:hover { background: #0055a5; color: #fff; border-color: #0055a5; }
      .ksa-mini-btn-danger:hover { background: #e3001b; color: #fff; border-color: #e3001b; }

      .ksa-banner-edit-bar {
        display: none;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        background: #fef3c7;
        border: 2px solid #f59e0b;
        color: #78350f;
        padding: 10px 16px;
        border-radius: 12px;
        margin-bottom: 12px;
        font-size: 13px;
        font-weight: 600;
      }
      body.ksa-edit-mode-active .ksa-banner-edit-bar {
        display: flex;
      }
      .ksa-banner-edit-bar input[type="datetime-local"] {
        padding: 5px 10px;
        border-radius: 6px;
        border: 1px solid #d97706;
        font-weight: 600;
      }

      .ksa-editor-dock {
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #0f172a;
        color: #ffffff;
        padding: 12px 20px;
        z-index: 99999;
        display: none;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 12px;
        box-shadow: 0 -6px 24px rgba(0,0,0,0.35);
        border-top: 3px solid #fdb900;
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      body.ksa-edit-mode-active .ksa-editor-dock {
        display: flex;
      }
      .ksa-dock-left {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .ksa-dock-badge {
        background: #e3001b;
        color: #fff;
        font-weight: 800;
        font-size: 12px;
        padding: 5px 12px;
        border-radius: 999px;
        letter-spacing: 0.5px;
      }
      .ksa-dock-hint {
        font-size: 13px;
        color: #cbd5e1;
      }
      .ksa-dock-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .ksa-dock-btn {
        padding: 9px 16px;
        border-radius: 999px;
        font-weight: 700;
        font-size: 13px;
        border: none;
        cursor: pointer;
        transition: all 0.2s;
      }
      .ksa-dock-btn-save {
        background: #22c55e;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(34, 197, 94, 0.35);
      }
      .ksa-dock-btn-save:hover { background: #16a34a; transform: translateY(-1px); }
      .ksa-dock-btn-sec {
        background: #334155;
        color: #f8fafc;
      }
      .ksa-dock-btn-sec:hover { background: #475569; }
      .ksa-dock-btn-exit {
        background: transparent;
        border: 1px solid #64748b;
        color: #cbd5e1;
      }
      .ksa-dock-btn-exit:hover { background: #1e293b; color: #fff; }

      .ksa-editor-modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(15, 23, 42, 0.65);
        backdrop-filter: blur(3px);
        z-index: 100000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 16px;
      }
      .ksa-editor-modal {
        background: #ffffff;
        color: #1e293b;
        border-radius: 16px;
        max-width: 480px;
        width: 100%;
        padding: 24px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        font-family: 'Plus Jakarta Sans', sans-serif;
      }
      .ksa-editor-modal h3 {
        margin: 0 0 8px 0;
        color: #0055a5;
        font-size: 1.25rem;
      }
      .ksa-editor-modal p {
        margin: 0 0 12px 0;
        font-size: 0.88rem;
        color: #475569;
        line-height: 1.45;
      }
      .ksa-editor-modal label {
        display: block;
        font-size: 0.8rem;
        font-weight: 700;
        color: #334155;
        margin-bottom: 4px;
        margin-top: 10px;
      }
      .ksa-editor-modal input[type="text"],
      .ksa-editor-modal input[type="password"] {
        width: 100%;
        padding: 10px 12px;
        border: 1.5px solid #cbd5e1;
        border-radius: 8px;
        font-size: 0.92rem;
      }
      .ksa-editor-modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 18px;
      }
    `;
    document.head.appendChild(style);

    const footerSupport = document.querySelector('.footer-support-tags');
    if (footerSupport) {
      footerSupport.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ksa-edit-trigger-btn';
      btn.innerHTML = '✏️ Bewerk Website (Edit Mode)';
      btn.onclick = promptAndEnableEditMode;
      footerSupport.appendChild(btn);
    }

    const mobInfoTab = document.getElementById('tab-info');
    if (mobInfoTab) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'text-align:center; padding: 20px 0 30px;';
      wrap.innerHTML = `<button type="button" class="ksa-edit-trigger-btn" style="padding:10px 18px; font-size:0.9rem;">✏️ Bewerk Website (Leiding Edit Mode)</button>`;
      wrap.querySelector('button').onclick = promptAndEnableEditMode;
      mobInfoTab.appendChild(wrap);
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    fileInput.id = 'ksaInlinePhotoInput';
    fileInput.addEventListener('change', handleInlinePhotoSelected);
    document.body.appendChild(fileInput);

    const dock = document.createElement('div');
    dock.className = 'ksa-editor-dock';
    dock.innerHTML = `
      <div class="ksa-dock-left">
        <span class="ksa-dock-badge">✏️ BEWERK-MODUS</span>
        <span class="ksa-dock-hint">Klik op eender welke <strong>tekst</strong> om te typen, op een <strong>foto</strong> om een nieuwe te kiezen, of op een <strong>knop</strong> om de link te wijzigen.</span>
      </div>
      <div class="ksa-dock-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnToggleBanner" title="Toon of verberg de Event Aftelbanner">🎯 Banner Aan/Uit</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnGithubConfig" title="Stel GitHub toegangstoken in voor live publicatie">⚙️ GitHub Koppeling</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnResetEdits" title="Herstel standaard waarden">↩️ Reset</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaBtnSaveEdits">💾 Opslaan naar GitHub</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-exit" id="ksaBtnExitEdit">✖ Sluiten</button>
      </div>
    `;
    document.body.appendChild(dock);

    const modalBackdrop = document.createElement('div');
    modalBackdrop.className = 'ksa-editor-modal-backdrop';
    modalBackdrop.id = 'ksaEditorModalBackdrop';
    modalBackdrop.innerHTML = `<div class="ksa-editor-modal" id="ksaEditorModalContent"></div>`;
    document.body.appendChild(modalBackdrop);

    document.getElementById('ksaBtnSaveEdits').onclick = saveAllEditsToGithub;
    document.getElementById('ksaBtnExitEdit').onclick = disableEditMode;
    document.getElementById('ksaBtnToggleBanner').onclick = toggleBannerVisibility;
    document.getElementById('ksaBtnGithubConfig').onclick = openGithubConfigModal;
    document.getElementById('ksaBtnResetEdits').onclick = resetAllEdits;

    if (window.location.search.includes('edit=1') || window.location.hash === '#edit') {
      promptAndEnableEditMode();
    }
  }

  // --------------------------------------------------------------------------
  // 5. WACHTWOORD / PINCODE CONTROLE
  // --------------------------------------------------------------------------
  function promptAndEnableEditMode() {
    if (isEditMode) return;
    if (sessionStorage.getItem('ksa_edit_unlocked') === '1') {
      enableEditMode();
      return;
    }

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>🔐 Leiding Bewerk-modus</h3>
      <p>Voer de KSA-leiding pincode in om teksten, foto's, kalender, groepen en de aftelbanner rechtstreeks op de website aan te passen.</p>
      <label for="ksaPinInput">Leiding Wachtwoord / Pincode:</label>
      <input type="password" id="ksaPinInput" placeholder="Bv. ksa2026" autofocus>
      <div id="ksaPinError" style="color:#e3001b; font-size:12px; margin-top:6px; display:none;">❌ Ongeldige pincode. Standaard pincode is: <strong>ksa2026</strong></div>
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaPinCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaPinSubmit">🔓 Ontgrendel Website</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const input = document.getElementById('ksaPinInput');
    const submit = () => {
      const val = (input.value || '').trim().toLowerCase();
      const customPin = (localStorage.getItem('ksa_custom_pin') || KSA_GITHUB_EDITOR_CONFIG.defaultPin).toLowerCase();
      if (val === customPin || val === 'ksa2026') {
        sessionStorage.setItem('ksa_edit_unlocked', '1');
        backdrop.style.display = 'none';
        enableEditMode();
      } else {
        document.getElementById('ksaPinError').style.display = 'block';
      }
    };

    document.getElementById('ksaPinSubmit').onclick = submit;
    document.getElementById('ksaPinCancel').onclick = () => { backdrop.style.display = 'none'; };
    input.onkeydown = (e) => { if (e.key === 'Enter') submit(); };
    setTimeout(() => input.focus(), 50);
  }

  // --------------------------------------------------------------------------
  // 6. ACTIVEER EDIT MODE OP ALLE ONDERDELEN VAN DE WEBSITE
  // --------------------------------------------------------------------------
  function enableEditMode() {
    isEditMode = true;
    document.body.classList.add('ksa-edit-mode-active');
    tagOriginalImageSources();

    const textSelectors = [
      '.ksa-topbar-badge',
      '.ksa-topbar span',
      '.hero-tag span',
      '.hero-title',
      '.hero-lead',
      '.hero-corner-title',
      '.hero-corner-sub',
      '.hero-stat-num',
      '.hero-stat-lbl',
      '.event-banner-tag',
      '.event-banner-title',
      '.event-banner-desc',
      '.section-eyebrow',
      '.section-title',
      '.section-intro',
      '.news-badge',
      '.news-date',
      '.news-card-title',
      '.news-snippet',
      '.news-meta-details div',
      '.cal-poster-sub',
      '.cal-date',
      '.cal-event-text',
      '#groupResultName',
      '#groupResultAge',
      '#groupResultTagline',
      '#groupResultDesc',
      '.group-tag-pill',
      '.leiding-name',
      '.leiding-role-tag',
      '.leiding-desc',
      '.leiding-avatar-name',
      '.paspoort-card-badge',
      '.info-feature-card h3',
      '.info-feature-card p',
      '.ravot-step-tile h5',
      '.ravot-step-tile p',
      '#verhuring p',
      '#verhuring li',
      '.contact-tile h4',
      '.contact-tile p',
      // Mobiel
      '.hero-live-title',
      '.hero-live-desc',
      '.event-title',
      '.event-media-badge',
      '.event-meta div',
      '.cal-day-num',
      '.cal-month-str',
      '.cal-event-name',
      '.cal-event-subtext',
      '#mGroupName',
      '#mGroupAge',
      '#mGroupTagline',
      '#mGroupDesc',
      '#mGroupLeaders',
      '.group-tag',
      '.hoofd-name',
      '.hoofd-desc',
      '.leader-card-name',
      '.leader-card-role',
      '.info-card-box h3',
      '.info-card-box p'
    ];

    document.querySelectorAll(textSelectors.join(',')).forEach(el => {
      if (el.closest('.ksa-editor-dock') || el.closest('.ksa-editor-modal')) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('spellcheck', 'false');
    });

    bindGroupLiveSync();

    document.querySelectorAll('img').forEach(img => {
      if (img.closest('.ksa-editor-dock') || img.closest('.nav-item-icon-wrap')) return;
      img.classList.add('ksa-editable-img');
      img.title = '📸 Klik om deze foto te vervangen vanaf je PC of GSM';
      img.addEventListener('click', onEditableImageClick, true);
    });

    document.querySelectorAll('.hero-cta-group a, .ksa-event-banner a.btn, .news-actions a, .btn-ravot, .btn-ticket').forEach(a => {
      a.addEventListener('click', onEditableLinkClick, true);
    });

    injectBannerControlBar();
    injectCardEditTools();
  }

  function bindGroupLiveSync() {
    const syncCurrentDesktopGroup = () => {
      if (!isEditMode || !window.groupData) return;
      const card = document.getElementById('groupResultCard');
      const activeKey = (card && card.getAttribute('data-active-group')) || 'kabouters';
      const g = window.groupData[activeKey];
      if (!g) return;

      const nameEl = document.getElementById('groupResultName');
      const ageEl = document.getElementById('groupResultAge');
      const tagEl = document.getElementById('groupResultTagline');
      const descEl = document.getElementById('groupResultDesc');
      const perksEls = document.querySelectorAll('#groupResultPerks .group-tag-pill');

      if (nameEl) g.name = nameEl.innerText.trim();
      if (ageEl) g.ageRange = ageEl.innerText.trim();
      if (tagEl) g.tagline = tagEl.innerText.trim();
      if (descEl) g.desc = descEl.innerText.trim();
      if (perksEls.length > 0) {
        g.perks = Array.from(perksEls).map(s => s.innerText.replace(/^✨\s*/, '').trim()).filter(Boolean);
      }
    };

    ['groupResultName', 'groupResultAge', 'groupResultTagline', 'groupResultDesc', 'groupResultPerks'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', syncCurrentDesktopGroup);
    });
  }

  function disableEditMode() {
    isEditMode = false;
    document.body.classList.remove('ksa-edit-mode-active');
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('img.ksa-editable-img').forEach(img => {
      img.classList.remove('ksa-editable-img');
      img.removeEventListener('click', onEditableImageClick, true);
    });
    document.querySelectorAll('.hero-cta-group a, .ksa-event-banner a.btn, .news-actions a, .btn-ravot, .btn-ticket').forEach(a => {
      a.removeEventListener('click', onEditableLinkClick, true);
    });
  }

  // --------------------------------------------------------------------------
  // 7. FOTO'S DIRECT VERVANGEN OP DE PAGINA (+ AUTOMATISCHE PASPOORT SYNC)
  // --------------------------------------------------------------------------
  function onEditableImageClick(e) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    currentImageTarget = e.currentTarget;
    const fileInput = document.getElementById('ksaInlinePhotoInput');
    fileInput.value = '';
    fileInput.click();
  }

  function handleInlinePhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentImageTarget) return;

    const isGroupImg = currentImageTarget.id === 'groupResultImg' || currentImageTarget.id === 'mGroupImg';
    const origSrc = isGroupImg ? '' : (currentImageTarget.getAttribute('data-orig-src') || currentImageTarget.getAttribute('src') || '');

    const reader = new FileReader();
    reader.onload = function(ev) {
      const imgObj = new Image();
      imgObj.onload = function() {
        const maxDim = 1400;
        let w = imgObj.width;
        let h = imgObj.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(imgObj, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

        // 1. Vervang op het aangeklikte element
        setSmartImageSrc(currentImageTarget, dataUrl);

        // 2. Vervang direct ook alle andere afbeeldingen op de pagina die dezelfde originele bron hadden
        //    (bv. als je de cirkel van Cara wijzigt, wijzigt haar grote paspoort onderaan automatisch mee!)
        if (origSrc && !origSrc.startsWith('data:')) {
          document.querySelectorAll('img').forEach(otherImg => {
            if (otherImg.id === 'groupResultImg' || otherImg.id === 'mGroupImg') return;
            const otherOrig = otherImg.getAttribute('data-orig-src') || otherImg.getAttribute('src') || '';
            if (otherOrig === origSrc) {
              setSmartImageSrc(otherImg, dataUrl);
            }
          });
        }

        const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.[^.]+$/, '') + '.jpg';
        const selector = getUniqueSelector(currentImageTarget);

        let groupKey = null;
        if (currentImageTarget.id === 'groupResultImg') {
          const card = document.getElementById('groupResultCard');
          groupKey = (card && card.getAttribute('data-active-group')) || 'kabouters';
          if (window.groupData && window.groupData[groupKey]) {
            window.groupData[groupKey].image = dataUrl;
          }
        } else if (currentImageTarget.id === 'mGroupImg') {
          const activeBtn = document.querySelector('.group-select-btn.active');
          groupKey = (activeBtn && activeBtn.getAttribute('data-group')) || 'kabouters';
          if (window.mobileGroupData && window.mobileGroupData[groupKey]) {
            window.mobileGroupData[groupKey].image = dataUrl;
          }
        }

        const key = groupKey ? `group_${groupKey}` : selector;
        pendingImageUploads[key] = {
          selector,
          origSrc,
          groupKey,
          base64: dataUrl.split(',')[1],
          fileName: `${Date.now()}_${cleanFileName}`,
          dataUrl
        };
      };
      imgObj.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }

  // --------------------------------------------------------------------------
  // 8. KNOPPEN & LINKS AANPASSEN
  // --------------------------------------------------------------------------
  function onEditableLinkClick(e) {
    if (!isEditMode) return;
    e.preventDefault();
    e.stopPropagation();
    currentLinkTarget = e.currentTarget;

    const span = currentLinkTarget.querySelector('span') || currentLinkTarget;
    const currentText = span.textContent.trim();
    const currentHref = currentLinkTarget.getAttribute('href') || '';
    const isHidden = currentLinkTarget.style.display === 'none';

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>🔗 Knop of Link aanpassen</h3>
      <label>Tekst op de knop:</label>
      <input type="text" id="ksaEditLinkText" value="${currentText.replace(/"/g, '&quot;')}">
      <label>Link-adres (bv. #nieuws, #agenda of https://...):</label>
      <input type="text" id="ksaEditLinkHref" value="${currentHref.replace(/"/g, '&quot;')}">
      <label style="display:flex; align-items:center; gap:8px; margin-top:14px; cursor:pointer;">
        <input type="checkbox" id="ksaEditLinkHide" ${isHidden ? 'checked' : ''}>
        <span>Verberg deze knop op de website</span>
      </label>
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaLinkCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaLinkApply">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    document.getElementById('ksaLinkCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaLinkApply').onclick = () => {
      const newText = document.getElementById('ksaEditLinkText').value.trim();
      const newHref = document.getElementById('ksaEditLinkHref').value.trim();
      const hide = document.getElementById('ksaEditLinkHide').checked;

      if (newText) span.textContent = newText;
      if (newHref) currentLinkTarget.setAttribute('href', newHref);
      currentLinkTarget.style.display = hide ? 'none' : '';
      backdrop.style.display = 'none';
    };
  }

  // --------------------------------------------------------------------------
  // 9. EVENT BANNER & AFTELKLOK BEDIENING
  // --------------------------------------------------------------------------
  function injectBannerControlBar() {
    const bannerWrap = document.querySelector('.countdown-banner-wrap') || document.querySelector('.mobile-event-card');
    if (!bannerWrap || document.getElementById('ksaBannerControlBar')) return;

    const bar = document.createElement('div');
    bar.id = 'ksaBannerControlBar';
    bar.className = 'ksa-banner-edit-bar';

    const curTarget = window.ksaCountdownTargetDate || new Date(2027, 2, 8, 12, 0);
    const isoLocal = new Date(curTarget.getTime() - curTarget.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

    bar.innerHTML = `
      <div>⏱️ <strong>Event Banner &amp; Aftelklok:</strong> Klik op de teksten in de banner om het evenement te wijzigen.</div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <label>Aftellen naar datum &amp; uur:
          <input type="datetime-local" id="ksaBannerDateInput" value="${isoLocal}">
        </label>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" id="ksaHideBannerInline">🙈 Banner Tonen / Verbergen</button>
      </div>
    `;

    bannerWrap.parentElement.insertBefore(bar, bannerWrap);

    document.getElementById('ksaBannerDateInput').addEventListener('change', (e) => {
      const d = new Date(e.target.value);
      if (!isNaN(d.getTime())) {
        window.ksaCountdownTargetDate = d;
      }
    });

    document.getElementById('ksaHideBannerInline').onclick = toggleBannerVisibility;
  }

  function toggleBannerVisibility() {
    const desktopWrap = document.querySelector('.countdown-banner-wrap');
    const mobileCard = document.querySelector('.mobile-event-card');
    const target = desktopWrap || mobileCard;
    if (!target) return;

    const isHidden = target.style.display === 'none';
    if (desktopWrap) desktopWrap.style.display = isHidden ? '' : 'none';
    if (mobileCard) mobileCard.style.display = isHidden ? '' : 'none';
  }

  // --------------------------------------------------------------------------
  // 10. KAARTJES TOEVOEGEN (+), OP 'VOORBIJ' ZETTEN (🏁) OF VERWIJDEREN (🗑️)
  // --------------------------------------------------------------------------
  function injectCardEditTools() {
    document.querySelectorAll('.cal-grid .cal-item').forEach(item => {
      if (item.querySelector('.ksa-card-edit-tools')) return;
      const tools = document.createElement('div');
      tools.className = 'ksa-card-edit-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-mini-btn" data-act="past" title="Zet op Voorbij of Actief">🏁 Voorbij</button>
        <button type="button" class="ksa-mini-btn" data-act="now" title="Markeer als Binnenkort!">🔥 Nu</button>
        <button type="button" class="ksa-mini-btn" data-act="add" title="Voeg extra datum hierna toe">➕</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" data-act="del" title="Verwijder datum">🗑️</button>
      `;
      tools.querySelector('[data-act="past"]').onclick = () => {
        item.classList.toggle('is-past');
        item.classList.remove('is-current');
      };
      tools.querySelector('[data-act="now"]').onclick = () => {
        item.classList.toggle('is-current');
        item.classList.remove('is-past');
      };
      tools.querySelector('[data-act="add"]').onclick = () => {
        const clone = item.cloneNode(true);
        clone.querySelector('.ksa-card-edit-tools')?.remove();
        item.after(clone);
        enableEditMode();
      };
      tools.querySelector('[data-act="del"]').onclick = () => item.remove();
      item.appendChild(tools);
    });

    document.querySelectorAll('.news-grid .news-card').forEach(card => {
      if (card.querySelector('.ksa-card-edit-tools')) return;
      const tools = document.createElement('div');
      tools.className = 'ksa-card-edit-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-mini-btn" data-act="past">🏁 Voorbij / Actief</button>
        <button type="button" class="ksa-mini-btn" data-act="add">➕ Nieuw Bericht</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" data-act="del">🗑️ Verwijder</button>
      `;
      tools.querySelector('[data-act="past"]').onclick = () => {
        const pastNow = !card.classList.contains('is-past');
        card.classList.toggle('is-past', pastNow);
        const badge = card.querySelector('.news-badge');
        if (badge) {
          badge.textContent = pastNow ? '🏁 Reeds voorbij' : '🔥 Evenement';
          badge.style.backgroundColor = pastNow ? '#555e68' : '';
        }
      };
      tools.querySelector('[data-act="add"]').onclick = () => {
        const clone = card.cloneNode(true);
        clone.querySelector('.ksa-card-edit-tools')?.remove();
        card.after(clone);
        enableEditMode();
      };
      tools.querySelector('[data-act="del"]').onclick = () => card.remove();
      card.appendChild(tools);
    });

    document.querySelectorAll('.paspoort-grid .paspoort-card').forEach(pCard => {
      if (pCard.querySelector('.ksa-card-edit-tools')) return;
      const tools = document.createElement('div');
      tools.className = 'ksa-card-edit-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-mini-btn" data-act="add">➕ Paspoort</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" data-act="del">🗑️</button>
      `;
      tools.querySelector('[data-act="add"]').onclick = (e) => {
        e.stopPropagation();
        const clone = pCard.cloneNode(true);
        clone.querySelector('.ksa-card-edit-tools')?.remove();
        pCard.after(clone);
        enableEditMode();
      };
      tools.querySelector('[data-act="del"]').onclick = (e) => {
        e.stopPropagation();
        pCard.remove();
      };
      pCard.appendChild(tools);
    });
  }

  // --------------------------------------------------------------------------
  // 11. GITHUB REST API HULPFUNCTIE
  // --------------------------------------------------------------------------
  async function commitFileToGithub(token, owner, repo, branch, filePath, base64Content, commitMessage) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    let sha = undefined;
    const getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, { headers });
    if (getRes.ok) {
      const existing = await getRes.json();
      sha = existing.sha;
    }

    const body = {
      message: commitMessage,
      content: base64Content,
      branch: branch
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const errText = await putRes.text();
      throw new Error(`GitHub fout (${putRes.status}): ${errText}`);
    }
    return await putRes.json();
  }

  function utf8ToBase64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  // --------------------------------------------------------------------------
  // 12. OPSLAAN & PUBLICEREN RECHTSTREEKS NAAR GITHUB
  // --------------------------------------------------------------------------
  async function saveAllEditsToGithub() {
    const saveBtn = document.getElementById('ksaBtnSaveEdits');
    const origText = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = '⏳ Bezig met opslaan...';

    document.querySelectorAll('.ksa-card-edit-tools').forEach(el => el.remove());

    const isMobilePage = window.location.pathname.includes('mobile.html');
    const pageKey = isMobilePage ? 'mobile' : 'desktop';

    let fullState = (await fetchLatestGithubState()) || {};
    fullState.imageMap = fullState.imageMap || {};

    const ghToken = (localStorage.getItem('ksa_github_token') || '').trim();
    const ghOwner = (localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner).trim();
    const ghRepo = (localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName).trim();
    const ghBranch = (localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch).trim();

    // 1. Upload nieuwe foto's naar images/uploads/ in GitHub
    if (ghToken && Object.keys(pendingImageUploads).length > 0) {
      for (const [key, imgItem] of Object.entries(pendingImageUploads)) {
        const repoImgPath = `images/uploads/${imgItem.fileName}`;
        try {
          await commitFileToGithub(
            ghToken,
            ghOwner,
            ghRepo,
            ghBranch,
            repoImgPath,
            imgItem.base64,
            `📸 Nieuwe website foto: ${imgItem.fileName}`
          );
          if (imgItem.groupKey && window.groupData && window.groupData[imgItem.groupKey]) {
            window.groupData[imgItem.groupKey].image = repoImgPath;
          }
          if (imgItem.origSrc && !imgItem.origSrc.startsWith('data:')) {
            fullState.imageMap[imgItem.origSrc] = repoImgPath;
            document.querySelectorAll('img').forEach(otherImg => {
              const otherOrig = otherImg.getAttribute('data-orig-src') || '';
              if (otherOrig === imgItem.origSrc) {
                setSmartImageSrc(otherImg, repoImgPath);
              }
            });
          }
          if (imgItem.selector) {
            const domImg = document.querySelector(imgItem.selector);
            if (domImg) setSmartImageSrc(domImg, repoImgPath);
          }
        } catch (err) {
          console.warn('[KSA GitHub Editor] Kon foto niet naar GitHub uploaden:', err);
        }
      }
      pendingImageUploads = {};
    }

    // 2. Verzamel alle gewijzigde teksten, foto's, links, groepen en containers
    const pageData = {
      texts: {},
      images: {},
      links: {},
      containers: {}
    };

    // Maak een schone kopie van de containers zonder contenteditable attributen
    ['.cal-grid', '.news-grid', '.paspoort-grid', '.cal-list'].forEach(sel => {
      const c = document.querySelector(sel);
      if (c) {
        const clone = c.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        clone.querySelectorAll('.ksa-editable-img').forEach(el => el.classList.remove('ksa-editable-img'));
        clone.querySelectorAll('.ksa-card-edit-tools').forEach(el => el.remove());
        pageData.containers[sel] = clone.innerHTML;
      }
    });

    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      const sel = getUniqueSelector(el);
      if (sel && !isGroupManagedSelector(sel)) pageData.texts[sel] = el.innerHTML;
    });

    document.querySelectorAll('img.ksa-editable-img').forEach(img => {
      const sel = getUniqueSelector(img);
      if (isGroupManagedSelector(sel)) return;
      const srcVal = img.getAttribute('src') || '';
      const origVal = img.getAttribute('data-orig-src') || '';
      // Als er een raw.githubusercontent fallback actief was, bewaar het schone repo-pad
      const cleanSrc = srcVal.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, '');
      if (sel) pageData.images[sel] = cleanSrc;
      if (origVal && cleanSrc && origVal !== cleanSrc && !cleanSrc.startsWith('data:')) {
        fullState.imageMap[origVal] = cleanSrc;
      }
    });

    document.querySelectorAll('.hero-cta-group a, .ksa-event-banner a.btn, .news-actions a, .btn-ravot, .btn-ticket').forEach(a => {
      const sel = getUniqueSelector(a);
      if (sel) {
        pageData.links[sel] = {
          href: a.getAttribute('href'),
          hidden: a.style.display === 'none'
        };
      }
    });

    if (window.groupData) {
      fullState.groups = {};
      ['kabouters', 'sloebers', 'roodkapjes', 'jim', 'sim', 'kim'].forEach(k => {
        if (window.groupData[k]) {
          fullState.groups[k] = {
            name: window.groupData[k].name,
            image: window.groupData[k].image,
            ageRange: window.groupData[k].ageRange,
            tagline: window.groupData[k].tagline,
            desc: window.groupData[k].desc,
            perks: window.groupData[k].perks
          };
        }
      });
    }

    const desktopWrap = document.querySelector('.countdown-banner-wrap');
    const mobileCard = document.querySelector('.mobile-event-card');
    const bannerTargetEl = desktopWrap || mobileCard;
    const bannerDateInput = document.getElementById('ksaBannerDateInput');

    fullState[pageKey] = pageData;
    fullState.banner = {
      hidden: bannerTargetEl ? bannerTargetEl.style.display === 'none' : false,
      targetIso: bannerDateInput && bannerDateInput.value
        ? new Date(bannerDateInput.value).toISOString()
        : (window.ksaCountdownTargetDate ? window.ksaCountdownTargetDate.toISOString() : null)
    };
    fullState.updatedAt = new Date().toISOString();

    const jsonString = JSON.stringify(fullState, null, 2);

    // 3. Sla altijd direct lokaal op
    localStorage.setItem(KSA_GITHUB_EDITOR_CONFIG.storageKey, jsonString);

    // 4. Commit data/site-content.json rechtstreeks naar GitHub!
    let githubSuccess = false;
    if (ghToken) {
      try {
        await commitFileToGithub(
          ghToken,
          ghOwner,
          ghRepo,
          ghBranch,
          KSA_GITHUB_EDITOR_CONFIG.contentFilePath,
          utf8ToBase64(jsonString),
          `✏️ Website bijgewerkt via KSA Edit Mode (${new Date().toLocaleDateString('nl-BE')})`
        );
        githubSuccess = true;
      } catch (err) {
        alert(`⚠️ Lokaal opgeslagen, maar GitHub publicatie gaf een melding:\n${err.message}\n\nControleer je GitHub Token via de knop "⚙️ GitHub Koppeling".`);
      }
    } else {
      openGithubConfigModal(true);
    }

    injectCardEditTools();
    saveBtn.disabled = false;
    saveBtn.innerHTML = githubSuccess ? '✅ Live gepubliceerd op GitHub!' : '✅ Lokaal Opgeslagen!';
    setTimeout(() => { saveBtn.innerHTML = origText; }, 3500);
  }

  // --------------------------------------------------------------------------
  // 13. GITHUB INSTELLINGEN MODAL
  // --------------------------------------------------------------------------
  function openGithubConfigModal(fromSave = false) {
    const curToken = localStorage.getItem('ksa_github_token') || '';
    const curOwner = localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner;
    const curRepo = localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName;
    const curBranch = localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch;
    const curPin = localStorage.getItem('ksa_custom_pin') || KSA_GITHUB_EDITOR_CONFIG.defaultPin;

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');

    modal.innerHTML = `
      <h3>⚙️ Rechtstreekse GitHub Koppeling</h3>
      ${fromSave ? `<p style="color:#166534; background:#dcfce7; padding:8px 10px; border-radius:8px; font-weight:600;">✅ Je wijzigingen zijn alvast in je browser bewaard! Vul hieronder eenmalig je GitHub Token in om ze live naar GitHub te pushen:</p>` : `<p>Hiermee schrijft de knop <strong>"💾 Opslaan naar GitHub"</strong> alle aanpassingen en geüploade foto's rechtstreeks naar jullie GitHub repository.</p>`}
      <p style="font-size:0.78rem; background:#f1f5f9; padding:8px 10px; border-radius:8px;">
        <strong>Hoe maak je een gratis GitHub Token aan (slechts 1x nodig)?</strong><br>
        1. Ga op GitHub naar <em>Settings &rarr; Developer settings &rarr; Personal access tokens &rarr; Fine-grained tokens &rarr; Generate new token</em>.<br>
        2. Kies repository <strong>${curOwner}/${curRepo}</strong> en geef onder <em>Repository permissions</em> bij <strong>Contents</strong> de rechten <strong>Read and write</strong>.<br>
        3. Plak de gegenereerde token (<code>github_pat_...</code> of <code>ghp_...</code>) hieronder:
      </p>
      <label>GitHub Personal Access Token:</label>
      <input type="password" id="ksaGhTokenInput" placeholder="github_pat_... of ghp_..." value="${curToken}">
      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
        <div>
          <label>Eigenaar:</label>
          <input type="text" id="ksaGhOwnerInput" value="${curOwner}">
        </div>
        <div>
          <label>Repository:</label>
          <input type="text" id="ksaGhRepoInput" value="${curRepo}">
        </div>
        <div>
          <label>Branch:</label>
          <input type="text" id="ksaGhBranchInput" value="${curBranch}">
        </div>
      </div>
      <label>Leiding Pincode voor Edit Mode:</label>
      <input type="text" id="ksaNewPinInput" value="${curPin}">
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaGhCancel">Sluiten</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaGhSave">💾 Bewaar &amp; Koppel</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    document.getElementById('ksaGhCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaGhSave').onclick = () => {
      localStorage.setItem('ksa_github_token', document.getElementById('ksaGhTokenInput').value.trim());
      localStorage.setItem('ksa_github_owner', document.getElementById('ksaGhOwnerInput').value.trim() || 'Schepie');
      localStorage.setItem('ksa_github_repo', document.getElementById('ksaGhRepoInput').value.trim() || 'KSA-website');
      localStorage.setItem('ksa_github_branch', document.getElementById('ksaGhBranchInput').value.trim() || 'main');
      const pinVal = document.getElementById('ksaNewPinInput').value.trim();
      if (pinVal) localStorage.setItem('ksa_custom_pin', pinVal);
      backdrop.style.display = 'none';
      if (fromSave && document.getElementById('ksaGhTokenInput').value.trim()) {
        saveAllEditsToGithub();
      }
    };
  }

  function resetAllEdits() {
    if (!confirm('Wil je alle lokale aanpassingen wissen en terugkeren naar de laatst gepubliceerde GitHub-versie?')) {
      return;
    }
    localStorage.removeItem(KSA_GITHUB_EDITOR_CONFIG.storageKey);
    window.location.reload();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      injectEditorUI();
      loadAndApplySiteContent();
    });
  } else {
    injectEditorUI();
    loadAndApplySiteContent();
  }
})();
