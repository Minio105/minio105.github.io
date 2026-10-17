# Epoka Konfliktów

Turowa strategia wojenna (grand strategy) na **prawdziwej mapie świata** — w stylu *Age of History II*.
Wcielasz się w jedno z 190 państw, rozwijasz gospodarkę, rekrutujesz armie i podbijasz kolejne
prowincje, aż staniesz się największym mocarstwem planety.

Gra działa **w całości offline**: wystarczy otworzyć plik `epoka-konfliktow.html` w przeglądarce
(Chrome, Edge, Firefox). Bez instalacji, bez serwera, bez internetu, bez Node.js.

> Plik `index.html` w tym katalogu to **Centrum gier** — proste menu z linkami do trzech gier
> (`skrzynki.html`, `kolo-i-krzyzyk.html`, `epoka-konfliktow.html`). Tę grę uruchomisz też
> bezpośrednio z `epoka-konfliktow.html`.

---

## Szybki start

1. Pobierz/rozpakuj katalog z grą.
2. Kliknij dwukrotnie **`epoka-konfliktow.html`** (albo przeciągnij plik do okna przeglądarki).
3. W menu wybierz **Nowa gra** → poziom trudności → państwo → **Rozpocznij grę**.
4. Zakończ turę (przycisk lub `Spacja`), wydawaj rozkazy i podbijaj świat.

Zapisy trzymane są w `localStorage` przeglądarki (sloty 1–3 + autosave). Nie są to pliki na dysku —
zapis jest przypisany do przeglądarki i profilu użytkownika. Wyczyszczenie danych witryny usuwa zapisy.

---

## Sterowanie

| Wejście | Działanie |
|---|---|
| **LPM** na prowincji | zaznacz prowincję (panel po prawej pokazuje rozkazy) |
| **LPM** na sąsiedniej własnej prowincji | przenieś armię |
| **LPM** na sąsiedniej wrogiej prowincji | atak (wymaga stanu wojny) |
| **Shift + LPM** na prowincji nadmorskiej | desant / transport morski (do 1800 km) |
| **PPM** | anuluj zaznaczenie / tryb rozkazu / zamknij okno |
| **Przeciągnij myszą** | przesuwanie mapy |
| **Kółko myszy**, `+`/`-` | zbliżenie / oddalenie (można oddalić do całego świata) |
| **Spacja** | zakończ turę |
| `M` | następny tryb mapy |
| `R` | ranking państw |
| `H` | pomoc / zasady |
| `Esc` | anuluj |
| `←→↑↓` | przesuwanie mapy klawiaturą |

W panelu prowincji dostępne są przyciski: rekrutacja (+1 / +5 / maks.), inwestycje,
fortyfikacje, tryb ruchu i tryb ataku. W panelu obcej prowincji: wypowiedzenie wojny,
propozycja pokoju, propozycja sojuszu, zerwanie sojuszu, „Pokaż państwo”.

---

## Zasady gry

**Czas.** Jedna tura = jeden rok, start w roku 2026.

**Gospodarka.** Każda prowincja daje co turę dochód zależny od liczby ludności i poziomu
gospodarki (0–100). Armia kosztuje utrzymanie (ok. 0,32 szt. zł za żołnierza na turę).
Pusty skarbiec oznacza dezercje.

- **Rekrutacja** — 10 szt. zł za żołnierza (ograniczeniem jest pojemność garnizonu prowincji).
- **Inwestycje** — zwiększają gospodarkę prowincji (+4), co podnosi przyszły dochód.
- **Fortyfikacje** — maks. 5 poziomów; każdy poziom mocno zwiększa obronę prowincji.

**Wojna.** Najpierw wypowiedz wojnę, potem atakuj. Bitwa rozgrywana jest automatycznie w 4 rundach
i uwzględnia: liczebność, technologię (poziom gospodarki), fortyfikacje, bonus stolicy,
wsparcie z sąsiednich prowincji oraz karę za desant morski (−38% siły ataku).
Ta sama armia działa raz na turę. Po zdobyciu prowincji ocalali żołnierze zostają w niej jako garnizon.
Zdobycie stolicy wroga automatycznie przenosi jego stolicę do innej prowincji.

**Desant morski.** Z własnej prowincji nadmorskiej można zaatakować/przetransportować armię do
prowincji nadmorskiej w promieniu 1800 km (koszt 25 szt. zł). Przytrzymaj `Shift` i kliknij cel.

**Dyplomacja.** Państwa mogą być w stanie wojny, pokoju, sojuszu lub rozejmu.
- Sojusznicy automatycznie przystępują do wojen po swojej stronie.
- Pokój daje 12 tur rozejmu (nie można wtedy wypowiedzieć wojny).
- Wojna wygasa, gdy strona traci siły — AI samo proponuje pokój lub sojusz (okno z decyzją).

**AI.** Państwa AI rekrutują armie na frontach, atakują przy korzystnych szansach, wypowiadają wojny
słabszym sąsiadom, zawierają sojusze i kończą wyczerpujące wojny. Świat „żyje” także bez gracza.

