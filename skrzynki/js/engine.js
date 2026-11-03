"use strict";

/* =======================================================================
   2. NARZĘDZIA
   ======================================================================= */
const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

function hash(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619);} return h>>>0; }
function rnd(a,b){ return a+Math.random()*(b-a); }
function pick(a){ return a[(Math.random()*a.length)|0]; }
function roundNice(n){
  if(n<1000) return Math.round(n);
  if(n<10000) return Math.round(n/10)*10;
  if(n<100000) return Math.round(n/50)*50;
  if(n<1000000) return Math.round(n/100)*100;
  return Math.round(n/1000)*1000;
}
function esc(s){ return String(s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
const fmt = n => Math.round(n).toLocaleString("pl-PL");
/* Skróty liczb: K / M / B / T / Qd / Qn / Sx / Sp / O / N / D / Ud / Dd / Td ... */
const SHORT_UNITS = [
  [1e63,"Vg"],[1e60,"Nod"],[1e57,"Ocd"],[1e54,"Spd"],[1e51,"Sxd"],
  [1e48,"Qid"],[1e45,"Qad"],[1e42,"Td"],[1e39,"Dd"],[1e36,"Ud"],[1e33,"D"],
  [1e30,"N"],[1e27,"O"],[1e24,"Sp"],[1e21,"Sx"],[1e18,"Qn"],[1e15,"Qd"],
  [1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]
];
function fmtShort(n){
  n = Math.round(Number(n)||0);
  const neg = n < 0 ? "-" : "";
  const a = Math.abs(n);
  const dec = v => v.toFixed(2).replace(/\.?0+$/,"").replace(".",",");
  for(let i=0;i<SHORT_UNITS.length;i++){
    const [v,suf] = SHORT_UNITS[i];
    if(a < v) continue;
    // 999,999 staje się "1M", a nie "1000K"
    if(a/v >= 999.995 && i > 0){ const [pv,ps] = SHORT_UNITS[i-1]; return neg + dec(a/pv) + ps; }
    return neg + dec(a/v) + suf;
  }
  return neg + fmt(a);
}

/* =======================================================================
   3. GRAFIKA BRONI (wielowarstwowe "skiny")
   ======================================================================= */
/* role: base | accent | light | dark | detail */
const ART = {
  pistol: [
    {d:"M58 48 H112 L104 106 H46 C 49 88, 53 66, 58 48 Z", r:"base"},
    {d:"M44 98 H105 l2 8 H42 Z", r:"dark"},
    {d:"M64 57 H108 L101 98 H54 Z", r:"accent"},
    {d:"M68 66 h20 l-2 6 h-20 Z M65 79 h20 l-2 6 h-20 Z M62 92 h20 l-2 6 h-20 Z", r:"dark"},
    {d:"M112 48 H146 v8 H112 Z", r:"dark"},
    {d:"M136 50 h11 v30 h-11 Z", r:"dark"},
    {d:"M112 72 H146 v9 H112 Z", r:"dark"},
    {d:"M119 54 h9 l-4 16 h-7 Z", r:"detail"},
    {d:"M46 18 H160 a10 10 0 0 1 10 10 v10 a10 10 0 0 1 -10 10 H46 Z", r:"base"},
    {d:"M50 21 H157 v5 H50 Z", r:"light"},
    {d:"M46 42 H120 v7 H46 Z", r:"dark"},
    {d:"M52 6 h12 v14 H52 Z", r:"dark"},
    {d:"M150 4 h11 v16 h-11 Z", r:"dark"},
    {d:"M112 24 h30 v9 h-30 Z", r:"dark"},
    {d:"M164 24 h18 v16 h-18 Z", r:"dark"},
    {d:"M174 30 a3.4 3.4 0 1 0 .1 0", r:"detail"},
    {d:"M60 22 h5 v22 h-5 Z M70 22 h5 v22 h-5 Z M80 22 h5 v22 h-5 Z M90 22 h5 v22 h-5 Z", r:"dark"},
    {d:"M46 38 H174 v3 H46 Z", r:"detail"}
  ],
  rifle: [
    {d:"M2 38 H50 v14 L32 84 H2 Z", r:"accent"},
    {d:"M6 43 H46 v7 H6 Z", r:"light"},
    {d:"M2 76 H36 v10 H2 Z", r:"dark"},
    {d:"M46 32 H130 v34 H46 Z", r:"base"},
    {d:"M50 37 H126 v5 H50 Z", r:"light"},
    {d:"M50 22 H104 v14 H50 Z", r:"dark"},
    {d:"M108 18 h16 v16 h-16 Z", r:"dark"},
    {d:"M124 36 H164 v28 H124 Z", r:"base"},
    {d:"M128 41 H160 v5 H128 Z", r:"light"},
    {d:"M132 52 h7 v7 h-7 Z M146 52 h7 v7 h-7 Z M158 52 h5 v7 h-5 Z", r:"dark"},
    {d:"M160 32 H182 v26 H160 Z", r:"dark"},
    {d:"M162 16 h12 v18 h-12 Z", r:"dark"},
    {d:"M160 26 H182 v6 h-22 Z", r:"dark"},
    {d:"M180 44 h22 v11 h-22 Z", r:"dark"},
    {d:"M198 40 h7 v19 h-7 Z", r:"detail"},
    {d:"M76 64 H120 L112 106 H68 Z", r:"accent"},
    {d:"M82 72 h30 l-3 8 h-30 Z M78 84 h30 l-3 8 h-30 Z", r:"dark"},
    {d:"M116 60 C 152 62, 164 84, 156 106 H124 C 132 86, 126 74, 116 70 Z", r:"dark"},
    {d:"M120 67 C 146 70, 155 86, 150 102 H132 C 137 86, 130 76, 120 73 Z", r:"accent"},
    {d:"M116 60 h26 v8 h-26 Z", r:"dark"},
    {d:"M100 66 h11 v10 h-11 Z", r:"detail"},
    {d:"M46 60 H72 v8 H46 Z", r:"dark"}
  ],
  awp: [
    {d:"M2 42 H58 v14 L42 90 H2 Z", r:"accent"},
    {d:"M8 47 H54 v8 H8 Z", r:"light"},
    {d:"M2 80 H38 v10 H2 Z", r:"dark"},
    {d:"M16 56 a11 11 0 1 0 22 0 a11 11 0 1 0 -22 0", r:"detail"},
    {d:"M58 38 H148 v34 H58 Z", r:"base"},
    {d:"M62 43 H144 v5 H62 Z", r:"light"},
    {d:"M74 12 H136 a11 11 0 0 1 11 11 v6 a11 11 0 0 1 -11 11 H74 a11 11 0 0 1 -11 -11 v-6 a11 11 0 0 1 11 -11 Z", r:"dark"},
    {d:"M78 17 H133 v5 H78 Z", r:"light"},
    {d:"M122 21 a9 9 0 1 0 18 0 a9 9 0 1 0 -18 0", r:"detail"},
    {d:"M84 36 h13 v10 H84 Z M114 36 h13 v10 h-13 Z", r:"dark"},
    {d:"M148 46 H196 v13 H148 Z", r:"dark"},
    {d:"M192 42 h10 v21 h-10 Z", r:"detail"},
    {d:"M134 62 h20 v14 h-20 Z", r:"dark"},
    {d:"M148 66 h11 v9 h-11 Z", r:"accent"},
    {d:"M54 70 h32 v18 H54 Z", r:"dark"},
    {d:"M58 75 h24 v5 H58 Z", r:"detail"},
    {d:"M90 66 H120 L114 106 H86 Z", r:"accent"},
    {d:"M94 74 h18 l-2 7 h-18 Z M91 86 h18 l-2 7 h-18 Z", r:"dark"},
    {d:"M90 66 h10 v14 H90 Z", r:"detail"},
    {d:"M58 62 H86 v8 H58 Z", r:"dark"}
  ],
  smg: [
    {d:"M2 44 L46 38 v30 L2 74 Z", r:"accent"},
    {d:"M8 48 L42 43 v20 L8 68 Z", r:"dark"},
    {d:"M44 28 H150 a12 12 0 0 1 12 12 v22 H44 Z", r:"base"},
    {d:"M48 33 H146 v5 H48 Z", r:"light"},
    {d:"M54 18 H136 v12 H54 Z", r:"dark"},
    {d:"M60 22 h9 v5 h-9 Z M76 22 h9 v5 h-9 Z M92 22 h9 v5 h-9 Z M108 22 h9 v5 h-9 Z M124 22 h9 v5 h-9 Z", r:"detail"},
    {d:"M128 8 h13 v12 h-13 Z", r:"dark"},
    {d:"M160 36 h28 v12 h-28 Z", r:"dark"},
    {d:"M184 40 h10 v6 h-10 Z", r:"detail"},
    {d:"M72 26 h12 v6 H72 Z", r:"detail"},
    {d:"M74 58 h14 v10 h-14 Z", r:"detail"},
    {d:"M70 58 H96 v8 H70 Z", r:"dark"},
    {d:"M92 60 H132 L124 106 H84 Z", r:"dark"},
    {d:"M97 68 H127 L121 100 H91 Z", r:"accent"},
    {d:"M100 77 h22 l-3 7 h-22 Z M96 88 h22 l-3 7 h-22 Z", r:"dark"},
    {d:"M80 96 H126 l3 9 H78 Z", r:"dark"},
    {d:"M44 56 H70 v8 H44 Z", r:"dark"}
  ],
  shotgun: [
    {d:"M2 40 H54 v12 L38 82 H2 Z", r:"accent"},
    {d:"M8 45 H50 v6 H8 Z", r:"light"},
    {d:"M2 72 H34 v10 H2 Z", r:"dark"},
    {d:"M52 30 H128 v36 H52 Z", r:"base"},
    {d:"M56 35 H124 v5 H56 Z", r:"light"},
    {d:"M124 34 h72 v12 h-72 Z", r:"dark"},
    {d:"M120 50 h64 v10 h-64 Z", r:"dark"},
    {d:"M128 42 h50 v30 h-50 Z", r:"accent"},
    {d:"M128 42 h50 v6 h-50 Z", r:"light"},
    {d:"M134 52 h6 v16 h-6 Z M146 52 h6 v16 h-6 Z M158 52 h6 v16 h-6 Z M170 52 h6 v16 h-6 Z", r:"dark"},
    {d:"M190 28 h10 v8 h-10 Z", r:"dark"},
    {d:"M76 66 H110 L104 106 H70 Z", r:"accent"},
    {d:"M80 74 h22 l-2 7 h-22 Z M77 86 h22 l-2 7 h-22 Z", r:"dark"},
    {d:"M104 64 h12 v9 h-12 Z", r:"detail"},
    {d:"M100 64 H126 v8 H100 Z", r:"dark"},
    {d:"M52 58 H72 v8 H52 Z", r:"dark"}
  ],
  lmg: [
    {d:"M2 42 H54 v12 L38 84 H2 Z", r:"accent"},
    {d:"M8 47 H50 v6 H8 Z", r:"light"},
    {d:"M2 74 H34 v10 H2 Z", r:"dark"},
    {d:"M52 28 H166 v40 H52 Z", r:"base"},
    {d:"M56 33 H162 v5 H56 Z", r:"light"},
    {d:"M60 14 H148 v14 H60 Z", r:"dark"},
    {d:"M66 18 h10 v6 h-10 Z M84 18 h10 v6 h-10 Z M102 18 h10 v6 h-10 Z M120 18 h10 v6 h-10 Z", r:"detail"},
    {d:"M164 38 H196 v16 H164 Z", r:"dark"},
    {d:"M164 30 H198 v6 h-34 Z", r:"dark"},
    {d:"M192 34 h11 v24 h-11 Z", r:"dark"},
    {d:"M60 66 H124 v40 H60 Z", r:"dark"},
    {d:"M66 72 h50 v7 H66 Z M66 83 h50 v7 H66 Z M66 94 h50 v6 H66 Z", r:"accent"},
    {d:"M122 62 h20 v10 h-20 Z", r:"accent"},
    {d:"M138 66 H166 L160 106 H132 Z", r:"accent"},
    {d:"M142 74 h18 l-2 7 h-18 Z M139 86 h18 l-2 7 h-18 Z", r:"dark"},
    {d:"M126 66 h11 v10 h-11 Z", r:"detail"},
    {d:"M170 52 h6 v30 h-6 Z M186 52 h6 v30 h-6 Z", r:"detail"},
    {d:"M164 80 h34 v6 h-34 Z", r:"dark"}
  ],
  revolver: [
    {d:"M14 46 H108 v18 H14 Z", r:"base"},
    {d:"M18 51 H104 v5 H18 Z", r:"light"},
    {d:"M104 42 H182 v10 H104 Z", r:"dark"},
    {d:"M100 52 H192 v14 H100 Z", r:"base"},
    {d:"M104 56 H188 v5 H104 Z", r:"light"},
    {d:"M188 46 h11 v26 h-11 Z", r:"dark"},
    {d:"M40 34 H104 a12 12 0 0 1 12 12 v16 a12 12 0 0 1 -12 12 H40 a12 12 0 0 1 -12 -12 V46 a12 12 0 0 1 12 -12 Z", r:"accent"},
    {d:"M48 42 h9 v30 h-9 Z M66 42 h9 v30 h-9 Z M84 42 h9 v30 h-9 Z", r:"dark"},
    {d:"M20 24 h16 v24 H20 Z", r:"dark"},
    {d:"M4 42 h14 v20 H4 Z", r:"detail"},
    {d:"M14 62 h34 v8 H14 Z", r:"dark"},
    {d:"M16 70 h28 L38 106 H10 Z", r:"accent"},
    {d:"M20 78 h16 l-2 7 h-16 Z M17 90 h16 l-2 7 h-16 Z", r:"dark"},
    {d:"M32 62 h10 v9 H32 Z", r:"detail"},
    {d:"M170 42 h16 v7 h-16 Z", r:"detail"}
  ],
  knife3: [
    {d:"M60 92 C 74 58, 110 26, 172 10 C 190 5, 202 10, 201 21 C 180 26, 158 38, 140 58 C 124 76, 112 90, 106 106 Z", r:"base"},
    {d:"M68 90 C 80 62, 112 34, 166 18 C 182 14, 192 17, 195 22 C 176 30, 156 42, 140 60 C 126 76, 116 90, 110 102 Z", r:"light"},
    {d:"M106 106 C 100 88, 108 66, 128 48 C 134 62, 126 84, 114 106 Z", r:"accent"},
    {d:"M52 84 L78 92 L74 104 L48 96 Z", r:"accent"},
    {d:"M22 78 h30 v26 H22 Z", r:"accent"},
    {d:"M22 78 h30 v6 H22 Z", r:"light"},
    {d:"M2 86 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0", r:"dark"},
    {d:"M8 86 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0", r:"detail"},
    {d:"M28 88 a3.2 3.2 0 1 0 6.4 0 a3.2 3.2 0 1 0 -6.4 0", r:"detail"}
  ],
  knife: [
    {d:"M52 82 C 62 30, 122 6, 194 6 C 152 30, 108 54, 84 88 Z", r:"base"},
    {d:"M60 78 C 70 36, 124 14, 182 10 C 146 32, 106 56, 84 84 Z", r:"light"},
    {d:"M50 78 L24 96 q10 10 22 2 L74 84 Z", r:"accent"},
    {d:"M9 88 a13 13 0 1 0 26 0 a13 13 0 1 0 -26 0", r:"accent"},
    {d:"M14 88 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0", r:"detail"},
    {d:"M36 84 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0", r:"detail"},
    {d:"M46 90 a3 3 0 1 0 6 0 a3 3 0 1 0 -6 0", r:"detail"}
  ],
  knife2: [
    {d:"M66 30 L168 24 L203 44 L164 62 L66 54 Z", r:"base"},
    {d:"M74 37 L166 31 L190 44 L162 55 L74 48 Z", r:"light"},
    {d:"M56 26 h14 v34 H56 Z", r:"accent"},
    {d:"M14 32 h44 v24 H14 Z", r:"accent"},
    {d:"M14 32 h44 v6 H14 Z", r:"light"},
    {d:"M20 40 h5 v12 h-5 Z M30 40 h5 v12 h-5 Z M40 40 h5 v12 h-5 Z", r:"dark"},
    {d:"M2 34 h12 v20 H2 Z", r:"dark"},
    {d:"M5 40 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0", r:"detail"}
  ],
  knife4: [
    {d:"M92 40 C 118 20, 158 8, 196 10 C 202 20, 196 32, 180 36 C 150 42, 124 52, 106 64 Z", r:"base"},
    {d:"M100 42 C 124 26, 158 17, 190 17 C 184 24, 168 29, 152 33 C 130 39, 114 47, 106 58 Z", r:"light"},
    {d:"M70 30 a16 16 0 1 0 32 0 a16 16 0 1 0 -32 0", r:"accent"},
    {d:"M76 30 a10 10 0 1 0 20 0 a10 10 0 1 0 -20 0", r:"dark"},
    {d:"M78 44 L104 94 L84 104 L60 54 Z", r:"accent"},
    {d:"M84 52 L100 90 L92 94 L74 56 Z", r:"dark"},
    {d:"M64 46 L40 96 L20 86 L44 36 Z", r:"accent"},
    {d:"M58 52 L42 90 L34 86 L50 48 Z", r:"dark"}
  ],
  knife5: [
    {d:"M68 56 L146 22 L198 56 L146 90 L68 56 Z", r:"base"},
    {d:"M80 56 L146 30 L182 56 L146 82 L80 56 Z", r:"light"},
    {d:"M146 22 L198 56 L146 56 Z", r:"accent"},
    {d:"M146 90 L198 56 L146 56 Z", r:"accent"},
    {d:"M56 44 h16 v28 H56 Z", r:"accent"},
    {d:"M12 48 h44 v16 H12 Z", r:"accent"},
    {d:"M12 48 h44 v5 H12 Z", r:"light"},
    {d:"M2 46 h12 v20 H2 Z", r:"dark"},
    {d:"M5 52 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0", r:"detail"}
  ],
  scythe: [
    {d:"M12 102 L140 14 L150 28 L22 112 Z", r:"dark"},
    {d:"M18 98 L138 20 L142 26 L22 106 Z", r:"accent"},
    {d:"M132 28 C 158 8, 188 6, 204 18 C 186 30, 160 32, 138 40 Z", r:"base"},
    {d:"M138 30 C 160 16, 184 14, 198 20 C 182 28, 160 30, 142 36 Z", r:"light"},
    {d:"M126 34 L150 24 L156 38 L132 48 Z", r:"accent"},
    {d:"M34 88 l12 6 M42 76 l12 6 M50 64 l12 6", r:"dark"},
    {d:"M6 92 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0", r:"accent"},
    {d:"M10 92 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0", r:"detail"}
  ],
  sticker: [
    {d:"M46 24 H164 a20 20 0 0 1 20 20 V84 a20 20 0 0 1 -20 20 H46 a20 20 0 0 1 -20 -20 V44 a20 20 0 0 1 20 -20 Z", r:"base"},
    {d:"M50 30 H160 a14 14 0 0 1 14 14 V80 a14 14 0 0 1 -14 14 H50 a14 14 0 0 1 -14 -14 V44 a14 14 0 0 1 14 -14 Z", r:"light"},
    {d:"M58 42 H152 V88 H58 Z", r:"accent"},
    {d:"M105 44 l8 18 20 2 -15 13 5 19 -18 -10 -18 10 5 -19 -15 -13 20 -2 Z", r:"dark"},
    {d:"M58 42 H152 V48 H58 Z", r:"detail"},
    {d:"M170 92 L190 72 L190 92 Z", r:"detail"}
  ],
  charm: [
    {d:"M96 4 h8 v24 h-8 Z", r:"dark"},
    {d:"M84 22 a16 16 0 0 1 32 0", r:"accent"},
    {d:"M100 28 L134 52 L118 100 L82 100 L66 52 Z", r:"base"},
    {d:"M100 28 L116 52 L100 100 L84 52 Z", r:"light"},
    {d:"M66 52 L134 52 L118 100 L82 100 Z", r:"accent"},
    {d:"M84 52 L100 28 L116 52 L100 66 Z", r:"detail"},
    {d:"M100 66 L116 52 L100 100 Z", r:"dark"},
    {d:"M52 44 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0", r:"detail"},
    {d:"M136 44 a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0", r:"detail"}
  ]
};

function artFor(item){
  if(item.art === "knife"){
    const w = String(item.w);
    if (/(motylkow|butterfl)/i.test(w)) return "knife4";          // motylkowy
    if (/(sztylet|stiletto|cieni|shadow|dagger)/i.test(w)) return "knife5"; // sztylet
    if (/(karambit|kukri|szpon)/i.test(w)) return "knife";        // hakowaty
    if (/(talon|skeleton|szkielet|falchion|ursus|huntsman|bowie|navaja|nomad|paracord|survival|przeżycia)/i.test(w)) return "knife3"; // zakrzywiony
    return "knife2";                                              // prosty (gut, flip, bayonet...)
  }
  return item.art;
}

function patternSVG(id, kind, c){
  const P = {
    0:`<pattern id="${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(32)">
         <path d="M0 0 V12" stroke="${c}" stroke-width="5"/></pattern>`,
    1:`<pattern id="${id}" width="17" height="17" patternUnits="userSpaceOnUse">
         <circle cx="4" cy="4" r="3.2" fill="${c}"/><circle cx="12.5" cy="12.5" r="3.2" fill="${c}"/></pattern>`,
    2:`<pattern id="${id}" width="20" height="15" patternUnits="userSpaceOnUse" patternTransform="rotate(-8)">
         <rect width="20" height="5" fill="${c}"/></pattern>`,
    3:`<pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
         <ellipse cx="6" cy="7" rx="6.5" ry="4.5" fill="${c}"/><ellipse cx="16" cy="16" rx="5.5" ry="3.8" fill="${c}"/></pattern>`,
    4:`<pattern id="${id}" width="17" height="13" patternUnits="userSpaceOnUse">
         <path d="M0 11 L8.5 2 L17 11" fill="none" stroke="${c}" stroke-width="3.6"/></pattern>`
  };
  return P[kind] || P[0];
}

function weaponSVG(item, seed){
  const h = hash(item.w+"|"+item.n);
  const hue = Math.round(TIER[item.tier].hue*0.5 + (h%360)*0.5) % 360;
  const c = {
    base:   `hsl(${hue} 76% 56%)`,
    accent: `hsl(${(hue+44)%360} 72% 36%)`,
    light:  `hsl(${(hue+18)%360} 95% 79%)`,
    dark:   `hsl(${hue} 30% 17%)`,
    detail: `hsl(${hue} 24% 9%)`
  };
  const uid = ("s"+(seed||"")+h.toString(36)).replace(/[^a-zA-Z0-9_]/g,"");
  const parts = ART[artFor(item)] || ART.rifle;
  const shapes = parts.map(p=>`<path d="${p.d}" fill="${c[p.r]||c.base}"/>`).join("");
  const clip   = parts.map(p=>`<path d="${p.d}"/>`).join("");
  const kind   = h % 5;
  return `<svg viewBox="-6 -8 212 118" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
<defs>
  <clipPath id="${uid}c">${clip}</clipPath>
  ${patternSVG(uid+"p", kind, c.light)}
  <radialGradient id="${uid}g" cx="0.28" cy="0.16" r="0.92">
    <stop offset="0%" stop-color="#fff" stop-opacity=".3"/>
    <stop offset="55%" stop-color="#fff" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="${uid}v" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stop-color="#fff" stop-opacity=".12"/>
    <stop offset="42%" stop-color="#fff" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity=".38"/>
  </linearGradient>
</defs>
<g fill="${c.detail}" stroke="${c.detail}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">${shapes}</g>
<g>${shapes}</g>
<g clip-path="url(#${uid}c)">
  <rect x="-8" y="-10" width="220" height="124" fill="url(#${uid}p)" opacity=".27"/>
  <rect x="-8" y="-10" width="220" height="124" fill="url(#${uid}v)"/>
  <rect x="-8" y="-10" width="220" height="124" fill="url(#${uid}g)"/>
  <path d="M-12 100 L52 -12 L84 -12 L20 100 Z" fill="#fff" opacity=".11"/>
  <path d="M72 100 L136 -12 L152 -12 L88 100 Z" fill="#fff" opacity=".05"/>
</g>
<g clip-path="url(#${uid}c)" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="1.3">${clip}</g>
<g clip-path="url(#${uid}c)" fill="none" stroke="rgba(255,255,255,.2)" stroke-width="1.3" transform="translate(0,-1.6)">${clip}</g>
</svg>`;
}

function guessArt(w){
  const s = w.toLowerCase();
  if (/kosa|scythe/.test(s)) return "scythe";
  if (/naklejka|sticker/.test(s)) return "sticker";
  if (/ozdoba|charm|amulet|klejnot/.test(s)) return "charm";
  if (/nóż|karambit|bayonet|kukri|sztylet|talon|skeleton|falchion|stiletto|ursus|navaja|nomad|paracord|survival|shadow|szpon/.test(s)) return "knife";
  if (s.includes("awp")||s.includes("ssg")||s.includes("scar")||s.includes("g3sg")) return "awp";
  if (s.includes("m249")||s.includes("negev")||s.includes("lmg")) return "lmg";
  if (s.includes("r8")||s.includes("rewolwer")||s.includes("revolver")) return "revolver";
  if (s.includes("glock")||s.includes("usp")||s.includes("p250")||s.includes("deagle")||s.includes("desert")||s.includes("five")||s.includes("tec")||s.includes("p2000")||s.includes("berettas")||s.includes("cz75")) return "pistol";
  if (s.includes("nova")||s.includes("xm")||s.includes("mag-7")||s.includes("sawed")||s.includes("shotgun")) return "shotgun";
  if (s.includes("mp")||s.includes("mac")||s.includes("p90")||s.includes("ump")||s.includes("bizon")) return "smg";
  return "rifle";
}

/* =======================================================================
   4. WARTOŚĆ I LOSOWANIE
   ======================================================================= */
const VALUE_CACHE = new Map();
function itemValue(caseDef, tier, key){
  const ck = caseDef.id+"|"+tier+"|"+key;
  if(VALUE_CACHE.has(ck)) return VALUE_CACHE.get(ck);
  const o = baseOdds(caseDef);
  let S = 0;
  for (const t of TIERS) S += (o[t]||0) * RATIO_EFF[t];
  const k = (EV_MULT * caseDef.price) / S;
  const v = (hash(key)%1000)/1000;
  const val = roundNice(k * RATIO_EFF[tier] * (0.82 + v*0.36));
  VALUE_CACHE.set(ck, val);
  return val;
}
function fxEventPool(){ return FX.concat(eventFxList()); }
function fxEventActive(id){
  if(!state.fxEvents || typeof state.fxEvents !== "object" || Array.isArray(state.fxEvents)) return false;
  return numFrom(state.fxEvents[id]) > Date.now();
}
function fxEventCount(){ return fxEventPool().filter(f=>fxEventActive(f.id)).length; }
function fxEventPrice(f){
  return FX_EVENT_PRICE[f.id] || Math.max(1000, Math.round(roundNice(f.mult*f.mult*500)));
}

/* ✨ losowanie efektu — droższe tiery mają go trochę częściej.
   Event efektu podbija wagę wybranego efektu, a każdy aktywny event dodaje
   +FX_EVENT_LUCK do ogólnej szansy na jakikolwiek efekt. */
function rollFx(tier){
  const boost = (FX_TIER_BOOST[tier] || 1) * (1 + FXHUNT_STEP*upLvl("fxhunt"));   // ✨ Łowca błysków
  const pool = fxEventPool();
  const baseTotal = pool.reduce((a,f)=>a + f.chance*boost, 0);
  const active = fxEventCount();
  const totalChance = Math.min(0.95, baseTotal * (1 + FX_EVENT_LUCK*active));
  const weights = pool.map(f=>f.chance*boost*(fxEventActive(f.id) ? FX_EVENT_BOOST : 1));
  const wsum = weights.reduce((a,b)=>a+b,0);
  if(wsum <= 0) return null;
  const r = Math.random();
  if(r >= totalChance) return null;
  let pick = Math.random()*wsum;
  let acc = 0;
  for(let i=0;i<pool.length;i++){
    acc += weights[i];
    if(pick < acc) return pool[i].id;
  }
  return null;
}
const fxOf    = it => { if(!it || !it.fx) return null; return FX_BY_ID[it.fx] || EVENT_FX_BY_ID[it.fx] || null; };
const fxMult  = it => { const f = fxOf(it); return f ? f.mult : 1; };
const fxBoostTxt = f => "+" + Math.round((f.mult-1)*100) + "% wartości";
/* polski przecinek w mnożniku: 1,8 zamiast 1.8 */
const fxM = f => String(f.mult).replace(".", ",");
const fxClass = it => { const f = fxOf(it); return f ? " fx fx-"+f.id : ""; };
function fxBadge(it){
  const f = fxOf(it);
  if(!f) return "";
  return `<span class="fx-badge" title="${f.name} — ${f.glow} · ${fxBoostTxt(f)}">${f.icon} ${f.name} ×${fxM(f)}</span>`;
}
/* ile razy w tym zapisie wypadł dany efekt (zwykły lub eventowy) */
const fxCount = id => numFrom((state.stats && state.stats.fx && state.stats.fx[id]) || 0);

function makeItem(caseDef, tier){
  const [w,n,art] = pick(caseDef.items[tier]);
  const fx = rollFx(tier);
  const f = fx ? (FX_BY_ID[fx] || EVENT_FX_BY_ID[fx]) : null;
  return {
    uid: "i"+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    w, n, art, tier, caseId: caseDef.id,
    fx,                                    // ✨ efekt (null, gdy brak)
    value: Math.round(itemValue(caseDef, tier, w+"|"+n) * valueBoost() * (f ? f.mult : 1)),
    ts: Date.now()
  };
}
function pickTier(caseDef){
  const o = oddsFor(caseDef);
  const r = Math.random(); let acc = 0;
  for (const t of TIERS){ acc += o[t]||0; if(r<acc) return t; }
  return "mil";
}
const itemSell = i => i.fixedSell ? numFrom(i.fixedSell) : Math.round(i.value * sellRate());
const casePrice = id => (CASES.find(c=>c.id===id)||{}).price || 0;

/* =======================================================================
   5. STAN + TRWAŁY ZAPIS
   ======================================================================= */
const SAVE_KEY  = "caseOpenerSave_v3";
const SAVE_BAK  = "caseOpenerSave_v3_bak";
const LEGACY_KEYS = ["caseOpenerSave_v2","caseOpenerSave_v1"];
const START_COINS = 5000;
let state = {
  coins: START_COINS, inv: [], recent: [], battles: [],
  stats:{opened:0, spent:0, earned:0, sold:0, knives:0, relics:0, rescues:0, battles:0, battleWins:0, clovers:0, albums:0, fx:{}, fxTotal:0, best:null, cases:{},
    codeDrops:0, codeRedeems:0, codeBuys:0, trollOpened:0, trollWins:0, shopBuys:0, shopSpent:0, shopCases:0, packBuys:0, packSpent:0},
  up: UP_ZERO(),
  album:{}, albumClaimed:{}, missions:null, weekly:null, achievements:{}, cosmetics:{}, bossKills:{}, idleKnifeClaimed:false, idleSec:0,
  caseStock:{}, botSalt:0, botBought:{}, botRefreshAt:0, botUnlocked:{},
  shopSalt:0, shopBought:{}, shopRefreshAt:0, packClaims:{},
  codes:{}, codeRedeemed:{}, codeBought:{},
  sound:true, fast:false, bonusAt:0, rescueAt:0, cloverUntil:0, fxEvents:{}, battleCase:"start", battleSize:1,
  autoTurbo:false, autoLimit:0, exp:0, rank:1
};

/* unikatowy identyfikator tej karty — pozwala wykryć grę w dwóch oknach */
const TAB_ID = "t" + Math.random().toString(36).slice(2,9) + Date.now().toString(36);
let saveRev = 0;              // rośnie z każdym zapisem
let knownRev = 0;             // ostatnia rewizja, o której wiemy
let dirty = false;            // są niezapisane zmiany?
let saveFails = 0;
let bakAt = 0;
let merging = false;
let lastSavedCoins = null;      // stan monet w chwili ostatniego zapisu
let otherTabWarned = false;
/* Cache zapisu: bez tego każdy drop parsował cały save dwa razy. */
let lastSaveRaw = null;         // dokładny string ostatniego udanego zapisu
let externalSaveDirty = true;   // inna karta coś zapisała (storage event)
let lastExternalCheck = 0;      // awaryjne sprawdzenie innych kart co 5 s
window.addEventListener("storage", e=>{
  if(e.key === SAVE_KEY || e.key === SAVE_BAK) externalSaveDirty = true;
});

function markDirty(){ dirty = true; }

/* Bezpieczna liczba z zapisu. Uwaga: |0 ucina wszystko powyżej 2^31 — a znaczniki
   czasu (ms) i duże statystyki już dawno ten limit przekraczają, więc parsujemy normalnie. */
function numFrom(v){ return (typeof v === "number" && isFinite(v)) ? Math.max(0, Math.round(v)) : 0; }
function validInv(inv){
  return (Array.isArray(inv)?inv:[]).filter(i=>i && typeof i.value==="number" && i.tier && TIER[i.tier]);
}
function readSave(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return null;
    const d = JSON.parse(raw);
    return (d && typeof d==="object") ? d : null;
  }catch(e){ return null; }
}

/* --- scalanie stanu z innej karty/okna: nic nie ginie --- */
function mergeFrom(other){
  const byUid = new Map();
  validInv(state.inv).forEach(i=>byUid.set(i.uid,i));
  let added = 0;
  validInv(other.inv).forEach(i=>{ if(!byUid.has(i.uid)){ byUid.set(i.uid,i); added++; } });
  state.inv = [...byUid.values()].sort((a,b)=>(b.ts||0)-(a.ts||0));

  const s = other.stats || {}, m = state.stats;
  m.opened = Math.max(numFrom(m.opened), numFrom(s.opened));
  m.spent  = Math.max(numFrom(m.spent),  numFrom(s.spent));
  m.earned = Math.max(numFrom(m.earned), numFrom(s.earned));
  m.sold   = Math.max(numFrom(m.sold),   numFrom(s.sold));
  m.knives = Math.max(numFrom(m.knives), numFrom(s.knives));
  m.relics = Math.max(numFrom(m.relics), numFrom(s.relics));
  if (s.best && (!m.best || s.best.value > m.best.value)) m.best = s.best;
  Object.entries(s.cases||{}).forEach(([k,v])=>{ m.cases[k] = Math.max(numFrom(m.cases[k]), numFrom(v)); });
  // ✨ efekty na broniach — bierzemy większą liczbę z obu okien (nic nie ginie)
  const ofx = (s.fx && typeof s.fx === "object" && !Array.isArray(s.fx)) ? s.fx : {};
  m.fx = (m.fx && typeof m.fx === "object" && !Array.isArray(m.fx)) ? m.fx : {};
  Object.keys(ofx).forEach(k=>{ m.fx[k] = Math.max(numFrom(m.fx[k]), numFrom(ofx[k])); });
  m.fxTotal = Math.max(numFrom(m.fxTotal), numFrom(s.fxTotal));
  m.codeDrops = Math.max(numFrom(m.codeDrops), numFrom(s.codeDrops));
  m.codeRedeems = Math.max(numFrom(m.codeRedeems), numFrom(s.codeRedeems));
  m.codeBuys = Math.max(numFrom(m.codeBuys), numFrom(s.codeBuys));
  m.shopBuys = Math.max(numFrom(m.shopBuys), numFrom(s.shopBuys));
  m.shopSpent = Math.max(numFrom(m.shopSpent), numFrom(s.shopSpent));
  m.shopCases = Math.max(numFrom(m.shopCases), numFrom(s.shopCases));
  m.packBuys = Math.max(numFrom(m.packBuys), numFrom(s.packBuys));
  m.packSpent = Math.max(numFrom(m.packSpent), numFrom(s.packSpent));
  const osb = (other.shopBought && typeof other.shopBought === "object" && !Array.isArray(other.shopBought)) ? other.shopBought : {};
  state.shopBought = (state.shopBought && typeof state.shopBought === "object" && !Array.isArray(state.shopBought)) ? state.shopBought : {};
  Object.keys(osb).forEach(k=>{ state.shopBought[k] = Math.max(numFrom(state.shopBought[k]), numFrom(osb[k])); });
  /* 🎁 pakiety — jednorazowe odbioru (starter) nie mogą zginąć przy dwóch oknach */
  const opc = (other.packClaims && typeof other.packClaims === "object" && !Array.isArray(other.packClaims)) ? other.packClaims : {};
  state.packClaims = (state.packClaims && typeof state.packClaims === "object" && !Array.isArray(state.packClaims)) ? state.packClaims : {};
  Object.keys(opc).forEach(k=>{ if(opc[k]) state.packClaims[k] = true; });
  /* 🎰 eventy efektów — przy grze w dwóch oknach liczy się dłuższy czas */
  const ofxEv = (other.fxEvents && typeof other.fxEvents === "object" && !Array.isArray(other.fxEvents)) ? other.fxEvents : {};
  state.fxEvents = (state.fxEvents && typeof state.fxEvents === "object" && !Array.isArray(state.fxEvents)) ? state.fxEvents : {};
  Object.keys(ofxEv).forEach(k=>{ state.fxEvents[k] = Math.max(numFrom(state.fxEvents[k]), numFrom(ofxEv[k])); });

  // 📅 misje tygodniowe — ta sama pula: scalamy postęp i odebrania
  const ow = other.weekly;
  if(ow && typeof ow === "object" && Array.isArray(ow.list) && ow.list.length){
    if(!state.weekly || !Array.isArray(state.weekly.list) || !state.weekly.list.length){
      state.weekly = ow;                                   // nie mamy nic — bierzemy z drugiej karty
    } else if(numFrom(ow.start) > numFrom(state.weekly.start)){
      state.weekly = ow;                                   // nowszy zestaw wygrywa
    } else if(numFrom(ow.start) === numFrom(state.weekly.start)){
      const mine = state.weekly.list;
      ow.list.forEach(x=>{
        if(!x) return;
        const m2 = mine.find(y=>y && y.kind===x.kind && (y.goal|0)===(x.goal|0));
        if(!m2) return;
        m2.prog = Math.max(m2.prog|0, x.prog|0);
        m2.claimed = m2.claimed || !!x.claimed;
      });
      state.weekly.rerolls = Math.max(numFrom(state.weekly.rerolls), numFrom(ow.rerolls));
    }
  }

  // monety: przyjmujemy wersję z nowszego zapisu, ale TYLKO jeśli sami
  // nie zmieniliśmy monet od ostatniego zapisu (inaczej cofnęlibyśmy sobie zakupy)
  if (state.coins === lastSavedCoins && typeof other.coins === "number")
    state.coins = other.coins;

  const seen = new Set(state.recent.map(r=>r.uid));
  (other.recent||[]).forEach(r=>{ if(r && r.uid && !seen.has(r.uid)) state.recent.push(r); });
  state.recent.sort((a,b)=>(b.ts||0)-(a.ts||0));
  state.recent = state.recent.slice(0,24);

  // 📖 album kolekcji — scalanie znalezisk z obu okien (nic nie ginie)
  const oa = other.album;
  if(oa && typeof oa === "object" && !Array.isArray(oa))
    Object.keys(oa).forEach(k=>{ state.album[k] = Math.max(state.album[k]|0, oa[k]|0); });
  const oc = other.albumClaimed;
  if(oc && typeof oc === "object")
    Object.keys(oc).forEach(k=>{ if(oc[k]) state.albumClaimed[k] = true; });

  // 🔑 kody — nic nie ginie przy grze w dwóch oknach
  ["codes","codeRedeemed"].forEach(key=>{
    const src = other[key];
    if(!src || typeof src !== "object" || Array.isArray(src)) return;
    state[key] = (state[key] && typeof state[key] === "object" && !Array.isArray(state[key])) ? state[key] : {};
    Object.keys(src).forEach(k=>{ state[key][k] = Math.max(numFrom(state[key][k]), numFrom(src[k])); });
  });
  const ob = other.codeBought;
  if(ob && typeof ob === "object" && !Array.isArray(ob)){
    state.codeBought = (state.codeBought && typeof state.codeBought === "object") ? state.codeBought : {};
    Object.keys(ob).forEach(k=>{ if(ob[k]) state.codeBought[k] = true; });
  }
  return added;
}

let flagTimer = null;
function flashSaved(kind){
  const el = $("#saveFlag");
  if(!el) return;
  el.textContent = kind === "relic" ? "✦ relikt zapisany" : kind === "rare" ? "🛡️ nóż zapisany" : kind === "code" ? "🔑 kod zapisany" : kind === "drop" ? "✓ drop zapisany" : "✓ zapisano";
  el.classList.toggle("rare", kind === "rare" || kind === "relic" || kind === "code");
  /* Przy auto-otwieraniu nie wymuszamy reflow co drop — plakietka i tak
     mruga kilka razy na sekundę. */
  if(autoOpen || state.fast || document.hidden){
    el.classList.add("show");
  } else {
    el.classList.remove("show"); void el.offsetWidth; el.classList.add("show");
  }
  clearTimeout(flagTimer);
  flagTimer = setTimeout(()=>el.classList.remove("show"), 1900);
}

function snapshot(){
  return { v:3, tab:TAB_ID, rev:saveRev, ts:Date.now(),
    coins:state.coins, inv:state.inv, recent:state.recent, stats:state.stats,
    battles:state.battles, battleCase:state.battleCase, battleSize:state.battleSize,
    up:state.up,
    sound:state.sound, fast:state.fast, bonusAt:state.bonusAt, rescueAt:state.rescueAt,
    autoTurbo:state.autoTurbo === true, autoLimit:autoLimitSan(state.autoLimit),
    exp:numFrom(state.exp), rank:numFrom(state.rank)||1,
    cloverUntil:state.cloverUntil||0,
    fxEvents:state.fxEvents || {},
    album:state.album, albumClaimed:state.albumClaimed, missions:state.missions, weekly:state.weekly, achievements:state.achievements, cosmetics:state.cosmetics, bossKills:state.bossKills,
    idleKnifeClaimed:state.idleKnifeClaimed===true, idleSec:numFrom(state.idleSec),
    codes:state.codes, codeRedeemed:state.codeRedeemed, codeBought:state.codeBought,
    caseStock:state.caseStock, botSalt:state.botSalt, botBought:state.botBought, botRefreshAt:state.botRefreshAt, botUnlocked:state.botUnlocked,
    shopSalt:state.shopSalt, shopBought:state.shopBought, shopRefreshAt:state.shopRefreshAt,
    packClaims:state.packClaims || {} };
}

/* Zapis z weryfikacją + wykrywaniem gry w dwóch oknach.
   force=true => pomija kopię zapasową (używane przy autozapisie). */
function save(opts){
  opts = opts || {};
  try{
    // Inną kartę sprawdzamy od razu po storage event albo awaryjnie co 5 s.
    // Przy zwykłym dropie nie ma sensu parsować całego save'a przed zapisem.
    let stored = null, storedRaw = null;
    if(externalSaveDirty || Date.now() - lastExternalCheck > 5000){
      storedRaw = localStorage.getItem(SAVE_KEY);
      if(storedRaw){
        try{ stored = JSON.parse(storedRaw); }catch(e){ stored = null; }
      }
      externalSaveDirty = false;
      lastExternalCheck = Date.now();
    }

    if(stored && stored.tab && stored.tab !== TAB_ID && (stored.rev|0) > knownRev){
      // inne okno zapisało coś po nas — scal zamiast nadpisywać
      const added = mergeFrom(stored);
      knownRev = stored.rev|0;
      saveRev  = Math.max(saveRev, knownRev);
      if(Date.now() - (stored.ts||0) < 12000 && !otherTabWarned && !merging){
        otherTabWarned = true;
        toast("🪟 Gra jest otwarta w <b>innej karcie</b> — graj w jednej, żeby uniknąć bałaganu","bad");
      }
      if(added > 0 && !merging){
        merging = true;
        toast("🛡️ Odzyskano <b>"+added+"</b> przedmiot(ów) z innego okna","good");
        setTimeout(()=>{ renderInv(); renderShop(); renderBalance(); merging=false; }, 0);
      }
    }

    // kopia poprzedniej wersji (max raz na 15 s) — bez ponownego parsowania
    if(Date.now() - bakAt > 15000 && (storedRaw || lastSaveRaw)){
      try{ localStorage.setItem(SAVE_BAK, storedRaw || lastSaveRaw); bakAt = Date.now(); }catch(e){}
    }

    saveRev = Math.max(saveRev, knownRev) + 1;
    const raw = JSON.stringify(snapshot());
    localStorage.setItem(SAVE_KEY, raw);

    // weryfikacja: dokładnie ten sam string jest już w pamięci przeglądarki
    if(localStorage.getItem(SAVE_KEY) !== raw)
      throw new Error("weryfikacja zapisu nie powiodła się");

    lastSaveRaw = raw;
    knownRev = saveRev;
    dirty = false; saveFails = 0;
    lastSavedCoins = state.coins;
    flashSaved(opts.kind);
    return true;
  }catch(e){
    saveFails++;
    if(saveFails <= 3) toast("⚠️ Nie udało się zapisać postępu (pamięć przeglądarki pełna?)","bad");
    return false;
  }
}

/* zapis konkretnie po zdobyciu przedmiotu — najważniejszy moment */
function saveDrop(item){
  const kind = item && item.tier === "relic" ? "relic" : item && item.tier === "special" ? "rare" : "drop";
  return save({kind});
}

function isValidSave(d){
  return !!(d && typeof d === "object" && Array.isArray(d.inv) && typeof d.coins === "number");
}

function load(){
  // Główny zapis ma zawsze pierwszeństwo. Kopia zapasowa i starsze wersje
  // służą wyłącznie do ratunku, gdy główny zapis jest brakujący/uszkodzony.
  let d = readSave(SAVE_KEY), fromBackup = false;
  if(!isValidSave(d)){
    const b = readSave(SAVE_BAK);
    if(isValidSave(b)){ d = b; fromBackup = true; }
    else d = LEGACY_KEYS.map(readSave).find(isValidSave) || null;
  }
  if(!isValidSave(d)) return;
  if(fromBackup) setTimeout(()=>toast("🛠️ Główny zapis był uszkodzony — wczytano kopię zapasową","bad"), 900);

  if(typeof d.coins === "number") state.coins = d.coins;
  state.inv    = validInv(d.inv);
  state.recent = Array.isArray(d.recent) ? d.recent.filter(r=>r&&r.uid) : [];
  state.stats  = Object.assign(state.stats, d.stats||{});
  if(!state.stats.cases || typeof state.stats.cases !== "object") state.stats.cases = {};
  state.sound  = d.sound !== false;
  state.fast   = d.fast === true;
  state.bonusAt= d.bonusAt || 0;
  state.rescueAt = d.rescueAt || 0;
  state.cloverUntil = numFrom(d.cloverUntil);   // ⚠ bez |0 — inaczej koniczyna „ginęła” przy odświeżeniu
  state.fxEvents = (d.fxEvents && typeof d.fxEvents === "object" && !Array.isArray(d.fxEvents)) ? d.fxEvents : {};
  state.autoTurbo = d.autoTurbo === true;       // ⚡ tryb turbo (ustawienie, nie stan biegu)
  state.autoLimit = autoLimitSan(d.autoLimit);  // ⏹ limit otwarć (0 = bez limitu)
  state.exp = numFrom(d.exp);
  state.rank = numFrom(d.rank) || 1;
  albumLoad(d);                    // 📖 album kolekcji (migruje stare zapisy)
  missionsLoad(d);                 // 🎯 misje dzienne (nowe, gdy zmienił się dzień)
  weeklyLoad(d);                   // 📅 misje tygodniowe (nowe co 7 dni)
  state.up = Object.assign(UP_ZERO(), d.up||{});
  UPGRADES.forEach(u=>{ state.up[u.id] = Math.max(0, Math.min(u.max, state.up[u.id]|0)); });
  const known = new Set(UPGRADES.map(u=>u.id));
  Object.keys(state.up).forEach(k=>{ if(!known.has(k)) delete state.up[k]; });   // usuwa wycofane perki
  if(typeof state.stats.rescues !== "number") state.stats.rescues = 0;
  if(typeof state.stats.clovers !== "number") state.stats.clovers = 0;
  if(typeof state.stats.battles !== "number") state.stats.battles = 0;
  if(typeof state.stats.battleWins !== "number") state.stats.battleWins = 0;
  if(typeof state.stats.albums !== "number") state.stats.albums = 0;
  if(typeof state.stats.relics !== "number") state.stats.relics = 0;
  state.battles = Array.isArray(d.battles) ? d.battles.filter(b=>b && b.cn).slice(0,8) : [];
  state.battleCase = CASES.some(c=>c.id===d.battleCase && !c.botOnly && !c.noBattle) ? d.battleCase : "start";
  state.battleSize = [1,2,3,5].includes(d.battleSize) ? d.battleSize : 1;
  /* 🤖 bazar botów — zapas skrzynek i wykupione oferty */
  state.caseStock = (d.caseStock && typeof d.caseStock === "object" && !Array.isArray(d.caseStock)) ? d.caseStock : {};
  Object.keys(state.caseStock).forEach(k=>{
    state.caseStock[k] = numFrom(state.caseStock[k]);
    if(!state.caseStock[k]) delete state.caseStock[k];
  });
  state.botSalt = numFrom(d.botSalt);
  state.botBought = (d.botBought && typeof d.botBought === "object" && !Array.isArray(d.botBought)) ? d.botBought : {};
  state.botRefreshAt = numFrom(d.botRefreshAt);
  /* 🛒 sklep — osobny zapas, żeby nie kolidował z bazarowym */
  state.shopSalt = numFrom(d.shopSalt);
  state.shopBought = (d.shopBought && typeof d.shopBought === "object" && !Array.isArray(d.shopBought)) ? d.shopBought : {};
  state.shopRefreshAt = numFrom(d.shopRefreshAt);
  state.packClaims = (d.packClaims && typeof d.packClaims === "object" && !Array.isArray(d.packClaims)) ? d.packClaims : {};
  /* skrzynki botów są jednorazowe — stary zapis mógł mieć flagę „odblokowana”,
     ale jej nie używamy: po otwarciu trzeba kupić kolejną u bota. */
  state.botUnlocked = {};
  /* 🔑 kody — walidujemy tylko znane wpisy, żeby stare/uszkodzone zapisy nie psuły widoku */
  const loadCodeMap = (src, onlyTrue) => {
    const out = {};
    if(src && typeof src === "object" && !Array.isArray(src)){
      Object.keys(src).forEach(k=>{
        if(!CODE_BY_ID[k]) return;
        if(onlyTrue){ if(src[k]) out[k] = true; }
        else { const n = numFrom(src[k]); if(n > 0) out[k] = n; }
      });
    }
    return out;
  };
  state.codes = loadCodeMap(d.codes, false);
  state.codeRedeemed = loadCodeMap(d.codeRedeemed, false);
  state.codeBought = loadCodeMap(d.codeBought, true);
  ["codeDrops","codeRedeems","codeBuys"].forEach(k=>{ if(typeof state.stats[k] !== "number") state.stats[k] = 0; });
  state.idleKnifeClaimed = d.idleKnifeClaimed === true;
  state.idleSec = numFrom(d.idleSec);
  ["botBuys","botSpent","botCases","stockOpened","bestDeal","trollOpened","trollWins","shopBuys","shopSpent","shopCases","packBuys","packSpent"].forEach(k=>{
    if(typeof state.stats[k] !== "number") state.stats[k] = 0;
  });
  saveRev = d.rev|0; knownRev = saveRev;
  lastSavedCoins = state.coins;
}

/* --- eksport / import zapisu (ręczna kopia bezpieczeństwa) --- */
function exportSave(){
  save();
  const raw = localStorage.getItem(SAVE_KEY);
  if(!raw){ toast("Brak zapisu do skopiowania","bad"); return; }
  const code = btoa(unescape(encodeURIComponent(raw)));
  const done = ()=>{ toast("📋 Kod zapisu skopiowany do schowka","good"); };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(done).catch(()=>prompt("Skopiuj kod zapisu:", code));
  } else prompt("Skopiuj kod zapisu:", code);
}
function importSave(){
  const code = prompt("Wklej kod zapisu (z przycisku „Kopia zapisu”):","");
  if(!code) return;
  try{
    const raw = decodeURIComponent(escape(atob(code.trim())));
    const d = JSON.parse(raw);
    if(!d || typeof d !== "object") throw new Error("zły kod");
    const inv = validInv(d.inv);
    if(!confirm("Wczytać zapis? Obecny stan ("+state.inv.length+" przedmiotów, 🪙 "+fmt(state.coins)+") zostanie nadpisany.\n\nW kodzie: "
      + inv.length + " przedmiotów, 🪙 " + fmt(d.coins||0) + ".")) return;
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v:3, tab:TAB_ID, rev:0, ts:Date.now(), coins:d.coins||0, inv,
      recent:Array.isArray(d.recent)?d.recent:[], stats:d.stats||state.stats,
      codes:d.codes||{}, codeRedeemed:d.codeRedeemed||{}, codeBought:d.codeBought||{},
      sound:state.sound, fast:state.fast, bonusAt:0 }));
    location.reload();
  }catch(e){ toast("❌ Nieprawidłowy kod zapisu","bad"); }
}


