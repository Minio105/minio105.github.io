"use strict";

/* =======================================================================
   1. DANE
   ======================================================================= */
const TIERS = ["mil","restricted","classified","covert","special","relic"];
const TIER = {
  mil:        {name:"Mil-Spec",            color:"#4b69ff", hue:214},
  restricted: {name:"Restricted",          color:"#8847ff", hue:274},
  classified: {name:"Classified",          color:"#d32ce6", hue:302},
  covert:     {name:"Covert",              color:"#eb4b4b", hue:2},
  special:    {name:"★ Rzadkie specjalne", color:"#ffd700", hue:46},
  relic:      {name:"✦ Relikt",             color:"#ffe9a8", hue:48}
};
const RATIO    = {mil:1, restricted:3.6, classified:13, covert:47, special:170, relic:650};
const EV_MULT  = 1.05;
const SELL_RATE= 0.90;

/* Noże ("kosy") są rzadsze, ale warte więcej. Współczynnik RATIO_EFF wyrównuje
   wartość, więc średni zwrot ze skrzynki (EV) zostaje bez zmian — po prostu
   rzadziej lecą noże, a gdy już lecą, są cenniejsze. */
const KNIFE_DAMP = 0.6;
const RATIO_EFF  = Object.assign({}, RATIO, { special: RATIO.special / KNIFE_DAMP });

/* =======================================================================
   1a. ✨ EFEKTY NA BRONIACH — rzadkie wykończenia podbijające wartość
   -----------------------------------------------------------------------
   Po wylosowaniu broni losuje się jeszcze efekt (niezależnie od tego, co
   wypadło). Efekt mnoży wartość przedmiotu, więc taki drop sprzedaje się
   za dużo więcej, a na karcie widać jego odznakę i poświatę.
   Droższe tiery mają trochę większą szansę na błysk (FX_TIER_BOOST).
   Łączna szansa na jakikolwiek efekt ≈ 3,2% (bez boostu tieru).
   ======================================================================= */
const FX = [
  {id:"neon",    icon:"💡", name:"Neonowy",    color:"#38e08a", chance:0.0160, mult:1.8,  glow:"świecące krawędzie"},
  {id:"gold",    icon:"🥇", name:"Złoty",      color:"#ffd700", chance:0.0090, mult:2.6,  glow:"czyste złoto"},
  {id:"diamond", icon:"💎", name:"Diamentowy", color:"#a5f3fc", chance:0.0040, mult:4.0,  glow:"krystaliczny blask"},
  {id:"rainbow", icon:"🌈", name:"Tęczowy",    color:"#f472b6", chance:0.0018, mult:7.0,  glow:"pełne spektrum barw"},
  {id:"cosmic",  icon:"🌌", name:"Kosmiczny",  color:"#a855f7", chance:0.0007, mult:12.0, glow:"pył gwiazd i pustka"}
];
const FX_BY_ID = {};
FX.forEach(f=>FX_BY_ID[f.id]=f);

/* 🎄 EFEKTY EVENTOWE — limitowane, dostępne tylko w czasie eventu.
   Event trwa EVENT_FX_HOURS godzin (liczony od epochy eventu). Gdy event
   nieaktywny, efekty eventowe nie wypadają. */
const EVENT_FX_START = Date.UTC(2026, 9, 20);   // 20 paź 2026 00:00 UTC
const EVENT_FX_HOURS = 72;                        // trwa 3 dni
const EVENT_FX = [
  {id:"xmas",   icon:"🎄", name:"Świąteczny",  color:"#38e08a", chance:0.008, mult:3.5, glow:"śnieg i świece"},
  {id:"hallow", icon:"🎃", name:"Halloween",   color:"#fb923c", chance:0.006, mult:5.0, glow:"dynia i duch"},
  {id:"ny",     icon:"🎆", name:"Noworoczny",  color:"#f472b6", chance:0.003, mult:9.0, glow:"fajerwerki"},
  {id:"easter", icon:"🐰", name:"Wielkanocny", color:"#fde047", chance:0.004, mult:6.5, glow:"jaja i kwiatki"}
];
const EVENT_FX_BY_ID = {};
EVENT_FX.forEach(f=>EVENT_FX_BY_ID[f.id]=f);
function eventFxActive(){
  const now = Date.now();
  return now >= EVENT_FX_START && now < EVENT_FX_START + EVENT_FX_HOURS*3600*1000;
}
function eventFxList(){
  return eventFxActive() ? EVENT_FX : [];
}
const FX_CHANCE = FX.reduce((a,f)=>a+f.chance,0);   // suma szans (na tierze ×1)
const FX_TIER_BOOST = {mil:1, restricted:1, classified:1.3, covert:1.6, special:2.2, relic:3.0};
const FX_BIG = 4;                                    // od tego mnożnika odpalamy wielką fetę

/* 🎰 EVENTY EFEKTÓW — czasowe boosty kupowane w Sklepie.
   Aktywny event zwielokrotnia wagę wybranego efektu przy dropach i dodaje
   trochę ogólnego „lucka” na jakikolwiek efekt. */
const FX_EVENT_DUR   = 10*60*1000;   // 10 minut
const FX_EVENT_BOOST = 4;            // ×4 waga wybranego efektu
const FX_EVENT_LUCK  = 0.05;         // +5% ogólnej szansy na efekt za aktywny event
const FX_EVENT_PRICE = {
  neon:7500, gold:14000, diamond:50000, rainbow:180000, cosmic:500000,
  xmas:22000, hallow:30000, ny:80000, easter:36000
};

/* 🤡 Skrzynka Troll — prawie zawsze 1 moneta, bardzo rzadki jackpot 1M. */
const TROLL_PRICE       = 5000;
const TROLL_CHANCE      = 0.001;      // 0,1% na jackpot
const TROLL_JACKPOT     = 1000000;
const TROLL_CONSOLATION = 1;

const CASES = [
  { id:"start", name:"Skrzynka Startowa", price:100, color:"#3b82f6", icon:"📦",
    sub:"Podstawowy zestaw dla nowicjusza",
    odds:{mil:.7992, restricted:.1598, classified:.032, covert:.0064, special:.0026},
    items:{
      mil:       [["MP9","Zamieć","smg"],["P250","Piaskowa Mgła","pistol"],["Glock-18","Płyta Stalowa","pistol"],
                  ["FAMAS","Kolonia","rifle"],["Five-SeveN","Leśny Duch","pistol"],["XM1014","Błękitny Szron","shotgun"],
                  ["R8 Revolver","Zardzewiały","revolver"],["PP-Bizon","Piaskownica","smg"]],
      restricted:[["AK-47","Niebieski Laminate","rifle"],["AWP","Siła Natury","awp"],["M4A4","Miejski Terror","rifle"],
                  ["UMP-45","Korpo-Szary","smg"],["Nova","Poligon","shotgun"]],
      classified:[["Desert Eagle","Kod Czerwony","pistol"],["AK-47","Czerwona Linia","rifle"],["P90","Azjatycki Smok","smg"],
                  ["Galil AR","Rdza","rifle"]],
      covert:    [["AWP","Elektryczny Gniew","awp"],["AK-47","Ognisty Wąż","rifle"],["M4A4","Wojskowy","rifle"]],
      special:   [["Karambit","Fala","knife"],["Bayonet","Diamentowy","knife"],["Nóż Skeleton","Szkielet","knife"]] } },

  { id:"urban", name:"Skrzynka Miejska", price:600, color:"#14b8a6", icon:"🏙️",
    sub:"Miejskie legendy i sprawdzone konstrukcje",
    odds:{mil:.755, restricted:.190, classified:.040, covert:.012, special:.003},
    items:{
      mil:       [["MP7","Nocna Zmiana","smg"],["UMP-45","Rusztowanie","smg"],["Galil AR","Betonowy","rifle"],
                  ["P2000","Biuro","pistol"],["Nova","Chodnik","shotgun"],["SSG 08","Komin","awp"],
                  ["Sawed-Off","Zaułek","shotgun"],["Dual Berettas","Blok","pistol"]],
      restricted:[["M4A1-S","Rozbiórka","rifle"],["USP-S","Kaseton","pistol"],["MAC-10","Graffiti","smg"],
                  ["SG 553","Wieżowiec","rifle"],["Negev","Fundament","lmg"]],
      classified:[["AK-47","Wieczorny Neon","rifle"],["Desert Eagle","Szyld","pistol"],["AWP","Metropolia","awp"],
                  ["P90","Przemysłowy","smg"]],
      covert:    [["M4A4","Wielkie Miasto","rifle"],["AK-47","Neonowy Jeździec","rifle"],["AWP","Dachy","awp"]],
      special:   [["Nóż Motylkowy","Szkło","knife"],["Kukri","Miejski","knife"],["Karambit","Beton","knife"]] } },

  { id:"prism", name:"Skrzynka Pryzmat", price:1500, color:"#06b6d4", icon:"🌈",
    sub:"Tęcza, holografia i czysta estetyka",
    odds:{mil:.748, restricted:.198, classified:.042, covert:.0105, special:.0015},
    items:{
      mil:       [["P250","Holograf","pistol"],["MP9","Tęcza","smg"],["FAMAS","Pryzmat","rifle"],
                  ["Five-SeveN","Widmo Koloru","pistol"],["Galil AR","Rozszczepienie","rifle"],["Nova","Spektrum","shotgun"],
                  ["CZ75-Auto","Irys","pistol"],["PP-Bizon","Fiolet","smg"]],
      restricted:[["AWP","Aurora","awp"],["M4A1-S","Nurkowe Światło","rifle"],["USP-S","Opal","pistol"],
                  ["AUG","Ametyst","rifle"],["MP5-SD","Turkus","smg"],["MAG-7","Neonowa Fala","shotgun"]],
      classified:[["AK-47","Kwarc","rifle"],["Desert Eagle","Perła","pistol"],["P90","Fioletowy Kwarc","smg"],
                  ["SCAR-20","Hologram","awp"]],
      covert:    [["AWP","Pryzmatyczny","awp"],["M4A4","Tęczowy Metal","rifle"],["AK-47","Spektralny","rifle"]],
      special:   [["Nóż Skeleton","Pryzmat","knife"],["Karambit","Tęcza","knife"],["Nóż Talon","Holo","knife"]] } },

  { id:"spectral", name:"Skrzynka Widmo", price:3000, color:"#8b5cf6", icon:"👻",
    sub:"Duchy, glitche i wszystko co nienaturalne",
    odds:{mil:.720, restricted:.210, classified:.050, covert:.016, special:.004},
    items:{
      mil:       [["P250","Widmo","pistol"],["MP9","Ektoplazma","smg"],["FAMAS","Szept","rifle"],
                  ["Tec-9","Zimny Duch","pistol"],["XM1014","Zamglenie","shotgun"],["Galil AR","Zjawa","rifle"],
                  ["MAC-10","Parapsychologia","smg"],["Dual Berettas","Medium","pistol"]],
      restricted:[["AWP","Widmowy Cień","awp"],["M4A1-S","Duch Lasu","rifle"],["Five-SeveN","Zjawisko","pistol"],
                  ["MP7","Niewidzialny","smg"],["R8 Revolver","Zjawa","revolver"],["Nova","Poltergeist","shotgun"]],
      classified:[["AK-47","Nocna Zjawa","rifle"],["Desert Eagle","Glitchpop","pistol"],["P90","Eteryczny","smg"],
                  ["SSG 08","Materializacja","awp"]],
      covert:    [["AWP","Widmowy Ostrze","awp"],["AK-47","Pustka","rifle"],["M4A4","Opętanie","rifle"]],
      special:   [["Nóż Motylkowy","Fantomowe","knife"],["Sztylet Cieni","Mroczny","knife"],["Karambit","Widmowy","knife"]] } },

  { id:"chroma", name:"Skrzynka Chroma", price:12000, color:"#ec4899", icon:"💎",
    sub:"Tylko dla tych, którzy mają czym grać",
    odds:{mil:.680, restricted:.230, classified:.060, covert:.024, special:.006},
    items:{
      mil:       [["Desert Eagle","Chromowany","pistol"],["M4A4","Różowy Metal","rifle"],["P250","Fuksja","pistol"],
                  ["MP9","Neon Róż","smg"],["FAMAS","Elektro","rifle"],["Nova","Chrom","shotgun"],
                  ["Glock-18","Metaliczny","pistol"],["PP-Bizon","Kwas","smg"]],
      restricted:[["AK-47","Różowa Mgła","rifle"],["USP-S","Laser","pistol"],["AWP","Wstęga","awp"],["UMP-45","Oktan","smg"],
                  ["M249","Chromowany","lmg"],["CZ75-Auto","Elektryk","pistol"]],
      classified:[["AWP","Neonowy Przypływ","awp"],["M4A1-S","Płynny Metal","rifle"],["Desert Eagle","Kobalt","pistol"],
                  ["R8 Revolver","Chrom","revolver"]],
      covert:    [["AK-47","Hyper Beast","rifle"],["AWP","Pulsar","awp"],["M4A4","Kwasowy","rifle"]],
      special:   [["Karambit","Chromowany","knife"],["Bayonet","Kobalt","knife"],["Nóż Motylkowy","Neon","knife"]] } },

  { id:"frost", name:"Skrzynka Mrozu", price:22000, color:"#38bdf8", icon:"❄️",
    sub:"Lodowe ostrza i wieczna zima",
    odds:{mil:.700, restricted:.228, classified:.055, covert:.0126, special:.0044},
    items:{
      mil:       [["MP9","Szron","smg"],["P250","Zamieć Wieków","pistol"],["Galil AR","Lodowiec","rifle"],
                  ["Nova","Śnieżna Płaszczyzna","shotgun"],["SSG 08","Zawieja","awp"],["FAMAS","Igloo","rifle"],
                  ["Sawed-Off","Sople","shotgun"],["Dual Berettas","Lód","pistol"]],
      restricted:[["AWP","Zamieć","awp"],["M4A1-S","Lodowa Skała","rifle"],["AK-47","Szron","rifle"],
                  ["Desert Eagle","Lodowy Kryształ","pistol"],["Negev","Zamarznięty","lmg"],["USP-S","Mróz","pistol"]],
      classified:[["AK-47","Wieczna Zamieć","rifle"],["AWP","Lodowy Smok","awp"],["M4A4","Kra","rifle"],
                  ["R8 Revolver","Zamieć","revolver"]],
      covert:    [["AWP","Zamieć Absolutna","awp"],["AK-47","Lodowy Feniks","rifle"],["M4A1-S","Glacjał","rifle"]],
      special:   [["Nóż Talon","Zamieć","knife"],["Karambit","Lód","knife"],["Bayonet","Szron","knife"],["Kukri","Lodowiec","knife"]] } },

  { id:"dragon", name:"Skrzynka Smoka", price:50000, color:"#f59e0b", icon:"🐉",
    sub:"Legendy. Smoki. I noże, o których mówi się latami.",
    odds:{mil:.640, restricted:.250, classified:.070, covert:.032, special:.008},
    items:{
      mil:       [["AK-47","Łuska Smoka","rifle"],["AWP","Złoty Pył","awp"],["Desert Eagle","Pazur","pistol"],
                  ["M4A4","Burza Ognia","rifle"],["P90","Smocza Łuska","smg"],["MP9","Iskra","smg"],
                  ["Negev","Smoczy Ogień","lmg"],["Glock-18","Złoto","pistol"]],
      restricted:[["AK-47","Ognisty Duch","rifle"],["AWP","Smoczy Oddech","awp"],["M4A1-S","Płomień","rifle"],
                  ["Desert Eagle","Rubinowy Pazur","pistol"],["R8 Revolver","Wulkan","revolver"],["SCAR-20","Żar","awp"]],
      classified:[["AK-47","Smocza Krew","rifle"],["AWP","Jadeitowy Smok","awp"],["M4A4","Smocza Skóra","rifle"],
                  ["M249","Lawa","lmg"]],
      covert:    [["AK-47","Fire Serpent","rifle"],["AWP","Dragon Lore","awp"],["M4A4","Smoczy Płomień","rifle"]],
      special:   [["Karambit","Smoczy Pazur","knife"],["Nóż Motylkowy","Złoto","knife"],["Bayonet","Płomień","knife"],["Kukri","Smok","knife"]] } },

  { id:"void", name:"Skrzynka Pustki", price:90000, color:"#7c3aed", icon:"🌌",
    sub:"Ciemna materia, czarne dziury i absolutna nicość",
    odds:{mil:.660, restricted:.252, classified:.068, covert:.0163, special:.0037},
    items:{
      mil:       [["MP9","Ciemna Materia","smg"],["P250","Nicość","pistol"],["Galil AR","Próżnia","rifle"],
                  ["Nova","Czarna Dziura","shotgun"],["FAMAS","Antymateria","rifle"],["Tec-9","Kwazar","pistol"],
                  ["MAC-10","Pulsar","smg"],["XM1014","Grawitacja","shotgun"]],
      restricted:[["AWP","Horyzont Zdarzeń","awp"],["AK-47","Ciemna Mgławica","rifle"],["M4A1-S","Pustka","rifle"],
                  ["Desert Eagle","Singularność","pistol"],["M249","Kollapsar","lmg"],["USP-S","Kwazar","pistol"]],
      classified:[["AK-47","Czarna Dziura","rifle"],["AWP","Nicość","awp"],["P90","Mgławica","smg"],
                  ["R8 Revolver","Supernowa","revolver"]],
      covert:    [["AWP","Pustka Absolutna","awp"],["AK-47","Ciemna Gwiazda","rifle"],["M4A4","Ciemna Energia","rifle"]],
      special:   [["Nóż Skeleton","Nicość","knife"],["Nóż Talon","Pustka","knife"],["Nóż Motylkowy","Czarna Dziura","knife"],["Karambit","Kwazar","knife"]] } },

  { id:"royal", name:"Skrzynka Królewska", price:300000, color:"#fbbf24", icon:"👑",
    sub:"Bez śmieci — same dobre rzeczy. Najwyższa półka.",
    odds:{mil:.030, restricted:.590, classified:.280, covert:.086, special:.014},
    items:{
      mil:       [["P250","Posąg","pistol"],["MP9","Marmur","smg"],["Galil AR","Alabaster","rifle"],["Nova","Porcelana","shotgun"]],
      restricted:[["AK-47","Złota Harmonia","rifle"],["AWP","Królewska Wstęga","awp"],["M4A1-S","Srebrny Dwór","rifle"],
                  ["Desert Eagle","Monarcha","pistol"],["USP-S","Berło","pistol"],["AUG","Korona","rifle"]],
      classified:[["AK-47","Tron","rifle"],["AWP","Berło Carów","awp"],["M4A4","Carska Mozaika","rifle"],
                  ["P90","Diadem","smg"],["R8 Revolver","Regalia","revolver"]],
      covert:    [["AK-47","Królewski Rubin","rifle"],["AWP","Cesarska Korona","awp"],["M4A1-S","Złoty Ornament","rifle"],
                  ["Desert Eagle","Cesarstwo","pistol"]],
      special:   [["Karambit","Królewski","knife"],["Nóż Motylkowy","Tron","knife"],["Nóż Talon","Cesarstwo","knife"],["Bayonet","Monarcha","knife"]] } },

  { id:"troll", name:"Skrzynka Troll", price:TROLL_PRICE, color:"#a855f7", icon:"🤡",
    sub:"Albo 1 000 000 monet, albo 1 moneta. Naprawdę.",
    troll:true, noBattle:true, noAlbum:true, noItems:true,
    trollChance:TROLL_CHANCE, trollJackpot:TROLL_JACKPOT, trollConsolation:TROLL_CONSOLATION,
    odds:{mil:1-TROLL_CHANCE, special:TROLL_CHANCE}, items:{} }
];

