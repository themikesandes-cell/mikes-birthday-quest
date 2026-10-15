/* =========================================================================
   FLAPPY MIKE — Cubatão → Cachoeira do Pilão → Santos → A FESTA
   ========================================================================= */
(() => {
'use strict';

/* ---------- EDITE AQUI os dados da festa ---------- */
const CONFIG = {
  festa: {
    titulo:    'NIVER DO MIKE',
    data:      'A CONFIRMAR',      // ex: 'SÁB, 25 DE OUTUBRO'
    hora:      '',                 // ex: '20H'
    local:     'A CONFIRMAR',      // ex: 'BAR DO ZÉ — SANTOS'
    mapa:      '',                 // link do Google Maps (opcional)
    confirmar: '',                 // link do WhatsApp p/ confirmar presença (opcional)
  },
  vidas: 3,
};

const PHASES = [
  { id:'cubatao', nome:'CUBATÃO',            obst:8,  speed:150, gap:184, spacing:212, kind:'pipe',     glow:'#e0644a' },
  { id:'pilao',   nome:'CACHOEIRA DO PILÃO', obst:10, speed:162, gap:174, spacing:206, kind:'tronco',   glow:'#e9a24b' },
  { id:'santos',  nome:'SANTOS',             obst:12, speed:176, gap:166, spacing:200, kind:'concreto', glow:'#7a4fd0' },
];
const IBIS_PER_PHASE = 5;
const TOTAL_IBIS = IBIS_PER_PHASE * PHASES.length;

/* sprites (âncora = centro da cabeça, em px da imagem) */
const SPRITES = {
  feliz:  { w:379, h:231, ax:231.5, ay:77.4 },
  bate:   { w:304, h:205, ax:191.2, ay:70.6 },
  quase:  { w:267, h:212, ax:149.9, ay:66.9 },
  triste: { w:343, h:195, ax:246.9, ay:125.0 },
  pronto: { w:264, h:202, ax:155.4, ay:69.3 },
};
const SPR_SCALE = 0.33;          // px lógicos por px da sprite
const HIT_R = 21;                // raio da hitbox (generoso)

/* ---------- constantes de mundo ---------- */
const W = 360, H = 640, LW = 720;
let VH = 640, PADT = 0;   // altura lógica visível (telas altas mostram mais céu/chão)
const GRAV = 1500, FLAP = -440, MAXFALL = 640;
const MIKE_X = 100;
const OBST_W = 62;
const GROUND_Y = 600;

/* ---------- utilidades ---------- */
const $ = s => document.querySelector(s);
const clamp = (v,a,b) => v<a?a:v>b?b:v;
const lerp = (a,b,t) => a+(b-a)*t;
const TAU = Math.PI*2;
function rng(seed){ return () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const store = {
  get(k,d){ try{ const v = localStorage.getItem('flappymike.'+k); return v===null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k,v){ try{ localStorage.setItem('flappymike.'+k, JSON.stringify(v)); }catch(e){} },
};

/* ---------- canvas ---------- */
const game = $('#game'), cv = $('#c'), ctx = cv.getContext('2d');
let S = 1; // px de backing por unidade lógica
function mk(w,h){ const c = document.createElement('canvas'); c.width = Math.ceil(w*S); c.height = Math.ceil(h*S); const x = c.getContext('2d'); x.setTransform(S,0,0,S,0,0); return [c,x]; }

const img = {};
for (const k in SPRITES){ const i = new Image(); i.src = `assets/sprites/mike-${k}.webp`; img[k] = i; }

/* ======================================================================
   ÁUDIO (sintetizado, sem arquivos)
   ====================================================================== */
let AC = null, master = null, soundOn = store.get('sound', true);
function audio(){
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = soundOn ? .55 : 0; master.connect(AC.destination);
  } catch(e){ AC = null; }
}
function tone(f, d, type='square', v=.2, f2=null, delay=0){
  if (!AC || !soundOn) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t+d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t+.008); g.gain.exponentialRampToValueAtTime(.0008, t+d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t+d+.02);
}
function noise(d, v=.2, freq=900, delay=0){
  if (!AC || !soundOn) return;
  const t = AC.currentTime + delay, n = Math.floor(AC.sampleRate*d), b = AC.createBuffer(1, n, AC.sampleRate), ch = b.getChannelData(0);
  for (let i=0;i<n;i++) ch[i] = (Math.random()*2-1) * (1-i/n);
  const s = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
  s.buffer = b; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = .8; g.gain.value = v;
  s.connect(f); f.connect(g); g.connect(master); s.start(t);
}
const sfx = {
  flap(){ noise(.12,.35,1400); tone(380,.09,'triangle',.08,620); },
  point(){ tone(988,.07,'square',.09); tone(1319,.14,'square',.09,null,.07); },
  ibis(){ tone(1500,.07,'sine',.16,2100); tone(1900,.09,'sine',.14,2600,.07); tone(2400,.12,'triangle',.06,null,.14); },
  hit(){ noise(.25,.6,300); tone(180,.3,'sawtooth',.18,55); },
  clear(){ [523,659,784,1047].forEach((f,i)=>tone(f,.18,'square',.1,null,i*.11)); tone(1568,.4,'triangle',.1,null,.44); },
  over(){ [494,440,392,294].forEach((f,i)=>tone(f,.26,'triangle',.14,null,i*.17)); },
  fanfare(){ [523,659,784,659,784,1047,1047,1175,1319].forEach((f,i)=>tone(f,.16,'square',.09,null,i*.12)); },
  click(){ tone(660,.05,'square',.07); },
};
function setSound(on){
  soundOn = on; store.set('sound', on);
  if (master) master.gain.value = on ? .55 : 0;
  document.querySelectorAll('svg.snd use').forEach(u => u.setAttribute('href', on ? '#i-snd-on' : '#i-snd-off'));
  document.querySelectorAll('.sndTxt').forEach(s => s.textContent = on ? 'SOM: LIGADO' : 'SOM: MUDO');
}

/* ======================================================================
   CENÁRIOS — pintados uma vez em canvases offscreen (LW de largura, tileável)
   ====================================================================== */
function ridge(base, harm){ return x => { let y = base; for (const [a,k,p] of harm) y += a*Math.sin(TAU*k*x/LW + p); return y; }; }
function fillRidge(x, fy, fill, bottom=H){ x.beginPath(); x.moveTo(-2,bottom); for (let i=-2;i<=LW+2;i+=3) x.lineTo(i, fy(i)); x.lineTo(LW+2,bottom); x.closePath(); x.fillStyle = fill; x.fill(); }
function rep(px, fn){ fn(px); fn(px-LW); fn(px+LW); } // desenha com wrap
function vgrad(x,y0,y1,stops){ const g = x.createLinearGradient(0,y0,0,y1); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; }
function glowDot(x, px, py, r, col, a=.9){ const g = x.createRadialGradient(px,py,0,px,py,r); g.addColorStop(0,col); g.addColorStop(1,'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(px-r,py-r,r*2,r*2); x.globalAlpha = 1; }

function leafCluster(x, cx, cy, r, base, hi, rim, R){
  for (let i=0;i<9;i++){
    const a = R()*TAU, d = R()*r*.7, rr = r*(.35+R()*.4);
    x.fillStyle = base; x.beginPath(); x.ellipse(cx+Math.cos(a)*d, cy+Math.sin(a)*d*.6, rr, rr*.8, 0, 0, TAU); x.fill();
  }
  for (let i=0;i<6;i++){
    const a = -Math.PI/2 + (R()-.5)*2.2, d = r*(.45+R()*.4), rr = r*(.18+R()*.18);
    x.fillStyle = hi; x.beginPath(); x.ellipse(cx+Math.cos(a)*d, cy+Math.sin(a)*d*.6, rr, rr*.7, 0, 0, TAU); x.fill();
  }
  if (rim){ x.strokeStyle = rim; x.lineWidth = 1.4; x.globalAlpha = .55; x.beginPath(); x.arc(cx, cy, r*.95, Math.PI*1.1, Math.PI*1.55); x.stroke(); x.globalAlpha = 1; }
}
function fern(x, bx, by, len, ang, col, R){
  x.strokeStyle = col; x.lineWidth = 1.6; x.lineCap = 'round';
  const ex = bx+Math.cos(ang)*len, ey = by+Math.sin(ang)*len, mx = bx+Math.cos(ang)*len*.5, my = by+Math.sin(ang)*len*.5 - len*.18;
  x.beginPath(); x.moveTo(bx,by); x.quadraticCurveTo(mx,my,ex,ey); x.stroke();
  for (let t=.15;t<.95;t+=.09){
    const px = (1-t)*(1-t)*bx + 2*(1-t)*t*mx + t*t*ex, py = (1-t)*(1-t)*by + 2*(1-t)*t*my + t*t*ey;
    const l = len*.28*(1-t*.7);
    x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(ang-1.1)*l, py+Math.sin(ang-1.1)*l); x.moveTo(px,py); x.lineTo(px+Math.cos(ang+1.1)*l*.8, py+Math.sin(ang+1.1)*l*.8); x.stroke();
  }
}
function palm(x, bx, by, h, lean, R){
  x.strokeStyle = '#1a1424'; x.lineWidth = 4; x.lineCap = 'round';
  const tx = bx + lean, ty = by - h;
  x.beginPath(); x.moveTo(bx,by); x.quadraticCurveTo(bx+lean*.2, by-h*.6, tx, ty); x.stroke();
  x.fillStyle = '#16122a';
  for (let i=0;i<7;i++){
    const a = -Math.PI/2 + (i-3)*.5 + (R()-.5)*.2, l = 22+R()*8;
    x.beginPath(); x.moveTo(tx,ty);
    x.quadraticCurveTo(tx+Math.cos(a-.25)*l*.6, ty+Math.sin(a-.25)*l*.6-6, tx+Math.cos(a)*l, ty+Math.sin(a)*l+8);
    x.quadraticCurveTo(tx+Math.cos(a+.25)*l*.5, ty+Math.sin(a+.25)*l*.5, tx, ty+2); x.fill();
  }
}

const SCENES = {
  /* ---------------- FASE 1: CUBATÃO ---------------- */
  cubatao(){
    const R = rng(7), L = { live:{} };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#1f1838'],[.28,'#4b2a5c'],[.5,'#9a3f5a'],[.64,'#e0644a'],[.72,'#f6994a'],[.76,'#ffc574']]); x.fillRect(0,0,W,H);
      glowDot(x, 268, 404, 190, 'rgba(255,190,110,.75)');
      glowDot(x, 268, 404, 60, 'rgba(255,236,190,1)');
      x.fillStyle = '#ffd88a'; x.beginPath(); x.arc(268,404,30,0,TAU); x.fill();
      x.fillStyle = '#fff3cf'; x.beginPath(); x.arc(268,404,22,0,TAU); x.fill();
    }
    { const [c,x] = mk(LW,H); // nuvens
      for (let i=0;i<14;i++){ const cx = R()*LW, cy = 70+R()*270, w = 50+R()*110;
        rep(cx, px => { x.fillStyle = `rgba(${cy<200?'120,70,120':'255,150,110'},${.18+R()*.18})`; for (let k=0;k<4;k++){ x.beginPath(); x.ellipse(px+(k-1.5)*w*.3, cy+(R()-.5)*6, w*.36, 7+R()*6, 0, 0, TAU); x.fill(); } }); }
      L.clouds = c; }
    { const [c,x] = mk(LW,H); // serra do mar
      const f1 = ridge(408,[[22,1,.4],[14,3,1.1],[8,7,2.2],[4,13,.3]]);
      fillRidge(x, f1, vgrad(x,360,480,[[0,'#7a4170'],[1,'#a2526a']]));
      const f2 = ridge(446,[[16,2,2.4],[10,5,.2],[6,9,1.7],[3,19,.9]]);
      fillRidge(x, f2, vgrad(x,410,490,[[0,'#4a2a54'],[1,'#5e3358']]));
      for (let i=0;i<70;i++){ const px = R()*LW; rep(px, p => { x.fillStyle = '#3d2348'; x.beginPath(); x.arc(p, f2(px)+2, 4+R()*5, Math.PI, 0); x.fill(); }); }
      L.far = c; }
    { const [c,x] = mk(LW,H); // refinaria
      const base = 482, chim = [];
      x.fillStyle = '#1f1529'; x.fillRect(0, base-2, LW, 10);
      for (let i=0;i<9;i++){ const px = 20+i*80+R()*30;
        rep(px, p => {
          // torres treliçadas
          x.strokeStyle = '#2a1d36'; x.lineWidth = 1.2; const th = 40+R()*40;
          x.strokeRect(p+18, base-th, 14, th); for (let yy=base-th; yy<base; yy+=8){ x.beginPath(); x.moveTo(p+18,yy); x.lineTo(p+32,yy+8); x.stroke(); }
          // tanques
          const tw = 30+R()*20, tht = 14+R()*14; x.fillStyle = '#2b1e37'; x.fillRect(p-10, base-tht, tw, tht); x.fillStyle = '#4a3245'; x.beginPath(); x.ellipse(p-10+tw/2, base-tht, tw/2, 3, 0, 0, TAU); x.fill();
        });
        const cw = 6+R()*5, ch = 70+R()*90, cx = px+40+R()*20;
        rep(cx, p => { x.fillStyle = '#22182e'; x.fillRect(p, base-ch, cw, ch); x.fillStyle = '#7a2f3a'; x.fillRect(p, base-ch+6, cw, 5); x.fillRect(p, base-ch+16, cw, 4); x.fillStyle = '#ffb35a'; x.fillRect(p+cw/2-1, base-ch-3, 2, 3); });
        chim.push({ x:cx+cw/2, y:base-ch });
      }
      for (let i=0;i<130;i++){ const px = R()*LW, py = base-4-R()*60*R(); rep(px, p => { glowDot(x,p,py,6,'rgba(255,190,100,.9)',.55); x.fillStyle = '#ffd690'; x.fillRect(p-.7,py-.7,1.4,1.4); }); }
      L.mid = c; L.live.chimneys = chim; L.midF = .3; }
    { const [c,x] = mk(LW,H); // água + navio
      x.fillStyle = vgrad(x,488,600,[[0,'#7a3a5a'],[.25,'#4a2747'],[1,'#1c1428']]); x.fillRect(0,488,LW,120);
      for (let i=0;i<120;i++){ const px = R()*LW, py = 492+R()*90, w = 4+R()*18; rep(px, p => { x.fillStyle = `rgba(255,${150+R()*80|0},90,${.12+R()*.25})`; x.fillRect(p,py,w,1.2); }); }
      const sx = 470; rep(sx, p => { x.fillStyle = '#1a1220'; x.beginPath(); x.moveTo(p,512); x.lineTo(p+92,512); x.lineTo(p+82,528); x.lineTo(p+8,528); x.fill(); x.fillRect(p+18,494,40,18); x.fillRect(p+28,480,14,14); x.fillRect(p+62,470,3,42); x.strokeStyle='#1a1220'; x.lineWidth=2; x.beginPath(); x.moveTo(p+63,472); x.lineTo(p+90,488); x.stroke(); for (let k=0;k<6;k++){ x.fillStyle='#ffcc77'; x.fillRect(p+21+k*6,500,2,2); } glowDot(x,p+44,478,9,'rgba(255,200,120,.9)'); });
      L.water = c; }
    { const [c,x] = mk(LW,H); // primeiro plano: mata + mureta
      const f = ridge(592,[[6,3,.2],[4,8,1.4],[3,17,2.1]]);
      fillRidge(x, f, vgrad(x,570,640,[[0,'#1a3220'],[1,'#0b160e']]));
      for (let i=0;i<5;i++){ const px = 40+i*144+R()*40; rep(px, p => { const ww = 46+R()*20; for (let b=0;b<3;b++){ x.fillStyle = b%2?'#4a4847':'#57534f'; x.fillRect(p+b*ww/3, 588, ww/3-1, 16); } x.fillStyle = '#3a6a2e'; x.fillRect(p, 586, ww, 3); }); }
      for (let i=0;i<34;i++){ const px = R()*LW, py = f(px)+4+R()*6, r = 12+R()*14; rep(px, p => leafCluster(x, p, py, r, '#173a20', '#2c5d30', '#ff9a5a', R)); }
      L.fg = c; }
    L.live.sun = { x:268, y:404 };
    L.top = '#1f1838'; L.bot = '#0b160e';
    return L;
  },

  /* ---------------- FASE 2: CACHOEIRA DO PILÃO ---------------- */
  pilao(){
    const R = rng(21), L = { live:{} };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#24305e'],[.32,'#5a4a86'],[.55,'#c4707a'],[.7,'#f2a35a'],[.8,'#ffdca0']]); x.fillRect(0,0,W,H);
      glowDot(x, 92, 300, 200, 'rgba(255,214,150,.7)');
      x.fillStyle = '#ffe6ad'; x.beginPath(); x.arc(92,300,26,0,TAU); x.fill(); x.fillStyle = '#fffbe8'; x.beginPath(); x.arc(92,300,19,0,TAU); x.fill();
    }
    { const [c,x] = mk(LW,H);
      for (let i=0;i<12;i++){ const cx = R()*LW, cy = 60+R()*220, w = 60+R()*120;
        rep(cx, px => { x.fillStyle = `rgba(255,${200+R()*40|0},210,${.16+R()*.16})`; for (let k=0;k<4;k++){ x.beginPath(); x.ellipse(px+(k-1.5)*w*.3, cy+(R()-.5)*8, w*.34, 8+R()*6, 0, 0, TAU); x.fill(); } }); }
      L.clouds = c; }
    { const [c,x] = mk(LW,H);
      fillRidge(x, ridge(350,[[30,1,1.2],[18,3,.4],[10,6,2.9],[4,14,.7]]), vgrad(x,300,470,[[0,'#6f6a9a'],[1,'#9a7c96']]));
      fillRidge(x, ridge(390,[[22,2,.8],[12,5,2.2],[6,11,1.1]]), vgrad(x,340,480,[[0,'#3f5068'],[1,'#556a72']]));
      L.far = c; }
    { const [c,x] = mk(LW,H); // paredões e cachoeiras
      const f = ridge(318,[[34,2,.3],[20,4,1.9],[10,9,.8],[5,21,2.4]]);
      fillRidge(x, f, vgrad(x,280,540,[[0,'#1f3b2c'],[.5,'#2a4036'],[1,'#1a2a24']]));
      for (let i=0;i<26;i++){ const px = R()*LW, py = f(px)+20+R()*150, w = 14+R()*26, h = 10+R()*30; rep(px, p => { x.fillStyle = `rgba(${90+R()*30|0},${100+R()*30|0},${95+R()*20|0},.45)`; x.fillRect(p, py, w, h); }); }
      for (let i=0;i<60;i++){ const px = R()*LW; rep(px, p => leafCluster(x, p, f(px)+6, 10+R()*10, '#1d4a2a', '#3a7a3a', '#ffc070', R)); }
      const falls = [];
      [[110,22],[300,34],[318,14],[540,26]].forEach(([fx,fw]) => {
        const top = f(fx)+6;
        rep(fx, p => { x.fillStyle = vgrad(x,top,530,[[0,'#d8f2f5'],[1,'#a8d8e0']]); x.fillRect(p-fw/2, top, fw, 530-top); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(p-fw/2+2, top, 3, 530-top); });
        falls.push({ x:fx, w:fw, top, bot:530 });
      });
      L.mid = c; L.live.falls = falls; L.midF = .24; }
    { const [c,x] = mk(LW,H); // rio
      x.fillStyle = vgrad(x,526,610,[[0,'#7ab3b8'],[.2,'#3f7f86'],[1,'#163a42']]); x.fillRect(0,526,LW,90);
      for (let i=0;i<100;i++){ const px = R()*LW, py = 530+R()*70, w = 6+R()*22; rep(px, p => { x.fillStyle = `rgba(230,250,255,${.1+R()*.25})`; x.fillRect(p,py,w,1.3); }); }
      for (let i=0;i<14;i++){ const px = R()*LW, w = 18+R()*30; rep(px, p => { x.fillStyle = '#2c3434'; x.beginPath(); x.ellipse(p, 540+R()*30, w/2, 7, 0, 0, TAU); x.fill(); }); }
      L.water = c; }
    { const [c,x] = mk(LW,H);
      const f = ridge(594,[[6,2,1.2],[5,7,.4],[3,15,2.7]]);
      fillRidge(x, f, vgrad(x,570,640,[[0,'#163420'],[1,'#08140c']]));
      for (let i=0;i<10;i++){ const px = R()*LW; rep(px, p => { x.fillStyle = '#3e4644'; x.beginPath(); x.ellipse(p, 600, 22+R()*14, 12, 0, Math.PI, 0); x.fill(); x.fillStyle = '#4f7a34'; x.beginPath(); x.ellipse(p-4, 590, 14, 4, 0, 0, TAU); x.fill(); }); }
      for (let i=0;i<40;i++){ const px = R()*LW, by = f(px)+6; rep(px, p => { for (let k=0;k<4;k++) fern(x, p, by, 18+R()*14, -Math.PI/2 + (k-1.5)*.55, k%2?'#2f6a35':'#3f8a3f', R); }); }
      L.fg = c; }
    L.top = '#24305e'; L.bot = '#08140c';
    return L;
  },

  /* ---------------- FASE 3: SANTOS (noite) ---------------- */
  santos(){
    const R = rng(33), L = { live:{} };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#090c26'],[.4,'#221950'],[.62,'#5e2f72'],[.74,'#b45a7a'],[.8,'#f08a7a']]); x.fillRect(0,0,W,H);
      for (let i=0;i<120;i++){ const a = R(); x.fillStyle = `rgba(255,255,255,${.3+a*.6})`; x.fillRect(R()*W, R()*330, a>.9?2:1.2, a>.9?2:1.2); }
      glowDot(x, 84, 150, 90, 'rgba(255,240,200,.35)');
      x.fillStyle = '#fff1d0'; x.beginPath(); x.arc(84,150,20,0,TAU); x.fill();
      x.fillStyle = '#e8d6b0'; [[78,144,4],[90,156,3],[86,141,2]].forEach(([a,b,r])=>{x.beginPath();x.arc(a,b,r,0,TAU);x.fill();});
    }
    { const [c,x] = mk(LW,H); L.clouds = c;
      for (let i=0;i<8;i++){ const cx = R()*LW, cy = 220+R()*140, w = 80+R()*120; rep(cx, px => { x.fillStyle = 'rgba(150,80,140,.22)'; for (let k=0;k<3;k++){ x.beginPath(); x.ellipse(px+(k-1)*w*.3, cy, w*.4, 6, 0, 0, TAU); x.fill(); } }); }
    }
    { const [c,x] = mk(LW,H);
      fillRidge(x, ridge(420,[[26,1,2.1],[16,3,.6],[6,8,1.9]]), vgrad(x,380,500,[[0,'#2a1f52'],[1,'#3a2a5a']]));
      L.far = c; }
    { const [c,x] = mk(LW,H); // prédios da orla (alguns tortos!)
      const base = 506; let px = 0;
      while (px < LW-10){
        const w = 24+R()*24, h = 60+R()*140, tilt = R()<.28 ? (R()-.5)*.09 : 0, col = ['#241d48','#2c2456','#1f1a40'][R()*3|0];
        const bx = px;
        x.save(); x.translate(bx+w/2, base); x.rotate(tilt);
        x.fillStyle = col; x.fillRect(-w/2, -h, w, h);
        x.fillStyle = 'rgba(255,255,255,.05)'; x.fillRect(-w/2, -h, 3, h);
        for (let yy=-h+6; yy<-6; yy+=7) for (let xx=-w/2+3; xx<w/2-3; xx+=5){ if (R()<.42){ x.fillStyle = R()<.8?`rgba(255,${200+R()*40|0},120,${.55+R()*.4})`:'rgba(140,200,255,.7)'; x.fillRect(xx,yy,2.6,3.2); } }
        x.fillStyle = '#ff4a4a'; x.fillRect(-1,-h-3,2,2);
        x.restore();
        px += w + 2 + R()*6;
      }
      x.fillStyle = '#120f26'; x.fillRect(0, base, LW, 8);
      L.mid = c; L.midF = .28; }
    { const [c,x] = mk(LW,H); // jardim da orla + areia
      x.fillStyle = '#12261c'; x.fillRect(0, 510, LW, 12);
      for (let i=0;i<60;i++){ const p0 = R()*LW; rep(p0, p => { x.fillStyle = '#183424'; x.beginPath(); x.ellipse(p, 512, 8+R()*6, 5, 0, 0, TAU); x.fill(); }); }
      for (let i=0;i<12;i++){ const p0 = 20+i*60+R()*20; rep(p0, p => { x.fillStyle = '#2a2236'; x.fillRect(p, 476, 2, 36); glowDot(x, p+1, 476, 14, 'rgba(255,205,120,.9)', .7); x.fillStyle = '#ffe2a8'; x.fillRect(p-1, 474, 4, 3); }); }
      for (let i=0;i<9;i++){ const p0 = R()*LW, hh = 46+R()*24, ln = (R()-.5)*20; rep(p0, p => palm(x, p, 516, hh, ln, R)); }
      x.fillStyle = vgrad(x,520,552,[[0,'#8c6a62'],[1,'#5a4458']]); x.fillRect(0, 520, LW, 34);
      L.water = c; L.waterF = .55; }
    { const [c,x] = mk(LW,H); // mar (primeiro plano)
      x.fillStyle = vgrad(x,552,640,[[0,'#3a3a7a'],[.3,'#1e2456'],[1,'#0a0e28']]); x.fillRect(0, 552, LW, 90);
      x.strokeStyle = 'rgba(220,230,255,.5)'; x.lineWidth = 1.5;
      x.beginPath(); for (let i=0;i<=LW;i+=4) x.lineTo(i, 554 + Math.sin(TAU*i/LW*24)*1.6); x.stroke();
      for (let i=0;i<70;i++){ const p0 = R()*LW, py = 562+R()*70, w = 10+R()*26; rep(p0, p => { x.fillStyle = `rgba(180,200,255,${.08+R()*.18})`; x.fillRect(p, py, w, 1.3); }); }
      L.fg = c; }
    L.live.moon = { x:84, y:150 };
    L.top = '#090c26'; L.bot = '#0a0e28';
    return L;
  },
};

