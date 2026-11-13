// Run with LINKEDOM_MODULE pointing to linkedom/esm/index.js. No production data.
const {parseHTML}=await import(process.env.LINKEDOM_MODULE || 'linkedom');
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const source=readFileSync(root+'public/app.js','utf8'),html=readFileSync(root+'app/site-shell.html','utf8');
const code=source.slice(source.indexOf('  // Home guide is local'),source.indexOf('  // GURU DEKU AI:'));
const storage=new Map();let tutorOpens=0;
function setup(storageBlocked=false){
 const {document,window}=parseHTML(html);
 const music=document.querySelector('#theme-music'),toggle=document.querySelector('#music-toggle');music.paused=true;
 toggle.addEventListener('click',()=>{music.paused=!music.paused;music.dispatchEvent(new window.Event(music.paused?'pause':'play'));});
 document.querySelector('#deku-fab').addEventListener('click',()=>{tutorOpens++;document.querySelector('#deku-chat').hidden=false;});
 const reduceMotion={matches:false,listeners:[],addEventListener(_,f){this.listeners.push(f);}};
 const ctx=vm.createContext({document,window,themeMusic:music,musicToggle:toggle,reduceMotion,localStorage:{getItem:k=>{if(storageBlocked)throw Error('disabled');return storage.get(k);},setItem:(k,v)=>{if(storageBlocked)throw Error('disabled');storage.set(k,v);}}});
 vm.runInContext(code,ctx);
 return {document,window,ctx,reduceMotion,click:el=>el.dispatchEvent(new window.Event('click',{bubbles:true}))};
}
const fixture=setup();const {document,window,ctx,click,reduceMotion}=fixture;
const tab=i=>document.querySelector(`[data-guide-step="${i}"]`),next=()=>click(document.querySelector('#guide-next'));
const visible=()=>[...document.querySelectorAll('.guide-step-panel')].filter(p=>!p.hidden);
assert.equal(visible().length,1);assert.equal(visible()[0].id,'guide-panel-0');assert.equal(document.querySelector('#guide-percent').textContent,'0%');
click(tab(4));next();assert.equal(document.querySelector('#guide-percent').textContent,'0%');assert.equal(document.querySelector('#guide-success').hidden,true);assert.match(document.querySelector('#guide-mission-message').textContent,/langkah 1/);
click(tab(0));
for(let i=0;i<4;i++){
 assert.equal(visible().length,1);assert.equal(visible()[0].id,'guide-panel-'+i);
 assert.match(document.querySelector('#guide-deku-dialog').textContent,new RegExp(['Hai','Enam','Mulakan','Perlukan'][i]));
 next();assert.equal(document.querySelector('#guide-percent').textContent,(i+1)*20+'%');
}
assert.equal(document.querySelector('#guide-success').hidden,true);next();assert.equal(document.querySelector('#guide-percent').textContent,'100%');assert.equal(document.querySelector('#guide-success').hidden,false);
assert.equal(document.querySelector('#guide-next').disabled,true);assert.equal(document.querySelector('#guide-progress').getAttribute('aria-valuenow'),'100');
assert.equal(document.querySelectorAll('.guide-step-done').length,5);
const restored=setup();assert.equal(restored.document.querySelector('#guide-percent').textContent,'100%');assert.equal(restored.document.querySelector('#guide-panel-4').hidden,false);
click(tab(1));const menuButtons=[...document.querySelectorAll('[data-guide-menu]')];for(const b of menuButtons){click(b);assert.equal(b.getAttribute('aria-pressed'),'true');assert.ok(document.querySelector('#guide-menu-description').textContent.length>35);}
click(tab(3));click(document.querySelector('#guide-open-tutor'));click(document.querySelector('#guide-open-tutor'));assert.equal(tutorOpens,1,'existing tutor opens once and is not toggled shut');
click(document.querySelector('#guide-music'));assert.equal(document.querySelector('#guide-music').getAttribute('aria-pressed'),'true');click(document.querySelector('#guide-music'));assert.equal(document.querySelector('#guide-music').getAttribute('aria-pressed'),'false');
click(document.querySelector('#guide-motion'));assert.equal(document.querySelector('#home-guide').classList.contains('guide-motion-off'),true);
reduceMotion.matches=true;reduceMotion.listeners.forEach(f=>f());assert.equal(document.querySelector('#guide-motion').disabled,true);
reduceMotion.matches=false;reduceMotion.listeners.forEach(f=>f());assert.equal(document.querySelector('#guide-motion').disabled,false);
click(document.querySelector('#guide-restart'));assert.equal(document.querySelector('#guide-percent').textContent,'0%');assert.equal(visible()[0].id,'guide-panel-0');
const key=new window.Event('keydown',{cancelable:true});key.key='End';tab(0).dispatchEvent(key);assert.equal(visible()[0].id,'guide-panel-4');
click(document.querySelector('#guide-prev'));assert.equal(visible()[0].id,'guide-panel-3');
const blocked=setup(true);blocked.click(blocked.document.querySelector('#guide-next'));assert.equal(blocked.document.querySelector('#guide-percent').textContent,'20%');assert.match(blocked.document.querySelector('#guide-storage-note').textContent,/sesi ini/);
const base='bd5c68001420e2cfd5c769ad087325e860e2a436';const oldHtml=execFileSync('git',['show',base+':app/site-shell.html'],{cwd:root,encoding:'utf8'});const oldDoc=parseHTML(oldHtml).document;const pristineDoc=parseHTML(html).document;
for(const id of ['nota','video','gamifikasi','quiz','sijil','main-nav','deku-chat','deku-fab','music-toggle','theme-music'])assert.equal(pristineDoc.querySelector('#'+id).outerHTML,oldDoc.querySelector('#'+id).outerHTML,'preserved '+id);
assert.equal(pristineDoc.querySelector('.hero-frame').outerHTML,oldDoc.querySelector('.hero-frame').outerHTML);
for(const selector of ['.home-background-video','.home-energy-streaks'])assert.equal(pristineDoc.querySelector(selector).outerHTML,oldDoc.querySelector(selector).outerHTML,'preserved '+selector);
assert.equal(document.querySelectorAll('.guide-route-card').length,6);
for(const card of document.querySelectorAll('.guide-route-card')){
 assert.equal(card.querySelectorAll('.home-card-design image').length,1);
 assert.equal(card.querySelectorAll('.home-card-circuit rect').length,3);
 assert.ok(card.getAttribute('aria-label').startsWith('Buka '));
 const event=new window.Event('click',{bubbles:true,cancelable:true});
 card.dispatchEvent(event);assert.equal(event.defaultPrevented,false,'card must retain native link navigation');
}

