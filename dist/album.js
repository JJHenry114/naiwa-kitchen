import {recipeBy,customer} from './restaurant.js';
import {skinName} from './views.js';
import {grade} from './quality.js';
const images=new Map();
function load(name){if(!images.has(name)){const im=new Image();im.src='assets/'+name+'.webp';images.set(name,im.decode().then(()=>im));}return images.get(name);}
function contain(ctx,im,x,y,w,h){const k=Math.min(w/im.width,h/im.height);ctx.drawImage(im,x+(w-im.width*k)/2,y+(h-im.height*k)/2,im.width*k,im.height*k);}
function round(ctx,x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
async function drawFood(ctx,item,cx,bottom,width){
 const f=item.food,r=recipeBy(item.recipe);
 if(r.type==='burger'){
  contain(ctx,await load('tray'),cx-width*.8,bottom-18,width*1.6,60);
  const spacing=Math.min(23,165/Math.max(1,f.burger.length-1));
  for(let n=0;n<f.burger.length;n++){const l=f.burger[n];contain(ctx,await load(l.id),cx-width/2+l.x*width,bottom-55-n*spacing,width,80);}
 }else{
  const w=width*.55,h=width*.98,x=cx-w/2,y=bottom-h;
  round(ctx,x,y,w,h,18,'#faf4df');
  const height=Math.min(.9,((f.tea.tea||0)+(f.tea.milk||0))*.25)*h;
  round(ctx,x+3,bottom-height,w-6,height,12,f.tea.tea&&f.tea.milk?'#c5996b':f.tea.milk?'#efdfbc':'#aa6c37');
  if(f.tea.pearls)contain(ctx,await load('pearls'),x+10,bottom-45,w-20,40);
  if(f.tea.foam)round(ctx,x+5,bottom-height-8,w-10,18,10,'#fff9e6');
  if(f.tea.cheese)contain(ctx,await load('cheese'),cx-25,bottom-65,50,40);
  ctx.strokeStyle='#b8b297';ctx.lineWidth=2;ctx.strokeRect(x,y,w,h);
  contain(ctx,await load('lid'),x-10+f.lidX*w,y-15,w+20,30);
  round(ctx,cx-25,bottom-h*.6,50,44,20,'#f4edda');ctx.fillStyle='#758255';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText('奶蛙',cx,bottom-h*.6+26);
 }
}
export async function exportCard(card){
 const canvas=document.createElement('canvas');canvas.width=720;canvas.height=920;const c=canvas.getContext('2d');
 c.fillStyle=card.theme?'#f2e4d6':'#e5eadb';c.fillRect(0,0,720,920);round(c,30,30,660,860,30,'#fbf7e9');
 c.textAlign='center';c.fillStyle='#879471';c.font='12px sans-serif';c.fillText('NAIWA’S LITTLE RESTAURANT · HAPPY MOMENTS',360,77);
 c.fillStyle='#46593d';c.font='bold 32px sans-serif';c.fillText(card.event,360,127);
 c.font='16px sans-serif';c.fillStyle='#8e967d';c.fillText('第 '+card.day+' 个营业日 · '+customer(card.customer).name,360,164);
 contain(c,await load(skinName(card.customer)),250,180,220,310);
 round(c,74,478,572,250,24,card.theme?'#eed8bf':'#ece5d1');
 const width=card.items.length===2?175:235;
 for(let n=0;n<card.items.length;n++)await drawFood(c,card.items[n],card.items.length===2?225+n*270:360,692,width);
 c.fillStyle='#70874e';c.font='48px Georgia';c.fillText(String(card.score),360,790);c.font='17px sans-serif';c.fillText(grade(card.score),360,824);
 c.fillStyle='#9b9f89';c.font='12px sans-serif';c.fillText('把日子，一层一层叠成好心情。',360,858);
 return canvas.toDataURL('image/png');
}
