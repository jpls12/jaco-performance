# Jaco Performance

Persoonlijke running- en performancecoach als mobiele web-app.

## Huidige release

**10.8.1 · Stability & UX Hardening**

10.8.1 hardent de actuele 10.8-basis zonder coachlogica te wijzigen. De patch verbetert focusbeheer in de trainingsdialoog, voorkomt Wake Lock-races, ontsnapt dynamische aria-labels veilig en houdt backup- en cachemetadata consistent.

## Architectuur

De app is bewust licht opgebouwd:

- `index.html` — schermen en formulieren
- `css/app.css` — responsive/mobile styling
- `js/app.js` — state, planners, coachlogica en rendering
- `js/training-sync.js` — koppeling uitgevoerd ↔ gepland en adaptieve feedback
- `js/training-quality.js` — blok-voor-blok analyse van gekoppelde sleuteltrainingen
- `js/training-response.js` — leert uit meerdere sleuteltrainingen en kalibreert toekomstige trainingspaces conservatief
- `js/session-progression.js` — leert trainingsdosis en past alleen nieuwe drempel-/VO₂-sessies conservatief aan
- `js/adaptive-block-planner.js` — bouwt een veilige 4-wekenmicrocyclus uit seizoen, races, beschikbaarheid en geleerd trainingsbewijs
- `js/performance-model.js` — actuele loopprognoses uit wedstrijddata en PR-benchmarks
- `js/race-readiness.js` — race readiness, geloofwaardige raceband en doeltempo-optimalisatie
- `js/fuel-hydration.js` — persoonlijk voedings-/zweetprofiel en exacte race-innameplanning
- `js/race-strategy.js` — pacingfasen, HR-guardrails, voeding en racedagbeslismomenten
- `js/race-day.js` — afvinkbare racedagchecklist, persistente raceklok en fullscreen live racekaart
- `js/race-debrief.js` — post-race koppeling, subjectieve debrief en gecontroleerde modelkalibratie
- `js/daily-decision.js` — centrale dagbeslissing en 3-daagse vooruitblik
- `js/adaptive-week-replanner.js` — herschikking van de resterende week na gemiste/afwijkende training of herstelwijziging
- `js/fully-adaptive-coach.js` — centrale 10.0-coachstaat, prioriteit, veranderlog en doelontwikkeling
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

## 10.8.1 Stability & UX Hardening

- Fullscreen trainingssessies verplaatsen focus naar de dialoog en herstellen de oorspronkelijke focus na sluiten.
- Tab- en Shift+Tab-focus blijven binnen de actieve trainingsdialoog, ook als focus onverwacht buiten de dialoog terechtkomt.
- Wake Lock serialiseert aanvragen en ruimt een laat voltooide aanvraag op wanneer de sessie intussen is gepauzeerd of gesloten.
- Dynamische aria-labels in de weekstrip worden veilig als HTML-attribuut ontsnapt.
- Backupmetadata gebruikt één centrale actieve appversie.
- De bestaande completion-identity-check en alle 10.8-planner- en data-integriteitsregels blijven behouden.



## 10.8 Adaptive Training Block Planner

- Genereert vier weken vanaf de eerstvolgende maandag met dezelfde beschikbaarheids- en racebescherming als de AI Week Planner.
- Week 1 gebruikt actuele readiness en Coach Dagboek; week 2–4 voorspellen geen herstel en gebruiken alleen stabiele planningsdata.
- Normale base/build/specific-blokken gebruiken een kleine microcyclus van ongeveer 96% → 100% → 104% → 90%; taper/race/herstel houden hun eigen seizoensfactor.
- Seizoensfase en wedstrijden worden per week opnieuw bepaald zodat het blok veilig door taper, race en herstel kan lopen.
- 10.6-pacelearning blijft gelden voor toekomstige gegenereerde sessies.
- Een actieve 10.7-dosisstap mag alleen in de eerste toekomstige geschikte sleuteltraining worden toegepast; week 2–4 kopiëren die progressie niet vooruit zonder nieuw bewijs.
- Toepassen is expliciet; bestaande kalenderdagen en racedagen worden overgeslagen en nooit overschreven.
- Het blok toont per week fase, focus, doelvolume, sleutelsessie, lange duur en de gebruikte adaptieve aannames.

## 10.7 Adaptive Key Session Progression