/* =======================================================================
   6. DŹWIĘK
   ======================================================================= */
let AC = null;
function ac(){
  if(!state.sound) return null;
  if(!AC){ try{ AC = new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return null; } }
  if(AC.state === "suspended") AC.resume();
  return AC;
}
function beep(freq, dur, type, vol, when){
  const c = ac(); if(!c) return;
  const t0 = c.currentTime + (when||0);
  const o = c.createOscillator(), g = c.createGain();
  o.type = type||"square"; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol||0.05, t0+0.007);
  g.gain.exponentialRampToValueAtTime(0.0001, t0+(dur||0.06));
  o.connect(g); g.connect(c.destination);
  o.start(t0); o.stop(t0+(dur||0.06)+0.03);
}
function sfxTick(){ beep(1250 + Math.random()*420, 0.03, "square", 0.022); }
function sfxWin(tier, fx){
  const sets = {
    relic:      [392,523,659,784,1046,1318,1568,2093],
    special:    [523,659,784,1046,1318,1568,2093],
    covert:     [523,659,784,1046,1318],
    classified: [440,554,659,880],
    restricted: [392,494,587],
    mil:        [330,415]
  };
  (sets[tier]||sets.mil).forEach((f,i)=>beep(f, 0.26, "triangle", 0.055, i*0.085));
  if (tier==="relic"||tier==="special"||tier==="covert") beep(120, 0.7, "sine", 0.09, 0);
  /* ✨ rzadki efekt dorzuca własny błysk na koniec fanfary */
  if (fx==="diamond"||fx==="rainbow"||fx==="cosmic"){
    beep(1568,0.22,"triangle",0.05,0.55); beep(2093,0.34,"triangle",0.045,0.73); beep(2637,0.42,"sine",0.04,0.95);
  } else if (fx){
    beep(1318,0.2,"triangle",0.045,0.46); beep(1760,0.28,"triangle",0.04,0.62);
  }
}
function sfxCoin(){ beep(940,0.055,"triangle",0.05); beep(1420,0.1,"triangle",0.045,0.06); }
function sfxClover(){ beep(1180,0.07,"triangle",0.042); beep(1580,0.07,"triangle",0.038,0.085); beep(2100,0.16,"triangle",0.034,0.17); }
function sfxCode(){ beep(880,0.08,"triangle",0.048); beep(1175,0.08,"triangle",0.044,0.075); beep(1568,0.12,"triangle",0.04,0.15); beep(2093,0.22,"sine",0.035,0.24); }
function sfxErr(){ beep(150,0.18,"sawtooth",0.045); }
function sfxWhoosh(){
  const c = ac(); if(!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type="sawtooth";
  o.frequency.setValueAtTime(160, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(90, c.currentTime+0.4);
  g.gain.setValueAtTime(0.045, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime+0.45);
  o.connect(g); g.connect(c.destination); o.start(); o.stop(c.currentTime+0.5);
}

/* =======================================================================
   7. UI POMOCNICZE
   ======================================================================= */
function toast(msg, kind){
  const el = document.createElement("div");
  el.className = "toast " + (kind||"");
  el.innerHTML = msg;
  $("#toasts").appendChild(el);
  setTimeout(()=>{ el.style.transition=".32s"; el.style.opacity="0"; el.style.transform="translateX(30px)"; }, 2300);
  setTimeout(()=>el.remove(), 2700);
}
let lastBalance = null;   // wartość, od której startuje kolejna animacja
let balShown = null;      // aktualnie wyświetlana (animowana) wartość
let balRAF = null;        // uchwyt trwającej animacji licznika monet
function renderBalance(instant){
  const el = $("#balance"), to = state.coins;

  // KLUCZOWE: ubij poprzednią animację. Bez tego np. sprzedaż zaraz po
  // dropie uruchamiała drugą pętlę i obie pisały do licznika naraz.
  if(balRAF){ cancelAnimationFrame(balRAF); balRAF = null; }

  const bal = document.querySelector(".balance");
  const prev = lastBalance;
  el.title = "🪙 " + fmt(to);

  /* Przy auto-otwieraniu licznik zmienia się kilka razy na sekundę.
     Animowanie go i wymuszanie reflow za każdym razem tylko szkodzi. */
  if(autoOpen || state.fast || document.hidden){
    lastBalance = to;
    balShown = to;
    el.textContent = fmtShort(to);
    if(bal) bal.classList.remove("flash","down");
    return;
  }

  const from = (instant || prev === null || Math.abs(to-prev) < 1 || balShown === null) ? to : balShown;
  lastBalance = to;
  balShown = from;

  if(from === to){
    el.textContent = fmtShort(to);
    balShown = to;
  } else {
    const t0 = performance.now(), dur = 430;
    const step = now=>{
      const p = Math.min(1, (now-t0)/dur);
      if(p >= 1){ balRAF = null; balShown = to; el.textContent = fmtShort(to); return; }
      const e = 1-Math.pow(1-p,3);
      balShown = from + (to-from)*e;
      el.textContent = fmtShort(balShown);
      balRAF = requestAnimationFrame(step);
    };
    balRAF = requestAnimationFrame(step);
  }

  if(bal){
    bal.classList.remove("flash","down");
    void bal.offsetWidth;
    bal.classList.add(to>=from ? "flash" : "down");
  }
}
function switchView(v){
  currentView = v;
  $$(".tab").forEach(t=>t.classList.toggle("active", t.dataset.view===v));
  $$(".view").forEach(s=>s.classList.toggle("active", s.id==="view-"+v));
  if(v==="inv") renderInv();
  if(v==="stats") renderStats();
  if(v==="up") renderUp();
  if(v==="album") renderAlbum();
  if(v==="daily") renderDaily();
  if(v==="battle") renderBattle();
  if(v==="bots") renderBots();
  if(v==="market") renderMarket();
  if(v==="codes") renderCodes();
  if(v==="casino"){ renderCoinflip(); renderCasinoProfile(); }
}