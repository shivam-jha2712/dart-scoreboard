const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const colors=['#b9f34a','#7c5cff','#4dd7ff','#ff9f43','#ff6b9d','#62e6a5'];
let players=JSON.parse(localStorage.getItem('throwPlayers')||'[]');
let darts={active:false,target:501,round:1,current:0,players:[],history:[]};
let baseball={active:false,inning:1,current:0,players:[],history:[]};
let target={active:false,round:1,rounds:10,current:0,players:[],history:[]};
let roomId=new URLSearchParams(location.search).get('room');
let hostMode=!roomId;
let firebaseApp=null, db=null, auth=null, currentUid=null, roomRef=null, authReadyPromise=null;
const throwSelection={0:null,1:null,2:null};
let draftThrows=[null,null,null];
let activeThrow=0;
const baseballThrowSelection={0:null,1:null,2:null};
let baseballDraftThrows=[null,null,null];
let baseballActiveThrow=0;
const targetThrowSelection={0:null,1:null,2:null};
let targetDraftThrows=[null,null,null];
let targetActiveThrow=0;
function savePlayers(){localStorage.setItem('throwPlayers',JSON.stringify(players));}
function initials(name){return name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()}
function avatar(p,small=false){return p.photo?`<img class="${small?'mini-avatar':'avatar'}" src="${p.photo}" alt="${esc(p.name)}">`:`<span class="${small?'mini-avatar':'avatar'}" style="background:${p.color||colors[0]}">${initials(p.name)}</span>`}
function nav(view){$$('.view').forEach(v=>v.classList.toggle('active-view',v.id===view));$$('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));window.scrollTo({top:0,behavior:'smooth'});if(view==='darts')renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));if(view==='baseball')renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));if(view==='target')renderPicker('targetPlayerPicker',target.players.map(p=>p.id));}
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>nav(b.dataset.view)));
function renderPlayers(){const grid=$('#playersGrid');if(!players.length){grid.innerHTML='<div class="setup-panel"><h3 style="font-family:Space Grotesk;margin-top:0">No players yet.</h3><p style="color:var(--muted)">Add your crew and their faces/initials will appear on the scoreboard.</p></div>';return}grid.innerHTML=players.map(p=>`<div class="player-card">${avatar(p)}<div class="player-card-info"><strong>${esc(p.name)}</strong><span>Ready to throw</span></div><button class="delete-btn" data-del="${p.id}" title="Delete">×</button></div>`).join('');$$('[data-del]').forEach(b=>b.onclick=()=>{players=players.filter(p=>p.id!==b.dataset.del);savePlayers();renderPlayers();renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));renderPicker('targetPlayerPicker',target.players.map(p=>p.id));});}
function renderPicker(id,selected){const el=$('#'+id);if(!players.length){el.innerHTML='<span class="muted">Add players first →</span>';return}el.innerHTML=players.map(p=>`<button class="player-chip ${selected.includes(p.id)?'selected':''}" data-pick="${p.id}">${avatar(p,true)}${esc(p.name)}</button>`).join('');$$('#'+id+' [data-pick]').forEach(b=>b.onclick=()=>{const mode=id.startsWith('darts')?'darts':id.startsWith('baseball')?'baseball':'target';const arr=mode==='darts'?darts.players:mode==='baseball'?baseball.players:target.players;const p=players.find(x=>x.id===b.dataset.pick);if(!p)return;const next=arr.some(x=>x.id===p.id)?arr.filter(x=>x.id!==p.id):[...arr,p];if(mode==='darts')darts.players=next;else if(mode==='baseball')baseball.players=next;else target.players=next;renderPicker(id,next.map(x=>x.id));});}
function openModal(){$('#modal').classList.remove('hidden');$('#playerName').focus()};function closeModal(){$('#modal').classList.add('hidden');$('#playerForm').reset();$('#avatarPreview').innerHTML='?'}
$('#addPlayerBtn').onclick=openModal;$('#closeModal').onclick=closeModal;$('#playerPhoto').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>$('#avatarPreview').innerHTML=`<img src="${r.result}" alt="preview">`;r.readAsDataURL(f)};
$('#playerForm').onsubmit=e=>{e.preventDefault();const name=$('#playerName').value.trim();if(!name)return;const f=$('#playerPhoto').files[0];const add=photo=>{players.push({id:crypto.randomUUID(),name,photo:photo||'',color:colors[players.length%colors.length]});savePlayers();renderPlayers();renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));renderPicker('baseballPlayerPicker',baseball.players.map(p=>p.id));renderPicker('targetPlayerPicker',target.players.map(p=>p.id));closeModal();toast(`${name} joined the crew ✦`)};if(f){const r=new FileReader();r.onload=()=>add(r.result);r.readAsDataURL(f)}else add('')};
$$('.score-option').forEach(b=>b.onclick=()=>{$$('.score-option').forEach(x=>x.classList.remove('active'));b.classList.add('active');$('#customScore').classList.toggle('hidden',b.dataset.score!=='custom')});
$('#startDarts').onclick=()=>{if(darts.players.length<1)return toast('Add at least one player');const sel=$('.score-option.active').dataset.score;const target=sel==='custom'?Number($('#customScore').value):Number(sel);if(!target||target<1)return toast('Choose a valid target');darts={active:true,target,round:1,current:0,players:darts.players.map(p=>({...p,score:target,scored:0})),history:[]};$('#dartsSetup').classList.add('hidden');$('#dartsGame').classList.remove('hidden');renderDarts();broadcast()};
$('#newDarts').onclick=()=>{darts.active=false;$('#dartsGame').classList.add('hidden');$('#dartsSetup').classList.remove('hidden');renderPicker('dartsPlayerPicker',darts.players.map(p=>p.id));};
function polarPoint(cx,cy,r,deg){const a=(deg-90)*Math.PI/180;return [cx+r*Math.cos(a),cy+r*Math.sin(a)]}
function sectorPath(cx,cy,r1,r2,a0,a1){const p1=polarPoint(cx,cy,r2,a0),p2=polarPoint(cx,cy,r2,a1),p3=polarPoint(cx,cy,r1,a1),p4=polarPoint(cx,cy,r1,a0);const large=Math.abs(a1-a0)>180?1:0;return `M ${p1[0]} ${p1[1]} A ${r2} ${r2} 0 ${large} 1 ${p2[0]} ${p2[1]} L ${p3[0]} ${p3[1]} A ${r1} ${r1} 0 ${large} 0 ${p4[0]} ${p4[1]} Z`}
function dartScoreTarget(score){
  if(score===50)return {ring:'bull',r:0,angle:0,label:'Bullseye'};
  if(score===25)return {ring:'outer-bull',r:34,angle:35,label:'Outer bull'};
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
  if(score===0)return '';
  const t=dartScoreTarget(score);
  const radialDeg=t.angle + (index-1)*2.0;
  const a=(radialDeg-90)*Math.PI/180;
  const x=300+Math.cos(a)*t.r;
  const y=300+Math.sin(a)*t.r;
  const left=(x/600*100).toFixed(4);
  const top=(y/600*100).toFixed(4);
  const src=index===1?'dart-red.png':'dart-yellow.png';
  const label=`${score}`;
  // The source image is photographed horizontally with its steel point on the LEFT.
  // Therefore the point is the exact anchor and the dart body extends radially OUTWARD.
  const cssAngle=(radialDeg-90).toFixed(2);
  return `<div class="planted-dart-real dart-${index+1}" data-score="${score}" style="--x:${left}%;--y:${top}%;--rot:${cssAngle}deg;--delay:${(index*.07).toFixed(2)}s">
    <div class="dart-real-shadow"></div>
    <img src="${src}" alt="${label} dart" draggable="false">
    <span class="dart-score-badge">${label}</span>
  </div>`;
}
function renderBoardDarts(){
  const board=$('#dartboardVisual'); if(!board)return;
  let layer=board.querySelector('.planted-darts-real-layer');
  if(layer)layer.remove();
  layer=document.createElement('div');
  layer.className='planted-darts-real-layer';
  // Only committed throws live in throwSelection. Draft typing never reaches this layer.
  layer.innerHTML=[0,1,2].map(i=>Number.isInteger(throwSelection[i])?makeDartElement(throwSelection[i],i):'').join('');
  board.appendChild(layer);
}
function makeDartboard(){
  const el=$('#dartboardVisual'); if(!el)return;
  const nums=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];
  const cx=300,cy=300;
  // The visual board is a photorealistic rendered board; the SVG below is an invisible
  // interaction layer so scoring remains precise without flattening the artwork.
  let svg=`<svg class="dartboard-svg dartboard-hit-layer" viewBox="0 0 600 600" aria-label="Interactive realistic darts board">`;
  for(let i=0;i<20;i++){
    const a0=i*18-9,a1=i*18+9;
    // Separate invisible hit regions for single, triple and double.
    svg+=`<path class="hit-zone" data-score-area="${nums[i]}" data-ring="single" d="${sectorPath(cx,cy,150,268,a0,a1)}"/>`;
    svg+=`<path class="hit-zone" data-score-area="${nums[i]*3}" data-ring="triple" d="${sectorPath(cx,cy,126,150,a0,a1)}"/>`;
    svg+=`<path class="hit-zone" data-score-area="${nums[i]*2}" data-ring="double" d="${sectorPath(cx,cy,216,239,a0,a1)}"/>`;
  }
  svg+=`<circle class="hit-zone" data-score-area="25" data-ring="outer-bull" cx="300" cy="300" r="43"/>
         <circle class="hit-zone" data-score-area="50" data-ring="bull" cx="300" cy="300" r="23"/>
         </svg>`;
  el.innerHTML=`<div class="real-board-wrap"><img class="real-board-image" src="dartboard-realistic.png" alt="Realistic darts board"><div class="board-glass-highlight"></div>${svg}</div><div class="dartboard-hint">Tap a scoring area · darts appear after the score is selected</div>`;
  $$('#dartboardVisual .hit-zone').forEach(z=>z.addEventListener('click',()=>{
    const score=Number(z.dataset.scoreArea);
    setThrow(activeThrow,score,true);
  }));
  renderBoardDarts();
}
function setThrow(i,value,fromBoard=false){
  const input=$('#t'+(i+1));if(!input)return;
  const v=Number(value);
  input.value=String(value);
  draftThrows[i]=v;
  if(fromBoard){
    throwSelection[i]=v;
    draftThrows[i]=v;
    activeThrow=Math.min(i+1,2);
    $$('.throw-inputs input').forEach((x,j)=>x.classList.toggle('selected-throw',j===activeThrow));
    updateRoundTotal();
    renderBoardDarts();
  } else {
    updateRoundTotal();
  }
}
function commitTypedThrow(i){
  const input=$('#t'+(i+1)); if(!input)return false;
  const raw=input.value.trim();
  if(raw===''){toast(`Dart ${i+1}: enter a score first.`);return false;}
  if(!/^\d+$/.test(raw)){toast(`Dart ${i+1}: enter a whole number.`);return false;}
  const v=Number(raw);
  if(!isValidDartScore(v)){toast(`Invalid dart ${i+1}. That score cannot be made with one dart.`);return false;}
  draftThrows[i]=v;throwSelection[i]=v;input.classList.remove('pending-throw');input.classList.add('committed-throw');updateRoundTotal();renderBoardDarts();
  if(i<2)activeThrow=i+1;
  return true;
}