/* ---------- texturas dos obstáculos ---------- */
const TEX_LEN = 680;
function cylGrad(x, w, stops){ const g = x.createLinearGradient(0,0,w,0); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; }
function buildObstacles(){
  const out = {}, R = rng(99);
  // cano industrial enferrujado
  out.pipe = [0,1].map(v => {
    const [c,x] = mk(OBST_W, TEX_LEN);
    x.fillStyle = cylGrad(x, OBST_W, [[0,'#141c17'],[.12,'#2e4234'],[.32,'#7f9a7c'],[.42,'#5c7860'],[.75,'#2d4232'],[1,'#0f1510']]); x.fillRect(0,0,OBST_W,TEX_LEN);
    for (let i=0;i<40;i++){ x.fillStyle = `rgba(${120+R()*40|0},${60+R()*20|0},30,${.15+R()*.25})`; x.beginPath(); x.ellipse(R()*OBST_W, R()*TEX_LEN, 2+R()*7, 3+R()*16, 0, 0, TAU); x.fill(); }
    for (let i=0;i<10;i++){ const px = R()*OBST_W, py = R()*TEX_LEN; x.fillStyle = 'rgba(110,55,25,.35)'; x.fillRect(px, py, 1.5+R()*2, 20+R()*60); }
    for (let yy=110; yy<TEX_LEN; yy+=150){
      x.fillStyle = cylGrad(x, OBST_W, [[0,'#0d120e'],[.32,'#5c705a'],[1,'#0c100c']]); x.fillRect(0, yy, OBST_W, 9);
      x.fillStyle = 'rgba(255,230,180,.25)'; x.fillRect(0, yy, OBST_W, 1.2);
      for (let k=6;k<OBST_W;k+=10){ x.fillStyle = '#1a201a'; x.beginPath(); x.arc(k, yy+4.5, 1.6, 0, TAU); x.fill(); }
    }
    if (v===1){ // pichação da coroa + faixa zebrada
      x.save(); x.translate(OBST_W/2, 260); x.strokeStyle = 'rgba(235,240,255,.8)'; x.lineWidth = 2.2; x.lineJoin = 'round';
      x.beginPath(); x.moveTo(-14,8); x.lineTo(-16,-10); x.lineTo(-7,-1); x.lineTo(0,-14); x.lineTo(7,-1); x.lineTo(16,-10); x.lineTo(14,8); x.closePath(); x.stroke();
      x.beginPath(); x.moveTo(-15,13); x.lineTo(15,13); x.stroke(); x.restore();
      x.save(); x.beginPath(); x.rect(0, 420, OBST_W, 40); x.clip(); x.fillStyle = '#e8b21c'; x.fillRect(0,420,OBST_W,40); x.fillStyle = '#16140f';
      for (let k=-40;k<OBST_W+40;k+=16){ x.beginPath(); x.moveTo(k,420); x.lineTo(k+8,420); x.lineTo(k+48,460); x.lineTo(k+40,460); x.fill(); } x.restore();
    }
    vines(x, R, '#2f6a2a', '#5a9a3a');
    return c;
  });
  // tronco com musgo
  out.tronco = [0,1].map(() => {
    const [c,x] = mk(OBST_W, TEX_LEN);
    x.fillStyle = cylGrad(x, OBST_W, [[0,'#1a100a'],[.18,'#4a2e1c'],[.38,'#8a5c38'],[.55,'#6a4428'],[.85,'#3a2414'],[1,'#140c06']]); x.fillRect(0,0,OBST_W,TEX_LEN);
    x.strokeStyle = 'rgba(30,16,8,.55)'; x.lineWidth = 1.4;
    for (let i=0;i<16;i++){ const px = 3+R()*(OBST_W-6); x.beginPath(); x.moveTo(px,0); for (let yy=0;yy<TEX_LEN;yy+=20) x.lineTo(px+Math.sin(yy*.03+i)*2.4, yy); x.stroke(); }
    for (let i=0;i<14;i++){ const py = R()*TEX_LEN; x.fillStyle = 'rgba(25,14,6,.7)'; x.beginPath(); x.ellipse(10+R()*(OBST_W-20), py, 4, 6, 0, 0, TAU); x.fill(); }
    for (let i=0;i<30;i++){ x.fillStyle = `rgba(${70+R()*40|0},${120+R()*40|0},40,${.4+R()*.4})`; x.beginPath(); x.ellipse(R()<.5?R()*14:OBST_W-R()*14, R()*TEX_LEN, 4+R()*8, 6+R()*14, 0, 0, TAU); x.fill(); }
    vines(x, R, '#3a7a2a', '#7ab84a');
    return c;
  });
  // pilar de concreto
  out.concreto = [0,1].map(v => {
    const [c,x] = mk(OBST_W, TEX_LEN);
    x.fillStyle = cylGrad(x, OBST_W, [[0,'#24242c'],[.15,'#5a5a66'],[.35,'#a6a4ac'],[.5,'#8a8892'],[.85,'#44444e'],[1,'#1c1c22']]); x.fillRect(0,0,OBST_W,TEX_LEN);
    for (let i=0;i<220;i++){ x.fillStyle = R()<.5?'rgba(0,0,0,.12)':'rgba(255,255,255,.08)'; x.fillRect(R()*OBST_W, R()*TEX_LEN, 1.5, 1.5); }
    x.strokeStyle = 'rgba(20,20,26,.6)'; x.lineWidth = 1;
    for (let i=0;i<6;i++){ let px = R()*OBST_W, py = R()*TEX_LEN; x.beginPath(); x.moveTo(px,py); for (let k=0;k<6;k++){ px += (R()-.5)*14; py += 6+R()*10; x.lineTo(px,py); } x.stroke(); }
    for (let yy=140; yy<TEX_LEN; yy+=180){ x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0,yy,OBST_W,2); }
    if (v===1){ x.fillStyle = 'rgba(80,220,255,.85)'; x.font = '900 13px Rubik, sans-serif'; x.textAlign = 'center'; x.save(); x.translate(OBST_W/2, 300); x.rotate(-Math.PI/2); x.fillText('SANTOS', 0, 4); x.restore(); }
    for (let i=0;i<8;i++){ const py = R()*TEX_LEN; x.fillStyle = 'rgba(120,80,50,.35)'; x.fillRect(R()*OBST_W, py, 1.4, 14+R()*24); }
    return c;
  });
  // tampas
  const caps = {};
  { const [c,x] = mk(OBST_W+14, 24); x.fillStyle = cylGrad(x, OBST_W+14, [[0,'#0e140f'],[.14,'#34503a'],[.34,'#9ab896'],[.46,'#6a8a6c'],[.78,'#2a3e2e'],[1,'#0c110d']]); x.fillRect(0,0,OBST_W+14,24);
    x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0,0,OBST_W+14,3); x.fillRect(0,21,OBST_W+14,3); x.fillStyle = 'rgba(255,220,160,.35)'; x.fillRect(0,3,OBST_W+14,1.2);
    for (let k=6;k<OBST_W+10;k+=9){ x.fillStyle = '#141a14'; x.beginPath(); x.arc(k, 12, 1.8, 0, TAU); x.fill(); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(k-1,10.5,1,1); }
    caps.pipe = c; }
  { const [c,x] = mk(OBST_W+14, 24); x.fillStyle = cylGrad(x, OBST_W+14, [[0,'#1a100a'],[.4,'#7a5232'],[1,'#1a100a']]); x.fillRect(0,4,OBST_W+14,20);
    for (let i=0;i<16;i++){ x.fillStyle = ['#3e7a2a','#5a9a3a','#2a5a22'][i%3]; x.beginPath(); x.ellipse(4+R()*(OBST_W+6), 6+R()*10, 6+R()*6, 5+R()*3, 0, 0, TAU); x.fill(); }
    caps.tronco = c; }
  { const [c,x] = mk(OBST_W+14, 24); x.save(); x.beginPath(); x.rect(0,0,OBST_W+14,24); x.clip(); x.fillStyle = '#f0b81c'; x.fillRect(0,0,OBST_W+14,24); x.fillStyle = '#15130e';
    for (let k=-30;k<OBST_W+40;k+=14){ x.beginPath(); x.moveTo(k,0); x.lineTo(k+7,0); x.lineTo(k+31,24); x.lineTo(k+24,24); x.fill(); } x.restore();
    x.strokeStyle = '#15130e'; x.lineWidth = 3; x.strokeRect(1.5,1.5,OBST_W+11,21); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(3,3,OBST_W+8,1.5);
    caps.concreto = c; }
  out.caps = caps;
  return out;
}
function vines(x, R, dark, light){
  for (let v=0; v<3; v++){
    const side = R()<.5 ? 4+R()*10 : OBST_W-4-R()*10, y0 = R()*TEX_LEN*.7, len = 120+R()*200;
    x.strokeStyle = dark; x.lineWidth = 1.6; x.beginPath();
    for (let yy=0; yy<len; yy+=6){ const px = side + Math.sin((yy+y0)*.05)*6; yy ? x.lineTo(px, y0+yy) : x.moveTo(px, y0); }
    x.stroke();
    for (let yy=0; yy<len; yy+=9){ const px = side + Math.sin((yy+y0)*.05)*6; x.fillStyle = R()<.5?dark:light; x.beginPath(); x.ellipse(px+(R()<.5?-4:4), y0+yy, 3.6, 2, R()*3, 0, TAU); x.fill(); }
  }
}

