// Local DOM regression check. Supply LINKEDOM_MODULE; no real account or remote playback.
const {parseHTML}=await import(process.env.LINKEDOM_MODULE || 'linkedom');
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const html=readFileSync(root+'app/site-shell.html','utf8');
const {document,window}=parseHTML(html);
const source=readFileSync(root+'public/app.js','utf8');
const code=source.slice(source.indexOf('  // One shared player;'),source.indexOf('  // Gamifikasi hosts'));
const location={hash:'#video'};
const context=vm.createContext({document,window,location,reduceMotion:{matches:false}});
vm.runInContext(code+`
this.definitions=videoDefinitions;
this.select=selectMainVideo;
`,context);
const buttons=[...document.querySelectorAll('[data-video-select]')];
assert.equal(buttons.length,5);
let previous;
for(let i=0;i<5;i++){
 const click=new window.Event('click',{bubbles:true});buttons[i].dispatchEvent(click);
 const frames=[...document.querySelectorAll('#video iframe')];assert.equal(frames.length,1);
 assert.equal(frames[0].getAttribute('src'),context.definitions[i].embed);
 assert.equal(document.querySelector('#video-active-title').textContent,context.definitions[i].title);
 assert.equal(document.querySelector('#video-active-credit').textContent,context.definitions[i].credit);
 assert.equal(document.querySelector('#video-active-source').getAttribute('href'),context.definitions[i].source);
 assert.ok(document.querySelector('#video-active-description').textContent.length>30);
 assert.equal(buttons.filter(b=>b.getAttribute('aria-pressed')==='true').length,1);
 assert.equal(buttons[i].getAttribute('aria-pressed'),'true');
 if(previous)assert.equal(previous.isConnected,false,'old player must be removed to stop audio');
 previous=frames[0];
}
assert.match(context.definitions[4].embed,/DAHZTmLuk50\/ZAVRb9zo3JPUyCvqGtWv6Q\/watch\?embed$/);
assert.match(document.querySelector('#video-active-credit').textContent,/MOHAMMAD FIRDAUS/);
context.select(-1);assert.equal(document.querySelector('#video-selected-count').textContent,'05 / 05');
context.select(5);assert.equal(document.querySelector('#video-selected-count').textContent,'05 / 05');
buttons[4].dispatchEvent(new window.Event('click'));assert.equal(document.querySelector('#video iframe'),previous,'same selection preserves playback');
document.querySelector('#next-video').dispatchEvent(new window.Event('click'));assert.equal(document.querySelector('#video-selected-count').textContent,'01 / 05');
const keyEvent=(key)=>{const event=new window.Event('keydown',{cancelable:true});event.key=key;return event;};
buttons[0].dispatchEvent(keyEvent('End'));assert.equal(document.querySelector('#video-selected-count').textContent,'05 / 05');
buttons[4].dispatchEvent(keyEvent('ArrowRight'));assert.equal(document.querySelector('#video-selected-count').textContent,'01 / 05');
buttons[0].dispatchEvent(keyEvent('ArrowLeft'));assert.equal(document.querySelector('#video-selected-count').textContent,'05 / 05');
buttons[4].dispatchEvent(keyEvent('Home'));assert.equal(document.querySelector('#video-selected-count').textContent,'01 / 05');
location.hash='#nota';window.dispatchEvent(new window.Event('hashchange'));assert.equal(document.querySelectorAll('#video iframe').length,0);
location.hash='#video';window.dispatchEvent(new window.Event('hashchange'));assert.equal(document.querySelectorAll('#video iframe').length,1);
document.hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.querySelectorAll('#video iframe').length,0);
document.hidden=false;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(document.querySelectorAll('#video iframe').length,1);
let fullscreen=0;document.querySelector('#video-main-stage').requestFullscreen=async()=>{fullscreen++;};
document.querySelector('#video-fullscreen').dispatchEvent(new window.Event('click'));await Promise.resolve();assert.equal(fullscreen,1);
document.querySelector('#video-main-stage').requestFullscreen=undefined;
document.querySelector('#video-fullscreen').dispatchEvent(new window.Event('click'));await Promise.resolve();assert.match(document.querySelector('#video-player-help').textContent,/peranti ini/);
// Five independent artwork windows and a true dashed perimeter path per card.
assert.equal(document.querySelectorAll('.video-card-art svg image').length,5);
assert.equal(document.querySelectorAll('.video-neon-track').length,5);
for(const button of buttons){
 assert.equal(button.querySelectorAll('.video-neon-track rect').length,3);
 for(const rect of button.querySelectorAll('.video-neon-track rect'))assert.equal(rect.getAttribute('pathLength'),'1000');
 assert.equal(button.querySelector('.video-card-current').textContent,'SEMASA');
}
buttons[0].getBoundingClientRect=()=>({left:0,top:0,width:200,height:300});
const pointer=(kind,type,x,y)=>{const event=new window.Event(kind);event.pointerType=type;event.clientX=x;event.clientY=y;return event;};
buttons[0].dispatchEvent(pointer('pointermove','mouse',200,0));
assert.equal(buttons[0].style.getPropertyValue('--tilt-x'),'5deg');assert.equal(buttons[0].style.getPropertyValue('--tilt-y'),'5deg');
buttons[0].dispatchEvent(pointer('pointerleave','mouse',0,0));assert.equal(buttons[0].style.getPropertyValue('--tilt-y'),'0deg');
buttons[0].dispatchEvent(pointer('pointermove','touch',200,0));assert.equal(buttons[0].style.getPropertyValue('--tilt-y'),'0deg');
context.reduceMotion.matches=true;buttons[0].dispatchEvent(pointer('pointermove','mouse',200,0));assert.equal(buttons[0].style.getPropertyValue('--tilt-y'),'0deg');
const base='935fbfd95a31abcc0b9c78c7f392feded9fff730';
const previousHtml=execFileSync('git',['show',base+':app/site-shell.html'],{cwd:root,encoding:'utf8'});
const oldDocument=parseHTML(previousHtml).document;
for(const id of ['rumah','nota','gamifikasi','quiz','sijil'])assert.equal(document.querySelector('#'+id).outerHTML,oldDocument.querySelector('#'+id).outerHTML,'other page remains identical: '+id);
const oldJs=execFileSync('git',['show',base+':public/app.js'],{cwd:root,encoding:'utf8'});
const originalBank=oldJs.slice(oldJs.indexOf('  const videoDefinitions ='),oldJs.indexOf('  const videoDescriptions ='));
const oldContext=vm.createContext({});vm.runInContext(originalBank+'this.bank=videoDefinitions;',oldContext);
for(let i=0;i<4;i++)assert.equal(JSON.stringify(context.definitions[i]),JSON.stringify(oldContext.bank[i]),'original video URL, title and credit preserved');
assert.deepEqual(readFileSync(root+'public/assets/video-todoroki-3d-academy.png'),readFileSync('/workspace/scratch/388893653908/upload/image(20261103-135143).png'),'exact supplied background used');
console.log('PASS: five independent portrait windows, continuous perimeter geometry and mouse/touch/reduced-motion tilt guards; five original/selected Canva entries, single iframe, previous player disposal, route/visibility stop, active title/credit/description, keyboard selection, next wrap, real fullscreen call/fallback, exact background and five other pages unchanged. Remote Canva playback not simulated or verified.');
