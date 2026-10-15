/* =========================================================================
   FLAPPY MIKE — Cubatão → Cachoeira do Pilão → Santos → A FESTA
   ========================================================================= */
(() => {
'use strict';

/* ---------- EDITE AQUI os dados da festa ---------- */
const CONFIG = {
  festa: {
    titulo:   'NIVER DO MIKE',
    data:     'SEXTA, 14 DE NOVEMBRO',
    hora:     '20H',
    local:    'PICLES CARDEAL',
    endereco: 'RUA CARDEAL ARCOVERDE, 1838',
    mapa:     'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent('Picles Cardeal, Rua Cardeal Arcoverde, 1838, São Paulo'),
    whatsapp: '',                         // número do Mike só com dígitos, ex: '5513999999999' (vazio = a pessoa escolhe o contato)
    msgSim:   'VOU COLAR SIM!',
    msgNao:   'VOU SER VACILÃO E NÃO VOU',
  },
  vidas: 3,
};

const PHASES = [
  { id:'novarepublica', nome:'NOVA REPÚBLICA', sub:'JARDIM · CUBATÃO',   bgm:'cubatao', obst:8,  speed:150, gap:184, spacing:212, kind:'concreto', glow:'#e88a50' },
  { id:'mangue',        nome:'MANGUEZAL',      sub:'CUBATÃO',            bgm:'cubatao', obst:10, speed:162, gap:174, spacing:206, kind:'tronco',   glow:'#d8a050' },
  { id:'saopaulo',      nome:'SÃO PAULO',      sub:'A CAPITAL',          bgm:'sp',      obst:12, speed:176, gap:166, spacing:200, kind:'masp',     glow:'#c04a6a' },
];
const IBIS_PER_PHASE = 5;
/* trilha das fases de voo (em loop) */
const BGM = { cubatao:'assets/music/hino-cubatao.mp3', sp:'assets/music/tiro-ao-alvaro.mp3', final:'assets/music/final-epico.mp3' };
const BGM_VOL = .5;
const TOTAL_IBIS = IBIS_PER_PHASE * PHASES.length;

/* sprites: atlas com as animações do Mike — [x, y, w, h, âncoraX, âncoraY] (âncora = centro da cabeça) */
const ATLAS = {"scale":0.4167,"frames":{"flap":[[0,0,294,234,205.3,47.1],[298,0,295,238,194.7,50.3],[597,0,306,240,228.1,50.9],[907,0,307,234,217.8,50.2],[1218,0,329,241,222.6,53.0],[1551,0,288,252,186.7,52.9],[0,256,284,254,181.0,55.5]],"glide":[[288,256,397,207,289.4,52.4],[689,256,443,209,282.1,52.8],[1136,256,399,208,264.0,51.1],[1539,256,440,192,274.0,50.3],[0,514,410,192,277.5,51.0]],"fall":[[414,514,408,237,289.9,86.9],[826,514,356,298,233.7,151.8],[1186,514,410,313,331.1,163.4],[1600,514,284,298,185.2,172.1],[0,831,328,308,239.3,169.5],[332,831,291,321,220.5,210.2],[627,831,264,244,208.8,190.3]],"crash":[[895,831,391,171,338.0,112.8],[1290,831,356,184,293.6,130.1],[0,1156,404,194,329.9,108.3],[408,1156,406,177,333.5,97.6],[818,1156,404,157,343.0,88.1]]}};
const SPR_SCALE = ATLAS.scale * 0.86;   // px lógicos por px do atlas
const FLAP_DUR = 0.24;
const HIT_R = 19;                // raio da hitbox (generoso)

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

const atlasImg = document.getElementById('atlasSrc');   // Mike voando (img escondida no HTML)
const gtImg = document.getElementById('gtSrc');         // Mike guitarrista
const GT = {"h":336,"frames":{"play":[[0,0,271,335,126.8,334.3],[275,0,260,337,119.2,336.3],[539,0,255,338,99.2,337.0],[798,0,243,334,121.3,332.9],[1045,0,262,334,143.4,332.9],[1311,0,261,337,118.5,336.3]],"rock":[[1576,0,314,332,126.8,330.8],[0,342,236,291,93.0,290.2],[240,342,314,333,120.6,332.2],[558,342,238,346,51.0,345.3],[800,342,236,286,40.0,285.3]],"miss":[[1040,342,286,298,190.2,297.1],[1330,342,275,295,83.4,294.3],[1609,342,250,285,91.7,284.0],[0,692,312,271,169.6,270.2],[316,692,320,203,97.2,201.9]],"cheer":[[640,692,318,333,101.3,332.2],[962,692,330,340,118.5,339.8],[1296,692,312,339,146.1,338.4],[1612,692,310,350,143.4,349.4]]}};
const GT_H = 156;   // altura do Mike no palco, em px lógicos

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
  for (const k in (typeof songEls === 'object' ? songEls : {})) songEls[k].muted = !on;
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

/* ---------- peças de cenário ---------- */
const WALLS = ['#e8b04a','#d8683e','#6aa4c8','#efe2c4','#94b460','#c47a9a','#f0d0a0','#8ab0a0','#e07a5a'];
function casa(x, bx, base, R){
  const w = 36 + R()*26, floors = R() < .45 ? 2 : 1, fh = 26 + R()*6, h = floors*fh;
  const brick = R() < .25, col = WALLS[R()*WALLS.length|0];
  x.fillStyle = brick ? '#b8582e' : col; x.fillRect(bx, base-h, w, h);
  if (brick){
    x.strokeStyle = 'rgba(80,30,10,.45)'; x.lineWidth = .6;
    for (let yy = base-h+3, r = 0; yy < base; yy += 4, r++){
      x.beginPath(); x.moveTo(bx, yy); x.lineTo(bx+w, yy); x.stroke();
      for (let xx = bx + (r%2 ? 0 : 4); xx < bx+w; xx += 8){ x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx, yy+4); x.stroke(); }
    }
  }
  x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(bx+w-5, base-h, 5, h);
  for (let f = 0; f < floors; f++){
    const fy = base - (f+1)*fh;
    const wins = w > 48 ? [bx+6, bx+w-20] : [bx+6];
    if (f === 0 && w <= 48) wins.length = 0;
    for (const wx of wins){
      if (f === 0 && wx > bx + w/2 - 10 && wx < bx + w/2 + 8) continue;
      x.fillStyle = R() < .4 ? '#ffd98a' : '#2c2c3e'; x.fillRect(wx, fy+7, 13, 10);
      x.strokeStyle = '#3a3a44'; x.lineWidth = .8; for (let k=1;k<4;k++){ x.beginPath(); x.moveTo(wx+k*3.25, fy+7); x.lineTo(wx+k*3.25, fy+17); x.stroke(); }
    }
  }
  if (R() < .5){ // portão de garagem
    const gw = Math.min(26, w*.55), gx = bx + w - gw - 4;
    x.fillStyle = '#7c7c88'; x.fillRect(gx, base-19, gw, 19);
    x.strokeStyle = '#5a5a66'; x.lineWidth = .8; for (let xx = gx+3; xx < gx+gw; xx += 3){ x.beginPath(); x.moveTo(xx, base-19); x.lineTo(xx, base); x.stroke(); }
    x.fillStyle = '#3a3a4a'; x.fillRect(bx+5, base-17, 9, 17);
  } else { x.fillStyle = '#3a3a4a'; x.fillRect(bx + w/2 - 6, base-18, 12, 18); }
  const top = base - h;
  if (R() < .55){ // laje
    x.fillStyle = '#bdb6aa'; x.fillRect(bx-1, top-3, w+2, 3);
    const cx = bx + w*(.3 + R()*.4);
    x.fillStyle = '#2f6fd8'; x.fillRect(cx-6, top-13, 12, 10); x.fillStyle = '#5a90f0'; x.beginPath(); x.ellipse(cx, top-13, 6, 2, 0, 0, TAU); x.fill();
    if (R() < .45){ x.strokeStyle = '#6a5a50'; x.lineWidth = 1; for (let k = 0; k < 4; k++){ const rx = bx + 3 + k*(w-6)/3; x.beginPath(); x.moveTo(rx, top-3); x.lineTo(rx + (R()-.5)*2, top-10); x.stroke(); } }
    if (R() < .35){ // varal
      const v0 = bx + 4, v1 = cx - 9; if (v1 - v0 > 10){
        x.strokeStyle = '#ddd'; x.lineWidth = .6; x.beginPath(); x.moveTo(v0, top-12); x.lineTo(v1, top-12); x.stroke();
        for (let xx = v0 + 3; xx < v1 - 3; xx += 5){ x.fillStyle = WALLS[R()*WALLS.length|0]; x.fillRect(xx, top-12, 3.5, 5 + R()*3); }
      }
    }
  } else { // telhado
    x.fillStyle = '#a54a2a'; x.beginPath(); x.moveTo(bx-3, top); x.lineTo(bx+w+3, top); x.lineTo(bx+w-6, top-12); x.lineTo(bx+6, top-12); x.closePath(); x.fill();
    x.strokeStyle = 'rgba(60,20,10,.4)'; x.lineWidth = .7; for (let yy = top-3; yy > top-12; yy -= 3){ x.beginPath(); x.moveTo(bx, yy); x.lineTo(bx+w, yy); x.stroke(); }
  }
  if (R() < .2){ x.fillStyle = '#c8c8d0'; x.beginPath(); x.ellipse(bx+w-8, top-8, 5, 6, -.5, 0, TAU); x.fill(); }
  return w;
}
function mangrove(x, bx, by, h, R){
  const tY = by - h*.45;
  x.strokeStyle = '#3e2f22'; x.lineCap = 'round';
  for (let k = 0; k < 7; k++){
    const sx = bx + (R()-.5)*6, sy = tY + R()*h*.12, ex = bx + (k-3)*h*.15 + (R()-.5)*6;
    x.lineWidth = 1.4 + R()*1.2; x.beginPath(); x.moveTo(sx, sy); x.quadraticCurveTo(sx + (ex-sx)*.8, sy - h*.14, ex, by); x.stroke();
  }
  x.lineWidth = 3.4; x.beginPath(); x.moveTo(bx, tY+4); x.quadraticCurveTo(bx + (R()-.5)*10, tY - h*.3, bx + (R()-.5)*8, by - h*.88); x.stroke();
  for (let k = 0; k < 5; k++) leafCluster(x, bx + (R()-.5)*h*.55, by - h + (R()-.3)*h*.22, h*(.2 + R()*.12), '#2c5a2c', '#4e8a3c', null, R);
}
function perchBird(x, px, py, s, white, R){
  x.save(); x.translate(px, py); x.scale(R() < .5 ? -s : s, s);
  const body = white ? '#f4f4ee' : '#ff3348';
  x.fillStyle = body; x.beginPath(); x.ellipse(0, 0, 5, 3, -.3, 0, TAU); x.fill();
  x.strokeStyle = body; x.lineWidth = 1.6; x.beginPath(); x.moveTo(2, -2); x.quadraticCurveTo(3, -6, 4.5, -6); x.stroke();
  x.fillStyle = body; x.beginPath(); x.arc(5, -6, 1.7, 0, TAU); x.fill();
  x.strokeStyle = white ? '#e8c040' : '#3a1a14'; x.lineWidth = .9; x.beginPath(); x.moveTo(6.4, -6); white ? x.lineTo(10, -5.5) : x.quadraticCurveTo(9.5, -6, 10.5, -2.5); x.stroke();
  x.strokeStyle = white ? '#222' : '#c04040'; x.beginPath(); x.moveTo(0, 2.5); x.lineTo(0, 7); x.stroke();
  x.restore();
}
function windows(x, bx, top, w, h, R, p=.4, cols=['rgba(255,214,140,.85)']){
  for (let yy = top+5; yy < top+h-4; yy += 6) for (let xx = bx+3; xx < bx+w-3; xx += 5)
    if (R() < p){ x.fillStyle = cols[R()*cols.length|0]; x.fillRect(xx, yy, 2.4, 3); }
}

const SCENES = {
  /* ---------------- FASE 1: JARDIM NOVA REPÚBLICA ---------------- */
  novarepublica(){
    const R = rng(11), L = { live:{} };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#2c4a8a'],[.3,'#6a7cc0'],[.5,'#d88aa0'],[.64,'#f6a868'],[.74,'#ffd696']]); x.fillRect(0,0,W,H);
      glowDot(x, 300, 392, 180, 'rgba(255,200,120,.7)');
      x.fillStyle = '#ffe2a0'; x.beginPath(); x.arc(300,392,26,0,TAU); x.fill(); x.fillStyle = '#fff6d8'; x.beginPath(); x.arc(300,392,19,0,TAU); x.fill();
    }
    { const [c,x] = mk(LW,H);
      for (let i=0;i<13;i++){ const cx = R()*LW, cy = 60+R()*250, w = 50+R()*110;
        rep(cx, px => { x.fillStyle = `rgba(${cy<180?'190,170,220':'255,190,150'},${.22+R()*.18})`; for (let k=0;k<4;k++){ x.beginPath(); x.ellipse(px+(k-1.5)*w*.3, cy+(R()-.5)*6, w*.36, 7+R()*6, 0, 0, TAU); x.fill(); } }); }
      L.clouds = c; }
    { const [c,x] = mk(LW,H); // Serra do Mar + chaminés ao longe
      fillRidge(x, ridge(362,[[30,1,.9],[18,3,2.1],[9,7,.4],[4,15,1.3]]), vgrad(x,320,480,[[0,'#6a7aa8'],[1,'#8a8aa8']]));
      const f2 = ridge(410,[[20,2,1.6],[12,5,.3],[6,11,2.5]]);
      fillRidge(x, f2, vgrad(x,380,490,[[0,'#3e6a5a'],[1,'#4e7064']]));
      for (let i=0;i<60;i++){ const px = R()*LW; rep(px, p => { x.fillStyle = '#355e4e'; x.beginPath(); x.arc(p, f2(px)+3, 4+R()*5, Math.PI, 0); x.fill(); }); }
      const chim = [];
      for (let i=0;i<4;i++){ const cx = 80 + i*170 + R()*40, ch = 50 + R()*40, cw = 4 + R()*2;
        rep(cx, p => { x.fillStyle = '#56607a'; x.fillRect(p, 470-ch, cw, ch); x.fillStyle = '#a8505a'; x.fillRect(p, 470-ch+4, cw, 3); });
        chim.push({ x: cx + cw/2, y: 470-ch, f: .1 }); }
      x.fillStyle = vgrad(x,440,480,[[0,'rgba(255,220,210,0)'],[1,'rgba(255,220,210,.35)']]); x.fillRect(0,440,LW,40);
      L.far = c; L.live.chimneys = chim; }
    { const [c,x] = mk(LW,H); // rio + ponte estaiada
      x.fillStyle = vgrad(x,470,540,[[0,'#9aa6c8'],[1,'#4a5a7a']]); x.fillRect(0,472,LW,70);
      for (let i=0;i<70;i++){ const px = R()*LW, py = 480+R()*50, w = 4+R()*14; rep(px, p => { x.fillStyle = `rgba(255,${200+R()*40|0},170,${.15+R()*.25})`; x.fillRect(p,py,w,1.2); }); }
      for (let i=0;i<46;i++){ const p0 = R()*LW; rep(p0, p => leafCluster(x, p, 476, 7+R()*8, '#2e5446', '#46705a', null, R)); }
      const bx = 250, dy = 460;
      x.fillStyle = '#a8a49e'; for (let k=-3;k<=3;k++) if (k) x.fillRect(bx + k*64 - 3, dy+8, 6, 50);
      // rampas
      x.fillStyle = '#d4d0c8';
      x.beginPath(); x.moveTo(bx-232, dy); x.lineTo(bx-232, dy+8); x.lineTo(bx-300, dy+34); x.lineTo(bx-300, dy+28); x.closePath(); x.fill();
      x.beginPath(); x.moveTo(bx+232, dy); x.lineTo(bx+232, dy+8); x.lineTo(bx+300, dy+34); x.lineTo(bx+300, dy+28); x.closePath(); x.fill();
      // cabos em leque
      x.strokeStyle = 'rgba(250,250,250,.9)'; x.lineWidth = .9;
      for (let k=0;k<10;k++){ const ty = dy-196 + k*10, d = 222 - k*20; x.beginPath(); x.moveTo(bx-d, dy); x.lineTo(bx, ty); x.lineTo(bx+d, dy); x.stroke(); }
      // tabuleiro
      x.fillStyle = '#d8d4cc'; x.fillRect(bx-232, dy, 464, 8); x.fillStyle = '#8a8680'; x.fillRect(bx-232, dy+8, 464, 2);
      x.fillStyle = '#f4f2ee'; x.fillRect(bx-232, dy-3, 464, 1.2);
      for (let i=0;i<7;i++){ x.fillStyle = WALLS[R()*WALLS.length|0]; x.fillRect(bx-210 + R()*420, dy-5, 9, 4); }
      // mastro
      const g = x.createLinearGradient(bx-7,0,bx+7,0); g.addColorStop(0,'#c8c2b8'); g.addColorStop(.4,'#f8f4ec'); g.addColorStop(1,'#a8a298');
      x.fillStyle = g; x.beginPath(); x.moveTo(bx-7, dy+58); x.lineTo(bx+7, dy+58); x.lineTo(bx+3.2, dy-206); x.lineTo(bx-3.2, dy-206); x.closePath(); x.fill();
      glowDot(x, bx, dy-208, 10, 'rgba(255,60,60,.9)'); x.fillStyle = '#ff5050'; x.fillRect(bx-1.5, dy-210, 3, 3);
      L.mid = c; L.midF = .16; }
    { const [c,x] = mk(LW,H); // casas baixas + postes
      const base = 566;
      let px = 0, i = 0;
      while (px < LW - 10){ const seed = 500 + i++; let w = 0; rep(px, p => { w = casa(x, p, base, rng(seed)); }); px += w + 1 + R()*4; }
      // muro grafitado
      x.fillStyle = '#c8c0b2'; x.fillRect(0, base-2, LW, 10);
      for (let k=0;k<26;k++){ const gx = R()*LW, col = ['#ff3b5a','#2a8aff','#ffd23a','#3fd36a','#ffffff'][R()*5|0]; rep(gx, p => { x.strokeStyle = col; x.lineWidth = 1.4; x.beginPath(); x.moveTo(p, base+5); for (let s=0;s<4;s++) x.lineTo(p + s*4 + R()*3, base+1 + R()*5); x.stroke(); }); }
      // postes e fios
      const posts = []; for (let p = 30; p < LW; p += 96 + R()*24) posts.push(p);
      for (const p0 of posts) rep(p0, p => { x.fillStyle = '#86868e'; x.fillRect(p-1.5, base-96, 3, 104); x.fillRect(p-9, base-90, 18, 2); x.fillStyle = '#5a5a62'; if (R()<.4) x.fillRect(p+2, base-80, 7, 9); });
      x.strokeStyle = 'rgba(30,30,40,.7)'; x.lineWidth = .7;
      for (let k=0;k<posts.length;k++){ const a = posts[k], b = k+1 < posts.length ? posts[k+1] : posts[0] + LW;
        for (const off of [-8, 0, 8]) rep(a, p => { const q = p + (b - a); x.beginPath(); x.moveTo(p+off, base-89); x.quadraticCurveTo((p+q)/2, base-78, q+off, base-89); x.stroke(); }); }
      L.water = c; L.waterF = .42; }
    { const [c,x] = mk(LW,H); // calçada e rua
      x.fillStyle = '#a8a29a'; x.fillRect(0, 586, LW, 9); x.fillStyle = '#d8d2c8'; x.fillRect(0, 594, LW, 3);
      x.fillStyle = '#2e2c32'; x.fillRect(0, 597, LW, 50);
      x.fillStyle = '#e8c040'; for (let p = 0; p < LW; p += 40) x.fillRect(p, 618, 22, 2.4);
      for (let i=0;i<30;i++){ const p0 = R()*LW; rep(p0, p => { x.fillStyle = '#4a7a3a'; for (let k=0;k<4;k++){ x.beginPath(); x.moveTo(p+k*2, 594); x.lineTo(p+k*2 - 2 + R()*4, 586 - R()*6); x.lineTo(p+k*2+1.5, 594); x.fill(); } }); }
      for (let i=0;i<5;i++){ const p0 = R()*LW; rep(p0, p => { x.fillStyle = '#1a1a1e'; x.fillRect(p, 596, 16, 3); }); }
      L.fg = c; }
    L.live.kites = [{ x:60, y:150, c:'#ff3b5a' }, { x:300, y:96, c:'#2a8aff' }, { x:205, y:250, c:'#ffd23a' }];
    L.top = '#2c4a8a'; L.bot = '#2e2c32';
    return L;
  },

  /* ---------------- FASE 2: MANGUEZAIS DE CUBATÃO ---------------- */
  mangue(){
    const R = rng(5), L = { live:{ flock:true } };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#3f78c0'],[.35,'#8ab8e0'],[.58,'#f4d4a8'],[.72,'#ffe4b8']]); x.fillRect(0,0,W,H);
      glowDot(x, 250, 330, 170, 'rgba(255,236,190,.8)');
      x.fillStyle = '#fff4d6'; x.beginPath(); x.arc(250,330,22,0,TAU); x.fill();
    }
    { const [c,x] = mk(LW,H);
      for (let i=0;i<12;i++){ const cx = R()*LW, cy = 50+R()*210, w = 60+R()*120;
        rep(cx, px => { x.fillStyle = `rgba(255,255,255,${.35+R()*.25})`; for (let k=0;k<4;k++){ x.beginPath(); x.ellipse(px+(k-1.5)*w*.28, cy+(R()-.5)*8, w*.32, 9+R()*7, 0, 0, TAU); x.fill(); } }); }
      L.clouds = c; }
    { const [c,x] = mk(LW,H); // Serra do Mar coberta de Mata Atlântica
      const f1 = ridge(318,[[44,1,1.2],[22,3,.4],[10,7,2.9],[4,16,.7]]);
      fillRidge(x, f1, vgrad(x,260,470,[[0,'#5a8a86'],[1,'#7a9a90']]));
      for (let i=0;i<90;i++){ const px = R()*LW; rep(px, p => { x.fillStyle = '#4e7e78'; x.beginPath(); x.arc(p, f1(px)+4, 4+R()*5, Math.PI, 0); x.fill(); }); }
      x.fillStyle = vgrad(x,370,420,[[0,'rgba(255,248,236,0)'],[.5,'rgba(255,248,236,.55)'],[1,'rgba(255,248,236,0)']]); x.fillRect(0,370,LW,50);
      const f2 = ridge(392,[[26,2,.8],[14,5,2.2],[6,11,1.1]]);
      fillRidge(x, f2, vgrad(x,350,490,[[0,'#2f6a4a'],[1,'#3e7a56']]));
      for (let i=0;i<110;i++){ const px = R()*LW; rep(px, p => { x.fillStyle = R()<.08 ? (R()<.5?'#f0c020':'#e070a0') : '#2a5e40'; x.beginPath(); x.arc(p, f2(px)+3+R()*20, 3+R()*4, 0, TAU); x.fill(); }); }
      L.far = c; }
    { const [c,x] = mk(LW,H); // mata atlântica mais perto: embaúbas e ipês
      const f = ridge(452,[[10,3,.4],[6,7,2.1],[3,17,1.2]]);
      fillRidge(x, f, vgrad(x,430,520,[[0,'#24502e'],[1,'#1c3e24']]));
      for (let i=0;i<70;i++){ const px = R()*LW; rep(px, p => leafCluster(x, p, f(px)+4, 10+R()*10, '#21492a', '#3a7a3a', null, R)); }
      for (let i=0;i<9;i++){ const px = R()*LW, h = 40+R()*30; rep(px, p => { // embaúba
        x.strokeStyle = '#d8d8cc'; x.lineWidth = 2; x.beginPath(); x.moveTo(p, f(px)+6); x.lineTo(p, f(px)-h); x.stroke();
        for (let k=0;k<6;k++){ const a = Math.PI + k/5*Math.PI; x.fillStyle = k%2 ? '#a8c4a4' : '#c4d8bc'; x.beginPath(); x.ellipse(p + Math.cos(a)*9, f(px)-h + Math.sin(a)*5 + 3, 7, 3, a, 0, TAU); x.fill(); } }); }
      for (let i=0;i<14;i++){ const px = R()*LW, col = R()<.6 ? ['#d8a812','#ffd84a'] : ['#c84a86','#f08ab8'], r = 7+R()*4; rep(px, p => { x.strokeStyle = '#3a2a1e'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(p, f(px)+4); x.lineTo(p, f(px)-r-6); x.stroke(); leafCluster(x, p, f(px)-r-8, r, col[0], col[1], null, R); }); }
      for (let i=0;i<14;i++){ const px = R()*LW; rep(px, p => perchBird(x, p, f(px)-6 - R()*10, .8, R()<.25, R)); }
      L.mid = c; L.midF = .2; }
    { const [c,x] = mk(LW,H); // manguezal
      x.fillStyle = vgrad(x,496,610,[[0,'#b8c8c0'],[.15,'#7a9a94'],[1,'#2e4a44']]); x.fillRect(0,496,LW,120);
      for (let i=0;i<90;i++){ const px = R()*LW, py = 500+R()*70, w = 6+R()*20; rep(px, p => { x.fillStyle = `rgba(255,240,220,${.12+R()*.2})`; x.fillRect(p,py,w,1.2); }); }
      for (let i=0;i<10;i++){ const px = R()*LW, w = 30+R()*50; rep(px, p => { x.fillStyle = '#6a5a44'; x.beginPath(); x.ellipse(p, 548+R()*16, w/2, 4, 0, 0, TAU); x.fill(); }); }
      const trees = []; for (let p = 10; p < LW; p += 34 + R()*30) trees.push([p, 520 + R()*26, 46 + R()*30]);
      for (const [p0, by, h] of trees){ const s = 900 + p0|0; rep(p0, p => mangrove(x, p, by, h, rng(s))); }
      for (let i=0;i<22;i++){ const t = trees[R()*trees.length|0]; const px = t[0] + (R()-.5)*30, py = t[1] - t[2]*(.55 + R()*.4); rep(px, p => perchBird(x, p, py, 1.1, R()<.18, R)); }
      for (let i=0;i<10;i++){ const px = R()*LW; rep(px, p => perchBird(x, p, 556 + R()*10, 1.2, R()<.3, R)); }
      L.water = c; L.waterF = .42; }
    { const [c,x] = mk(LW,H); // raízes e lama em primeiro plano
      const f = ridge(598,[[4,3,.2],[3,9,1.4],[2,19,2.1]]);
      fillRidge(x, f, vgrad(x,585,640,[[0,'#4a3a2a'],[1,'#1e160e']]));
      x.strokeStyle = '#2a2016'; x.lineCap = 'round';
      for (let i=0;i<40;i++){ const p0 = R()*LW, w = 14+R()*26, h = 12+R()*14; rep(p0, p => { x.lineWidth = 2.4+R()*1.6; x.beginPath(); x.moveTo(p, 602); x.quadraticCurveTo(p + w/2, 602 - h*2, p + w, 602); x.stroke(); }); }
      for (let i=0;i<8;i++){ const p0 = R()*LW; rep(p0, p => { x.fillStyle = '#4a7ac0'; x.beginPath(); x.ellipse(p, 606, 5, 3.4, 0, 0, TAU); x.fill(); x.fillStyle = '#e8a030'; x.fillRect(p-7, 604, 3, 2); x.fillRect(p+4, 604, 3, 2); }); }
      L.fg = c; }
    L.top = '#3f78c0'; L.bot = '#1e160e';
    return L;
  },

  /* ---------------- FASE 3: SÃO PAULO ---------------- */
  saopaulo(){
    const R = rng(9), L = { live:{ rain:true, cars:true } };
    { const [c,x] = mk(W,H); L.sky = c;
      x.fillStyle = vgrad(x,0,H,[[0,'#141634'],[.35,'#2e2a5a'],[.56,'#7a4070'],[.7,'#d86a5a'],[.78,'#f6a060']]); x.fillRect(0,0,W,H);
      for (let i=0;i<50;i++){ x.fillStyle = `rgba(255,255,255,${.2+R()*.4})`; x.fillRect(R()*W, R()*220, 1.2, 1.2); }
    }
    { const [c,x] = mk(LW,H);
      for (let i=0;i<12;i++){ const cx = R()*LW, cy = 120+R()*240, w = 80+R()*140; rep(cx, px => { x.fillStyle = `rgba(140,100,150,${.18+R()*.15})`; for (let k=0;k<3;k++){ x.beginPath(); x.ellipse(px+(k-1)*w*.3, cy, w*.4, 7, 0, 0, TAU); x.fill(); } }); }
      L.clouds = c; }
    { const [c,x] = mk(LW,H); // mar de prédios
      let px = 0;
      while (px < LW){ const w = 14+R()*24, h = 60+R()*170, col = ['#2a2850','#30305a','#262448'][R()*3|0];
        rep(px, p => { x.fillStyle = col; x.fillRect(p, 476-h, w, h); });
        const seed = px|0; rep(px, p => windows(x, p, 476-h, w, h, rng(seed), .22, ['rgba(255,214,140,.55)','rgba(170,200,255,.45)']));
        if (R() < .15){ const ah = 14+R()*16; rep(px, p => { x.strokeStyle = '#3a3866'; x.lineWidth = 1.2; x.beginPath(); x.moveTo(p+w/2, 476-h); x.lineTo(p+w/2, 476-h-ah); x.stroke(); x.fillStyle = '#ff4040'; x.fillRect(p+w/2-1, 476-h-ah-1, 2, 2); }); }
        px += w + R()*3; }
      x.fillStyle = '#262448'; x.fillRect(0, 474, LW, 60);
      L.far = c; }
    { const [c,x] = mk(LW,H); // marcos de SP
      const base = 488, S1 = '#3e3870', S2 = '#4a4480';
      // Edifício Altino Arantes (Farol Santander)
      { const p = 40; [[44,120],[34,18],[24,14],[14,12]].reduce((y,[w,h]) => { x.fillStyle = S2; x.fillRect(p - w/2, y - h, w, h); windows(x, p - w/2, y - h, w, h, R, .5); return y - h; }, base);
        x.strokeStyle = '#8a86b0'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(p, base-164); x.lineTo(p, base-196); x.stroke(); glowDot(x, p, base-196, 8, 'rgba(255,60,60,.9)');
        glowDot(x, p, base-150, 22, 'rgba(255,200,120,.5)'); }
      // Edifício Itália
      { const p = 104, w = 36, h = 200; x.fillStyle = S1; x.fillRect(p, base-h, w, h); windows(x, p, base-h, w, h, R, .45); x.fillStyle = 'rgba(255,220,150,.85)'; x.fillRect(p, base-h, w, 4); x.fillStyle = S2; x.fillRect(p+8, base-h-10, w-16, 10); }
      // Copan (curvo, com brises)
      { const p = 150, w = 110, h = 128;
        x.fillStyle = S2; x.beginPath(); x.moveTo(p, base); x.bezierCurveTo(p-10, base-h*.4, p+14, base-h*.7, p+4, base-h); x.lineTo(p+w+4, base-h); x.bezierCurveTo(p+w+14, base-h*.6, p+w-10, base-h*.3, p+w, base); x.closePath(); x.fill();
        x.save(); x.clip(); for (let y = base-h+3; y < base; y += 4){ x.fillStyle = R()<.5 ? 'rgba(255,220,160,.35)' : 'rgba(255,220,160,.12)'; x.fillRect(p-12, y, w+30, 2); } x.restore();
        x.fillStyle = S1; x.fillRect(p+w*.4, base-h-14, 18, 14); }
      // Catedral da Sé
      { const p = 330;
        glowDot(x, p+35, base-50, 70, 'rgba(255,200,130,.35)');
        x.fillStyle = '#5a5288'; x.fillRect(p, base-46, 70, 46);
        x.beginPath(); x.arc(p+35, base-46, 18, Math.PI, 0); x.fill(); x.fillRect(p+34, base-82, 2, 18);
        for (const tx of [p+2, p+58]){ x.fillRect(tx, base-86, 10, 86); x.beginPath(); x.moveTo(tx-1, base-86); x.lineTo(tx+5, base-128); x.lineTo(tx+11, base-86); x.closePath(); x.fill(); }
        x.fillStyle = 'rgba(255,214,140,.8)'; x.beginPath(); x.arc(p+35, base-30, 6, 0, TAU); x.fill(); for (const tx of [p+5, p+61]) x.fillRect(tx+1.5, base-70, 3, 9); }
      // Ponte Estaiada Octavio Frias (mastro em X)
      { const p = 490, dy = base-14;
        x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = .8;
        for (let k=0;k<9;k++){ const ty = dy-120 + k*7, d = 110 - k*11; x.beginPath(); x.moveTo(p-d, dy); x.lineTo(p, ty); x.lineTo(p+d, dy); x.stroke(); }
        x.fillStyle = '#d8d8e8'; x.beginPath(); x.moveTo(p-120, dy); x.quadraticCurveTo(p, dy-14, p+120, dy); x.lineTo(p+120, dy+5); x.quadraticCurveTo(p, dy-9, p-120, dy+5); x.closePath(); x.fill();
        x.strokeStyle = '#f0f0fa'; x.lineWidth = 5; x.beginPath(); x.moveTo(p-22, base); x.lineTo(p+5, dy-126); x.moveTo(p+22, base); x.lineTo(p-5, dy-126); x.stroke();
        glowDot(x, p, dy-128, 10, 'rgba(255,60,60,.9)'); }
      // Obelisco do Ibirapuera
      { const p = 650; x.fillStyle = '#c8b89a'; x.beginPath(); x.moveTo(p-7, base); x.lineTo(p+7, base); x.lineTo(p+4, base-118); x.lineTo(p, base-130); x.lineTo(p-4, base-118); x.closePath(); x.fill(); x.fillStyle = 'rgba(0,0,0,.18)'; x.fillRect(p, base-118, 5, 118); }
      x.fillStyle = '#1c1a38'; x.fillRect(0, base, LW, 80);
      windows(x, 0, base+4, LW, 60, R, .05, ['rgba(255,214,140,.5)']);
      L.mid = c; L.midF = .18; }
    { const [c,x] = mk(LW,H); // Av. Paulista: MASP, Theatro Municipal, árvores e postes
      const base = 552;
      // Theatro Municipal
      { const p = 470;
        x.fillStyle = '#8a7a66'; x.fillRect(p, base-56, 96, 56);
        x.fillStyle = '#4a8a7a'; x.beginPath(); x.ellipse(p+48, base-56, 18, 14, 0, Math.PI, 0); x.fill(); x.fillRect(p+47, base-78, 2, 9);
        for (const tx of [p, p+84]){ x.fillStyle = '#8a7a66'; x.fillRect(tx, base-70, 12, 70); x.fillStyle = '#4a8a7a'; x.beginPath(); x.ellipse(tx+6, base-70, 7, 7, 0, Math.PI, 0); x.fill(); }
        for (let k=0;k<6;k++){ x.fillStyle = 'rgba(255,214,140,.85)'; x.fillRect(p+18+k*11, base-44, 5, 14); x.fillStyle = '#b8a890'; x.fillRect(p+16+k*11, base-48, 2, 30); }
        glowDot(x, p+48, base-30, 60, 'rgba(255,200,120,.3)'); }
      // MASP
      { const p = 160, w = 160;
        x.fillStyle = '#26243e'; x.fillRect(p+4, base-80, w-8, 40);
        for (let yy = base-76; yy < base-44; yy += 6) for (let xx = p+8; xx < p+w-8; xx += 7){ x.fillStyle = R()<.35 ? 'rgba(255,214,140,.7)' : 'rgba(120,130,170,.25)'; x.fillRect(xx, yy, 4, 3); }
        x.fillStyle = '#e02a2e'; x.fillRect(p-6, base-92, w+12, 12); x.fillRect(p-6, base-92, 12, 92); x.fillRect(p+w-6, base-92, 12, 92);
        x.fillStyle = '#a81820'; x.fillRect(p-6, base-82, w+12, 2); x.fillRect(p+2, base-92, 4, 92); x.fillRect(p+w+2, base-92, 4, 92);
        for (let k=0;k<10;k++){ x.fillStyle = WALLS[R()*WALLS.length|0]; x.fillRect(p+12 + R()*(w-24), base-7, 2.4, 7); } }
      // árvores e postes da avenida
      for (let i=0;i<16;i++){ const p0 = R()*LW; rep(p0, p => leafCluster(x, p, base-14, 12+R()*8, '#1e3a2a', '#2e5a3a', null, R)); }
      for (let p0 = 20; p0 < LW; p0 += 72){ rep(p0, p => { x.fillStyle = '#2a2838'; x.fillRect(p, base-46, 2, 46); x.fillRect(p, base-46, 10, 2); glowDot(x, p+10, base-43, 16, 'rgba(255,214,150,.8)', .7); }); }
      x.fillStyle = '#3a3646'; x.fillRect(0, base, LW, 34);
      x.fillStyle = '#4a4656'; for (let p = 0; p < LW; p += 10) x.fillRect(p, base+4 + (p/10%2)*6, 6, 3);
      L.water = c; L.waterF = .42; }
    { const [c,x] = mk(LW,H); // avenida
      x.fillStyle = '#4a4656'; x.fillRect(0, 586, LW, 4);
      x.fillStyle = '#1e1c26'; x.fillRect(0, 590, LW, 56);
      x.fillStyle = '#e8e4f0'; for (let p = 0; p < LW; p += 36) x.fillRect(p, 615, 18, 2);
      L.fg = c; }
    L.top = '#141634'; L.bot = '#1e1c26';
    return L;
  },
};