/* ======================================================================
   ESTADO
   ====================================================================== */
const st = {
  mode:'menu', phase:0, scene:null, sceneOld:null, fade:0,
  cam:0, y:H*.42, vy:0, rot:0, flapT:0, inv:0, hurtT:0, shake:0,
  hearts:CONFIG.vidas, score:0, ibis:0, phaseIbis:0, passed:0,
  scoreAtPhase:0, ibisAtPhase:0,
  obst:[], pickups:[], signs:[], parts:[], birds:[], smoke:[], confetti:[],
  t:0, overT:0, clearT:0, best:store.get('best', 0),
};
let OB = null;

function setScene(i, crossfade){
  if (crossfade && st.scene){ const [c,x] = mk(W,VH); x.drawImage(cv, 0, 0, cv.width, cv.height, 0, 0, W, VH); st.sceneOld = c; st.fade = 1; }
  st.phase = i; st.scene = SCENES[PHASES[i].id]();
  document.body.style.setProperty('--glow', PHASES[i].glow);
}

/* ---------- HUD ---------- */
const hud = { hearts:$('#hearts'), score:$('#scoreN'), phase:$('#phaseN'), prog:$('#prog i'), ibis:$('#ibisN'), ibisWrap:$('#ibis') };
hud.hearts.innerHTML = Array.from({length:CONFIG.vidas}, () => '<svg viewBox="0 0 20 18" style="color:#ff3348"><use href="#i-heart"/></svg>').join('');
function drawHUD(){
  [...hud.hearts.children].forEach((h,i) => { const on = i < st.hearts; h.style.color = on ? '#ff3348' : '#2b2e3c'; h.classList.toggle('lost', !on); });
  hud.score.textContent = st.score;
  hud.phase.textContent = `FASE ${st.phase+1} · ${Math.min(st.passed, PHASES[st.phase].obst)}/${PHASES[st.phase].obst}`;
  hud.prog.style.width = (100*st.passed/PHASES[st.phase].obst) + '%';
  hud.ibis.textContent = `${st.ibis}/${TOTAL_IBIS}`;
}
function bump(el){ el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function show(id){ document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id)); }
function hudOn(on){ $('#hud').classList.toggle('on', on); }
function hint(on){ $('#hint').classList.toggle('on', on); }
let tagTimer = 0;
function tag(small, big, ms=1800){ $('#tagS').textContent = small; $('#tagB').textContent = big; $('#tag').classList.add('on'); clearTimeout(tagTimer); tagTimer = setTimeout(() => $('#tag').classList.remove('on'), ms); }

