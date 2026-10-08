const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const colors=['#b9f34a','#7c5cff','#4dd7ff','#ff9f43','#ff6b9d','#62e6a5'];
let players=JSON.parse(localStorage.getItem('throwPlayers')||'[]');
let darts={active:false,target:501,round:1,current:0,players:[],history:[]};
let baseball={active:false,inning:1,current:0,players:[],history:[]};
let roomId=new URLSearchParams(location.search).get('room');
let hostMode=!roomId;
let firebaseApp=null, db=null, auth=null, currentUid=null, roomRef=null, authReadyPromise=null;
const throwSelection={0:null,1:null,2:null}; let activeThrow=0;
function savePlayers(){localStorage.setItem('throwPlayers',JSON.stringify(players));}
function initials(name){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function avatar(p,small=false){return p.photo?`<img class="${small?'mini-avatar':'avatar'}" src="${p.photo}" alt="${esc(p.name)}">`:`<span class="${small?'mini-avatar':'avatar'}" style="background:${p.color||colors[0]}">${initials(p.name)}</span>`}
function nav(view){$$('.view').forEach(v=>v.classList.toggle('active-view',v.id===view));$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='darts')renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));if(view==='baseball')renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.view)));
function renderPlayers(){const grid=$('#playersGrid');if(!players.length){grid.innerHTML='<div class="setup-panel"><h3 style="font-family:Space Grotesk;margin-top:0">No players yet.</h3><p style="color:var(--muted)">Add your crew and their faces/initials will appear on the scoreboard.</p></div>';return}grid.innerHTML=players.map(p=>`<div class="player-card">${avatar(p)}<div class="player-card-info"><strong>${esc(p.name)}</strong><span>Ready to throw</span></div><button class="delete-btn" data-del="${p.id}" title="Delete">×</button></div>`).join('');$$('[data-del]').forEach(b=>b.onclick=()=>{players=players.filter(p=>p.id!==b.dataset.del);savePlayers();renderPlayers();renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));});}
function renderPicker(id,selected){const el=$('#'+id);if(!players.length){el.innerHTML='<span class="muted">Add players first →</span>';return}el.innerHTML=players.map(p=>`<button class="player-chip ${selected.includes(p.id)?'selected':''}" data-pick="${p.id}">${avatar(p,true)}${esc(p.name)}</button>`).join('');$$('#'+id+' [data-pick]').forEach(b=>b.onclick=()=>{const isD=id.startsWith('darts');const arr=isD?darts.players:baseball.players;const p=players.find(x=>x.id===b.dataset.pick);if(arr.some(x=>x.id===p.id)){if(isD)darts.players=arr.filter(x=>x.id!==p.id);else baseball.players=arr.filter(x=>x.id!==p.id)}else{if(isD)darts.players=[...arr,p];else baseball.players=[...arr,p]}renderPicker(id,(isD?darts.players:baseball.players).map(x=>x.id));});}
function openModal(){$('#modal').classList.remove('hidden');$('#playerName').focus()};function closeModal(){$('#modal').classList.add('hidden');$('#playerForm').reset();$('#avatarPreview').innerHTML='?'}
$('#addPlayerBtn').onclick=openModal;$('#closeModal').onclick=closeModal;$('#playerPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>$('#avatarPreview').innerHTML=`<img src="${r.result}" alt="preview">`;r.readAsDataURL(f)};
$('#playerForm').onsubmit=e=>{e.preventDefault();const name=$('#playerName').value.trim();if(!name)return;const f=$('#playerPhoto').files[0];const add=photo=>{players.push({id:crypto.randomUUID(),name,photo:photo||'',color:colors[players.length%colors.length]});savePlayers();renderPlayers();renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));closeModal();toast(`${name} joined the crew ✦`)};if(f){const r=new FileReader();r.onload=()=>add(r.result);r.readAsDataURL(f)}else add('')};
$$('.score-option').forEach(b=>b.onclick=()=>{$$('.score-option').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#customScore').classList.toggle('hidden',b.dataset.score!=='custom')});
$('#startDarts').onclick=()=>{if(darts.players.length<1)return toast('Add at least one player');const sel=$('.score-option.active').dataset.score;const target=sel==='custom'?Number($('#customScore').value):Number(sel);if(!target||target<1)return toast('Choose a valid target');darts={active:true,target,round:1,current:0,players:darts.players.map(p=>({...p,score:target,scored:0})),history:[]};$('#dartsSetup').classList.add('hidden');$('#dartsGame').classList.remove('hidden');renderDarts();broadcast()};
$('#newDarts').onclick=()=>{darts.active=false;$('#dartsGame').classList.add('hidden');$('#dartsSetup').classList.remove('hidden');renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));};
function polarPoint(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]}
function sectorPath(cx,cy,r1,r2,a0,a1){const p1=polarPoint(cx,cy,r2,a0),p2=polarPoint(cx,cy,r2,a1),p3=polarPoint(cx,cy,r1,a1),p4=polarPoint(cx,cy,r1,a0);const large=Math.abs(a1-a0)>180?1:0;return `M ${p1[0]} ${p1[1]} A ${r2} ${r2} 0 ${large} 1 ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} A ${r1} ${r1} 0 ${large} 0 ${p4[0]} ${p4[1]} Z`}
function dartScoreTarget(score){
  if(score===50)return {ring:'bull',r:0,angle:0,label:'Bullseye'};
  if(score===25)return {ring:'outer-bull',r:44,angle:0,label:'Outer bull'};
  let multiplier=1,number=score;
  if(score>=1&&score<=20){multiplier=1;number=score}
  else if(score%3===0&&score/3<=20){multiplier=3;number=score/3}
  else if(score%2===0&&score/2<=20){multiplier=2;number=score/2}
  const nums=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const idx=Math.max(0,nums.indexOf(number));
  const angle=idx*18;
  return {ring:multiplier===3?'triple':multiplier===2?'double':'single',r:multiplier===3?137:multiplier===2?227:180,angle,label:`${multiplier===3?'T':multiplier===2?'D':'S'}${number}`};
}
function makeDartElement(score,index){
  const t=dartScoreTarget(score);
  const angle=t.angle+(index-1)*1.8;
  const a=(angle-90)*Math.PI/180;
  const r=t.r;
  const x=300+Math.cos(a)*r;
  const y=300+Math.sin(a)*r;
  const flight=['#ff3f4b','#ffc43b','#74ef63'][index%3];
  const flightDark=['#9f101d','#a76d00','#2b8e2f'][index%3];
  const id=`dartShadow${index}`;
  return `<g class="dart-3d dart-fly-${index+1}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(angle-90).toFixed(1)})" style="--dart-delay:${index*70}ms" data-score="${score}">
      <defs>
        <linearGradient id="shaftG${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff5d6"/><stop offset=".38" stop-color="#c59a5d"/><stop offset=".62" stop-color="#4a3623"/><stop offset=".76" stop-color="#e6e8eb"/><stop offset="1" stop-color="#555b63"/></linearGradient>
        <linearGradient id="barrelG${index}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b5057"/><stop offset=".2" stop-color="#d8dde1"/><stop offset=".48" stop-color="#6b727a"/><stop offset=".72" stop-color="#f3f5f7"/><stop offset="1" stop-color="#42474e"/></linearGradient>
        <linearGradient id="tipG${index}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#e9edf1"/><stop offset=".5" stop-color="#7f8790"/><stop offset="1" stop-color="#343a40"/></linearGradient>
        <filter id="${id}" x="-40%" y="-80%" width="180%" height="260%"><feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="#000" flood-opacity=".8"/></filter>
      </defs>
      <g filter="url(#${id})">
        <ellipse cx="-51" cy="8" rx="52" ry="5" fill="#000" opacity=".28"/>
        <path d="M-112,-12 L-91,-6 L-86,0 L-91,6 L-112,12 L-106,2 Z" fill="${flightDark}" opacity=".95"/>
        <path d="M-110,-9 L-92,-4 L-88,0 L-92,4 L-110,9 L-104,1 Z" fill="${flight}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>
        <path d="M-102,-6 L-92,-3 L-90,0 L-92,3 L-102,6" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.5"/>
        <rect x="-89" y="-2.5" width="49" height="5" rx="2.5" fill="url(#shaftG${index})"/>
        <rect x="-41" y="-6" width="30" height="12" rx="4" fill="url(#barrelG${index})" stroke="#20242a" stroke-width="1"/>
        <path d="M-36,-5 L-33,5 M-30,-5 L-27,5 M-24,-5 L-21,5 M-18,-5 L-15,5" stroke="#2f343a" stroke-width="2" opacity=".8"/>
        <path d="M-11,-3 L4,0 L-11,3 Z" fill="url(#tipG${index})" stroke="#16191d" stroke-width=".8"/>
        <circle cx="-12" cy="0" r="3.5" fill="#b8bec5" stroke="#3b4047" stroke-width="1"/>
      </g>
      <g transform="translate(-61 -25) rotate(${-(angle-90)})">
        <rect x="0" y="0" width="36" height="17" rx="8.5" fill="#080b10" fill-opacity=".9" stroke="#ffffff" stroke-opacity=".16"/>
        <text x="18" y="12" text-anchor="middle" class="dart-score-label">${score}</text>
      </g>
    </g>`;
}
function renderBoardDarts(){
  const board=$('#dartboardVisual'); if(!board)return;
  const old=board.querySelector('.thrown-darts-layer'); if(old)old.remove();
  const vals=[0,1,2].map(i=>throwSelection[i]).filter(v=>Number.isInteger(v));
  const layer=document.createElement('div'); layer.className='thrown-darts-layer';
  const svg=board.querySelector('.dartboard-svg');
  if(svg){
    const group=document.createElementNS('http://www.w3.org/2000/svg','g');
    group.setAttribute('class','thrown-darts-svg-layer');
    group.innerHTML=vals.map((v,i)=>makeDartElement(v,i)).join('');
    svg.appendChild(group);
  }
  layer.remove();
}
function makeDartboard(){
  const el=$('#dartboardVisual'); if(!el)return;
  const nums=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const cx=300,cy=300;
  let svg=`<svg class="dartboard-svg" viewBox="0 0 600 600" aria-label="Interactive 3D-style darts board">
    <defs>
      <radialGradient id="boardBase" cx="38%" cy="30%" r="78%"><stop offset="0" stop-color="#3d434b"/><stop offset=".38" stop-color="#20252c"/><stop offset=".78" stop-color="#0d1116"/><stop offset="1" stop-color="#05070a"/></radialGradient>
      <radialGradient id="sisalCream" cx="32%" cy="25%" r="85%"><stop offset="0" stop-color="#fffaf0"/><stop offset=".45" stop-color="#e6dfd2"/><stop offset="1" stop-color="#a9a49b"/></radialGradient>
      <radialGradient id="sisalBlack" cx="32%" cy="25%" r="85%"><stop offset="0" stop-color="#30363e"/><stop offset=".5" stop-color="#12171d"/><stop offset="1" stop-color="#05070a"/></radialGradient>
      <linearGradient id="rimG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f1f4f6"/><stop offset=".14" stop-color="#707985"/><stop offset=".34" stop-color="#161a20"/><stop offset=".56" stop-color="#bfc5cc"/><stop offset=".72" stop-color="#353b43"/><stop offset="1" stop-color="#0c0f13"/></linearGradient>
      <linearGradient id="redG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff6a67"/><stop offset=".35" stop-color="#ef2f3b"/><stop offset=".72" stop-color="#a81523"/><stop offset="1" stop-color="#5d0b14"/></linearGradient>
      <linearGradient id="greenG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d7ff79"/><stop offset=".35" stop-color="#9bea35"/><stop offset=".72" stop-color="#4e9d1e"/><stop offset="1" stop-color="#234d12"/></linearGradient>
      <filter id="boardShadow" x="-35%" y="-35%" width="170%" height="180%"><feDropShadow dx="0" dy="22" stdDeviation="15" flood-color="#000" flood-opacity=".8"/></filter>
      <filter id="sisalNoise" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="3" seed="12" result="n"/><feColorMatrix in="n" values=".55 0 0 0 0 0 .55 0 0 0 0 0 .55 0 0 0 0 0 .17 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
      <filter id="metalGlow"><feGaussianBlur stdDeviation="1.4"/></filter>
    </defs>
    <circle cx="300" cy="300" r="294" fill="#020304" filter="url(#boardShadow)"/>
    <circle cx="300" cy="300" r="291" fill="url(#rimG)" stroke="#050608" stroke-width="4"/>
    <circle cx="300" cy="300" r="279" fill="#080b0f" stroke="#8a929c" stroke-width="2"/>
    <circle cx="300" cy="300" r="272" fill="url(#boardBase)"/>
    <circle cx="300" cy="300" r="268" fill="none" stroke="#d7dbe0" stroke-opacity=".2" stroke-width="2"/>`;
  const rings=[43,54,126,150,216,239,268];
  for(let i=0;i<20;i++){
    const a0=i*18-9,a1=i*18+9,light=i%2===0;
    const base=light?'url(#sisalCream)':'url(#sisalBlack)';
    svg+=`<path class="board-wedge" data-seg="${nums[i]}" d="${sectorPath(cx,cy,54,268,a0,a1)}" fill="${base}" filter="url(#sisalNoise)"/>`;
    svg+=`<path d="${sectorPath(cx,cy,54,126,a0,a1)}" fill="${base}" opacity=".98"/>`;
    svg+=`<path d="${sectorPath(cx,cy,126,150,a0,a1)}" fill="url(#${i%2===0?'redG':'greenG'})"/>`;
    svg+=`<path d="${sectorPath(cx,cy,150,216,a0,a1)}" fill="${base}" filter="url(#sisalNoise)"/>`;
    svg+=`<path d="${sectorPath(cx,cy,216,239,a0,a1)}" fill="url(#${i%2===0?'greenG':'redG'})"/>`;
    svg+=`<path d="${sectorPath(cx,cy,239,268,a0,a1)}" fill="${base}" opacity=".98"/>`;
  }
  // Strong, readable wire rings: the inner colored band is TRIPLE, the outer colored band is DOUBLE.
  svg+=`<circle cx="300" cy="300" r="126" fill="none" stroke="#d7dbe0" stroke-width="2" opacity=".9"/>
    <circle cx="300" cy="300" r="150" fill="none" stroke="#c9cfd6" stroke-width="4" opacity=".95"/>
    <circle cx="300" cy="300" r="216" fill="none" stroke="#d7dbe0" stroke-width="2" opacity=".95"/>
    <circle cx="300" cy="300" r="239" fill="none" stroke="#c9cfd6" stroke-width="4" opacity=".95"/>`;
  for(let i=0;i<20;i++){
    const a=i*18-9,p1=polarPoint(cx,cy,43,a),p2=polarPoint(cx,cy,268,a);
    svg+=`<line x1="${p1[0]}" y1="${p1[1]}" x2="${p2[0]}" y2="${p2[1]}" stroke="#d8dde2" stroke-width="2.8" opacity=".9"/>
      <circle cx="${p2[0]}" cy="${p2[1]}" r="1.8" fill="#fff" opacity=".7"/>`;
  }
  // Crisp outer scoring edge and center rings.
  svg+=`<circle cx="300" cy="300" r="268" fill="none" stroke="#f0f2f4" stroke-width="2" opacity=".45"/>
    <circle cx="300" cy="300" r="54" fill="#11161c" stroke="#bfc5cc" stroke-width="4"/>
    <circle cx="300" cy="300" r="43" fill="url(#greenG)" stroke="#1b2612" stroke-width="3"/>
    <circle cx="300" cy="300" r="23" fill="#d92735" stroke="#650e17" stroke-width="4"/>
    <circle cx="300" cy="300" r="12" fill="#ff4b51" opacity=".85"/>
    <text x="300" y="304" class="bull-label" text-anchor="middle">BULL</text>`;
  for(let i=0;i<20;i++){
    const lp=polarPoint(cx,cy,281,i*18);
    svg+=`<text x="${lp[0]}" y="${lp[1]+7}" class="board-number" text-anchor="middle">${nums[i]}</text>`;
  }
  // Tiny ring labels reinforce the visual distinction without cluttering the board.
  svg+=`<g class="ring-labels" aria-hidden="true">
      <text x="300" y="158" text-anchor="middle" class="ring-label triple-label">TRIPLE</text>
      <text x="300" y="518" text-anchor="middle" class="ring-label double-label">DOUBLE</text>
    </g>
    <path d="M300 25 A275 275 0 0 1 550 160" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="9" stroke-linecap="round"/>
    <path d="M75 445 A275 275 0 0 0 185 535" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="12" stroke-linecap="round"/>`;
  svg+=`</svg>`;
  el.innerHTML=`${svg}<div class="dartboard-hint">Tap a scoring area · darts appear where you scored</div>`;
  $$('#dartboardVisual .board-wedge').forEach(b=>b.addEventListener('click',()=>setThrow(activeThrow,Number(b.dataset.seg))));
  renderBoardDarts();
}
function setThrow(i,value){const input=$('#t'+(i+1));if(!input)return;input.value=value;throwSelection[i]=value;activeThrow=(i+1)%3;$$('.throw-inputs input').forEach((x,j)=>x.classList.toggle('selected-throw',j===activeThrow));renderBoardDarts();updateRoundTotal();}
function updateRoundTotal(){const total=throwSelection[0]+throwSelection[1]+throwSelection[2];const el=$('#roundTotal');if(el)el.textContent=total||0;const chips=$$('#roundDartSummary .round-dart-chip');chips.forEach((c,i)=>{const v=throwSelection[i];c.querySelector('.chip-score').textContent=v??'—';c.classList.toggle('filled',Number.isInteger(v));});}
function renderDarts(){if(!darts.active)return;$('#dartsTargetLabel').textContent=darts.target;$('#dartsRoundLabel').textContent=darts.round;const sorted=[...darts.players].sort((a,b)=>a.score-b.score);$('#dartsBoard').innerHTML=sorted.map(p=>`<div class="score-card ${p.id===darts.players[darts.current].id?'current':''} ${p.score===0?'winner':''}"><div class="player-row">${avatar(p,true)}<strong>${esc(p.name)}</strong></div><div class="score-big">${p.score}</div><div class="score-sub">${p.scored} total points scored</div></div>`).join('');const p=darts.players[darts.current];throwSelection[0]=throwSelection[1]=throwSelection[2]=null;activeThrow=0;$('#throwPanel').innerHTML=`<div class="throw-title"><div><h3>${avatar(p,true)} ${esc(p.name)}'s throw</h3><span class="turn-subtitle">Tap the board or enter each dart score</span></div><span class="muted">Remaining ${p.score}</span></div><div id="roundDartSummary" class="round-dart-summary"><div class="round-dart-chip"><span>DART 1</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 2</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 3</span><b class="chip-score">—</b></div><div class="round-total-box"><span>ROUND TOTAL</span><b id="roundTotal">0</b></div></div><div class="throw-inputs"><input id="t1" type="number" min="0" max="60" step="1" placeholder="1st"><input id="t2" type="number" min="0" max="60" step="1" placeholder="2nd"><input id="t3" type="number" min="0" max="60" step="1" placeholder="3rd"></div><div class="throw-actions"><button class="primary-btn" id="submitDarts">Add round →</button></div>`;$$('.throw-inputs input').forEach((x,i)=>{x.onfocus=()=>activeThrow=i;x.oninput=()=>{const v=x.value.trim();throwSelection[i]=v===''?null:Number(v);renderBoardDarts();updateRoundTotal()};});$('#submitDarts').onclick=submitDarts;makeDartboard();updateRoundTotal();renderDartsHistory();}
function isValidDartScore(value){
  if(!Number.isInteger(value) || value<0 || value>60)return false;
  if(value===0 || value===25 || value===50)return true;
  if(value>=1 && value<=20)return true;
  if(value%2===0 && value/2>=1 && value/2<=20)return true;
  if(value%3===0 && value/3>=1 && value/3<=20)return true;
  return false;
}
function submitDarts(){
  const raw=[1,2,3].map(i=>$('#t'+i).value.trim());
  const vals=raw.map(v=>v===''?0:Number(v));
  const invalid=vals.findIndex(v=>!isValidDartScore(v));
  if(invalid!==-1){
    const dartNo=invalid+1;
    toast(`Invalid dart ${dartNo}. Use 0, 1–20, doubles, triples, 25 or 50.`);
    $('#t'+dartNo).focus();
    return;
  }
  const total=vals.reduce((a,b)=>a+b,0);
  const p=darts.players[darts.current];
  if(total>p.score){toast('Bust! Score stays where it is.');darts.history.push({player:p.name,round:darts.round,throws:vals,total:0,bust:true});nextDarts();return}
  p.score-=total;p.scored+=total;darts.history.push({player:p.name,round:darts.round,throws:vals,total,bust:false});broadcast();if(p.score===0){renderDarts();setTimeout(()=>toast(`🏆 ${p.name} wins the game!`),100);return}nextDarts()}
