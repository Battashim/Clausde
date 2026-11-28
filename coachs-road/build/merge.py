import re, sys
S='/tmp/claude-0/-home-user-Clausde/2d228f61-562f-5a74-9a4c-5c84ecfb8309/scratchpad/merge/'
CR=open('/root/.claude/projects/-home-user-Clausde/2d228f61-562f-5a74-9a4c-5c84ecfb8309/tool-results/artifact-75d8671a-1795872088-378b.html').read()
PC=open('/home/user/Clausde/pitchcraft/index.html').read()
BS=open(S+'bs2.js').read()
FHTML=open(S+'found.html').read()
FJS=open(S+'found.js').read()
FUN=open(S+'funino.js').read()

def one(h,a,b,cnt=1):
    assert h.count(a)==cnt,(a[:70],h.count(a)); return h.replace(a,b)

# ---------- split CR ----------
cr_body=CR.split('<body>',1)[1].rsplit('</body>',1)[0]   # skeleton stripped; republished fresh
cr_style=re.search(r'<style>\n/\* Layout: a coach.*?</style>',cr_body,re.S).group(0)
cr_head_links=cr_body[:cr_body.index(cr_style)]
cr_rest=cr_body[cr_body.index(cr_style)+len(cr_style):]
cr_html,cr_script=cr_rest.split('<script>',1)
cr_script='<script>'+cr_script

# ---------- split PC ----------
pc_style=re.search(r'<style>(.*?)</style>',PC,re.S).group(1)
pc_html=PC[PC.index('<main class="wrap">'):PC.index('</main>')+7]
pc_script=re.search(r'<script>(.*?)</script>',PC,re.S).group(1)

# ---------- PC CSS ----------
css=pc_style
# drop PC token blocks (first three blocks)
css=css[css.index('*{box-sizing:border-box}'):]
drop_prefixes=['*{box-sizing','[hidden]','body{','body::before','h1,h2,h3,h4{','p{margin','a{color','button{font',':focus-visible','.wrap{',
 '.topbar','.brand','.tabs','main{','.eyebrow{','.hero','.cta-row','.entry','footer{','/* nav */','/* hero */']
out=[]
for line in css.split('\n'):
    s=line.strip()
    if any(s.startswith(p) for p in drop_prefixes): continue
    out.append(line)
css='\n'.join(out)
css=css.replace('.hero,.lib,.fix,.method-grid{','.lib,.fix,.method-grid{')
css=css.replace('  .entry{grid-template-columns:1fr 1fr}\n','')
css=css.replace('.entry,.fusion,','.fusion,')
css=css.replace('  .tabs{margin-left:0;width:100%}\n','')
for a,b in [('board','pc-board'),('cap','pc-cap'),('ctrls','pc-ctrls'),('legend','pc-legend'),('chip','pc-chip'),('ladder','pc-ladder'),('rung','pc-rung'),('blk','pc-blk'),('steps','pc-steps')]:
    css=re.sub(r'\.'+a+r'(?![\w-])','.'+b,css)
css=css.replace('pre.model','pre.modelans')
css=css.replace('var(--line)','var(--rule)')
# no uppercase on display-font headings (CR style)
def fix_rule(m):
    sel,dec=m.group(1),m.group(2)
    if 'uppercase' in dec and 'font-mono' not in dec:
        dec=re.sub(r';?text-transform:uppercase','',dec)
        dec=re.sub(r';?letter-spacing:\.0[0-9]+em','',dec)
    return sel+'{'+dec+'}'
css=re.sub(r'([^{}\n]+)\{([^{}]*)\}',fix_rule,css)
css=css.replace('.detail{scroll-margin-top:130px;position:sticky;top:calc(env(safe-area-inset-top,0px) + 76px)','.detail{scroll-margin-top:130px;position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--appbar-h) + 14px)')
assert 'appbar-h' in css

# ---------- PC HTML ----------
h=pc_html
h=re.sub(r'<!-- HOME -->.*?</section>\n\n','',h,flags=re.S)
h=h.replace('<main class="wrap">','<div class="wrap pc-main" id="tools" hidden>').replace('</main>','</div>')
def ren_classes(s):
    def f(m):
        toks=m.group(2).split(' ')
        mp={'board':'pc-board','cap':'pc-cap','ctrls':'pc-ctrls','legend':'pc-legend','chip':'pc-chip','ladder':'pc-ladder','rung':'pc-rung','blk':'pc-blk','steps':'pc-steps','model':'modelans'}
        return m.group(1)+' '.join(mp.get(t,t) for t in toks)+'"'
    return re.sub(r'(class(?:Name)?=\\?")([^"]*)"',f,s)