function updateRoundTotal(){const total=draftThrows[0]+draftThrows[1]+draftThrows[2];const el=$('#roundTotal');if(el)el.textContent=total||0;const chips=$$('#roundDartSummary .round-dart-chip');chips.forEach((c,i)=>{const v=draftThrows[i];c.querySelector('.chip-score').textContent=v??'—';c.classList.toggle('filled',Number.isInteger(v));});}
function renderDarts(){
  if(!darts.active)return;
  const targetEl=$('#dartsTargetLabel'), roundEl=$('#dartsRoundLabel');
  if(targetEl)targetEl.textContent=darts.target;
  if(roundEl)roundEl.textContent=darts.round;
  const currentPlayer=darts.players[darts.current];
  if(!currentPlayer)return;

  const boardScores=$('#dartsBoard');
  if(boardScores){
    const sorted=[...darts.players].sort((a,b)=>a.score-b.score);
    boardScores.innerHTML=sorted.map(p=>`<div class="score-card ${p.id===currentPlayer.id?'current':''} ${p.score===0?'winner':''}"><div class="player-row">${avatar(p,true)}<strong>${esc(p.name)}</strong></div><div class="score-big">${p.score}</div><div class="score-sub">${p.scored} total points scored</div></div>`).join('');
  }

  throwSelection[0]=throwSelection[1]=throwSelection[2]=null;
  draftThrows[0]=draftThrows[1]=draftThrows[2]=null;
  activeThrow=0;

  const panel=$('#throwPanel');
  if(!panel)return;
  panel.style.display='block';
  panel.style.visibility='visible';
  panel.style.minHeight='360px';
  panel.innerHTML=`
    <div class="throw-title">
      <div><h3>${avatar(currentPlayer,true)} ${esc(currentPlayer.name)}'s throw</h3><span class="turn-subtitle">Enter each dart score. A dart is planted only after that score is committed.</span></div>
      <span class="muted">Remaining ${currentPlayer.score}</span>
    </div>
    <div id="roundDartSummary" class="round-dart-summary">
      <div class="round-dart-chip"><span>DART 1</span><b class="chip-score">—</b></div>
      <div class="round-dart-chip"><span>DART 2</span><b class="chip-score">—</b></div>
      <div class="round-dart-chip"><span>DART 3</span><b class="chip-score">—</b></div>
      <div class="round-total-box"><span>ROUND TOTAL</span><b id="roundTotal">0</b></div>
    </div>
    <div class="throw-inputs">
      ${[1,2,3].map(n=>`<div class="dart-entry" data-entry="${n-1}"><label>DART ${n}</label><input id="t${n}" inputmode="numeric" autocomplete="off" maxlength="2" placeholder="Score"><button type="button" class="commit-dart" data-commit="${n-1}" title="Commit Dart ${n}">✓</button></div>`).join('')}
    </div>
    <div class="dart-keypad">
      ${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-key="${n}">${n}</button>`).join('')}
      <button type="button" data-key="back">⌫</button><button type="button" data-key="clear">Clear</button>
    </div>
    <div class="throw-actions"><button type="button" class="primary-btn" id="submitDarts">Add round →</button></div>
  `;

  $$('.throw-inputs input').forEach((input,i)=>{
    input.addEventListener('focus',()=>{activeThrow=i; $$('.dart-entry').forEach((e,j)=>e.classList.toggle('active',j===i));});
    input.addEventListener('input',()=>{
      const raw=input.value.replace(/\D/g,'').slice(0,2);
      if(input.value!==raw)input.value=raw;
      draftThrows[i]=raw===''?null:Number(raw);
      input.classList.add('pending-throw');
      updateRoundTotal();
    });
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){e.preventDefault();commitTypedThrow(i);}
    });
  });
  $$('.commit-dart').forEach(btn=>btn.addEventListener('click',()=>{
    const i=Number(btn.dataset.commit); activeThrow=i; commitTypedThrow(i);
  }));
  $$('[data-key]').forEach(btn=>btn.addEventListener('click',()=>{
    const k=btn.dataset.key, input=$('#t'+(activeThrow+1)); if(!input)return;
    if(k==='back')input.value=input.value.slice(0,-1);
    else if(k==='clear')input.value='';
    else if(input.value.length<2)input.value+=k;
    const raw=input.value.replace(/\D/g,'').slice(0,2);
    input.value=raw; draftThrows[activeThrow]=raw===''?null:Number(raw); input.classList.add('pending-throw'); updateRoundTotal(); input.focus();
  }));
  $('#submitDarts').onclick=submitDarts;
  makeDartboard();
  updateRoundTotal();
  renderDartsHistory();
}

function isValidDartScore(value){
  if(!Number.isInteger(value) || value<0 || value>60)return false;
  if(value===0 || value===25 || value===50)return true;
  if(value>=1 && value<=20)return true;
  if(value%2===0 && value/2>=1 && value/2<=20)return true;
  if(value%3===0 && value/3>=1 && value/3<=20)return true;
  return false;
}
function submitDarts(){
  for(let i=0;i<3;i++){const raw=$('#t'+(i+1)).value.trim();if(raw!=='' && !Number.isInteger(throwSelection[i])){if(!commitTypedThrow(i))return;}}
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
$('#startBaseball').onclick=()=>{if(baseball.players.length<1)return toast('Add at least one player');baseball={active:true,inning:1,current:0,players:baseball.players.map(p=>({...p,total:0,innings:Array(9).fill(null),inningDarts:Array.from({length:9},()=>[null,null,null])})),history:[]};resetBaseballThrowDraft();$('#baseballSetup').classList.add('hidden');$('#baseballGame').classList.remove('hidden');renderBaseball();broadcast()};
$('#newBaseball').onclick=()=>{$('#baseballGame').classList.add('hidden');$('#baseballSetup').classList.remove('hidden');resetBaseballThrowDraft()};
function resetBaseballThrowDraft(){baseballThrowSelection[0]=baseballThrowSelection[1]=baseballThrowSelection[2]=null;baseballDraftThrows[0]=baseballDraftThrows[1]=baseballDraftThrows[2]=null;baseballActiveThrow=0}
function makeBaseballDartElement(score,index){return makeDartElement(score,index).replace('dart-score-badge">'+score,'dart-score-badge">'+score)}
function renderBaseballDarts(){
  const board=$('#baseballDartboardVisual'); if(!board)return;
  let layer=board.querySelector('.planted-darts-real-layer');
  if(layer)layer.remove();
  layer=document.createElement('div'); layer.className='planted-darts-real-layer';
  layer.innerHTML=[0,1,2].map(i=>Number.isInteger(baseballThrowSelection[i])?makeBaseballDartElement(baseballThrowSelection[i],i):'').join('');
  board.appendChild(layer);
}
function setBaseballThrow(i,value,fromBoard=false){
  const input=$('#b'+(i+1));if(!input)return;
  const v=Number(value); input.value=String(value); baseballDraftThrows[i]=v;
  if(fromBoard){baseballThrowSelection[i]=v;baseballActiveThrow=Math.min(i+1,2);$$('#baseballInput .throw-inputs input').forEach((x,j)=>x.classList.toggle('selected-throw',j===baseballActiveThrow));updateBaseballRoundTotal();renderBaseballDarts()}
  else updateBaseballRoundTotal();
}
function commitBaseballThrow(i){
  const input=$('#b'+(i+1));if(!input)return false;
  const raw=input.value.trim();
  if(raw===''){toast(`Dart ${i+1}: enter a score first.`);return false}
  if(!/^\d+$/.test(raw)){toast(`Dart ${i+1}: enter a whole number.`);return false}
  const v=Number(raw);
  if(!isValidDartScore(v)){toast(`Invalid dart ${i+1}. Use 0, 1–20, doubles, triples, 25 or 50.`);return false}
  baseballDraftThrows[i]=v;baseballThrowSelection[i]=v;input.classList.remove('pending-throw');input.classList.add('committed-throw');
  updateBaseballRoundTotal();renderBaseballDarts();if(i<2)baseballActiveThrow=i+1;return true;
}
function updateBaseballRoundTotal(){const total=baseballDraftThrows.reduce((a,b)=>a+(Number.isInteger(b)?b:0),0);const el=$('#baseballRoundTotal');if(el)el.textContent=total;const chips=$$('#baseballRoundDartSummary .round-dart-chip');chips.forEach((c,i)=>{const v=baseballDraftThrows[i];c.querySelector('.chip-score').textContent=v??'—';c.classList.toggle('filled',Number.isInteger(v));})}
function baseballHitSvg(){
  const nums=[20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5],cx=300,cy=300;
  let svg=`<svg class="dartboard-svg dartboard-hit-layer" viewBox="0 0 600 600" aria-label="Interactive realistic baseball darts board">`;
  for(let i=0;i<20;i++){const a0=i*18-9,a1=i*18+9;svg+=`<path class="hit-zone" data-baseball-score="${nums[i]}" d="${sectorPath(cx,cy,150,268,a0,a1)}"/>`;svg+=`<path class="hit-zone" data-baseball-score="${nums[i]*3}" d="${sectorPath(cx,cy,126,150,a0,a1)}"/>`;svg+=`<path class="hit-zone" data-baseball-score="${nums[i]*2}" d="${sectorPath(cx,cy,216,239,a0,a1)}"/>`}svg+=`<circle class="hit-zone" data-baseball-score="25" cx="300" cy="300" r="43"/><circle class="hit-zone" data-baseball-score="50" cx="300" cy="300" r="23"/></svg>`;return svg
}
function renderBaseballVisual(){
  const board=$('#baseballDartboardVisual');if(!board)return;
  board.innerHTML=`<div class="real-board-wrap"><img class="real-board-image" src="dartboard-realistic.png" alt="Hyper-realistic steel-tip darts board"><div class="board-glass-highlight"></div>${baseballHitSvg()}</div><div class="baseball-board-caption">BASEBALL DARTS · INNING ${baseball.inning}</div><div class="dartboard-hint">Tap a scoring area · a dart is planted only after that score is committed</div>`;
  $$('#baseballDartboardVisual .hit-zone').forEach(z=>z.addEventListener('click',()=>setBaseballThrow(baseballActiveThrow,Number(z.dataset.baseballScore),true)));
  renderBaseballDarts();
}
function renderBaseball(){const cp=baseball.players[baseball.current];$('#inningLabel').textContent=`${baseball.inning} / 9`;$('#baseballBoard').innerHTML=baseball.players.map(p=>`<div class="score-card ${p.id===cp.id?'current':''}"><div class="player-row">${avatar(p,true)}<strong>${esc(p.name)}</strong></div><div class="score-big">${p.total}</div><div class="score-sub">Inning ${baseball.inning}: ${p.innings[baseball.inning-1]??'—'}</div></div>`).join('');resetBaseballThrowDraft();$('#baseballInput').innerHTML=`<div class="throw-title"><div><h3>⚾ ${esc(cp.name)} · inning ${baseball.inning}</h3><span class="turn-subtitle">Enter each dart score. Each committed dart is pinned to the board; the three dart scores become this inning's runs.</span></div><span class="muted">3 DARTS / INNING</span></div><div id="baseballRoundDartSummary" class="round-dart-summary"><div class="round-dart-chip"><span>DART 1</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 2</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 3</span><b class="chip-score">—</b></div><div class="round-total-box"><span>INNING RUNS</span><b id="baseballRoundTotal">0</b></div></div><div class="throw-inputs">${[1,2,3].map(n=>`<div class="dart-entry" data-entry="${n-1}"><label>DART ${n}</label><input id="b${n}" inputmode="numeric" autocomplete="off" maxlength="2" placeholder="Score"><button type="button" class="commit-dart baseball-commit" data-baseball-commit="${n-1}" title="Commit Dart ${n}">✓</button></div>`).join('')}</div><div class="dart-keypad">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-baseball-key="${n}">${n}</button>`).join('')}<button type="button" data-baseball-key="back">⌫</button><button type="button" data-baseball-key="clear">Clear</button></div><div class="throw-actions"><button class="primary-btn" id="submitRuns">Record inning →</button></div>`;
  $$('#baseballInput .throw-inputs input').forEach((input,i)=>{input.addEventListener('focus',()=>{baseballActiveThrow=i;$$('#baseballInput .dart-entry').forEach((e,j)=>e.classList.toggle('active',j===i))});input.addEventListener('input',()=>{const raw=input.value.replace(/\D/g,'').slice(0,2);if(input.value!==raw)input.value=raw;baseballDraftThrows[i]=raw===''?null:Number(raw);input.classList.add('pending-throw');updateBaseballRoundTotal()});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitBaseballThrow(i)}})});
  $$('#baseballInput [data-baseball-commit]').forEach(btn=>btn.addEventListener('click',()=>commitBaseballThrow(Number(btn.dataset.baseballCommit))));
  $$('#baseballInput [data-baseball-key]').forEach(btn=>btn.addEventListener('click',()=>{const k=btn.dataset.baseballKey,input=$('#b'+(baseballActiveThrow+1));if(!input)return;if(k==='back')input.value=input.value.slice(0,-1);else if(k==='clear')input.value='';else input.value=(input.value+k).slice(0,2);baseballDraftThrows[baseballActiveThrow]=input.value===''?null:Number(input.value);input.classList.add('pending-throw');updateBaseballRoundTotal()}));
  $('#submitRuns').onclick=submitRuns;renderBaseballVisual();$('#baseballHistory').innerHTML=[...baseball.history].reverse().slice(0,10).map(x=>`<div class="history-row"><span>Inning ${x.inning} · ${esc(x.player)}</span><strong>+${x.runs}</strong></div>`).join('')||'<div class="muted">No innings yet.</div>'}