function nextDarts(){darts.current=(darts.current+1)%darts.players.length;if(darts.current===0)darts.round++;renderDarts();broadcast()};
function renderDartsHistory(){const h=[...darts.history].reverse().slice(0,8);$('#dartsHistory').innerHTML=h.length?h.map(x=>`<div class="history-row"><span>R${x.round} · ${esc(x.player)}</span><strong>${x.bust?'BUST':`+${x.total}`}</strong></div>`).join(''):'<div class="muted">No throws yet.</div>'}
$('#undoDarts').onclick=()=>{if(!darts.history.length)return;const last=darts.history.pop();const p=darts.players.find(x=>x.name===last.player);if(p&&!last.bust){p.score+=last.total;p.scored-=last.total}darts.current=darts.players.findIndex(x=>x.name===last.player);darts.round=Math.max(1,last.round);renderDarts();broadcast()};
$('#startBaseball').onclick=()=>{if(baseball.players.length<1)return toast('Add at least one player');baseball={active:true,inning:1,current:0,players:baseball.players.map(p=>({...p,total:0,innings:Array(9).fill(null)})),history:[]};$('#baseballSetup').classList.add('hidden');$('#baseballGame').classList.remove('hidden');renderBaseball();broadcast()};
$('#newBaseball').onclick=()=>{$('#baseballGame').classList.add('hidden');$('#baseballSetup').classList.remove('hidden')};
function renderBaseball(){const cp=baseball.players[baseball.current];$('#inningLabel').textContent=`${baseball.inning} / 9`;$('#baseballBoard').innerHTML=baseball.players.map(p=>`<div class="score-card ${p.id===cp.id?'current':''}"><div class="player-row">${avatar(p,true)}<strong>${esc(p.name)}</strong></div><div class="score-big">${p.total}</div><div class="score-sub">Inning ${baseball.inning}: ${p.innings[baseball.inning-1]??'—'}</div></div>`).join('');$('#baseballInput').innerHTML=`<div class="throw-title"><h3>⚾ ${esc(cp.name)} · inning ${baseball.inning}</h3><span class="muted">Enter runs</span></div><div class="throw-inputs" style="grid-template-columns:1fr"><input id="runs" type="number" min="0" max="50" placeholder="0"></div><div class="throw-actions"><button class="primary-btn" id="submitRuns">Record inning →</button></div>`;$('#submitRuns').onclick=submitRuns;$('#baseballHistory').innerHTML=[...baseball.history].reverse().slice(0,10).map(x=>`<div class="history-row"><span>Inning ${x.inning} · ${esc(x.player)}</span><strong>+${x.runs}</strong></div>`).join('')||'<div class="muted">No innings yet.</div>'}
function submitRuns(){const runs=Math.max(0,Math.min(50,Number($('#runs').value)||0)),p=baseball.players[baseball.current];p.innings[baseball.inning-1]=runs;p.total+=runs;baseball.history.push({inning:baseball.inning,player:p.name,runs});baseball.current=(baseball.current+1)%baseball.players.length;if(baseball.current===0){if(baseball.inning===9){renderBaseball();broadcast();const winner=[...baseball.players].sort((a,b)=>b.total-a.total)[0];setTimeout(()=>toast(`🏆 ${winner.name} wins with ${winner.total}!`),100);return}baseball.inning++}renderBaseball();broadcast()}
$('#undoBaseball').onclick=()=>{if(!baseball.history.length)return;const x=baseball.history.pop(),p=baseball.players.find(p=>p.name===x.player);if(p){p.total-=x.runs;p.innings[x.inning-1]=null}baseball.inning=x.inning;baseball.current=baseball.players.findIndex(p=>p.name===x.player);renderBaseball();broadcast()};
$('#resetApp').onclick=()=>{if(confirm('Reset the current game?')){darts.active=false;baseball.active=false;$('#dartsGame,#baseballGame').forEach(x=>x.classList.add('hidden'));$('#dartsSetup,#baseballSetup').forEach(x=>x.classList.remove('hidden'));broadcast();toast('Game reset')}};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function state(){return JSON.stringify({darts,baseball})}
function applyState(raw){try{const s=typeof raw==='string'?JSON.parse(raw):raw;if(s.darts){darts=s.darts; if(darts.active){$('#dartsSetup').classList.add('hidden');$('#dartsGame').classList.remove('hidden');renderDarts()}}if(s.baseball){baseball=s.baseball;if(baseball.active){$('#baseballSetup').classList.add('hidden');$('#baseballGame').classList.remove('hidden');renderBaseball()}}}catch(e){console.warn(e)}}
function firebaseReady(){return window.firebase && window.THROW_FIREBASE_CONFIG && window.THROW_FIREBASE_CONFIG.apiKey && !String(window.THROW_FIREBASE_CONFIG.apiKey).startsWith('PASTE_') && window.THROW_FIREBASE_CONFIG.databaseURL && !String(window.THROW_FIREBASE_CONFIG.databaseURL).includes('YOUR_PROJECT')}
function setLiveStatus(msg){const el=$('#roomStatus');if(el)el.textContent=msg}
function state(){return JSON.stringify({darts,baseball})}
function applyState(raw){try{const s=typeof raw==='string'?JSON.parse(raw):raw;if(s.darts){darts=s.darts;if(darts.active){$('#dartsSetup').classList.add('hidden');$('#dartsGame').classList.remove('hidden');renderDarts()}}if(s.baseball){baseball=s.baseball;if(baseball.active){$('#baseballSetup').classList.add('hidden');$('#baseballGame').classList.remove('hidden');renderBaseball()}}}catch(e){console.warn(e)}}
function initFirebase(){
  if(!firebaseReady()){setLiveStatus('Firebase config is missing or still contains placeholders.');return false}
  if(!window.firebase){setLiveStatus('Firebase SDK did not load. Check your internet connection.');return false}
  try{
    firebaseApp=firebase.apps.length?firebase.app():firebase.initializeApp(window.THROW_FIREBASE_CONFIG);
    auth=firebase.auth();db=firebase.database();
    authReadyPromise=new Promise((resolve,reject)=>{
      let settled=false;
      const unsubscribe=auth.onAuthStateChanged(user=>{
        currentUid=user?user.uid:null;
        if(user && !settled){
          settled=true;
          unsubscribe();
          resolve(user);
          if(!hostMode) subscribeToRoom();
        }
      }, err=>{
        if(!settled){
          settled=true;
          unsubscribe();
          reject(err);
        }
      });
      window.__throwAuthTimer=setTimeout(()=>{
        if(!settled){
          settled=true;
          unsubscribe();
          const err=new Error('Firebase authentication timed out. Add your deployed domain to Firebase Authentication > Settings > Authorized domains.');
          err.code='auth/timeout';
          reject(err);
        }
      },10000);
    });
    auth.signInAnonymously().catch(err=>{
      console.error('Anonymous auth failed',err);
      const code=err.code||'auth/unknown';
      let msg=code;
      if(code==='auth/unauthorized-domain') msg='This deployed domain is not authorized in Firebase. Add it under Authentication → Settings → Authorized domains.';
      else if(code==='auth/operation-not-allowed') msg='Anonymous Authentication is not enabled in Firebase.';
      else if(code==='auth/network-request-failed') msg='Firebase authentication network request failed. Check the deployed site connection.';
      setLiveStatus('Firebase login failed: '+msg);
      toast('Firebase login failed — see Live room status.');
    });
    return true;
  }catch(e){console.error(e);setLiveStatus('Firebase error: '+(e.code||e.message||'check firebase-config.js'));return false}
}
function makeRoomId(){return Math.random().toString(36).slice(2,7).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase()}
function subscribeToRoom(){
  if(!db||!roomId)return;
  roomRef=db.ref('rooms/'+roomId);
  roomRef.on('value',snap=>{const room=snap.val();if(!room){setLiveStatus('Room not found. Check the QR/link.');return}applyState(room.state);setLiveStatus('● Live · synced with host')},err=>setLiveStatus('Could not read this room. Check Firebase rules.'));
}
async function createLiveRoom(){
  if(!firebaseReady() || !db){setLiveStatus('Firebase is not ready. Check firebase-config.js and reload.');return}
  try{
    if(authReadyPromise && !currentUid) await authReadyPromise;
    if(!currentUid){setLiveStatus('Firebase login has not completed. Reload and check Authentication → Settings → Authorized domains.');return}
    roomId=makeRoomId();
    roomRef=db.ref('rooms/'+roomId);
    const initialState=JSON.parse(state());
    await roomRef.set({hostUid:currentUid,state:initialState,createdAt:firebase.database.ServerValue.TIMESTAMP});
    hostMode=true;
    history.replaceState(null,'',location.pathname+'?room='+encodeURIComponent(roomId));
    showRoom(roomId);
  }catch(err){
    console.error('Room creation failed',err);
    const reason=err && (err.code||err.message) ? (err.code||err.message) : 'unknown error';
    let friendly=reason;
    if(reason.includes('PERMISSION_DENIED') || reason.includes('permission-denied')) friendly='Firebase Database permission denied. Make sure Anonymous Auth is enabled and the published database rules match this app.';
    setLiveStatus('Could not create room: '+friendly);
    toast('Room creation failed — see Live room status.');
  }
}
function broadcast(){
  if(!hostMode||!roomRef)return;
  roomRef.update({state:JSON.parse(state()),updatedAt:firebase.database.ServerValue.TIMESTAMP}).catch(e=>console.warn(e));
}
function showRoom(id){
  $('#roomModal').classList.remove('hidden');$('#qrcode').innerHTML='';
  const link=location.origin+location.pathname+'?room='+encodeURIComponent(id);
  if(window.QRCode){ new QRCode($('#qrcode'),{text:link,width:220,height:220}); } else { $('#qrcode').innerHTML='<p class="muted">QR library did not load. Use the room link below.</p>'; }
  $('#roomCode').textContent=id;
  const local=location.hostname==='localhost'||location.hostname==='127.0.0.1';
  setLiveStatus(local ? 'Room created. For phone scanning, deploy the app to Vercel/Netlify first; localhost is only reachable on this computer.' : '● Room created · scan this code on every phone.');
}
$('#shareRoom').onclick=()=>{if(!hostMode)return toast('This phone is a viewer.');if(roomRef&&roomId)showRoom(roomId);else createLiveRoom()};
$('#closeRoom').onclick=()=>$('#roomModal').classList.add('hidden');
$('#copyRoomLink').onclick=async()=>{const link=location.origin+location.pathname+'?room='+encodeURIComponent(roomId);try{await navigator.clipboard.writeText(link);toast('Room link copied')}catch(e){toast(link)}};
if(!hostMode){document.body.insertAdjacentHTML('afterbegin','<div class="viewer-banner">📱 <b>Live viewer mode</b> — this phone is following the host scoreboard. Scoring controls are disabled here.</div>');$('#dartsSetup').classList.add('hidden');$('#baseballSetup').classList.add('hidden');}
initFirebase();
if(hostMode)makeDartboard();
renderPlayers();renderPicker('dartsPlayerPicker',[]);renderPicker('baseballPlayerPicker',[]);

