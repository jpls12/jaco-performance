# Adaptieve coach 11.4.2 — implementatie en controle

Gebaseerd op de bestaande app en commit `aad037d30192d1c349bb9b4642495a3381ab91d1` uit PR #83. Deze uitbreiding is voorbereid voor publicatie als pull request en is nog niet met main samengevoegd of uitgerold.

## Onderzoek van de bestaande app

- `training-sync.js` heeft activiteitkoppelingen met sport, volume, intensiteit, tempo, vermogen en een venster van drie dagen, handmatige bevestiging en opgeslagen uitvoeringsstatus.
- `adaptive-week-replanner.js` is de centrale engine voor morgen tot zeven dagen vooruit. `app.js` bevat het expliciet toe te passen dagadvies. Deze uitbreiding voegt geen tweede kalenderplanner toe.
- `activity-results.js` toont meetgegevens, vergelijking met de gekoppelde training, beoordeling, splits en een route als de API GPS levert.
- `performance-model.js` en `race-readiness.js` leveren hardloopprognoses met bandbreedte. A/B/C-wedstrijden en taper/herstelvensters bestonden al.
- Intervals.icu-export gebruikt de bestaande serverroute en een upsert met een vaste externe identiteit per datum. COROS heeft een handmatig krachtrecept; dit is geen directe, bevestigde horlogekoppeling.
- Er is geen package.json of buildscript; de bestaande projectcontrole is `node --test tests/*.test.cjs`.

## Nieuw geïmplementeerd

1. **Activiteiten behouden en dubbelen beperken.** Een begrensd synchronisatieantwoord verwijdert geen bestaande historische activiteiten. Een identieke provider-ID wordt bijgewerkt. Verschillende bronrecords worden samengevoegd bij dezelfde externe ID en sport, of bij verschillende bekende bronnen, dezelfde sport, maximaal tien seconden startverschil en maximaal twee procent verschil in zowel duur als afstand. Bronrecords en alias-ID's blijven bewaard. Koppelingen en beoordelingen worden naar de canonieke activiteit overgezet. Zonder voldoende bewijs blijven activiteiten afzonderlijk.
2. **Onbekend blijft onbekend.** Een ontbrekende activiteit heet niet langer na één dag overgeslagen. Ontbrekende intensiteit heet onbekend en kan geen automatische volledige koppeling aan een kwaliteitstraining onderbouwen.
3. **Geen automatisch inhalen.** De bestaande weekengine schuift gemiste kwaliteit niet meer automatisch door. De eerdere prioriteits-, belasting-, wedstrijd- en beschikbaarheidsregels blijven behouden.
4. **Dagadvies binnen beschikbare tijd.** Een geblokkeerde dag levert rust als voorstel; een te lange sessie kan worden ingekort of door een passende herstelsessie worden vervangen. Toepassen blijft via het bestaande dagadvies. Vastgezette trainingen blijven beschermd.
5. **Optionele herstelcheck.** Op Vandaag kunnen slaapuren, energie, spiervermoeidheid en klachten worden vastgelegd. Ontbrekende velden blijven null. Eén ongunstige slaap-, energie- of spierwaarde veroorzaakt vanuit deze check geen weekcorrectie. Twee ongunstige signalen geven aandacht; duidelijke klachten geven een herstelindicatie. De check geldt voor vandaag en overschrijft geen trainingsbeoordeling.
6. **Beoordeling bij de activiteit.** De gebruiker kan aangeven dat de geplande training gedeeltelijk lukte of door een andere training werd vervangen. Dit wordt in uitvoering en coachadvies verwerkt. Een melding 'volledig' wist een duidelijke afwijking uit meetgegevens niet uit.
7. **Koppeling corrigeren.** Een resultaat bevat een uitklapbare keuze om de koppeling te wijzigen of de activiteit extra te noemen. Het scherm toont het vertrouwen en de reden. Een al bezette geplande training is uitgesloten. Corrigeren van een koppeling herschrijft geen eerdere kalenderwijzigingen; die blijven in de historie staan.
8. **Vastzetten en historie.** Kalendertrainingen hebben een vastzetknop. Automatische en handmatig toegepaste weekwijzigingen bewaren dezelfde herstelpunten. De historie bewaart maximaal honderd gebeurtenissen, toont de laatste twintig en omvat koppelingen en vastzetten. De bestaande terugzetfunctie herstelt de laatste weekmutatie zolang de betrokken trainingen niet inmiddels zijn gewijzigd, uitgevoerd of verstuurd. Terugzetten pauzeert automatisch aanpassen.
9. **Betrouwbaarder exportgedrag.** Poging, fout en succes worden opgeslagen. De kalender en Vandaag onderscheiden lokaal, fout en bevestigd in Intervals. Gelijktijdige klikken op dezelfde training starten geen tweede aanvraag. Tijdens de aanvraag wisselen van datum verplaatst het ontvangstbewijs niet. De server eist een Intervals-event-ID voordat succes wordt gemeld. Herhalen gebruikt dezelfde bestaande upsert-identiteit. Stale ontvangstbewijzen worden bij opstart niet gewist alleen omdat de lokale inhoud gewijzigd is.
10. **Dagscherm en prognosedatum.** Vandaag toont trainingsdoel, geregistreerde duur, reden en exportstatus, met een directe route naar de beschikbaarheid van deze week. De hardloopwedstrijdkaart toont de berekeningsdatum naast de bestaande onafhankelijke bandbreedte. Doeltijden worden niet veranderd.
11. App- en serviceworkerversie zijn verhoogd naar 11.4.2; de nieuwe module zit in de offline shell.

