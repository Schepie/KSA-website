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
  defaultPinHash: '1b76a9af19078b491475a25e77a874cd60a79dd7f8ff4ec8c2bde91d7a542de7',
  adminEmail: 'geert.schepers@gmail.com',
  hashSalt: 'ksa_zonhoven_editor_v1:',
  repoOwner: 'Schepie',
  repoName: 'KSA-website',
  defaultBranch: 'main',
  contentFilePath: 'data/site-content.json',
  storageKey: 'ksa_website_github_edits_v3'
};

(function initKsaVisualEditor() {
  let isEditMode = false;
  let currentLinkTarget = null;
  let currentImageTarget = null;
  let pendingImageUploads = {}; // { key: { selector, origSrc, groupKey, base64, fileName, dataUrl } }

  // --------------------------------------------------------------------------
  // CRYPTOGRAFISCHE WACHTWOORD HASHING (SHA-256)
  // --------------------------------------------------------------------------
  async function hashPin(pin) {
    const raw = (pin || '').trim().toLowerCase();
    const salted = KSA_GITHUB_EDITOR_CONFIG.hashSalt + raw;
    try {
      if (window.crypto && crypto.subtle) {
        const msgBuffer = new TextEncoder().encode(salted);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('[KSA Auth] Web Crypto niet beschikbaar, fallback actief:', e);
    }
    let h = 0;
    for (let i = 0; i < salted.length; i++) {
      h = Math.imul(31, h) + salted.charCodeAt(i) | 0;
    }
    return 'fallback_' + Math.abs(h).toString(16);
  }

  async function getActivePinHash() {
    try {
      const s = await fetchLatestGithubState();
      if (s && s._auth && s._auth.pinHash) {
        localStorage.setItem('ksa_active_pin_hash', s._auth.pinHash);
        return s._auth.pinHash;
      }
    } catch (e) {}

    const cached = localStorage.getItem('ksa_active_pin_hash');
    if (cached) return cached;

    return KSA_GITHUB_EDITOR_CONFIG.defaultPinHash;
  }

  // --------------------------------------------------------------------------
  // AES-256-GCM WACHTWOORD-KLUIS VOOR GITHUB TOKEN (PBKDF2 + AES-GCM)
  // --------------------------------------------------------------------------
  const toHex = arr => Array.from(new Uint8Array(arr)).map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = hex => new Uint8Array((hex || '').match(/.{1,2}/g).map(byte => parseInt(byte, 16)));

  async function encryptToVault(plaintext, password) {
    if (!window.crypto || !crypto.subtle) throw new Error('Web Crypto API niet beschikbaar');
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const baseKey = await crypto.subtle.importKey(
      'raw',
      enc.encode((password || '').trim().toLowerCase()),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    const aesKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );
    const cipherBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      enc.encode(plaintext.trim())
    );
    return {
      salt: toHex(salt),
      iv: toHex(iv),
      data: toHex(cipherBuffer),
      updatedAt: new Date().toISOString()
    };
  }

  async function decryptFromVault(vaultObj, password) {
    if (!vaultObj || !vaultObj.salt || !vaultObj.iv || !vaultObj.data) return null;
    if (!window.crypto || !crypto.subtle) return null;
    try {
      const enc = new TextEncoder();
      const dec = new TextDecoder();
      const salt = fromHex(vaultObj.salt);
      const iv = fromHex(vaultObj.iv);
      const cipher = fromHex(vaultObj.data);
      const baseKey = await crypto.subtle.importKey(
        'raw',
        enc.encode((password || '').trim().toLowerCase()),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      );
      const aesKey = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        aesKey,
        cipher
      );
      return dec.decode(decrypted).trim();
    } catch (e) {
      console.warn('[KSA Vault] Ontsleutelen kluis mislukt met opgegeven wachtwoord');
      return null;
    }
  }

  function getEffectiveGithubToken() {
    return (sessionStorage.getItem('ksa_github_token') || localStorage.getItem('ksa_github_token') || '').trim();
  }

  async function verifyGithubToken(token, owner, repo) {
    if (!token) return false;
    const cleanToken = token.replace(/^Bearer\s+/i, '').replace(/[\r\n\t ]+/g, '').trim();
    if (!cleanToken) return false;

    const url = `https://api.github.com/repos/${owner}/${repo}`;
    try {
      let res = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${cleanToken}`,
          'Accept': 'application/vnd.github+json'
        }
      });
      if (!res.ok && res.status === 401) {
        res = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `token ${cleanToken}`,
            'Accept': 'application/vnd.github+json'
          }
        });
      }
      return res.status === 200;
    } catch (e) {
      return false;
    }
  }

  async function checkAndSyncGithubConnectionStatus() {
    const ghBtn = document.getElementById('ksaBtnGithubConfig');
    const owner = (localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner).trim();
    const repo = (localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName).trim();

    let token = getEffectiveGithubToken();
    if (!token) {
      try {
        const s = await fetchLatestGithubState();
        if (s && s._auth && s._auth.vault) {
          const pass = sessionStorage.getItem('ksa_session_pass');
          if (pass) {
            token = await decryptFromVault(s._auth.vault, pass);
            if (token) {
              sessionStorage.setItem('ksa_github_token', token);
              localStorage.setItem('ksa_github_token', token);
            }
          }
        }
      } catch (e) {}
    }

    const isValid = await verifyGithubToken(token, owner, repo);

    if (isValid) {
      // ✅ Geldige koppeling aanwezig: verberg de knop in het bewerkmenu!
      if (ghBtn) ghBtn.style.display = 'none';
    } else {
      // ⚠️ Geen geldige koppeling, corrupt of vervallen token:
      if (ghBtn) ghBtn.style.display = '';
      openGithubConfigModal(false, true);
    }
  }

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

  const EDITABLE_LINK_SELECTOR = '.hero-cta-group a, .ksa-event-banner a.btn, .news-actions a, .btn-ravot, .btn-ticket, #groupResultBtn, .leiding-card a.btn, #verhuring a.btn, #contact a.btn, .topbar-link, .ksa-topbar a';

  function isGroupManagedSelector(selector) {
    return typeof selector === 'string' && (selector.startsWith('#groupResult') || selector.startsWith('#mGroup'));
  }

  function applyGroupButtonsState() {
    const groups = window.groupData || window.mobileGroupData;
    if (!groups) return;
    ['kabouters', 'sloebers', 'roodkapjes', 'jim', 'sim', 'kim'].forEach(grpKey => {
      const g = (window.groupData && window.groupData[grpKey]) || (window.mobileGroupData && window.mobileGroupData[grpKey]) || groups[grpKey];
      if (!g) return;
      const dBtn = document.querySelector(`.quiz-pill-btn[data-group="${grpKey}"]`);
      if (dBtn) {
        if (g.buttonLabel) dBtn.textContent = g.buttonLabel;
        else g.buttonLabel = dBtn.textContent.trim();
        dBtn.classList.toggle('ksa-group-hidden', !!g.hidden);
        dBtn.style.display = (!isEditMode && g.hidden) ? 'none' : '';
      }
      const mBtn = document.querySelector(`.group-select-btn[data-group="${grpKey}"]`);
      if (mBtn) {
        if (g.mobileButtonLabel) mBtn.textContent = g.mobileButtonLabel;
        else if (g.buttonLabel) mBtn.textContent = g.buttonLabel;
        mBtn.classList.toggle('ksa-group-hidden', !!g.hidden);
        mBtn.style.display = (!isEditMode && g.hidden) ? 'none' : '';
      }
    });
  }

  function ensureJimSimCircles() {
    const cards = document.querySelectorAll('.leiding-grid .leiding-card');
    if (cards.length < 5) return;

    // Kaart 4 = JIM (3 cirkels: Lotte, Lina B., Lina S.)
    const jimCard = cards[3];
    if (jimCard && jimCard.querySelectorAll('.leiding-avatar-item').length < 3) {
      const duo = jimCard.querySelector('.leiding-avatars-duo');
      if (duo) {
        duo.style.gap = '10px';
        duo.innerHTML = `
          <div class="leiding-avatar-item gallery-item" title="Klik om foto van Lotte te bekijken">
            <div class="leiding-avatar-thumb">
              <img src="images/uploads/1793738396382_WhatsApp_Image_2026-11-03_at_17.46.16__6_.jpg" alt="Lotte (Jim)">
            </div>
            <span class="leiding-avatar-name">Lotte</span>
          </div>
          <div class="leiding-avatar-item gallery-item" title="Klik om foto van Lina B. te bekijken">
            <div class="leiding-avatar-thumb">
              <img src="images/WhatsApp Image 2026-11-03 at 17.46.17 (5).jpeg" alt="Lina B. (Jim)">
            </div>
            <span class="leiding-avatar-name">Lina B.</span>
          </div>
          <div class="leiding-avatar-item gallery-item" title="Klik om foto van Lina S. te bekijken">
            <div class="leiding-avatar-thumb">
              <img src="images/uploads/1793738407058_WhatsApp_Image_2026-11-03_at_17.46.16__4_.jpg" alt="Lina S. (Jim)">
            </div>
            <span class="leiding-avatar-name">Lina S.</span>
          </div>
        `;
      }
    }

    // Kaart 5 = SIM (2 cirkels: Kato, Fien)
    const simCard = cards[4];
    if (simCard && simCard.querySelectorAll('.leiding-avatar-item').length < 2) {
      const firstDiv = simCard.querySelector('div');
      if (firstDiv) {
        const duo = document.createElement('div');
        duo.className = 'leiding-avatars-duo';
        duo.innerHTML = `
          <div class="leiding-avatar-item gallery-item" title="Klik om foto van Kato te bekijken">
            <div class="leiding-avatar-thumb">
              <img src="images/WhatsApp Image 2026-11-03 at 17.46.16 (2).jpeg" alt="Kato (Sim)">
            </div>
            <span class="leiding-avatar-name">Kato</span>
          </div>
          <div class="leiding-avatar-item gallery-item" title="Klik om foto van Fien te bekijken">
            <div class="leiding-avatar-thumb">
              <img src="images/uploads/1793738334687_WhatsApp_Image_2026-11-03_at_17.46.16__1_.jpg" alt="Fien (Sim)">
            </div>
            <span class="leiding-avatar-name">Fien</span>
          </div>
        `;
        firstDiv.replaceWith(duo);
      }
    }
  }

  function convertDesktopCalToMobileList(calGridHtml) {
    if (!calGridHtml || typeof calGridHtml !== 'string') return '';
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${calGridHtml}</div>`, 'text/html');
      const items = doc.querySelectorAll('.cal-item');
      if (!items || items.length === 0) return '';

      const monthNames = {
        '1': 'JAN', '01': 'JAN',
        '2': 'FEB', '02': 'FEB',
        '3': 'MRT', '03': 'MRT',
        '4': 'APR', '04': 'APR',
        '5': 'MEI', '05': 'MEI',
        '6': 'JUN', '06': 'JUN',
        '7': 'JULI', '07': 'JULI',
        '8': 'AUG', '08': 'AUG',
        '9': 'SEP', '09': 'SEP',
        '10': 'OKT',
        '11': 'NOV',
        '12': 'DEC'
      };

      const mobileCards = [];

      items.forEach(item => {
        const dateEl = item.querySelector('.cal-date');
        let rawDate = dateEl ? (dateEl.innerText || dateEl.textContent).replace('!', '').trim() : '';
        let day = '01';
        let monthStr = 'KSA';

        if (rawDate.includes('/')) {
          const parts = rawDate.split('/');
          const dPart = parts[0].trim();
          const mPart = parts[1].trim();
          day = dPart.length === 1 ? '0' + dPart : dPart;
          monthStr = monthNames[mPart] || mPart;
        } else if (rawDate) {
          day = rawDate;
        }

        const stickerEl = item.querySelector('.cal-sticker');
        const sticker = stickerEl ? (stickerEl.innerText || stickerEl.textContent).trim() : '';

        const textEl = item.querySelector('.cal-event-text');
        let title = textEl ? (textEl.innerText || textEl.textContent).replace(/\n+/g, ' ').trim() : 'KSA';
        if (!title) title = 'KSA';

        const isCurrent = item.classList.contains('is-current') || !!item.querySelector('.cal-pill-now');
        const isPast = item.classList.contains('is-past');

        const lowerTitle = title.toLowerCase();
        const isGeenKsa = lowerTitle.includes('geen ksa');
        const isHololool = lowerTitle.includes('hololool') || sticker === '🔥';
        const isKerst = lowerTitle.includes('kerst') || sticker === '🎅';
        const isSint = lowerTitle.includes('sint') || sticker === '👑';
        const isSpaghetti = lowerTitle.includes('spaghetti') || sticker === '🍝';
        const isKamp = lowerTitle.includes('kamp') || sticker === '⛺';

        let category = 'ksa';
        let badgeHtml = '<span class="cal-event-badge badge-active">13u30 - 17u00</span>';
        let subtext = 'Aan ons lokaal &bull; Dijkbeemdenweg 8';
        let dateBlockStyle = '';

        if (isGeenKsa) {
          category = 'special';
          badgeHtml = '<span class="cal-event-badge badge-none">Geen KSA</span>';
          subtext = 'Geen KSA activiteit deze zondag';
          dateBlockStyle = 'style="background:#f1f5f9; color:#64748b;"';
        } else if (isCurrent) {
          badgeHtml = '<span class="cal-event-badge badge-highlight">Binnenkort!</span>';
        } else if (isPast) {
          badgeHtml = '<span class="cal-event-badge badge-none">Reeds voorbij</span>';
          dateBlockStyle = 'style="background:#f1f5f9; color:#94a3b8;"';
        }

        if (isHololool) {
          category = 'special';
          if (!isCurrent && !isPast) badgeHtml = '<span class="cal-event-badge badge-highlight">Hololool!</span>';
          subtext = 'Samen rond het vuur &bull; Gezelligheid!';
          dateBlockStyle = 'style="background:#fef3c7; color:#d97706;"';
        } else if (isKerst) {
          category = 'special';
          if (!isCurrent && !isPast) badgeHtml = '<span class="cal-event-badge badge-highlight">Kerstfeestje!</span>';
          subtext = 'Gezellig samen kerst vieren aan ons lokaal';
          dateBlockStyle = 'style="background:var(--ksa-red-soft); color:var(--ksa-red);"';
        } else if (isSint) {
          category = 'special';
          if (!isCurrent && !isPast) badgeHtml = '<span class="cal-event-badge badge-active">Sint op bezoek!</span>';
          subtext = '13u30 tot 17u00 &bull; Hoog bezoek aan ons lokaal!';
          dateBlockStyle = 'style="background:var(--ksa-red-soft); color:var(--ksa-red);"';
        } else if (isSpaghetti) {
          category = 'special';
          if (!isCurrent && !isPast) badgeHtml = '<span class="cal-event-badge badge-highlight">Spaghettidag</span>';
          subtext = 'Lekker eten & gezelligheid aan ons lokaal';
          dateBlockStyle = 'style="background:var(--ksa-yellow-soft); color:#b45309;"';
        } else if (isKamp) {
          category = 'special';
          if (!isCurrent && !isPast) badgeHtml = '<span class="cal-event-badge badge-highlight">Zomerkamp!</span>';
          subtext = 'Het absolute hoogtepunt van ons KSA-jaar!';
          dateBlockStyle = 'style="background:var(--ksa-blue-soft); color:var(--ksa-blue);"';
        } else if (sticker || (lowerTitle !== 'ksa' && !isGeenKsa)) {
          category = 'special';
        }

        let fullTitle = title;
        if (sticker && !fullTitle.includes(sticker)) {
          fullTitle = `${fullTitle} ${sticker}`;
        }

        mobileCards.push(`
        <div class="cal-card-item ${isCurrent ? 'is-current' : ''} ${isPast ? 'is-past' : ''}" data-category="${category}">
          <div class="cal-date-block" ${dateBlockStyle}>
            <span class="cal-day-num">${day}</span>
            <span class="cal-month-str">${monthStr}</span>
          </div>
          <div class="cal-info-block">
            <div class="cal-event-title-row">
              <span class="cal-event-name">${fullTitle}</span>
              ${badgeHtml}
            </div>
            <div class="cal-event-subtext">${subtext}</div>
          </div>
        </div>`);
      });

      return mobileCards.join('\n');
    } catch (err) {
      console.warn('[KSA Visual Editor] Fout bij converteren desktop kalender naar mobiel:', err);
      return '';
    }
  }

  function applyStateToDom(state) {
    if (!state || typeof state !== 'object') return;
    ensureJimSimCircles();
    const isMobilePage = window.location.pathname.includes('mobile.html');
    const pageKey = isMobilePage ? 'mobile' : 'desktop';
    const pageData = state[pageKey] || {};
    const desktopData = state.desktop || {};

    // 1. Leeftijdsgroepen data (Kabouters, Sloebers, Roodkapjes, JIM, SIM, KIM)
    if (state.groups && typeof state.groups === 'object') {
      if (!window.groupData) {
        window.groupData = JSON.parse(JSON.stringify(state.groups));
      }
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
          window.mobileGroupData[grpKey].hidden = !!gVal.hidden;
        }
      });

      applyGroupButtonsState();

      let activeDesktopPill = document.querySelector('.quiz-pill-btn.active:not(.ksa-group-hidden), .quiz-age-pill.active:not(.ksa-group-hidden)')
        || document.querySelector('.quiz-pill-btn:not(.ksa-group-hidden)');
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
      const activeMobBtn = document.querySelector('.group-select-btn.active:not(.ksa-group-hidden)')
        || document.querySelector('.group-select-btn:not(.ksa-group-hidden)');
      if (activeMobBtn && typeof window.renderMobileGroup === 'function') {
        window.renderMobileGroup(activeMobBtn.getAttribute('data-group') || 'kabouters');
      }
    }

    // 2. Sectie-containers (Kalender, Nieuws, Paspoortjes)
    if (pageData.containers) {
      Object.entries(pageData.containers).forEach(([selector, html]) => {
        if (isMobilePage && selector === '.cal-list') return;
        const el = querySmartSelector(selector);
        if (el && typeof html === 'string') {
          el.innerHTML = html;
          // Zorg dat buiten Edit Mode geen contenteditable achterblijft
          if (!isEditMode) {
            el.querySelectorAll('[contenteditable]').forEach(c => c.removeAttribute('contenteditable'));
            el.querySelectorAll('.ksa-editable-img').forEach(c => c.classList.remove('ksa-editable-img'));
          }
        }
      });
      updateShortcutsVisibility();
    }

    // 2b. Synchroniseer Kalender van Desktop naar Mobiel
    if (isMobilePage) {
      const desktopContainers = desktopData.containers || {};
      const calGridHtml = desktopContainers['.cal-grid'];
      if (calGridHtml) {
        const calList = document.querySelector('.cal-list');
        if (calList) {
          const convertedMobileCal = convertDesktopCalToMobileList(calGridHtml);
          if (convertedMobileCal) {
            calList.innerHTML = convertedMobileCal;
            if (typeof window.initCalendarFilters === 'function') {
              window.initCalendarFilters();
            }
          }
        }
      }
    }

    // 3. Tekst-elementen
    if (pageData.texts) {
      Object.entries(pageData.texts).forEach(([selector, html]) => {
        if (isGroupManagedSelector(selector)) return;
        const el = querySmartSelector(selector);
        if (!el || html === undefined) return;
        if (el.classList && el.classList.contains('cal-sticker')) return;
        el.innerHTML = html;
      });
    }

    // 4. Foto's per selector (elke foto is 100% onafhankelijk!)
    const imagesToApply = Object.assign({}, desktopData.images || {}, pageData.images || {});
    if (Object.keys(imagesToApply).length > 0) {
      Object.entries(imagesToApply).forEach(([selector, src]) => {
        if (isGroupManagedSelector(selector)) return;
        const img = querySmartSelector(selector);
        if (img && src) {
          setSmartImageSrc(img, src);
        }
      });
    }

    // 5. Knoppen & Links
    if (pageData.links) {
      Object.entries(pageData.links).forEach(([selector, info]) => {
        const a = querySmartSelector(selector);
        if (!a || !info) return;
        // Als dit element in een container zit die al geladen is (.hero-cta-group, #ksaTopbar, .news-grid), sla over
        if (a.closest('#ksaTopbar, .hero-cta-group, .cal-grid, .news-grid, .paspoort-grid, .cal-list')) return;
        if (info.href !== undefined) a.setAttribute('href', info.href);
        if (info.text !== undefined) {
          const span = a.querySelector('span') || a;
          span.textContent = info.text;
        }
        if (info.hidden !== undefined) {
          a.classList.toggle('ksa-link-hidden', !!info.hidden);
          a.style.display = (!isEditMode && info.hidden) ? 'none' : '';
        }
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
        updateBannerButtonState();
      }
      if (b.targetIso) {
        const d = new Date(b.targetIso);
        if (!isNaN(d.getTime())) {
          window.ksaCountdownTargetDate = d;
        }
      }
    }

    // 7b. Snelle Toegang sectie zichtbaarheid op mobiel
    const isShortcutsHidden = (state.shortcutsHidden !== undefined) ? state.shortcutsHidden : (state.mobile && state.mobile.shortcutsHidden);
    if (isShortcutsHidden !== undefined) {
      setShortcutsSectionHidden(isShortcutsHidden);
    }

    // 7c. Topbar sectie zichtbaarheid op desktop
    const isTopbarHidden = (state.topbarHidden !== undefined) ? state.topbarHidden : (state.desktop && state.desktop.topbarHidden);
    if (isTopbarHidden !== undefined) {
      setTopbarSectionHidden(isTopbarHidden);
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
          if (sib.id === 'ksaBannerControlBar' || sib.id === 'ksaGroupPillsControlBar' || sib.classList.contains('ksa-card-edit-tools')) {
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
      body.ksa-edit-mode-active .ksa-topbar [contenteditable="true"] {
        outline: 1.5px dashed #fdb900;
        outline-offset: 3px;
        border-radius: 4px;
        color: #ffffff;
        cursor: text;
        transition: all 0.2s;
      }
      body.ksa-edit-mode-active .ksa-topbar [contenteditable="true"]:hover,
      body.ksa-edit-mode-active .ksa-topbar [contenteditable="true"]:focus {
        outline: 2px solid #ffffff;
        background-color: rgba(253, 185, 0, 0.25);
      }
      body.ksa-edit-mode-active .ksa-topbar a.topbar-link {
        outline: 1.5px dashed #22c55e;
        outline-offset: 3px;
        border-radius: 4px;
        padding: 1px 4px;
        cursor: pointer !important;
        transition: all 0.2s;
      }
      body.ksa-edit-mode-active .ksa-topbar a.topbar-link:hover {
        outline: 2px solid #ffffff;
        background-color: rgba(34, 197, 94, 0.25);
      }
      .ksa-topbar-edit-pill {
        display: none;
      }
      body.ksa-edit-mode-active .ksa-topbar-edit-pill {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #fdb900;
        color: #001f3f;
        font-weight: 800;
        font-size: 11px;
        padding: 3px 10px;
        border-radius: 999px;
        cursor: pointer;
        border: none;
        box-shadow: 0 2px 6px rgba(0,0,0,0.25);
        margin-left: 8px;
        transition: all 0.2s;
      }
      body.ksa-edit-mode-active .ksa-topbar-edit-pill:hover {
        background: #ffffff;
        transform: scale(1.05);
      }
      .ksa-topbar-pill-danger {
        background: #fee2e2 !important;
        color: #b91c1c !important;
      }
      .ksa-topbar-pill-success {
        background: #dcfce7 !important;
        color: #166534 !important;
      }
      .topbar-hidden-badge {
        font-size: 10px;
        font-weight: 800;
        background: #fee2e2;
        color: #b91c1c;
        border: 1px solid #fca5a5;
        border-radius: 999px;
        padding: 2px 8px;
        margin-left: 8px;
        vertical-align: middle;
        text-transform: uppercase;
      }
      body:not(.ksa-edit-mode-active) .topbar-hidden-badge {
        display: none !important;
      }
      body:not(.ksa-edit-mode-active) .ksa-topbar.ksa-section-hidden {
        display: none !important;
      }
      body.ksa-edit-mode-active .ksa-topbar.ksa-section-hidden {
        opacity: 0.55;
        filter: grayscale(0.5);
        border-bottom: 2px dashed #f59e0b;
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
      body:not(.ksa-edit-mode-active) .cal-sticker.ksa-sticker-empty,
      body:not(.ksa-edit-mode-active) .cal-sticker:empty {
        display: none !important;
      }
      body.ksa-edit-mode-active .cal-sticker {
        pointer-events: auto !important;
        cursor: pointer !important;
        outline: 2px dashed #e3001b;
        outline-offset: 2px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.95);
        padding: 2px;
        min-width: 26px;
        min-height: 26px;
        display: inline-flex !important;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
      }
      body.ksa-edit-mode-active .cal-sticker.ksa-sticker-empty::before,
      body.ksa-edit-mode-active .cal-sticker:empty::before {
        content: "➕";
        font-size: 0.75rem;
        line-height: 1;
        opacity: 0.75;
      }
      body.ksa-edit-mode-active .cal-sticker.ksa-sticker-empty,
      body.ksa-edit-mode-active .cal-sticker:empty {
        outline: 2px dashed #0055a5;
        background: rgba(255, 255, 255, 0.92);
      }
      body.ksa-edit-mode-active .cal-sticker:hover {
        transform: scale(1.25) !important;
        outline: 2px solid #0055a5;
        opacity: 1 !important;
      }
      .ksa-sticker-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 8px;
        margin: 12px 0;
      }
      .ksa-sticker-choice {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 8px 6px;
        border: 1.5px solid #cbd5e1;
        border-radius: 10px;
        background: #f8fafc;
        cursor: pointer;
        font-size: 1.35rem;
        transition: all 0.15s;
      }
      .ksa-sticker-choice span {
        font-size: 0.7rem;
        font-weight: 700;
        color: #334155;
      }
      .ksa-sticker-choice:hover {
        border-color: #0055a5;
        background: #e0f2fe;
        transform: translateY(-1px);
      }

      body:not(.ksa-edit-mode-active) .ksa-group-hidden,
      body:not(.ksa-edit-mode-active) .ksa-link-hidden {
        display: none !important;
      }
      body.ksa-edit-mode-active .ksa-group-hidden,
      body.ksa-edit-mode-active .ksa-link-hidden {
        display: inline-flex !important;
        opacity: 0.55 !important;
        text-decoration: line-through !important;
        outline: 2px dashed #e3001b !important;
        position: relative !important;
      }
      .ksa-btn-add-pill {
        display: none;
      }
      body.ksa-edit-mode-active .ksa-btn-add-pill {
        display: inline-flex !important;
        align-items: center;
        gap: 6px;
        background: rgba(0, 85, 165, 0.08);
        color: #0055a5;
        border: 2px dashed #0055a5;
        border-radius: 999px;
        padding: 10px 18px;
        font-weight: 700;
        font-size: 14px;
        cursor: pointer;
        transition: all 0.2s;
        vertical-align: middle;
      }
      body.ksa-edit-mode-active .ksa-btn-add-pill:hover {
        background: #0055a5;
        color: #ffffff;
        border-color: #0055a5;
        transform: scale(1.04);
      }
      body.ksa-edit-mode-active .ksa-editable-btn {
        outline: 2px dashed #0055a5;
        outline-offset: 3px;
        cursor: pointer !important;
      }
      body.ksa-edit-mode-active .ksa-editable-btn:hover {
        outline: 2.5px solid #e3001b;
      }

      body.ksa-edit-mode-active .paspoort-card {
        transform: none !important;
      }
      body.ksa-edit-mode-active .paspoort-card:hover {
        transform: none !important;
      }
      body.ksa-edit-mode-active .paspoort-card-badge {
        cursor: pointer !important;
        outline: 2px dashed #0055a5 !important;
        outline-offset: 2px;
        background-color: #0055a5 !important;
        transition: transform 0.15s, background-color 0.15s;
        z-index: 25 !important;
      }
      body.ksa-edit-mode-active .paspoort-card-badge:hover {
        outline: 2px solid #e3001b !important;
        background-color: #e3001b !important;
        transform: scale(1.06);
      }

      .leiding-avatar-thumb,
      .leiding-card > div:first-child:not(.leiding-avatars-duo) {
        width: 76px !important;
        height: 76px !important;
      }
      .leiding-avatar-thumb img,
      .leiding-card > div:first-child > img {
        object-fit: cover !important;
        object-position: 50% 34% !important;
        transform-origin: 50% 36% !important;
        transition: transform 0.35s cubic-bezier(0.25, 0.8, 0.25, 1) !important;
      }
      .leiding-avatar-item:hover .leiding-avatar-thumb img,
      .leiding-card > div:first-child:hover > img {
        transform: scale(1.85) !important;
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
      .ksa-dock-btn-push {
        background: #0284c7;
        color: #ffffff;
        box-shadow: 0 4px 12px rgba(2, 132, 199, 0.35);
      }
      .ksa-dock-btn-push:hover { background: #0369a1; transform: translateY(-1px); }
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

      @media (max-width: 768px), (pointer: coarse) {
        body.ksa-edit-mode-active .mobile-bottom-nav {
          position: fixed !important;
          bottom: 0 !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 100000 !important;
          display: flex !important;
          background: rgba(255, 255, 255, 0.98) !important;
          box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.15) !important;
        }
        body.ksa-edit-mode-active .ksa-editor-dock {
          bottom: calc(var(--nav-height, 64px) + env(safe-area-inset-bottom, 0px)) !important;
          z-index: 99999 !important;
          padding: 8px 10px !important;
          gap: 6px !important;
        }
        body.ksa-edit-mode-active .ksa-dock-hint {
          display: none !important;
        }
        body.ksa-edit-mode-active .ksa-dock-left {
          gap: 6px !important;
        }
        body.ksa-edit-mode-active .ksa-dock-actions {
          width: 100% !important;
          justify-content: flex-start !important;
          overflow-x: auto !important;
          -webkit-overflow-scrolling: touch !important;
          flex-wrap: nowrap !important;
          padding-bottom: 2px !important;
        }
        body.ksa-edit-mode-active .ksa-dock-btn {
          padding: 6px 12px !important;
          font-size: 11.5px !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        body.ksa-edit-mode-active {
          padding-bottom: calc(var(--nav-height, 64px) + 140px + env(safe-area-inset-bottom, 0px)) !important;
        }
      }

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

    const mobHeaderBtn = document.getElementById('mobileEditTriggerBtn');
    if (mobHeaderBtn) {
      mobHeaderBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditMode) disableEditMode();
        else promptAndEnableEditMode();
      };
    }

    const deskHeaderBtn = document.getElementById('desktopEditTriggerBtn');
    if (deskHeaderBtn) {
      deskHeaderBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isEditMode) disableEditMode();
        else promptAndEnableEditMode();
      };
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
        <!-- Pushbericht tijdelijk verborgen -->
        <button type="button" class="ksa-dock-btn ksa-dock-btn-push" id="ksaBtnSendPush" title="Stuur direct een pushbericht naar alle smartphones via OneSignal" style="display:none;">📢 Pushbericht</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnEditTopbar" title="Pas de bovenste blauwe KSA-balk aan">📢 Topbalk</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnToggleBanner" title="Toon of verberg de Event Aftelbanner">🎯 Banner Aan/Uit</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBtnChangePin" title="Wijzig het bewerkwachtwoord voor de hele leidingsploeg">🔑 Wachtwoord</button>
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

    const pushBtn = document.getElementById('ksaBtnSendPush');
    if (pushBtn) pushBtn.onclick = openPushNotificationModal;
    document.getElementById('ksaBtnEditTopbar').onclick = openTopbarModal;
    document.getElementById('ksaBtnSaveEdits').onclick = saveAllEditsToGithub;
    document.getElementById('ksaBtnExitEdit').onclick = disableEditMode;
    document.getElementById('ksaBtnToggleBanner').onclick = toggleBannerVisibility;
    document.getElementById('ksaBtnChangePin').onclick = openChangePasswordModal;
    document.getElementById('ksaBtnGithubConfig').onclick = openGithubConfigModal;
    document.getElementById('ksaBtnResetEdits').onclick = resetAllEdits;

    const isMobilePage = window.location.pathname.includes('mobile.html');
    if (isMobilePage) {
      const topbarBtn = document.getElementById('ksaBtnEditTopbar');
      if (topbarBtn) topbarBtn.style.display = 'none';
      const hintEl = dock.querySelector('.ksa-dock-hint');
      if (hintEl) {
        hintEl.innerHTML = '📱 <strong>Mobiele bewerk-modus:</strong> Wijzigingen in groepen, foto\'s en mobiele teksten worden gesynchroniseerd. De <strong>kalender</strong> wordt automatisch overgenomen van de desktop!';
      }

      const shortcutsBtn = document.createElement('button');
      shortcutsBtn.type = 'button';
      shortcutsBtn.className = 'ksa-dock-btn ksa-dock-btn-sec';
      shortcutsBtn.id = 'ksaBtnToggleShortcuts';
      shortcutsBtn.title = 'Toon of verberg de hele sectie Snelle Toegang';
      shortcutsBtn.innerHTML = '⚡ Snelle Toegang Aan/Uit';
      shortcutsBtn.onclick = toggleShortcutsSectionVisibility;
      document.querySelector('.ksa-dock-actions')?.insertBefore(shortcutsBtn, document.getElementById('ksaBtnGithubConfig'));
    }

    if (window.location.search.includes('edit=1') || window.location.hash === '#edit') {
      promptAndEnableEditMode();
    }
  }

  // --------------------------------------------------------------------------
  // 5. WACHTWOORD / PINCODE CONTROLE & MOBIELE BERICHTGEVING
  // --------------------------------------------------------------------------
  function showMobileEditNoticeModal(onProceed) {
    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    if (!modal || !backdrop) {
      if (typeof onProceed === 'function') onProceed();
      return;
    }

    modal.innerHTML = `
      <h3>📱 Mobiele Bewerk-modus</h3>
      <div style="background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:10px; padding:14px; margin:12px 0 16px 0; font-size:13.5px; color:#1e3a8a; line-height:1.5; text-align:left;">
        <strong>ℹ️ Belangrijke info voor leiding:</strong><br>
        Hier kunnen enkel <strong>mobiel-specifieke zaken</strong> worden aangepast (zoals de snelle toegang blokken, mobiele teksten, actieknoppen en foto's).<br><br>
        Grote updates zoals de <strong>officiële kalender</strong> en <strong>groepsinstellingen</strong> dienen op de <strong>desktop website</strong> (het grote scherm) te gebeuren. Die wijzigingen worden daarna automatisch gesynchroniseerd naar deze app!
      </div>
      <div class="ksa-editor-modal-actions" style="gap:10px; display:flex; flex-wrap:wrap; justify-content:flex-end;">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaMobileInfoCancelBtn">Annuleren</button>
        <a href="index.html?edit=1" class="ksa-dock-btn ksa-dock-btn-sec" style="text-decoration:none; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
          💻 Naar Desktopversie
        </a>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaMobileInfoProceedBtn">
          Begrepen, start bewerken
        </button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const proceedBtn = document.getElementById('ksaMobileInfoProceedBtn');
    if (proceedBtn) {
      proceedBtn.onclick = () => {
        backdrop.style.display = 'none';
        if (typeof onProceed === 'function') onProceed();
      };
    }

    const cancelBtn = document.getElementById('ksaMobileInfoCancelBtn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        backdrop.style.display = 'none';
      };
    }
  }

  function injectMobileCalendarEditNotice() {
    const isMobilePage = window.location.pathname.includes('mobile.html') || !!document.getElementById('mobileEditTriggerBtn');
    if (!isMobilePage) return;

    const board = document.getElementById('mobile-kalender-board');
    if (board && !document.getElementById('ksaMobileCalNotice')) {
      const notice = document.createElement('div');
      notice.id = 'ksaMobileCalNotice';
      notice.style.cssText = 'background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:10px; padding:10px 14px; margin-bottom:12px; font-size:12.5px; color:#1e3a8a; display:flex; align-items:center; gap:10px; line-height:1.4;';
      notice.innerHTML = '<span style="font-size:1.3rem;">📅</span><div><strong>Centrale kalender:</strong> De kalender wordt beheerd op de desktop website en wordt hier automatisch actueel gehouden.</div>';
      board.parentElement.insertBefore(notice, board);
    }
  }

  function promptAndEnableEditMode() {
    if (isEditMode) return;
    const isMobilePage = window.location.pathname.includes('mobile.html') || !!document.getElementById('mobileEditTriggerBtn');

    if (sessionStorage.getItem('ksa_edit_unlocked') === '1') {
      if (isMobilePage) {
        showMobileEditNoticeModal(() => enableEditMode());
      } else {
        enableEditMode();
      }
      return;
    }

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>🔐 Leiding Bewerk-modus</h3>
      ${isMobilePage ? `
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-left:4px solid #2563eb; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#1e3a8a; line-height:1.45; text-align:left;">
          <strong>ℹ️ Belangrijke info voor leiding:</strong><br>
          Op deze mobiele weergave kunnen enkel <strong>mobiel-specifieke zaken</strong> worden aangepast (zoals de snelle toegang blokken, mobiele teksten en foto's).<br><br>
          Grote updates zoals de <strong>officiële kalender</strong> en <strong>groepsinstellingen</strong> dienen op de <strong>desktop website</strong> (het grote scherm) te gebeuren en worden automatisch gesynchroniseerd!
        </div>
      ` : `
        <p>Voer de KSA-leiding pincode in om teksten, foto's, kalender, groepen en de aftelbanner rechtstreeks op de website aan te passen.</p>
      `}
      <label for="ksaPinInput">Leiding Wachtwoord / Pincode:</label>
      <input type="password" id="ksaPinInput" placeholder="Voer leiding wachtwoord in..." autofocus>
      <div id="ksaPinError" style="color:#e3001b; font-size:12px; margin-top:6px; display:none;">❌ Ongeldig wachtwoord / pincode. Probeer het opnieuw of vraag de code aan de hoofdleiding.</div>
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaPinCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaPinSubmit">🔓 Ontgrendel Website</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const input = document.getElementById('ksaPinInput');
    const submit = async () => {
      const val = (input.value || '').trim();
      if (!val) {
        input.focus();
        return;
      }
      const submitBtn = document.getElementById('ksaPinSubmit');
      const origText = submitBtn ? submitBtn.innerHTML : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Verifiëren...';
      }

      let isMatch = false;
      try {
        const enteredHash = await hashPin(val);
        const activeHash = await getActivePinHash();

        if (enteredHash === activeHash) {
          isMatch = true;
        } else if (val.toLowerCase() === KSA_GITHUB_EDITOR_CONFIG.defaultPin.toLowerCase() && activeHash === KSA_GITHUB_EDITOR_CONFIG.defaultPinHash) {
          isMatch = true;
        }
      } catch (err) {
        if (val.toLowerCase() === KSA_GITHUB_EDITOR_CONFIG.defaultPin.toLowerCase()) {
          isMatch = true;
        }
      }

      if (isMatch) {
        sessionStorage.setItem('ksa_edit_unlocked', '1');
        sessionStorage.setItem('ksa_session_pass', val);

        // Ontsleutel automatisch de GitHub token kluis indien aanwezig
        try {
          const s = await fetchLatestGithubState();
          if (s && s._auth && s._auth.vault) {
            const token = await decryptFromVault(s._auth.vault, val);
            if (token) {
              sessionStorage.setItem('ksa_github_token', token);
              localStorage.setItem('ksa_github_token', token);
            }
          }
        } catch (e) {
          console.warn('[KSA Vault] Kon kluis bij inloggen niet openen:', e);
        }

        backdrop.style.display = 'none';
        if (isMobilePage) {
          showMobileEditNoticeModal(() => enableEditMode());
        } else {
          enableEditMode();
        }
      } else {
        const errEl = document.getElementById('ksaPinError');
        if (errEl) {
          errEl.style.display = 'block';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = origText;
        }
        input.focus();
        input.select();
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
    checkAndSyncGithubConnectionStatus();

    const textSelectors = [
      '#topbarBadge',
      '#topbarDesc',
      '#topbarPromo',
      '.ksa-topbar-badge',
      '.ksa-topbar-desc',
      '.ksa-topbar-promo',
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
      '.cal-pill-now',
      '#groupResultName',
      '#groupResultAge',
      '#groupResultTagline',
      '#groupResultDesc',
      '.group-tag-pill',
      '.leiding-name',
      '.leiding-role-tag',
      '.leiding-desc',
      '.leiding-avatar-name',
      '.agenda-badge',
      '.paspoort-card-badge',
      '.info-feature-icon',
      '.info-feature-card h3',
      '.info-feature-card p',
      '.ravot-badge',
      '.step-circle',
      '.ravot-step-tile h5',
      '.ravot-step-tile p',
      '#verhuring p',
      '#verhuring li',
      '.contact-tile-icon',
      '.contact-tile h4',
      '.contact-tile p',
      '#footerCopyright',
      '.footer-copyright',
      // Mobiel
      '.shortcut-title',
      '.shortcut-desc',
      '.shortcut-icon-bubble',
      '.hero-live-title',
      '.hero-live-desc',
      '.event-title',
      '.event-media-badge',
      '.event-meta div',
      '#mGroupName',
      '#mGroupAge',
      '#mGroupTagline',
      '#mGroupDesc',
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
      if (!img.dataset.ksaBound) {
        img.dataset.ksaBound = '1';
        img.addEventListener('click', onEditableImageClick, true);
      }
    });

    document.querySelectorAll(EDITABLE_LINK_SELECTOR).forEach(a => {
      a.classList.add('ksa-editable-btn');
      a.title = '🔗 Klik om knoptekst, link of zichtbaarheid aan te passen';
      a.addEventListener('click', onEditableLinkClick, true);
    });

    document.querySelectorAll('.quiz-pill-btn, .group-select-btn').forEach(btn => {
      btn.title = 'Klik om groep te bekijken • Dubbelklik om knoptekst te wijzigen of groep dit jaar te verbergen';
      btn.ondblclick = (e) => {
        if (!isEditMode) return;
        e.preventDefault();
        e.stopPropagation();
        openGroupPillsModal(btn.getAttribute('data-group'));
      };
    });

    document.querySelectorAll('.shortcut-icon-bubble').forEach(bubble => {
      bubble.style.cursor = 'pointer';
      bubble.title = '🎨 Klik om dit icoon of instellingen aan te passen';
      if (!bubble.dataset.ksaBound) {
        bubble.dataset.ksaBound = '1';
        bubble.addEventListener('click', (e) => {
          if (!isEditMode) return;
          e.preventDefault();
          e.stopPropagation();
          const tile = bubble.closest('.shortcut-tile');
          if (tile) openShortcutSettingsModal(tile);
          else openShortcutIconModal(bubble);
        });
      }
    });

    injectBannerControlBar();
    updateBannerButtonState();
    injectGroupPillsControlBar();
    injectCardEditTools();
    injectShortcutTools();
    injectTopbarEditTools();
    updateTopbarButtonState();
    injectButtonGroupTools();
    injectShortcutTools();
    document.querySelectorAll('.ksa-link-hidden, .ksa-group-hidden').forEach(el => {
      el.style.display = '';
    });

    injectMobileCalendarEditNotice();

    const mobHeaderBtn = document.getElementById('mobileEditTriggerBtn');
    if (mobHeaderBtn) {
      mobHeaderBtn.classList.add('active');
      mobHeaderBtn.title = 'Sluit bewerk-modus';
      mobHeaderBtn.innerHTML = '✖';
    }

    const deskHeaderBtn = document.getElementById('desktopEditTriggerBtn');
    if (deskHeaderBtn) {
      deskHeaderBtn.classList.add('active');
      deskHeaderBtn.title = 'Sluit bewerk-modus';
      deskHeaderBtn.innerHTML = '✖';
    }

    document.querySelectorAll('.mobile-bottom-nav .nav-item').forEach(item => {
      if (!item.dataset.ksaTabBound) {
        item.dataset.ksaTabBound = '1';
        item.addEventListener('click', () => {
          if (isEditMode) {
            setTimeout(enableEditMode, 60);
          }
        });
      }
    });
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
    document.querySelectorAll('.cal-sticker').forEach(el => {
      const hasContent = el.textContent.trim().length > 0 || el.querySelector('img') !== null;
      if (!hasContent) el.remove();
      else el.classList.remove('ksa-sticker-empty');
    });
    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      el.removeAttribute('contenteditable');
    });
    document.querySelectorAll('img.ksa-editable-img').forEach(img => {
      img.classList.remove('ksa-editable-img');
      delete img.dataset.ksaBound;
      img.removeEventListener('click', onEditableImageClick, true);
    });
    document.querySelectorAll(EDITABLE_LINK_SELECTOR).forEach(a => {
      a.classList.remove('ksa-editable-btn');
      a.removeEventListener('click', onEditableLinkClick, true);
    });
    const tbBtn = document.getElementById('ksaTopbarEditBtn');
    if (tbBtn) tbBtn.remove();
    const tbToggleBtn = document.getElementById('ksaTopbarToggleHideBtn');
    if (tbToggleBtn) tbToggleBtn.remove();
    const tbBadge = document.getElementById('ksaTopbarHiddenBadge');
    if (tbBadge) tbBadge.remove();
    document.querySelectorAll('.ksa-btn-add-pill').forEach(el => el.remove());
    document.querySelectorAll('.ksa-link-hidden, .ksa-group-hidden').forEach(el => {
      el.style.display = 'none';
    });
    const calNotice = document.getElementById('ksaMobileCalNotice');
    if (calNotice) calNotice.remove();

    const headBtn = document.getElementById('ksaToggleShortcutsHeadBtn');
    if (headBtn) headBtn.remove();
    const badge = document.getElementById('ksaShortcutsHiddenBadge');
    if (badge) badge.remove();

    document.querySelectorAll('.ksa-shortcut-tools, .shortcut-tile-add').forEach(el => el.remove());
    updateShortcutsVisibility();

    const mobHeaderBtn = document.getElementById('mobileEditTriggerBtn');
    if (mobHeaderBtn) {
      mobHeaderBtn.classList.remove('active');
      mobHeaderBtn.title = 'Bewerk website (Leiding Edit Mode)';
      mobHeaderBtn.innerHTML = '✏️';
    }

    const deskHeaderBtn = document.getElementById('desktopEditTriggerBtn');
    if (deskHeaderBtn) {
      deskHeaderBtn.classList.remove('active');
      deskHeaderBtn.title = 'Bewerk website (Leiding Edit Mode)';
      deskHeaderBtn.innerHTML = '✏️';
    }
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

        // Vervang enkel het aangeklikte element (elk element zoals leidingsploeg en leidingspaspoortje heeft zijn eigen aparte foto)
        setSmartImageSrc(currentImageTarget, dataUrl);

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
          targetImg: currentImageTarget,
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
    const isHidden = currentLinkTarget.classList.contains('ksa-link-hidden') || currentLinkTarget.style.display === 'none';

    const isTopbarLink = !!currentLinkTarget.closest('#ksaTopbar');
    const isBtn = currentLinkTarget.classList.contains('btn') || currentLinkTarget.classList.contains('read-more-link');

    let curStyle = 'btn-primary';
    if (currentLinkTarget.classList.contains('btn-blue')) curStyle = 'btn-blue';
    else if (currentLinkTarget.classList.contains('btn-outline-blue')) curStyle = 'btn-outline-blue';
    else if (currentLinkTarget.classList.contains('btn-ravot')) curStyle = 'btn-ravot';
    else if (currentLinkTarget.classList.contains('read-more-link')) curStyle = 'read-more-link';
    else if (currentLinkTarget.classList.contains('btn-primary')) curStyle = 'btn-primary';

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>🔗 Knop of Link aanpassen</h3>
      <label>Tekst op de knop:</label>
      <input type="text" id="ksaEditLinkText" value="${currentText.replace(/"/g, '&quot;')}">
      <label style="margin-top:10px;">Link-adres (bv. #nieuws, #groepen, #kalender, #info of https://...):</label>
      <input type="text" id="ksaEditLinkHref" value="${currentHref.replace(/"/g, '&quot;')}">
      
      ${(!isTopbarLink && isBtn) ? `
      <label style="margin-top:10px;">Knop-stijl / Kleur:</label>
      <select id="ksaEditLinkStyle" style="width:100%; padding:9px 12px; border-radius:8px; border:1px solid #cbd5e1; font-weight:600; margin-top:4px;">
        <option value="btn-primary" ${curStyle === 'btn-primary' ? 'selected' : ''}>🔴 KSA Rood (Standaard Actieknop)</option>
        <option value="btn-blue" ${curStyle === 'btn-blue' ? 'selected' : ''}>🔵 KSA Marineblauw</option>
        <option value="btn-outline-blue" ${curStyle === 'btn-outline-blue' ? 'selected' : ''}>⚪ Wit met blauwe rand</option>
        <option value="btn-ravot" ${curStyle === 'btn-ravot' ? 'selected' : ''}>🟡 Ravot Geel</option>
        <option value="read-more-link" ${curStyle === 'read-more-link' ? 'selected' : ''}>🔗 Subtiele Tekstlink (zonder knopachtergrond)</option>
      </select>
      ` : ''}

      <label style="display:flex; align-items:center; gap:8px; margin-top:14px; cursor:pointer;">
        <input type="checkbox" id="ksaEditLinkHide" ${isHidden ? 'checked' : ''}>
        <span>🙈 Verberg deze knop voor bezoekers op de website</span>
      </label>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:20px; padding-top:14px; border-top:1px solid #e2e8f0; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:8px;">
          ${!isTopbarLink ? `
          <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" id="ksaLinkDelete" title="Verwijder deze knop definitief van de pagina">🗑️ Verwijderen</button>
          <button type="button" class="ksa-mini-btn" id="ksaLinkDuplicate" title="Voeg een extra kopie van deze knop toe ernaast">➕ Knop Dupliceren</button>
          ` : ''}
        </div>
        <div class="ksa-editor-modal-actions" style="margin:0;">
          <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaLinkCancel">Annuleren</button>
          <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaLinkApply">✔️ Toepassen</button>
        </div>
      </div>
    `;
    backdrop.style.display = 'flex';

    if (document.getElementById('ksaLinkDelete')) {
      document.getElementById('ksaLinkDelete').onclick = () => {
        if (confirm('Ben je zeker dat je deze knop wil verwijderen? Tip: je kan hem ook tijdelijk verbergen met het vinkje "Verberg".')) {
          currentLinkTarget.remove();
          backdrop.style.display = 'none';
        }
      };
    }

    if (document.getElementById('ksaLinkDuplicate')) {
      document.getElementById('ksaLinkDuplicate').onclick = () => {
        const clone = currentLinkTarget.cloneNode(true);
        clone.classList.remove('ksa-link-hidden');
        clone.style.display = '';
        const cSpan = clone.querySelector('span') || clone;
        cSpan.textContent = (span.textContent.trim() || 'Nieuwe Knop') + ' (Kopie)';
        if (currentLinkTarget.nextSibling) {
          currentLinkTarget.parentNode.insertBefore(clone, currentLinkTarget.nextSibling);
        } else {
          currentLinkTarget.parentNode.appendChild(clone);
        }
        clone.classList.add('ksa-editable-btn');
        clone.title = '🔗 Klik om knoptekst, link of zichtbaarheid aan te passen';
        clone.addEventListener('click', onEditableLinkClick, true);
        backdrop.style.display = 'none';
        setTimeout(() => {
          onEditableLinkClick({
            currentTarget: clone,
            preventDefault: () => {},
            stopPropagation: () => {}
          });
        }, 50);
      };
    }

    document.getElementById('ksaLinkCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaLinkApply').onclick = () => {
      const newText = document.getElementById('ksaEditLinkText').value.trim();
      const newHref = document.getElementById('ksaEditLinkHref').value.trim();
      const hide = document.getElementById('ksaEditLinkHide').checked;
      const styleSelect = document.getElementById('ksaEditLinkStyle');

      if (newText) span.textContent = newText;
      if (newHref) currentLinkTarget.setAttribute('href', newHref);

      if (styleSelect) {
        const sVal = styleSelect.value;
        currentLinkTarget.classList.remove('btn-primary', 'btn-blue', 'btn-outline-blue', 'btn-ravot', 'read-more-link');
        if (sVal === 'read-more-link') {
          currentLinkTarget.classList.remove('btn', 'btn-lg', 'btn-sm');
          currentLinkTarget.classList.add('read-more-link');
        } else {
          currentLinkTarget.classList.add('btn', sVal);
          if (!currentLinkTarget.classList.contains('btn-lg') && !currentLinkTarget.classList.contains('btn-sm')) {
            currentLinkTarget.classList.add('btn-lg');
          }
        }
      }

      currentLinkTarget.classList.toggle('ksa-link-hidden', hide);
      currentLinkTarget.style.display = (!isEditMode && hide) ? 'none' : '';
      backdrop.style.display = 'none';
    };
  }

  function injectButtonGroupTools() {
    document.querySelectorAll('.hero-cta-group').forEach(group => {
      if (group.querySelector('.ksa-btn-add-pill')) return;
      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'ksa-btn-add-pill';
      addBtn.innerHTML = '➕ Knop Toevoegen';
      addBtn.title = 'Voeg hier een extra knop toe aan deze rij';
      addBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        addNewButtonToGroup(group, addBtn);
      };
      group.appendChild(addBtn);
    });
  }

  function addNewButtonToGroup(group, beforeEl) {
    const newA = document.createElement('a');
    newA.href = '#nieuws';
    newA.className = 'btn btn-primary btn-lg';
    newA.setAttribute('data-confetti', '');
    newA.innerHTML = `<span>✨ Nieuwe Knop</span>`;
    newA.classList.add('ksa-editable-btn');
    newA.title = '🔗 Klik om knoptekst, link of zichtbaarheid aan te passen';
    newA.addEventListener('click', onEditableLinkClick, true);

    if (beforeEl && beforeEl.parentNode === group) {
      group.insertBefore(newA, beforeEl);
    } else {
      group.appendChild(newA);
    }

    setTimeout(() => {
      onEditableLinkClick({
        currentTarget: newA,
        preventDefault: () => {},
        stopPropagation: () => {}
      });
    }, 50);
  }

  // --------------------------------------------------------------------------
  // 8A. BOVENSTE KSA-BALK BEHEREN (TOPBAR)
  // --------------------------------------------------------------------------
  function updateTopbarToggleBtnText() {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    const isHidden = topbar ? topbar.classList.contains('ksa-section-hidden') : false;

    const toggleBtn = document.getElementById('ksaTopbarToggleHideBtn');
    if (toggleBtn) {
      toggleBtn.innerHTML = isHidden ? '👁️ Topbalk Tonen' : '🙈 Topbalk Verbergen';
      toggleBtn.title = isHidden ? 'Toon de bovenste balk weer op de website' : 'Verberg de bovenste balk volledig op de website';
      toggleBtn.className = isHidden ? 'ksa-topbar-edit-pill ksa-topbar-pill-success' : 'ksa-topbar-edit-pill ksa-topbar-pill-danger';
    }

    const badge = document.getElementById('ksaTopbarHiddenBadge');
    if (badge) {
      badge.style.display = isHidden ? 'inline-block' : 'none';
    }
  }

  function updateTopbarButtonState() {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    const isHidden = topbar ? topbar.classList.contains('ksa-section-hidden') : false;
    const btn = document.getElementById('ksaBtnEditTopbar');
    if (btn) {
      if (isHidden) {
        btn.innerHTML = '📢 Topbalk: UIT (Verborgen)';
        btn.title = 'De bovenste blauwe KSA-balk staat momenteel UIT. Klik om aan te passen of AAN te zetten.';
        btn.style.background = '#fee2e2';
        btn.style.color = '#991b1b';
        btn.style.borderColor = '#fca5a5';
      } else {
        btn.innerHTML = '📢 Topbalk: AAN (Zichtbaar)';
        btn.title = 'De bovenste blauwe KSA-balk staat momenteel AAN. Klik om aan te passen of UIT te zetten.';
        btn.style.background = '#dcfce7';
        btn.style.color = '#166534';
        btn.style.borderColor = '#86efac';
      }
    }
  }

  function setTopbarSectionHidden(hidden) {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    if (topbar) {
      topbar.classList.toggle('ksa-section-hidden', !!hidden);
      if (!isEditMode && hidden) {
        topbar.style.display = 'none';
      } else {
        topbar.style.display = '';
      }
    }
    updateTopbarToggleBtnText();
    updateTopbarButtonState();
  }

  function toggleTopbarVisibility() {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    const isHidden = topbar ? topbar.classList.contains('ksa-section-hidden') : false;
    setTopbarSectionHidden(!isHidden);
  }

  function injectTopbarEditTools() {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    if (!topbar) return;
    const container = topbar.querySelector('.container') || topbar;

    if (!container.querySelector('#ksaTopbarEditBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ksaTopbarEditBtn';
      btn.className = 'ksa-topbar-edit-pill';
      btn.innerHTML = '✏️ Topbalk';
      btn.title = 'Pas badge, tekst of links in de bovenste KSA-balk aan';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openTopbarModal();
      };
      container.appendChild(btn);
    }

    if (!container.querySelector('#ksaTopbarToggleHideBtn')) {
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'ksaTopbarToggleHideBtn';
      toggleBtn.className = 'ksa-topbar-edit-pill';
      toggleBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleTopbarVisibility();
      };
      container.appendChild(toggleBtn);
    }

    if (!container.querySelector('#ksaTopbarHiddenBadge')) {
      const badge = document.createElement('span');
      badge.id = 'ksaTopbarHiddenBadge';
      badge.className = 'topbar-hidden-badge';
      badge.textContent = 'Verborgen';
      badge.style.display = 'none';
      container.appendChild(badge);
    }

    updateTopbarToggleBtnText();
    updateTopbarButtonState();
  }

  function openTopbarModal() {
    const topbar = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    const isTopbarHidden = topbar ? topbar.classList.contains('ksa-section-hidden') : false;

    const badgeEl = document.getElementById('topbarBadge') || document.querySelector('.ksa-topbar-badge');
    const descEl = document.getElementById('topbarDesc') || document.querySelector('.ksa-topbar-desc');
    const linkLeftEl = document.getElementById('topbarLinkLeft') || document.querySelector('.ksa-topbar-left a, .ksa-topbar a');
    const promoEl = document.getElementById('topbarPromo') || document.querySelector('.ksa-topbar-promo');
    const linkRightEl = document.getElementById('topbarLinkRight') || document.querySelector('.ksa-topbar-right a');

    const curBadge = badgeEl ? badgeEl.innerText.trim() : 'KSA LIMBURG';
    const curDesc = descEl ? descEl.innerHTML.trim() : 'Aangesloten bij <strong>KSA Nationaal</strong> &bull;';
    const curLeftText = linkLeftEl ? linkLeftEl.innerText.trim() : 'www.ksa.be';
    const curLeftHref = linkLeftEl ? (linkLeftEl.getAttribute('href') || 'https://www.ksa.be') : 'https://www.ksa.be';

    const curPromo = promoEl ? promoEl.innerHTML.trim() : '🎃 <strong>HalloKien 2026:</strong>';
    const curRightText = linkRightEl ? linkRightEl.innerText.trim() : 'Bestel tickets via Ravotshop →';
    const curRightHref = linkRightEl ? (linkRightEl.getAttribute('href') || 'https://ravotshop.ksa.be/hallokien') : 'https://ravotshop.ksa.be/hallokien';
    const isPromoHidden = linkRightEl ? (linkRightEl.classList.contains('ksa-link-hidden') || linkRightEl.style.display === 'none') : false;

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');

    modal.innerHTML = `
      <h3>📢 Bovenste KSA-Balk Aanpassen</h3>
      <p style="font-size:13px; color:#64748b; margin-top:-6px; margin-bottom:14px;">
        Pas hier de teksten en links aan van de donkerblauwe balk helemaal bovenaan de website. Je kunt ook direct op de teksten in de balk klikken om ze live te bewerken!
      </p>

      <div style="background:#eff6ff; border:1px solid #bfdbfe; padding:12px 14px; border-radius:8px; margin-bottom:14px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:13.5px; font-weight:700; color:#1e3a8a;">
          <input type="checkbox" id="tbHideEntireTopbarInput" ${isTopbarHidden ? 'checked' : ''}>
          <span>🙈 Verberg de volledige topbalk op de website</span>
        </label>
        <div style="font-size:12px; color:#64748b; margin-top:4px; margin-left:24px;">
          Wanneer aangevinkt, is deze hele bovenste donkerblauwe balk onzichtbaar voor gewone bezoekers van de website.
        </div>
      </div>

      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:12px;">
        <h4 style="margin:0 0 8px 0; font-size:14px; color:#0055a5;">Linkerkant (KSA Nationaal)</h4>
        <label>Badge tekst (rood label):</label>
        <input type="text" id="tbBadgeInput" value="${curBadge.replace(/"/g, '&quot;')}">
        <label style="margin-top:8px;">Ondertitel / beschrijving:</label>
        <input type="text" id="tbDescInput" value="${curDesc.replace(/"/g, '&quot;')}">
        <div style="display:flex; gap:10px; margin-top:8px;">
          <div style="flex:1;">
            <label>Link tekst:</label>
            <input type="text" id="tbLeftTextInput" value="${curLeftText.replace(/"/g, '&quot;')}">
          </div>
          <div style="flex:1;">
            <label>Link adres (URL):</label>
            <input type="text" id="tbLeftHrefInput" value="${curLeftHref.replace(/"/g, '&quot;')}">
          </div>
        </div>
      </div>

      <div style="background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:14px;">
        <h4 style="margin:0 0 8px 0; font-size:14px; color:#e3001b;">Rechterkant (Promo / Evenement)</h4>
        <label>Promo tekst:</label>
        <input type="text" id="tbPromoInput" value="${curPromo.replace(/"/g, '&quot;')}">
        <div style="display:flex; gap:10px; margin-top:8px;">
          <div style="flex:1;">
            <label>Actieknop tekst:</label>
            <input type="text" id="tbRightTextInput" value="${curRightText.replace(/"/g, '&quot;')}">
          </div>
          <div style="flex:1;">
            <label>Actieknop adres (URL):</label>
            <input type="text" id="tbRightHrefInput" value="${curRightHref.replace(/"/g, '&quot;')}">
          </div>
        </div>
        <label style="display:flex; align-items:center; gap:8px; margin-top:10px; cursor:pointer; font-size:13px;">
          <input type="checkbox" id="tbHidePromoInput" ${isPromoHidden ? 'checked' : ''}>
          <span>🙈 Verberg de rechter promo / actielink</span>
        </label>
      </div>

      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="tbCancelBtn">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="tbApplyBtn">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    document.getElementById('tbCancelBtn').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('tbApplyBtn').onclick = () => {
      const hideEntireTopbar = document.getElementById('tbHideEntireTopbarInput').checked;
      setTopbarSectionHidden(hideEntireTopbar);

      const newBadge = document.getElementById('tbBadgeInput').value.trim();
      const newDesc = document.getElementById('tbDescInput').value.trim();
      const newLeftText = document.getElementById('tbLeftTextInput').value.trim();
      const newLeftHref = document.getElementById('tbLeftHrefInput').value.trim();

      const newPromo = document.getElementById('tbPromoInput').value.trim();
      const newRightText = document.getElementById('tbRightTextInput').value.trim();
      const newRightHref = document.getElementById('tbRightHrefInput').value.trim();
      const hidePromo = document.getElementById('tbHidePromoInput').checked;

      if (badgeEl && newBadge) badgeEl.innerText = newBadge;
      if (descEl && newDesc) descEl.innerHTML = newDesc;
      if (linkLeftEl) {
        if (newLeftText) linkLeftEl.innerText = newLeftText;
        if (newLeftHref) linkLeftEl.setAttribute('href', newLeftHref);
      }

      if (promoEl && newPromo) promoEl.innerHTML = newPromo;
      if (linkRightEl) {
        if (newRightText) linkRightEl.innerText = newRightText;
        if (newRightHref) linkRightEl.setAttribute('href', newRightHref);
        linkRightEl.classList.toggle('ksa-link-hidden', hidePromo);
        linkRightEl.style.display = (!isEditMode && hidePromo) ? 'none' : '';
      }
      if (promoEl) {
        promoEl.classList.toggle('ksa-link-hidden', hidePromo);
        promoEl.style.display = (!isEditMode && hidePromo) ? 'none' : '';
      }

      backdrop.style.display = 'none';
    };
  }

  // --------------------------------------------------------------------------
  // 8B. LEEFTIJDSGROEPEN KNOPPEN BEHEREN (TEKST WIJZIGEN & GROEP VERBERGEN)
  // --------------------------------------------------------------------------
  function injectGroupPillsControlBar() {
    const pillsWrap = document.querySelector('.quiz-pills') || document.querySelector('.scrollable-bar-wrap');
    if (!pillsWrap || document.getElementById('ksaGroupPillsControlBar')) return;

    const bar = document.createElement('div');
    bar.id = 'ksaGroupPillsControlBar';
    bar.className = 'ksa-banner-edit-bar';
    bar.innerHTML = `
      <div>🎒 <strong>Leeftijdsgroepen Knoppen:</strong> Pas de tekst op de knoppen aan of verberg een groep als die dit jaar niet bestaat.</div>
      <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
        <button type="button" class="ksa-mini-btn" id="ksaBtnEditGroupPills">✏️ Knopteksten &amp; Groepen Aan/Uit</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" id="ksaBtnToggleActiveGroup">🙈 Verberg / Toon geselecteerde groep</button>
      </div>
    `;

    pillsWrap.parentElement.insertBefore(bar, pillsWrap);

    document.getElementById('ksaBtnEditGroupPills').onclick = () => {
      const card = document.getElementById('groupResultCard');
      const activeKey = (card && card.getAttribute('data-active-group')) || 'kabouters';
      openGroupPillsModal(activeKey);
    };

    document.getElementById('ksaBtnToggleActiveGroup').onclick = () => {
      if (!window.groupData) return;
      const card = document.getElementById('groupResultCard');
      const activeMob = document.querySelector('.group-select-btn.active');
      const activeKey = (card && card.getAttribute('data-active-group')) || (activeMob && activeMob.getAttribute('data-group')) || 'kabouters';
      const g = window.groupData[activeKey];
      if (!g) return;
      g.hidden = !g.hidden;
      applyGroupButtonsState();
    };
  }

  function openGroupPillsModal(focusGroupKey) {
    if (!window.groupData) return;
    applyGroupButtonsState();

    const groupKeys = ['kabouters', 'sloebers', 'roodkapjes', 'jim', 'sim', 'kim'];
    const isMob = window.location.pathname.includes('mobile.html');

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');

    modal.innerHTML = `
      <h3>🎒 Leeftijdsgroepen Knoppen Beheren</h3>
      <p>Pas hieronder de tekst op de groepsknoppen aan, of vink een groep <strong>uit</strong> als deze leeftijdsgroep dit werkjaar niet beschikbaar is:</p>
      <div style="display:flex; flex-direction:column; gap:10px; max-height:340px; overflow-y:auto; padding-right:4px;">
        ${groupKeys.map(k => {
          const g = window.groupData[k] || {};
          const lbl = isMob ? (g.mobileButtonLabel || g.name || k) : (g.buttonLabel || g.name || k);
          const isAvailable = !g.hidden;
          const isFocus = k === focusGroupKey;
          return `
            <div style="background:${isFocus ? '#eff6ff' : '#f8fafc'}; border:1.5px solid ${isFocus ? '#3b82f6' : '#cbd5e1'}; border-radius:10px; padding:10px 12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                <strong style="font-size:0.85rem; color:#0f172a;">${(g.name || k).toUpperCase()}</strong>
                <label style="display:inline-flex; align-items:center; gap:6px; margin:0; cursor:pointer; font-size:0.8rem; color:${isAvailable ? '#166534' : '#dc2626'};">
                  <input type="checkbox" class="ksa-grp-avail-cb" data-group="${k}" ${isAvailable ? 'checked' : ''}>
                  <span>Beschikbaar dit jaar (toon knop)</span>
                </label>
              </div>
              <input type="text" class="ksa-grp-lbl-input" data-group="${k}" value="${lbl.replace(/"/g, '&quot;')}" placeholder="Tekst op de knop">
            </div>
          `;
        }).join('')}
      </div>
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaGrpModalCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaGrpModalSave">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    document.getElementById('ksaGrpModalCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaGrpModalSave').onclick = () => {
      modal.querySelectorAll('.ksa-grp-lbl-input').forEach(inp => {
        const k = inp.getAttribute('data-group');
        const val = inp.value.trim();
        if (window.groupData[k] && val) {
          if (isMob) window.groupData[k].mobileButtonLabel = val;
          else window.groupData[k].buttonLabel = val;
        }
      });
      modal.querySelectorAll('.ksa-grp-avail-cb').forEach(cb => {
        const k = cb.getAttribute('data-group');
        if (window.groupData[k]) {
          window.groupData[k].hidden = !cb.checked;
        }
      });
      applyGroupButtonsState();
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
    updateBannerButtonState();
  }

  function updateBannerButtonState() {
    const desktopWrap = document.querySelector('.countdown-banner-wrap');
    const mobileCard = document.querySelector('.mobile-event-card');
    const target = desktopWrap || mobileCard;
    if (!target) return;

    const isHidden = target.style.display === 'none';
    const btn = document.getElementById('ksaBtnToggleBanner');
    if (btn) {
      if (isHidden) {
        btn.innerHTML = '🎯 Banner: UIT (Verborgen)';
        btn.title = 'De aftelbanner staat momenteel UIT. Klik om hem weer AAN te zetten.';
        btn.style.background = '#fee2e2';
        btn.style.color = '#991b1b';
        btn.style.borderColor = '#fca5a5';
      } else {
        btn.innerHTML = '🎯 Banner: AAN (Zichtbaar)';
        btn.title = 'De aftelbanner staat momenteel AAN. Klik om hem UIT te zetten.';
        btn.style.background = '#dcfce7';
        btn.style.color = '#166534';
        btn.style.borderColor = '#86efac';
      }
    }

    const inlineBtn = document.getElementById('ksaHideBannerInline');
    if (inlineBtn) {
      if (isHidden) {
        inlineBtn.innerHTML = '👁️ Banner AAN zetten';
        inlineBtn.className = 'ksa-mini-btn';
        inlineBtn.style.background = '#16a34a';
        inlineBtn.style.color = '#fff';
      } else {
        inlineBtn.innerHTML = '🙈 Banner UIT zetten';
        inlineBtn.className = 'ksa-mini-btn ksa-mini-btn-danger';
        inlineBtn.style.background = '';
        inlineBtn.style.color = '';
      }
    }
  }

  function toggleBannerVisibility() {
    const desktopWrap = document.querySelector('.countdown-banner-wrap');
    const mobileCard = document.querySelector('.mobile-event-card');
    const target = desktopWrap || mobileCard;
    if (!target) return;

    const isHidden = target.style.display === 'none';
    if (desktopWrap) desktopWrap.style.display = isHidden ? '' : 'none';
    if (mobileCard) mobileCard.style.display = isHidden ? '' : 'none';

    updateBannerButtonState();
  }

  // --------------------------------------------------------------------------
  // 10. KAARTJES TOEVOEGEN (+), OP 'VOORBIJ' ZETTEN (🏁) OF VERWIJDEREN (🗑️)
  // --------------------------------------------------------------------------
  function openCalendarStickerModal(calItem) {
    if (!calItem) return;
    const card = calItem.querySelector('.cal-card');
    if (!card) return;
    const existingSticker = card.querySelector('.cal-sticker');
    let curVal = '';
    if (existingSticker) {
      const img = existingSticker.querySelector('img');
      if (img) {
        curVal = existingSticker.getAttribute('data-img-src') || img.getAttribute('src') || '';
      } else {
        curVal = existingSticker.textContent.trim();
      }
    }

    const presets = [
      { emoji: '', label: 'Geen icoon' },
      { emoji: 'img:assets/icons/ksa-logo-square.png', iconHtml: '<img src="assets/icons/ksa-logo-square.png" alt="KSA Logo" style="width:26px; height:26px; object-fit:contain; border-radius:4px; vertical-align:middle;">', label: 'KSA Logo' },
      { emoji: '🎅', label: 'Kerstman' },
      { emoji: '🎄', label: 'Kerstboom' },
      { emoji: '👑', label: 'Sinterklaas' },
      { emoji: '🎃', label: 'Halloween' },
      { emoji: '🎟️', label: 'Kien / Bingo' },
      { emoji: '🍝', label: 'Spaghetti' },
      { emoji: '🎉', label: 'Feest / Fuif' },
      { emoji: '🏕️', label: 'Kamp / Tent' },
      { emoji: '🔥', label: 'Kampvuur' },
      { emoji: '🌲', label: 'Bosspel' },
      { emoji: '🏊', label: 'Zwemmen' },
      { emoji: '🐣', label: 'Pasen' },
      { emoji: '❤️', label: 'Vriendinnen' },
      { emoji: '🏆', label: 'Toernooi' },
      { emoji: '⭐', label: 'Speciaal' }
    ];

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>🎨 Kalender Icoon / Sticker aanpassen</h3>
      <p>Kies met 1 klik een icoontje voor dit kalendervakje (of kies <strong>Geen icoon</strong> om bv. de Kerstman te verwijderen):</p>
      <div class="ksa-sticker-grid">
        ${presets.map(p => `
          <button type="button" class="ksa-sticker-choice" data-emoji="${p.emoji}">
            <div style="display:flex; align-items:center; justify-content:center; min-height:28px;">${p.iconHtml || p.emoji || '🚫'}</div>
            <span>${p.label}</span>
          </button>
        `).join('')}
      </div>
      <label>Of typ zelf een emoji / icoon (maak leeg om te verwijderen):</label>
      <input type="text" id="ksaCustomStickerInput" value="${curVal}" placeholder="Bv. 🎅 of laat leeg">
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaStickerCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaStickerApply">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const applyEmoji = (val) => {
      const clean = (val || '').trim();
      card.querySelectorAll('.cal-sticker').forEach(s => s.remove());
      if (clean) {
        const span = document.createElement('span');
        span.className = 'cal-sticker';
        if (clean.startsWith('img:') || clean.includes('ksa-logo-square.png') || clean.includes('assets/icons/')) {
          const imgSrc = clean.startsWith('img:') ? clean.substring(4) : (clean.startsWith('<img') ? (clean.match(/src="([^"]+)"/) || [])[1] : clean);
          span.innerHTML = `<img src="${imgSrc || 'assets/icons/ksa-logo-square.png'}" alt="KSA Logo">`;
          span.setAttribute('data-img-src', imgSrc || 'assets/icons/ksa-logo-square.png');
        } else if (clean.startsWith('<img')) {
          span.innerHTML = clean;
        } else {
          span.textContent = clean;
        }
        span.title = '🎨 Klik om dit icoon te wijzigen of te verwijderen';
        span.onclick = (e) => {
          if (!isEditMode) return;
          e.preventDefault();
          e.stopPropagation();
          openCalendarStickerModal(calItem);
        };
        card.insertBefore(span, card.firstChild);
      } else if (isEditMode) {
        ensureCalStickerSlot(calItem);
      }
      backdrop.style.display = 'none';
    };

    modal.querySelectorAll('.ksa-sticker-choice').forEach(btn => {
      btn.onclick = () => applyEmoji(btn.getAttribute('data-emoji'));
    });

    document.getElementById('ksaStickerCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaStickerApply').onclick = () => {
      applyEmoji(document.getElementById('ksaCustomStickerInput').value);
    };
  }

  function openShortcutIconModal(bubble) {
    if (!bubble) return;
    const curVal = bubble.textContent.trim();
    const presets = [
      { emoji: '📅', label: 'Kalender' },
      { emoji: '🎒', label: 'Groepen' },
      { emoji: '👑', label: 'Leiding' },
      { emoji: '📝', label: 'Info' },
      { emoji: '🔥', label: 'Vuur' },
      { emoji: '🏕️', label: 'Kamp' },
      { emoji: '🎈', label: 'Sloeber' },
      { emoji: '🧭', label: 'Kompas' },
      { emoji: '⚡', label: 'Sim' },
      { emoji: '📸', label: 'Foto' },
      { emoji: '🍝', label: 'Eten' },
      { emoji: '💌', label: 'Contact' },
      { emoji: '⭐', label: 'Ster' },
      { emoji: '🎉', label: 'Feest' },
      { emoji: '💙', label: 'KSA Blauw' },
      { emoji: '❤️', label: 'KSA Rood' }
    ];

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>⚡ Snelle Toegang Icoon Aanpassen</h3>
      <p>Kies een nieuw icoontje of typ zelf een emoji:</p>
      <div class="ksa-sticker-grid">
        ${presets.map(p => `
          <button type="button" class="ksa-sticker-choice" data-emoji="${p.emoji}">
            <div>${p.emoji}</div>
            <span>${p.label}</span>
          </button>
        `).join('')}
      </div>
      <label>Of typ een eigen emoji / icoon:</label>
      <input type="text" id="ksaCustomShortcutEmoji" value="${curVal}" placeholder="Bv. 🚀 of 🎯" style="font-size:1.6rem; text-align:center;">
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaShortcutCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaShortcutApply">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const applyEmoji = (val) => {
      const clean = (val || '').trim();
      if (clean) {
        bubble.textContent = clean;
      }
      backdrop.style.display = 'none';
    };

    modal.querySelectorAll('.ksa-sticker-choice').forEach(btn => {
      btn.onclick = () => applyEmoji(btn.getAttribute('data-emoji'));
    });

    document.getElementById('ksaShortcutCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaShortcutApply').onclick = () => {
      applyEmoji(document.getElementById('ksaCustomShortcutEmoji').value);
    };
  }

  function updateShortcutsVisibility() {
    const grid = document.querySelector('.shortcuts-grid');
    if (!grid) return;
    const head = document.getElementById('shortcutsSectionHead') || (grid.previousElementSibling && grid.previousElementSibling.classList.contains('app-section-head') ? grid.previousElementSibling : null);

    const isHidden = (head && head.classList.contains('ksa-section-hidden')) || grid.classList.contains('ksa-section-hidden');
    const tileCount = grid.querySelectorAll('.shortcut-tile:not(.shortcut-tile-add)').length;

    if (!isEditMode) {
      if (isHidden || tileCount === 0) {
        grid.style.display = 'none';
        if (head) head.style.display = 'none';
      } else {
        grid.style.display = '';
        if (head) head.style.display = '';
      }
    } else {
      // In edit mode: altijd zichtbaar zodat leiding de sectie kan bewerken en desgewenst weer tonen
      grid.style.display = '';
      if (head) head.style.display = '';
    }

    updateShortcutsToggleBtnText();
  }

  function setShortcutsSectionHidden(hidden) {
    const head = document.getElementById('shortcutsSectionHead');
    const grid = document.querySelector('.shortcuts-grid');
    if (head) head.classList.toggle('ksa-section-hidden', !!hidden);
    if (grid) grid.classList.toggle('ksa-section-hidden', !!hidden);
    updateShortcutsVisibility();
  }

  function toggleShortcutsSectionVisibility() {
    const head = document.getElementById('shortcutsSectionHead');
    const grid = document.querySelector('.shortcuts-grid');
    const isHidden = (head && head.classList.contains('ksa-section-hidden')) || (grid && grid.classList.contains('ksa-section-hidden'));
    setShortcutsSectionHidden(!isHidden);
  }

  function updateShortcutsToggleBtnText() {
    const head = document.getElementById('shortcutsSectionHead');
    const grid = document.querySelector('.shortcuts-grid');
    const isHidden = (head && head.classList.contains('ksa-section-hidden')) || (grid && grid.classList.contains('ksa-section-hidden'));

    const headBtn = document.getElementById('ksaToggleShortcutsHeadBtn');
    if (headBtn) {
      headBtn.innerHTML = isHidden ? '👁️ Sectie Tonen' : '🙈 Sectie Verbergen';
      headBtn.title = isHidden ? 'Toon Snelle Toegang weer op de mobiele site' : 'Verberg Snelle Toegang volledig van de mobiele site';
      headBtn.className = isHidden ? 'ksa-mini-btn ksa-mini-btn-success' : 'ksa-mini-btn ksa-mini-btn-danger';
    }

    const dockBtn = document.getElementById('ksaBtnToggleShortcuts');
    if (dockBtn) {
      dockBtn.innerHTML = isHidden ? '👁️ Snelle Toegang Tonen' : '🙈 Snelle Toegang Verbergen';
      dockBtn.title = isHidden ? 'Toon Snelle Toegang weer op de mobiele site' : 'Verberg Snelle Toegang volledig van de mobiele site';
    }

    const badge = document.getElementById('ksaShortcutsHiddenBadge');
    if (badge) {
      badge.style.display = isHidden ? 'inline-block' : 'none';
    }
  }

  function injectShortcutTools() {
    const grid = document.querySelector('.shortcuts-grid');
    if (!grid) return;

    // 0. Knop op de sectietitel zelf injecteren om met 1 klik te verbergen/tonen
    const head = document.getElementById('shortcutsSectionHead');
    if (head && !document.getElementById('ksaToggleShortcutsHeadBtn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'ksaToggleShortcutsHeadBtn';
      btn.className = 'ksa-mini-btn';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleShortcutsSectionVisibility();
      };
      head.appendChild(btn);

      if (!document.getElementById('ksaShortcutsHiddenBadge')) {
        const titleEl = head.querySelector('.app-section-title');
        if (titleEl) {
          const badge = document.createElement('span');
          badge.id = 'ksaShortcutsHiddenBadge';
          badge.className = 'shortcuts-hidden-badge';
          badge.textContent = 'Verborgen';
          badge.style.display = 'none';
          titleEl.appendChild(badge);
        }
      }
    }

    // 1. Voeg op elke bestaande tegel de bewerk-knoppen toe (als nog niet aanwezig)
    grid.querySelectorAll('.shortcut-tile:not(.shortcut-tile-add)').forEach(tile => {
      if (tile.querySelector('.ksa-shortcut-tools')) return;

      const tools = document.createElement('div');
      tools.className = 'ksa-shortcut-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-shortcut-btn" data-act="settings" title="Doel, link of kleur aanpassen">⚙️</button>
        <button type="button" class="ksa-shortcut-btn ksa-shortcut-btn-del" data-act="del" title="Verwijder deze knop">🗑️</button>
      `;

      tools.querySelector('[data-act="settings"]').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        openShortcutSettingsModal(tile);
      };

      tools.querySelector('[data-act="del"]').onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const titleEl = tile.querySelector('.shortcut-title');
        const name = titleEl ? titleEl.textContent.trim() : 'deze knop';
        if (confirm(`Weet je zeker dat je de knop '${name}' wilt verwijderen?`)) {
          tile.remove();
          updateShortcutsVisibility();
        }
      };

      tile.appendChild(tools);
    });

    // 2. Voeg de "+ Knop Toevoegen" tegel toe als hij er nog niet is
    if (!grid.querySelector('.shortcut-tile-add')) {
      const addTile = document.createElement('div');
      addTile.className = 'shortcut-tile shortcut-tile-add';
      addTile.title = 'Voeg een extra snelle toegang knop toe';
      addTile.innerHTML = `
        <div class="shortcut-icon-bubble" style="background:#f1f5f9; color:#0284c7; font-size:1.4rem;">➕</div>
        <span class="shortcut-title" style="color:var(--ksa-blue, #002B49); font-weight:800;">Knop Toevoegen</span>
        <span class="shortcut-desc">Extra tegel in raster</span>
      `;
      addTile.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        addNewShortcutTile();
      };
      grid.appendChild(addTile);
    }

    updateShortcutsVisibility();
  }

  function addNewShortcutTile() {
    const grid = document.querySelector('.shortcuts-grid');
    if (!grid) return;

    const addBtn = grid.querySelector('.shortcut-tile-add');
    const newTile = document.createElement('div');
    newTile.className = 'shortcut-tile';
    newTile.setAttribute('data-switch-tab', 'agenda');
    newTile.innerHTML = `
      <div class="shortcut-icon-bubble" style="background:var(--ksa-blue-soft); color:var(--ksa-blue);">⭐</div>
      <span class="shortcut-title">Nieuwe Knop</span>
      <span class="shortcut-desc">Klik om te openen</span>
    `;

    if (addBtn) {
      grid.insertBefore(newTile, addBtn);
    } else {
      grid.appendChild(newTile);
    }

    enableEditMode();
    openShortcutSettingsModal(newTile);
  }

  function openShortcutSettingsModal(tile) {
    if (!tile) return;
    const titleEl = tile.querySelector('.shortcut-title');
    const descEl = tile.querySelector('.shortcut-desc');
    const bubble = tile.querySelector('.shortcut-icon-bubble');

    const curTitle = titleEl ? titleEl.textContent.trim() : '';
    const curDesc = descEl ? descEl.textContent.trim() : '';
    const curEmoji = bubble ? bubble.textContent.trim() : '⭐';
    const curSwitchTab = tile.getAttribute('data-switch-tab') || '';
    const curHref = tile.getAttribute('data-href') || '';
    const curTargetMode = curHref ? 'custom' : (curSwitchTab || 'agenda');

    const colorPresets = [
      { id: 'blue', label: 'Blauw', bg: 'var(--ksa-blue-soft)', color: 'var(--ksa-blue)', swatch: '#e0f2fe' },
      { id: 'yellow', label: 'Geel/Oranje', bg: '#fef7e6', color: '#d97706', swatch: '#fef7e6' },
      { id: 'red', label: 'Rood', bg: '#fde8e9', color: '#e3001b', swatch: '#fde8e9' },
      { id: 'green', label: 'Groen', bg: '#ecfdf5', color: '#059669', swatch: '#ecfdf5' },
      { id: 'purple', label: 'Paars', bg: '#f3e8ff', color: '#7c3aed', swatch: '#f3e8ff' },
      { id: 'gray', label: 'Grijs', bg: '#f1f5f9', color: '#475569', swatch: '#f1f5f9' }
    ];

    const iconPresets = [
      { emoji: '📅', label: 'Kalender' },
      { emoji: '🎒', label: 'Groepen' },
      { emoji: '👑', label: 'Leiding' },
      { emoji: '📝', label: 'Info' },
      { emoji: '🔥', label: 'Vuur' },
      { emoji: '🏕️', label: 'Kamp' },
      { emoji: '🎈', label: 'Sloeber' },
      { emoji: '🧭', label: 'Kompas' },
      { emoji: '⚡', label: 'Sim' },
      { emoji: '📸', label: 'Foto' },
      { emoji: '🍝', label: 'Eten' },
      { emoji: '💌', label: 'Contact' },
      { emoji: '⭐', label: 'Ster' },
      { emoji: '🎉', label: 'Feest' },
      { emoji: '💙', label: 'KSA Blauw' },
      { emoji: '❤️', label: 'KSA Rood' },
      { emoji: '🏆', label: 'Wedstrijd' },
      { emoji: 'ℹ️', label: 'Informatie' },
      { emoji: '📱', label: 'App' },
      { emoji: '🎟️', label: 'Tickets' }
    ];

    let selectedBg = bubble ? bubble.style.background : 'var(--ksa-blue-soft)';
    let selectedColor = bubble ? bubble.style.color : 'var(--ksa-blue)';

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>⚡ Snelle Toegang Knop Bewerken</h3>
      
      <label for="ksaShortcutTitleInput">Titel van de knop:</label>
      <input type="text" id="ksaShortcutTitleInput" value="${curTitle.replace(/"/g, '&quot;')}" placeholder="Bv. Officiële Kalender">

      <label for="ksaShortcutDescInput">Korte beschrijving (ondertitel):</label>
      <input type="text" id="ksaShortcutDescInput" value="${curDesc.replace(/"/g, '&quot;')}" placeholder="Bv. Wanneer is het KSA?">

      <label>Icoon (Emoji):</label>
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
        <input type="text" id="ksaShortcutEmojiInput" value="${curEmoji}" style="width:65px; font-size:1.6rem; text-align:center; padding:4px; border-radius:8px; border:1px solid #cbd5e1;">
        <span style="font-size:12px; color:#64748b;">Kies hieronder of typ een eigen emoji</span>
      </div>
      <div class="ksa-sticker-grid" style="max-height:115px; overflow-y:auto; margin-bottom:14px; border:1px solid #e2e8f0; padding:6px; border-radius:8px;">
        ${iconPresets.map(p => `
          <button type="button" class="ksa-sticker-choice" data-emoji="${p.emoji}" style="padding:6px 2px;">
            <div style="font-size:1.3rem;">${p.emoji}</div>
            <span style="font-size:10px;">${p.label}</span>
          </button>
        `).join('')}
      </div>

      <label>Icoon Kleur:</label>
      <div id="ksaColorChoiceRow" style="display:flex; gap:8px; margin-bottom:14px; flex-wrap:wrap;">
        ${colorPresets.map(c => `
          <button type="button" class="ksa-color-pill-btn" data-bg="${c.bg}" data-color="${c.color}" style="background:${c.swatch}; color:${c.color}; border:1px solid #cbd5e1; border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer;">
            ${c.label}
          </button>
        `).join('')}
      </div>

      <label for="ksaShortcutTargetSelect">Waar moet de knop naartoe gaan?</label>
      <select id="ksaShortcutTargetSelect" style="width:100%; padding:10px; border-radius:8px; border:1px solid #cbd5e1; font-size:13.5px; margin-bottom:10px; background:#fff;">
        <option value="agenda" ${curTargetMode === 'agenda' ? 'selected' : ''}>📅 Kalender / Agenda tabblad</option>
        <option value="groepen" ${curTargetMode === 'groepen' ? 'selected' : ''}>🎒 5 Groepen tabblad</option>
        <option value="leiding" ${curTargetMode === 'leiding' ? 'selected' : ''}>👑 De Leidingploeg tabblad</option>
        <option value="info" ${curTargetMode === 'info' ? 'selected' : ''}>📝 Inschrijven & Info tabblad</option>
        <option value="custom" ${curTargetMode === 'custom' ? 'selected' : ''}>🌐 Eigen weblink / URL (bv. inschrijving of externe pagina)</option>
      </select>

      <div id="ksaShortcutUrlWrap" style="display:${curTargetMode === 'custom' ? 'block' : 'none'}; margin-bottom:14px;">
        <label for="ksaShortcutUrlInput">Webadres (URL):</label>
        <input type="text" id="ksaShortcutUrlInput" value="${curHref.replace(/"/g, '&quot;')}" placeholder="Bv. https://instagram.com/ksa_zonhoven of https://...">
      </div>

      <div class="ksa-editor-modal-actions" style="justify-content:space-between; margin-top:16px;">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaShortcutModalDelete" style="background:#fee2e2; color:#b91c1c; border-color:#fca5a5;">🗑️ Verwijder knop</button>
        <div style="display:flex; gap:8px;">
          <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaShortcutModalCancel">Annuleren</button>
          <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaShortcutModalSave">✔️ Opslaan</button>
        </div>
      </div>
    `;
    backdrop.style.display = 'flex';

    // Emoji preset click handlers
    modal.querySelectorAll('.ksa-sticker-choice').forEach(btn => {
      btn.onclick = () => {
        document.getElementById('ksaShortcutEmojiInput').value = btn.getAttribute('data-emoji');
      };
    });

    // Color choices click handlers
    modal.querySelectorAll('.ksa-color-pill-btn').forEach(btn => {
      btn.onclick = () => {
        selectedBg = btn.getAttribute('data-bg');
        selectedColor = btn.getAttribute('data-color');
        modal.querySelectorAll('.ksa-color-pill-btn').forEach(b => b.style.outline = 'none');
        btn.style.outline = '2px solid #2563eb';
      };
    });

    // Target select dropdown change
    const targetSelect = document.getElementById('ksaShortcutTargetSelect');
    const urlWrap = document.getElementById('ksaShortcutUrlWrap');
    targetSelect.onchange = () => {
      urlWrap.style.display = targetSelect.value === 'custom' ? 'block' : 'none';
    };

    // Delete button
    document.getElementById('ksaShortcutModalDelete').onclick = () => {
      if (confirm('Weet je zeker dat je deze knop wilt verwijderen?')) {
        tile.remove();
        updateShortcutsVisibility();
        backdrop.style.display = 'none';
      }
    };

    // Cancel button
    document.getElementById('ksaShortcutModalCancel').onclick = () => {
      backdrop.style.display = 'none';
    };

    // Save button
    document.getElementById('ksaShortcutModalSave').onclick = () => {
      const newTitle = document.getElementById('ksaShortcutTitleInput').value.trim();
      const newDesc = document.getElementById('ksaShortcutDescInput').value.trim();
      const newEmoji = document.getElementById('ksaShortcutEmojiInput').value.trim() || '⭐';
      const newTarget = targetSelect.value;
      const newUrl = document.getElementById('ksaShortcutUrlInput').value.trim();

      if (titleEl) titleEl.textContent = newTitle || 'Knop';
      if (descEl) descEl.textContent = newDesc;
      if (bubble) {
        bubble.textContent = newEmoji;
        if (selectedBg) bubble.style.background = selectedBg;
        if (selectedColor) bubble.style.color = selectedColor;
      }

      if (newTarget === 'custom') {
        tile.removeAttribute('data-switch-tab');
        tile.setAttribute('data-href', newUrl || '#');
      } else {
        tile.removeAttribute('data-href');
        tile.setAttribute('data-switch-tab', newTarget);
      }

      backdrop.style.display = 'none';
      enableEditMode();
      updateShortcutsVisibility();
    };
  }

  function ensureCalStickerSlot(item) {
    if (!item) return;
    const card = item.querySelector('.cal-card');
    if (!card) return;
    let sticker = card.querySelector('.cal-sticker');
    if (!sticker) {
      sticker = document.createElement('span');
      sticker.className = 'cal-sticker ksa-sticker-empty';
      card.insertBefore(sticker, card.firstChild);
    }
    const hasIcon = sticker.textContent.trim().length > 0 || sticker.querySelector('img') !== null;
    sticker.classList.toggle('ksa-sticker-empty', !hasIcon);
    sticker.removeAttribute('contenteditable');
    sticker.title = hasIcon
      ? '🎨 Klik om dit icoon te wijzigen of te verwijderen'
      : '🎨 Klik om een icoon (bv. 🎅, 👑, 🎃) toe te voegen aan deze datum';
    sticker.onclick = (e) => {
      if (!isEditMode) return;
      e.preventDefault();
      e.stopPropagation();
      openCalendarStickerModal(item);
    };
  }

  function openPassportBadgeModal(pCard) {
    if (!pCard) return;
    const badge = pCard.querySelector('.paspoort-card-badge');
    const curVal = badge ? badge.textContent.trim() : '';

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    modal.innerHTML = `
      <h3>✏️ Paspoort Tekst / Naam aanpassen</h3>
      <p>Typ hier de naam en groep voor dit paspoortje (bv. <strong>🔍 Kato &amp; Fien • Sim</strong> of <strong>🔍 Lotte &amp; Lina's • Jim</strong>):</p>
      <label for="ksaBadgeInput">Tekst op paspoort:</label>
      <input type="text" id="ksaBadgeInput" value="${curVal.replace(/"/g, '&quot;')}" placeholder="Bv. 🔍 Kato &amp; Fien • Sim">
      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaBadgeCancel">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaBadgeSave">✔️ Toepassen</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const input = document.getElementById('ksaBadgeInput');
    const applyBadge = () => {
      const val = input.value.trim();
      if (val) {
        if (!badge) {
          const newBadge = document.createElement('div');
          newBadge.className = 'paspoort-card-badge';
          pCard.appendChild(newBadge);
        }
        const targetBadge = pCard.querySelector('.paspoort-card-badge');
        if (targetBadge) {
          targetBadge.textContent = val.startsWith('🔍') ? val : `🔍 ${val}`;
          pCard.title = `Bekijk paspoort van ${val.replace(/^[🔍\s]+/, '')}`;
        }
      }
      backdrop.style.display = 'none';
    };

    document.getElementById('ksaBadgeSave').onclick = applyBadge;
    document.getElementById('ksaBadgeCancel').onclick = () => { backdrop.style.display = 'none'; };
    input.onkeydown = (e) => { if (e.key === 'Enter') applyBadge(); };
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  }

  function injectCardEditTools() {
    document.querySelectorAll('.cal-grid .cal-item').forEach(item => {
      ensureCalStickerSlot(item);

      if (item.querySelector('.ksa-card-edit-tools')) return;
      const tools = document.createElement('div');
      tools.className = 'ksa-card-edit-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-mini-btn" data-act="icon" title="Kies of verwijder icoon/sticker (bv. 🎅, 👑)">🎨 Icoon</button>
        <button type="button" class="ksa-mini-btn" data-act="past" title="Zet op Voorbij of Actief">🏁 Voorbij</button>
        <button type="button" class="ksa-mini-btn" data-act="now" title="Markeer als Binnenkort!">🔥 Nu</button>
        <button type="button" class="ksa-mini-btn" data-act="add" title="Voeg extra datum hierna toe">➕</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" data-act="del" title="Verwijder datum">🗑️</button>
      `;
      tools.querySelector('[data-act="icon"]').onclick = () => openCalendarStickerModal(item);
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
        clone.querySelectorAll('.cal-sticker').forEach(s => s.remove());
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
      const badge = pCard.querySelector('.paspoort-card-badge');
      if (badge && !badge.dataset.ksaBadgeClickBound) {
        badge.dataset.ksaBadgeClickBound = '1';
        badge.title = '✏️ Klik om de tekst/naam van dit paspoort aan te passen';
        badge.addEventListener('click', (e) => {
          if (!isEditMode) return;
          e.preventDefault();
          e.stopPropagation();
          openPassportBadgeModal(pCard);
        });
      }

      if (pCard.querySelector('.ksa-card-edit-tools')) return;
      const tools = document.createElement('div');
      tools.className = 'ksa-card-edit-tools';
      tools.innerHTML = `
        <button type="button" class="ksa-mini-btn" data-act="badge" title="Pas de naam / groep van dit paspoort aan">✏️ Tekst</button>
        <button type="button" class="ksa-mini-btn" data-act="view" title="Bekijk dit paspoort groot">🔍 Bekijk</button>
        <button type="button" class="ksa-mini-btn" data-act="add" title="Voeg nieuw paspoort toe">➕ Paspoort</button>
        <button type="button" class="ksa-mini-btn ksa-mini-btn-danger" data-act="del" title="Verwijder dit paspoort">🗑️</button>
      `;
      tools.querySelector('[data-act="badge"]').onclick = (e) => {
        e.stopPropagation();
        openPassportBadgeModal(pCard);
      };
      tools.querySelector('[data-act="view"]').onclick = (e) => {
        e.stopPropagation();
        const img = pCard.querySelector('img');
        const badgeEl = pCard.querySelector('.paspoort-card-badge');
        if (img && typeof window.openPaspoortLightbox === 'function') {
          window.openPaspoortLightbox(img.src, badgeEl ? badgeEl.textContent.trim() : '', img.alt);
        }
      };
      tools.querySelector('[data-act="add"]').onclick = (e) => {
        e.stopPropagation();
        const clone = pCard.cloneNode(true);
        clone.querySelector('.ksa-card-edit-tools')?.remove();

        // Maak het nieuwe gekloonde paspoort volledig onafhankelijk van het origineel:
        const cloneImg = clone.querySelector('img');
        if (cloneImg) {
          cloneImg.removeAttribute('data-orig-src');
          delete cloneImg.dataset.origSrc;
          delete cloneImg.dataset.ksaBound;
          cloneImg.id = 'paspoort_img_' + Date.now();
          cloneImg.title = '📸 Klik om de foto van dit nieuwe paspoort te kiezen';
        }
        const cloneBadge = clone.querySelector('.paspoort-card-badge');
        if (cloneBadge) {
          delete cloneBadge.dataset.ksaBadgeClickBound;
          cloneBadge.textContent = '🔍 Nieuw Paspoort';
        }
        clone.title = 'Bekijk paspoort';

        pCard.after(clone);
        enableEditMode();
      };
      tools.querySelector('[data-act="del"]').onclick = (e) => {
        e.stopPropagation();
        if (document.querySelectorAll('.paspoort-grid .paspoort-card').length <= 1) {
          alert('Je moet minstens één paspoort behouden.');
          return;
        }
        pCard.remove();
      };
      pCard.appendChild(tools);
    });
  }

  // --------------------------------------------------------------------------
  // 11. GITHUB REST API HULPFUNCTIE
  // --------------------------------------------------------------------------
  async function commitFileToGithub(token, owner, repo, branch, filePath, base64Content, commitMessage) {
    const cleanToken = (token || '').replace(/^Bearer\s+/i, '').replace(/[\r\n\t ]+/g, '').trim();
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers = {
      'Authorization': `Bearer ${cleanToken}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };

    let sha = undefined;
    let getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, { headers });
    if (!getRes.ok && getRes.status === 401) {
      headers['Authorization'] = `token ${cleanToken}`;
      getRes = await fetch(`${apiUrl}?ref=${encodeURIComponent(branch)}&t=${Date.now()}`, { headers });
    }
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

    let putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers,
      body: JSON.stringify(body)
    });

    if (!putRes.ok && putRes.status === 401 && headers['Authorization'].startsWith('Bearer ')) {
      headers['Authorization'] = `token ${cleanToken}`;
      putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify(body)
      });
    }

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
    document.querySelectorAll('.cal-sticker').forEach(el => {
      const hasContent = el.textContent.trim().length > 0 || el.querySelector('img') !== null;
      if (!hasContent) el.remove();
      else el.classList.remove('ksa-sticker-empty');
    });

    const isMobilePage = window.location.pathname.includes('mobile.html');
    const pageKey = isMobilePage ? 'mobile' : 'desktop';

    let fullState = (await fetchLatestGithubState()) || {};
    delete fullState.imageMap;

    let ghToken = getEffectiveGithubToken();
    if (!ghToken && fullState._auth && fullState._auth.vault) {
      const sessPass = sessionStorage.getItem('ksa_session_pass');
      if (sessPass) {
        ghToken = await decryptFromVault(fullState._auth.vault, sessPass);
        if (ghToken) {
          sessionStorage.setItem('ksa_github_token', ghToken);
          localStorage.setItem('ksa_github_token', ghToken);
        }
      }
    }

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
          if (imgItem.targetImg) {
            setSmartImageSrc(imgItem.targetImg, repoImgPath);
          } else if (imgItem.selector) {
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

    // Maak een schone kopie van de containers zonder contenteditable attributen (hoofdcontainers worden op desktop beheerd en live gesynchroniseerd naar mobiel)
    const containerSelectors = isMobilePage ? ['.shortcuts-grid'] : ['#ksaTopbar', '.hero-cta-group', '.cal-grid', '.news-grid', '.paspoort-grid'];
    containerSelectors.forEach(sel => {
      const c = document.querySelector(sel);
      if (c) {
        const clone = c.cloneNode(true);
        clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
        clone.querySelectorAll('.ksa-editable-img').forEach(el => el.classList.remove('ksa-editable-img'));
        clone.querySelectorAll('.ksa-card-edit-tools, .ksa-topbar-edit-pill, #ksaTopbarEditBtn, .ksa-btn-add-pill, .ksa-shortcut-tools, .shortcut-tile-add').forEach(el => el.remove());
        pageData.containers[sel] = clone.innerHTML;
      }
    });

    document.querySelectorAll('[contenteditable="true"]').forEach(el => {
      // Sla geen teksten op die al in containers (.cal-grid, .paspoort-grid, .shortcuts-grid, ...) zitten
      if (el.closest('#ksaTopbar, .hero-cta-group, .cal-grid, .news-grid, .paspoort-grid, .cal-list, .shortcuts-grid')) return;
      const sel = getUniqueSelector(el);
      if (sel && !isGroupManagedSelector(sel)) pageData.texts[sel] = el.innerHTML;
    });

    document.querySelectorAll('img.ksa-editable-img').forEach(img => {
      // Sla geen foto's op die al in containers (.paspoort-grid, .cal-grid, ...) zitten om index-conflicten bij toevoegen te vermijden
      if (img.closest('#ksaTopbar, .hero-cta-group, .cal-grid, .news-grid, .paspoort-grid, .cal-list')) return;
      const sel = getUniqueSelector(img);
      if (isGroupManagedSelector(sel)) return;
      const srcVal = img.getAttribute('src') || '';
      // Als er een raw.githubusercontent fallback actief was, bewaar het schone repo-pad
      const cleanSrc = srcVal.replace(/^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\//, '');
      if (sel) pageData.images[sel] = cleanSrc;
    });

    document.querySelectorAll(EDITABLE_LINK_SELECTOR).forEach(a => {
      if (a.closest('#ksaTopbar, .hero-cta-group, .cal-grid, .news-grid, .paspoort-grid, .cal-list')) return;
      const sel = getUniqueSelector(a);
      if (sel) {
        const span = a.querySelector('span') || a;
        pageData.links[sel] = {
          href: a.getAttribute('href'),
          text: span.textContent.trim(),
          hidden: a.classList.contains('ksa-link-hidden') || a.style.display === 'none'
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
            perks: window.groupData[k].perks,
            buttonLabel: window.groupData[k].buttonLabel,
            mobileButtonLabel: window.groupData[k].mobileButtonLabel,
            hidden: !!window.groupData[k].hidden
          };
        }
      });
    }

    const desktopWrap = document.querySelector('.countdown-banner-wrap');
    const mobileCard = document.querySelector('.mobile-event-card');
    const bannerTargetEl = desktopWrap || mobileCard;
    const bannerDateInput = document.getElementById('ksaBannerDateInput');

    const headEl = document.getElementById('shortcutsSectionHead');
    const gridEl = document.querySelector('.shortcuts-grid');
    const shortcutsAreHidden = (headEl && headEl.classList.contains('ksa-section-hidden')) || (gridEl && gridEl.classList.contains('ksa-section-hidden'));

    fullState.shortcutsHidden = !!shortcutsAreHidden;
    if (pageData) pageData.shortcutsHidden = !!shortcutsAreHidden;

    const topbarEl = document.getElementById('ksaTopbar') || document.querySelector('.ksa-topbar');
    const isTopbarHidden = topbarEl ? topbarEl.classList.contains('ksa-section-hidden') : false;
    fullState.topbarHidden = isTopbarHidden;
    if (pageData) pageData.topbarHidden = isTopbarHidden;

    fullState[pageKey] = pageData;
    fullState.banner = {
      hidden: bannerTargetEl ? bannerTargetEl.style.display === 'none' : false,
      targetIso: bannerDateInput && bannerDateInput.value
        ? new Date(bannerDateInput.value).toISOString()
        : (window.ksaCountdownTargetDate ? window.ksaCountdownTargetDate.toISOString() : null)
    };
    if (!fullState._auth || !fullState._auth.pinHash) {
      const activeHash = localStorage.getItem('ksa_active_pin_hash') || KSA_GITHUB_EDITOR_CONFIG.defaultPinHash;
      fullState._auth = {
        pinHash: activeHash,
        updatedAt: new Date().toISOString()
      };
    }

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
    injectShortcutTools();
    saveBtn.disabled = false;
    saveBtn.innerHTML = githubSuccess ? '✅ Live gepubliceerd op GitHub!' : '✅ Lokaal Opgeslagen!';
    setTimeout(() => { saveBtn.innerHTML = origText; }, 3500);
  }

  // --------------------------------------------------------------------------
  // 13. GITHUB INSTELLINGEN & AUTOMATISCHE KLUIS MODAL
  // --------------------------------------------------------------------------
  async function openGithubConfigModal(fromSave = false, isCorruptOrExpired = false) {
    const curToken = getEffectiveGithubToken();
    const curOwner = localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner;
    const curRepo = localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName;
    const curBranch = localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch;

    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');

    let hasVault = false;
    try {
      const s = await fetchLatestGithubState();
      hasVault = !!(s && s._auth && s._auth.vault);
    } catch (e) {}

    let noticeHtml = '';
    if (isCorruptOrExpired) {
      noticeHtml = `
        <div style="background:#fee2e2; border:1px solid #f87171; border-left:4px solid #ef4444; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#991b1b; line-height:1.45;">
          <strong>⚠️ GitHub Koppeling is Vervallen of Niet Ingesteld:</strong><br>
          Het huidige GitHub-toegangstoken ontbreekt, is verlopen of niet geldig. Voer hieronder een geldig GitHub Personal Access Token in. Zodra je dit opslaat, wordt de knop in het menu automatisch verborgen en kan iedereen weer direct opslaan!
        </div>
      `;
    } else if (hasVault) {
      noticeHtml = `
        <div style="background:#f0fdf4; border:1px solid #86efac; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#166534; line-height:1.45;">
          ✅ <strong>Automatische Kluis is Actief!</strong><br>
          Jouw GitHub Token is veilig versleuteld (AES-256-GCM) gekoppeld aan het leiding-wachtwoord. Zolang deze geldig is, is de instellingenknop automatisch verborgen in het bewerkmenu.
        </div>
      `;
    } else {
      noticeHtml = `
        <div style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px; padding:12px 14px; margin-bottom:14px; font-size:13px; color:#1e3a8a; line-height:1.45;">
          🔐 <strong>Eénmalige instelling voor de hele leidingsploeg:</strong><br>
          Vul hieronder éénmalig jouw GitHub Token in. Het systeem versleutelt dit met het leidingwachtwoord en bewaart het in een beveiligde kluis op GitHub. Daarna is deze knop automatisch verborgen en kan <strong>elke leidster direct bewerken en opslaan met enkel het wachtwoord!</strong>
        </div>
      `;
    }

    modal.innerHTML = `
      <h3>⚙️ Automatische GitHub Kluis &amp; Koppeling</h3>
      ${noticeHtml}
      <div id="ksaGhModalMsg" style="display:none; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:10px;"></div>

      <p style="font-size:0.78rem; background:#f8fafc; border:1px solid #e2e8f0; padding:8px 10px; border-radius:8px; margin-bottom:10px;">
        <strong>Hoe maak je een gratis GitHub Token aan (slechts 1x nodig)?</strong><br>
        1. Ga op GitHub naar <em>Settings &rarr; Developer settings &rarr; Personal access tokens &rarr; Tokens (classic) &rarr; Generate new token</em>.<br>
        2. Geef een naam in (bv. <em>KSA Website</em>) en vink <strong>repo</strong> aan.<br>
        3. Plak de gegenereerde token (<code>ghp_...</code>) hieronder:
      </p>

      <label for="ksaGhTokenInput">GitHub Personal Access Token (beheerder):</label>
      <input type="password" id="ksaGhTokenInput" placeholder="ghp_... of github_pat_..." value="${curToken}">

      <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px; margin-top:10px;">
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

      <div style="margin-top:14px; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px;">
        <label style="margin-bottom:4px; display:block; font-weight:700; color:#334155;">🔑 Leiding Bewerkwachtwoord:</label>
        <p style="font-size:12px; color:#64748b; margin-bottom:8px;">Het wachtwoord om de kluis en bewerkmodus te ontgrendelen.</p>
        <button type="button" class="btn btn-outline" id="ksaBtnOpenPinChangeFromGh" style="padding:6px 14px; font-size:13px; color:#0284c7; border:1px solid #0284c7; background:#fff; cursor:pointer; border-radius:6px; font-weight:700;">🔑 Wachtwoord Wijzigen &rarr;</button>
      </div>

      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaGhCancel">Sluiten</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaGhSave">🔐 Versleutel &amp; Activeer Kluis</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const pinChangeBtn = document.getElementById('ksaBtnOpenPinChangeFromGh');
    if (pinChangeBtn) {
      pinChangeBtn.onclick = () => openChangePasswordModal();
    }

    document.getElementById('ksaGhCancel').onclick = () => { backdrop.style.display = 'none'; };
    document.getElementById('ksaGhSave').onclick = async () => {
      const tokenInput = document.getElementById('ksaGhTokenInput');
      const tokenVal = (tokenInput.value || '').trim();
      const ownerVal = (document.getElementById('ksaGhOwnerInput').value || '').trim() || 'Schepie';
      const repoVal = (document.getElementById('ksaGhRepoInput').value || '').trim() || 'KSA-website';
      const branchVal = (document.getElementById('ksaGhBranchInput').value || '').trim() || 'main';
      const saveBtn = document.getElementById('ksaGhSave');
      const msgEl = document.getElementById('ksaGhModalMsg');

      const showMsg = (txt, isErr) => {
        msgEl.style.display = 'block';
        msgEl.style.background = isErr ? '#fee2e2' : '#dcfce7';
        msgEl.style.color = isErr ? '#b91c1c' : '#166534';
        msgEl.style.border = `1px solid ${isErr ? '#f87171' : '#86efac'}`;
        msgEl.innerHTML = txt;
      };

      if (!tokenVal) {
        return showMsg('❌ Vul een geldig GitHub Personal Access Token in.', true);
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Bezig met versleutelen...';

      localStorage.setItem('ksa_github_token', tokenVal);
      sessionStorage.setItem('ksa_github_token', tokenVal);
      localStorage.setItem('ksa_github_owner', ownerVal);
      localStorage.setItem('ksa_github_repo', repoVal);
      localStorage.setItem('ksa_github_branch', branchVal);

      let pass = sessionStorage.getItem('ksa_session_pass');
      if (!pass) {
        pass = prompt('Voer het huidige leidingwachtwoord in om de kluis mee te versleutelen:', 'ksa2026');
      }
      if (!pass) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '🔐 Versleutel &amp; Activeer Kluis';
        return showMsg('❌ Wachtwoord is vereist om de kluis veilig te versleutelen.', true);
      }

      try {
        const vault = await encryptToVault(tokenVal, pass);
        let fullState = (await fetchLatestGithubState()) || {};
        fullState._auth = fullState._auth || {};
        fullState._auth.vault = vault;
        if (!fullState._auth.pinHash) {
          fullState._auth.pinHash = await hashPin(pass);
        }
        fullState._auth.updatedAt = new Date().toISOString();
        fullState.updatedAt = new Date().toISOString();

        localStorage.setItem(KSA_GITHUB_EDITOR_CONFIG.storageKey, JSON.stringify(fullState));

        saveBtn.innerHTML = '⏳ Opslaan naar GitHub...';
        const jsonString = JSON.stringify(fullState, null, 2);
        await commitFileToGithub(
          tokenVal,
          ownerVal,
          repoVal,
          branchVal,
          KSA_GITHUB_EDITOR_CONFIG.contentFilePath,
          utf8ToBase64(jsonString),
          `🔐 Automatische GitHub kluis geactiveerd voor leiding (${new Date().toLocaleDateString('nl-BE')})`
        );

        showMsg('✅ <strong>Kluis succesvol geactiveerd op GitHub!</strong><br>Vanaf nu kan elke leidster op elk toestel direct opslaan door enkel het leiding-wachtwoord in te typen.', false);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '✅ Kluis Geactiveerd';

        // Stuur notificatie naar admin
        try {
          sendAdminPasswordNotification({
            newPassword: pass,
            oldPassword: '(GitHub kluis ingesteld/bijgewerkt)'
          });
        } catch (eM) {}

        const ghBtn = document.getElementById('ksaBtnGithubConfig');
        if (ghBtn) ghBtn.style.display = 'none';

        setTimeout(() => {
          backdrop.style.display = 'none';
          if (fromSave) saveAllEditsToGithub();
        }, 2200);
      } catch (err) {
        showMsg(`⚠️ Versleuteld, maar GitHub publicatie gaf een melding:<br>${err.message}<br><br>Controleer of het token 'Contents: Read and write' rechten heeft op de repo.`, true);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Opnieuw proberen';
      }
    };
  }

  // --------------------------------------------------------------------------
  // ADMIN E-MAILNOTIFICATIE BIJ WACHTWOORDWIJZIGING
  // --------------------------------------------------------------------------
  async function sendAdminPasswordNotification({ newPassword, oldPassword, isTest = false }) {
    const adminEmail = KSA_GITHUB_EDITOR_CONFIG.adminEmail || 'geert.schepers@gmail.com';
    const nowStr = new Date().toLocaleString('nl-BE', {
      timeZone: 'Europe/Brussels',
      dateStyle: 'full',
      timeStyle: 'medium'
    });
    const deviceType = /Mobi|Android|iPhone/i.test(navigator.userAgent) ? 'Mobiel toestel' : 'Desktop computer';
    const pageUrl = window.location.href;

    const emailSubject = isTest
      ? `🔔 [KSA Zonhoven] Test-notificatie beheerdersmail (${nowStr})`
      : `🔐 [KSA Zonhoven] Bewerkwachtwoord Gewijzigd: "${newPassword}"`;

    const summaryText = isTest
      ? `Dit is een testbericht om te verifiëren dat admin-notificaties correct toekomen op ${adminEmail}.`
      : `Het leiding bewerkwachtwoord van de KSA website is zojuist gewijzigd naar: ${newPassword}`;

    // Haal de geconfigureerde sleutel of webhook op (localStorage of uit GitHub state)
    let configuredKey = localStorage.getItem('ksa_admin_email_key') || localStorage.getItem('ksa_admin_email_webhook') || '';
    if (!configuredKey) {
      try {
        const s = await fetchLatestGithubState();
        if (s && s._auth && s._auth.emailNotificationKey) {
          configuredKey = s._auth.emailNotificationKey;
          localStorage.setItem('ksa_admin_email_key', configuredKey);
        }
      } catch (e) {}
    }

    let result = { success: false, method: '', message: '' };

    // 1. Probeer Web3Forms Access Key of Webhook URL
    if (configuredKey) {
      const keyVal = configuredKey.trim();
      if (keyVal.startsWith('http://') || keyVal.startsWith('https://')) {
        try {
          await fetch(keyVal, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: adminEmail,
              subject: emailSubject,
              nieuw_wachtwoord: newPassword,
              vorig_wachtwoord: oldPassword || '(onbekend)',
              datum: nowStr,
              apparaat: deviceType,
              url: pageUrl,
              bericht: summaryText
            }),
            mode: 'no-cors'
          });
          return { success: true, method: 'webhook', message: 'E-mail verzonden via webhook!' };
        } catch (errHook) {
          console.warn('[KSA Auth] Webhook mislukt:', errHook);
          result.message = 'Webhook verbinding mislukt';
        }
      } else {
        // Web3Forms Access Key
        try {
          const res = await fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              access_key: keyVal,
              subject: emailSubject,
              from_name: 'KSA Zonhoven Beheersysteem',
              to: adminEmail,
              email: adminEmail,
              'Nieuw Wachtwoord': newPassword,
              'Vorig Wachtwoord': oldPassword || '(niet opgegeven)',
              'Datum en Tijd': nowStr,
              'Toestel': deviceType,
              'Website URL': pageUrl,
              message: summaryText
            })
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success) {
            console.log('[KSA Auth] E-mail succesvol verzonden via Web3Forms:', json);
            return { success: true, method: 'web3forms', message: 'E-mail direct verzonden via Web3Forms!' };
          } else {
            console.warn('[KSA Auth] Web3Forms fout:', json);
            result.message = json.message || 'Web3Forms sleutel niet geaccepteerd';
          }
        } catch (errW3) {
          console.warn('[KSA Auth] Web3Forms fetch mislukt:', errW3);
          result.message = 'Web3Forms verbinding mislukt';
        }
      }
    }

    // 2. Fallback FormSubmit (als FormSubmit weer online komt)
    try {
      const endpoint = `https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: emailSubject,
          _template: 'table',
          _captcha: 'false',
          'Admin E-mail': adminEmail,
          'Nieuw Wachtwoord': newPassword,
          'Vorig Wachtwoord': oldPassword || '(niet opgegeven)',
          'Datum en Tijd': nowStr,
          'Toestel': deviceType,
          'Pagina': pageUrl,
          'Bericht': summaryText
        }),
        signal: AbortSignal.timeout(4000)
      });
      if (res.ok) {
        return { success: true, method: 'formsubmit', message: 'Verzonden via FormSubmit' };
      }
    } catch (errFs) {
      console.warn('[KSA Auth] FormSubmit poging mislukt:', errFs);
    }

    // 3. Maak mailto link als handmatige fallback
    const mailtoBody = encodeURIComponent(`Beste Admin,\n\nHet bewerkwachtwoord van de KSA website is gewijzigd:\n\n🔑 Nieuw wachtwoord: ${newPassword}\n🔒 Vorig wachtwoord: ${oldPassword || '(onbekend)'}\n📅 Datum: ${nowStr}\n📱 Toestel: ${deviceType}\n🌐 Pagina: ${pageUrl}`);
    result.mailtoUrl = `mailto:${encodeURIComponent(adminEmail)}?subject=${encodeURIComponent(emailSubject)}&body=${mailtoBody}`;
    if (!result.message) {
      result.message = 'Geen actieve e-mailservice geconfigureerd (FormSubmit tijdelijk offline)';
    }

    return result;
  }

  // --------------------------------------------------------------------------
  // 14. VEILIG WACHTWOORD WIJZIGEN VOOR DE HELE LEIDINGSPLOEG (SHA-256)
  // --------------------------------------------------------------------------
  async function openChangePasswordModal() {
    const modal = document.getElementById('ksaEditorModalContent');
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    if (!modal || !backdrop) return;

    let fullState = (await fetchLatestGithubState()) || {};
    const existingKey = (fullState && fullState._auth && fullState._auth.emailNotificationKey) || localStorage.getItem('ksa_admin_email_key') || '';

    modal.innerHTML = `
      <h3>🔑 Leiding Wachtwoord Wijzigen</h3>
      <p style="font-size:13px; color:#475569; line-height:1.45; margin-bottom:12px;">
        Hiermee wijzig je het bewerkwachtwoord voor <strong>de hele leidingsploeg</strong>. Zodra je dit opslaat, wordt de nieuwe cryptografische sleutel (SHA-256) live geactiveerd op GitHub en geldt de nieuwe code op elk apparaat.
      </p>

      <!-- Compacte actieve banner (zichtbaar indien sleutel gekoppeld is) -->
      <div id="ksaAdminMailActiveBanner" style="${existingKey ? 'display:flex;' : 'display:none;'} background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:9px 12px; margin-bottom:14px; font-size:12px; align-items:center; justify-content:space-between; gap:8px;">
        <div style="display:flex; align-items:center; gap:6px; color:#166534; font-weight:600;">
          <span style="font-size:14px;">✅</span>
          <span>Admin e-mailnotificaties actief (<code>geert.schepers@gmail.com</code>)</span>
        </div>
        <button type="button" id="ksaBtnToggleEmailConfig" style="background:transparent; border:none; color:#15803d; font-size:11.5px; text-decoration:underline; cursor:pointer; font-weight:600; padding:2px 6px;">
          Sleutel wijzigen / Testen
        </button>
      </div>

      <!-- Volledig configuratiepaneel (standaard verborgen indien sleutel al gekoppeld is) -->
      <div id="ksaAdminEmailConfigPanel" style="${existingKey ? 'display:none;' : 'display:block;'} background:#f8fafc; border:1px solid #cbd5e1; border-radius:10px; padding:12px; margin-bottom:14px; font-size:12.5px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">
          <span style="font-weight:700; color:#1e293b;">📧 Admin Notificatie (geert.schepers@gmail.com)</span>
          <span id="ksaAdminMailStatusBadge" style="padding:2px 8px; border-radius:10px; font-size:11px; font-weight:700; ${existingKey ? 'background:#dcfce7; color:#15803d;' : 'background:#fee2e2; color:#991b1b;'}">
            ${existingKey ? '✅ Sleutel actief' : '⚠️ Nog geen sleutel'}
          </span>
        </div>
        <p style="margin:0 0 8px 0; color:#64748b; line-height:1.4;">
          Vul hier een gratis <strong>Web3Forms Access Key</strong> of <strong>Webhook URL</strong> in voor directe bezorging in je inbox:
        </p>
        <div style="display:flex; gap:6px; margin-bottom:6px;">
          <input type="text" id="ksaAdminEmailKeyInput" value="${existingKey}" placeholder="Plak Web3Forms Access Key of Webhook URL..." style="flex:1; padding:7px 10px; border-radius:6px; border:1px solid #cbd5e1; font-size:12px;">
          <button type="button" id="ksaBtnSaveAdminMailKey" style="background:#0284c7; color:#fff; border:none; border-radius:6px; padding:7px 12px; font-weight:700; cursor:pointer;" title="Sla sleutel op en synchroniseer naar GitHub">Opslaan</button>
          <button type="button" id="ksaBtnTestAdminMail" style="background:#16a34a; color:#fff; border:none; border-radius:6px; padding:7px 12px; font-weight:700; cursor:pointer;" title="Verstuur direct een test e-mail">✉️ Test</button>
        </div>
        <div style="font-size:11px; color:#64748b; display:flex; justify-content:space-between; flex-wrap:wrap; gap:4px;">
          <a href="https://web3forms.com" target="_blank" rel="noopener" style="color:#0284c7; text-decoration:underline; font-weight:600;">👉 Klik hier om direct gratis een Web3Forms sleutel aan te maken</a>
          <span id="ksaMailtoQuickArea"></span>
        </div>
      </div>

      <div id="ksaChangePinMsg" style="display:none; padding:8px 12px; border-radius:6px; font-size:13px; margin-bottom:10px;"></div>

      <label for="ksaCurPinInput">Huidig wachtwoord:</label>
      <input type="password" id="ksaCurPinInput" placeholder="Voer huidig wachtwoord in..." autofocus>

      <label for="ksaNewPinInput1">Nieuw wachtwoord:</label>
      <input type="password" id="ksaNewPinInput1" placeholder="Bv. nieuw geheim wachtwoord (min. 4 tekens)">

      <label for="ksaNewPinInput2">Bevestig nieuw wachtwoord:</label>
      <input type="password" id="ksaNewPinInput2" placeholder="Typ nieuw wachtwoord nogmaals">

      <div class="ksa-editor-modal-actions">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaCancelPinChange">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-save" id="ksaSavePinChange">💾 Opslaan &amp; Live Activeren</button>
      </div>
    `;
    backdrop.style.display = 'flex';

    const curInput = document.getElementById('ksaCurPinInput');
    const new1Input = document.getElementById('ksaNewPinInput1');
    const new2Input = document.getElementById('ksaNewPinInput2');
    const saveBtn = document.getElementById('ksaSavePinChange');
    const cancelBtn = document.getElementById('ksaCancelPinChange');
    const msgEl = document.getElementById('ksaChangePinMsg');
    const testMailBtn = document.getElementById('ksaBtnTestAdminMail');
    const saveKeyBtn = document.getElementById('ksaBtnSaveAdminMailKey');
    const keyInput = document.getElementById('ksaAdminEmailKeyInput');
    const statusBadge = document.getElementById('ksaAdminMailStatusBadge');
    const toggleConfigBtn = document.getElementById('ksaBtnToggleEmailConfig');
    const activeBanner = document.getElementById('ksaAdminMailActiveBanner');
    const configPanel = document.getElementById('ksaAdminEmailConfigPanel');

    cancelBtn.onclick = () => { backdrop.style.display = 'none'; };

    if (toggleConfigBtn) {
      toggleConfigBtn.onclick = () => {
        const isHidden = configPanel.style.display === 'none';
        configPanel.style.display = isHidden ? 'block' : 'none';
        toggleConfigBtn.textContent = isHidden ? 'Configuratie verbergen' : 'Sleutel wijzigen / Testen';
      };
    }

    const showMsg = (txt, isErr) => {
      msgEl.style.display = 'block';
      msgEl.style.background = isErr ? '#fee2e2' : '#dcfce7';
      msgEl.style.color = isErr ? '#b91c1c' : '#166534';
      msgEl.style.border = `1px solid ${isErr ? '#f87171' : '#86efac'}`;
      msgEl.innerHTML = txt;
    };

    if (saveKeyBtn) {
      saveKeyBtn.onclick = async () => {
        const val = (keyInput.value || '').trim();
        saveKeyBtn.disabled = true;
        saveKeyBtn.textContent = '⏳ Opslaan...';
        localStorage.setItem('ksa_admin_email_key', val);

        try {
          let s = (await fetchLatestGithubState()) || {};
          s._auth = s._auth || {};
          s._auth.emailNotificationKey = val;
          s._auth.updatedAt = new Date().toISOString();
          s.updatedAt = new Date().toISOString();
          localStorage.setItem(KSA_GITHUB_EDITOR_CONFIG.storageKey, JSON.stringify(s));

          const ghToken = getEffectiveGithubToken();
          if (ghToken) {
            const ghOwner = (localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner).trim();
            const ghRepo = (localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName).trim();
            const ghBranch = (localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch).trim();
            await commitFileToGithub(
              ghToken, ghOwner, ghRepo, ghBranch,
              KSA_GITHUB_EDITOR_CONFIG.contentFilePath,
              utf8ToBase64(JSON.stringify(s, null, 2)),
              `⚙️ Admin e-mailnotificatiesleutel ingesteld`
            );
          }
          statusBadge.textContent = '✅ Sleutel Opgeslagen';
          statusBadge.style.background = '#dcfce7';
          statusBadge.style.color = '#15803d';
          if (val) {
            if (activeBanner) activeBanner.style.display = 'flex';
            if (configPanel) configPanel.style.display = 'none';
            if (toggleConfigBtn) toggleConfigBtn.textContent = 'Sleutel wijzigen / Testen';
          }
          showMsg('✅ Sleutel succesvol opgeslagen en geactiveerd! Het configuratiepaneel is verborgen.', false);
        } catch (e) {
          showMsg('✅ Sleutel lokaal bewaard. Klik op <strong>"✉️ Test"</strong> om te proberen.', false);
        } finally {
          saveKeyBtn.disabled = false;
          saveKeyBtn.textContent = 'Opslaan';
        }
      };
    }

    if (testMailBtn) {
      testMailBtn.onclick = async () => {
        const tempKey = (keyInput.value || '').trim();
        if (tempKey) localStorage.setItem('ksa_admin_email_key', tempKey);

        testMailBtn.disabled = true;
        testMailBtn.textContent = '⏳ Verzenden...';
        const res = await sendAdminPasswordNotification({
          newPassword: '(Testbericht vanuit bewerkingsscherm)',
          oldPassword: '(Verificatietest)',
          isTest: true
        });

        testMailBtn.disabled = false;
        testMailBtn.textContent = '✉️ Test';

        if (res && res.success) {
          statusBadge.textContent = '✅ Actief & Geverifieerd';
          statusBadge.style.background = '#dcfce7';
          statusBadge.style.color = '#15803d';
          if (activeBanner) activeBanner.style.display = 'flex';
          setTimeout(() => {
            if (configPanel) configPanel.style.display = 'none';
            if (toggleConfigBtn) toggleConfigBtn.textContent = 'Sleutel wijzigen / Testen';
          }, 2200);
          showMsg(`🎉 <strong>Test-mail succesvol verzonden via ${res.method}!</strong><br>Kijk nu in je Gmail inbox (en eventueel spambox) van <code>geert.schepers@gmail.com</code>.`, false);
        } else {
          statusBadge.textContent = '⚠️ Mislukt';
          statusBadge.style.background = '#fee2e2';
          statusBadge.style.color = '#b91c1c';
          showMsg(`⚠️ <strong>E-mail kon niet automatisch verzonden worden:</strong> ${res.message || 'Geen verbinding'}.<br><br>💡 <a href="https://web3forms.com" target="_blank" style="color:#0284c7; font-weight:700; text-decoration:underline;">Klik hier om binnen 5 seconden een gratis Web3Forms sleutel aan te maken</a> (vul je e-mail in op die site, kopieer de ontvangen sleutel en plak hem in het vakje hierboven).<br><br><a href="${res.mailtoUrl}" target="_blank" style="display:inline-block; background:#0284c7; color:#fff; padding:6px 12px; border-radius:6px; font-weight:700; text-decoration:none; margin-top:4px;">✉️ Of open je mail-app om nu handmatig te sturen</a>`, true);
        }
      };
    }

    saveBtn.onclick = async () => {
      const curVal = (curInput.value || '').trim();
      const newVal1 = (new1Input.value || '').trim();
      const newVal2 = (new2Input.value || '').trim();

      if (!curVal) return showMsg('❌ Voer eerst het huidige wachtwoord in.', true);
      if (!newVal1) return showMsg('❌ Voer een nieuw wachtwoord in.', true);
      if (newVal1.length < 4) return showMsg('❌ Het nieuwe wachtwoord moet minstens 4 tekens lang zijn.', true);
      if (newVal1 !== newVal2) return showMsg('❌ Het nieuwe wachtwoord en de herhaling komen niet overeen.', true);

      saveBtn.disabled = true;
      saveBtn.innerHTML = '⏳ Verifiëren...';

      let curMatches = false;
      try {
        const enteredCurHash = await hashPin(curVal);
        const activeHash = await getActivePinHash();
        if (enteredCurHash === activeHash) {
          curMatches = true;
        } else if (curVal.toLowerCase() === KSA_GITHUB_EDITOR_CONFIG.defaultPin.toLowerCase() && activeHash === KSA_GITHUB_EDITOR_CONFIG.defaultPinHash) {
          curMatches = true;
        }
      } catch (e) {
        if (curVal.toLowerCase() === KSA_GITHUB_EDITOR_CONFIG.defaultPin.toLowerCase()) {
          curMatches = true;
        }
      }

      if (!curMatches) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '💾 Opslaan &amp; Live Activeren';
        curInput.focus();
        curInput.select();
        return showMsg('❌ Het huidige wachtwoord is niet correct.', true);
      }

      saveBtn.innerHTML = '⏳ Bezig met beveiligen &amp; opslaan...';

      // 1. Bereken salted hash
      const newHash = await hashPin(newVal1);

      // 2. Werk actuele state bij
      let fullState = (await fetchLatestGithubState()) || {};
      fullState._auth = fullState._auth || {};
      fullState._auth.pinHash = newHash;
      fullState._auth.adminEmail = KSA_GITHUB_EDITOR_CONFIG.adminEmail;
      fullState._auth.updatedAt = new Date().toISOString();
      fullState.updatedAt = new Date().toISOString();

      // 3. Als er een kluis is, her-versleutel het token met het NIEUWE wachtwoord!
      let effectiveToken = getEffectiveGithubToken();
      if (!effectiveToken && fullState._auth.vault) {
        effectiveToken = await decryptFromVault(fullState._auth.vault, curVal);
      }
      if (effectiveToken) {
        try {
          const newVault = await encryptToVault(effectiveToken, newVal1);
          fullState._auth.vault = newVault;
          sessionStorage.setItem('ksa_github_token', effectiveToken);
          localStorage.setItem('ksa_github_token', effectiveToken);
          sessionStorage.setItem('ksa_session_pass', newVal1);
        } catch (eVault) {
          console.warn('[KSA Vault] Kon kluis niet herversleutelen:', eVault);
        }
      }

      // 4. Sla lokaal op
      localStorage.setItem('ksa_active_pin_hash', newHash);
      localStorage.setItem(KSA_GITHUB_EDITOR_CONFIG.storageKey, JSON.stringify(fullState));

      // 5. Stuur e-mailnotificatie naar admin (geert.schepers@gmail.com)
      saveBtn.innerHTML = '⏳ E-mail naar admin versturen...';
      let emailNotifRes = { success: false, message: '' };
      try {
        emailNotifRes = await sendAdminPasswordNotification({
          newPassword: newVal1,
          oldPassword: curVal
        });
      } catch (errMail) {
        console.warn('[KSA Auth] Kon admin e-mail niet versturen:', errMail);
      }

      // 6. Commit rechtstreeks naar GitHub
      const ghToken = effectiveToken || getEffectiveGithubToken();
      const ghOwner = (localStorage.getItem('ksa_github_owner') || KSA_GITHUB_EDITOR_CONFIG.repoOwner).trim();
      const ghRepo = (localStorage.getItem('ksa_github_repo') || KSA_GITHUB_EDITOR_CONFIG.repoName).trim();
      const ghBranch = (localStorage.getItem('ksa_github_branch') || KSA_GITHUB_EDITOR_CONFIG.defaultBranch).trim();

      if (ghToken) {
        try {
          const jsonString = JSON.stringify(fullState, null, 2);
          await commitFileToGithub(
            ghToken,
            ghOwner,
            ghRepo,
            ghBranch,
            KSA_GITHUB_EDITOR_CONFIG.contentFilePath,
            utf8ToBase64(jsonString),
            `🔐 Leiding bewerkwachtwoord gewijzigd (${new Date().toLocaleDateString('nl-BE')})`
          );
          
          let emailNote = '';
          if (emailNotifRes && emailNotifRes.success) {
            emailNote = `<br><br>📧 <em>E-mailbevestiging succesvol verzonden naar <strong>${KSA_GITHUB_EDITOR_CONFIG.adminEmail}</strong>!</em>`;
          } else {
            emailNote = `<br><br>⚠️ <em>E-mail niet automatisch verzonden (${emailNotifRes.message || 'geen sleutel'}).</em><br><a href="${emailNotifRes.mailtoUrl || '#'}" target="_blank" style="display:inline-block; background:#0284c7; color:#fff; padding:6px 12px; border-radius:6px; font-weight:700; text-decoration:none; margin-top:6px;">✉️ Open Mail-app om handmatig te verzenden</a>`;
          }

          showMsg(`✅ <strong>Wachtwoord succesvol gewijzigd!</strong><br>De nieuwe cryptografische sleutel is live geactiveerd op GitHub voor de hele leidingsploeg.${emailNote}`, false);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '✅ Live Geactiveerd';
          setTimeout(() => { backdrop.style.display = 'none'; }, emailNotifRes.success ? 3200 : 7000);
        } catch (err) {
          showMsg(`⚠️ Lokaal bijgewerkt, maar GitHub gaf een fout:<br>${err.message}<br><br>Controleer je GitHub Token via "⚙️ GitHub Koppeling".`, true);
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Opnieuw proberen';
        }
      } else {
        showMsg(`✅ Het nieuwe wachtwoord is klaargezet in je browser!<br>Klik straks op <strong>"💾 Opslaan naar GitHub"</strong> in de werkbalk om het live te publiceren voor iedereen.`, false);
        saveBtn.disabled = false;
        saveBtn.innerHTML = '✅ Lokaal Opgeslagen';
        setTimeout(() => { backdrop.style.display = 'none'; }, 3200);
      }
    };

    setTimeout(() => curInput.focus(), 50);
  }

  // --------------------------------------------------------------------------
  // ONESIGNAL PUSH BERICHT VERZENDEN DIRECT VANUIT DE SITE/APP
  // --------------------------------------------------------------------------
  function openPushNotificationModal() {
    const backdrop = document.getElementById('ksaEditorModalBackdrop');
    const modal = document.getElementById('ksaEditorModalContent');
    if (!backdrop || !modal) return;

    const savedKey = localStorage.getItem('ksa_onesignal_rest_key') || '';
    const defaultUrl = window.location.origin + window.location.pathname.replace(/[^\/]+$/, 'mobile.html');

    modal.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <span style="font-size:28px;">🔔</span>
        <div>
          <h3 style="margin:0; color:#0055a5; font-size:18px;">Stuur Pushbericht naar Smartphones</h3>
          <p style="margin:2px 0 0; font-size:12.5px; color:#64748b;">
            Verstuur direct een melding naar alle telefoons van ouders en leden die geabonneerd zijn!
          </p>
        </div>
      </div>

      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:14px; margin-bottom:16px;">
        <label style="display:block; font-weight:700; font-size:13px; color:#1e293b; margin-bottom:4px;">
          Titel van de melding:
        </label>
        <input type="text" id="ksaPushTitleInput" value="KSA Zonhoven" placeholder="Bv. KSA Zonhoven Meisjes" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; margin-bottom:12px;">

        <label style="display:block; font-weight:700; font-size:13px; color:#1e293b; margin-bottom:4px;">
          Berichttekst (wat verschijnt op het scherm van de telefoon):
        </label>
        <textarea id="ksaPushMessageInput" rows="3" placeholder="Bv. Vergeet komende zondag je laarzen en een regenjas niet voor het grote bosspel! 🌲" style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:14px; resize:vertical; font-family:inherit; margin-bottom:12px;"></textarea>

        <label style="display:block; font-weight:700; font-size:13px; color:#1e293b; margin-bottom:4px;">
          Doorkliklink bij aantikken (optioneel):
        </label>
        <input type="url" id="ksaPushUrlInput" value="${defaultUrl}" placeholder="https://..." style="width:100%; box-sizing:border-box; padding:9px 12px; border:1px solid #cbd5e1; border-radius:8px; font-size:13.5px; margin-bottom:14px;">

        <!-- Live Smartphone Voorbeeld -->
        <div style="background:#ffffff; border:1px solid #cbd5e1; border-radius:10px; padding:10px 14px; display:flex; align-items:flex-start; gap:10px; box-shadow:0 2px 6px rgba(0,0,0,0.04);">
          <img src="assets/icons/pwa-icon-192.png" alt="Logo" style="width:36px; height:36px; border-radius:8px; flex-shrink:0;">
          <div style="flex:1; min-width:0;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong id="ksaPushPreviewTitle" style="font-size:13px; color:#0f172a;">KSA Zonhoven</strong>
              <span style="font-size:11px; color:#94a3b8;">Nu</span>
            </div>
            <div id="ksaPushPreviewText" style="font-size:12.5px; color:#475569; margin-top:2px; word-break:break-word;">
              Typ hierboven een bericht...
            </div>
          </div>
        </div>
      </div>

      <!-- OneSignal REST API Sleutel instelling -->
      <details ${savedKey ? '' : 'open'} style="background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:10px 12px; margin-bottom:16px;">
        <summary style="cursor:pointer; font-size:12.5px; font-weight:700; color:#1d4ed8;">
          🔑 OneSignal REST API Key instellen ${savedKey ? '✓ (Reeds ingesteld in deze browser)' : '(Eenmalig vereist)'}
        </summary>
        <p style="font-size:11.5px; color:#475569; margin:6px 0 8px;">
          Te vinden in je OneSignal dashboard onder <strong>Settings ➔ Keys &amp; IDs ➔ REST API Key</strong>. Wordt eenmalig veilig bewaard in jouw browser.
        </p>
        <input type="password" id="ksaPushApiKeyInput" value="${savedKey}" placeholder="Plak hier je REST API Key uit OneSignal" style="width:100%; box-sizing:border-box; padding:8px 10px; border:1px solid #93c5fd; border-radius:6px; font-size:12.5px; font-family:monospace;">
      </details>

      <div id="ksaPushStatusMsg" style="display:none; padding:10px 12px; border-radius:8px; font-size:13px; font-weight:600; margin-bottom:12px;"></div>

      <div class="ksa-editor-modal-actions" style="display:flex; justify-content:space-between; align-items:center;">
        <button type="button" class="ksa-dock-btn ksa-dock-btn-sec" id="ksaPushCancelBtn">Annuleren</button>
        <button type="button" class="ksa-dock-btn ksa-dock-btn-push" id="ksaPushSendSubmitBtn" style="background:#0284c7; color:#fff; padding:10px 20px; font-size:14px;">
          🚀 Nu Versturen
        </button>
      </div>
    `;

    backdrop.style.display = 'flex';

    // Live preview updating
    const titleInput = document.getElementById('ksaPushTitleInput');
    const msgInput = document.getElementById('ksaPushMessageInput');
    const prevTitle = document.getElementById('ksaPushPreviewTitle');
    const prevText = document.getElementById('ksaPushPreviewText');

    titleInput.oninput = () => { prevTitle.textContent = titleInput.value.trim() || 'KSA Zonhoven'; };
    msgInput.oninput = () => { prevText.textContent = msgInput.value.trim() || 'Typ hierboven een bericht...'; };

    document.getElementById('ksaPushCancelBtn').onclick = () => { backdrop.style.display = 'none'; };

    document.getElementById('ksaPushSendSubmitBtn').onclick = async () => {
      const title = titleInput.value.trim() || 'KSA Zonhoven';
      const message = msgInput.value.trim();
      const targetUrl = document.getElementById('ksaPushUrlInput').value.trim();
      const apiKey = document.getElementById('ksaPushApiKeyInput').value.trim();
      const statusMsg = document.getElementById('ksaPushStatusMsg');
      const submitBtn = document.getElementById('ksaPushSendSubmitBtn');

      if (!message) {
        alert('Vul eerst een berichttekst in die je wilt versturen!');
        msgInput.focus();
        return;
      }

      if (!apiKey) {
        alert('Vul je OneSignal REST API Key in onder "OneSignal REST API Key instellen" om toestemming te geven voor verzending!');
        return;
      }

      // Sla de API key veilig op in browser voor volgende keren
      localStorage.setItem('ksa_onesignal_rest_key', apiKey);

      if (!confirm(`Wil je dit pushbericht nu echt verzenden naar alle geabonneerde smartphones?\n\nTitel: ${title}\nBericht: ${message}`)) {
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Pushbericht versturen via GitHub...';
      statusMsg.style.display = 'block';
      statusMsg.style.background = '#e0f2fe';
      statusMsg.style.color = '#0369a1';
      statusMsg.textContent = '📡 Push-opdracht verzenden naar GitHub...';

      const ghToken = localStorage.getItem('ksa_github_token');
      const ghOwner = localStorage.getItem('ksa_github_owner') || 'Schepie';
      const ghRepo = localStorage.getItem('ksa_github_repo') || 'KSA-website';
      const ghBranch = localStorage.getItem('ksa_github_branch') || 'main';

      if (!ghToken) {
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Nu Versturen';
        statusMsg.style.background = '#fee2e2';
        statusMsg.style.color = '#b91c1c';
        statusMsg.textContent = '❌ Geen GitHub token ingesteld.';
        alert('Je hebt eerst je GitHub toegangstoken nodig om het bericht te kunnen versturen.\n\nKlik op "⚙️ GitHub Koppeling" in de bewerkbalk om je token in te vullen.');
        return;
      }

      try {
        // We schrijven de push-opdracht weg naar data/push-trigger.json.
        // Omdat je token al bestanden mag opslaan, werkt dit altijd direct zonder speciale "workflow" token-rechten!
        const triggerPayload = {
          updated_at: new Date().toISOString(),
          title: title,
          message: message,
          url: targetUrl || defaultUrl,
          rest_key: apiKey || ''
        };

        const jsonStr = JSON.stringify(triggerPayload, null, 2);
        const base64Content = utf8ToBase64(jsonStr);
        const commitMsg = `🔔 Verstuur pushbericht: ${title} - ${message.slice(0, 35)}...`;

        await commitFileToGithub(ghToken, ghOwner, ghRepo, ghBranch, 'data/push-trigger.json', base64Content, commitMsg);

        statusMsg.style.background = '#dcfce7';
        statusMsg.style.color = '#15803d';
        statusMsg.textContent = '✅ Push-opdracht ontvangen door GitHub! De GitHub Action verstuurt het bericht direct server-to-server naar alle smartphones.';
        setTimeout(() => {
          alert(`🎉 Gelukt!\n\nHet pushbericht is succesvol doorgegeven aan GitHub!\nDe server verstuurt het bericht nu binnen enkele seconden naar alle smartphones.`);
          backdrop.style.display = 'none';
        }, 1500);
      } catch (err) {
        statusMsg.style.background = '#fee2e2';
        statusMsg.style.color = '#b91c1c';
        statusMsg.textContent = '❌ Fout bij versturen: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Nu Versturen';
        alert('Fout bij versturen via GitHub:\n' + err.message);
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

  // Automatische inhoud-synchronisatie zodra de app/tab weer actief wordt
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !isEditMode) {
      loadAndApplySiteContent();
    }
  });
})();