h=ren_classes(h)
h=h.replace('id="ladder"','id="pc-ladder"')
h=one(h,'Orange = the players this drill develops','Red = the players this drill develops')
h=one(h,'the orange line shows where the ball goes next.','the orange line shows where the ball goes next. Want the big ideas first? Each drill links back to a level of the course.')
# method: the 4 moments live in Level 1 now (no duplicate)
h=re.sub(r'  <div class="sec-head"><span class="eyebrow">The language of every license</span>.*?</div>\n  </div>\n','  <p class="note">The 4 moments of the game, and how a player stands in each one, are in <a href="#level-1">Level 1 of the course</a>. Fàbregas\'s full game model, side by side with Gasperini\'s, is in <a href="#level-4">Level 4</a>.</p>\n',h,flags=re.S)
assert 'The language of every license' not in h
# planner: add the unique Coach's Road tips (6-8-10, rope/phone, full-pitch picture)
h=one(h,'''    <div><b>3 · Size it to your group</b><span>Pick the number of players and the type of activity. You get the size in metres and in your steps.</span></div>
  </div>''','''    <div><b>3 · Size it to your group</b><span>Pick the number of players and the type of activity. You get the size in metres and in your steps.</span></div>
    <div><b>No pitch lines?</b><span>Measure 10 m once with a tape and count your steps. Or tie knots every 5 m in a cheap 30 m rope. Map apps can also measure distance on a satellite view of your field.</span></div>
    <div><b>Square corners: 6-8-10</b><span>Walk 6 steps along one side and 8 along the other. If the corner is square, the line between those two points is exactly 10 steps.</span>
      <svg viewBox="0 0 220 120" style="width:100%;max-width:240px;height:auto" role="img" aria-label="The 6-8-10 trick for a square corner"><line x1="30" y1="100" x2="30" y2="20" stroke="var(--green)" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="100" x2="150" y2="100" stroke="var(--green)" stroke-width="4" stroke-linecap="round"/><line x1="30" y1="20" x2="150" y2="100" stroke="var(--red)" stroke-width="3" stroke-dasharray="7 5"/><rect x="30" y="88" width="12" height="12" fill="none" stroke="var(--ink)" stroke-width="1.5"/><text x="10" y="64" fill="var(--ink)" font-size="13" font-family="JetBrains Mono, monospace" font-weight="700">6</text><text x="70" y="116" fill="var(--ink)" font-size="13" font-family="JetBrains Mono, monospace" font-weight="700">8 steps</text><text x="96" y="52" fill="var(--red)" font-size="13" font-family="JetBrains Mono, monospace" font-weight="700">10 = square</text></svg></div>
    <div><b>Rulers already on the pitch</b><span>Penalty box 40 × 16.5 m. Goal area 18 × 5.5 m. Centre circle 18.3 m across. Penalty spot 11 m from the goal line. Full pitch about 105 × 68 m.</span></div>
  </div>''')
h=one(h,'<label for="spN">Players in the activity (incl. neutrals)','<label for="spN">Players in the activity (count neutrals, not goalkeepers)')
h=one(h,'<div id="spOut" style="display:flex;flex-direction:column;gap:12px"></div>','<div class="space" style="align-items:center"><div id="spOut" style="display:flex;flex-direction:column;gap:12px;min-width:0"></div><figure style="margin:0;min-width:0"><svg id="spPitch" viewBox="-3 -3 111 74" style="width:100%;height:auto;display:block;border-radius:10px;background:var(--pitch)" role="img" aria-label="Your area drawn to scale on a full pitch"></svg><figcaption class="wc" id="spCmp" style="margin-top:6px"></figcaption></figure></div>')
h=h.replace('<span class="eyebrow">Animated · position-specific · scored</span>','<span class="eyebrow">Animated · position-specific · scored · Pitchcraft method</span>')