## Testresultaat

`node --test tests/*.test.cjs`: **121 tests geslaagd**, geen mislukkingen. Dit omvat bestaande controles en nieuwe regressietests. Alle clientbestanden en API-bestanden zijn op JavaScript-syntax gecontroleerd; `git diff --check` is schoon.

| Gevraagde situatie | Controle |
| --- | --- |
| 3×3 km een dag eerder | Bestaande integratietest: koppelen, verwijderen van herhaling en herhaald synchroniseren |
| Herstelloop is geen voltooide interval | Nieuwe integratietest; ook onbekende intensiteit wordt getest |
| Deels uitgevoerd telt mee | Nieuwe integratietest: gedeeltelijke status, werkelijke RPE-minuten |
| Zware fietsrit beïnvloedt lopen | Bestaande integratietest met gecombineerde fiets-/zwembelasting |
| Zaterdag onbeschikbaar | Nieuwe integratietest met beschermde race en vastgezette training |
| Hersteldata ontbreken | Nieuwe test: score null, voldoende data false; lege check onbekend |
| Zelfde activiteit uit twee bronnen | Nieuwe integratietest: eenmaal belasting, bronbewijs behouden |
| Herhaald synchroniseren | Herhaalde koppeling zonder mutatie; dubbele import blijft één activiteit |
| Vastgezet en wedstrijd beschermd | Weektest en nieuwe dagadviestest |
| Exportfout zichtbaar en herhaalbaar | Nieuwe test: opgeslagen fout, herhaling, één ontvangstbewijs; bestaande servertest controleert upsert en vaste ID |
| Terugzetten | Nieuwe integratietest: kalender hersteld, activiteit en historie behouden |

API-antwoorden in tests zijn gecontroleerde testfixtures, geen live synchronisaties. Er zijn geen persoonlijke sleutels of echte activiteiten gebruikt. Een visuele mobiele browsercontrole kon niet worden uitgevoerd: Chromium ontbreekt en de browserdownload leverde geen bruikbaar archief op. De UI is dus nog niet visueel afgetekend.

## Aannames en resterende grenzen

- **Dit is nog niet de volledige gevraagde triathloncoach.** De bestaande kalender kan loop-, fiets-, zwem-, kracht- en mobiliteitssessies aanpassen en gezamenlijke vermoeidheid meenemen. De seizoensopbouw en wedstrijdmodellen zijn nog hardloopgericht; een triathlon-specifieke seizoensgenerator en onderbouwde zwem-/fiets-/wisselprognose ontbreken.
- De kalender bewaart één hoofdtraining per dag, met aparte aanvullende kracht/mobiliteit. Algemene dubbele trainingsdagen en bricktrainingen zijn nog geen volwaardig model.
- Automatische weekaanpassingen blijven morgen tot zeven dagen vooruit. Vandaag biedt een toepasbaar advies. Lange-termijnopbouw blijft onder de bestaande seizoensplanner.
- Reeds geëxporteerde trainingen blijven beschermd tegen automatische herplanning. Bijwerken op dezelfde datum gebruikt upsert. Een robuuste verplaatsing/verwijdering van een remote event met datumonafhankelijke identiteit is nog niet geïmplementeerd.
- De bestaande hoofdexport ondersteunt Run/Core/Mobility; aanvullende kracht gebruikt zijn bestaande exportpad. Fiets-/zwemexport en een directe COROS-API-koppeling zijn niet toegevoegd. Een Intervals-ontvangstbewijs bevestigt niet dat het horloge de training ontving.
- Dubbelherkenning is conservatief. Zonder herkomst/tijd/afstand/duur kunnen twee bronrecords niet veilig automatisch worden samengevoegd. Conflicterende beoordelingen van twee duplicaten worden niet inhoudelijk gecombineerd; de canonieke beoordeling blijft leidend.
- RPE × minuten en providerbelasting zijn verschillende eenheden en blijven gescheiden. Drempels zijn transparante vaste heuristieken, geen persoonlijk gevalideerd fysiologisch model. Mobility blijft in de bestaande brede strength-sportfamilie voor matching; zeer specifieke subdisciplineherkenning ontbreekt.
- Het intervalmodel gebruikt beschikbare samenvattingen en de bestaande detailanalyse. Een ontbrekende lap-/intervalstructuur wordt niet uit alleen een titel gereconstrueerd.
- De herstelcheck maakt geen extra numerieke fitheidsscore. Bestaande horlogereadiness blijft onder het bestaande model; niet alle bestaande beslisregels zijn in deze wijziging opnieuw ontworpen.
- De geschiedenis is lokaal en begrensd. Nieuwe `jp_`-gegevens reizen mee in de bestaande backup. De bestaande laatste-undo-key met `jaco_`-prefix blijft buiten die generieke backupselectie.
- **Publicatietoestemming:** na de eerdere automatische blokkade heeft de gebruiker op 12 oktober 2026 expliciet toestemming gegeven om deze broncode naar `jpls12/jaco-performance` te publiceren en een pull request aan te maken. Samenvoegen en uitrollen zijn nog niet uitgevoerd.
