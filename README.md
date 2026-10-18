# NIGHT SHIFT: THE FORGOTTEN

Horror / survival / strategia w jednym pliku HTML. Wcielasz się w nocnego pracownika
opuszczonego centrum rozrywki „Kalejdoskop”. Siedzisz w kanciapie ochrony, masz monitor
z dwunastoma kamerami i jedną noc do przetrwania — od 12:00 AM do 6:00 AM.

## Jak uruchomić

Najprościej: otwórz `index.html` — to centrum gier z kartami wszystkich gier z tego folderu.
Karta **Night Shift: The Forgotten** (klawisz `5`) uruchamia tę grę.

Możesz też otworzyć sam plik `night-shift-the-forgotten.html` podwójnym kliknięciem
(Chrome / Edge / Firefox). Nie potrzeba internetu, instalacji ani żadnych dodatkowych
plików — grafika i dźwięk są generowane w kodzie. Gra zapisuje postęp w pamięci
przeglądarki (localStorage).

## Sterowanie

| Klawisz | Akcja |
| --- | --- |
| `A` / `D` | drzwi lewe / prawe |
| `Q` / `E` | światło w lewych / prawych drzwiach |
| `S` / `F` | kratka wentylacyjna / światło w szybie |
| `SPACJA` | monitor (kamery) |
| `1`–`9`, `0`, `-`, `=` | wybór kamery C1–C12 |
| `W` | nakręcanie pozytywki (tylko na kamerze C6) |
| `T` | odbierz / odłóż telefon nocnego pracownika |
| `V` | tryb pełnoekranowy |
| `P` / `ESC` | pauza |

Wszystko da się też klikać myszką (przyciski na dole ekranu, kafelki kamer w panelu,
aparat telefoniczny na biurku). Przyciskiem `DŹWIĘK` w menu i na dole ekranu można wyciszyć grę.

## Przeciwnicy

- **Kurator** — idzie z warsztatu przez magazyn i korytarz zachodni do lewych drzwi. Cofa się
  od światła (ale tylko, gdy świecisz mu w twarz), a tak naprawdę zatrzymują go dopiero zamknięte
  drzwi. Gdy patrzysz na jego pomieszczenie na monitorze, zastyga.
- **Ten, Który Czeka** — przesuwa się wtedy, gdy „mrugasz” obrazem: przełączasz kamerę albo
  opuszczasz monitor. Jeśli patrzysz bez ruchu na jego korytarz — stoi. Zamykaj drzwi, a gdy
  w nie wali, tracisz dodatkową energię.
- **Świetlik** — leci wentylacją i **wabi go światło**. Nie zapalaj lampy w szybie. Zatrzymuje
  go tylko zamknięta kratka (i to na chwilę, potem próbuje znowu).
- **Marionetka** — od 4. nocy w piwnicy gra pozytywka. Jeśli umilknie, masz kilkanaście sekund
  na jej nakręcenie (kamera C6, przytrzymaj `W`), zanim ona wstanie. Wtedy nic jej nie zatrzyma.

Maskotki z przedstawień (od 5. nocy) — każda ma inny sposób działania:

- **Bonifacy** (króliczek z sali urodzinowej, prawe drzwi) — światło reflektora go **mrozi**
  w miejscu (i tylko mrozi — nie odpędza, więc można tak stać bez końca), a dopiero zamknięte
  drzwi każą mu się cofnąć. Idzie szybciej, gdy patrzysz w monitory.
- **Lisek** (kręgielnia C11, lewe drzwi) — ładuje się, gdy **nikt na niego nie patrzy**. Gdy
  wskaźnik się zapełni, rusza biegiem korytarzem i masz około sekundy na zamknięcie drzwi.
  Wystarczy zaglądać do kręgielni, żeby ładowanie się zerowało; zamknięte drzwi odbijają go
  do kręgielni, ale tracisz wtedy energię.
- **Gospodarz** (miś z plakatu, lewe drzwi, 6. noc) — najpowolniejszy i najtrwalszy. Idzie
  **tylko wtedy, gdy patrzysz w monitory** — im dłużej siedzisz na kamerach, tym bliżej jest.
  Światło go nie obchodzi: zatrzymują go wyłącznie drzwi. Zamyka się go na dłużej niż resztę.

Każde zamknięte drzwi i każde światło pobiera energię. Gdy energia spadnie do zera, budynek
gaśnie — a po kilkunastu sekundach ciemności coś podchodzi do biura.

## Telefon nocnego pracownika

Każdej nocy po kilku sekundach dzwoni aparat na biurku. Odbierz (`T` albo klik w słuchawkę),
żeby wysłuchać poprzedniego pracownika — Marka. Jego rady są prawdziwe i dotyczą konkretnie
tej nocy (nowych maskotek, pozytywki, wentylacji). Rozmowa nie zatrzymuje gry, więc możesz
w trakcie zamykać drzwi. Obrazek trzymany na biurku, obok telefonu, to podgląd wszystkich
kamer: C1–C12.

## Kamery i pomieszczenia

| Kamera | Pomieszczenie | Uwagi |
| --- | --- | --- |
| C1 | Wejście główne | start Gospodarza |
| C2 | Korytarz zachodni | tu wchodzą Kurator i Lisek |
| C3 | Korytarz wschodni | tu wchodzi Ten, Który Czeka |
| C4 | Sala gier | |
| C5 | Kuchnia i bar | start Świetlika |
| C6 | Piwnica / generator | pozytywka Marionetki (trzymaj `W`) |
| C7 | Sala kinowa | start Tego, Który Czeka |
| C8 | Szyb wentylacyjny | droga Świetlika |
| C9 | Magazyn | |
| C10 | Sala urodzinowa | start Bonifacego |
| C11 | Kręgielnia | tu ładuje się Lisek |
| C12 | Warsztat | start Kuratora |

## Struktura gry

- 6 nocy o rosnącej trudności (szósta to „Koszmar”, odblokowywana po przejściu pięciu).
  Wrogowie dochodzą kolejno: 1. noc — Kurator; 2. — Ten, Który Czeka; 3. — Świetlik;
  4. — Marionetka; 5. — Bonifacy i Lisek; 6. — Gospodarz.
- 12 kamer, 12 pomieszczeń, własna scenografia każdego z nich.
- 6 wpisów z księgi zmian odkrywających historię zamknięcia centrum (menu → WPISY).
- Wpisy i najwyższa odblokowana noc zapisują się automatycznie.

## Pliki

- `index.html` — centrum gier (karty wszystkich gier z folderu, klawisze `1`–`5`).
- `night-shift-the-forgotten.html` — cała gra (HTML + CSS + JavaScript, ok. 97 kB).