# ---------- PC JS ----------
j=pc_script
j=ren_classes(j)
j=j.replace('$("#ladder")','$("#pc-ladder")')
j=one(j,'makeBoard($("#heroBoard"),D.rondo,{intro:.6});\n','')
j=one(j,'a:{f:"#ff6a2b",t:"#fff"}','a:{f:"#C8102E",t:"#fff"}')
j=j.replace('"Barlow Condensed, Arial Narrow, sans-serif"','"Bricolage Grotesque, system-ui, sans-serif"')
j=j.replace('"Barlow Condensed, sans-serif"','"Bricolage Grotesque, system-ui, sans-serif"')
j=j.replace('var(--line)','var(--rule)')
j=re.sub(r'(font-family:var\(--font-display\)[^"]*?);text-transform:uppercase',r'\1',j)
j=j.replace('text-transform:uppercase;letter-spacing:.03em','')
j=one(j,'const VIEWS=["home","license","exam","method","drills","fix","session","space"];\nlet curView="home";','const VIEWS=["course","license","exam","method","drills","fix","session","space"];\nlet curView="course";')
j=one(j,'let h=location.hash.slice(1)||"home", view=h, arg=null;','let h=location.hash.slice(1)||"course", view=h, arg=null;\n  if(/^level-\\d+$/.test(h)||h==="top"){view="course";arg=h}\n  if(h==="measure")view="space";\n  {const t=document.getElementById(h);if(t&&document.getElementById("v-course").contains(t)&&h!=="v-course"){view="course";arg=h}}')
j=one(j,'if(!VIEWS.includes(view))view="home";','if(!VIEWS.includes(view))view="course";')
j=one(j,'VIEWS.forEach(v=>$("#v-"+v).hidden=v!==view);','VIEWS.forEach(v=>$("#v-"+v).hidden=v!==view);$("#tools").hidden=view==="course";')
j=one(j,'document.querySelectorAll(".tabs a").forEach(a=>a.setAttribute("aria-current",a.getAttribute("href")==="#"+view?"page":"false"));','document.querySelectorAll(".appbar a").forEach(a=>a.setAttribute("aria-current",a.getAttribute("href")==="#"+view?"page":"false"));\n  if(view==="course"&&arg){const t=document.getElementById(arg==="top"?"v-course":arg);if(t)requestAnimationFrame(()=>t.scrollIntoView());}')
# planner: full-pitch picture + comparison (from Coach's Road)
j=one(j,'  startWalker(g.L,g.W);\n}','''  startWalker(g.L,g.W);
  drawAreaOnPitch(g.L,g.W,players);
}
function drawAreaOnPitch(L,W,n){
  const svg=$("#spPitch");if(!svg)return;svg.innerHTML="";
  const Ln={fill:"none",stroke:"rgba(255,255,255,.75)","stroke-width":.35};
  for(let i=0;i<10;i+=2)el("rect",{x:i*10.5,y:0,width:10.5,height:68,fill:"rgba(255,255,255,.05)"},svg);
  el("rect",{x:0,y:0,width:105,height:68,...Ln},svg);el("line",{x1:52.5,y1:0,x2:52.5,y2:68,...Ln},svg);el("circle",{cx:52.5,cy:34,r:9.15,...Ln},svg);
  el("rect",{x:0,y:13.84,width:16.5,height:40.32,...Ln},svg);el("rect",{x:88.5,y:13.84,width:16.5,height:40.32,...Ln},svg);
  L=Math.min(L,105);W=Math.min(W,68);const x=(105-L)/2,y=(68-W)/2;
  el("rect",{x,y,width:L,height:W,rx:.6,fill:"rgba(255,214,90,.18)",stroke:"#FFD65A","stroke-width":.4,"stroke-dasharray":"1.2 .8"},svg);
  const cols=Math.ceil(Math.sqrt(n*L/W)),rows=Math.ceil(n/cols);
  for(let i=0;i<n;i++){const c=i%cols,r=Math.floor(i/cols);el("circle",{cx:x+L*(c+.5)/cols,cy:y+W*(r+.5)/rows,r:Math.min(1.6,L/cols/3,W/rows/3),fill:i%2?"#F4F1E8":"#C8102E",stroke:"#fff","stroke-width":.2},svg)}
  const a=L*W;$("#spCmp").textContent="Drawn to scale on a full pitch. That's "+(a<=120?"about the size of the goal area (6-yard box).":a<=300?"a bit smaller than the centre circle area.":a<=700?"about the size of the penalty box.":a<=1800?"about 2 penalty boxes.":a<=3700?"about half a pitch.":"most of a full pitch.");
}''')
j=j.replace('On a full pitch (105 × 68 m) each player in an 11v11 game has about 325 m².','In a real 11v11 match each player has about 325 m² (105 × 68 m shared by 22). Training games are much smaller so players get many more touches.')

