# Doorlopende coach 11.4.8

Implementatie op basis van main `d3ff69271c245650559953d22d9b44123119cb63`.

## Onderzochte bestaande basis

De app is een browserapp met lokale opslag en Vercel API-proxies voor Intervals. Er is geen serverdatabase voor de persoonlijke kalender of scheduler/cronconfiguratie in deze repository. Training Sync koppelt op sport, duur, afstand, intensiteit en tijdvenster, behoudt handmatige keuzes en snapshots, en werkt activiteiten op ID bij. Coach state, reviews, herstelcheck, calibration, support training, dagadvies en weekreplanner bestonden al. De weekreplanner was een correctiemotor voor morgen t/m zeven dagen vooruit; toevoegen van weken bleef handmatig. Profielkalibratie is de bestaande centrale bron; doeltijden en prognoses blijven gescheiden.

## Geïmplementeerd

- `rolling-coach.js` orkestreert de bestaande `buildAdaptiveWeekReplan`; voegt geen onafhankelijke kalendercorrectiemotor toe. Ook de bestaande weekvoorstellen gebruiken dezelfde doorlopende uitkomst na startup.
- Vandaag t/m zes dagen vooruit is concreet. Onbezette beschikbare dagen worden conservatief aangevuld; bestaande passende sessies worden behouden. Drie verdere kalenderweken staan als flexibele **aanvullende** vooruitblik buiten de kalender.
- De weekevaluatie wordt één keer per kalenderweek opgeslagen en bij een latere eerste opening ingehaald. De vorige week wordt vergeleken op geplande/uitgevoerde minuten en uitkomsten. RPE-minuten verschijnen alleen als de benodigde waarden beschikbaar zijn. Niet gekoppeld blijft onbekend, niet automatisch overgeslagen.
- Nieuwe activiteiten, gewijzigde activiteiten, reviews, herstel, profiel, beschikbaarheid, doelen en zones maken de invoersignatuur ongelijk. Bestaande refreshroutes plannen één microtask; dezelfde inhoud veroorzaakt geen nieuwe mutatie. Vluchtige timestamps tellen niet mee. Op de voorgrond wordt ook iedere minuut en bij terugkeer gecontroleerd.
- Dezelfde beschermde transactie en undo worden voor vandaag gebruikt. De weekmotor neemt het bestaande dagadvies als input mee. Tijdens het bewerken van een training wordt automatische toepassing uitgesteld.
- Triathlonvoorkeur ondersteunt loop-, fiets- en zwemsessies. Budgetten blijven per discipline apart. Zware belasting uit andere disciplines blijft via de bestaande stressanalyse meetellen.
- Historische minuten (drie weken) begrenzen de nieuwe omvang. Bij voldoende importdekking wordt de actuele week ook begrensd. De standaard groeimarge is 5%, instelbaar 0–10%; herstelruimte is instelbaar 2–4 dagen. Dit zijn conservatieve **heuristieken**, geen individueel gevalideerd fysiologisch model of universele veilige grenzen. Onvolledige historie wordt zichtbaar gemaakt; ze bewijst geen goede belastbaarheid.
- Nieuwe gestructureerde bloktrainingen kunnen minder herhalingen krijgen; naam, duur, instructies en exportrecept worden samen aangepast. Bestaande niet-herkende intervalrecepten worden niet blind afgekapt: de bestaande herstel-/rustvervanging blijft de uitweg.
- Pijn en vermoeidheid zijn snelle herstelcheckacties. Pijn maakt vrije nabije trainingen rust; beschermde sessies tonen een conflict met een concrete vervolgstap. Een enkele losse slaapmeting blijft onder de bestaande meervoudige-signalenregel.
- Vandaag heeft snelle acties voor tijd, vermoeidheid, pijn, verplaatsen en voltooiing. Voltooiing opent de bestaande optionele beoordeling. Wijzigingen/reden en vooruitblik staan uitklapbaar bij Vandaag.
- Web Locks serialiseren planners tussen tabbladen indien ondersteund. Binnen één tabblad coalesceren callers. Opnieuw gelezen kalenderopslag voorkomt het overschrijven van een wijziging uit een ander tabblad voordat het storage-event is verwerkt. Bij andere-tabwijzigingen pauzeert de coach tot herladen.
- Serviceworkerassets en appversie zijn 11.4.8. Bestaande gegevenssleutels, APIs en koppelingen zijn behouden; nieuwe `jp_`-staat reist mee in de generieke backup.

