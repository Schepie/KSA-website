# 📋 KSA Zonhoven - Google Sheets Website Beheer

Met deze koppeling kan de leidingsploeg de **Kalender** en het **Nieuws** van de website rechtstreeks bijwerken via Google Sheets, zonder enige technische kennis!

## 🔗 Jullie Actieve Google Sheet

👉 **[Klik hier om de KSA Zonhoven Google Sheet te openen](https://docs.google.com/spreadsheets/d/1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4/edit)**

De website is al **volledig gekoppeld** aan deze sheet! Zodra jij of de leidsters hier iets aanpassen, staat het direct live op de website.

---

### Stap 2: Vul de kolomkoppen in (zie hieronder)

#### 📅 Tabblad 1: `Kalender`
Zet op de **eerste rij (Rij 1)** van het tabblad `Kalender` de volgende kolomnamen:

| Datum | Titel | Status | Emoji | Onderlijnd |
| :--- | :--- | :--- | :--- | :--- |
| `17 / 10` | `HALLOKIEN` | `Nu` | `🎃` | `Nee` |
| `18 / 10` | `GEEN KSA` | | | `Ja` |
| `25 / 10` | `KSA` | | | `Nee` |
| `1 / 11` | `GEEN KSA` | | | `Ja` |
| `20 / 09` | `STARTDAG` | `Voorbij` | | `Nee` |

* **Datum**: bv. `17 / 10`, `8 / 11`, `11-20 Juli`
* **Titel**: Naam van de activiteit
* **Status**: 
  * `Nu` of `Binnenkort` (krijgt een rood uitroepteken en "Binnenkort!" label)
  * `Voorbij` (wordt grijs en transparant / faded)
  * *Laat leeg voor een gewone activiteit*
* **Emoji**: bv. `🎃`, `🎟️`, `🍝`, `⛺` (of laat leeg)
* **Onderlijnd**: `Ja` als het onderlijnd moet zijn (zoals bij `GEEN KSA`)

---

#### 📰 Tabblad 2: `Nieuws`
Zet op de **eerste rij (Rij 1)** van het tabblad `Nieuws` de volgende kolomnamen:

| Titel | Datum | Categorie | Omschrijving | Waar | Uur | Afbeelding | Link | LinkTekst | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HALLOKIEN: SPANNENDE BINGO` | `Za 17 Okt 2026` | `Kienavond` | `Klaar voor een avond vol spanning...` | `Evenementenhal Zonhoven` | `18u30` | `assets/images/real_hallokien.jpg` | `https://ravotshop.ksa.be/hallokien` | `Koop tickets op Ravotshop →` | |
| `SPAGHETTIDAG` | `Zo 8 Maart` | `Eetdag` | `Heerlijke verse spaghetti...` | `'t Heem` | `11u30` | `assets/images/real_spaghettidag.jpg` | `#` | `Voorbij` | `Voorbij` |

* **Afbeelding**: Een weblink naar een foto (bv. Google Drive / Imgur / Facebook afbeeldingslink) of een bestand in de site.
* **Status**: Typ `Voorbij` zodra het evenement afgelopen is, dan vervaagt het kaartje automatisch.

---

### Stap 3: Delen & Sheet ID koppelen
1. Klik rechtsboven in je Google Sheet op de blauwe knop **Delen**.
2. Zet de Algemene toegang op: **"Iedereen met de link"** mag **"Lezer"** zijn.
3. Kopieer het **Spreadsheet ID** uit de adresbalk van je browser:
   > URL: `https://docs.google.com/spreadsheets/d/`**`1AbCdEfGhIjKlMnOpQrStUvWxYz123456789`**`/edit`
4. Plak dit ID in [js/sheets-sync.js](file:///c:/Users/geert/Documents/Github/KSA%20website/js/sheets-sync.js) bij `sheetId`:
   ```javascript
   const KSA_SHEETS_CONFIG = {
     sheetId: '1AbCdEfGhIjKlMnOpQrStUvWxYz123456789', // <-- Jouw ID hier
     ...
   };
   ```

Klaar! Vanaf dan leest de website automatisch de inhoud live uit de Google Sheet. Als de Google Sheet even niet bereikbaar is, toont de website automatisch de standaard inhoud.