// ---------- THROW LEAGUE ----------
const LEAGUE_DEFAULT_RATING = 1000;
let leagueMode = 'overall';
let leaguePlayers = {};
let leagueMatches = [];
function leaguePlayer(id, base) {
  if (!leaguePlayers[id]) leaguePlayers[id] = { id, name: base?.name || 'Player', photo: base?.photo || '', color: base?.color || colors[0], games: 0, wins: 0, losses: 0, rating: LEAGUE_DEFAULT_RATING, darts: {games:0,wins:0,losses:0,rating:LEAGUE_DEFAULT_RATING,streak:0,bestStreak:0}, baseball:{games:0,wins:0,losses:0,rating:LEAGUE_DEFAULT_RATING,streak:0,bestStreak:0}, streak:0, bestStreak:0 };
  return leaguePlayers[id];
}
function hydrateLeague() {
  players.forEach(p=>leaguePlayer(p.id,p));
}
function eloDelta(playerRating, opponentRatings, won) {
  if (!opponentRatings.length) return 0;
  const avg = opponentRatings.reduce((a,b)=>a+b,0)/opponentRatings.length;
  const expected = 1/(1+Math.pow(10,(avg-playerRating)/400));
  return Math.round(32*((won?1:0)-expected));
}
function awardBadges(p, mode) {
  const badges=[];
  if(p.wins>=10) badges.push('🏆 10+ wins');
  if(p[mode]?.bestStreak>=5) badges.push('🔥 5-win streak');
  if(p[mode]?.wins>=1 && p[mode]?.wins===p[mode]?.games) badges.push('💯 Unbeaten');
  return badges;
}
function completeLeagueMatch(mode, participantIds, winnerId, scores={}) {
  hydrateLeague();
  const ps=participantIds.map(id=>leaguePlayer(id,players.find(p=>p.id===id))).filter(Boolean);
  const winner=ps.find(p=>p.id===winnerId); if(!winner) return;
  const changes={};
  ps.forEach(p=>{const opp=ps.filter(x=>x.id!==p.id).map(x=>x[mode].rating); const delta=eloDelta(p[mode].rating,opp,p.id===winnerId); changes[p.id]=delta;});
  ps.forEach(p=>{
    const m=p[mode]; p.games++; m.games++; if(p.id===winnerId){p.wins++;m.wins++;p.streak++;m.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak);m.bestStreak=Math.max(m.bestStreak,m.streak)} else {p.losses++;m.losses++;p.streak=0;m.streak=0}
    p.rating+=changes[p.id]; m.rating+=changes[p.id];
  });
  const match={id:crypto.randomUUID(),mode,participants:participantIds,winnerId,scores,changes,createdAt:Date.now()};
  leagueMatches.unshift(match); leagueMatches=leagueMatches.slice(0,100);
  saveLeague(); renderLeaderboard();
}
function saveLeague() {
  localStorage.setItem('throwLeaguePlayers',JSON.stringify(leaguePlayers));
  localStorage.setItem('throwLeagueMatches',JSON.stringify(leagueMatches));
  if(db && currentUid) db.ref('league/players').set(leaguePlayers).catch(()=>{});
  if(db && currentUid) db.ref('league/matches').set(Object.fromEntries(leagueMatches.map(m=>[m.id,m]))).catch(()=>{});
}
function loadLeague() {
  try { leaguePlayers=JSON.parse(localStorage.getItem('throwLeaguePlayers')||'{}'); leagueMatches=JSON.parse(localStorage.getItem('throwLeagueMatches')||'[]'); } catch(e){leaguePlayers={};leagueMatches=[]}
  hydrateLeague(); renderLeaderboard();
}
function subscribeLeague() {
  if(!db || !currentUid) return;
  db.ref('league/players').on('value',s=>{const v=s.val();if(v){leaguePlayers=v;localStorage.setItem('throwLeaguePlayers',JSON.stringify(v));renderLeaderboard();}});
  db.ref('league/matches').on('value',s=>{const v=s.val();if(v){leagueMatches=Object.values(v).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));localStorage.setItem('throwLeagueMatches',JSON.stringify(leagueMatches));renderLeaderboard();}});
}
function renderLeaderboard() {
  const el=$('#leaderboardTable'); if(!el) return; hydrateLeague();
  const list=Object.values(leaguePlayers).map(p=>({p,stats:leagueMode==='overall'?p:p[leagueMode]})).sort((a,b)=>b.stats.rating-a.stats.rating);
  if(!list.length){el.innerHTML='<div class="setup-panel"><h3 style="margin-top:0">No league games yet.</h3><p class="muted">Finish a game and THROW will build the rankings automatically.</p></div>';}
  else el.innerHTML=list.map(({p,stats},i)=>{const pct=stats.games?Math.round(stats.wins/stats.games*100):0;const badges=awardBadges(p,leagueMode==='overall'?'darts':leagueMode);return `<div class="leader-row"><div class="leader-rank">${i<3?['🥇','🥈','🥉'][i]:'#'+(i+1)}</div><div class="leader-player">${avatar(p,true)}<div><span>${esc(p.name)}</span><div class="badge-row">${badges.slice(0,2).map(b=>`<span class="badge">${b}</span>`).join('')}</div></div></div><div class="leader-rating">${stats.rating}</div><div class="leader-wl">${stats.wins}-${stats.losses}</div><div class="leader-win">${pct}%</div></div>`}).join('');
  const hist=$('#leagueHistory'); if(hist){hist.innerHTML=leagueMatches.slice(0,12).map(m=>{const win=leaguePlayers[m.winnerId];const names=m.participants.map(id=>leaguePlayers[id]?.name||'Player').join(', ');const ch=m.changes?.[m.winnerId]||0;return `<div class="match-result"><div class="match-game">${m.mode==='baseball'?'⚾':'🎯'} ${m.mode}</div><div><div class="match-winner">🏆 ${esc(win?.name||'Winner')}</div><div class="match-meta">vs ${esc(names.replace(win?.name||'Winner','').replace(/^, /,''))}</div></div><div class="rating-up">+${ch}</div></div>`}).join('')||'<div class="muted">No completed matches yet.</div>'}
}
$$('[data-leader]').forEach(b=>b.onclick=()=>{$$('[data-leader]').forEach(x=>x.classList.remove('active'));b.classList.add('active');leagueMode=b.dataset.leader;renderLeaderboard()});

