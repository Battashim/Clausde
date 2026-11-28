/* ---------- Body shape in the 4 moments ---------- */
(function(){
const NS='http://www.w3.org/2000/svg';
const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
function el(tag,a,p){const e=document.createElementNS(NS,tag);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
const R=d=>d*Math.PI/180, lerp=(a,b,t)=>a+(b-a)*t, ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* Side-view poses. Angles in degrees: 0 = straight down, + = towards the front (right).
   lean: torso forward lean. head: + looks down, - looks up. turn: 1 = looking back over the shoulder.
   aF/aB: near/far arm [shoulder, elbow]. lF/lB: near/far leg [hip, knee bend]. */
const POSE={
 stand:{lean:4,head:8,turn:0,aF:[12,20],aB:[-12,20],lF:[6,6],lB:[-6,6]},
 scan:{lean:6,head:-4,turn:1,aF:[20,35],aB:[-24,30],lF:[16,24],lB:[-14,20]},
 recv:{lean:9,head:30,turn:0,aF:[40,30],aB:[-42,25],lF:[26,16],lB:[-22,14]},
 drive:{lean:16,head:-6,turn:0,aF:[-45,85],aB:[50,95],lF:[42,75],lB:[-32,45]},
 pass:{lean:6,head:22,turn:0,aF:[-34,25],aB:[38,25],lF:[48,12],lB:[-6,12]},
 react:{lean:32,head:4,turn:0,aF:[-55,95],aB:[65,95],lF:[56,88],lB:[-38,30]},
 press:{lean:22,head:14,turn:0,aF:[45,70],aB:[-50,80],lF:[32,62],lB:[-36,55]},
 jockey:{lean:16,head:24,turn:0,aF:[42,25],aB:[-30,35],lF:[28,60],lB:[-26,52]},
 tackle:{lean:22,head:32,turn:0,aF:[20,30],aB:[-52,30],lF:[52,18],lB:[-30,62]},
 lookup:{lean:4,head:-14,turn:0,aF:[22,30],aB:[-22,30],lF:[14,20],lB:[-12,16]},
 gkSet:{lean:20,head:18,turn:0,aF:[38,62],aB:[30,62],lF:[20,44],lB:[-20,44]},
 gkOpen:{lean:8,head:20,turn:0,aF:[32,40],aB:[-32,40],lF:[22,22],lB:[-20,20]},
 gkSweep:{lean:28,head:2,turn:0,aF:[-50,90],aB:[60,90],lF:[50,82],lB:[-36,36]},
 gkThrow:{lean:-4,head:-10,turn:0,aF:[62,10],aB:[-150,20],lF:[30,10],lB:[-26,16]}
};
/* Top view: p = player [x,y,facing°,look°], o = opponent(s), m = team-mate(s), b = ball, a = arrows, n = note.
   Facing 0 = towards the right (we attack right), 90 = down. */
const M=[
 {id:'with',name:'1 · We have the ball',
  wrong:'Common mistake: standing square-on and watching only the ball. The first touch goes back towards your own goal, or straight into the defender.',
  out:[
   {pose:'scan',ball:[-60,0],cap:'Before the ball arrives, check your shoulder. Know where the pressure is.',lab:[['head','Head turns:|check behind','r',58],['kneeF','Knees soft,|on your toes','l',214]],
    top:{p:[150,110,180,-35],o:[[218,80,180]],m:[[40,110,0]],b:[50,112],a:[['pass',50,112,128,114]],n:'SCAN FIRST'}},
   {pose:'recv',ball:[-14,0],cap:'Open your body: stand side-on, half-turned. Receive with the back foot.',lab:[['handF','Arms out for|balance','r',118],['footB','Back foot|receives','l',262]],
    top:{p:[150,110,-95,180],o:[[212,86,180]],m:[[40,110,0]],b:[136,118],a:[],n:'SIDE-ON ✓'}},
   {pose:'drive',ball:[46,0],cap:'First touch away from pressure, into space. Head up: what is next?',lab:[['head','Head up','r',52],['footF','Touch into|space','r',262]],
    top:{p:[196,142,18,0],o:[[204,98,140]],m:[[40,110,0]],b:[212,147],a:[['run',150,112,192,140]],n:'TURN & GO'}}
  ],
  gk:[
   {pose:'gkOpen',ball:[-70,0],cap:'Back-pass coming: open your body to the side and check where the striker is.',lab:[['head','Check the|striker','r',58],['footF','On your toes','l',262]],
    top:{p:[40,110,-60,0],o:[[150,105,180]],m:[[120,160,200],[95,32,180]],b:[118,156],a:[['pass',118,156,46,116]],n:'OPEN ANGLE'}},
   {pose:'recv',ball:[-12,0],cap:'First touch away from the striker, onto the open side.',lab:[['footB','Touch away|from pressure','l',262]],
    top:{p:[40,92,-80,-40],o:[[95,108,200]],m:[[120,160,200],[95,32,180]],b:[44,82],a:[['run',40,110,40,94]],n:'AWAY FROM PRESS'}},
   {pose:'pass',ball:[60,0],cap:'Pass to the side the striker can\'t block.',lab:[['footF','Pass with|either foot','r',262]],
    top:{p:[40,92,-60,-60],o:[[85,104,200]],m:[[120,160,200],[95,32,180]],b:[92,38],a:[['pass',44,84,92,38]],n:'PLAY OUT'}}
  ]},
 {id:'lost',name:'2 · We just lost it',
  wrong:'Common mistake: stopping, arms up, complaining. Those 2 seconds are exactly when the opponent escapes.',
  out:[
   {pose:'react',ball:[90,0],cap:'Ball lost! React in the first second. No stopping, no complaining.',lab:[['chest','Lean|forward','r',96],['footB','Explosive|first steps','l',262]],
    top:{p:[112,110,0,0],o:[[166,104,180],[232,64,180]],m:[],b:[156,107],a:[],n:'1 SECOND'}},
   {pose:'press',ball:[70,0],cap:'Sprint at the ball in a curve, so your body blocks the pass behind you.',lab:[['head','Eyes on|the ball','r',58],['handF','Arms drive','l',122]],
    top:{p:[146,92,15,10],o:[[170,106,200],[232,64,180]],m:[],b:[160,108],a:[['run',112,110,144,92]],shadow:[232,64],n:'PRESS + SHADOW'}},
   {pose:'jockey',ball:[36,0],cap:'Arrive under control: brake, get low, don\'t dive in. You have 5 seconds to win it.',lab:[['kneeF','Brake: low|and side-on','l',214]],
    top:{p:[156,98,30,30],o:[[174,110,200],[232,64,180]],m:[],b:[166,112],a:[],n:'5 SECONDS'}}
  ],
  gk:[
   {pose:'gkSweep',ball:[160,0],cap:'We lost the ball: step up to the edge of your box, ready to sweep.',lab:[['chest','Move up|with the line','r',96]],
    top:{p:[72,110,0,0],o:[[200,100,180]],m:[[120,70,0],[120,150,0]],b:[192,102],a:[['run',22,110,70,110]],n:'STEP UP'}},
   {pose:'gkSet',ball:[120,0],cap:'Through ball? Read it early and attack the space. If not, get set before the shot.',lab:[['handF','Hands|ready','r',122],['kneeF','Knees bent','l',214]],
    top:{p:[84,108,0,0],o:[[150,104,180]],m:[[120,70,0],[120,150,0]],b:[128,106],a:[['pass',192,102,130,106]],n:'READ IT'}}
  ]},
 {id:'out',name:'3 · They have the ball',
  wrong:'Common mistake: standing square and diving in. One touch past you and you\'re out of the game.',
  out:[
   {pose:'press',ball:[110,0],cap:'Get goal-side: stand between the ball and your own goal.',lab:[['head','Eyes on ball|and player','r',58]],
    top:{p:[96,110,0,0],o:[[174,110,180]],m:[],b:[164,112],a:[['run',60,110,94,110]],goal:1,n:'GOAL-SIDE'}},
   {pose:'jockey',ball:[44,0],cap:'Side-on, low, knees bent, an arm\'s length away. Show him to the side line.',lab:[['kneeF','Knees bent','l',214],['handF','Arm out','r',122],['footF','Weight on|front of feet','r',262]],
    top:{p:[140,114,-30,0],o:[[172,110,180]],m:[],b:[162,112],a:[['run',172,104,190,40]],goal:1,n:'SHOW OUTSIDE'}},
   {pose:'tackle',ball:[30,0],cap:'Wait for the heavy touch. Then step in with the front foot and win it.',lab:[['footF','Front foot|steps in','r',262]],
    top:{p:[160,92,-50,-50],o:[[176,78,250]],m:[],b:[170,74],a:[],goal:1,n:'WIN IT'}}
  ],
  gk:[
   {pose:'gkSet',ball:[150,0],cap:'Set position: on the line between the ball and the middle of your goal.',lab:[['handF','Hands at|waist height','r',122],['footF','Feet shoulder-|width apart','r',262]],
    top:{p:[30,104,-12,-12],o:[[176,72,180]],m:[],b:[166,74],a:[['line',166,74,6,110]],goal:1,n:'BALL–GOAL LINE'}},
   {pose:'gkSet',ball:[60,0],cap:'Shot coming: weight forward, on your toes, a small set step as the striker shoots.',lab:[['kneeF','Weight|forward','l',214],['head','Eyes on|the ball','r',58]],
    top:{p:[38,100,-18,-18],o:[[120,76,180]],m:[],b:[110,78],a:[['line',110,78,6,110]],goal:1,n:'SET STEP'}}
  ]},
 {id:'won',name:'4 · We just won it',
  wrong:'Common mistake: winning the ball and looking down. The chance to attack an unorganised team is gone in about 3 seconds.',
  out:[
   {pose:'lookup',ball:[18,0],cap:'Ball won! Head up straight away: can we play forward before they are organised?',lab:[['head','Look forward|first','r',52]],
    top:{p:[110,120,0,0],o:[[150,152,200],[128,64,160]],m:[[206,64,0]],b:[124,123],a:[],long:1,n:'LOOK FORWARD'}},
   {pose:'drive',ball:[46,0],cap:'First touch forward, into space. Run with the ball if nobody stops you.',lab:[['footF','Touch|forward','r',262],['head','Head up','r',52]],
    top:{p:[160,116,-4,-10],o:[[150,150,200],[136,72,160]],m:[[226,56,0]],b:[176,114],a:[['run',206,64,226,56]],n:'GO!'}},
   {pose:'pass',ball:[120,0],cap:'Find the runner before the defence recovers. Can\'t go forward? Keep it and rebuild.',lab:[['footF','Pass into|the run','r',262]],
    top:{p:[166,114,-30,-40],o:[[154,148,200],[146,78,160]],m:[[240,48,0]],b:[238,54],a:[['pass',176,112,236,54]],n:'FORWARD PASS'}}
  ],
  gk:[
   {pose:'lookup',ball:[10,-120],cap:'Ball caught: look up fast. Is a quick throw or pass on?',lab:[['head','Look up|first','r',52]],
    top:{p:[30,104,0,0],o:[[130,90,180],[120,130,180]],m:[[150,30,0]],b:[38,104],a:[],long:1,n:'LOOK UP'}},
   {pose:'gkThrow',ball:[-30,-150],cap:'Throw or pass to the free wide player before they reorganise.',lab:[['handB','Arm back,|then throw','l',70]],
    top:{p:[34,100,-20,-30],o:[[130,90,180],[120,130,180]],m:[[160,26,0]],b:[156,30],a:[['pass',40,100,156,30]],n:'QUICK START'}}
  ]}
];
const CUES={
 with:{def:['Centre-backs: split wide and receive on the outside foot','Check the striker before every pass comes in','Under pressure, use the keeper. Never turn into pressure'],
       mid:['Scan twice before the ball arrives','Stand half-turned between their lines, not in front of them','Receive on the back foot so you can play forward in 2 touches'],
       att:['Start on the defender\'s blind side, then show','Wingers: stay wide with the body open to the inside','Attack the space behind when the passer looks up'],
       gk:['Be available: open an angle to the centre-backs','Feet ready, never flat','Know your next pass before the ball arrives']},
 lost:{def:['Step up to squeeze the space, or drop if the ball carrier is free','Talk: "Squeeze!" or "Drop!"','Never let a runner get behind you unseen'],
       mid:['Nearest player presses the ball at once','The others close the closest passing lanes','Use your back to block the pass behind you (cover shadow)'],
       att:['You lost it, so you are the first presser','Curve your run to block the pass back','5 seconds of fire, then recover'],
       gk:['Step up to the edge of the box','Talk: organise the back line','Be ready to sweep a ball over the top']},
 out:{def:['Goal-side and side-on','Show the attacker outside, never inside','Tackle on the heavy touch and stay on your feet'],
      mid:['Screen the pass into their striker','Stay compact: 10–15 m from the next team-mate','Angle your body to push the ball away from the middle'],
      att:['Press the centre-back in a curve to close one side','Wait for the trigger: back-pass, bad touch, sideways pass','Never press alone. Jump together'],
      gk:['Set position on the ball–goal line','Hands at waist height, palms forward','Small set step just before the shot']},
 won:{def:['Look forward first: can a pass break a line?','If not, keep it simple and build again','Support the new ball carrier at an angle'],
      mid:['Turn and face forward fast','First touch forward into space','Find the runner before the defence recovers'],
      att:['Sprint into the space behind straight away','Make the pitch big: one runs in behind, one comes short','Arrive in the box with speed'],
      gk:['Look up before you celebrate the save','Quick throw to a free wide player','Slow it down if nobody is free']}
};
const POS=[['def','Defender'],['mid','Midfielder'],['att','Attacker'],['gk','Goalkeeper']];

const root=document.getElementById('bodyshape'); if(!root) return;
const side=document.getElementById('bsSide'), top=document.getElementById('bsTop');
const capEl=document.getElementById('bsCap'), cuesEl=document.getElementById('bsCues'), wrongEl=document.getElementById('bsWrong');
const dotsEl=document.getElementById('bsDots'), playBtn=document.getElementById('bsPlay');
const S={m:0,pos:'mid',i:0,t:0,playing:!reduce,visible:false,last:0};
const frames=()=>S.pos==='gk'?M[S.m].gk:M[S.m].out;

/* side view: skeleton */
const L={T:58,N:7,H:13,UA:30,FA:27,TH:46,SH:44,F:15};
function skel(p){
  const d=(a,len,o)=>[o[0]+Math.sin(R(a))*len,o[1]+Math.cos(R(a))*len];
  const hip=[0,0], sh=[Math.sin(R(p.lean))*L.T,-Math.cos(R(p.lean))*L.T];
  const neck=[sh[0]+Math.sin(R(p.lean))*L.N,sh[1]-Math.cos(R(p.lean))*L.N];
  const head=[neck[0]+Math.sin(R(p.lean))*L.H*.9,neck[1]-Math.cos(R(p.lean))*L.H*.9];
  const arm=a=>{const e=d(a[0],L.UA,sh);const h=d(a[0]+a[1],L.FA,e);return[e,h]};
  const leg=l=>{const k=d(l[0],L.TH,hip);const an=d(l[0]-l[1],L.SH,k);const ft=[an[0]+L.F*Math.cos(R((l[0]-l[1])*.35)),an[1]+2];return[k,an,ft]};
  return {hip,sh,neck,head,aF:arm(p.aF),aB:arm(p.aB),lF:leg(p.lF),lB:leg(p.lB)};
}
function mix(a,b,t){const o={};for(const k in a)o[k]=Array.isArray(a[k])?[lerp(a[k][0],b[k][0],t),lerp(a[k][1],b[k][1],t)]:lerp(a[k],b[k],t);return o;}
const GROUND=282;
function drawSide(p,ball,labs,gk){
  side.innerHTML='';
  const k=skel(p);
  const ys=[k.lF[1][1],k.lF[2][1],k.lB[1][1],k.lB[2][1]];
  const ox=152-k.sh[0]*.35, oy=GROUND-Math.max(...ys)-5;
  const P=q=>[q[0]+ox,q[1]+oy];
  el('rect',{x:0,y:GROUND,width:320,height:18,fill:'var(--pitch)'},side);
  el('ellipse',{cx:ox+10,cy:GROUND+1,rx:56,ry:5,fill:'rgba(0,0,0,.18)'},side);
  const kit=gk?{shirt:'#E2A92B',dark:'#A87A14',shorts:'#22302A',shortsD:'#111813',sock:'#E2A92B',sockD:'#A87A14'}:{shirt:'#C8102E',dark:'#7E0A1E',shorts:'#FFFFFF',shortsD:'#C3CAC5',sock:'#C8102E',sockD:'#7E0A1E'};
  const skin='#B9805A', skinD='#8F5F40', boot='#111';
  const seg=(a,b,w,c)=>{const A=P(a),B=P(b);el('line',{x1:A[0].toFixed(1),y1:A[1].toFixed(1),x2:B[0].toFixed(1),y2:B[1].toFixed(1),stroke:c,'stroke-width':w,'stroke-linecap':'round'},side)};
  const part=(a,b,f)=>[lerp(a[0],b[0],f),lerp(a[1],b[1],f)];
  const drawLeg=(l,far)=>{const[kn,an,ft]=l;seg(part(k.hip,kn,.55),kn,13,far?skinD:skin);seg(kn,an,12,far?kit.sockD:kit.sock);seg(k.hip,part(k.hip,kn,.6),17,far?kit.shortsD:kit.shorts);seg(an,ft,9,boot)};
  const drawArm=(a,far)=>{const[e,h]=a;seg(k.sh,part(k.sh,e,.5),12,far?kit.dark:kit.shirt);seg(part(k.sh,e,.45),e,10,far?skinD:skin);seg(e,h,9,far?skinD:skin);const H=P(h);el('circle',{cx:H[0],cy:H[1],r:gk?7:5,fill:gk?'#F4F4F4':(far?skinD:skin)},side)};
  // ball (side)
  if(ball){const bx=ox+ball[0], by=ball[1]?GROUND-6+ball[1]:GROUND-6; el('circle',{cx:bx,cy:by,r:6,fill:'#fff',stroke:'#111','stroke-width':1.4},side);}
  drawLeg(k.lB,1); drawArm(k.aB,1);
  seg(k.hip,k.sh,26,kit.shirt);
  seg(k.hip,part(k.hip,k.sh,.12),24,kit.shorts);
  drawLeg(k.lF,0);
  // head + view cone
  const Hc=P(k.head), back=p.turn>.5;
  const look=back?180+p.head:p.head; // degrees from horizontal-right, + down
  const eye=[Hc[0]+Math.cos(R(look))*6*(back?1:1),Hc[1]+Math.sin(R(look))*5];
  const cone=(len,w)=>{const a1=R(look-w),a2=R(look+w);return `M${eye[0]} ${eye[1]} L${eye[0]+Math.cos(a1)*len} ${eye[1]+Math.sin(a1)*len} L${eye[0]+Math.cos(a2)*len} ${eye[1]+Math.sin(a2)*len} Z`};
  el('path',{d:cone(120,16),fill:'rgba(226,169,43,.22)',stroke:'rgba(226,169,43,.6)','stroke-width':1},side);
  seg(k.sh,k.neck,10,skin);
  el('circle',{cx:Hc[0],cy:Hc[1],r:L.H,fill:skin},side);
  el('path',{d:`M${Hc[0]-L.H} ${Hc[1]-2} A${L.H} ${L.H} 0 0 1 ${Hc[0]+L.H} ${Hc[1]-2} Z`,fill:'#1d1611',transform:`rotate(${(back?-1:1)*p.lean*.6} ${Hc[0]} ${Hc[1]})`},side);
  el('circle',{cx:eye[0],cy:eye[1],r:2,fill:'#111'},side);
  drawArm(k.aF,0);
  // labels
  const anchor={head:Hc,chest:P(part(k.hip,k.sh,.6)),handF:P(k.aF[1]),handB:P(k.aB[1]),kneeF:P(k.lF[0]),footF:P(k.lF[2]),footB:P(k.lB[2])};
  (labs||[]).forEach(([a,txt,s,y])=>{
    const A=anchor[a]; if(!A) return; const x=s==='l'?8:312;
    const lines=txt.split('|'); const ly=Math.max(14,Math.min(GROUND-10,y));
    el('line',{x1:A[0],y1:A[1],x2:s==='l'?x+62:x-62,y2:ly+4,stroke:'var(--muted)','stroke-width':1,'stroke-dasharray':'3 3'},side);
    el('circle',{cx:A[0],cy:A[1],r:3.5,fill:'var(--gold)',stroke:'var(--ink)','stroke-width':1},side);
    const t=el('text',{x,y:ly-(lines.length-1)*7,'text-anchor':s==='l'?'start':'end','font-size':12,'font-weight':700,fill:'var(--ink)','font-family':'Atkinson Hyperlegible, system-ui, sans-serif'},side);
    lines.forEach((ln,i)=>{const sp=el('tspan',{x,dy:i?14:0},t);sp.textContent=ln});
  });
}

/* top view */
function person(g,x,y,face,look,col,ink,labelTxt,longCone){
  const f=R(face), sx=-Math.sin(f), sy=Math.cos(f), fx=Math.cos(f), fy=Math.sin(f);
  if(look!=null){const l=R(look),len=longCone?150:62,w=R(longCone?14:22);
    el('path',{d:`M${x} ${y} L${x+Math.cos(l-w)*len} ${y+Math.sin(l-w)*len} L${x+Math.cos(l+w)*len} ${y+Math.sin(l+w)*len} Z`,fill:'rgba(255,214,90,.22)',stroke:'rgba(255,214,90,.55)','stroke-width':.8},g);}
  // feet (staggered: one forward)
  [[1,-1],[-1,1]].forEach(([s,fw])=>el('ellipse',{cx:x+sx*5*s+fx*fw*3,cy:y+sy*5*s+fy*fw*3,rx:5,ry:2.6,fill:'#111',transform:`rotate(${face} ${x+sx*5*s+fx*fw*3} ${y+sy*5*s+fy*fw*3})`},g));
  // arms
  [1,-1].forEach(s=>el('ellipse',{cx:x+sx*12*s+fx*2,cy:y+sy*12*s+fy*2,rx:5,ry:3.2,fill:col,stroke:ink,'stroke-width':.8,transform:`rotate(${face} ${x+sx*12*s+fx*2} ${y+sy*12*s+fy*2})`},g));
  // shoulders
  el('ellipse',{cx:x,cy:y,rx:6.5,ry:12,fill:col,stroke:ink,'stroke-width':1,transform:`rotate(${face} ${x} ${y})`},g);
  // head + nose
  const hl=R(look!=null?look:face);
  el('circle',{cx:x,cy:y,r:5.4,fill:'#2a1d14'},g);
  el('path',{d:`M${x+Math.cos(hl)*8} ${y+Math.sin(hl)*8} L${x+Math.cos(hl+.5)*4.5} ${y+Math.sin(hl+.5)*4.5} L${x+Math.cos(hl-.5)*4.5} ${y+Math.sin(hl-.5)*4.5} Z`,fill:'#B9805A'},g);
  if(labelTxt){const t=el('text',{x,y:y-17,'text-anchor':'middle','font-size':9,'font-weight':700,fill:'#fff','font-family':'JetBrains Mono, monospace'},g);t.textContent=labelTxt;}
}
function drawTop(A,B,t,gk){
  top.innerHTML='';
  el('rect',{x:0,y:0,width:300,height:220,fill:'var(--pitch)'},top);
  for(let i=0;i<6;i+=2) el('rect',{x:i*50,y:0,width:50,height:220,fill:'rgba(255,255,255,.04)'},top);
  const L1={stroke:'rgba(255,255,255,.75)','stroke-width':1.5,fill:'none'};
  if(gk||B.goal){el('rect',{x:-2,y:50,width:62,height:120,...L1},top);el('rect',{x:-2,y:85,width:20,height:50,...L1},top);el('rect',{x:-6,y:95,width:8,height:30,fill:'rgba(255,255,255,.3)',stroke:'#fff'},top);}
  const lab=(x,y,s,anc)=>{const tx=el('text',{x,y,'text-anchor':anc||'start','font-size':10,fill:'rgba(255,255,255,.8)','font-family':'JetBrains Mono, monospace'},top);tx.textContent=s};
  lab(296,214,'WE ATTACK →','end'); if(gk||B.goal) lab(6,214,'OUR GOAL');
  const v=(a,b)=>lerp(a,b,t);
  const arrs=t<.5?A.a:B.a;
  (arrs||[]).forEach(([ty,x1,y1,x2,y2])=>{
    const c=ty==='pass'?'#fff':ty==='line'?'rgba(255,214,90,.8)':'#fff';
    el('path',{d:`M${x1} ${y1} L${x2} ${y2}`,stroke:c,'stroke-width':ty==='pass'?2:1.6,'stroke-dasharray':ty==='pass'?'':'5 4',fill:'none','marker-end':ty==='line'?'':'url(#bsArrow)'},top);
  });
  const d=el('defs',{},top),mk=el('marker',{id:'bsArrow',viewBox:'0 0 10 10',refX:8,refY:5,markerWidth:5,markerHeight:5,orient:'auto-start-reverse'},d);el('path',{d:'M0 0 L10 5 L0 10 z',fill:'#fff'},mk);
  const sh=t<.5?A.shadow:B.shadow;
  const pp=[v(A.p[0],B.p[0]),v(A.p[1],B.p[1]),v(A.p[2],B.p[2]),v(A.p[3],B.p[3])];
  if(sh){const ang=Math.atan2(sh[1]-pp[1],sh[0]-pp[0]);const w=.33,len=Math.hypot(sh[0]-pp[0],sh[1]-pp[1])+20;
    el('path',{d:`M${pp[0]} ${pp[1]} L${pp[0]+Math.cos(ang-w)*len} ${pp[1]+Math.sin(ang-w)*len} L${pp[0]+Math.cos(ang+w)*len} ${pp[1]+Math.sin(ang+w)*len} Z`,fill:'rgba(0,0,0,.22)'},top);
    lab(sh[0]-10,sh[1]+24,'BLOCKED','middle');}
  const opp=(arrA,arrB)=>(arrB||[]).map((q,i)=>{const a=(arrA||[])[i]||q;return [v(a[0],q[0]),v(a[1],q[1]),v(a[2],q[2])]});
  opp(A.m,B.m).forEach(q=>person(top,q[0],q[1],q[2],null,'var(--red)','#fff'));
  opp(A.o,B.o).forEach(q=>person(top,q[0],q[1],q[2],null,'var(--them)','var(--them-ink)'));
  const bx=v(A.b[0],B.b[0]), by=v(A.b[1],B.b[1]);
  el('circle',{cx:bx,cy:by,r:4,fill:'#fff',stroke:'#111','stroke-width':1.2},top);
  person(top,pp[0],pp[1],pp[2],pp[3],gk?'#E2A92B':'var(--red)','#fff','YOU',(t<.5?A.long:B.long));
  const n=(t<.5?A:B).n; if(n){el('rect',{x:6,y:6,width:n.length*7.4+14,height:22,rx:11,fill:'rgba(0,0,0,.45)'},top);const tx=el('text',{x:13,y:21,'font-size':11,'font-weight':700,fill:'#FFD65A','font-family':'JetBrains Mono, monospace'},top);tx.textContent=n;}
}

/* tabs, state and loop */
const mBox=document.getElementById('bsMoments'), pBox=document.getElementById('bsPos');
M.forEach((m,k)=>{const b=document.createElement('button');b.type='button';b.className='tab';b.role='tab';b.textContent=m.name;b.onclick=()=>{S.m=k;S.i=0;S.t=0;S.playing=!reduce;build()};mBox.appendChild(b)});
POS.forEach(([k,n])=>{const b=document.createElement('button');b.type='button';b.className='tab';b.textContent=n;b.dataset.k=k;b.onclick=()=>{S.pos=k;S.i=0;S.t=0;build()};pBox.appendChild(b)});
const MOVE=700, HOLD=2600;
function build(){
  [...mBox.children].forEach((b,k)=>b.setAttribute('aria-selected',k===S.m));
  [...pBox.children].forEach(b=>b.setAttribute('aria-selected',b.dataset.k===S.pos));
  cuesEl.innerHTML=''; CUES[M[S.m].id][S.pos].forEach(c=>{const li=document.createElement('li');li.textContent=c;cuesEl.appendChild(li)});
  wrongEl.textContent=M[S.m].wrong;
  dotsEl.innerHTML=''; frames().forEach((f,k)=>{const d=document.createElement('button');d.type='button';d.className='dot';d.setAttribute('aria-label','Step '+(k+1));d.onclick=()=>{S.playing=false;S.i=k;S.t=MOVE;sync()};dotsEl.appendChild(d)});
  sync();
}
function sync(){playBtn.textContent=S.playing?'❚❚ Pause':'▶ Play';render();}
function render(){
  const F=frames(), cur=F[S.i], prev=F[(S.i-1+F.length)%F.length];
  const t=reduce?1:ease(Math.min(1,S.t/MOVE));
  const gk=S.pos==='gk';
  drawSide(mix(POSE[prev.pose],POSE[cur.pose],t),[lerp(prev.ball[0],cur.ball[0],t),lerp(prev.ball[1],cur.ball[1],t)],t>.6?cur.lab:[],gk);
  drawTop(prev.top,cur.top,t,gk);
  capEl.innerHTML=`<span class="step">Step ${S.i+1} of ${F.length}</span>`; const sp=document.createElement('span');sp.textContent=cur.cap;capEl.appendChild(sp);
  [...dotsEl.children].forEach((d,k)=>d.classList.toggle('on',k===S.i));
}
playBtn.onclick=()=>{S.playing=!S.playing;sync()};
document.getElementById('bsNext').onclick=()=>{S.playing=false;S.i=(S.i+1)%frames().length;S.t=0;sync()};
document.getElementById('bsBack').onclick=()=>{S.playing=false;S.i=(S.i-1+frames().length)%frames().length;S.t=MOVE;sync()};
function tick(now){const dt=Math.min(64,now-(S.last||now));S.last=now;
  if(S.visible&&root.offsetParent){ if(S.t<MOVE){S.t+=dt;render();} else if(S.playing){S.t+=dt;if(S.t>MOVE+HOLD){S.i=(S.i+1)%frames().length;S.t=0;render();}} }
  requestAnimationFrame(tick);}
if('IntersectionObserver' in window) new IntersectionObserver(es=>es.forEach(e=>S.visible=e.isIntersecting),{threshold:.2}).observe(root); else S.visible=true;
build(); requestAnimationFrame(tick);
})();