# ---------- CR CSS ----------
c=cr_style
alias='''  --surface-2:#E8EEE8; --def:#2f6fdc; --mid:#0f8a6a; --att:#c8361f; --gk:#7b45c9; --all:#56655B;
  --bg:var(--paper); --surface:var(--panel); --accent:var(--red); --accent-ink:var(--red); --accent-soft:var(--red-soft);
  --font-display:var(--display); --font-body:var(--body); --font-mono:var(--mono); --r:12px; --chalk:#eaf6ee; --appbar-h:54px;
'''
c=one(c,'  --mono:"JetBrains Mono", ui-monospace, Menlo, monospace;\n}','  --mono:"JetBrains Mono", ui-monospace, Menlo, monospace;\n'+alias+'}')
darkx='  --surface-2:#1E2A23; --def:#6a9cff; --mid:#3cc9a0; --att:#ff7a52; --gk:#b78cff; --all:#9DAEA2;\n'
c=one(c,"  --gold:#F0BF4C; --gold-soft:#33291A; --blue:#7FA2F5; --blue-soft:#18223A; --them:#EDEAE0; --them-ink:#1C2A44; color-scheme:dark}}","  --gold:#F0BF4C; --gold-soft:#33291A; --blue:#7FA2F5; --blue-soft:#18223A; --them:#EDEAE0; --them-ink:#1C2A44;\n"+darkx+"  color-scheme:dark}}")
c=one(c,"  --gold:#F0BF4C; --gold-soft:#33291A; --blue:#7FA2F5; --blue-soft:#18223A; --them:#EDEAE0; --them-ink:#1C2A44; color-scheme:dark}\n\n","  --gold:#F0BF4C; --gold-soft:#33291A; --blue:#7FA2F5; --blue-soft:#18223A; --them:#EDEAE0; --them-ink:#1C2A44;\n"+darkx+"  color-scheme:dark}\n\n")
c=one(c,'.road{position:sticky;top:env(safe-area-inset-top,0px);','.road{position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--appbar-h));')
c=one(c,'.level{padding-block:56px;border-bottom:1px solid var(--rule);scroll-margin-top:64px}','.level{padding-block:56px;border-bottom:1px solid var(--rule);scroll-margin-top:calc(var(--appbar-h) + 64px)}')
c=one(c,'.board{position:sticky;top:76px;','.board{position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--appbar-h) + 72px);')
c=one(c,'.stylecard{position:sticky;top:76px;','.stylecard{position:sticky;top:calc(env(safe-area-inset-top,0px) + var(--appbar-h) + 72px);')
c=one(c,'body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--paper)}','body::before{content:"";position:fixed;inset:0 0 auto;height:env(safe-area-inset-top,0px);z-index:10;background:var(--panel)}')
extra='''
/* App bar: one platform, many rooms */
[hidden]{display:none!important}
a{color:var(--red)}
.appbar{position:sticky;top:env(safe-area-inset-top,0px);z-index:8;background:var(--panel);border-bottom:1px solid var(--rule);height:var(--appbar-h)}
.appbar .wrap{display:flex;align-items:center;gap:14px;height:100%}
.appbar .brand{font-family:var(--display);font-weight:800;font-size:1.1rem;text-decoration:none;color:var(--ink);white-space:nowrap;flex:none}
.appbar .brand span{color:var(--red)}
.appbar nav{display:flex;gap:2px;overflow-x:auto;scrollbar-width:none;min-width:0;flex:1}
.appbar nav::-webkit-scrollbar{display:none}
.appbar nav a{white-space:nowrap;text-decoration:none;color:var(--muted);font-weight:700;font-size:.9rem;padding:7px 11px;border-radius:999px}
.appbar nav a:hover{color:var(--ink);background:var(--paper)}
.appbar nav a[aria-current="page"]{color:#fff;background:var(--ink)}
@media (max-width:560px){.appbar .brand{display:none}}
.pc-main{padding-block:32px 64px;font-size:16px}
.pc-main .sec-head h2{font-weight:800;letter-spacing:-.01em}
.pc-main .eyebrow{color:var(--red)}
.tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-top:18px}
.tools a{background:var(--panel);border:1px solid var(--rule);border-radius:14px;padding:14px 16px;display:grid;gap:4px;text-decoration:none;color:var(--ink)}
.tools a:hover{border-color:var(--red)}
.tools b{font-family:var(--display);font-size:1.1rem}
.tools span{font-size:.92rem;color:var(--muted)}
.tools small{font-family:var(--mono);font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--red)}
.xlink{display:inline-block;margin-top:6px;font-weight:700}
#v-course [id]{scroll-margin-top:calc(var(--appbar-h) + 76px)}
.form select,.form input{min-width:0;max-width:100%}
.space .form{grid-template-columns:minmax(0,1fr)}
@media (max-width:620px){.form{grid-template-columns:minmax(0,1fr)}}
@media (max-width:960px){.lib,.fix,.method-grid,.space{grid-template-columns:minmax(0,1fr)}}
.fun b,.card b{overflow-wrap:anywhere}


/* Foundations */
.fnd{display:flex;flex-direction:column;gap:18px}
.lbl-key{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;font-size:.85rem;color:var(--muted)}
.lbl{display:inline-block;font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;border-radius:5px;padding:2px 6px;margin-right:4px;vertical-align:1px;white-space:nowrap}
.lbl.res{background:var(--green-soft);color:var(--green)}.lbl.gen{background:var(--blue-soft,#E3EAFB);color:var(--blue,#1D4ED8)}.lbl.our{background:var(--gold-soft);color:#7A5600}
:root[data-theme="dark"] .lbl.our{color:var(--gold)}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .lbl.our{color:var(--gold)}}
.fnd-card{gap:12px}
.fnd-head{display:flex;gap:14px;align-items:center}
.fnd-n{font-family:var(--display);font-weight:800;font-size:3rem;line-height:.8;color:var(--red)}
.fnd-card ul{display:flex;flex-direction:column;gap:8px}
.src{font-size:.82rem;color:var(--muted);border-top:1px dashed var(--rule);padding-top:8px}
.cl-grid{display:grid;grid-template-columns:minmax(0,300px) minmax(0,1fr);gap:14px;align-items:start}
.cl-ctrl{display:flex;flex-direction:column;gap:8px}
.cl-ctrl select{font:inherit;padding:10px 12px;border-radius:8px;border:1px solid var(--rule);background:var(--panel);color:var(--ink);width:100%;min-width:0}
.cl-out{display:grid;gap:8px}
.cl-row{display:grid;grid-template-columns:150px minmax(0,1fr);gap:10px;background:var(--paper);border-radius:10px;padding:10px 12px}
.cl-row b{font-family:var(--mono);font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);padding-top:3px}
.cl-row.no{background:var(--red-soft)}.cl-row.no span{text-decoration:line-through;text-decoration-color:var(--red)}
.cl-row.ask{background:var(--green-soft)}.cl-row.ask span{font-weight:700}
.fn-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:14px;align-items:start}
.fn-table table{width:100%}
.sc-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px}
.sc-box{background:var(--paper);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
.sc-box svg{width:100%;height:auto;border-radius:10px;display:block}
.sc-bar{position:relative;height:12px;border-radius:6px;background:var(--rule);overflow:visible}
.sc-bar i{display:block;height:100%;border-radius:6px;background:var(--red)}
.sc-bar b{position:absolute;top:-4px;width:2px;height:20px;background:var(--ink)}
table.ft{min-width:620px}.ft input{width:44px;font:inherit;padding:4px;border:1px solid var(--rule);border-radius:6px;background:var(--panel);color:var(--ink);text-align:center}
.ft td,.ft th{padding:6px 6px!important;text-align:center!important}
@media (max-width:760px){.cl-grid,.fn-grid,.sc-grid{grid-template-columns:minmax(0,1fr)}.cl-row{grid-template-columns:minmax(0,1fr)}}
/* Body shape in the 4 moments */
.bshape{margin-top:44px;display:grid;gap:14px}
.bs-tabs{display:flex;gap:6px;flex-wrap:wrap}
.bs-stage{display:grid;gap:16px;background:var(--panel);border:1px solid var(--rule);border-radius:16px;padding:14px}
.bs-pair{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px;align-items:start}
.bs-fig{margin:0;background:var(--paper);border-radius:12px;overflow:hidden;display:flex;flex-direction:column;min-width:0;border:2px solid transparent}
.bs-fig.ok{border-color:var(--green)}.bs-fig.bad{border-color:var(--red)}
.bs-fig svg{display:block;width:100%;height:auto}
.bs-tag{font-family:var(--display);font-weight:800;font-size:1.05rem;padding:8px 12px;color:var(--ink)}
.bs-tag.ok{background:var(--green-soft);color:var(--green)}.bs-tag.bad{background:var(--red-soft);color:var(--red)}
.bs-badtxt{padding:8px 12px 12px;font-size:.95rem}
.bs-step{display:grid;gap:8px}
.bs-step .cap{min-height:3.2em;font-size:1.15rem;font-weight:700}
.bs-legend{display:flex;flex-wrap:wrap;gap:6px 14px;padding:8px 12px 12px;font-size:.82rem;color:var(--muted)}
.bs-legend span{display:inline-flex;align-items:center;gap:6px}
.bs-legend i{width:12px;height:12px;border-radius:3px;display:inline-block}
.bs-legend i.ln{height:0;width:18px;border-top:2px solid var(--ink);border-radius:0}.bs-legend i.ln.dash{border-top-style:dashed}
.bs-body{display:grid;gap:10px;align-content:start;min-width:0}
.bs-list{margin:0;padding:0;list-style:none;display:grid;gap:6px}
.bs-part{display:grid;grid-template-columns:auto minmax(0,1fr);gap:10px;align-items:start;text-align:left;width:100%;border:1px solid var(--rule);background:var(--paper);border-radius:10px;padding:8px 10px;cursor:pointer;font-size:.95rem;line-height:1.4}
.bs-part b{display:block;font-family:var(--display);font-size:1rem}
.bs-part[aria-pressed="true"]{border-color:var(--ink);box-shadow:0 0 0 2px var(--gold) inset}
.bs-num{width:26px;height:26px;border-radius:50%;background:var(--gold);color:#16231B;font-weight:800;display:grid;place-items:center;border:1.5px solid var(--ink)}
.bs-say{background:var(--gold-soft);border-radius:10px;padding:10px 12px}
.bs-say #bsSay{font-family:var(--display);font-size:1.3rem;font-weight:800}
.bs-cues{margin:0;padding-left:20px;display:grid;gap:4px}
@media (max-width:760px){.bs-pair{grid-template-columns:minmax(0,1fr)}}
'''
c=c.replace('</style>','\n/* ===== Toolbox (Pitchcraft) ===== */\n'+css+extra+'</style>')

