import {createClient, parseForecast, localTime, localDay, condition} from './core.js';
import {createScene} from './scene3d.js';

const $ = id => document.getElementById(id);
const el = {provinsi:$('provinsi'), kota:$('kota'), refresh:$('refresh'), lokasi:$('lokasi'), suhu:$('suhu'),
  kondisi:$('kondisi'), waktu:$('waktu'), status:$('status'), stats:$('stats'), days:$('days'), slots:$('slots'),
  canvas:$('scene'), fallback:$('fallback')};

const client = createClient({fetcher:url => fetch(url, {headers:{Accept:'application/json'}})});
const dayFmt = new Intl.DateTimeFormat('id-ID', {weekday:'long', day:'numeric', month:'short'});
const state = {regions:null, loc:null, slots:[], day:null, selected:null, tz:'Asia/Jakarta'};

/* ---------- 3D (degrades to 2D) ---------- */
let scene3d = null;
function hasWebGL(){
  try { return !!(document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl')); }
  catch { return false; }
}
if (hasWebGL()){
  try { scene3d = createScene(el.canvas); }
  catch (e) { console.warn('3D gagal:', e); }
}
if (!scene3d){
  el.fallback.hidden = false;
  el.canvas.style.display = 'none';
}

/* ---------- regions ---------- */
async function loadRegions(){
  const res = await fetch(`${import.meta.env.BASE_URL}regions.json`);
  if (!res.ok) throw new Error('Daftar wilayah gagal dimuat.');
  state.regions = await res.json();

  for (const p of state.regions.provinces){
    el.provinsi.add(new Option(titleCase(p), p));
  }
  const want = decodeURIComponent(location.hash.slice(1)) || DEFAULT_ADM2;
  const known = state.regions.locations.find(l => l.adm2 === want) ?? state.regions.locations.find(l => l.adm2 === DEFAULT_ADM2);
  el.provinsi.value = known ? known.provinsi : 'DKI JAKARTA';
  fillKota(known ? known.adm2 : null);
}

function fillKota(preselect){
  const prov = el.provinsi.value;
  el.kota.replaceChildren();
  const list = state.regions.locations.filter(l => l.provinsi === prov);
  for (const l of list) el.kota.add(new Option(titleCase(l.nama), l.adm2));
  el.kota.disabled = !list.length;
  if (preselect && list.some(l => l.adm2 === preselect)) el.kota.value = preselect;
  else if (list.length) el.kota.selectedIndex = 0;
}

const titleCase = s => s.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase())
  .replace(/\bKab\./g, 'Kab.').replace(/\bKota\b/g, 'Kota')
  .replace(/\bDki\b/g, 'DKI').replace(/\bDi\b/g, 'DI').replace(/\bAdm\./g, 'Adm.');
const DEFAULT_ADM2 = '31.71'; // Kota Adm. Jakarta Pusat

/* ---------- forecast ---------- */
async function showForecast(adm2){
  const loc = state.regions.locations.find(l => l.adm2 === adm2);
  if (!loc) return;
  state.loc = loc;
  history.replaceState(null, '', `#${adm2}`);
  setStatus('Mengambil data BMKG…');
  el.refresh.disabled = true;
  el.suhu.textContent = '--';
  el.kondisi.textContent = '—';
  el.lokasi.textContent = `${titleCase(loc.nama)} · ${titleCase(loc.provinsi)}`;

  try {
    const raw = await client.get(loc.adm4);
    const parsed = parseForecast(raw);
    state.slots = parsed.slots;
    state.tz = parsed.location.timezone || 'Asia/Jakarta';
    state.day = localDay(nearest(state.slots).instant, state.tz);
    state.selected = nearest(state.slots);
    setStatus('');
    renderAll();
  } catch (err) {
    setStatus(err.message || 'Gagal memuat prakiraan.', true);
    el.slots.replaceChildren();
    el.days.replaceChildren();
    el.stats.replaceChildren();
  } finally {
    el.refresh.disabled = false;
  }
}

const nearest = slots => {
  const now = Date.now();
  return slots.reduce((best, s) => Math.abs(Date.parse(s.instant) - now) < Math.abs(Date.parse(best.instant) - now) ? s : best, slots[0]);
};

function renderAll(){
  renderHero(state.selected);
  renderStats(state.selected);
  renderDays();
  renderSlots();
}

function renderHero(slot){
  const loc = state.loc;
  el.lokasi.textContent = `${titleCase(loc.nama)} · ${titleCase(loc.provinsi)}`;
  el.lokasi.title = `Titik prakiraan: ${loc.desa}, Kec. ${loc.kecamatan} (${loc.adm4})`;
  el.suhu.textContent = slot.t ?? '--';
  el.kondisi.textContent = slot.weather_desc ?? '—';
  const dayLabel = localDay(slot.instant, state.tz) === localDay(new Date().toISOString(), state.tz) ? 'Hari ini' : dayFmt.format(new Date(slot.instant));
  el.waktu.textContent = `${dayLabel}, ${localTime(slot.instant, state.tz)} ${tzLabel(state.tz)} · prakiraan ${slot.time_index ?? ''}`.trim();
  scene3d?.setCondition(condition(slot));
}

function renderStats(slot){
  const vsValue = slot.vs_text || (slot.vs != null && slot.vs !== '' ? `${slot.vs} km` : '—');
  const rows = [
    ['Kelembapan', num(slot.hu, '%')],
    ['Angin', num(slot.ws, ' km/jam'), slot.wd ? `dari ${slot.wd}${slot.wd_deg != null ? ` (${slot.wd_deg}°)` : ''}` : ''],
    ['Tutupan awan', num(slot.tcc, '%')],
    ['Potensi hujan', num(slot.tp, ' mm')],
    ['Jarak pandang', vsValue, vsValue === '—' ? 'tidak dilaporkan BMKG' : ''],
    ['Arah angin', slot.wd_to ? `ke ${slot.wd_to}` : '—'],
  ];
  el.stats.replaceChildren(...rows.map(([label, value, sub]) => {
    const card = document.createElement('div');
    card.className = 'card';
    const s = document.createElement('span'); s.textContent = label;
    const b = document.createElement('b'); b.textContent = value;
    card.append(s, b);
    if (sub){ const small = document.createElement('small'); small.textContent = sub; card.append(small); }
    return card;
  }));
}

const num = (v, unit) => (v === null || v === undefined || v === '') ? '—' : `${v}${unit}`;
const tzLabel = tz => ({'Asia/Jakarta':'WIB','Asia/Makassar':'WITA','Asia/Jayapura':'WIT'})[tz] ?? tz;

function days(){
  const map = new Map();
  for (const s of state.slots){
    const d = localDay(s.instant, state.tz);
    if (!map.has(d)) map.set(d, s);
  }
  return [...map.entries()];
}

function renderDays(){
  const today = localDay(new Date().toISOString(), state.tz);
  el.days.replaceChildren(...days().map(([d, s], i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'day'; b.role = 'tab';
    b.setAttribute('aria-selected', String(d === state.day));
    b.textContent = d === today ? 'Hari ini' : i === 1 ? 'Besok' : dayFmt.format(new Date(s.instant));
    b.onclick = () => {
      state.day = d;
      state.selected = state.slots.find(x => localDay(x.instant, state.tz) === d);
      renderAll();
    };
    return b;
  }));
}

function renderSlots(){
  const list = state.slots.filter(s => localDay(s.instant, state.tz) === state.day);
  el.slots.replaceChildren(...list.map(s => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'slot';
    b.setAttribute('aria-current', String(s.instant === state.selected?.instant));
    const time = document.createElement('time');
    time.textContent = localTime(s.instant, state.tz);
    const temp = document.createElement('strong');
    temp.textContent = s.t != null ? `${s.t}°` : '—';
    const desc = document.createElement('em');
    desc.textContent = s.weather_desc ?? '—';
    b.append(time, temp, desc);
    b.onclick = () => { state.selected = s; renderHero(s); renderStats(s); renderSlots(); };
    return b;
  }));
}