/* =======================================================================
   1a. NOWE BRONIE — dorzucane do zestawów skrzynek
   Wartość przedmiotu liczy się z hasha nazwy (itemValue), więc dopisanie
   pozycji nie zmienia ekonomii skrzynki — dodaje tylko różnorodność.
   ======================================================================= */
const EXTRA_ITEMS = {
  start: {
    mil:       [["M249","Piaskowy","lmg"],["G3SG1","Zwiad","awp"],["Tec-9","Betonowy","pistol"],
                ["MAC-10","Kurier","smg"]],
    restricted:[["SG 553","Blokowisko","rifle"],["SSG 08","Nadzór","awp"],["MAG-7","Osiedle","shotgun"]],
    classified:[["M4A1-S","Nocna Zmiana","rifle"],["USP-S","Szkicownik","pistol"]],
    covert:    [["Desert Eagle","Błękitny Płomień","pistol"]],
    special:   [["Nóż Gut","Piaskowy","knife"],["Nóż Flip","Stalowy","knife"],["Nóż Przeżycia","Nowicjusz","knife"]]
  },
  urban: {
    mil:       [["G3SG1","Dachowiec","awp"],["PP-Bizon","Rusztowanie","smg"],["FAMAS","Klatka Schodowa","rifle"],
                ["Tec-9","Brukarz","pistol"]],
    restricted:[["Glock-18","Blokada","pistol"],["MAG-7","Kiosk","shotgun"],["P250","Szyld","pistol"]],
    classified:[["M4A4","Betonowy Ogród","rifle"],["USP-S","Metro","pistol"]],
    covert:    [["AWP","Wieżowiec","awp"]],
    special:   [["Nóż Bowie","Miejski","knife"],["Nóż Huntsman","Beton","knife"],["Nóż Nomad","Spacer","knife"]]
  },
  prism: {
    mil:       [["G3SG1","Spektrum","awp"],["MAC-10","Tęczowy Pył","smg"],["UMP-45","Refrakcja","smg"],
                ["P2000","Kalejdoskop","pistol"]],
    restricted:[["SCAR-20","Szkło","awp"],["SSG 08","Holo Ptak","awp"],["Sawed-Off","Fiolet","shotgun"]],
    classified:[["M4A1-S","Pryzmat Ognia","rifle"],["Glock-18","Fasetowanie","pistol"]],
    covert:    [["M4A1-S","Tęczowy Kwarc","rifle"]],
    special:   [["Nóż Ursus","Pryzmat","knife"],["Nóż Paracord","Holo","knife"],["Nóż Stiletto","Barwiony","knife"]]
  },
  spectral: {
    mil:       [["G3SG1","Seans","awp"],["PP-Bizon","Cmentarz","smg"],["Nova","Mgła","shotgun"],
                ["P2000","Mediumizm","pistol"]],
    restricted:[["UMP-45","Upiór","smg"],["Sawed-Off","Zniknięcie","shotgun"],["MAG-7","Ektoplazma","shotgun"]],
    classified:[["M4A1-S","Widmowy Las","rifle"],["Galil AR","Glitch","rifle"]],
    covert:    [["M4A1-S","Fantom","rifle"]],
    special:   [["Nóż Navaja","Zjawa","knife"],["Nóż Gut","Widmo","knife"],["Nóż Falchion","Ektoplazma","knife"]]
  },
  chroma: {
    mil:       [["G3SG1","Neonowy Zwiad","awp"],["Tec-9","Kwas","pistol"],["MAC-10","Różowy Neon","smg"],
                ["UMP-45","Chrom","smg"]],
    restricted:[["SG 553","Kwasowy","rifle"],["MAG-7","Neon","shotgun"],["P2000","Laser","pistol"]],
    classified:[["M4A4","Chromowana Mgła","rifle"],["Glock-18","Kwas","pistol"]],
    covert:    [["M4A1-S","Chromowany Wąż","rifle"]],
    special:   [["Nóż Flip","Neon","knife"],["Nóż Ursus","Chrom","knife"],["Nóż Klasyczny","Kobalt","knife"]]
  },
  frost: {
    mil:       [["G3SG1","Szron","awp"],["MAC-10","Sople","smg"],["XM1014","Lodowiec","shotgun"],
                ["CZ75-Auto","Mróz","pistol"]],
    restricted:[["SG 553","Zamarznięty","rifle"],["SCAR-20","Zawieja","awp"],["MAG-7","Sople","shotgun"]],
    classified:[["M4A1-S","Lodowiec","rifle"],["Glock-18","Szron","pistol"]],
    covert:    [["AWP","Lodowa Korona","awp"]],
    special:   [["Nóż Navaja","Lód","knife"],["Nóż Paracord","Mróz","knife"],["Nóż Bowie","Zamieć","knife"]]
  },
  dragon: {
    mil:       [["G3SG1","Żar","awp"],["UMP-45","Węgiel","smg"],["XM1014","Smoczy Pył","shotgun"],
                ["CZ75-Auto","Iskra","pistol"]],
    restricted:[["Galil AR","Smocza Łuska","rifle"],["MAC-10","Płomień","smg"],["MAG-7","Wulkan","shotgun"]],
    classified:[["M4A1-S","Smoczy Pazur","rifle"],["Glock-18","Złoty Smok","pistol"]],
    covert:    [["AWP","Złoty Smok","awp"]],
    special:   [["Nóż Ursus","Smok","knife"],["Nóż Huntsman","Lawa","knife"],["Nóż Klasyczny","Złoto","knife"]]
  },
  void: {
    mil:       [["G3SG1","Próżnia","awp"],["UMP-45","Kwark","smg"],["Sawed-Off","Antymateria","shotgun"],
                ["P2000","Ciemna Materia","pistol"]],
    restricted:[["SG 553","Kollapsar","rifle"],["SCAR-20","Horyzont","awp"],["MP7","Nicość","smg"]],
    classified:[["M4A1-S","Ciemna Mgławica","rifle"],["Glock-18","Pulsar","pistol"]],
    covert:    [["AWP","Osobliwość","awp"]],
    special:   [["Nóż Navaja","Kwazar","knife"],["Nóż Falchion","Nicość","knife"],["Nóż Nomad","Pustka","knife"]]
  },
  royal: {
    mil:       [["G3SG1","Porcelana","awp"],["XM1014","Alabaster","shotgun"],["Tec-9","Marmur","pistol"],
                ["MAC-10","Posąg","smg"]],
    restricted:[["SG 553","Złota Wstęga","rifle"],["MP7","Srebrny Dwór","smg"],["Nova","Królewska","shotgun"]],
    classified:[["M4A1-S","Złoty Dwór","rifle"],["Glock-18","Berło","pistol"],["Desert Eagle","Korona","pistol"]],
    covert:    [["M4A4","Złota Mozaika","rifle"],["AWP","Carska Wstęga","awp"]],
    special:   [["Nóż Ursus","Królewski","knife"],["Nóż Stiletto","Złoto","knife"],["Nóż Klasyczny","Monarcha","knife"],
                ["Nóż Huntsman","Cesarstwo","knife"]]
  }
};

CASES.forEach(c=>{
  const e = EXTRA_ITEMS[c.id]; if(!e) return;
  for (const t of TIERS) if (e[t]) c.items[t].push(...e[t]);
});

/* =======================================================================
   1a2. NOWE SKRZYNKI
   Każda ma własny motyw, kolory, pulę broni i noże. Ekonomia wyrównuje się
   sama (itemValue liczy wartość z ceny skrzynki i szans), więc nowe skrzynki
   mają dokładnie taki sam zwrot jak stare — różnią się zawartością.
   ======================================================================= */
