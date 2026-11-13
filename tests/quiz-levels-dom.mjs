const {parseHTML}=await import(process.env.LINKEDOM_MODULE || 'linkedom');
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const root=new URL('../',import.meta.url).pathname;
const {document,window}=parseHTML(readFileSync(root+'app/site-shell.html','utf8'));
const source=readFileSync(root+'public/app.js','utf8');
const start=source.indexOf('  const easyQuestions = [',source.indexOf('// Quiz Tokoyami'));
const code=source.slice(start,source.indexOf('  // Certificate unlocks',start));
let storage=new Map(), requests=[];
const context=vm.createContext({document,window,assert,localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)},crypto:{randomUUID:()=>String(Math.random())},fetch:async(...a)=>{requests.push(a);throw Error('offline fixture');},playSound:()=>{},refreshCertificateStats:()=>{}});
vm.runInContext(code+`
const click = el => el.dispatchEvent(new window.Event('click',{bubbles:true}));
const levelButtons=[...document.querySelectorAll('[data-quiz-level]')];
assert.equal(quizLevels.length,3);
quizLevels.forEach(l=>{assert.equal(l.questions.length,10);l.questions.forEach(q=>{assert.equal(q.options.length,4);assert.equal(new Set(q.options).size,4);assert.ok(q.answer>=0&&q.answer<4);});});
const numeric = option => Number(option.split(' ')[0].replaceAll(',',''));
const mediumExpected=[48.5*10,325/100,850/10,4.25*100,3500/1000,.906*1000,6.08*1000,7025/1000,.045*1000*100,12500/100/1000];
const hardExpected=[1.275+850/1000,5*100/8,3.006*1000-128.5*10,2.45*1000-1875,18.5-167/10,4*1.125*100,.875-350/1000,2+35/100+1650/1000,120*3.5/1000,6.4*100-3*75];
[mediumExpected,hardExpected].forEach((values,j)=>values.forEach((v,i)=>assert.ok(Math.abs(numeric(quizLevels[j+1].questions[i].options[quizLevels[j+1].questions[i].answer])-v)<1e-9)));
assert.equal(levelButtons[1].disabled,true);assert.equal(levelButtons[2].disabled,true);
startQuizLevel(2);assert.equal(activeQuizLevel,0);
function complete(score) {
 for(let i=0;i<10;i++){
  assert.equal(document.querySelector('#quiz-card').dataset.motion,String(i%5));
  assert.equal(document.querySelector('#quiz-question').textContent,questions[i].q);
  click(document.querySelector('#quiz-concept-toggle'));
  assert.equal(document.querySelector('#quiz-concept').hidden,false);
  assert.ok(document.querySelector('#quiz-concept').textContent.length>0);
  const answer=i<score?questions[i].answer:(questions[i].answer+1)%4;
  const button=document.querySelectorAll('.quiz-option')[answer];click(button);
  const before=quizScore;click(button);assert.equal(quizScore,before);
  click(document.querySelector('#next-question'));
 }
 assert.equal(quizScore,score);assert.equal(document.querySelector('#quiz-result').hidden,false);
 click(document.querySelector('#next-question'));assert.equal(quizIndex,10);
}
complete(5);assert.equal(levelButtons[1].disabled,true);assert.equal(document.querySelector('#next-quiz-level').hidden,true);
click(levelButtons[1]);assert.equal(activeQuizLevel,0);
click(document.querySelector('#restart-quiz'));assert.equal(quizIndex,0);
complete(6);assert.equal(levelButtons[1].disabled,false);assert.equal(levelButtons[2].disabled,true);
click(document.querySelector('#next-quiz-level'));assert.equal(activeQuizLevel,1);assert.equal(quizScore,0);
complete(5);assert.equal(levelButtons[2].disabled,true);
click(document.querySelector('#restart-quiz'));assert.equal(activeQuizLevel,1);
complete(6);assert.equal(levelButtons[2].disabled,false);
click(document.querySelector('#next-quiz-level'));assert.equal(activeQuizLevel,2);
complete(10);assert.equal(document.querySelector('#next-quiz-level').hidden,true);
click(document.querySelector('#restart-quiz'));assert.equal(activeQuizLevel,2);assert.equal(quizScore,0);
assert.deepEqual(practiceBest,[6,6,10]);
`,context);
assert.equal(storage.size,1);
// Verify the other five page sections are byte-identical to the previous pushed commit.
import {execFileSync} from 'node:child_process';
const before=execFileSync('git',['show','6ae2f6eaba692b8a0c0d7a481500c93a54aabfe6:app/site-shell.html'],{cwd:root,encoding:'utf8'});
const current=readFileSync(root+'app/site-shell.html','utf8');
for(const id of ['rumah','nota','video','gamifikasi','sijil']){const section=s=>s.slice(s.indexOf('<section id="'+id+'"'),s.indexOf('</section>',s.indexOf('<section id="'+id+'"'))+10);assert.equal(section(current),section(before));}
console.log('PASS: 30 questions, animations and hints every question; 5/10 locked, 6/10 unlock; Hard requires both stages; retry, duplicate click and completed-stage guard; five other pages unchanged. UI fixture only, not production database.');
