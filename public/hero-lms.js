(()=>{
const reflection=document.getElementById('hero-reflection-form');
if(!reflection)return;
const classSelect=reflection.elements.class_id;
const answerNames=['one','two','three','four'];
const crystals=[...document.querySelectorAll('.froppy-crystals [data-crystal]')];
const crystalTray=document.querySelector('.froppy-crystals');
function updateReflectionEnergy(){
 const complete=answerNames.reduce((total,name,index)=>{
  const filled=String(reflection.elements[name].value||'').trim().length>0;
  reflection.elements[name].closest('.froppy-question')?.classList.toggle('completed',filled);
  crystals[index]?.classList.toggle('active',filled);
  return total+(filled?1:0);
 },0);
 crystalTray?.setAttribute('aria-label',`Kemajuan jawapan: ${complete} daripada 4`);
 const energyTrack=document.querySelector('.froppy-energy-track');
 const energyFill=energyTrack?.querySelector('span');
 energyTrack?.setAttribute('aria-valuenow',String(complete));
 if(energyFill)energyFill.style.width=`${complete*25}%`;
}
answerNames.forEach(name=>reflection.elements[name].addEventListener('input',updateReflectionEnergy));
async function loadClasses(){
 const response=await fetch('/api/hero-portal-test?action=my-classes',{credentials:'same-origin',cache:'no-store'});
 const data=await response.json();
 if(!response.ok)throw Error(data.error||'Kelas tidak dapat dimuatkan.');
 if(!Array.isArray(data.classes))throw Error('Respons kelas tidak sah.');
 const previous=classSelect.value;
 classSelect.replaceChildren(new Option(data.classes.length?'Pilih kelas':'Sertai kelas dahulu',''));
 for(const item of data.classes)classSelect.add(new Option(item.name,String(item.id)));
 if(data.classes.some(item=>String(item.id)===previous))classSelect.value=previous;
 else if(data.classes.length===1)classSelect.value=String(data.classes[0].id);
 return data.classes;
}
loadClasses().catch(error=>{document.getElementById('hero-reflection-status').textContent=error.message;});
reflection.addEventListener('submit',async event=>{
 event.preventDefault();
 const button=reflection.querySelector('[type=submit]'), message=document.getElementById('hero-reflection-status');
 if (button.disabled) return;
 button.disabled=true; message.textContent='Menghantar refleksi ke Supabase…';
 try {
  const values=answerNames.map(name=>String(reflection.elements[name].value||'').trim());
  if(values.some(value=>value.length<1||value.length>2000))throw Error('Setiap jawapan perlu mengandungi 1 hingga 2000 aksara.');
  const selected=classSelect.value;
  const classes=await loadClasses();
  if(!selected||!classes.some(item=>String(item.id)===selected))throw Error('Pilih kelas yang telah anda sertai sebelum menghantar refleksi.');
  const response=await fetch('/api/hero-portal-test',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit-reflection',class_id:selected,reflection_1:values[0],reflection_2:values[1],reflection_3:values[2],reflection_4:values[3]})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Refleksi belum disimpan.');
  if(!result.saved)throw Error('Penyimpanan refleksi belum disahkan.');
  message.textContent='PLUS ULTRA! REFLEKSI BERJAYA DISIMPAN!';button.innerHTML='<span class="submit-crystal" aria-hidden="true">✓</span><span>REFLEKSI DISIMPAN</span><small>SUPABASE TELAH MENGESAHKAN MISI</small>';
  const victory=document.querySelector('.froppy-victory');
  if(victory){victory.classList.add('show');victory.setAttribute('aria-hidden','false');setTimeout(()=>{victory.classList.remove('show');victory.setAttribute('aria-hidden','true');},3200);}
 }catch(error){message.textContent=error.message;button.disabled=false;}
});
})();