function submitRuns(){
  for(let i=0;i<3;i++){const raw=$('#b'+(i+1).toString()).value.trim();if(raw!==''&&!Number.isInteger(baseballThrowSelection[i])){if(!commitBaseballThrow(i))return}}
  const raw=[1,2,3].map(i=>$('#b'+i).value.trim()),vals=raw.map(v=>v===''?0:Number(v));
  const invalid=vals.findIndex(v=>!isValidDartScore(v));if(invalid!==-1){toast(`Invalid dart ${invalid+1}. Use 0, 1–20, doubles, triples, 25 or 50.`);$('#b'+(invalid+1)).focus();return}
  const runs=vals.reduce((a,b)=>a+b,0),p=baseball.players[baseball.current];p.innings[baseball.inning-1]=runs;p.total+=runs;if(p.inningDarts)p.inningDarts[baseball.inning-1]=vals.slice();baseball.history.push({inning:baseball.inning,player:p.name,runs,throws:vals});baseball.current=(baseball.current+1)%baseball.players.length;if(baseball.current===0){if(baseball.inning===9){renderBaseball();broadcast();const winner=[...baseball.players].sort((a,b)=>b.total-a.total)[0];setTimeout(()=>toast(`🏆 ${winner.name} wins with ${winner.total}!`),100);return}baseball.inning++}renderBaseball();broadcast()}
