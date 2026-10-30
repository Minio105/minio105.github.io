# MOSTOWNIA — symulator inżyniera

Gra 2D o budowaniu mostów z rzeczywistą symulacją konstrukcji. Zbuduj przeprawę,
zmieść się w budżecie i przeprowadź pojazd na drugi brzeg.

## Uruchomienie

Otwórz `index.html` w przeglądarce albo uruchom lokalny serwer:

```powershell
powershell -ExecutionPolicy Bypass -File tools/serve.ps1
```

Następnie wejdź na <http://localhost:8765/>.

## Sterowanie

| Akcja | Sposób |
| --- | --- |
| Budowanie | przeciągnij między dwoma punktami albo kliknij punkt, a potem drugi |
| Wybór materiału | `1` droga, `2` drewno, `3` stal, `4` lina |
| Zaznaczenie elementu | kliknij belkę |
| Usunięcie | `Delete` / `Backspace`, przycisk „Usuń” lub prawy przycisk myszy |
| Cofnij / ponów | `Ctrl+Z` / `Ctrl+Y` |
| Start testu | `T` lub „TESTUJ MOST” |
| Pauza / wznowienie | `Spacja` |
| Reset testu | `R` |
| Powrót do projektu | `B` |
| Pomoc | `H` |

## Zasady

- Droga musi tworzyć ciągły ciąg od lewego do prawego brzegu.
- Każdy wewnętrzny punkt drogowy musi mieć zakotwiczoną podporę — ciąg belek lub lin
  prowadzący do stałego punktu w skale.
- Nie możesz przekroczyć budżetu poziomu.
- Droga jest ciężka i tylko ona pozwala pojazdowi przejechać.
- Drewno jest tanie i lekkie, stal mocna, ale ciężka, a lina przenosi wyłącznie
  rozciąganie — nigdy nie podpiera.
- Elementy mają masę, sprężystość i limity wytrzymałości. Przeciążone pękają,
  a oderwane fragmenty spadają do doliny.
- Trzy gwiazdki dostajesz za przejazd bez uszkodzeń i koszt nie większy niż 90% budżetu.

## Poziomy

Pięć coraz trudniejszych przepraw: od lekkiej drewnianej kratownicy po głęboki kanion
dla 7,8-tonowego pojazdu testowego. Postęp i projekty zapisują się w `localStorage`.

## Pliki

- `index.html` — interfejs gry
- `icon.svg` — ikona gry i favicon
- `css/style.css` — wygląd i układ responsywny
- `js/levels.js` — materiały, pojazdy i konfiguracje poziomów
- `js/physics.js` — solver sprężysty, zrywanie elementów i ruch pojazdu
- `js/render.js` — rysowanie planszy, mostu, pojazdu i efektów
- `js/app.js` — logika budowania, testów, wyników i zapisu
- `tools/serve.ps1` — prosty serwer lokalny