## Testen

`node --test tests/*.test.cjs`: 159 tests geslaagd. Nieuwe integratietests gebruiken de echte matcher en weekmotor met gecontroleerde gegevens. DOM-controles gebruiken de volledige HTML/scriptketen met jsdom en nagebootste netwerkantwoorden:

- `tests/ui/interface.smoke.cjs`: bestaande navigatie, beschikbaarheid, editor/verplaatsen, feedback, menu, offline en foutpaden. Automatische mutaties staan in deze navigatietest uit om handmatige fixtures te behouden.
- `tests/ui/rolling-coach.smoke.cjs`: automatische driedisciplineplanning, zeven dagen, flexibele vooruitblik, stabiele refresh, pijnactie, vandaag terugzetten en optionele beoordeling.

| Gevraagde situatie | Controle |
| --- | --- |
| Dag eerder uitgevoerd | Bestaande matcher/week-integratie: koppeling behouden, geen herhaling, idempotent |
| Gedeeltelijk uitgevoerd | Werkelijke duur/RPE en gedeeltelijke status, ook expliciete review |
| Extra zware activiteit | Drie uur fietsen beïnvloedt volgende looptraining, ook vandaag |
| Dag valt weg | Beschikbaarheid, inkorten/verplaatsen/vervallen en bescherming |
| Vermoeidheid of pijn | Herstelcheck, meervoudige signalen, pijnactie in volledige DOM-route |
| Meerdere gemiste trainingen | Niet inhalen; onbekende koppeling blijft onbekend; historie begrenst nieuwe omvang |
| Herhaalde synchronisatie | Deduplicatie en onveranderde invoersignatuur |
| Achteraf gewijzigd | Bestaande handmatige koppeling blijft behouden; status en rolling signature veranderen |
| Taper | Geen nieuwe zware sessies in beschermde periode; bestaande motor beschermt races |
| Vastgezette sessie | Ongewijzigd, conflict zichtbaar, andere dagen kunnen wijzigen |

## Grenzen en publicatiestatus

- Deze wijziging is een werkende uitbreiding, **geen volledige vervanging van alle gevraagde triathloncoachfunctionaliteit**. Er blijft één hoofdtraining per dag (maximaal zes nieuwe hoofdtrainingen per week) met aparte kracht/mobiliteit. Dubbele triathlondagen, bricks en een discipline-specifiek triathlonseizoensmodel zijn niet toegevoegd. Seizoensfasen en racekalender zijn nog grotendeels hardloopgericht.
- De vooruitblik gebruikt huidige historie zonder toekomstige fitheid te verzinnen en vult alleen ontbrekende sessies aan. Het is geen volledig geoptimaliseerd triathlonjaarplan. Algemene rustige sessies gebruiken zones/RPE; nieuwe blokken zijn conservatieve gecontroleerde trainingen. Niet alle oudere handmatige trainingsrecepten zijn zone-gebaseerd.
- Geen updates zolang de app gesloten is. De inhaalcontrole werkt bij openen/terugkeer/sync. Gemiste kalenderweken worden niet retrospectief verzonnen; de laatste afgelopen week wordt geëvalueerd.
- Export naar fiets/zwem/brick en directe COROS-ontvangst zijn niet uitgebreid. Reeds geëxporteerde sessies blijven beschermd; remote verplaatsen/verwijderen is nog geen automatische transactie.
- Geen live activiteitensync met persoonlijke credentials en geen echte iPhone/Safari-rendercontrole uitgevoerd. DOM-tests zijn geen visuele browser- of horlogecontrole.
- Lokale implementatie en tests zijn voltooid. Publicatie naar een ontwikkelbranch/PR wordt afzonderlijk gerapporteerd. Een PR is geen bevestigde productie-uitrol op Vercel.