# ---------- CR HTML ----------
x=cr_html
x=one(x,'<header class="hero">','<div id="v-course">\n<header class="hero">')
x=one(x,'''    <div class="howto">''','''    <div class="tools">
      <a href="#license"><small>US Soccer D → Pro</small><b>License path</b><span>What each course assesses and how to pass it.</span></a>
      <a href="#exam"><small>Your assessor</small><b>Exam room</b><span>Get tested level by level. Pass at 100% to unlock the next one.</span></a>
      <a href="#drills"><small>21 animated drills</small><b>Drill library</b><span>For defenders, midfielders, attackers and keepers.</span></a>
      <a href="#fix"><small>Problem → drill</small><b>Fix a problem</b><span>What you saw in the game, why it happens, and what fixes it.</span></a>
      <a href="#session"><small>Play – Practice – Play</small><b>Session builder</b><span>A full timed session for any problem.</span></a>
      <a href="#space"><small>Steps & headcount</small><b>Pitch planner</b><span>Measure with your feet. Size any drill for your group.</span></a>
    </div>
    <div class="howto">''')
x=one(x,'Nine levels, from zero to your own coaching style. Each one has moving tactics boards, a "like you\'re 6" story, the real coach words, a drill to try this week, and a checklist. By the end you will look at football the way Cesc Fàbregas and Gian Piero Gasperini do.',
      'Nine levels, from zero to your own coaching style. Each one has moving tactics boards, a "like you\'re 6" story, the real coach words, a drill to try this week, and a checklist. Next to the course you have a toolbox: licence exams, animated drills built on Coerver, Ekkono and Fàbregas, a session builder and a pitch planner.')
