# Adaptieve coach 11.4.3

Vervolg op de op productie gecontroleerde versie 11.4.2.

## Correcties

- Een geblokkeerde dag zonder training levert rust op, geen ongevraagde mobiliteit.
- Alle nieuwe dagvoorstellen worden aan de beschikbare tijd getoetst. De bestaande centrale weekhelpers verzorgen inkorten of verlichten; als een zinvolle sessie niet past, blijft rust over. Wedstrijden, vastgezette en voltooide trainingen blijven beschermd, ook bij een tijdconflict.
- Fiets- en zwemtrainingen blijven in hun eigen discipline wanneer vermoeidheid of de herstelfase een lichtere sessie vraagt. Een geplande kracht-/coresessie kan in herstel mobiliteit worden; dat wordt als vervanging getoond.
- De inkorthelper accepteert de expliciete beschikbaarheid van het dagadvies, zodat een oudere weekinstelling niet leidend is.
- Yoga, mobiliteit en stretching vormen een afzonderlijke matchingfamilie. Kracht/core blijven samen. Dezelfde indeling voorkomt foutieve deduplicatie tussen mobiliteit en kracht. Historische activiteiten worden niet veranderd.

## Controle

124 tests geslaagd met `node --test tests/*.test.cjs`; syntaxcontrole van gewijzigde JavaScript en `git diff --check` geslaagd. Nieuwe regressietests controleren lege geblokkeerde dagen, fiets-/zwemherstel, een vijfminutenvenster, expliciete tijdslimieten, determinisme, behoud van het originele plan en kracht versus mobiliteit.

## Grenzen

Dit is een gerichte vervolgverbetering, nog geen complete triathlonseizoenscoach. De overige beperkingen van 11.4.2 blijven gelden: één hoofdtraining per dag, geen volledige triathlonprognose of seizoensgenerator, geen directe COROS-koppeling en geen fiets-/zwemexport. Er is geen live horloge-export met persoonlijke credentials uitgevoerd. Titel of subjectieve intensiteit alleen is geen bewijs voor trainingsvoltooiing.
