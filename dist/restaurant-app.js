import {RECIPES,OUTFITS,FAILURES,LABELS} from './engine.js';
import {CharacterRenderer,Sound} from './animation.js';
import {act,tick,restoreRestaurant,currentOrder,recipeBy,customer,CUSTOMERS,EQUIPMENT,DECOR,dailyLimit,availableTables,statusText,badge} from './restaurant.js';
import {clamp,mean,grade,circleStep,scoreFood} from './quality.js';
import {img,characterImage,escapeText,frontView,kitchenView,diningView,foodHTML,stackHTML,cupHTML,rulesHTML,teaReadout} from './views.js';
import {exportCard} from './album.js';
const $=id=>document.getElementById(id),KEY='naiwa-kitchen-v2',LEGACY='naiwa-kitchen-v1';
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
let state=restoreRestaurant(read(KEY),read(LEGACY));
const ui={menu:[],table:null,pending:null,tray:null,shop:'equipment',arrival:null};
let started=false,gesture=null,ghost=null,suppressUntil=0,toastTimer,celebration=null,modalMode='',saveAt=0,lastTime=0,raf=0,frames=0,fpsAt=0,dirty=false,renderPending=false,exportURL='';
const sound=new Sound(),character=new CharacterRenderer($('character-canvas'),$('character-fallback'));
const reducedMedia=matchMedia('(prefers-reduced-motion: reduce)');
function prefs(){sound.enabled=state.sound;character.reduced=state.reduced||reducedMedia.matches;document.body.classList.toggle('reduced',character.reduced);}
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));$('save-status').textContent='✓ 营业现场已自动保存';dirty=false;}catch{$('save-status').textContent='存储空间不足，请保留此页面并保存备份';}saveAt=performance.now();}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').classList.add('show');toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3200);}
function context(){const o=currentOrder(state),item=o?.items[o.selected];return {o,item,f:item?.food,r:item&&recipeBy(item.recipe)};}
function dispatch(type,p={},redraw=true){const result=act(state,type,p);if(!result.ok){toast(result.message);sound.tone('error');}dirty=true;persist();if(redraw)render();return result;}
function header(){
 $('coins').textContent=state.coins;$('day-label').textContent='第 '+state.day+' 天'+(state.day%7===0?' · 派对日':'');$('progress-label').textContent=state.phase==='closed'?'今天圆满收工':`已招待 ${state.completed} / ${dailyLimit(state.day)} 位`;
 const active=state.orders.filter(o=>o.status!=='settled');
 $('order-strip').innerHTML=active.length?active.map(o=>`<button class="order-chip ${o.id===state.active?'active':''}" data-action="order" data-order="${o.id}">${characterImage(o.customer)}<span><b>${o.challenge?'高塔挑战':o.table+' 号桌'}${o.items.length>1?' · 套餐':''}</b><small>${statusText(o,state)}</small></span></button>`).join(''):'<span class="order-empty">＋ 接一份订单，让小餐厅热闹起来。</span>';
 document.querySelectorAll('.scene-nav button').forEach(b=>{b.classList.toggle('active',b.dataset.scene===state.scene);b.setAttribute('aria-current',b.dataset.scene===state.scene?'page':'false');});
 $('front-count').textContent=state.queue.length||'';$('kitchen-count').textContent=active.filter(o=>o.status==='making').length||'';$('dining-count').textContent=active.filter(o=>o.status==='packed').length||'';
 $('game').style.setProperty('--wall',['#ececd8','#dce7db','#f0dfd3'][state.decor.wall]);$('game').style.setProperty('--cloth',['#ebe3c8','#d8e6ce','#f0d4be'][state.decor.cloth]);
 $('game').dataset.scene=state.scene;$('game').dataset.day=state.day;$('game').dataset.phase=celebration?'laughing':state.phase;
 $('game').dataset.theme=String(state.day%7===0);$('game').classList.toggle('fine-measure',state.equipment.includes('measure'));
 $('desktop-day').innerHTML=`第 ${state.day} 天 · ${state.phase==='closed'?'今日圆满收工':'正在收集好心情'}<br>熟客 ${Object.values(state.customers).filter(n=>n>=3).length} 位 · 配方 ${state.discovered.length}/12<br>今日小费 ${state.stats.tips} ✦ · 快乐相册 ${state.album.length} 张`;
}
function render(){header();$('scene').innerHTML=state.scene==='front'?frontView(state,ui):state.scene==='kitchen'?kitchenView(state,ui):diningView(state,ui);const tea=$('tea-pad');if(tea){tea.tabIndex=0;tea.setAttribute('aria-label','奶茶搅拌区，画圈或按左右方向键转动搅拌柄');}document.querySelectorAll('[data-pour]').forEach(b=>b.title='向右滑动倾倒；键盘左右方向键每次调整 0.1 份');renderPending=false;}
function refreshFood(){
 const {f,r}=context();if(!f)return;
 if(r.type==='burger'&&$('stack-view'))$('stack-view').innerHTML=stackHTML(f,{preview:ui.pending&&ui.pending.id!=='lid'?ui.pending:null});
 if(r.type==='tea'&&$('cup-view')){$('cup-view').innerHTML=cupHTML(f,r,{guides:true,lidPreview:ui.pending?.id==='lid'?ui.pending.x:null});$('stir-progress').textContent='搅拌 '+f.turns.toFixed(1)+' / 3 圈';$('tea-readout').textContent=teaReadout(state,f);}
 if($('recipe-rules'))$('recipe-rules').innerHTML=rulesHTML(f,r);
}
function openModal(title,eyebrow,html,mode='generic'){modalMode=mode;$('modal-title').textContent=title;$('modal-eyebrow').textContent=eyebrow;$('modal-content').innerHTML=html;if(!$('modal').open)$('modal').showModal();}
function closeModal(){if(modalMode==='result'){dispatch('acknowledge',{},false);modalMode='';}else modalMode='';$('modal').close();render();}
$('modal').addEventListener('cancel',e=>{e.preventDefault();closeModal();});
function qualityLines(q){return q.parts.map(([name,score])=>`<div class="quality-part"><span>${name}</span><div class="quality-track"><i style="width:${score}%"></i></div><b>${score}</b></div>`).join('')+`<p class="modal-copy">${q.note}</p>`;}
function showResult(){
 const result=state.lastResult;if(!result)return;const {order:o,reward:r}=result;
 const challengeText=o.challenge?(o.quality.score>=85?'八层高塔完成，建筑师徽章已收录！':'这座高塔很有个性。达到 85 分可收录建筑师徽章。'):o.critic?(o.quality.score>=90?'评论员给出了推荐，徽章已收录！':'评论员期待下一次的 90 分作品，正常餐费照常结算。'):customer(o.customer).name+'：'+(o.quality.score>=95?'这简直是一件小艺术品！':o.quality.score>=80?'好看又好吃，下次还来！':'好吃就开心，慢慢来，我们一起进步。');
 openModal('好心情，已送达',o.challenge?'高塔挑战':`${o.table} 号桌 · ${customer(o.customer).name}`,`<div class="result-food">${foodHTML(o.items)}</div><div class="score-heading"><div class="score-number">${o.quality.score}<small>${grade(o.quality.score)}</small></div></div>${o.items.map(i=>`<h3>${recipeBy(i.recipe).name}</h3>${qualityLines(i.quality)}`).join('')}<p class="modal-copy">${challengeText}</p><div class="earning-lines"><div><span>餐费</span><b>+${r.base}</b></div><div><span>手艺小费</span><b>+${r.tips}</b></div>${r.discovery?`<div><span>首次配方</span><b>+${r.discovery}</b></div>`:''}${r.combo?`<div><span>连续三单</span><b>+${r.combo}</b></div>`:''}${r.critic?`<div><span>评论员推荐</span><b>+${r.critic}</b></div>`:''}<div class="total"><span>本单收入</span><b>+${r.total} ✦</b></div></div><button class="primary wide" data-action="result-done">${state.phase==='closed'?'看看今日营业手账':'继续招待下一份期待'} →</button>`,'result');
}
async function beginCelebration(){
 const result=state.lastResult;if(!result||result.acknowledged)return;
 const {order:o}=result;closeAnyModal();$('celebration').hidden=false;
 $('celebration').classList.remove('leaving');
 let meal=$('taste-food');if(!meal){meal=document.createElement('div');meal.id='taste-food';meal.className='taste-food';document.querySelector('.laugh-actor').append(meal);}meal.innerHTML=foodHTML(o.items);meal.hidden=false;
 $('celebrate-label').textContent=o.challenge?'高塔挑战 · 用心完成':o.table+' 号桌 · 快乐已送达';
 $('celebrate-title').textContent=o.quality.score>=95?'漂亮得，忍不住大笑！':'这一口，哈哈哈哈！';
 $('celebrate-line').textContent=customer(o.customer).name+'拿起料理，认真尝了一口……';
 celebration={at:performance.now(),duration:(character.reduced?3:result.important?9.3:3)*1000,stage:'taste'};
 character.laugh(false);await character.setSkin(o.customer).catch(()=>{});$('game').dataset.characterReady='true';
 if(!celebration)return;
 render();
}
function closeAnyModal(){modalMode='';if($('modal').open)$('modal').close();}
function finishLaugh(){if(!celebration||celebration.stage==='leave')return;celebration.stage='leave';sound.stop();$('celebration').classList.add('leaving');setTimeout(()=>{celebration=null;character.laugh(false);$('celebration').hidden=true;showResult();render();},character.reduced?0:180);}
function showJournal(){
 const st=state.stats,closed=state.phase==='closed';
 openModal('第 '+state.day+' 天 · '+(closed?'收工啦':'营业手账'),closed?'今天的每一份认真，都记在这里':'慢慢做，没有倒计时',`<div class="stat-grid"><div><b>${state.completed}/${dailyLimit(state.day)}</b><small>今日招待</small></div><div><b>${st.tips}</b><small>手艺小费</small></div><div><b>${st.scores.length?Math.round(mean(st.scores)):'—'}</b><small>平均精美度</small></div></div><div class="earning-lines"><div><span>餐费</span><b>${st.base} ✦</b></div><div><span>奖励</span><b>${st.bonus} ✦</b></div><div><span>熟客星星</span><b>+${st.stars} ★</b></div><div class="total"><span>今日总收入</span><b>${st.base+st.tips+st.bonus} ✦</b></div></div>${st.best?`<div class="summary-best"><span>今日最佳 · ${st.best.score} 分</span>${foodHTML(st.best.items)}<button class="text-button" data-action="export-best">保存今日最佳合照 ↗</button></div>`:''}${state.badges.length?`<div class="badge-row">${state.badges.map(id=>'<span>✦ '+(id==='tower'?'高塔建筑师':'评论员推荐')+'</span>').join('')}</div>`:''}<p class="modal-copy">${closed?dayUnlockText(state.day+1):'你可以随时换场景、暂停或离开。已确认的操作会自动保存。'}</p><div class="journal-actions"><button class="secondary" data-action="shop">设备与装修</button><button class="secondary" data-action="customers">熟客手账</button><button class="secondary" data-action="album">快乐相册</button></div>${closed?'<button class="primary wide" data-action="nextDay">明天，也要开开心心 →</button>':'<button class="primary wide" data-action="close">继续营业 →</button>'}`,'journal');
}
function dayUnlockText(day){return ({2:'明天会有新面孔，还有奶茶订单。',3:'明天解锁设备商店。第二煎位，让准备工作更从容。',4:'明天开放八层高塔挑战。',5:'明天美食评论员来访，最后一单目标 90 分。',6:'明天出现汉堡与奶茶套餐，还有派对蛙！',7:'明天是派对营业日，限定合照等着你。'})[day]||'收工后添一点设备和装饰，再开启新的营业日。';}
function showShop(tab=ui.shop){
 ui.shop=tab;const closed=state.phase==='closed';
 const tabs=[['equipment','实用设备'],['decor','餐厅装饰'],['outfits','招牌衣橱']].map(([id,name])=>`<button class="${tab===id?'active':''}" data-action="shop-tab" data-id="${id}">${name}</button>`).join('');
 let content='';
 if(tab==='equipment')content=EQUIPMENT.map(e=>`<article class="shop-card"><h3>${e.name}</h3><p>${e.desc}。帮助观察与操作，不直接增加分数。</p><button class="secondary" data-action="buy" data-id="${e.id}" ${state.equipment.includes(e.id)||!closed||state.day<3?'disabled':''}>${state.equipment.includes(e.id)?'✓ 已安装':state.day<3?'第 3 天解锁':e.price+' ✦ 购买'}</button></article>`).join('');
 if(tab==='decor')content=DECOR.map(d=>`<article class="shop-card"><h3>${d.name} · 三种样式</h3><p>为小店换个好心情。买一次，就能自由切换这一组。</p>${state.decorOwned.includes(d.id)?`<div class="decor-swatches">${d.choices.map((name,n)=>`<button class="${state.decor[d.id]===n?'active':''}" data-action="buy" data-id="${d.id}" data-choice="${n}" ${closed?'':'disabled'}>${name}</button>`).join('')}</div>`:`<button class="secondary" data-action="buy" data-id="${d.id}" ${closed?'':'disabled'}>${d.price} ✦ 解锁</button>`}</article>`).join('');
 if(tab==='outfits')content=OUTFITS.map(o=>`<article class="shop-card">${characterImage(o.id)}<h3>${o.name}</h3><p>用于前台的招牌奶蛙。顾客随营业日独立解锁。</p><button class="secondary" data-action="buy" data-id="${o.id}" ${!closed||state.equipped===o.id?'disabled':''}>${state.equipped===o.id?'✓ 正在展示':state.owned.includes(o.id)?'换上这套':o.price+' ✦ 解锁'}</button></article>`).join('');
 openModal('给小店，添一点喜欢','现有 '+state.coins+' ✦',`<div class="catalog-tabs">${tabs}</div><p class="modal-copy">${closed?'收工时间，可以慢慢挑。':'营业中可以看看，收工后再采购与换装。'}</p><div class="shop-grid">${content}</div>`,'shop');
}
function showCustomers(){openModal('常来的，都是老朋友','熟客星星 · 每次 80 分以上 +1',CUSTOMERS.map((c,n)=>{const stars=state.customers[c.id]||0,unlocked=state.day>n;return `<article class="customer-card">${characterImage(c.id)}<div><h3>${c.name} ${unlocked?'':'· 第'+(n+1)+'天到访'}</h3><p>${c.title}</p><span class="stars">${stars} ★ · ${badge(stars)}</span><p>${stars>=8?c.story:stars>=3?'“还是老样子。” 点单时可以一键录入。':'再见几次，就会记住彼此。'}</p></div></article>`;}).join('')+'<p class="modal-copy">3 / 8 / 15 颗星：铜 / 银 / 金熟客。升级时自动收录合照。</p>','customers');}
function showAlbum(){openModal('把好心情，收进相册','共 '+state.album.length+' 个快乐瞬间',state.album.length?`<div class="album-grid">${state.album.slice().reverse().map(a=>`<button class="album-card" data-action="album-card" data-id="${escapeText(a.id)}">${foodHTML(a.items)}<b>${escapeText(a.event)}</b><small>第 ${a.day} 天 · ${a.score} 分 · ${customer(a.customer).name}</small></button>`).join('')}</div>`:'<p class="modal-copy">完成新配方、结识熟客、挑战评论员，或者认真经营完今天。你的第一张合照很快就会到来。</p>','album');}
async function showExport(card){if(!card)return;openModal('好心情正在装框','请稍等','<p class="modal-copy">正在绘制你亲手制作的料理……</p>','export');try{exportURL=await exportCard(card);if(modalMode!=='export')return;openModal(card.event,'第 '+card.day+' 天 · 实际成品合照',`<img class="export-image" src="${exportURL}" alt="${escapeText(card.event)}合照"><a class="primary wide download-link" href="${exportURL}" download="奶蛙快乐合照.png">保存图片 ↓</a><p class="modal-copy">手机也可以长按上方图片保存。</p>`,'export');}catch{toast('图片暂时没有加载好，请重试。');showAlbum();}}
function showRecipes(){openModal('奶蛙的配方手账','已收录 '+state.discovered.length+' / 12',`<div class="shop-grid">${RECIPES.map(r=>`<article class="shop-card">${img('dish-'+r.icon,r.name)}<h3>${r.name} ${state.discovered.includes(r.id)?'✓':''}</h3><p>${r.type==='burger'?'底包打底，顶包收尾。':'搅拌三圈，最后封杯。'}<br>${r.rules.map(([,n,l])=>l+' '+n+'份').join(' · ')}${r.forbid?'<br>不要'+r.forbid.filter(id=>id!=='raw-patty').map(id=>LABELS[id]).join('、'):''}</p></article>`).join('')}</div><h3>翻车也是经验 · ${state.failures.length}/6</h3>${FAILURES.filter(f=>state.failures.includes(f.id)).map(f=>`<p class="modal-copy"><b>${f.name}</b> · ${f.tip}</p>`).join('')}`,'recipes');}
function showSettings(){openModal('按喜欢的节奏，慢慢做','厨房小设置',`<div class="setting-row"><div><strong>声音</strong><p>经典原声与轻量操作音效</p></div><button class="toggle ${state.sound?'on':''}" data-action="sound" role="switch" aria-checked="${state.sound}">${state.sound?'开启':'关闭'}</button></div><div class="setting-row"><div><strong>轻柔动画</strong><p>减少摆动，保留操作反馈</p></div><button class="toggle ${state.reduced?'on':''}" data-action="reduced" role="switch" aria-checked="${state.reduced}">${state.reduced?'开启':'关闭'}</button></div><p class="modal-copy">前台听需求录单，选择空桌。厨房可以保存不同订单的草稿；肉饼绑定各自订单。奶茶向右滑动容器倾倒，在杯中沿环画圈。打包后拖动托盘送到对应桌。没有耐心倒计时，食物不会烧焦。</p><div class="journal-actions"><button class="secondary" data-action="recipes">配方手账</button><button class="secondary" data-action="backup">保存进度备份</button></div><p class="modal-copy">旧版金币、收藏和衣橱已兼容。进度保存在当前浏览器与网址。更换浏览器前可保存备份。</p>`,'settings');}
function startPlacement(id,slot){const {o,f,r}=context();if(!o||o.status!=='making')return toast('先选择一份制作中的订单。');if(id==='lid'&&f.turns<3-1e-6)return toast('先沿圆环搅拌三圈，再放杯盖。');if(id!=='lid'&&r.type!=='burger')return;ui.pending={id,slot,x:.2,touched:false};render();}
function switchScene(scene){cancelGesture();ui.pending=null;dispatch('scene',{scene});}
document.addEventListener('click',async e=>{
 const b=e.target.closest('[data-action]');if(!b||b.disabled||performance.now()<suppressUntil)return;
 const a=b.dataset.action,id=b.dataset.id;sound.unlock();
 if(a==='start'){started=true;prefs();$('welcome').hidden=true;await sound.unlock();$('game').dataset.audioReady=String(!!sound.buffer);$('game').dataset.audioDuration=String(sound.buffer?.duration||0);if(state.lastResult&&!state.lastResult.acknowledged)showResult();else toast(state.day===1?'先听顾客说想吃什么，再点击菜单和空桌。':'欢迎回来，营业现场都保存好啦。');render();return;}
 if(!started)return;
 sound.tone();
 if(a==='scene'){closeAnyModal();switchScene(b.dataset.scene);return;}
 if(a==='order'){cancelGesture();ui.pending=null;dispatch('select',{order:b.dataset.order},false);state.scene=currentOrder(state)?.status==='packed'?'dining':'kitchen';persist();render();return;}
 if(a==='item'){ui.pending=null;dispatch('select',{item:Number(b.dataset.item)});return;}
 if(a==='menu'){const q=state.queue[0];if(!q)return;if(ui.menu.includes(id))ui.menu=ui.menu.filter(x=>x!==id);else if(q.recipes.length===1)ui.menu=[id];else if(ui.menu.length<2)ui.menu.push(id);else toast('这份套餐是两件料理，先取消一项再修改。');render();return;}
 if(a==='seat'){ui.table=Number(b.dataset.table);render();return;}
 if(a==='regular'){ui.menu=[...(state.queue[0]?.recipes||[])];render();return;}
 if(a==='accept'){const result=dispatch('accept',{recipes:ui.menu,table:ui.table},false);if(result.ok){ui.menu=[];ui.table=null;state.scene='kitchen';persist();toast(recipeBy(result.order.items[0].recipe).type==='tea'?'订单已经夹好。向右滑动容器倒茶和奶，再添配料。':'订单已经夹好。先准备食材，生肉饼要下锅。');}render();return;}
 if(a==='ingredient'){if(id==='raw-patty')dispatch('grill');else startPlacement(id);return;}
 if(a==='grill-slot'){
  const n=Number(b.dataset.slot),g=state.grills[n];
  if(!g){dispatch('grill',{slot:n});return;}
  const target=state.orders.find(o=>o.id===g.order);if(!target)return;
  if(state.active!==g.order||target.selected!==g.item){ui.pending=null;dispatch('select',{order:g.order,item:g.item});toast('已切到这片肉饼对应的订单。');return;}
  if(g.phase==='flip')dispatch('flip',{slot:n});else if(g.phase==='ready')startPlacement('patty',n);else toast('小火慢煎，煎好会提示。');return;
 }
 if(a==='confirm-place'){
  if(!ui.pending?.touched)return;const p={...ui.pending};
  const result=dispatch(p.id==='lid'?'seal':'place',p,false);if(result.ok){ui.pending=null;sound.tone('ready');if(Math.abs(p.x)<.05)toast('漂亮，这个位置刚刚好。');}render();return;
 }
 if(a==='cancel-place'){ui.pending=null;render();return;}
 if(a==='lid'){startPlacement('lid');return;}
 if(a==='topping'){dispatch('topping',{id});return;}
 if(['undo','reset','cancelChallenge'].includes(a)){ui.pending=null;dispatch(a);return;}
 if(a==='pack'){ui.pending=null;const result=dispatch('pack',{},false);if(result.ok){state.scene=result.order.challenge?'kitchen':'dining';sound.tone('ready');toast('打包好了，把托盘送到对应餐桌吧。');}persist();render();return;}
 if(a==='tray'){ui.tray=b.dataset.order;render();toast('托盘已拿起，再点对应餐桌。');return;}
 if(a==='table'){if(!ui.tray)return toast('先拿起出餐架上的托盘，再送餐。');deliver(ui.tray,Number(b.dataset.table));return;}
 if(a==='challenge-deliver'){deliver(state.active,0);return;}
 if(a==='challenge'){ui.pending=null;closeAnyModal();dispatch('challenge');return;}
 if(a==='finish-laugh'){finishLaugh();return;}
 if(a==='result-done'){closeModal();if(state.phase==='closed')showJournal();return;}
 if(a==='close'){closeModal();return;}
 if(a==='journal'){showJournal();return;}
 if(a==='nextDay'){const result=dispatch('nextDay',{},false);if(result.ok){closeAnyModal();ui.menu=[];ui.table=null;ui.pending=null;render();toast(dayUnlockText(state.day).replace('明天','今天'));}return;}
 if(a==='shop'){showShop();return;}if(a==='shop-tab'){showShop(id);return;}
 if(a==='buy'){const result=dispatch('buy',{id,choice:Number(b.dataset.choice||0)},false);if(result.ok)sound.tone('coin');header();render();showShop();return;}
 if(a==='customers'){showCustomers();return;}if(a==='album'){showAlbum();return;}if(a==='recipes'){showRecipes();return;}
 if(a==='album-card'){showExport(state.album.find(x=>x.id===id));return;}
 if(a==='export-best'){showExport(state.stats.best);return;}
 if(a==='download'){const link=document.createElement('a');link.href=exportURL;link.download='奶蛙快乐合照.png';link.click();return;}
 if(a==='settings'){showSettings();settingsExtras();return;}
 if(a==='sound'||a==='reduced'){state[a]=!state[a];prefs();persist();showSettings();settingsExtras();return;}
 if(a==='import-save'){$('import-save-file').click();return;}
 if(a==='undo-import'){const previous=read(KEY+'-before-import');if(previous){const now=state;state=restoreRestaurant(previous);localStorage.setItem(KEY+'-before-import',JSON.stringify(now));ui.pending=null;ui.menu=[];ui.table=null;prefs();persist();closeModal();toast('已恢复导入前的营业现场。');}return;}
 if(a==='backup'){const link=document.createElement('a');const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));link.href=url;link.download='奶蛙餐厅-第'+state.day+'天-存档.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('备份已下载，请妥善保存。');}
});
function deliver(order,table){
 if(celebration||state.lastResult&&!state.lastResult.acknowledged)return;
 const result=dispatch('deliver',{order,table},false);
 if(result.ok){ui.tray=null;render();beginCelebration();}
}
document.addEventListener('input',e=>{
 if(e.target.id!=='placement-slider')return;
 const x=Number(e.target.value)/100;
 if(ui.pending){ui.pending.x=x;ui.pending.touched=true;const confirm=document.querySelector('[data-action="confirm-place"]');if(confirm)confirm.disabled=false;}
 else{act(state,'adjust',{x});dirty=true;}
 refreshFood();
});
document.addEventListener('change',e=>{if(e.target.id==='placement-slider')persist();});
function settingsExtras(){
 $('modal-content').insertAdjacentHTML('beforeend','<div class="journal-actions"><button class="secondary" data-action="import-save">导入进度备份</button>'+(read(KEY+'-before-import')?'<button class="secondary" data-action="undo-import">撤回上次导入</button>':'')+'</div><input id="import-save-file" type="file" accept="application/json,.json" hidden><p class="modal-copy">导入前自动保留当前进度，可通过“撤回上次导入”恢复。</p>');
}
document.addEventListener('change',async e=>{
 if(e.target.id!=='import-save-file'||!e.target.files[0])return;
 try{const file=e.target.files[0];if(file.size>5e6)throw Error('size');const raw=JSON.parse(await file.text());if(![1,2].includes(raw.version))throw Error('version');const next=restoreRestaurant(raw);
  if(raw.version===2&&(next.day!==raw.day||next.orders.length!==raw.orders?.length))throw Error('invalid save');
  localStorage.setItem(KEY+'-before-import',JSON.stringify(state));state=next;ui.pending=null;ui.menu=[];ui.table=null;ui.tray=null;prefs();persist();closeModal();if(state.lastResult&&!state.lastResult.acknowledged)showResult();else toast('备份已导入，欢迎回到小餐厅。');
 }catch{toast('这份存档无法读取，原有进度保持不变。');}
});
let keyboardTurn=0,keyboardDish='';
document.addEventListener('keydown',e=>{
 if(!started||celebration||$('modal').open||!['ArrowLeft','ArrowRight'].includes(e.key))return;
 const {o,f,r}=context();if(!o||o.status!=='making'||r.type!=='tea'||f.sealed)return;
 const dishKey=o.id+':'+o.selected+':'+JSON.stringify(f.tea)+':'+f.turns;
 if(dishKey!==keyboardDish){keyboardTurn=0;keyboardDish=dishKey;}
 const bottle=e.target.closest('[data-pour]');
 if(bottle){e.preventDefault();act(state,'snapshot');const id=bottle.dataset.pour;if(e.key==='ArrowRight')act(state,'pour',{id,amount:.1});else{f.tea[id]=Math.max(0,(f.tea[id]||0)-.1);f.turns=f.stirTravel=f.stirValid=0;}persist();refreshFood();return;}
 if(e.target.id==='tea-pad'&&Object.keys(f.tea).length&&f.turns<3){
  e.preventDefault();if(!keyboardTurn)act(state,'snapshot');keyboardTurn+=e.key==='ArrowRight'?1:-1;let turns=0;if(Math.abs(keyboardTurn)>=24){turns=1;keyboardTurn=0;sound.tone('ready');}act(state,'stir',{travel:12,valid:12,turns});dirty=true;persist();refreshFood();
 }
});

