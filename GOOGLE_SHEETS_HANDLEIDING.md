# 📋 KSA Zonhoven - Google Sheets Website Beheer

Met deze koppeling kan de leidingsploeg de **VOLLEDIGE website** (inclusief het **Startscherm**, de **Aftelklok Event Banner** en alle **7 menu-items**) rechtstreeks en live bijwerken via Google Sheets op computer of smartphone, zonder enige technische programmeerkennis!

---

## 🔗 Jullie Actieve Google Sheet

👉 **[Klik hier om de KSA Zonhoven Google Sheet te openen](https://docs.google.com/spreadsheets/d/1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4/edit)**

De website is **al gekoppeld** aan deze sheet. Zodra jullie in een tabblad iets aanpassen of toevoegen, is het direct live zichtbaar op zowel computer (desktop) als smartphone (mobiel).

---

## 🚀 Snelle Start: Alles in één klik importeren

In de hoofdmap van het project staat het bestand **`KSA_Zonhoven_Website_Beheer.xlsx`**. Hierin zijn **alle 9 tabbladen** (`Home`, `Kalender`, `Nieuws`, `Groepen`, `Leiding`, `Info`, `HetHeem`, `Contact` én het ingebouwde **`Help`**-tabblad met uitleg) al volledig voor jullie klaargezet met de huidige inhoud van de website als voorbeeld!

### Hoe importeer je dit in jullie Google Sheet?
1. Open de [KSA Google Sheet](https://docs.google.com/spreadsheets/d/1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4/edit).
2. Klik linksboven in het menu op **Bestand** *(File)* &rarr; **Importeren** *(Import)*.
3. Klik op het tabblad **Uploaden** en kies het bestand `KSA_Zonhoven_Website_Beheer.xlsx`.
4. Kies bij Importlocatie: **"Spreadsheet vervangen"** *(Replace spreadsheet)* of **"Nieuwe bladen invoegen"** *(Insert new sheets)*.
5. Klik op **Gegevens importeren**. Klaar! Alle 9 tabbladen (inclusief het **`Help`**-overzicht voor de leiding) staan direct klaar.

---

## 📸 Nieuw: Foto's toevoegen met de ingebouwde `"📸 KSA Foto's"`-knop (Zonder URL!)

De leiding hoeft **geen URL's of bestandspaden** meer te typen om een foto te wijzigen of toe te voegen! Via het bestand **`ksa_foto_uploader_script.gs`** voeg je een eigen upload-knop toe aan jullie Google Sheet.

### Eenmalige installatie in Google Sheets (duurt 30 seconden):
1. Open jullie [KSA Google Sheet](https://docs.google.com/spreadsheets/d/1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4/edit).
2. Klik in het bovenste menu op **Uitbreidingen** *(Extensions)* &rarr; **Apps Script**.
3. Verwijder de korte standaardcode die daar staat en plak de volledige inhoud van het bestand **`ksa_foto_uploader_script.gs`**.
4. Klik bovenaan op het diskette-icoontje **Project opslaan** (`Ctrl+S`) en ververs de Google Sheet (`F5`).
5. Er verschijnt nu bovenaan in de menubalk van Google Sheets automatisch een knop: **`📸 KSA Foto's`**!

### Hoe gebruikt de leiding de knop?
1. **Klik op de cel** in de Google Sheet waar een foto moet komen (bv. kolom `Afbeelding` in `Nieuws`, kolom `Foto` in `Leiding` of `HeroFoto` in `Home`).
2. Klik bovenaan op **`📸 KSA Foto's`** &rarr; **`📤 Foto uploaden naar geselecteerde cel...`** (of open het zijpaneel voor meerdere foto's tegelijk).
3. Kies een foto vanaf je **computer of smartphone** (of klik op een eerder geüploade foto in het overzicht onderaan).
4. Het script verkleint grote camerafoto's automatisch voor snelle laadtijd, slaat de foto op in de Google Drive-map `KSA_Zonhoven_Website_Fotos` en **vult de cel 100% automatisch in**!

*(Tip: Daarnaast kun je in een fotocel ook gewoon een kort woord typen zoals `spaghetti`, `hallokien`, `startdag`, `kamp`, `kabouters`, `lotte`, `cara` of een gewone Google Drive deel-link plakken — de website zet alles automatisch om!)*

---

## 📑 Overzicht van de 9 Tabbladen

Hieronder vind je per onderdeel de exacte kolommen en uitleg:

---

### 🏠 Tabblad 1: `Home` (Startscherm & Event Banner met Aftelklok)
Beheert alles wat bezoekers als eerste zien op het startscherm: de **Event Banner met live aftelklok**, de **bovenbalk**, de **grote welkomsttekst**, de **3 actieknoppen**, de **grote foto rechts** en de **4 statistieken**.

| Onderdeel | Titel | Tekst | Extra_Info | Datum_Uur | Knop_Tekst | Link_of_Foto | Tonen |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`Banner`** | `HALLOKIEN BINGO NIGHT 2026 🎃` | `Zaterdag 17 oktober • Polyvalente Zaal Evenementenhal Zonhoven • Vol = Vol!` | `🔥 GROOT KSA ZONHOVEN EVENEMENT` | `17/10/2026 19:30` | `🎟️ Bestel Kaarten →` | `https://ravotshop.ksa.be/hallokien` | `Ja` |
| **`Banner`** | `HET GROTE ZOMERKAMP 2027 ⛺` | `11 t/m 20 juli • 10 dagen avontuur, kampvuur en vriendschap!` | `⛺ HOOGTEPUNT VAN HET JAAR` | `11/07/2027 09:00` | `🎒 Meer Kamp Info →` | `#info` | `Nee` |
| **`Topbalk`** | `🎃 HalloKien 2026:` | `Bestel tickets via Ravotshop →` | `KSA LIMBURG` | | | `https://ravotshop.ksa.be/hallokien` | `Ja` |
| **`Hero`** | `VOOR ALLE TOFFE MEISJES VAN 6 TOT 17 JAAR!` | `Iedere zondagnamiddag van 13u30 tot 17u00 komen wij samen aan ons lokaal (Dijkbeemdenweg 8)...` | `💙❤️ Dé Jeugdbeweging van Zonhoven` | `6 TOT 17 JAAR` | | | `Ja` |
| **`HeroFoto`** | `KSA ZONHOVEN MEISJES` | `Elke zondag van 13u30 tot 17u00` | `🏕️` | | | `images/ksakinderen.jpg` | `Ja` |
| **`HeroKnop1`** | `🔥 Bekijk het Nieuws` | | | | | `#nieuws` | `Ja` |
| **`HeroKnop2`** | `🎃 HalloKien Tickets` | | | | | `https://ravotshop.ksa.be/hallokien` | `Ja` |
| **`HeroKnop3`** | `Ontdek Jouw Groep →` | | | | | `#groepen` | `Ja` |
| **`Stat1`** | `5` | `Leeftijdsgroepen` | | | | | `Ja` |
| **`Stat2`** | `100+` | `Enthousiaste Meisjes` | | | | | `Ja` |
| **`Stat3`** | `10 DAGEN` | `Groot Zomerkamp` | | | | | `Ja` |
| **`Stat4`** | `13U30` | `Elke Zondag` | | | | | `Ja` |

#### ⏱️ Hoe werkt de Event Banner met Aftelklok (`Banner`)?
* **Automatisch op `'Voorbij'` als de datum gepasseerd is**: In het Excel/Google Sheet-bestand bevat de kolom **`Tonen`** bij `Banner` een slimme datumformule die `Datum_Uur` vergelijkt met de datum van vandaag (`VANDAAG()` / `TODAY()`). Zodra het evenement voorbij is, springt het veld **`Tonen`** automatisch op **`Voorbij`** en verbergt de website de verlopen banner! Ook de website zelf controleert bij het laden automatisch de huidige datum.
* **Banner handmatig verbergen / verwijderen**: Zet in de kolom **`Tonen`** de waarde op **`Nee`** of **`Voorbij`** (of wis de `Banner` rij). De volledige donkerblauwe banner met aftelklok verdwijnt dan meteen van zowel de computer- als smartphone-versie!
* **Banner aanpassen naar een nieuw evenement**: Pas de `Titel`, `Tekst`, `Extra_Info` (het rode labeltje), `Knop_Tekst` en `Link_of_Foto` aan, en vul bij **`Datum_Uur`** de nieuwe datum en tijd in (bv. `08/03/2027 12:00` voor Spaghettidag of `11/07/2027 09:00` voor Zomerkamp). De klok telt automatisch tot op de seconde af naar dit moment!
* **Extra banner toevoegen**: Wil je een nieuw evenement alvast klaarzetten of twee aftelbanners tegelijk tonen? Voeg gewoon een extra rij toe met `Onderdeel = Banner`. Elke rij met `Tonen = Ja` (en een datum in de toekomst) krijgt zijn eigen live aftelklok!
* **Extra knop in de Hero (`HeroKnop2`) of `Topbalk` verbergen**: Is HalloKien voorbij? Zet bij `HeroKnop2` en `Topbalk` de kolom `Tonen` op `Nee` (of pas ze aan naar het volgende evenement).

---

### 📅 Tabblad 2: `Kalender` (Menu: Kalender) — *Automatisch op 'Voorbij'!*
Beheert het werkjaaroverzicht op de desktop-kalender en de mobiele agendalijst.

| Datum | Titel | Status | Emoji | Onderlijnd |
| :--- | :--- | :--- | :--- | :--- |
| `20 / 09` | `STARTDAG` | `Voorbij` *(automatisch)* | `🎉` | `Nee` |
| `17 / 10` | `HALLOKIEN` | `Voorbij` *(automatisch)* | `🎃` | `Nee` |
| `8 / 11` | `KSA` | `Nu` *(automatisch)* | | `Nee` |
| `15 / 11` | `KSA` | | | `Nee` |
| `8 / 03` | `SPAGHETTIDAG` | | `🍝` | `Nee` |
| `11 - 20 Juli` | `ZOMERKAMP` | | `⛺` | `Nee` |

* **Datum**: bv. `17 / 10`, `8 / 11`, `11 - 20 Juli`
* **Titel**: Naam van de activiteit
* **Status (Automatisch berekend op basis van huidige datum!)**:
  * In `KSA_Zonhoven_Website_Beheer.xlsx` staat in kolom C (`Status`) een automatische datumformule op basis van `VANDAAG()` (`TODAY()`).
  * Ligt de datum in het verleden? Dan springt `Status` in de sheet én op de website **automatisch op `Voorbij`** (wordt grijs op desktop en verdwijnt automatisch uit de komende lijst op mobiel).
  * De eerstvolgende toekomstige activiteit krijgt **automatisch `Nu` (`Binnenkort!`)** met het rode uitroepteken!
* **Emoji**: bv. `🎃`, `🎟️`, `🍝`, `⛺`, `🎁`
* **Onderlijnd**: `Ja` als het onderlijnd moet zijn (zoals bij `GEEN KSA`)

---

### 📰 Tabblad 3: `Nieuws` (Menu: Nieuws) — *Automatisch op 'Voorbij'!*
Beheert alle nieuwskaarten en evenementen in de sectie Nieuws.

| Titel | Datum | Categorie | Omschrijving | Waar | Uur | Afbeelding | Link | LinkTekst | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `HalloKien Bingo Night 2026 🎃` | `Za 17 Okt 2026` | `🔥 Groot Evenement` | `Op zaterdag 17 oktober...` | `Evenementenhal Zonhoven` | `Deuren: 18u30` | `assets/images/real_hallokien.jpg` | `https://ravotshop.ksa.be/hallokien` | `Bestel Tickets →` | `Voorbij` *(automatisch)* |
| `Grote KSA Spaghettidag 🍝` | `Zondag 8 Maart` | `🍝 Eetdag` | `Schuif gezellig de benen onder tafel...` | `Zonhoven` | `Middag & Avond` | `assets/images/real_spaghettidag.jpg` | `#agenda` | `Zet in je agenda →` | `Nu` *(automatisch)* |

* **Afbeelding**: Een weblink naar een foto (bv. Google Drive / Imgur / Facebook afbeeldingslink) of een lokaal bestand (bv. `assets/images/real_hallokien.jpg`).
* **Status (Automatisch berekend op basis van huidige datum!)**: Zowel via de datumformule in kolom J (`Status`) als via de website-code springt een gepasseerd evenement **automatisch op `Voorbij`**. Het kaartje krijgt dan automatisch het grijze label `"🏁 Reeds voorbij"`, de datum krijgt `(Voorbij)` en de bestelknop voor tickets wordt netjes verborgen.

---

### 🎒 Tabblad 4: `Groepen` (Menu: Groepen)
Beheert de interactieve groepskiezer op desktop en de swipe-bare groepen op smartphones.

| Groep | Leeftijd | Tagline | Omschrijving | Activiteiten | Leidsters | Afbeelding | Kleur |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Kabouters` | `6 - 8 jaar (1ste & 2de leerjaar)` | `Spelen, ontdekken & fantasie!` | `Bij de kabouters stappen de allerjongste meisjes binnen in een magische wereld...` | `Knutselen & dansen, Pleinspelen, Korte kampjes` | `Cara & Nore` | `images/kabouters.jpg` | `#fdb900` |
| `Sloebers` | `8 - 10 jaar (3de & 4de leerjaar)` | `Energie voor tien!` | `De sloebers zitten boordevol energie! We ontdekken het bos...` | `Bosspelen, Forten bouwen, Samen op weekend` | `Lien & Lies` | `images/sloebers.jpg` | `#fa7818` |
| `Roodkapjes` | `10 - 12 jaar (5de & 6de leerjaar)` | `Stoer en klaar voor uitdaging!` | `De roodkapjes leren sjorren, koken op kampvuurtjes...` | `Kampvuur, Marshmallows, 10 dagen tentenkamp` | `Lotte & Lina's` | `images/ksakinderen.jpg` | `#e73339` |
| `Jim` | `12 - 14 jaar (1ste & 2de middelbaar)` | `Grensverleggend avontuur!` | `Op naar het middelbaar met spectaculaire tochten...` | `Nachtspelen, Dropping, Vlotten bouwen` | `Lotte, Lina B. & Lina S.` | `images/jim.jpg` | `#531c77` |
| `Sim` | `14 - 16 jaar (3de & 4de middelbaar)` | `Samen sterk en pure actie!` | `Een hechte bende die voor elkaar door het vuur gaat...` | `Uitstapjes, Zelf activiteiten bedenken, 24u-spel` | `Kato & Fien` | `images/sim.jpg` | `#253290` |
| `Kim` | `16 - 17+ jaar (+16'ers)` | `De leiding van morgen!` | `Zelf de touwtjes in handen nemen en toffe feesten organiseren...` | `Leefweek, Triptrap, Feesten organiseren` | `Oonah (Begeleiding)` | `images/Oonah.jpg` | `#008a44` |

* **Activiteiten**: Komma-gescheiden lijst met leuke trefwoorden die als badges getoond worden.
* **Afbeelding**: Foto van de groep of leidsters.
* **Kleur**: (Optioneel) Kleurcode voor de buttons en achtergrond.

---

### 👑 Tabblad 5: `Leiding` (Menu: Leiding)
Beheert de hoofdleiding-kaart, de leidingsploeg per leeftijdsgroep én de interactieve leidingspaspoortjes die bezoekers kunnen vergroten!

| Naam | Groep | Functie | Omschrijving | Badge | Foto | Email |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `Fien Aerts` | `Hoofdleiding` | `Hoofdleiding KSA Zonhoven` | `Het centrale aanspreekpunt voor ouders, leiding, gemeente en KSA Nationaal.` | `Hoofdleiding` | `assets/images/real_leiding_hoofd.jpg` | `hoofdleiding.ksazonhoven@gmail.com` |
| `Cara` | `Kabouters` | `Leidster (6-8j)` | `Koninginnen van de verkleedkist en knutselkampioenen.` | `Creatief & Zorgzaam` | `images/cara.jpg` | |
| `Nore` | `Kabouters` | `Leidster (6-8j)` | `Koninginnen van de verkleedkist en knutselkampioenen.` | `Creatief & Zorgzaam` | `images/nore.jpg` | |
| `Lien` | `Sloebers` | `Leidster (8-10j)` | `Onvermoeibaar en verzot op estafettes in het bos.` | `Vol Energie` | `images/lien.jpg` | |
| `Lies` | `Sloebers` | `Leidster (8-10j)` | `Onvermoeibaar en verzot op estafettes in het bos.` | `Vol Energie` | `images/lies.jpg` | |
| `Lotte` | `Jim` | `Leidster (12-14j)` | `Meesters in gezelligheid, dorpsspelen en hikes.` | `Avontuurlijk` | `images/lotte.jpg` | |
| `Lina B. & Lina S.` | `Jim` | `Leidsters (12-14j)` | `Meesters in gezelligheid, dorpsspelen en hikes.` | `Avontuurlijk` | `images/jim.jpg` | |
| `Kato & Fien` | `Sim` | `Leidsters (14-16j)` | `Altijd in voor een dropping en vlotten bouwen.` | `Grensverleggend` | `images/sim.jpg` | |
| `Oonah` | `Kim` | `Begeleiding (+16)` | `Klaarstomen voor leiding, leefweek en triptrap.` | `Toekomst` | `images/Oonah.jpg` | |

* **Foto**: Paspoortfoto van de leidster. Bezoekers kunnen op de foto klikken om het originele paspoortje op ware grootte te bekijken!

---

### ℹ️ Tabblad 6: `Info` (Menu: Info & Ravot)
Beheert de praktische zondaginfo, het uniform en het 4-stappenplan om in te schrijven via Ravot (ksa.be).

| Onderdeel | Titel | Tekst | Extra | Icoon |
| :--- | :--- | :--- | :--- | :--- |
| `Zondagen` | `WEKELIJKSE ZONDAGEN` | `Iedere zondag van 13u30 tot 17u00 aan ons lokaal (Dijkbeemdenweg 8, Zonhoven).` | `13u30 tot 17u00` | `⏰` |
| `Uniform` | `ONS KSA UNIFORM` | `Elke zondag dragen we hetzelfde! Een donkerblauwe trui of hemd en ons KSA sjaaltje.` | `Trui/hemd & sjaaltje` | `👕` |
| `Kamp` | `WEEKEND & KAMP` | `1 keer per jaar op weekend én ons grote 10-daags zomerkamp (11-20 juli).` | `11 - 20 Juli Zomerkamp` | `🏕️` |
| `RavotStap1` | `Surf naar Ravot` | `Ga naar ravot.ksa.be op je pc of smartphone.` | `https://ravot.ksa.be` | `1` |
| `RavotStap2` | `Inloggen of Account` | `Al eerder ingeschreven? Log in. Nieuwe ouder? Maak eenvoudig een gezinsaccount aan.` | | `2` |
| `RavotStap3` | `Lid Inschrijven` | `Klik in het hoofdmenu op de knop "Lid inschrijven" en kies KSA Zonhoven Meisjes.` | | `3` |
| `RavotStap4` | `Gegevens & UiTPAS` | `Vul rijksregisternummer & eventueel UiTPAS in (kansentarief discreet mogelijk).` | | `4` |
| `RavotKnop` | `Direct Inschrijven op ravot.ksa.be →` | `Nieuwe leden mogen altijd 2 zondagen gratis komen proberen!` | `https://ravot.ksa.be` | `🚀` |

---

### 🏡 Tabblad 7: `HetHeem` (Menu: 't Heem)
Beheert alle informatie over zaalverhuur VZW 't Heem (lokalen, weide en feestzalen).

| Titel | Omschrijving | Adres | Email | Website | Afbeelding | Faciliteiten |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ZAALVERHURING VZW 'T HEEM` | `Voor het huren van onze lokalen en zalen in Zonhoven kan je alle info, prijzen en kalender vinden via de officiële website van ons lokaalbeheer:` | `Dijkbeemdenweg 8, 3520 Zonhoven` | `heem.ksazonhoven@gmail.com` | `https://www.theem.be` | `images/theem.jpg` | `Ruime polyvalente feest- en speelzalen; Volledig uitgeruste professionele keuken & sanitair; Grote buitenspeelweide vlakbij de natuur; Ruime parking; Ideaal voor jeugdverenigingen en weekends` |

* **Faciliteiten**: Scheid de faciliteiten met een puntkomma (`;`), deze worden automatisch als nette vinkjeslijst getoond op de website!

---

### 📬 Tabblad 8: `Contact` (Menu: Contact)
Beheert alle contacttegels, e-mailadressen en sociale media links.

| Onderdeel | Titel | Waarde | Link | Icoon |
| :--- | :--- | :--- | :--- | :--- |
| `Adres` | `KSA Lokaal Zonhoven` | `Dijkbeemdenweg 8, 3520 Zonhoven` | `https://maps.google.com/?q=Dijkbeemdenweg+8+3520+Zonhoven` | `📍` |
| `Hoofdleiding` | `Hoofdleiding Fien Aerts` | `hoofdleiding.ksazonhoven@gmail.com` | `mailto:hoofdleiding.ksazonhoven@gmail.com` | `👑` |
| `Email` | `Algemeen E-mailadres` | `ksa_zonhoven@hotmail.com` | `mailto:ksa_zonhoven@hotmail.com` | `📨` |
| `Ravotshop` | `Ravotshop KSA Zonhoven` | `ravotshop.ksa.be →` | `https://ravotshop.ksa.be` | `🛒` |
| `Facebook` | `Facebook Pagina` | `Volg ons op Facebook →` | `https://www.facebook.com/ksazonhoven/?locale=nl_BE` | `📱` |

---

## 🔒 Veiligheid & Fallback

* **Wat als Google Sheets even offline is?** Geen probleem: de website toont dan automatisch de standaard ingebouwde teksten en afbeeldingen. Er verschijnt nooit een leeg scherm.
* **Wat als een nieuw tabblad nog niet is ingevuld?** Dan blijft voor dat onderdeel gewoon de standaard inhoud zichtbaar totdat jullie het tabblad vullen.