# remove the duplicated measuring section (now the Pitch planner)
x,nsub=re.subn(r'\n    <div id="measure" style="scroll-margin-top:70px">.*?\n    </div>\n    </div>\n  </div>\n</section>','\n  </div>\n</section>',x,flags=re.S)
assert nsub==1
x=x.replace('<a href="#measure" class="mlink">How to measure it →</a>','<a href="#space" class="mlink">Measure it with your steps →</a>')
# level 5: link to session builder
x=one(x,'''          <div class="week" id="week"></div>
        </div>''','''          <div class="week" id="week"></div>
        </div>
        <a class="xlink" href="#session">Build your own session for any problem →</a>''')
# level 2/3 drills link to animated drills
x=one(x,'<label><input type="checkbox" id="c2a"','<a class="xlink" href="#drill-rondo">Animated drill: Scan &amp; Strike Rondo →</a>\n          <label><input type="checkbox" id="c2a"')
x=one(x,'<label><input type="checkbox" id="c3a"','<a class="xlink" href="#drill-hunt">Animated drill: Five-Second Hunt →</a>\n          <label><input type="checkbox" id="c3a"')
# level 4: links to Fàbregas drills
x=one(x,'<label><input type="checkbox" id="c4a"','<a class="xlink" href="#drill-invbox">Train the Fàbregas build-up: Inverted Fullback Box, Pocket Hunter →</a>\n          <label><input type="checkbox" id="c4a"')
# level 7: link to licence prep + exams
x=one(x,'<label><input type="checkbox" id="c7a"','<a class="xlink" href="#exam">Prepare for licence assessments in the Exam room →</a>\n          <label><input type="checkbox" id="c7a"')
# level 1: body shape in the 4 moments
bs_html='''
    <div class="bshape" id="bodyshape">
      <h3 class="section-title" style="margin:0">How a player stands in each moment</h3>
      <p style="max-width:72ch;color:var(--muted)">Choose a moment and a position. <b style="color:var(--ink)">Left:</b> the right way, with numbered body points. <b style="color:var(--ink)">Right:</b> the common mistake, with the wrong body parts crossed out. <b style="color:var(--ink)">Below:</b> the same moment seen from above, and the body checklist to read out. Tap a checklist line to light up its number on the player.</p>
      <div class="bs-tabs" id="bsMoments" role="tablist" aria-label="Moment of the game"></div>
      <div class="bs-tabs" id="bsPos" aria-label="Position"></div>
      <div class="bs-stage">
        <div class="bs-pair">
          <figure class="bs-fig ok"><figcaption class="bs-tag ok">✓ Do this</figcaption><svg id="bsSide" viewBox="0 44 320 256" role="img" aria-label="Correct body position, seen from the side, with numbered body points"></svg></figure>
          <figure class="bs-fig bad"><figcaption class="bs-tag bad">✗ Not this</figcaption><svg id="bsBad" viewBox="0 44 320 256" role="img" aria-label="Common mistake, seen from the side"></svg><p class="bs-badtxt" id="bsBadTxt"></p></figure>
        </div>
        <div class="bs-step"><p class="cap" id="bsCap" aria-live="polite"></p>
          <div class="ctrls"><button class="cbtn" id="bsBack" type="button" aria-label="Previous step">◀</button><button class="cbtn play" id="bsPlay" type="button">▶ Play</button><button class="cbtn" id="bsNext" type="button" aria-label="Next step">▶|</button><div class="dots" id="bsDots"></div></div></div>
        <div class="bs-pair">
          <figure class="bs-fig"><figcaption class="bs-tag">From above</figcaption><svg id="bsTop" viewBox="0 0 300 220" role="img" aria-label="The same moment seen from above"></svg>
            <div class="bs-legend"><span><i style="background:#C8102E"></i>YOU / MATE: our team</span><span><i style="background:#F4F1E8;border:1px solid #1C2A44"></i>OPP: opponent</span><span><i style="background:#fff;border:1px solid #111;border-radius:50%"></i>Ball</span><span><i class="ln"></i>Pass</span><span><i class="ln dash"></i>Run</span><span><i style="background:rgba(226,169,43,.5)"></i>Where the player looks</span></div></figure>
          <div class="bs-body"><p class="eyebrow">Body checklist · matches the numbers</p><ol class="bs-list" id="bsBody"></ol>
            <div class="bs-say"><p class="eyebrow">Say it to your players</p><p id="bsSay"></p></div></div>
        </div>
        <div><p class="eyebrow" style="margin-bottom:6px">Extra coaching points · for this position</p><ul class="bs-cues" id="bsCues"></ul></div>
      </div>
    </div>
  </div>
</section>

<!-- LEVEL 2 -->'''
x=one(x,'\n  </div>\n</section>\n\n<!-- LEVEL 2 -->',bs_html)
x=one(x,'<label><input type="checkbox" id="c1c" data-key="1c"> I watched 15 minutes without following the ball</label>','<label><input type="checkbox" id="c1c" data-key="1c"> I watched 15 minutes without following the ball</label>\n          <label><input type="checkbox" id="c1d" data-key="1d"> I can show a player how to stand in each of the 4 moments</label>')
# footer
x=one(x,'<span>Fàbregas build-up patterns, deeper</span><span>Gasperini pressing, deeper</span></div>','<span>Fàbregas build-up patterns, deeper</span><span>Gasperini pressing, deeper</span></div>\n    <p style="margin-top:18px;font-size:.85rem;color:var(--muted)">Drills are original, inspired by the principles of Coerver Coaching, the Ekkono Method and the coaching ideas of Cesc Fàbregas. Not affiliated with US Soccer, UEFA, the AFC, Coerver Coaching, Ekkono, Cesc Fàbregas or Como 1907.</p>')
x=x.replace('</footer>','</footer>\n</div><!-- /v-course -->',1)