- Gebruikt 10.6-bewijs, recente kwaliteitsscores, voltooiingsratio, readiness, belastbaarheid en wedstrijdfase.
- Minimaal drie vergelijkbare sessies nodig voordat automatische dosisopbouw mogelijk is.
- Automatische opbouw geldt alleen voor nieuw gegenereerde drempel- en VO₂-sessies.
- Drempelwerk wordt maximaal tot 10 km kwaliteit opgebouwd; VO₂-werk maximaal tot 6 km.
- Eén stap betekent doorgaans +1 herhaling; bij korte 400 m-VO₂-blokken maximaal +2 herhalingen.
- Bij verhoogde belasting, lage readiness of zwakke recente kwaliteit kan de volgende gegenereerde sessie één dosisstap worden teruggebracht.
- Tempo en dosis worden nooit tegelijk automatisch opgehoogd: als 10.6 een pacecorrectie actief heeft, consolideert 10.7 eerst de hoeveelheid werk.
- Taper, race-week en herstelblokken blokkeren automatische dosisopbouw.
- HM-specifieke trainingsdosis wordt wel geleerd en getoond, maar nog niet automatisch verhoogd.
- Bestaande kalendertrainingen worden nooit achteraf aangepast.

## 10.6 Training Response Learner

- Gebruikt de recente 9.6 Training Quality-resultaten als leerbewijs; geen extra API-verzoeken nodig.
- Classificeert bruikbare sessies als drempel, VO₂, HM-specifiek of marathon-specifiek op basis van workouttekst, blokafstand en huidige modelpaces.
- Vergelijkt werkelijk gemiddeld werktempo met het geplande midden van de pace-band.
- Tempo-afwijking telt alleen als sterk sneller-signaal wanneer blokvoltooiing, consistentie en beschikbare HR/RPE-signalen voldoende goed zijn.
- Minimaal drie vergelijkbare sessies nodig voordat een richting als structureel wordt gezien.
- Leerrichting: sneller, rustiger of stabiel; spreiding tussen sessies verlaagt de zekerheid.
- Automatische correctie is maximaal ±4 sec/km en geldt alleen voor toekomstige gegenereerde drempel- en VO₂-trainingen.
- HM-specifiek wordt wel geleerd en getoond, maar wijzigt de 10.1-racereferentie of opgeslagen streeftijd niet.
- Bestaande kalendertrainingen worden nooit achteraf herschreven.
- Toont per categorie bewijsomvang, mediaan tempo-afwijking, zekerheid en de recentste gebruikte sessies.

## 10.5 Race Debrief & Model Calibration

- Aparte selectie voor afgelopen wedstrijden; de toekomstgerichte Race Simulator blijft ongewijzigd.
- Koppelt een race aan de beste hardloopactiviteit op dezelfde datum met afstandscontrole en ambiguïteitswaarschuwing.
- Vergelijkt werkelijke Intervals-tijd met het vooraf bewaarde raceplan; als geen raceplan is bewaard wordt alleen de ingestelde streeftijd gebruikt.
- Toont werkelijke tijd, GPS-afstand/tempo, gemiddelde/maximale hartslag en training load.
- Laat RPE, uitvoering van het voedingsplan, maag-/darmklachten en vrije notities opslaan.
- Bevestigen markeert exact dezelfde raceactiviteit als extra sterk bewijs; er wordt geen tweede evidence-record gemaakt.
- Performance Model verhoogt de weightBase van een bevestigde race van 1.35 naar 1.58.
- Slaat modelprognoses vóór en na bevestiging op zodat materiële kalibratie per afstand zichtbaar kan worden gemaakt.
- Debriefs worden opgeslagen onder `jp_race_debrief_v1` en gaan daardoor automatisch mee met Backup & Herstel.

## 10.4 Race Day Checklist & Live Race Card

- Bouwt automatisch een checklist uit wedstrijdmateriaal, pacing en het persoonlijke 10.3-voedingsplan.
- Checkliststatus wordt per wedstrijd lokaal bewaard en gaat via de bestaande `jp_`-backup mee.
- Fullscreen Race Mode met persistente startklok; herladen van de pagina verliest een lopende klok niet.
- Toont huidige geplande racefase, segmentpace en HR-guardrail.
- Toont volgende gel en resterende minuten tot die gel.
- Toont volgende drankpost, geplande ml en resterende minuten.
- Toont het volgende 10.2-beslismoment met concrete instructie.
- Schat alleen de **geplande** positie uit tijd + pacing; Race Mode gebruikt geen GPS en presenteert dit expliciet niet als werkelijke afstand.
- Raceklok kan handmatig worden gestart, gestopt en gereset.

## 10.3 Personal Fuel & Hydration Profile

