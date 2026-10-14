# Kalibratie & zones — implementatie 11.4.7

Deze wijziging voegt een beoordelingsgestuurde kalibratiefunctie toe aan de bestaande app, onder **Voortgang → Kalibratie & zones**. De kalender, dagelijkse training, Intervals-export, profiel en prestatiemodellen blijven dezelfde onderdelen gebruiken. Geen extra planner of externe opslagdienst.

## Protocollen en betekenis

| Test | Gegevens en verwerking | Betekenis |
| --- | --- | --- |
| Aerobe duurcontrole | 15 min voorbereiden, 60 min gelijkmatig praattempo, 10 min uitlopen. Vergelijk snelheid/hartslag in beide testhelften. | Submaximale veldindicatie. Alleen 3,5–5% drift geeft een voorstel voor een aerobe trainingsgrens, gebaseerd op de eerste 3 stabiele testminuten. Minder drift bepaalt de grens niet; meer drift vraagt om herhaling/omstandighedencontrole. |
| 30 min solo | 15 min voorbereiden, 30 min gelijkmatige zware solo-inspanning, 10 min uitlopen. Hartslag: laatste 20 testminuten; tempo: de volledige 30 min. | Functionele veldschattingen van drempelhartslag en drempeltempo, geen gemeten LT2/VT2. |
| Prestatietest / recente wedstrijd | 5 km-test; alternatief: een recente wedstrijd op een bevestigd gemeten parcours van 3–42,2 km. Verstreken testtijd en snelheid/afstand worden gecontroleerd. | Prestatie, geen lactaat-, ventilatoire of maximale hartslagmeting. |
| Optionele maximale hartslag | Progressief heuvelprotocol met inlopen, herstel en uitlopen; 50 min gereserveerd inclusief extra herstel. Hoogste aanhoudende hartslag over 10 seconden in het volledige heuvelblok. | Geteste veldbenadering van HRmax. Los van hoogste waargenomen hartslag; geen leeftijdsformule of opslag van 10 slagen. |

Bronnen geraadpleegd op 14 oktober 2026:

- Joe Friel / TrainingPeaks: https://www.trainingpeaks.com/learn/articles/joe-friel-s-quick-guide-to-setting-zones/ — 30-minutensolotest, sportafhankelijke drempelhartslagzones, tempotrainingsindeling.
- Uphill Athlete: https://uphillathlete.com/aerobic-training/heart-rate-drift/ — constant tempo, testhelften en driftinterpretatie. De app gebruikt de langere 60-minutenvariant. De gebruikte grenzen zijn praktijkheuristieken, geen universeel gevalideerde laboratoriumdrempels.
- Polar: https://www.polar.com/blog/calculate-maximum-heart-rate-running/ — vrijwillig progressief heuvelprotocol en geschiktheid. De app neemt geen leeftijdsformule of vaste opslag bij een lagere piek over.
- Intervals.icu API, uitleg door de ontwikkelaar: https://forum.intervals.icu/t/api-access-to-intervals-icu/609?page=11 — optionele tijdreeksen via `/activity/{id}/streams`.

**LT1/LT2, VT1/VT2, aerobe trainingsgrens en HRmax blijven aparte begrippen.** De app meet geen lactaat of ademgassen. Het Friel-zonemodel is een trainingsconventie; de bovengrens van zijn Z2 is niet automatisch LT1/VT1.

## Centrale gegevens en bestaande berekeningen

`jp_calibration_v1` bevat waarden per sport, datum, bron, methode, kwaliteit, vergrendeling, voorstellen en een versiegeschiedenis. Bestaande opgeslagen hartslaginstellingen worden gemigreerd als **onbevestigd**, zonder verzonnen testdatum. De bestaande appdefaults zijn geen persoonlijke meetresultaten en onderdrukken een voorstel bij ontbrekende uitgangswaarden niet.