appbar='''<header class="appbar">
  <div class="wrap">
    <a class="brand" href="#course">The Coach's <span>Road</span></a>
    <nav aria-label="Sections">
      <a href="#course">Course</a>
      <a href="#license">License path</a>
      <a href="#exam">Exam room</a>
      <a href="#method">The method</a>
      <a href="#drills">Drill library</a>
      <a href="#fix">Fix a problem</a>
      <a href="#session">Session builder</a>
      <a href="#space">Pitch planner</a>
    </nav>
  </div>
</header>
'''
# CR script: remove its measuring planner (replaced by Pitch planner)
s=cr_script
s,nsub=re.subn(r'/\* ---------- Space planner ---------- \*/\n\(function\(\)\{.*?\n\}\)\(\);\n','',s,flags=re.S)
assert nsub==1
s=s.replace('<a href="#measure" class="mlink">Size it for your players →</a>','<a href="#space" class="mlink">Size it for your players →</a>')
s=s.replace('</script>','</script>',1)

# Fàbregas: the course now has 'The Fàbregas file' (Level 4). Keep only the drill roots in the method page.
h,nsub=re.subn(r'(<h4>Influence 3 · Cesc Fàbregas</h4>\n    <h3>)[^<]*(</h3>\n)    <p>.*?</p>\n    <div class="prin">.*?</div>\n    </div>\n',r'\1Brave possession, trained in drills\2    <p>His career, his teachers and his 8 principles are in <a href="#fabregas-file">The Fàbregas file (Level 4)</a>. Here are the animated drills that train that style.</p>\n',h,flags=re.S)
assert nsub==1,nsub
x=x.replace('href="#measure"','href="#space"')
x=one(x,'<p style="margin-top:10px"><a href="#space" class="mlink">Size these drills for your players →</a></p>','<p style="margin-top:10px"><a href="#space" class="mlink">Size these drills for your players →</a> · <a href="#drill-hunt" class="mlink">Animated: Five-Second Hunt →</a> · <a href="#drill-zones" class="mlink">Animated: Three-Zone Overload →</a> · <a href="#drill-invbox" class="mlink">Animated: Inverted Fullback Box →</a></p>')
s=s.replace('href="#measure"','href="#space"')