**Zwycięstwo.**
- **Zwycięstwo — nowa potęga:** powiększysz państwo trzykrotnie (względem stanu początkowego),
  kontrolując co najmniej 5% prowincji świata i będąc w pierwszej trójce rankingu.
- **Dominacja światowa:** kontrolujesz co najmniej 50% prowincji świata.
- Przegrywasz, gdy twoje państwo przestanie istnieć.

**Tryby mapy:** Polityczna, Dyplomatyczna (sojusze/wojny/rozejmy), Armia, Gospodarka, Ludność.

---

## Struktura projektu

```
index.html                  Centrum gier — menu z linkami do wszystkich trzech gier
epoka-konfliktow.html       punkt wejścia tej gry (klasyczne <script>, działa z file://)
css/style.css               wygląd (ciemny motyw, polskie etykiety)
js/core/util.js             drobne funkcje pomocnicze (formatowanie, losowość, kolory)
js/core/camera.js           kamera mapy: przesuwanie, zoom, przeliczanie współrzędnych
js/world/worldgen.js        budowa świata: rasteryzacja lądów, podział na prowincje,
                            kontury, granice, nazwy, ludność, stolice
js/game/state.js            stan gry, zapis/odczyt (localStorage), poziomy trudności
js/game/logic.js            ekonomia, rekrutacja, ruch, bitwy, dyplomacja, koniec tury
js/game/ai.js               decyzje państw AI
js/render/renderer.js       rysowanie mapy (Path2D, tryby mapy, armie, etykiety)
js/ui/ui.js                 pasek górny, panel prowincji, kronika, modale
js/main.js                  spina wszystko: start, wejście, tury, okna dialogowe
js/data/world-geo.js        dane mapy (Natural Earth 1:50m) — patrz niżej
js/data/world-cities.js     miasta z nazwami polskimi (Natural Earth)
tools/extract-cities-pl.ps1 skrypt pomocniczy: ekstrakcja miast 1:50m (z tłumaczeniami PL)
tools/merge-cities.ps1      skrypt pomocniczy: scalanie 1:50m + 1:10m (bez duplikatów)
```

Gra nie wymaga budowania ani instalowania zależności. Pliki `js/data/*.js` to zwykłe skrypty
przypisujące dane do `window` — dlatego wszystko działa również z protokołu `file://`
(bez `fetch` i bez modułów ES).

---

## Dane źródłowe

- **Granice państw:** Natural Earth 1:50m (*Admin 0 – Countries*), domena publiczna.
- **Miasta:** Natural Earth 1:50m *Populated Places* (wersja z tłumaczeniami — użyto `NAME_PL`,
  stąd polskie nazwy: Monachium, Praga, Wiedeń…) oraz Natural Earth 1:10m *Populated Places*
  (~5,7 tys. dodatkowych miejscowości). Razem **6921 miast**.

Skrypty w `tools/` służą do odtworzenia danych i wymagają PowerShella; do samej gry nie są potrzebne.

### Jak powstaje mapa

1. Lądy z GeoJSON są rasteryzowane do siatki 0,5° (720 × 284 komórki, zakres szerokości −58°…84°,
   bez Antarktydy).
2. Spójne obszary każdego państwa są dzielone na prowincje metodą BFS od rozrzuconych ziaren
   (docelowo ~13 komórek na prowincję, maks. 220 prowincji na państwo).
3. Kontury prowincji są upraszczane (Douglas–Peucker) i rysowane jako `Path2D`.
   Granice (wybrzeża, granice państw, linie frontu) rysowane są z osobno zapisanych odcinków.
4. Każda prowincja otrzymuje nazwę najbliższego miasta w swoim kraju, populację i gospodarkę
   (interpolowane z danych), a państwo — stolicę.

Dzięki deterministycznemu generowaniu świat jest identyczny przy każdym uruchomieniu, więc zapisy
odwołujące się do numerów prowincji pozostają spójne.

**Ograniczenia:** prowincje są generowane algorytmicznie na siatce, więc mają „schodkowe”,
kanciaste kształty (to nie są prawdziwe jednostki administracyjne). Bardzo duże i słabo zaludnione
obszary (Grenlandia, Kanada, Syberia) mają proporcjonalnie więcej prowincji niż gęsto zaludnione
państwa Europy.

---

## Rozwój i debugowanie

Gra jest czystym JavaScriptem (ES5-owy styl, brak zależności), więc edytujesz pliki i odświeżasz stronę.
Konsola przeglądarki (`F12`) pokazuje błędy. Przydatne obiekty globalne:

- `App` — główny obiekt aplikacji (`App.state`, `App.world`, `App.renderer`, `App.camera`),
- `Logic`, `GameState`, `AI`, `Renderer`, `Camera`, `WorldGen`, `UI`, `Util`.

W świecie dostępne są m.in. `App.world.provinces.length` (3933), `App.world.countries.length` (190)
oraz czasy budowy w `App.world.timings` i `App.world.loadMs`.
