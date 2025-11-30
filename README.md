# 🚀 Rakett Tracker

En web-basert applikasjon for å tracke og analysere modellraketter fra video. Programmet bruker datamaskinsyn (OpenCV.js) til å følge raketten gjennom videoen og beregne telemetri som høyde, hastighet, og akselerasjon.

## 🎯 Funksjoner

- **Video-opplasting**: Last opp video fra mobiltelefon eller annet kamera
- **Kalibrering**: Bruk en 1-meter referansepinne for nøyaktige målinger
- **Automatisk tracking**: Track raketten automatisk gjennom hele videoen
- **Telemetri-beregning**:
  - Høyde over tid
  - Hastighet (vertikal, horisontal, total)
  - Akselerasjon
  - Banekurve (2D)
  - Vinkel fra vertikal
- **Visualisering**: Interaktive grafer og statistikk
- **Eksport**: Last ned data som CSV for videre analyse

## 🛠️ Teknologi

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Computer Vision**: OpenCV.js
- **Visualisering**: Chart.js
- **Ingen backend nødvendig**: Alt kjører i nettleseren!

## 📋 Systemkrav

- Moderne nettleser (Chrome, Firefox, Edge, Safari)
- Minimum 4GB RAM (anbefalt 8GB for store videoer)
- JavaScript aktivert

## 🚀 Komme i gang

### 1. Start applikasjonen

Det er flere måter å kjøre applikasjonen på:

#### Alternativ A: Python HTTP Server (anbefalt)

```bash
cd public
python -m http.server 8000
```

Åpne så nettleseren og gå til: `http://localhost:8000`

#### Alternativ B: Node.js HTTP Server

```bash
# Installer http-server globalt (kun første gang)
npm install -g http-server

# Start server
cd public
http-server -p 8000
```

#### Alternativ C: Åpne direkte i nettleser

Noen nettlesere tillater å åpne `public/index.html` direkte. Dette kan ha begrensninger med CORS for enkelte funksjoner.

### 2. Bruk applikasjonen

#### Steg 1: Last opp video
- Klikk på "Velg fil" og last opp videoen din
- Støttede formater: MP4, MOV, AVI, WebM
- Anbefalt: Video filmet fra siden med stasjonært kamera

#### Steg 2: Kalibrering
- Du vil se første ramme av videoen
- **Merk referansepinnen** (1 meter):
  - Klikk og hold musknappen nede ved pinnens bunn
  - Dra til pinnens topp
  - Slipp musknappen
- Applikasjonen beregner automatisk piksel-til-meter ratio
- Klikk "Bekreft kalibrering"

#### Steg 3: Merk raketten
- Tegn en boks rundt raketten i første ramme:
  - Klikk og hold ved ett hjørne
  - Dra til motsatt hjørne
  - Slipp musknappen
- Sørg for at hele raketten er innenfor boksen
- Klikk "Start tracking"

#### Steg 4: Tracking
- Applikasjonen tracker nå raketten automatisk gjennom videoen
- Du kan se fremdriften i prosent-baren
- Bruk "Pause" for å pause prosessen
- Bruk "Stopp" for å avbryte

#### Steg 5: Resultater
- Når tracking er ferdig, vises resultatene:
  - **Statistikk**: Maks høyde, hastighet, akselerasjon, tid til apogee
  - **Grafer**:
    - Høyde over tid
    - Hastighet over tid (vertikal, horisontal, total)
    - Akselerasjon over tid
    - 2D banekurve
- **Eksporter data**: Klikk "Eksporter til CSV" for å laste ned rå-data

## 📊 Telemetri-data

Applikasjonen beregner følgende:

### Posisjonsdata
- **Høyde**: Vertikal posisjon over oppskytningspunkt (meter)
- **Horisontal posisjon**: Sideveis avvik fra oppskytningspunkt (meter)

### Hastighet
- **Vertikal hastighet**: Hastighet oppover/nedover (m/s)
- **Horisontal hastighet**: Hastighet sideveis (m/s)
- **Total hastighet**: Vektorsum av hastigheter (m/s)

### Akselerasjon
- **Vertikal akselerasjon**: Endring i vertikal hastighet (m/s²)
- **Horisontal akselerasjon**: Endring i horisontal hastighet (m/s²)
- **Total akselerasjon**: Vektorsum av akselerasjoner (m/s²)

### Nøkkelhendelser
- **Apogee**: Høyeste punkt i banen
- **Maksimal hastighet**: Vanligvis like etter motor burnout
- **Maksimal akselerasjon**: Under motor thrust-fase

## 📝 Tips for best resultat