# ---- Foundations (constraints-led, Funino, scanning) ----
h=one(h,'  <div class="method-grid">',FHTML+'\n  <div class="sec-head"><span class="eyebrow">Our influences</span><h2 style="font-size:clamp(26px,4vw,36px)">Where our drills come from</h2></div>\n  <div class="method-grid">')
j=one(j,"  {d:1.5,cap:\"Ball over the top! The keeper reads it early and sweeps outside the box.\",b:\"g\",m:{g:[31,19],b2:[34,23]}}\n ]}",
      "  {d:1.5,cap:\"Ball over the top! The keeper reads it early and sweeps outside the box.\",b:\"g\",m:{g:[31,19],b2:[34,23]}}\n ]}"+FUN)
j=one(j,'hunt:{type:"area",base:8}};','hunt:{type:"area",base:8},funino:{type:"station",base:6}};')
x=x.replace('<small>21 animated drills</small>','<small>22 animated drills</small>')
h=h.replace('21 animated drills','22 animated drills')

h=one(h,'<p>Skills are built from the bottom up. Tap a level to see how Pitchcraft trains it.</p>','<p><span class="lbl res">School\'s own model</span> The six-level pyramid is Coerver Coaching\'s player development model. <span class="lbl our">Our design</span> The drills linked to each level are ours. Tap a level.</p>')
h=one(h,'<p>Technique always serves a decision. Players learn to perceive, decide and then execute, in situations that look like the real game.</p>','<p><span class="lbl res">School\'s idea</span> Ekkono teaches football intelligence through real game situations, with the coach guiding by questions. <span class="lbl gen">Football principle</span> Perceive → decide → execute and the types of superiority below are shared by many modern schools, not only Ekkono.</p>')
fonts=cr_head_links  # title + meta + CR fonts
doc=fonts+c+'\n'+appbar+x+'\n'+h+'\n'+s+'\n<script>\n'+j+'</script>\n<script>\n'+BS+'</script>\n<script>\n'+FJS+'</script>\n'
doc=doc.replace("<title>The Coach's Road</title>","<title>The Coach's Road</title>")
open('/home/user/Clausde/coachs-road/index.html','w').write(doc)
print(len(doc))
