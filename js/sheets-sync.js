/**
 * ==========================================================================
 * KSA ZONHOVEN - COMPLETE GOOGLE SHEETS "HEADLESS CMS" SYNC
 * ==========================================================================
 * Hiermee kan de leidingsploeg zonder enige technische kennis de VOLLEDIGE
 * website live bijwerken via een eenvoudige Google Sheet op computer of smartphone!
 * 
 * Gesynchroniseerde onderdelen:
 * 0. Home / Startscherm & Aftelklok Event Banner(s) (Hero + Countdown)
 * 1. Kalender (#agenda)
 * 2. Nieuws (#nieuws) & Mobiele Spotlight
 * 3. Groepen (#groepen)
 * 4. Leiding & Paspoortjes (#leiding)
 * 5. Info & Ravot Inschrijfgids (#info)
 * 6. 't Heem Zaalverhuur (#verhuring)
 * 7. Contact & Bereikbaarheid (#contact)
 * 
 * 100% gratis, geen API-sleutels nodig, veilige fallback naar statische HTML.
 */

const KSA_SHEETS_CONFIG = {
  // Gekoppeld aan de live KSA Zonhoven Google Sheet
  sheetId: '1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4',

  // Tabbladnamen (met ondersteuning voor synoniemen / alternatieve schrijfwijzen)
  tabs: {
    home: ['Home', 'Startscherm', 'Homescreen', 'Welkom', 'Banner'],
    kalender: ['Kalender', 'Agenda', 'Planning'],
    nieuws: ['Nieuws', 'Berichten', 'Events', 'Evenementen'],
    groepen: ['Groepen', 'Leeftijdsgroepen', 'Afdelingen'],
    leiding: ['Leiding', 'Leidsters', 'Leidingploeg'],
    info: ['Info', 'Informatie', 'Praktisch', 'Ravot'],
    heem: ['HetHeem', "'t Heem", 'Heem', 'Verhuring', 'Zaalverhuur'],
    contact: ['Contact', 'Contacteer', 'Bereikbaarheid']
  },

  // Schakel synchronisatie in of uit
  enabled: true
};

/**
 * Haal data op van een Google Sheet tabblad via de Google Visualization API.
 * Ondersteunt tabblad-aliassen en valideert of Google niet stiekem het eerste tabblad teruggeeft.
 */