- `getProfile()` levert geaccepteerde hardloopwaarden aan de bestaande coach.
- Fietshartslag wordt niet meer uit hardloop-HRmax afgeleid bij activiteitclassificatie of RPE-suggesties.
- `targetPacesForRace()` en nieuw gegenereerde weektrainingen gebruiken geaccepteerd drempeltempo. Tempo-intervallen zijn trainingsvoorschriften, geen nieuwe fysiologische metingen.
- Zonder drempeltempo kan een geaccepteerde prestatie trainingsdoelen leveren via het al gebruikte Riegel-model (exponent 1,06; 60-minutenequivalent). Dat wordt niet als drempelwaarde opgeslagen.
- Geaccepteerde prestaties vervangen de oude ongedateerde profiel-PR-bron in de prognoseberekening en krijgen een echte ouderdomsweging. Het bestaande model kan daarnaast recente activiteiten gebruiken; prognoses blijven schattingen.
- Fitness/belasting (CTL/ATL e.d.) blijven afkomstig uit de bestaande synchronisatie. Een test overschrijft deze niet.

## Planning en begeleiding

De app stelt eerst een test voor, maar plant uitsluitend na een expliciete keuze. Een test vervangt een bestaande geschikte hardlooptraining. Beschikbare minuten inclusief aanvullende sessies, bestaande duur, intensiteit, voltooiing, vergrendeling, races, herstel en recente belasting worden gecontroleerd. Een zware test kan alleen een kwaliteitstraining vervangen. Geen geschikt slot betekent geen extra training.

Praktische standaardtermijnen: aerobe/drempelcontrole circa 8 weken; recente wedstrijdinformatie maximaal 6 weken voor het voorkomen van een extra prestatietest. Meerdere bruikbare afwijkende resultaten leiden eerst tot beoordeling daarvan. Basis-/opbouwfase en handmatige keuze kunnen een rustige controle motiveren. Dit zijn productkeuzes, geen medische voorschriften. HRmax wordt nooit automatisch getest omdat het ontbreekt.

Conservatieve buffers: 14 dagen vóór een A-race, 7 vóór andere wedstrijden, minimaal 3 dagen erna (of langer volgens de bestaande raceherstellogica), twee rustige dagen rond zware/lange training, inclusief fietsen, zwemmen en aanvullende kracht. Onbekend herstel wordt niet als goed gepresenteerd: de geschiktheidscheck moet expliciet worden ingevuld.

Klachten, ziekte en medische beperkingen blokkeren de test. Zware testen vragen bewuste instemming en recente intensieve ervaring. Stopcriteria en professionele beoordeling bij inspanningsklachten staan in de begeleiding. Een borstband wordt aanbevolen, zonder automatische kwaliteitsgarantie.

## Kwaliteitsbeoordeling

De bestaande detail-API vraagt uitsluitend bij `streams=1` tijd, hartslag, snelheid en cadans op. Normale activiteitsdetails blijven lichtgewicht. De analyse gebruikt een expliciet geselecteerd testblok, niet het activiteitsgemiddelde. De gebruiker geeft start/einde in seconden vanaf activiteitstart, uitvoering, RPE en omstandigheden aan.

Controles: testduur, warming-upregistratie, tijdvolgorde, gaten groter dan 5 seconden, minimaal 98% datadekking, hartslag 45–230 bpm, abrupte hartslagwisselingen, snelheid 1–8 m/s en GPS-sprongen, langdurige overeenkomst met cadans of dubbele cadans, tempoconstantie en pauzes. Dit zijn conservatieve detectiegrenzen, **geen betrouwbaarheidspercentages**. Cadansverwarring kan niet definitief bewezen worden; een verdenking blokkeert verwerking. Ontbrekende cadans is geen bewijs van een correcte sensor.

Hitte, vermoeidheid, wisselend terrein en GPS-problemen zijn deels afhankelijk van gebruikersrapportage. De heuveltest mag uiteraard op een heuvel plaatsvinden. Elke beperking wordt uitgelegd; onbruikbare/beperkte resultaten wijzigen geen zones. Na aanvulling van ontbrekende data mag een onbruikbare, nog niet behandelde analyse opnieuw worden uitgevoerd; de eerdere poging blijft vastgelegd. Een geaccepteerde of afgewezen activiteit wordt niet opnieuw verwerkt.

## Acceptatie, historie en export