/* ---------- fluxo ---------- */
function toMenu(){
  st.mode = 'menu'; setScene(0); st.confetti = []; st.obst = []; st.pickups = []; st.signs = []; st.parts = [];
  st.score = 0; st.ibis = 0; st.hearts = CONFIG.vidas;
  $('#best').textContent = st.best ? `RECORDE: ${st.best} ★` : 'CUBATÃO É NÓIS';
  show('menu'); hudOn(false); hint(false); $('#tag').classList.remove('on');
}
function enterPhase(i, opts={}){
  if (i !== st.phase || !st.scene || opts.rebuild) setScene(i, opts.crossfade);
  const P = PHASES[i];
  st.mode = 'ready'; st.y = H*.42; st.vy = 0; st.rot = 0; st.inv = 0; st.hurtT = 0;
  st.passed = 0; st.obst = []; st.pickups = []; st.parts = []; st.confetti = [];
  st.scoreAtPhase = st.score; st.ibisAtPhase = st.ibis; st.phaseIbis = 0;
  const signText = [ ['CUBATÃO →','SANTOS →','SÃO PAULO →'], ['CACHOEIRA','DO PILÃO →'], ['SANTOS →','ORLA'] ][i];
  st.signs = [{ x: 228, lines: signText, kind: i }];
  show(null); hudOn(true); hint(true); drawHUD();
  tag(`FASE ${i+1}`, P.nome, 2200);
}
function startPlay(){
  const P = PHASES[st.phase], R = Math.random;
  st.mode = 'play'; hint(false);
  // gera a fase inteira (justa: variação limitada entre vãos)
  let g = H*.45;
  for (let k=0; k<P.obst; k++){
    g = clamp(g + (R()*2-1)*170, P.gap/2 + 90, GROUND_Y - 40 - P.gap/2);
    st.obst.push({ x: W + 70 + k*P.spacing, gap: g, passed: false, v: R()<.35 ? 1 : 0, wob: R()*TAU });
  }
  const idxs = [...Array(IBIS_PER_PHASE)].map((_,k) => Math.min(P.obst-1, Math.round((k+.5)*P.obst/IBIS_PER_PHASE)));
  idxs.forEach(k => {
    const a = st.obst[k], b = st.obst[k+1];
    const y = b ? (a.gap + b.gap)/2 + (R()-.5)*40 : a.gap;
    st.pickups.push({ x: a.x + OBST_W/2 + P.spacing/2, y, got: false, ph: R()*TAU });
  });
  flap();
}
function flap(){
  st.vy = FLAP; st.flapT = .16; sfx.flap();
  for (let i=0;i<2;i++) st.parts.push(feather(MIKE_X - 30, st.y + 10, -80 - Math.random()*60, -40 + Math.random()*80));
}
function feather(x,y,vx,vy,col='#fff'){ return { type:'feather', x, y, vx, vy, r: Math.random()*TAU, vr: (Math.random()-.5)*8, life: 1, col }; }
function hurt(){
  if (st.inv > 0 || st.mode !== 'play') return;
  st.hearts--; st.inv = 1.4; st.hurtT = .6; st.shake = .35; st.vy = -300; sfx.hit();
  try { navigator.vibrate && navigator.vibrate(80); } catch(e){}
  for (let i=0;i<10;i++) st.parts.push(feather(MIKE_X, st.y, (Math.random()-.5)*360, (Math.random()-.8)*300));
  st.parts.push({ type:'star', x: MIKE_X+18, y: st.y-30, life: 1 });
  const h = hud.hearts.children[st.hearts]; if (h){ h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
  drawHUD();
  if (st.hearts <= 0){ st.mode = 'dying'; st.overT = 1.1; sfx.over(); hudOn(true); }
}
function phaseClear(){
  st.mode = 'clear';
  const P = PHASES[st.phase], last = st.phase === PHASES.length-1;
  if (st.score > st.best){ st.best = st.score; store.set('best', st.best); }
  if (last){ finale(); return; }
  sfx.clear();
  const gain = st.hearts < CONFIG.vidas ? 1 : 0;
  $('#clearT').innerHTML = `FASE ${st.phase+1}<br>COMPLETA!`;
  $('#clearP').textContent = `Você passou pelos ${P.obst} obstáculos!`;
  $('#clearI').textContent = `${st.phaseIbis}/${IBIS_PER_PHASE}`;
  $('#clearH').textContent = gain ? '+1' : 'CHEIO';
  $('#nextBtn').textContent = `PRÓXIMA: ${PHASES[st.phase+1].nome} →`;
  st.pendingHeart = gain;
  setTimeout(() => { if (st.mode === 'clear') show('clear'); }, 450);
}
function finale(){
  st.mode = 'finale'; sfx.fanfare();
  const f = CONFIG.festa;
  $('#fTitle').textContent = f.titulo;
  $('#fList').innerHTML = [['DATA', f.data], ['HORA', f.hora], ['LOCAL', f.local]].filter(r => r[1]).map(([k,v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  const links = [];
  if (f.confirmar) links.push(`<a class="btn green" href="${encodeURI(f.confirmar)}" target="_blank" rel="noopener">CONFIRMAR</a>`);
  if (f.mapa) links.push(`<a class="btn ghost" href="${encodeURI(f.mapa)}" target="_blank" rel="noopener">VER MAPA</a>`);
  $('#fLinks').innerHTML = links.join(''); $('#fLinks').hidden = !links.length;
  $('#finI').textContent = `${st.ibis}/${TOTAL_IBIS}`; $('#finS').textContent = st.score;
  $('#rank').textContent = st.ibis >= TOTAL_IBIS ? 'LENDA DOS GUARÁS!' : st.ibis >= 10 ? 'CAÇADOR DE GUARÁS!' : st.ibis >= 5 ? 'BOM DE ASA!' : 'SOBREVIVENTE DE CUBATÃO!';
  for (let i=0;i<140;i++) st.confetti.push(confetto(true));
  setTimeout(() => { if (st.mode === 'finale') show('finale'); }, 700);
}
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function confetto(burst){ const cols = ['#ffc531','#ff3348','#3fd36a','#4ab0ff','#ffffff','#ff8a3d']; return { x: burst ? W/2 + (Math.random()-.5)*60 : Math.random()*W, y: burst ? H*.45 : -10, vx: burst ? (Math.random()-.5)*520 : (Math.random()-.5)*40, vy: burst ? -200-Math.random()*420 : 40+Math.random()*60, r: Math.random()*TAU, vr: (Math.random()-.5)*12, w: 4+Math.random()*5, h: 6+Math.random()*6, c: cols[Math.random()*cols.length|0] }; }

/* ======================================================================
   UPDATE
   ====================================================================== */
function update(dt){
  st.t += dt;
  const P = PHASES[st.phase];
  const playing = st.mode === 'play' || st.mode === 'dying';
  const worldSpeed = st.mode === 'play' ? P.speed : st.mode === 'dying' ? P.speed*.25 : st.mode === 'finale' ? 40 : P.speed*.35;
  if (st.mode !== 'pause') st.cam += worldSpeed * dt;
  if (st.fade > 0) st.fade = Math.max(0, st.fade - dt/0.9);

  if (st.mode === 'pause') return;

  // Mike
  if (st.mode === 'play' || st.mode === 'dying'){
    st.vy = Math.min(MAXFALL, st.vy + GRAV*dt);
    st.y += st.vy*dt;
    if (st.y < 24 - PADT){ st.y = 24 - PADT; st.vy = Math.max(0, st.vy); }
    if (st.mode === 'play' && st.y > GROUND_Y - 6){ st.y = GROUND_Y - 6; hurt(); st.vy = -460; }
    if (st.mode === 'dying'){ st.y = Math.min(st.y, H+120); st.overT -= dt; if (st.overT <= 0){ st.mode = 'over'; show('over'); hudOn(false); } }
  } else if (st.mode === 'ready' || st.mode === 'clear' || st.mode === 'finale' || st.mode === 'menu'){
    st.y = lerp(st.y, H*.42 + Math.sin(st.t*3)*10, 1 - Math.pow(.02, dt)); st.vy = Math.cos(st.t*3)*30;
  }
  const targetRot = st.mode === 'dying' ? st.rot + 6*dt : clamp(st.vy/650*.55, -.38, .55);
  st.rot = st.mode === 'dying' ? targetRot : lerp(st.rot, targetRot, 1 - Math.pow(.0005, dt));
  st.flapT = Math.max(0, st.flapT - dt); st.inv = Math.max(0, st.inv - dt); st.hurtT = Math.max(0, st.hurtT - dt); st.shake = Math.max(0, st.shake - dt);

  // mundo
  const mv = (st.mode === 'play' ? P.speed : st.mode === 'dying' ? P.speed*.25 : st.mode === 'clear' ? P.speed*.6 : 0) * dt;
  for (const o of st.obst){
    o.x -= mv;
    if (st.mode === 'play'){
      if (!o.passed && o.x + OBST_W < MIKE_X - HIT_R){ o.passed = true; st.passed++; st.score++; sfx.point(); bump(hud.score); drawHUD(); }
      const half = P.gap/2;
      if (circleRect(MIKE_X, st.y, HIT_R, o.x, -100, OBST_W, o.gap - half + 100) || circleRect(MIKE_X, st.y, HIT_R, o.x, o.gap + half, OBST_W, H)) hurt();
    }
  }
  for (const p of st.pickups){
    p.x -= mv;
    if (!p.got && st.mode === 'play' && Math.hypot(p.x - MIKE_X, p.y + Math.sin(st.t*3+p.ph)*6 - st.y) < HIT_R + 16){
      p.got = true; st.ibis++; st.phaseIbis++; sfx.ibis(); bump(hud.ibisWrap); drawHUD();
      for (let i=0;i<8;i++) st.parts.push({ type:'spark', x:p.x, y:p.y, vx:Math.cos(i/8*TAU)*140, vy:Math.sin(i/8*TAU)*140, life:1 });
      st.parts.push({ type:'text', x:p.x, y:p.y-18, txt:'+1 GUARÁ', life:1 });
    }
  }
  for (const s of st.signs) s.x -= mv;
  st.signs = st.signs.filter(s => s.x > -160);
  if (st.mode === 'play' && st.passed >= P.obst && st.obst.every(o => o.x + OBST_W < MIKE_X - 40)) phaseClear();

  // partículas
  for (const q of st.parts){
    q.life -= dt * (q.type === 'feather' ? .9 : q.type === 'text' ? .8 : q.type === 'star' ? 1.4 : 2.2);
    if (q.vx !== undefined){ q.x += q.vx*dt; q.y += q.vy*dt; }
    if (q.type === 'feather'){ q.vy += 260*dt; q.vx *= Math.pow(.2, dt); q.vy = Math.min(q.vy, 60); q.r += q.vr*dt; }
    if (q.type === 'text') q.y -= 30*dt;
    if (q.type === 'star') q.y -= 20*dt;
  }
  st.parts = st.parts.filter(q => q.life > 0);

  // pássaros decorativos (guarás ao fundo)
  if (Math.random() < dt*.45 && st.birds.length < 4) st.birds.push({ x: W+30, y: 80 + Math.random()*260, s: .45 + Math.random()*.3, v: 30 + Math.random()*30, ph: Math.random()*TAU });
  for (const b of st.birds) b.x -= (b.v + worldSpeed*.2)*dt;
  st.birds = st.birds.filter(b => b.x > -40);

  // fumaça (fase 1)
  const L = st.scene;
  if (L && L.live.chimneys){
    for (const ch of L.live.chimneys){
      if (Math.random() < dt*6){
        const sx = wrapX(ch.x, L.midF);
        if (sx > -40 && sx < W+40) st.smoke.push({ wx: ch.x, y: ch.y, r: 4, a: .5, f: L.midF, dx: 0 });
      }
    }
  }
  for (const s of st.smoke){ s.y -= 18*dt; s.dx -= 12*dt; s.r += 9*dt; s.a -= dt*.11; }
  st.smoke = st.smoke.filter(s => s.a > 0 && st.scene.live.chimneys);

  // confete
  if (st.mode === 'finale' && Math.random() < dt*20) st.confetti.push(confetto(false));
  for (const c of st.confetti){ c.vy += 300*dt; c.vy = Math.min(c.vy, 110); c.vx *= Math.pow(.3, dt); c.x += c.vx*dt + Math.sin(st.t*4+c.r)*20*dt; c.y += c.vy*dt; c.r += c.vr*dt; }
  st.confetti = st.confetti.filter(c => c.y < H+20);
}
function circleRect(cx, cy, r, rx, ry, rw, rh){ const nx = clamp(cx, rx, rx+rw), ny = clamp(cy, ry, ry+rh); return (cx-nx)*(cx-nx) + (cy-ny)*(cy-ny) < r*r; }
function wrapX(wx, f){ let o = (st.cam*f) % LW; let x = wx - o; if (x < -LW/2) x += LW; return x; }

/* ======================================================================
   RENDER
   ====================================================================== */
function layer(c, f){
  if (!c) return;
  let o = (st.cam*f) % LW; o = Math.round(o*S)/S;
  ctx.drawImage(c, -o, 0, LW, H); ctx.drawImage(c, LW-o, 0, LW, H);
}
function render(){
  const L = st.scene, P = PHASES[st.phase];
  ctx.setTransform(S,0,0,S,0,0);
  if (PADT > 0){ ctx.fillStyle = L.top; ctx.fillRect(0,0,W,VH); ctx.fillStyle = L.bot; ctx.fillRect(0,PADT+H-2,W,VH); }
  ctx.translate(0, PADT);
  if (st.shake > 0){ const m = st.shake*14; ctx.translate((Math.random()-.5)*m, (Math.random()-.5)*m); }
  ctx.drawImage(L.sky, 0, 0, W, H);
  layer(L.clouds, .04);
  if (L.live.moon){ glowDot(ctx, L.live.moon.x, L.live.moon.y, 40 + Math.sin(st.t*1.3)*4, 'rgba(255,240,210,.25)'); }
  // guarás decorativos ao fundo
  for (const b of st.birds) drawIbis(b.x, b.y, b.s, st.t*10 + b.ph, .85, false);
  layer(L.far, .1);
  // fumaça atrás da refinaria
  for (const s of st.smoke){ const x = wrapX(s.wx, s.f) + s.dx; ctx.fillStyle = `rgba(78,58,82,${s.a})`; ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, TAU); ctx.fill(); }
  layer(L.mid, L.midF || .3);
  // cachoeiras animadas
  if (L.live.falls) for (const f of L.live.falls){
    const x = wrapX(f.x, L.midF);
    if (x < -40 || x > W+40) continue;
    ctx.save(); ctx.beginPath(); ctx.rect(x-f.w/2, f.top, f.w, f.bot-f.top); ctx.clip();
    for (let k=0;k<6;k++){ const yy = f.top + ((st.t*140 + k*37) % (f.bot - f.top + 40)) - 20; ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(x - f.w/2 + (k*7 % f.w), yy, 2, 18); }
    ctx.restore();
    for (let k=0;k<4;k++){ ctx.fillStyle = `rgba(240,255,255,${.25 + Math.sin(st.t*3+k)*.1})`; ctx.beginPath(); ctx.ellipse(x + (k-1.5)*f.w*.4, f.bot + 2, f.w*.5 + 6, 6 + Math.sin(st.t*4+k)*2, 0, 0, TAU); ctx.fill(); }
  }
  layer(L.water, L.waterF || .45);
  if (L.live.sun){ // reflexo do sol tremulando
    for (let k=0;k<12;k++){ const yy = 494 + k*7, w = (26 - k*1.6) * (0.7 + Math.sin(st.t*5 + k*1.7)*.3); ctx.fillStyle = `rgba(255,214,140,${.55 - k*.035})`; ctx.fillRect(L.live.sun.x - w/2 + Math.sin(st.t*3+k)*3, yy, w, 2); }
  }

  // placas
  for (const s of st.signs) drawSign(s);
  // obstáculos
  for (const o of st.obst) if (o.x < W+20 && o.x > -OBST_W-20) drawObstacle(o, P);
  // guarás coletáveis
  for (const p of st.pickups) if (!p.got && p.x < W+30 && p.x > -30){
    const y = p.y + Math.sin(st.t*3 + p.ph)*6;
    glowDot(ctx, p.x, y, 34, 'rgba(255,80,90,.55)', .6 + Math.sin(st.t*6)*.15);
    drawIbis(p.x, y, 1.25, st.t*12 + p.ph, 1, true);
  }
  // Mike
  if (st.mode !== 'menu') drawMike();
  // partículas
  for (const q of st.parts){
    ctx.globalAlpha = clamp(q.life, 0, 1);
    if (q.type === 'feather'){ ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0,0,5,2,0,0,TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke(); ctx.restore(); }
    else if (q.type === 'spark'){ ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(q.x, q.y, 3*q.life+1, 0, TAU); ctx.fill(); }
    else if (q.type === 'text'){ ctx.font = '400 15px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#14121c'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillStyle = '#ffd34a'; ctx.fillText(q.txt, q.x, q.y); }
    else if (q.type === 'star'){ drawStar(q.x, q.y, 9 + (1-q.life)*6, st.t*6); }
    ctx.globalAlpha = 1;
  }
  layer(L.fg, 1);
  // confete
  for (const c of st.confetti){ ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h*Math.abs(Math.cos(c.r*1.3))); ctx.restore(); }
  // flash de dano
  if (st.hurtT > .45){ ctx.fillStyle = `rgba(255,60,60,${(st.hurtT-.45)*1.4})`; ctx.fillRect(0,-PADT,W,VH); }
  // transição entre fases
  if (st.fade > 0 && st.sceneOld){ ctx.globalAlpha = st.fade; ctx.drawImage(st.sceneOld, 0, -PADT, W, VH); ctx.globalAlpha = 1; }
}
function drawMike(){
  let pose = 'feliz';
  if (st.mode === 'dying' || st.mode === 'over' || st.hurtT > 0) pose = 'triste';
  else if (st.mode === 'ready' || st.mode === 'clear') pose = 'pronto';
  else if (st.flapT > 0) pose = 'bate';
  else if (st.vy > 330) pose = 'quase';
  const sp = SPRITES[pose], im = img[pose];
  if (!im.complete || !im.naturalWidth) return;
  ctx.save();
  ctx.translate(MIKE_X, st.y); ctx.rotate(pose === 'triste' ? st.rot*.4 : st.rot);
  if (st.inv > 0 && st.mode === 'play' && Math.floor(st.inv*12) % 2) ctx.globalAlpha = .45;
  const k = SPR_SCALE * (st.flapT > .1 ? 1.03 : 1);
  ctx.drawImage(im, -sp.ax*k, -sp.ay*k, sp.w*k, sp.h*k);
  ctx.restore();
}
function drawObstacle(o, P){
  const half = P.gap/2, tex = OB[P.kind][o.v], cap = OB.caps[P.kind], capH = 22, x = Math.round(o.x*S)/S;
  const topEnd = o.gap - half, botStart = o.gap + half;
  // sombra suave
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(x + OBST_W, 0, 6, topEnd); ctx.fillRect(x + OBST_W, botStart, 6, H - botStart);
  // topo (espelhado)
  const lenT = Math.max(0, topEnd - capH + 4);
  if (lenT > 0){ ctx.save(); ctx.translate(x, topEnd - capH + 4); ctx.scale(1,-1); ctx.drawImage(tex, 0, 0, tex.width, Math.min(tex.height, lenT*S), 0, 0, OBST_W, Math.min(TEX_LEN, lenT)); ctx.restore(); }
  ctx.drawImage(cap, x - 7, topEnd - capH, OBST_W + 14, capH);
  // base
  const lenB = H - (botStart + capH - 4);
  ctx.drawImage(tex, 0, 0, tex.width, Math.min(tex.height, lenB*S), x, botStart + capH - 4, OBST_W, Math.min(TEX_LEN, lenB));
  ctx.drawImage(cap, x - 7, botStart, OBST_W + 14, capH);
  if (P.kind === 'pipe' && o.v === 0){ // gotejando
    const d = (st.t*60 + o.wob*40) % 60; ctx.fillStyle = 'rgba(160,220,140,.7)'; ctx.beginPath(); ctx.arc(x + OBST_W*.6, topEnd + 2 + d, 1.8, 0, TAU); ctx.fill();
  }
}
function drawSign(s){
  const x = Math.round(s.x), kind = s.kind;
  const lines = s.lines, w = kind === 0 ? 128 : 120, h = 18 + lines.length*20, top = 470 - h;
  ctx.fillStyle = '#3a3a40'; ctx.fillRect(x + 14, top + h - 4, 5, 140); ctx.fillRect(x + w - 19, top + h - 4, 5, 140);
  const col = kind === 0 ? '#1d6a46' : kind === 1 ? '#5a3a24' : '#1d4a8a';
  ctx.fillStyle = '#e8e8e0'; roundRect(x - 3, top - 3, w + 6, h + 6, 7); ctx.fill();
  ctx.fillStyle = col; roundRect(x, top, w, h, 5); ctx.fill();
  ctx.font = '400 17px "Lilita One", sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
  lines.forEach((t, i) => ctx.fillText(t, x + 10, top + 25 + i*20));
}
function roundRect(x, y, w, h, r){ ctx.beginPath(); ctx.moveTo(x+r, y); ctx.arcTo(x+w, y, x+w, y+h, r); ctx.arcTo(x+w, y+h, x, y+h, r); ctx.arcTo(x, y+h, x, y, r); ctx.arcTo(x, y, x+w, y, r); ctx.closePath(); }
function drawStar(x, y, r, a){
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.beginPath();
  for (let i=0;i<10;i++){ const rr = i%2 ? r*.45 : r, t = i/10*TAU - Math.PI/2; ctx.lineTo(Math.cos(t)*rr, Math.sin(t)*rr); }
  ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#14121c'; ctx.lineWidth = 2; ctx.stroke(); ctx.restore();
}
/* guará (Eudocimus ruber) */
function drawIbis(x, y, s, t, a=1, outline=false){
  ctx.save(); ctx.translate(x, y); ctx.scale(-s, s); ctx.globalAlpha = a;
  const flap = Math.sin(t);
  if (outline){ ctx.lineWidth = 3; ctx.strokeStyle = '#14121c'; }
  // asa de trás
  ctx.fillStyle = '#b81e2c';
  ctx.beginPath(); ctx.moveTo(-2,-2); ctx.quadraticCurveTo(-8, -14 - flap*10, -20, -12 - flap*14); ctx.quadraticCurveTo(-12, -4, 2, 0); ctx.fill();
  // corpo
  ctx.fillStyle = '#ff3348'; ctx.beginPath(); ctx.ellipse(0, 0, 13, 6, -.08, 0, TAU); if (outline) ctx.stroke(); ctx.fill();
  // pescoço e cabeça
  ctx.beginPath(); ctx.moveTo(9,-3); ctx.quadraticCurveTo(15,-6,17,-5); ctx.lineTo(18,-2); ctx.quadraticCurveTo(14,-1,10,2); ctx.fill();
  ctx.beginPath(); ctx.arc(17.5,-4,3.2,0,TAU); ctx.fill();
  // bico curvo
  ctx.strokeStyle = '#3a1a14'; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(20,-4); ctx.quadraticCurveTo(27,-3,30,3); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(18.3,-4.8,.9,0,TAU); ctx.fill();
  // cauda e pernas
  ctx.fillStyle = '#e8202f'; ctx.beginPath(); ctx.moveTo(-12,-2); ctx.lineTo(-19,0); ctx.lineTo(-12,3); ctx.fill();
  ctx.strokeStyle = '#d0484a'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8,4); ctx.lineTo(-20,7); ctx.moveTo(-7,4); ctx.lineTo(-19,9); ctx.stroke();
  // asa da frente
  ctx.fillStyle = '#ff5566';
  ctx.beginPath(); ctx.moveTo(-4,-1); ctx.quadraticCurveTo(-4, -16 - flap*12, -16, -20 - flap*16); ctx.lineTo(-18,-18 - flap*15); ctx.quadraticCurveTo(-14,-6,4,1); if (outline){ ctx.strokeStyle = '#14121c'; ctx.lineWidth = 2; ctx.stroke(); } ctx.fill();
  ctx.fillStyle = '#14121c'; ctx.beginPath(); ctx.ellipse(-16.5, -19 - flap*15.5, 2.6, 1.6, .5, 0, TAU); ctx.fill();
  ctx.restore();
}

/* ======================================================================
   LOOP / RESIZE / INPUT
   ====================================================================== */
let last = performance.now();
function frame(now){
  const dt = Math.min(.034, (now - last)/1000); last = now;
  update(dt); render();
  requestAnimationFrame(frame);
}
let resizeT = 0;
function resize(){
  const r = game.getBoundingClientRect();
  const ns = Math.min(r.width * Math.min(devicePixelRatio || 1, 2) / W, 3);
  const nvh = Math.max(H, Math.round(r.height / r.width * W));
  if (Math.abs(ns - S) < .01 && nvh === VH && OB) return;
  VH = nvh; PADT = Math.round((VH - H) * .6);
  S = ns; cv.width = Math.round(W*S); cv.height = Math.round(VH*S);
  OB = buildObstacles();
  if (st.scene) st.scene = SCENES[PHASES[st.phase].id]();
}
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); });

