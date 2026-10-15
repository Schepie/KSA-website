/**
 * ==========================================================================
 * KSA ZONHOVEN - GOOGLE SHEETS "HEADLESS CMS" SYNC
 * ==========================================================================
 * Hiermee kan de leidingsploeg zonder enige technische kennis de website
 * live bijwerken via een eenvoudige Google Sheet op computer of smartphone!
 * 
 * Geen API keys nodig, 100% gratis en direct actief.
 */

const KSA_SHEETS_CONFIG = {
  // Gekoppeld aan de live KSA Zonhoven Google Sheet
  sheetId: '1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4', 

  // Namen van de tabbladen in de Google Sheet
  tabKalender: 'Kalender',
  tabNieuws: 'Nieuws',

  // Schakel in of uit
  enabled: true
};

/**
 * Haal data op van een Google Sheet tabblad via de Google Visualization API
 */
async function fetchGoogleSheetData(sheetId, tabName) {
  if (!sheetId) return null;
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(tabName)}&t=${Date.now()}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    const text = await res.text();
    
    // Parse Google's response: /*O_o*/ google.visualization.Query.setResponse({...});
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');
    if (jsonStart === -1 || jsonEnd === -1) return null;
    
    const jsonString = text.substring(jsonStart, jsonEnd + 1);
    const data = JSON.parse(jsonString);
    
    if (!data.table || !data.table.rows) return null;
    
    // Kolomkoppen bepalen:
    // 1. Kijken of data.table.cols gevuld is
    let headers = (data.table.cols || []).map(c => (c.label || '').trim());
    let dataRows = data.table.rows;
    
    const hasColHeaders = headers.some(h => h.length > 0);
    if (!hasColHeaders && dataRows.length > 0) {
      // De eerste rij in rows bevat de kolomnamen!
      headers = dataRows[0].c.map(cell => (cell && cell.v !== null && cell.v !== undefined) ? String(cell.v).trim() : '');
      dataRows = dataRows.slice(1); // Sla de koprij over
    }
    
    // Rijen converteren naar handige objecten
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
        rowObj[`col_${idx}`] = cleanVal; // Altijd ook positioneel beschikbaar
      });
      return rowObj;
    });

    return rows;
  } catch (err) {
    console.warn(`[KSA Sheets] Fout bij ophalen tabblad ${tabName}:`, err);
    return null;
  }
}

/**
 * Synchroniseer Kalender vanaf Google Sheets
 * Kolommen verwacht in Sheet:
 * - Datum (bv. "17 / 10" of "17/10/2026")
 * - Titel (bv. "HALLOKIEN", "STARTDAG", "GEEN KSA")
 * - Status (bv. "Voorbij", "Nu", "Binnenkort", of leeg)
 * - Emoji (bv. "🎃", "🎟️", "🍝")
 * - Onderlijnd (Ja / Nee)
 */
