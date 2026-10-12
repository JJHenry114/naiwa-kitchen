// Reproducible QA fixtures, generated outside the web root. Import through Settings.
import {mkdir,writeFile} from 'node:fs/promises';
import {freshRestaurant,act,recipeBy,dailyLimit} from '../dist/restaurant.js';
import {freshFood} from '../dist/quality.js';
const directory=new URL('../.sites-runtime/qa/',import.meta.url);
await mkdir(directory,{recursive:true});
function food(r){const f=freshFood();if(r.type==='burger'){f.burger=[{id:'bun-bottom',x:0}];for(const [id,n] of r.rules)if(id!=='layers')for(let i=0;i<n;i++)f.burger.push({id,x:0});while(f.burger.length-1<(r.rules.find(([id])=>id==='layers')?.[1]||0))f.burger.push({id:'lettuce',x:0});f.burger.push({id:'bun-top',x:0});}else{for(const [id,n] of r.rules)f.tea[id]=n;f.turns=3;f.stirTravel=f.stirValid=300;f.sealed=true;}return f;}
const s=freshRestaurant();
const save=async name=>writeFile(new URL(name+'.json',directory),JSON.stringify(s,null,2));
for(let day=1;day<=7;day++){
 if(day===2)await save('day-2-open');
 if(day===7){
  for(let n=1;n<=3;n++){const o=act(s,'accept',{table:n,recipes:s.queue[0].recipes}).order;if(n<=2){o.items.forEach(i=>i.food=food(recipeBy(i.recipe)));act(s,'pack',{order:o.id});}}
  s.scene='dining';await save('day-7-three-tables');break;
 }
 while(s.completed<dailyLimit(day)){const o=act(s,'accept',{table:1,recipes:s.queue[0].recipes}).order;o.items.forEach(i=>i.food=food(recipeBy(i.recipe)));act(s,'pack',{order:o.id});act(s,'deliver',{order:o.id,table:o.table});act(s,'acknowledge');}
 if(day===3)await save('day-3-closed');
 act(s,'nextDay');
}
console.log('QA fixtures: .sites-runtime/qa/');
