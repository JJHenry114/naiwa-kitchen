import {RECIPES,LABELS} from './engine.js';
import {CUSTOMERS,customer,recipeBy,availableTables,currentOrder,statusText,dailyLimit,badge} from './restaurant.js';
import {foodCounts,clamp,grade} from './quality.js';

export const escapeText=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const img=(name,alt='',cls='')=>`<img src="assets/${name}.webp" alt="${escapeText(alt)}" class="${cls}" draggable="false">`;
export const skinName=id=>id==='original'?'char-neutral':'outfit-'+id;
export const characterImage=(id,cls='')=>img(skinName(id),customer(id).name,cls);
export function stackHTML(food,{mini=false,preview=null,highlight=-1}={}){
 const list=[...food.burger];if(preview)list.push(preview);
 const spacing=Math.min(mini?9:15,(mini?45:112)/Math.max(1,list.length-1));
 return img('tray','餐盘','plate')+`<div class="food-stack">${list.map((l,i)=>`<img src="assets/${l.id}.webp" alt="${LABELS[l.id]}${i===highlight?'（建议调整这一层）':''}" class="food-layer ${preview&&i===list.length-1?'preview':''} ${i===highlight?'quality-highlight':''}" style="bottom:${i*spacing}px;z-index:${i+1};--offset:calc(var(--bun,170px) * ${l.x})" data-layer="${i}" draggable="false">`).join('')}</div>`;
}
export function cupHTML(f,r,{guides=false,lidPreview=null}={}){
 const amount=(f.tea.tea||0)+(f.tea.milk||0),height=Math.min(91,amount*25),color=f.tea.tea&&f.tea.milk?'#c5996b':f.tea.milk?'#f0e0ba':'#ad6a31';
 let targetTotal=0;
 const marks=guides?r.rules.filter(([id])=>['tea','milk'].includes(id)).map(([id,n])=>{targetTotal+=n;return `<div class="cup-mark" style="bottom:${Math.min(91,targetTotal*25)}%"><span>加${LABELS[id]} ${n}份后</span></div>`;}).join(''):'';
 return `<div class="cup"><div class="cup-vessel"><div class="tea-liquid" style="height:${height}%;background:${color}"></div>${marks}${f.tea.pearls?img('pearls','珍珠','cup-pearls'):''}${f.tea.foam?`<div class="cup-foam" style="bottom:${Math.min(85,height)}%"></div>`:''}${f.tea.cheese?img('cheese','芝士','cup-cheese'):''}${img('cup','','cup-texture')}</div><div class="cup-label">奶蛙<br><small>HAPPY CUP</small></div>${f.sealed||lidPreview!==null?`<img class="cup-lid" src="assets/lid.webp" alt="杯盖" style="--lid:${(lidPreview??f.lidX)*120}px;opacity:${f.sealed?1:.7}">`:''}</div>`;
}
export function foodHTML(items){
 if(items.length>1)return `<div class="mini-food combo-food">${items.map(i=>foodHTML([i])).join('')}</div>`;
 const i=items[0];return `<div class="mini-food">${recipeBy(i.recipe).type==='burger'?stackHTML(i.food,{mini:true,highlight:i.quality?.problemLayer??-1}):cupHTML(i.food,recipeBy(i.recipe))}</div>`;
}
export const title=(name,sub)=>`<div class="scene-title"><h2>${name}</h2><small>${sub}</small></div>`;
export function frontView(s,ui){
 const q=s.queue[0],c=customer(q?.customer),tables=availableTables(s),full=tables.length===0;
 const theme=s.day%7===0?'<div class="theme-banner">✦ 今天是派对营业日 · 留下一张特别合照</div>':'';
 if(s.phase==='closed')return title('今天，辛苦啦','CLOSED · 明天也见')+`<div class="quiet-card">${characterImage(s.equipped)}<h3>第 ${s.day} 天圆满收工</h3><p>招待了 ${s.completed} 位奶蛙，收获 ${s.stats.tips} 金币小费。<br>看看今日手账，再给小店添一点新东西吧。</p><button class="primary" data-action="journal">查看营业总结 →</button></div>${challengePanel(s)}`;
 let html=title('前台 · 接一份期待',`${s.issued}/${dailyLimit(s.day)} 已接单`)+theme;
 html+=`<div class="front-stage"><div class="wall-lines"></div><div class="wall-sign">${['好好吃饭','笑口常开','今天也开心'][s.decor.sign]}<small>ORDER SOMETHING HAPPY</small></div><div class="host-portrait">今日招牌 ${characterImage(s.equipped)}</div>${characterImage(q?q.customer:s.equipped,'front-customer')}<div class="speech"><span class="name">${q?(q.critic?'美食评论员 · ':'')+c.name:'慢慢做，我等得住'}</span><p>${q?`${c.hello}<strong class="request">${q.recipes.map(id=>recipeBy(id).name).join(' ＋ ')}</strong>`:'今天的点单已经记好啦。<br>去厨房把好味道准备好吧。'}</p>${q?`<small>${q.recipes.map(id=>recipeBy(id).line).join('<br>')}</small>`:''}${q?.critic?'<small>✦ 本次目标：90 分，达成获推荐徽章</small>':''}</div><span class="counter-label">ORDER HERE · 开门营业中</span></div>`;
 if(q&&!full){
  html+=`<div class="front-controls"><span class="section-label">01 / 听一听，记下菜单${q.recipes.length>1?' · 这是一份双件套餐':''}</span>${(s.customers[q.customer]||0)>=3?'<button class="text-button" data-action="regular">老样子，一键录单 ↗</button>':''}<div class="menu-grid">${RECIPES.filter(r=>s.day>1||r.type==='burger').map(r=>`<button class="menu-choice ${ui.menu.includes(r.id)?'selected':''}" data-action="menu" data-id="${r.id}" aria-pressed="${ui.menu.includes(r.id)}" aria-label="点单：${r.name}">${img('dish-'+r.icon)}<span>${r.name}</span></button>`).join('')}</div><span class="section-label">02 / 给这份期待安排座位</span><div class="seat-pick">${[1,2,3].map(n=>`<button data-action="seat" data-table="${n}" class="${ui.table===n?'selected':''}" ${tables.includes(n)?'':'disabled'}>${n} 号桌 · ${tables.includes(n)?'空闲':'用餐中'}</button>`).join('')}</div><button class="primary wide" data-action="accept" ${!ui.menu.length||!ui.table?'disabled':''}>确认点单，安排入座 →</button></div>`;
 }else html+=`<div class="quiet-card" style="min-height:auto;padding:22px"><p>${full?'三张桌子都有客人啦。做好一份、送达一份，再来迎接新的期待。':'前台暂时忙完啦，去看看厨房和餐厅。'}</p><button class="primary" data-action="scene" data-scene="kitchen">去厨房准备 →</button></div>`;
 html+=`<div class="queue-line">${s.queue.slice(1).map(q=>characterImage(q.customer)).join('')}<span>${s.queue.length>1?'还有一位奶蛙在等候':'没有倒计时，认真做就很好。'}</span></div>`;
 return html;
}
export function rulesHTML(f,r){const counts=foodCounts(f,r.type);return `<div class="recipe-rules">${r.rules.map(([id,n,label])=>`<span class="rule ${(counts[id]||0)>=n*(r.type==='tea'&&['tea','milk'].includes(id)?.9:1)?'done':''}">${label} ${Number((counts[id]||0).toFixed(1))}/${n}</span>`).join('')}${r.forbid?'<span class="rule forbid">不要'+r.forbid.filter(id=>id!=='raw-patty').map(id=>LABELS[id]).join('、')+'</span>':''}</div>`;}
export function grillHTML(s){return `<div class="grill-row">${s.grills.map((g,n)=>{
 if(n===1&&!s.equipment.includes('grill2'))return '<button class="grill-slot locked" data-action="shop"><span>＋</span><b>第二煎位</b><small>收工后可升级</small></button>';
 const o=g&&s.orders.find(o=>o.id===g.order),label=g?{side1:'滋滋…第一面',flip:'向上滑动翻面 ↑',side2:'滋滋…第二面',ready:'已熟 · 拖入对应订单'}[g.phase]:'拖入生肉饼';
 return `<button class="grill-slot ${g?g.phase:''} ${g&&['side1','side2'].includes(g.phase)?'cooking':''}" data-action="grill-slot" data-slot="${n}" aria-label="煎位 ${n+1}：${label}">${img('pan','煎锅','pan-image')}${g?img(['side2','ready'].includes(g.phase)?'patty':'raw-patty','肉饼','patty-image'):''}<b>${label}</b><small>${o?(o.challenge?'挑战':o.table+'号桌')+' · '+recipeBy(o.items[g.item].recipe).name:'煎好自动保温，不烧焦'}</small><div class="meter"><i data-meter="${n}" style="transform:scaleX(${g?1-g.remaining/(g.phase==='side1'?3200:1800):0})"></i></div></button>`;
 }).join('')}</div>`;}
