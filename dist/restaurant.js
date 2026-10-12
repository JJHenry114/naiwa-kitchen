import {RECIPES,OUTFITS,sanitizeSave} from './engine.js';
import {freshFood,checkFood,scoreFood,tipFor,mean,clamp} from './quality.js';

export const CUSTOMERS=[
 {id:'original',name:'阿蛙',title:'每天都想吃饱',hello:'先来一份熟悉的好味道吧。',pref:['classic','classic-tea'],story:'第一天开门时就来了。它记得每一份认真做的汉堡。'},
 {id:'apron',name:'小围裙',title:'认真研究每一口',hello:'今天也想偷学一点你的手艺。',pref:['garden','milky'],story:'总说回家也要试试，结果第二天又坐在同一张桌前。'},
 {id:'bow',name:'领结先生',title:'喜欢整整齐齐',hello:'好看的料理，会让一天变得特别。',pref:['cheesy','cloud'],story:'领结每天都系得很正，也会把漂亮的餐巾悄悄收藏。'},
 {id:'chef',name:'大厨蛙',title:'休息日不想做饭',hello:'今天轮到我坐下来享受啦。',pref:['tower','cheese-tea'],story:'原来大厨休息时，最想吃的是别人用心做的家常味道。'},
 {id:'shades',name:'酷酷',title:'双倍肉，双倍快乐',hello:'肉多一点。嗯，开心也多一点。',pref:['double','tea-only'],story:'看起来很酷，笑起来却完全藏不住。'},
 {id:'party',name:'派对蛙',title:'每一口都值得庆祝',hello:'让我看看今天有什么惊喜！',pref:['pearl-burger','pearl-tea'],story:'不需要特殊的日子，有朋友、有食物就值得庆祝。'}
];
export const EQUIPMENT=[{id:'grill2',name:'第二煎位',price:120,desc:'同时准备两片肉饼'},{id:'bell',name:'翻面提醒铃',price:60,desc:'跨场景听到翻面与出锅提醒'},{id:'guide',name:'精细定位线',price:80,desc:'显示更精细的对齐刻度'},{id:'measure',name:'精细刻度杯',price:80,desc:'显示实时份量与小刻度'}];
export const DECOR=[{id:'cloth',name:'餐桌布',price:60,choices:['奶油格纹','薄荷时光','蜜桃派对']},{id:'wall',name:'墙面',price:100,choices:['香草奶油','薄荷花园','落日蜜桃']},{id:'sign',name:'灯牌',price:150,choices:['好好吃饭','笑口常开','今天也开心']}];
export const dailyLimit=day=>Math.min(6,day+2);
export const badge=stars=>stars>=15?'金牌熟客':stars>=8?'银牌熟客':stars>=3?'铜牌熟客':'初次相识';
export const customer=id=>CUSTOMERS.find(c=>c.id===id)||CUSTOMERS[0];
export const recipeBy=id=>id==='challenge'?{...RECIPES.find(r=>r.id==='tower'),id:'challenge',name:'八层高塔挑战',rules:[['patty',1,'熟肉饼'],['cheese',1,'芝士'],['layers',8,'馅料']],reward:0}:RECIPES.find(r=>r.id===id);
const copy=x=>structuredClone(x);
const emptyStats=()=>({base:0,tips:0,bonus:0,scores:[],best:null,stars:0,events:[]});
export function freshRestaurant(old){
 const s={...sanitizeSave(old),version:2,day:1,phase:'open',scene:'front',issued:0,completed:0,serial:1,queue:[],orders:[],grills:[null,null],active:null,customers:{},equipment:[],decorOwned:[],decor:{cloth:0,wall:0,sign:0},album:[],badges:[],stats:emptyStats(),lastResult:null};
 fillQueue(s);return s;
}
function guestFor(s,index){
 const unlocked=Math.min(6,s.day),c=CUSTOMERS[(s.day-1+index)%unlocked];
 let id=s.day===1?['classic','garden','cheesy'][index]:c.pref[index%2];
 if(s.day===2&&index===0)id='classic-tea';
 const critic=s.day%5===0&&index===dailyLimit(s.day)-1;
 const ids=[id];if(s.day>=6&&index%3===1){const r=recipeBy(id);ids.push(r.type==='burger'?'classic-tea':'classic');}
 return {id:'guest-'+s.day+'-'+index,customer:c.id,recipes:ids,critic,theme:s.day%7===0};
}
export function fillQueue(s){
 if(s.phase!=='open'||s.orders.filter(o=>!o.challenge&&o.status!=='settled').length>=3)return;
 while(s.queue.length<2&&s.issued+s.queue.length<dailyLimit(s.day))s.queue.push(guestFor(s,s.issued+s.queue.length));
}
export function availableTables(s){return [1,2,3].filter(n=>!s.orders.some(o=>o.table===n&&o.status!=='settled'));}
export const currentOrder=s=>s.orders.find(o=>o.id===s.active);
export function statusText(o,s){
 if(o.status==='packed')return '待送餐';if(o.status==='settled')return '已结算';
 const g=s.grills.filter(g=>g?.order===o.id);
 if(g.some(g=>g.phase==='flip'))return '待翻面';if(g.some(g=>g.phase==='ready'))return '肉饼保温中';if(g.length)return '煎制中';
 return o.items.some(i=>i.food.burger.length||Object.keys(i.food.tea).length)?'制作中':'待制作';
}
function snapshot(s,o){o.history.push({items:copy(o.items),grills:copy(s.grills.map(g=>g?.order===o.id?g:null))});if(o.history.length>25)o.history.shift();}
function resetMix(f){f.turns=0;f.stirTravel=0;f.stirValid=0;f.sealed=false;}
function record(s,o,event){
 const id=event+'-'+o.id;if(s.album.some(a=>a.id===id))return;
 s.album.push({id,event,customer:o.customer,day:s.day,score:o.quality.score,items:copy(o.items.map(({recipe,food,quality})=>({recipe,food,quality}))),theme:o.theme});
}
function settle(s,o){
 if(o.status!=='packed')return {ok:false,message:'这份订单已经送达，或还没有打包。'};
 const score=o.quality.score;
 const oldStars=s.customers[o.customer]||0;
 const newRecipes=o.items.map(i=>i.recipe).filter(id=>id!=='challenge'&&!s.discovered.includes(id));
 let base=o.items.reduce((n,i)=>n+recipeBy(i.recipe).reward,0),tips=tipFor(base,score),discovery=newRecipes.length*25,combo=(s.streak+1)%3===0?15:0,critic=o.critic&&score>=90?10:0;
 if(o.challenge){base=tips=discovery=combo=critic=0;if(score>=85&&!s.badges.includes('tower')){s.badges.push('tower');record(s,o,'高塔建筑师');}}
 else{
  s.served++;s.streak++;s.best=Math.max(s.best,s.streak);s.completed++;
  s.discovered.push(...newRecipes);
  if(score>=80){s.customers[o.customer]=oldStars+1;s.stats.stars++;}
  if(newRecipes.length)record(s,o,'新配方');
  if(badge(oldStars)!==badge(s.customers[o.customer]||0))record(s,o,badge(s.customers[o.customer]));
  if(critic){if(!s.badges.includes('critic'))s.badges.push('critic');record(s,o,'评论员推荐');s.stats.events.push('获得评论员推荐');}
  if(o.theme)record(s,o,'派对营业日');
  s.stats.base+=base;s.stats.tips+=tips;s.stats.bonus+=discovery+combo+critic;s.stats.scores.push(score);
  if(!s.stats.best||score>s.stats.best.score)s.stats.best={id:'best-'+s.day,event:'今日最佳',customer:o.customer,day:s.day,score,items:copy(o.items),theme:o.theme};
 }
 const reward={base,tips,discovery,combo,critic,total:base+tips+discovery+combo+critic};
 s.coins+=reward.total;o.status='settled';o.reward=reward;
 s.lastResult={order:copy({...o,history:[]}),reward,important:!!(newRecipes.length||critic||badge(oldStars)!==badge(s.customers[o.customer]||0)),acknowledged:false};
 if(!o.challenge&&s.completed>=dailyLimit(s.day)){s.phase='closed';s.queue=[];if(s.stats.best&&!s.album.some(a=>a.id===s.stats.best.id))s.album.push(copy(s.stats.best));}
 return {ok:true,result:s.lastResult};
}
export function act(s,type,p={}){
 const fail=message=>({ok:false,message});
 let o=s.orders.find(o=>o.id===(p.order||s.active)),item=o?.items[p.item??o?.selected??0],r=item&&recipeBy(item.recipe),f=item?.food;
 if(type==='scene'){if(!['front','kitchen','dining'].includes(p.scene))return fail('未知场景');s.scene=p.scene;return {ok:true};}
 if(type==='accept'){
  const q=s.queue[0];if(!q||s.phase!=='open')return fail('今天的订单已经接完啦。');
  if(!availableTables(s).includes(p.table))return fail('请安排一张空桌。');
  if(JSON.stringify([...p.recipes].sort())!==JSON.stringify([...q.recipes].sort()))return fail('再听一遍需求，菜单还没有录对。');
  const order={id:'order-'+s.serial++,customer:q.customer,table:p.table,items:q.recipes.map(recipe=>({recipe,food:freshFood()})),selected:0,status:'making',history:[],critic:q.critic,theme:q.theme,challenge:false};
  s.orders.push(order);s.queue.shift();s.issued++;s.active=order.id;fillQueue(s);return {ok:true,order};
 }
 if(type==='select'){if(!o||o.status==='settled')return fail('请选择营业中的订单。');s.active=o.id;if(Number.isInteger(p.item)&&o.items[p.item])o.selected=p.item;return {ok:true};}
 if(type==='challenge'){
  if(s.day<4)return fail('第四天解锁高塔挑战。');
  const existing=s.orders.find(o=>o.challenge&&o.status!=='settled');if(existing){s.active=existing.id;s.scene='kitchen';return {ok:true};}
  const challenge={id:'order-'+s.serial++,customer:'chef',table:0,items:[{recipe:'challenge',food:freshFood()}],selected:0,status:'making',history:[],critic:false,theme:false,challenge:true};
  s.orders.push(challenge);s.active=challenge.id;s.scene='kitchen';return {ok:true};
 }
 if(type==='buy'){
  if(s.phase!=='closed')return fail('收工后再来采购，今天先好好招待客人。');
  const eq=EQUIPMENT.find(x=>x.id===p.id),de=DECOR.find(x=>x.id===p.id),out=OUTFITS.find(x=>x.id===p.id),entry=eq||de||out;
  if(!entry)return fail('没有这个商品。');
  if(eq&&s.day<3)return fail('第三天起开放设备升级。');
  const owned=eq?s.equipment:de?s.decorOwned:s.owned;
  if(!owned.includes(p.id)){if(s.coins<entry.price)return fail('金币还不够，再经营一天吧。');s.coins-=entry.price;owned.push(p.id);}
  if(out)s.equipped=p.id;if(de)s.decor[p.id]=Math.round(clamp(p.choice||0,0,2));return {ok:true};
 }
 if(type==='nextDay'){
  if(s.phase!=='closed'||s.lastResult&&!s.lastResult.acknowledged)return fail('先完成今天的结算。');
  if(s.orders.some(o=>o.challenge&&o.status!=='settled'))return fail('先完成或结束高塔挑战。');
  s.day++;s.phase='open';s.issued=0;s.completed=0;s.orders=[];s.queue=[];s.grills=[null,null];s.active=null;s.stats=emptyStats();s.lastResult=null;s.scene='front';fillQueue(s);return {ok:true};
 }
 if(type==='acknowledge'){if(s.lastResult)s.lastResult.acknowledged=true;s.orders=s.orders.filter(o=>o.status!=='settled');if(!currentOrder(s))s.active=s.orders[0]?.id||null;fillQueue(s);return {ok:true};}
 if(type==='cancelChallenge'){if(!o?.challenge)return fail('普通订单需要认真完成。');s.grills=s.grills.map(g=>g?.order===o.id?null:g);s.orders=s.orders.filter(x=>x.id!==o.id);s.active=s.orders[0]?.id||null;return {ok:true};}
 if(type==='deliver'){if(!o||o.table!==p.table)return fail('这是 '+(o?.table||'挑战')+' 号桌的料理，请核对桌号。');return settle(s,o);}
 if(!o||o.status!=='making'||!f)return fail('请先接单，并选择正在制作的料理。');
 if(type==='snapshot'){snapshot(s,o);return {ok:true};}
 if(type==='undo'){
  const h=o.history.pop();if(!h)return fail('没有可以撤回的步骤。');
  // Never overwrite another order's occupied slot when restoring a transferred patty.
  if(h.grills.some((g,i)=>g&&s.grills[i]&&s.grills[i].order!==o.id)){o.history.push(h);return fail('另一单正在使用煎位，等空出来再撤回。');}
  o.items=h.items;s.grills=s.grills.map((g,i)=>h.grills[i]||(g?.order===o.id?null:g));return {ok:true};
 }
 if(type==='reset'){snapshot(s,o);item.food=freshFood();s.grills=s.grills.map(g=>g?.order===o.id&&g.item===o.selected?null:g);return {ok:true};}
 if(type==='grill'){
  if(r.type!=='burger')return fail('请先选择汉堡订单。');
  const slots=s.equipment.includes('grill2')?2:1;
  const n=p.slot??s.grills.findIndex((g,i)=>i<slots&&!g);
  if(n<0||n>=slots||s.grills[n])return fail('煎位正在使用，先取出保温中的肉饼。');
  snapshot(s,o);s.grills[n]={order:o.id,item:o.selected,phase:'side1',remaining:3200};return {ok:true};
 }
 if(type==='flip'){
  const g=s.grills[p.slot];if(!g||g.order!==o.id||g.phase!=='flip')return fail('等这一面煎好，再向上滑动翻面。');
  snapshot(s,o);g.phase='side2';g.remaining=1800;return {ok:true};
 }
 if(type==='place'){
  if(r.type!=='burger')return fail('这是饮品订单。');
  if(!Number.isFinite(p.x)||Math.abs(p.x)>.45)return fail('放在餐盘范围内，再试一次。');
  if(f.burger.length>=14)return fail('最多叠放 14 层。');
  if(f.burger.at(-1)?.id==='bun-top')return fail('先撤回顶包，才能继续加料。');
  if(!['bun-bottom','bun-top','cheese','lettuce','tomato','pearls','patty'].includes(p.id))return fail('肉饼先下锅煎熟。');
  let g;if(p.id==='patty'){g=s.grills[p.slot];if(!g||g.phase!=='ready'||g.order!==o.id||g.item!==o.selected)return fail('请使用这份订单已经煎熟的肉饼。');}
  snapshot(s,o);f.burger.push({id:p.id,x:p.x});if(g)s.grills[p.slot]=null;return {ok:true};
 }
 if(type==='adjust'){if(!f.burger.length)return fail('先放下一层食材。');f.burger.at(-1).x=clamp(p.x,-.45,.45);return {ok:true};}
 if(type==='pour'){
  if(r.type!=='tea'||f.sealed||!['tea','milk'].includes(p.id))return fail('先打开杯盖再倒入。');
  const total=Object.values(f.tea).reduce((a,b)=>a+b,0);const amount=Math.min(9-total,Math.max(0,p.amount||0));
  if(amount<=0)return fail('杯子已经满啦。');f.tea[p.id]=(f.tea[p.id]||0)+amount;resetMix(f);return {ok:true};
 }
 if(type==='topping'){if(r.type!=='tea'||f.sealed)return fail('先打开杯盖再加料。');if(!['pearls','foam','cheese'].includes(p.id))return fail('请选择配料。');if(Object.values(f.tea).reduce((a,b)=>a+b,0)>=9)return fail('杯子满啦。');snapshot(s,o);f.tea[p.id]=(f.tea[p.id]||0)+1;resetMix(f);return {ok:true};}
 if(type==='stir'){if(r.type!=='tea'||f.sealed||!Object.keys(f.tea).length)return fail('先加入饮品，再搅拌。');f.stirTravel+=Math.max(0,p.travel||0);f.stirValid+=Math.min(Math.max(0,p.valid||0),Math.max(0,p.travel||0));f.turns=Math.min(3,f.turns+Math.max(0,p.turns||0));return {ok:true};}
 if(type==='seal'){if(r.type!=='tea'||f.turns<3-1e-6)return fail('搅拌完成三个圆周后再封杯。');if(!Number.isFinite(p.x)||Math.abs(p.x)>.35)return fail('杯盖需要对准杯口。');snapshot(s,o);f.lidX=p.x;f.sealed=true;return {ok:true};}
 if(type==='pack'){
  if(s.grills.some(g=>g?.order===o.id))return fail('煎锅里还有这份订单的肉饼，请先取出或重做对应料理。');
  for(const i of o.items){const check=checkFood(i.food,recipeBy(i.recipe));if(!check.ok){if(!s.failures.includes(check.id))s.failures.push(check.id);s.streak=0;return check;}}
  for(const i of o.items)i.quality=scoreFood(i.food,recipeBy(i.recipe));
  o.quality={score:Math.round(mean(o.items.map(i=>i.quality.score)))};o.status='packed';o.history=[];return {ok:true,order:o};
 }
 return fail('这一步暂时不能操作。');
}
export function tick(s,ms){
 const changes=[];for(let i=0;i<s.grills.length;i++){const g=s.grills[i];if(g&&['side1','side2'].includes(g.phase)){g.remaining=Math.max(0,g.remaining-Math.max(0,ms));if(g.remaining===0){g.phase=g.phase==='side1'?'flip':'ready';changes.push(i);}}}return changes;
}
export function restoreRestaurant(raw,legacy){
 if(raw?.version!==2)return freshRestaurant(legacy||raw);
 try{
  const s=copy(raw),base=sanitizeSave(raw);Object.assign(s,base,{version:2});
  if(!Number.isSafeInteger(s.day)||s.day<1||s.day>100000)throw Error('day');
  for(const n of ['issued','completed','serial'])if(!Number.isSafeInteger(s[n])||s[n]<0)throw Error(n);
  if(s.completed>s.issued||s.issued>dailyLimit(s.day)||!['open','closed'].includes(s.phase))throw Error('daily state');
  if(!Array.isArray(s.orders)||!Array.isArray(s.queue)||s.queue.length>2||!Array.isArray(s.grills)||s.grills.length!==2)throw Error('orders');
  for(const q of s.queue)if(!q||!CUSTOMERS.some(c=>c.id===q.customer)||!Array.isArray(q.recipes)||q.recipes.length<1||q.recipes.length>2||q.recipes.some(id=>!RECIPES.some(r=>r.id===id)))throw Error('queue');
  if(new Set(s.orders.map(o=>o.id)).size!==s.orders.length)throw Error('duplicate order');
  const tables=[];
  for(const o of s.orders){
   if(!CUSTOMERS.some(c=>c.id===o.customer)||!['making','packed','settled'].includes(o.status)||!Array.isArray(o.items)||o.items.length<1||o.items.length>2)throw Error('order');
   if(!Number.isInteger(o.table)||o.table<0||o.table>3||o.table===0!==!!o.challenge)throw Error('table');
   if(o.status!=='settled'&&o.table){if(tables.includes(o.table))throw Error('duplicate table');tables.push(o.table);}
   o.selected=o.items[o.selected]?o.selected:0;o.history=[];
   for(const i of o.items){if(!recipeBy(i.recipe))throw Error('recipe');const f=i.food;
    if(!Array.isArray(f.burger)||f.burger.length>14||!f.tea||typeof f.tea!=='object')throw Error('food');
    for(const l of f.burger)if(!['bun-bottom','bun-top','patty','cheese','lettuce','tomato','pearls'].includes(l.id)||!Number.isFinite(l.x)||Math.abs(l.x)>.45)throw Error('layer');
    for(const [id,n] of Object.entries(f.tea))if(!['tea','milk','pearls','foam','cheese'].includes(id)||!Number.isFinite(n)||n<0||n>9)throw Error('amount');
    for(const n of ['turns','stirTravel','stirValid','lidX'])if(!Number.isFinite(f[n]))throw Error('quality');
    f.turns=clamp(f.turns,0,3);f.stirTravel=Math.max(0,f.stirTravel);f.stirValid=clamp(f.stirValid,0,f.stirTravel);f.lidX=clamp(f.lidX,-.35,.35);f.sealed=!!f.sealed;
    if(o.status==='packed'){if(!checkFood(f,recipeBy(i.recipe)).ok)throw Error('invalid packed dish');i.quality=scoreFood(f,recipeBy(i.recipe));}
   }if(o.status==='packed')o.quality={score:Math.round(mean(o.items.map(i=>i.quality.score)))};
  }
  for(const g of s.grills)if(g&&(!s.orders.some(o=>o.id===g.order&&o.status==='making'&&o.items[g.item])||!['side1','flip','side2','ready'].includes(g.phase)||!Number.isFinite(g.remaining)||g.remaining<0))throw Error('grill');
  s.equipment=(s.equipment||[]).filter(id=>EQUIPMENT.some(e=>e.id===id));s.decorOwned=(s.decorOwned||[]).filter(id=>DECOR.some(e=>e.id===id));
  s.decor=s.decor||{};for(const d of DECOR)s.decor[d.id]=s.decorOwned.includes(d.id)?Math.round(clamp(Number(s.decor[d.id])||0,0,2)):0;
  s.customers=s.customers||{};for(const c of CUSTOMERS)s.customers[c.id]=Math.max(0,Math.floor(Number(s.customers[c.id])||0));
  if(!Array.isArray(s.album)||!Array.isArray(s.badges)||!s.stats||!Array.isArray(s.stats.scores))throw Error('collections');
  const validCard=a=>a&&typeof a.id==='string'&&typeof a.event==='string'&&Number.isFinite(a.score)&&Number.isInteger(a.day)&&CUSTOMERS.some(c=>c.id===a.customer)&&Array.isArray(a.items)&&a.items.length>0&&a.items.length<=2&&a.items.every(i=>recipeBy(i.recipe)&&i.food&&Array.isArray(i.food.burger)&&i.food.burger.every(l=>['bun-bottom','bun-top','patty','cheese','lettuce','tomato','pearls'].includes(l.id)&&Number.isFinite(l.x))&&i.food.tea&&Object.values(i.food.tea).every(Number.isFinite));
  s.album=s.album.filter(validCard);if(s.stats.best&&!validCard(s.stats.best))s.stats.best=null;
  for(const n of ['base','tips','bonus','stars'])if(!Number.isFinite(s.stats[n])||s.stats[n]<0)throw Error('stats');
  s.stats.scores=s.stats.scores.filter(n=>Number.isFinite(n)&&n>=0&&n<=100);s.stats.events=(s.stats.events||[]).filter(e=>typeof e==='string');
  s.badges=s.badges.filter(b=>['tower','critic'].includes(b));
  if(s.lastResult&&!s.lastResult.acknowledged){
   const last=s.orders.find(o=>o.id===s.lastResult.order?.id&&o.status==='settled');
   if(!last||!last.quality||!last.items.every(i=>i.quality&&Array.isArray(i.quality.parts))||!s.lastResult.reward||!Object.values(s.lastResult.reward).every(Number.isFinite))throw Error('result');
   s.lastResult.order=copy(last);
  }
  s.scene=['front','kitchen','dining'].includes(s.scene)?s.scene:'front';if(!currentOrder(s))s.active=s.orders.find(o=>o.status!=='settled')?.id||null;
  fillQueue(s);return s;
 }catch{return freshRestaurant(raw);}
}
