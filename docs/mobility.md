# Mobiliteit — 11.4.5

## Integratie

De bestaande `supportWeekPlan` blijft eigenaar van aanvullende trainingen. Er is geen tweede kalender. Vandaag, Planning en de oefeningenbibliotheek gebruiken dezelfde routinebouw en beschikbare dagtijd. Mobiliteit wordt uit de resterende tijd gekozen, na hoofdtraining en kracht. Een geblokkeerde sessie kan binnen de week verschuiven; de oorspronkelijke datum blijft na uitvoering gekoppeld zodat die sessie niet opnieuw verschijnt. Expliciete keuzes staan in `jp_mobility_plans_v1`; voorkeuren in `jp_mobility_preferences_v1`. Beide vallen onder de bestaande backup, inclusief validatie.

Een hoofdtraining van type Mobility opent dezelfde speler. Voltooiing wordt alleen afgeleid bij een volledig uitgevoerde, identiek gekoppelde hoofdtraining. Gewijzigde hoofdtrainingen erven geen oude voltooiing. Dubbele registratie in verzamelde trainingshistorie wordt gefilterd. Bestaande krachtregistraties en sportkoppelingen blijven behouden.

De bestaande tekstvelden en een expliciete `mobilityIncluded`/`mobilityRoutineId` markering voorkomen een aanvullend blok als mobiliteit al is opgenomen. De app kan een niet benoemde warming-up niet als mobiliteit herkennen.

## Bibliotheek en routines

19 oefeningen: enkel buigen/strekken, knie over de voet, kuitrek, kuitheffen, zittend knieheffen, 90/90 heupwissel, zijwaarts beenheffen, achterwaarts beenheffen, liggende bilrek, hamstringrek, bovenbeenrek in zijlig, vlinderzit, kleine squat, kat-koe, zittende romprotatie, zijwaartse buiging, borstopening, schouders rollen en nekrotatie.

Kuitheffen, beenheffen en squat zijn als **kracht** geclassificeerd, niet als mobiliteit. Zittend knieheffen is lichte activatie. Statische rekoefeningen staan niet in de voorbereidende routines.

Acht routines: voorbereiding hardlopen, enkels/heupen, fietsen, bovenrug voor zwemmen, algemene mobiliteit, weinig tijd, na het sporten, voorbereiding kracht. De gebruiker kiest een maximum van 5, 10 of 15 minuten. De werkelijke tijd wordt berekend uit alle zijden, 10 seconden voorbereiding, werkduur en 10 seconden rust/wisseltijd. Maximaal drie sets; ontbrekend materiaal of vermeden oefeningen kunnen een kortere routine opleveren. De app vult ontbrekende tijd niet met langere rekposities. Sportkeuze en recente belasting beïnvloeden de selectie; dit is geen diagnose of individuele bewegingsanalyse.

## Speler en registraties

- Kloktijd in plaats van interval-ticks. Na voorbereiding start de werkfase als de app zichtbaar is. Na werk en rust kiest de gebruiker zelf wanneer verder te gaan. Een lange achtergrondonderbreking voltooit hooguit de huidige fase, nooit ongemerkt volgende oefeningen.
- Sluiten bewaart en pauzeert. Herladen hervat gepauzeerd, met begrensde verstreken tijd. De lopende sessie staat lokaal onder `jaco_mobility_active_v1`, buiten de overdraagbare backup.
- Vervanging vereist dezelfde regio, categorie en links/rechts-opbouw. Eerdere uitvoering blijft in het logboek; de resterende tijd verandert zichtbaar. Geen passende vervanger: eenvoudigere uitvoering of overslaan.
- Logboek in de bestaande `jp_support_done_v1`: per uitgevoerde werkstap oefening, zijde, set, werkelijke seconden en status. Totale seconden bevatten ook daadwerkelijk getimede voorbereiding/rust. Een afgeronde gedeeltelijke sessie wordt niet automatisch opnieuw ingepland of overschreven.
- Te zwaar verlaagt het gewenste budget tijdelijk tot maximaal vijf minuten; te makkelijk verhoogt niets. Ongemak sluit de aangegeven oefening uit totdat de gebruiker deze expliciet weer toestaat. Geen interpretatie van hartslag als blessure.
- Mobiliteit krijgt geen geschatte sRPE-belasting en wordt niet aan Intervals CTL/ATL toegevoegd. Overzichten tonen tijd en regelmaat, geen onbewezen verbetering van bewegingsbereik.

## Inhoud, rechten en media