assert.deepEqual([...document.querySelectorAll('.guide-route-card')].map(a=>a.getAttribute('href')),['#rumah','#nota','#video','#gamifikasi','#quiz','#sijil']);
// The obsolete Home learning section and its handlers have been deliberately removed.
assert.equal(document.querySelector('#home-unit-learning'),null);
assert.equal(document.querySelector('#home-conversion-title'),null);
assert.equal(document.querySelector('#rumah').textContent.includes('JOM KUASAI'),false);
assert.equal(document.querySelector('.guide-inline-link').getAttribute('href'),'#nota');
assert.equal(source.includes("document.querySelector('#home-reverse')"),false);
// Electric feedback is decorative, bounded, and disabled when motion is reduced.
click(tab(0));assert.equal(tab(0).querySelector('.guide-electric-burst'),null,'guide motion was switched off earlier');
click(document.querySelector('#guide-motion'));click(tab(1));
assert.equal(tab(1).querySelectorAll('.guide-electric-burst').length,1);
assert.equal(tab(1).querySelector('.guide-electric-burst').getAttribute('aria-hidden'),'true');
click(tab(1));assert.equal(tab(1).querySelectorAll('.guide-electric-burst').length,1,'one burst per control even after repeated clicks');
reduceMotion.matches=true;click(tab(2));assert.equal(tab(2).querySelector('.guide-electric-burst'),null);
const oldCss=execFileSync('git',['show',base+':public/styles.css'],{cwd:root,encoding:'utf8'});assert.ok(readFileSync(root+'public/styles.css','utf8').startsWith(oldCss),'original background styles stay byte-identical');
console.log('PASS: all five guide steps, explicit completion, no premature congratulations, persistence/restart, keyboard tabs, six menu descriptions and real route links, existing tutor/music controls, reduced-motion, storage failure, obsolete Home section removed, electric tap feedback and original backgrounds/other pages preserved. Local DOM fixtures; browser visual QA unverified.');
