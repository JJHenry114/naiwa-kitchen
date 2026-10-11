import {RECIPES,OUTFITS,FAILURES,LABELS,freshDish,counts,evaluate,freshSave,sanitizeSave,rewardFor} from './engine.js';
import {CharacterRenderer,Sound} from './animation.js';
const $=id=>document.getElementById(id),KEY='naiwa-kitchen-v1';
let save;try{save=sanitizeSave(JSON.parse(localStorage.getItem(KEY)));}catch{save=freshSave();}
let dish=freshDish(),station=RECIPES[save.orderIndex%12].type,history=[],grill={phase:'empty',started:0},started=false,locked=false,toastTimer,celebration=null,resultPending=false,raf=0,hiddenAt=0;
const character=new CharacterRenderer($('character-canvas'),$('character-fallback')),sound=new Sound();
const systemReduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const recipe=()=>RECIPES[save.orderIndex%RECIPES.length];
const clone=x=>structuredClone(x);
const asset=x=>'assets/'+x+'.webp';
const image=(name,alt='',cls='')=>'<img src="'+asset(name)+'" alt="'+alt+'" class="'+cls+'" draggable="false">';
function persist(){try{localStorage.setItem(KEY,JSON.stringify(save));$('saved-status').textContent='已自动保存';}catch{$('saved-status').textContent='本次游玩';}}
function prefs(){sound.enabled=save.sound;character.reduced=save.reduced||systemReduced;$('game').classList.toggle('reduced',character.reduced);}
function toast(text){clearTimeout(toastTimer);$('toast').textContent=text;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000);}
function talk(text){$('character-bubble').textContent=text;}
function snap(){history.push({dish:clone(dish),grill:{...grill,remaining:Math.max(0,(grill.phase==='side1'?3200:1800)-(performance.now()-grill.started))}});if(history.length>30)history.shift();}
function orderView(){
 const r=recipe(),c=counts(dish,r.type);
 $('order-number').textContent='ORDER '+String(save.served+1).padStart(2,'0');
 $('order-name').textContent=r.name;$('order-line').textContent=r.line;$('order-reward').textContent='+'+r.reward+' ✦';
 $('order-rules').innerHTML=r.rules.map(([id,n,label])=>'<span class="rule '+((c[id]||0)>=n?'done':'')+'">'+((c[id]||0)>=n?'✓ ':'')+label+' '+Math.min(c[id]||0,n)+'/'+n+'</span>').join('')+(r.forbid?.length?'<span class="rule forbid">不要'+r.forbid.filter(x=>x!=='raw-patty').map(x=>LABELS[x]).join(' / ')+'</span>':'');
}
function renderIngredients(){
 const list=station==='burger'?['bun-bottom','raw-patty','cheese','bun-top','lettuce','tomato','pearls']:['tea','milk','pearls','foam','cheese'];
 $('ingredient-shelf').innerHTML=list.map(id=>'<button class="ingredient" data-ingredient="'+id+'" aria-label="添加'+LABELS[id]+'"><b class="plus">+</b>'+image(id)+'<span>'+LABELS[id]+'</span></button>').join('');
 $('ingredient-tip').textContent=station==='burger'?'轻点添加 · 生肉饼先放煎锅':'轻点倒入 · 在杯子上画圈也能搅拌';
}
function setStation(type){
 if(locked)return;station=type;
 $('burger-tab').classList.toggle('selected',type==='burger');$('tea-tab').classList.toggle('selected',type==='tea');
 $('burger-tab').setAttribute('aria-pressed',type==='burger');$('tea-tab').setAttribute('aria-pressed',type==='tea');
 $('burger-work').hidden=type!=='burger';$('tea-work').hidden=type!=='tea';renderIngredients();render();
}
function renderBurger(){
 const stack=$('burger-stack'),old=[...stack.children];
 // Preserve unchanged layer nodes so adding one ingredient does not replay every animation.
 let i=0;for(;i<Math.min(old.length,dish.burger.length);i++)if(old[i].dataset.item!==dish.burger[i])break;
 while(stack.children.length>i)stack.lastElementChild.remove();
 const spacing=Math.min(17,100/Math.max(1,dish.burger.length-1));
 for(let j=i;j<dish.burger.length;j++){const im=new Image();im.src=asset(dish.burger[j]);im.alt=LABELS[dish.burger[j]];im.className='burger-layer '+dish.burger[j];im.dataset.item=dish.burger[j];stack.append(im);}
 [...stack.children].forEach((im,j)=>{im.style.bottom=(j*spacing)+'px';im.style.zIndex=j+1;});
 $('burger-hint').hidden=dish.burger.length>0;$('burger-counter').textContent=dish.burger.length+' 层';
}
function renderTea(){
 const c=counts(dish,'tea'),total=(c.tea||0)+(c.milk||0),mix=c.tea&&c.milk;
 const color=mix?'#c69765':c.milk?'#f4e4c7':'#af6524';
 $('liquid').style.height=Math.min(86,total*34)+'%';
 $('liquid').style.background=total?(mix&&dish.stirs<3?'linear-gradient(to bottom,#f0dec0 0%,#f0dec0 45%,#a6652e 49%,#a6652e 100%)':color):'transparent';
 $('cup-pearls').hidden=!c.pearls;$('cup-pearls').style.height=Math.min(65,25+(c.pearls||0)*11)+'px';
 $('cup-foam').hidden=!c.foam;$('cup-foam').style.top=(100-Math.min(86,total*34))+'%';
 $('cup-lid').hidden=!dish.sealed;$('tea-counter').textContent=dish.tea.length+' 份'+(dish.sealed?' · 已封杯':'');
 $('stir-dots').innerHTML=[0,1,2].map(i=>'<i class="'+(i<dish.stirs?'done':'')+'"></i>').join('');
 $('stir-btn').disabled=!dish.tea.length||dish.sealed||dish.stirs>=3||locked;
 $('seal-btn').disabled=dish.stirs<3||dish.sealed||locked;
 $('tea-status').textContent=dish.sealed?'封杯完成，准备交付':dish.stirs>=3?'味道混合好啦，封杯吧':dish.tea.length?'搅拌 '+dish.stirs+'/3 次':'先加红茶和牛奶';
}
function renderGrill(){
 const phase=grill.phase,busy=['side1','side2'].includes(phase);
 $('grill').classList.toggle('ready',phase==='flip'||phase==='ready');
 $('grill-patty').hidden=phase==='empty';$('grill-patty').src=asset(['side2','ready'].includes(phase)?'patty':'raw-patty');
 $('grill-status').textContent=({empty:'放入一片生肉饼',side1:'滋滋滋…正在煎',flip:'点一下，翻面！',side2:'再煎一小会儿',ready:'熟啦！点一下入盘'})[phase];
 $('sizzle').innerHTML=busy?'<i></i><i></i><i></i>':'';
 $('cook-progress').style.transform='scaleX('+(['flip','ready'].includes(phase)?1:0)+')';
}
function render(){
 renderBurger();renderTea();orderView();$('coins').textContent=save.coins;$('recipe-count').textContent=save.discovered.length+'/12';
 $('undo-btn').disabled=!history.length||locked;$('reset-btn').disabled=(!dish[station].length&&(station!=='burger'||grill.phase==='empty'))||locked;
 $('serve-btn').disabled=!dish[station].length||locked;
 $('game').dataset.phase=celebration?'laughing':locked?'result':started?'playing':'intro';
}
function canAdd(id){
 if(locked||!started)return false;
 if(station==='burger'){
  if(dish.burger.length>=14){toast('汉堡已经够高啦，先交给奶蛙尝尝。');return false;}
  if(dish.burger.at(-1)==='bun-top'){toast('顶包已经盖好，先撤回顶包才能继续加料。');return false;}
 }else{
  if(dish.sealed){toast('杯子已经封好，撤回封杯后再加料。');return false;}
  if(dish.tea.length>=9){toast('杯子满啦，搅匀封杯就能交付。');return false;}
 }return true;
}
function add(id,target='auto'){
 if(locked||!started)return;
 sound.unlock();
 if(id==='raw-patty'&&target!=='tray'){
  if(grill.phase!=='empty'){toast(grill.phase==='ready'?'锅里的肉饼煎好了，先点一下放进汉堡。':'锅里还有肉饼，等这一片煎好吧。');return;}
  snap();grill={phase:'side1',started:performance.now()};renderGrill();render();sound.tone();talk('这个香味，我熟。');return;
 }
 if(!canAdd(id))return;
 snap();dish[station].push(id);
 if(station==='tea'){
  dish.stirs=0;dish.sealed=false;
  if(id==='tea'||id==='milk'){
   $('pour-stream').style.background=id==='milk'?'#efdfbf':'#aa6027';
   $('cup-body').classList.remove('pouring');void $('cup-body').offsetWidth;$('cup-body').classList.add('pouring');
  }
 }
 sound.tone();render();
 if(id==='raw-patty')toast('生肉饼也能放进餐盘，不过奶蛙更喜欢煎熟的。');
 if(dish.burger.length===1&&id==='bun-bottom')talk('底包稳稳的，按订单加料吧。');
}
function grillClick(){
 if(locked||!started)return;
 if(grill.phase==='empty'){toast('轻点“生肉饼”，或把它拖进煎锅。');return;}
 if(grill.phase==='side1'||grill.phase==='side2'){toast('小火慢煎，马上就好。');return;}
 if(grill.phase==='flip'){snap();grill={phase:'side2',started:performance.now()};$('grill-patty').animate([{transform:'rotateX(0)'},{transform:'translateY(-20px) rotateX(180deg)'},{transform:'rotateX(360deg)'}],{duration:420,easing:'ease-in-out'});renderGrill();sound.tone();render();return;}
 if(grill.phase==='ready'){
  if(station!=='burger')setStation('burger');
  if(!canAdd('patty'))return;
  snap();dish.burger.push('patty');grill={phase:'empty',started:0};renderGrill();render();sound.tone('ready');talk('煎得刚刚好。');
 }
}
function stir(){
 if(locked||!dish.tea.length||dish.sealed||dish.stirs>=3)return;
 snap();dish.stirs++;sound.tone();$('cup-body').classList.remove('stirring');void $('cup-body').offsetWidth;$('cup-body').classList.add('stirring');render();
 if(dish.stirs===3)talk('咕嘟咕嘟，最后封个杯。');
}
function seal(){if(locked||dish.stirs<3||dish.sealed)return;snap();dish.sealed=true;sound.tone('ready');render();}
function undo(){if(locked||!history.length)return;const h=history.pop();dish=h.dish;grill=h.grill;if(['side1','side2'].includes(grill.phase))grill.started=performance.now()-(grill.phase==='side1'?3200:1800)+grill.remaining;renderGrill();render();sound.tone();}
function resetDish(){if(locked)return;snap();dish[station]=[];if(station==='tea'){dish.stirs=0;dish.sealed=false;}else grill={phase:'empty',started:0};renderGrill();render();toast('台面收拾好啦，再来一份。');}
function openModal(title,eyebrow,content){$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-content').innerHTML=content;if(!$('modal').open)$('modal').showModal();}
function closeModal(){$('modal').close();}
function confetti(){if(character.reduced)return;const colors=['#adc17a','#ddb365','#cd8e6c','#f2d894'];$('particles').innerHTML=Array.from({length:24},(_,i)=>'<i class="particle" style="left:'+(10+Math.random()*80)+'%;background:'+colors[i%4]+';--dx:'+((Math.random()-.5)*150)+'px;--rot:'+(Math.random()*720)+'deg;animation-delay:'+(Math.random()*.3)+'s"></i>').join('');setTimeout(()=>$('particles').replaceChildren(),2200);}
async function serve(){
 if(locked||!dish[station].length)return;
 if(station!==recipe().type){toast('这位奶蛙想要'+(recipe().type==='burger'?'汉堡':'奶茶')+'，切回对应制作台吧。');return;}
 const r=recipe(),check=evaluate(dish,r);
 if(!check.ok){
  sound.tone('error');save.streak=0;if(!save.failures.includes(check.id))save.failures.push(check.id);persist();
  talk('嗯？好像还差一点点。');
  const i=FAILURES.findIndex(f=>f.id===check.id),f=FAILURES[i];
  openModal('再调整一下就好','奶蛙的温柔提醒','<div class="result-view">'+image('fail-'+i,f.name)+'<h3>'+f.name+'</h3><p>'+check.message+'</p><span class="new-badge">失败料理也收进手账啦</span><button class="serve" data-action="close">继续调整 →</button></div>');return;
 }
 locked=true;
 const reward=rewardFor(r,save);save.coins+=reward.total;save.served++;save.streak++;save.best=Math.max(save.best,save.streak);if(reward.isNew)save.discovered.push(r.id);persist();
 const duration=character.reduced?3:reward.isNew?9.3:3.8;
 celebration={at:performance.now(),duration:duration*1000,recipe:r,reward};character.laugh(true);
 $('game').classList.add('celebrating');$('laugh-caption').hidden=false;$('character-canvas').setAttribute('aria-label','奶蛙正在捧腹大笑');
 $('laugh-caption').querySelector('small').textContent=reward.isNew?'新配方解锁！奶蛙笑得更开心了。':'这口味，正合我意。';
 sound.laugh(duration);confetti();render();
}
function finishLaugh(){
 if(!celebration)return;
 const c=celebration;celebration=null;sound.stop();character.laugh(false);
 $('game').classList.remove('celebrating');$('laugh-caption').hidden=true;$('character-canvas').setAttribute('aria-label','奶蛙吃得很满意');talk('哈哈哈，下次还来！');
 const {reward:r,recipe:food}=c;resultPending=true;
 openModal('奶蛙很满意','今日份快乐已送达','<div class="result-view">'+image('dish-'+food.icon,food.name)+'<h3>'+food.name+'</h3>'+(r.isNew?'<span class="new-badge">✦ 新配方已收录</span>':'')+'<div class="earnings">+'+r.total+' ✦</div><p>餐费 '+r.base+(r.bonus?' · 新配方奖励 '+r.bonus:'')+(r.combo?' · 连续三单奖励 '+r.combo:'')+'<br>已招待 '+save.served+' 位奶蛙 · 连续满意 '+save.streak+' 单</p><button class="serve" data-action="next">迎接下一位奶蛙 →</button></div>');
 render();
}
function nextOrder(index){
 locked=false;resultPending=false;$('character-canvas').setAttribute('aria-label','奶蛙正在等待料理');save.orderIndex=index??save.orderIndex+1;dish=freshDish();history=[];grill={phase:'empty',started:0};setStation(recipe().type);renderGrill();talk(['肚子准备好啦。','今天吃点什么好呢？','听说你这里很好吃。','慢慢做，我等得住。'][save.served%4]);persist();$('order-card').animate([{opacity:0,transform:'translateX(30px) rotate(3deg)'},{opacity:1,transform:'translateX(0) rotate(1.5deg)'}],{duration:450,easing:'ease-out'});
}
function showBook(fails=false){
 if(locked)return;
 const list=fails?FAILURES:RECIPES,owned=fails?save.failures:save.discovered;
 openModal('奶蛙的配方手账','每一口，都值得记下来','<div class="collection-tabs"><button data-action="book" class="'+(!fails?'active':'')+'">招牌配方 '+save.discovered.length+'/12</button><button data-action="failures" class="'+(fails?'active':'')+'">翻车收藏 '+save.failures.length+'/6</button></div><p class="modal-summary">'+(fails?'偶尔翻车也没关系，奶蛙会陪你再试一次。':'点开配方看做法，也可以选择想做的那一道。')+'</p><div class="collection-grid">'+list.map((r,i)=>'<button class="recipe-tile '+(owned.includes(r.id)?'unlocked':'locked')+'" data-action="'+(fails?'failure':'recipe')+'" data-id="'+r.id+'">'+image((fails?'fail-':'dish-')+(fails?i:r.icon))+'<span>'+r.name+'</span><small>'+(owned.includes(r.id)?'已收录':'等待发现')+'</small></button>').join('')+'</div>');
}
function showRecipe(id){
 const r=RECIPES.find(x=>x.id===id);if(!r)return;
 const bread=r.type==='burger'?'<li>底包打底，顶包收尾</li>':'<li>搅拌三次，最后封杯</li>';
 openModal(r.name,r.tag,'<div class="recipe-detail">'+image('dish-'+r.icon)+'<p>'+r.line+'</p><ul>'+bread+r.rules.map(([id,n,label])=>'<li>'+label+'至少 '+n+(id==='layers'?' 层':' 份')+'</li>').join('')+(r.forbid?'<li>不要'+r.forbid.filter(x=>x!=='raw-patty').map(x=>LABELS[x]).join('、')+'</li>':'')+'</ul><button class="serve" data-action="choose-recipe" data-id="'+r.id+'">就做这一道 →</button></div>');
}
function showWardrobe(){
 if(locked)return;
 openModal('奶蛙的衣橱','吃饱了，也要穿得开心','<p class="modal-summary">现有 <b>'+save.coins+' ✦</b> · 完成订单赚金币，装扮解锁后永久保留。</p><div class="closet-grid">'+OUTFITS.map(o=>{
  const owned=save.owned.includes(o.id),equipped=save.equipped===o.id;
  return '<article class="outfit '+(equipped?'equipped':'')+'">'+image('outfit-'+o.id,o.name)+'<h3>'+o.name+'</h3><p>'+o.desc+'</p><button data-action="outfit" data-id="'+o.id+'" class="'+(owned?'':'buy')+'" '+(equipped||!owned&&save.coins<o.price?'disabled':'')+'>'+(equipped?'✓ 正在穿':owned?'换上这套':o.price+' ✦ 解锁')+'</button></article>';
 }).join('')+'</div>');
}
function settings(){
 if(locked)return;
 openModal('厨房小设置','按你喜欢的方式玩','<div class="setting-row"><div><strong>声音</strong><p>奶蛙原声大笑与操作音效</p></div><button class="toggle '+(save.sound?'on':'')+'" data-action="sound" role="switch" aria-checked="'+save.sound+'" aria-label="声音"></button></div><div class="setting-row"><div><strong>轻柔动画</strong><p>减少摇晃和彩纸，保留操作反馈</p></div><button class="toggle '+(save.reduced?'on':'')+'" data-action="reduced" role="switch" aria-checked="'+save.reduced+'" aria-label="轻柔动画"></button></div><div class="help-text"><p><b>汉堡：</b>轻点或拖拽食材。生肉饼先下锅，提示后点煎锅翻面，再点一下取出。底包打底，顶包收尾。</p><p><b>奶茶：</b>轻点食材加入杯中，搅拌三次并封杯。也可以在杯子上画圈搅拌。</p><p>没有倒计时，食物不会烧焦。撤回和重做不花金币。换客人或从手账选择配方会清空当前台面。</p><p>已招待 '+save.served+' 位 · 最佳连续满意 '+save.best+' 单<br>进度保存在当前浏览器中。</p></div><button class="mini-button" data-action="reset-save">重新开店</button>');
}
$('modal').addEventListener('click',e=>{
 const b=e.target.closest('[data-action]');if(!b)return;
 const a=b.dataset.action,id=b.dataset.id;sound.tone();
 if(a==='close'||a==='next')closeModal();
 if(a==='book')showBook();if(a==='failures')showBook(true);if(a==='recipe')showRecipe(id);
 if(a==='failure'){const f=FAILURES.find(x=>x.id===id);toast(f.tip);}
 if(a==='choose-recipe'){
  const index=RECIPES.findIndex(x=>x.id===id);
  if(dish.burger.length||dish.tea.length||grill.phase!=='empty'){openModal('换一道配方？','台面会重新准备','<p class="modal-summary">当前料理会清空，已获得的金币和收集进度都会保留。</p><button class="serve" data-action="confirm-recipe" data-id="'+index+'">清空台面，做这道 →</button>');}
  else{closeModal();nextOrder(index);}
 }
 if(a==='confirm-recipe'){closeModal();nextOrder(Number(id));}
 if(a==='outfit'){
  const o=OUTFITS.find(x=>x.id===id);if(!o)return;
  if(!save.owned.includes(id)){if(save.coins<o.price)return;save.coins-=o.price;save.owned.push(id);}
  save.equipped=id;character.setSkin(id).catch(()=>toast('装扮加载失败，请刷新再试。'));persist();render();showWardrobe();sound.tone('coin');
 }
 if(a==='sound'){save.sound=!save.sound;prefs();persist();settings();if(save.sound)sound.unlock();}
 if(a==='reduced'){save.reduced=!save.reduced;prefs();persist();settings();}
 if(a==='skip'){closeModal();nextOrder();}
 if(a==='reset-save')openModal('重新开店？','这会清空当前浏览器中的游戏进度','<p class="modal-summary">金币、配方收藏和已解锁装扮将重新开始。此操作无法撤回。</p><button class="serve" data-action="confirm-reset-save">确定重新开店</button>');
 if(a==='confirm-reset-save'){save=freshSave();prefs();character.setSkin('original');closeModal();nextOrder(0);toast('新的一天，开门营业！');}
});
$('modal').addEventListener('close',()=>{if(resultPending)nextOrder();});
document.querySelector('.close-modal').onclick=closeModal;
$('settings-btn').onclick=settings;$('wallet-btn').onclick=showWardrobe;$('wardrobe-btn').onclick=showWardrobe;$('book-btn').onclick=()=>showBook();
$('skip-order').onclick=()=>{if(locked)return;if(!dish.burger.length&&!dish.tea.length&&grill.phase==='empty'){nextOrder();return;}openModal('换一位奶蛙？','慢慢来，总有喜欢的口味','<p class="modal-summary">当前台面会清空，金币与收藏不受影响。</p><button class="serve" data-action="skip">换一位客人 →</button>');};
document.querySelectorAll('[data-station]').forEach(b=>b.onclick=()=>setStation(b.dataset.station));
$('grill').onclick=grillClick;$('stir-btn').onclick=stir;$('seal-btn').onclick=seal;$('undo-btn').onclick=undo;$('reset-btn').onclick=resetDish;$('serve-btn').onclick=serve;$('finish-laugh').onclick=finishLaugh;
$('start-btn').onclick=()=>{
 if(started)return;started=true;sound.unlock().then(()=>{$('game').dataset.audioReady=String(!!sound.buffer);$('game').dataset.audioDuration=String(sound.buffer?.duration||0);if(save.sound&&!sound.buffer)toast('笑声还没加载好，打开设置可重新开启声音。');});$('intro').classList.add('leaving');
 setTimeout(()=>$('intro').hidden=true,450);
 talk(save.served?'欢迎回来，店长。':'先来一份招牌吧。');render();toast('轻点食材就能添加，生肉饼要先煎熟。');
};
let drag=null,suppressClick=false;
$('ingredient-shelf').addEventListener('pointerdown',e=>{
 const b=e.target.closest('[data-ingredient]');if(!b||locked||!started||e.button!==0)return;
 drag={id:b.dataset.ingredient,x:e.clientX,y:e.clientY,px:e.clientX,py:e.clientY,pointer:e.pointerId,button:b,ghost:null,dragging:false};
});
window.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;drag.px=e.clientX;drag.py=e.clientY;
 const distance=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);
 if(!drag.dragging&&distance>9){
  // Horizontal motion stays a native shelf scroll. Vertical motion picks up the ingredient.
  if(e.pointerType==='touch'&&Math.abs(e.clientX-drag.x)>Math.abs(e.clientY-drag.y)*1.4){drag=null;return;}
  drag.dragging=true;drag.button.setPointerCapture(e.pointerId);const im=new Image();im.src=asset(drag.id);im.className='drag-ghost';document.body.append(im);drag.ghost=im;
 }
 if(drag.dragging)e.preventDefault();
},{passive:false});
function cleanDrag(){if(drag?.ghost)drag.ghost.remove();document.querySelectorAll('.drag-over').forEach(x=>x.classList.remove('drag-over'));drag=null;}
window.addEventListener('pointercancel',()=>cleanDrag());
window.addEventListener('pointerup',e=>{
 if(!drag||e.pointerId!==drag.pointer)return;
 const d=drag;if(d.dragging){
  suppressClick=true;setTimeout(()=>suppressClick=false,200);
  const target=document.elementFromPoint(e.clientX,e.clientY);
  if(target?.closest('#grill')){if(d.id==='raw-patty')add(d.id);else toast('煎锅只需要生肉饼。');}
  else if(target?.closest('#burger-drop')&&station==='burger')add(d.id,'tray');
  else if(target?.closest('#tea-drop')&&station==='tea')add(d.id);
  else toast('拖进餐盘或杯子里就能放下。');
 }cleanDrag();
});
$('ingredient-shelf').addEventListener('click',e=>{if(suppressClick)return;const b=e.target.closest('[data-ingredient]');if(b)add(b.dataset.ingredient);});
let circle=null;
$('tea-drop').addEventListener('pointerdown',e=>{
 if(locked||!dish.tea.length||dish.sealed)return;
 const r=$('tea-drop').getBoundingClientRect();circle={id:e.pointerId,cx:r.left+r.width/2,cy:r.top+r.height/2,angle:Math.atan2(e.clientY-r.top-r.height/2,e.clientX-r.left-r.width/2),total:0};$('tea-drop').setPointerCapture(e.pointerId);
});
$('tea-drop').addEventListener('pointermove',e=>{
 if(!circle||e.pointerId!==circle.id)return;
 const a=Math.atan2(e.clientY-circle.cy,e.clientX-circle.cx);let delta=a-circle.angle;if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;circle.total+=Math.abs(delta);circle.angle=a;
 if(circle.total>Math.PI*1.4){circle.total=0;stir();}
});
$('tea-drop').addEventListener('pointerup',()=>circle=null);$('tea-drop').addEventListener('pointercancel',()=>circle=null);
let frames=0,measureAt=performance.now(),lastUi=0;
function frame(t){
 if(document.hidden){raf=0;return;}
 character.frame(t,celebration?sound.energy((t-celebration.at)/1000):0);
 if(drag?.ghost){drag.ghost.style.transform='translate3d('+(drag.px-37)+'px,'+(drag.py-42)+'px,0)';const el=document.elementFromPoint(drag.px,drag.py);document.querySelectorAll('.dropzone').forEach(z=>z.classList.toggle('drag-over',!!el&&z.contains(el)));}
 if(t-lastUi>75){
  lastUi=t;
  if(['side1','side2'].includes(grill.phase)){
   const duration=grill.phase==='side1'?3200:1800,progress=Math.min(1,(t-grill.started)/duration);
   $('cook-progress').style.transform='scaleX('+progress+')';
   if(progress===1){grill.phase=grill.phase==='side1'?'flip':'ready';renderGrill();sound.tone('ready');if(grill.phase==='flip')toast('这面煎好了，点煎锅翻面。');}
  }
  if(celebration&&t-celebration.at>=celebration.duration)finishLaugh();
 }
 frames++;if(t-measureAt>1200){$('game').dataset.fps=String(Math.round(frames*1000/(t-measureAt)));measureAt=t;frames=0;}
 raf=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenAt=performance.now();if(raf)cancelAnimationFrame(raf);raf=0;cleanDrag();if(sound.ctx?.state==='running')sound.ctx.suspend();}
 else{
  const elapsed=performance.now()-hiddenAt;if(['side1','side2'].includes(grill.phase))grill.started+=elapsed;if(celebration)celebration.at+=elapsed;measureAt=performance.now();frames=0;character.last=0;
  if(started&&sound.ctx?.state==='suspended')sound.ctx.resume().catch(()=>{});
  if(!raf)raf=requestAnimationFrame(frame);
 }
});
prefs();renderGrill();setStation(station);
character.setSkin(save.equipped).then(()=>{$('game').dataset.characterReady='true';}).catch(e=>{console.warn(e);$('character-canvas').hidden=true;$('character-fallback').hidden=false;});
raf=requestAnimationFrame(frame);
window.addEventListener('pagehide',()=>{persist();sound.stop();});