const NEW_CASES = [
  { id:"sand", name:"Skrzynka Pustyni", price:300, color:"#b45309", icon:"🏜️",
    sub:"Gorący piasek, kurz i przetarte karabiny",
    odds:{mil:.780, restricted:.175, classified:.036, covert:.0076, special:.0014},
    items:{
      mil:       [["MP9","Pustynna Burza","smg"],["P250","Piaskowy Kamień","pistol"],["FAMAS","Kaktus","rifle"],
                  ["Galil AR","Miraż","rifle"],["Nova","Wydma","shotgun"],["R8 Revolver","Skorpion","revolver"],
                  ["Tec-9","Kurz","pistol"],["Sawed-Off","Wyschnięte","shotgun"]],
      restricted:[["AK-47","Pustynny Sztorm","rifle"],["AWP","Fata Morgana","awp"],["UMP-45","Karawana","smg"],
                  ["XM1014","Susz","shotgun"],["SSG 08","Oaza","awp"]],
      classified:[["Desert Eagle","Skarb Faraona","pistol"],["M4A4","Piaskowa Zbroja","rifle"],["P90","Sirocco","smg"],
                  ["MAG-7","Dune","shotgun"]],
      covert:    [["AWP","Pustynna Noc","awp"],["AK-47","Złoty Piasek","rifle"],["M4A1-S","Burza Piaskowa","rifle"]],
      special:   [["Nóż Klasyczny","Pustynny","knife"],["Nóż Gut","Piaskowiec","knife"],["Kukri","Beduin","knife"]] } },

  { id:"midnight", name:"Skrzynka Północy", price:1000, color:"#6366f1", icon:"🌙",
    sub:"Nocne łowy w zimnym świetle księżyca",
    odds:{mil:.752, restricted:.195, classified:.042, covert:.0093, special:.0017},
    items:{
      mil:       [["MP7","Nokturn","smg"],["P2000","Gwiezdny Pył","pistol"],["FAMAS","Cisza Nocy","rifle"],
                  ["Dual Berettas","Bliźniacze Gwiazdy","pistol"],["Nova","Sierp Księżyca","shotgun"],["SSG 08","Teleskop","awp"],
                  ["Galil AR","Cień Nocy","rifle"],["PP-Bizon","Sen","smg"]],
      restricted:[["M4A1-S","Północ","rifle"],["USP-S","Luna","pistol"],["MAC-10","Kometa","smg"],
                  ["AWP","Gwiazdozbiór","awp"],["SG 553","Obserwatorium","rifle"],["Negev","Noktowizja","lmg"]],
      classified:[["AK-47","Nocny Łowca","rifle"],["Desert Eagle","Zaćmienie","pistol"],["AWP","Droga Mleczna","awp"],
                  ["P90","Nokturn Nocy","smg"]],
      covert:    [["AWP","Czarny Księżyc","awp"],["AK-47","Gwiazda Północy","rifle"],["M4A4","Mgławica","rifle"]],
      special:   [["Nóż Motylkowy","Noc","knife"],["Karambit","Sierp","knife"],["Nóż Talon","Gwiezdny","knife"]] } },

  { id:"toxic", name:"Skrzynka Toksyczna", price:8000, color:"#84cc16", icon:"☣️",
    sub:"Kwas, radioaktywny szlam i zakazane eksperymenty",
    odds:{mil:.690, restricted:.225, classified:.058, covert:.021, special:.006},
    items:{
      mil:       [["MP9","Zielony Szlam","smg"],["P250","Toksyna","pistol"],["Galil AR","Skażenie","rifle"],
                  ["Nova","Kwas","shotgun"],["Tec-9","Mutagen","pistol"],["FAMAS","Laboratorium","rifle"],
                  ["MAC-10","Radioaktywny","smg"],["XM1014","Wyciek","shotgun"]],
      restricted:[["AK-47","Trucizna","rifle"],["AWP","Geiger","awp"],["M4A1-S","Zielony Rdzeń","rifle"],
                  ["USP-S","Antidotum","pistol"],["MP5-SD","Skażony","smg"],["M249","Reaktor","lmg"]],
      classified:[["AK-47","Radioaktywny Wyciek","rifle"],["Desert Eagle","Zielony Płomień","pistol"],["AWP","Toksyczny Deszcz","awp"],
                  ["P90","Kwasowy Szlam","smg"],["R8 Revolver","Izotop","revolver"]],
      covert:    [["AWP","Hiper Toksyna","awp"],["AK-47","Zielona Zaraza","rifle"],["M4A4","Kwasowa Chmura","rifle"],
                  ["Desert Eagle","Eksperyment","pistol"]],
      special:   [["Karambit","Toksyczny","knife"],["Nóż Falchion","Kwas","knife"],["Sztylet Cieni","Izotop","knife"],
                  ["Nóż Ursus","Szlam","knife"]] } },

  { id:"volcano", name:"Skrzynka Wulkanu", price:160000, color:"#ef4444", icon:"🌋",
    sub:"Zastygła lawa, bazalt i żar z głębi ziemi",
    odds:{mil:.600, restricted:.280, classified:.085, covert:.028, special:.007},
    items:{
      mil:       [["MP9","Bazalt","smg"],["P250","Popiół","pistol"],["Galil AR","Tuf","rifle"],
                  ["Nova","Pył Wulkaniczny","shotgun"],["FAMAS","Kaldera","rifle"],["Tec-9","Siarka","pistol"],
                  ["Sawed-Off","Krater","shotgun"],["Dual Berettas","Bomba","pistol"]],
      restricted:[["AK-47","Lawa","rifle"],["AWP","Magma","awp"],["M4A1-S","Bazaltowy","rifle"],
                  ["Desert Eagle","Obsydian","pistol"],["R8 Revolver","Erupcja","revolver"],["SCAR-20","Piroklast","awp"]],
      classified:[["AK-47","Płynna Skała","rifle"],["AWP","Serce Wulkanu","awp"],["M4A4","Zastygła Lawa","rifle"],
                  ["M249","Popiół Wulkanu","lmg"],["P90","Kaldera Ognia","smg"]],
      covert:    [["AK-47","Ognista Rzeka","rifle"],["AWP","Wulkaniczny","awp"],["M4A1-S","Obsydianowy","rifle"],
                  ["Desert Eagle","Żar Ziemi","pistol"]],
      special:   [["Karambit","Obsydian","knife"],["Nóż Motylkowy","Lawa","knife"],["Nóż Huntsman","Bazalt","knife"],
                  ["Kukri","Wulkan","knife"]] } },

  { id:"celestial", name:"Skrzynka Niebios", price:750000, color:"#e2e8f0", icon:"🕊️",
    sub:"Boski blask, skrzydła i światło z zaświatów",
    odds:{mil:.080, restricted:.560, classified:.270, covert:.075, special:.015},
    items:{
      mil:       [["P250","Halo","pistol"],["MP9","Chmurka","smg"],["Galil AR","Świt","rifle"],
                  ["Nova","Obłok","shotgun"],["FAMAS","Anioł Stróż","rifle"],["Tec-9","Świetlik","pistol"]],
      restricted:[["AK-47","Boskie Światło","rifle"],["AWP","Zorza","awp"],["M4A1-S","Srebrne Skrzydła","rifle"],
                  ["Desert Eagle","Archanioł","pistol"],["USP-S","Aureola","pistol"],["AUG","Serafin","rifle"],
                  ["SG 553","Chór","rifle"]],
      classified:[["AK-47","Niebiański Tron","rifle"],["AWP","Pióro Anioła","awp"],["M4A4","Boski Ornament","rifle"],
                  ["P90","Hymn","smg"],["R8 Revolver","Relikwia","revolver"]],
      covert:    [["AK-47","Anielski Blask","rifle"],["AWP","Niebiańska Brama","awp"],["M4A1-S","Święta Zbroja","rifle"],
                  ["Desert Eagle","Boski Wyrok","pistol"]],
      special:   [["Karambit","Niebiański","knife"],["Nóż Motylkowy","Anioł","knife"],["Nóż Talon","Święty","knife"],
                  ["Bayonet","Skrzydło","knife"]] } },

  { id:"abyss", name:"Skrzynka Otchłani", price:2000000, color:"#4338ca", icon:"🦑",
    sub:"Głębiny, Lewiatan i ciśnienie, które zgniata stal",
    odds:{mil:.010, restricted:.520, classified:.330, covert:.115, special:.025},
    items:{
      mil:       [["P250","Głębia","pistol"],["MP9","Plankton","smg"],["Galil AR","Osad","rifle"],
                  ["Nova","Koral","shotgun"],["Tec-9","Ciśnienie","pistol"]],
      restricted:[["AK-47","Wąż Morski","rifle"],["AWP","Lewiatan","awp"],["M4A1-S","Otchłań","rifle"],
                  ["Desert Eagle","Szczęka","pistol"],["USP-S","Latarnia","pistol"],["AUG","Bioptyka","rifle"],
                  ["Negev","Kraken","lmg"]],
      classified:[["AK-47","Głębinowa Groza","rifle"],["AWP","Abysalny","awp"],["M4A4","Hydra","rifle"],
                  ["P90","Meduza","smg"],["R8 Revolver","Rozgwiazda","revolver"],["MAG-7","Muszla","shotgun"]],
      covert:    [["AK-47","Serce Otchłani","rifle"],["AWP","Lewiatan Królewski","awp"],["M4A1-S","Czarna Głębia","rifle"],
                  ["Desert Eagle","Żarłacz","pistol"],["M4A4","Wiry","rifle"]],
      special:   [["Karambit","Otchłań","knife"],["Nóż Motylkowy","Meduza","knife"],["Sztylet Cieni","Abysalny","knife"],
                  ["Nóż Navaja","Wąż","knife"],["Kukri","Lewiatan","knife"]] } }
];

/* =======================================================================
   1a3. DRUGA PORCJA BRONI — wchodzi do WSZYSTKICH skrzynek (starych i nowych)
   Nazwy są unikalne w całej grze (klucz "broń|skin" jest kluczem albumu),
   a wartość liczy się z nazwy, więc zwrot ze skrzynki się nie zmienia.
   ======================================================================= */
const EXTRA_ITEMS_2 = {
  start: {
    mil:       [["MP7","Rekrut","smg"],["P2000","Instrukcja","pistol"],["XM1014","Magazynek","shotgun"],
                ["Tec-9","Trening","pistol"],["Galil AR","Musztra","rifle"]],
    restricted:[["AK-47","Pierwsza Krew","rifle"],["M4A4","Kurs Podstawowy","rifle"],["SSG 08","Zwiad Terenowy","awp"],
                ["Five-SeveN","Kaliber","pistol"]],
    classified:[["M4A1-S","Awans","rifle"],["Desert Eagle","Ostrzeżenie","pistol"],["P90","Mundur","smg"]],
    covert:    [["AWP","Weteran","awp"],["AK-47","Odznaczenie","rifle"]],
    special:   [["Nóż Klasyczny","Rekrut","knife"],["Nóż Gut","Polowy","knife"]]
  },
  sand: {
    mil:       [["MP7","Piach","smg"],["Dual Berettas","Karawana Morska","pistol"],["Galil AR","Sucha Wydma","rifle"],
                ["Nova","Oaza Skąpa","shotgun"],["Tec-9","Skarabeusz","pistol"]],
    restricted:[["AK-47","Karawana Piasku","rifle"],["AWP","Miraż Górący","awp"],["M4A1-S","Fasada Piaskowa","rifle"],
                ["SG 553","Noc Sirocco","rifle"]],
    classified:[["M4A4","Piaskowy Sfinks","rifle"],["Desert Eagle","Złoty Skarabeusz","pistol"],["AWP","Fata Piaskowa","awp"]],
    covert:    [["AK-47","Faraon","rifle"],["AWP","Pustynny Grzmot","awp"]],
    special:   [["Nóż Flip","Pustynny","knife"],["Karambit","Piaskowiec","knife"]]
  },
  urban: {
    mil:       [["MP9","Rusztowanie Miejskie","smg"],["P250","Kiosk Ruchu","pistol"],["FAMAS","Wielki Blok","rifle"],
                ["Nova","Śmietnik","shotgun"],["CZ75-Auto","Kamyk","pistol"]],
    restricted:[["AK-47","Osiedle Noc","rifle"],["AWP","Dachowiec Nocny","awp"],["M4A1-S","Kamienica","rifle"],
                ["Glock-18","Klatka Schodowa Noc","pistol"]],
    classified:[["M4A4","Blok Betonowy","rifle"],["USP-S","Przystanek","pistol"],["P90","Autostrada","smg"]],
    covert:    [["AWP","Metropolia Nocna","awp"],["AK-47","Szklany Wieżowiec","rifle"]],
    special:   [["Nóż Przeżycia","Miejski","knife"],["Nóż Paracord","Kamienica Miejska","knife"]]
  },
  prism: {
    mil:       [["MP7","Fiolet Widma","smg"],["P2000","Barwa","pistol"],["Galil AR","Rozszczepione Światło","rifle"],
                ["Nova","Szkło Kolorowe","shotgun"],["Tec-9","Pigment","pistol"]],
    restricted:[["AK-47","Dyfrakcja","rifle"],["AWP","Tęczowa Mgła","awp"],["M4A4","Refleks","rifle"],
                ["R8 Revolver","Barwnik","revolver"]],
    classified:[["M4A1-S","Holograficzny","rifle"],["Desert Eagle","Bursztyn","pistol"],["AWP","Rozszczepienie Barw","awp"]],
    covert:    [["AK-47","Pełne Spektrum","rifle"],["M4A4","Pryzmatyczna Mgła","rifle"]],
    special:   [["Nóż Gut","Barwny","knife"],["Nóż Skeleton","Refrakcja","knife"]]
  },
  spectral: {
    mil:       [["MP9","Seans Nocny","smg"],["P250","Medium Ciemne","pistol"],["Galil AR","Nawiedzony Dwór","rifle"],
                ["Nova","Zimna Mgła","shotgun"],["Dual Berettas","Ouija","pistol"]],
    restricted:[["AK-47","Nawiedzenie","rifle"],["AWP","Widmo Puszczy","awp"],["M4A1-S","Poltergeist Nocny","rifle"],
                ["MAC-10","Zjawa Mroczna","smg"]],
    classified:[["M4A4","Dwunasta Noc","rifle"],["Desert Eagle","Glitch Cienia","pistol"],["AWP","Gęsta Ektoplazma","awp"]],
    covert:    [["AK-47","Cmentarna Mgła","rifle"],["AWP","Duch Puszczy","awp"]],
    special:   [["Nóż Flip","Zjawa","knife"],["Nóż Bowie","Fantom Cienia","knife"]]
  },
  chroma: {
    mil:       [["MP7","Kwasowy Neon","smg"],["P250","Laserowy Róż","pistol"],["Galil AR","Chromowane Światło","rifle"],
                ["Nova","Ciemna Fuksja","shotgun"],["CZ75-Auto","Elektryczny Róż","pistol"]],
    restricted:[["AK-47","Kwas z Neona","rifle"],["AWP","Laserowa Wstęga","awp"],["M4A4","Różowy Chrom","rifle"],
                ["USP-S","Neonowy Metal","pistol"]],
    classified:[["M4A1-S","Neonowa Mgła","rifle"],["Desert Eagle","Kobaltowy Neon","pistol"],["P90","Kwas Elektryczny","smg"]],
    covert:    [["AK-47","Neonowy Kwas","rifle"],["AWP","Chromowany Pulsar","awp"]],
    special:   [["Nóż Huntsman","Kwasowy","knife"],["Nóż Paracord","Różowy Neon","knife"]]
  },
  frost: {
    mil:       [["MP7","Cicha Zamieć","smg"],["P2000","Cienki Szron","pistol"],["Galil AR","Śnieżny Stok","rifle"],
                ["Nova","Ostry Mróz","shotgun"],["Sawed-Off","Mała Zamieć","shotgun"]],
    restricted:[["AK-47","Lodowe Kolce","rifle"],["AWP","Zawieja Nocna","awp"],["M4A4","Zamarznięta Skała","rifle"],
                ["UMP-45","Sopel Lodu","smg"]],
    classified:[["M4A1-S","Ciemna Korona Lodu","rifle"],["Desert Eagle","Królewski Szron","pistol"],["AWP","Głęboki Lodowiec","awp"]],
    covert:    [["AK-47","Wieczna Zima","rifle"],["AWP","Absolutne Zero","awp"]],
    special:   [["Nóż Nomad","Szron Nocny","knife"],["Nóż Stiletto","Cienki Lód","knife"]]
  },
  dragon: {
    mil:       [["MP7","Cichy Żar","smg"],["P2000","Złoty Pyłek","pistol"],["Galil AR","Zwęglona Łuska","rifle"],
                ["Nova","Smocze Jajo","shotgun"],["Sawed-Off","Gorący Węgiel","shotgun"]],
    restricted:[["AK-47","Ciemna Łuska","rifle"],["AWP","Złoty Oddech","awp"],["M4A4","Skrzydło Smoka","rifle"],
                ["R8 Revolver","Ciemna Lawa","revolver"]],
    classified:[["M4A1-S","Ciemny Płomień","rifle"],["Desert Eagle","Ognisty Pazur","pistol"],["AWP","Legenda Smoka","awp"]],
    covert:    [["AK-47","Złoty Cesarz","rifle"],["AWP","Smocze Serce","awp"]],
    special:   [["Nóż Falchion","Smoczy","knife"],["Nóż Skeleton","Złota Łuska","knife"]]
  },
  void: {
    mil:       [["MP7","Ciemny Kwark","smg"],["P2000","Bezgwiezdna Próżnia","pistol"],["Galil AR","Mroczna Antymateria","rifle"],
                ["Nova","Czarna Mgła","shotgun"],["Dual Berettas","Czerwony Karzeł","pistol"]],
    restricted:[["AK-47","Wyrwa w Czasie","rifle"],["AWP","Zaćmienie Horyzontu","awp"],["M4A4","Rozpad Kollapsara","rifle"],
                ["SCAR-20","Grawitacja Ciemna","awp"]],
    classified:[["M4A1-S","Bezkres Nicości","rifle"],["Desert Eagle","Ciemna Osobliwość","pistol"],["AWP","Ciemna Supernowa","awp"]],
    covert:    [["AK-47","Mroczny Pulsar","rifle"],["AWP","Ciemna Energia","awp"]],
    special:   [["Nóż Ursus","Kwazar Nocny","knife"],["Kukri","Antymateria","knife"]]
  },
  volcano: {
    mil:       [["MP7","Żużel","smg"],["P2000","Siarka Ciemna","pistol"],["Galil AR","Ciemny Bazalt","rifle"],
                ["Nova","Gęsty Popiół","shotgun"],["Dual Berettas","Iskra Wulkanu","pistol"]],
    restricted:[["AK-47","Gęsta Lawa","rifle"],["AWP","Nocna Erupcja","awp"],["M4A4","Piroklast","rifle"],
                ["SG 553","Tuf Wulkaniczny","rifle"]],
    classified:[["M4A1-S","Ciemna Magma","rifle"],["Desert Eagle","Obsydianowy Rdzeń","pistol"],["AWP","Serce Krateru","awp"]],
    covert:    [["AK-47","Płynąca Lawa","rifle"],["AWP","Wulkaniczna Noc","awp"]],
    special:   [["Nóż Gut","Bazalt Nocny","knife"],["Nóż Talon","Kaldera","knife"]]
  },
  royal: {
    mil:       [["P2000","Porcelanowy","pistol"],["MP7","Alabastrowy","smg"],["Galil AR","Dworski","rifle"],
                ["Nova","Kryształ Górski","shotgun"],["Tec-9","Złoty Marmur","pistol"]],
    restricted:[["AK-47","Dwór Królewski","rifle"],["AWP","Złota Wstęga Króla","awp"],["M4A4","Srebrna Mozaika","rifle"],
                ["USP-S","Koronacja","pistol"]],
    classified:[["M4A1-S","Królewski Gobelin","rifle"],["Desert Eagle","Złote Berło","pistol"],["AWP","Tron Carów","awp"]],
    covert:    [["AK-47","Diamentowa Korona","rifle"],["AWP","Pan Królów","awp"]],
    special:   [["Nóż Motylkowy","Diamentowy","knife"],["Nóż Skeleton","Król","knife"]]
  },
  celestial: {
    mil:       [["MP7","Cienki Obłok","smg"],["P2000","Świetlik Niebios","pistol"],["Galil AR","Jutrzenka","rifle"],
                ["Nova","Puch Anioła","shotgun"],["Tec-9","Gwiazdka Poranna","pistol"]],
    restricted:[["AK-47","Chór Aniołów","rifle"],["AWP","Poranna Zorza","awp"],["M4A4","Srebrne Skrzydło","rifle"],
                ["USP-S","Złota Aureola","pistol"]],
    classified:[["M4A1-S","Niebiańska Zbroja","rifle"],["Desert Eagle","Sąd Ostateczny","pistol"],["AWP","Brama Niebios","awp"]],
    covert:    [["AK-47","Światło Stworzenia","rifle"],["AWP","Archanioł Michał","awp"]],
    special:   [["Nóż Falchion","Serafin","knife"],["Nóż Navaja","Halo","knife"]]
  },
  abyss: {
    mil:       [["MP7","Gęsty Plankton","smg"],["P2000","Koral Nocny","pistol"],["Galil AR","Ciemny Osad","rifle"],
                ["Nova","Muszla Głębinowa","shotgun"],["Tec-9","Ciśnienie Głębin","pistol"]],
    restricted:[["AK-47","Głębina","rifle"],["AWP","Ciemny Kraken","awp"],["M4A4","Latarnia Morska","rifle"],
                ["SG 553","Bioptyka Głębin","rifle"]],
    classified:[["M4A1-S","Głębinowa Hydra","rifle"],["Desert Eagle","Szczęka Rekina","pistol"],["AWP","Abysalna Noc","awp"]],
    covert:    [["AK-47","Absolutna Otchłań","rifle"],["AWP","Lewiatan Cesarz","awp"]],
    special:   [["Nóż Bowie","Głębia","knife"],["Nóż Nomad","Meduza Głębin","knife"]]
  },
  midnight: {
    mil:       [["MP9","Gwiezdny Pyłek","smg"],["P2000","Ciemna Luna","pistol"],["Galil AR","Cichy Nokturn","rifle"],
                ["Nova","Wschodzący Księżyc","shotgun"],["Tec-9","Astronomia","pistol"]],
    restricted:[["AK-47","Noc Polarna","rifle"],["AWP","Konstelacja","awp"],["M4A4","Nocny Teleskop","rifle"],
                ["USP-S","Świt Nocy","pistol"]],
    classified:[["M4A1-S","Czarna Noc","rifle"],["Desert Eagle","Krwawe Zaćmienie","pistol"],["AWP","Droga Gwiazd","awp"]],
    covert:    [["AK-47","Nocny Cesarz","rifle"],["AWP","Nocna Dziura","awp"]],
    special:   [["Nóż Gut","Księżyc","knife"],["Nóż Ursus","Nokturn","knife"]]
  },
  toxic: {
    mil:       [["MP7","Gęsty Zielony Szlam","smg"],["P2000","Cienki Izotop","pistol"],["Galil AR","Ciemny Mutagen","rifle"],
                ["Nova","Zielony Wyciek","shotgun"],["Dual Berettas","Antidotum","pistol"]],
    restricted:[["AK-47","Kwasowy Szlam","rifle"],["AWP","Promieniowanie","awp"],["M4A4","Zielony Reaktor","rifle"],
                ["SSG 08","Ciemny Geiger","awp"]],
    classified:[["M4A1-S","Toksyczna Mgła","rifle"],["Desert Eagle","Kwasowy Rdzeń","pistol"],["AWP","Ciemna Zaraza","awp"]],
    covert:    [["AK-47","Radioaktywna Noc","rifle"],["AWP","Hiper Kwas","awp"]],
    special:   [["Nóż Klasyczny","Toksyczny Nocny","knife"],["Nóż Stiletto","Szlam Kwasowy","knife"]]
  },
  /* dopięcie pul nowych skrzynek (1a4), żeby miały równie dużo dropów w
     najczęstszych tierach, co starsze skrzynki */
  neon: {
    mil:       [["MP7","Kolorowy Dym","smg"],["Galil AR","Dyskoteka","rifle"],["Nova","Glow Stick","shotgun"],
                ["Dual Berettas","Błyszczące","pistol"]],
    restricted:[["AK-47","Rave","rifle"],["M4A4","Świecący Parkiet","rifle"]]
  },
  storm: {
    mil:       [["MP9","Błyskawica","smg"],["FAMAS","Wichura","rifle"],["XM1014","Rozpogodzenie","shotgun"],
                ["CZ75-Auto","Kropla","pistol"]],
    restricted:[["AK-47","Nawałnica","rifle"],["M4A4","Burzowe Niebo","rifle"]]
  },
  relic: {
    mil:       [["MP7","Stare Wykopalisko","smg"],["Galil AR","Zwoje","rifle"],["Nova","Skorupa","shotgun"],
                ["Tec-9","Mozaika Starożytna","pistol"]],
    restricted:[["AK-47","Artefakt","rifle"],["M4A4","Posąg Boga","rifle"]]
  },
  samurai: {
    mil:       [["MP7","Herb Rodu","smg"],["Galil AR","Wojenna Flaga","rifle"],["Nova","Sakura","shotgun"],
                ["CZ75-Auto","Tusz","pistol"]],
    restricted:[["AK-47","Pieczęć","rifle"],["M4A4","Zbroja Daimyo","rifle"]]
  },
  cyber: {
    mil:       [["MP7","Obwód","smg"],["Galil AR","Drukarka 3D","rifle"],["Nova","Kamera","shotgun"],
                ["Dual Berettas","Bity","pistol"]],
    restricted:[["AK-47","Skan Biometryczny","rifle"],["M4A4","Hologram Wojskowy","rifle"]]
  },
  hunter: {
    mil:       [["MP7","Mchy","smg"],["Galil AR","Żołądź","rifle"],["Nova","Sarna","shotgun"],
                ["Tec-9","Dzik","pistol"]],
    restricted:[["AK-47","Ostroga","rifle"],["M4A4","Knieja","rifle"]]
  },
  witch: {
    mil:       [["MP7","Kadzidło","smg"],["Galil AR","Fioletowy Wywar","rifle"],["Nova","Nietoperz","shotgun"],
                ["Dual Berettas","Świeca","pistol"]],
    restricted:[["AK-47","Zaklęcie","rifle"],["M4A4","Księga Zaklęć","rifle"]]
  },
  phoenix: {
    mil:       [["MP7","Pióra","smg"],["Galil AR","Węgiel Drzewny","rifle"],["Nova","Ogniste Jajo","shotgun"],
                ["Tec-9","Znicz","pistol"]],
    restricted:[["AK-47","Ptasi Pazur","rifle"],["M4A4","Ognista Burza","rifle"]]
  }
};