function press(e){
  if (e && e.target.closest && e.target.closest('button,a')) return;
  audio();
  if (st.mode === 'play') flap();
  else if (st.mode === 'ready') startPlay();
  else if (st.mode === 'menu') { sfx.click(); enterPhase(0); }
}
game.addEventListener('pointerdown', e => { if (e.button > 0) return; press(e); if (!e.target.closest('button,a')) e.preventDefault(); });
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (['Space','ArrowUp','KeyW'].includes(e.code)){ e.preventDefault();
    if (st.mode === 'over') act('retry'); else if (st.mode === 'clear' && $('#clear').classList.contains('on')) act('next'); else if (st.mode === 'pause') act('resume'); else press();
  }
  if (e.code === 'Escape' || e.code === 'KeyP'){ if (st.mode === 'play') act('pause'); else if (st.mode === 'pause') act('resume'); }
  if (e.code === 'KeyM') setSound(!soundOn);
});
document.addEventListener('visibilitychange', () => { if (document.hidden && st.mode === 'play') act('pause'); });

let pausedFrom = null;
function act(a){
  audio();
  switch (a){
    case 'start': sfx.click(); enterPhase(0); break;
    case 'pause': if (st.mode === 'play' || st.mode === 'ready'){ pausedFrom = st.mode; st.mode = 'pause'; show('pause'); } break;
    case 'resume': if (st.mode === 'pause'){ st.mode = pausedFrom || 'play'; show(null); last = performance.now(); } break;
    case 'retry': sfx.click(); st.score = st.scoreAtPhase; st.ibis = st.ibisAtPhase; st.hearts = CONFIG.vidas; enterPhase(st.phase); break;
    case 'menu': sfx.click(); toMenu(); break;
    case 'next': sfx.click(); st.hearts = Math.min(CONFIG.vidas, st.hearts + (st.pendingHeart||0)); st.pendingHeart = 0; enterPhase(st.phase + 1, { crossfade: true }); break;
    case 'restart': sfx.click(); st.confetti = []; st.score = 0; st.ibis = 0; st.hearts = CONFIG.vidas; enterPhase(0, { crossfade: true, rebuild: true }); break;
    case 'sound': setSound(!soundOn); sfx.click(); break;
  }
}
document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); act(b.dataset.act); }));
$('#pauseBtn').addEventListener('click', e => { e.stopPropagation(); act('pause'); });

/* boot */
setSound(soundOn);
resize();
setScene(0);
toMenu();
const fontsReady = document.fonts && document.fonts.load ? Promise.all([document.fonts.load('17px "Lilita One"'), document.fonts.load('20px "Luckiest Guy"')]).catch(()=>{}) : Promise.resolve();
fontsReady.then(() => { OB = buildObstacles(); });
requestAnimationFrame(t => { last = t; frame(t); });

// atalho p/ testes: ?fase=2
const q = new URLSearchParams(location.search);
if (q.get('fase')){ const f = clamp((+q.get('fase')||1)-1, 0, PHASES.length-1); setScene(f); enterPhase(f); }
window.__fm = { st, act, enterPhase, startPlay, PHASES };
})();