/* ---------- texturas dos obstáculos ---------- */
const TEX_LEN = 680;
function cylGrad(x, w, stops){ const g = x.createLinearGradient(0,0,w,0); stops.forEach(([o,c])=>g.addColorStop(o,c)); return g; }
function buildObstacles(){
  const out = {}, R = rng(99);
  // pilar vermelho do MASP
  out.masp = [0,1].map(v => {
    const [c,x] = mk(OBST_W, TEX_LEN);
    x.fillStyle = cylGrad(x, OBST_W, [[0,'#4a080c'],[.18,'#a01a20'],[.38,'#ec3a3c'],[.52,'#c82428'],[.85,'#741014'],[1,'#34060a']]); x.fillRect(0,0,OBST_W,TEX_LEN);
    for (let i=0;i<260;i++){ x.fillStyle = R()<.5 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.07)'; x.fillRect(R()*OBST_W, R()*TEX_LEN, 1.5, 1.5); }
    for (let yy=60; yy<TEX_LEN; yy+=60){ x.fillStyle = 'rgba(0,0,0,.14)'; x.fillRect(0,yy,OBST_W,1.4); }
    for (let i=0;i<6;i++){ x.fillStyle = 'rgba(40,0,0,.25)'; x.fillRect(R()*OBST_W, R()*TEX_LEN, 1.4, 18+R()*30); }
    if (v===1){ // pixo paulistano
      x.save(); x.translate(10, 250); x.strokeStyle = 'rgba(20,16,24,.85)'; x.lineWidth = 2.2; x.lineJoin = 'miter';
      for (let k=0;k<4;k++){ const bx = k*11; x.beginPath(); x.moveTo(bx, 34); x.lineTo(bx, 0); x.lineTo(bx+7, 6); x.lineTo(bx+7, 34); if (k%2){ x.moveTo(bx, 17); x.lineTo(bx+7, 17); } x.stroke(); }
      x.restore();
    }
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
    if (v===1){ x.save(); x.translate(OBST_W/2, 320); x.rotate(-.05); x.fillStyle = '#ffe14a'; x.fillRect(-23,-30,46,58); x.fillStyle = '#1a1a1a'; x.textAlign = 'center';
      x.font = '900 10px Rubik, sans-serif'; x.fillText('ALUGA-SE', 0, -15); x.fillText('CASA', 0, -3); x.font = '700 7px Rubik, sans-serif'; x.fillText('2 QUARTOS', 0, 9); x.fillText('TRATAR AQUI', 0, 19); x.restore(); }
    for (let i=0;i<8;i++){ const py = R()*TEX_LEN; x.fillStyle = 'rgba(120,80,50,.35)'; x.fillRect(R()*OBST_W, py, 1.4, 14+R()*24); }
    return c;
  });
  // tampas
  const caps = {};
  { const [c,x] = mk(OBST_W+14, 24); x.fillStyle = cylGrad(x, OBST_W+14, [[0,'#5a0a0e'],[.3,'#f04044'],[.5,'#d02a2e'],[1,'#4a080c']]); x.fillRect(0,0,OBST_W+14,24);
    x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0,0,OBST_W+14,2.5); x.fillRect(0,21.5,OBST_W+14,2.5); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(0,3,OBST_W+14,1.2);
    caps.masp = c; }
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
let bgmKey = null, bgmPending = false;
function bgmEl(){ return bgmKey ? songEl(BGM[bgmKey]) : null; }
function bgmPlay(key){
  if (key !== bgmKey){ bgmStop(); bgmKey = key; const el = bgmEl(); el.loop = true; el.volume = BGM_VOL; try { el.currentTime = 0; } catch(e){} }
  const el = bgmEl(); if (!el) return;
  el.muted = !soundOn;
  if (!el.paused) return;
  let p; try { p = el.play(); } catch(e){ p = null; }
  bgmPending = false;
  if (p && p.catch) p.catch(() => { bgmPending = true; });
}
function bgmPause(){ const el = bgmEl(); if (el) try { el.pause(); } catch(e){} }
function bgmStop(){ bgmPause(); bgmKey = null; bgmPending = false; }
function toMenu(){
  bgmStop();
  st.mode = 'menu'; setScene(0); st.confetti = []; st.obst = []; st.pickups = []; st.signs = []; st.parts = [];
  st.score = 0; st.ibis = 0; st.hearts = CONFIG.vidas;
  $('#best').textContent = st.best ? `RECORDE: ${st.best} ★` : 'CUBATÃO É NÓIS';
  show('menu'); hudOn(false); hint(false); $('#tag').classList.remove('on');
}
function enterPhase(i, opts={}){
  if (i !== st.phase || !st.scene || opts.rebuild) setScene(i, opts.crossfade);
  bgmPlay(PHASES[i].bgm);
  const P = PHASES[i];
  st.mode = 'ready'; st.y = H*.42; st.vy = 0; st.rot = 0; st.inv = 0; st.hurtT = 0;
  st.passed = 0; st.obst = []; st.pickups = []; st.parts = []; st.confetti = [];
  st.scoreAtPhase = st.score; st.ibisAtPhase = st.ibis; st.phaseIbis = 0;
  const signText = [ ['JD. NOVA','REPÚBLICA →'], ['MANGUEZAL','DE CUBATÃO →'], ['AV. PAULISTA','SÃO PAULO →'] ][i];
  st.signs = [{ x: 228, lines: signText, kind: i }];
  show(null); hudOn(true); hint(true); drawHUD();
  tag(`FASE ${i+1} · ${P.sub}`, P.nome, 2200);
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
  st.vy = FLAP; st.flapT = FLAP_DUR; sfx.flap();
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
  if (st.hearts <= 0){ st.mode = 'dying'; st.dieT = 0; st.landed = false; st.overT = 0; sfx.over(); hudOn(true); }
}
function phaseClear(){
  st.mode = 'clear';
  const P = PHASES[st.phase], last = st.phase === PHASES.length-1;
  if (st.score > st.best){ st.best = st.score; store.set('best', st.best); }
  sfx.clear();
  const gain = st.hearts < CONFIG.vidas ? 1 : 0;
  $('#clearT').innerHTML = `FASE ${st.phase+1}<br>COMPLETA!`;
  $('#clearP').textContent = `Você passou pelos ${P.obst} obstáculos!`;
  $('#clearI').textContent = `${st.phaseIbis}/${IBIS_PER_PHASE}`;
  $('#clearH').textContent = gain ? '+1' : 'CHEIO';
  $('#nextBtn').textContent = last ? 'PRÓXIMA: O SHOW →' : `PRÓXIMA: ${PHASES[st.phase+1].nome} →`;
  st.pendingHeart = gain;
  setTimeout(() => { if (st.mode === 'clear') show('clear'); }, 450);
}
function waLink(msg){ const n = String(CONFIG.festa.whatsapp || '').replace(/\D/g, ''); return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`; }
function finale(){
  st.mode = 'finale'; stopSong(); bgmPlay('final');
  const f = CONFIG.festa;
  $('#fTitle').textContent = f.titulo;
  $('#fList').innerHTML = [['QUANDO', f.data], ['HORA', f.hora], ['ONDE', f.local], ['ENDEREÇO', f.endereco]].filter(r => r[1]).map(([k,v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('');
  $('#fMap').href = f.mapa; $('#fMap').hidden = !f.mapa;
  $('#rsvpYes').href = waLink(f.msgSim); $('#rsvpNo').href = waLink(f.msgNao); $('#rsvpNote').hidden = true;
  $('#finI').textContent = `${st.ibis}/${TOTAL_IBIS}`; $('#finS').textContent = st.score;
  $('#finRw').hidden = !st.show; if (st.show) $('#finR').textContent = st.show.total.toLocaleString('pt-BR');
  $('#rank').textContent = st.ibis >= TOTAL_IBIS ? 'LENDA DOS GUARÁS!' : st.ibis >= 10 ? 'CAÇADOR DE GUARÁS!' : st.ibis >= 5 ? 'BOM DE ASA!' : 'SOBREVIVENTE DE CUBATÃO!';
  for (let i=0;i<140;i++) st.confetti.push(confetto(true));
  setTimeout(() => { if (st.mode === 'finale'){ show('finale'); $('#finale').scrollTop = 0; } }, 700);
}
$('#rsvpYes').addEventListener('click', e => { e.stopPropagation(); const n = $('#rsvpNote'); n.textContent = 'Boa! É só mandar a mensagem no WhatsApp que abriu.'; n.hidden = false; });
$('#rsvpNo').addEventListener('click', e => { e.stopPropagation(); const n = $('#rsvpNote'); n.textContent = 'Tá certo, vacilão. A mensagem já tá pronta no WhatsApp.'; n.hidden = false; });
function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function confetto(burst){ const cols = ['#ffc531','#ff3348','#3fd36a','#4ab0ff','#ffffff','#ff8a3d']; return { x: burst ? W/2 + (Math.random()-.5)*60 : Math.random()*W, y: burst ? H*.45 : -10, vx: burst ? (Math.random()-.5)*520 : (Math.random()-.5)*40, vy: burst ? -200-Math.random()*420 : 40+Math.random()*60, r: Math.random()*TAU, vr: (Math.random()-.5)*12, w: 4+Math.random()*5, h: 6+Math.random()*6, c: cols[Math.random()*cols.length|0] }; }

/* ======================================================================
   UPDATE
   ====================================================================== */
function update(dt){
  st.t += dt;
  if (st.show && st.mode !== 'finale'){ updateShow(dt); return; }
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
    if (st.mode === 'dying'){
      st.dieT += dt;
      if (!st.landed && st.y >= GROUND_Y - 12){ // esborrachou no chão
        st.landed = true; st.landT = 0; st.y = GROUND_Y - 12; st.shake = .25; noise(.3,.7,180); tone(90,.25,'sine',.3,40);
        for (let i=0;i<14;i++) st.parts.push({ type:'dust', x: MIKE_X + (Math.random()-.5)*60, y: GROUND_Y + 6, vx:(Math.random()-.5)*160, vy:-30-Math.random()*60, life:1, r:6+Math.random()*8 });
      }
      if (st.landed){ st.y = GROUND_Y - 12; st.vy = 0; st.landT += dt; if (st.landT > 1.3 && st.mode === 'dying'){ st.mode = 'over'; show('over'); hudOn(false); } }
    }
  } else if (st.mode === 'ready' || st.mode === 'clear' || st.mode === 'finale' || st.mode === 'menu'){
    st.y = lerp(st.y, H*.42 + Math.sin(st.t*3)*10, 1 - Math.pow(.02, dt)); st.vy = Math.cos(st.t*3)*30;
  }
  const targetRot = st.mode === 'dying' ? 0 : clamp(st.vy/650*.45, -.32, .4);
  st.rot = lerp(st.rot, targetRot, 1 - Math.pow(.0005, dt));
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
    if (q.type === 'dust'){ q.vx *= Math.pow(.1, dt); q.vy *= Math.pow(.1, dt); q.r += 14*dt; }
    if (q.type === 'star') q.y -= 20*dt;
  }
  st.parts = st.parts.filter(q => q.life > 0);

  // pássaros decorativos (guarás ao fundo)
  const flock = st.scene && st.scene.live.flock;
  if (Math.random() < dt*(flock ? 1.5 : .45) && st.birds.length < (flock ? 12 : 4)){
    const n = flock && Math.random() < .5 ? 3 + (Math.random()*3|0) : 1, y0 = 70 + Math.random()*250, s = .45 + Math.random()*.3, v = 30 + Math.random()*30;
    for (let k=0;k<n;k++) st.birds.push({ x: W+30 + k*20, y: y0 + (k%2)*12 + k*4, s, v, ph: Math.random()*TAU });
  }
  for (const b of st.birds) b.x -= (b.v + worldSpeed*.2)*dt;
  st.birds = st.birds.filter(b => b.x > -40);

  // fumaça (fase 1)
  const L = st.scene;
  if (L && L.live.chimneys){
    for (const ch of L.live.chimneys){
      if (Math.random() < dt*6){
        const sx = wrapX(ch.x, ch.f || L.midF);
        if (sx > -40 && sx < W+40) st.smoke.push({ wx: ch.x, y: ch.y, r: 3, a: .35, f: ch.f || L.midF, dx: 0 });
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
  if (st.show){ renderShow(); return; }
  const L = st.scene, P = PHASES[st.phase];
  ctx.setTransform(S,0,0,S,0,0);
  if (PADT > 0){ ctx.fillStyle = L.top; ctx.fillRect(0,0,W,VH); ctx.fillStyle = L.bot; ctx.fillRect(0,PADT+H-2,W,VH); }
  ctx.translate(0, PADT);
  if (st.shake > 0){ const m = st.shake*14; ctx.translate((Math.random()-.5)*m, (Math.random()-.5)*m); }
  ctx.drawImage(L.sky, 0, 0, W, H);
  layer(L.clouds, .04);
  if (L.live.kites) for (const k of L.live.kites){
    const bx = k.x + Math.sin(st.t*1.3 + k.x)*6, by = k.y + Math.cos(st.t*1.7 + k.x)*5;
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(bx, by+8); ctx.quadraticCurveTo(bx-40, by+130, bx-90, by+280); ctx.stroke();
    ctx.save(); ctx.translate(bx, by); ctx.rotate(Math.sin(st.t*2 + k.x)*.15);
    ctx.fillStyle = k.c; ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(8,0); ctx.lineTo(0,9); ctx.lineTo(-8,0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(0,-11); ctx.lineTo(0,9); ctx.moveTo(-8,0); ctx.lineTo(8,0); ctx.stroke();
    ctx.strokeStyle = k.c; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0,9); for (let t=1;t<=6;t++) ctx.lineTo(Math.sin(st.t*5 + t)*3, 9 + t*4); ctx.stroke();
    ctx.restore();
  }
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
  const mikeOnTop = st.mode === 'dying' || st.mode === 'over';
  if (st.mode !== 'menu' && !mikeOnTop) drawMike();
  // partículas
  for (const q of st.parts){
    ctx.globalAlpha = clamp(q.life, 0, 1);
    if (q.type === 'feather'){ ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.r); ctx.fillStyle = q.col; ctx.beginPath(); ctx.ellipse(0,0,5,2,0,0,TAU); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(-5,0); ctx.lineTo(5,0); ctx.stroke(); ctx.restore(); }
    else if (q.type === 'spark'){ ctx.fillStyle = '#ffe28a'; ctx.beginPath(); ctx.arc(q.x, q.y, 3*q.life+1, 0, TAU); ctx.fill(); }
    else if (q.type === 'text'){ ctx.font = '400 15px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = '#14121c'; ctx.strokeText(q.txt, q.x, q.y); ctx.fillStyle = '#ffd34a'; ctx.fillText(q.txt, q.x, q.y); }
    else if (q.type === 'dust'){ ctx.globalAlpha = clamp(q.life,0,1)*.6; ctx.fillStyle = '#b9a690'; ctx.beginPath(); ctx.arc(q.x, q.y, q.r, 0, TAU); ctx.fill(); }
    else if (q.type === 'star'){ drawStar(q.x, q.y, 9 + (1-q.life)*6, st.t*6); }
    ctx.globalAlpha = 1;
  }
  layer(L.fg, 1);
  if (L.live.cars) for (let k=0;k<8;k++){
    const dir = k%2 ? 1 : -1, sp = 90 + (k*37)%70, y = dir > 0 ? 604 : 626, span = W + 120;
    const cx = ((k*151 + st.t*sp*dir) % span + span) % span - 60;
    glowDot(ctx, cx, y, 13, dir > 0 ? 'rgba(255,60,60,.9)' : 'rgba(255,240,200,.9)', .7);
    ctx.fillStyle = dir > 0 ? '#ff4a4a' : '#fff4d8'; ctx.fillRect(cx-6, y-1, 3, 2); ctx.fillRect(cx+3, y-1, 3, 2);
  }
  if (L.live.rain){
    ctx.strokeStyle = 'rgba(210,215,255,.2)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let k=0;k<50;k++){ const span = W + 60, rx = ((k*97.3 - st.t*70) % span + span) % span - 30, ry = ((k*173.7 + st.t*560) % (VH + 40)) - PADT - 20; ctx.moveTo(rx, ry); ctx.lineTo(rx-3, ry+11); }
    ctx.stroke();
  }
  if (mikeOnTop) drawMike();
  // confete
  for (const c of st.confetti){ ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h*Math.abs(Math.cos(c.r*1.3))); ctx.restore(); }
  // flash de dano
  if (st.hurtT > .45){ ctx.fillStyle = `rgba(255,60,60,${(st.hurtT-.45)*1.4})`; ctx.fillRect(0,-PADT,W,VH); }
  // transição entre fases
  if (st.fade > 0 && st.sceneOld){ ctx.globalAlpha = st.fade; ctx.drawImage(st.sceneOld, 0, -PADT, W, VH); ctx.globalAlpha = 1; }
}
function mikeFrame(){
  // devolve [animação, quadro, fator de rotação]
  if (st.mode === 'dying'){
    if (st.landed) return ['crash', Math.min(4, Math.floor(st.landT*10)), 0];
    return ['fall', Math.min(6, Math.floor(st.dieT*12)), 0];
  }
  if (st.mode === 'over') return ['crash', 4, 0];
  if (st.hurtT > 0) return ['fall', Math.min(2, Math.floor((.6 - st.hurtT)*9)), .3];
  if (st.flapT > 0) return ['flap', Math.min(6, Math.floor((1 - st.flapT/FLAP_DUR)*7)), 1];
  if (st.mode === 'play' && st.vy > 400) return ['fall', 0, .5];
  const n = ATLAS.frames.glide.length, k = Math.floor(st.t*7) % (n*2-2);
  return ['glide', k < n ? k : n*2-2-k, 1];
}
function drawMike(){
  if (!atlasImg.complete || !atlasImg.naturalWidth) return;
  const [anim, i, rf] = mikeFrame(), [sx, sy, sw, sh, ax, ay] = ATLAS.frames[anim][i];
  ctx.save();
  ctx.translate(MIKE_X, st.y); ctx.rotate(st.rot * rf);
  if (st.inv > 0 && st.mode === 'play' && st.hurtT <= 0 && Math.floor(st.inv*12) % 2) ctx.globalAlpha = .45;
  const k = SPR_SCALE;
  ctx.drawImage(atlasImg, sx, sy, sw, sh, -ax*k, -ay*k, sw*k, sh*k);
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
   FASE 4 — O SHOW (ritmo estilo Guitar Hero)
   ====================================================================== */
const SONGS = [
  { titulo:'MÚSICA 1', src:'assets/music/musica-1.mp3', fall:1.75, chart:{"bpm":129.2,"dur":14.96,"notes":[[0.116,1],[0.604,0],[1.091,1],[1.579,0],[2.043,0],[2.508,1],[2.949,2],[3.413,1],[3.878,0],[4.342,1],[4.807,0],[5.294,1],[5.712,0],[6.177,0],[6.641,1],[7.105,0],[7.57,1],[8.034,2],[8.475,1],[8.963,0],[9.427,1],[9.868,0],[10.333,0],[10.797,1],[11.262,0],[11.703,1],[12.167,2],[12.632,1],[13.096,2],[13.56,1],[14.025,2],[14.489,1]]} },
  { titulo:'MÚSICA 2', src:'assets/music/musica-2.mp3', fall:1.55, chart:{"bpm":143.6,"dur":11.15,"notes":[[0.255,1],[0.813,2],[1.231,1],[1.625,0],[2.02,1],[2.438,2],[2.67,2],[2.902,1],[3.344,2],[3.808,1],[4.203,0],[4.621,1],[4.83,0],[5.039,1],[5.457,0],[5.851,1],[6.246,0],[6.455,0,1],[6.664,1],[7.082,2],[7.291,1],[7.697,2],[8.104,1],[8.313,0],[8.533,1],[8.754,2],[9.172,2],[9.567,1],[9.961,0],[10.356,0],[10.751,1]]} },
  { titulo:'MÚSICA 3', src:'assets/music/musica-3.mp3', fall:1.35, chart:{"bpm":152.0,"dur":11.15,"notes":[[0.255,1],[0.65,2],[1.068,2],[1.463,1],[1.858,2],[2.252,1],[2.647,0],[3.042,0],[3.46,1],[3.831,2],[4.226,2],[4.423,1],[4.621,2],[5.016,2],[5.213,1],[5.41,0],[5.608,1],[5.805,0],[6.2,1],[6.409,0],[6.618,1],[6.989,2],[7.338,1],[7.546,0],[7.755,0],[7.976,1],[8.197,0],[8.591,1],[8.789,2],[8.986,1],[9.183,2],[9.381,1,0],[9.799,0],[9.996,1],[10.194,2],[10.391,2],[10.588,1],[10.786,0],[10.983,1]]} },
];
const LANE_COL = ['#ffc531', '#ff3348', '#3fd36a'];
const LANE_KEYS = [['KeyA','KeyJ','ArrowLeft','Digit1'], ['KeyS','KeyK','ArrowDown','Digit2'], ['KeyD','KeyL','ArrowRight','Digit3']];
const HIT_Y = 528, TOP_Y = 222, LEAD = 2.2;
const WIN_PERFECT = .075, WIN_GOOD = .15;
/* música via <audio>: toca mesmo com o iPhone no silencioso; os arquivos já têm LEAD s de silêncio no início */
const songEls = {};
function songEl(src){
  if (songEls[src]) return songEls[src];
  let url = src;
  if (src.startsWith('data:')){
    try {
      const b = atob(src.slice(src.indexOf(',')+1)), u = new Uint8Array(b.length);
      for (let i=0;i<b.length;i++) u[i] = b.charCodeAt(i);
      url = URL.createObjectURL(new Blob([u], { type:'audio/mpeg' }));
    } catch(e){}
  }
  const el = new Audio(); el.preload = 'auto'; el.setAttribute('playsinline', ''); el.src = url;
  el.addEventListener('error', () => { el.failed = true; });
  el.load();
  return songEls[src] = el;
}
function showTime(){
  const sh = st.show, now = performance.now()/1000;
  if (sh.noAudio) return now - sh.t0;
  const el = sh.el;
  if (!el || el.paused) return sh.lastT;
  const m = el.currentTime;
  if (m !== sh.lastM){ sh.lastM = m; sh.syncWall = now; sh.syncMedia = m; }
  const t = Math.max(sh.lastT, sh.syncMedia + Math.min(.3, now - sh.syncWall) - LEAD);
  sh.lastT = t; return t;
}
function stopSong(){ const sh = st.show; if (sh && sh.el){ try { sh.el.pause(); } catch(e){} } }
function playSong(){
  const sh = st.show, el = sh.el;
  if (el.failed){ sh.noAudio = true; sh.t0 = performance.now()/1000 + LEAD; sh.needTap = false; return; }
  el.muted = !soundOn;
  try { el.currentTime = 0; } catch(e){}
  sh.lastT = -LEAD; sh.lastM = -1;
  let p; try { p = el.play(); } catch(e){ p = Promise.reject(e); }
  sh.needTap = false;
  if (p && p.catch) p.catch(err => {
    if (st.show !== sh) return;
    if (err && err.name === 'NotAllowedError') sh.needTap = true;
    else { sh.noAudio = true; sh.t0 = performance.now()/1000 + LEAD; }
  });
}

function startShow(){
  audio(); bgmStop();
  st.show = { song:0, total:0, el:null };
  st.confetti = []; st.parts = [];
  show(null); hudOn(false); hint(false);
  document.body.style.setProperty('--glow', '#b03ae0');
  SONGS.forEach(s => songEl(s.src));
  startSong(0);
}
function startSong(i){
  const sh = st.show, S0 = SONGS[i];
  stopSong();
  Object.assign(sh, { song:i, notes:[], score:0, combo:0, maxCombo:0, hits:0, perfect:0, misses:0, energy:70,
    judge:null, judgeT:0, laneFlash:[0,0,0], hitFx:[], missT:0, flapT:0, rockT:0, loading:false, ended:false,
    el: songEl(S0.src), noAudio:false, needTap:false, t0:0, lastT:-LEAD, dur: S0.chart.dur });
  for (const n of S0.chart.notes){ sh.notes.push({ t:n[0], lane:n[1], done:false }); if (n.length > 2) sh.notes.push({ t:n[0], lane:n[2], done:false }); }
  sh.notes.sort((a,b) => a.t - b.t);
  st.mode = 'show';
  show(null);
  tag(`FASE 4 · MÚSICA ${i+1} DE ${SONGS.length}`, i === 0 ? 'O SHOW!' : S0.titulo, 2000);
  playSong();
}
function judge(kind){
  const sh = st.show; sh.judge = kind; sh.judgeT = .55;
}
function hitLane(l){
  const sh = st.show; if (!sh || st.mode !== 'show') return;
  if (sh.needTap){ sh.needTap = false; playSong(); return; }
  sh.laneFlash[l] = .18;
  const t = showTime();
  let best = null, bd = 9;
  for (const n of sh.notes){ if (n.done || n.lane !== l) continue; const d = Math.abs(n.t - t); if (d < bd){ bd = d; best = n; } if (n.t - t > WIN_GOOD) break; }
  if (!best || bd > WIN_GOOD) return;
  best.done = true;
  const perfect = bd <= WIN_PERFECT;
  sh.combo++; sh.maxCombo = Math.max(sh.maxCombo, sh.combo); sh.hits++; if (perfect) sh.perfect++;
  const mult = Math.min(4, 1 + Math.floor(sh.combo/8));
  sh.score += (perfect ? 100 : 50) * mult;
  sh.energy = Math.min(100, sh.energy + (perfect ? 4 : 2.5));
  sh.flapT = FLAP_DUR;
  if (sh.combo >= 8 && sh.combo % 8 === 0) sh.rockT = .9;
  judge(perfect ? 'PERFEITO!' : 'BOM!');
  sh.hitFx.push({ lane:l, life:1, perfect });
  if (sh.combo > 0 && sh.combo % 10 === 0) tone(1320, .12, 'triangle', .06);
}
function missNote(){
  const sh = st.show;
  sh.combo = 0; sh.misses++; sh.energy -= 13; sh.missT = .6; sh.rockT = 0;
  judge('ERROU!'); tone(140, .18, 'sawtooth', .08, 90);
  if (sh.energy <= 0){
    sh.energy = 0; stopSong(); st.mode = 'show-fail'; sfx.over(); st.shake = .3;
    $('#overT').textContent = 'A GALERA VAIOU!'; $('#over .mike').src = $('#gtSadSrc').src;
    $('#overP').innerHTML = 'O Mike perdeu o ritmo.<br>Bora tentar essa música de novo?';
    setTimeout(() => { if (st.mode === 'show-fail') show('over'); }, 800);
  }
}
function songDone(){
  const sh = st.show; stopSong();
  st.mode = 'show-wait'; sh.total += sh.score; sfx.clear();
  const n = sh.notes.length, acc = n ? Math.round(100*(sh.hits)/n) : 100, last = sh.song === SONGS.length-1;
  $('#songT').innerHTML = `${SONGS[sh.song].titulo}<br>${acc >= 90 ? 'ARRASOU!' : acc >= 70 ? 'MANDOU BEM!' : 'PASSOU!'}`;
  $('#songP').textContent = `${sh.score.toLocaleString('pt-BR')} pontos nessa música`;
  $('#songA').textContent = acc + '%'; $('#songC').textContent = sh.maxCombo;
  $('#songBtn').textContent = last ? 'IR PRA FESTA →' : `PRÓXIMA: ${SONGS[sh.song+1].titulo} →`;
  for (let i=0;i<60;i++) st.confetti.push(confetto(true));
  setTimeout(() => { if (st.mode === 'show-wait') show('song'); }, 500);
}
function updateShow(dt){
  const sh = st.show;
  for (let k=0;k<3;k++) sh.laneFlash[k] = Math.max(0, sh.laneFlash[k] - dt);
  sh.judgeT = Math.max(0, sh.judgeT - dt); sh.missT = Math.max(0, sh.missT - dt); sh.flapT = Math.max(0, sh.flapT - dt); sh.rockT = Math.max(0, (sh.rockT||0) - dt);
  for (const f of sh.hitFx) f.life -= dt*2.6; sh.hitFx = sh.hitFx.filter(f => f.life > 0);
  st.shake = Math.max(0, st.shake - dt);
  for (const c of st.confetti){ c.vy += 300*dt; c.vy = Math.min(c.vy, 110); c.vx *= Math.pow(.3, dt); c.x += c.vx*dt; c.y += c.vy*dt; c.r += c.vr*dt; }
  st.confetti = st.confetti.filter(c => c.y < H+20);
  if (st.mode !== 'show' || sh.loading) return;
  const t = showTime();
  for (const n of sh.notes){ if (n.done) continue; if (n.t < t - WIN_GOOD){ n.done = true; missNote(); if (st.mode !== 'show') return; } else break; }
  const over = (!sh.noAudio && sh.el && sh.el.ended) || t > (sh.dur || 0) + .4;
  if (!sh.ended && over){ for (const n of sh.notes) if (!n.done){ n.done = true; sh.misses++; } sh.ended = true; songDone(); }
}

/* ---------- palco ---------- */
let stageBg = null;
function buildStage(){
  const [c,x] = mk(W,H);
  x.fillStyle = vgrad(x,0,H,[[0,'#0c0718'],[.5,'#1c0f34'],[1,'#2a1240']]); x.fillRect(0,0,W,H);
  // treliça
  x.strokeStyle = '#3a3448'; x.lineWidth = 2;
  for (const yy of [52, 66]){ x.beginPath(); x.moveTo(0,yy); x.lineTo(W,yy); x.stroke(); }
  x.lineWidth = 1; for (let xx=0; xx<W; xx+=14){ x.beginPath(); x.moveTo(xx,52); x.lineTo(xx+14,66); x.moveTo(xx+14,52); x.lineTo(xx,66); x.stroke(); }
  // caixas de som
  for (const sx of [6, W-46]){ x.fillStyle = '#141018'; x.fillRect(sx, 380, 40, 150); x.strokeStyle = '#2a2430'; x.strokeRect(sx+.5, 380.5, 39, 149);
    for (const yy of [410, 460, 505]){ x.fillStyle = '#26202e'; x.beginPath(); x.arc(sx+20, yy, 14, 0, TAU); x.fill(); x.fillStyle = '#0a080c'; x.beginPath(); x.arc(sx+20, yy, 6, 0, TAU); x.fill(); } }
  // faixa
  x.save(); x.translate(W/2, 30); x.fillStyle = '#ffc531'; x.fillRect(-92, -12, 184, 24); x.fillStyle = '#14121c'; x.font = '400 15px "Luckiest Guy", sans-serif'; x.textAlign = 'center'; x.fillText('NIVER DO MIKE', 0, 6); x.restore();
  stageBg = c;
}
function laneX(l, p){ // p: 0 no topo, 1 na linha de acerto
  const sc = lerp(.42, 1, p), gap = 98;
  return W/2 + (l-1)*gap*sc;
}
function laneY(p){ return lerp(TOP_Y, HIT_Y, p*p*.35 + p*.65); }
function renderShow(){
  const sh = st.show;
  if (!stageBg) buildStage();
  ctx.setTransform(S,0,0,S,0,0);
  ctx.fillStyle = '#0c0718'; ctx.fillRect(0,0,W,VH);
  ctx.translate(0, PADT);
  if (st.shake > 0){ const m = st.shake*12; ctx.translate((Math.random()-.5)*m, (Math.random()-.5)*m); }
  ctx.drawImage(stageBg, 0, 0, W, H);
  const t = sh.loading ? -LEAD : showTime(), bpm = SONGS[sh.song].chart.bpm, beat = Math.max(0, t) * bpm / 60, pulse = Math.pow(1 - (beat % 1), 3);
  // canhões de luz
  ctx.globalCompositeOperation = 'lighter';
  for (let k=0;k<4;k++){
    const ox = 40 + k*93, a = Math.sin(st.t*.9 + k*1.7)*.45, col = ['255,197,49','255,51,72','63,211,106','176,58,224'][k];
    const g = ctx.createLinearGradient(ox, 66, ox + Math.sin(a)*520, 600); g.addColorStop(0, `rgba(${col},${.22 + pulse*.18})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox-4, 66); ctx.lineTo(ox + Math.sin(a)*520 - 70, 640); ctx.lineTo(ox + Math.sin(a)*520 + 70, 640); ctx.lineTo(ox+4, 66); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  for (let k=0;k<8;k++){ ctx.fillStyle = ['#ffc531','#ff3348','#3fd36a','#b03ae0'][k%4]; ctx.globalAlpha = .5 + pulse*.5; ctx.beginPath(); ctx.arc(22 + k*45, 72, 4, 0, TAU); ctx.fill(); }
  ctx.globalAlpha = 1;
  // pista em perspectiva
  const pts = [[laneX(-.5,0), TOP_Y], [laneX(2.5,0), TOP_Y], [laneX(2.5,1.12), laneY(1.12)], [laneX(-.5,1.12), laneY(1.12)]];
  ctx.fillStyle = 'rgba(10,8,20,.82)'; ctx.beginPath(); pts.forEach(([a,b],i) => i ? ctx.lineTo(a,b) : ctx.moveTo(a,b)); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  for (let l=0;l<3;l++){
    if (sh.laneFlash[l] > 0){ ctx.fillStyle = LANE_COL[l]; ctx.globalAlpha = sh.laneFlash[l]*1.2; ctx.beginPath(); ctx.moveTo(laneX(l-.5,0), TOP_Y); ctx.lineTo(laneX(l+.5,0), TOP_Y); ctx.lineTo(laneX(l+.5,1.12), laneY(1.12)); ctx.lineTo(laneX(l-.5,1.12), laneY(1.12)); ctx.fill(); ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.beginPath(); ctx.moveTo(laneX(l+.5,0), TOP_Y); ctx.lineTo(laneX(l+.5,1.12), laneY(1.12)); if (l < 2) ctx.stroke();
  }
  // traços de tempo
  if (!sh.loading){ const fall = SONGS[sh.song].fall, spb = 60/bpm;
    for (let b = Math.ceil(t/spb); b*spb < t + fall; b++){ const p = 1 - (b*spb - t)/fall; if (p < 0) continue; ctx.strokeStyle = `rgba(255,255,255,${b%4 ? .07 : .18})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(laneX(-.5,p), laneY(p)); ctx.lineTo(laneX(2.5,p), laneY(p)); ctx.stroke(); } }
  // receptores
  for (let l=0;l<3;l++){
    const x = laneX(l,1), y = HIT_Y, on = sh.laneFlash[l] > 0;
    ctx.fillStyle = '#0c0a14'; ctx.beginPath(); ctx.arc(x, y, 27, 0, TAU); ctx.fill();
    ctx.strokeStyle = LANE_COL[l]; ctx.lineWidth = on ? 6 : 4; ctx.beginPath(); ctx.arc(x, y, 24, 0, TAU); ctx.stroke();
    ctx.fillStyle = on ? LANE_COL[l] : 'rgba(255,255,255,.08)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, TAU); ctx.fill();
    ctx.font = '400 11px "Lilita One", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillText(['A','S','D'][l], x, y + 44);
  }
  // notas
  if (!sh.loading){ const fall = SONGS[sh.song].fall;
    for (let i = sh.notes.length-1; i >= 0; i--){ const n = sh.notes[i]; if (n.done) continue; const p = 1 - (n.t - t)/fall; if (p < 0 || p > 1.15) continue;
      const x = laneX(n.lane, p), y = laneY(p), r = 19 * lerp(.45, 1, p);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + r*.35, r*1.05, r*.6, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#14121c'; ctx.beginPath(); ctx.arc(x, y, r+2.5, 0, TAU); ctx.fill();
      ctx.fillStyle = LANE_COL[n.lane]; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.arc(x, y, r*.45, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x - r*.35, y - r*.45, r*.28, r*.16, -.5, 0, TAU); ctx.fill();
    } }
  // efeitos de acerto
  for (const f of sh.hitFx){ const x = laneX(f.lane,1); ctx.strokeStyle = LANE_COL[f.lane]; ctx.globalAlpha = f.life; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, HIT_Y, 26 + (1-f.life)*26, 0, TAU); ctx.stroke();
    for (let k=0;k<8;k++){ const a = k/8*TAU, d = 20 + (1-f.life)*40; ctx.fillStyle = f.perfect ? '#fff' : LANE_COL[f.lane]; ctx.beginPath(); ctx.arc(x + Math.cos(a)*d, HIT_Y + Math.sin(a)*d, 3*f.life + 1, 0, TAU); ctx.fill(); } ctx.globalAlpha = 1; }
  // plateia
  for (let k=0;k<14;k++){
    const x = 8 + k*26 + (k%2)*6, bob = (k%3 === 0 ? pulse : Math.pow(1 - ((beat + .5) % 1), 3))*7, y = 618 - bob;
    ctx.fillStyle = '#06040c'; ctx.beginPath(); ctx.arc(x, y - 18, 9, 0, TAU); ctx.fill(); ctx.fillRect(x-12, y-10, 24, 40);
    if (k%4 === 1){ ctx.strokeStyle = '#06040c'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x+8, y-6); ctx.lineTo(x+16, y-34 - bob); ctx.stroke(); }
  }
  // Mike guitarrista no fundo do palco
  if (gtImg.complete && gtImg.naturalWidth){
    let anim = 'play', i = Math.floor((t < 0 ? st.t*3 : beat)*2) % 6;
    if (st.mode === 'show-fail'){ anim = 'miss'; i = 4; }
    else if (st.mode === 'show-wait' || st.mode === 'finale'){ anim = 'cheer'; i = Math.floor(st.t*5) % 4; }
    else if (sh.missT > 0){ anim = 'miss'; i = Math.min(3, Math.floor((.6 - sh.missT)/.6*4)); }
    else if (sh.rockT > 0){ anim = 'rock'; i = Math.min(4, Math.floor((.9 - sh.rockT)/.9*5)); }
    const [sx, sy, sw, sh2, ax, ay] = GT.frames[anim][i], k = GT_H / GT.h, fy = TOP_Y + 4 - (anim === 'play' ? pulse*2 : 0);
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(W/2, TOP_Y + 4, 40, 6, 0, 0, TAU); ctx.fill();
    ctx.drawImage(gtImg, sx, sy, sw, sh2, W/2 - ax*k, fy - ay*k, sw*k, sh2*k);
  }
  // HUD do show
  const txt = (s, x, y, size, col, al='center', font='"Lilita One"') => { ctx.font = `400 ${size}px ${font}, sans-serif`; ctx.textAlign = al; ctx.lineWidth = size*.28; ctx.strokeStyle = '#14121c'; ctx.lineJoin = 'round'; ctx.strokeText(s, x, y); ctx.fillStyle = col; ctx.fillText(s, x, y); };
  const topY = 26 - PADT;
  txt(`${SONGS[sh.song].titulo} · ${sh.song+1}/${SONGS.length}`, 14, topY + 4, 14, '#ffe3a3', 'left');
  txt((sh.total + sh.score).toLocaleString('pt-BR'), W - 14, topY + 8, 24, '#fff', 'right');
  // energia
  const ex = 14, ey = topY + 14, ew = 130, eh = 9;
  ctx.fillStyle = '#000a'; roundRect(ex-2, ey-2, ew+4, eh+4, 6); ctx.fill();
  const ec = sh.energy > 45 ? '#3fd36a' : sh.energy > 22 ? '#ffc531' : '#ff3348';
  ctx.fillStyle = ec; roundRect(ex, ey, Math.max(4, ew*sh.energy/100), eh, 4); ctx.fill();
  if (sh.combo >= 4){ ctx.globalAlpha = .55; txt(`${sh.combo} COMBO`, W/2, 330, 20, '#fff'); const mult = Math.min(4, 1 + Math.floor(sh.combo/8)); if (mult > 1) txt(`x${mult}`, W/2, 352, 15, '#ffc531'); ctx.globalAlpha = 1; }
  if (sh.judgeT > 0){ const a = Math.min(1, sh.judgeT*3), s = 1 + (sh.judgeT > .45 ? (sh.judgeT-.45)*3 : 0); ctx.globalAlpha = a; txt(sh.judge, W/2, 452, 26*s, sh.judge === 'ERROU!' ? '#ff3348' : sh.judge === 'PERFEITO!' ? '#ffc531' : '#3fd36a', 'center', '"Luckiest Guy"'); ctx.globalAlpha = 1; }
  if (sh.needTap) txt('TOQUE PARA COMEÇAR', W/2, 400, 22, '#fff');
  else if (t < 0){ const n = Math.ceil(-t); if (n <= 3 && st.mode === 'show') txt(String(n), W/2, 400, 64 + (1 - ((-t)%1))*20, '#fff', 'center', '"Luckiest Guy"'); }
  for (const c of st.confetti){ ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.fillStyle = c.c; ctx.fillRect(-c.w/2, -c.h/2, c.w, c.h*Math.abs(Math.cos(c.r*1.3))); ctx.restore(); }
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
  OB = buildObstacles(); stageBg = null;
  if (st.scene) st.scene = SCENES[PHASES[st.phase].id]();
}
addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(resize, 120); });

function press(e){
  if (e && e.target.closest && e.target.closest('button,a')) return;
  audio();
  if (bgmPending && bgmKey) bgmPlay(bgmKey);
  if (st.mode === 'show'){ if (e && e.clientX !== undefined){ const r = cv.getBoundingClientRect(), lx = (e.clientX - r.left)/r.width*W; hitLane(lx < W/3 ? 0 : lx < W*2/3 ? 1 : 2); } return; }
  if (st.mode === 'play') flap();
  else if (st.mode === 'ready') startPlay();
  else if (st.mode === 'menu') { sfx.click(); enterPhase(0); }
}
game.addEventListener('pointerdown', e => { if (e.button > 0) return; press(e); if (!e.target.closest('button,a')) e.preventDefault(); });
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (st.mode === 'show'){ const l = LANE_KEYS.findIndex(ks => ks.includes(e.code)); if (l >= 0){ e.preventDefault(); hitLane(l); return; } }
  if (e.code === 'Space' && st.mode === 'show-wait' && $('#song').classList.contains('on')){ e.preventDefault(); act('nextSong'); return; }
  if (e.code === 'Space' && st.mode === 'show-fail'){ e.preventDefault(); act('retry'); return; }
  if (['Space','ArrowUp','KeyW'].includes(e.code)){ e.preventDefault();
    if (st.mode === 'over') act('retry'); else if (st.mode === 'clear' && $('#clear').classList.contains('on')) act('next'); else if (st.mode === 'pause') act('resume'); else press();
  }
  if (e.code === 'Escape' || e.code === 'KeyP'){ if (st.mode === 'play') act('pause'); else if (st.mode === 'pause') act('resume'); }
  if (e.code === 'KeyM') setSound(!soundOn);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && st.mode === 'play') act('pause');
  if (document.hidden) bgmPause();
  if (!document.hidden && bgmKey && st.mode !== 'pause') bgmPlay(bgmKey);
  if (document.hidden && st.mode === 'show'){ stopSong(); st.mode = 'show-paused'; }
  if (!document.hidden && st.mode === 'show-paused') startSong(st.show.song);
});
const overImgDefault = $('#over .mike').src;
function resetOverText(){ $('#over .mike').src = overImgDefault; $('#overT').textContent = 'GAME OVER'; $('#overP').innerHTML = 'Não foi dessa vez,<br>mas a festa ainda te espera!'; }

let pausedFrom = null;
function act(a){
  audio();
  switch (a){
    case 'start': sfx.click(); enterPhase(0); break;
    case 'pause': if (st.mode === 'play' || st.mode === 'ready'){ pausedFrom = st.mode; st.mode = 'pause'; show('pause'); bgmPause(); } break;
    case 'resume': if (st.mode === 'pause'){ st.mode = pausedFrom || 'play'; show(null); last = performance.now(); if (bgmKey) bgmPlay(bgmKey); } break;
    case 'retry': if (st.show){ sfx.click(); resetOverText(); startSong(st.show.song); break; } sfx.click(); st.score = st.scoreAtPhase; st.ibis = st.ibisAtPhase; st.hearts = CONFIG.vidas; enterPhase(st.phase); break;
    case 'menu': sfx.click(); stopSong(); st.show = null; resetOverText(); toMenu(); break;
    case 'next': if (st.phase === PHASES.length-1){ sfx.click(); startShow(); break; } sfx.click(); st.hearts = Math.min(CONFIG.vidas, st.hearts + (st.pendingHeart||0)); st.pendingHeart = 0; enterPhase(st.phase + 1, { crossfade: true }); break;
    case 'nextSong': if (st.show && st.mode === 'show-wait'){ sfx.click(); if (st.show.song < SONGS.length-1) startSong(st.show.song+1); else finale(); } break;
    case 'restart': stopSong(); st.show = null; sfx.click(); st.confetti = []; st.score = 0; st.ibis = 0; st.hearts = CONFIG.vidas; enterPhase(0, { crossfade: true, rebuild: true }); break;
    case 'sound': setSound(!soundOn); sfx.click(); break;
    case 'intro': sfx.click(); show('menu'); bgmPlay('cubatao'); break;
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
if (q.get('fase') === 'fim'){ st.show = null; finale(); }
else if (q.get('fase') === '4') startShow();
else if (!q.get('fase')) show('intro');
else if (q.get('fase')){ const f = clamp((+q.get('fase')||1)-1, 0, PHASES.length-1); setScene(f); enterPhase(f); }
window.__fm = { bgm: () => ({ key: bgmKey, el: bgmEl() && { t: bgmEl().currentTime, p: bgmEl().paused } }), st, act, enterPhase, startPlay, PHASES, startShow, hitLane, showTime, SONGS };
})();