$('#undoBaseball').onclick=()=>{if(!baseball.history.length)return;const x=baseball.history.pop(),p=baseball.players.find(p=>p.name===x.player);if(p){p.total-=x.runs;p.innings[x.inning-1]=null;if(p.inningDarts)p.inningDarts[x.inning-1]=[null,null,null]}baseball.inning=x.inning;baseball.current=baseball.players.findIndex(p=>p.name===x.player);renderBaseball();broadcast()};
// ---------- STANDARD TARGET GAME ----------
function resetTargetThrowDraft(){targetThrowSelection[0]=targetThrowSelection[1]=targetThrowSelection[2]=null;targetDraftThrows[0]=targetDraftThrows[1]=targetDraftThrows[2]=null;targetActiveThrow=0}
function isValidTargetScore(v){return Number.isInteger(v)&&v>=0&&v<=10}
function targetScoreRadius(score){if(score===10)return 0;return 255-(score-1)*28}
function makeTargetDartElement(score,index){
  if(score===0)return '';
  const angle=-42 + index*120 + ((target.round-1)*7)%18;
  const r=score===10?(index-1)*7:targetScoreRadius(score);
  const rad=(angle-90)*Math.PI/180;
  const x=300+Math.cos(rad)*r, y=300+Math.sin(rad)*r;
  const left=(x/600*100).toFixed(4), top=(y/600*100).toFixed(4);
  const src=index===1?'dart-red.png':'dart-yellow.png';
  const cssAngle=(angle-90).toFixed(2);
  return `<div class="planted-dart-real target-planted-dart" data-score="${score}" style="--x:${left}%;--y:${top}%;--rot:${cssAngle}deg;--delay:${(index*.07).toFixed(2)}s"><div class="dart-real-shadow"></div><img src="${src}" alt="${score} point dart" draggable="false"><span class="dart-score-badge">${score}</span></div>`;
}
function renderTargetDarts(){
  const board=$('#targetDartboardVisual');if(!board)return;
  let layer=board.querySelector('.planted-darts-real-layer');if(layer)layer.remove();
  layer=document.createElement('div');layer.className='planted-darts-real-layer';
  layer.innerHTML=[0,1,2].map(i=>Number.isInteger(targetThrowSelection[i])?makeTargetDartElement(targetThrowSelection[i],i):'').join('');board.appendChild(layer);
}
function targetAnnulusPath(cx,cy,rInner,rOuter){
  const p1=polarPoint(cx,cy,rOuter,0),p2=polarPoint(cx,cy,rOuter,180),p3=polarPoint(cx,cy,rInner,180),p4=polarPoint(cx,cy,rInner,0);
  return `M ${p1[0]} ${p1[1]} A ${rOuter} ${rOuter} 0 1 1 ${p2[0]} ${p2[1]} A ${rOuter} ${rOuter} 0 1 1 ${p1[0]} ${p1[1]} M ${p4[0]} ${p4[1]} A ${rInner} ${rInner} 0 1 0 ${p3[0]} ${p3[1]} A ${rInner} ${rInner} 0 1 0 ${p4[0]} ${p4[1]} Z`;
}
function targetHitSvg(){
  const cx=300,cy=300;let svg=`<svg class="dartboard-svg dartboard-hit-layer" viewBox="0 0 600 600" aria-label="Interactive standard target board">`;
  const boundaries=[270,240,210,180,150,120,90,60,30,18];
  for(let score=1;score<=9;score++){const outer=boundaries[score-1],inner=boundaries[score];svg+=`<path class="hit-zone" data-target-score="${score}" d="${targetAnnulusPath(cx,cy,inner,outer)}"/>`;}
  svg+=`<circle class="hit-zone target-bull-zone" data-target-score="10" cx="300" cy="300" r="18"/></svg>`;
  return svg;
}
function setTargetThrow(i,value,fromBoard=false){
  const input=$('#g'+(i+1));if(!input)return;const v=Number(value);input.value=String(value);targetDraftThrows[i]=v;input.classList.add('pending-throw');
  if(fromBoard){targetActiveThrow=i;$$('#targetInput .dart-entry').forEach((e,j)=>e.classList.toggle('active',j===i));updateTargetRoundTotal();}
  else updateTargetRoundTotal();
}
function commitTargetThrow(i){
  const input=$('#g'+(i+1));if(!input)return false;const raw=input.value.trim();if(raw===''){toast(`Dart ${i+1}: enter a target score first.`);return false}
  if(!/^\d+$/.test(raw)){toast(`Dart ${i+1}: enter a whole number.`);return false}
  const v=Number(raw);if(!isValidTargetScore(v)){toast(`Invalid target dart ${i+1}. Use 0–9 or 10 for the bull.`);return false}
  targetDraftThrows[i]=v;targetThrowSelection[i]=v;input.classList.remove('pending-throw');input.classList.add('committed-throw');updateTargetRoundTotal();renderTargetDarts();if(i<2)targetActiveThrow=i+1;return true;
}
function updateTargetRoundTotal(){const total=targetDraftThrows.reduce((a,b)=>a+(Number.isInteger(b)?b:0),0);const el=$('#targetRoundTotal');if(el)el.textContent=total;const chips=$$('#targetRoundDartSummary .round-dart-chip');chips.forEach((c,i)=>{const v=targetDraftThrows[i];c.querySelector('.chip-score').textContent=v??'—';c.classList.toggle('filled',Number.isInteger(v));});}
function renderTargetVisual(){
  const board=$('#targetDartboardVisual');if(!board)return;
  board.innerHTML=`<div class="real-board-wrap target-real-board-wrap"><img class="real-board-image target-board-image" src="target-board-realistic.png" alt="Hyper-realistic numbered standard target board"><div class="board-glass-highlight"></div>${targetHitSvg()}</div><div class="target-board-caption">STANDARD TARGET · 1–9 RINGS · BULL 10</div><div class="dartboard-hint">Select a ring, then commit the dart to plant it on the board</div>`;
  $$('#targetDartboardVisual .hit-zone').forEach(z=>z.addEventListener('click',()=>setTargetThrow(targetActiveThrow,Number(z.dataset.targetScore),true)));
  renderTargetDarts();
}
function renderTarget(){
  if(!target.active)return;const cp=target.players[target.current];if(!cp)return;
  $('#targetRoundLabel').textContent=`${target.round} / ${target.rounds}`;
  $('#targetBoard').innerHTML=target.players.map(p=>`<div class="score-card ${p.id===cp.id?'current':''}"><div class="player-row">${avatar(p,true)}<strong>${esc(p.name)}</strong></div><div class="score-big">${p.total}</div><div class="score-sub">${p.roundsPlayed||0} rounds · ${p.total} points</div></div>`).join('');
  resetTargetThrowDraft();const panel=$('#targetInput');
  panel.innerHTML=`<div class="throw-title"><div><h3>${avatar(cp,true)} ${esc(cp.name)}'s throw</h3><span class="turn-subtitle">Choose a ring or enter its value. A dart is planted only after that dart is committed.</span></div><span class="muted">ROUND ${target.round} / ${target.rounds}</span></div><div id="targetRoundDartSummary" class="round-dart-summary"><div class="round-dart-chip"><span>DART 1</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 2</span><b class="chip-score">—</b></div><div class="round-dart-chip"><span>DART 3</span><b class="chip-score">—</b></div><div class="round-total-box"><span>ROUND TOTAL</span><b id="targetRoundTotal">0</b></div></div><div class="throw-inputs">${[1,2,3].map(n=>`<div class="dart-entry" data-entry="${n-1}"><label>DART ${n}</label><input id="g${n}" inputmode="numeric" autocomplete="off" maxlength="2" placeholder="1–10"><button type="button" class="commit-dart" data-target-commit="${n-1}" title="Commit Dart ${n}">✓</button></div>`).join('')}</div><div class="dart-keypad target-keypad">${[1,2,3,4,5,6,7,8,9,0].map(n=>`<button type="button" data-target-key="${n}">${n}</button>`).join('')}<button type="button" data-target-key="back">⌫</button><button type="button" data-target-key="clear">Clear</button></div><div class="throw-actions"><button type="button" class="primary-btn" id="submitTarget">Add round →</button></div>`;
  $$('#targetInput .throw-inputs input').forEach((input,i)=>{input.addEventListener('focus',()=>{targetActiveThrow=i;$$('#targetInput .dart-entry').forEach((e,j)=>e.classList.toggle('active',j===i))});input.addEventListener('input',()=>{const raw=input.value.replace(/\D/g,'').slice(0,2);if(input.value!==raw)input.value=raw;targetDraftThrows[i]=raw===''?null:Number(raw);input.classList.add('pending-throw');updateTargetRoundTotal()});input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitTargetThrow(i)}})});
  $$('#targetInput [data-target-commit]').forEach(btn=>btn.addEventListener('click',()=>{const i=Number(btn.dataset.targetCommit);targetActiveThrow=i;commitTargetThrow(i)}));
  $$('#targetInput [data-target-key]').forEach(btn=>btn.addEventListener('click',()=>{const k=btn.dataset.targetKey,input=$('#g'+(targetActiveThrow+1));if(!input)return;if(k==='back')input.value=input.value.slice(0,-1);else if(k==='clear')input.value='';else if(input.value.length<2)input.value+=k;const raw=input.value.replace(/\D/g,'').slice(0,2);input.value=raw;targetDraftThrows[targetActiveThrow]=raw===''?null:Number(raw);input.classList.add('pending-throw');updateTargetRoundTotal();input.focus()}));
  $('#submitTarget').onclick=submitTarget;renderTargetVisual();updateTargetRoundTotal();renderTargetHistory();
}
function submitTarget(){
  for(let i=0;i<3;i++){const raw=$('#g'+(i+1)).value.trim();if(raw!==''&&!Number.isInteger(targetThrowSelection[i])){if(!commitTargetThrow(i))return}}
  const vals=[0,1,2].map(i=>Number.isInteger(targetThrowSelection[i])?targetThrowSelection[i]:0);
  const p=target.players[target.current];const total=vals.reduce((a,b)=>a+b,0);p.total+=total;p.roundsPlayed=(p.roundsPlayed||0)+1;p.roundScores=p.roundScores||[];p.roundScores[target.round-1]=total;target.history.push({player:p.name,round:target.round,throws:vals,total});target.current=(target.current+1)%target.players.length;
  if(target.current===0){if(target.round===target.rounds){const winner=[...target.players].sort((a,b)=>b.total-a.total)[0];renderTarget();broadcast();setTimeout(()=>toast(`🏆 ${winner.name} wins with ${winner.total}!`),100);return}target.round++}renderTarget();broadcast();
}
function renderTargetHistory(){const h=[...target.history].reverse().slice(0,10);$('#targetHistory').innerHTML=h.length?h.map(x=>`<div class="history-row"><span>R${x.round} · ${esc(x.player)}</span><strong>+${x.total}</strong></div>`).join(''):'<div class="muted">No target rounds yet.</div>'}
$('#startTarget').onclick=()=>{if(target.players.length<1)return toast('Add at least one player');target={active:true,round:1,rounds:target.rounds||10,current:0,players:target.players.map(p=>({...p,total:0,roundsPlayed:0,roundScores:[]})),history:[]};$('#targetSetup').classList.add('hidden');$('#targetGame').classList.remove('hidden');renderTarget();broadcast()};
$('#newTarget').onclick=()=>{target.active=false;$('#targetGame').classList.add('hidden');$('#targetSetup').classList.remove('hidden');renderPicker('targetPlayerPicker',target.players.map(p=>p.id));resetTargetThrowDraft()};
$('#undoTarget').onclick=()=>{if(!target.history.length)return;const x=target.history.pop(),p=target.players.find(p=>p.name===x.player);if(!p)return;p.total-=x.total;p.roundsPlayed=Math.max(0,(p.roundsPlayed||0)-1);if(p.roundScores)p.roundScores[x.round-1]=null;target.round=x.round;target.current=target.players.findIndex(p=>p.name===x.player);renderTarget();broadcast()};
$$('#targetRoundOptions .score-option').forEach(b=>b.onclick=()=>{$$('#targetRoundOptions .score-option').forEach(x=>x.classList.remove('active'));b.classList.add('active');target.rounds=Number(b.dataset.targetRounds)});

