# ⚽ Abpfiff! – Das Wett-Escape

Online-Escape-Spiel zu den rechtlichen Rahmenbedingungen von Fussballwetten in der Schweiz (Vertiefungsarbeit).

An acht Stationen begegnen die Spielenden fiktiven Personen und entscheiden, ob deren Handlung rechtlich zulässig oder unzulässig ist. Dabei wird ausdrücklich zwischen **Anbieten** und **Teilnahme** unterschieden. Jede richtige Antwort liefert einen Buchstaben; mit dem vollständigen Code öffnet sich die letzte Station.

Das Spiel ist kostenlos und enthält keine echten Wetten, keine Einsätze und keine Geld- oder Sachpreise. Alle Personen und Fälle sind erfunden.

**Features:** Stadion-Kulisse, illustrierte Figuren, Anzeigetafel mit Spielzeit und Code-Buchstaben, Schiri-Karten als Feedback, Soundeffekte (abschaltbar), Konfetti am Ende, Spielstand wird im Browser gespeichert. Alle Illustrationen sind selbst gezeichnet (SVG im Code), es werden keine fremden Bilder oder Logos verwendet. Funktioniert auch auf dem Handy.

## Spielen

**Online:** `https://<euer-github-name>.github.io/<repo-name>/`
**Lokal:** `index.html` im Browser öffnen.

## Auf GitHub Pages veröffentlichen

1. Auf GitHub ein neues, öffentliches Repository anlegen (z. B. `wett-escape`).
2. `index.html` und `README.md` hochladen («Add file» → «Upload files»).
3. Im Repository: **Settings → Pages → Source: «Deploy from a branch»**, Branch `main`, Ordner `/ (root)` → Save.
4. Nach ca. einer Minute ist das Spiel unter der oben genannten Adresse erreichbar.

## Fälle anpassen

Alle Fälle stehen oben im `<script>`-Teil von `index.html` in der Liste `FAELLE`. Pro Fall: Person, Thema, Rolle, Falltext, richtige Antwort (`zulaessig`/`unzulaessig`), Code-Buchstabe, Erklärung und Quelle. Der Lösungscode ergibt sich automatisch aus den Buchstaben in Stationsreihenfolge (aktuell: `FAIRPLAY`).

## Stationen

| Nr. | Person | Thema | Rolle | Lösung |
|---|---|---|---|---|
| 1 | Lara | Bewilligte Anbieter | Teilnahme | zulässig |
| 2 | Frau Keller (Kiosk) | Mindestalter | Anbieten | unzulässig |
| 3 | Nina (Wettseite Malta) | Ausländische Onlineangebote | Anbieten | unzulässig |
| 4 | Marco (VPN) | Ausländische Onlineangebote | Teilnahme | nicht strafbar |
| 5 | Jan (Influencer) | Werbung | Werbung | unzulässig |
| 6 | Agentur «Kickboost» | Werbung | Werbung | unzulässig |
| 7 | Online-Anbieter / Reto | Spielerschutz | Anbieten | unzulässig |
| 8 | Sandra (Team-Tippspiel) | Privater Kreis | Teilnahme | zulässig |

## Quellen (Rechtsstand: November 2026)

- Bundesgesetz über Geldspiele (BGS), SR 935.51 – https://www.fedlex.admin.ch/eli/cc/2018/795/de
- Interkantonale Geldspielaufsicht (Gespa) – https://www.gespa.ch
- Bundesamt für Justiz, Fragen und Antworten zum Geldspielgesetz – https://www.bj.admin.ch/de/fragen-und-antworten-zum-geldspielgesetz
- Bundesamt für Justiz, Merkblätter «Schutz Minderjähriger» und «Illegale Onlineseiten»

Keine Rechtsberatung.
