/* ---------- Foundations: constraint lab, scanning trainer, field test ---------- */
(function(){
const $=id=>document.getElementById(id);
if(!$('foundations')) return;
const NS='http://www.w3.org/2000/svg';
function el(t,a,p){const e=document.createElementNS(NS,t);for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;}
const store={get(k,d){try{const v=localStorage.getItem('fnd:'+k);return v?JSON.parse(v):d}catch(e){return d}},set(k,v){try{localStorage.setItem('fnd:'+k,JSON.stringify(v))}catch(e){}}};
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;

/* 1 · Constraint lab. Every entry: change, what you should see, instead of saying, ask. */
const LEVERS=[['S','Space'],['T','Task (rules)'],['E','Equipment'],['P','People']];
const LAB=[
 {p:'They never switch the play',drill:'funino',
  S:['Make the pitch 10 m wider, same length.','Players start using the far side because it is now too far to defend.','"Switch it!"','"Which side had more space?"'],
  T:['A goal only counts if the ball has been on both halves of the pitch (left and right) in that attack.','Players look for the far side before shooting.','"Use the whole pitch."','"How did you make the defenders move?"'],
  E:['Play with two goals on each end line (Funino).','When one goal is blocked, players attack the other one.','"Go the other way."','"Which goal was open, and why?"'],
  P:['Add a neutral player on each side line who always plays for the team with the ball.','Players find the wide free player to change the point of attack.','"Pass wide!"','"Who was free?"']},
 {p:'They don\'t look before receiving (no scanning)',drill:'rondo',
  S:['Make the area smaller, so pressure arrives faster.','Players who don\'t scan lose the ball, so they start checking.','"Look around!"','"Where was the defender before you got it?"'],
  T:['Before each reception the coach shows a colour card. The receiver must call it out: correct call = 1 point.','Heads turn before the ball arrives.','"Check your shoulder."','"What did you see behind you?"'],
  E:['Put coloured gates behind the receiver. The coach calls a colour as the pass is made; the receiver must turn out through that gate.','Players look behind before the ball arrives so they can turn the right way.','"Turn!"','"Which way was free?"'],
  P:['A defender enters from behind the receiver on the coach\'s signal.','Receivers learn the pressure can come from anywhere, so they scan.','"Man on!"','"How did you know he was coming?"']},
 {p:'They always play backwards or sideways',drill:'pocket',
  S:['Make the pitch longer and narrower.','More forward options appear; players look for them.','"Play forward!"','"Was there a forward pass on?"'],
  T:['A pass that breaks a line of defenders = 2 points. Max 2 backward passes in a row.','Players search for passes between and past defenders.','"Be brave."','"Which pass beat the most defenders?"'],
  E:['Put two target gates between the opponent\'s lines.','Players learn where the "pockets" are.','"Find the gap."','"Where could a team-mate receive between their lines?"'],
  P:['Add a target player in the end zone who is always free.','Players look up and forward first.','"Look up!"','"Who could you see when you received?"']},
 {p:'Slow reaction after losing the ball',drill:'hunt',
  S:['Make the pitch smaller, so the ball is always close.','The nearest players can reach the ball in 1–2 seconds.','"React!"','"How many seconds did it take to win it back?"'],
  T:['Win the ball back within 5 seconds = 2 points. The coach counts out loud.','Players attack the ball immediately after losing it.','"Press!"','"Who pressed first, and who closed the passing lanes?"'],
  E:['Mini-goals on the sides: after winning the ball, the team that won it can score in them immediately.','Both teams learn the danger right after a turnover.','"Don\'t switch off."','"When is the opponent most disorganised?"'],
  P:['The team that just lost the ball gets a joker for 5 seconds.','Losing the ball becomes a chance, not a disaster.','"Get it back!"','"What did the joker help you do?"']},
 {p:'Afraid to take players on 1 v 1',drill:'gate',
  S:['More space per player: wide channels with one defender each.','There is room to try a move and accelerate away.','"Dribble!"','"Where was the space behind the defender?"'],
  T:['Beating a player = 1 point, even if the attack fails after.','Players try moves without fear of losing the ball.','"Don\'t lose it."','"What made the defender move the wrong way?"'],
  E:['Replace goals with three dribble gates.','Players read which gate the defender leaves open.','"Go left."','"Which gate did the defender leave open?"'],
  P:['Play 2 v 1 and 1 v 1 in turn.','Players learn when to dribble and when to pass.','"Take him on!"','"When was it better to dribble than to pass?"']},
 {p:'One-footed players',drill:'mirror',
  S:['Put the goal or target on the player\'s weak-foot side.','The weak foot becomes the natural choice.','"Use your left!"','"Which foot made it easier?"'],
  T:['Goals and passes with the weak foot count double.','Players choose the weak foot more often.','"Weak foot only!"','"How did you set up your weaker foot?"'],
  E:['Gates placed only on the weak-foot side in ball-mastery games.','Thousands of weak-foot touches without a lecture.','"Stop using your right."','"Can you do the same move with both feet?"'],
  P:['A partner feeds the ball only to the weak foot.','Players get used to receiving on their weaker side.','"Control it with your left."','"Which first touch worked best?"']}
];
let clP=0,clL='T';
const probSel=$('clProb'),levBox=$('clLever'),out=$('clOut');
LAB.forEach((x,i)=>{const o=document.createElement('option');o.value=i;o.textContent=x.p;probSel.appendChild(o)});
LEVERS.forEach(([k,n])=>{const b=document.createElement('button');b.type='button';b.textContent=k+' · '+n;b.dataset.k=k;b.onclick=()=>{clL=k;renderLab()};levBox.appendChild(b)});
probSel.onchange=()=>{clP=+probSel.value;renderLab()};
function renderLab(){
  const x=LAB[clP],r=x[clL];
  [...levBox.children].forEach(b=>b.setAttribute('aria-pressed',b.dataset.k===clL));
  out.innerHTML='';
  const rows=[['Change this',r[0]],['What you should see',r[1]],['Instead of saying',r[2]],['Ask this question',r[3]]];
  rows.forEach(([h,t],i)=>{const d=document.createElement('div');d.className='cl-row'+(i===2?' no':i===3?' ask':'');const b=document.createElement('b');b.textContent=h;const p=document.createElement('span');p.textContent=t;d.appendChild(b);d.appendChild(p);out.appendChild(d)});
  const lk=document.createElement('a');lk.href='#drill-'+x.drill;lk.textContent='See a drill that uses this →';lk.className='xlink';out.appendChild(lk);
  const lb=document.createElement('p');lb.className='wc';lb.innerHTML='<span class="lbl our">Our design</span> Built on the research principles above. Test it with your team and keep what works.';out.appendChild(lb);
}
renderLab();

/* 3 · Scanning trainer (top view): head turns N times while the ball travels */
const svg=$('scSvg'); let scN=2, scT=0, scLast=0, ansShown=false;
const DUR=4200;
function newEx(){scN=1+Math.floor(Math.random()*4);scT=0;ansShown=false;$('scAns').textContent='Count the head turns. Then press "Show answer".';}
function drawSc(t){
  svg.innerHTML='';
  el('rect',{x:0,y:0,width:300,height:180,fill:'var(--pitch)'},svg);
  for(let i=0;i<6;i+=2)el('rect',{x:i*50,y:0,width:50,height:180,fill:'rgba(255,255,255,.05)'},svg);
  const p=Math.min(1,t/DUR);
  // passer, receiver, defender
  const P=[40,90],Y=[175,92],D=[232,60];
  const person=(x,y,face,col,ink,lab,look)=>{const f=face*Math.PI/180,sx=-Math.sin(f),sy=Math.cos(f);
    if(look!=null){const l=look*Math.PI/180,w=.38,len=70;el('path',{d:`M${x} ${y} L${x+Math.cos(l-w)*len} ${y+Math.sin(l-w)*len} L${x+Math.cos(l+w)*len} ${y+Math.sin(l+w)*len} Z`,fill:'rgba(255,214,90,.3)',stroke:'rgba(255,214,90,.7)'},svg);}
    [1,-1].forEach(s=>el('ellipse',{cx:x+sx*14*s,cy:y+sy*14*s,rx:6,ry:3.8,fill:col,stroke:ink,transform:`rotate(${face} ${x+sx*14*s} ${y+sy*14*s})`},svg));
    el('ellipse',{cx:x,cy:y,rx:8,ry:14.5,fill:col,stroke:ink,'stroke-width':1.2,transform:`rotate(${face} ${x} ${y})`},svg);
    const hl=(look!=null?look:face)*Math.PI/180;
    el('circle',{cx:x,cy:y,r:6.5,fill:'#2a1d14'},svg);
    el('path',{d:`M${x+Math.cos(hl)*9.5} ${y+Math.sin(hl)*9.5} L${x+Math.cos(hl+.5)*5.5} ${y+Math.sin(hl+.5)*5.5} L${x+Math.cos(hl-.5)*5.5} ${y+Math.sin(hl-.5)*5.5} Z`,fill:'#B9805A'},svg);
    const w=lab.length*6.2+10;el('rect',{x:x-w/2,y:y-34,width:w,height:14,rx:7,fill:'rgba(0,0,0,.55)'},svg);
    const tx=el('text',{x,y:y-24,'text-anchor':'middle','font-size':9,'font-weight':700,fill:'#fff','font-family':'JetBrains Mono, monospace'},svg);tx.textContent=lab;};
  person(P[0],P[1],0,'#C8102E','#fff','MATE');
  person(D[0],D[1],200,'#F4F1E8','#1C2A44','OPP');
  // receiver look: default towards ball (180); scans are short turns to ~-20° (behind) spread over the first 80% of the time
  let look=180;
  if(p<.85){const seg=.85/scN, k=Math.floor(p/seg), local=(p-k*seg)/seg; if(local>.35&&local<.75) look=-25+((k%2)?40:0);}
  person(Y[0],Y[1],180,'#C8102E','#fff','YOU',look);
  // ball: waits at passer for 1.6 s, then travels
  const bp=Math.max(0,(p-.55)/.45);
  const bx=P[0]+12+(Y[0]-12-(P[0]+12))*bp, by=P[1]+(Y[1]-P[1])*bp;
  el('circle',{cx:bx,cy:by,r:5,fill:'#fff',stroke:'#111','stroke-width':1.4},svg);
  const tx=el('text',{x:8,y:172,'font-size':10,fill:'rgba(255,255,255,.85)','font-family':'JetBrains Mono, monospace'},svg);tx.textContent=p<1?`${(p*DUR/1000).toFixed(1)} s`:'Ball arrived';
}
function tick(now){const dt=Math.min(64,now-(scLast||now));scLast=now;
  if(svg.isConnected&&svg.getBoundingClientRect().width>0){ if(!reduce){scT+=dt; if(scT>DUR+1800)scT=0;} else scT=DUR; drawSc(scT);} requestAnimationFrame(tick);}
$('scNew').onclick=()=>newEx();
$('scShow').onclick=()=>{const rate=(scN/(DUR/1000)).toFixed(2);$('scAns').textContent=`${scN} scan${scN>1?'s':''} in ${(DUR/1000).toFixed(1)} seconds = ${rate} scans per second.`;};
newEx(); requestAnimationFrame(tick);

/* calculator */
function calc(){const n=Math.max(0,+$('scN').value||0),s=Math.max(1,+$('scS').value||1),r=n/s;
  const box=$('scRate');box.innerHTML='';
  const big=document.createElement('div');big.className='spbig';big.innerHTML=`<span>${r.toFixed(2)}</span><small>scans per second</small>`;box.appendChild(big);
  const bar=document.createElement('div');bar.className='sc-bar';const fill=document.createElement('i');fill.style.width=Math.min(100,r/0.8*100)+'%';bar.appendChild(fill);const mk=document.createElement('b');mk.style.left=(0.6/0.8*100)+'%';mk.title='0.6 per second';bar.appendChild(mk);box.appendChild(bar);
  const p=document.createElement('p');p.className='wc';
  p.textContent=r>=0.6?'At the level of the best scanners in Jordet\'s Premier League study (about 0.6 per second).':r>=0.3?'A good habit is forming. Aim to raise this number over the next 4 weeks.':'Scanning rarely. Start with the colour-card rule in the rondo.';
  box.appendChild(p);
  const n2=document.createElement('p');n2.className='wc';n2.textContent='The 0.6 mark comes from elite professional midfielders. Young players start lower: compare a player with their own earlier number, not with Lampard.';box.appendChild(n2);
}
['scN','scS'].forEach(id=>$(id).addEventListener('input',calc));calc();

/* field test: 10 receptions, week 1 vs week 4 */
const ft=store.get('ft',{w1:Array(10).fill(''),w4:Array(10).fill('')});
const tbl=$('ftTable');
function buildFt(){
  tbl.innerHTML='';
  const thead=document.createElement('thead');const hr=document.createElement('tr');
  ['','1','2','3','4','5','6','7','8','9','10','Average'].forEach(h=>{const th=document.createElement('th');th.textContent=h;hr.appendChild(th)});thead.appendChild(hr);tbl.appendChild(thead);
  const tb=document.createElement('tbody');
  [['w1','Week 1'],['w4','Week 4']].forEach(([k,n])=>{const tr=document.createElement('tr');const th=document.createElement('th');th.textContent=n;tr.appendChild(th);
    for(let i=0;i<10;i++){const td=document.createElement('td');const inp=document.createElement('input');inp.type='number';inp.min=0;inp.max=9;inp.id='ft-'+k+'-'+i;inp.setAttribute('aria-label',n+', reception '+(i+1));inp.value=ft[k][i];inp.oninput=()=>{ft[k][i]=inp.value;store.set('ft',ft);avg()};td.appendChild(inp);tr.appendChild(td)}
    const td=document.createElement('td');td.id='ftAvg-'+k;td.style.fontWeight='700';tr.appendChild(td);tb.appendChild(tr)});
  tbl.appendChild(tb);avg();
}
function mean(a){const v=a.filter(x=>x!==''&&!isNaN(+x)).map(Number);return v.length?v.reduce((s,x)=>s+x,0)/v.length:null}
function avg(){const a=mean(ft.w1),b=mean(ft.w4);
  $('ftAvg-w1').textContent=a==null?'–':a.toFixed(1);$('ftAvg-w4').textContent=b==null?'–':b.toFixed(1);
  $('ftOut').textContent=a!=null&&b!=null?(b>a?`Improved: ${a.toFixed(1)} → ${b.toFixed(1)} scans per reception (+${Math.round((b-a)/Math.max(a,.1)*100)}%).`:`No improvement yet (${a.toFixed(1)} → ${b.toFixed(1)}). Use more scanning constraints in training.`):'Fill in both weeks to see the change.';}
buildFt();
})();
