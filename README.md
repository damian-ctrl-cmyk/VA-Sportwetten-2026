# ⚽ Abpfiff! – Das Wett-Escape

Online-Escape-Spiel zu den rechtlichen Rahmenbedingungen von Fussballwetten in der Schweiz.

Nach dem Schlusspfiff ist man allein im Stadion eingeschlossen. An **12 Stationen** beurteilt man, ob die Handlungen fiktiver Personen rechtlich zulässig sind – immer mit der Unterscheidung zwischen **Anbieten** und **Teilnahme**. Jede gelöste Station liefert einen Buchstaben. Der Code öffnet die letzte Station, ein **Penaltyschiessen** mit Wissensfragen. Zum Schluss erhält man ein **persönliches Zertifikat**, das man ausdrucken oder als PDF speichern kann.

Das Spiel ist kostenlos und enthält keine echten Wetten, Einsätze oder Geld- und Sachpreise. Alle Personen, Firmen und Websites sind erfunden (ausser Swisslos, Loterie Romande und Behörden).

## Spielen

- **Lokal:** `index.html` doppelklicken – es braucht keine Installation.
- **Online:** über GitHub Pages (siehe unten).

## Auf GitHub veröffentlichen

1. Neues, öffentliches Repository anlegen.
2. Den Inhalt dieses Ordners hochladen (`index.html`, `README.md` und den Ordner `assets`).
3. **Settings → Pages → Source: «Deploy from a branch»**, Branch `main`, Ordner `/ (root)` → Save.
4. Nach 1–2 Minuten ist das Spiel unter `https://<benutzername>.github.io/<repository>/` erreichbar.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `index.html` | Seitengerüst: Header, Anzeigetafel, Ansichten, Dialoge |
| `assets/css/base.css` | Farben, Schriften, Grundlagen |
| `assets/css/layout.css` | Header, Anzeigetafel, Startseite, Stadionkarte |
| `assets/css/components.css` | Buttons, Rückmeldungen, Dialoge, Album, Zertifikat |
| `assets/css/stations.css` | Die Aufgabentypen und das Penaltyschiessen |
| `assets/css/print.css` | Druckansicht (nur das Zertifikat) |
| `assets/js/spiel.js` | Spiellogik und alle Inhalte |

## Inhalte anpassen

Alle Texte stehen in `assets/js/spiel.js`. Die Datei ist in Abschnitte gegliedert; mit der Suche (Ctrl+F) findet man sie schnell:

| Was | Abschnitt suchen |
| --- | --- |
| Stationen (Texte, Erklärungen, Quellen) | `assets/js/content/stations.js` |
| Penalty-Fragen | `assets/js/content/penalties.js` |
| Texte von Stadionwart Ruedi | `assets/js/content/story.js` |
| Kernaussagen am Spielende | `assets/js/content/takeaways.js` |
| Quellen | `assets/js/content/sources.js` |
| Punkte, Spieltag, Feedback-Formular-Link | `assets/js/config.js` |

**Testrückmeldungen sammeln:** Ein Google- oder Microsoft-Formular erstellen und den Link bei `feedbackFormUrl` eintragen. Am Spielende erscheint dann ein Button zum Formular.

## Datenschutz

Der Spielstand wird nur im eigenen Browser gespeichert, damit nach einem Neuladen nichts verloren geht. Es werden keine Daten übermittelt.

## Quellen (Rechtsstand November 2026)

- Bundesgesetz über Geldspiele (BGS), SR 935.51 – https://www.fedlex.admin.ch/eli/cc/2018/795/de
- Sportförderungsgesetz (SpoFöG), Art. 25a – https://www.fedlex.admin.ch/eli/cc/2012/460/de
- Interkantonale Geldspielaufsicht (Gespa) – https://www.gespa.ch
- Gespa, Medienmitteilung Testkäufe Sportwetten, 15.7.2026
- Gespa, Jahresbericht Wettkampfmanipulation, März 2026
- Bundesamt für Justiz: Fragen und Antworten zum BGS; Schutz vor exzessivem Geldspiel; Merkblätter «Schutz Minderjähriger» und «Illegale Onlineseiten»
- Swissvotes, Abstimmung über das Geldspielgesetz vom 10.6.2018

Keine Rechtsberatung.