function setStatus(msg, isErr = false){
  el.status.textContent = msg;
  el.status.classList.toggle('err', !!isErr);
}

/* ---------- events ---------- */
el.provinsi.addEventListener('change', () => { fillKota(null); showForecast(el.kota.value); });
el.kota.addEventListener('change', () => showForecast(el.kota.value));
el.refresh.addEventListener('click', () => state.loc && showForecast(state.loc.adm2));
window.addEventListener('hashchange', () => {
  const adm2 = decodeURIComponent(location.hash.slice(1));
  const loc = state.regions?.locations.find(l => l.adm2 === adm2);
  if (loc && loc.adm2 !== state.loc?.adm2){ el.provinsi.value = loc.provinsi; fillKota(loc.adm2); showForecast(adm2); }
});

/* ---------- perf guard: kill the blur if the GPU can't hold 20 FPS ---------- */
(() => {
  let frames = 0, t0 = performance.now(), low = 0;
  const root = document.documentElement;
  const tick = now => {
    frames++;
    if (now - t0 >= 1000){
      low = frames * 1000 / (now - t0) < 20 ? low + 1 : 0;
      if (low >= 2) root.classList.add('reduce-blur');
      frames = 0; t0 = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
})();

loadRegions()
  .then(() => showForecast(el.kota.value))
  .catch(err => setStatus(err.message, true));