/* =======================================================================
   1a4. TRZECIA FALA SKRZYNEK — 8 nowych, od 200 do 1 250 000 🪙
   Ceny wypełniają luki między istniejącymi skrzynkami, a każda ma własny
   motyw, kolor i pulę broni. Zwrot liczy się sam z ceny (itemValue).
   ======================================================================= */
const NEW_CASES_2 = [
  { id:"neon", name:"Skrzynka Neonowa", price:200, color:"#4ade80", icon:"🪩",
    sub:"Klub, lasery i świecące krawędzie",
    odds:{mil:.800, restricted:.160, classified:.030, covert:.0075, special:.0025},
    items:{
      mil:       [["MP9","Neonowy Pył","smg"],["P250","Fluorescencja","pistol"],["Galil AR","Lasery","rifle"],
                  ["Nova","Świecąca Rura","shotgun"],["Tec-9","Parkiet","pistol"],["MAC-10","Stroboskop","smg"]],
      restricted:[["AK-47","Neon Klub","rifle"],["AWP","Laser Show","awp"],["M4A1-S","Fioletowy Neon","rifle"],
                  ["USP-S","Koktajl","pistol"],["MP5-SD","Ultrafiolet","smg"]],
      classified:[["AK-47","Świecąca Krawędź","rifle"],["Desert Eagle","Neonowy Szyld","pistol"],
                  ["P90","Klubowe Lasery","smg"],["M4A4","Fluor","rifle"]],
      covert:    [["AWP","Neonowa Noc","awp"],["AK-47","Elektryczny Neon","rifle"],["M4A1-S","Świetlna Rura","rifle"]],
      special:   [["Nóż Flip","Neonowy","knife"],["Nóż Gut","Fluorescencyjny","knife"],["Karambit","Klubowy","knife"]] } },

  { id:"storm", name:"Skrzynka Burzy", price:450, color:"#64748b", icon:"⛈️",
    sub:"Pioruny, chmury i elektryczne wyładowania",
    odds:{mil:.780, restricted:.175, classified:.035, covert:.008, special:.002},
    items:{
      mil:       [["MP7","Elektryczność","smg"],["P2000","Kropla Deszczu","pistol"],["FAMAS","Front Atmosferyczny","rifle"],
                  ["Nova","Grad","shotgun"],["SSG 08","Wiatr","awp"],["PP-Bizon","Chmura Burzowa","smg"]],
      restricted:[["M4A1-S","Wyładowanie","rifle"],["USP-S","Monsun","pistol"],["AWP","Piorun Kulisty","awp"],
                  ["SG 553","Turbulencja","rifle"],["MAC-10","Sztorm","smg"]],
      classified:[["AK-47","Burza","rifle"],["Desert Eagle","Grom","pistol"],["AWP","Czarna Chmura","awp"],
                  ["P90","Cyklon","smg"]],
      covert:    [["AWP","Oko Cyklonu","awp"],["AK-47","Piorunowy","rifle"],["M4A4","Sztormowa Fala","rifle"]],
      special:   [["Nóż Huntsman","Piorun","knife"],["Nóż Bowie","Sztorm","knife"],["Kukri","Grom Wichru","knife"]] } },

  { id:"relic", name:"Skrzynka Relikwii", price:900, color:"#c2410c", icon:"🏺",
    sub:"Starożytne skarby i zapomniani bogowie",
    odds:{mil:.770, restricted:.180, classified:.038, covert:.0092, special:.0028},
    items:{
      mil:       [["MP9","Hieroglif","smg"],["P250","Papirus","pistol"],["Galil AR","Glina","rifle"],
                  ["Nova","Amfora","shotgun"],["CZ75-Auto","Moneta","pistol"],["XM1014","Pył Wykopalisk","shotgun"]],
      restricted:[["AK-47","Sarkofag","rifle"],["AWP","Obelisk","awp"],["M4A1-S","Marmur Zeusa","rifle"],
                  ["R8 Revolver","Skarbiec","revolver"],["Negev","Kolos","lmg"]],
      classified:[["AK-47","Klątwa Faraona","rifle"],["AWP","Złota Maska","awp"],["P90","Labirynt","smg"],
                  ["M4A4","Ruiny","rifle"]],
      covert:    [["AWP","Oko Horusa","awp"],["AK-47","Gniew Bogów","rifle"],["M4A1-S","Zaginiona Cywilizacja","rifle"]],
      special:   [["Karambit","Relikwia","knife"],["Nóż Talon","Faraon","knife"],["Nóż Przeżycia","Wykopalisko","knife"]] } },

  { id:"samurai", name:"Skrzynka Samuraja", price:2000, color:"#7f1d1d", icon:"🎎",
    sub:"Katany, jedwab i droga wojownika",
    odds:{mil:.760, restricted:.185, classified:.040, covert:.011, special:.004},
    items:{
      mil:       [["MP9","Jedwab","smg"],["P250","Lakier","pistol"],["Galil AR","Bambus","rifle"],
                  ["Nova","Ryżowe Pole","shotgun"],["Tec-9","Origami","pistol"],["Dual Berettas","Wachlarz","pistol"]],
      restricted:[["AK-47","Katana","rifle"],["AWP","Długi Łuk","awp"],["M4A1-S","Zbroja Ronina","rifle"],
                  ["USP-S","Herbata","pistol"],["FAMAS","Shogun","rifle"]],
      classified:[["AK-47","Droga Wojownika","rifle"],["Desert Eagle","Tsuba","pistol"],["AWP","Góra Fudżi","awp"],
                  ["P90","Kirigami","smg"]],
      covert:    [["AWP","Oddech Smoka Wschodu","awp"],["AK-47","Honor Samuraja","rifle"],["M4A4","Cesarska Zbroja","rifle"]],
      special:   [["Karambit","Samuraj","knife"],["Nóż Motylkowy","Jedwabny","knife"],["Nóż Skeleton","Ronin","knife"]] } },

  { id:"cyber", name:"Skrzynka Cyber", price:5000, color:"#22d3ee", icon:"🧬",
    sub:"Implanty, sieci neuronowe i zimna stal",
    odds:{mil:.700, restricted:.220, classified:.056, covert:.018, special:.006},
    items:{
      mil:       [["MP9","Implant","smg"],["P250","Serwomotor","pistol"],["FAMAS","Krzem","rifle"],
                  ["Nova","Dioda","shotgun"],["Tec-9","Nanorurka","pistol"],["MAC-10","Skaner","smg"]],
      restricted:[["AK-47","Neuron","rifle"],["AWP","Predykcja","awp"],["M4A1-S","Cyberoko","rifle"],
                  ["USP-S","Kod Źródłowy","pistol"],["MP5-SD","Serwerownia","smg"],["M249","Egzoszkielet","lmg"]],
      classified:[["AK-47","Sztuczna Inteligencja","rifle"],["Desert Eagle","Hologram Taktyczny","pistol"],
                  ["AWP","Sieć Neuronowa","awp"],["P90","Firewall","smg"]],
      covert:    [["AWP","Rdzeń Procesora","awp"],["AK-47","Nadpisany Kod","rifle"],["M4A4","Chłodzenie Cieczą","rifle"]],
      special:   [["Nóż Paracord","Cybernetyczny","knife"],["Nóż Nomad","Implant Nocny","knife"],["Sztylet Cieni","Nano","knife"]] } },

  { id:"hunter", name:"Skrzynka Łowcy", price:16000, color:"#65a30d", icon:"🐺",
    sub:"Trop, instynkt i las pełen oczu",
    odds:{mil:.660, restricted:.240, classified:.070, covert:.022, special:.008},
    items:{
      mil:       [["MP9","Wilczy Trop","smg"],["P250","Porost","pistol"],["Galil AR","Kora","rifle"],
                  ["Nova","Ściółka","shotgun"],["SSG 08","Gałąź","awp"],["Sawed-Off","Mech","shotgun"]],
      restricted:[["AK-47","Wilcze Oczy","rifle"],["AWP","Zasadzka","awp"],["M4A1-S","Leśny Instynkt","rifle"],
                  ["Desert Eagle","Kieł","pistol"],["UMP-45","Trop Nocny","smg"],["XM1014","Sidła","shotgun"]],
      classified:[["AK-47","Alfa","rifle"],["AWP","Nocne Łowy","awp"],["M4A4","Gęstwina","rifle"],
                  ["R8 Revolver","Wilcza Jagoda","revolver"]],
      covert:    [["AWP","Wataha","awp"],["AK-47","Biały Wilk","rifle"],["M4A1-S","Drapieżnik","rifle"]],
      special:   [["Nóż Ursus","Łowca","knife"],["Nóż Nomad","Wilk","knife"],["Kukri","Pazur Bestii","knife"]] } },

  { id:"witch", name:"Skrzynka Wiedźmy", price:120000, color:"#d946ef", icon:"🔮",
    sub:"Klątwy, eliksiry i fioletowy dym",
    odds:{mil:.600, restricted:.270, classified:.090, covert:.032, special:.008},
    items:{
      mil:       [["MP9","Mgła Rytuału","smg"],["P250","Zioła","pistol"],["Galil AR","Kocioł","rifle"],
                  ["Nova","Kruczy Piasek","shotgun"],["CZ75-Auto","Amulet","pistol"],["XM1014","Kości Rzutu","shotgun"]],
      restricted:[["AK-47","Klątwa","rifle"],["AWP","Kruk","awp"],["M4A1-S","Sabat","rifle"],
                  ["USP-S","Eliksir","pistol"],["MP7","Laleczka","smg"],["Negev","Wrzący Kocioł","lmg"]],
      classified:[["AK-47","Czarna Msza","rifle"],["Desert Eagle","Księga Cieni","pistol"],["AWP","Wiedźmi Krąg","awp"],
                  ["P90","Fioletowy Dym","smg"],["R8 Revolver","Rytuał Krwi","revolver"]],
      covert:    [["AWP","Wiedźma","awp"],["AK-47","Klątwa Wieków","rifle"],["M4A4","Noc Sabatu","rifle"],
                  ["Desert Eagle","Ametystowe Oko","pistol"]],
      special:   [["Karambit","Wiedźmi","knife"],["Nóż Falchion","Klątwa Nocna","knife"],["Nóż Navaja","Rytuał","knife"],
                  ["Sztylet Cieni","Cień Wiedźmy","knife"]] } },

  { id:"phoenix", name:"Skrzynka Feniksa", price:1250000, color:"#f97316", icon:"🦅",
    sub:"Ognisty ptak, wieczny powrót i popiół w garści",
    odds:{mil:.020, restricted:.500, classified:.320, covert:.130, special:.030},
    items:{
      mil:       [["P250","Popiół Feniksa","pistol"],["MP9","Żar Feniksa","smg"],["Galil AR","Spopielony","rifle"],
                  ["Nova","Gniazdo Ognia","shotgun"],["Tec-9","Iskra Feniksa","pistol"]],
      restricted:[["AK-47","Skrzydło Ognia","rifle"],["AWP","Słoneczny Ptak","awp"],["M4A1-S","Wieczny Powrót","rifle"],
                  ["Desert Eagle","Pióro Feniksa","pistol"],["USP-S","Węgle","pistol"],["AUG","Wschód Słońca","rifle"],
                  ["Negev","Płonące Gniazdo","lmg"]],
      classified:[["AK-47","Feniks","rifle"],["AWP","Ognisty Powrót","awp"],["M4A4","Popiół i Płomień","rifle"],
                  ["P90","Solare","smg"],["R8 Revolver","Samospalenie","revolver"]],
      covert:    [["AK-47","Serce Feniksa","rifle"],["AWP","Nieśmiertelny Ptak","awp"],["M4A1-S","Zmartwychwstanie","rifle"],
                  ["Desert Eagle","Wieczny Żar","pistol"]],
      special:   [["Karambit","Feniks","knife"],["Nóż Motylkowy","Ogniste Pióro","knife"],["Nóż Talon","Popiół Ognia","knife"],
                  ["Bayonet","Zmartwychwstanie Ptaka","knife"]] } }
];

