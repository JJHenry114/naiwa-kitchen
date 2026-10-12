import {LABELS} from './engine.js';

export const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
export const precision=(error,tolerance=.05,limit=.35)=>100*(1-clamp((Math.abs(error)-tolerance)/(limit-tolerance)));
export const grade=n=>n>=95?'大师出品':n>=80?'精致美味':n>=60?'家常好味':'有点随性';
export const tipFor=(base,score)=>Math.round(base*.5*clamp((score-50)/50));
export function freshFood(){return {burger:[],tea:{},turns:0,stirTravel:0,stirValid:0,sealed:false,lidX:0};}
export function foodCounts(dish,type){
 if(type==='tea')return {...dish.tea};
 const c={layers:0};for(const l of dish.burger){c[l.id]=(c[l.id]||0)+1;if(!l.id.startsWith('bun-'))c.layers++;}return c;
}
export function checkFood(d,r){
 const c=foodCounts(d,r.type),fail=(id,message)=>({ok:false,id,message});
 if(r.type==='burger'){
  if(c['raw-patty'])return fail('raw','生肉饼需要先煎熟。');
  if(d.burger[0]?.id!=='bun-bottom'||d.burger.at(-1)?.id!=='bun-top')return fail('bread','底包打底，顶包收尾，才能打包。');
 }else{
  if(d.turns<3-1e-6)return fail('unstirred','沿杯中的圆环搅拌，完成三个有效圆周。');
  if(!d.sealed)return fail('unsealed','把杯盖放到杯口，再确认封杯。');
 }
 const forbidden=r.forbid?.find(id=>(c[id]||0)>.001);
 if(forbidden)return fail('forbidden','这份订单不要'+LABELS[forbidden]+'，请撤回或重做。');
 const missing=r.rules.filter(([id,n])=>(c[id]||0)+1e-6<n*(r.type==='tea'&&['tea','milk'].includes(id)?.9:1));
 if(missing.length)return fail('missing','还需要：'+missing.map(([id,n,label])=>label+' '+n+'份').join('、'));
 return {ok:true};
}
export function scoreBurger(d){
 const layers=d.burger,body=layers.slice(0,-1),top=layers.at(-1);
 if(!layers.length)return {score:0,parts:[],note:'还没有开始制作'};
 const centered=precision(mean(layers.map(l=>l.x)));
 const offsets=body.slice(1).map((l,i)=>({offset:Math.abs(l.x-body[i].x),layer:l}));
 const aligned=offsets.length?mean(offsets.map(o=>precision(o.offset))):100;
 const cap=precision((top?.x||0)-mean(body.map(l=>l.x)));
 const worst=offsets.slice().sort((a,b)=>b.offset-a.offset)[0];
 const note=cap<85?'顶包再向中间靠一点。':worst?.offset>.05?LABELS[worst.layer.id]+'有些偏'+(worst.layer.x>0?'右':'左')+'，下一次可以微调。':centered<85?'层间很整齐，整座汉堡再靠餐盘中心一点。':'层层整齐，顶包也稳稳的。';
 const problemLayer=cap<85?layers.length-1:worst?.offset>.05?body.indexOf(worst.layer):-1;
 return {score:Math.round(centered*.2+aligned*.6+cap*.2),parts:[['摆盘居中',Math.round(centered)],['内层整齐',Math.round(aligned)],['顶包位置',Math.round(cap)]],note,problemLayer};
}
export function scoreTea(d,r){
 const liquids=r.rules.filter(([id])=>['tea','milk'].includes(id));
 const weight=liquids.reduce((s,[,n])=>s+n,0)||1;
 const amounts=liquids.reduce((s,[id,n])=>s+n*precision(((d.tea[id]||0)-n)/n,.05,.5),0)/weight;
 const stir=d.stirTravel>0?100*clamp(d.stirValid/d.stirTravel):0;
 const lid=precision(d.lidX);
 return {score:Math.round(amounts*.5+stir*.3+lid*.2),parts:[['份量准确',Math.round(amounts)],['搅拌轨迹',Math.round(stir)],['封杯对齐',Math.round(lid)]],note:amounts<85?'注意杯身目标刻度，快接近时缓缓倒入。':stir<85?'沿着圆环搅拌，轨迹会更均匀。':lid<85?'下次把杯盖再往杯口中心移一点。':'份量、搅拌和封杯，都刚刚好。'};
}
export const scoreFood=(d,r)=>r.type==='burger'?scoreBurger(d):scoreTea(d,r);

// A full circle must be traced continuously; back-and-forth movements cancel.
export function circleStep(previous,point,cx,cy,radius){
 const x=point.x-cx,y=point.y-cy,rad=Math.hypot(x,y),angle=Math.atan2(y,x);
 const inRing=rad>=radius*.62&&rad<=radius*1.3;
 if(!previous)return {point:{angle,inRing,x:point.x,y:point.y},travel:0,valid:0,angle:0};
 const travel=Math.hypot(point.x-previous.x,point.y-previous.y);
 let delta=angle-previous.angle;if(delta>Math.PI)delta-=Math.PI*2;if(delta< -Math.PI)delta+=Math.PI*2;
 const valid=inRing&&previous.inRing&&Math.abs(delta)<.75;
 return {point:{angle,inRing,x:point.x,y:point.y},travel,valid:valid?travel:0,angle:valid?delta:0};
}
