const KEY = 'shiftwise_hamed_v1';
const OLD_KEYS = ['crewflow_pro_hamed_v4','crewflow_hamed_v3','mac_tracker_shifts','mcdo_shifts'];
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
const months = {januari:0,jan:0,februari:1,feb:1,maart:2,mrt:2,april:3,apr:3,mei:4,juni:5,jun:5,juli:6,jul:6,augustus:7,aug:7,september:8,sep:8,oktober:9,okt:9,november:10,nov:10,december:11,dec:11};

let shifts = loadShifts();

function loadShifts(){
  const current = safeParse(localStorage.getItem(KEY));
  if(Array.isArray(current)) return current;
  for(const k of OLD_KEYS){
    const old = safeParse(localStorage.getItem(k));
    if(Array.isArray(old) && old.length){
      localStorage.setItem(KEY, JSON.stringify(old));
      return old;
    }
  }
  return [];
}
function safeParse(v){try{return JSON.parse(v || 'null')}catch{return null}}
function toast(t){$('toast').textContent=t;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),1700)}
function save(t='Opgeslagen'){localStorage.setItem(KEY,JSON.stringify(shifts));render();toast(t)}
function money(v){return '€'+(Math.round(v*100)/100).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:2})}
function h(min){return (Math.round((min/60)*10)/10).toLocaleString('nl-NL')+'h'}
function niceDate(d){return new Date(d+'T12:00:00').toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})}
function escapeHtml(str){return String(str ?? '').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]))}

function times(s){
  const start = new Date(`${s.date}T${s.start}`);
  const end = new Date(`${s.date}T${s.end}`);
  if(end <= start) end.setDate(end.getDate()+1);
  return {start,end};
}
function rawMin(s){const {start,end}=times(s);return Math.max(0,(end-start)/60000)}
function paidMin(s){return Math.max(0,rawMin(s)-Number(s.break ?? s.brk ?? 0))}
function nightMin(s){
  const {start,end}=times(s);
  const mid = new Date(start); mid.setDate(mid.getDate()+1); mid.setHours(0,0,0,0);
  const rawNight = Math.max(0,(end - Math.max(start,mid))/60000);
  const total = rawMin(s);
  const breakPart = total ? Number(s.break ?? s.brk ?? 0) * (rawNight / total) : 0;
  return Math.max(0, rawNight - breakPart);
}
function pay(s){
  const rate = Number(s.rate || 0);
  const base = paidMin(s)/60*rate;
  const bonus = nightMin(s)/60*rate*.40;
  return {base,bonus,total:base+bonus};
}
function weekNo(date){
  let d = new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate()));
  d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7));
  let y = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d-y)/86400000)+1)/7);
}

function addShift(){
  const s = {
    id: Date.now()+Math.random(),
    date: $('date').value,
    start: $('start').value,
    end: $('end').value,
    break: Number($('break').value || 0),
    rate: Number($('rate').value || 0),
    position: $('position').value.trim() || 'Shift',
    note: $('note').value.trim()
  };
  if(!s.date || !s.start || !s.end) return toast('Datum, start en einde nodig');
  shifts.push(s);
  shifts.sort((a,b)=>new Date(a.date+'T'+a.start)-new Date(b.date+'T'+b.start));
  $('position').value=''; $('note').value='';
  $('range').value='all'; // important: user sees the added shift directly
  save('Dienst opgeslagen');
}
function del(id){shifts=shifts.filter(s=>String(s.id)!==String(id));save('Dienst verwijderd')}
function clearAll(){if(confirm('Alle diensten wissen?')){shifts=[];save('Alles gewist')}}