const NEW_CASES_3 = [
  { id:"star", name:"Skrzynka Gwiazd", price:2500000, color:"#fde047", icon:"🌟",
    sub:"Błysk supernowych, pył gwiazdowy i ostrza z nieba",
    odds:{mil:.050, restricted:.550, classified:.280, covert:.095, special:.025},
    items:{
      mil:       [["MP9","Pył Gwiazdowy","smg"],["P250","Supernowa","pistol"],["Galil AR","Jutrzenka","rifle"],
                  ["Nova","Kometa","shotgun"],["Tec-9","Meteor","pistol"]],
      restricted:[["AK-47","Gwiazda Północy","rifle"],["AWP","Zorza Polarna","awp"],["M4A1-S","Srebrny Pył","rifle"],
                  ["Desert Eagle","Archanioł","pistol"],["USP-S","Aureola","pistol"],["AUG","Serafin","rifle"],
                  ["Negev","Chór Niebios","lmg"]],
      classified:[["AK-47","Tron Niebios","rifle"],["AWP","Pióro Anioła","awp"],["M4A4","Boski Ornament","rifle"],
                  ["P90","Hymn Kosmiczny","smg"],["R8 Revolver","Relikwia Gwiazd","revolver"]],
      covert:    [["AK-47","Anielski Blask","rifle"],["AWP","Niebiańska Brama","awp"],["M4A1-S","Święta Zbroja","rifle"],
                  ["Desert Eagle","Boski Wyrok","pistol"]],
      special:   [["Karambit","Niebiański","knife"],["Nóż Motylkowy","Anioł","knife"],["Nóż Talon","Święty","knife"],
                  ["Bayonet","Skrzydło","knife"],["Nóż Skeleton","Gwiazda","knife"]] } },

  { id:"power", name:"Skrzynka Mocy", price:5000000, color:"#a855f7", icon:"⚡",
    sub:"Czysta energia, przepięcia i ostrza naładowane prądem",
    odds:{mil:.030, restricted:.500, classified:.320, covert:.120, special:.030},
    items:{
      mil:       [["MP9","Prąd","smg"],["P250","Iskra","pistol"],["Galil AR","Napięcie","rifle"],
                  ["Nova","Wyładowanie","shotgun"],["Tec-9","Kondensator","pistol"]],
      restricted:[["AK-47","Burza Energii","rifle"],["AWP","Piorun Kulisty","awp"],["M4A1-S","Cyberoko","rifle"],
                  ["Desert Eagle","Grom","pistol"],["USP-S","Monsun","pistol"],["AUG","Wschód Słońca","rifle"],
                  ["M249","Egzoszkielet","lmg"],["SG 553","Turbulencja","rifle"]],
      classified:[["AK-47","Sztuczna Inteligencja","rifle"],["AWP","Sieć Neuronowa","awp"],["M4A4","Chłodzenie Cieczą","rifle"],
                  ["P90","Firewall","smg"],["R8 Revolver","Supernowa","revolver"]],
      covert:    [["AWP","Rdzeń Procesora","awp"],["AK-47","Nadpisany Kod","rifle"],["M4A1-S","Zmartwychwstanie","rifle"],
                  ["Desert Eagle","Wieczny Żar","pistol"]],
      special:   [["Karambit","Cybernetyczny","knife"],["Nóż Motylkowy","Implant Nocny","knife"],["Nóż Talon","Nano","knife"],
                  ["Bayonet","Piorun","knife"],["Sztylet Cieni","Nano","knife"]] } },




  { id:"apoc", name:"Skrzynka Apokalipsy", price:20000000, color:"#7f1d1d", icon:"💀",
    sub:"Koniec świata, popiół i ostrza z otchłani",
    odds:{mil:.005, restricted:.400, classified:.380, covert:.165, special:.050},
    items:{
      mil:       [["P250","Popiół Końca","pistol"],["MP9","Zgliszcza","smg"],["Galil AR","Zniszczenie","rifle"]],
      restricted:[["AK-47","Zgliszcza Świata","rifle"],["AWP","Koniec Czasu","awp"],["M4A1-S","Apokalipsa","rifle"],
                  ["Desert Eagle","Sąd Ostateczny","pistol"],["USP-S","Zmierzch","pistol"],["AUG","Zniszczenie","rifle"],
                  ["Negev","Popiół Ziemi","lmg"],["SCAR-20","Żar Końca","awp"]],
      classified:[["AK-47","Koniec Świata","rifle"],["AWP","Otchłań Końca","awp"],["M4A4","Zniszczenie Duszy","rifle"],
                  ["P90","Apokalipsa Nocy","smg"],["R8 Revolver","Sąd Ostateczny","revolver"],
                  ["MAG-7","Popiół Ziemi","shotgun"]],
      covert:    [["AK-47","Serce Apokalipsy","rifle"],["AWP","Lewiatan Końca","awp"],["M4A1-S","Czarna Głębia Końca","rifle"],
                  ["Desert Eagle","Żarłacz Końca","pistol"],["M4A4","Wiry Końca","rifle"]],
      special:   [["Karambit","Apokalipsa","knife"],["Nóż Motylkowy","Koniec Świata","knife"],["Sztylet Cieni","Otchłań","knife"],
                  ["Nóż Navaja","Zniszczenie","knife"],["Kukri","Koniec Czasu","knife"],["Nóż Bowie","Popiół","knife"]] } },

  { id:"secret10", name:"Skrzynka Sekretna", price:10000000, color:"#1e293b", icon:"🔐", secret:true,
    sub:"Zamknięta na siedem kłódek. W środku tylko to, czego nikt nie powinien mieć.",
    odds:{mil:.001, restricted:.350, classified:.400, covert:.199, special:.050},
    items:{
      mil:       [["P250","Ostatni Oddech","pistol"],["MP9","Szept Echa","smg"],["Galil AR","Zamek Cieni","rifle"],
                  ["Nova","Kopuła","shotgun"],["Tec-9","Lekki Jak Cień","pistol"]],
      restricted:[["AK-47","Złota Harmonia Legendy","rifle"],["AWP","Królewska Wstęga Legendy","awp"],
                  ["M4A1-S","Srebrny Dwór Legendy","rifle"],["Desert Eagle","Monarcha Legendy","pistol"],
                  ["USP-S","Berło Legendy","pistol"],["AUG","Korona Legendy","rifle"],
                  ["Negev","Królewski Dwór","lmg"],["SCAR-20","Żar Legendy","awp"],
                  ["M4A4","Zbroja Cienia","rifle"],["MP7","Strażnik","smg"]],
      classified:[["AK-47","Tron Legendy","rifle"],["AWP","Berło Carów Legendy","awp"],["M4A4","Carska Mozaika Legendy","rifle"],
                  ["P90","Diadem Legendy","smg"],["R8 Revolver","Regalia Legendy","revolver"],
                  ["MAG-7","Złota Mozaika","shotgun"],["Desert Eagle","Kodeks","pistol"],
                  ["FAMAS","Opatrzność","rifle"],["Glock-18","Pieczęć","pistol"]],
      covert:    [["AK-47","Królewski Rubin Legendy","rifle"],["AWP","Cesarska Korona Legendy","awp"],
                  ["M4A1-S","Złoty Ornament Legendy","rifle"],["Desert Eagle","Cesarstwo Legendy","pistol"],
                  ["M4A4","Diamentowa Korona","rifle"],["AWP","Pan Królów Legendy","awp"],
                  ["AK-47","Szarlatan","rifle"],["M4A1-S","Sarkofag","rifle"]],
      special:   [["Karambit","Królewski Legendarny","knife"],["Nóż Motylkowy","Tron Legendy","knife"],
                  ["Nóż Talon","Cesarstwo Legendy","knife"],["Bayonet","Monarcha Legendy","knife"],
                  ["Nóż Skeleton","Król Legendy","knife"],["Nóż Gut","Legendarny","knife"],
                  ["Nóż Flip","Diamentowy Legendarny","knife"],["Kukri","Korona","knife"],
                  ["Sztylet Cieni","Berło","knife"],["Nóż Huntsman","Regalia","knife"],
                  ["Nóż Falchion","Tron","knife"],["Nóż Ursus","Srebro","knife"]] } },

  { id:"secret50", name:"Skrzynka Legendarna", price:50000000, color:"#fbbf24", icon:"👑", secret:true,
    sub:"Szczyt. Tylko dla tych, którzy nie mają już czego szukać. Najrzadsze ostrza na świecie.",
    odds:{mil:.001, restricted:.350, classified:.400, covert:.199, special:.050},
    items:{
      mil:       [["P250","Ostatni Oddech","pistol"],["MP9","Echa Tronu","smg"],["Galil AR","Kolumna","rifle"],
                  ["Nova","Korona Popiołów","shotgun"],["Tec-9","Złoty Pył","pistol"],["MAC-10","Siedem","smg"]],
      restricted:[["AK-47","Złota Harmonia Legendy","rifle"],["AWP","Królewska Wstęga Legendy","awp"],
                  ["M4A1-S","Srebrny Dwór Legendy","rifle"],["Desert Eagle","Monarcha Legendy","pistol"],
                  ["USP-S","Berło Legendy","pistol"],["AUG","Korona Legendy","rifle"],
                  ["Negev","Królewski Dwór","lmg"],["SCAR-20","Żar Legendy","awp"],
                  ["M4A4","Cesarski Ornament","rifle"],["MP7","Słoneczny","smg"],["SG 553","Ołtarz","rifle"]],
      classified:[["AK-47","Tron Legendy","rifle"],["AWP","Berło Carów Legendy","awp"],["M4A4","Carska Mozaika Legendy","rifle"],
                  ["P90","Diadem Legendy","smg"],["R8 Revolver","Regalia Legendy","revolver"],
                  ["MAG-7","Złota Mozaika","shotgun"],["Desert Eagle","Złoty Kodeks","pistol"],
                  ["FAMAS","Zwycięstwo","rifle"],["Glock-18","Królewska Pieczęć","pistol"],
                  ["M249","Serafin","lmg"],["SSG 08","Zorza","awp"]],
      covert:    [["AK-47","Królewski Rubin Legendy","rifle"],["AWP","Cesarska Korona Legendy","awp"],
                  ["M4A1-S","Złoty Ornament Legendy","rifle"],["Desert Eagle","Cesarstwo Legendy","pistol"],
                  ["M4A4","Diamentowa Korona","rifle"],["AWP","Pan Królów Legendy","awp"],
                  ["AK-47","Złoty Władca","rifle"],["M4A1-S","Srebro","rifle"]],
      special:   [["Karambit","Królewski Legendarny","knife"],["Nóż Motylkowy","Tron Legendy","knife"],
                  ["Nóż Talon","Cesarstwo Legendy","knife"],["Bayonet","Monarcha Legendy","knife"],
                  ["Nóż Skeleton","Król Legendy","knife"],["Nóż Gut","Legendarny","knife"],
                  ["Nóż Flip","Diamentowy Legendarny","knife"],["Kukri","Siewca","knife"],
                  ["Sztylet Cieni","Złoto","knife"],["Nóż Huntsman","Szlachetny","knife"],
                  ["Nóż Falchion","Cesarski","knife"],["Nóż Ursus","Korona","knife"],
                  ["Nóż Navaja","Legendarny","knife"],["Nóż Paracord","Królewski","knife"],
                  ["Nóż Klasyczny","Berło","knife"],["Nóż Bowie","Ornament","knife"]] } }
];

