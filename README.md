# Jaco Performance

Persoonlijke running- en performancecoach als mobiele web-app.

## Huidige release

**9.5 · Adaptive Week Replanner**

9.5 beoordeelt na nieuwe herstel- of Training Sync-data automatisch de resterende kalenderweek. Gemiste sessies, afwijkende uitvoering, actuele belasting, beschikbaarheid en racevensters worden gecombineerd tot een transparant herschikkingsvoorstel dat pas na bevestiging wordt toegepast.

## Architectuur

De app is bewust licht opgebouwd:

- `index.html` — schermen en formulieren
- `css/app.css` — responsive/mobile styling
- `js/app.js` — state, planners, coachlogica en rendering
- `js/training-sync.js` — koppeling uitgevoerd ↔ gepland en adaptieve feedback
- `js/performance-model.js` — actuele loopprognoses uit wedstrijddata en PR-benchmarks
- `js/daily-decision.js` — centrale dagbeslissing en 3-daagse vooruitblik
- `js/adaptive-week-replanner.js` — herschikking van de resterende week na gemiste/afwijkende training of herstelwijziging
- `js/bootstrap.js` — event handlers en initialisatie
- `api/workouts.js` — publieke vaste workouts
- `api/upload-workout.js` — export naar Intervals.icu
- `api/intervals-status.js` — wellnessdata uit Intervals.icu
- `api/intervals-activities.js` — uitgevoerde activiteiten uit Intervals.icu
- `lib/workouts.js` — vaste server-workouts

Vercel serveert de statische app en de API-routes.

## Lokale data

Persoonlijke appdata staat in `localStorage` met sleutels die beginnen met
`jp_`. Daaronder vallen onder meer:

- eigen trainingen;
- voltooid-status;
- uploadstatus;
- wedstrijden;
- profiel en weekbeschikbaarheid;
- Coach Dagboek;
- eenmalige schema-imports.

Vanaf 8.3 kan deze data via **Profiel → Backup & Herstel** als JSON worden
geëxporteerd en op een ander toestel worden geïmporteerd.

API-credentials staan **niet** in de browserbackup.

## Intervals.icu

Vercel gebruikt deze environment variables:

- `INTERVALS_API_KEY`
- `JACO_APP_PIN`

Geplande workouts worden met een stabiele external ID per kalenderdag naar
Intervals.icu gestuurd, zodat opnieuw exporteren dezelfde geplande workout kan
bijwerken in plaats van bewust een nieuwe app-identiteit te gebruiken.

Wellnessdata wordt server-side opgehaald en in de app alleen gebruikt wanneer
de benodigde meetwaarde aanwezig en voldoende recent is.

Vanaf 9.2 haalt Training Sync recente uitgevoerde activiteiten server-side op.
Alleen benodigde samenvattingsvelden worden naar de browser gestuurd. Een
passende activiteit kan een geplande niet-racetraining automatisch als voltooid
markeren. Werkelijk uitgevoerd loopvolume krijgt vervolgens voorrang in de
belastbaarheidsmonitor.

## Data-integriteitsregels

Bij nieuwe ontwikkeling gelden deze uitgangspunten:

1. Ontbrekende waarden blijven `null`/onbekend; ze worden niet stilzwijgend 0.
2. Trainingshistorie en belastbaarheidsanalyse gebruiken alleen als voltooid
   gemarkeerde trainingen.
3. Toekomstige hersteldata wordt niet voorspeld.
4. Wedstrijddagen worden niet automatisch door coachadvies vervangen.
5. Bestaande kalenderdagen worden niet stilzwijgend door weekplanners
   overschreven.
6. Race Calendar Optimizer en Seizoensplanner bepalen gezamenlijk de fase die
   alle coachmodules gebruiken.
7. Datumverschillen worden als kalenderdagen berekend, niet als verstreken
   milliseconden, zodat zomertijd geen dagfouten veroorzaakt.
8. Een backup-import maakt eerst een lokaal herstelpunt.

## Voor een release controleren

Voor merge naar `main`:

- JavaScript/API syntax groen;
- geen dubbele DOM-IDs;
- alle statische `getElementById`-referenties bestaan;
- tabs en views komen één-op-één overeen;
- geen dubbele functiedefinities;
- startup zonder wellnessdata;
- startup met gedeeltelijk/null wellnessrecord;
- startup bij tijdelijke Intervals.icu-fout;
- backup merge/replace-validatie;
- racedag blijft beschermd;
- cacheversies van CSS/app/bootstrap zijn verhoogd wanneer nodig.

