export const localTime=(instant,timeZone)=>new Intl.DateTimeFormat('id-ID',{timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(instant));
export const localDay=(instant,timeZone)=>new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(instant));
export function condition(s) {
 const d=(s.weather_desc||'').toLowerCase();
 if(/petir/.test(d)) return 'storm';
 if(/hujan/.test(d)) return 'rain';
 if(/kabut|asap|udara kabur/.test(d)) return 'fog';
 if(/cerah berawan/.test(d)) return 'partly';
 if(/berawan/.test(d)) return 'cloud';
 if(/cerah/.test(d)) return 'sun';
 return 'unknown'; // ponytail: unknown codes stay neutral; descriptions are authoritative.
}
const CODE=/^\d{2}(\.\d{2}(\.\d{2}(\.\d{4})?)?)?$/;
export function createClient({fetcher=fetch,now=Date.now,sleep=ms=>new Promise(r=>setTimeout(r,ms)),ttl=1800000,max=32,minInterval=1200}={}) {
 const cache=new Map();let last=null,blockedUntil=0;
 return {async get(raw){
  if(!CODE.test(String(raw))) throw Error('Kode wilayah tidak valid.');
  const k=String(raw),hit=cache.get(k);
  if(hit && now()-hit.at<ttl){cache.delete(k);cache.set(k,hit);return hit.value;}
  if(blockedUntil>now()) throw Error(`Tunggu ${Math.ceil((blockedUntil-now())/1000)} detik sebelum mencoba lagi (batas BMKG 60 permintaan/menit).`);
  if(last!==null && now()-last<minInterval) await sleep(minInterval-(now()-last));
  last=now();
  const res=await fetcher(`https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${k}`);
  if(res.status===429){const s=Number(res.headers?.get?.('retry-after'))||60;blockedUntil=now()+s*1000;throw Error(`BMKG membatasi permintaan (429). Coba lagi dalam ${s} detik.`);}
  if(!res.ok) throw Error(`BMKG menolak permintaan (${res.status}).`);
  const value=await res.json();
  cache.set(k,{at:now(),value});
  while(cache.size>max) cache.delete(cache.keys().next().value);
  return value;
 }};
}
export function parseForecast(raw) {
 const location=raw?.lokasi;
 if(!location?.timezone || !location.adm4) throw Error('Lokasi BMKG tidak valid.');
 new Intl.DateTimeFormat('id-ID',{timeZone:location.timezone});
 const rows=raw.data?.find(d=>d.lokasi?.adm4===location.adm4)?.cuaca;
 const slots=(Array.isArray(rows)?rows.flat(Infinity):[]).filter(s=>s && typeof s==='object').map(s=>{
  const text=s.utc_datetime ? s.utc_datetime.replace(' ','T')+'Z' : s.datetime;
  const time=Date.parse(text);
  if(!Number.isFinite(time)) throw Error('Waktu BMKG tidak valid.');
  return {...s,instant:new Date(time).toISOString()};
 }).sort((a,b)=>a.instant.localeCompare(b.instant));
 if(!slots.length) throw Error('BMKG belum menyediakan prakiraan untuk lokasi ini.');
 return {location,slots:[...new Map(slots.map(s=>[s.instant,s])).values()]};
}
