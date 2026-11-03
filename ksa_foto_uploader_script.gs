/**
 * ============================================================================
 * 📸 KSA ZONHOVEN - 1-KLIK FOTO UPLOADER VOOR GOOGLE SHEETS
 * ============================================================================
 * HOE INSTALLEREN (SLECHTS 1 KEER NODIG - DUURT 30 SECONDEN):
 * 1. Open de KSA Zonhoven Google Sheet.
 * 2. Klik bovenaan in het menu op: Uitbreidingen (Extensions) -> Apps Script.
 * 3. Verwijder de eventuele korte standaardcode die daar staat.
 * 4. Plak dit VOLLEDIGE bestand in het tekstvak en klik bovenaan op het
 *    diskette-icoontje "Project opslaan" (Ctrl+S).
 * 5. Herlaad (F5) de Google Sheet. Er verschijnt nu bovenaan in de menubalk
 *    automatisch een nieuwe knop: "📸 KSA Foto's"!
 * ============================================================================
 */

const KSA_DRIVE_FOLDER_NAME = 'KSA_Zonhoven_Website_Fotos';

/**
 * Voegt automatisch het menu "📸 KSA Foto's" toe zodra de Google Sheet opent.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("📸 KSA Foto's")
    .addItem('📤 Foto uploaden naar geselecteerde cel...', 'openUploadDialog')
    .addItem('📌 Open Foto-Uploader Zijpaneel (voor meerdere foto\'s)', 'openUploadSidebar')
    .addSeparator()
    .addItem('ℹ️ Hoe werkt het?', 'showPhotoHelp')
    .addToUi();
}

/**
 * Opent een centraal pop-up venster om direct een foto te kiezen van PC of GSM.
 */
function openUploadDialog() {
  const html = HtmlService.createHtmlOutput(getUploaderHtml())
    .setWidth(480)
    .setHeight(560)
    .setTitle("📸 KSA Foto Uploaden");
  SpreadsheetApp.getUi().showModalDialog(html, "📸 Foto toevoegen aan geselecteerde cel");
}

/**
 * Opent het upload-paneel aan de rechterkant van Google Sheets (handig voor meerdere foto's).
 */
function openUploadSidebar() {
  const html = HtmlService.createHtmlOutput(getUploaderHtml())
    .setTitle("📸 KSA Foto Uploader");
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * Toont een korte uitleg in Google Sheets.
 */
function showPhotoHelp() {
  SpreadsheetApp.getUi().alert(
    "📸 Hoe voeg je een foto toe?",
    "1. Klik eerst op de cel in het tabblad (bv. kolom 'Afbeelding', 'Foto' of 'Paspoort') waar de foto moet komen.\n\n" +
    "2. Klik bovenaan op '📸 KSA Foto's' -> '📤 Foto uploaden naar geselecteerde cel...'.\n\n" +
    "3. Kies een foto van je computer of smartphone.\n\n" +
    "4. De foto wordt automatisch opgeslagen in Google Drive en de juiste link wordt vanzelf in de cel ingevuld!",
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Geeft informatie terug over de momenteel geselecteerde cel in Google Sheets.
 */
function getSelectedCellInfo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cell = sheet.getActiveCell();
  const row = cell.getRow();
  const col = cell.getColumn();
  const colHeader = String(sheet.getRange(1, col).getValue() || '').trim();
  const rowLabel = String(sheet.getRange(row, 1).getValue() || '').trim();

  return {
    sheetName: sheet.getName(),
    cellA1: cell.getA1Notation(),
    row: row,
    col: col,
    colHeader: colHeader || ('Kolom ' + col),
    rowLabel: rowLabel || ('Rij ' + row),
    currentValue: String(cell.getValue() || '')
  };
}

/**
 * Zoekt of maakt de gedeelde Google Drive map 'KSA_Zonhoven_Website_Fotos' aan.
 */
function getOrCreateKsaPhotoFolder_() {
  const folders = DriveApp.getFoldersByName(KSA_DRIVE_FOLDER_NAME);
  let folder;
  if (folders.hasNext()) {
    folder = folders.next();
  } else {
    folder = DriveApp.createFolder(KSA_DRIVE_FOLDER_NAME);
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  }
  return folder;
}

/**
 * Ontvangt de geüploade foto (base64), slaat deze op in Google Drive,
 * maakt deze publiek zichtbaar voor de website, en vult de actieve cel in!
 */
function uploadPhotoToActiveCell(base64Data, fileName, mimeType) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getActiveSheet();
  const cell = sheet.getActiveCell();

  if (cell.getRow() === 1) {
    throw new Error("Je hebt rij 1 (de blauwe kolomtitel) geselecteerd. Klik eerst op een cel daaronder (vanaf rij 2)!");
  }

  const folder = getOrCreateKsaPhotoFolder_();
  const cleanName = (fileName || 'ksa_foto.jpg').replace(/[^a-zA-Z0-9._-]/g, '_');
  const timestampedName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmm_") + cleanName;

  const bytes = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(bytes, mimeType || 'image/jpeg', timestampedName);

  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  // Rechtstreekse snelle Google CDN afbeeldingslink die op elke browser en GSM werkt:
  const directImageUrl = "https://lh3.googleusercontent.com/d/" + fileId + "=w1200";

  cell.setValue(directImageUrl);
  SpreadsheetApp.flush();

  return {
    success: true,
    url: directImageUrl,
    fileName: file.getName(),
    sheetName: sheet.getName(),
    cellA1: cell.getA1Notation()
  };
}

/**
 * Haalt de laatste 20 geüploade foto's op uit de KSA Drive-map zodat je ze ook met 1 klik kunt hergebruiken.
 */
function listRecentKsaPhotos() {
  const folder = getOrCreateKsaPhotoFolder_();
  const files = folder.getFiles();
  const result = [];

  while (files.hasNext() && result.length < 20) {
    const f = files.next();
    const mime = f.getMimeType() || '';
    if (mime.indexOf('image/') === 0) {
      const id = f.getId();
      result.push({
        id: id,
        name: f.getName(),
        url: "https://lh3.googleusercontent.com/d/" + id + "=w1200",
        thumb: "https://lh3.googleusercontent.com/d/" + id + "=w300"
      });
    }
  }
  return result;
}

/**
 * Plaatst een reeds gekozen foto-URL rechtstreeks in de momenteel geselecteerde cel.
 */
function setUrlInActiveCell(imageUrl) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const cell = sheet.getActiveCell();

  if (cell.getRow() === 1) {
    throw new Error("Klik eerst op een cel onder de blauwe titelbalk (vanaf rij 2)!");
  }

  cell.setValue(imageUrl);
  SpreadsheetApp.flush();

  return {
    sheetName: sheet.getName(),
    cellA1: cell.getA1Notation()
  };
}

