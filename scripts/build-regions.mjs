// Extract wilayah hierarchy from BMKG's public wilayah.sql -> regions.json
// ponytail: representative desa = first adm4 per adm2; upgrade to full adm4 picker later.
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';

const sql = readFileSync('evidence/wilayah.sql', 'utf8');
const rows = [...sql.matchAll(/\('([\d.]+)','((?:[^'\\]|\\.)*)'\)/g)]
  .map(m => [m[1], m[2].replace(/\\'/g, "'").replace(/\\\\/g, '\\')]);

const byCode = new Map(rows);
const provinsi = new Map();
for (const [kode, nama] of rows) {
  if (kode.length === 2) provinsi.set(kode, nama);
}

const kotkab = new Map(); // adm2 -> entry
for (const [kode, nama] of rows) {
  if (kode.split('.').length !== 2) continue;
  kotkab.set(kode, {adm2: kode, nama, provinsi: provinsi.get(kode.slice(0, 2)) ?? '?', kecamatan: null, desa: null, adm4: null});
}

for (const [kode, nama] of rows) {
  const parts = kode.split('.');
  if (parts.length !== 4) continue;
  const e = kotkab.get(parts[0] + '.' + parts[1]);
  if (!e) continue;
  if (!e.adm4 || kode < e.adm4) {
    e.adm4 = kode;
    e.desa = nama;
    e.kecamatan = byCode.get(parts[0] + '.' + parts[1] + '.' + parts[2]) ?? null;
  }
}

const list = [...kotkab.values()].filter(e => e.adm4 && e.provinsi !== '?')
  .sort((a, b) => (a.provinsi + a.nama).localeCompare(b.provinsi + b.nama, 'id'));

const out = {
  source: 'data.bmkg.go.id wilayah.sql',
  note: 'adm4 = desa perwakilan (pertama alfabetis) per kabupaten/kota',
  provinces: [...new Set(list.map(e => e.provinsi))].sort((a, b) => a.localeCompare(b, 'id')),
  locations: list,
};

mkdirSync('public', {recursive: true});
writeFileSync('public/regions.json', JSON.stringify(out));
console.log('rows', rows.length, 'kotkab', list.length, 'provinsi', out.provinces.length);
console.log('missing adm4:', [...kotkab.values()].filter(e => !e.adm4).length);
console.log(list.slice(0, 3));
