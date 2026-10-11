import test from 'node:test';
import assert from 'node:assert/strict';
import {RECIPES,OUTFITS,freshDish,evaluate,counts,sanitizeSave,freshSave,rewardFor} from '../dist/engine.js';
function valid(r){
 const d=freshDish(),items=[];
 for(const [id,n] of r.rules)if(id!=='layers')for(let i=0;i<n;i++)items.push(id);
 const layers=r.rules.find(x=>x[0]==='layers')?.[1]||0;
 while(items.length<layers)items.push('lettuce');
 if(r.type==='burger')d.burger=['bun-bottom',...items,'bun-top'];
 else{d.tea=items;d.stirs=3;d.sealed=true;}return d;
}
for(const r of RECIPES)test(r.name+' accepts its complete recipe',()=>assert.equal(evaluate(valid(r),r).ok,true));
test('raw meat is rejected even if recipe otherwise complete',()=>{const r=RECIPES[0],d=valid(r);d.burger.splice(1,0,'raw-patty');assert.equal(evaluate(d,r).id,'raw');});
test('burger requires correctly ordered bread',()=>{const r=RECIPES[0],d=valid(r);d.burger.shift();assert.equal(evaluate(d,r).id,'bread');});
test('missing required ingredients rejected',()=>{const r=RECIPES[0],d=valid(r);d.burger=d.burger.filter(x=>x!=='cheese');assert.equal(evaluate(d,r).id,'missing');});
test('vegetarian order rejects cooked meat',()=>{const r=RECIPES.find(x=>x.id==='garden'),d=valid(r);d.burger.splice(1,0,'patty');assert.equal(evaluate(d,r).id,'forbidden');});
test('plain tea rejects milk',()=>{const r=RECIPES.find(x=>x.id==='tea-only'),d=valid(r);d.tea.push('milk');assert.equal(evaluate(d,r).id,'forbidden');});
test('milk tea must be stirred then sealed',()=>{const r=RECIPES[1],d=valid(r);d.stirs=2;assert.equal(evaluate(d,r).id,'unstirred');d.stirs=3;d.sealed=false;assert.equal(evaluate(d,r).id,'unsealed');});
test('five layers excludes both buns',()=>{const r=RECIPES[2],d=valid(r);assert.equal(counts(d,'burger').layers,5);d.burger.splice(2,1);assert.equal(evaluate(d,r).id,'missing');});
test('first discovery reward is granted only once',()=>{const s=freshSave(),r=RECIPES[0];assert.equal(rewardFor(r,s).total,55);s.discovered.push(r.id);assert.equal(rewardFor(r,s).total,30);s.streak=2;assert.equal(rewardFor(r,s).total,45);});
test('corrupt saves cannot equip unowned outfits or add unknown collections',()=>{const s=sanitizeSave({coins:-4,served:'7',owned:['apron','apron','hacked'],equipped:'chef',discovered:['classic','classic','nope'],failures:['raw','nope']});assert.equal(s.coins,0);assert.equal(s.served,0);assert.equal(s.equipped,'original');assert.deepEqual(s.owned,['original','apron']);assert.deepEqual(s.discovered,['classic']);assert.deepEqual(s.failures,['raw']);});
test('all six wardrobes have unique IDs and valid prices',()=>{assert.equal(new Set(OUTFITS.map(x=>x.id)).size,6);assert.ok(OUTFITS.every(x=>x.price>=0));});