/**
 * De ingebouwde HTML & JavaScript interface voor het upload-venster.
 */
function getUploaderHtml() {
  return `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }
    body { margin: 0; padding: 16px; background: #f8fafc; color: #1e293b; }
    .target-box {
      background: #e0f2fe;
      border: 1px solid #7dd3fc;
      border-radius: 10px;
      padding: 10px 12px;
      margin-bottom: 14px;
      font-size: 13px;
    }
    .target-box strong { color: #0369a1; }
    .refresh-btn {
      background: none; border: none; color: #0284c7; cursor: pointer;
      font-size: 12px; text-decoration: underline; padding: 0; float: right;
    }
    .drop-zone {
      border: 2px dashed #0055a5;
      border-radius: 14px;
      background: #ffffff;
      padding: 24px 16px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .drop-zone:hover, .drop-zone.dragover {
      background: #f0f7ff;
      border-color: #e3001b;
    }
    .drop-icon { font-size: 38px; margin-bottom: 8px; display: block; }
    .drop-title { font-weight: 700; font-size: 15px; color: #0055a5; margin-bottom: 4px; }
    .drop-sub { font-size: 12px; color: #64748b; }
    #fileInput { display: none; }
    .preview-wrap {
      display: none;
      margin-top: 14px;
      text-align: center;
      background: #fff;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .preview-wrap img {
      max-width: 100%;
      max-height: 160px;
      border-radius: 8px;
      object-fit: cover;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .btn-upload {
      display: block;
      width: 100%;
      margin-top: 12px;
      padding: 12px;
      background: #e3001b;
      color: #ffffff;
      font-weight: 700;
      font-size: 14px;
      border: none;
      border-radius: 999px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(227, 0, 27, 0.25);
    }
    .btn-upload:disabled { background: #94a3b8; cursor: not-allowed; box-shadow: none; }
    .status-msg {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      display: none;
    }
    .status-ok { display: block; background: #dcfce7; color: #166534; border: 1px solid #86efac; }
    .status-err { display: block; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }
    .status-wait { display: block; background: #fef9c3; color: #854d0e; border: 1px solid #fde047; }
    .section-title {
      margin-top: 18px;
      margin-bottom: 8px;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      color: #475569;
      letter-spacing: 0.5px;
    }
    .gallery-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      max-height: 150px;
      overflow-y: auto;
      padding: 4px;
    }
    .gallery-item {
      border: 2px solid transparent;
      border-radius: 8px;
      overflow: hidden;
      cursor: pointer;
      background: #fff;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      transition: transform 0.15s;
    }
    .gallery-item:hover { transform: scale(1.04); border-color: #0055a5; }
    .gallery-item img { width: 100%; height: 64px; object-fit: cover; display: block; }
  </style>
</head>
<body>

  <div class="target-box">
    <button class="refresh-btn" onclick="refreshCellInfo()" title="Vernieuw geselecteerde cel">🔄 Ververs</button>
    <div>Geselecteerde cel: <strong id="cellLabel">Laden...</strong></div>
    <div id="cellContext" style="font-size:12px; color:#475569; margin-top:2px;"></div>
  </div>

  <div class="drop-zone" id="dropZone" onclick="document.getElementById('fileInput').click()">
    <span class="drop-icon">📸</span>
    <div class="drop-title">Klik hier om een foto te kiezen</div>
    <div class="drop-sub">of sleep een foto vanaf je computer of GSM hierheen</div>
    <input type="file" id="fileInput" accept="image/*">
  </div>

  <div class="preview-wrap" id="previewWrap">
    <img id="previewImg" src="" alt="Voorbeeld">
    <div id="previewName" style="font-size:12px; color:#64748b; margin-top:6px;"></div>
    <button class="btn-upload" id="uploadBtn" onclick="startUpload()">
      🚀 Foto opslaan &amp; in deze cel zetten
    </button>
  </div>

  <div id="statusBox" class="status-msg"></div>

  <div class="section-title">🖼️ Of klik op een eerder geüploade foto:</div>
  <div id="galleryGrid" class="gallery-grid">
    <div style="font-size:12px; color:#94a3b8; grid-column: span 3;">Eerdere foto's laden...</div>
  </div>

  <script>
    let preparedBase64 = null;
    let preparedFileName = '';
    let preparedMimeType = 'image/jpeg';

    function refreshCellInfo() {
      google.script.run.withSuccessHandler(info => {
        document.getElementById('cellLabel').textContent = info.sheetName + ' ! ' + info.cellA1;
        document.getElementById('cellContext').textContent =
          'Kolom: ' + info.colHeader + ' • Onderwerp: ' + info.rowLabel;
      }).getSelectedCellInfo();
    }

    function loadGallery() {
      google.script.run.withSuccessHandler(items => {
        const grid = document.getElementById('galleryGrid');
        if (!items || items.length === 0) {
          grid.innerHTML = '<div style="font-size:12px; color:#94a3b8; grid-column: span 3;">Nog geen foto\\'s in de KSA Drive-map.</div>';
          return;
        }
        grid.innerHTML = items.map(it =>
          '<div class="gallery-item" title="Klik om ' + it.name + ' in de cel te zetten" onclick="useExisting(\\'' + it.url + '\\')">' +
            '<img src="' + it.thumb + '" alt="' + it.name + '">' +
          '</div>'
        ).join('');
      }).listRecentKsaPhotos();
    }

    function useExisting(url) {
      showStatus('wait', '⏳ Foto wordt in de geselecteerde cel gezet...');
      google.script.run
        .withSuccessHandler(res => {
          showStatus('ok', '✅ Foto geplaatst in ' + res.sheetName + ' (' + res.cellA1 + ')!');
          refreshCellInfo();
        })
        .withFailureHandler(err => {
          showStatus('err', '❌ ' + (err.message || err));
        })
        .setUrlInActiveCell(url);
    }

    function showStatus(type, msg) {
      const box = document.getElementById('statusBox');
      box.className = 'status-msg status-' + type;
      box.textContent = msg;
    }

    // Verklein grote smartphone/camera foto's automatisch naar max 1600px voor razendsnelle upload
    function processSelectedFile(file) {
      if (!file || !file.type.startsWith('image/')) {
        showStatus('err', '❌ Kies een geldig afbeeldingsbestand (JPG, PNG, WEBP).');
        return;
      }
      preparedFileName = file.name.replace(/\\.[^.]+$/, '') + '.jpg';
      preparedMimeType = 'image/jpeg';

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const maxDim = 1600;
          let w = img.width;
          let h = img.height;
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
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
          preparedBase64 = dataUrl.split(',')[1];

          document.getElementById('previewImg').src = dataUrl;
          document.getElementById('previewName').textContent = file.name + ' (' + w + 'x' + h + ' px)';
          document.getElementById('previewWrap').style.display = 'block';
          showStatus('wait', 'Klaar om op te slaan! Klik op de rode knop hierboven.');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    document.getElementById('fileInput').addEventListener('change', function(e) {
      if (e.target.files && e.target.files[0]) {
        processSelectedFile(e.target.files[0]);
      }
    });

    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', function(e) {
      e.preventDefault();
      dropZone.classList.add('dragover');
    });
    dropZone.addEventListener('dragleave', function() {
      dropZone.classList.remove('dragover');
    });
    dropZone.addEventListener('drop', function(e) {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processSelectedFile(e.dataTransfer.files[0]);
      }
    });

    function startUpload() {
      if (!preparedBase64) return;
      const btn = document.getElementById('uploadBtn');
      btn.disabled = true;
      btn.textContent = '⏳ Bezig met uploaden naar Google Drive...';
      showStatus('wait', '⏳ Foto wordt opgeslagen in Google Drive en gekoppeld aan de cel...');

      google.script.run
        .withSuccessHandler(res => {
          btn.disabled = false;
          btn.textContent = '🚀 Foto opslaan & in deze cel zetten';
          showStatus('ok', '✅ Gelukt! De foto staat nu in ' + res.sheetName + ' (' + res.cellA1 + ') en is direct zichtbaar op de website!');
          refreshCellInfo();
          loadGallery();
        })
        .withFailureHandler(err => {
          btn.disabled = false;
          btn.textContent = '🚀 Foto opslaan & in deze cel zetten';
          showStatus('err', '❌ Fout: ' + (err.message || err));
        })
        .uploadPhotoToActiveCell(preparedBase64, preparedFileName, preparedMimeType);
    }

    // Init
    refreshCellInfo();
    loadGallery();
  </script>
</body>
</html>`;
}