function padX(clientX,pad,bun){const r=pad.getBoundingClientRect();return (clientX-r.left-r.width/2)/bun;}
function bunWidth(){return parseFloat(getComputedStyle($('burger-pad')).getPropertyValue('--bun'))||170;}
function makeGhost(id){ghost=document.createElement('img');ghost.src='assets/'+id+'.webp';ghost.className='drag-ghost';document.body.append(ghost);}
function cancelGesture(){if(ghost)ghost.remove();ghost=null;gesture=null;document.querySelectorAll('.drag-over,.pouring').forEach(e=>e.classList.remove('drag-over','pouring'));}
document.addEventListener('pointerdown',e=>{
 if(!started||celebration||$('modal').open||e.button!==0||gesture)return;
 const {o,f,r}=context(),target=e.target,button=target.closest('button');
 if(target.id==='placement-slider'){if(!ui.pending&&f?.burger.length)act(state,'snapshot');return;}
 const base={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,element:button||target,order:o?.id,item:o?.selected};
 const pour=target.closest('[data-pour]');
 if(pour&&f&&!f.sealed){act(state,'snapshot');gesture={...base,type:'pour',id:pour.dataset.pour,rate:0};pour.setPointerCapture(e.pointerId);e.preventDefault();return;}
 const ingredient=target.closest('[data-action="ingredient"]');
 if(ingredient){gesture={...base,type:'ingredient',id:ingredient.dataset.id,dragging:false};return;}
 const grill=target.closest('[data-action="grill-slot"]');
 if(grill){const slot=Number(grill.dataset.slot),g=state.grills[slot];if(g&&['flip','ready'].includes(g.phase)){gesture={...base,type:g.phase==='flip'?'flip':'patty',id:'patty',slot,dragging:false};grill.setPointerCapture(e.pointerId);}return;}
 const tray=target.closest('[data-action="tray"]');if(tray){gesture={...base,type:'tray',order:tray.dataset.order,dragging:false};tray.setPointerCapture(e.pointerId);return;}
 const lid=target.closest('[data-action="lid"]');if(lid&&f?.turns>=3-1e-6){gesture={...base,type:'lid',id:'lid',dragging:false};lid.setPointerCapture(e.pointerId);return;}
 const pad=target.closest('#burger-pad');
 if(pad&&f&&r.type==='burger'&&(ui.pending||f.burger.length)){
  if(!ui.pending)act(state,'snapshot');gesture={...base,type:'adjust'};pad.setPointerCapture(e.pointerId);e.preventDefault();return;
 }
 const tea=target.closest('#tea-pad');
 if(tea&&f&&!f.sealed&&Object.keys(f.tea).length&&f.turns<3){
  act(state,'snapshot');const ring=$('stir-ring').getBoundingClientRect();const cx=ring.left+ring.width/2,cy=ring.top+ring.height/2,rad=ring.width/2;
  gesture={...base,type:'stir',cx,cy,rad,net:0,previous:circleStep(null,{x:e.clientX,y:e.clientY},cx,cy,rad).point};tea.setPointerCapture(e.pointerId);e.preventDefault();
 }
});
document.addEventListener('pointermove',e=>{
 const g=gesture;if(!g||g.pointer!==e.pointerId)return;g.x=e.clientX;g.y=e.clientY;
 const dx=g.x-g.startX,dy=g.y-g.startY,distance=Math.hypot(dx,dy);
 if(g.type==='pour'){g.rate=clamp(dx/85,0,1.6);g.element.classList.toggle('pouring',g.rate>0);e.preventDefault();return;}
 if(g.type==='stir'){
  const step=circleStep(g.previous,{x:g.x,y:g.y},g.cx,g.cy,g.rad);g.previous=step.point;
  if(!step.valid&&step.travel>2)g.net=0;g.net+=step.angle;
  let turns=0;if(Math.abs(g.net)>=Math.PI*2){turns=1;g.net-=Math.sign(g.net)*Math.PI*2;sound.tone('ready');}
  act(state,'stir',{order:g.order,item:g.item,travel:step.travel,valid:step.valid,turns});dirty=true;refreshFood();e.preventDefault();return;
 }
 if(g.type==='adjust'){
  const x=clamp(padX(g.x,$('burger-pad'),bunWidth()),-.45,.45);
  if(ui.pending){ui.pending.x=x;ui.pending.touched=true;const b=document.querySelector('[data-action="confirm-place"]');if(b)b.disabled=false;}
  else {act(state,'adjust',{x});dirty=true;}
  if($('placement-slider'))$('placement-slider').value=x*100;refreshFood();e.preventDefault();return;
 }
 if(g.type==='flip'){if(dy< -32&&Math.abs(dy)>Math.abs(dx)){const target=state.orders.find(o=>o.id===state.grills[g.slot]?.order);if(target){act(state,'select',{order:target.id,item:state.grills[g.slot].item});dispatch('flip',{slot:g.slot},false);sound.tone('ready');}suppressUntil=performance.now()+400;cancelGesture();render();}e.preventDefault();return;}
 if(!g.dragging&&distance>9){
  if(g.type==='ingredient'&&e.pointerType==='touch'&&Math.abs(dx)>Math.abs(dy)*1.4){cancelGesture();return;}
  g.dragging=true;g.element.setPointerCapture(e.pointerId);ui.pending=null;
  if(g.type==='tray'){ghost=document.createElement('div');ghost.className='drag-ghost tray-ghost';const order=state.orders.find(o=>o.id===g.order);ghost.innerHTML=order?order.table+' 号桌'+foodHTML(order.items):'';document.body.append(ghost);}else makeGhost(g.id);
 }
 if(g.dragging)e.preventDefault();
},{passive:false});
function endGesture(e,cancelled=false){
 const g=gesture;if(!g||g.pointer!==e.pointerId)return;
 const target=document.elementFromPoint(e.clientX,e.clientY);
 if(g.dragging&&!cancelled){
  suppressUntil=performance.now()+400;
  if(g.type==='tray'){const table=target?.closest('[data-action="table"]');if(table)deliver(g.order,Number(table.dataset.table));else toast('把托盘送到对应桌号，料理仍在出餐架。');}
  else if(g.type==='lid'){
   const tea=$('tea-pad'),rect=tea?.getBoundingClientRect(),cup=tea?.querySelector('.cup')?.getBoundingClientRect();
   if(cup&&e.clientY>=cup.top-30&&e.clientY<=cup.top+65&&Math.abs(e.clientX-(cup.left+cup.width/2))<=70){ui.pending={id:'lid',x:clamp((e.clientX-cup.left-cup.width/2)/120,-.35,.35),touched:true};toast('可以微调杯盖，确认后封杯。');}else toast('将杯盖放到杯口上方。');
  }else if(g.id==='raw-patty'&&target?.closest('[data-action="grill-slot"]'))dispatch('grill',{slot:Number(target.closest('[data-action="grill-slot"]').dataset.slot)},false);
  else if(target?.closest('#burger-pad')){
   const slot=g.type==='patty'?g.slot:undefined;
   const result=dispatch('place',{id:g.id,x:padX(e.clientX,$('burger-pad'),bunWidth()),slot},false);
   if(result.ok)sound.tone('ready');
  }else toast('放到对应制作区，离开餐盘的食材会退回。');
 }
 if(g.type==='pour'||g.type==='stir'||g.type==='adjust'){suppressUntil=performance.now()+250;persist();}
 cancelGesture();if(g.dragging||['pour','stir','adjust'].includes(g.type)||renderPending)render();
}
document.addEventListener('pointerup',e=>endGesture(e));document.addEventListener('pointercancel',e=>endGesture(e,true));