## Release-aanpak

Grotere wijzigingen worden op een aparte branch gebouwd, via een pull request
gecontroleerd en daarna naar `main` gemerged. Vercel deployt vervolgens vanuit
`main`.

Nieuwe functionaliteit hoort pas na deze stabilisatielaag verder te bouwen op
de bestaande modules.



## 9.5 Adaptive Week Replanner

- Analyseert automatisch de resterende kalenderweek na herstel- en Training Sync-updates.
- Gemiste rustige trainingen en gemiste lange duurlopen worden niet automatisch ingehaald.
- Gemiste kwaliteit mag alleen een toekomstige rustige training vervangen wanneer herstel goed, belasting stabiel en de wedstrijdfase veilig is.
- Bij verhoogde belasting wordt een nabije zware sessie verplaatst naar een veiligere dag of afgezwakt naar herstel.
- Zware/lange trainingen worden niet in taper- of herstelvensters geplaatst en wedstrijddagen blijven volledig beschermd.
- Beschikbaarheidsconflicten worden waar mogelijk binnen dezelfde week opgelost.
- Alle voorgestelde wijzigingen worden vooraf getoond; kalenderwijzigingen gebeuren alleen na expliciete bevestiging.

## 9.4 Performance Model

- Prognoses voor 5 km, 10 km, halve marathon en marathon met tempo en onzekerheidsband.
- Echte Intervals.icu-loopactiviteiten die aan een racedag zijn gekoppeld gelden als sterkste actuele bewijs.
- Profiel-PR’s blijven sterke benchmarks wanneer recente racedata ontbreekt.
- Alleen performance-achtige trainingen (bijv. TT/parkrun, hoge HR of hoge RPE) mogen als lage-confidence fallback dienen; rustige duurlopen worden niet als prestatietest behandeld.
- Marathonextrapolatie krijgt extra duurzaamheidsmarge wanneer alleen kortere benchmarks beschikbaar zijn.
- De Race Simulator gebruikt voortaan het Performance Model als primaire onafhankelijke prognose en valt terug op het oude profielmodel als 9.4 onvoldoende data heeft.

## 9.3 Daily Decision Engine

- Eén centrale dagstatus: Uitvoeren, Gecontroleerd, Aanpassen, Herstellen of Race.
- Combineert actuele hersteldata, belastbaarheidsmonitor, Training Sync, beschikbaarheid, wedstrijd en fase.
- Laat doelbelasting/RPE en een expliciete planwijzigingsstatus zien.
- Geeft een zekerheidsniveau zodat ontbrekende data niet als stellig coachadvies wordt gepresenteerd.
- Toont morgen direct en een inklapbare 3-daagse kalenderblik.
- De Decision Engine wijzigt de kalender niet zelfstandig; toepassen blijft via de bestaande bevestigde coachactie verlopen.

## 9.2.2 Sync Calibration

- Racedagen selecteren voor diagnose de run die qua afstand het beste bij de wedstrijd past; warming-ups blijven als extra activiteit zichtbaar.
- De huidige kalenderdag telt niet meer als gemiste training in de 21-daagse historische kalibratie.
- Handmatig voltooide review/unmatched-trainingen worden in de diagnose als handmatig voltooid getoond.

## 9.2.1 Live Sync Validation & Calibration

- Automatische voltooiing vereist nu 70–160% van het geplande volume en een niet-ambigue beste match.
- Ontbrekende volume-informatie, te kleine/grote afwijkingen en bijna gelijke kandidaten worden als **Controleren** getoond.
- Alleen vertrouwde matches leveren werkelijk loopvolume aan de belastbaarheidsmonitor.
- De app toont een 21-daagse kalibratielijst met automatisch gekoppelde, open, handmatig voltooide, beschermde en extra activiteiten.
- De Intervals.icu-route rapporteert hoeveel records ontvangen, bruikbaar en overgeslagen zijn plus dekking van afstand, duur, hartslag, load en vermogen.
- De activities-aanvraag gebruikt alleen de kernparameters `oldest`, `newest` en `limit`.
- Een kopieerbare diagnose maakt verdere kalibratie mogelijk zonder API-key of app-pincode te delen.

## 9.2 Training Sync & Adaptive Coach

