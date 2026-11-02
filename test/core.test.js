import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as core from '../src/core.js';
test('timezone uses location, not computer; condition trusts description',()=>{
 assert.equal(typeof core.localTime,'function');
 assert.match(core.localTime('2026-10-29T13:00:00Z','Asia/Jakarta'),/20[.:]00/);
 assert.match(core.localTime('2026-10-29T13:00:00Z','Asia/Jayapura'),/22[.:]00/);
 assert.equal(core.condition({weather:1,weather_desc:'Cerah'}),'sun');
 assert.equal(core.condition({weather:61,weather_desc:'Hujan Ringan'}),'rain');
 assert.equal(core.condition({weather:3,weather_desc:'Berawan'}),'cloud');
 assert.equal(core.condition({weather:999,weather_desc:'Tidak dikenal'}),'unknown');
});
test('cache expires, evicts LRU, throttles and backs off without network flood',async()=>{
 assert.equal(typeof core.createClient,'function');
 let clock=0,calls=0;const waits=[];
 const client=core.createClient({now:()=>clock,sleep:async ms=>{waits.push(ms);clock+=ms;},ttl:10000,max:2,fetcher:async()=>{calls++;return {ok:true,json:async()=>({calls})};}});
 await client.get('31.71.03.1001');await client.get('31.71.03.1001');assert.equal(calls,1);
 await client.get('91.71.01.1001');assert.deepEqual(waits,[1200]);
 await client.get('51.71.01.1001');await client.get('31.71.03.1001');assert.equal(calls,4);
 clock+=10001;await client.get('31.71.03.1001');assert.equal(calls,5);
 let failures=0;const limited=core.createClient({now:()=>clock,sleep:async ms=>{clock+=ms},fetcher:async()=>{failures++;return {ok:false,status:429,headers:{get:()=> '60'}};}});
 await assert.rejects(limited.get('31.71.03.1001'),/429/);
 await assert.rejects(limited.get('31.71.03.1001'),/Tunggu/);assert.equal(failures,1);
 await assert.rejects(client.get('bad'),/Kode/);
});
const fixture=JSON.parse(readFileSync(new URL('../evidence/browser-adm4.json',import.meta.url)));
test('parser retains real nested slots, sorts UTC, preserves null',()=>{
 assert.equal(typeof core.parseForecast,'function');
 const p=core.parseForecast(fixture);
 assert.equal(p.slots.length,fixture.data[0].cuaca.flat().length);
 assert.equal(p.location.timezone,'Asia/Jakarta');
 assert.equal(p.slots[0].vs_text,null);
 assert.equal(p.slots[0].instant,'2026-10-29T13:00:00.000Z');
 assert.throws(()=>core.parseForecast({data:[]}));
});