### Video-opptak
1. **Stasjonært kamera**: Bruk stativ eller plasser kameraet stabilt
2. **Sideveis vinkel**: Film fra siden (90° fra oppskytningsretning)
3. **God avstand**: Sørg for at hele rakettbanen er synlig
4. **God belysning**: Film på dagslys med god kontrast
5. **Høy oppløsning**: 1080p eller bedre anbefales
6. **Høy FPS**: 60 FPS gir bedre presisjon enn 30 FPS

### Referansepinne
1. **Synlig i første ramme**: Sørg for at 1-meter pinnen er tydelig synlig
2. **Vertikal orientering**: Hold pinnen loddrett for lettere måling
3. **Nær oppskytningsrampen**: Plasser den i samme plan som raketten

### Tracking
1. **Tydelig rakett**: Sørg for god kontrast mellom rakett og bakgrunn
2. **Snever boks**: Tegn boksen tett rundt raketten (ikke for stor)
3. **Inkluder hele raketten**: Men unngå for mye bakgrunn

## 🔧 Feilsøking

### OpenCV.js laster ikke
- Sjekk internettforbindelsen (OpenCV.js lastes fra CDN)
- Prøv å refreshe siden
- Sjekk konsollen for feilmeldinger (F12)

### Tracking mister raketten
- Prøv med en trangere ROI-boks rundt raketten
- Sørg for god kontrast i videoen
- Sjekk at raketten er tydelig synlig i alle rammer
- Prøv å filme med bedre belysning neste gang

### Unøyaktige målinger
- Sjekk at kalibreringen er korrekt (1-meter pinnen)
- Sørg for at kameraet er stasjonært
- Unngå videos med lens distortion (wide-angle)
- Film fra større avstand med zoom

### Treg ytelse
- Bruk mindre videoer (reduser oppløsning før opplasting)
- Lukk andre nettleser-faner
- Prøv en annen nettleser (Chrome anbefales)

## 📁 Prosjektstruktur

```
rocketTracker/
├── public/
│   ├── index.html          # Hoved-HTML fil
│   ├── css/
│   │   └── style.css       # Styling
│   └── js/
│       ├── app.js          # Hoved-applikasjon
│       ├── tracker.js      # Object tracking logikk
│       ├── telemetry.js    # Telemetri-beregninger
│       └── visualization.js # Grafer og visualisering
└── README.md               # Denne filen
```

## 🔬 Teknisk informasjon

### Tracking-algoritme
Applikasjonen bruker OpenCV.js med følgende tracking-metoder:
1. **CSRT Tracker**: Primær metode (høy nøyaktighet)
2. **KCF Tracker**: Fallback (raskere, mindre nøyaktig)
3. **Template Matching**: Siste fallback hvis trackere ikke er tilgjengelige

### Koordinatsystem
- **Origo**: Oppskytningspunkt (rakett-posisjon i første ramme)
- **X-akse**: Horisontal (positiv = høyre)
- **Y-akse**: Vertikal (positiv = opp)

### Data-smoothing
Telemetri-data smoothes med moving average (vindu på 3 frames) for å redusere støy fra tracking.

## 🚧 Kjente begrensninger

1. **Video-eksport**: Ikke implementert ennå (kommer i fremtidig versjon)
2. **3D-tracking**: Kun 2D-analyse (sideveis visning)
3. **FPS-deteksjon**: Må manuelt justeres hvis video ikke er 30 FPS
4. **Tracker-begrensninger**: OpenCV.js har færre trackere enn Python OpenCV
5. **Store videoer**: Kan være tregt på eldre maskiner

## 🔮 Fremtidige forbedringer

- [ ] Automatisk FPS-deteksjon fra video-metadata
- [ ] Video-eksport med tracking overlay
- [ ] Sammenligning av flere oppskytninger
- [ ] Vingestimering (angle of attack)
- [ ] Automatisk deteksjon av nøkkelhendelser
- [ ] Støtte for flere referansepunkter
- [ ] Machine learning-basert rakett-deteksjon
- [ ] 3D-tracking med multiple kameraer

## 📄 Lisens

Dette prosjektet er laget for utdannings- og hobbyformål.

## 🤝 Bidrag

Bidrag er velkommen! Dette er et open-source prosjekt.

## 📞 Support

Hvis du opplever problemer:
1. Sjekk "Feilsøking"-seksjonen over
2. Sjekk nettleser-konsollen for feilmeldinger (F12)
3. Opprett en issue med detaljert beskrivelse

## 🎓 Laget med

- OpenCV.js - Computer vision bibliotek
- Chart.js - Grafer og visualisering
- Moderne web-teknologi (HTML5, CSS3, ES6+)

---

**God fornøyelse med rakett-tracking! 🚀**