async function syncKalenderFromSheets(sheetId) {
  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabKalender);
  if (!rows || rows.length === 0) return;

  const calGrid = document.querySelector('.cal-grid');
  if (!calGrid) return;

  let html = '';
  rows.forEach(item => {
    // Veldnamen flexibel matchen
    const datum = item['Datum'] || item['datum'] || item['col_0'] || '';
    const titel = item['Titel'] || item['titel'] || item['Activiteit'] || item['col_1'] || '';
    const status = String(item['Status'] || item['status'] || item['col_2'] || '').toLowerCase();
    const emoji = item['Emoji'] || item['emoji'] || item['Sticker'] || item['col_3'] || '';
    const onderlijnd = String(item['Onderlijnd'] || item['onderlijnd'] || item['col_4'] || '').toLowerCase();

    if (!datum && !titel) return;
    if (datum.toLowerCase() === 'datum' && titel.toLowerCase() === 'titel') return; // Header skip

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

    html += `
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

  if (html.trim()) {
    calGrid.innerHTML = html;
  }

  // Automatisch de periode (maanden) detecteren en bijwerken in de titel
  const validDates = [];
  rows.forEach(item => {
    const datum = item['Datum'] || item['datum'] || item['col_0'] || '';
    const titel = item['Titel'] || item['titel'] || item['col_1'] || '';
    if (datum && titel && datum.toLowerCase() !== 'datum') {
      validDates.push(datum);
    }
  });

  if (validDates.length > 0) {
    const parseMonth = (str) => {
      const s = String(str).toLowerCase();
      if (s.includes('jan') || s.includes('/ 01') || s.includes('/01') || s.includes('/ 1') || s.includes('/1')) return 'JAN';
      if (s.includes('feb') || s.includes('/ 02') || s.includes('/02') || s.includes('/ 2') || s.includes('/2')) return 'FEB';
      if (s.includes('mrt') || s.includes('maa') || s.includes('/ 03') || s.includes('/03') || s.includes('/ 3') || s.includes('/3')) return 'MRT';
      if (s.includes('apr') || s.includes('/ 04') || s.includes('/04') || s.includes('/ 4') || s.includes('/4')) return 'APR';
      if (s.includes('mei') || s.includes('/ 05') || s.includes('/05') || s.includes('/ 5') || s.includes('/5')) return 'MEI';
      if (s.includes('jun') && !s.includes('jul') || s.includes('/ 06') || s.includes('/06') || s.includes('/ 6') || s.includes('/6')) return 'JUNI';
      if (s.includes('jul') || s.includes('/ 07') || s.includes('/07') || s.includes('/ 7') || s.includes('/7')) return 'JULI';
      if (s.includes('aug') || s.includes('/ 08') || s.includes('/08') || s.includes('/ 8') || s.includes('/8')) return 'AUG';
      if (s.includes('sep') || s.includes('/ 09') || s.includes('/09') || s.includes('/ 9') || s.includes('/9')) return 'SEPT';
      if (s.includes('okt') || s.includes('oct') || s.includes('/ 10') || s.includes('/10')) return 'OKT';
      if (s.includes('nov') || s.includes('/ 11') || s.includes('/11')) return 'NOV';
      if (s.includes('dec') || s.includes('/ 12') || s.includes('/12')) return 'DEC';
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

/**
 * Synchroniseer Nieuwsberichten vanaf Google Sheets
 * Kolommen verwacht in Sheet:
 * - Titel
 * - Datum
 * - Categorie (bv. "Kienavond", "Kamp", "Evenement")
 * - Omschrijving
 * - Waar (bv. "Evenementenhal Zonhoven")
 * - Uur (bv. "18u30")
 * - Afbeelding (URL of relatief pad zoals assets/images/real_hallokien.jpg)
 * - Link (bv. https://ravotshop.ksa.be/hallokien)
 * - LinkTekst (bv. "Tickets Bestellen")
 * - Status (bv. "Voorbij" of leeg)
 */
async function syncNieuwsFromSheets(sheetId) {
  const rows = await fetchGoogleSheetData(sheetId, KSA_SHEETS_CONFIG.tabNieuws);
  if (!rows || rows.length === 0) return;

  const newsGrid = document.querySelector('.news-grid');
  if (!newsGrid) return;

  let html = '';
  rows.forEach(item => {
    const titel = item['Titel'] || item['titel'] || item['col_0'] || '';
    let datum = item['Datum'] || item['datum'] || item['col_1'] || '';
    const categorie = item['Categorie'] || item['categorie'] || item['col_2'] || 'KSA Nieuws';
    const omschrijving = item['Omschrijving'] || item['omschrijving'] || item['Tekst'] || item['col_3'] || '';
    const waar = item['Waar'] || item['Locatie'] || item['col_4'] || '';
    const uur = item['Uur'] || item['Tijd'] || item['col_5'] || '';
    const afbeelding = item['Afbeelding'] || item['afbeelding'] || item['Foto'] || item['col_6'] || 'assets/images/groepsfoto.jpg';
    const link = item['Link'] || item['link'] || item['col_7'] || '#contact';
    const linkTekst = item['LinkTekst'] || item['linktekst'] || item['Knop'] || item['col_8'] || 'Meer info &rarr;';
    const status = String(item['Status'] || item['status'] || item['col_9'] || '').toLowerCase();

    if (!titel) return;
    if (titel.toLowerCase() === 'titel') return; // Header skip

    // Datum formatting if Google returns Date(yyyy,m,d)
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

/**
 * Start synchronisatie
 */
async function initKsaSheetsCMS() {
  if (!KSA_SHEETS_CONFIG.enabled || !KSA_SHEETS_CONFIG.sheetId) {
    // Geen sheetId ingevuld; behoud de standaard statische inhoud in HTML
    return;
  }

  // Voer beide parallel uit
  await Promise.allSettled([
    syncKalenderFromSheets(KSA_SHEETS_CONFIG.sheetId),
    syncNieuwsFromSheets(KSA_SHEETS_CONFIG.sheetId)
  ]);
}

// Uitvoeren zodra DOM geladen is
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKsaSheetsCMS);
} else {
  initKsaSheetsCMS();
}