- Recente uitgevoerde Intervals.icu-activiteiten worden via een beveiligde API-route opgehaald.
- Matching gebeurt op lokale kalenderdatum en sporttype, met afstand en duur als extra matchsignalen.
- Niet-racetrainingen kunnen door een echte activiteit automatisch als voltooid worden gemarkeerd.
- Wedstrijden blijven handmatig beschermd en worden niet automatisch door sync afgevinkt.
- De belastbaarheidsmonitor gebruikt werkelijk uitgevoerd loopvolume als dat beschikbaar is.
- De Dagelijkse Coach vergelijkt gepland en werkelijk uitgevoerd volume.
- Een duidelijk zwaarder uitgevoerde zware of lange sessie kan een volgende zware prikkel laten vervangen door herstel.
- Syncdata wordt lokaal gecachet zodat eerder opgehaalde informatie offline bruikbaar blijft.

## 8.3.3 hardening

- Persoonlijke Intervals.icu-wellnessdata vereist nu dezelfde app-pincode als workout-export.
- De pincode wordt alleen voor de huidige browsersessie bewaard en komt niet in backups.
- Voltooidstatus wordt aan de concrete workout gekoppeld in plaats van alleen aan een datum.
- Uploadstatus gebruikt een workout-fingerprint, zodat een gewijzigde training niet onterecht als gesynchroniseerd wordt getoond.
- Voltooide wedstrijden tellen mee in lokale loopbelasting en zware-sessiehistorie.
- Automatische core/mobility wordt maximaal één keer per gegenereerde week toegevoegd.


## 8.3.4 planner alignment

- AI Week Planner, Adaptive Week en Plan mijn week gebruiken dezelfde centrale weekengine.
- Taperweken krijgen een korte doeltempo-prikkel in plaats van een volledige zware intervaltraining.
- Lange duurlopen krijgen in taper/raceweek geen snelle finish.
- De raceplan-generator beschermt alle bestaande kalenderitems en overschrijft nooit een wedstrijddag.
- Volledig Seizoensschema controleert racedagen opnieuw op het moment van toepassen.
- Bij bewust vervangen van een training worden lokale voltooid- en uploadmarkers opgeschoond.
- Workout-upload valideert kalenderdatums strikt en gebruikt alleen eigen properties uit de vaste workoutbibliotheek.


## 8.3.6 final audit

- Backupbestanden dragen weer exact dezelfde appversie als de actieve release.
- De kalender bepaalt “vandaag” dynamisch; een lang geopende/PWA-sessie corrigeert zichzelf bij terugkeer naar de app.
- Vervangen of verwijderen van trainingen ruimt verouderde voltooid- en uploadmarkers op.
- Een handmatig bewerkte voltooide training behoudt zijn voltooidstatus, terwijl gewijzigde uploadinhoud opnieuw gesynchroniseerd moet worden.
- Het verwijderen van een 8.2-seizoensschema verwijdert ook bijbehorende lokale statusmarkers.
- Wedstrijden kunnen niet stilzwijgend op een bezette trainings- of andere wedstrijddag worden geplaatst.
- Bij het verplaatsen van een voltooide wedstrijd verhuist de voltooidstatus mee en een verborgen geïmporteerde racefallback komt niet terug op de oude datum.
- Niet-ondersteunde Intervals.icu-export wordt als niet beschikbaar weergegeven in plaats van als toekomstige fase.


## 9.1 Daily Training Experience

- Training van vandaag staat als eerste inhoudelijke kaart op het Vandaag-scherm.
- Compacte weekstrip toont planning, voltooidstatus en wedstrijddagen.
- Eén primaire actie start de geplande sessie.
- Fullscreen begeleide sessie toont trainingsonderdelen, voortgang en verstreken tijd.
- De sessie houdt waar mogelijk het scherm actief, maar gebruikt geen GPS; live tempo en afstand blijven op het sporthorloge.
- Afronden gebruikt dezelfde completion-identiteit als kalender en belastbaarheidsmonitor en opent daarna het Coach Dagboek.


## 9.1.1 Stability & Cleanup

- Ontbrekende numerieke waarden blijven onbekend in volume-, metric- en scorehelpers in plaats van stilzwijgend als 0 te worden behandeld.
- De actuele datum blijft de bron voor `selectedDate`; de bestaande daggrenscorrectie blijft actief voor lang geopende PWA-sessies.
- Afgeleide coachpanelen worden niet meer dubbel gerenderd tijdens één refresh.
- Een begeleide trainingssessie kan alleen de workout afronden waarmee de sessie daadwerkelijk is gestart; wijzigingen in de kalender tijdens de sessie blokkeren afronding.
- Backup-export vangt ook fouten tijdens het verzamelen van lokale opslag af.
- De mobiele installatiestroom sluit het app-menu vóór de browserinstallatieprompt.
- Cache- en assetversies zijn verhoogd naar 9.1.1.