CASES.push(...NEW_CASES, ...NEW_CASES_2, ...NEW_CASES_3);
CASES.sort((a,b)=>a.price - b.price);

/* druga porcja broni wchodzi do wszystkich skrzynek — także tych nowych */
CASES.forEach(c=>{
  const e = EXTRA_ITEMS_2[c.id]; if(!e) return;
  for (const t of TIERS) if (e[t]) c.items[t].push(...e[t]);
});

/* =======================================================================
   1a5. CZTERY SKRZYNKI TYLKO DLA BAZARU BOTÓW 🕶️🎲🌾🏷️
   Oznaczone botOnly:true — renderShop ich nie pokazuje, można je zdobyć
   wyłącznie kupując od bota. Po otwarciu znikają z zapasu i nie da się
   ich wznawiać za monety — kolejną trzeba kupić u bota.
   ======================================================================= */
const BOT_CASES = [
  { id:"smuggler", name:"Skrzynka Przemytnika", price:7500, color:"#10b981", icon:"🕶️", botOnly:true,
    sub:"Oficjalnie nie istnieje. A jednak ktoś ją sprzedaje.",
    odds:{mil:.700, restricted:.226, classified:.052, covert:.018, special:.004},
    items:{
      mil:       [["MP9","Szmugiel","smg"],["P250","Fałszywy Nominał","pistol"],["Galil AR","Kontrabanda","rifle"],
                  ["Nova","Skrytka","shotgun"],["Tec-9","Podsłuch","pistol"],["MAC-10","Kurier Nocny","smg"],
                  ["Dual Berettas","Podwójna Gra","pistol"],["Sawed-Off","Luka w Prawie","shotgun"]],
      restricted:[["AK-47","Czarny Rynek","rifle"],["AWP","Przemyt","awp"],["M4A1-S","Fikcyjna Faktura","rifle"],
                  ["USP-S","Cichy Wspólnik","pistol"],["SG 553","Granica","rifle"],["MP7","Kanał","smg"]],
      classified:[["AK-47","Przemytnik","rifle"],["Desert Eagle","Łapówka","pistol"],["AWP","Nocna Dostawa","awp"],
                  ["P90","Kontener","smg"],["R8 Revolver","Kod Cła","revolver"]],
      covert:    [["AWP","Czarna Dostawa","awp"],["AK-47","Król Przemytu","rifle"],["M4A4","Nielegalny Ładunek","rifle"],
                  ["Desert Eagle","Cena Milczenia","pistol"]],
      special:   [["Karambit","Przemytnik","knife"],["Nóż Motylkowy","Kontrabanda","knife"],["Nóż Talon","Czarny Rynek","knife"],
                  ["Nóż Gut","Szmugler","knife"]] } },

  { id:"gambler", name:"Skrzynka Hazardzisty", price:900000, color:"#e11d48", icon:"🎲", botOnly:true,
    sub:"Jedno rozdanie decyduje o wszystkim. Stawka? Twoja kolekcja.",
    odds:{mil:.120, restricted:.540, classified:.250, covert:.070, special:.020},
    items:{
      mil:       [["MP9","Kostka","smg"],["P250","Żeton","pistol"],["Galil AR","Ruletka","rifle"],
                  ["Nova","Zakład","shotgun"],["Tec-9","Szuler","pistol"],["MAC-10","Talia Kart","smg"]],
      restricted:[["AK-47","Podwójne Zero","rifle"],["AWP","All-In","awp"],["M4A1-S","Krupier","rifle"],
                  ["Desert Eagle","Jednoreki Bandyta","pistol"],["USP-S","Ostatni Żeton","pistol"],
                  ["AUG","Wielka Wygrana","rifle"],["Negev","Jackpot","lmg"]],
      classified:[["AK-47","Rosyjska Ruletka","rifle"],["AWP","Złoty Żeton","awp"],["M4A4","Kasyno","rifle"],
                  ["P90","Fortuna","smg"],["R8 Revolver","Bank","revolver"],["MAG-7","Slepa Ulica","shotgun"]],
      covert:    [["AK-47","Król Kasyna","rifle"],["AWP","Wielki Szuler","awp"],["M4A1-S","Ostatni Zakład","rifle"],
                  ["Desert Eagle","Fortuna Kołem","pistol"]],
      special:   [["Karambit","Hazard","knife"],["Nóż Motylkowy","Ruletka","knife"],["Nóż Skeleton","Jackpot","knife"],
                  ["Bayonet","Fortuna","knife"],["Nóż Flip","Zakład","knife"]] } },

  /* ✦ Nowe skrzynki wyłącznie z bazaru botów — z bardzo rzadkimi reliktami.
     Po otwarciu znikają z zapasu; nie można ich wznawiać za monety. */
  { id:"reaper", name:"Skrzynka Żniwiarza", price:2500000, color:"#b91c1c", icon:"🌾", botOnly:true,
    sub:"Ostatnie żniwo. Kosy, widma i relikty, których nie kupisz nigdzie indziej.",
    odds:{mil:.550, restricted:.280, classified:.110, covert:.050, special:.009, relic:.001},
    items:{
      mil:       [["MP9","Kościany Pył","smg"],["P250","Grzechotnik","pistol"],["Galil AR","Cmentarna Brama","rifle"],
                  ["Nova","Mgła Cmentarna","shotgun"],["Tec-9","Żniwo","pistol"],["MAC-10","Kruk","smg"]],
      restricted:[["AK-47","Wieczny Głód","rifle"],["AWP","Ostatnie Żniwo","awp"],["M4A1-S","Koszmar","rifle"],
                  ["USP-S","Modlitwa","pistol"],["SG 553","Kaplica","rifle"]],
      classified:[["AK-47","Żniwiarz","rifle"],["Desert Eagle","Księga Umarłych","pistol"],
                  ["AWP","Noc Żniw","awp"],["P90","Kruk Nocy","smg"]],
      covert:    [["AWP","Kosa Śmierci","awp"],["AK-47","Pan Żniw","rifle"],["M4A4","Ostatni Oddech","rifle"]],
      special:   [["Karambit","Żniwiarz","knife"],["Nóż Motylkowy","Ostatnie Żniwo","knife"],
                  ["Nóż Talon","Cień Śmierci","knife"]],
      relic:     [["Kosa Żniwiarza","Ostrze Otchłani","scythe"],["Nóż Widmo","Ostatni Cień","knife"],
                  ["Naklejka: Ostatni Znak","Żniwiarz","sticker"],["Ozdoba: Klepsydra","Ostatnia Godzina","charm"]] } },

  { id:"sticker", name:"Skrzynka Naklejek", price:350000, color:"#f59e0b", icon:"🏷️", botOnly:true,
    sub:"Holograficzne naklejki, ozdoby i ostrza kolekcjonera. Tylko z bazaru.",
    odds:{mil:.620, restricted:.240, classified:.090, covert:.040, special:.009, relic:.001},
    items:{
      mil:       [["MP9","Kalkomania","smg"],["P250","Etykieta","pistol"],["Galil AR","Szablon","rifle"],
                  ["Nova","Folia","shotgun"],["Tec-9","Winyl","pistol"],["MAC-10","Nadruk","smg"]],
      restricted:[["AK-47","Holo","rifle"],["AWP","Foil","awp"],["M4A1-S","Grafika","rifle"],
                  ["USP-S","Naklejka","pistol"],["SG 553","Sitodruk","rifle"]],
      classified:[["AK-47","Kolekcjoner","rifle"],["Desert Eagle","Złota Naklejka","pistol"],
                  ["AWP","Holograf","awp"],["P90","Sticker Bomb","smg"]],
      covert:    [["AWP","Katastrofa","awp"],["AK-47","Arcydzieło","rifle"],["M4A4","Folia","rifle"]],
      special:   [["Karambit","Holo","knife"],["Nóż Motylkowy","Sticker","knife"],["Nóż Talon","Folia","knife"]],
      relic:     [["Naklejka: Oko Burzy","Kolekcja Legend","sticker"],["Naklejka: Czaszka Króla","Złota Seria","sticker"],
                  ["Ozdoba: Kryształ Otchłani","Bursztyn","charm"],["Nóż Kolekcjonera","Ostatni Egzemplarz","knife"]] } }
];

/* =======================================================================
   1a6. 💎 SKRZYNKI MEGA — trzy najdroższe skrzynki w grze (5 / 10 / 15 bilionów)
   Oznaczone mega:true — nie trafiają do bazaru botów (cena zbyt duża),
   ale są normalnie w sklepie i w bitwach.
   ======================================================================= */
const MEGA_CASES = [
  { id:"quantum", name:"Skrzynka Kwantowa", price:5000000000000, color:"#22d3ee", icon:"⚛️", mega:true,
    sub:"Pięć bilionów monet. Fizyka przestaje działać.",
    odds:{mil:.004, restricted:.300, classified:.360, covert:.260, special:.076},
    items:{
      mil:       [["MP9","Kwant","smg"],["P250","Superpozycja","pistol"],["Galil AR","Obserwator","rifle"],
                  ["Nova","Skok Kwantowy","shotgun"],["Tec-9","Foton","pistol"],["MAC-10","Splątanie","smg"],
                  ["Dual Berettas","Dwie Rzeczywistości","pistol"],["Sawed-Off","Rozpad","shotgun"]],
      restricted:[["AK-47","Fala Prawdopodobieństwa","rifle"],["AWP","Kolaps Funkcji","awp"],
                  ["M4A1-S","Qubit","rifle"],["USP-S","Nieoznaczoność","pistol"],
                  ["SG 553","Przesunięcie","rifle"],["MP7","Tunel Czasoprzestrzeni","smg"]],
      classified:[["AK-47","Przenikanie","rifle"],["Desert Eagle","Zasada Niepewności","pistol"],
                  ["AWP","Pułapka Kwantowa","awp"],["P90","Splątanie Kwantowe","smg"],
                  ["R8 Revolver","Paradoks","revolver"]],
      covert:    [["AWP","Nieskończona Pętla","awp"],["AK-47","Kwantowy Bunt","rifle"],
                  ["M4A4","Druga Rzeczywistość","rifle"],["Desert Eagle","Obserwacja","pistol"]],
      special:   [["Karambit","Kwazar Kwantowy","knife"],["Nóż Motylkowy","Supernowa","knife"],
                  ["Nóż Talon","Cząstka","knife"],["Bayonet","Antymateria","knife"],
                  ["Nóż Skeleton","Fala","knife"]] } },

  { id:"eternity", name:"Skrzynka Wieczności", price:10000000000000, color:"#a78bfa", icon:"♾️", mega:true,
    sub:"Dziesięć bilionów. Czas nie ma tu znaczenia.",
    odds:{mil:.002, restricted:.240, classified:.340, covert:.318, special:.100},
    items:{
      mil:       [["P250","Piasek Czasu","pistol"],["MP9","Wieczny","smg"],["Galil AR","Cykl","rifle"],
                  ["Nova","Klepsydra","shotgun"],["Tec-9","Zegar","pistol"],["MAC-10","Epoka","smg"],
                  ["Dual Berettas","Dwie Wieczności","pistol"],["Sawed-Off","Koniec Czasu","shotgun"]],
      restricted:[["AK-47","Złoty Wiek","rifle"],["AWP","Nieskończoność","awp"],["M4A1-S","Chronos","rifle"],
                  ["USP-S","Minuta","pistol"],["SG 553","Stulecie","rifle"],["MP7","Wiek","smg"]],
      classified:[["AK-47","Eon","rifle"],["Desert Eagle","Klejnot Czasu","pistol"],
                  ["AWP","Ostatnia Godzina","awp"],["P90","Wieczna","smg"],["R8 Revolver","Zegar Zagłady","revolver"]],
      covert:    [["AWP","Bez Końca","awp"],["AK-47","Król Eonów","rifle"],
                  ["M4A4","Monolit Czasu","rifle"],["Desert Eagle","Wieczność","pistol"]],
      special:   [["Karambit","Złoty Czas","knife"],["Nóż Motylkowy","Nieskończoność","knife"],
                  ["Nóż Talon","Eon","knife"],["Bayonet","Złota Era","knife"],
                  ["Nóż Skeleton","Czas","knife"],["Nóż Flip","Sekunda","knife"]] } },

  { id:"singularity", name:"Skrzynka Osobliwości", price:15000000000000, color:"#a855f7", icon:"🕳️", mega:true,
    sub:"Piętnaście bilionów. Ostatnia skrzynka w grze.",
    odds:{mil:.001, restricted:.200, classified:.330, covert:.369, special:.100},
    items:{
      mil:       [["P250","Pył","pistol"],["MP9","Ciemność","smg"],["Galil AR","Grawitacja","rifle"],
                  ["Nova","Zapadnia","shotgun"],["Tec-9","Horyzont","pistol"],["MAC-10","Zapadłość","smg"],
                  ["Dual Berettas","Dwa Światy","pistol"],["Sawed-Off","Kres","shotgun"]],
      restricted:[["AK-47","Czarna Dziura Absolutna","rifle"],["AWP","Horyzont Absolutny","awp"],
                  ["M4A1-S","Zakrzywienie","rifle"],["USP-S","Nicość","pistol"],
                  ["SG 553","Przyciąganie","rifle"],["MP7","Otchłań","smg"]],
      classified:[["AK-47","Osobliwość","rifle"],["Desert Eagle","Biały Karzeł","pistol"],
                  ["AWP","Ostatnie Światło","awp"],["P90","Zapadnięcie","smg"],
                  ["R8 Revolver","Kres Wszechświata","revolver"]],
      covert:    [["AWP","Singularność","awp"],["AK-47","Pan Ciemności","rifle"],
                  ["M4A4","Czarna Materia","rifle"],["Desert Eagle","Nicość Absolutna","pistol"]],
      special:   [["Karambit","Osobliwość","knife"],["Nóż Motylkowy","Horyzont","knife"],
                  ["Nóż Talon","Otchłań","knife"],["Bayonet","Nicość","knife"],
                  ["Nóż Skeleton","Studnia","knife"],["Nóż Flip","Kres","knife"]] } }
];

/* =======================================================================
   1a7. 🌠 SKRZYNKI ELITY — pięć skrzynek od 1 mld do 900 mld monet
   Oznaczone elite:true — nie trafiają do bazaru botów.
   ======================================================================= */