$('#resetApp').onclick=()=>{if(confirm('Reset the current game?')){darts.active=false;baseball.active=false;target.active=false;$('#dartsGame,#baseballGame,#targetGame').forEach(x=>x.classList.add('hidden'));$('#dartsSetup,#baseballSetup,#targetSetup').forEach(x=>x.classList.remove('hidden'));broadcast();toast('Game reset')}};
function toast(msg){const t=$('#toast');t.textContent=msg;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),2200)}function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function state(){return JSON.stringify({darts,baseball,target})}
function applyState(raw){try{const s=typeof raw==='string'?JSON.parse(raw):raw;if(s.darts){darts=s.darts; if(darts.active){$('#dartsSetup').classList.add('hidden');$('#dartsGame').classList.remove('hidden');renderDarts()}}if(s.baseball){baseball=s.baseball;if(baseball.active){$('#baseballSetup').classList.add('hidden');$('#baseballGame').classList.remove('hidden');renderBaseball()}}if(s.target){target=s.target;if(target.active){$('#targetSetup').classList.add('hidden');$('#targetGame').classList.remove('hidden');renderTarget()}}}catch(e){console.warn(e)}}
function firebaseReady(){return window.firebase && window.THROW_FIREBASE_CONFIG && window.THROW_FIREBASE_CONFIG.apiKey && !String(window.THROW_FIREBASE_CONFIG.apiKey).startsWith('PASTE_') && window.THROW_FIREBASE_CONFIG.databaseURL && !String(window.THROW_FIREBASE_CONFIG.databaseURL).includes('YOUR_PROJECT')}
function setLiveStatus(msg){const el=$('#roomStatus');if(el)el.textContent=msg}
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
if(!hostMode){document.body.insertAdjacentHTML('afterbegin','<div class="viewer-banner">📱 <b>Live viewer mode</b> — this phone is following the host scoreboard. Scoring controls are disabled here.</div>');$('#dartsSetup').classList.add('hidden');$('#baseballSetup').classList.add('hidden');$('#targetSetup').classList.add('hidden');}
initFirebase();
if(hostMode)makeDartboard();
renderPlayers();renderPicker('dartsPlayerPicker',[]);renderPicker('baseballPlayerPicker',[]);renderPicker('targetPlayerPicker',[]);

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