- Nieuw profielblok voor race-koolhydraten/uur, maximale geteste tolerantie, gelgrootte en koolhydraten uit drank.
- Persoonlijke zweet- en vochtvelden: zweetverlies ml/uur, drinkdoel ml/uur en afstand tussen drankposten.
- Natrium kan expliciet als mg/uur worden ingesteld of uit ingevoerde zweetnatriumconcentratie + drinkdoel worden afgeleid.
- Berekent exact aantal gels en gelminuten op basis van raceduur en gekozen producten.
- Berekent totaal vocht en, wanneer drankpostafstand bekend is, ml per post plus geschatte passage-minuten.
- Berekent natrium totaal en optioneel het capsule-equivalent wanneer capsule/tabletgrootte is ingevuld.
- Als drinkdoel hoger is dan gemeten zweetverlies wordt de race-aanbeveling conservatief begrensd op het gemeten verlies en wordt dit zichtbaar gemeld.
- Profiel wordt genest opgeslagen in `jp_profile_v1` en reist daardoor automatisch mee met de bestaande Backup & Herstel-functie.
- Ontbrekende velden veroorzaken geen verzonnen precisie: alleen het betreffende onderdeel valt terug op 10.2-basisranges.

## 10.2 Race Strategy Engine

- Gebruikt dezelfde 10.1-racereferentie voor pacing; een agressief doel kan dus niet via de strategie alsnog te snel worden.
- Bouwt per afstand een negatieve/gelijke splitstrategie met bewust behoudende openingsfase en late versnelling.
- Maakt persoonlijke HR-guardrails uit HFmax wanneer die beschikbaar is; HR is plafond/controle, niet de primaire pace-target.
- Geeft RPE-opbouw per raceafstand zodat tempo, hartslag en gevoel samen gelezen kunnen worden.
- Voegt koolhydraat-, vocht- en natriumranges toe zonder ontbrekende zweet- of darmtolerantiedata te verzinnen.
- Geeft concrete racedagbeslismomenten: wanneer tempo vasthouden, terugschakelen of pas laat versnellen.
- Race Simulator gebruikt de nieuwe strategie direct voor pacing- en voedingssecties.

## 10.1 Race Readiness & Goal Optimizer

- Combineert Performance Model, recente trainingskwaliteit, belastbaarheid, uitvoering en actuele raceweek-hersteldata.
- Geeft per geselecteerde wedstrijd een race-readinessscore 0–100 en optimizervertrouwen.
- Toont een geloofwaardige finishtijdband in plaats van één schijnpreciese racedagvoorspelling.
- Beoordeelt de ingestelde streeftijd als passend, agressief, conservatief of nog onvoldoende onderbouwd.
- Een agressief doel verandert de opgeslagen wedstrijd niet, maar trainingspaces worden begrensd op de snelste geloofwaardige modelrand.
- Een conservatiever doel blijft volledig gerespecteerd.
- De Race Simulator gebruikt de geoptimaliseerde race-referentie voor pacing.
- In de laatste racedagen kan laag actueel herstel de referentie conservatiever maken.

## 10.0 Fully Adaptive Coach

- Eén centrale coachstaat boven Daily Decision, Week Replanner, Training Quality en Performance Model.
- Prioriteit wordt automatisch bepaald als Race, Herstel, Aanpassen, Week bijsturen, Gecontroleerd of Op schema.
- Combineert herstel, load monitor, Training Sync, trainingskwaliteit, weekwijzigingen en doelprognose in één beslislaag.
- Toont Coachvertrouwen 0–100 op basis van actuele datadekking; ontbrekende data verlaagt zekerheid in plaats van aannames te vullen.
- Volgt wat sinds de vorige coachcheck betekenisvol veranderde: dagstatus, herstel, belasting, trainingskwaliteit, weekvoorstel en doelprognose.
- Vergelijkt de actuele Performance Model-prognose met de streeftijd van de actieve wedstrijd wanneer die beschikbaar is.
- Geeft één primaire actie: vandaag aanpassen, weekvoorstel toepassen, sleuteltraining analyseren of niets wijzigen.
- Kalenderwijzigingen blijven expliciet bevestigd en bestaande racebescherming blijft intact.

## 9.6 Training Quality Analyzer

- Haalt voor de laatste betrouwbaar gekoppelde kwaliteit- of lange duurtraining Intervals.icu-detaildata op via de server.
- Gebruikt de activiteit-detailroute met `intervals=true`; API-key en app-pincode blijven buiten lokale opslag en clientcode.
- Herkent geplande herhalingen, blokafstand en doeltempo uit de workoutbeschrijving.
- Beoordeelt blokvoltooiing, tempodoel, tempo-consistentie, totaalvolume, hartslagbelasting en RPE wanneer die data beschikbaar is.
- Geeft een 0–100 trainingskwaliteitscore plus Hoog/Goed/Redelijk/Laag vertrouwen afhankelijk van de beschikbare intervaldata.
- Een duidelijke kwaliteitsafwijking wordt teruggegeven aan de adaptieve uitvoeringsfeedback, zodat Daily Decision en Week Replanner conservatiever kunnen reageren.
- Alleen compacte analyseresultaten worden lokaal gecachet; ruwe streams worden niet opgeslagen.

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