export function placementHTML(ui,f,r){
 const p=ui.pending,hasTop=r.type==='burger'&&f.burger.length;
 if(!p&&!hasTop)return '';
 const value=p?p.x:f.burger.at(-1).x;
 const label=p?(p.id==='lid'?'杯盖对齐':LABELS[p.id]+' · 滑动选择落点'):'微调最上层 · '+LABELS[f.burger.at(-1).id];
 return `<div class="placement"><div class="placement-head"><span>${label}</span><small>← 左右微调 →</small></div><input id="placement-slider" type="range" min="-${p?.id==='lid'?35:45}" max="${p?.id==='lid'?35:45}" step="1" value="${Math.round(value*100)}" aria-label="${p?.id==='lid'?'杯盖':'食材'}横向位置"><div class="placement-actions">${p?`<button class="secondary" data-action="cancel-place">取消</button><button class="primary" data-action="confirm-place" ${p.touched?'':'disabled'}>${p.id==='lid'?'确认封杯':'放好这一层'} ✓</button>`:'<small>下一层放下后锁定；撤回可继续调整。</small>'}</div></div>`;
}
export function kitchenView(s,ui){
 const o=currentOrder(s);
 if(!o||o.status==='settled')return title('厨房 · 做一份好味道','KITCHEN')+`<div class="quiet-card">${img('pan','煎锅')}<h3>台面已经准备好</h3><p>先去前台接一份订单，<br>再回来慢慢做。</p><button class="primary" data-action="scene" data-scene="front">去前台接单 →</button></div>${challengePanel(s)}`;
 if(o.status==='packed')return title('厨房 · 这份做好啦','READY TO SERVE')+`<div class="quiet-card"><div class="result-food">${foodHTML(o.items)}</div><h3>${grade(o.quality.score)} · ${o.quality.score} 分</h3><p>${o.challenge?'高塔挑战制作完成':'送给 '+o.table+' 号桌的 '+customer(o.customer).name+'，看看它的反应吧。'}</p><button class="primary" data-action="${o.challenge?'challenge-deliver':'scene'}" data-scene="dining">${o.challenge?'提交挑战':'去餐厅送餐'} →</button></div>`;
 const i=o.items[o.selected],r=recipeBy(i.recipe),f=i.food;
 let html=title('厨房 · '+(r.type==='burger'?'层层用心':'摇一杯快乐'),'MADE WITH A LITTLE CARE');
 html+=`<div class="kitchen-order"><div><span class="eyebrow">${o.challenge?'CHALLENGE':customer(o.customer).name+(o.critic?' · 评论员目标90分':'')}</span><h3>${r.name}</h3><p>${r.line}</p><div id="recipe-rules">${rulesHTML(f,r)}</div></div><span class="table-number">${o.table||'★'}</span></div>`;
 if(o.items.length>1)html+=`<div class="item-tabs">${o.items.map((i,n)=>`<button class="${o.selected===n?'active':''}" data-action="item" data-item="${n}">${recipeBy(i.recipe).name}</button>`).join('')}</div>`;
 html+=grillHTML(s);
 if(r.type==='burger'){
  html+=`<div class="build-area"><small>ASSEMBLY / 让每一层，都刚刚好</small><div id="burger-pad" class="burger-pad" aria-label="汉堡摆放区"><div class="center-guide"></div>${s.equipment.includes('guide')?'<div class="fine-guides"></div>':''}<div id="stack-view">${stackHTML(f,{preview:ui.pending&&ui.pending.id!=='lid'?ui.pending:null})}</div>${!f.burger.length&&!ui.pending?'<div class="pad-placeholder">从一片底包开始<br><small>拖入，或选择后滑动摆放</small></div>':''}<span class="layer-counter">${f.burger.length} / 14 层</span></div></div>`;
  html+=placementHTML(ui,f,r);
  html+=`<div class="ingredient-head"><span>新鲜食材</span><small>向上拖取 · 横滑料架</small></div><div class="ingredients">${['bun-bottom','raw-patty','cheese','bun-top','lettuce','tomato','pearls'].map(id=>`<button class="ingredient" data-action="ingredient" data-id="${id}" aria-label="选取${LABELS[id]}">${img(id)}<span>${LABELS[id]}</span></button>`).join('')}</div>`;
 }else{
  html+=`<div class="tea-work"><div class="tea-controls">${['tea','milk'].map(id=>`<button class="pour-bottle" data-pour="${id}" aria-label="滑动倾倒${LABELS[id]}">${img(id)}<span>${LABELS[id]}</span><small>按住向右滑，松手停</small></button>`).join('')}<button class="lid-handle" data-action="lid" aria-label="拿取杯盖">${img('lid')}<span>拖动杯盖到杯口</span></button><span id="stir-progress" class="stir-progress">搅拌 ${f.turns.toFixed(1)} / 3 圈</span></div><div id="tea-pad" class="tea-pad" aria-label="奶茶画圈搅拌区"><div id="cup-view">${cupHTML(f,r,{guides:true,lidPreview:ui.pending?.id==='lid'?ui.pending.x:null})}</div>${!f.sealed?'<div class="stir-ring" id="stir-ring"></div>':''}<div class="tea-readout" id="tea-readout">${teaReadout(s,f)}</div></div></div>${placementHTML(ui,f,r)}<div class="ingredient-head"><span>给奶茶添一点快乐</span><small>液体按刻度倒入</small></div><div class="ingredients">${['pearls','foam','cheese'].map(id=>`<button class="ingredient" data-action="topping" data-id="${id}" aria-label="添加${LABELS[id]}">${img(id)}<span>${LABELS[id]}</span></button>`).join('')}</div>`;
 }
 html+=`<div class="kitchen-actions"><button class="secondary" data-action="undo" ${o.history.length?'':'disabled'}>↶ 撤回</button><button class="secondary" data-action="reset">重做</button><button class="primary" data-action="pack">检查并打包 →</button></div><p class="serve-note">${r.type==='burger'?'轻微偏差也能满分。位置影响精美度，认真摆放能赚更多小费。':'画圈时沿引导环搅拌，完成三个圆周后封杯。'}${o.items.length>1?' 套餐两件都做好才能打包。':''}</p>${o.challenge?'<button class="text-button" data-action="cancelChallenge" style="margin:0 15px 15px">结束本次挑战</button>':''}`;
 return html;
}
export function teaReadout(s,f){return s.equipment.includes('measure')?`红茶 ${(f.tea.tea||0).toFixed(2)} · 牛奶 ${(f.tea.milk||0).toFixed(2)} 份`:`红茶 ${(f.tea.tea||0).toFixed(1)} · 牛奶 ${(f.tea.milk||0).toFixed(1)} 份`;}
export function diningView(s,ui){
 const packed=s.orders.filter(o=>o.status==='packed'&&!o.challenge);
 return title('餐厅 · 把快乐送到桌','TABLE FOR A HAPPY DAY')+`<div class="dining-room"><div class="room-sign">${s.day%7===0?'✦ 奶蛙派对日 ✦':['好好吃饭，好好大笑','笑口常开，吃好每餐','今天也要开开心心'][s.decor.sign]}</div><div class="tables">${[1,2,3].map(n=>{
  const o=s.orders.find(o=>o.table===n&&o.status!=='settled');return `<button class="table" data-action="table" data-table="${n}" aria-label="送到 ${n} 号桌">${o?characterImage(o.customer,'seated'):'<span class="empty-seat">为好心情留个座</span>'}<div class="tabletop"><span class="table-number-badge">${n}</span></div><span class="table-state">${o?customer(o.customer).name+' · '+statusText(o,s):'空闲'}</span></button>`;
 }).join('')}</div></div><div class="pickup"><h3>出餐架 <small>把托盘拖到对应餐桌</small></h3>${packed.length?`<div class="tray-grid">${packed.map(o=>`<button class="tray-card ${ui.tray===o.id?'selected':''}" data-action="tray" data-order="${o.id}" aria-label="${o.table}号桌托盘"><b>${o.table} 号桌 · ${customer(o.customer).name}</b>${foodHTML(o.items)}<small>${o.quality.score} 分 · ${grade(o.quality.score)}</small></button>`).join('')}</div>`:'<div class="pickup-empty">出餐架还空着。<br>厨房打包后，好味道就会出现在这里。</div>'}</div><p class="serve-note">也可以先点选托盘，再点餐桌送达。送错桌会退回，不扣金币。</p><div class="journal-actions" style="margin:0 15px 18px"><button class="secondary" data-action="customers">熟客手账</button><button class="secondary" data-action="album">快乐相册</button></div>${challengePanel(s)}`;
}
export function challengePanel(s){return s.day>=4?`<div class="challenge-panel"><div><b>八层高塔挑战 ${s.badges.includes('tower')?'✓':''}</b><p>八层馅料，85分达标。慢慢叠，收集建筑师徽章。</p></div><button class="secondary" data-action="challenge">试试看 ↗</button></div>`:'';}