Standaard en in deze versie uitsluitend handmatige acceptatie. Vastgezette, professionele en recentere bronnen vereisen expliciete bronkeuze. Wijzigingen groter dan 8% vragen een extra bevestiging; dit is een beschermingsgrens, geen fysiologische zekerheid. Conflicterende grensvolgorde wordt geblokkeerd. Een gewone lagere piek verlaagt HRmax niet.

Acceptatie materialiseert gewijzigde doelen uitsluitend in toekomstige, niet voltooide en niet vastgezette hardlooptrainingen. Bekende tempo-/hartslagvoorschriften worden aangepast, warming-up/cooling-down blijven behouden. Gemengde kwaliteitstrainingen zonder duidelijke intensiteitscategorie en wedstrijdspecifieke blokken worden niet blind hernoemd of herschaald. Historische trainingen blijven ongewijzigd; nieuwe/gewijzigde trainingen bewaren hun zoneversie. Oude activiteitinterpretatie raadpleegt de zonehistorie waar beschikbaar.

Terugdraaien maakt een nieuwe versie en herstelt alleen toekomstige trainingen die sinds de wijziging niet handmatig zijn aangepast. Geschiedenis blijft bestaan. Fiets- of zwemwaarden wijzigen geen hardlooptrainingen.

Bestaande geëxporteerde gewijzigde trainingen worden via dezelfde datumgebonden `external_id` met `upsert=true` bijgewerkt. Alleen de kalibratie-exportwachtrij wordt verwerkt, geen andere oude exports. Fouten blijven zichtbaar en kunnen opnieuw worden geprobeerd. Nieuwe tests worden via de bestaande Planning-export verstuurd. Een geslaagde Intervals-export bewijst niet dat COROS het bestand al heeft ontvangen; Intervals-/horlogezoneprofielen worden niet apart overschreven.

## Verificatie

- `node --test tests/*.test.cjs`: **148 geslaagd**, waarvan 24 nieuwe kalibratie-, API- en integratiescenario's.
- `tests/ui/interface.smoke.cjs`: bestaande appinitialisatie, navigatie, trainingsdetails en offline foutafhandeling geslaagd (JSDOM).
- `tests/ui/calibration.smoke.cjs`: route, invoer, beoordeling, acceptatie, tempo’s, historie, terugdraaien, afwijzen en maximale-testuitleg geslaagd (JSDOM).
- Scenario’s omvatten: geen uitgangswaarden, professionele/vaste bronnen, geldige test, afbreken, ontbrekende HR, pieken, cadansverwarring, omstandigheden, recente race, bescherming vóór A-race, sporten scheiden, herhaalde analyse, grote wijzigingen, historiebehoud, latere handmatige edits en exportfouten/herhaling.
- Export en stream-API zijn met gesimuleerde antwoorden getest. Geen persoonlijke trainingsdata of echte geplande trainingen zijn tijdens deze ontwikkeling gewijzigd.

## Concrete beperkingen

- Live Intervals-tijdreeksen en daadwerkelijke COROS-overdracht zijn niet bevestigd in deze ontwikkelomgeving. Ontbrekende upstream-gegevens leiden tot een expliciete onbruikbare uitslag.
- Fiets-FTP en zwem-CSS kunnen met datum/bron/methode worden ingevoerd. Geen automatische FTP-/CSS-protocollen: de bestaande export ondersteunt geen volledige Ride/Swim-testketen en de benodigde vermogens-/zwembadverwerking ontbreekt.
- Testblokselectie en omgevingsbeoordeling zijn voorlopig handmatig. Geen automatische bevestiging van een laboratoriumrapport, borstbandsensor of parcoursmeting.
- Geen automatische zoneacceptatie; dit was optioneel en is bewust niet toegevoegd.
- Visuele beoordeling op een echt iPhone-scherm en echte veldvalidatie zijn niet uitgevoerd. De lokale Chromium-download was niet beschikbaar; DOM-interactietests zijn wel uitgevoerd.
- Bewaring volgt de bestaande lokale appopslag/backup. Geen nieuwe accountbrede cloud-synchronisatie van kalibratiegegevens.
