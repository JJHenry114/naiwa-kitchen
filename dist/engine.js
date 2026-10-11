export const RECIPES = [
 {id:'classic',name:'招牌芝士堡',type:'burger',icon:0,tag:'开店第一口',line:'热乎的肉饼，配上芝士就很幸福。',rules:[['patty',1,'熟肉饼'],['cheese',1,'芝士']],reward:30},
 {id:'classic-tea',name:'招牌珍珠奶茶',type:'tea',icon:6,tag:'快乐咕嘟咕嘟',line:'茶、奶和珍珠，搅一搅再封杯！',rules:[['tea',1,'红茶'],['milk',1,'牛奶'],['pearls',1,'珍珠']],reward:30},
 {id:'tower',name:'高高堡',type:'burger',icon:1,tag:'叠高高挑战',line:'馅料至少五层，别忘了肉饼和芝士。',rules:[['patty',1,'熟肉饼'],['cheese',1,'芝士'],['layers',5,'馅料']],reward:40},
 {id:'milky',name:'奶香加倍',type:'tea',icon:7,tag:'今天偏爱奶',line:'一份红茶，两份牛奶，奶味要浓一点。',rules:[['tea',1,'红茶'],['milk',2,'牛奶']],reward:35},
 {id:'garden',name:'草坪汉堡',type:'burger',icon:2,tag:'一口小花园',line:'两层生菜加番茄，今天不要肉饼。',rules:[['lettuce',2,'生菜'],['tomato',1,'番茄']],forbid:['patty','raw-patty'],reward:35},
 {id:'pearl-tea',name:'珍珠开大会',type:'tea',icon:8,tag:'嚼嚼嚼',line:'奶茶没问题，珍珠记得放两份！',rules:[['tea',1,'红茶'],['milk',1,'牛奶'],['pearls',2,'珍珠']],reward:40},
 {id:'cheesy',name:'芝士瀑布堡',type:'burger',icon:3,tag:'芝士就是力量',line:'一片肉饼，三层芝士。多一点快乐！',rules:[['patty',1,'熟肉饼'],['cheese',3,'芝士']],reward:40},
 {id:'cloud',name:'云朵奶茶',type:'tea',icon:9,tag:'把云朵装进杯子',line:'红茶与牛奶，上面盖一朵奶盖。',rules:[['tea',1,'红茶'],['milk',1,'牛奶'],['foam',1,'奶盖']],reward:40},
 {id:'double',name:'双层肉肉堡',type:'burger',icon:4,tag:'肉食奶蛙',line:'两片煎好的肉饼，再来一片芝士。',rules:[['patty',2,'熟肉饼'],['cheese',1,'芝士']],reward:45},
 {id:'tea-only',name:'清醒红茶',type:'tea',icon:10,tag:'今天清爽一点',line:'两份红茶就好，不加牛奶和奶盖。',rules:[['tea',2,'红茶']],forbid:['milk','foam'],reward:35},
 {id:'pearl-burger',name:'珍珠乱入堡',type:'burger',icon:5,tag:'怪，但好吃',line:'肉饼加珍珠！奶蛙的口味你别猜。',rules:[['patty',1,'熟肉饼'],['pearls',1,'珍珠']],reward:50},
 {id:'cheese-tea',name:'芝士怪味茶',type:'tea',icon:11,tag:'隐藏菜单的味道',line:'给奶茶放一片芝士，搅匀了试试看。',rules:[['tea',1,'红茶'],['milk',1,'牛奶'],['cheese',1,'芝士']],reward:50}
];
export const OUTFITS=[
 {id:'original',name:'原味奶蛙',price:0,desc:'熟悉的呆呆模样'},
 {id:'apron',name:'认真小店长',price:80,desc:'薄荷围裙，开工啦'},
 {id:'bow',name:'今日有约',price:120,desc:'系好领结再吃饭'},
 {id:'chef',name:'主厨驾到',price:180,desc:'这厨房我很熟'},
 {id:'shades',name:'墨镜食客',price:220,desc:'酷酷地再来一杯'},
 {id:'party',name:'派对时间',price:280,desc:'每一口都值得庆祝'}
];
export const FAILURES=[
 {id:'raw',name:'半生不熟堡',tip:'肉饼先煎一面，再翻面煎熟。'},
 {id:'bread',name:'散架汉堡',tip:'底包在最下，顶包在最上。'},
 {id:'missing',name:'随缘料理',tip:'照着订单，把缺少的食材补齐。'},
 {id:'forbidden',name:'放错料啦',tip:'注意订单里“不要”的食材。'},
 {id:'unstirred',name:'分层奶茶',tip:'轻点搅拌三次，或在杯子上画圈。'},
 {id:'unsealed',name:'漏风奶茶',tip:'搅拌后记得封杯，再交给奶蛙。'}
];
export const LABELS={'bun-bottom':'底包','bun-top':'顶包','raw-patty':'生肉饼',patty:'熟肉饼',cheese:'芝士',lettuce:'生菜',tomato:'番茄',pearls:'珍珠',tea:'红茶',milk:'牛奶',foam:'奶盖'};
export function freshDish(){return {burger:[],tea:[],stirs:0,sealed:false};}
export function counts(dish,type){
 const arr=type==='burger'?dish.burger:dish.tea;
 const c={};for(const i of arr)c[i]=(c[i]||0)+1;
 c.layers=arr.filter(x=>!x.startsWith('bun-')).length;return c;
}
export function evaluate(dish,recipe){
 const c=counts(dish,recipe.type);
 if(recipe.type==='burger'){
  if(c['raw-patty'])return {ok:false,id:'raw',message:'肉饼还没熟，先去煎锅里翻个面吧。'};
  if(dish.burger[0]!=='bun-bottom'||dish.burger.at(-1)!=='bun-top')return {ok:false,id:'bread',message:'汉堡需要底包打底、顶包收尾。可以撤回最上面一层。'};
 }else{
  if(dish.stirs<3)return {ok:false,id:'unstirred',message:'再搅一搅，让味道混在一起。'};
  if(!dish.sealed)return {ok:false,id:'unsealed',message:'还差最后一步：给杯子封口。'};
 }
 const forbidden=(recipe.forbid||[]).find(x=>c[x]);
 if(forbidden)return {ok:false,id:'forbidden',message:'这位奶蛙今天不要'+LABELS[forbidden]+'，撤回或重做试试。'};
 const missing=recipe.rules.filter(([id,n])=>(c[id]||0)<n);
 if(missing.length)return {ok:false,id:'missing',message:'还缺：'+missing.map(([id,n,name])=>name+' × '+(n-(c[id]||0))).join('、')+'。'};
 return {ok:true};
}
export function freshSave(){return {version:1,coins:0,served:0,streak:0,best:0,discovered:[],failures:[],owned:['original'],equipped:'original',sound:true,reduced:false,orderIndex:0};}
export function sanitizeSave(raw){
 const s=freshSave();if(!raw||typeof raw!=='object')return s;
 for(const k of ['coins','served','streak','best','orderIndex'])if(Number.isSafeInteger(raw[k])&&raw[k]>=0)s[k]=Math.min(raw[k],1000000);
 s.discovered=[...new Set((Array.isArray(raw.discovered)?raw.discovered:[]).filter(id=>RECIPES.some(r=>r.id===id)))];
 s.failures=[...new Set((Array.isArray(raw.failures)?raw.failures:[]).filter(id=>FAILURES.some(r=>r.id===id)))];
 s.owned=[...new Set(['original',...(Array.isArray(raw.owned)?raw.owned:[]).filter(id=>OUTFITS.some(o=>o.id===id))])];
 s.equipped=s.owned.includes(raw.equipped)?raw.equipped:'original';
 for(const k of ['sound','reduced'])if(typeof raw[k]==='boolean')s[k]=raw[k];return s;
}
export function rewardFor(recipe,save){
 const isNew=!save.discovered.includes(recipe.id),streak=save.streak+1;
 return {isNew,base:recipe.reward,bonus:isNew?25:0,combo:streak%3===0?15:0,total:recipe.reward+(isNew?25:0)+(streak%3===0?15:0)};
}

