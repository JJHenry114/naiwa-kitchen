// A small GPU-deformed mesh keeps the approved raster artwork intact while moving it continuously.
export class CharacterRenderer{
 constructor(canvas,fallback){
  this.canvas=canvas;this.fallback=fallback;this.images=new Map();this.textures=new Map();this.skin='original';this.mix=0;this.target=0;this.energy=0;this.last=0;this.reduced=false;this.active=true;
  this.gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,powerPreference:'low-power'});
  if(!this.gl){canvas.hidden=true;fallback.hidden=false;return;}
  const gl=this.gl;
  const vertex=`attribute vec2 a_uv; varying vec2 v_uv; uniform float u_time,u_laugh,u_energy,u_reduced;
  void main(){
   v_uv=a_uv; vec2 p=a_uv;
   float t=u_time; float upper=pow(1.0-p.y,1.5); float breath=sin(t*1.8)*.004;
   float motion=1.0-u_reduced;
   p.x+=(sin(t*1.25)*.005+u_laugh*sin(t*10.0)*(.005+.009*u_energy))*upper*motion;
   p.y+=breath*(1.0-p.y)*motion;
   p.y+=u_laugh*sin(t*12.0)*(.004+.007*u_energy)*sin(p.y*3.14159)*motion;
   float belly=exp(-pow((p.y-.57)/.21,2.0));
   p.x+=(p.x-.5)*belly*(breath*2.2+u_laugh*u_energy*.026)*motion;
   float mouth=exp(-pow((p.y-.21)/.065,2.0)-pow((p.x-.44)/.18,2.0));
   p.y+=(p.y-.21)*mouth*u_laugh*(u_energy-.35)*.30*motion;
   p.x=.5+(p.x-.5)*.92; p.y=.025+p.y*.95;
   gl_Position=vec4(p.x*2.0-1.0,1.0-p.y*2.0,0,1);
  }`;
  const fragment=`precision mediump float; varying vec2 v_uv; uniform sampler2D u_idle,u_happy; uniform float u_mix; void main(){gl_FragColor=mix(texture2D(u_idle,v_uv),texture2D(u_happy,v_uv),u_mix);}`;
  const shader=(type,src)=>{const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;};
  try{
   this.program=gl.createProgram();gl.attachShader(this.program,shader(gl.VERTEX_SHADER,vertex));gl.attachShader(this.program,shader(gl.FRAGMENT_SHADER,fragment));gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error('Character renderer link failed');
   gl.useProgram(this.program);
   const points=[];for(let y=0;y<40;y++)for(let x=0;x<24;x++){const a=x/24,b=y/40,c=(x+1)/24,d=(y+1)/40;points.push(a,b,c,b,a,d,c,b,c,d,a,d);}
   this.count=points.length/2;const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(points),gl.STATIC_DRAW);
   const attr=gl.getAttribLocation(this.program,'a_uv');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);
   this.uniform={};for(const k of ['time','laugh','energy','reduced','mix','idle','happy'])this.uniform[k]=gl.getUniformLocation(this.program,'u_'+k);
   gl.uniform1i(this.uniform.idle,0);gl.uniform1i(this.uniform.happy,1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
   canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();this.active=false;canvas.hidden=true;fallback.hidden=false;});
  }catch(e){console.warn(e);this.gl=null;canvas.hidden=true;fallback.hidden=false;}
 }
 async load(name){
  if(this.textures.has(name))return this.textures.get(name);
  if(this.images.has(name))return this.images.get(name);
  const promise=(async()=>{
   const im=new Image();im.src='assets/'+name+'.webp';await im.decode();
   if(!this.gl)return null;
   const buffer=document.createElement('canvas');buffer.width=512;buffer.height=768;const ctx=buffer.getContext('2d');
   const scale=Math.min(480/im.width,740/im.height);ctx.drawImage(im,(512-im.width*scale)/2,755-im.height*scale,im.width*scale,im.height*scale);
   const gl=this.gl,texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,buffer);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);this.textures.set(name,texture);return texture;
  })();this.images.set(name,promise);return promise;
 }
 async setSkin(skin){
  this.skin=skin;const idle=skin==='original'?'char-neutral':'outfit-'+skin;const happy=skin==='original'?'char-laugh':'laugh-'+skin;
  this.fallback.src='assets/'+(this.target?happy:idle)+'.webp';
  const textures=await Promise.all([this.load(idle),this.load(happy)]);
  if(this.skin!==skin)return;
  [this.idle,this.happy]=textures;
 }
 laugh(on){this.target=on?1:0;this.fallback.src='assets/'+(on?(this.skin==='original'?'char-laugh':'laugh-'+this.skin):(this.skin==='original'?'char-neutral':'outfit-'+this.skin))+'.webp';}
 frame(t,energy=0){
  if(!this.gl||!this.active||!this.idle||!this.happy)return;
  const dt=Math.min((t-(this.last||t))/1000,.06);this.last=t;
  this.mix+=(this.target-this.mix)*(1-Math.exp(-dt*12));this.energy+=(energy-this.energy)*(1-Math.exp(-dt*18));
  const gl=this.gl,dpr=Math.min(window.devicePixelRatio||1,1.5),w=Math.round(this.canvas.clientWidth*dpr),h=Math.round(this.canvas.clientHeight*dpr);
  if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;gl.viewport(0,0,w,h);}
  gl.useProgram(this.program);gl.clear(gl.COLOR_BUFFER_BIT);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,this.idle);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,this.happy);
  gl.uniform1f(this.uniform.time,t/1000);gl.uniform1f(this.uniform.laugh,this.mix);gl.uniform1f(this.uniform.mix,this.mix);gl.uniform1f(this.uniform.energy,this.energy);gl.uniform1f(this.uniform.reduced,this.reduced?1:0);gl.drawArrays(gl.TRIANGLES,0,this.count);
 }
}
export class Sound{
 constructor(){this.ctx=null;this.buffer=null;this.envelope=[];this.source=null;this.startTime=0;this.playing=false;this.enabled=true;this.loading=null;}
 async unlock(){
  if(!this.ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;this.ctx=new AC();}
  if(this.ctx.state==='suspended')await this.ctx.resume();
  if(!this.loading)this.loading=fetch('assets/laugh.m4a').then(r=>{if(!r.ok)throw Error('Laugh audio unavailable');return r.arrayBuffer();}).then(b=>this.ctx.decodeAudioData(b)).then(b=>{
   this.buffer=b;const data=b.getChannelData(0),hop=Math.round(b.sampleRate*.025);
   for(let i=0;i<data.length;i+=hop){let sum=0;for(let j=i;j<Math.min(i+hop,data.length);j++)sum+=data[j]*data[j];this.envelope.push(Math.sqrt(sum/hop));}
   const peak=Math.max(.03,...this.envelope);this.envelope=this.envelope.map(x=>Math.min(1,x/peak));return b;
  }).catch(e=>{console.warn('Laugh sound failed to load',e);this.loading=null;});
  return this.loading;
 }
 tone(kind='tap'){
  if(!this.enabled||!this.ctx||this.ctx.state!=='running')return;
  const o=this.ctx.createOscillator(),g=this.ctx.createGain(),now=this.ctx.currentTime;
  o.type='sine';const freq=kind==='coin'?880:kind==='error'?220:kind==='ready'?660:470;
  o.frequency.setValueAtTime(freq,now);o.frequency.exponentialRampToValueAtTime(freq*(kind==='error'?.7:1.45),now+.09);g.gain.setValueAtTime(.0001,now);g.gain.exponentialRampToValueAtTime(.045,now+.012);g.gain.exponentialRampToValueAtTime(.0001,now+.15);o.connect(g);g.connect(this.ctx.destination);o.start(now);o.stop(now+.16);
 }
 laugh(duration){
  this.stop();this.startTime=this.ctx?.currentTime||0;this.playing=true;
  if(this.enabled&&this.buffer&&this.ctx){this.source=this.ctx.createBufferSource();this.source.buffer=this.buffer;const g=this.ctx.createGain();g.gain.value=.76;this.source.connect(g);g.connect(this.ctx.destination);const length=Math.min(duration,this.buffer.duration);g.gain.setValueAtTime(.76,this.ctx.currentTime);g.gain.setValueAtTime(.76,this.ctx.currentTime+Math.max(0,length-.18));g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+length);this.source.start(0,0,length);}
 }
 energy(elapsed){const t=this.ctx&&this.playing?this.ctx.currentTime-this.startTime:elapsed;return this.envelope[Math.floor(t/.025)]??(.4+.3*Math.sin(t*11));}
 stop(){if(this.source){try{this.source.stop();}catch{}this.source=null;}this.playing=false;}
}