function parseDate(line){
  const txt = line.toLowerCase().replace(/,/g,' ').replace(/\s+/g,' ');
  const m = txt.match(/(\d{1,2})\s+(januari|jan|februari|feb|maart|mrt|april|apr|mei|juni|jun|juli|jul|augustus|aug|september|sep|oktober|okt|november|nov|december|dec)\s+(20\d{2})/i);
  if(!m) return null;
  return `${m[3]}-${pad(months[m[2]]+1)}-${pad(m[1])}`;
}
function importShifts(){
  const lines = $('importText').value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
  let added=0;
  for(const line of lines){
    const date = parseDate(line);
    const tm = line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if(date && tm){
      const pos = (line.split(tm[0])[1]||'').replace(/^[,\s-]+/,'').trim() || 'Imported shift';
      shifts.push({id:Date.now()+Math.random(),date,start:tm[1],end:tm[2],break:30,rate:Number($('rate').value||12.41),position:pos,note:'Imported from Gmail roster'});
      added++;
    }
  }
  if(!added) return alert('Geen shifts gevonden. Gebruik bijvoorbeeld: vrijdag 17 juli 2026 20:30 - 02:30, MPS');
  $('importText').value=''; $('range').value='all';
  shifts.sort((a,b)=>new Date(a.date+'T'+a.start)-new Date(b.date+'T'+b.start));
  save(`${added} dienst(en) geïmporteerd`);
}
function downloadBackup(){
  const blob = new Blob([JSON.stringify(shifts,null,2)],{type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'shiftwise-hamed-backup.json'; a.click(); URL.revokeObjectURL(a.href); toast('Backup gedownload');
}
function restoreBackup(e){
  const file = e.target.files[0]; if(!file) return;
  const r = new FileReader();
  r.onload = () => {try{const data=JSON.parse(r.result); if(!Array.isArray(data)) throw Error(); shifts=data; $('range').value='all'; save('Backup geïmporteerd')}catch{alert('Dit JSON bestand klopt niet')}};
  r.readAsText(file);
}
function fillDemo(){
  const n = new Date();
  $('date').value = `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  $('start').value='17:30'; $('end').value='01:30'; $('break').value='30'; $('rate').value='12.41'; $('position').value='MPS Close'; $('note').value='Demo: 40% bonus na 00:00';
  toast('Demo ingevuld');
}
function rangeOk(s,range){
  const n = new Date(), d = new Date(s.date+'T12:00:00');
  if(range==='week') return d.getFullYear()===n.getFullYear() && weekNo(d)===weekNo(n);
  if(range==='month') return d.getFullYear()===n.getFullYear() && d.getMonth()===n.getMonth();
  if(range==='future') return new Date(`${s.date}T${s.start}`) >= n;
  return true;
}

function render(){
  const now = new Date();
  let weekM=0,monthM=0,weekC=0,monthC=0,earned=0,bonus=0,night=0,next=null;
  for(const s of shifts){
    const d = new Date(s.date+'T12:00:00'), mins = paidMin(s), p = pay(s);
    if(d.getFullYear()===now.getFullYear() && weekNo(d)===weekNo(now)){weekM+=mins;weekC++}
    if(d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth()){monthM+=mins;monthC++;earned+=p.total;bonus+=p.bonus;night+=nightMin(s)}
    const st = new Date(`${s.date}T${s.start}`); if(st>=now && (!next || st < new Date(`${next.date}T${next.start}`))) next=s;
  }
  $('weekHours').textContent=h(weekM); $('weekCount').textContent=weekC+' diensten';
  $('monthHours').textContent=h(monthM); $('monthCount').textContent=monthC+' diensten';
  $('earnedBig').textContent=money(earned); $('earnedSmall').textContent=money(earned); $('bonusSmall').textContent=money(bonus); $('nightHours').textContent=h(night)+' na 00:00';
  const pct = Math.min(100,Math.round(monthM/(120*60)*100)); document.querySelector('.target-ring').style.setProperty('--p',pct*3.6+'deg'); $('targetPct').textContent=pct+'%';
  if(next){$('nextShift').textContent=niceDate(next.date); $('nextInfo').textContent=next.start+' - '+next.end}else{$('nextShift').textContent='–'; $('nextInfo').textContent='niets gepland'}

  const q = ($('search').value||'').toLowerCase();
  const range = $('range').value || 'all';
  const list = shifts
    .filter(s=>rangeOk(s,range))
    .filter(s=>(s.position+' '+(s.note||'')+' '+s.date).toLowerCase().includes(q))
    .sort((a,b)=>new Date(b.date+'T'+b.start)-new Date(a.date+'T'+a.start));

  $('shiftCountLine').textContent = shifts.length ? `${shifts.length} dienst${shifts.length===1?'':'en'} opgeslagen` : '0 diensten opgeslagen';
  $('list').innerHTML='';

  if(!list.length){
    const msg = shifts.length
      ? `<div class="empty"><b>Geen diensten in deze filter.</b>Zet de filter op “Alle diensten” om je opgeslagen diensten te zien.</div>`
      : `<div class="empty"><b>Nog geen diensten hier.</b>Voeg je eerste shift toe ✨</div>`;
    $('list').innerHTML = msg;
    return;
  }
  for(const s of list){
    const p=pay(s), nm=nightMin(s), br=Number(s.break ?? s.brk ?? 0);
    const div=document.createElement('article'); div.className='shift';
    div.innerHTML=`<div class="shift-main"><div class="shift-title">${niceDate(s.date)} · ${s.start} → ${s.end}</div><div class="shift-sub">${escapeHtml(s.position)}${s.note?' · '+escapeHtml(s.note):''}</div><div class="pills"><span class="pill">⏱ ${h(paidMin(s))}</span><span class="pill">☕ ${br} min pauze</span><span class="pill hot">🌙 ${h(nm)} bonus</span><span class="pill">€${Number(s.rate||0).toLocaleString('nl-NL')} / uur</span></div></div><div class="shift-pay"><b>${money(p.total)}</b><button class="btn danger delete" onclick="del('${s.id}')">Delete</button></div>`;
    $('list').appendChild(div);
  }
}
function tick(){
  const n = new Date();
  $('clock').textContent = n.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'});
  const text = n.getHours()<12 ? 'Goedemorgen Hamed ☀️' : n.getHours()<18 ? 'Goedemiddag Hamed ⚡' : 'Goedenavond Hamed 🌙';
  $('greeting').textContent = text.replace(/[☀️⚡🌙]/g,'').trim();
  $('todayLine').textContent = text;
}
$('themeBtn').addEventListener('click',()=>{document.body.classList.toggle('light');localStorage.setItem('shiftwise_theme',document.body.classList.contains('light')?'light':'dark');$('themeBtn').textContent=document.body.classList.contains('light')?'☀️':'🌙'});
(function init(){
  if(localStorage.getItem('shiftwise_theme')==='light'){document.body.classList.add('light');$('themeBtn').textContent='☀️'}
  const n = new Date(); $('date').value = `${n.getFullYear()}-${pad(n.getMonth()+1)}-${pad(n.getDate())}`;
  tick(); setInterval(tick,1000); render();
})();