// Wrap game completion hooks so league stats are recorded exactly once.
const _submitDartsOriginal = submitDarts;
submitDarts = function(){
  const before=darts.players.map(p=>({id:p.id,score:p.score}));
  _submitDartsOriginal();
  const winner=darts.players.find(p=>p.score===0);
  if(winner && !darts.__leagueRecorded){darts.__leagueRecorded=true;completeLeagueMatch('darts',darts.players.map(p=>p.id),winner.id,Object.fromEntries(darts.players.map(p=>[p.id,p.score])))}
};
const _submitRunsOriginal = submitRuns;
submitRuns = function(){
  const wasFinal=baseball.inning===9 && baseball.current===baseball.players.length-1;
  _submitRunsOriginal();
  if(wasFinal && !baseball.__leagueRecorded){baseball.__leagueRecorded=true;const winner=[...baseball.players].sort((a,b)=>b.total-a.total)[0];completeLeagueMatch('baseball',baseball.players.map(p=>p.id),winner.id,Object.fromEntries(baseball.players.map(p=>[p.id,p.total])))}
};
const _newDartsOriginal=$('#newDarts').onclick; $('#newDarts').onclick=function(){darts.__leagueRecorded=false;_newDartsOriginal&&_newDartsOriginal()};
const _newBaseballOriginal=$('#newBaseball').onclick; $('#newBaseball').onclick=function(){baseball.__leagueRecorded=false;_newBaseballOriginal&&_newBaseballOriginal()};

// Load shared league data after Firebase auth is ready.
if(authReadyPromise){ authReadyPromise.then(()=>subscribeLeague()).catch(()=>{}); }
loadLeague();
