# Jaco Performance

Persoonlijke running- en performancecoach als mobiele web-app.

## Huidige release

**8.3.6 · Final Audit**

Deze release sluit de volledige stabilisatie-audit af: kalenderstatus, racedagen, plannerpreviews, lokale markers, backupmetadata en lang-openstaande mobiele sessies zijn op één consistente basis gebracht.

## Architectuur

De app is bewust licht opgebouwd:

- `index.html` — schermen en formulieren
- `css/app.css` — responsive/mobile styling
- `js/app.js` — state, planners, coachlogica en rendering
- `js/bootstrap.js` — event handlers en initialisatie
- `api/workouts.js` — publieke vaste workouts
- `api/upload-workout.js` — export naar Intervals.icu
- `api/intervals-status.js` — wellnessdata uit Intervals.icu
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