Nederlandse tekstbewerkingen zijn op 13 oktober 2026 vergeleken met de oefenbeschrijvingen hieronder. Dit is **geen onafhankelijke klinische goedkeuring** en de bibliotheek is geen blessurebehandeling. Bronlinks zijn per oefening vastgelegd. Dosering in de app is een rustige algemene sessie-indeling, niet een voorgeschreven behandelprogramma.

| Inhoud | Oorspronkelijke beschrijving |
| --- | --- |
| Enkelbeweging, zittend knieheffen, romprotatie, borstopening | https://www.nhs.uk/live-well/exercise/sitting-exercises/ |
| Kuitrek, zijwaartse buiging, nekrotatie | https://www.nhs.uk/live-well/exercise/flexibility-exercises/ |
| Bil, hamstring, bovenbeen, vlinderzit | https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/ |
| Kuitheffen, beenheffen, kleine squat | https://www.nhs.uk/live-well/exercise/strength-exercises/ |
| Schouders rollen | https://www.nhs.uk/live-well/exercise/how-to-warm-up-before-exercising/ |
| Kat-koe | https://www.acefitness.org/resources/everyone/exercise-library/15/cat-cow/ |
| Knie over de voet | https://e3rehab.com/ankle-dorsiflexion/ |
| Heupwissel | https://e3rehab.com/how-to-improve-your-hip-range-of-motion/ |

Contains public sector information licensed under the [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Nederlandse bewerking, geen endorsement. De NHS-rechten voor tekst zijn niet gebruikt als toestemming voor foto's: die kunnen afzonderlijke rechten hebben. Er zijn geen bronfoto's gekopieerd, en geen gegenereerde anatomische instructiebeelden gebruikt.

**Twee aangeboden video's**, beide door E3 Rehab gepubliceerd en met een door Vimeo aangeboden oEmbed-insluitcode gecontroleerd op 13 oktober 2026:

| Oefening | Video | Gebruik |
| --- | --- | --- |
| Kat-koe | https://vimeo.com/731400896 — Cat Cow (Demo) | Originele Vimeo-speler, alleen insluiten |
| 90/90 heupwissel | https://vimeo.com/647991664 — 90/90 Transitions (Tutorial) | Originele Vimeo-speler, alleen insluiten |

Geen downloads of herpublicatie. Geen claims dat Vimeo continu beschikbaar is of dat afspelen in een echte iPhone-webview is bevestigd. De andere **17 oefeningen hebben nog geen gecontroleerd instructiebeeld/video**; dat is zichtbaar in de app. Verdere beelddekking en een onafhankelijke inhoudelijke beoordeling blijven open werk.

De iframe wordt pas na een tik gemaakt, met `autoplay=0` en `dnt=1`. De gebruiker bedient de originele speler voor afspelen, pauze en terugspoelen. De sessietimer wordt gepauzeerd wanneer een demonstratie wordt geopend. Tekst blijft altijd beschikbaar; offline- en foutmeldingen zijn getest. Een cross-origin videospeler kan een interne afspeelfout niet altijd aan de app doorgeven; de blijvende tekstfallback en handmatige sluit/herlaadknop zijn daarom leidend.

## Tests en grenzen

- `node --test tests/*.test.cjs`: 135 geslaagde tests, inclusief 11 nieuwe mobiliteitstests.
- `node tests/ui/interface.smoke.cjs`: bestaande volledige DOM-regressieroute geslaagd (jsdom).
- `node tests/ui/mobility.smoke.cjs`: plannen → Vandaag → starten, links/rechts, pauzeren/hervatten, vervangen, overslaan, gedeeltelijk opslaan, feedback/historie, gegevensbehoud en mediafouten geslaagd (jsdom).
- `node tests/ui/mobility.browser.cjs`: Chromium op 320, 390 en 430 px. Geen horizontale overflow in bibliotheek/speler/feedback; primaire bediening minimaal 44 px; geen JavaScript-excepties. Screenshots visueel beoordeeld; donkere thema-kleuren en bestaande bibliotheek-overflow gecorrigeerd.
- Werkelijke iPhone/Safari, achtergrondgedrag bij een door iOS beëindigde PWA, geluid, haptiek en volledige online videoweergave zijn niet op een fysiek toestel bevestigd.
- Tekst en routines staan in de service-worker-appshell (`1145`); offline caching vereist eerst een succesvolle online installatie. Externe video's worden niet gecachet. Geen externe API-uploads of wijzigingen aan echte trainingsdata uitgevoerd tijdens tests.

De testafhankelijkheden jsdom en Playwright zijn alleen voor ontwikkeltests nodig; de app blijft dependency-vrij in de browser.