function frame(time){
 if(document.hidden){raf=0;return;}
 const ms=lastTime?Math.min(time-lastTime,100):0;lastTime=time;
 if(started){
  const changes=tick(state,ms);if(changes.length){dirty=true;if(state.equipment.includes('bell'))sound.tone('ready');header();if(gesture)renderPending=true;else render();}
  state.grills.forEach((g,n)=>{if(g&&['side1','side2'].includes(g.phase)){const el=document.querySelector('[data-meter="'+n+'"]');if(el)el.style.transform='scaleX('+(1-g.remaining/(g.phase==='side1'?3200:1800))+')';}});
  if(gesture?.type==='pour'&&gesture.rate>0){const result=act(state,'pour',{id:gesture.id,amount:gesture.rate*ms/1000,order:gesture.order,item:gesture.item});if(result.ok){dirty=true;refreshFood();}}
  if(celebration){
   const elapsed=time-celebration.at;
   if(celebration.stage==='taste'&&elapsed>=550){celebration.stage='laugh';if($('taste-food'))$('taste-food').hidden=true;character.laugh(true);sound.laugh(celebration.duration/1000);$('celebrate-line').textContent=state.lastResult.order.quality.score>=95?'做得这么漂亮，笑得更开心了！':'好吃就开心，下次还来！';}
   character.frame(time,celebration.stage==='laugh'?sound.energy((elapsed-550)/1000):0);
   if(elapsed>=celebration.duration+550)finishLaugh();
  }
 }
 if(ghost&&gesture){ghost.style.transform=`translate3d(${gesture.x-47}px,${gesture.y-96}px,0)`;const el=document.elementFromPoint(gesture.x,gesture.y);document.querySelectorAll('.table,#burger-pad,.grill-slot').forEach(n=>n.classList.toggle('drag-over',!!el&&n.contains(el)));}
 if(dirty&&time-saveAt>1500)persist();
 frames++;if(time-fpsAt>1200){$('game').dataset.fps=String(Math.round(frames*1000/(time-fpsAt)));frames=0;fpsAt=time;}
 raf=requestAnimationFrame(frame);
}
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){cancelGesture();persist();if(raf)cancelAnimationFrame(raf);raf=0;if(sound.ctx?.state==='running')sound.ctx.suspend();if(celebration)celebration.pausedAt=performance.now();}
 else{if(celebration?.pausedAt){celebration.at+=performance.now()-celebration.pausedAt;delete celebration.pausedAt;}lastTime=0;fpsAt=performance.now();frames=0;character.last=0;if(started&&sound.ctx?.state==='suspended')sound.ctx.resume().catch(()=>{});if(!raf)raf=requestAnimationFrame(frame);render();}
});
window.addEventListener('pagehide',()=>{persist();sound.stop();});
prefs();render();persist();fpsAt=performance.now();raf=requestAnimationFrame(frame);
