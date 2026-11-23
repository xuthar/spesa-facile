# Spesa Facile

Programma web per preparare una lista della spesa, raggruppare i prodotti per reparto e salvare un PDF A4.

- Ricerca per nome, marca e categoria.
- Quantità con pulsanti più e meno o inserimento numerico.
- Prezzi unitari modificabili e calcoli in centesimi.
- Subtotali per reparto e totale generale.
- Salvataggio automatico della lista sul dispositivo.
- PDF scaricabile con quantità, prezzo unitario, importo e caselle da spuntare.
- Interfaccia utilizzabile anche da telefono.

## Catalogo e prezzi

Il file `data/catalog.json` contiene le schede recuperate da Conad Spesa Online il 23 novembre 2026 per l’assortimento visibile nella zona di Adria. La rilevazione riporta data, provenienza e copertura. I prodotti sono identificati dal codice Conad e conservano il collegamento alla scheda originale.

I prezzi sono una rilevazione datata. Promozioni a soglia, carte fedeltà e buoni richiedono una verifica. I prodotti a peso variabile hanno un costo stimato. Consegna e costi di servizio sono esclusi dal totale. I prezzi si possono correggere nella lista.

## Esecuzione

Il sito usa HTML, CSS e JavaScript senza dipendenze esterne per i calcoli e i PDF. GitHub Pages serve la cartella principale del ramo `main`.

Per una verifica locale, dalla cartella del progetto avviare `python -m http.server 8080` e aprire `http://localhost:8080`.

La lista personale resta nel browser del dispositivo utilizzato.
