/*
 * Abpfiff! – Das Wett-Escape
 * Spiellogik in einer Datei. Läuft direkt im Browser, ohne Installation.
 *
 * Die Datei ist in Abschnitte gegliedert (Suche nach «// assets/js/…»):
 *   content/stations.js   Die 12 Stationen: Texte, Lösungen, Quellen, Sticker
 *   content/penalties.js  Fragen fürs Penaltyschiessen
 *   content/story.js      Texte von Stadionwart Ruedi
 *   content/takeaways.js  Kernaussagen am Spielende
 *   content/sources.js    Quellenverzeichnis
 *   config.js             Einstellungen (Punkte, Feedback-Formular-Link, Spieltag)
 *   core/…                Spielzustand, Regeln, Speichern, Ton
 *   stations/…            Die 11 Aufgabentypen
 *   views/…               Ansichten (Start, Karte, Station, Penaltys, Ergebnis, Zertifikat)
 *   ui/…                  Anzeigetafel, Dialoge, Effekte
 */
(() => {
  var __defProp = Object.defineProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // assets/js/content/story.js
  var NARRATOR = Object.freeze({
    name: "Ruedi, Stadionwart",
    avatar: { skin: "#e8b98f", hair: "#8a8a8a", style: "cap", shirt: "#e67e22", extra: ["beard"] }
  });
  var INTRO_SCENE = Object.freeze([
    {
      text: "Hoi! Ich bin Ruedi, der Stadionwart. Das Spiel ist aus, die Fans sind heimgegangen – nur du bist noch da."
    },
    {
      text: "*KLACK* … Oh nein. Die Zentralverriegelung! Das Flutlicht ist aus, und alle Tore sind zu.",
      effect: "lightsOut"
    },
    {
      text: "Das Ausgangstor lässt sich nur vom Penaltypunkt in der Mitte aus öffnen. Dafür braucht es einen 12-stelligen Code."
    },
    {
      text: "An zwölf Orten im Stadion warten Leute mit kniffligen Fragen zu Fussballwetten. Für jede richtige Lösung bekommst du einen Buchstaben – und einen Sticker fürs Sammelalbum."
    },
    {
      text: "Und denk immer dran: Wer Wetten ANBIETET, hat ganz andere Pflichten als wer nur MITSPIELT. Viel Glück – ich halte dich auf der Anzeigetafel auf dem Laufenden!"
    }
  ]);
  var HALFTIME = Object.freeze({
    message: "Stark! Sechs Buchstaben hast du schon. Die zweite Halbzeit wird anspruchsvoller – Serverraum, Schiri-Kabine, Rechtsabteilung …",
    factTitle: "Pausen-Fakt aus der Praxis",
    fact: "Im Auftrag der Gespa versuchten 16- und 17-Jährige 2026 in 200 Verkaufsstellen, Sportwetten zu kaufen. In <b>47,5 %</b> der Fälle klappte es – an Selbstbedienungsgeräten sogar in <b>66,7 %</b>. Der Jugendschutz funktioniert also noch nicht überall.",
    factSource: "Gespa-Medienmitteilung vom 15.7.2026"
  });
  var PENALTY_BRIEFING = "Der Code stimmt! Aber das Tor hat noch eine letzte Sicherung: Du musst gegen unseren Goalie antreten. Verwandle mindestens <b>3 von 5 Penaltys</b>. Jede Frage hat drei Antworten – schiess in die Ecke mit der richtigen!";

  // assets/js/core/audio.js
  var SoundBoard = class {
    #context = null;
    #crowd = null;
    enabled = true;
    get crowdPlaying() {
      return this.#crowd !== null;
    }
    #ctx() {
      this.#context ??= new (window.AudioContext || window.webkitAudioContext)();
      return this.#context;
    }
    #tone(frequency, duration, { type = "sine", delay = 0, volume = 0.15 } = {}) {
      const ctx = this.#ctx();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(1e-3, start + duration);
      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(start);
      oscillator.stop(start + duration);
    }
    #noise(duration, frequency, volume) {
      const ctx = this.#ctx();
      const length = Math.floor(ctx.sampleRate * duration);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      source.buffer = buffer;
      filter.type = "bandpass";
      filter.frequency.value = frequency;
      filter.Q.value = 0.7;
      gain.gain.setValueAtTime(1e-3, now);
      gain.gain.exponentialRampToValueAtTime(volume, now + duration * 0.3);
      gain.gain.exponentialRampToValueAtTime(1e-3, now + duration);
      source.connect(filter).connect(gain).connect(ctx.destination);
      source.start();
    }
    #effects = {
      whistle: () => {
        this.#tone(2600, 0.12, { type: "square", volume: 0.05 });
        this.#tone(2500, 0.35, { type: "square", delay: 0.15, volume: 0.05 });
      },
      longWhistle: () => {
        this.#tone(2600, 0.15, { type: "square", volume: 0.05 });
        this.#tone(2550, 0.15, { type: "square", delay: 0.2, volume: 0.05 });
        this.#tone(2500, 0.6, { type: "square", delay: 0.42, volume: 0.05 });
      },
      success: () => {
        [523, 659, 784].forEach((f, i) => this.#tone(f, i === 2 ? 0.25 : 0.12, { type: "triangle", delay: i * 0.1 }));
        this.#noise(1.2, 900, 0.18);
      },
      click: () => this.#tone(880, 0.08, { type: "triangle", volume: 0.08 }),
      error: () => {
        this.#tone(220, 0.25, { type: "sawtooth", volume: 0.07 });
        this.#tone(180, 0.35, { type: "sawtooth", delay: 0.2, volume: 0.07 });
      },
      hint: () => {
        this.#tone(440, 0.1);
        this.#tone(660, 0.1, { delay: 0.12 });
      },
      switchOff: () => {
        this.#tone(90, 0.12, { type: "square", volume: 0.2 });
        this.#noise(0.15, 300, 0.3);
      },
      kick: () => {
        this.#tone(120, 0.08, { volume: 0.35 });
        this.#noise(0.08, 1500, 0.2);
      },
      goal: () => {
        this.#noise(2.2, 800, 0.35);
        [523, 659, 784, 1047].forEach((f, i) => this.#tone(f, 0.25, { type: "triangle", delay: 0.1 + i * 0.12 }));
      },
      save: () => {
        this.#noise(1.2, 300, 0.2);
        this.#tone(200, 0.3, { type: "sawtooth", volume: 0.05 });
      },
      victory: () => {
        [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.#tone(f, 0.22, { type: "triangle", delay: i * 0.13 }));
        this.#noise(3, 850, 0.3);
      }
    };
    /** Spielt einen benannten Effekt ab (Fehler beim Abspielen werden ignoriert). */
    play(name) {
      if (!this.enabled) return;
      try {
        this.#effects[name]?.();
      } catch {
      }
    }
    setEnabled(enabled) {
      this.enabled = enabled;
      if (!enabled) this.stopCrowd();
    }
    /** Startet eine leise Stadion-Geräuschkulisse in Endlosschleife. */
    startCrowd() {
      if (!this.enabled || this.#crowd) return false;
      try {
        const ctx = this.#ctx();
        const length = ctx.sampleRate * 3;
        const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < length; i += 1) {
          const white = Math.random() * 2 - 1;
          last = (last + 0.02 * white) / 1.02;
          data[i] = last * 3.5 + white * 0.03;
        }
        const source = ctx.createBufferSource();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        source.buffer = buffer;
        source.loop = true;
        filter.type = "lowpass";
        filter.frequency.value = 1200;
        gain.gain.value = 0.35;
        lfo.frequency.value = 0.12;
        lfoGain.gain.value = 0.12;
        lfo.connect(lfoGain).connect(gain.gain);
        source.connect(filter).connect(gain).connect(ctx.destination);
        source.start();
        lfo.start();
        this.#crowd = { source, lfo };
        return true;
      } catch {
        return false;
      }
    }
    stopCrowd() {
      if (!this.#crowd) return;
      this.#crowd.source.stop();
      this.#crowd.lfo.stop();
      this.#crowd = null;
    }
  };
  var sound = new SoundBoard();

  // assets/js/core/dom.js
  var ESCAPE_MAP = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ESCAPE_MAP[char]);
  }
  var SafeHtml = class {
    constructor(value) {
      this.value = value;
    }
    toString() {
      return this.value;
    }
  };
  var raw = (value) => new SafeHtml(String(value ?? ""));
  function serialize(value) {
    if (value === null || value === void 0 || value === false) return "";
    if (value instanceof SafeHtml) return value.value;
    if (Array.isArray(value)) return value.map(serialize).join("");
    return escapeHtml(value);
  }
  function html(strings, ...values) {
    let out = strings[0];
    values.forEach((value, index) => {
      out += serialize(value) + strings[index + 1];
    });
    return new SafeHtml(out);
  }
  function setHtml(element, content) {
    element.innerHTML = content instanceof SafeHtml ? content.value : escapeHtml(content);
  }
  var qs = (selector, root = document) => root.querySelector(selector);
  var qsa = (selector, root = document) => [...root.querySelectorAll(selector)];
  function delegate(root, type, selector, handler) {
    const listener = (event) => {
      const target = event.target.closest(selector);
      if (target && root.contains(target)) handler(event, target);
    };
    root.addEventListener(type, listener);
    return () => root.removeEventListener(type, listener);
  }
  function restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }

  // assets/js/config.js
  var CONFIG = Object.freeze({
    /** Schlüssel für den automatisch gespeicherten Spielstand im Browser. */
    storageKey: "abpfiff:game:v5",
    /** Stand der rechtlichen Recherche (erscheint im Spiel und auf dem Zertifikat). */
    legalStatus: "November 2026",
    /** Fiktiver Spieltag für die Ausweiskontrolle (ISO-Datum). */
    matchDay: "2026-03-14",
    /** Anzahl VAR-Joker pro Spiel. */
    jokers: 3,
    points: Object.freeze({
      base: 100,
      yellowCard: 20,
      joker: 30,
      minimum: 20,
      penaltyGoal: 20
    }),
    penalty: Object.freeze({
      shots: 5,
      goalsRequired: 3
    }),
    /** Nach so vielen gelösten Stationen erscheint die Halbzeitpause. */
    halftimeAfter: 6,
    /**
     * Link zu einem Online-Formular (z. B. Google Forms oder Microsoft Forms)
     * für die Testrückmeldungen. Leer lassen, dann können die Spielenden ihre
     * Auswertung nur kopieren oder als Textdatei speichern.
     */
    feedbackFormUrl: ""
  });

  // assets/js/content/stations.js
  var SOURCE = Object.freeze({
    bgs: "https://www.fedlex.admin.ch/eli/cc/2018/795/de",
    minors: "https://www.bj.admin.ch/dam/bj/de/data/wirtschaft/geldspiele/merkblaetter/mb-schutz-minderjaehriger-d.pdf",
    illegalSites: "https://www.bj.admin.ch/dam/bj/de/data/wirtschaft/geldspiele/merkblaetter/mb-illegale-onlineseiten-d.pdf",
    playerProtection: "https://www.bj.admin.ch/de/schutz-der-spielerinnen-und-spieler-vor-exzessivem-geldspiel",
    faq: "https://www.bj.admin.ch/de/fragen-und-antworten-zum-geldspielgesetz",
    gespaIllegal: "https://gespa.ch/en/fighting-illegal-gambling/illegal-gambling-offers",
    testPurchases: "https://www.gespa.ch/download/pictures/e6/913p1yhtgkg69nu6pgzowrh0syu2b4/26-07-15_medienmitteilung_testkaeufe.pdf",
    matchFixing: "https://www.gespa.ch/download/pictures/96/lledf36lzjm4xvs1w7lp8kd8kg362t/26-03-12_jahresbericht_wettkampfmanipulation_de.pdf",
    history: "https://www.bj.admin.ch/de/geldspielgesetz"
  });
  var STATIONS = Object.freeze([
    {
      id: "kiosk",
      letter: "S",
      location: "Stadionkiosk",
      icon: "kiosk",
      colors: ["#3fae6e", "#1f6b40"],
      person: {
        name: "Frau Keller",
        avatar: { skin: "#f3d2b8", hair: "#b9b9b9", style: "bun", shirt: "#2e8b57", extra: ["glasses", "apron"] }
      },
      topic: "Mindestalter",
      role: "offer",
      type: "idCheck",
      intro: "Uff, Matchtag! Ich muss kurz ins Lager. Kannst du den Verkauf übernehmen? Vor dem Kiosk stehen vier Leute, die einen Sporttip-Schein wollen.",
      task: "Prüfe bei jeder Person den Ausweis und entscheide: <b>verkaufen</b> oder <b>ablehnen</b>? Massgebend ist das Datum des Spieltags.",
      hint: "Für die Sportwetten von Swisslos und Loterie Romande gilt 18 Jahre. Rechne genau: Ist der 18. Geburtstag am Spieltag schon erreicht – oder erst morgen?",
      explanation: "Für die Sportwetten von Swisslos und Loterie Romande gilt ein Mindestalter von 18 Jahren. Die Verkaufsstelle muss das Alter kontrollieren – wer verkauft, steht auf der Anbieterseite und trägt die Verantwortung. Dass das wichtig ist, zeigen Testkäufe der Gespa vom Juli 2026: In 44,5 % der Fälle gab es gar keine Alterskontrolle.",
      source: {
        label: "Art. 72 BGS; Merkblatt BJ «Schutz Minderjähriger»; Gespa-Medienmitteilung Testkäufe, 15.7.2026",
        url: SOURCE.testPurchases
      },
      sticker: {
        title: "18+ am Kiosk",
        emoji: "🔞",
        fact: "Sporttip gibt es erst ab 18. Die Verkaufsstelle muss das Alter prüfen."
      },
      data: {
        customers: [
          {
            name: "Timo Brunner",
            birthDate: "2009-09-02",
            says: "Einen Sporttip für das Cupspiel, bitte!",
            avatar: { skin: "#f1c7a5", hair: "#e0b25a", style: "short", shirt: "#3498db" }
          },
          {
            name: "Selina Frei",
            birthDate: "2008-03-13",
            says: "Hoi! Ich hatte gestern Geburtstag – endlich darf ich auch mal tippen.",
            avatar: { skin: "#e8b98f", hair: "#2b1b10", style: "long", shirt: "#e67e22" }
          },
          {
            name: "Kevin Ammann",
            birthDate: "2008-03-15",
            says: "Morgen werde ich sowieso 18. Das passt doch schon, oder?",
            avatar: { skin: "#dba57c", hair: "#6b3e1f", style: "cap", shirt: "#9b59b6" }
          },
          {
            name: "Ursula Rossi",
            birthDate: "1961-07-21",
            says: "Wie jeden Samstag: ein Schein auf den FC Thun.",
            avatar: { skin: "#f3d2b8", hair: "#dcdcdc", style: "bob", shirt: "#c0392b", extra: ["glasses"] }
          }
        ]
      }
    },
    {
      id: "fan-zone",
      letter: "C",
      location: "Fankurve",
      icon: "flag",
      colors: ["#e74c3c", "#962d22"],
      person: {
        name: "Beni, Fanbetreuer",
        avatar: { skin: "#c98e62", hair: "#2b1b10", style: "short", shirt: "#c0392b", extra: ["beard"] }
      },
      topic: "Anbieten vs. Teilnahme",
      role: "mixed",
      type: "sort",
      intro: "In der Kurve wird über Wetten diskutiert – und alle werfen alles durcheinander. Hilf mir, Ordnung zu schaffen: Wer <b>bietet an</b> (oder bewirbt), und wer <b>nimmt nur teil</b>?",
      task: "Ziehe jede Karte in die richtige Kiste – oder tippe zuerst die Karte und dann die Kiste an.",
      hint: "Stellt die Person ein Wettangebot bereit, verkauft es oder macht Werbung dafür? Dann «Anbieten». Setzt sie selbst Geld? Dann «Teilnehmen».",
      explanation: "Das Geldspielgesetz nimmt vor allem die Anbieterseite in die Pflicht: Veranstalter, Verkaufsstellen und Werbende brauchen eine Bewilligung bzw. müssen Regeln einhalten. Wer illegale Online-Geldspiele anbietet oder dafür wirbt, macht sich strafbar – wer als Spielerin oder Spieler teilnimmt, nicht.",
      source: { label: "Art. 3, 130 und 131 BGS; Gespa, illegale Geldspielangebote", url: SOURCE.gespaIllegal },
      sticker: {
        title: "Anbieten ≠ Teilnehmen",
        emoji: "⚖️",
        fact: "Das Gesetz nimmt vor allem Anbietende und Werbende in die Pflicht."
      },
      data: {
        bins: { offer: "Anbieten / Werben", participate: "Teilnehmen" },
        items: [
          { text: "Swisslos stellt Quoten für die Super League online.", bin: "offer" },
          { text: "Lara tippt online 10 Franken auf den FC Thun.", bin: "participate" },
          { text: "Ein Kiosk verkauft Sporttip-Scheine.", bin: "offer" },
          { text: "Ein Fan setzt am Swisslos-Automaten auf ein Unentschieden.", bin: "participate" },
          { text: "Ein Influencer postet einen Bonuscode für eine Wettseite.", bin: "offer" },
          { text: "Marco wettet über ein VPN auf einer ausländischen Seite.", bin: "participate" },
          { text: "Eine Firma auf Malta betreibt eine Wettseite für Schweizer Kundschaft.", bin: "offer" },
          { text: "Reto beantragt für sich selbst eine Spielsperre.", bin: "participate" }
        ]
      }
    },
    {
      id: "media-room",
      letter: "H",
      location: "Medienraum",
      icon: "globe",
      colors: ["#3e6fb8", "#1c3866"],
      person: {
        name: "Nina & Marco",
        avatar: { skin: "#e8b98f", hair: "#e3c16f", style: "long", shirt: "#1f3a68", extra: ["tie"] }
      },
      topic: "Ausländische Onlineangebote",
      role: "mixed",
      type: "websiteCheck",
      intro: "Im Medienraum flimmert eine Wettseite über den Bildschirm. Sie gehört Nina, die von Malta aus eine Firma führt. Ihr Kollege Marco aus Luzern hat dort gerade per VPN eine Wette platziert.",
      task: "Untersuche die Website mit den Werkzeugen. Beurteile dann <b>beide</b> Handlungen.",
      hint: "Eine ausländische Lizenz zählt in der Schweiz nicht. Und: Das Gesetz bestraft das Anbieten illegaler Online-Geldspiele – aber nicht jede Handlung auf Spielerseite.",
      explanation: "Wer in der Schweiz Online-Sportwetten anbietet, braucht eine Schweizer Bewilligung – eine Lizenz aus Malta genügt nicht. Solche Seiten kommen auf die Sperrliste und werden blockiert. Marco als Spieler macht sich nicht strafbar. Er verliert aber jeden Schweizer Spielerschutz, und Einsätze oder Gewinne können in einem Strafverfahren eingezogen werden.",
      source: {
        label: "Art. 21, 24, 86 ff. und 130 BGS; Merkblatt BJ «Illegale Onlineseiten»",
        url: SOURCE.illegalSites
      },
      sticker: {
        title: "Auslandslizenz zählt nicht",
        emoji: "🌍",
        fact: "Ohne Schweizer Bewilligung ist das Angebot illegal. Spielende sind nicht strafbar."
      },
      data: {
        site: {
          name: "BETBLITZ24",
          url: "https://www.betblitz24.example",
          headline: "🇨🇭 Super League Spezialquoten!",
          claim: "Jetzt in CHF einzahlen und 100 % Willkommensbonus sichern.",
          odds: ["Thun – Basel 2.10", "YB – Lugano 1.65", "Servette – FCZ 2.40"],
          footer: "© BetBlitz Ltd. · Valletta, Malta · Lizenziert in Malta · Spielen ab 18"
        },
        tools: [
          {
            label: "🔍 Impressum öffnen",
            result: "<b>Impressum:</b> BetBlitz Ltd., Valletta, Malta · Lizenz: Malta · <b>Schweizer Bewilligung: keine</b>"
          },
          {
            label: "📋 Gespa-Sperrliste prüfen",
            result: "<b>Treffer:</b> betblitz24.example steht auf der Sperrliste für nicht bewilligte Online-Geldspiele. <i>(fiktives Beispiel)</i>"
          },
          {
            label: "🌐 Zielgruppe ansehen",
            result: "Sprache Deutsch · Einzahlung in Franken · Werbung mit «Super League Spezialquoten» → richtet sich klar an die Schweiz."
          }
        ],
        verdicts: [
          {
            text: "Nina bietet die Wettseite Schweizer Kundinnen und Kunden an.",
            role: "offer",
            correct: "illegal"
          },
          {
            text: "Marco umgeht die Sperre per VPN und wettet dort. Macht er sich strafbar?",
            role: "participate",
            correct: "legal",
            labels: { legal: "Nein, nicht strafbar", illegal: "Ja, strafbar" }
          }
        ]
      }
    },
    {
      id: "advertising",
      letter: "L",
      location: "Werbebande",
      icon: "tv",
      colors: ["#f39c4a", "#b35a12"],
      person: {
        name: "Lena, Agentur «Kickboost»",
        avatar: { skin: "#f0c8a0", hair: "#d35400", style: "bob", shirt: "#e67e22", extra: ["glasses"] }
      },
      topic: "Werbung",
      role: "advertise",
      type: "adCheck",
      intro: "Hier ist mein Entwurf für die neue Handy-Kampagne von «TippTopp», einem bewilligten Anbieter (fiktiv). Morgen geht sie online. Findest du noch etwas, das rechtlich nicht geht?",
      task: "Tippe alle Stellen in der Werbung an, die <b>unzulässig</b> sind. Achtung: Nicht alles ist ein Problem! Dann «Prüfung abschliessen».",
      hint: "Werbung darf nicht irreführend oder aufdringlich sein und sich nicht an Minderjährige richten. Es gibt genau drei Probleme.",
      explanation: "Auch bewilligte Anbieter dürfen nicht beliebig werben: Werbung darf weder aufdringlich noch irreführend sein und sich nicht an Minderjährige oder gesperrte Personen richten. Schulmotive und «Gspänli in der Pause» zielen auf Jugendliche, «100 % sicherer Gewinn» ist irreführend. Der Hinweis «ab 18», das Logo und der Hinweis auf Hilfe sind in Ordnung.",
      source: {
        label: "Art. 74 Abs. 1 und 2, Art. 131 Abs. 1 BGS; Merkblatt BJ «Schutz Minderjähriger»",
        url: SOURCE.minors
      },
      sticker: {
        title: "Werbung mit Grenzen",
        emoji: "📣",
        fact: "Nicht irreführend, nicht aufdringlich, nicht an Minderjährige."
      },
      data: {
        spots: [
          { id: "logo", label: "Logo des Anbieters", violation: false, area: [6, 3, 88, 9] },
          { id: "image", label: "Pausenplatz mit Schulranzen", violation: true, area: [6, 14, 88, 33] },
          { id: "slogan", label: "Slogan «Gspänli in der grossen Pause»", violation: true, area: [6, 48, 88, 12] },
          { id: "promise", label: "«100 % sicherer Gewinn»", violation: true, area: [14, 66, 72, 10] },
          { id: "age", label: "Hinweis «ab 18»", violation: false, area: [6, 79, 28, 9] },
          { id: "help", label: "Hinweis auf Hilfe", violation: false, area: [36, 79, 58, 15] }
        ]
      }
    },
    {
      id: "social-wall",
      letter: "U",
      location: "Social-Media-Wall",
      icon: "phone",
      colors: ["#a55bd0", "#5e2a80"],
      person: {
        name: "Jan, Influencer",
        avatar: { skin: "#8d5a3b", hair: "#1a1a1a", style: "curly", shirt: "#8e44ad" }
      },
      topic: "Werbung",
      role: "mixed",
      type: "stories",
      intro: "Yo! Ich hab 80 000 Follower und poste heute zwei Stories. Die eine bringt mir sogar Geld 🤑. Passt das so?",
      task: "Beurteile jede Story: <b>zulässig</b> oder <b>unzulässig</b>?",
      hint: "Bei Story 1 macht Jan Werbung (Anbieterseite) – wofür genau? Bei Story 2 erzählt er nur von seiner eigenen Teilnahme an einem bewilligten Angebot.",
      explanation: "Werbung für in der Schweiz nicht bewilligte Geldspiele ist verboten, auch für Influencer – es droht eine Busse. Story 1 ist also unzulässig. Story 2 ist keine Werbung: Jan ist erwachsen und erzählt von seiner eigenen Teilnahme an einem bewilligten Angebot. Das ist zulässig.",
      source: { label: "Art. 74 Abs. 3 und Art. 131 Abs. 1 BGS", url: SOURCE.bgs },
      sticker: {
        title: "Kein Bonuscode für Illegale",
        emoji: "📱",
        fact: "Werbung für nicht bewilligte Geldspiele ist verboten – auch für Influencer."
      },
      data: {
        account: "jan.kickt",
        stories: [
          {
            theme: "warm",
            text: "Mit meinem Code bekommst du 50 Franken Startguthaben bei BetBlitz24! 🔥",
            code: "JAN50",
            meta: "Bezahlte Partnerschaft · BetBlitz24 ist in der Schweiz nicht bewilligt",
            correct: "illegal"
          },
          {
            theme: "cool",
            text: "Heute im Stadion! Hab mir privat einen Sporttip auf ein 2:1 gegönnt. Mal schauen 😄",
            meta: "Kein Sponsoring · Jan ist 26 · Sporttip ist ein bewilligtes Angebot",
            correct: "legal"
          }
        ]
      }
    },
    {
      id: "customer-service",
      letter: "S",
      location: "Kundendienst",
      icon: "shield",
      colors: ["#3a96d6", "#165985"],
      person: {
        name: "Du im Kundendienst",
        avatar: { skin: "#dba57c", hair: "#3a2a1a", style: "short", shirt: "#1f78b4", extra: ["headset"] }
      },
      topic: "Spielerschutz",
      role: "offer",
      type: "chat",
      intro: "Du arbeitest heute im Kundendienst eines bewilligten Online-Anbieters (fiktiv). Gerade meldet sich ein Kunde im Chat.",
      task: "Wähle bei jeder Nachricht die rechtlich und menschlich richtige Antwort.",
      hint: "Denk an drei Dinge: Sperrregister prüfen, keine Ausnahmen, auf Hilfsangebote hinweisen.",
      explanation: "Anbieter von Online-Sportwetten müssen ein Sozialkonzept haben und gesperrte Personen vom Spiel ausschliessen. Eine Spielsperre gilt für alle Spielbanken und alle online durchgeführten Grossspiele. Neue E-Mail-Adresse, Bonus oder «Ausnahme» – alles unzulässig.",
      source: { label: "Art. 71, 76, 80 und 81 BGS; BJ, Schutz vor exzessivem Geldspiel", url: SOURCE.playerProtection },
      sticker: {
        title: "Sperre heisst Sperre",
        emoji: "🛡️",
        fact: "Eine Spielsperre gilt für alle Spielbanken und Online-Grossspiele."
      },
      data: {
        contact: "Reto",
        agent: "Du (Kundendienst)",
        closing: "Danke … ich ruf da mal an. 🙏",
        steps: [
          {
            message: "Hoi! Ich möchte ein neues Konto eröffnen. Mein altes ist irgendwie gesperrt 😅 Geht das mit einer neuen E-Mail-Adresse?",
            systemNote: "Sperrregister: Treffer – Reto M., Spielsperre auf eigenen Antrag.",
            options: [
              {
                text: "Klar, mit neuer E-Mail geht das sofort!",
                correct: false,
                feedback: "Ein neues Konto darf kein Schlupfloch sein. Der Anbieter muss zuerst prüfen, ob die Person gesperrt ist."
              },
              { text: "Ich prüfe zuerst deine Personalien im Sperrregister.", correct: true },
              {
                text: "Gesperrt? Dann gibt's 50 Franken Bonus als Willkommensgeschenk!",
                correct: false,
                feedback: "Ein Bonus für eine möglicherweise gesperrte Person widerspricht dem Spielerschutz komplett."
              }
            ]
          },
          {
            message: "Ach komm, das war nur eine Phase. Mach doch eine Ausnahme, niemand merkt's.",
            options: [
              {
                text: "Okay, aber nur dieses eine Mal.",
                correct: false,
                feedback: "Eine Spielsperre gilt verbindlich. Der Anbieter darf keine Ausnahmen machen."
              },
              {
                text: "Versuch's doch bei einer ausländischen Seite.",
                correct: false,
                feedback: "Damit würdest du auf ein illegales Angebot verweisen – und Reto noch mehr gefährden."
              },
              {
                text: "Das darf ich nicht. Die Sperre gilt für alle Spielbanken und alle Online-Grossspiele. Aufheben lässt sie sich nur auf Antrag, wenn die Gründe weggefallen sind.",
                correct: true
              }
            ]
          },
          {
            message: "Hmm … ehrlich gesagt hab ich in letzter Zeit wieder ziemlich viel verloren.",
            options: [
              {
                text: "Selber schuld.",
                correct: false,
                feedback: "Anbieter müssen ein Sozialkonzept haben – dazu gehört, gefährdete Personen ernst zu nehmen und auf Hilfe hinzuweisen."
              },
              {
                text: "Danke, dass du das sagst. Es gibt kostenlose, anonyme Beratung, z. B. bei SOS Spielsucht (0800 040 080).",
                correct: true
              },
              {
                text: "Probier's doch mal mit Lotto, das ist was anderes.",
                correct: false,
                feedback: "Auch Lotto ist ein Geldspiel – das hilft Reto nicht."
              }
            ]
          }
        ]
      }
    },
    {
      id: "server-room",
      letter: "S",
      location: "Serverraum",
      icon: "server",
      colors: ["#2c5364", "#0f2027"],
      person: {
        name: "Aylin, Netzwerktechnikerin",
        avatar: { skin: "#c98e62", hair: "#1a1a1a", style: "long", shirt: "#16a085", extra: ["glasses"] }
      },
      topic: "Netzsperre",
      role: "authority",
      type: "netBlock",
      intro: "Ich arbeite bei einem Schweizer Internetanbieter (fiktiv). Wir müssen Geldspielseiten sperren, die auf der Sperrliste stehen. Mein Filter ist ausgefallen – hilf mir, den Datenverkehr von Hand zu prüfen!",
      task: "Lies den Steckbrief jeder Website und entscheide schnell: <b>Zugang offen lassen</b> oder <b>sperren</b>? Pro Datenpaket hast du 30 Sekunden.",
      hint: "Gesperrt werden nur Online-Geldspiele ohne Schweizer Bewilligung. Logos, Flaggen und ausländische Lizenzen zählen nicht – und eine Newsseite ohne Einsatz ist gar kein Geldspiel.",
      explanation: "Online-Geldspiele ohne Schweizer Bewilligung werden gesperrt. Die Gespa (Lotterien, Sportwetten) und die ESBK (Spielbankenspiele) führen Sperrlisten, und die Schweizer Internetanbieter müssen den Zugang blockieren. Wer eine gesperrte Seite aufruft, landet auf einer Informationsseite. Ein Schweizerkreuz im Logo ist keine Bewilligung.",
      source: { label: "Art. 86 ff. BGS; Merkblatt BJ «Illegale Onlineseiten»", url: SOURCE.illegalSites },
      sticker: {
        title: "Netzsperre",
        emoji: "🛰️",
        fact: "Nicht bewilligte Online-Geldspiele werden von Schweizer Internetanbietern blockiert."
      },
      data: {
        secondsPerSite: 30,
        sites: [
          {
            url: "www.swisslos.ch",
            logo: "🍀",
            tint: "#d4f1df",
            facts: [
              ["Betreiber", "Swisslos, Basel"],
              ["Angebot", "Lotterien und Sportwetten (Sporttip)"],
              ["Bewilligung", "Schweizer Bewilligung ✔"]
            ],
            shouldBlock: false,
            feedback: "Swisslos ist eine bewilligte Schweizer Veranstalterin. Ihr Angebot wird nicht gesperrt."
          },
          {
            url: "www.betblitz24.example",
            logo: "⚡",
            tint: "#ecdcff",
            facts: [
              ["Betreiber", "BetBlitz Ltd., Malta"],
              ["Angebot", "Online-Sportwetten in CHF"],
              ["Bewilligung", "nur Lizenz aus Malta"]
            ],
            shouldBlock: true,
            feedback: "Eine Lizenz aus Malta zählt nicht. Ohne Schweizer Bewilligung kommt die Seite auf die Sperrliste."
          },
          {
            url: "www.fussball-resultate.example",
            logo: "📰",
            tint: "#e6eef7",
            facts: [
              ["Betreiber", "Sportmedien AG, Zürich"],
              ["Angebot", "Resultate, Tabellen, Spielberichte"],
              ["Bewilligung", "nicht nötig"]
            ],
            shouldBlock: false,
            feedback: "Eine Sport-Newsseite ohne Geldeinsatz ist kein Geldspiel. Sie wird nicht gesperrt."
          },
          {
            url: "www.wetten-schweiz.example",
            logo: "🇨🇭",
            tint: "#ffe0e0",
            facts: [
              ["Betreiber", "unbekannt, Server im Ausland"],
              ["Angebot", "Online-Sportwetten, Logo mit Schweizerkreuz"],
              ["Bewilligung", "keine"]
            ],
            shouldBlock: true,
            feedback: "Ein Schweizerkreuz im Logo ist keine Bewilligung! Ohne Schweizer Bewilligung wird gesperrt."
          },
          {
            url: "www.loro.ch",
            logo: "🎯",
            tint: "#d4f1df",
            facts: [
              ["Betreiber", "Loterie Romande, Lausanne"],
              ["Angebot", "Lotterien und Sportwetten"],
              ["Bewilligung", "Schweizer Bewilligung ✔"]
            ],
            shouldBlock: false,
            feedback: "Die Loterie Romande ist eine bewilligte Schweizer Veranstalterin."
          },
          {
            url: "www.goalgold-casino.example",
            logo: "🎰",
            tint: "#fff1c9",
            facts: [
              ["Betreiber", "GoalGold N.V., Curaçao"],
              ["Angebot", "Online-Casino und Fussballwetten"],
              ["Bewilligung", "keine Schweizer Bewilligung"]
            ],
            shouldBlock: true,
            feedback: "Ausländisches Online-Geldspiel ohne Schweizer Bewilligung – sperren."
          }
        ]
      }
    },
    {
      id: "referee-room",
      letter: "P",
      location: "Schiri-Kabine",
      icon: "whistle",
      colors: ["#2b2b2b", "#0d0d0d"],
      person: {
        name: "Petra, Schiedsrichterin",
        avatar: { skin: "#f1c7a5", hair: "#a0522d", style: "bun", shirt: "#111111" }
      },
      topic: "Wettkampfmanipulation",
      role: "mixed",
      type: "judge",
      intro: "Vor dem Anpfiff hat mir Noah, ein junger Spieler aus einem Challenge-League-Team (fiktiv), diesen Chatverlauf gezeigt. Auf das Spiel werden Sportwetten angeboten. Was sagst du dazu?",
      task: "Lies den Chat und beurteile das Verhalten jeder Person: <b>strafbar</b> oder <b>nicht strafbar</b>?",
      hint: "Bei Wettkampfmanipulation sind beide Seiten strafbar: wer einen Vorteil anbietet – und wer ihn annimmt. Melden ist dagegen genau richtig.",
      explanation: "Wettkampfmanipulation ist in der Schweiz strafbar – für die Person, die einen Vorteil anbietet (indirekte Manipulation), und für den Spieler, der ihn annimmt (direkte Manipulation): Freiheitsstrafe bis zu drei Jahren oder Geldstrafe, in schweren Fällen bis zu fünf Jahren. Die Gespa befasst sich mit Wettkampfmanipulation und veröffentlicht jährlich einen Bericht dazu. Noah handelt vorbildlich.",
      source: {
        label: "Art. 25a Sportförderungsgesetz (SpoFöG); Gespa-Jahresbericht Wettkampfmanipulation, März 2026",
        url: SOURCE.matchFixing
      },
      sticker: {
        title: "Fair Play ist Pflicht",
        emoji: "🟥",
        fact: "Wettkampfmanipulation ist strafbar – bis zu 3 Jahre, in schweren Fällen 5."
      },
      data: {
        evidence: {
          title: "Chat · Luca (Verteidiger)",
          messages: [
            {
              author: "Unbekannte Nummer",
              text: "Hey Luca 👋 2000 Franken für dich, wenn du heute in den ersten 15 Minuten Gelb holst.",
              time: "13:02"
            },
            {
              author: "Unbekannte Nummer",
              text: "Ich setze dann online auf eine frühe Gelbe Karte. Bleibt unter uns 🤫",
              time: "13:03"
            },
            { own: true, text: "Ok, Deal. Schick das Geld vorher.", time: "13:10" }
          ],
          note: "Noah hat dieselbe Nachricht bekommen – und zeigt sie Petra."
        },
        labels: { legal: "Nicht strafbar", illegal: "Strafbar" },
        cases: [
          {
            title: "Die unbekannte Person",
            text: "bietet Luca 2000 Franken an, damit er absichtlich früh eine Gelbe Karte holt.",
            correct: "illegal"
          },
          { title: "Luca", text: "nimmt das Angebot an und verlangt das Geld im Voraus.", correct: "illegal" },
          {
            title: "Noah",
            text: "meldet die Nachricht der Schiedsrichterin, seinem Verein und der Meldestelle seines Verbands.",
            correct: "legal"
          }
        ]
      }
    },
    {
      id: "vip-lounge",
      letter: "F",
      location: "VIP-Lounge",
      icon: "trophy",
      colors: ["#2fbf9f", "#127462"],
      person: {
        name: "Sandra, Teamleiterin",
        avatar: { skin: "#f5d0b5", hair: "#a8321c", style: "bob", shirt: "#16a085" }
      },
      topic: "Privater Kreis",
      role: "mixed",
      type: "judge",
      intro: "Die WM kommt! Ich will ein Tippspiel organisieren und habe drei Ideen. Welche sind erlaubt?",
      task: "Beurteile jede Variante: <b>zulässig</b> oder <b>unzulässig</b>?",
      hint: "Kennen sich alle persönlich? Verdient jemand daran? Wird es öffentlich angeboten? Und: Braucht es überhaupt einen Geldeinsatz für ein Geldspiel?",
      explanation: "Geldspiele im privaten Kreis fallen nicht unter das Geldspielgesetz: nicht gewerbsmässig, Teilnehmende kennen sich persönlich, keine öffentliche Werbung (A). Ohne Geldeinsatz ist es gar kein Geldspiel (C). Wird das Tippspiel aber öffentlich online angeboten und schöpft Sandra Gewinn ab, verlässt es den privaten Kreis – ohne Bewilligung unzulässig (B).",
      source: { label: "Art. 1 Abs. 2 lit. a und Art. 3 lit. a BGS i.V.m. Art. 1 VGS", url: SOURCE.bgs },
      sticker: {
        title: "Privater Kreis",
        emoji: "🏆",
        fact: "Ein Tippspiel unter Bekannten ohne Gewinnabschöpfung fällt nicht unter das BGS."
      },
      data: {
        cases: [
          {
            title: "Variante A – Team-Tippspiel",
            text: "8 Leute aus meinem Team zahlen je 10 Franken. Wer am meisten richtig tippt, gewinnt den ganzen Topf. Ich verdiene nichts daran, und es wird nirgends öffentlich beworben.",
            correct: "legal"
          },
          {
            title: "Variante B – Öffentliches Online-Tippspiel",
            text: "Ich stelle das Tippspiel öffentlich ins Internet. Alle können gegen 10 Franken mitmachen, und ich behalte 20 % der Einsätze als «Organisationsgebühr».",
            correct: "illegal"
          },
          {
            title: "Variante C – Tippspiel ohne Einsatz",
            text: "Im Team tippen alle gratis mit. Wer gewinnt, bekommt den selbstgebastelten Wanderpokal fürs Büro.",
            correct: "legal"
          }
        ]
      }
    },
    {
      id: "legal-department",
      letter: "I",
      location: "Rechtsabteilung",
      icon: "law",
      colors: ["#8e6e3b", "#4d3a1c"],
      person: {
        name: "Dr. Elena Weber, Clubjuristin",
        avatar: { skin: "#f3d2b8", hair: "#2b1b10", style: "bob", shirt: "#34495e", extra: ["glasses", "tie"] }
      },
      topic: "Rechtsgrundlagen",
      role: "knowledge",
      type: "match",
      intro: "Mein Aktenschrank ist umgekippt! Sechs Fälle liegen durcheinander. Kannst du jedem Fall die richtige Rechtsgrundlage zuordnen?",
      task: "Tippe zuerst einen <b>Fall</b> an, dann den passenden <b>Artikel</b>. Wenn alle zugeordnet sind: «Akten prüfen».",
      hint: "Lies die Kurztitel der Artikel genau – sie verraten viel. Nur ein Artikel stammt nicht aus dem Geldspielgesetz.",
      explanation: "Das Bundesgesetz über Geldspiele (BGS, SR 935.51) regelt Minderjährigenschutz (Art. 72), Werbung (Art. 74), Spielsperren (Art. 80), Netzsperren (Art. 86 ff.) und Strafen (Art. 130 f.). Die Manipulation von Sportwettkämpfen ist im Sportförderungsgesetz geregelt (Art. 25a SpoFöG).",
      source: { label: "BGS, SR 935.51; SpoFöG, SR 415.0 – Fedlex", url: SOURCE.bgs },
      sticker: { title: "Die Paragrafen", emoji: "📜", fact: "Art. 72, 74, 80, 86, 130 BGS und Art. 25a SpoFöG." },
      data: {
        cases: [
          { text: "Ein Kiosk verkauft einen Sporttip-Schein an einen 16-Jährigen.", answer: "bgs-72" },
          { text: "Eine Kampagne wirbt mit Schulranzen und «Wette in der Pause!».", answer: "bgs-74" },
          { text: "Ein gesperrter Kunde eröffnet mit neuer E-Mail ein Konto.", answer: "bgs-80" },
          { text: "Ein Internetanbieter blockiert eine ausländische Wettseite.", answer: "bgs-86" },
          { text: "Eine Firma bietet ohne Bewilligung Online-Sportwetten an – Strafverfahren.", answer: "bgs-130" },
          { text: "Ein Spieler kassiert Geld für eine absichtliche Gelbe Karte.", answer: "spofog-25a" }
        ],
        options: [
          { id: "bgs-86", title: "Art. 86 BGS", description: "Sperre des Zugangs zu nicht bewilligten Online-Angeboten" },
          { id: "bgs-72", title: "Art. 72 BGS", description: "Schutz von Minderjährigen" },
          { id: "spofog-25a", title: "Art. 25a SpoFöG", description: "Wettkampfmanipulation" },
          {
            id: "bgs-130",
            title: "Art. 130 BGS",
            description: "Strafbestimmung: Geldspiele ohne Bewilligung durchführen"
          },
          { id: "bgs-80", title: "Art. 80 BGS", description: "Spielsperre" },
          { id: "bgs-74", title: "Art. 74 BGS", description: "Werbung" }
        ]
      }
    },
    {
      id: "museum",
      letter: "F",
      location: "Stadionmuseum",
      icon: "museum",
      colors: ["#7f8c8d", "#3d4849"],
      person: {
        name: "Herr Gerber, Museumsführer",
        avatar: { skin: "#f3d2b8", hair: "#ececec", style: "short", shirt: "#7f4f24", extra: ["glasses", "beard"] }
      },
      topic: "Geschichte des Geldspielrechts",
      role: "knowledge",
      type: "timeline",
      intro: "Willkommen im Museum! Leider hat jemand meine Ausstellung durcheinandergebracht. Die Tafeln zur Geschichte des Schweizer Geldspielrechts stehen in der falschen Reihenfolge.",
      task: "Bringe die Ereignisse in die <b>richtige zeitliche Reihenfolge</b> – vom ältesten oben bis zum neusten unten. Verschiebe mit ▲▼ oder per Ziehen.",
      hint: "Das Gesetz musste zuerst vom Parlament verabschiedet werden – dann kam das Referendum mit der Volksabstimmung, erst danach trat es in Kraft. Das Lotteriegesetz ist fast 100 Jahre älter.",
      explanation: "Lange galt das Lotteriegesetz von 1923. 2012 wurde ein neuer Verfassungsartikel angenommen, 2017 verabschiedete das Parlament das Geldspielgesetz, und am 10. Juni 2018 sagte das Volk mit 72,9 % Ja. Seit dem 1. Januar 2019 ist das BGS in Kraft – inklusive Netzsperren. Testkäufe der Gespa 2026 zeigen: Beim Jugendschutz gibt es weiterhin Lücken.",
      source: {
        label: "BJ, Geldspielgesetz; Swissvotes, Abstimmung vom 10.6.2018; Gespa-Medienmitteilung 15.7.2026",
        url: SOURCE.history
      },
      sticker: {
        title: "Seit 2019",
        emoji: "🏛️",
        fact: "Das BGS gilt seit 1.1.2019 – das Volk sagte 2018 mit 72,9 % Ja."
      },
      data: {
        /** In chronologisch richtiger Reihenfolge erfassen. */
        events: [
          { year: "1923", text: "Das Lotteriegesetz regelt Lotterien und gewerbsmässige Wetten." },
          { year: "2012", text: "Volk und Stände nehmen einen neuen Verfassungsartikel über Geldspiele an." },
          { year: "2017", text: "Das Parlament verabschiedet das neue Geldspielgesetz." },
          { year: "2018", text: "Das Stimmvolk sagt Ja zum Geldspielgesetz – mit 72,9 %." },
          {
            year: "2019",
            text: "Das Geldspielgesetz tritt in Kraft. Nicht bewilligte Online-Angebote können nun gesperrt werden."
          },
          {
            year: "2026",
            text: "Gespa-Testkäufe: Minderjährige kommen bei fast jedem zweiten Versuch zu einer Sportwette."
          }
        ],
        /** Anfangsreihenfolge (Indizes in events), damit die Aufgabe nicht schon gelöst startet. */
        initialOrder: [3, 0, 5, 1, 4, 2]
      }
    },
    {
      id: "press-conference",
      letter: "F",
      location: "Pressekonferenz",
      icon: "mic",
      colors: ["#59636c", "#2c3338"],
      person: {
        name: "Mia, Sportjournalistin",
        avatar: { skin: "#e8b98f", hair: "#2b1b10", style: "bun", shirt: "#34495e", extra: ["glasses"] }
      },
      topic: "Bewilligte Anbieter",
      role: "knowledge",
      type: "quiz",
      intro: "Ich schreibe einen Artikel über Sportwetten in der Schweiz. Für meinen Faktencheck brauche ich vier schnelle Antworten – kannst du mir helfen?",
      task: "Beantworte alle vier Fragen und klicke dann auf «Antworten abgeben».",
      hint: "Online-Sportwetten sind ein «Grossspiel». Die Aufsicht über Grossspiele liegt bei einer interkantonalen Behörde – nicht bei der Polizei oder einem Verband. Und die Testkäufe zeigten grosse Lücken.",
      explanation: "Online, automatisiert oder in mehreren Kantonen angebotene Sportwetten dürfen nur Swisslos und die Loterie Romande veranstalten. Die Gespa beaufsichtigt diese Grossspiele und führt die Sperrliste. Online-Grossspiele sind erst ab 18. Bei 200 Testkäufen 2026 schlossen Minderjährige in 47,5 % der Fälle eine Sportwette ab – an Selbstbedienungsgeräten sogar in 66,7 %.",
      source: {
        label: "Art. 3 lit. e, 72, 86 BGS; BJ, Fragen und Antworten zum BGS; Gespa-Medienmitteilung 15.7.2026",
        url: SOURCE.faq
      },
      sticker: { title: "Nur zwei dürfen", emoji: "🎤", fact: "Online-Sportwetten: nur Swisslos und Loterie Romande." },
      data: {
        questions: [
          {
            text: "Wer darf in der Schweiz Online-Sportwetten veranstalten?",
            options: [
              "Jede Firma mit einer EU-Lizenz",
              "Nur Swisslos und die Loterie Romande",
              "Jeder Fussballclub für seine eigenen Spiele",
              "Niemand – Online-Sportwetten sind verboten"
            ],
            answer: 1
          },
          {
            text: "Wer führt die Sperrliste für nicht bewilligte Online-Sportwetten und Lotterien?",
            options: ["Die FIFA", "Die Kantonspolizei", "Die Gespa (Interkantonale Geldspielaufsicht)", "Swisslos"],
            answer: 2
          },
          {
            text: "Ab welchem Alter dürfen online durchgeführte Grossspiele wie Sportwetten genutzt werden?",
            options: ["16 Jahre", "17 Jahre", "18 Jahre", "21 Jahre"],
            answer: 2
          },
          {
            text: "Gespa-Testkäufe 2026: Wie oft kamen minderjährige Testpersonen zu einer Sportwette?",
            options: [
              "In etwa 5 % der Fälle",
              "In 47,5 % der Fälle – fast jedes zweite Mal",
              "Nie – die Kontrollen funktionierten",
              "In allen Fällen"
            ],
            answer: 1
          }
        ]
      }
    }
  ]);

  // assets/js/core/storage.js
  function readJson(key) {
    try {
      const value = window.localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    } catch {
      return null;
    }
  }
  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
  function remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch {
    }
  }

  // assets/js/core/store.js
  var SCHEMA_VERSION = 5;
  function createInitialState() {
    return {
      version: SCHEMA_VERSION,
      playerName: "",
      certificateId: null,
      startedAt: null,
      finishedAt: null,
      jokersLeft: CONFIG.jokers,
      halftimeShown: false,
      finalUnlocked: false,
      penaltyGoals: 0,
      completed: false,
      stations: STATIONS.map(() => ({ solved: false, yellowCards: 0, jokerUsed: false, points: 0 }))
    };
  }
  function isValidSnapshot(snapshot) {
    return snapshot?.version === SCHEMA_VERSION && Array.isArray(snapshot.stations) && snapshot.stations.length === STATIONS.length && typeof snapshot.startedAt === "number";
  }
  var state = createInitialState();
  var listeners = /* @__PURE__ */ new Set();
  function notify() {
    listeners.forEach((listener) => listener(state));
  }
  var store = {
    get state() {
      return state;
    },
    /** Ändert den Zustand über eine Funktion, speichert und benachrichtigt. */
    update(mutator) {
      mutator(state);
      writeJson(CONFIG.storageKey, state);
      notify();
    },
    /** Startet ein neues Spiel. */
    reset(playerName) {
      state = createInitialState();
      state.playerName = playerName;
      state.startedAt = Date.now();
      writeJson(CONFIG.storageKey, state);
      notify();
    },
    /** Gibt einen gespeicherten, unfertigen Spielstand zurück (ohne ihn zu laden). */
    peekSavedGame() {
      const snapshot = readJson(CONFIG.storageKey);
      return isValidSnapshot(snapshot) && !snapshot.completed ? snapshot : null;
    },
    /** Lädt den gespeicherten Spielstand. */
    restore() {
      const snapshot = this.peekSavedGame();
      if (!snapshot) return false;
      state = snapshot;
      notify();
      return true;
    },
    /** Löscht den gespeicherten Spielstand. */
    clear() {
      remove(CONFIG.storageKey);
      state = createInitialState();
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }
  };

  // assets/js/core/rules.js
  var SOLUTION_CODE = STATIONS.map((station) => station.letter).join("");
  var MAX_POINTS = STATIONS.length * CONFIG.points.base + CONFIG.penalty.shots * CONFIG.points.penaltyGoal;
  function stationScore({ yellowCards, jokerUsed }) {
    const { base, yellowCard, joker, minimum } = CONFIG.points;
    return Math.max(minimum, base - yellowCards * yellowCard - (jokerUsed ? joker : 0));
  }
  var solvedCount = (state2) => state2.stations.filter((entry) => entry.solved).length;
  var allStationsSolved = (state2) => solvedCount(state2) === STATIONS.length;
  var totalYellowCards = (state2) => state2.stations.reduce((sum, entry) => sum + entry.yellowCards, 0);
  var jokersUsed = (state2) => CONFIG.jokers - state2.jokersLeft;
  function totalPoints(state2) {
    const stationPoints = state2.stations.reduce((sum, entry) => sum + entry.points, 0);
    return stationPoints + state2.penaltyGoals * CONFIG.points.penaltyGoal;
  }
  function elapsedMs(state2, now = Date.now()) {
    if (!state2.startedAt) return 0;
    return (state2.finishedAt ?? now) - state2.startedAt;
  }
  function rankFor(points) {
    const share = points / MAX_POINTS;
    if (share >= 0.9) return "🏆 Schiedsrichter-Legende";
    if (share >= 0.75) return "🥇 Fair-Play-Profi";
    if (share >= 0.55) return "🥈 Solide Abwehr";
    return "🥉 Starke Einwechslung";
  }
  var displayPlayerName = (state2) => state2.playerName || "Spieler/in";

  // assets/js/core/game.js
  function createCertificateId(timestamp) {
    const date = new Date(timestamp);
    const stamp = [date.getFullYear() % 100, date.getMonth() + 1, date.getDate()].map((part) => String(part).padStart(2, "0")).join("");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const suffix = Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
    return `AB-${stamp}-${suffix}`;
  }
  function startNewGame(playerName) {
    store.reset(playerName.trim().slice(0, 40));
  }
  function startClock() {
    store.update((state2) => {
      state2.startedAt = Date.now();
    });
  }
  function recordMistake(index) {
    store.update((state2) => {
      state2.stations[index].yellowCards += 1;
    });
  }
  function useJoker(index) {
    const entry = store.state.stations[index];
    if (entry.solved || entry.jokerUsed || store.state.jokersLeft <= 0) return false;
    store.update((state2) => {
      state2.jokersLeft -= 1;
      state2.stations[index].jokerUsed = true;
    });
    return true;
  }
  function solveStation(index) {
    const entry = store.state.stations[index];
    if (entry.solved) return entry.points;
    const points = stationScore(entry);
    store.update((state2) => {
      Object.assign(state2.stations[index], { solved: true, points });
    });
    return points;
  }
  function markHalftimeShown() {
    store.update((state2) => {
      state2.halftimeShown = true;
    });
  }
  function tryUnlockFinal(code) {
    if (code.trim().toUpperCase() !== SOLUTION_CODE) return false;
    store.update((state2) => {
      state2.finalUnlocked = true;
    });
    return true;
  }
  function finishPenaltyRound(goals) {
    if (goals < CONFIG.penalty.goalsRequired) return false;
    store.update((state2) => {
      state2.penaltyGoals = Math.max(state2.penaltyGoals, goals);
      state2.completed = true;
      state2.finishedAt ??= Date.now();
      state2.certificateId ??= createCertificateId(state2.finishedAt);
    });
    return true;
  }

  // assets/js/graphics/avatar.js
  var HAIR_STYLES = {
    short: (hair) => ({
      front: `<path d="M31 42 Q30 22 50 22 Q70 22 69 42 Q65 31 50 30 Q35 31 31 42Z" fill="${hair}"/>`
    }),
    long: (hair) => ({
      back: `<path d="M27 46 Q26 20 50 19 Q74 20 73 46 L76 76 Q50 82 24 76Z" fill="${hair}"/>`,
      front: `<path d="M31 42 Q33 25 50 24 Q67 25 69 42 Q60 33 47 33 Q38 34 31 42Z" fill="${hair}"/>`
    }),
    bun: (hair) => ({
      back: `<circle cx="50" cy="20" r="9" fill="${hair}"/>`,
      front: `<path d="M31 44 Q30 24 50 24 Q70 24 69 44 Q64 31 50 31 Q36 31 31 44Z" fill="${hair}"/>`
    }),
    curly: (hair) => ({
      front: [
        [34, 32],
        [42, 26],
        [51, 24],
        [60, 26],
        [67, 32],
        [31, 40],
        [69, 40]
      ].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${hair}"/>`).join("")
    }),
    cap: () => ({
      front: '<path d="M30 40 Q30 22 50 22 Q70 22 70 40Z" fill="#c0392b"/><path d="M50 38 L80 40 Q78 44 50 42Z" fill="#922b21"/><circle cx="50" cy="23" r="2.5" fill="#922b21"/>'
    }),
    bob: (hair) => ({
      back: `<path d="M28 48 Q26 21 50 20 Q74 21 72 48 L72 60 Q66 62 64 56 L36 56 Q34 62 28 60Z" fill="${hair}"/>`,
      front: `<path d="M31 42 Q34 24 50 24 Q66 24 69 42 Q66 34 50 32 Q40 33 31 42Z" fill="${hair}"/>`
    })
  };
  var BODY_EXTRAS = {
    apron: () => '<path d="M38 74 L62 74 L64 100 L36 100Z" fill="#f4f1e6"/>',
    tie: () => '<path d="M50 70 L46 74 L50 92 L54 74Z" fill="#c0392b"/><path d="M42 70 L50 76 L58 70" fill="#fff"/>'
  };
  var FACE_EXTRAS = {
    beard: (hair) => `<path d="M34 48 Q36 66 50 66 Q64 66 66 48 Q62 58 50 58 Q38 58 34 48Z" fill="${hair}"/>`,
    glasses: () => '<g fill="none" stroke="#222" stroke-width="2"><circle cx="43" cy="46" r="5.5"/><circle cx="57" cy="46" r="5.5"/><path d="M48.5 46 L51.5 46"/></g>',
    headset: () => '<path d="M30 46 Q30 22 50 22 Q70 22 70 46" fill="none" stroke="#222" stroke-width="3"/><rect x="26" y="42" width="7" height="12" rx="3" fill="#222"/><rect x="67" y="42" width="7" height="12" rx="3" fill="#222"/><path d="M30 54 Q32 62 42 61" stroke="#222" stroke-width="2" fill="none"/><circle cx="43" cy="61" r="2.5" fill="#222"/>'
  };
  function avatarSvg({ skin, hair, shirt, style = "short", extra = [] }) {
    const hairParts = (HAIR_STYLES[style] ?? HAIR_STYLES.short)(hair);
    const bodyExtras = extra.map((name) => BODY_EXTRAS[name]?.(hair) ?? "").join("");
    const faceExtras = extra.map((name) => FACE_EXTRAS[name]?.(hair) ?? "").join("");
    return `<svg class="avatar" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    ${hairParts.back ?? ""}
    <path d="M18 100 Q18 72 50 70 Q82 72 82 100Z" fill="${shirt}"/>${bodyExtras}
    <rect x="44" y="58" width="12" height="14" rx="4" fill="${skin}"/>
    <circle cx="31" cy="47" r="4" fill="${skin}"/><circle cx="69" cy="47" r="4" fill="${skin}"/>
    <ellipse cx="50" cy="45" rx="18" ry="20" fill="${skin}"/>
    <circle cx="43" cy="46" r="2.2" fill="#222"/><circle cx="57" cy="46" r="2.2" fill="#222"/>
    <circle cx="39" cy="53" r="3" fill="#e8806a" opacity=".35"/><circle cx="61" cy="53" r="3" fill="#e8806a" opacity=".35"/>
    <path d="M44 55 Q50 60 56 55" stroke="#7a3b2a" stroke-width="2" fill="none" stroke-linecap="round"/>
    ${hairParts.front ?? ""}${faceExtras}
  </svg>`;
  }

  // assets/js/ui/cutscene.js
  var TYPING_INTERVAL_MS = 22;
  var CHARACTERS_PER_TICK = 2;
  function playCutscene(lines, { onEffect } = {}) {
    const dialog2 = qs("#cutscene");
    const text = qs('[data-ref="text"]', dialog2);
    const dots = qs('[data-ref="dots"]', dialog2);
    const next = qs('[data-action="next"]', dialog2);
    const skip = qs('[data-action="skip"]', dialog2);
    setHtml(qs('[data-ref="name"]', dialog2), NARRATOR.name);
    setHtml(qs('[data-ref="portrait"]', dialog2), raw(avatarSvg(NARRATOR.avatar)));
    return new Promise((resolve) => {
      let index = 0;
      let typingTimer = null;
      const finishTyping = () => {
        clearInterval(typingTimer);
        typingTimer = null;
        text.textContent = lines[index].text;
      };
      const showLine = () => {
        const line = lines[index];
        if (line.effect) onEffect?.(line.effect);
        setHtml(
          dots,
          html`
          ${lines.map(
            (_, i) => html`
              <i class="${i <= index ? "is-active" : ""}"></i>
            `
          )}
        `
        );
        next.textContent = index === lines.length - 1 ? "Los geht’s! ⚽" : "Weiter ▶";
        let shown = 0;
        text.textContent = "";
        clearInterval(typingTimer);
        typingTimer = setInterval(() => {
          shown += CHARACTERS_PER_TICK;
          text.textContent = line.text.slice(0, shown);
          if (shown >= line.text.length) finishTyping();
        }, TYPING_INTERVAL_MS);
      };
      const end = () => {
        clearInterval(typingTimer);
        next.removeEventListener("click", onNext);
        skip.removeEventListener("click", onSkip);
        dialog2.removeEventListener("cancel", onSkip);
        if (dialog2.open) dialog2.close();
        resolve();
      };
      function onNext() {
        if (typingTimer) {
          finishTyping();
          return;
        }
        index += 1;
        if (index >= lines.length) end();
        else showLine();
      }
      function onSkip(event) {
        event?.preventDefault();
        lines.slice(index + 1).forEach((line) => line.effect && onEffect?.(line.effect));
        end();
      }
      next.addEventListener("click", onNext);
      skip.addEventListener("click", onSkip);
      dialog2.addEventListener("cancel", onSkip);
      dialog2.showModal();
      next.focus();
      showLine();
    });
  }

  // assets/js/ui/dialog.js
  var dialog = null;
  var body = null;
  var onCloseCallback = null;
  function initDialog() {
    dialog = qs("#dialog");
    body = qs('[data-ref="dialog-body"]', dialog);
    qs('[data-action="close-dialog"]', dialog).addEventListener("click", () => closeDialog());
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) closeDialog();
    });
    dialog.addEventListener("close", () => {
      const callback = onCloseCallback;
      onCloseCallback = null;
      callback?.();
    });
  }
  function openDialog(content, { label, onClose } = {}) {
    if (dialog.open) dialog.close();
    setHtml(body, content);
    body.scrollTop = 0;
    dialog.setAttribute("aria-label", label ?? "");
    onCloseCallback = onClose ?? null;
    dialog.showModal();
    return body;
  }
  function closeDialog() {
    if (dialog.open) dialog.close();
  }

  // assets/js/ui/effects.js
  var TOAST_DURATION_MS = 2600;
  var CONFETTI_FRAMES = 420;
  var CONFETTI_COLORS = ["#f5c542", "#e74c3c", "#ffffff", "#1f9a55", "#3e8ed0"];
  var prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.setAttribute("role", "status");
    element.textContent = message;
    const host = document.querySelector("dialog[open]") ?? document.body;
    host.append(element);
    setTimeout(() => element.remove(), TOAST_DURATION_MS);
  }
  function confetti() {
    if (prefersReducedMotion()) return;
    const canvas = document.getElementById("confetti");
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const pieces = Array.from({ length: 220 }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.6,
      width: 6 + Math.random() * 6,
      height: 8 + Math.random() * 8,
      vx: -2 + Math.random() * 4,
      vy: 2 + Math.random() * 4,
      rotation: Math.random() * 6,
      spin: -0.2 + Math.random() * 0.4,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)]
    }));
    let frame = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.03;
        piece.rotation += piece.spin;
        ctx.save();
        ctx.translate(piece.x, piece.y);
        ctx.rotate(piece.rotation);
        ctx.fillStyle = piece.color;
        ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
        ctx.restore();
      });
      frame += 1;
      if (frame < CONFETTI_FRAMES) window.requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    };
    window.requestAnimationFrame(draw);
  }

  // assets/js/ui/navigation.js
  var routes = /* @__PURE__ */ new Map();
  var teardown = null;
  var currentRoute = null;
  function defineRoute(name, { element, render: render2, scrollTo = "scoreboard" }) {
    routes.set(name, { element, render: render2, scrollTo });
  }
  function navigate(name, params = {}) {
    const route = routes.get(name);
    if (!route) throw new Error(`Unbekannte Ansicht: ${name}`);
    teardown?.();
    teardown = null;
    routes.forEach(({ element }) => {
      element.hidden = element !== route.element;
    });
    currentRoute = name;
    teardown = route.render(route.element, params) ?? null;
    const anchor = route.scrollTo === "top" ? null : document.getElementById(route.scrollTo);
    const top = anchor && !anchor.hidden ? anchor.offsetTop - 8 : 0;
    window.scrollTo({ top, behavior: "smooth" });
  }
  var getCurrentRoute = () => currentRoute;

  // assets/js/core/utils.js
  function shuffle(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }
  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1e3));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  function parseIsoDate(iso) {
    const [year, month, day] = iso.split("-").map(Number);
    return { year, month, day };
  }
  function ageOn(birthIso, referenceIso) {
    const birth = parseIsoDate(birthIso);
    const ref = parseIsoDate(referenceIso);
    let age = ref.year - birth.year;
    const birthdayNotYetReached = ref.month < birth.month || ref.month === birth.month && ref.day < birth.day;
    if (birthdayNotYetReached) age -= 1;
    return age;
  }
  var LONG_DATE = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  var SHORT_DATE = new Intl.DateTimeFormat("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
  function formatDate(iso, { long = false } = {}) {
    const { year, month, day } = parseIsoDate(iso);
    const date = new Date(year, month - 1, day, 12);
    return (long ? LONG_DATE : SHORT_DATE).format(date);
  }
  function slugify(text) {
    return text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "spieler";
  }

  // assets/js/ui/scoreboard.js
  var HALF = Math.ceil(STATIONS.length / 2);
  var elements = null;
  var clockTimer = null;
  function renderClock() {
    elements.clock.textContent = formatDuration(elapsedMs(store.state));
  }
  function render(flashIndex = -1) {
    const { state: state2 } = store;
    const slots = STATIONS.map((station, index) => {
      const solved = state2.stations[index].solved;
      const classes = ["scoreboard__slot", solved && "is-filled", index === HALF && "has-gap"].filter(Boolean).join(" ");
      return html`
      <span class="${classes}" data-slot="${index}">${solved ? station.letter : "·"}</span>
    `;
    });
    setHtml(
      elements.slots,
      html`
      ${slots}
    `
    );
    if (flashIndex >= 0) restartAnimation(elements.slots.children[flashIndex], "is-flashing");
    elements.points.textContent = String(totalPoints(state2));
    elements.albumCount.textContent = String(solvedCount(state2));
    renderClock();
  }
  function initScoreboard({ onAction }) {
    const root = qs("#scoreboard");
    elements = {
      root,
      clock: qs('[data-ref="clock"]', root),
      points: qs('[data-ref="points"]', root),
      slots: qs('[data-ref="slots"]', root),
      albumCount: qs('[data-ref="album-count"]', root),
      ticker: qs('[data-ref="ticker"]', root)
    };
    root.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");
      if (button) onAction(button.dataset.action, button);
    });
    store.subscribe(() => render());
  }
  function showScoreboard() {
    elements.root.hidden = false;
    render();
    clearInterval(clockTimer);
    clockTimer = setInterval(renderClock, 1e3);
  }
  function flashLetter(index) {
    render(index);
  }
  function announce(message) {
    elements.ticker.textContent = `+++ ${message} +++`;
    restartAnimation(elements.ticker, "is-running");
  }

  // assets/js/graphics/artwork.js
  var svg = (viewBox, body2, className = "") => `<svg class="${className}" viewBox="${viewBox}" aria-hidden="true" focusable="false">${body2}</svg>`;
  var ICONS = Object.freeze({
    phone: svg(
      "0 0 40 40",
      '<rect x="11" y="3" width="18" height="34" rx="4" fill="#222"/><rect x="13" y="7" width="14" height="24" fill="#c13584"/><rect x="16" y="15" width="8" height="8" rx="2" fill="none" stroke="#fff" stroke-width="2"/><circle cx="20" cy="19" r="2" fill="#fff"/>'
    ),
    kiosk: svg(
      "0 0 40 40",
      '<rect x="5" y="16" width="30" height="20" fill="#d9a35b"/><path d="M3 16 L8 6 L32 6 L37 16Z" fill="#c0392b"/><path d="M8 6 L11 16 M16 6 L17 16 M24 6 L23 16 M32 6 L29 16" stroke="#fff" stroke-width="2"/><rect x="12" y="21" width="16" height="9" fill="#fff"/>'
    ),
    globe: svg(
      "0 0 40 40",
      '<circle cx="20" cy="20" r="16" fill="#3e8ed0"/><path d="M10 13 Q16 10 18 16 Q14 20 17 25 Q12 27 9 22Z M23 8 Q30 12 28 18 Q24 17 22 13Z M24 24 Q30 23 31 28 Q26 33 23 29Z" fill="#5fbf6a"/>'
    ),
    tv: svg(
      "0 0 40 40",
      '<rect x="10" y="3" width="20" height="34" rx="4" fill="#111"/><rect x="12" y="7" width="16" height="25" fill="#ff2d55"/><path d="M17 14 V25 L25 19.5Z" fill="#fff"/>'
    ),
    shield: svg(
      "0 0 40 40",
      '<path d="M20 3 L34 8 V19 Q34 31 20 37 Q6 31 6 19 V8Z" fill="#1f78b4"/><path d="M13 13 L27 27 M27 13 L13 27" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>'
    ),
    trophy: svg(
      "0 0 40 40",
      '<path d="M12 5 H28 V15 Q28 24 20 24 Q12 24 12 15Z" fill="#f5c542"/><path d="M12 8 H6 Q6 17 13 17 M28 8 H34 Q34 17 27 17" stroke="#f5c542" stroke-width="2.5" fill="none"/><rect x="18" y="24" width="4" height="6" fill="#d79b13"/><rect x="12" y="30" width="16" height="6" rx="1" fill="#6b4a1a"/>'
    ),
    flag: svg(
      "0 0 40 40",
      '<rect x="8" y="4" width="3" height="33" fill="#555"/><path d="M11 5 Q20 1 26 6 Q32 10 36 6 V22 Q32 26 26 22 Q20 17 11 21Z" fill="#e74c3c"/><path d="M19 9 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4z" fill="#fff"/>'
    ),
    mic: svg(
      "0 0 40 40",
      '<rect x="14" y="3" width="12" height="20" rx="6" fill="#34495e"/><path d="M9 17 Q9 29 20 29 Q31 29 31 17" stroke="#34495e" stroke-width="3" fill="none"/><rect x="18" y="29" width="4" height="6" fill="#34495e"/><rect x="12" y="34" width="16" height="3" rx="1" fill="#34495e"/>'
    ),
    server: svg(
      "0 0 40 40",
      '<rect x="7" y="4" width="26" height="9" rx="2" fill="#2c3e50"/><rect x="7" y="15" width="26" height="9" rx="2" fill="#2c3e50"/><rect x="7" y="26" width="26" height="9" rx="2" fill="#2c3e50"/><circle cx="12" cy="8.5" r="1.8" fill="#36d27c"/><circle cx="12" cy="19.5" r="1.8" fill="#d23b30"/><circle cx="12" cy="30.5" r="1.8" fill="#36d27c"/><path d="M17 8.5 H29 M17 19.5 H29 M17 30.5 H29" stroke="#7fd4ff" stroke-width="1.5"/>'
    ),
    whistle: svg(
      "0 0 40 40",
      '<rect x="9" y="5" width="9" height="13" rx="2" fill="#f7d31a" stroke="#222" transform="rotate(-10 13 11)"/><rect x="20" y="7" width="9" height="13" rx="2" fill="#d23b30" stroke="#222" transform="rotate(10 24 13)"/><circle cx="20" cy="28" r="7" fill="#444"/><rect x="20" y="24" width="14" height="6" rx="2" fill="#444"/>'
    ),
    law: svg(
      "0 0 40 40",
      '<rect x="18.5" y="6" width="3" height="26" fill="#6b4a1a"/><rect x="11" y="32" width="18" height="4" rx="1" fill="#6b4a1a"/><path d="M8 11 H32" stroke="#6b4a1a" stroke-width="2.5"/><path d="M8 11 L4 21 H12Z M32 11 L28 21 H36Z" fill="#d79b13"/><circle cx="20" cy="6" r="3" fill="#d79b13"/>'
    ),
    museum: svg(
      "0 0 40 40",
      '<path d="M4 14 L20 4 L36 14Z" fill="#7f8c8d"/><rect x="7" y="16" width="4" height="15" fill="#95a5a6"/><rect x="15" y="16" width="4" height="15" fill="#95a5a6"/><rect x="21" y="16" width="4" height="15" fill="#95a5a6"/><rect x="29" y="16" width="4" height="15" fill="#95a5a6"/><rect x="4" y="32" width="32" height="4" fill="#7f8c8d"/>'
    ),
    lock: svg(
      "0 0 100 100",
      '<path d="M35 50 V36 Q35 20 50 20 Q65 20 65 36 V50" fill="none" stroke="currentColor" stroke-width="8"/><rect x="25" y="48" width="50" height="40" rx="8" fill="#f5c542"/>'
    )
  });
  var YELLOW_CARD = svg(
    "0 0 54 76",
    '<rect x="3" y="3" width="44" height="66" rx="5" fill="#f7d31a" stroke="#1b1f1c" stroke-width="2" transform="rotate(-8 27 38)"/>',
    "referee-card"
  );
  var GREEN_CARD = svg(
    "0 0 54 76",
    '<g transform="rotate(8 27 38)"><rect x="3" y="3" width="44" height="66" rx="5" fill="#1f9a55" stroke="#1b1f1c" stroke-width="2"/><path d="M14 38 L23 47 L39 28" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>',
    "referee-card"
  );
  var VAR_SCREEN = svg(
    "0 0 54 54",
    '<rect x="2" y="8" width="50" height="34" rx="5" fill="#1b1f1c"/><rect x="6" y="12" width="42" height="26" fill="#2f6fd0"/><text x="27" y="31" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="16" fill="#fff">VAR</text><rect x="20" y="42" width="14" height="6" fill="#1b1f1c"/>',
    "referee-card"
  );
  var PADLOCK = svg(
    "0 0 120 150",
    '<path class="padlock__shackle" d="M30 70 V45 Q30 15 60 15 Q90 15 90 45 V70" fill="none" stroke="#9aa3a0" stroke-width="12" stroke-linecap="round"/><rect x="14" y="66" width="92" height="76" rx="14" fill="#f5c542" stroke="#b38a17" stroke-width="4"/><circle cx="60" cy="98" r="9" fill="#6b4a1a"/><rect x="56" y="102" width="8" height="20" rx="3" fill="#6b4a1a"/>',
    "padlock"
  );
  var TROPHY = svg(
    "0 0 120 130",
    '<path d="M30 10 H90 V45 Q90 80 60 80 Q30 80 30 45Z" fill="#f5c542" stroke="#b38a17" stroke-width="3"/><path d="M30 20 H12 Q10 55 34 55 M90 20 H108 Q110 55 86 55" stroke="#f5c542" stroke-width="7" fill="none"/><rect x="52" y="80" width="16" height="18" fill="#d79b13"/><rect x="32" y="98" width="56" height="22" rx="4" fill="#5c3d12"/><text x="60" y="114" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="14" fill="#f5c542">FAIR PLAY</text><circle cx="60" cy="40" r="14" fill="#fff" stroke="#222" stroke-width="2"/><polygon points="60,32 67,37 64,45 56,45 53,37" fill="#222"/>',
    "trophy"
  );
  var BALL = svg(
    "0 0 40 40",
    '<circle cx="20" cy="20" r="18" fill="#fff" stroke="#222" stroke-width="2"/><polygon points="20,11 28,17 25,26 15,26 12,17" fill="#222"/><path d="M20 11 V3 M28 17 L36 14 M25 26 L30 34 M15 26 L10 34 M12 17 L4 14" stroke="#222" stroke-width="2"/>'
  );
  var GOALKEEPER = svg(
    "0 0 100 130",
    '<rect x="8" y="40" width="22" height="12" rx="6" fill="#f5c542" transform="rotate(-35 19 46)"/><rect x="70" y="40" width="22" height="12" rx="6" fill="#f5c542" transform="rotate(35 81 46)"/><circle cx="12" cy="34" r="8" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="88" cy="34" r="8" fill="#fff" stroke="#222" stroke-width="2"/><path d="M28 44 Q50 36 72 44 L68 90 H32Z" fill="#f5c542" stroke="#b38a17" stroke-width="2"/><text x="50" y="74" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="20" fill="#1b1f1c">1</text><rect x="34" y="88" width="13" height="34" rx="5" fill="#1b1f1c"/><rect x="53" y="88" width="13" height="34" rx="5" fill="#1b1f1c"/><circle cx="50" cy="24" r="14" fill="#e8b98f"/><path d="M36 22 Q38 8 50 8 Q62 8 64 22 Q58 15 50 15 Q42 15 36 22Z" fill="#2b1b10"/><circle cx="45" cy="25" r="1.8" fill="#222"/><circle cx="55" cy="25" r="1.8" fill="#222"/><path d="M45 31 Q50 34 55 31" stroke="#7a3b2a" stroke-width="1.6" fill="none"/>'
  );
  var GOAL_FRAME = `<svg viewBox="0 0 600 260" preserveAspectRatio="none" aria-hidden="true" focusable="false">
  <defs><pattern id="goal-net" width="18" height="18" patternUnits="userSpaceOnUse"><path d="M0 0 L18 18 M18 0 L0 18" stroke="rgba(255,255,255,.35)" stroke-width="1.2"/></pattern></defs>
  <rect x="10" y="10" width="580" height="250" fill="rgba(0,0,0,.25)"/><rect x="10" y="10" width="580" height="250" fill="url(#goal-net)"/>
  <rect width="600" height="12" fill="#fff"/><rect width="12" height="260" fill="#fff"/><rect x="588" width="12" height="260" fill="#fff"/>
</svg>`;
  var STADIUM_MAP = `<svg class="stadium-map__base" viewBox="0 0 1000 620" role="img" aria-label="Stadionplan von oben">
  <defs>
    <pattern id="seats-red" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#3b4652"/><circle cx="6" cy="6" r="3" fill="#c0392b"/></pattern>
    <pattern id="seats-white" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#3b4652"/><circle cx="6" cy="6" r="3" fill="#e8e8e8"/></pattern>
    <pattern id="lawn" width="80" height="10" patternUnits="userSpaceOnUse"><rect width="40" height="10" fill="#2f9152"/><rect x="40" width="40" height="10" fill="#2a8549"/></pattern>
  </defs>
  <rect width="1000" height="620" fill="#4f6b52"/>
  <g fill="#6b8a6e"><circle cx="40" cy="40" r="26"/><circle cx="960" cy="590" r="30"/><circle cx="980" cy="70" r="22"/><circle cx="30" cy="560" r="24"/></g>
  <path d="M0 604 H1000" stroke="#8c8c8c" stroke-width="26"/><path d="M0 604 H1000" stroke="#fff" stroke-width="2" stroke-dasharray="20 18"/>
  <ellipse cx="500" cy="310" rx="440" ry="275" fill="#2b3239"/>
  <ellipse cx="500" cy="310" rx="420" ry="258" fill="url(#seats-red)"/>
  <path d="M500 52 A420 258 0 0 1 920 310 A420 258 0 0 1 500 568" fill="url(#seats-white)" opacity=".85"/>
  <ellipse cx="500" cy="310" rx="330" ry="190" fill="#b5653f"/>
  <ellipse cx="500" cy="310" rx="318" ry="180" fill="url(#lawn)"/>
  <g stroke="#fff" stroke-width="3" fill="none" opacity=".85"><rect x="270" y="170" width="460" height="280"/><line x1="500" y1="170" x2="500" y2="450"/><circle cx="500" cy="310" r="46"/><rect x="270" y="245" width="60" height="130"/><rect x="670" y="245" width="60" height="130"/></g>
  <rect x="258" y="285" width="12" height="50" fill="#fff"/><rect x="730" y="285" width="12" height="50" fill="#fff"/>
  <rect x="440" y="584" width="120" height="30" rx="6" fill="#1b1f1c"/>
  <text x="500" y="605" fill="#f5c542" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="18" letter-spacing="2">AUSGANG</text>
</svg>`;

  // assets/js/views/certificate.js
  var TOPICS = ["Bewilligte Anbieter", "Mindestalter", "Ausländische Onlineangebote", "Spielerschutz", "Werbung"];
  function certificateMarkup(state2) {
    const points = totalPoints(state2);
    const date = new Date(state2.finishedAt ?? Date.now()).toLocaleDateString("de-CH", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
    return html`
    <article class="certificate" aria-label="Zertifikat">
      <div class="certificate__frame">
        <div class="certificate__seal">${raw(TROPHY)}</div>
        <p class="certificate__eyebrow">Zertifikat</p>
        <h2 class="certificate__title">Fussballwetten &amp; Recht</h2>
        <p class="certificate__intro">Hiermit wird bestätigt, dass</p>
        <p class="certificate__name">${displayPlayerName(state2)}</p>
        <p class="certificate__text">
          das Lernspiel <b>«Abpfiff! – Das Wett-Escape»</b> erfolgreich abgeschlossen, alle ${STATIONS.length} Stationen
          gelöst und das Penaltyschiessen gewonnen hat.
        </p>
        <ul class="certificate__topics">
          ${TOPICS.map((topic) => html`<li>${topic}</li>`)}
        </ul>
        <dl class="certificate__stats">
          <div><dt>Punkte</dt><dd>${points} / ${MAX_POINTS}</dd></div>
          <div><dt>Zeit</dt><dd>${formatDuration(elapsedMs(state2))}</dd></div>
          <div><dt>Penaltys</dt><dd>${state2.penaltyGoals}/${CONFIG.penalty.shots}</dd></div>
          <div><dt>Rang</dt><dd>${rankFor(points)}</dd></div>
        </dl>
        <div class="certificate__footer">
          <span>${date}</span>
          <span>Nr. ${state2.certificateId ?? "–"}</span>
          <span>Ruedi, Stadionwart</span>
        </div>
        <p class="certificate__note">
          Lernspiel ohne echte Wetten, Einsätze oder Preise · Rechtsstand ${CONFIG.legalStatus}
        </p>
      </div>
    </article>
  `;
  }
  function printCertificate(state2) {
    setHtml(qs("#print-root"), certificateMarkup(state2));
    window.print();
  }

  // assets/js/content/labels.js
  var ROLE_LABELS = Object.freeze({
    offer: "Anbieten",
    participate: "Teilnahme",
    advertise: "Werbung",
    mixed: "Gemischt",
    authority: "Behörde/Internetanbieter",
    knowledge: "Wissen"
  });
  var TYPE_LABELS = Object.freeze({
    idCheck: "Ausweiskontrolle",
    sort: "Sortieren",
    websiteCheck: "Website-Check",
    adCheck: "Werbe-Check",
    stories: "Story-Check",
    chat: "Live-Chat",
    netBlock: "Netzsperre",
    judge: "Fälle beurteilen",
    match: "Paragraphen-Puzzle",
    timeline: "Zeitstrahl",
    quiz: "Faktencheck"
  });
  var VERDICT_LABELS = Object.freeze({
    legal: "Zulässig",
    illegal: "Unzulässig"
  });

  // assets/js/ui/components.js
  function progressDots(total, current) {
    const dots = Array.from({ length: total }, (_, i) => {
      const state2 = i < current ? "is-done" : i === current ? "is-current" : "";
      return html`
      <i class="${state2}"></i>
    `;
    });
    return html`
    <span class="progress-dots" aria-label="Schritt ${current + 1} von ${total}">${dots}</span>
  `;
  }
  function verdictButtons(group, labels = {}) {
    const text = { ...VERDICT_LABELS, ...labels };
    return html`
    <div class="choice-group" role="group">
      <button type="button" class="choice choice--legal" data-group="${group}" data-value="legal" aria-pressed="false">
        ${text.legal}
      </button>
      <button
        type="button"
        class="choice choice--illegal"
        data-group="${group}"
        data-value="illegal"
        aria-pressed="false"
      >
        ${text.illegal}
      </button>
    </div>
  `;
  }
  function optionButtons(group, options) {
    return html`
    <div class="choice-group choice-group--grid" role="group">
      ${options.map(
      (option, index) => html`
          <button
            type="button"
            class="choice choice--neutral"
            data-group="${group}"
            data-value="${index}"
            aria-pressed="false"
          >
            ${option}
          </button>
        `
    )}
    </div>
  `;
  }
  function createChoiceTracker(root, { numeric = false, onSelect } = {}) {
    const answers = /* @__PURE__ */ new Map();
    const handle = (event) => {
      const button = event.target.closest(".choice[data-group]");
      if (!button || !root.contains(button)) return false;
      const { group } = button.dataset;
      const value = numeric ? Number(button.dataset.value) : button.dataset.value;
      answers.set(group, value);
      root.querySelectorAll(`.choice[data-group="${group}"]`).forEach((other) => {
        other.setAttribute("aria-pressed", String(other === button));
      });
      onSelect?.(group, value);
      return true;
    };
    return { answers, handle };
  }
  var FEEDBACK_ICONS = { success: GREEN_CARD, error: YELLOW_CARD, hint: VAR_SCREEN };
  function showFeedback(element, variant, content) {
    setHtml(
      element,
      html`
      ${raw(FEEDBACK_ICONS[variant])}
      <div class="feedback__body">${content}</div>
    `
    );
    element.className = `feedback feedback--${variant}`;
    element.hidden = false;
    if (variant === "error") restartAnimation(element, "is-shaking");
  }
  function hideFeedback(element) {
    if (!element.classList.contains("feedback--hint")) element.hidden = true;
  }
  function statTiles(items) {
    return html`
    <div class="stat-tiles">
      ${items.map(
      ({ label, value }) => html`
          <div class="stat-tile">
            <span class="stat-tile__label">${label}</span>
            <span class="stat-tile__value">${value}</span>
          </div>
        `
    )}
    </div>
  `;
  }
  function sourceList(sources) {
    return html`
    <ul class="source-list">
      ${sources.map(
      (source) => html`
          <li><a href="${source.url}" target="_blank" rel="noopener">${source.label}</a></li>
        `
    )}
    </ul>
  `;
  }

  // assets/js/views/dialogs.js
  var narratorPortrait = () => html`
  <div class="narrator-portrait">${raw(avatarSvg(NARRATOR.avatar))}</div>
`;
  function openHalftime() {
    const { state: state2 } = store;
    const body2 = openDialog(
      html`
      <div class="center">
        ${narratorPortrait()}
        <h2 class="dialog__title">⏸️ Halbzeit!</h2>
        <p class="lead">Ruedi bringt dir einen Pausentee: «${HALFTIME.message}»</p>
      </div>
      ${statTiles([
        { label: "Punkte", value: `${totalPoints(state2)}` },
        { label: "Zeit", value: formatDuration(elapsedMs(state2)) },
        { label: "Gelbe Karten", value: `${totalYellowCards(state2)}` },
        { label: "Joker übrig", value: `${state2.jokersLeft}` }
      ])}
      <section class="info-box">
        <h3 class="info-box__title">📰 ${HALFTIME.factTitle}</h3>
        <p>${raw(HALFTIME.fact)}</p>
        <p class="hint">Quelle: ${HALFTIME.factSource}</p>
      </section>
      <div class="actions actions--center">
        <button type="button" class="btn" data-action="second-half">▶ Zweite Halbzeit anpfeifen</button>
      </div>
    `,
      { label: "Halbzeit" }
    );
    qs('[data-action="second-half"]', body2).addEventListener("click", closeDialog);
  }
  function openPenaltyBriefing(onStart) {
    const body2 = openDialog(
      html`
      <div class="center">
        ${narratorPortrait()}
        <h2 class="dialog__title">Schlusspfiff … fast!</h2>
        <p class="lead">«${raw(PENALTY_BRIEFING)}»</p>
        <div class="actions actions--center">
          <button type="button" class="btn" data-action="start-penalty">⚽ Zum Penaltyschiessen</button>
        </div>
      </div>
    `,
      { label: "Penaltyschiessen", onClose: onStart }
    );
    qs('[data-action="start-penalty"]', body2).addEventListener("click", closeDialog);
  }
  function openAlbum(highlightIndex = -1) {
    const { state: state2 } = store;
    openDialog(
      html`
      <h2 class="dialog__title">🎴 Sammelalbum</h2>
      <p class="hint">
        ${solvedCount(state2)} von ${STATIONS.length} Stickern gesammelt. Löst Stationen, um weitere freizuschalten.
      </p>
      <ul class="album">
        ${STATIONS.map((station, index) => {
        const unlocked = state2.stations[index].solved;
        const classes = ["sticker", !unlocked && "is-locked", unlocked && index === highlightIndex && "is-new"].filter(Boolean).join(" ");
        return html`
            <li class="${classes}" style="--sticker-from:${station.colors[0]};--sticker-to:${station.colors[1]}">
              <div class="sticker__image">
                <span class="sticker__number">${index + 1}</span>
                <span class="sticker__emoji" aria-hidden="true">${unlocked ? station.sticker.emoji : "❔"}</span>
                ${raw(avatarSvg(station.person.avatar))}
              </div>
              <div class="sticker__body">
                <h3 class="sticker__title">${unlocked ? station.sticker.title : "???"}</h3>
                <p class="sticker__fact">
                  ${unlocked ? station.sticker.fact : `Station ${index + 1}: ${station.location}`}
                </p>
              </div>
            </li>
          `;
      })}
      </ul>
    `,
      { label: "Sammelalbum" }
    );
  }

  // assets/js/views/intro.js
  var RULES = [
    {
      icon: "🗺️",
      title: "12 Orte, 12 Rätsel",
      text: "Kiosk, Fankurve, Serverraum, Schiri-Kabine … Die Reihenfolge ist frei."
    },
    {
      icon: "⚖️",
      title: "Anbieten oder teilnehmen?",
      text: "Wer Wetten anbietet, verkauft oder bewirbt, hat andere Pflichten als wer mitspielt."
    },
    { icon: "🟨📺", title: "Gelbe Karten & VAR", text: "Fehler kosten Punkte. Drei VAR-Joker liefern Hinweise." },
    { icon: "🎴⚽", title: "Album & Penaltys", text: "Sammle 12 Sticker – und verwandle im Finale deine Penaltys." }
  ];
  function renderIntro(element, { onStart, onResume }) {
    const saved = store.peekSavedGame();
    setHtml(
      element,
      html`
      <div class="intro">
        <div>
          <h2 class="panel__title">Nach dem Schlusspfiff eingeschlossen!</h2>
          <p class="lead">
            Das Spiel ist vorbei, das Stadion leer – und plötzlich gehen alle Tore zu. Nur wer an zwölf Orten im Stadion
            die Regeln zu Fussballwetten in der Schweiz richtig anwendet, knackt den Code und kommt hinaus.
          </p>
          <ul class="rule-cards">
            ${RULES.map(
        (rule) => html`
                <li class="rule-card">
                  <span class="rule-card__icon" aria-hidden="true">${rule.icon}</span>
                  <strong>${rule.title}</strong>
                  ${rule.text}
                </li>
              `
      )}
          </ul>
          <form class="start-form" data-ref="start-form">
            <label class="field">
              <span class="field__label">Dein Name (erscheint auf dem Zertifikat)</span>
              <input
                class="field__input"
                name="player"
                maxlength="28"
                placeholder="Vorname Nachname"
                autocomplete="off"
                required
              />
            </label>
            <div class="actions">
              <button type="submit" class="btn">▶ Anpfiff – Spiel starten</button>
              ${saved ? html`
                      <button type="button" class="btn btn--ghost" data-action="resume">
                        Weiterspielen als «${saved.playerName}» (${solvedCount(saved)}/${STATIONS.length})
                      </button>
                    ` : ""}
            </div>
          </form>
        </div>
        <aside class="intro__aside">
          <section class="info-box">
            <h3 class="info-box__title">🎮 So funktioniert's</h3>
            <ul class="check-list">
              <li>
                Du spielst alleine und in deinem Tempo. Am Ende erhältst du ein
                <b>persönliches Zertifikat</b>
                zum Ausdrucken.
              </li>
              <li>Dauer: etwa 30–45 Minuten. Ton einschalten lohnt sich.</li>
              <li>Dein Fortschritt wird automatisch gespeichert. Neu laden ist kein Problem.</li>
              <li>Kostenlos, ohne echte Wetten, Einsätze oder Preise. Alle Personen und Fälle sind erfunden.</li>
            </ul>
          </section>
        </aside>
      </div>
    `
    );
    const form = qs('[data-ref="start-form"]', element);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      onStart(new FormData(form).get("player").toString());
    });
    qs('[data-action="resume"]', element)?.addEventListener("click", onResume);
  }

  // assets/js/views/lock.js
  var UNLOCK_DELAY_MS = 900;
  function renderLock(element, { onUnlocked, onBack }) {
    const length = SOLUTION_CODE.length;
    const half = Math.ceil(length / 2);
    setHtml(
      element,
      html`
      <div class="lock">
        <div class="lock__visual" data-ref="padlock">${raw(PADLOCK)}</div>
        <div>
          <h2 class="panel__title">Der Penaltypunkt</h2>
          <p>
            Hier, mitten auf dem Rasen, steckt die Steuerung für das Ausgangstor. Gebt den ${length}-stelligen Code ein
            – die Buchstaben der Stationen 1 bis ${length} in der richtigen Reihenfolge. Die Anzeigetafel hilft!
          </p>
          <form data-ref="code-form" autocomplete="off">
            <fieldset class="code-input">
              <legend class="visually-hidden">Lösungscode</legend>
              ${Array.from(
        { length },
        (_, i) => html`
                  <input
                    class="code-input__char ${i === half ? "has-gap" : ""}"
                    maxlength="1"
                    aria-label="Buchstabe ${i + 1}"
                    autocapitalize="characters"
                  />
                `
      )}
            </fieldset>
            <div class="actions">
              <button type="submit" class="btn">🔓 Entsperren</button>
              <button type="button" class="btn btn--ghost" data-action="back">← Stadionkarte</button>
            </div>
          </form>
          <div class="feedback" data-ref="feedback" role="status" hidden></div>
        </div>
      </div>
    `
    );
    const form = qs('[data-ref="code-form"]', element);
    const inputs = qsa(".code-input__char", element);
    const feedback = qs('[data-ref="feedback"]', element);
    let unlockTimer = null;
    inputs.forEach((input, i) => {
      input.addEventListener("input", () => {
        input.value = input.value.toUpperCase().replace(/[^A-Z]/g, "");
        if (input.value && inputs[i + 1]) inputs[i + 1].focus();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Backspace" && !input.value && inputs[i - 1]) inputs[i - 1].focus();
      });
      input.addEventListener("paste", (event) => {
        event.preventDefault();
        const pasted = (event.clipboardData.getData("text") || "").toUpperCase().replace(/[^A-Z]/g, "");
        [...pasted].slice(0, length - i).forEach((char, offset) => {
          inputs[i + offset].value = char;
        });
        inputs[Math.min(i + pasted.length, length - 1)].focus();
      });
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const code = inputs.map((input) => input.value).join("");
      if (tryUnlockFinal(code)) {
        qs(".padlock", element).classList.add("is-open");
        sound.play("longWhistle");
        announce(`Code ${SOLUTION_CODE} geknackt! ${displayPlayerName(store.state)} tritt zum Penaltyschiessen an`);
        unlockTimer = setTimeout(onUnlocked, UNLOCK_DELAY_MS);
        return;
      }
      sound.play("error");
      const missing = STATIONS.length - solvedCount(store.state);
      showFeedback(
        feedback,
        "error",
        html`
        <h3 class="feedback__title">Gesperrt.</h3>
        <p>
          ${missing > 0 ? `Dir fehlen noch ${missing} Buchstaben. Geh zurück zur Stadionkarte.` : "Der Code stimmt noch nicht. Gib die Buchstaben in der Reihenfolge der Stationsnummern ein."}
        </p>
      `
      );
    });
    qs('[data-action="back"]', element).addEventListener("click", onBack);
    inputs[0].focus();
    return () => clearTimeout(unlockTimer);
  }

  // assets/js/views/map.js
  function pinPosition(index) {
    const angle = (-90 + index * 360 / STATIONS.length) * Math.PI / 180;
    return { x: 50 + 40.5 * Math.cos(angle), y: 50 + 39.5 * Math.sin(angle) };
  }
  function phaseLabel(state2) {
    if (allStationsSolved(state2)) return "Finale";
    return solvedCount(state2) < CONFIG.halftimeAfter ? "1. Halbzeit" : "2. Halbzeit";
  }
  function statusText(state2) {
    if (!allStationsSolved(state2)) {
      return `${solvedCount(state2)} von ${STATIONS.length} Orten gelöst · VAR-Joker: ${state2.jokersLeft}`;
    }
    return state2.finalUnlocked ? "Penaltypunkt entsperrt – auf zum Penaltyschiessen! ⚽" : "Alle 12 Buchstaben! Ab zum Penaltypunkt in der Mitte 🔓";
  }
  function renderMap(element, { onOpenStation, onOpenFinal, onHalftime }) {
    const { state: state2 } = store;
    const ready = allStationsSolved(state2);
    const pins = STATIONS.map((station, index) => {
      const { x, y } = pinPosition(index);
      const solved = state2.stations[index].solved;
      return html`
      <button
        type="button"
        class="map-pin ${solved ? "is-solved" : ""}"
        style="left:${x}%;top:${y}%;--pin-from:${station.colors[0]};--pin-to:${station.colors[1]}"
        data-station="${index}"
        aria-label="Station ${index + 1}: ${station.location}${solved ? " (gelöst)" : ""}"
      >
        <span class="map-pin__face">${raw(avatarSvg(station.person.avatar))}</span>
        <span class="map-pin__number">${solved ? "✓" : index + 1}</span>
        <span class="map-pin__label">${station.location}</span>
      </button>
    `;
    });
    setHtml(
      element,
      html`
      <header class="map-header">
        <h2 class="map-header__title">
          <span class="phase-badge">${phaseLabel(state2)}</span>
          ${displayPlayerName(state2)}
        </h2>
        <p class="map-header__status">${statusText(state2)}</p>
      </header>
      <div class="stadium-map">
        ${raw(STADIUM_MAP)} ${pins}
        <button
          type="button"
          class="map-pin map-pin--final ${ready ? "is-ready" : ""}"
          style="left:50%;top:50%"
          data-final
          aria-label="Penaltypunkt: letzte Station"
        >
          <span class="map-pin__face">${raw(state2.finalUnlocked ? BALL : ICONS.lock)}</span>
          <span class="map-pin__label">Penaltypunkt</span>
        </button>
      </div>
      <ul class="station-list">
        ${STATIONS.map(
        (station, index) => html`
            <li>
              <button
                type="button"
                class="station-list__item ${state2.stations[index].solved ? "is-solved" : ""}"
                data-station="${index}"
              >
                <span class="station-list__number">${state2.stations[index].solved ? "✓" : index + 1}</span>
                <span>
                  ${station.location}
                  <small>${station.person.name} · ${station.topic}</small>
                </span>
              </button>
            </li>
          `
      )}
        <li>
          <button type="button" class="station-list__item station-list__item--final" data-final>
            <span class="station-list__number">⚽</span>
            <span>
              Penaltypunkt
              <small>Letzte Station – Code nötig</small>
            </span>
          </button>
        </li>
      </ul>
    `
    );
    const removeStationListener = delegate(
      element,
      "click",
      "[data-station]",
      (_, button) => onOpenStation(Number(button.dataset.station))
    );
    const removeFinalListener = delegate(element, "click", "[data-final]", () => onOpenFinal());
    let halftimeTimer = null;
    if (solvedCount(state2) >= CONFIG.halftimeAfter && !state2.halftimeShown) {
      halftimeTimer = setTimeout(onHalftime, 450);
    }
    return () => {
      clearTimeout(halftimeTimer);
      removeStationListener();
      removeFinalListener();
    };
  }

  // assets/js/content/penalties.js
  var PENALTY_QUESTIONS = Object.freeze([
    {
      question: "Wer darf in der Schweiz online Sportwetten anbieten?",
      options: ["Jede Firma mit EU-Lizenz", "Nur Swisslos und Loterie Romande", "Jeder Fussballclub"],
      answer: 1,
      explanation: "Online-Sportwetten sind Grossspiele – nur Swisslos und Loterie Romande dürfen sie veranstalten."
    },
    {
      question: "Lara (19) tippt online bei Swisslos 10 Franken. Ist das zulässig?",
      options: ["Ja, zulässig", "Nein, unzulässig", "Nur mit Erlaubnis der Eltern"],
      answer: 0,
      explanation: "Lara ist volljährig und nutzt ein bewilligtes Angebot."
    },
    {
      question: "Marco wettet per VPN auf einer gesperrten Auslandseite. Macht er sich strafbar?",
      options: [
        "Ja, Gefängnis",
        "Nein – aber er riskiert die Einziehung von Einsätzen und Gewinnen",
        "Ja, Busse bis 500 000 Franken"
      ],
      answer: 1,
      explanation: "Spielende sind nicht strafbar, verlieren aber den Schweizer Spielerschutz."
    },
    {
      question: "Werbung für nicht bewilligte Geldspiele ist …",
      options: ["erlaubt mit Hinweis «ab 18»", "nur online erlaubt", "verboten"],
      answer: 2,
      explanation: "Art. 74 Abs. 3 BGS: Werbung für nicht bewilligte Geldspiele ist verboten."
    },
    {
      question: "Für wen gilt eine Spielsperre?",
      options: ["Nur für einen Anbieter", "Für alle Spielbanken und Online-Grossspiele", "Nur für einen Monat"],
      answer: 1,
      explanation: "Die Sperre gilt anbieterübergreifend."
    },
    {
      question: "Wer führt die Sperrliste für nicht bewilligte Online-Sportwetten?",
      options: ["Die Gespa", "Die FIFA", "Der Fussballverband"],
      answer: 0,
      explanation: "Die Interkantonale Geldspielaufsicht Gespa führt die Sperrliste für Lotterien und Sportwetten."
    },
    {
      question: "Jemand bietet einem Spieler Geld für eine absichtliche Gelbe Karte. Das ist …",
      options: ["legal, wenn es privat bleibt", "strafbar", "nur eine Vereinsangelegenheit"],
      answer: 1,
      explanation: "Wettkampfmanipulation ist strafbar (Art. 25a SpoFöG)."
    },
    {
      question: "Ein Tippspiel im Team ohne Gewinnabschöpfung, unter Bekannten …",
      options: ["fällt nicht unter das Geldspielgesetz", "braucht eine Bewilligung der Gespa", "ist verboten"],
      answer: 0,
      explanation: "Geldspiele im privaten Kreis fallen nicht unter das BGS."
    },
    {
      question: "Eine Website hat ein Schweizerkreuz im Logo, aber keine Bewilligung. Was gilt?",
      options: ["Sie ist automatisch bewilligt", "Sie kommt auf die Sperrliste", "Sie braucht nur eine Lizenz aus Malta"],
      answer: 1,
      explanation: "Ein Logo ist keine Bewilligung – ohne Schweizer Bewilligung wird gesperrt."
    },
    {
      question: "Seit wann gilt das Geldspielgesetz?",
      options: ["Seit 1. Januar 2019", "Seit 1923", "Seit 2026"],
      answer: 0,
      explanation: "Das BGS ist seit dem 1. Januar 2019 in Kraft."
    }
  ]);

  // assets/js/views/penalty.js
  var ZONES = [24, 50, 76];
  var ZONE_LABELS = ["A", "B", "C"];
  var SHOT_DURATION_MS = 620;
  var MISS_OFFSET = [-10, 0, 10];
  function renderPenalty(element, { onWon, onBack }) {
    const { shots, goalsRequired } = CONFIG.penalty;
    const timers = /* @__PURE__ */ new Set();
    let round;
    const later = (callback, delay) => {
      const id = setTimeout(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.add(id);
    };
    function startRound() {
      round = {
        questions: shuffle(PENALTY_QUESTIONS).slice(0, shots),
        shot: 0,
        results: [],
        zoneToOption: [],
        busy: false
      };
      renderShot();
    }
    function scoreDots() {
      return html`
      <div class="penalty-score" aria-label="Spielstand">
        ${Array.from({ length: shots }, (_, i) => {
        const result = round.results[i];
        const state2 = result === true ? "is-goal" : result === false ? "is-miss" : i === round.shot ? "is-current" : "";
        const label = result === true ? "⚽" : result === false ? "✗" : i + 1;
        return html`
            <span class="penalty-score__dot ${state2}">${label}</span>
          `;
      })}
        <span class="penalty-score__summary">
          ${goals()} ${goals() === 1 ? "Tor" : "Tore"} · nötig: ${goalsRequired}
        </span>
      </div>
    `;
    }
    const goals = () => round.results.filter(Boolean).length;
    function renderShot() {
      const question = round.questions[round.shot];
      round.zoneToOption = shuffle([0, 1, 2]);
      round.busy = false;
      setHtml(
        element,
        html`
        <h2 class="panel__title">⚽ Penaltyschiessen</h2>
        ${scoreDots()}
        <p class="penalty-question">Penalty ${round.shot + 1}/${shots}: ${question.question}</p>
        <div class="pitch" data-ref="pitch">
          <div class="pitch__goal">${raw(GOAL_FRAME)}</div>
          ${ZONES.map(
          (x, zone) => html`
              <button
                type="button"
                class="pitch__zone"
                style="left:${x - 12.75}%"
                data-zone="${zone}"
                aria-label="Ecke ${ZONE_LABELS[zone]}: ${question.options[round.zoneToOption[zone]]}"
              >
                <span class="pitch__zone-label">${ZONE_LABELS[zone]}</span>
              </button>
            `
        )}
          <div class="pitch__keeper" data-ref="keeper">${raw(GOALKEEPER)}</div>
          <span class="pitch__spot"></span>
          <div class="pitch__ball" data-ref="ball">${raw(BALL)}</div>
          <div class="pitch__message" data-ref="message" aria-live="assertive"></div>
        </div>
        <div class="penalty-answers">
          ${ZONES.map(
          (_, zone) => html`
              <button type="button" class="penalty-answer" data-zone="${zone}">
                <span class="penalty-answer__label">${ZONE_LABELS[zone]}</span>
                ${question.options[round.zoneToOption[zone]]}
              </button>
            `
        )}
        </div>
        <div class="feedback" data-ref="feedback" role="status" hidden></div>
      `
      );
    }
    function keeperZone(shotZone, isGoal) {
      if (!isGoal) return shotZone;
      const others = [0, 1, 2].filter((zone) => zone !== shotZone);
      return others[Math.floor(Math.random() * others.length)];
    }
    function shoot(zone) {
      if (round.busy) return;
      round.busy = true;
      const question = round.questions[round.shot];
      const isGoal = round.zoneToOption[zone] === question.answer;
      const ball = qs('[data-ref="ball"]', element);
      const keeper = qs('[data-ref="keeper"]', element);
      const diveZone = keeperZone(zone, isGoal);
      qsa("[data-zone]", element).forEach((button) => {
        button.disabled = true;
      });
      sound.play("kick");
      ball.style.left = `${ZONES[zone]}%`;
      ball.style.top = zone === 1 ? "26%" : "32%";
      ball.style.transform = "translate(-50%, -50%) scale(.6) rotate(540deg)";
      keeper.style.left = `${ZONES[diveZone]}%`;
      keeper.style.transform = diveZone === 1 ? "translate(-50%, -14%)" : `translate(-50%, 8%) rotate(${diveZone === 0 ? -68 : 68}deg)`;
      later(() => resolveShot(zone, isGoal, question), SHOT_DURATION_MS);
    }
    function resolveShot(zone, isGoal, question) {
      const ball = qs('[data-ref="ball"]', element);
      if (!isGoal) {
        ball.style.left = `${ZONES[zone] + MISS_OFFSET[zone]}%`;
        ball.style.top = "70%";
        ball.style.transform = "translate(-50%, -50%) scale(.75) rotate(720deg)";
      }
      const message = qs('[data-ref="message"]', element);
      message.classList.toggle("is-goal", isGoal);
      setHtml(
        message,
        html`
        <span>${isGoal ? "TOOOR!" : "GEHALTEN!"}</span>
      `
      );
      round.results[round.shot] = isGoal;
      sound.play(isGoal ? "goal" : "save");
      announce(
        isGoal ? `TOOOR für ${displayPlayerName(store.state)}! Penalty ${round.shot + 1} sitzt` : `Penalty ${round.shot + 1} gehalten! Der Goalie jubelt`
      );
      qsa(".penalty-answer", element).forEach((button) => {
        const buttonZone = Number(button.dataset.zone);
        if (round.zoneToOption[buttonZone] === question.answer) button.classList.add("is-correct");
        else if (buttonZone === zone) button.classList.add("is-wrong");
      });
      const isLast = round.shot === shots - 1;
      showFeedback(
        qs('[data-ref="feedback"]', element),
        isGoal ? "success" : "error",
        html`
        <h3 class="feedback__title">${isGoal ? "Richtig!" : "Leider falsch."}</h3>
        <p>${question.explanation}</p>
        <div class="actions">
          <button type="button" class="btn" data-action="next">
            ${isLast ? "Ergebnis ansehen" : "Nächster Penalty ▶"}
          </button>
        </div>
      `
      );
      qs('[data-action="next"]', element).focus();
    }
    function next() {
      round.shot += 1;
      if (round.shot < shots) {
        renderShot();
        return;
      }
      if (finishPenaltyRound(goals())) {
        onWon();
        return;
      }
      setHtml(
        element,
        html`
        <div class="center">
          <h2 class="panel__title">Verlängerung!</h2>
          <p class="lead">
            Nur ${goals()} von ${shots} Penaltys verwandelt – das Tor bleibt noch zu. Ruedi meint: «Kopf hoch, neue
            Runde, neue Fragen!»
          </p>
          <div class="actions actions--center">
            <button type="button" class="btn" data-action="retry">⚽ Nochmals antreten</button>
            <button type="button" class="btn btn--ghost" data-action="back">Zur Stadionkarte</button>
          </div>
        </div>
      `
      );
    }
    const onClick = (event) => {
      const zoneButton = event.target.closest("[data-zone]");
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (zoneButton) shoot(Number(zoneButton.dataset.zone));
      else if (action === "next") next();
      else if (action === "retry") startRound();
      else if (action === "back") onBack();
    };
    element.addEventListener("click", onClick);
    startRound();
    return () => {
      timers.forEach(clearTimeout);
      element.removeEventListener("click", onClick);
    };
  }

  // assets/js/content/sources.js
  var SOURCES = Object.freeze([
    {
      label: "Bundesgesetz über Geldspiele (Geldspielgesetz, BGS), SR 935.51 – Fedlex",
      url: "https://www.fedlex.admin.ch/eli/cc/2018/795/de"
    },
    {
      label: "Sportförderungsgesetz (SpoFöG), SR 415.0, Art. 25a – Fedlex",
      url: "https://www.fedlex.admin.ch/eli/cc/2012/460/de"
    },
    { label: "Interkantonale Geldspielaufsicht (Gespa)", url: "https://www.gespa.ch" },
    {
      label: "Gespa – Medienmitteilung Testkäufe Sportwetten, 15.7.2026",
      url: "https://www.gespa.ch/download/pictures/e6/913p1yhtgkg69nu6pgzowrh0syu2b4/26-07-15_medienmitteilung_testkaeufe.pdf"
    },
    {
      label: "Gespa – Jahresbericht Wettkampfmanipulation, März 2026",
      url: "https://www.gespa.ch/download/pictures/96/lledf36lzjm4xvs1w7lp8kd8kg362t/26-03-12_jahresbericht_wettkampfmanipulation_de.pdf"
    },
    {
      label: "Bundesamt für Justiz – Fragen und Antworten zum Geldspielgesetz",
      url: "https://www.bj.admin.ch/de/fragen-und-antworten-zum-geldspielgesetz"
    },
    {
      label: "Bundesamt für Justiz – Schutz vor exzessivem Geldspiel",
      url: "https://www.bj.admin.ch/de/schutz-der-spielerinnen-und-spieler-vor-exzessivem-geldspiel"
    },
    {
      label: "Bundesamt für Justiz – Merkblatt Schutz Minderjähriger",
      url: "https://www.bj.admin.ch/dam/bj/de/data/wirtschaft/geldspiele/merkblaetter/mb-schutz-minderjaehriger-d.pdf"
    },
    {
      label: "Bundesamt für Justiz – Merkblatt Illegale Onlineseiten",
      url: "https://www.bj.admin.ch/dam/bj/de/data/wirtschaft/geldspiele/merkblaetter/mb-illegale-onlineseiten-d.pdf"
    },
    {
      label: "Swissvotes – Abstimmung über das Geldspielgesetz vom 10.6.2018",
      url: "https://swissvotes.ch/vote/619.00"
    }
  ]);

  // assets/js/content/takeaways.js
  var KEY_TAKEAWAYS = Object.freeze([
    {
      title: "🏟️ Bewilligte Anbieter",
      text: "Online, automatisiert oder in mehreren Kantonen angebotene Sportwetten dürfen nur Swisslos und die Loterie Romande veranstalten."
    },
    {
      title: "🔞 Mindestalter",
      text: "Online-Grossspiele sind ab 18. Swisslos und Loterie Romande verlangen auch am Kiosk 18 Jahre – die Verkaufsstelle muss kontrollieren."
    },
    {
      title: "🌍 Ausländische Angebote",
      text: "Anbieten ist verboten und strafbar, die Seiten werden gesperrt. Spielende sind nicht strafbar, verlieren aber jeden Schutz."
    },
    {
      title: "🛡️ Spielerschutz",
      text: "Sozialkonzept, Spielsperren für alle Anbieter, Hinweis auf Hilfe – und Wettkampfmanipulation ist strafbar."
    },
    {
      title: "📣 Werbung",
      text: "Nicht aufdringlich, nicht irreführend, nicht an Minderjährige – und nie für nicht bewilligte Angebote."
    },
    {
      title: "🏆 Privater Kreis",
      text: "Ein Tippspiel unter Bekannten ohne Gewinnabschöpfung fällt nicht unter das Geldspielgesetz."
    }
  ]);

  // assets/js/views/result.js
  var RATINGS = [
    { key: "clarity", label: "Wie verständlich waren die Fälle und Erklärungen?" },
    { key: "usability", label: "Wie einfach war die Bedienung?" },
    { key: "fun", label: "Wie viel Spass hat das Spiel gemacht?" }
  ];
  function ratingField({ key, label }) {
    return html`
    <fieldset class="rating" data-rating="${key}">
      <legend class="rating__label">${label}</legend>
      ${[1, 2, 3, 4, 5].map(
      (value) => html`
          <button
            type="button"
            class="rating__star"
            data-value="${value}"
            aria-label="${value} von 5"
            aria-pressed="false"
          >
            ★
          </button>
        `
    )}
    </fieldset>
  `;
  }
  function buildReport(state2, form) {
    const ratings = Object.fromEntries(
      RATINGS.map(({ key }) => [key, form.querySelector(`[data-rating="${key}"]`).dataset.selected ?? "–"])
    );
    return [
      "RÜCKMELDUNG – ABPFIFF! Das Wett-Escape",
      `Name: ${displayPlayerName(state2)}`,
      `Datum: ${(/* @__PURE__ */ new Date()).toLocaleString("de-CH")}`,
      `Zeit: ${formatDuration(elapsedMs(state2))} · Punkte: ${totalPoints(state2)}/${MAX_POINTS} · Gelbe Karten: ${totalYellowCards(state2)} · Joker: ${jokersUsed(state2)} · Penaltys: ${state2.penaltyGoals}/${CONFIG.penalty.shots}`,
      "",
      "Fehlversuche pro Station:",
      ...STATIONS.map((station, index) => {
        const entry = state2.stations[index];
        return `  ${index + 1}. ${station.location}: ${entry.yellowCards} Fehlversuch(e)${entry.jokerUsed ? ", Joker genutzt" : ""}`;
      }),
      "",
      `Verständlichkeit: ${ratings.clarity}/5`,
      `Bedienung: ${ratings.usability}/5`,
      `Spass: ${ratings.fun}/5`,
      `Unklarste Station: ${form.elements.unclear.value || "–"}`,
      `Kommentar: ${form.elements.comment.value.trim() || "–"}`
    ].join("\n");
  }
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }
  function downloadText(filename, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  }
  function renderResult(element, { onPrint, onAlbum, onRestart }) {
    const { state: state2 } = store;
    const points = totalPoints(state2);
    const hasForm = Boolean(CONFIG.feedbackFormUrl);
    setHtml(
      element,
      html`
      <div class="center">
        <h2 class="panel__title">Schlusspfiff – du bist frei!</h2>
        <p class="lead">
          Das Ausgangstor schwingt auf, das Flutlicht geht wieder an. Gratulation, ${displayPlayerName(state2)}! Dein Rang:
          <strong>${rankFor(points)}</strong>
        </p>
      </div>
      <div class="certificate-preview">${certificateMarkup(state2)}</div>
      <div class="actions actions--center">
        <button type="button" class="btn" data-action="print">🖨️ Zertifikat drucken</button>
        <button type="button" class="btn btn--ghost" data-action="print">📄 Als PDF speichern</button>
      </div>
      <p class="hint center">Tipp: Im Druckfenster bei «Ziel» bzw. «Drucker» die Option «Als PDF speichern» wählen.</p>
      ${statTiles([
        { label: "Punkte", value: `${points}` },
        { label: "Zeit", value: formatDuration(elapsedMs(state2)) },
        { label: "Gelbe Karten", value: `${totalYellowCards(state2)}` },
        { label: "Joker", value: `${jokersUsed(state2)}` },
        { label: "Penaltys", value: `${state2.penaltyGoals}/${CONFIG.penalty.shots}` }
      ])}
      <div class="actions actions--center">
        <button type="button" class="btn btn--dark" data-action="album">🎴 Sammelalbum ansehen</button>
      </div>

      <h3 class="section-title">Das nimmst du mit</h3>
      <ul class="takeaways">
        ${KEY_TAKEAWAYS.map(
        (item) => html`
            <li class="takeaway">
              <strong>${item.title}</strong>
              ${item.text}
            </li>
          `
      )}
      </ul>

      <h3 class="section-title">📝 Deine Rückmeldung zum Spiel</h3>
      <p class="hint">
        ${hasForm ? "Füll bitte kurz das Formular aus. Mit «Auswertung kopieren» kannst du deine Spielwerte direkt ins Formular einfügen." : "Bewerte das Spiel und gib uns die Auswertung als Text oder Datei."}
      </p>
      <form class="feedback-form" data-ref="feedback-form">
        ${RATINGS.map(ratingField)}
        <label class="field">
          <span class="field__label">Welche Station war am unklarsten?</span>
          <select class="field__input" name="unclear">
            <option value="">– keine –</option>
            ${STATIONS.map(
        (station, index) => html`
                <option>${index + 1}. ${station.location} (${station.topic})</option>
              `
      )}
            <option>Penaltyschiessen</option>
          </select>
        </label>
        <label class="field">
          <span class="field__label">Was war unklar oder was sollen wir verbessern?</span>
          <textarea
            class="field__input"
            name="comment"
            rows="4"
            placeholder="z. B. Bei Station 7 war nicht klar, dass …"
          ></textarea>
        </label>
        <div class="actions">
          ${hasForm ? html`
                  <a class="btn" href="${CONFIG.feedbackFormUrl}" target="_blank" rel="noopener">
                    📨 Zum Feedback-Formular
                  </a>
                ` : ""}
          <button type="button" class="btn ${hasForm ? "btn--ghost" : ""}" data-action="copy">
            📋 Auswertung kopieren
          </button>
          <button type="button" class="btn btn--ghost" data-action="download">💾 Als Textdatei speichern</button>
        </div>
      </form>

      <h3 class="section-title">Quellen</h3>
      ${sourceList(SOURCES)}
      <p class="hint">Rechtsstand der Recherche: ${CONFIG.legalStatus}. Keine Rechtsberatung.</p>
      <div class="actions">
        <button type="button" class="btn btn--ghost" data-action="restart">↺ Neues Spiel starten</button>
      </div>
    `
    );
    const form = qs('[data-ref="feedback-form"]', element);
    const onClick = async (event) => {
      const star = event.target.closest(".rating__star");
      if (star) {
        const group = star.closest("[data-rating]");
        const value = Number(star.dataset.value);
        group.dataset.selected = String(value);
        qsa(".rating__star", group).forEach((other) => {
          const active = Number(other.dataset.value) <= value;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(Number(other.dataset.value) === value));
        });
        return;
      }
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "print") onPrint();
      else if (action === "album") onAlbum();
      else if (action === "restart") onRestart();
      else if (action === "copy") {
        const copied = await copyToClipboard(buildReport(store.state, form));
        toast(copied ? "Auswertung kopiert ✓" : "Kopieren nicht möglich – bitte als Datei speichern.");
      } else if (action === "download") {
        downloadText(`rueckmeldung-${slugify(displayPlayerName(store.state))}.txt`, buildReport(store.state, form));
      }
    };
    element.addEventListener("click", onClick);
    return () => element.removeEventListener("click", onClick);
  }

  // assets/js/stations/ad-check.js
  var ad_check_exports = {};
  __export(ad_check_exports, {
    mount: () => mount
  });
  var ARTWORK = `<svg viewBox="0 0 300 520" aria-hidden="true" focusable="false">
  <rect width="300" height="520" fill="#7fc4ef"/>
  <rect x="18" y="16" width="264" height="42" rx="10" fill="#fff"/>
  <text x="150" y="44" text-anchor="middle" font-family="Bebas Neue, Impact, sans-serif" font-size="26" fill="#e67e22">⚽ TIPPTOPP <tspan font-size="12" fill="#999">(fiktiv)</tspan></text>
  <rect x="18" y="72" width="264" height="170" rx="12" fill="#cfe9b8"/><rect x="18" y="72" width="264" height="70" rx="12" fill="#a6d8f5"/>
  <rect x="40" y="110" width="90" height="60" fill="#e9d7b5"/><rect x="40" y="100" width="90" height="14" fill="#c0392b"/>
  <text x="85" y="145" text-anchor="middle" font-size="11" font-weight="800" fill="#7a4a1a">SCHULHAUS</text>
  <rect x="160" y="170" width="40" height="50" rx="8" fill="#e74c3c"/><rect x="167" y="160" width="26" height="14" rx="6" fill="none" stroke="#c0392b" stroke-width="4"/>
  <rect x="210" y="178" width="36" height="44" rx="8" fill="#3498db"/><rect x="216" y="168" width="24" height="14" rx="6" fill="none" stroke="#2471a3" stroke-width="4"/>
  <circle cx="80" cy="212" r="16" fill="#fff" stroke="#222" stroke-width="2"/>
  <text x="150" y="268" text-anchor="middle" font-size="19" font-weight="800" fill="#1b1f1c">Wette mit deinen Gspänli</text>
  <text x="150" y="292" text-anchor="middle" font-size="19" font-weight="800" fill="#1b1f1c">in der grossen Pause! 🎒</text>
  <rect x="45" y="346" width="210" height="42" rx="21" fill="#f5c542"/>
  <text x="150" y="373" text-anchor="middle" font-size="16" font-weight="800" fill="#1b1f1c">100 % sicherer Gewinn!</text>
  <rect x="20" y="412" width="80" height="40" rx="8" fill="#1b1f1c"/>
  <text x="60" y="438" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">ab 18</text>
  <text x="112" y="428" font-size="11" fill="#1b1f1c">Spiel verantwortungsvoll.</text>
  <text x="112" y="444" font-size="11" fill="#1b1f1c">Hilfe: sos-spielsucht.ch</text>
  <text x="112" y="460" font-size="11" fill="#1b1f1c">0800 040 080</text>
</svg>`;
  function mount(root, station, ctx) {
    const { spots } = station.data;
    const marked = /* @__PURE__ */ new Set();
    setHtml(
      root,
      html`
      <div class="phone-mockup">
        <div class="phone-mockup__screen">
          ${raw(ARTWORK)}
          ${spots.map(({ id, label, area: [left, top, width, height] }) => {
        const style = `left:${left}%;top:${top}%;width:${width}%;height:${height}%`;
        return html`
              <button type="button" class="hotspot" style="${style}" data-spot="${id}" aria-pressed="false">
                <span class="visually-hidden">${label}</span>
              </button>
            `;
      })}
        </div>
      </div>
      <p class="counter" data-ref="counter" aria-live="polite">0 Stellen markiert</p>
      <div class="actions actions--center">
        <button type="button" class="btn" data-action="check">Prüfung abschliessen</button>
      </div>
    `
    );
    const counter = qs('[data-ref="counter"]', root);
    function toggle(button) {
      const { spot } = button.dataset;
      if (marked.has(spot)) marked.delete(spot);
      else marked.add(spot);
      button.setAttribute("aria-pressed", String(marked.has(spot)));
      counter.textContent = `${marked.size} ${marked.size === 1 ? "Stelle" : "Stellen"} markiert`;
      ctx.progress();
    }
    function check() {
      const falsePositives = spots.filter((spot) => !spot.violation && marked.has(spot.id));
      const missed = spots.filter((spot) => spot.violation && !marked.has(spot.id));
      if (falsePositives.length === 0 && missed.length === 0) {
        ctx.solve();
        return;
      }
      const parts = [];
      if (falsePositives.length > 0) {
        parts.push(`Unproblematisch ist: ${falsePositives.map((spot) => `«${spot.label}»`).join(", ")}.`);
      }
      if (missed.length > 0) {
        parts.push(missed.length === 1 ? "Es fehlt noch ein Problem." : `Es fehlen noch ${missed.length} Probleme.`);
      }
      ctx.fail(parts.join(" "));
    }
    const onClick = (event) => {
      const spotButton = event.target.closest("[data-spot]");
      if (spotButton) toggle(spotButton);
      else if (event.target.closest('[data-action="check"]')) check();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/chat.js
  var chat_exports = {};
  __export(chat_exports, {
    mount: () => mount2
  });
  var TYPING_DELAY_MS = 700;
  var SYSTEM_NOTE_DELAY_MS = 400;
  var NEXT_STEP_DELAY_MS = 900;
  function mount2(root, station, ctx) {
    const { contact, agent, closing, steps } = station.data;
    const timers = /* @__PURE__ */ new Set();
    let stepIndex = 0;
    setHtml(
      root,
      html`
      <div class="chat" data-ref="log" aria-live="polite"></div>
      <div class="chat-replies" data-ref="replies"></div>
    `
    );
    const log = qs('[data-ref="log"]', root);
    const replies = qs('[data-ref="replies"]', root);
    const later = (callback, delay) => {
      const id = setTimeout(() => {
        timers.delete(id);
        callback();
      }, delay);
      timers.add(id);
    };
    function addMessage(kind, text, author) {
      const message = document.createElement("div");
      message.className = `chat-message chat-message--${kind}`;
      setHtml(
        message,
        html`
        ${author ? html`
                <span class="chat-message__author">${author}</span>
              ` : ""}${text}
      `
      );
      log.append(message);
      log.scrollTop = log.scrollHeight;
    }
    function showTyping(then) {
      const indicator = document.createElement("div");
      indicator.className = "chat-typing";
      indicator.setAttribute("aria-label", `${contact} schreibt …`);
      setHtml(
        indicator,
        html`
        <i></i>
        <i></i>
        <i></i>
      `
      );
      log.append(indicator);
      log.scrollTop = log.scrollHeight;
      later(() => {
        indicator.remove();
        then();
      }, TYPING_DELAY_MS);
    }
    function showStep() {
      const step = steps[stepIndex];
      showTyping(() => {
        addMessage("incoming", step.message, contact);
        const order = shuffle(step.options.map((_, index) => index));
        setHtml(
          replies,
          html`
          ${order.map(
            (index) => html`
              <button type="button" class="chat-reply" data-option="${index}">${step.options[index].text}</button>
            `
          )}
        `
        );
      });
    }
    function answer(optionIndex) {
      const step = steps[stepIndex];
      const option = step.options[optionIndex];
      if (!option.correct) {
        ctx.fail(option.feedback);
        return;
      }
      ctx.progress();
      setHtml(replies, "");
      addMessage("outgoing", option.text, agent);
      if (step.systemNote) later(() => addMessage("system", `🔎 ${step.systemNote}`), SYSTEM_NOTE_DELAY_MS);
      stepIndex += 1;
      if (stepIndex < steps.length) {
        later(showStep, step.systemNote ? NEXT_STEP_DELAY_MS : SYSTEM_NOTE_DELAY_MS);
      } else {
        showTyping(() => {
          addMessage("incoming", closing, contact);
          later(ctx.solve, 500);
        });
      }
    }
    const onClick = (event) => {
      const reply = event.target.closest("[data-option]");
      if (reply) answer(Number(reply.dataset.option));
    };
    root.addEventListener("click", onClick);
    showStep();
    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
      root.removeEventListener("click", onClick);
    };
  }

  // assets/js/stations/id-check.js
  var id_check_exports = {};
  __export(id_check_exports, {
    mount: () => mount3
  });
  var ADULT_AGE = 18;
  function mount3(root, station, ctx) {
    const { customers } = station.data;
    const matchDay = formatDate(CONFIG.matchDay, { long: true });
    let index = 0;
    function render2() {
      const customer = customers[index];
      setHtml(
        root,
        html`
        <div class="infobar">
          <span>📅 Spieltag: ${matchDay}</span>
          ${progressDots(customers.length, index)}
        </div>
        <div class="customer">
          <div class="customer__portrait">${raw(avatarSvg(customer.avatar))}</div>
          <div>
            <p class="customer__quote">«${customer.says}»</p>
            <div class="id-card">
              <div class="id-card__photo">${raw(avatarSvg(customer.avatar))}</div>
              <dl class="id-card__data">
                <dt class="id-card__title">Identitätskarte · Muster</dt>
                <dd></dd>
                <dt>Name</dt>
                <dd>${customer.name}</dd>
                <dt>Geburtsdatum</dt>
                <dd>${formatDate(customer.birthDate)}</dd>
              </dl>
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn btn--success" data-decision="sell">✓ Verkaufen</button>
          <button type="button" class="btn btn--danger" data-decision="deny">✗ Ablehnen</button>
        </div>
      `
      );
    }
    function decide(sell) {
      const customer = customers[index];
      const age = ageOn(customer.birthDate, CONFIG.matchDay);
      const isAdult = age >= ADULT_AGE;
      const firstName = customer.name.split(" ")[0];
      if (sell !== isAdult) {
        ctx.fail(
          sell ? `${firstName} ist am Spieltag erst ${age} Jahre alt. Rechne nochmals nach!` : `${firstName} ist am Spieltag ${age} Jahre alt – und darf damit einen Sporttip kaufen.`
        );
        return;
      }
      index += 1;
      if (index === customers.length) {
        ctx.solve();
      } else {
        ctx.progress();
        render2();
      }
    }
    const onClick = (event) => {
      const button = event.target.closest("[data-decision]");
      if (button) decide(button.dataset.decision === "sell");
    };
    root.addEventListener("click", onClick);
    render2();
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/judge.js
  var judge_exports = {};
  __export(judge_exports, {
    mount: () => mount4
  });
  function evidenceView(evidence) {
    if (!evidence) return "";
    return html`
    <figure class="evidence">
      <figcaption class="evidence__title">🔒 ${evidence.title}</figcaption>
      <div class="chat chat--messenger">
        ${evidence.messages.map(
      (message) => html`
            <div class="chat-message ${message.own ? "chat-message--own" : "chat-message--incoming"}">
              ${message.author ? html`
                      <span class="chat-message__author">${message.author}</span>
                    ` : ""}${message.text}
              <span class="chat-message__time">${message.time}</span>
            </div>
          `
    )}
        ${evidence.note ? html`
                <div class="chat-message chat-message--system">${evidence.note}</div>
              ` : ""}
      </div>
    </figure>
  `;
  }
  function mount4(root, station, ctx) {
    const { cases, evidence, labels } = station.data;
    setHtml(
      root,
      html`
      ${evidenceView(evidence)}
      <div class="cases">
        ${cases.map(
        (item, index) => html`
            <article class="case" data-case="${index}">
              <h3 class="case__title">${item.title}</h3>
              <p class="case__text">${item.text}</p>
              ${verdictButtons(index, labels)}
            </article>
          `
      )}
      </div>
      <div class="actions"><button type="button" class="btn" data-action="check">Urteil abgeben</button></div>
    `
    );
    const choices = createChoiceTracker(root, {
      onSelect: (group) => qs(`[data-case="${group}"]`, root).classList.remove("is-wrong")
    });
    function check() {
      if (choices.answers.size < cases.length) {
        ctx.notice("Bitte alle Punkte beurteilen.");
        return;
      }
      const wrong = cases.map((item, index) => choices.answers.get(String(index)) === item.correct ? -1 : index).filter((index) => index >= 0);
      cases.forEach((_, index) => {
        qs(`[data-case="${index}"]`, root).classList.toggle("is-wrong", wrong.includes(index));
      });
      if (wrong.length === 0) ctx.solve();
      else ctx.fail(`${wrong.length === 1 ? "Ein Urteil ist" : `${wrong.length} Urteile sind`} falsch (rot markiert).`);
    }
    const onClick = (event) => {
      if (choices.handle(event)) ctx.progress();
      else if (event.target.closest('[data-action="check"]')) check();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/match.js
  var match_exports = {};
  __export(match_exports, {
    mount: () => mount5
  });
  function mount5(root, station, ctx) {
    const { cases, options } = station.data;
    const assignment = cases.map(() => null);
    const optionById = new Map(options.map((option) => [option.id, option]));
    let selectedCase = 0;
    let wrongCases = /* @__PURE__ */ new Set();
    function render2() {
      const complete = !assignment.includes(null);
      setHtml(
        root,
        html`
        <div class="match">
          <div>
            <h3 class="column-title">📁 Fälle</h3>
            ${cases.map((item, index) => {
          const assigned = assignment[index] ? optionById.get(assignment[index]).title : null;
          const classes = [
            "match-case",
            selectedCase === index && "is-selected",
            wrongCases.has(index) && "is-wrong"
          ].filter(Boolean).join(" ");
          return html`
                <button type="button" class="${classes}" data-case="${index}" aria-pressed="${selectedCase === index}">
                  ${item.text}
                  <span class="match-case__answer ${assigned ? "is-set" : ""}">
                    ${assigned ?? "– noch kein Artikel –"}
                  </span>
                </button>
              `;
        })}
          </div>
          <div>
            <h3 class="column-title">📜 Rechtsgrundlagen</h3>
            <div class="match-options">
              ${options.map(
          (option) => html`
                  <button
                    type="button"
                    class="match-option"
                    data-option="${option.id}"
                    ${selectedCase === null ? "disabled" : ""}
                  >
                    <span class="match-option__title">${option.title}</span>
                    ${option.description}
                  </button>
                `
        )}
            </div>
          </div>
        </div>
        <div class="actions">
          <button type="button" class="btn" data-action="check" ${complete ? "" : "disabled"}>Akten prüfen</button>
        </div>
      `
      );
    }
    function assign(optionId) {
      if (selectedCase === null) return;
      assignment[selectedCase] = optionId;
      wrongCases.delete(selectedCase);
      const next = assignment.findIndex((value, index) => value === null && index !== selectedCase);
      selectedCase = next >= 0 ? next : null;
      ctx.progress();
      render2();
    }
    function check() {
      wrongCases = new Set(
        cases.map((item, index) => assignment[index] === item.answer ? -1 : index).filter((i) => i >= 0)
      );
      if (wrongCases.size === 0) {
        ctx.solve();
        return;
      }
      wrongCases.forEach((index) => {
        assignment[index] = null;
      });
      [selectedCase] = wrongCases;
      render2();
      ctx.fail(
        `${wrongCases.size === 1 ? "Ein Fall war" : `${wrongCases.size} Fälle waren`} falsch zugeordnet (rot markiert). Ordne sie neu zu.`
      );
    }
    const onClick = (event) => {
      const caseButton = event.target.closest("[data-case]");
      const optionButton = event.target.closest("[data-option]");
      if (caseButton) {
        selectedCase = Number(caseButton.dataset.case);
        ctx.progress();
        render2();
      } else if (optionButton) {
        assign(optionButton.dataset.option);
      } else if (event.target.closest('[data-action="check"]')) {
        check();
      }
    };
    root.addEventListener("click", onClick);
    render2();
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/net-block.js
  var net_block_exports = {};
  __export(net_block_exports, {
    mount: () => mount6
  });
  var TICK_MS = 100;
  function mount6(root, station, ctx) {
    const { sites, secondsPerSite } = station.data;
    let index = 0;
    let remaining = secondsPerSite;
    let timer = null;
    const stopTimer = () => {
      clearInterval(timer);
      timer = null;
    };
    function startTimer() {
      stopTimer();
      remaining = secondsPerSite;
      const bar = qs('[data-ref="timer"]', root);
      timer = setInterval(() => {
        remaining -= TICK_MS / 1e3;
        bar.style.width = `${Math.max(0, remaining / secondsPerSite * 100)}%`;
        if (remaining <= 0) {
          stopTimer();
          ctx.fail("Zeit abgelaufen! Das Datenpaket wartet noch – entscheide jetzt.");
        }
      }, TICK_MS);
    }
    function render2() {
      const site = sites[index];
      setHtml(
        root,
        html`
        <div class="infobar infobar--dark">
          <span>🛰️ Datenverkehr · Paket ${index + 1} von ${sites.length}</span>
          ${progressDots(sites.length, index)}
        </div>
        <article class="packet">
          <header class="packet__head">
            <span class="packet__logo" style="background:${site.tint}">${site.logo}</span>
            <span class="packet__url">${site.url}</span>
          </header>
          <dl class="packet__facts">
            ${site.facts.map(
          ([key, value]) => html`
                <dt>${key}</dt>
                <dd>${value}</dd>
              `
        )}
          </dl>
        </article>
        <div class="countdown" aria-hidden="true"><i data-ref="timer"></i></div>
        <div class="actions">
          <button type="button" class="btn btn--success" data-decision="allow">✅ Zugang offen lassen</button>
          <button type="button" class="btn btn--danger" data-decision="block">⛔ Sperren</button>
        </div>
      `
      );
      startTimer();
    }
    function decide(block) {
      const site = sites[index];
      if (block !== site.shouldBlock) {
        ctx.fail(site.feedback);
        return;
      }
      index += 1;
      if (index === sites.length) {
        stopTimer();
        ctx.solve();
      } else {
        ctx.progress();
        render2();
      }
    }
    const onClick = (event) => {
      const button = event.target.closest("[data-decision]");
      if (button) decide(button.dataset.decision === "block");
    };
    root.addEventListener("click", onClick);
    render2();
    return () => {
      stopTimer();
      root.removeEventListener("click", onClick);
    };
  }

  // assets/js/stations/quiz.js
  var quiz_exports = {};
  __export(quiz_exports, {
    mount: () => mount7
  });
  function mount7(root, station, ctx) {
    const { questions } = station.data;
    setHtml(
      root,
      html`
      <div class="quiz">
        ${questions.map(
        (question, index) => html`
            <article class="case" data-case="${index}">
              <p class="case__eyebrow">🎤 Frage ${index + 1} von ${questions.length}</p>
              <h3 class="case__title">${question.text}</h3>
              ${optionButtons(index, question.options)}
            </article>
          `
      )}
      </div>
      <div class="actions"><button type="button" class="btn" data-action="check">Antworten abgeben</button></div>
    `
    );
    const choices = createChoiceTracker(root, {
      numeric: true,
      onSelect: (group) => qs(`[data-case="${group}"]`, root).classList.remove("is-wrong")
    });
    function check() {
      if (choices.answers.size < questions.length) {
        ctx.notice("Bitte alle Fragen beantworten.");
        return;
      }
      const wrong = questions.map((question, index) => choices.answers.get(String(index)) === question.answer ? -1 : index).filter((index) => index >= 0);
      questions.forEach((_, index) => {
        qs(`[data-case="${index}"]`, root).classList.toggle("is-wrong", wrong.includes(index));
      });
      if (wrong.length === 0) {
        ctx.solve();
      } else {
        ctx.fail(
          `Mia hat nachgeprüft: ${wrong.length === 1 ? "Eine Antwort stimmt" : `${wrong.length} Antworten stimmen`} nicht (rot markiert).`
        );
      }
    }
    const onClick = (event) => {
      if (choices.handle(event)) ctx.progress();
      else if (event.target.closest('[data-action="check"]')) check();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/sort.js
  var sort_exports = {};
  __export(sort_exports, {
    mount: () => mount8
  });
  var TRAY = "";
  function mount8(root, station, ctx) {
    const { bins, items } = station.data;
    const placement = items.map(() => TRAY);
    let selected = null;
    const card = (item, index) => html`
    <button
      type="button"
      class="sort-card ${selected === index ? "is-selected" : ""}"
      draggable="true"
      data-card="${index}"
    >
      ${item.text}
    </button>
  `;
    const cardsIn = (bin) => items.map((item, index) => placement[index] === bin ? card(item, index) : "");
    function render2() {
      const allPlaced = !placement.includes(TRAY);
      setHtml(
        root,
        html`
        <div class="sort-tray" data-bin="${TRAY}">
          ${allPlaced ? html`
                  <span class="hint">Alle Karten verteilt – jetzt prüfen!</span>
                ` : cardsIn(TRAY)}
        </div>
        <div class="sort-bins">
          ${Object.entries(bins).map(
          ([key, label]) => html`
              <div class="sort-bin sort-bin--${key}" data-bin="${key}">
                <h3 class="sort-bin__title">${key === "offer" ? "🏪" : "🙋"} ${label}</h3>
                ${cardsIn(key)}
              </div>
            `
        )}
        </div>
        <div class="actions">
          <button type="button" class="btn" data-action="check" ${allPlaced ? "" : "disabled"}>Zuordnung prüfen</button>
        </div>
      `
      );
    }
    function moveSelectedTo(bin) {
      placement[selected] = bin;
      selected = null;
      ctx.progress();
      render2();
    }
    function check() {
      const wrong = items.map((item, index) => placement[index] === item.bin ? -1 : index).filter((index) => index >= 0);
      if (wrong.length === 0) {
        ctx.solve();
        return;
      }
      wrong.forEach((index) => {
        placement[index] = TRAY;
      });
      render2();
      ctx.fail(
        `${wrong.length} ${wrong.length === 1 ? "Karte war" : "Karten waren"} in der falschen Kiste und ${wrong.length === 1 ? "liegt" : "liegen"} wieder oben. Wer stellt das Angebot bereit, wer setzt selbst?`
      );
    }
    const onClick = (event) => {
      if (event.target.closest('[data-action="check"]')) {
        check();
        return;
      }
      const cardButton = event.target.closest("[data-card]");
      const container = event.target.closest("[data-bin]");
      if (cardButton) {
        const index = Number(cardButton.dataset.card);
        const cardBin = cardButton.parentElement.dataset.bin;
        if (selected !== null && selected !== index && placement[selected] !== cardBin) {
          moveSelectedTo(cardBin);
        } else {
          selected = selected === index ? null : index;
          render2();
        }
        return;
      }
      if (container && selected !== null) moveSelectedTo(container.dataset.bin);
    };
    const onDragStart = (event) => {
      const cardButton = event.target.closest("[data-card]");
      if (cardButton) event.dataTransfer.setData("text/plain", cardButton.dataset.card);
    };
    const onDragOver = (event) => {
      if (event.target.closest("[data-bin]")) event.preventDefault();
    };
    const onDrop = (event) => {
      const container = event.target.closest("[data-bin]");
      if (!container) return;
      event.preventDefault();
      selected = Number(event.dataTransfer.getData("text/plain"));
      moveSelectedTo(container.dataset.bin);
    };
    root.addEventListener("click", onClick);
    root.addEventListener("dragstart", onDragStart);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    render2();
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
    };
  }

  // assets/js/stations/stories.js
  var stories_exports = {};
  __export(stories_exports, {
    mount: () => mount9
  });
  function mount9(root, station, ctx) {
    const { account, stories } = station.data;
    const profile = raw(avatarSvg(station.person.avatar));
    setHtml(
      root,
      html`
      <div class="stories">
        ${stories.map(
        (story, index) => html`
            <article class="story" data-case="${index}">
              <div class="story__screen story__screen--${story.theme}">
                <div>
                  <div class="story__progress">
                    <i></i>
                    <i></i>
                  </div>
                  <p class="story__account">
                    <span class="story__avatar">${profile}</span>
                    ${account} · Story ${index + 1}
                  </p>
                </div>
                <div>
                  <p class="story__text">${story.text}</p>
                  ${story.code ? html`
                          <p class="story__code">Code: ${story.code}</p>
                        ` : ""}
                </div>
                <p class="story__meta">ℹ️ ${story.meta}</p>
              </div>
              <div class="story__verdict">${verdictButtons(index)}</div>
            </article>
          `
      )}
      </div>
      <div class="actions"><button type="button" class="btn" data-action="check">Urteil abgeben</button></div>
    `
    );
    const choices = createChoiceTracker(root, {
      onSelect: (group) => qs(`[data-case="${group}"]`, root).classList.remove("is-wrong")
    });
    function check() {
      if (choices.answers.size < stories.length) {
        ctx.notice("Bitte beide Stories beurteilen.");
        return;
      }
      const wrong = stories.map((story, index) => choices.answers.get(String(index)) === story.correct ? -1 : index).filter((index) => index >= 0);
      stories.forEach((_, index) => {
        qs(`[data-case="${index}"]`, root).classList.toggle("is-wrong", wrong.includes(index));
      });
      if (wrong.length === 0) {
        ctx.solve();
      } else {
        ctx.fail(
          `Story ${wrong.map((index) => index + 1).join(" und ")} ist falsch beurteilt. Macht Jan Werbung – und wenn ja, wofür?`
        );
      }
    }
    const onClick = (event) => {
      if (choices.handle(event)) ctx.progress();
      else if (event.target.closest('[data-action="check"]')) check();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/timeline.js
  var timeline_exports = {};
  __export(timeline_exports, {
    mount: () => mount10
  });
  function mount10(root, station, ctx) {
    const { events, initialOrder } = station.data;
    const order = [...initialOrder];
    let dragFrom = null;
    let wrongPositions = /* @__PURE__ */ new Set();
    function render2({ revealYears = false } = {}) {
      setHtml(
        root,
        html`
        <ol class="timeline">
          ${order.map((eventIndex, position) => {
          const event = events[eventIndex];
          const classes = ["timeline__item", wrongPositions.has(position) && "is-wrong"].filter(Boolean).join(" ");
          return html`
              <li class="${classes}" draggable="${!revealYears}" data-position="${position}">
                ${revealYears ? html`
                        <span class="timeline__year">${event.year}</span>
                      ` : html`
                        <span class="timeline__position">${position + 1}</span>
                      `}
                <span class="timeline__text">${event.text}</span>
                ${revealYears ? "" : html`
                        <span class="timeline__controls">
                          <button
                            type="button"
                            class="timeline__move"
                            data-move="-1"
                            data-position="${position}"
                            aria-label="Nach oben"
                            ${position === 0 ? "disabled" : ""}
                          >
                            ▲
                          </button>
                          <button
                            type="button"
                            class="timeline__move"
                            data-move="1"
                            data-position="${position}"
                            aria-label="Nach unten"
                            ${position === order.length - 1 ? "disabled" : ""}
                          >
                            ▼
                          </button>
                        </span>
                      `}
              </li>
            `;
        })}
        </ol>
        ${revealYears ? "" : html`
                <div class="actions">
                  <button type="button" class="btn" data-action="check">Reihenfolge prüfen</button>
                </div>
              `}
      `
      );
    }
    function move(from, to) {
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item);
      wrongPositions = /* @__PURE__ */ new Set();
      ctx.progress();
      render2();
    }
    function check() {
      wrongPositions = new Set(
        order.map((eventIndex, position) => eventIndex === position ? -1 : position).filter((p) => p >= 0)
      );
      if (wrongPositions.size === 0) {
        render2({ revealYears: true });
        ctx.solve();
        return;
      }
      render2();
      ctx.fail(`${wrongPositions.size} Tafeln stehen noch am falschen Platz (rot markiert).`);
    }
    const onClick = (event) => {
      const moveButton = event.target.closest("[data-move]");
      if (moveButton) {
        const from = Number(moveButton.dataset.position);
        move(from, from + Number(moveButton.dataset.move));
      } else if (event.target.closest('[data-action="check"]')) {
        check();
      }
    };
    const onDragStart = (event) => {
      const item = event.target.closest(".timeline__item");
      if (item) dragFrom = Number(item.dataset.position);
    };
    const onDragOver = (event) => {
      if (event.target.closest(".timeline__item")) event.preventDefault();
    };
    const onDrop = (event) => {
      const item = event.target.closest(".timeline__item");
      if (!item || dragFrom === null) return;
      event.preventDefault();
      const to = Number(item.dataset.position);
      if (to !== dragFrom) move(dragFrom, to);
      dragFrom = null;
    };
    root.addEventListener("click", onClick);
    root.addEventListener("dragstart", onDragStart);
    root.addEventListener("dragover", onDragOver);
    root.addEventListener("drop", onDrop);
    render2();
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("dragstart", onDragStart);
      root.removeEventListener("dragover", onDragOver);
      root.removeEventListener("drop", onDrop);
    };
  }

  // assets/js/stations/website-check.js
  var website_check_exports = {};
  __export(website_check_exports, {
    mount: () => mount11
  });
  function mount11(root, station, ctx) {
    const { site, tools, verdicts } = station.data;
    setHtml(
      root,
      html`
      <div class="browser">
        <div class="browser__bar">
          <i></i>
          <i></i>
          <i></i>
          <span class="browser__url">🔒 ${site.url}</span>
        </div>
        <div class="browser__page">
          <span class="browser__stamp">Fiktiv</span>
          <p class="browser__logo">⚡ ${site.name}</p>
          <p class="browser__hero">
            <b>${site.headline}</b>
            <br />
            ${site.claim}
          </p>
          <ul class="browser__odds">
            ${site.odds.map(
        (odd) => html`
                <li>${odd}</li>
              `
      )}
          </ul>
          <p class="browser__footer">${site.footer}</p>
        </div>
      </div>
      <div class="tool-buttons">
        ${tools.map(
        (tool, index) => html`
            <button type="button" class="btn btn--info btn--sm" data-tool="${index}">${tool.label}</button>
          `
      )}
      </div>
      <div class="tool-results" data-ref="tool-results" aria-live="polite"></div>
      <h3 class="section-title">Dein Urteil</h3>
      <div class="cases">
        ${verdicts.map(
        (verdict, index) => html`
            <article class="case" data-case="${index}">
              <span class="tag tag--role-${verdict.role}">${ROLE_LABELS[verdict.role]}</span>
              <p class="case__text">${verdict.text}</p>
              ${verdictButtons(index, verdict.labels)}
            </article>
          `
      )}
      </div>
      <div class="actions"><button type="button" class="btn" data-action="check">Urteil abgeben</button></div>
    `
    );
    const results = qs('[data-ref="tool-results"]', root);
    const choices = createChoiceTracker(root, {
      onSelect: (group) => qs(`[data-case="${group}"]`, root).classList.remove("is-wrong")
    });
    function check() {
      if (choices.answers.size < verdicts.length) {
        ctx.notice("Bitte beide Fragen beantworten.");
        return;
      }
      const wrong = verdicts.filter((verdict, index) => choices.answers.get(String(index)) !== verdict.correct);
      verdicts.forEach((verdict, index) => {
        qs(`[data-case="${index}"]`, root).classList.toggle("is-wrong", wrong.includes(verdict));
      });
      if (wrong.length === 0) {
        ctx.solve();
      } else if (wrong.length === verdicts.length) {
        ctx.fail("Beide Urteile stimmen nicht.");
      } else {
        ctx.fail(
          `Das Urteil zu «${ROLE_LABELS[wrong[0].role]}» stimmt nicht. Unterscheide genau zwischen Anbieten und Teilnehmen.`
        );
      }
    }
    const onClick = (event) => {
      if (choices.handle(event)) {
        ctx.progress();
        return;
      }
      const toolButton = event.target.closest("[data-tool]");
      if (toolButton && !toolButton.disabled) {
        toolButton.disabled = true;
        const result = document.createElement("div");
        result.className = "tool-result";
        setHtml(result, raw(tools[Number(toolButton.dataset.tool)].result));
        results.append(result);
        ctx.progress();
        return;
      }
      if (event.target.closest('[data-action="check"]')) check();
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }

  // assets/js/stations/index.js
  var STATION_TYPES = Object.freeze({
    idCheck: id_check_exports,
    sort: sort_exports,
    websiteCheck: website_check_exports,
    adCheck: ad_check_exports,
    stories: stories_exports,
    chat: chat_exports,
    netBlock: net_block_exports,
    judge: judge_exports,
    match: match_exports,
    timeline: timeline_exports,
    quiz: quiz_exports
  });

  // assets/js/views/station.js
  function solvedFeedback(station, entry, { fresh }) {
    return html`
    <h3 class="feedback__title">
      ${fresh ? "Richtig gelöst!" : "Bereits gelöst."} Dein Buchstabe:
      <span class="letter-tile">${station.letter}</span>
      <span class="points-badge">+${entry.points} Pkt.</span>
    </h3>
    <p>${raw(station.explanation)}</p>
    <p class="sticker-note">
      🎴 ${fresh ? "Neuer Sticker" : "Sticker"} im Album:
      <b>${station.sticker.title}</b>
      <button type="button" class="btn btn--dark btn--sm" data-action="show-sticker">Ansehen</button>
    </p>
    <p class="source-note">
      📖 ${station.source.label} –
      <a href="${station.source.url}" target="_blank" rel="noopener">zur Quelle</a>
    </p>
  `;
  }
  function renderStation(element, { index, onBack, onShowSticker }) {
    const station = STATIONS[index];
    const type = STATION_TYPES[station.type];
    setHtml(
      element,
      html`
      <article class="station">
        <div class="station__intro">
          <figure class="portrait" style="--portrait-from:${station.colors[0]};--portrait-to:${station.colors[1]}">
            ${raw(avatarSvg(station.person.avatar))}
            <figcaption class="portrait__name">${station.person.name}</figcaption>
            <span class="portrait__badge">${raw(ICONS[station.icon])}</span>
          </figure>
          <div>
            <h2 class="panel__title">Station ${index + 1}: ${station.location}</h2>
            <ul class="tags">
              <li class="tag tag--type">${TYPE_LABELS[station.type]}</li>
              <li class="tag">${station.topic}</li>
              <li class="tag tag--role-${station.role}">Rolle: ${ROLE_LABELS[station.role]}</li>
            </ul>
            <div class="speech-bubble">
              <p class="speech-bubble__speaker">💬 ${station.person.name}</p>
              <p>${raw(station.intro)}</p>
            </div>
            <div class="task-box">
              <span aria-hidden="true">🎯</span>
              <p>${raw(station.task)}</p>
            </div>
          </div>
        </div>
        <div class="station__puzzle" data-ref="puzzle"></div>
        <div class="feedback" data-ref="feedback" role="status" hidden></div>
        <div class="actions">
          <button type="button" class="btn btn--info btn--sm" data-action="joker"></button>
          <button type="button" class="btn btn--ghost btn--sm" data-action="back">← Zur Stadionkarte</button>
        </div>
      </article>
    `
    );
    const puzzle = qs('[data-ref="puzzle"]', element);
    const feedback = qs('[data-ref="feedback"]', element);
    const jokerButton = qs('[data-action="joker"]', element);
    const backButton = qs('[data-action="back"]', element);
    let unmountPuzzle = null;
    let flashOnBack;
    function updateJokerButton() {
      const entry = store.state.stations[index];
      jokerButton.disabled = entry.solved || entry.jokerUsed || store.state.jokersLeft <= 0;
      jokerButton.textContent = entry.jokerUsed && !entry.solved ? "📺 Hinweis angezeigt" : `📺 VAR-Joker (${store.state.jokersLeft})`;
    }
    function showSolved(fresh) {
      puzzle.classList.add("is-locked");
      showFeedback(feedback, "success", solvedFeedback(station, store.state.stations[index], { fresh }));
      backButton.className = "btn";
      backButton.textContent = "Buchstabe einsammeln → Karte";
      updateJokerButton();
    }
    const ctx = {
      progress() {
        sound.play("click");
        hideFeedback(feedback);
      },
      notice(message) {
        toast(message);
      },
      fail(message) {
        recordMistake(index);
        sound.play("error");
        announce(`Gelbe Karte für ${displayPlayerName(store.state)} an Station ${index + 1}!`);
        showFeedback(
          feedback,
          "error",
          html`
          <h3 class="feedback__title">Gelbe Karte!</h3>
          <p>${message}</p>
          <p class="hint">Du kannst es gleich nochmals versuchen. (−${CONFIG.points.yellowCard} Punkte)</p>
        `
        );
      },
      solve() {
        if (store.state.stations[index].solved) return;
        unmountPuzzle?.();
        unmountPuzzle = null;
        const points = solveStation(index);
        sound.play("success");
        flashLetter(index);
        flashOnBack = index;
        announce(
          `TOOOR! ${displayPlayerName(store.state)} knackt Station ${index + 1} – Buchstabe ${station.letter}! +${points} Punkte`
        );
        showSolved(true);
        feedback.scrollIntoView({ behavior: "smooth", block: "center" });
        if (allStationsSolved(store.state)) setTimeout(() => toast("Alle 12 Buchstaben! Ab zum Penaltypunkt 🔓"), 700);
      }
    };
    const onClick = (event) => {
      const action = event.target.closest("[data-action]")?.dataset.action;
      if (action === "back") onBack(flashOnBack);
      else if (action === "show-sticker") onShowSticker(index);
      else if (action === "joker" && useJoker(index)) {
        sound.play("hint");
        announce(`VAR-Check für ${displayPlayerName(store.state)} an Station ${index + 1}`);
        showFeedback(
          feedback,
          "hint",
          html`
          <h3 class="feedback__title">VAR-Check: Hinweis vom Videoschiri</h3>
          <p>${raw(station.hint)}</p>
          <p class="hint">−${CONFIG.points.joker} Punkte für diese Station.</p>
        `
        );
        updateJokerButton();
      }
    };
    element.addEventListener("click", onClick);
    announce(`${displayPlayerName(store.state)} betritt Station ${index + 1}: ${station.location}`);
    if (store.state.stations[index].solved) showSolved(false);
    else unmountPuzzle = type.mount(puzzle, station, ctx) ?? null;
    updateJokerButton();
    return () => {
      unmountPuzzle?.();
      element.removeEventListener("click", onClick);
    };
  }

  // assets/js/main.js
  var setLightsOut = (on) => document.body.classList.toggle("is-lights-out", on);
  function enterStadium() {
    showScoreboard();
    setLightsOut(true);
    navigate(store.state.completed ? "result" : "map");
  }
  function openFinalStation() {
    const { state: state2 } = store;
    if (state2.completed) navigate("result");
    else if (state2.finalUnlocked) navigate("penalty");
    else navigate("lock");
  }
  defineRoute("intro", {
    element: qs("#view-intro"),
    scrollTo: "top",
    render: (element) => renderIntro(element, {
      async onStart(playerName) {
        startNewGame(playerName);
        await playCutscene(INTRO_SCENE, {
          onEffect: (effect) => {
            if (effect === "lightsOut") {
              setLightsOut(true);
              sound.play("switchOff");
            }
          }
        });
        startClock();
        enterStadium();
        sound.play("whistle");
        announce(`Anpfiff! ${displayPlayerName(store.state)} ist im Stadion eingeschlossen – 12 Buchstaben gesucht`);
      },
      onResume() {
        store.restore();
        enterStadium();
        announce(`Willkommen zurück, ${displayPlayerName(store.state)}!`);
      }
    })
  });
  defineRoute("map", {
    element: qs("#view-map"),
    render: (element) => renderMap(element, {
      onOpenStation: (index) => navigate("station", { index }),
      onOpenFinal: openFinalStation,
      onHalftime() {
        markHalftimeShown();
        sound.play("longWhistle");
        announce(`HALBZEIT! ${displayPlayerName(store.state)} liegt gut im Rennen`);
        openHalftime();
      }
    })
  });
  defineRoute("station", {
    element: qs("#view-station"),
    render: (element, { index }) => renderStation(element, {
      index,
      onBack: () => navigate("map"),
      onShowSticker: (stickerIndex) => openAlbum(stickerIndex)
    })
  });
  defineRoute("lock", {
    element: qs("#view-lock"),
    render: (element) => renderLock(element, {
      onUnlocked: () => openPenaltyBriefing(() => navigate("penalty")),
      onBack: () => navigate("map")
    })
  });
  defineRoute("penalty", {
    element: qs("#view-penalty"),
    render: (element) => renderPenalty(element, {
      onWon() {
        sound.play("victory");
        confetti();
        setLightsOut(false);
        announce(`SCHLUSSPFIFF! ${displayPlayerName(store.state)} ist frei`);
        navigate("result");
      },
      onBack: () => navigate("map")
    })
  });
  defineRoute("result", {
    element: qs("#view-result"),
    render: (element) => renderResult(element, {
      onPrint: () => printCertificate(store.state),
      onAlbum: () => openAlbum(),
      onRestart() {
        store.clear();
        window.location.reload();
      }
    })
  });
  initDialog();
  initScoreboard({
    onAction(action, button) {
      if (action === "map") {
        if (store.state.completed) navigate("result");
        else if (getCurrentRoute() !== "map") navigate("map");
      } else if (action === "album") {
        openAlbum();
      } else if (action === "sound") {
        sound.setEnabled(!sound.enabled);
        button.textContent = sound.enabled ? "🔊" : "🔇";
        button.setAttribute("aria-pressed", String(!sound.enabled));
        qs('[data-action="crowd"]').setAttribute("aria-pressed", "false");
      } else if (action === "crowd") {
        if (!sound.enabled) {
          toast("Zuerst die Soundeffekte einschalten 🔊");
          return;
        }
        let playing = false;
        if (sound.crowdPlaying) sound.stopCrowd();
        else playing = sound.startCrowd();
        button.setAttribute("aria-pressed", String(playing));
        toast(playing ? "Stadionatmosphäre an 🏟️" : "Stadionatmosphäre aus");
      }
    }
  });
  navigate("intro");
})();
