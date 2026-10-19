# 11.4.9 — lege beschikbare week herstellen

Gebruiker meldde een leeg weekoverzicht ondanks beschikbare tijd. Dit is gereproduceerd met een lege kalender, vier gewenste loopsessies, onvolledige historie en een herstelweek na een halve marathon. In 11.4.8 werd 58,5 minuten herstelbudget door vier gedeeld; alle sessies bleven onder de minimumduur van twintig minuten en werden allemaal verworpen. De voorkeurfrequentie wordt nu begrensd op het aantal haalbare sessies. Het totale volume wordt niet verhoogd om dagen te vullen.

Een gedeeltelijk importvenster wordt niet langer over drie fictieve weken gemiddeld. Bij onvolledige historie wordt alleen de waargenomen periode gebruikt, minimaal één week; het vertrouwen blijft beperkt.

Het weekoverzicht toont de status van automatisch aanvullen en een gerichte actie om opnieuw te controleren. Als de gebruiker automatisch aanpassen eerder heeft uitgezet, blijft dat gerespecteerd en verschijnt een inschakelknop. Blokkades en ontbrekende planningsruimte blijven zichtbaar. De invoersignatuur bevat nu de planner-versie zodat de reparatie ook zonder nieuwe trainingsinput wordt toegepast.

Opslaan van beschikbaarheid gebruikt in de volledige app nu uitsluitend de centrale rolling-coach, inclusief de eerste vulling. De oude generator blijft alleen als compatibiliteitsfallback voor omgevingen zonder de rolling-module.

Validatie: 162 unit/integratietests geslaagd, inclusief eerst falende regressie voor herstelweek, korte importperiode en uitgeschakelde coach. Beide volledige DOM-smokes slagen; rolling smoke controleert ook de zichtbare planning in een herstelweek. Syntax en diff-whitespace gecontroleerd. Geen toegang tot de persoonlijke lokale opslag op de iPhone: de exacte oorzaak op dat toestel is niet onafhankelijk vastgesteld. Geen persoonlijke activiteiten of sleutels gebruikt.
