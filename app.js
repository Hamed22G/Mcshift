const KEY = 'crewflow_by_hamed_v2';
let shifts = JSON.parse(localStorage.getItem(KEY) || '[]');
const nlMonths = { januari:0, jan:0, februari:1, feb:1, maart:2, mrt:2, april:3, apr:3, mei:4, juni:5, jun:5, juli:6, jul:6, augustus:7, aug:7, september:8, sep:8, oktober:9, okt:9, november:10, nov:10, december:11, dec:11 };
const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2,'0');
function showToast(msg){ $('toast').textContent = msg; $('toast').classList.add('show'); setTimeout(()=>$('toast').classList.remove('show'),1800); }
function save(msg='Opgeslagen'){ localStorage.setItem(KEY, JSON.stringify(shifts)); render(); showToast(msg); }
function fmtDate(d){ return new Date(d+'T12:00:00').toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }
function money(v){ return '€' + (Math.round(v * 100) / 100).toLocaleString('nl-NL',{minimumFractionDigits:0,maximumFractionDigits:2}); }
function hoursText(mins){ return (Math.round((mins/60)*10)/10).toLocaleString('nl-NL') + 'h'; }
function getShiftTimes(s){ let start = new Date(`${s.date}T${s.start}`); let end = new Date(`${s.date}T${s.end}`); if(end <= start) end.setDate(end.getDate()+1); return {start,end}; }
function rawMinutes(s){ const {start,end}=getShiftTimes(s); return Math.max(0,(end-start)/60000); }
function paidMinutes(s){ return Math.max(0, rawMinutes(s) - Number(s.break || 0)); }
function nightMinutesAfterMidnight(s){
  const {start,end}=getShiftTimes(s);
  const midnight = new Date(start); midnight.setDate(midnight.getDate()+1); midnight.setHours(0,0,0,0);
  const nightRaw = Math.max(0, (end - Math.max(start, midnight)) / 60000);
  const totalRaw = rawMinutes(s);
  const breakPart = totalRaw ? Number(s.break || 0) * (nightRaw / totalRaw) : 0;
  return Math.max(0, nightRaw - breakPart);
}
function payForShift(s){
  const rate = Number(s.rate || 0);
  const normal = paidMinutes(s) / 60 * rate;
  const bonus = nightMinutesAfterMidnight(s) / 60 * rate * 0.40;
  return { normal, bonus, total: normal + bonus };
}
function addShift(){
  const shift = { id: Date.now()+Math.random(), date:$('date').value, start:$('start').value, end:$('end').value, break:Number($('break').value||0), rate:Number($('rate').value||0), position:$('position').value.trim()||'Shift', note:$('note').value.trim() };
  if(!shift.date || !shift.start || !shift.end) return showToast('Vul datum, start en einde in');
  shifts.push(shift); shifts.sort((a,b)=>new Date(a.date)-new Date(b.date)); $('position').value=''; $('note').value=''; save('Dienst toegevoegd');
}
function del(id){ shifts = shifts.filter(s=>s.id!==id); save('Dienst verwijderd'); }
function clearAll(){ if(confirm('Alles wissen?')){ shifts=[]; save('Alles gewist'); } }
function getWeekNumber(d){ d=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const y=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-y)/86400000)+1)/7); }
function parseDutchDate(txt){
  txt = txt.toLowerCase().replace(/,/g,' ').replace(/\s+/g,' ');
  const m = txt.match(/(\d{1,2})\s+(januari|jan|februari|feb|maart|mrt|april|apr|mei|juni|jun|juli|jul|augustus|aug|september|sep|oktober|okt|november|nov|december|dec)\s+(20\d{2})/i);
  if(!m) return null;
  return `${m[3]}-${pad(nlMonths[m[2]]+1)}-${pad(m[1])}`;
}
function importShifts(){
  const lines = $('importText').value.split(/\n+/).map(x=>x.trim()).filter(Boolean); let added=0;
  lines.forEach(line=>{
    const d=parseDutchDate(line), t=line.match(/(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
    if(d && t){ const after=(line.split(t[0])[1]||'').replace(/^[,\s-]+/,'').trim(); shifts.push({id:Date.now()+Math.random(),date:d,start:t[1],end:t[2],break:30,position:after||'Imported shift',rate:Number($('rate').value||12.41),note:'Imported from roster'}); added++; }
  });
  if(!added){ alert('Geen shifts gevonden. Voorbeeld: vrijdag 17 juli 2026 20:30 - 02:30, MPS'); return showToast('Geen shifts gevonden'); }
  $('importText').value=''; shifts.sort((a,b)=>new Date(a.date)-new Date(b.date)); save(`${added} shift(s) geïmporteerd`);
}
function exportData(){ const blob = new Blob([JSON.stringify(shifts,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='crewflow-backup.json'; a.click(); URL.revokeObjectURL(a.href); showToast('Backup gedownload'); }
function fillDemo(){ $('date').value = new Date().toISOString().slice(0,10); $('start').value='17:30'; $('end').value='01:30'; $('break').value='30'; $('rate').value='12.41'; $('position').value='MPS Close'; $('note').value='Demo met 40% bonus na 00:00'; showToast('Demo ingevuld'); }
function render(){
  const now=new Date(), thisMonth=now.getMonth(), thisYear=now.getFullYear(), thisWeek=getWeekNumber(now); let weekM=0, monthM=0, weekC=0, monthC=0, earned=0, bonus=0, nightM=0, next=null;
  const q=($('search')?.value||'').toLowerCase(); $('list').innerHTML='';
  shifts.forEach(s=>{ const d=new Date(s.date+'T12:00:00'), mins=paidMinutes(s), pay=payForShift(s); if(d.getFullYear()===thisYear && getWeekNumber(d)===thisWeek){ weekM+=mins; weekC++; } if(d.getFullYear()===thisYear && d.getMonth()===thisMonth){ monthM+=mins; monthC++; earned+=pay.total; bonus+=pay.bonus; nightM+=nightMinutesAfterMidnight(s); } if(new Date(`${s.date}T${s.start}`)>=now && (!next || new Date(`${s.date}T${s.start}`)<new Date(`${next.date}T${next.start}`))) next=s; });
  $('weekHours').textContent=hoursText(weekM); $('weekCount').textContent=weekC+' diensten'; $('monthHours').textContent=hoursText(monthM); $('monthCount').textContent=monthC+' diensten'; $('earnedBig').textContent=money(earned); $('bonusText').textContent=money(bonus); $('nightHours').textContent=hoursText(nightM); $('monthBar').style.width=Math.min(100,(monthM/(120*60))*100)+'%';
  if(next){ $('nextShift').textContent=fmtDate(next.date); $('nextInfo').textContent=next.start+' - '+next.end; } else { $('nextShift').textContent='–'; $('nextInfo').textContent='niets gepland'; }
  const filtered=shifts.filter(s=>(s.position+' '+(s.note||'')).toLowerCase().includes(q));
  if(!filtered.length){ $('list').innerHTML='<div class="empty">Nog geen diensten gevonden. Voeg je eerste shift toe ✨</div>'; return; }
  filtered.slice().reverse().forEach(s=>{ const mins=paidMinutes(s), nm=nightMinutesAfterMidnight(s), pay=payForShift(s); const div=document.createElement('div'); div.className='shift'; div.innerHTML=`<div><strong>${fmtDate(s.date)} · ${s.start} - ${s.end}</strong><small>${s.position}${s.note?' · '+s.note:''}</small><div class="pills"><span class="pill">⏱ ${hoursText(mins)}</span><span class="pill">☕ ${s.break||0} min pauze</span><span class="pill hot">🌙 ${hoursText(nm)} bonus</span><span class="pill">💸 ${money(pay.total)}</span></div></div><button class="btn danger" onclick="del(${s.id})">Delete</button>`; $('list').appendChild(div); });
}
function tick(){ const n=new Date(); $('clock').textContent=n.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'}); $('todayLine').textContent=n.getHours()<12?'Goedemorgen, Hamed ☀️':n.getHours()<18?'Ready voor vandaag ⚡':'Avond shift mode 🌙'; }
(function init(){ const t=new Date(); $('date').value=`${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; tick(); setInterval(tick,1000); render(); })();