const ELITE_CASES = [
  { id:"aurora", name:"Skrzynka Aurory", price:1000000000, color:"#34d399", icon:"🌠", elite:true,
    sub:"Miliard monet. Niebo płonie kolorami.",
    odds:{mil:.020, restricted:.420, classified:.340, covert:.190, special:.030},
    items:{
      mil:       [["MP9","Zorza","smg"],["P250","Świt","pistol"],["Galil AR","Arktyka","rifle"],
                  ["Nova","Szron","shotgun"],["Tec-9","Iskra","pistol"],["MAC-10","Wiatr","smg"],
                  ["Dual Berettas","Dwie Zorze","pistol"],["Sawed-Off","Lód","shotgun"]],
      restricted:[["AK-47","Zorza Polarna","rifle"],["AWP","Nocna Zorza","awp"],["M4A1-S","Północny Blask","rifle"],
                  ["USP-S","Poranek","pistol"],["SG 553","Horyzont Polarny","rifle"],["MP7","Wichura","smg"]],
      classified:[["AK-47","Kolorowy Horyzont","rifle"],["Desert Eagle","Aurora","pistol"],["AWP","Światło Północy","awp"],
                  ["P90","Elektryczność","smg"],["R8 Revolver","Burza Magnetyczna","revolver"]],
      covert:    [["AWP","Zorza Wszechświata","awp"],["AK-47","Niebiański Ogień","rifle"],
                  ["M4A4","Polaris","rifle"],["Desert Eagle","Borealis","pistol"]],
      special:   [["Karambit","Aurora","knife"],["Nóż Motylkowy","Zorza","knife"],["Nóż Talon","Świt","knife"],
                  ["Bayonet","Północ","knife"],["Nóż Skeleton","Iskra","knife"]] } },

  { id:"nebula", name:"Skrzynka Mgławicy", price:10000000000, color:"#f472b6", icon:"🌌", elite:true,
    sub:"Dziesięć miliardów. Gwiazdy rodzą się na twoich oczach.",
    odds:{mil:.015, restricted:.380, classified:.360, covert:.210, special:.035},
    items:{
      mil:       [["P250","Mgławica","pistol"],["MP9","Pył Gwiezdny","smg"],["Galil AR","Chmura","rifle"],
                  ["Nova","Kosmos","shotgun"],["Tec-9","Gwiezdny Wiatr","pistol"],["MAC-10","Nebula","smg"],
                  ["Dual Berettas","Dwie Mgławice","pistol"],["Sawed-Off","Ciemna Materia","shotgun"]],
      restricted:[["AK-47","Narodziny Gwiazdy","rifle"],["AWP","Gwiezdna Mgławica","awp"],["M4A1-S","Kosmiczny Pył","rifle"],
                  ["USP-S","Orbita","pistol"],["SG 553","Wybuch","rifle"],["MP7","Promieniowanie","smg"]],
      classified:[["AK-47","Serce Mgławicy","rifle"],["Desert Eagle","Pulsar","pistol"],["AWP","Gwiezdna Kołyska","awp"],
                  ["P90","Kwazar","smg"],["R8 Revolver","Czerwony Olbrzym","revolver"]],
      covert:    [["AWP","Narodziny Wszechświata","awp"],["AK-47","Gwiezdny Tron","rifle"],
                  ["M4A4","Mgławica Oriona","rifle"],["Desert Eagle","Andromeda","pistol"]],
      special:   [["Karambit","Nebula","knife"],["Nóż Motylkowy","Gwiezdny Pył","knife"],["Nóż Talon","Pulsar","knife"],
                  ["Bayonet","Andromeda","knife"],["Nóż Skeleton","Orbita","knife"],["Nóż Flip","Kometa","knife"]] } },

  { id:"vortex", name:"Skrzynka Wiru", price:50000000000, color:"#38bdf8", icon:"🌀", elite:true,
    sub:"Pięćdziesiąt miliardów. Wszystko wiruje.",
    odds:{mil:.010, restricted:.330, classified:.380, covert:.240, special:.040},
    items:{
      mil:       [["P250","Wir","pistol"],["MP9","Pęd","smg"],["Galil AR","Cyklon","rifle"],
                  ["Nova","Podmuch","shotgun"],["Tec-9","Łuk","pistol"],["MAC-10","Turbina","smg"],
                  ["Dual Berettas","Dwa Wiry","pistol"],["Sawed-Off","Ssawnia","shotgun"]],
      restricted:[["AK-47","Oko Cyklonu","rifle"],["AWP","Wichura","awp"],["M4A1-S","Strumień","rifle"],
                  ["USP-S","Nurt","pistol"],["SG 553","Huragan","rifle"],["MP7","Tornado","smg"]],
      classified:[["AK-47","Wielki Wir","rifle"],["Desert Eagle","Elektro","pistol"],["AWP","Burza","awp"],
                  ["P90","Plazma","smg"],["R8 Revolver","Jonosfera","revolver"]],
      covert:    [["AWP","Oko Huraganu","awp"],["AK-47","Mistrz Żywiołów","rifle"],
                  ["M4A4","Stalowy Wiatr","rifle"],["Desert Eagle","Błękitna Burza","pistol"]],
      special:   [["Karambit","Wir","knife"],["Nóż Motylkowy","Tornado","knife"],["Nóż Talon","Cyklon","knife"],
                  ["Bayonet","Huragan","knife"],["Nóż Skeleton","Plazma","knife"],["Nóż Flip","Prąd","knife"]] } },

  { id:"titan", name:"Skrzynka Tytana", price:200000000000, color:"#fbbf24", icon:"🗿", elite:true,
    sub:"Dwieście miliardów. Legenda z kamienia i złota.",
    odds:{mil:.005, restricted:.280, classified:.380, covert:.290, special:.045},
    items:{
      mil:       [["P250","Brąz","pistol"],["MP9","Kolos","smg"],["Galil AR","Głaz","rifle"],
                  ["Nova","Młot","shotgun"],["Tec-9","Kowadło","pistol"],["MAC-10","Stalowy","smg"],
                  ["Dual Berettas","Bliźniaki","pistol"],["Sawed-Off","Wyłom","shotgun"]],
      restricted:[["AK-47","Tytan","rifle"],["AWP","Grom","awp"],["M4A1-S","Kolos","rifle"],
                  ["USP-S","Miecz","pistol"],["SG 553","Forteca","rifle"],["MP7","Kuźnia","smg"]],
      classified:[["AK-47","Pan Tytanów","rifle"],["Desert Eagle","Złoty Cios","pistol"],["AWP","Ostatni Grom","awp"],
                  ["P90","Obelisk","smg"],["R8 Revolver","Tytanomachia","revolver"]],
      covert:    [["AWP","Władca Tytanów","awp"],["AK-47","Boski Kowal","rifle"],
                  ["M4A4","Niebiańska Forteca","rifle"],["Desert Eagle","Mit","pistol"]],
      special:   [["Karambit","Tytan","knife"],["Nóż Motylkowy","Obelisk","knife"],["Nóż Talon","Grom","knife"],
                  ["Bayonet","Mit","knife"],["Nóż Skeleton","Kolos","knife"],["Nóż Flip","Kuźnia","knife"]] } },

  { id:"eclipse", name:"Skrzynka Zaćmienia", price:900000000000, color:"#fb923c", icon:"🌑", elite:true,
    sub:"Dziewięćset miliardów. Słońce gaśnie, zostaje tylko cień.",
    odds:{mil:.003, restricted:.230, classified:.360, covert:.347, special:.060},
    items:{
      mil:       [["P250","Cień","pistol"],["MP9","Półcień","smg"],["Galil AR","Korona","rifle"],
                  ["Nova","Promień","shotgun"],["Tec-9","Pierścień","pistol"],["MAC-10","Mrok","smg"],
                  ["Dual Berettas","Dwa Słońca","pistol"],["Sawed-Off","Zasłona","shotgun"]],
      restricted:[["AK-47","Czarna Korona","rifle"],["AWP","Zaćmienie","awp"],["M4A1-S","Korona Słońca","rifle"],
                  ["USP-S","Ostatni Promień","pistol"],["SG 553","Halo","rifle"],["MP7","Cień Księżyca","smg"]],
      classified:[["AK-47","Władca Zaćmienia","rifle"],["Desert Eagle","Mrok Absolutny","pistol"],["AWP","Ostatnie Zaćmienie","awp"],
                  ["P90","Promienny Krąg","smg"],["R8 Revolver","Apogeum","revolver"]],
      covert:    [["AWP","Całkowite Zaćmienie","awp"],["AK-47","Czarny Helios","rifle"],
                  ["M4A4","Korona Cienia","rifle"],["Desert Eagle","Anty-słońce","pistol"]],
      special:   [["Karambit","Zaćmienie","knife"],["Nóż Motylkowy","Korona","knife"],["Nóż Talon","Helios","knife"],
                  ["Bayonet","Mrok Absolutny","knife"],["Nóż Skeleton","Apogeum","knife"],["Nóż Flip","Halo","knife"]] } }
];

/* =======================================================================
   1a8. 💠 SKRZYNKI ULTRA — od 20 bilionów (20T) do 1 kwadryliona (1Qd)
   Oznaczone ultra:true — poza bazarem botów i poza zwykłą skalą.
   ======================================================================= */
const ULTRA_CASES = [
  { id:"quad", name:"Kwadra", price:2e13, color:"#22d3ee", icon:"💠", ultra:true,
    sub:"Dwadzieścia bilionów monet. Cztery wymiary, jedna skrzynka.",
    odds:{mil:.002, restricted:.250, classified:.350, covert:.320, special:.078},
    items:{
      mil:       [["MP9","Kwadrat","smg"],["P250","Tetrada","pistol"],["Galil AR","Kwadrant","rifle"],
                  ["Nova","Cztery Wiatry","shotgun"],["Tec-9","Kwartet","pistol"],["MAC-10","Poczwórny","smg"]],
      restricted:[["AK-47","Kwadryga","rifle"],["AWP","Cztery Światy","awp"],
                  ["M4A1-S","Kwadrant Nieskończoności","rifle"],["USP-S","Poczwórna Gra","pistol"]],
      classified:[["AK-47","Pan Kwadrantów","rifle"],["Desert Eagle","Tetrarcha","pistol"],
                  ["AWP","Poczwórna Gwiazda","awp"],["P90","Kwadrypol","smg"]],
      covert:    [["AWP","Kwadrylion","awp"],["AK-47","Cztery Korony","rifle"],["M4A4","Tetrada Absolutna","rifle"]],
      special:   [["Karambit","Kwadra","knife"],["Nóż Motylkowy","Kwartet","knife"],
                  ["Nóż Talon","Kwadrant","knife"],["Bayonet","Cztery Ostrza","knife"]] } },

  { id:"quint", name:"Kwinta", price:5e13, color:"#818cf8", icon:"🔷", ultra:true,
    sub:"Pięćdziesiąt bilionów monet. Piąty wymiar otwiera się tylko tutaj.",
    odds:{mil:.0015, restricted:.230, classified:.350, covert:.340, special:.0785},
    items:{
      mil:       [["P250","Pięciokąt","pistol"],["MP9","Kwinta","smg"],["Galil AR","Pentagon","rifle"],
                  ["Nova","Pięć Wiatrów","shotgun"],["Tec-9","Piątka","pistol"],["MAC-10","Pięciokrotny","smg"]],
      restricted:[["AK-47","Pentagram","rifle"],["AWP","Pięć Światów","awp"],
                  ["M4A1-S","Piąty Krąg","rifle"],["USP-S","Kwintesencja","pistol"]],
      classified:[["AK-47","Pan Pięciu","rifle"],["Desert Eagle","Pentarcha","pistol"],
                  ["AWP","Pięcioramienna Gwiazda","awp"],["P90","Pentaktyl","smg"]],
      covert:    [["AWP","Kwintylion","awp"],["AK-47","Pięć Koron","rifle"],["M4A4","Pentagram Absolutny","rifle"]],
      special:   [["Karambit","Kwinta","knife"],["Nóż Motylkowy","Pentagram","knife"],
                  ["Nóż Talon","Pięciokąt","knife"],["Bayonet","Pięć Ostrzy","knife"]] } },

  { id:"sext", name:"Seksta", price:1e14, color:"#fb7185", icon:"🔶", ultra:true,
    sub:"Sto bilionów monet. Sześć pieczęci pęka naraz.",
    odds:{mil:.001, restricted:.210, classified:.350, covert:.359, special:.080},
    items:{
      mil:       [["P250","Heksagon","pistol"],["MP9","Seksta","smg"],["Galil AR","Sześcian","rifle"],
                  ["Nova","Sześć Wiatrów","shotgun"],["Tec-9","Szóstka","pistol"],["MAC-10","Sześciokrotny","smg"]],
      restricted:[["AK-47","Heksagram","rifle"],["AWP","Sześć Światów","awp"],
                  ["M4A1-S","Szósty Zmysł","rifle"],["USP-S","Sekstens","pistol"]],
      classified:[["AK-47","Pan Sześciu","rifle"],["Desert Eagle","Heksarcha","pistol"],
                  ["AWP","Sześcioramienna Gwiazda","awp"],["P90","Heksaktyl","smg"]],
      covert:    [["AWP","Sekstylion","awp"],["AK-47","Sześć Koron","rifle"],["M4A4","Heksagram Absolutny","rifle"]],
      special:   [["Karambit","Seksta","knife"],["Nóż Motylkowy","Heksagram","knife"],
                  ["Nóż Talon","Sześcian","knife"],["Bayonet","Sześć Ostrzy","knife"]] } },

  { id:"sept", name:"Septa", price:2.5e14, color:"#f59e0b", icon:"🔺", ultra:true,
    sub:"Dwieście pięćdziesiąt bilionów monet. Siedem kręgów w jednej skrzynce.",
    odds:{mil:.0008, restricted:.190, classified:.350, covert:.3792, special:.080},
    items:{
      mil:       [["P250","Heptagon","pistol"],["MP9","Septyma","smg"],["Galil AR","Siedem Wiatrów","rifle"],
                  ["Nova","Siódemka","shotgun"],["Tec-9","Siedmioramienny","pistol"],["MAC-10","Siedmiokrotny","smg"]],
      restricted:[["AK-47","Siedem Pieczęci","rifle"],["AWP","Siedem Światów","awp"],
                  ["M4A1-S","Siódmy Krąg","rifle"],["USP-S","Septet","pistol"]],
      classified:[["AK-47","Pan Siedmiu","rifle"],["Desert Eagle","Heptarcha","pistol"],
                  ["AWP","Siedmioramienna Gwiazda","awp"],["P90","Heptaktyl","smg"]],
      covert:    [["AWP","Septylion","awp"],["AK-47","Siedem Koron","rifle"],
                  ["M4A4","Siedem Pieczęci Absolutnych","rifle"]],
      special:   [["Karambit","Septyma","knife"],["Nóż Motylkowy","Heptagram","knife"],
                  ["Nóż Talon","Heptagon","knife"],["Bayonet","Siedem Ostrzy","knife"]] } },

  { id:"oct", name:"Okta", price:5e14, color:"#2dd4bf", icon:"🧿", ultra:true,
    sub:"Pięćset bilionów monet. Osiem cudów, zero litości.",
    odds:{mil:.0006, restricted:.170, classified:.350, covert:.3994, special:.080},
    items:{
      mil:       [["P250","Oktagon","pistol"],["MP9","Oktawa","smg"],["Galil AR","Osiem Wiatrów","rifle"],
                  ["Nova","Ósemka","shotgun"],["Tec-9","Ośmioramienny","pistol"],["MAC-10","Ośmiokrotny","smg"]],
      restricted:[["AK-47","Osiem Kręgów","rifle"],["AWP","Osiem Światów","awp"],
                  ["M4A1-S","Ósmy Cud","rifle"],["USP-S","Oktet","pistol"]],
      classified:[["AK-47","Pan Ośmiu","rifle"],["Desert Eagle","Oktarcha","pistol"],
                  ["AWP","Ośmioramienna Gwiazda","awp"],["P90","Oktaktyl","smg"]],
      covert:    [["AWP","Oktylion","awp"],["AK-47","Osiem Koron","rifle"],["M4A4","Oktagram Absolutny","rifle"]],
      special:   [["Karambit","Oktawa","knife"],["Nóż Motylkowy","Oktagram","knife"],
                  ["Nóż Talon","Oktagon","knife"],["Bayonet","Osiem Ostrzy","knife"]] } },

  { id:"non", name:"Nona", price:1e15, color:"#c084fc", icon:"🔮", ultra:true,
    sub:"Kwadrylion monet. Dziewięć otchłani czeka na śmiałka.",
    odds:{mil:.0005, restricted:.150, classified:.350, covert:.4195, special:.080},
    items:{
      mil:       [["P250","Nonagon","pistol"],["MP9","Nonet","smg"],["Galil AR","Dziewięć Wiatrów","rifle"],
                  ["Nova","Dziewiątka","shotgun"],["Tec-9","Dziewięcioramienny","pistol"],["MAC-10","Dziewięciokrotny","smg"]],
      restricted:[["AK-47","Dziewięć Kręgów","rifle"],["AWP","Dziewięć Światów","awp"],
                  ["M4A1-S","Dziewiąta Fala","rifle"],["USP-S","Nonet","pistol"]],
      classified:[["AK-47","Pan Dziewięciu","rifle"],["Desert Eagle","Ennearcha","pistol"],
                  ["AWP","Dziewięcioramienna Gwiazda","awp"],["P90","Enneaktyl","smg"]],
      covert:    [["AWP","Nonylion","awp"],["AK-47","Dziewięć Koron","rifle"],["M4A4","Enneagram Absolutny","rifle"]],
      special:   [["Karambit","Nonagon","knife"],["Nóż Motylkowy","Enneagram","knife"],
                  ["Nóż Talon","Nowenna","knife"],["Bayonet","Dziewięć Ostrzy","knife"]] } }
];

