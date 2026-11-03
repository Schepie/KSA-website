# 📋 KSA Zonhoven - Website Beheer (Edit Mode & Google Sheets)

De website van KSA Zonhoven (zowel computer als mobiel) kan op **twee manieren** zonder enige programmeerkennis worden aangepast door de leiding:
1. **✏️ Rechtstreeks op de website zelf ("Edit Mode" / Bewerk-modus)** — klik en typ direct op de pagina!
2. **📊 Via de gekoppelde Google Sheet** — met automatische datumcontrole (`Voorbij`), dropdown-keuzelijstjes en een `📸 KSA Foto's` upload-knop!

---

## ✏️ Manier 1: Rechtstreeks op de Website bewerken ("Edit Mode")

Wil je snel een tekst, datum, knop, banner of foto aanpassen zonder naar Google Sheets te gaan? Zet de website dan in **Bewerk-modus**:

### Hoe activeer je de Edit Mode?
1. Scroll helemaal naar beneden op de website (in de donkere balk onderaan, of op mobiel onderaan het tabblad **Info**) en klik op de knop **`✏️ Bewerk Website (Edit Mode)`** *(of typ `?edit=1` achter het webadres)*.
2. Vul de pincode voor de leiding in (standaard pincode: **`ksa2026`** — zelf aanpasbaar via de knop *⚙️ Cloud Koppeling*).
3. Onderaan het scherm verschijnt de **Bewerk-werkbalk**:
   * **📝 Teksten aanpassen**: Klik gewoon op eender welke titel, alinea, datum, uur of groepsbeschrijving op de website en typ je aanpassing.
   * **📸 Foto's wijzigen**: Klik rechtstreeks op een foto op de website &rarr; kies een nieuwe foto van je computer of smartphone &rarr; de foto wordt direct op de pagina vervangen!
   * **🔗 Knoppen & Links aanpassen**: Klik op een actieknop (bv. *"Bestel Kaarten"*) om de tekst op de knop, de URL-link of de zichtbaarheid (tonen/verbergen) te wijzigen.
   * **⏱️ Event Banner & Aftelklok**: Bovenaan de Event Banner verschijnt een gele balk waarmee je via een kalender-kiezer direct een nieuwe datum en tijd voor de aftelklok instelt, of de volledige banner met één klik verbergt/toont (`🎯 Banner Aan/Uit`).
   * **➕ Kaartjes toevoegen, op 'Voorbij' zetten of verwijderen**: Onder elk kalender-item, nieuwsbericht en leidingspaspoort verschijnen in de Edit Mode knoppen om een nieuw item toe te voegen (`➕`), een activiteit op **`🏁 Voorbij`** of **`🔥 Nu`** te zetten, of te verwijderen (`🗑️`).
   * **💾 Opslaan & Publiceren**: Klik op de groene knop **`💾 Opslaan & Publiceren`** om alle wijzigingen te bewaren!

---

## 📊 Manier 2: Beheer via de gekoppelde Google Sheet

👉 **[Klik hier om de KSA Zonhoven Google Sheet te openen](https://docs.google.com/spreadsheets/d/1yNw0GTkWEvEtJ9beIVNfT-pSE5rVDy1sILdIHAQUhX4/edit)**

In de hoofdmap van dit project staat het kant-en-klare bestand **`KSA_Zonhoven_Website_Beheer.xlsx`** met alle **9 tabbladen**:
1. **`Home`**: Startscherm, Bovenbalk, Hero-knoppen, 4 Statistieken én de **Event Banner met live aftelklok**.
2. **`Kalender`**: Alle zondagen en activiteiten (springt automatisch op **`Voorbij`** zodra de datum gepasseerd is!).
3. **`Nieuws`**: Nieuwsberichten en evenementen (springt automatisch op **`Voorbij`** na de datum!).
4. **`Groepen`**: Leeftijden, beschrijvingen, foto's en leiding per tak (`KABOUTERS`, `SLOEBERS`, `ROODKAPJES`, `JIM`, `SIM`, `KIM`).
5. **`Leiding`**: Hoofdleiding, leidsters per groep en paspoortjes.
6. **`Info`**: Praktische infokaarten (Lidgeld, Uniform, Kamp) en het Ravot-stappenplan.
7. **`HetHeem`**: Zaalverhuur 't Heem, kenmerken en contactpersoon.
8. **`Contact`**: Adres, e-mail, telefoonnummers en sociale media.
9. **`Help`**: Volledige Nederlandstalige handleiding in het document zelf.

### Handige functies in de Google Sheet:
* **📋 Dropdown-keuzelijstjes**: Velden met vaste waarden (zoals `Tonen`, `Status`, `Onderlijnd`, `Groep`, `Onderdeel` en `Type`) hebben een ingebouwd keuzemenu zodat je nooit zelf hoeft te typen.
* **⏱️ Automatische `'Voorbij'`-update op datum**: Zowel de formules in de sheet (`VANDAAG()` / `TODAY()`) als de website-code zetten gepasseerde kalenderdata, nieuws-evenementen en banners automatisch op **`Voorbij`**.
* **📸 Ingebouwde `"📸 KSA Foto's"` Upload-knop**:
  * Plak eenmalig de code uit **`ksa_foto_uploader_script.gs`** in je Google Sheet via *Uitbreidingen &rarr; Apps Script* en klik op Opslaan.
  * Klik in de Sheet op een fotocel &rarr; klik bovenaan op **`📸 KSA Foto's` &rarr; `📤 Foto uploaden naar geselecteerde cel...`** &rarr; kies een foto van je pc of GSM. De foto wordt automatisch opgeslagen in de Google Drive-map **`KSA_Zonhoven_Website_Fotos`** en de link verschijnt vanzelf in de cel!