async function fetchGoogleSheetData(sheetId, tabNames, validatorFn) {
  if (!sheetId) return null;
  const candidates = Array.isArray(tabNames) ? tabNames : [tabNames];

  for (const tabName of candidates) {
    const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&t=${Date.now()}`;
    
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      
      const jsonStart = text.indexOf('{');
      const jsonEnd = text.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) continue;
      
      const jsonString = text.substring(jsonStart, jsonEnd + 1);
      const data = JSON.parse(jsonString);
      
      if (!data.table || !data.table.rows || data.table.rows.length === 0) continue;
      
      // Kolomkoppen bepalen
      let headers = (data.table.cols || []).map(c => (c.label || '').trim());
      let dataRows = data.table.rows;
      
      const hasColHeaders = headers.some(h => h.length > 0);
      if (!hasColHeaders && dataRows.length > 0) {
        // Eerste rij bevat de kolomnamen
        headers = dataRows[0].c.map(cell => (cell && cell.v !== null && cell.v !== undefined) ? String(cell.v).trim() : '');
        dataRows = dataRows.slice(1);
      }
      
      // Rijen converteren naar objecten
      const rows = dataRows.map(r => {
        const rowObj = {};
        if (!r || !r.c) return rowObj;
        r.c.forEach((cell, idx) => {
          const key = headers[idx] || `col_${idx}`;
          let val = '';
          if (cell && cell.v !== null && cell.v !== undefined) {
            val = cell.f !== undefined ? cell.f : cell.v;
          }
          const cleanVal = typeof val === 'string' ? val.trim() : val;
          rowObj[key] = cleanVal;
          rowObj[`col_${idx}`] = cleanVal;
        });
        return rowObj;
      });

      // Valideren of dit tabblad daadwerkelijk de verwachte gegevens bevat
      if (typeof validatorFn === 'function') {
        if (!validatorFn(rows, headers)) {
          // Google viel terug op een ander tabblad; sla over
          continue;
        }
      }

      return rows;
    } catch (err) {
      console.warn(`[KSA Sheets] Poging tabblad "${tabName}" mislukt:`, err);
    }
  }

  return null;
}

/**
 * Hulpfunctie om veldwaarden case-insensitief en met aliassen op te vragen
 */
function getVal(item, ...keys) {
  if (!item) return '';
  for (const k of keys) {
    if (item[k] !== undefined && item[k] !== null && String(item[k]).trim() !== '') {
      return String(item[k]).trim();
    }
    const lowerK = k.toLowerCase();
    for (const objKey of Object.keys(item)) {
      if (objKey.toLowerCase() === lowerK && item[objKey] !== undefined && item[objKey] !== null) {
        const v = String(item[objKey]).trim();
        if (v !== '') return v;
      }
    }
  }
  return '';
}

/**
 * Controleer of een rij getoond moet worden op basis van de 'Tonen' kolom
 */
function isRowVisible(tonenVal) {
  const s = String(tonenVal || '').toLowerCase().trim();
  if (['nee', 'no', 'false', '0', 'uit', 'verbergen', 'weg', 'voorbij', 'hide'].includes(s)) {
    return false;
  }
  return true;
}

/**
 * Flexibele datum- en tijdparser voor de Countdown Banner.
 * Ondersteunt o.a.:
 * - "17/10/2026 19:30" of "17-10-2026 19u30"
 * - "17/10/2026" of "17/10 19:30"
 * - "2026-10-17 19:30"
 * - "17 oktober 2026 19:30"
 * - Google Sheets Date(2026,9,17,19,30,0)
 */
function parseFlexibleCountdownDate(str) {
  if (!str) return null;
  const raw = String(str).trim();
  if (!raw || raw.toLowerCase() === 'geen') return null;

  const now = new Date();
  let year = now.getFullYear();
  let month = null; // 0-indexed (0 = Jan, 9 = Okt)
  let day = null;
  let hours = 19;
  let minutes = 30;
  let yearExplicit = false;

  // 1. Google GViz Date(yyyy, m, d, h, min, s)
  if (raw.startsWith('Date(')) {
    const nums = raw.match(/\d+/g);
    if (nums && nums.length >= 3) {
      year = parseInt(nums[0], 10);
      month = parseInt(nums[1], 10); // Al 0-indexed bij Google Date()
      day = parseInt(nums[2], 10);
      hours = nums[3] !== undefined ? parseInt(nums[3], 10) : 19;
      minutes = nums[4] !== undefined ? parseInt(nums[4], 10) : 30;
      yearExplicit = true;
    }
  } else {
    // Tijdstip extraheren indien aanwezig (bv. "19:30" of "19u30" of "19.30")
    const timeMatch = raw.match(/(\d{1,2})\s*[:uU\.]\s*(\d{2})/);
    if (timeMatch) {
      hours = parseInt(timeMatch[1], 10);
      minutes = parseInt(timeMatch[2], 10);
    } else {
      hours = 13;
      minutes = 30;
    }

    // Datum zonder het tijd-gedeelte
    const datePart = raw.replace(/(\d{1,2})\s*[:uU\.]\s*(\d{2})(:\d{2})?/, '').trim();

    // 2. ISO formaat: yyyy-mm-dd
    const isoMatch = datePart.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    // 3. Europees formaat: dd/mm/yyyy of dd-mm-yyyy (of zonder jaar: dd/mm)
    const euMatch = datePart.match(/^(\d{1,2})\s*[\/\-]\s*(\d{1,2})(?:\s*[\/\-]\s*(\d{2,4}))?/);

    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      month = parseInt(isoMatch[2], 10) - 1;
      day = parseInt(isoMatch[3], 10);
      yearExplicit = true;
    } else if (euMatch) {
      day = parseInt(euMatch[1], 10);
      month = parseInt(euMatch[2], 10) - 1;
      if (euMatch[3]) {
        year = parseInt(euMatch[3], 10);
        if (year < 100) year += 2000;
        yearExplicit = true;
      }
    } else {
      // 4. Nederlandse maandnamen (bv. "17 oktober 2026")
      const nlMonths = {
        jan: 0, feb: 1, mrt: 2, maa: 2, apr: 3, mei: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, okt: 9, oct: 9, nov: 10, dec: 11
      };
      const lower = datePart.toLowerCase();
      for (const [mKey, mIdx] of Object.entries(nlMonths)) {
        if (lower.includes(mKey)) {
          month = mIdx;
          break;
        }
      }
      const nums = datePart.match(/\d+/g);
      if (nums && nums.length >= 1) {
        day = parseInt(nums[0], 10);
        if (nums.length >= 2 && parseInt(nums[1], 10) > 31) {
          year = parseInt(nums[1], 10);
          yearExplicit = true;
        }
      }
    }
  }

  if (month === null || day === null || isNaN(month) || isNaN(day)) {
    return null;
  }

  const target = new Date(year, month, day, hours, minutes, 0, 0);

  // Als de datum al gepasseerd is, schuif door naar het eerstvolgende jaar
  while (target.getTime() < Date.now()) {
    target.setFullYear(target.getFullYear() + 1);
  }

  return target;
}

/* ==========================================================================
   0. HOME / STARTSCHERM & COUNTDOWN BANNER SYNC
   ========================================================================== */
async function syncHomeFromSheets(sheetId) {
  const isHomeValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return (
      hStr.includes('onderdeel') ||
      hStr.includes('knop_tekst') ||
      hStr.includes('datum_uur') ||
      hStr.includes('tonen')
    ) && (
      rowsStr.includes('banner') ||
      rowsStr.includes('hero') ||
      rowsStr.includes('topbalk') ||
      rowsStr.includes('stat1') ||
      rowsStr.includes('countdown')
    );
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.home, isHomeValid);
  if (!rows || rows.length === 0) return;

  const homeMap = {};
  const bannerRows = [];

  rows.forEach(item => {
    const rawType = getVal(item, 'Onderdeel', 'Sectie', 'Type', 'col_0');
    if (!rawType || rawType.toLowerCase() === 'onderdeel') return;

    const cleanKey = rawType.toLowerCase().replace(/[^a-z0-9]/g, '');
    const rowData = {
      onderdeel: rawType,
      titel: getVal(item, 'Titel', 'Waarde', 'col_1'),
      tekst: getVal(item, 'Tekst', 'Omschrijving', 'col_2'),
      extra: getVal(item, 'Extra_Info', 'Extra', 'Label', 'Badge', 'col_3'),
      datumUur: getVal(item, 'Datum_Uur', 'Datum', 'Highlight', 'col_4'),
      knopTekst: getVal(item, 'Knop_Tekst', 'KnopTekst', 'Knop', 'col_5'),
      linkOfFoto: getVal(item, 'Link_of_Foto', 'Link', 'Foto', 'Afbeelding', 'col_6'),
      tonen: getVal(item, 'Tonen', 'Actief', 'Status', 'col_7')
    };

    if (cleanKey.startsWith('banner') || cleanKey.includes('countdown') || cleanKey.includes('evenementbanner')) {
      bannerRows.push(rowData);
    } else {
      homeMap[cleanKey] = rowData;
    }
  });

  // -------------------------------------------------------------------------
  // A. BOVENBALK (Topbar rechtsboven op desktop)
  // -------------------------------------------------------------------------
  if (homeMap.topbalk) {
    const tb = homeMap.topbalk;
    const topbarRight = document.querySelector('.ksa-topbar .container > div:last-child');
    const topbarBadge = document.querySelector('.ksa-topbar-badge');
    if (topbarBadge && tb.extra) {
      topbarBadge.textContent = tb.extra;
    }
    if (topbarRight) {
      if (!isRowVisible(tb.tonen) || (!tb.titel && !tb.tekst)) {
        topbarRight.style.display = 'none';
      } else {
        topbarRight.style.display = '';
        const linkHref = tb.linkOfFoto || '#nieuws';
        const isExt = linkHref.startsWith('http');
        topbarRight.innerHTML = `
          <span>
            ${tb.titel ? `<strong>${tb.titel}</strong> ` : ''}
            ${tb.tekst ? `<a href="${linkHref}" ${isExt ? 'target="_blank" rel="noopener"' : ''}>${tb.tekst}</a>` : ''}
          </span>
        `;
      }
    }
  }

  // -------------------------------------------------------------------------
  // B. HERO SECTIE (Hoofdtitel, Label, Introtekst op Desktop & Mobiel)
  // -------------------------------------------------------------------------
  if (homeMap.hero) {
    const hr = homeMap.hero;
    const heroSec = document.querySelector('.hero-section');
    if (heroSec) {
      const tagSpan = heroSec.querySelector('.hero-tag span');
      const titleEl = heroSec.querySelector('.hero-title');
      const leadEl = heroSec.querySelector('.hero-lead');

      if (tagSpan && hr.extra) {
        tagSpan.textContent = hr.extra;
      }
      if (titleEl && hr.titel) {
        let fullTitle = hr.titel;
        const highlight = hr.datumUur;
        if (highlight && fullTitle.toUpperCase().includes(highlight.toUpperCase())) {
          const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
          fullTitle = fullTitle.replace(regex, '<span class="text-blue">$1</span>');
        }
        titleEl.innerHTML = fullTitle;
      }
      if (leadEl && hr.tekst) {
        leadEl.innerHTML = hr.tekst;
      }
    }

    // Mobiele Hero tekst
    const mobHeroDesc = document.querySelector('.hero-live-desc');
    if (mobHeroDesc && hr.tekst) {
      mobHeroDesc.innerHTML = hr.tekst;
    }
  }

  // -------------------------------------------------------------------------
  // C. HERO KNOPPEN (HeroKnop1, HeroKnop2, HeroKnop3)
  // -------------------------------------------------------------------------
  const heroBtns = document.querySelectorAll('.hero-cta-group a');
  ['heroknop1', 'heroknop2', 'heroknop3'].forEach((btnKey, idx) => {
    const btnEl = heroBtns[idx];
    const cfg = homeMap[btnKey];
    if (!btnEl || !cfg) return;

    if (!isRowVisible(cfg.tonen) || !cfg.titel) {
      btnEl.style.display = 'none';
    } else {
      btnEl.style.display = '';
      const span = btnEl.querySelector('span');
      if (span) span.textContent = cfg.titel;
      else btnEl.textContent = cfg.titel;

      if (cfg.linkOfFoto) {
        btnEl.href = cfg.linkOfFoto;
        if (cfg.linkOfFoto.startsWith('http')) {
          btnEl.setAttribute('target', '_blank');
          btnEl.setAttribute('rel', 'noopener');
        } else {
          btnEl.removeAttribute('target');
          btnEl.removeAttribute('rel');
        }
      }
    }
  });

  // -------------------------------------------------------------------------
  // D. HERO FOTO & BADGE RECHTS
  // -------------------------------------------------------------------------
  if (homeMap.herofoto) {
    const hf = homeMap.herofoto;
    const heroImg = document.querySelector('.hero-image-frame img');
    const cornerBadge = document.querySelector('.hero-corner-badge');
    const cornerIcon = document.querySelector('.hero-corner-icon');
    const cornerTitle = document.querySelector('.hero-corner-title');
    const cornerSub = document.querySelector('.hero-corner-sub');

    if (heroImg && hf.linkOfFoto) {
      heroImg.src = hf.linkOfFoto;
    }
    if (cornerBadge) {
      if (!isRowVisible(hf.tonen)) {
        cornerBadge.style.display = 'none';
      } else {
        cornerBadge.style.display = '';
        if (cornerIcon && hf.extra) cornerIcon.textContent = hf.extra;
        if (cornerTitle && hf.titel) cornerTitle.textContent = hf.titel;
        if (cornerSub && hf.tekst) cornerSub.textContent = hf.tekst;
      }
    }
  }

  // -------------------------------------------------------------------------
  // E. 4 STATISTIEKEN ONDERAAN HERO (Stat1 t/m Stat4)
  // -------------------------------------------------------------------------
  const statItems = document.querySelectorAll('.hero-stats-bar .hero-stat-item');
  ['stat1', 'stat2', 'stat3', 'stat4'].forEach((stKey, idx) => {
    const stEl = statItems[idx];
    const cfg = homeMap[stKey];
    if (!stEl || !cfg) return;

    if (!isRowVisible(cfg.tonen) || !cfg.titel) {
      stEl.style.display = 'none';
    } else {
      stEl.style.display = '';
      const numEl = stEl.querySelector('.hero-stat-num');
      const lblEl = stEl.querySelector('.hero-stat-lbl');
      if (numEl && cfg.titel) numEl.textContent = cfg.titel;
      if (lblEl && cfg.tekst) lblEl.textContent = cfg.tekst;
    }
  });

  // -------------------------------------------------------------------------
  // F. COUNTDOWN EVENT BANNER(S) (Toevoegen, aanpassen of verwijderen!)
  // -------------------------------------------------------------------------
  const activeBanners = bannerRows.filter(b => isRowVisible(b.tonen) && b.titel);

  // Stop standaard countdown-timers uit main.js / mobile.js zodat onze dynamische timer het overneemt
  if (window.ksaDesktopCountdownInterval) {
    clearInterval(window.ksaDesktopCountdownInterval);
  }
  if (window.ksaMobileCountdownInterval) {
    clearInterval(window.ksaMobileCountdownInterval);
  }
  if (window.ksaCustomBannerInterval) {
    clearInterval(window.ksaCustomBannerInterval);
  }

  // 1. Desktop Countdown Banner Container (.countdown-banner-wrap)
  const desktopBannerWrap = document.querySelector('.countdown-banner-wrap');
  if (desktopBannerWrap) {
    if (activeBanners.length === 0) {
      // Volledig verbergen als alle banners op 'Nee' staan of verwijderd zijn
      desktopBannerWrap.style.display = 'none';
      desktopBannerWrap.innerHTML = '';
    } else {
      desktopBannerWrap.style.display = '';
      desktopBannerWrap.innerHTML = activeBanners.map((b, idx) => {
        const targetDate = parseFlexibleCountdownDate(b.datumUur);
        const targetMs = targetDate ? targetDate.getTime() : 0;
        const badgeText = b.extra || '🔥 GROOT KSA ZONHOVEN EVENEMENT';
        const btnLink = b.linkOfFoto || '#nieuws';
        const btnText = b.knopTekst || '';
        const isExt = btnLink.startsWith('http');
        const marginStyle = idx > 0 ? 'style="margin-top: 20px;"' : '';

        return `
          <div class="ksa-event-banner" ${marginStyle} ${targetMs ? `data-countdown-target="${targetMs}"` : ''}>
            <div>
              ${badgeText ? `<span class="event-banner-tag">${badgeText}</span>` : ''}
              <h2 class="event-banner-title">${b.titel}</h2>
              ${b.tekst ? `<p class="event-banner-desc">${b.tekst}</p>` : ''}
            </div>

            ${targetMs ? `
              <div class="countdown-grid">
                <div class="countdown-tile">
                  <div class="countdown-digit" data-cd-unit="days">--</div>
                  <div class="countdown-label">Dagen</div>
                </div>
                <div class="countdown-tile">
                  <div class="countdown-digit" data-cd-unit="hours">--</div>
                  <div class="countdown-label">Uur</div>
                </div>
                <div class="countdown-tile">
                  <div class="countdown-digit" data-cd-unit="minutes">--</div>
                  <div class="countdown-label">Min</div>
                </div>
                <div class="countdown-tile">
                  <div class="countdown-digit" data-cd-unit="seconds">--</div>
                  <div class="countdown-label">Sec</div>
                </div>
              </div>
            ` : ''}

            ${btnText ? `
              <div>
                <a href="${btnLink}" ${isExt ? 'target="_blank" rel="noopener"' : ''} class="btn btn-primary btn-lg" data-confetti>
                  <span>${btnText}</span>
                </a>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  }

  // 2. Mobiele Event Spotlight Card (.mobile-event-card)
  const mobileCard = document.querySelector('.mobile-event-card');
  if (mobileCard) {
    if (activeBanners.length === 0) {
      mobileCard.style.display = 'none';
    } else {
      mobileCard.style.display = '';
      const firstBanner = activeBanners[0];
      const targetDate = parseFlexibleCountdownDate(firstBanner.datumUur);
      const targetMs = targetDate ? targetDate.getTime() : 0;

      if (targetMs) {
        mobileCard.setAttribute('data-countdown-target', String(targetMs));
      } else {
        mobileCard.removeAttribute('data-countdown-target');
      }

      const titleEl = mobileCard.querySelector('.event-title');
      const badgeEl = mobileCard.querySelector('.event-media-badge');
      const metaEl = mobileCard.querySelector('.event-meta');
      const cdRow = mobileCard.querySelector('.event-countdown-row');
      const actionRow = mobileCard.querySelector('.event-action-row');
      const ticketBtn = mobileCard.querySelector('.btn-ticket');
      const imgEl = mobileCard.querySelector('.event-media-img');

      if (titleEl) titleEl.textContent = firstBanner.titel;
      if (badgeEl && firstBanner.datumUur) badgeEl.textContent = `📅 ${firstBanner.datumUur}`;
      if (metaEl && firstBanner.tekst) {
        metaEl.innerHTML = `<div>📍 ${firstBanner.tekst}</div>`;
      }
      if (cdRow) {
        cdRow.style.display = targetMs ? '' : 'none';
        const dEl = document.getElementById('mDays');
        const hEl = document.getElementById('mHours');
        const mEl = document.getElementById('mMinutes');
        const sEl = document.getElementById('mSeconds');
        if (dEl) dEl.setAttribute('data-cd-unit', 'days');
        if (hEl) hEl.setAttribute('data-cd-unit', 'hours');
        if (mEl) mEl.setAttribute('data-cd-unit', 'minutes');
        if (sEl) sEl.setAttribute('data-cd-unit', 'seconds');
      }
      if (actionRow && ticketBtn) {
        if (!firstBanner.knopTekst) {
          actionRow.style.display = 'none';
        } else {
          actionRow.style.display = '';
          ticketBtn.href = firstBanner.linkOfFoto || '#info';
          ticketBtn.innerHTML = firstBanner.knopTekst;
        }
      }
      if (imgEl) {
        const tUp = firstBanner.titel.toUpperCase();
        if (tUp.includes('SPAGHETTI')) imgEl.src = 'assets/images/real_spaghettidag.jpg';
        else if (tUp.includes('STARTDAG')) imgEl.src = 'assets/images/real_startdag.jpg';
        else if (tUp.includes('HALLOKIEN')) imgEl.src = 'assets/images/real_hallokien.jpg';
      }
    }
  }

  // 3. Start live aftelklok voor alle actieve banners (desktop & mobiel)
  function tickAllBannerCountdowns() {
    const now = Date.now();
    document.querySelectorAll('[data-countdown-target]').forEach(container => {
      const targetMs = parseInt(container.getAttribute('data-countdown-target'), 10);
      if (!targetMs || isNaN(targetMs)) return;

      const diff = targetMs - now;
      const dEl = container.querySelector('[data-cd-unit="days"]');
      const hEl = container.querySelector('[data-cd-unit="hours"]');
      const mEl = container.querySelector('[data-cd-unit="minutes"]');
      const sEl = container.querySelector('[data-cd-unit="seconds"]');

      if (diff <= 0) {
        if (dEl) dEl.textContent = '00';
        if (hEl) hEl.textContent = '00';
        if (mEl) mEl.textContent = '00';
        if (sEl) sEl.textContent = '00';
        return;
      }

      const d = Math.floor(diff / (1000 * 60 * 60 * 24));
      const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);

      if (dEl) dEl.textContent = String(d).padStart(2, '0');
      if (hEl) hEl.textContent = String(h).padStart(2, '0');
      if (mEl) mEl.textContent = String(m).padStart(2, '0');
      if (sEl) sEl.textContent = String(s).padStart(2, '0');
    });
  }

  if (activeBanners.length > 0) {
    tickAllBannerCountdowns();
    window.ksaCustomBannerInterval = setInterval(tickAllBannerCountdowns, 1000);
  }
}

/* ==========================================================================
   1. KALENDER SYNC (#agenda)
   ========================================================================== */
async function syncKalenderFromSheets(sheetId) {
  const isKalenderValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    return (hStr.includes('datum') && hStr.includes('titel')) || hStr.includes('onderlijnd') || hStr.includes('emoji');
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.kalender, isKalenderValid);
  if (!rows || rows.length === 0) return;

  const calGrid = document.querySelector('.cal-grid');
  const calList = document.querySelector('.cal-list');
  if (!calGrid && !calList) return;

  // 1. Desktop kalender (.cal-grid) bijwerken
  if (calGrid) {
    let desktopHtml = '';
    rows.forEach(item => {
      const datum = getVal(item, 'Datum', 'col_0');
      const titel = getVal(item, 'Titel', 'Activiteit', 'col_1');
      const status = getVal(item, 'Status', 'col_2').toLowerCase();
      const emoji = getVal(item, 'Emoji', 'Sticker', 'col_3');
      const onderlijnd = getVal(item, 'Onderlijnd', 'col_4').toLowerCase();

      if (!datum && !titel) return;
      if (datum.toLowerCase() === 'datum' && titel.toLowerCase() === 'titel') return;

      const isPast = status.includes('voorbij') || status.includes('past');
      const isCurrent = status.includes('nu') || status.includes('binnenkort') || status.includes('actief') || status.includes('highlight');
      const isUnderline = onderlijnd === 'ja' || onderlijnd === 'yes' || titel.toUpperCase().includes('GEEN KSA');

      let itemClasses = ['cal-item'];
      if (isPast) itemClasses.push('is-past');
      if (isCurrent) itemClasses.push('is-current');

      let textClasses = ['cal-event-text'];
      if (isUnderline) textClasses.push('cal-text-underline');
      if (titel.toUpperCase().includes('HALLOKIEN')) textClasses.push('cal-text-hallokien');
      if (titel.toUpperCase().includes('SPAGHETTI')) textClasses.push('cal-text-spaghetti');
      if (titel.length >= 13) textClasses.push('cal-text-long');

      desktopHtml += `
        <div class="${itemClasses.join(' ')}">
          <div class="cal-date">
            ${isCurrent ? '<span class="cal-excl">!</span> ' : ''}${datum}
          </div>
          <div class="cal-card">
            ${emoji ? `<span class="cal-sticker">${emoji}</span>` : ''}
            <span class="${textClasses.join(' ')}">${titel}</span>
            ${isCurrent ? `<span class="cal-pill-now">Binnenkort!</span>` : ''}
            ${isPast ? `<span style="font-size:0.75rem; color:#888; margin-top:2px;">(Voorbij)</span>` : ''}
          </div>
        </div>
      `;
    });

    if (desktopHtml.trim()) {
      calGrid.innerHTML = desktopHtml;
    }
  }

  // 2. Mobiele kalender (.cal-list) bijwerken
  if (calList) {
    let mobileHtml = '';
    rows.forEach(item => {
      const datum = getVal(item, 'Datum', 'col_0');
      const titel = getVal(item, 'Titel', 'Activiteit', 'col_1');
      const status = getVal(item, 'Status', 'col_2').toLowerCase();
      const emoji = getVal(item, 'Emoji', 'Sticker', 'col_3');

      if (!datum && !titel) return;
      if (datum.toLowerCase() === 'datum' && titel.toLowerCase() === 'titel') return;

      const isPast = status.includes('voorbij') || status.includes('past');
      if (isPast) return; // Op mobiel tonen we enkel komende evenementen

      const isCurrent = status.includes('nu') || status.includes('binnenkort') || status.includes('actief') || status.includes('highlight');

      let day = '';
      let month = 'KSA';
      if (datum.includes('/')) {
        const parts = datum.split('/');
        day = parts[0].trim().padStart(2, '0');
        const mIdx = parseInt(parts[1].trim());
        const months = ['JAN', 'FEB', 'MRT', 'APR', 'MEI', 'JUN', 'JUL', 'AUG', 'SEP', 'OKT', 'NOV', 'DEC'];
        if (!isNaN(mIdx) && mIdx >= 1 && mIdx <= 12) {
          month = months[mIdx - 1];
        } else {
          month = parts[1].trim().toUpperCase();
        }
      } else if (datum.toLowerCase().includes('juli')) {
        day = datum.replace(/[^0-9\-]/g, '') || '11-20';
        month = 'JULI';
      } else {
        day = datum;
      }

      const titelUpper = titel.toUpperCase();
      let category = 'ksa';
      let badgeHtml = '';
      let subtext = 'Aan ons lokaal &bull; Dijkbeemdenweg 8';
      let dateBlockStyle = '';

      if (titelUpper.includes('GEEN KSA')) {
        category = 'special';
        badgeHtml = '<span class="cal-event-badge badge-none">Geen KSA</span>';
        subtext = 'Geen KSA activiteit deze zondag';
        dateBlockStyle = 'style="background:#f1f5f9; color:#64748b;"';
      } else if (titelUpper.includes('HALLOKIEN')) {
        category = 'special';
        badgeHtml = '<span class="cal-event-badge badge-highlight">Binnenkort!</span>';
        subtext = 'Evenementenhal Zonhoven &bull; Deuren 18u30';
      } else if (titelUpper.includes('SPAGHETTI')) {
        category = 'special';
        badgeHtml = '<span class="cal-event-badge badge-highlight">Spaghettidag</span>';
        subtext = 'Lekker eten & gezelligheid aan ons lokaal';
      } else if (titelUpper.includes('ZOMERKAMP') || titelUpper.includes('KAMP')) {
        category = 'special';
        badgeHtml = '<span class="cal-event-badge badge-highlight">Zomerkamp!</span>';
        subtext = 'Het absolute hoogtepunt van ons KSA-jaar!';
      } else {
        category = 'ksa';
        badgeHtml = '<span class="cal-event-badge badge-active">13u30 - 17u00</span>';
        subtext = 'Aan ons lokaal &bull; Dijkbeemdenweg 8';
      }

      mobileHtml += `
        <div class="cal-card-item ${isCurrent ? 'is-current' : ''}" data-category="${category}">
          <div class="cal-date-block" ${dateBlockStyle}>
            <span class="cal-day-num">${day}</span>
            <span class="cal-month-str">${month}</span>
          </div>
          <div class="cal-info-block">
            <div class="cal-event-title-row">
              <span class="cal-event-name">${titel} ${emoji || ''}</span>
              ${badgeHtml}
            </div>
            <div class="cal-event-subtext">${subtext}</div>
          </div>
        </div>
      `;
    });

    if (mobileHtml.trim()) {
      calList.innerHTML = mobileHtml;
      if (typeof window.filterMobileCalendar === 'function') {
        const activeChip = document.querySelector('.cal-filter-chip.active');
        const currentFilter = activeChip ? activeChip.getAttribute('data-filter') : 'all';
        window.filterMobileCalendar(currentFilter);
      }
    }
  }

  // Periode updaten
  const validDates = rows.map(r => getVal(r, 'Datum', 'col_0')).filter(d => d && d.toLowerCase() !== 'datum');
  if (validDates.length > 0) {
    const parseMonth = (str) => {
      const s = String(str).toLowerCase();
      if (s.includes('jan') || s.includes('/ 01') || s.includes('/ 1')) return 'JAN';
      if (s.includes('feb') || s.includes('/ 02') || s.includes('/ 2')) return 'FEB';
      if (s.includes('mrt') || s.includes('maa') || s.includes('/ 03') || s.includes('/ 3')) return 'MRT';
      if (s.includes('apr') || s.includes('/ 04') || s.includes('/ 4')) return 'APR';
      if (s.includes('mei') || s.includes('/ 05') || s.includes('/ 5')) return 'MEI';
      if (s.includes('jun') || s.includes('/ 06') || s.includes('/ 6')) return 'JUNI';
      if (s.includes('jul') || s.includes('/ 07') || s.includes('/ 7')) return 'JULI';
      if (s.includes('aug') || s.includes('/ 08') || s.includes('/ 8')) return 'AUG';
      if (s.includes('sep') || s.includes('/ 09') || s.includes('/ 9')) return 'SEPT';
      if (s.includes('okt') || s.includes('oct') || s.includes('/ 10')) return 'OKT';
      if (s.includes('nov') || s.includes('/ 11')) return 'NOV';
      if (s.includes('dec') || s.includes('/ 12')) return 'DEC';
      return null;
    };
    const firstMonth = parseMonth(validDates[0]);
    const lastMonth = parseMonth(validDates[validDates.length - 1]);
    const subEl = document.querySelector('.cal-poster-sub');
    if (subEl && firstMonth && lastMonth) {
      subEl.textContent = `${firstMonth} – ${lastMonth}`;
    }
  }
}

/* ==========================================================================
   2. NIEUWS SYNC (#nieuws)
   ========================================================================== */
async function syncNieuwsFromSheets(sheetId) {
  const isNieuwsValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    return (hStr.includes('nieuws') || hStr.includes('bericht') || hStr.includes('categorie') || hStr.includes('omschrijving')) && !hStr.includes('activiteit');
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.nieuws, isNieuwsValid);
  if (!rows || rows.length === 0) return;

  const newsGrid = document.querySelector('.news-grid');
  if (newsGrid) {
    let html = '';
    rows.forEach(item => {
      const titel = getVal(item, 'Titel', 'col_0');
      let datum = getVal(item, 'Datum', 'col_1');
      const categorie = getVal(item, 'Categorie', 'col_2') || 'KSA Nieuws';
      const omschrijving = getVal(item, 'Omschrijving', 'Tekst', 'col_3');
      const waar = getVal(item, 'Waar', 'Locatie', 'col_4');
      const uur = getVal(item, 'Uur', 'Tijd', 'col_5');
      const afbeelding = getVal(item, 'Afbeelding', 'Foto', 'col_6') || 'assets/images/groepsfoto.jpg';
      const link = getVal(item, 'Link', 'col_7') || '#contact';
      const linkTekst = getVal(item, 'LinkTekst', 'Knop', 'col_8') || 'Meer info &rarr;';
      const status = getVal(item, 'Status', 'col_9').toLowerCase();

      if (!titel || titel.toLowerCase() === 'titel') return;

      if (typeof datum === 'string' && datum.startsWith('Date(')) {
        const parts = datum.match(/\d+/g);
        if (parts && parts.length >= 3) {
          datum = `${parts[2]}/${parseInt(parts[1]) + 1}/${parts[0]}`;
        }
      }

      const isPast = status.includes('voorbij') || status.includes('past');

      html += `
        <article class="news-card ${isPast ? 'is-past' : ''}">
          <div class="news-media">
            <img src="${afbeelding}" alt="${titel}" onerror="this.src='assets/images/groepsfoto.jpg'">
            <div class="news-badge ${isPast ? '' : 'news-badge-red'}" ${isPast ? 'style="background-color:#555e68; color:#fff;"' : ''}>
              ${isPast ? '🏁 Reeds voorbij' : categorie}
            </div>
            <div class="news-date" ${isPast ? 'style="background-color:rgba(40,40,40,0.85);"' : ''}>
              ${datum} ${isPast ? '(Voorbij)' : ''}
            </div>
          </div>
          <div class="news-content">
            <h3 class="news-card-title" ${isPast ? 'style="color:#4a5568;"' : ''}>${titel}</h3>
            ${(waar || uur) ? `
              <div class="news-meta-details">
                ${waar ? `<div>📍 <strong>Waar:</strong> ${waar}</div>` : ''}
                ${uur ? `<div>⏰ <strong>Tijd:</strong> ${uur}</div>` : ''}
              </div>
            ` : ''}
            <p class="news-snippet">${omschrijving}</p>
            <div class="news-actions">
              <a href="${link}" ${link.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} class="read-more-link">
                ${linkTekst}
              </a>
              ${!isPast && link.startsWith('http') ? `
                <a href="${link}" target="_blank" rel="noopener" class="btn btn-primary btn-sm" data-confetti>
                  <span>${linkTekst.includes('Ticket') ? '🎟️ Tickets' : '✨ Bekijk'}</span>
                </a>
              ` : ''}
            </div>
          </div>
        </article>
      `;
    });

    if (html.trim()) {
      newsGrid.innerHTML = html;
    }
  }
}

/* ==========================================================================
   3. GROEPEN SYNC (#groepen)
   ========================================================================== */
async function syncGroepenFromSheets(sheetId) {
  const isGroepenValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return hStr.includes('groep') || hStr.includes('leeftijd') || rowsStr.includes('kabouter') || rowsStr.includes('sloeber');
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.groepen, isGroepenValid);
  if (!rows || rows.length === 0) return;

  const normalizeGroupKey = (name) => {
    const s = String(name || '').toLowerCase().trim();
    if (s.includes('kabouter')) return 'kabouters';
    if (s.includes('sloeber') || s.includes('springer')) return 'sloebers';
    if (s.includes('roodkap')) return 'roodkapjes';
    if (s.includes('jim')) return 'jim';
    if (s.includes('sim')) return 'sim';
    if (s.includes('kim') || s.includes('+16') || s.includes('plus')) return 'kim';
    return null;
  };

  rows.forEach(item => {
    const rawGroep = getVal(item, 'Groep', 'Naam', 'col_0');
    const groupKey = normalizeGroupKey(rawGroep);
    if (!groupKey) return;

    const leeftijd = getVal(item, 'Leeftijd', 'Leeftijdsgroep', 'col_1');
    const tagline = getVal(item, 'Tagline', 'Slogan', 'col_2');
    const omschrijving = getVal(item, 'Omschrijving', 'Tekst', 'Beschrijving', 'col_3');
    const actStr = getVal(item, 'Activiteiten', 'Voordelen', 'Tags', 'Perks', 'col_4');
    const leidsters = getVal(item, 'Leidsters', 'Leiding', 'col_5');
    const afbeelding = getVal(item, 'Afbeelding', 'Foto', 'col_6');
    const kleur = getVal(item, 'Kleur', 'Kleurcode', 'col_7');

    const perksArray = actStr ? actStr.split(/[,;]/).map(s => s.trim()).filter(Boolean) : null;

    // Desktop data model updaten
    if (window.groupData && window.groupData[groupKey]) {
      const g = window.groupData[groupKey];
      if (leeftijd) g.ageRange = leeftijd;
      if (tagline) g.tagline = tagline;
      if (omschrijving) g.desc = omschrijving;
      if (afbeelding) g.image = afbeelding;
      if (kleur) g.color = kleur;
      if (perksArray && perksArray.length > 0) {
        if (leidsters && !perksArray.some(p => p.toLowerCase().includes('leiding'))) {
          perksArray.push(`Leiding: ${leidsters}`);
        }
        g.perks = perksArray;
      }
    }

    // Mobiel data model updaten
    if (window.mobileGroupData && window.mobileGroupData[groupKey]) {
      const mg = window.mobileGroupData[groupKey];
      if (leeftijd) mg.age = leeftijd;
      if (tagline) mg.tagline = tagline;
      if (omschrijving) mg.desc = omschrijving;
      if (afbeelding) mg.image = afbeelding;
      if (leidsters) mg.leaders = leidsters;
      if (perksArray && perksArray.length > 0) {
        mg.tags = perksArray.map(p => p.startsWith('✨') ? p : `✨ ${p}`);
      }
    }
  });

  // Actieve desktop weergave her-renderen
  const activePill = document.querySelector('.quiz-pill-btn.active, .quiz-age-pill.active');
  const activeKey = activePill ? activePill.getAttribute('data-group') : 'kabouters';
  if (typeof window.renderDesktopGroup === 'function') {
    window.renderDesktopGroup(activeKey);
  }

  // Actieve mobiele weergave her-renderen
  const activeMobileBtn = document.querySelector('.group-select-btn.active');
  const activeMobileKey = activeMobileBtn ? activeMobileBtn.getAttribute('data-group') : 'kabouters';
  if (typeof window.renderMobileGroup === 'function') {
    window.renderMobileGroup(activeMobileKey);
  }
}

/* ==========================================================================
   4. LEIDING SYNC (#leiding) & PASPOORTJES
   ========================================================================== */
async function syncLeidingFromSheets(sheetId) {
  const isLeidingValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return hStr.includes('naam') || hStr.includes('functie') || rowsStr.includes('hoofdleiding') || rowsStr.includes('fien');
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.leiding, isLeidingValid);
  if (!rows || rows.length === 0) return;

  // 1. Hoofdleiding card updaten (desktop & mobiel)
  const hoofdRow = rows.find(r => {
    const gr = getVal(r, 'Groep', 'col_1').toLowerCase();
    const fn = getVal(r, 'Functie', 'col_2').toLowerCase();
    const nm = getVal(r, 'Naam', 'col_0').toLowerCase();
    return gr.includes('hoofd') || fn.includes('hoofd') || nm.includes('fien');
  });

  if (hoofdRow) {
    const naam = getVal(hoofdRow, 'Naam', 'col_0');
    const rol = getVal(hoofdRow, 'Functie', 'col_2') || 'Hoofdleiding KSA Zonhoven';
    const desc = getVal(hoofdRow, 'Omschrijving', 'Tekst', 'col_3');
    const foto = getVal(hoofdRow, 'Foto', 'Afbeelding', 'col_5');
    const email = getVal(hoofdRow, 'Email', 'E-mail', 'col_6') || 'hoofdleiding.ksazonhoven@gmail.com';

    // Desktop
    const hoofdCard = document.querySelector('.leiding-card-hoofd');
    if (hoofdCard) {
      const img = hoofdCard.querySelector('img');
      const nmEl = hoofdCard.querySelector('.leiding-name');
      const rolEl = hoofdCard.querySelector('.leiding-role-tag');
      const descEl = hoofdCard.querySelector('.leiding-desc');
      const btn = hoofdCard.querySelector('a');

      if (img && foto) img.src = foto;
      if (nmEl && naam) nmEl.textContent = naam.toUpperCase();
      if (rolEl && rol) rolEl.textContent = rol;
      if (descEl && desc) descEl.textContent = desc;
      if (btn && email) {
        btn.href = `mailto:${email}`;
        const span = btn.querySelector('span');
        if (span) span.textContent = `✉️ Stuur ${naam.split(' ')[0]} een Mailtje`;
      }
    }

    // Mobiel
    const hoofdMob = document.querySelector('.hoofdleiding-banner');
    if (hoofdMob) {
      const img = hoofdMob.querySelector('.hoofdleiding-photo img');
      const nmEl = hoofdMob.querySelector('.hoofd-name');
      const descEl = hoofdMob.querySelector('.hoofd-desc');
      const btn = hoofdMob.querySelector('.hoofd-actions a');

      if (img && foto) img.src = foto;
      if (nmEl && naam) nmEl.textContent = naam.toUpperCase();
      if (descEl && desc) descEl.textContent = desc;
      if (btn && email) btn.href = `mailto:${email}`;
    }
  }

  // 2. Leidingspaspoorten showcase updaten (.paspoort-grid op desktop)
  const paspoortGrid = document.querySelector('.paspoort-grid');
  if (paspoortGrid) {
    let pGridHtml = '';
    rows.forEach(item => {
      const naam = getVal(item, 'Naam', 'col_0');
      const groep = getVal(item, 'Groep', 'col_1');
      const foto = getVal(item, 'Foto', 'Afbeelding', 'col_5');
      if (!naam || !foto || naam.toLowerCase() === 'naam') return;
      if (groep.toLowerCase().includes('hoofdleiding')) return;

      pGridHtml += `
        <div class="paspoort-card gallery-item" title="Bekijk paspoort van ${naam}">
          <img src="${foto}" alt="Leidingspaspoort ${naam} (${groep})">
          <div class="paspoort-card-badge">🔍 ${naam} &bull; ${groep}</div>
        </div>
      `;
    });

    if (pGridHtml.trim()) {
      paspoortGrid.innerHTML = pGridHtml;
      if (typeof window.initLightbox === 'function') {
        window.initLightbox();
      }
    }
  }

  // 3. Mobiele leidingkaarten updaten (per groep)
  const groupLeaderBlocks = {
    kabouters: document.querySelector('#leader-sec-kabouters .leader-cards-grid'),
    sloebers: document.querySelector('#leader-sec-sloebers .leader-cards-grid'),
    jim: document.querySelector('#leader-sec-jim .leader-cards-grid'),
    sim: document.querySelector('#leader-sec-sim .leader-cards-grid'),
    kim: document.querySelector('#leader-sec-kim .leader-cards-grid')
  };

  const hasAnyBlock = Object.values(groupLeaderBlocks).some(Boolean);
  if (hasAnyBlock) {
    const groupItems = { kabouters: [], sloebers: [], jim: [], sim: [], kim: [] };

    rows.forEach(item => {
      const naam = getVal(item, 'Naam', 'col_0');
      const rawGroep = getVal(item, 'Groep', 'col_1').toLowerCase();
      const foto = getVal(item, 'Foto', 'Afbeelding', 'col_5');
      const rol = getVal(item, 'Functie', 'col_2') || 'Leiding';

      if (!naam || !foto || naam.toLowerCase() === 'naam') return;

      if (rawGroep.includes('kabouter')) groupItems.kabouters.push({ naam, foto, rol });
      else if (rawGroep.includes('sloeber')) groupItems.sloebers.push({ naam, foto, rol });
      else if (rawGroep.includes('jim')) groupItems.jim.push({ naam, foto, rol });
      else if (rawGroep.includes('sim')) groupItems.sim.push({ naam, foto, rol });
      else if (rawGroep.includes('kim') || rawGroep.includes('+16')) groupItems.kim.push({ naam, foto, rol });
    });

    Object.keys(groupLeaderBlocks).forEach(grp => {
      const container = groupLeaderBlocks[grp];
      const items = groupItems[grp];
      if (container && items && items.length > 0) {
        container.innerHTML = items.map(ld => `
          <div class="leader-card-single" data-paspoort="${ld.foto}" data-name="${ld.naam} (${ld.rol})">
            <div class="leader-avatar-circle">
              <img src="${ld.foto}" alt="${ld.naam}" style="object-position: 50% 20%;">
            </div>
            <span class="leader-card-name">${ld.naam}</span>
            <span class="leader-card-role">${ld.rol}</span>
            <span class="leader-card-pill">🔍 Bekijk Paspoort</span>
          </div>
        `).join('');
      }
    });

    if (typeof window.initPaspoortModal === 'function') {
      window.initPaspoortModal();
    }
  }
}

/* ==========================================================================
   5. INFO & INSCHRIJVEN SYNC (#info)
   ========================================================================== */
async function syncInfoFromSheets(sheetId) {
  const isInfoValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return (hStr.includes('onderdeel') || hStr.includes('praktisch')) && (rowsStr.includes('uniform') || rowsStr.includes('zondagen') || rowsStr.includes('ravotstap'));
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.info, isInfoValid);
  if (!rows || rows.length === 0) return;

  const infoMap = {};
  rows.forEach(item => {
    const rawKey = getVal(item, 'Onderdeel', 'Sectie', 'Type', 'col_0').toLowerCase().replace(/[^a-z0-9]/g, '');
    infoMap[rawKey] = {
      titel: getVal(item, 'Titel', 'col_1'),
      tekst: getVal(item, 'Tekst', 'Omschrijving', 'col_2'),
      extra: getVal(item, 'Extra', 'col_3'),
      icoon: getVal(item, 'Icoon', 'col_4')
    };
  });

  // Desktop .info-grid feature cards (Zondagen, Uniform, Kamp)
  const infoCards = document.querySelectorAll('.info-feature-card');
  if (infoCards.length >= 3) {
    if (infoMap.zondagen) {
      const c = infoCards[0];
      const h3 = c.querySelector('h3');
      const p = c.querySelector('p');
      if (h3 && infoMap.zondagen.titel) h3.textContent = infoMap.zondagen.titel.toUpperCase();
      if (p && infoMap.zondagen.tekst) p.innerHTML = infoMap.zondagen.tekst;
    }
    if (infoMap.uniform) {
      const c = infoCards[1];
      const h3 = c.querySelector('h3');
      const p = c.querySelector('p');
      if (h3 && infoMap.uniform.titel) h3.textContent = infoMap.uniform.titel.toUpperCase();
      if (p && infoMap.uniform.tekst) p.innerHTML = infoMap.uniform.tekst;
    }
    if (infoMap.kamp) {
      const c = infoCards[2];
      const h3 = c.querySelector('h3');
      const p = c.querySelector('p');
      if (h3 && infoMap.kamp.titel) h3.textContent = infoMap.kamp.titel.toUpperCase();
      if (p && infoMap.kamp.tekst) p.innerHTML = infoMap.kamp.tekst;
    }
  }

  // Desktop Ravot Stappen in .ravot-steps-row
  const stepTiles = document.querySelectorAll('.ravot-steps-row .ravot-step-tile');
  ['ravotstap1', 'ravotstap2', 'ravotstap3', 'ravotstap4'].forEach((stKey, idx) => {
    if (stepTiles[idx] && infoMap[stKey]) {
      const h5 = stepTiles[idx].querySelector('h5');
      const p = stepTiles[idx].querySelector('p');
      if (h5 && infoMap[stKey].titel) h5.textContent = infoMap[stKey].titel;
      if (p && infoMap[stKey].tekst) p.innerHTML = infoMap[stKey].tekst;
    }
  });

  // Ravot Actie Knop
  if (infoMap.ravotknop) {
    const ravotBtn = document.querySelector('.btn-ravot');
    if (ravotBtn && infoMap.ravotknop.extra) {
      ravotBtn.href = infoMap.ravotknop.extra;
      if (infoMap.ravotknop.titel) {
        const span = ravotBtn.querySelector('span');
        if (span) span.textContent = `🚀 ${infoMap.ravotknop.titel}`;
      }
    }
  }

  // Mobiele info cards in #tab-info
  const mobileZondag = document.querySelector('#tab-info .info-card-box:nth-of-type(1) p');
  if (mobileZondag && infoMap.zondagen && infoMap.zondagen.tekst) {
    mobileZondag.innerHTML = infoMap.zondagen.tekst;
  }
  const mobileUniform = document.querySelector('#tab-info .info-card-box:nth-of-type(2) p');
  if (mobileUniform && infoMap.uniform && infoMap.uniform.tekst) {
    mobileUniform.innerHTML = infoMap.uniform.tekst;
  }
}

/* ==========================================================================
   6. 'T HEEM / ZAALVERHURING SYNC (#verhuring)
   ========================================================================== */
async function syncHeemFromSheets(sheetId) {
  const isHeemValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return hStr.includes('heem') || hStr.includes('zaal') || hStr.includes('faciliteit') || rowsStr.includes('heem') || rowsStr.includes('zaalverhuur');
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.heem, isHeemValid);
  if (!rows || rows.length === 0) return;

  const item = rows[0];
  const titel = getVal(item, 'Titel', 'col_0') || "ZAALVERHURING VZW 'T HEEM";
  const omschrijving = getVal(item, 'Omschrijving', 'Beschrijving', 'col_1');
  const adres = getVal(item, 'Adres', 'col_2') || 'Dijkbeemdenweg 8, 3520 Zonhoven';
  const email = getVal(item, 'Email', 'E-mail', 'col_3') || 'heem.ksazonhoven@gmail.com';
  const website = getVal(item, 'Website', 'Link', 'col_4') || 'https://www.theem.be';
  const afbeelding = getVal(item, 'Afbeelding', 'Foto', 'col_5');
  const faciliteitenStr = getVal(item, 'Faciliteiten', 'col_6');

  // Desktop #verhuring
  const verhuringSec = document.getElementById('verhuring');
  if (verhuringSec) {
    const titleEl = verhuringSec.querySelector('.section-title');
    const descEl = verhuringSec.querySelector('p:first-of-type');
    const adresLink = verhuringSec.querySelector('a[href*="maps"]');
    const emailLink = verhuringSec.querySelector('a[href^="mailto:heem"]');
    const webBtn = verhuringSec.querySelector('a[href*="theem.be"]');
    const imgEl = verhuringSec.querySelector('.verhuring-box img');
    const listEl = verhuringSec.querySelector('.verhuring-box ul');

    if (titleEl && titel) titleEl.textContent = titel.toUpperCase();
    if (descEl && omschrijving) descEl.textContent = omschrijving;
    if (adresLink && adres) {
      const span = adresLink.querySelector('span:first-child');
      if (span) span.textContent = `📍 ${adres}`;
    }
    if (emailLink && email) {
      emailLink.href = `mailto:${email}`;
      emailLink.textContent = email;
    }
    if (webBtn && website) webBtn.href = website;
    if (imgEl && afbeelding) imgEl.src = afbeelding;

    if (listEl && faciliteitenStr) {
      const facs = faciliteitenStr.split(/[,;]/).map(s => s.trim()).filter(Boolean);
      if (facs.length > 0) {
        listEl.innerHTML = facs.map(f => `<li>✔️ ${f}</li>`).join('');
      }
    }
  }

  // Mobiel 't Heem blok in #tab-info
  const mobileHeemBox = Array.from(document.querySelectorAll('#tab-info .info-card-box')).find(box => {
    return box.textContent.includes("'t Heem") || box.textContent.includes('Zaalverhuur');
  });

  if (mobileHeemBox) {
    const descP = mobileHeemBox.querySelector('p');
    const emailA = mobileHeemBox.querySelector('a[href^="mailto:heem"]');
    const webAs = mobileHeemBox.querySelectorAll('a[href*="theem.be"]');
    const imgEl = mobileHeemBox.querySelector('img');

    if (descP && omschrijving) descP.textContent = omschrijving;
    if (emailA && email) {
      emailA.href = `mailto:${email}`;
      emailA.textContent = email;
    }
    if (webAs.length && website) {
      webAs.forEach(a => a.href = website);
    }
    if (imgEl && afbeelding) imgEl.src = afbeelding;
  }
}

/* ==========================================================================
   7. CONTACT SYNC (#contact)
   ========================================================================== */
async function syncContactFromSheets(sheetId) {
  const isContactValid = (rows, headers) => {
    const hStr = headers.join(' ').toLowerCase();
    const rowsStr = rows.map(r => Object.values(r).join(' ')).join(' ').toLowerCase();
    return (hStr.includes('contact') || hStr.includes('waarde')) && (rowsStr.includes('lokaal') || rowsStr.includes('hotmail') || rowsStr.includes('facebook'));
  };

  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabs.contact, isContactValid);
  if (!rows || rows.length === 0) return;

  const contactMap = {};
  rows.forEach(item => {
    const rawKey = getVal(item, 'Onderdeel', 'Type', 'Platform', 'col_0').toLowerCase().replace(/[^a-z0-9]/g, '');
    contactMap[rawKey] = {
      titel: getVal(item, 'Titel', 'col_1'),
      waarde: getVal(item, 'Waarde', 'Gegevens', 'col_2'),
      link: getVal(item, 'Link', 'col_3'),
      icoon: getVal(item, 'Icoon', 'col_4')
    };
  });

  // Desktop Contact Tiles in #contact
  const contactTiles = document.querySelectorAll('.contact-tile-card');
  contactTiles.forEach(tile => {
    const h5 = tile.querySelector('h5');
    if (!h5) return;
    const h5Text = h5.textContent.toLowerCase();

    // 1. Adres
    if ((h5Text.includes('lokaal') || h5Text.includes('adres')) && contactMap.adres) {
      if (contactMap.adres.titel) h5.textContent = contactMap.adres.titel;
      const p = tile.querySelector('p');
      if (p && contactMap.adres.waarde) p.textContent = contactMap.adres.waarde;
      if (tile.tagName === 'A' && contactMap.adres.link) tile.href = contactMap.adres.link;
    }
    // 2. Hoofdleiding Email
    else if (h5Text.includes('hoofd') && contactMap.hoofdleiding) {
      if (contactMap.hoofdleiding.titel) h5.textContent = contactMap.hoofdleiding.titel;
      const a = tile.querySelector('a');
      if (a) {
        if (contactMap.hoofdleiding.waarde) a.textContent = contactMap.hoofdleiding.waarde;
        if (contactMap.hoofdleiding.link) a.href = contactMap.hoofdleiding.link;
      }
    }
    // 3. Algemeen Email
    else if (h5Text.includes('algemeen') && contactMap.email) {
      if (contactMap.email.titel) h5.textContent = contactMap.email.titel;
      const a = tile.querySelector('a');
      if (a) {
        if (contactMap.email.waarde) a.textContent = contactMap.email.waarde;
        if (contactMap.email.link) a.href = contactMap.email.link;
      }
    }
    // 4. Ravotshop
    else if (h5Text.includes('ravotshop') && contactMap.ravotshop) {
      if (contactMap.ravotshop.titel) h5.textContent = contactMap.ravotshop.titel;
      const a = tile.querySelector('a');
      if (a) {
        if (contactMap.ravotshop.waarde) a.textContent = contactMap.ravotshop.waarde;
        if (contactMap.ravotshop.link) a.href = contactMap.ravotshop.link;
      }
    }
    // 5. Facebook
    else if (h5Text.includes('facebook') && contactMap.facebook) {
      if (contactMap.facebook.titel) h5.textContent = contactMap.facebook.titel;
      const a = tile.querySelector('a');
      if (a) {
        if (contactMap.facebook.waarde) a.textContent = contactMap.facebook.waarde;
        if (contactMap.facebook.link) a.href = contactMap.facebook.link;
      }
    }
  });

  // Mobiel Contact blok in #tab-info
  const mobileContactBox = Array.from(document.querySelectorAll('#tab-info .info-card-box')).find(box => {
    return box.textContent.includes('Contact & Vragen');
  });

  if (mobileContactBox) {
    if (contactMap.hoofdleiding) {
      const emailA = mobileContactBox.querySelector('a[href^="mailto:hoofdleiding"]');
      if (emailA) {
        if (contactMap.hoofdleiding.waarde) emailA.textContent = contactMap.hoofdleiding.waarde;
        if (contactMap.hoofdleiding.link) emailA.href = contactMap.hoofdleiding.link;
      }
    }
    if (contactMap.adres) {
      const adresA = mobileContactBox.querySelector('a[href*="maps"]');
      if (adresA) {
        if (contactMap.adres.waarde) adresA.textContent = contactMap.adres.waarde;
        if (contactMap.adres.link) adresA.href = contactMap.adres.link;
      }
    }
  }
}

/* ==========================================================================
   INITIALISATIE VAN DE COMPLETE CMS SYNC
   ========================================================================== */
async function initKsaSheetsCMS() {
  if (!KSA_SHEETS_CONFIG.enabled || !KSA_SHEETS_CONFIG.sheetId) {
    return;
  }

  // Alle 8 onderdelen (Home + 7 menu-onderdelen) parallel synchroniseren
  await Promise.allSettled([
    syncHomeFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncKalenderFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncNieuwsFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncGroepenFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncLeidingFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncInfoFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncHeemFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncContactFromSheets(KSA_SHEETS_CONFIG.sheetId)
  ]);
}

// Uitvoeren zodra DOM gereed is
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKsaSheetsCMS);
  } else {
    initKsaSheetsCMS();
  }
}