CASES.push(...BOT_CASES, ...MEGA_CASES, ...ELITE_CASES, ...ULTRA_CASES);
CASES.sort((a,b)=>a.price - b.price);

/* =======================================================================
   1b. ULEPSZENIA (trwałe perki kupowane za monety)
   ======================================================================= */
const LUCK_STEP   = 0.07;   // siła szczęścia za poziom
const KNIFE_STEP  = 0.12;   // +12% (względnie) szansy na nóż za poziom
const BONUS_STEP  = 0.25;   // +25% do nagrody z bonusu za poziom
const SELL_STEP   = 0.02;   // +2% wartości przy sprzedaży za poziom
const SPEED_STEP  = 2000;   // -2 s odnowienia bonusu za poziom
const COUPON_STEP = 0.04;   // +4% szans na darmowe otwarcie za poziom
const VALUE_STEP  = 0.10;   // +10% wartości zdobytych przedmiotów
const BULK_STEP   = 0.03;   // -3% ceny przy otwieraniu ×10
const CLOVER_STEP = 15000;  // +15 s działania koniczyny za poziom
const BATTLE_STEP = 0.05;   // +5% wartości WYGRANYCH dropów gracza (nie wpływa na szansę wygranej)
const IDLE_STEP   = 0.20;   // +20% monet za czas gry
const KOH_STEP    = 0.010;  // +1% szczęścia w Królowej góry
const TRADE_STEP  = 0.020;  // -2% cen u botów
const FXHUNT_STEP = 0.10;   // +10% szansy na efekt
const PATCH_STEP  = 0.05;   // -5% ceny kosmetyków
const BASECASE    = 100;    // najtańsza skrzynka (do ratunku)

/* Noże prawie nie korzystają ze szczęścia — inaczej przy pełnym szczęściu
   z każdej skrzynki leciałyby same kosy. Wzrost rośnie z rzadkością, żeby
   szczęście zawsze podnosiło wartość otwarcia, a nie ją zaniżało.
   Od samych noży jest osobny perek: 🔪 Łowca Noży. */
const TIER_LUCK = {mil:0, restricted:0.6, classified:1.0, covert:1.3, special:0.15, relic:0.05};

const UPGRADES = [
  { id:"luck", icon:"🎯", name:"Szczęście", max:20,
    desc:"Przesuwa losowanie w stronę lepszych skinów. Noże prawie z tego nie korzystają — od noży jest osobny perek 🔪 Łowca Noży. (Osobny bonus: 🍀 koniczyna wypadająca ze skrzynek.)",
    costs:[5000,25000,90000,300000,1000000,2000000,4000000,8000000,16000000,32000000,
           40000000,52000000,68000000,88000000,114000000,149000000,193000000,251000000,326000000,424000000],
    fmt:l => l ? "+"+Math.round(LUCK_STEP*l*100)+"% szansy na lepsze skiny" : "standardowe szanse" },
  { id:"knives", icon:"🔪", name:"Łowca Noży", max:10,
    desc:"Podnosi szansę na ★ noże w każdej skrzynce (liczy się też w bitwach). Noże są warte najwięcej, więc to najkrótsza droga do naprawdę drogich dropów.",
    costs:[10000000,14500000,21000000,30500000,44000000,64000000,93000000,135000000,195000000,283000000],
    fmt:l => l ? "×"+(1+KNIFE_STEP*l).toFixed(2)+" szansy na nóż (+"+Math.round(KNIFE_STEP*l*100)+"%)" : "podstawowa szansa na nóż" },
  { id:"bonus", icon:"🎁", name:"Moc Bonusu", max:8,
    desc:"Zwiększa nagrodę z przycisku 🎁 Bonus. Im wyższy poziom, tym szybciej rośnie Twój portfel.",
    costs:[2000,8000,30000,100000,350000,1200000,4500000,16000000],
    fmt:l => "+"+Math.round(BONUS_STEP*l*100)+"% do nagrody z bonusu" },
  { id:"sell", icon:"💰", name:"Negocjator", max:5,
    desc:"Podnosi procent wartości, jaki dostajesz przy sprzedaży przedmiotu z ekwipunku. Maks. 5 — wyżej sprzedawałbyś drożej niż przedmiot jest warty.",
    costs:[3000,12000,45000,150000,500000],
    fmt:l => "sprzedajesz za "+Math.round((0.90+SELL_STEP*l)*100)+"% wartości" },
  { id:"speed", icon:"⏱️", name:"Przyspieszenie", max:8,
    desc:"Skraca czas odnowienia przycisku 🎁 Bonus — darmowe monety dostajesz częściej.",
    costs:[1500,6000,20000,70000,250000,800000,3000000,10000000],
    fmt:l => "bonus gotowy co "+Math.round(Math.max(4000,20000-SPEED_STEP*l)/1000)+"s" },
  { id:"coupon", icon:"🎟️", name:"Kupony", max:5,
    desc:"Szansa, że otwarcie skrzynki nic Cię nie kosztuje. Kupon zużywa się przy każdym otwarciu. Maks. 5 — wyżej otwarcia byłyby prawie darmowe.",
    costs:[8000,35000,120000,400000,1200000],
    fmt:l => Math.round(COUPON_STEP*l*100)+"% szans na darmowe otwarcie" },
  { id:"value", icon:"💎", name:"Wycena", max:5,
    desc:"Każdy nowo zdobyty przedmiot jest wart więcej — działa od razu przy dropie, także przy sprzedaży. Maks. 5 — wyżej wartość dropów rosłaby szybciej niż cena skrzynek.",
    costs:[10000,40000,140000,450000,1500000],
    fmt:l => "+"+Math.round(VALUE_STEP*l*100)+"% wartości nowych dropów" },
  { id:"bulk", icon:"📦", name:"Hurt", max:8,
    desc:"Rabat na otwieranie ×10 i na bitwy 5×5. Przydatne, gdy wolisz otwierać hurtem zamiast pojedynczo.",
    costs:[5000,18000,65000,220000,800000,2500000,9000000,32000000],
    fmt:l => l ? "−"+Math.round(BULK_STEP*l*100)+"% ceny przy ×10" : "bez rabatu przy ×10" },
  { id:"auto", icon:"🤖", name:"Auto-otwieranie", max:1,
    desc:"Odblokowuje przycisk 🤖 Auto przy każdej skrzynce — gra otwiera ją za Ciebie jedno po drugim, dopóki wystarcza monet (albo wciśniesz ⏹ Stop). Otwarcia liczą się jak zwykłe: kupony, 🍀 koniczyna, misje dzienne, album i ekwipunek działają normalnie. W panelu auto-otwierania znajdziesz ⚡ tryb turbo (4 otwarcia na sekundę) i ⏹ limit otwarć (∞ / 25 / 100 / 500).",
    costs:[12500],
    fmt:l => l ? "auto-otwieranie skrzynek: odblokowane" : "auto-otwieranie: zablokowane" },
  { id:"clover", icon:"🍀", name:"Długi kwiat", max:8,
    desc:"Wydłuża działanie czterolistnej koniczyny. Każde trafienie daje dłuższe okno na noże i lepsze bronie.",
    costs:[40000,120000,350000,900000,2200000,5500000,14000000,35000000],
    fmt:l => "koniczyna działa "+Math.round((CLOVER_DUR+CLOVER_STEP*l)/1000)+" s" },
  { id:"battle", icon:"⚔️", name:"Wojownik", max:10,
    desc:"Zwiększa wartość przedmiotów, które wygrywasz w bitwie. Nie zmienia szansy na wygraną — walki są uczciwe, a wygrane coraz cenniejsze.",
    costs:[30000,90000,250000,700000,1800000,4800000,12000000,30000000,75000000,180000000],
    fmt:l => l ? "+"+Math.round(BATTLE_STEP*l*100)+"% wartości wygranych dropów" : "bez bonusu do wygranych" },
  { id:"idle", icon:"💤", name:"Cierpliwość", max:10,
    desc:"Zwiększa monety, które dostajesz za czas spędzony w grze (nagroda co 30 sekund).",
    costs:[15000,45000,120000,300000,800000,2000000,5000000,12000000,30000000,75000000],
    fmt:l => "+"+Math.round(IDLE_STEP*l*100)+"% monet za czas gry" },
  { id:"jackpot", icon:"🎰", name:"Szczęśliwa ręka", max:8,
    desc:"Przesuwa wynik w Królowej góry na Twoją korzyść — łatwiej o wygraną, wielką wygraną i jackpot.",
    costs:[120000,350000,900000,2200000,5500000,14000000,35000000,90000000],
    fmt:l => "+"+Math.round(KOH_STEP*l*100)+"% szczęścia w Królowej góry" },
  { id:"trade", icon:"🏷️", name:"Targowanie", max:8,
    desc:"Zbija ceny wszystkich ofert na bazarze botów — zarówno broni, jak i skrzynek.",
    costs:[50000,150000,400000,1000000,2500000,6500000,16000000,40000000],
    fmt:l => l ? "-"+Math.round(TRADE_STEP*l*100)+"% cen u botów" : "normalne ceny u botów" },
  { id:"fxhunt", icon:"✨", name:"Łowca błysków", max:8,
    desc:"Zwiększa szansę, że zdobycz dostanie rzadki efekt ✨, który mnoży jej wartość.",
    costs:[250000,700000,2000000,5500000,15000000,40000000,100000000,250000000],
    fmt:l => l ? "+"+Math.round(FXHUNT_STEP*l*100)+"% szansy na efekt" : "podstawowa szansa na efekt" },
  { id:"patch", icon:"🎨", name:"Zniżka na patche", max:5,
    desc:"Obniża cenę kosmetyków kupowanych w dziale Statystyki.",
    costs:[500000,2000000,7000000,25000000,80000000],
    fmt:l => l ? "-"+Math.round(PATCH_STEP*l*100)+"% ceny kosmetyków" : "normalne ceny kosmetyków" }
];
const UP_BY_ID = Object.fromEntries(UPGRADES.map(u=>[u.id,u]));
const upCost = (id, lvl) => UP_BY_ID[id].costs[lvl];
const UP_ZERO = () => Object.fromEntries(UPGRADES.map(u=>[u.id,0]));

/* ile poziomów mam */
const upLvl = id => (state.up && state.up[id]|0) || 0;
const upTotal = () => UPGRADES.reduce((a,u)=>a+upLvl(u.id),0);
const upMaxTotal = () => UPGRADES.reduce((a,u)=>a+u.max,0);

/* --- "oficjalne" szanse skrzynki: noże rzadsze, ich udział dzielony na resztę --- */
const BASE_ODDS_CACHE = new Map();
function baseOdds(c){
  let o = BASE_ODDS_CACHE.get(c.id);
  if(o) return o;
  o = {};
  let sum = 0;
  for(const t of TIERS){ o[t] = (c.odds[t]||0) * (t==="special" ? KNIFE_DAMP : 1); sum += o[t]; }
  for(const t of TIERS) o[t] = o[t]/sum;
  BASE_ODDS_CACHE.set(c.id, o);
  return o;
}

/* --- realne szanse z uwzględnieniem ulepszeń (szczęście, łowca noży) i 🍀 koniczyny --- */
const ODDS_CACHE = new Map();
function oddsFor(c){
  const bo = baseOdds(c);
  const lvl = upLvl("luck");
  const kl  = upLvl("knives");
  const cl  = cloverOdds();
  if(!lvl && !kl && !cl) return bo;
  const ck = c.id+"|"+lvl+"|"+kl+"|"+(cl?"cl":"-");
  if(ODDS_CACHE.has(ck)) return ODDS_CACHE.get(ck);
  const raw = {};
  let sum = 0;
  for(const t of TIERS){
    let p = (bo[t] || 0) * (1 + lvl*LUCK_STEP*TIER_LUCK[t]);
    if(t === "special" && kl) p *= (1 + kl*KNIFE_STEP);   // 🔪 Łowca Noży
    if(cl) p *= (1 + (CLOVER_BOOST[t] || 0));             // 🍀 przesuwa szanse w stronę dobrych dropów
    raw[t] = p; sum += p;
  }
  for(const t of TIERS) raw[t] /= sum;
  ODDS_CACHE.set(ck, raw);
  return raw;
}

/* --- pozostałe efekty ulepszeń --- */
const sellRate     = () => SELL_RATE + SELL_STEP*upLvl("sell");
const bonusCd      = () => Math.max(4000, 20000 - SPEED_STEP*upLvl("speed"));
const couponChance = () => COUPON_STEP*upLvl("coupon");
const valueBoost   = () => 1 + VALUE_STEP*upLvl("value");
const bulkRate     = () => BULK_STEP*upLvl("bulk");