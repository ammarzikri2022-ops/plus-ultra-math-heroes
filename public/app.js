(() => {
  'use strict';

  const routes = ['rumah', 'nota', 'video', 'gamifikasi', 'quiz', 'sijil', 'refleksi'];
  const pages = [...document.querySelectorAll('[data-page]')];
  const navLinks = [...document.querySelectorAll('[data-route]')];
  const nav = document.querySelector('#main-nav');
  const menuToggle = document.querySelector('.menu-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const homeBackgroundVideo = document.querySelector('.home-background-video');
  const syncHomeBackgroundVideo = () => {
    if (!homeBackgroundVideo) return;
    homeBackgroundVideo.muted = true;
    const homeAnchor = location.hash && document.getElementById(location.hash.slice(1))?.closest('#rumah');
    if (reduceMotion.matches || document.hidden || (location.hash && location.hash !== '#rumah' && !homeAnchor)) {
      homeBackgroundVideo.pause();
    } else {
      homeBackgroundVideo.play().catch(() => {});
    }
  };
  reduceMotion.addEventListener('change', syncHomeBackgroundVideo);
  document.addEventListener('visibilitychange', syncHomeBackgroundVideo);
  window.addEventListener('hashchange', syncHomeBackgroundVideo);
  document.addEventListener('pointerdown', syncHomeBackgroundVideo, { passive: true });
  syncHomeBackgroundVideo();
  const scrollBehavior = () => reduceMotion.matches ? 'auto' : 'smooth';

  let audioContext;
  function playSound(kind = 'click') {
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state === 'suspended') audioContext.resume();
      const patterns = {
        click: [[420, 0, .045, .035], [650, .035, .035, .025]],
        correct: [[520, 0, .09, .06], [660, .09, .09, .07], [820, .18, .14, .08]],
        wrong: [[230, 0, .12, .055], [170, .1, .16, .045]],
        victory: [[440, 0, .12, .065], [554, .12, .12, .07], [659, .24, .13, .075], [880, .38, .25, .09]]
      };
      const start = audioContext.currentTime;
      (patterns[kind] || patterns.click).forEach(([frequency, offset, duration, volume]) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = kind === 'wrong' ? 'sawtooth' : 'sine';
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(volume, start + offset + .01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        oscillator.connect(gain).connect(audioContext.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + duration + .02);
      });
    } catch (_) {
      // Audio is optional; the learning experience continues if a browser blocks it.
    }
  }

  document.addEventListener('click', event => {
    if (event.target.closest('button, a[href]')) playSound('click');
  });

  const themeMusic = document.querySelector('#theme-music');
  const musicToggle = document.querySelector('#music-toggle');
  const musicLabel = document.querySelector('#music-label');
  themeMusic.volume = 0.28;
  themeMusic.loop = true;
  function updateMusicButton(playing) {
    musicToggle.classList.toggle('is-playing', playing);
    musicToggle.setAttribute('aria-pressed', String(playing));
    musicToggle.setAttribute('aria-label', playing ? 'Matikan muzik latar' : 'Hidupkan muzik latar');
    musicLabel.textContent = playing ? 'Muzik ON' : 'Muzik OFF';
  }
  musicToggle.addEventListener('click', async () => {
    if (themeMusic.paused) {
      try {
        await themeMusic.play();
        updateMusicButton(true);
      } catch (_) {
        updateMusicButton(false);
      }
    } else {
      themeMusic.pause();
      updateMusicButton(false);
    }
  });
  themeMusic.addEventListener('play', () => updateMusicButton(true));
  themeMusic.addEventListener('pause', () => updateMusicButton(false));

  // Home guide is local orientation progress, separate from official quiz records.
  const guideRoot = document.querySelector('#home-guide');
  const guideTabs = [...document.querySelectorAll('[data-guide-step]')];
  const guidePanels = [...document.querySelectorAll('.guide-step-panel')];
  const guideNames = ['Pengenalan','Navigasi Menu','Fungsi Utama','Tips Penggunaan','Misi Panduan'];
  const guideDialogs = [
    'Hai, Wira! Kenali akademi Matematik kita. Tekan Seterusnya selepas membaca.',
    'Enam menu, enam rakan wira! Tekan ikon untuk mengenali tugas setiap halaman.',
    'Mulakan dengan nota, kukuhkan melalui video dan permainan, kemudian cuba kuiz!',
    'Perlukan bantuan? Guru Deku sedia membantu. Pilih muzik dan gerakan yang selesa.',
    'Semak semua langkah. Lengkapkan misi panduan dan mulakan pengembaraan!'
  ];
  const guideMenuDescriptions = [
    'Rumah — Halaman utama, panduan penggunaan dan panel penukaran unit.',
    'Nota — Baca konsep, contoh dan langkah; cuba latihan serta simulator Bakugo.',
    'Video — Pilih VIDEO 01–05 dalam satu pemain untuk lagu, podcast dan pengajaran.',
    'Gamifikasi — Baca arahan, pilih Space Defender, Mask Maze atau Hero Run dan belajar sambil bermain.',
    'Kuiz — Easy, Medium dan Hard mempunyai 10 soalan setiap tahap. Minimum 6/10 membuka tahap berikutnya.',
    'Sijil — Keputusan kuiz rasmi yang disimpan dan mencapai minimum 6/10 membolehkan anda menjana sijil.'
  ];
  const guideIdentity = JSON.parse(document.querySelector('#ua-account-context')?.textContent || '{}');
  const guideStorageKey = 'plusUltraGuide:v1:' + (guideIdentity.id || 'browser');
  let guideStep=0, guideDone=[false,false,false,false,false], guideMotionOff=false;
  try {
    const saved=JSON.parse(localStorage.getItem(guideStorageKey) || 'null');
    if(saved && Array.isArray(saved.done) && saved.done.length===5) {
      guideDone=saved.done.map(x=>x===true);
      if(!guideDone.slice(0,4).every(Boolean)) guideDone[4]=false;
      if(Number.isInteger(saved.step) && saved.step>=0 && saved.step<5) guideStep=saved.step;
      guideMotionOff=saved.motionOff===true;
    }
  } catch {}
  function saveGuideProgress() {
    try { localStorage.setItem(guideStorageKey,JSON.stringify({done:guideDone,step:guideStep,motionOff:guideMotionOff})); }
    catch { document.querySelector('#guide-storage-note').textContent='Kemajuan kekal untuk sesi ini. Penyimpanan peranti tidak tersedia.'; }
  }
  function syncGuideMotion() {
    const off=guideMotionOff || reduceMotion.matches;
    guideRoot.classList.toggle('guide-motion-off',off);
    if(off)guideRoot.querySelectorAll('.guide-electric-burst').forEach(burst=>burst.remove());
    const button=document.querySelector('#guide-motion');
    button.disabled=reduceMotion.matches;
    button.setAttribute('aria-pressed',String(off));
    button.textContent=reduceMotion.matches ? 'Animasi dikurangkan oleh peranti' : `Animasi panduan: ${off?'OFF':'ON'}`;
  }
  function syncGuideProgress() {
    const doneCount=guideDone.filter(Boolean).length, percent=doneCount*20;
    document.querySelector('#guide-percent').textContent=percent+'%';
    document.querySelector('#guide-progress').setAttribute('aria-valuenow',String(percent));
    document.querySelector('#guide-progress span').style.width=percent+'%';
    document.querySelector('#guide-progress-copy').textContent=`${doneCount} daripada 5 langkah selesai`;
    guideTabs.forEach((tab,i)=>{
      tab.classList.toggle('guide-step-done',guideDone[i]);
      tab.querySelector('i').textContent=guideDone[i]?'✓':'';
      tab.setAttribute('aria-label',`Langkah ${i+1}: ${guideNames[i]}${guideDone[i]?', selesai':''}`);
      document.querySelector(`[data-guide-check="${i}"]`).textContent=guideDone[i]?'✓':'○';
      document.querySelector(`[data-guide-check-status="${i}"]`).textContent=guideDone[i]?'Selesai':'Belum selesai';
    });
    document.querySelector('#guide-success').hidden=!guideDone.every(Boolean);
    document.querySelector('#guide-next').textContent=guideStep<4?'Seterusnya →':guideDone.every(Boolean)?'Panduan selesai ✓':'Sahkan Misi ✓';
    document.querySelector('#guide-next').disabled=guideStep===4 && guideDone.every(Boolean);
  }
  function showGuideStep(index,focus=false) {
    if(!Number.isInteger(index)||index<0||index>4)return;
    guideStep=index;
    guideTabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;});
    guidePanels.forEach((panel,i)=>{panel.hidden=i!==index;panel.classList.remove('guide-step-enter');});
    const panel=guidePanels[index];void panel.offsetWidth;panel.classList.add('guide-step-enter');
    document.querySelector('#guide-step-number').textContent=`0${index+1} / 05`;
    document.querySelector('#guide-active-label').textContent=`Langkah ${index+1} / 5`;
    document.querySelector('#guide-prev').disabled=index===0;
    document.querySelector('#guide-deku-dialog').textContent=guideDone.every(Boolean)?'TAHNIAH, WIRA! Kamu bersedia menerokai semua misi Matematik!':guideDialogs[index];
    document.querySelector('#guide-mission-message').textContent='';
    guideRoot.classList.remove('guide-choice-glow');void guideRoot.offsetWidth;guideRoot.classList.add('guide-choice-glow');
    syncGuideProgress();saveGuideProgress();
    if(focus)panel.focus({preventScroll:true});
  }
  guideTabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>showGuideStep(i));
    tab.addEventListener('keydown',event=>{
      const next=event.key==='ArrowRight'?(i+1)%5:event.key==='ArrowLeft'?(i+4)%5:event.key==='Home'?0:event.key==='End'?4:null;
      if(next===null)return;event.preventDefault();showGuideStep(next);guideTabs[next].focus();
    });
  });
  document.querySelector('#guide-prev').addEventListener('click',()=>showGuideStep(guideStep-1,true));
  document.querySelector('#guide-next').addEventListener('click',()=>{
    if(guideStep<4){guideDone[guideStep]=true;showGuideStep(guideStep+1,true);return;}
    if(!guideDone.slice(0,4).every(Boolean)) {
      const missing=guideDone.slice(0,4).findIndex(x=>!x);
      document.querySelector('#guide-mission-message').textContent=`Lengkapkan langkah ${missing+1} — ${guideNames[missing]} dahulu. Tekan namanya dalam senarai semak untuk kembali.`;
      return;
    }
    guideDone[4]=true;syncGuideProgress();saveGuideProgress();
    document.querySelector('#guide-deku-dialog').textContent='TAHNIAH, WIRA! Semua langkah selesai. PLUS ULTRA!';
  });
  document.querySelector('#guide-restart').addEventListener('click',()=>{guideDone=[false,false,false,false,false];showGuideStep(0,true);});
  document.querySelectorAll('[data-guide-review]').forEach(button=>button.addEventListener('click',()=>showGuideStep(Number(button.dataset.guideReview),true)));
  document.querySelectorAll('[data-guide-menu]').forEach(button=>button.addEventListener('click',()=>{
    const i=Number(button.dataset.guideMenu);
    document.querySelector('#guide-menu-description').textContent=guideMenuDescriptions[i];
    document.querySelectorAll('[data-guide-menu]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
  }));
  document.querySelector('#guide-open-tutor').addEventListener('click',()=>{if(document.querySelector('#deku-chat').hidden)document.querySelector('#deku-fab').click();});
  document.querySelector('#guide-music').addEventListener('click',()=>musicToggle.click());
  const syncGuideMusic=()=>{const on=!themeMusic.paused;document.querySelector('#guide-music').textContent=on?'Matikan muzik':'Hidupkan muzik';document.querySelector('#guide-music').setAttribute('aria-pressed',String(on));};
  themeMusic.addEventListener('play',syncGuideMusic);themeMusic.addEventListener('pause',syncGuideMusic);
  document.querySelector('#guide-motion').addEventListener('click',()=>{guideMotionOff=!guideMotionOff;syncGuideMotion();saveGuideProgress();});
  reduceMotion.addEventListener('change',syncGuideMotion);
  syncGuideMusic();syncGuideMotion();showGuideStep(guideStep);
  // One brief, decorative electric burst per activated Home guide control.
  guideRoot.addEventListener('click',event=>{
    const control=event.target.closest('button,a');
    if(!control || control.disabled || reduceMotion.matches || guideRoot.classList.contains('guide-motion-off')) return;
    control.querySelector('.guide-electric-burst')?.remove();
    const burst=document.createElement('span');
    burst.className='guide-electric-burst';burst.setAttribute('aria-hidden','true');
    for(let i=0;i<6;i++) {const ray=document.createElement('i');ray.style.setProperty('--ray-angle',`${i*60}deg`);burst.appendChild(ray);}
    control.appendChild(burst);
    burst.addEventListener('animationend',event=>{if(event.target===burst)burst.remove();});
    window.setTimeout(()=>burst.remove(),900);
  });


  // GURU DEKU AI: one draggable tutor shared by every hash-routed page.
  const dekuFab = document.querySelector('#deku-fab');
  const dekuChat = document.querySelector('#deku-chat');
  const dekuClose = document.querySelector('#deku-close');
  const dekuNewChat = document.querySelector('#deku-new-chat');
  const dekuMessages = document.querySelector('#deku-messages');
  const dekuThinking = document.querySelector('#deku-thinking');
  const dekuError = document.querySelector('#deku-error');
  const dekuForm = document.querySelector('#deku-form');
  const dekuInput = document.querySelector('#deku-input');
  const dekuSend = document.querySelector('#deku-send');
  const dekuEndpoint = document.querySelector('meta[name="guru-deku-api"]')?.content || '/api/guru-deku';
  const dekuGreeting = 'Hai, Wira! Saya Guru Deku AI. Saya sedia membantu kamu belajar, menjawab soalan dan memahami perkara baharu. Tanya sahaja apa-apa soalan. PLUS ULTRA!';
  let dekuHistory = [];
  let dekuDrag = null;
  let dekuDragged = false;

  function clampDekuButton(left, top) {
    const width = dekuFab.offsetWidth;
    const height = dekuFab.offsetHeight;
    return {
      left: Math.max(6, Math.min(left, window.innerWidth - width - 6)),
      top: Math.max(6, Math.min(top, window.innerHeight - height - 6))
    };
  }
  function placeDekuButton(left, top, persist = true) {
    const point = clampDekuButton(left, top);
    dekuFab.style.left = `${point.left}px`;
    dekuFab.style.top = `${point.top}px`;
    dekuFab.style.right = 'auto';
    dekuFab.style.bottom = 'auto';
    if (persist) localStorage.setItem('plusUltraDekuPosition', JSON.stringify(point));
  }
  try {
    const saved = JSON.parse(localStorage.getItem('plusUltraDekuPosition') || 'null');
    if (saved && Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      requestAnimationFrame(() => placeDekuButton(saved.left, saved.top, false));
    }
  } catch (_) { /* Use the default CSS position. */ }

  dekuFab.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = dekuFab.getBoundingClientRect();
    dekuDrag = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, left: rect.left, top: rect.top };
    dekuDragged = false;
    dekuFab.setPointerCapture?.(event.pointerId);
  });
  dekuFab.addEventListener('pointermove', event => {
    if (!dekuDrag || event.pointerId !== dekuDrag.pointerId) return;
    const dx = event.clientX - dekuDrag.startX;
    const dy = event.clientY - dekuDrag.startY;
    if (!dekuDragged && Math.hypot(dx, dy) < 6) return;
    dekuDragged = true;
    event.preventDefault();
    placeDekuButton(dekuDrag.left + dx, dekuDrag.top + dy, false);
  });
  function finishDekuDrag(event) {
    if (!dekuDrag || event.pointerId !== dekuDrag.pointerId) return;
    dekuFab.releasePointerCapture?.(event.pointerId);
    dekuDrag = null;
    if (dekuDragged) {
      const rect = dekuFab.getBoundingClientRect();
      placeDekuButton(rect.left, rect.top, true);
    }
  }
  dekuFab.addEventListener('pointerup', finishDekuDrag);
  dekuFab.addEventListener('pointercancel', finishDekuDrag);

  function placeDekuPanel() {
    if (dekuChat.hidden) return;
    const fabRect = dekuFab.getBoundingClientRect();
    const panelWidth = dekuChat.offsetWidth;
    const panelHeight = dekuChat.offsetHeight;
    const left = Math.max(8, Math.min(fabRect.left, window.innerWidth - panelWidth - 8));
    const roomAbove = fabRect.top - 10;
    const top = roomAbove >= panelHeight ? fabRect.top - panelHeight - 10 : Math.min(fabRect.bottom + 10, window.innerHeight - panelHeight - 8);
    dekuChat.style.left = `${left}px`;
    dekuChat.style.top = `${Math.max(8, top)}px`;
    dekuChat.style.right = 'auto';
    dekuChat.style.bottom = 'auto';
  }
  function openDekuChat() {
    dekuChat.hidden = false;
    dekuFab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      placeDekuPanel();
      dekuInput.focus();
    });
  }
  function closeDekuChat() {
    dekuChat.hidden = true;
    dekuFab.setAttribute('aria-expanded', 'false');
    dekuFab.focus();
  }
  dekuFab.addEventListener('click', event => {
    if (dekuDragged) {
      event.preventDefault();
      event.stopPropagation();
      dekuDragged = false;
      return;
    }
    dekuChat.hidden ? openDekuChat() : closeDekuChat();
  });
  dekuClose.addEventListener('click', closeDekuChat);
  window.addEventListener('resize', () => {
    const rect = dekuFab.getBoundingClientRect();
    placeDekuButton(rect.left, rect.top, false);
    placeDekuPanel();
  });

  function appendDekuMessage(text, type) {
    const message = document.createElement('article');
    message.className = `deku-message ${type === 'user' ? 'deku-question' : 'deku-answer'}`;
    message.textContent = text;
    dekuMessages.appendChild(message);
    dekuMessages.scrollTop = dekuMessages.scrollHeight;
  }
  function resetDekuChat() {
    dekuHistory = [];
    dekuMessages.innerHTML = '';
    appendDekuMessage(dekuGreeting, 'assistant');
    dekuError.hidden = true;
    dekuError.textContent = '';
    dekuInput.value = '';
    dekuInput.focus();
  }
  dekuNewChat.addEventListener('click', resetDekuChat);

  const dekuPageContexts = {
    rumah: 'Halaman Rumah: bantu murid memahami laman dan memilih Nota, Video, Gamifikasi, Quiz atau Sijil.',
    nota: 'Halaman Nota: terangkan konsep panjang, mm, cm, m, km dan penukaran unit dengan petunjuk langkah demi langkah.',
    video: 'Halaman Video: bantu murid memahami topik video pembelajaran dan kaitannya dengan panjang serta penukaran unit.',
    gamifikasi: 'Halaman Gamifikasi: terangkan peraturan permainan dan beri petunjuk tanpa mengambil alih usaha murid.',
    quiz: 'Halaman Quiz: bantu memahami konsep tetapi jangan dedahkan jawapan soalan semasa kecuali murid menyatakan mereka sudah menjawab dan meminta penerangan.',
    sijil: 'Halaman Sijil: terangkan syarat pencapaian, cara menjana dan mencetak sijil aktiviti.'
  };
  function currentDekuContext() {
    const route = location.hash.slice(1).toLowerCase();
    return dekuPageContexts[route] || dekuPageContexts.rumah;
  }
  dekuForm.addEventListener('submit', async event => {
    event.preventDefault();
    const question = dekuInput.value.trim();
    if (!question) {
      dekuError.textContent = 'Taip satu soalan dahulu, Wira.';
      dekuError.hidden = false;
      dekuInput.focus();
      return;
    }
    dekuError.hidden = true;
    appendDekuMessage(question, 'user');
    dekuHistory.push({ role: 'user', content: question });
    dekuInput.value = '';
    dekuInput.disabled = true;
    dekuSend.disabled = true;
    dekuThinking.hidden = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(dekuEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: question, history: dekuHistory.slice(-10), context: currentDekuContext() }),
        signal: controller.signal
      });
      let data = {};
      try { data = await response.json(); } catch (_) { /* Non-JSON errors are handled below. */ }
      if (!response.ok) {
        const fallback = [404, 405, 501, 503].includes(response.status)
          ? 'Sambungan Guru Deku belum tersedia. Sila maklumkan kepada guru.'
          : 'Sambungan Guru Deku gagal. Sila cuba lagi sebentar nanti.';
        throw new Error(data.error || fallback);
      }
      if (!data.answer || typeof data.answer !== 'string') throw new Error('Jawapan AI tidak dapat dibaca.');
      dekuHistory.push({ role: 'assistant', content: data.answer });
      dekuHistory = dekuHistory.slice(-10);
      appendDekuMessage(data.answer, 'assistant');
    } catch (error) {
      const message = error.name === 'AbortError'
        ? 'Guru Deku mengambil masa terlalu lama. Sila cuba lagi.'
        : error.name === 'TypeError'
          ? 'Sambungan Guru Deku gagal. Periksa internet dan cuba lagi.'
          : error.message || 'Sambungan Guru Deku gagal.';
      dekuError.textContent = message;
      dekuError.hidden = false;
    } finally {
      clearTimeout(timeout);
      dekuThinking.hidden = true;
      dekuInput.disabled = false;
      dekuSend.disabled = false;
      dekuInput.focus();
    }
  });

  function showRoute() {
    const requested = location.hash.slice(1).toLowerCase();
    if (requested && !routes.includes(requested)) {
      const target = document.getElementById(requested);
      if (target) target.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
      return;
    }
    const route = routes.includes(requested) ? requested : 'rumah';
    pages.forEach(page => {
      const active = page.dataset.page === route;
      page.hidden = !active;
      page.classList.toggle('active', active);
    });
    navLinks.forEach(link => {
      const active = link.dataset.route === route;
      link.classList.toggle('active', active);
      active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current');
    });
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    document.title = `${route[0].toUpperCase() + route.slice(1)} — PLUS ULTRA MATH HEROES`;
    if (route === 'sijil') refreshCertificateStats();
    handleGameRoute(route);
    window.scrollTo({ top: 0, behavior: scrollBehavior() });
  }

  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
  });
  window.addEventListener('hashchange', showRoute);
  if (!location.hash) history.replaceState(null, '', '#rumah');

  // Nota Bakugo: unit cards, progressive examples, mini practice and hints.
  // The five objectives count observed activity in this page session. Visiting
  // another page alone never completes a mission.
  const objectiveSection = document.querySelector('#bakugo-objectives');
  if (objectiveSection) {
    const completed = new Set();
    const completeObjective = number => {
      if (completed.has(number)) return;
      completed.add(number);
      objectiveSection.querySelector(`[data-objective="${number}"]`)?.classList.add('is-complete');
      const count = completed.size;
      objectiveSection.querySelector('#bakugo-progress-count').textContent = `${count}/5`;
      const progress = objectiveSection.querySelector('.bakugo-progress-track');
      progress.setAttribute('aria-valuenow', String(count));
      objectiveSection.querySelector('#bakugo-progress-fill').style.width = `${count * 20}%`;
      objectiveSection.querySelector('#bakugo-progress-message').textContent = count === 5 ? 'Semua lima misi selesai!' : `${5 - count} misi lagi untuk diselesaikan.`;
      if (count === 5) objectiveSection.querySelector('#bakugo-success').hidden = false;
    };
    const relations = {
      mm: '10 mm = 1 cm. Untuk mm → cm, bahagi 10.',
      cm: '1 cm = 10 mm dan 100 cm = 1 m.',
      m: '1 m = 100 cm dan 1,000 m = 1 km.',
      km: '1 km = 1,000 m. Untuk km → m, darab 1,000.'
    };
    objectiveSection.querySelector('.bakugo-unit-buttons').addEventListener('click', event => {
      const button = event.target.closest('button[data-relation]');
      if (!button) return;
      objectiveSection.querySelector('#bakugo-relation-output').textContent = relations[button.dataset.relation];
      completeObjective(1);
    });
    objectiveSection.querySelector('#bakugo-show-working').addEventListener('click', event => {
      const working = objectiveSection.querySelector('#bakugo-working');
      working.hidden = !working.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!working.hidden));
      event.currentTarget.textContent = working.hidden ? 'TUNJUKKAN PENGIRAAN' : 'SEMBUNYIKAN PENGIRAAN';
      if (!working.hidden) completeObjective(2);
    });
    // The quiz status node is created later in this script.
    setTimeout(() => {
    const quizStatus = document.querySelector('.quiz-cloud-status');
    const quizScore = document.querySelector('#final-score');
    const reflectionStatus = document.querySelector('#hero-reflection-status');
    const gameOverlays = [...document.querySelectorAll('#maze-complete-overlay,#run-complete-overlay')];
    const observeCompletion = () => {
      if (quizStatus?.textContent.includes('Keputusan Supabase disimpan:')) {
        const match = quizScore?.textContent.match(/^(\d+)\s*\/\s*10$/);
        if (match && Number(match[1]) >= 8) completeObjective(3);
      }
      if (gameOverlays.some(overlay => !overlay.hidden)) completeObjective(4);
      if (reflectionStatus?.textContent.includes('Refleksi anda berjaya disimpan.')) completeObjective(5);
    };
    [quizStatus,quizScore,reflectionStatus,...gameOverlays].filter(Boolean).forEach(element => {
      new MutationObserver(observeCompletion).observe(element,{attributes:true,childList:true,characterData:true,subtree:true,attributeFilter:['hidden']});
    });
    observeCompletion();
    }, 0);
  }
  const noteMissionNames = ['MILLIMETER BLAST', 'CENTIMETER IMPACT', 'KILOMETER EXPLOSION'];
  const noteMissionDescriptions = ['cm ↔ mm • Darab atau bahagi 10.', 'm ↔ cm • Darab atau bahagi 100.', 'km ↔ m • Darab atau bahagi 1,000.'];
  document.querySelectorAll('#nota .lesson-card').forEach((card, index) => {
    const heading = document.createElement('h3');
    heading.className = 'note-mission-title';
    heading.textContent = noteMissionNames[index];
    card.querySelector('h2').before(heading);
    const description = document.createElement('p');
    description.className = 'note-mission-description';
    description.textContent = noteMissionDescriptions[index];
    heading.after(description);
    const disclosure = document.createElement('details');
    disclosure.className = 'note-mission-details';
    const summary = document.createElement('summary');
    summary.textContent = 'Buka Nota →';
    disclosure.appendChild(summary);
    disclosure.appendChild(card.querySelector('.working'));
    disclosure.appendChild(card.querySelector('.lesson-actions'));
    card.appendChild(disclosure);
  });
  const unitFacts = {
    km: '<strong>Kilometer (km)</strong> digunakan untuk jarak jauh. 1 km = 1,000 m. Contoh: jarak antara dua bandar.',
    m: '<strong>Meter (m)</strong> digunakan untuk panjang sederhana. 1 m = 100 cm = 1,000 mm. Contoh: tinggi pintu.',
    cm: '<strong>Sentimeter (cm)</strong> sesuai untuk objek kecil. 1 cm = 10 mm. Contoh: panjang pensel.',
    mm: '<strong>Milimeter (mm)</strong> digunakan untuk ukuran sangat kecil. 10 mm = 1 cm. Contoh: ketebalan kad.'
  };
  document.querySelector('.unit-ladder').addEventListener('click', event => {
    const card = event.target.closest('.unit-card');
    if (!card) return;
    document.querySelectorAll('.unit-card').forEach(item => item.setAttribute('aria-expanded', String(item === card)));
    const noteUnitExamples = { km: '2.006 km × 1,000 = 2,006 m', m: '2.5 m × 100 = 250 cm', cm: '48.5 cm × 10 = 485 mm', mm: '850 mm ÷ 10 = 85 cm' };
    document.querySelector('#unit-info').innerHTML = `${unitFacts[card.dataset.unit]}<br><b class="note-unit-example">${noteUnitExamples[card.dataset.unit]}</b>`;
  });

  document.querySelectorAll('.reveal-step').forEach(button => {
    button.addEventListener('click', () => {
      const steps = [...button.closest('.lesson-card').querySelectorAll('.solution-steps li')];
      const next = steps.find(step => !step.classList.contains('shown'));
      if (next) next.classList.add('shown');
      const remaining = steps.filter(step => !step.classList.contains('shown')).length;
      button.textContent = remaining ? `Langkah Seterusnya (${remaining})` : 'Semua Langkah Ditunjukkan ✓';
      if (!remaining) button.disabled = true;
    });
  });
  document.querySelectorAll('.try-practice').forEach(button => {
    button.addEventListener('click', () => {
      document.querySelector('#mini-practice').scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
      document.querySelector('#note-answer').focus({ preventScroll: true });
    });
  });
  document.querySelector('#note-hint').addEventListener('click', () => {
    document.querySelector('#note-feedback').className = 'feedback';
    document.querySelector('#note-feedback').textContent = 'Petunjuk Bakugo: m ialah unit lebih besar daripada cm. Darab 7.2 dengan 100.';
  });
  document.querySelector('#note-practice-form').addEventListener('submit', event => {
    event.preventDefault();
    const answer = Number(document.querySelector('#note-answer').value);
    const feedback = document.querySelector('#note-feedback');
    if (Math.abs(answer - 720) < 1e-9) {
      feedback.className = 'feedback good';
      feedback.innerHTML = '<strong>LETUPAN TEPAT!</strong> 7.2 × 100 = 720 cm.';
      playSound('correct');
    } else {
      feedback.className = 'feedback bad';
      feedback.innerHTML = '<strong>Belum tepat.</strong> Semak arah penukaran: m → cm ialah unit besar kepada unit kecil.';
      playSound('wrong');
    }
  });

  // Bakugo Explosive Math Academy — interactive visual learning (Nota Asas only).
  const academy = document.querySelector('#bakugo-math-academy');
  if (academy) {
    const conversionTrack = academy.querySelector('.conversion-track');
    const conversionDemo = academy.querySelector('#conversion-demo');
    let conversionForward = true;
    const renderConversionDirection = () => {
      conversionTrack.dataset.direction = conversionForward ? 'forward' : 'reverse';
      academy.querySelectorAll('.conversion-arrow').forEach(arrow => {
        const factor = Number(arrow.dataset.factor);
        arrow.querySelector('span').textContent = conversionForward ? `× ${factor.toLocaleString('en-US')}` : `÷ ${factor.toLocaleString('en-US')}`;
        arrow.querySelector('i').textContent = conversionForward ? '➜' : '➜';
      });
      academy.querySelector('#conversion-direction').setAttribute('aria-pressed', String(!conversionForward));
      conversionDemo.innerHTML = `<span class="moving-number">1</span><p><b>${conversionForward ? 'Unit besar → kecil: darab.' : 'Unit kecil → besar: bahagi.'}</b> Pilih anak panah untuk melihat langkah pengiraan.</p>`;
    };
    academy.querySelector('#conversion-direction').addEventListener('click', () => { conversionForward = !conversionForward; renderConversionDirection(); });
    academy.querySelectorAll('.conversion-arrow').forEach(arrow => arrow.addEventListener('click', () => {
      const factor = Number(arrow.dataset.factor);
      const from = conversionForward ? arrow.dataset.from : arrow.dataset.to;
      const to = conversionForward ? arrow.dataset.to : arrow.dataset.from;
      const start = conversionForward ? 1 : factor;
      const result = conversionForward ? factor : 1;
      conversionDemo.classList.remove('is-animating'); void conversionDemo.offsetWidth; conversionDemo.classList.add('is-animating');
      conversionDemo.innerHTML = `<span class="moving-number">${start.toLocaleString('en-US')}</span><p><b>${start.toLocaleString('en-US')} ${from} ${conversionForward ? '×' : '÷'} ${factor.toLocaleString('en-US')} = ${result.toLocaleString('en-US')} ${to}</b><br>${conversionForward ? 'Setiap digit memperoleh nilai tempat lebih besar.' : 'Setiap digit memperoleh nilai tempat lebih kecil.'}</p>`;
      playSound('correct');
    }));

    let labStep = 0;
    const labSteps = [...academy.querySelectorAll('#lab-steps li')];
    const renderLab = () => {
      labSteps.forEach((step, index) => step.classList.toggle('is-active', index <= labStep));
      academy.querySelector('#lab-progress-fill').style.width = `${(labStep + 1) * 25}%`;
      academy.querySelector('#lab-next').textContent = labStep === 3 ? 'MISI SELESAI ✓' : 'LANGKAH SETERUSNYA';
      academy.querySelector('#lab-feedback').textContent = labStep === 3 ? '💥 Bakugo: PLUS ULTRA! BETUL! 3.45 m = 345 cm.' : `Bakugo: Langkah ${labStep + 1} sudah dikuasai. Teruskan!`;
    };
    academy.querySelector('#lab-next').addEventListener('click', () => { if (labStep < 3) { labStep += 1; renderLab(); playSound(labStep === 3 ? 'victory' : 'correct'); } });
    academy.querySelector('#lab-replay').addEventListener('click', () => { labStep = 0; renderLab(); });
    academy.querySelector('#lab-try').addEventListener('click', () => { activateNoteTab(2); document.querySelector('#mini-practice').scrollIntoView({ behavior: scrollBehavior(), block: 'center' }); });

    const baseDecimal = 2.375;
    const decimalLabels = { '10':'× 10', '100':'× 100', '1000':'× 1,000', '0.1':'÷ 10', '0.01':'÷ 100', '0.001':'÷ 1,000' };
    academy.querySelector('.decimal-controls').addEventListener('click', event => {
      const button = event.target.closest('button[data-operation]'); if (!button) return;
      const multiplier = Number(button.dataset.operation); const answer = baseDecimal * multiplier;
      academy.querySelectorAll('.decimal-controls button').forEach(item => item.classList.toggle('is-active', item === button));
      academy.querySelector('#decimal-value').textContent = '2.375';
      academy.querySelector('#decimal-equation span').textContent = decimalLabels[button.dataset.operation];
      academy.querySelector('#decimal-result').textContent = answer.toLocaleString('en-US', { maximumFractionDigits: 6 });
      academy.querySelector('#decimal-digits').classList.remove('is-shifting'); void academy.querySelector('#decimal-digits').offsetWidth; academy.querySelector('#decimal-digits').classList.add('is-shifting');
      const places = Math.abs(Math.round(Math.log10(multiplier)));
      const direction = multiplier >= 1 ? 'ke kiri' : 'ke kanan';
      academy.querySelector('#decimal-explain').innerHTML = `<b>2.375 ${decimalLabels[button.dataset.operation]} = ${answer.toLocaleString('en-US', { maximumFractionDigits: 6 })}.</b> Setiap digit berubah ${places} nilai tempat ${direction}; sebab itu nilai nombor ${multiplier >= 1 ? 'menjadi lebih besar' : 'menjadi lebih kecil'}.`;
    });

    const academyQuestions = [
      { text:'4.5 m = ? cm', options:['45 cm','450 cm','4,500 cm'], answer:'450 cm', hint:'m → cm: darab 100. 4.5 × 100 = 450.' },
      { text:'750 mm = ? cm', options:['7.5 cm','75 cm','750 cm'], answer:'75 cm', hint:'mm → cm: bahagi 10. 750 ÷ 10 = 75.' },
      { text:'1.25 km = ? m', options:['125 m','1,250 m','12,500 m'], answer:'1,250 m', hint:'km → m: darab 1,000. 1.25 × 1,000 = 1,250.' }
    ];
    let academyQuestionIndex = 0; let academyCorrect = 0;
    const renderAcademyQuestion = () => {
      const question = academyQuestions[academyQuestionIndex];
      academy.querySelector('#academy-question-number').textContent = String(academyQuestionIndex + 1);
      academy.querySelector('#academy-question-text').textContent = question.text;
      academy.querySelector('#academy-options').innerHTML = question.options.map(option => `<button type="button">${option}</button>`).join('');
      academy.querySelector('#academy-challenge-feedback').className = ''; academy.querySelector('#academy-challenge-feedback').textContent = 'Pilih jawapan terbaik.';
      academy.querySelector('#challenge-progress-fill').style.width = `${academyQuestionIndex / 3 * 100}%`;
    };
    academy.querySelector('#academy-options').addEventListener('click', event => {
      const button = event.target.closest('button'); if (!button) return;
      const question = academyQuestions[academyQuestionIndex];
      if (button.textContent === question.answer) {
        button.classList.add('is-correct'); academyCorrect += 1; playSound('correct');
        academy.querySelector('#academy-challenge-feedback').className = 'good'; academy.querySelector('#academy-challenge-feedback').textContent = '★ EXPLOSIVE SUCCESS! Jawapan tepat! ★';
        academy.querySelectorAll('#academy-options button').forEach(item => item.disabled = true);
        setTimeout(() => { academyQuestionIndex += 1; if (academyQuestionIndex < 3) renderAcademyQuestion(); else { academy.querySelector('#academy-question').innerHTML = `<small>MISI SELESAI</small><strong>💥 EXPLOSIVE SUCCESS!</strong><p class="good">${academyCorrect}/3 betul — PLUS ULTRA!</p><button id="academy-retry" class="academy-action" type="button">CUBA LAGI</button>`; academy.querySelector('#challenge-progress-fill').style.width = '100%'; academy.querySelector('#academy-retry').addEventListener('click', () => { academyQuestionIndex = 0; academyCorrect = 0; location.reload(); }); playSound('victory'); } }, 850);
      } else {
        button.classList.add('is-wrong'); playSound('wrong');
        academy.querySelector('#academy-challenge-feedback').className = 'bad'; academy.querySelector('#academy-challenge-feedback').textContent = `Belum tepat. Petunjuk: ${question.hint} Cuba semula.`;
      }
    });
    renderConversionDirection(); renderLab(); renderAcademyQuestion();
  }

  // MISI BAKUGO: a Note-page-only distance simulator. Screen pixels only
  // control progress along the track; all conversions use one meter value.
  const distanceSimulator = document.querySelector('#bakugo-distance-simulator');
  const distanceLane = document.querySelector('#distance-lane');
  const bakugoRunner = document.querySelector('#bakugo-runner');
  const bakugoPosition = document.querySelector('#bakugo-position');
  const distanceQuestion = document.querySelector('#distance-question');
  const distanceHint = document.querySelector('#distance-hint');
  const distanceAnswer = document.querySelector('#distance-answer');
  const distanceAnswerUnit = document.querySelector('#distance-answer-unit');
  const distanceFeedback = document.querySelector('#distance-feedback');
  const distanceSteps = document.querySelector('#distance-solution-steps');
  const distanceShowSteps = document.querySelector('#distance-show-steps');
  const distanceMissionBadge = document.querySelector('#distance-mission-badge');
  const maxDistanceMeters = 1000;
  const startingProgress = 25;
  let distanceProgress = startingProgress;
  let distanceMissionIndex = 0;
  let distanceExpectedAnswer = 0;
  let distanceDragPointer = null;
  let distanceMovementTimer;

  const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
  const formatDistance = (value, maximumFractionDigits = 3) => {
    const rounded = Number(Number(value).toFixed(maximumFractionDigits));
    return rounded.toLocaleString('en-US', { maximumFractionDigits });
  };
  const currentDistanceMeters = () => Math.round(maxDistanceMeters * (1 - distanceProgress / 100));

  function maximumRunnerLeft() {
    const school = distanceLane.querySelector('.school-destination');
    return Math.max(0, school.offsetLeft - bakugoRunner.offsetWidth - 16);
  }

  function distanceMissionFor(index, meters) {
    const kilometerValue = meters / 1000;
    const centimeterValue = meters * 100;
    const millimeterValue = meters * 1000;
    const meterText = formatDistance(meters, 0);
    const kilometerText = formatDistance(kilometerValue, 3);
    const centimeterText = formatDistance(centimeterValue, 0);
    const millimeterText = formatDistance(millimeterValue, 0);
    return [
      {
        question: `Bakugo berada ${meterText} m dari sekolah. Tukarkan jarak itu kepada km.`,
        unit: 'km',
        answer: kilometerValue,
        hint: 'Petunjuk Bakugo: m → km ialah unit kecil kepada unit besar. Bahagi dengan 1,000.',
        steps: [`Mulakan dengan ${meterText} m.`, 'Untuk menukar m kepada km, bahagi dengan 1,000.', `${meterText} ÷ 1,000 = ${kilometerText} km.`]
      },
      {
        question: `Bakugo berada ${kilometerText} km dari sekolah. Tukarkan jarak itu kepada m.`,
        unit: 'm',
        answer: meters,
        hint: 'Petunjuk Bakugo: km → m ialah unit besar kepada unit kecil. Darab dengan 1,000.',
        steps: [`Mulakan dengan ${kilometerText} km.`, 'Untuk menukar km kepada m, darab dengan 1,000.', `${kilometerText} × 1,000 = ${meterText} m.`]
      },
      {
        question: `Jarak Bakugo ialah ${centimeterText} cm. Tukarkan jarak itu kepada m.`,
        unit: 'm',
        answer: meters,
        hint: 'Petunjuk Bakugo: cm → m ialah unit kecil kepada unit besar. Bahagi dengan 100.',
        steps: [`Mulakan dengan ${centimeterText} cm.`, 'Untuk menukar cm kepada m, bahagi dengan 100.', `${centimeterText} ÷ 100 = ${meterText} m.`]
      },
      {
        question: `Jarak Bakugo ialah ${millimeterText} mm. Tukarkan jarak itu kepada cm.`,
        unit: 'cm',
        answer: centimeterValue,
        hint: 'Petunjuk Bakugo: mm → cm ialah unit kecil kepada unit besar. Bahagi dengan 10.',
        steps: [`Mulakan dengan ${millimeterText} mm.`, 'Untuk menukar mm kepada cm, bahagi dengan 10.', `${millimeterText} ÷ 10 = ${centimeterText} cm.`]
      }
    ][index];
  }

  function renderDistanceMission(resetAnswer = true) {
    const mission = distanceMissionFor(distanceMissionIndex, currentDistanceMeters());
    distanceExpectedAnswer = mission.answer;
    distanceMissionBadge.textContent = `MISI PENUKARAN ${distanceMissionIndex + 1} / 4`;
    distanceQuestion.textContent = mission.question;
    distanceAnswerUnit.textContent = mission.unit;
    distanceHint.textContent = 'Gerakkan Bakugo untuk menghasilkan nilai soalan yang baharu.';
    distanceSteps.replaceChildren(...mission.steps.map((step, index) => {
      const item = document.createElement('li');
      item.innerHTML = index === mission.steps.length - 1 ? `<strong>${step}</strong>` : step;
      return item;
    }));
    distanceSteps.hidden = true;
    distanceShowSteps.hidden = true;
    distanceShowSteps.textContent = 'Tunjuk Langkah';
    if (resetAnswer) distanceAnswer.value = '';
    distanceFeedback.className = 'feedback';
    distanceFeedback.textContent = 'Masukkan jawapan apabila anda sudah bersedia.';
  }

  function showMovementEnergy() {
    distanceLane.classList.add('is-moving');
    clearTimeout(distanceMovementTimer);
    distanceMovementTimer = setTimeout(() => distanceLane.classList.remove('is-moving'), 520);
  }

  function setDistanceProgress(value, options = {}) {
    distanceProgress = clamp(Math.round(Number(value) || 0), 0, 100);
    bakugoPosition.value = String(distanceProgress);
    bakugoRunner.style.left = `${maximumRunnerLeft() * distanceProgress / 100}px`;
    const meters = currentDistanceMeters();
    const brightDistanceSlider = document.querySelector('#bright-distance-slider');
    if (brightDistanceSlider) brightDistanceSlider.value = String(meters);
    document.querySelector('#distance-km').textContent = formatDistance(meters / 1000, 3);
    document.querySelector('#distance-m').textContent = formatDistance(meters, 0);
    document.querySelector('#distance-cm').textContent = formatDistance(meters * 100, 0);
    document.querySelector('#distance-mm').textContent = formatDistance(meters * 1000, 0);
    bakugoRunner.setAttribute('aria-label', `Bakugo berada ${formatDistance(meters, 0)} meter dari sekolah. Seret ke kiri atau kanan.`);
    renderDistanceMission(options.resetAnswer !== false);
    if (options.moving !== false) showMovementEnergy();
  }

  function moveBakugo(step) {
    setDistanceProgress(distanceProgress + step);
  }

  document.querySelector('#bakugo-closer').addEventListener('click', () => moveBakugo(10));
  document.querySelector('#bakugo-away').addEventListener('click', () => moveBakugo(-10));
  document.querySelector('#bakugo-reset-position').addEventListener('click', () => setDistanceProgress(startingProgress));
  bakugoPosition.addEventListener('input', () => setDistanceProgress(bakugoPosition.value));

  bakugoRunner.addEventListener('keydown', event => {
    const keys = { ArrowLeft: -5, ArrowRight: 5 };
    if (event.key in keys) {
      event.preventDefault();
      moveBakugo(keys[event.key]);
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      setDistanceProgress(event.key === 'Home' ? 0 : 100);
    }
  });

  function progressFromPointer(clientX) {
    const laneRect = distanceLane.getBoundingClientRect();
    const runnerCenterOffset = bakugoRunner.offsetWidth / 2;
    const desiredLeft = clientX - laneRect.left - runnerCenterOffset;
    const maximumLeft = maximumRunnerLeft();
    return maximumLeft ? clamp(desiredLeft / maximumLeft * 100, 0, 100) : 0;
  }

  bakugoRunner.addEventListener('pointerdown', event => {
    if (event.button !== undefined && event.button !== 0) return;
    distanceDragPointer = event.pointerId;
    bakugoRunner.classList.add('is-dragging');
    bakugoRunner.setPointerCapture?.(event.pointerId);
    setDistanceProgress(progressFromPointer(event.clientX));
    event.preventDefault();
  });
  bakugoRunner.addEventListener('pointermove', event => {
    if (distanceDragPointer !== event.pointerId) return;
    setDistanceProgress(progressFromPointer(event.clientX));
    event.preventDefault();
  });
  function finishDistanceDrag(event) {
    if (distanceDragPointer !== event.pointerId) return;
    bakugoRunner.releasePointerCapture?.(event.pointerId);
    distanceDragPointer = null;
    bakugoRunner.classList.remove('is-dragging');
  }
  bakugoRunner.addEventListener('pointerup', finishDistanceDrag);
  bakugoRunner.addEventListener('pointercancel', finishDistanceDrag);

  document.querySelector('#distance-mission-form').addEventListener('submit', event => {
    event.preventDefault();
    const submittedAnswer = Number(distanceAnswer.value);
    const mission = distanceMissionFor(distanceMissionIndex, currentDistanceMeters());
    const tolerance = Math.max(1e-9, Math.abs(distanceExpectedAnswer) * 1e-9);
    distanceShowSteps.hidden = false;
    if (Number.isFinite(submittedAnswer) && Math.abs(submittedAnswer - distanceExpectedAnswer) <= tolerance) {
      distanceFeedback.className = 'feedback good';
      distanceFeedback.innerHTML = `<strong>LETUPAN TEPAT!</strong> Jawapan kamu ialah ${formatDistance(distanceExpectedAnswer, 3)} ${mission.unit}.`;
      distanceHint.textContent = 'Hebat, Wira! Pilih “Misi Baharu” untuk cuba penukaran seterusnya.';
      distanceSimulator.classList.remove('mission-success');
      void distanceSimulator.offsetWidth;
      distanceSimulator.classList.add('mission-success');
      setTimeout(() => distanceSimulator.classList.remove('mission-success'), 950);
      playSound('victory');
    } else {
      distanceFeedback.className = 'feedback bad';
      distanceFeedback.innerHTML = '<strong>Belum tepat.</strong> Cuba semak arah penukaran dan operasi yang digunakan.';
      distanceHint.textContent = mission.hint;
      playSound('wrong');
    }
  });

  distanceShowSteps.addEventListener('click', () => {
    distanceSteps.hidden = !distanceSteps.hidden;
    distanceShowSteps.textContent = distanceSteps.hidden ? 'Tunjuk Langkah' : 'Sembunyikan Langkah';
  });
  document.querySelector('#distance-next-mission').addEventListener('click', () => {
    distanceMissionIndex = (distanceMissionIndex + 1) % 4;
    renderDistanceMission();
    distanceAnswer.focus();
  });
  document.querySelector('#distance-reset-mission').addEventListener('click', () => {
    distanceMissionIndex = 0;
    setDistanceProgress(startingProgress);
  });
  window.addEventListener('resize', () => {
    bakugoRunner.style.left = `${maximumRunnerLeft() * distanceProgress / 100}px`;
  });
  setDistanceProgress(startingProgress, { moving: false });

  // Bright Note academy: preserve original nodes and their event handlers.
  const noteStack = document.querySelector('#nota .section-stack');
  const noteTabs = document.createElement('div');
  noteTabs.className = 'note-tabbar';
  noteTabs.setAttribute('role', 'tablist');
  noteTabs.setAttribute('aria-label', 'Subhalaman Nota');
  noteTabs.innerHTML = ['01 — Nota Asas', '02 — Simulator', '03 — Cabaran'].map((label, index) => `<button type="button" role="tab" id="note-tab-${index}" aria-controls="note-panel-${index}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}" data-note-tab="${index}">${label}</button>`).join('');
  noteStack.before(noteTabs);
  const originalNoteNodes = [...noteStack.children];
  const notePanels = [0, 1, 2].map(index => {
    const panel = document.createElement('section');
    panel.id = `note-panel-${index}`;
    panel.className = 'note-tab-panel';
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `note-tab-${index}`);
    panel.hidden = index !== 0;
    noteStack.appendChild(panel);
    return panel;
  });
  const noteActions = originalNoteNodes.find(node => node.classList.contains('page-actions'));
  originalNoteNodes.forEach(node => {
    if (node === noteActions) return;
    if (node === distanceSimulator) notePanels[1].appendChild(node);
    else if (node.id === 'mini-practice' || node.classList.contains('daily-problem')) notePanels[2].appendChild(node);
    else notePanels[0].appendChild(node);
  });
  noteStack.appendChild(noteActions);
  const notePanelTitles = ['BAKUGO KNOWLEDGE ACADEMY', 'BAKUGO DISTANCE SIMULATOR 2.0', 'BAKUGO FINAL EXPLOSION CHALLENGE'];
  notePanels.forEach((panel, index) => {
    if (index === 0) return;
    const title = document.createElement('h2');
    title.className = 'bright-panel-title';
    title.textContent = notePanelTitles[index];
    panel.prepend(title);
    const companion = document.createElement('aside');
    companion.className = 'note-floating-companion';
    const imageNames = ['bakugo-scarf-cutout.png', 'bakugo-sit-cutout.png', 'bakugo-smile-cutout.png'];
    const companionTips = ['Unit besar ke kecil: darab. Unit kecil ke besar: bahagi. Pilih misi dan cuba satu langkah dahulu!', 'Seret saya atau gunakan slider. Semua empat unit dikira daripada jarak meter yang sama.', 'Cuba jawab sendiri dahulu. Jika belum tepat, gunakan petunjuk dan cuba lagi. Kamu boleh, Wira!'];
    companion.innerHTML = `<img src="assets/${imageNames[index]}" alt="Bakugo chibi terapung" loading="lazy" width="180" height="210"><div><span class="eyebrow">TEMAN MISI BAKUGO</span><strong>${['Mari kuasai unit!', 'Jom ke sekolah!', 'Bersedia, Wira?'][index]}</strong><button type="button" class="secondary-button" aria-expanded="false" aria-controls="note-companion-tip-${index}">Petua Bakugo ✦</button><p id="note-companion-tip-${index}" hidden>${companionTips[index]}</p></div>`;
    title.after(companion);
    companion.querySelector('button').addEventListener('click', event => {
      const tip = companion.querySelector('p');
      tip.hidden = !tip.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!tip.hidden));
    });
  });
  function activateNoteTab(index, focus = false) {
    notePanels.forEach((panel, panelIndex) => {
      panel.hidden = panelIndex !== index;
      const tab = noteTabs.children[panelIndex];
      tab.setAttribute('aria-selected', String(panelIndex === index));
      tab.tabIndex = panelIndex === index ? 0 : -1;
    });
    if (index === 1) requestAnimationFrame(() => { bakugoRunner.style.left = `${maximumRunnerLeft() * distanceProgress / 100}px`; });
    if (index !== 1) stopNoteJourney();
    if (focus) noteTabs.children[index].focus();
  }
  noteTabs.addEventListener('click', event => { const tab = event.target.closest('[data-note-tab]'); if (tab) activateNoteTab(Number(tab.dataset.noteTab)); });
  noteTabs.addEventListener('keydown', event => {
    const selected = [...noteTabs.children].findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    const target = event.key === 'ArrowRight' ? (selected + 1) % 3 : event.key === 'ArrowLeft' ? (selected + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : null;
    if (target !== null) { event.preventDefault(); activateNoteTab(target, true); }
  });
  document.querySelector('#nota .note-hero-copy h1').innerHTML = 'BAKUGO <em>EXPLOSION</em><span>LEARNING LAB</span>';
  document.querySelector('#nota').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link?.getAttribute('href') === '#bakugo-distance-simulator') { event.preventDefault(); activateNoteTab(1); noteTabs.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }
    if (link?.getAttribute('href') === '#unit-mission') { event.preventDefault(); activateNoteTab(0); noteTabs.scrollIntoView({ behavior: scrollBehavior(), block: 'start' }); }
    if (event.target.closest('.try-practice')) activateNoteTab(2);
  }, true);

  const missionCards = [...document.querySelectorAll('#nota .lesson-card')];
  const missionGrid = document.querySelector('#nota .note-missions');
  let activeNoteMission = 0;
  let activeNoteView = 0;
  const missionExamples = [
    ['cm → mm : darab 10.', 'mm → cm : bahagi 10.', '3.5 cm × 10 = 35 mm', '420 mm ÷ 10 = 42 cm'],
    ['m → cm : darab 100.', 'cm → m : bahagi 100.', '2.75 m × 100 = 275 cm', '350 cm ÷ 100 = 3.5 m'],
    ['km → m : darab 1,000.', 'm → km : bahagi 1,000.', '1.206 km × 1,000 = 1,206 m', '2,500 m ÷ 1,000 = 2.5 km']
  ];
  missionCards.forEach((card, index) => {
    const extra = document.createElement('div');
    extra.className = 'bright-extra-examples';
    extra.innerHTML = `<h4>Kaedah & contoh dua arah</h4>${missionExamples[index].map(text => `<p>${text}</p>`).join('')}`;
    card.querySelector('.working').appendChild(extra);
  });
  const learningLayout = document.createElement('div');
  learningLayout.className = 'bright-learning-layout';
  missionGrid.before(learningLayout);
  const learningMenu = document.createElement('div');
  learningMenu.className = 'bright-learning-menu';
  learningMenu.setAttribute('role', 'group');
  learningMenu.setAttribute('aria-label', 'Paparan misi');
  learningMenu.innerHTML = ['Nota & Konsep', 'Contoh Penyelesaian', 'Cuba Sendiri'].map((label, index) => `<button type="button" data-note-view="${index}" aria-pressed="${index === 0}">${label}</button>`).join('');
  learningLayout.append(learningMenu, missionGrid);
  const missionPractice = document.createElement('form');
  missionPractice.className = 'bright-mission-practice';
  missionPractice.innerHTML = '<label for="bright-mission-answer" id="bright-mission-question"></label><div><input id="bright-mission-answer" type="number" step="any" required inputmode="decimal"><button type="submit" class="cta">Semak Jawapan</button></div><p id="bright-mission-feedback" role="status">Cuba soalan misi ini.</p>';
  missionGrid.after(missionPractice);
  const missionNavigation = document.createElement('div');
  missionNavigation.className = 'bright-mission-nav';
  missionNavigation.innerHTML = '<button type="button" id="bright-prev" class="secondary-button">← Sebelumnya</button><span id="bright-mission-count"></span><button type="button" id="bright-next" class="cta">Seterusnya →</button>';
  learningLayout.after(missionNavigation);
  const missionPracticeData = [{q:'3.5 cm = ? mm',a:35},{q:'2.75 m = ? cm',a:275},{q:'1.206 km = ? m',a:1206}];
  function renderNoteMission() {
    missionCards.forEach((card, index) => { card.hidden = index !== activeNoteMission || activeNoteView === 2; card.querySelector('details').open = activeNoteView === 1; });
    missionPractice.hidden = activeNoteView !== 2;
    [...learningMenu.children].forEach((button, index) => button.setAttribute('aria-pressed', String(index === activeNoteView)));
    document.querySelector('#bright-mission-question').textContent = missionPracticeData[activeNoteMission].q;
    document.querySelector('#bright-mission-count').textContent = `MISI ${activeNoteMission + 1} / 3`;
    document.querySelector('#bright-prev').disabled = activeNoteMission === 0;
    document.querySelector('#bright-next').disabled = activeNoteMission === 2;
    document.querySelector('#bright-mission-answer').value = '';
    document.querySelector('#bright-mission-feedback').textContent = 'Cuba soalan misi ini.';
  }
  learningMenu.addEventListener('click', event => { const button = event.target.closest('[data-note-view]'); if (button) { activeNoteView = Number(button.dataset.noteView); renderNoteMission(); } });
  document.querySelector('#bright-prev').addEventListener('click', () => { activeNoteMission = Math.max(0, activeNoteMission - 1); renderNoteMission(); });
  document.querySelector('#bright-next').addEventListener('click', () => { activeNoteMission = Math.min(2, activeNoteMission + 1); renderNoteMission(); });
  missionPractice.addEventListener('submit', event => {
    event.preventDefault();
    const item = missionPracticeData[activeNoteMission];
    const correct = Number(document.querySelector('#bright-mission-answer').value) === item.a;
    document.querySelector('#bright-mission-feedback').textContent = correct ? `✓ Tepat! ${item.q.replace('? ', `${formatDistance(item.a)} `)}` : `Belum tepat. ${missionExamples[activeNoteMission][0]} Cuba lagi.`;
    playSound(correct ? 'correct' : 'wrong');
  });
  renderNoteMission();

  const directDistanceForm = document.createElement('form');
  directDistanceForm.className = 'bright-distance-form';
  directDistanceForm.innerHTML = '<label for="bright-distance-input">Jarak simulasi</label><input id="bright-distance-input" type="number" min="0" step="any" value="750" required inputmode="decimal"><select id="bright-distance-unit" aria-label="Unit jarak"><option value="1">m</option><option value="1000">km</option><option value="0.01">cm</option><option value="0.001">mm</option></select><button class="secondary-button" type="submit">Tetapkan Jarak</button><button id="bright-start-journey" class="cta" type="button">Mulakan Misi →</button><p id="bright-distance-status" role="status">Skala simulasi: 0–1,000 m. Input dibundarkan kepada 10 m terdekat pada trek.</p>';
  distanceLane.after(directDistanceForm);
  const distanceSliderLabel = document.createElement('label');
  distanceSliderLabel.className = 'bright-distance-slider-label';
  distanceSliderLabel.innerHTML = 'Jarak 0–1,000 m <input id="bright-distance-slider" type="range" min="0" max="1000" step="10" value="750">';
  directDistanceForm.before(distanceSliderLabel);
  let noteJourneyTimer;
  function stopNoteJourney() { clearInterval(noteJourneyTimer); noteJourneyTimer = undefined; document.querySelector('#bright-start-journey').textContent = 'Mulakan Misi →'; }
  document.querySelector('#bright-distance-slider').addEventListener('input', event => { stopNoteJourney(); setDistanceProgress(100 - Number(event.target.value) / 10); });
  directDistanceForm.addEventListener('submit', event => {
    event.preventDefault(); stopNoteJourney();
    const meters = Number(document.querySelector('#bright-distance-input').value) * Number(document.querySelector('#bright-distance-unit').value);
    if (!Number.isFinite(meters) || meters < 0 || meters > 1000) { document.querySelector('#bright-distance-status').textContent = 'Masukkan jarak yang bersamaan 0 hingga 1,000 m.'; return; }
    setDistanceProgress(100 - meters / 10);
    document.querySelector('#bright-distance-status').textContent = `Jarak trek: ${formatDistance(currentDistanceMeters())} m. Skala langkah 10 m.`;
  });
  document.querySelector('#bright-start-journey').addEventListener('click', () => {
    if (noteJourneyTimer) { stopNoteJourney(); document.querySelector('#bright-distance-status').textContent = 'Perjalanan dijeda.'; return; }
    if (distanceProgress >= 100) setDistanceProgress(0);
    document.querySelector('#bright-start-journey').textContent = 'Jeda Misi';
    noteJourneyTimer = setInterval(() => {
      if (document.querySelector('#nota').hidden || notePanels[1].hidden) { stopNoteJourney(); return; }
      setDistanceProgress(distanceProgress + 1);
      document.querySelector('#bright-distance-status').textContent = `Baki ${formatDistance(currentDistanceMeters())} m ke sekolah.`;
      if (distanceProgress >= 100) { stopNoteJourney(); document.querySelector('#bright-distance-status').textContent = 'TAHNIAH! MISI BERJAYA!'; }
    }, 120);
  });
  document.querySelector('#bakugo-reset-position').addEventListener('click', () => { stopNoteJourney(); document.querySelector('#bright-distance-status').textContent = 'Kedudukan permulaan dipulihkan.'; });
  window.addEventListener('hashchange', () => { if (location.hash !== '#nota') stopNoteJourney(); });

  const challenge = document.createElement('article');
  challenge.className = 'bright-challenge bakugo-arena';
  challenge.innerHTML = `<header class="arena-hero-banner"><div class="arena-banner-copy"><span class="arena-chip">BAKUGO HERO CHALLENGE</span><h2>💥 BAKUGO FINAL<br>EXPLOSION CHALLENGE</h2><p>BUKTIKAN KUASA PENUKARAN UNIT ANDA!</p><button id="arena-start" class="arena-primary" type="button">MULAKAN CABARAN →</button></div><img src="assets/bakugo-arena-banner.png" alt="Bakugo tanpa latar belakang bersedia memulakan cabaran" loading="lazy"><span class="arena-boom" aria-hidden="true">BOOM!</span></header>
  <section id="arena-battle" class="arena-battle" aria-labelledby="bright-challenge-question" hidden><div class="arena-character"><div class="arena-energy" aria-hidden="true"></div><img src="assets/bakugo-arena-battle.png" alt="Bakugo tanpa latar belakang dalam pose pertempuran" loading="lazy"></div><div class="arena-console"><div class="arena-status"><div><span>FINAL EXPLOSION / 4 MISI</span><div id="arena-crystals" class="arena-crystals" aria-label="Empat kristal misi">${'<i>◆</i>'.repeat(4)}</div></div><div class="arena-power"><span>EXPLOSION POWER</span><div><b id="arena-power-fill"></b></div><strong id="bright-challenge-count">0 / 4</strong></div></div><div id="arena-math-visual" class="arena-math-visual" aria-hidden="true"><span>3.5 cm</span><div class="arena-mini-ruler">${'<i></i>'.repeat(10)}</div><b>= 35 mm</b></div><h3 id="bright-challenge-question"></h3><div class="arena-answer-mode"><span>MOD JAWAPAN</span><button type="button" data-answer-mode="type" class="is-active">⌨ TAIP</button><button type="button" data-answer-mode="pad">▦ PAPAN NOMBOR</button></div><form id="bright-challenge-form"><label for="bright-challenge-answer">JAWAPAN DIGITAL</label><div><input id="bright-challenge-answer" type="number" step="any" required inputmode="decimal" placeholder="0"><button class="arena-primary" type="submit">LEPASKAN JAWAPAN!</button></div></form><div id="arena-keypad" class="arena-keypad" hidden>${['7','8','9','4','5','6','1','2','3','.','0','⌫'].map(key=>`<button type="button" data-key="${key}">${key}</button>`).join('')}</div><div class="bright-challenge-tools"><button id="bright-challenge-hint" type="button" class="arena-secondary">💡 PETUNJUK</button><button id="bright-challenge-steps" type="button" class="arena-secondary" hidden>📐 LIHAT LANGKAH</button><button id="bright-challenge-next" type="button" class="arena-primary" hidden>MISI SETERUSNYA →</button><button id="bright-challenge-reset" type="button" class="arena-secondary">↻ MULA SEMULA</button></div><p id="bright-challenge-feedback" role="status" aria-live="polite">Tekan “Mulakan Cabaran” untuk mengaktifkan arena.</p><div id="arena-victory" class="arena-victory" hidden>★ 💥 PLUS ULTRA! 💥 ★<small>SEMUA MISI BERJAYA</small></div></div></section>`;
  notePanels[2].prepend(challenge);
  const brightChallenges = [
    {q:'3.5 cm = ? mm',a:35,h:'cm kepada mm: darab 10.',s:'3.5 × 10 = 35 mm.'},
    {q:'350 cm = ? m',a:3.5,h:'cm kepada m: bahagi 100.',s:'350 ÷ 100 = 3.5 m.'},
    {q:'1.206 km = ? m',a:1206,h:'km kepada m: darab 1,000.',s:'1.206 × 1,000 = 1,206 m.'},
    {q:'Deku berlari 1.25 km dan 750 m. Berapakah jumlahnya dalam meter?',a:2000,h:'Tukarkan 1.25 km kepada m dahulu, kemudian tambah 750.',s:'1.25 × 1,000 = 1,250 m. 1,250 + 750 = 2,000 m.'}
  ];
  let brightChallengeIndex = 0;
  let brightChallengeSolved = false;
  let brightChallengeCompleted = 0;
  function renderBrightChallenge() {
    brightChallengeSolved = false;
    document.querySelector('#bright-challenge-question').textContent = brightChallenges[brightChallengeIndex].q;
    document.querySelector('#bright-challenge-count').textContent = `${brightChallengeCompleted} / 4`;
    document.querySelector('#arena-power-fill').style.width = `${brightChallengeCompleted * 25}%`;
    [...document.querySelectorAll('#arena-crystals i')].forEach((crystal,index)=>crystal.classList.toggle('is-lit',index<brightChallengeCompleted));
    document.querySelector('#bright-challenge-answer').value = '';
    document.querySelector('#bright-challenge-answer').disabled = false;
    document.querySelector('#bright-challenge-form button').disabled = false;
    document.querySelector('#bright-challenge-next').hidden = true;
    document.querySelector('#bright-challenge-steps').hidden = true;
    document.querySelector('#bright-challenge-feedback').textContent = 'Cuba jawab dahulu. Anda boleh mencuba semula.';
    document.querySelector('#arena-math-visual').classList.toggle('is-visible', brightChallengeIndex === 0);
    document.querySelector('#arena-victory').hidden = true;
  }
  document.querySelector('#arena-start').addEventListener('click',()=>{document.querySelector('#arena-battle').hidden=false;document.querySelector('#arena-battle').scrollIntoView({behavior:scrollBehavior(),block:'start'});document.querySelector('#bright-challenge-answer').focus({preventScroll:true});});
  challenge.querySelector('.arena-answer-mode').addEventListener('click',event=>{const button=event.target.closest('[data-answer-mode]');if(!button)return;challenge.querySelectorAll('[data-answer-mode]').forEach(item=>item.classList.toggle('is-active',item===button));document.querySelector('#arena-keypad').hidden=button.dataset.answerMode!=='pad';if(button.dataset.answerMode==='type')document.querySelector('#bright-challenge-answer').focus();});
  document.querySelector('#arena-keypad').addEventListener('click',event=>{const button=event.target.closest('[data-key]');if(!button)return;const input=document.querySelector('#bright-challenge-answer');input.value=button.dataset.key==='⌫'?input.value.slice(0,-1):`${input.value}${button.dataset.key}`;});
  document.querySelector('#bright-challenge-form').addEventListener('submit', event => {
    event.preventDefault(); if (brightChallengeSolved) return;
    const item = brightChallenges[brightChallengeIndex];
    const correct = Math.abs(Number(document.querySelector('#bright-challenge-answer').value) - item.a) < 1e-9;
    document.querySelector('#bright-challenge-steps').hidden = false;
    document.querySelector('#bright-challenge-feedback').className = correct ? 'is-success' : 'is-error';
    document.querySelector('#bright-challenge-feedback').textContent = correct ? `💥 EXPLOSIVE SUCCESS! ${item.s}` : `Belum tepat. ${item.h} Cuba lagi!`;
    if (correct) {
      brightChallengeSolved = true;
      brightChallengeCompleted = Math.max(brightChallengeCompleted,brightChallengeIndex+1);
      document.querySelector('#bright-challenge-count').textContent = `${brightChallengeCompleted} / 4`;
      document.querySelector('#arena-power-fill').style.width = `${brightChallengeCompleted * 25}%`;
      [...document.querySelectorAll('#arena-crystals i')].forEach((crystal,index)=>crystal.classList.toggle('is-lit',index<brightChallengeCompleted));
      document.querySelector('#arena-battle').classList.remove('arena-success');void document.querySelector('#arena-battle').offsetWidth;document.querySelector('#arena-battle').classList.add('arena-success');
      document.querySelector('#bright-challenge-answer').disabled = true;
      document.querySelector('#bright-challenge-form button').disabled = true;
      document.querySelector('#bright-challenge-next').hidden = brightChallengeIndex === 3;
      if (brightChallengeIndex === 3) { document.querySelector('#bright-challenge-feedback').textContent = 'EXPLOSIVE SUCCESS! Semua empat latihan selesai.';document.querySelector('#arena-victory').hidden=false; }
    }
    playSound(correct ? 'correct' : 'wrong');
  });
  document.querySelector('#bright-challenge-hint').addEventListener('click', () => { document.querySelector('#bright-challenge-feedback').textContent = brightChallenges[brightChallengeIndex].h; });
  document.querySelector('#bright-challenge-steps').addEventListener('click', () => { document.querySelector('#bright-challenge-feedback').textContent = brightChallenges[brightChallengeIndex].s; });
  document.querySelector('#bright-challenge-next').addEventListener('click', () => { if (brightChallengeSolved && brightChallengeIndex < 3) { brightChallengeIndex += 1; renderBrightChallenge(); } });
  document.querySelector('#bright-challenge-reset').addEventListener('click', () => { brightChallengeIndex = 0; brightChallengeCompleted = 0; renderBrightChallenge(); });
  renderBrightChallenge();

  const noteWorking=document.querySelector('#note-working');
  document.querySelector('#note-show-steps').addEventListener('click',()=>{noteWorking.hidden=!noteWorking.hidden;if(!noteWorking.hidden){noteWorking.classList.remove('is-animated');void noteWorking.offsetWidth;noteWorking.classList.add('is-animated');}});
  document.querySelector('#note-retry').addEventListener('click',()=>{document.querySelector('#note-answer').value='';document.querySelector('#note-feedback').className='feedback';document.querySelector('#note-feedback').textContent='Cuba sekali lagi. m → cm menggunakan ×100.';document.querySelector('#note-answer').focus();});
  let trackStep=0;
  document.querySelector('#track-solution').addEventListener('click',()=>{trackStep=Math.min(3,trackStep+1);const steps=[...document.querySelectorAll('#track-steps li')];steps.forEach((step,index)=>step.classList.toggle('is-shown',index<trackStep));document.querySelector('.arena-story-track').classList.add('is-running');document.querySelector('#track-solution').textContent=trackStep<3?'LANGKAH SETERUSNYA →':'✓ PENYELESAIAN LENGKAP';if(trackStep===3)playSound('victory');else playSound('correct');});

  // One shared player; remove the old iframe before changing lessons.
  const videoDefinitions = [
    {
      kind: 'LAGU MATEMATIK',
      title: 'Lagu Matematik: Penukaran Unit',
      embed: 'https://www.canva.com/design/DAHZTpoKHj4/XaD_mGH7QFShiw4A3YMKnA/view?embed',
      source: 'https://www.canva.com/design/DAHZTpoKHj4/XaD_mGH7QFShiw4A3YMKnA/view?utm_content=DAHZTpoKHj4&utm_campaign=designshare&utm_medium=embeds&utm_source=link',
      credit: 'MUHAMMAD ARIFF DANIAL BIN MUHAMMAD KHAIRUL SAFUAN IPG-Pelajar',
      format: 'wide'
    },
    {
      kind: 'PODCAST MATEMATIK',
      title: 'Podcast Matematik: Penukaran Unit',
      embed: 'https://www.canva.com/design/DAHZTjhHEO0/u3BqMOYmwrPFTFL9f7RbAA/watch?embed',
      source: 'https://www.canva.com/design/DAHZTjhHEO0/u3BqMOYmwrPFTFL9f7RbAA/watch?utm_content=DAHZTjhHEO0&utm_campaign=designshare&utm_medium=embeds&utm_source=link',
      credit: 'AMMAR ZIKRI BIN ZAINUL PAKRI IPG-Pelajar',
      format: 'wide'
    },
    {
      kind: 'VIDEO MENGAJAR 01',
      title: 'Belajar Penukaran Unit Panjang',
      embed: 'https://www.canva.com/design/DAHZTTR0h5A/jNew1SD6Y1ZHc2b4k1GpQw/watch?embed',
      source: 'https://www.canva.com/design/DAHZTTR0h5A/jNew1SD6Y1ZHc2b4k1GpQw/watch?utm_content=DAHZTTR0h5A&utm_campaign=designshare&utm_medium=embeds&utm_source=link',
      credit: 'AMMAR ZIKRI BIN ZAINUL PAKRI IPG-Pelajar',
      format: 'wide'
    },
    {
      kind: 'VIDEO MENGAJAR 02',
      title: 'Pengukuhan Penukaran Unit',
      embed: 'https://www.canva.com/design/DAHZTi2enzA/d0DLQUdfQ6axvPJC0aeLdw/watch?embed',
      source: 'https://www.canva.com/design/DAHZTi2enzA/d0DLQUdfQ6axvPJC0aeLdw/watch?utm_content=DAHZTi2enzA&utm_campaign=designshare&utm_medium=embeds&utm_source=link',
      credit: 'AMMAR ZIKRI BIN ZAINUL PAKRI IPG-Pelajar',
      format: 'wide'
    },
    {
      kind: 'VIDEO MENGAJAR 03',
      title: 'Penukaran Unit mm dan cm',
      embed: 'https://www.canva.com/design/DAHZTmLuk50/ZAVRb9zo3JPUyCvqGtWv6Q/watch?embed',
      source: 'https://www.canva.com/design/DAHZTmLuk50/ZAVRb9zo3JPUyCvqGtWv6Q/watch?utm_content=DAHZTmLuk50&utm_campaign=designshare&utm_medium=embeds&utm_source=link',
      credit: 'MOHAMMAD FIRDAUS BIN MOHD ADIN IPG-Pelajar',
      format: 'wide'
    }
  ];
  const videoDescriptions = [
    'Belajar hubungan unit panjang melalui lagu Matematik yang menyeronokkan.',
    'Dengar perbincangan podcast untuk mengukuhkan pemahaman penukaran unit panjang.',
    'Ikuti penerangan dan contoh penukaran unit panjang dalam video mengajar pertama.',
    'Kukuhkan kemahiran penukaran unit melalui video mengajar kedua.',
    'Pelajari penukaran antara milimeter (mm) dan sentimeter (cm). Ingat: 1 cm = 10 mm.'
  ];
  const videoColors = ['#35cfff','#ff5d6c','#56ed8b','#ffd348','#bc81ff'];
  const videoSelector = document.querySelector('#video-selector');
  const mainVideoStage = document.querySelector('#video-main-stage');
  let currentVideo = 0;
  function clearMainVideo() {
    // Removing the browsing context stops playback, including cross-origin audio.
    mainVideoStage.replaceChildren();
  }
  function mountMainVideo() {
    if (location.hash !== '#video' || document.hidden || mainVideoStage.querySelector('iframe')) return;
    const video = videoDefinitions[currentVideo];
    const frame = document.createElement('iframe');
    frame.src = video.embed;
    frame.title = `VIDEO ${String(currentVideo+1).padStart(2,'0')} — ${video.title}`;
    frame.allow = 'fullscreen; picture-in-picture';
    frame.setAttribute('allowfullscreen','');
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    mainVideoStage.appendChild(frame);
  }
  function selectMainVideo(index) {
    if (!Number.isInteger(index) || index<0 || index>=videoDefinitions.length) return;
    if (index !== currentVideo) clearMainVideo();
    currentVideo = index;
    const video = videoDefinitions[index];
    document.querySelector('#video-active-title').textContent = video.title;
    document.querySelector('#video-active-kind').textContent = video.kind;
    document.querySelector('#video-active-description').textContent = videoDescriptions[index];
    document.querySelector('#video-active-credit').textContent = video.credit;
    document.querySelector('#video-active-source').href = video.source;
    document.querySelector('#video-selected-count').textContent = `${String(index+1).padStart(2,'0')} / 05`;
    document.querySelectorAll('[data-video-select]').forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));
    const consolePanel = document.querySelector('.video-console');
    consolePanel.style.setProperty('--selected-video-color',videoColors[index]);
    consolePanel.classList.remove('video-changing');
    void consolePanel.offsetWidth;
    consolePanel.classList.add('video-changing');
    document.querySelector('#video-player-help').textContent = 'Tekan Play dalam video. Gunakan kawalan pemain untuk jeda, bunyi dan garis masa.';
    mountMainVideo();
  }
  videoDefinitions.forEach((video,index)=>{
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.videoSelect = String(index);
    button.style.setProperty('--video-color',videoColors[index]);
    button.setAttribute('aria-controls','video-main-stage');
    button.setAttribute('aria-pressed',String(index===0));
    button.classList.add('todoroki-video-card');
    const art = document.createElement('span'); art.className='video-card-art';art.setAttribute('aria-hidden','true');
    // Five independent portrait windows from the supplied reference; all labels remain live HTML.
    const ns='http://www.w3.org/2000/svg';
    const scene=document.createElementNS(ns,'svg');
    const portraitWindows=['25 100 405 240','455 45 375 290','850 45 372 290','1246 45 372 290','1646 90 375 245'];
    scene.setAttribute('viewBox',portraitWindows[index]);
    scene.setAttribute('preserveAspectRatio','xMidYMid slice');scene.setAttribute('focusable','false');
    const picture=document.createElementNS(ns,'image');picture.setAttribute('href','assets/todoroki-five-card-artwork.png');
    picture.setAttribute('width','2048');picture.setAttribute('height','684');scene.appendChild(picture);
    const aura=document.createElement('span');aura.className='video-card-aura';
    art.append(scene,aura);
    const number = document.createElement('strong');number.className='video-card-number';
    const play=document.createElement('b');play.className='video-card-play';play.textContent='▶';play.setAttribute('aria-hidden','true');
    const digits=document.createElement('span');digits.textContent=String(index+1).padStart(2,'0');number.append(play,digits);
    const label = document.createElement('span'); label.className='video-card-label';label.textContent = `VIDEO ${String(index+1).padStart(2,'0')}`;
    const title = document.createElement('small'); title.className='video-card-title';title.textContent = video.title;
    const current=document.createElement('span');current.className='video-card-current';current.textContent='SEMASA';current.setAttribute('aria-hidden','true');
    const border=document.createElementNS(ns,'svg');border.classList.add('video-neon-track');border.setAttribute('viewBox','0 0 200 320');border.setAttribute('preserveAspectRatio','none');border.setAttribute('aria-hidden','true');border.setAttribute('focusable','false');
    ['video-neon-trail','video-neon-runner','video-neon-head'].forEach(className=>{
      const path=document.createElementNS(ns,'rect');path.setAttribute('x','3');path.setAttribute('y','3');path.setAttribute('width','194');path.setAttribute('height','314');path.setAttribute('rx','14');path.setAttribute('pathLength','1000');path.setAttribute('fill','none');path.setAttribute('vector-effect','non-scaling-stroke');path.classList.add(className);border.appendChild(path);
    });
    button.append(art,number,label,title,current,border);
    button.addEventListener('pointermove',event=>{
      if(event.pointerType!=='mouse' || reduceMotion.matches)return;
      const rect=button.getBoundingClientRect();
      if(!rect.width || !rect.height)return;
      const x=Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
      const y=Math.max(-1,Math.min(1,(event.clientY-rect.top)/rect.height*2-1));
      button.style.setProperty('--tilt-x',`${-y*5}deg`);button.style.setProperty('--tilt-y',`${x*5}deg`);
    });
    button.addEventListener('pointerleave',()=>{button.style.setProperty('--tilt-x','0deg');button.style.setProperty('--tilt-y','0deg');});
    button.addEventListener('click',()=>selectMainVideo(index));
    button.addEventListener('keydown',event=>{
      let next=index;
      if(event.key==='ArrowRight') next=(index+1)%5;
      else if(event.key==='ArrowLeft') next=(index+4)%5;
      else if(event.key==='Home') next=0;
      else if(event.key==='End') next=4;
      else return;
      event.preventDefault();
      videoSelector.children[next].focus();
      selectMainVideo(next);
    });
    videoSelector.appendChild(button);
  });
  document.querySelector('#next-video').addEventListener('click',()=>{
    selectMainVideo((currentVideo+1)%videoDefinitions.length);
    videoSelector.children[currentVideo].focus({preventScroll:true});
  });
  document.querySelector('#video-fullscreen').addEventListener('click',async()=>{
    try {
      if(document.fullscreenElement) await document.exitFullscreen();
      else if(mainVideoStage.requestFullscreen) await mainVideoStage.requestFullscreen();
      else throw new Error('unsupported');
    } catch {
      document.querySelector('#video-player-help').textContent = 'Gunakan ikon skrin penuh di dalam pemain video pada peranti ini.';
    }
  });
  const syncMainVideo = ()=>{
    if(location.hash !== '#video' || document.hidden) clearMainVideo();
    else mountMainVideo();
  };
  window.addEventListener('hashchange',syncMainVideo);
  document.addEventListener('visibilitychange',syncMainVideo);
  selectMainVideo(0);

  // Gamifikasi hosts two independent arcade missions.
  let activeArcade = 'space';
  function handleGameRoute(route) {
    handleSpaceRoute(route);
    handleMazeRoute(route);
    handleRunRoute(route);
  }

  // PLUS ULTRA SPACE DEFENDER: a separate canvas arcade on Gamifikasi only.
  const spaceDefender = document.querySelector('#space-defender');
  const spaceCanvas = document.querySelector('#space-canvas');
  const spaceContext = spaceCanvas.getContext('2d');
  const spaceStartOverlay = document.querySelector('#space-start-overlay');
  const spacePauseOverlay = document.querySelector('#space-pause-overlay');
  const spaceGameOverOverlay = document.querySelector('#space-gameover-overlay');
  const spaceMathOverlay = document.querySelector('#space-math-overlay');
  const spacePauseButton = document.querySelector('#space-pause');
  const spaceResumeButton = document.querySelector('#space-resume');
  const spaceLiveStatus = document.querySelector('#space-live-status');
  const spacePowerIndicator = document.querySelector('#space-power-indicator');
  const spaceWidth = spaceCanvas.width;
  const spaceHeight = spaceCanvas.height;
  const spaceKeys = new Set();
  let spaceAnimationFrame = 0;
  let spaceLastTime = 0;

  const spaceQuestions = [
    { question: '48.5 cm = ? mm', options: ['4.85 mm', '48.5 mm', '485 mm', '4,850 mm'], answer: 2, explanation: 'cm → mm: darab 10. 48.5 × 10 = 485 mm.' },
    { question: '325 cm = ? m', options: ['0.325 m', '3.25 m', '32.5 m', '325 m'], answer: 1, explanation: 'cm → m: bahagi 100. 325 ÷ 100 = 3.25 m.' },
    { question: '2.006 km = ? m', options: ['20.06 m', '200.6 m', '2,006 m', '20,060 m'], answer: 2, explanation: 'km → m: darab 1,000. 2.006 × 1,000 = 2,006 m.' },
    { question: '1.5 m = ? cm', options: ['15 cm', '150 cm', '1,500 cm', '0.15 cm'], answer: 1, explanation: 'm → cm: darab 100. 1.5 × 100 = 150 cm.' },
    { question: '0.75 km = ? m', options: ['7.5 m', '75 m', '750 m', '7,500 m'], answer: 2, explanation: 'km → m: darab 1,000. 0.75 × 1,000 = 750 m.' },
    { question: '850 mm = ? cm', options: ['8.5 cm', '85 cm', '850 cm', '8,500 cm'], answer: 1, explanation: 'mm → cm: bahagi 10. 850 ÷ 10 = 85 cm.' },
    { question: '4.25 m = ? cm', options: ['42.5 cm', '425 cm', '4,250 cm', '0.425 cm'], answer: 1, explanation: 'm → cm: darab 100. 4.25 × 100 = 425 cm.' },
    { question: '3,500 m = ? km', options: ['0.35 km', '3.5 km', '35 km', '350 km'], answer: 1, explanation: 'm → km: bahagi 1,000. 3,500 ÷ 1,000 = 3.5 km.' }
  ];

  let spaceGame = createSpaceState();

  function createSpaceState() {
    return {
      mode: 'idle', score: 0, lives: 3, level: 1, questionIndex: 0,
      killsSinceQuestion: 0, pendingNextLevel: false, powerShots: 0,
      enemyDirection: 1, enemyFireCooldown: 1.35, playerFireCooldown: 0,
      player: { x: spaceWidth / 2 - 29, y: spaceHeight - 61, width: 58, height: 36, speed: 410, invulnerable: 0 },
      bullets: [], enemyBullets: [], enemies: [], particles: [], stars: createSpaceStars(95)
    };
  }

  function createSpaceStars(count) {
    return Array.from({ length: count }, (_, index) => ({
      x: (index * 83 + Math.random() * 51) % spaceWidth,
      y: Math.random() * spaceHeight,
      size: index % 9 === 0 ? 2 : index % 4 === 0 ? 1.4 : .8,
      speed: 12 + index % 5 * 9,
      color: index % 7 === 0 ? '#a87cff' : index % 5 === 0 ? '#58eaff' : '#ffffff'
    }));
  }

  function createSpaceEnemies() {
    const rows = Math.min(5, 3 + Math.floor((spaceGame.level - 1) / 2));
    const columns = 7;
    const width = 46;
    const height = 31;
    const gapX = 72;
    const gapY = 48;
    const formationWidth = (columns - 1) * gapX + width;
    const startX = (spaceWidth - formationWidth) / 2;
    spaceGame.enemies = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        spaceGame.enemies.push({
          x: startX + column * gapX,
          y: 70 + row * gapY,
          width,
          height,
          row,
          pulse: (row * 7 + column) * .3
        });
      }
    }
    spaceGame.enemyDirection = 1;
    spaceGame.enemyFireCooldown = Math.max(.55, 1.55 - spaceGame.level * .11);
  }

  function setSpaceLiveStatus(message) {
    spaceLiveStatus.textContent = message;
  }

  function syncSpaceHud(status) {
    document.querySelector('#space-score').textContent = spaceGame.score.toLocaleString('en-US');
    document.querySelector('#space-level').textContent = String(spaceGame.level);
    document.querySelector('#space-lives').textContent = Array.from({ length: 3 }, (_, index) => index < spaceGame.lives ? '♥' : '♡').join(' ');
    document.querySelector('#space-lives').setAttribute('aria-label', `${spaceGame.lives} nyawa`);
    document.querySelector('#space-status').textContent = status || ({ idle: 'SEDIA', running: 'BERTEMPUR', paused: 'DIJEDA', quiz: 'MATH ALERT', gameover: 'GAME OVER' }[spaceGame.mode]);
    spacePowerIndicator.textContent = spaceGame.powerShots > 0 ? `POWER: TRIPLE LASER ×${spaceGame.powerShots}` : 'POWER: NORMAL';
    spaceDefender.classList.toggle('powered', spaceGame.powerShots > 0);
    spaceDefender.dataset.spaceState = spaceGame.mode;
    spaceDefender.dataset.playerX = String(Math.round(spaceGame.player.x));
    spaceDefender.dataset.bullets = String(spaceGame.bullets.length);
    spaceDefender.dataset.enemies = String(spaceGame.enemies.length);
  }

  function setSpaceControls() {
    const active = spaceGame.mode === 'running';
    spacePauseButton.disabled = !active;
    spacePauseButton.hidden = spaceGame.mode === 'paused';
    spaceResumeButton.hidden = spaceGame.mode !== 'paused';
  }

  function startSpaceLoop() {
    cancelAnimationFrame(spaceAnimationFrame);
    spaceLastTime = 0;
    spaceAnimationFrame = requestAnimationFrame(spaceLoop);
  }

  function startSpaceGame() {
    activeArcade = 'space';
    if (typeof mazeGame !== 'undefined' && mazeGame.state === 'running') pauseMazeGame(true);
    if (typeof runGame !== 'undefined' && runGame.state === 'running') pauseHeroRun(true);
    spaceGame = createSpaceState();
    spaceGame.mode = 'running';
    createSpaceEnemies();
    spaceStartOverlay.hidden = true;
    spacePauseOverlay.hidden = true;
    spaceGameOverOverlay.hidden = true;
    spaceMathOverlay.hidden = true;
    setSpaceControls();
    syncSpaceHud();
    setSpaceLiveStatus('Misi bermula. Gerakkan kapal dan tembak dron musuh.');
    playSound('victory');
    startSpaceLoop();
  }

  function pauseSpaceGame(automatic = false) {
    if (spaceGame.mode !== 'running') return;
    spaceGame.mode = 'paused';
    cancelAnimationFrame(spaceAnimationFrame);
    spacePauseOverlay.hidden = false;
    setSpaceControls();
    syncSpaceHud(automatic ? 'AUTO PAUSE' : 'DIJEDA');
    setSpaceLiveStatus(automatic ? 'Permainan dijeda kerana halaman ditukar.' : 'Permainan dijeda.');
    drawSpace();
  }

  function resumeSpaceGame() {
    if (spaceGame.mode !== 'paused') return;
    spaceGame.mode = 'running';
    spacePauseOverlay.hidden = true;
    setSpaceControls();
    syncSpaceHud();
    setSpaceLiveStatus('Permainan disambung.');
    startSpaceLoop();
  }

  function endSpaceGame() {
    spaceGame.mode = 'gameover';
    cancelAnimationFrame(spaceAnimationFrame);
    spaceKeys.clear();
    document.querySelector('#space-final-score').textContent = `Skor akhir: ${spaceGame.score.toLocaleString('en-US')} • Tahap ${spaceGame.level}`;
    spaceGameOverOverlay.hidden = false;
    setSpaceControls();
    syncSpaceHud();
    setSpaceLiveStatus(`Game over. Skor akhir ${spaceGame.score}.`);
    playSound('wrong');
    drawSpace();
  }

  function fireSpaceLaser() {
    if (spaceGame.mode !== 'running' || spaceGame.playerFireCooldown > 0) return;
    const player = spaceGame.player;
    const powered = spaceGame.powerShots > 0;
    const shots = powered ? [-150, 0, 150] : [0];
    shots.forEach(velocityX => spaceGame.bullets.push({
      x: player.x + player.width / 2 - 2,
      y: player.y - 9,
      width: 4,
      height: 15,
      velocityX,
      velocityY: -610
    }));
    if (powered) spaceGame.powerShots -= 1;
    spaceGame.playerFireCooldown = powered ? .16 : .24;
    syncSpaceHud();
  }

  function boxesOverlap(first, second) {
    return first.x < second.x + second.width && first.x + first.width > second.x && first.y < second.y + second.height && first.y + first.height > second.y;
  }

  function addSpaceExplosion(x, y, color = '#ffd84a', amount = 15) {
    const limitedAmount = reduceMotion.matches ? Math.min(5, amount) : amount;
    for (let index = 0; index < limitedAmount; index += 1) {
      const angle = Math.PI * 2 * index / limitedAmount + Math.random() * .35;
      const speed = 55 + Math.random() * 150;
      spaceGame.particles.push({ x, y, velocityX: Math.cos(angle) * speed, velocityY: Math.sin(angle) * speed, life: .45 + Math.random() * .35, size: 2 + Math.random() * 4, color });
    }
  }

  function damageSpacePlayer() {
    if (spaceGame.player.invulnerable > 0 || spaceGame.mode !== 'running') return;
    spaceGame.lives -= 1;
    spaceGame.player.invulnerable = 1.8;
    spaceGame.enemyBullets = [];
    addSpaceExplosion(spaceGame.player.x + 29, spaceGame.player.y + 18, '#ff5577', 24);
    syncSpaceHud('TERKENA!');
    setSpaceLiveStatus(`Kapal terkena serangan. Baki ${spaceGame.lives} nyawa.`);
    playSound('wrong');
    if (spaceGame.lives <= 0) endSpaceGame();
  }

  function spaceEnemyFire() {
    if (!spaceGame.enemies.length) return;
    const candidates = spaceGame.enemies.filter(enemy => !spaceGame.enemies.some(other => Math.abs(other.x - enemy.x) < 12 && other.y > enemy.y));
    const shooter = candidates[Math.floor(Math.random() * candidates.length)] || spaceGame.enemies[0];
    spaceGame.enemyBullets.push({ x: shooter.x + shooter.width / 2 - 3, y: shooter.y + shooter.height, width: 6, height: 14, velocityY: 210 + spaceGame.level * 20 });
  }

  function updateSpaceGame(delta) {
    const player = spaceGame.player;
    const movingLeft = spaceKeys.has('ArrowLeft') || spaceKeys.has('KeyA') || spaceKeys.has('touch-left');
    const movingRight = spaceKeys.has('ArrowRight') || spaceKeys.has('KeyD') || spaceKeys.has('touch-right');
    if (movingLeft !== movingRight) player.x += (movingRight ? 1 : -1) * player.speed * delta;
    player.x = clamp(player.x, 12, spaceWidth - player.width - 12);
    if (spaceKeys.has('Space') || spaceKeys.has('touch-fire')) fireSpaceLaser();
    player.invulnerable = Math.max(0, player.invulnerable - delta);
    spaceGame.playerFireCooldown = Math.max(0, spaceGame.playerFireCooldown - delta);

    spaceGame.stars.forEach(star => {
      star.y += star.speed * delta * (1 + spaceGame.level * .06);
      if (star.y > spaceHeight) { star.y = -3; star.x = Math.random() * spaceWidth; }
    });
    spaceGame.bullets.forEach(bullet => { bullet.x += bullet.velocityX * delta; bullet.y += bullet.velocityY * delta; });
    spaceGame.enemyBullets.forEach(bullet => { bullet.y += bullet.velocityY * delta; });
    spaceGame.particles.forEach(particle => { particle.x += particle.velocityX * delta; particle.y += particle.velocityY * delta; particle.life -= delta; particle.velocityX *= .98; particle.velocityY *= .98; });
    spaceGame.bullets = spaceGame.bullets.filter(bullet => bullet.y + bullet.height > -20 && bullet.x > -20 && bullet.x < spaceWidth + 20);
    spaceGame.enemyBullets = spaceGame.enemyBullets.filter(bullet => bullet.y < spaceHeight + 25);
    spaceGame.particles = spaceGame.particles.filter(particle => particle.life > 0);

    const enemySpeed = 38 + spaceGame.level * 11;
    let reverseFormation = false;
    spaceGame.enemies.forEach(enemy => {
      enemy.x += enemySpeed * spaceGame.enemyDirection * delta;
      enemy.pulse += delta * 3;
      if (enemy.x < 18 || enemy.x + enemy.width > spaceWidth - 18) reverseFormation = true;
    });
    if (reverseFormation) {
      spaceGame.enemyDirection *= -1;
      spaceGame.enemies.forEach(enemy => { enemy.x = clamp(enemy.x, 18, spaceWidth - enemy.width - 18); enemy.y += 15 + Math.min(10, spaceGame.level * 2); });
    }

    spaceGame.enemyFireCooldown -= delta;
    if (spaceGame.enemyFireCooldown <= 0) {
      spaceEnemyFire();
      spaceGame.enemyFireCooldown = Math.max(.48, 1.55 - spaceGame.level * .11) * (.75 + Math.random() * .55);
    }

    for (let bulletIndex = spaceGame.bullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      const bullet = spaceGame.bullets[bulletIndex];
      const enemyIndex = spaceGame.enemies.findIndex(enemy => boxesOverlap(bullet, enemy));
      if (enemyIndex < 0) continue;
      const enemy = spaceGame.enemies[enemyIndex];
      spaceGame.bullets.splice(bulletIndex, 1);
      spaceGame.enemies.splice(enemyIndex, 1);
      spaceGame.score += 50 * spaceGame.level;
      spaceGame.killsSinceQuestion += 1;
      addSpaceExplosion(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2, enemy.row % 2 ? '#9d61ff' : '#36e8ff');
      playSound('click');
    }

    for (let bulletIndex = spaceGame.enemyBullets.length - 1; bulletIndex >= 0; bulletIndex -= 1) {
      if (!boxesOverlap(spaceGame.enemyBullets[bulletIndex], player)) continue;
      spaceGame.enemyBullets.splice(bulletIndex, 1);
      damageSpacePlayer();
      if (spaceGame.mode !== 'running') return;
    }

    if (spaceGame.enemies.some(enemy => enemy.y + enemy.height >= player.y)) {
      damageSpacePlayer();
      if (spaceGame.mode !== 'running') return;
      createSpaceEnemies();
    }

    syncSpaceHud();
    if (!spaceGame.enemies.length) {
      spaceGame.level += 1;
      spaceGame.score += 300 * (spaceGame.level - 1);
      spaceGame.pendingNextLevel = true;
      showSpaceMathQuestion('TAHAP SELESAI • BONUS KUASA');
    } else if (spaceGame.killsSinceQuestion >= (spaceGame.questionIndex === 0 ? 4 : 7)) {
      spaceGame.killsSinceQuestion = 0;
      showSpaceMathQuestion('AMARAN MATEMATIK • POWER-UP');
    }
  }

  function drawSpaceShip(context, player) {
    const flashing = player.invulnerable > 0 && Math.floor(player.invulnerable * 10) % 2 === 0;
    if (flashing) context.globalAlpha = .28;
    context.save();
    context.translate(player.x, player.y);
    const engine = context.createLinearGradient(0, player.height, 0, player.height + 18);
    engine.addColorStop(0, '#fff16b'); engine.addColorStop(.35, '#3bffff'); engine.addColorStop(1, 'rgba(52,216,255,0)');
    context.fillStyle = engine;
    context.beginPath(); context.moveTo(18, 31); context.lineTo(27, 50); context.lineTo(32, 31); context.fill();
    context.beginPath(); context.moveTo(31, 31); context.lineTo(40, 50); context.lineTo(45, 31); context.fill();
    context.shadowColor = '#35e8ff'; context.shadowBlur = 18;
    context.fillStyle = '#39dfff';
    context.beginPath(); context.moveTo(29, 0); context.lineTo(57, 31); context.lineTo(39, 28); context.lineTo(29, 36); context.lineTo(19, 28); context.lineTo(1, 31); context.closePath(); context.fill();
    context.shadowColor = '#a452ff'; context.fillStyle = '#6737c9';
    context.beginPath(); context.moveTo(29, 5); context.lineTo(39, 28); context.lineTo(29, 31); context.lineTo(19, 28); context.closePath(); context.fill();
    context.shadowBlur = 12; context.shadowColor = '#ffe54f'; context.fillStyle = '#ffe54f'; context.beginPath(); context.arc(29, 18, 5, 0, Math.PI * 2); context.fill();
    context.restore();
    context.globalAlpha = 1;
  }

  function drawSpaceEnemy(context, enemy) {
    context.save();
    context.translate(enemy.x, enemy.y + Math.sin(enemy.pulse) * 2.5);
    const mainColor = enemy.row % 2 ? '#9b4dff' : '#20cfff';
    context.shadowColor = mainColor; context.shadowBlur = 14;
    context.fillStyle = mainColor;
    context.beginPath(); context.moveTo(23, 0); context.lineTo(34, 9); context.lineTo(46, 6); context.lineTo(40, 24); context.lineTo(30, 30); context.lineTo(16, 30); context.lineTo(6, 24); context.lineTo(0, 6); context.lineTo(12, 9); context.closePath(); context.fill();
    context.fillStyle = '#071326'; context.fillRect(12, 11, 22, 10);
    context.fillStyle = '#ffe85b'; context.fillRect(16, 14, 5, 4); context.fillRect(27, 14, 5, 4);
    context.restore();
  }

  function drawSpace() {
    const context = spaceContext;
    context.clearRect(0, 0, spaceWidth, spaceHeight);
    const background = context.createLinearGradient(0, 0, 0, spaceHeight);
    background.addColorStop(0, '#050b2c'); background.addColorStop(.55, '#100b34'); background.addColorStop(1, '#020819');
    context.fillStyle = background; context.fillRect(0, 0, spaceWidth, spaceHeight);
    const nebula = context.createRadialGradient(720, 80, 10, 720, 80, 210);
    nebula.addColorStop(0, 'rgba(91,69,255,.32)'); nebula.addColorStop(.45, 'rgba(38,174,255,.12)'); nebula.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = nebula; context.fillRect(500, 0, 400, 300);
    const planet = context.createRadialGradient(760, 110, 8, 760, 110, 63);
    planet.addColorStop(0, '#fff5ad'); planet.addColorStop(.3, '#4bc8ff'); planet.addColorStop(.72, '#3534a4'); planet.addColorStop(1, 'rgba(34,20,103,0)');
    context.fillStyle = planet; context.beginPath(); context.arc(760, 110, 62, 0, Math.PI * 2); context.fill();
    spaceGame.stars.forEach(star => { context.globalAlpha = .55 + star.size * .16; context.fillStyle = star.color; context.fillRect(star.x, star.y, star.size, star.size); });
    context.globalAlpha = 1;
    spaceGame.enemies.forEach(enemy => drawSpaceEnemy(context, enemy));
    spaceGame.bullets.forEach(bullet => { context.shadowColor = '#50ffe0'; context.shadowBlur = 11; context.fillStyle = '#bafff0'; context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height); });
    spaceGame.enemyBullets.forEach(bullet => { context.shadowColor = '#ff4370'; context.shadowBlur = 10; context.fillStyle = '#ff8ca3'; context.fillRect(bullet.x, bullet.y, bullet.width, bullet.height); });
    context.shadowBlur = 0;
    spaceGame.particles.forEach(particle => { context.globalAlpha = clamp(particle.life * 1.8, 0, 1); context.fillStyle = particle.color; context.fillRect(particle.x, particle.y, particle.size, particle.size); });
    context.globalAlpha = 1;
    drawSpaceShip(context, spaceGame.player);
    context.fillStyle = 'rgba(66,220,255,.22)'; context.fillRect(0, spaceHeight - 2, spaceWidth, 2);
  }

  function spaceLoop(timestamp) {
    if (spaceGame.mode !== 'running') return;
    if (!spaceLastTime) spaceLastTime = timestamp;
    const delta = Math.min(.034, (timestamp - spaceLastTime) / 1000);
    spaceLastTime = timestamp;
    updateSpaceGame(delta);
    drawSpace();
    if (spaceGame.mode === 'running') spaceAnimationFrame = requestAnimationFrame(spaceLoop);
  }

  function showSpaceMathQuestion(badgeText) {
    if (spaceGame.mode !== 'running') return;
    spaceGame.mode = 'quiz';
    cancelAnimationFrame(spaceAnimationFrame);
    spaceKeys.clear();
    const question = spaceQuestions[spaceGame.questionIndex % spaceQuestions.length];
    spaceGame.questionIndex += 1;
    document.querySelector('#space-math-badge').textContent = badgeText;
    document.querySelector('#space-math-question').textContent = question.question;
    const options = document.querySelector('#space-math-options');
    options.innerHTML = '';
    question.options.forEach((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'space-math-option';
      button.textContent = label;
      button.addEventListener('click', () => answerSpaceQuestion(index, question));
      options.appendChild(button);
    });
    const feedback = document.querySelector('#space-math-feedback');
    feedback.className = 'space-math-feedback';
    feedback.textContent = 'Pilih jawapan yang tepat untuk mendapatkan bonus 250 mata dan Triple Laser.';
    document.querySelector('#space-math-continue').hidden = true;
    spaceMathOverlay.hidden = false;
    setSpaceControls();
    syncSpaceHud();
    setSpaceLiveStatus(`Soalan Matematik: ${question.question}`);
    drawSpace();
  }

  function answerSpaceQuestion(chosenIndex, question) {
    const buttons = [...document.querySelectorAll('.space-math-option')];
    if (buttons.some(button => button.disabled)) return;
    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === question.answer) button.classList.add('correct');
    });
    const feedback = document.querySelector('#space-math-feedback');
    if (chosenIndex === question.answer) {
      spaceGame.score += 250 * spaceGame.level;
      spaceGame.powerShots += 10;
      buttons[chosenIndex].classList.add('correct');
      feedback.className = 'space-math-feedback good';
      feedback.innerHTML = `<strong>BETUL! +${(250 * spaceGame.level).toLocaleString('en-US')} MATA.</strong> ${question.explanation} Triple Laser dibuka untuk 10 tembakan.`;
      setSpaceLiveStatus('Jawapan betul. Triple Laser dibuka untuk 10 tembakan.');
      playSound('victory');
    } else {
      buttons[chosenIndex].classList.add('wrong');
      feedback.className = 'space-math-feedback bad';
      feedback.innerHTML = `<strong>Belum tepat.</strong> Jawapan yang betul ialah ${question.options[question.answer]}. ${question.explanation}`;
      setSpaceLiveStatus(`Jawapan salah. Jawapan betul ialah ${question.options[question.answer]}.`);
      playSound('wrong');
    }
    syncSpaceHud();
    document.querySelector('#space-math-continue').hidden = false;
  }

  function continueSpaceMission() {
    if (document.querySelector('#space-math-continue').hidden) return;
    spaceMathOverlay.hidden = true;
    if (spaceGame.pendingNextLevel) {
      spaceGame.pendingNextLevel = false;
      spaceGame.killsSinceQuestion = 0;
      createSpaceEnemies();
      spaceGame.player.x = spaceWidth / 2 - spaceGame.player.width / 2;
      spaceGame.enemyBullets = [];
      setSpaceLiveStatus(`Tahap ${spaceGame.level} bermula. Musuh bergerak lebih pantas.`);
    } else {
      setSpaceLiveStatus('Misi disambung. Kalahkan formasi musuh.');
    }
    spaceGame.mode = 'running';
    setSpaceControls();
    syncSpaceHud();
    startSpaceLoop();
  }

  function handleSpaceRoute(route) {
    if (route !== 'gamifikasi' && spaceGame.mode === 'running') pauseSpaceGame(true);
  }

  document.querySelector('#space-start').addEventListener('click', startSpaceGame);
  document.querySelector('#space-play-again').addEventListener('click', startSpaceGame);
  spacePauseButton.addEventListener('click', () => pauseSpaceGame(false));
  spaceResumeButton.addEventListener('click', resumeSpaceGame);
  document.querySelector('#space-resume-overlay').addEventListener('click', resumeSpaceGame);
  document.querySelector('#space-math-continue').addEventListener('click', continueSpaceMission);

  document.addEventListener('keydown', event => {
    if (document.querySelector('[data-page="gamifikasi"]').hidden) return;
    if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'Space'].includes(event.code) && spaceGame.mode === 'running') {
      event.preventDefault();
      spaceKeys.add(event.code);
      if (event.code === 'Space') fireSpaceLaser();
    }
    if (event.code === 'Escape' && activeArcade === 'space') {
      if (spaceGame.mode === 'running') pauseSpaceGame(false);
      else if (spaceGame.mode === 'paused') resumeSpaceGame();
    }
  });
  document.addEventListener('keyup', event => spaceKeys.delete(event.code));

  const touchSpaceControls = [
    ['#space-touch-left', 'touch-left'],
    ['#space-touch-right', 'touch-right'],
    ['#space-touch-fire', 'touch-fire']
  ];
  touchSpaceControls.forEach(([selector, key]) => {
    const button = document.querySelector(selector);
    const start = event => {
      event.preventDefault();
      if (spaceGame.mode !== 'running') return;
      spaceKeys.add(key);
      button.classList.add('active');
      button.setPointerCapture?.(event.pointerId);
      if (key === 'touch-fire') fireSpaceLaser();
    };
    const stop = event => {
      spaceKeys.delete(key);
      button.classList.remove('active');
      if (event?.pointerId !== undefined && button.hasPointerCapture?.(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener('pointerdown', start);
    button.addEventListener('pointerup', stop);
    button.addEventListener('pointercancel', stop);
    button.addEventListener('lostpointercapture', stop);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && spaceGame.mode === 'running') pauseSpaceGame(true);
  });

  syncSpaceHud();
  setSpaceControls();
  drawSpace();

  // PLUS ULTRA MASK MAZE: slide-to-wall pixel maze with Stage and Endless modes.
  const mazeRoot = document.querySelector('#mask-maze');
  const mazeCanvas = document.querySelector('#maze-canvas');
  const mazeContext = mazeCanvas.getContext('2d');
  const mazeStartOverlay = document.querySelector('#maze-start-overlay');
  const mazePauseOverlay = document.querySelector('#maze-pause-overlay');
  const mazeGameOverOverlay = document.querySelector('#maze-gameover-overlay');
  const mazeCompleteOverlay = document.querySelector('#maze-complete-overlay');
  const mazeMathOverlay = document.querySelector('#maze-math-overlay');
  const mazePauseButton = document.querySelector('#maze-pause');
  const mazeResumeButton = document.querySelector('#maze-resume');
  const mazeNextLevelButton = document.querySelector('#maze-next-level');
  const mazeLiveStatus = document.querySelector('#maze-live-status');
  const mazeSize = 15;
  const mazeTile = mazeCanvas.width / mazeSize;
  const mazeDirections = {
    up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 }
  };
  const mazeQuestions = [
    { question: '48.5 cm = ? mm', options: ['4.85 mm', '48.5 mm', '485 mm', '4,850 mm'], answer: 2, explanation: 'cm → mm: darab 10. 48.5 × 10 = 485 mm.' },
    { question: '325 cm = ? m', options: ['0.325 m', '3.25 m', '32.5 m', '325 m'], answer: 1, explanation: 'cm → m: bahagi 100. 325 ÷ 100 = 3.25 m.' },
    { question: '2.006 km = ? m', options: ['20.06 m', '200.6 m', '2,006 m', '20,060 m'], answer: 2, explanation: 'km → m: darab 1,000. 2.006 × 1,000 = 2,006 m.' },
    { question: '1.5 m = ? cm', options: ['15 cm', '150 cm', '1,500 cm', '0.15 cm'], answer: 1, explanation: 'm → cm: darab 100. 1.5 × 100 = 150 cm.' },
    { question: '0.75 km = ? m', options: ['7.5 m', '75 m', '750 m', '7,500 m'], answer: 2, explanation: 'km → m: darab 1,000. 0.75 × 1,000 = 750 m.' },
    { question: '850 mm = ? cm', options: ['8.5 cm', '85 cm', '850 cm', '8,500 cm'], answer: 1, explanation: 'mm → cm: bahagi 10. 850 ÷ 10 = 85 cm.' },
    { question: '4.25 m = ? cm', options: ['42.5 cm', '425 cm', '4,250 cm', '0.425 cm'], answer: 1, explanation: 'm → cm: darab 100. 4.25 × 100 = 425 cm.' },
    { question: '3,500 m = ? km', options: ['0.35 km', '3.5 km', '35 km', '350 km'], answer: 1, explanation: 'm → km: bahagi 1,000. 3,500 ÷ 1,000 = 3.5 km.' }
  ];

  function createMazeState(mode = 'stage') {
    return {
      mode, state: 'idle', level: 1, score: 0, lives: 3, collected: 0, totalCoins: 0,
      player: { x: 1, y: mazeSize - 2 }, start: { x: 1, y: mazeSize - 2 }, exit: { x: mazeSize - 2, y: 1 },
      grid: [], coins: [], traps: [], lasers: [], enemies: [], questionTile: null,
      questionIndex: 0, gateAnswered: false, sliding: false, moveCount: 0, voidRow: mazeSize,
      highScore: Number(localStorage.getItem('plusUltraMaskMazeHighScore') || 0), laserDisabledUntil: 0
    };
  }
  let mazeGame = createMazeState();
  let mazeSwipeStart = null;

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function shuffled(items, random) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(random() * (index + 1));
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function buildMazeBoard(level = 1) {
    const random = seededRandom((mazeGame.mode === 'endless' ? 7411 : 2917) + level * 997);
    const grid = Array.from({ length: mazeSize }, () => Array(mazeSize).fill(1));
    const start = { x: 1, y: mazeSize - 2 };
    const stack = [start];
    grid[start.y][start.x] = 0;
    while (stack.length) {
      const current = stack[stack.length - 1];
      const choices = shuffled([
        { x: 0, y: -2 }, { x: 2, y: 0 }, { x: 0, y: 2 }, { x: -2, y: 0 }
      ], random).filter(direction => {
        const x = current.x + direction.x;
        const y = current.y + direction.y;
        return x > 0 && x < mazeSize - 1 && y > 0 && y < mazeSize - 1 && grid[y][x] === 1;
      });
      if (!choices.length) {
        stack.pop();
        continue;
      }
      const direction = choices[0];
      const next = { x: current.x + direction.x, y: current.y + direction.y };
      grid[current.y + direction.y / 2][current.x + direction.x / 2] = 0;
      grid[next.y][next.x] = 0;
      stack.push(next);
    }

    const exit = { x: mazeSize - 2, y: 1 };
    grid[exit.y][exit.x] = 0;
    const candidates = shuffled(grid.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y })))
      .filter(tile => tile.cell === 0 && !(tile.x === start.x && tile.y === start.y) && !(tile.x === exit.x && tile.y === exit.y)), random);
    const used = new Set();
    const take = () => {
      const tile = candidates.find(candidate => !used.has(`${candidate.x},${candidate.y}`));
      if (tile) used.add(`${tile.x},${tile.y}`);
      return tile ? { x: tile.x, y: tile.y } : { x: 1, y: 1 };
    };
    const coinCount = Math.min(10, 5 + level);
    const coins = Array.from({ length: coinCount }, take).map(tile => ({ ...tile, collected: false }));
    const questionTile = { ...take(), used: false };
    const trapCount = Math.min(7, 1 + level);
    const laserCount = Math.min(4, Math.max(1, Math.floor(level / 2) + 1));
    const enemyCount = Math.min(4, Math.max(1, Math.floor((level + 1) / 2)));
    const traps = Array.from({ length: trapCount }, take);
    const lasers = Array.from({ length: laserCount }, take);
    const enemies = Array.from({ length: enemyCount }, () => ({ ...take(), pulse: random() * Math.PI * 2 }));
    Object.assign(mazeGame, {
      grid, start, exit, coins, traps, lasers, enemies, questionTile,
      player: { ...start }, collected: 0, totalCoins: coins.length, gateAnswered: false,
      sliding: false, moveCount: 0, voidRow: mazeSize, laserDisabledUntil: 0
    });
    syncMazeHud();
    drawMaze();
  }

  function setMazeStatus(status, message = status) {
    document.querySelector('#maze-status').textContent = status;
    mazeLiveStatus.textContent = message;
  }

  function syncMazeHud() {
    document.querySelector('#maze-score').textContent = mazeGame.score.toLocaleString('en-US');
    document.querySelector('#maze-level').textContent = mazeGame.level;
    document.querySelector('#maze-coins').textContent = `${mazeGame.collected} / ${mazeGame.totalCoins}`;
    document.querySelector('#maze-lives').textContent = Array.from({ length: 3 }, (_, index) => index < mazeGame.lives ? '♥' : '♡').join(' ');
    document.querySelector('#maze-lives').setAttribute('aria-label', `${mazeGame.lives} nyawa`);
    document.querySelector('#maze-high-score').textContent = mazeGame.highScore.toLocaleString('en-US');
    mazeRoot.dataset.mazeState = mazeGame.state;
    mazeRoot.dataset.playerX = String(mazeGame.player.x);
    mazeRoot.dataset.playerY = String(mazeGame.player.y);
    mazeRoot.dataset.coins = String(mazeGame.collected);
    mazeRoot.dataset.mode = mazeGame.mode;
    mazePauseButton.disabled = mazeGame.state !== 'running';
    mazePauseButton.hidden = mazeGame.state === 'paused';
    mazeResumeButton.hidden = mazeGame.state !== 'paused';
  }

  function mazeCellOpen(x, y) {
    return x >= 0 && y >= 0 && x < mazeSize && y < mazeSize && mazeGame.grid[y]?.[x] === 0;
  }

  function mazeHasTile(items, x, y) {
    return items.find(item => item.x === x && item.y === y);
  }

  function mazeLaserActive() {
    return Date.now() >= mazeGame.laserDisabledUntil && Math.floor(Date.now() / 850) % 2 === 0;
  }

  function rememberMazeScore() {
    const previous = Number(localStorage.getItem('plusUltraGameScore') || 0);
    if (mazeGame.score > previous) localStorage.setItem('plusUltraGameScore', String(mazeGame.score));
    if (mazeGame.score > mazeGame.highScore) {
      mazeGame.highScore = mazeGame.score;
      localStorage.setItem('plusUltraMaskMazeHighScore', String(mazeGame.highScore));
    }
  }

  function collectMazeCoin() {
    const coin = mazeGame.coins.find(item => !item.collected && item.x === mazeGame.player.x && item.y === mazeGame.player.y);
    if (!coin) return;
    coin.collected = true;
    mazeGame.collected += 1;
    mazeGame.score += 50 * mazeGame.level;
    setMazeStatus('SYILING!', `Syiling dikutip. ${mazeGame.collected} daripada ${mazeGame.totalCoins}.`);
    playSound('correct');
    rememberMazeScore();
  }

  function damageMazePlayer(reason) {
    if (!['running', 'sliding'].includes(mazeGame.state)) return;
    mazeGame.sliding = false;
    mazeGame.lives -= 1;
    mazeGame.score = Math.max(0, mazeGame.score - 75);
    playSound('wrong');
    if (mazeGame.lives <= 0) {
      endMazeGame(reason);
      return;
    }
    mazeGame.state = 'running';
    setMazeStatus('NYAWA -1', `${reason} Teruskan dari petak semasa. Baki ${mazeGame.lives} nyawa.`);
    syncMazeHud();
    drawMaze();
  }

  function checkMazeTile() {
    collectMazeCoin();
    const { x, y } = mazeGame.player;
    const trap = mazeHasTile(mazeGame.traps, x, y);
    if (trap) {
      mazeGame.traps = mazeGame.traps.filter(item => item !== trap);
      damageMazePlayer('Terkena duri!');
      return true;
    }
    if (mazeLaserActive() && mazeHasTile(mazeGame.lasers, x, y)) {
      mazeGame.laserDisabledUntil = Date.now() + 1800;
      damageMazePlayer('Terkena laser!');
      return true;
    }
    const enemy = mazeHasTile(mazeGame.enemies, x, y);
    if (enemy) {
      mazeGame.enemies = mazeGame.enemies.filter(item => item !== enemy);
      damageMazePlayer('Bertembung dengan penjaga maze!');
      return true;
    }
    if (mazeGame.questionTile && !mazeGame.questionTile.used && mazeGame.questionTile.x === x && mazeGame.questionTile.y === y) {
      showMazeQuestion();
      return true;
    }
    if (mazeGame.mode === 'endless' && y >= mazeGame.voidRow) {
      mazeGame.lives = 0;
      endMazeGame('Void neon telah menangkap wira.');
      return true;
    }
    if (mazeGame.exit.x === x && mazeGame.exit.y === y) {
      if (mazeGame.collected === mazeGame.totalCoins && mazeGame.gateAnswered) {
        completeMazeLevel();
        return true;
      }
      const missing = mazeGame.totalCoins - mazeGame.collected;
      setMazeStatus('PORTAL TERKUNCI', missing ? `Kutip ${missing} lagi syiling.` : 'Aktifkan Unit Power Gate dahulu.');
    }
    return false;
  }

  function slideMaze(directionName) {
    if (mazeGame.state !== 'running' || mazeGame.sliding) return;
    const direction = mazeDirections[directionName];
    if (!direction) return;
    const path = [];
    let x = mazeGame.player.x;
    let y = mazeGame.player.y;
    while (mazeCellOpen(x + direction.x, y + direction.y)) {
      x += direction.x;
      y += direction.y;
      path.push({ x, y });
    }
    if (!path.length) {
      setMazeStatus('DINDING!', 'Pilih arah lain. Wira tidak boleh menembusi dinding.');
      playSound('wrong');
      return;
    }
    mazeGame.sliding = true;
    mazeGame.state = 'sliding';
    setMazeStatus('MELUNCUR', `Wira bergerak ${directionName}.`);
    syncMazeHud();
    let index = 0;
    const advance = () => {
      if (!mazeGame.sliding || !['running', 'sliding'].includes(mazeGame.state)) return;
      mazeGame.player = path[index];
      index += 1;
      syncMazeHud();
      drawMaze();
      if (checkMazeTile()) return;
      if (index < path.length) {
        window.setTimeout(advance, reduceMotion.matches ? 1 : 58);
      } else {
        mazeGame.sliding = false;
        mazeGame.state = 'running';
        mazeGame.moveCount += 1;
        if (mazeGame.mode === 'endless' && mazeGame.moveCount % 3 === 0) {
          mazeGame.voidRow = Math.max(2, mazeGame.voidRow - 1);
          if (mazeGame.player.y >= mazeGame.voidRow) {
            mazeGame.lives = 0;
            endMazeGame('Void neon telah mengejar wira.');
            return;
          }
        }
        setMazeStatus('PILIH ARAH', 'Wira berhenti pada dinding. Pilih arah seterusnya.');
        syncMazeHud();
        drawMaze();
      }
    };
    advance();
  }

  function moveMazeEnemies() {
    if (mazeGame.state !== 'running' || mazeGame.sliding) return;
    mazeGame.enemies.forEach(enemy => {
      const options = shuffled(Object.values(mazeDirections), Math.random)
        .map(direction => ({ x: enemy.x + direction.x, y: enemy.y + direction.y }))
        .filter(tile => mazeCellOpen(tile.x, tile.y) && !(tile.x === mazeGame.exit.x && tile.y === mazeGame.exit.y));
      if (options.length) Object.assign(enemy, options[0]);
      enemy.pulse += .5;
    });
    if (mazeHasTile(mazeGame.enemies, mazeGame.player.x, mazeGame.player.y)) damageMazePlayer('Penjaga maze menangkap wira!');
    drawMaze();
  }

  function showMazeQuestion() {
    mazeGame.sliding = false;
    mazeGame.state = 'quiz';
    mazeGame.questionTile.used = true;
    const question = mazeQuestions[mazeGame.questionIndex % mazeQuestions.length];
    mazeGame.questionIndex += 1;
    document.querySelector('#maze-math-question').textContent = question.question;
    const options = document.querySelector('#maze-math-options');
    options.innerHTML = '';
    question.options.forEach((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'maze-math-option';
      button.textContent = label;
      button.addEventListener('click', () => answerMazeQuestion(index, question));
      options.appendChild(button);
    });
    const feedback = document.querySelector('#maze-math-feedback');
    feedback.className = 'maze-math-feedback';
    feedback.textContent = 'Pilih jawapan. Jawapan betul memberi 250 mata bonus.';
    document.querySelector('#maze-math-continue').hidden = true;
    mazeMathOverlay.hidden = false;
    setMazeStatus('UNIT POWER', `Soalan Matematik: ${question.question}`);
    syncMazeHud();
  }

  function answerMazeQuestion(chosenIndex, question) {
    const buttons = [...document.querySelectorAll('.maze-math-option')];
    if (buttons.some(button => button.disabled)) return;
    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === question.answer) button.classList.add('correct');
    });
    mazeGame.gateAnswered = true;
    const feedback = document.querySelector('#maze-math-feedback');
    if (chosenIndex === question.answer) {
      mazeGame.score += 250 * mazeGame.level;
      feedback.className = 'maze-math-feedback good';
      feedback.innerHTML = `<strong>BETUL! +${(250 * mazeGame.level).toLocaleString('en-US')} MATA.</strong> ${question.explanation}`;
      playSound('victory');
    } else {
      buttons[chosenIndex].classList.add('wrong');
      feedback.className = 'maze-math-feedback bad';
      feedback.innerHTML = `<strong>Belum tepat.</strong> Jawapan betul ialah ${question.options[question.answer]}. ${question.explanation}`;
      playSound('wrong');
    }
    rememberMazeScore();
    syncMazeHud();
    document.querySelector('#maze-math-continue').hidden = false;
  }

  function continueMazeMission() {
    if (document.querySelector('#maze-math-continue').hidden) return;
    mazeMathOverlay.hidden = true;
    mazeGame.state = 'running';
    setMazeStatus('LALUAN DIBUKA', 'Unit Power Gate aktif. Kutip syiling dan cari portal.');
    syncMazeHud();
    drawMaze();
  }

  function completeMazeLevel() {
    mazeGame.sliding = false;
    mazeGame.state = 'complete';
    mazeGame.score += 500 * mazeGame.level;
    rememberMazeScore();
    const finalStage = mazeGame.mode === 'stage' && mazeGame.level >= 3;
    document.querySelector('#maze-complete-copy').textContent = finalStage
      ? `Semua 3 tahap selesai! Skor ${mazeGame.score.toLocaleString('en-US')}.`
      : `${mazeGame.mode === 'endless' ? 'Tingkat' : 'Tahap'} ${mazeGame.level} selesai. Skor ${mazeGame.score.toLocaleString('en-US')}.`;
    mazeNextLevelButton.textContent = finalStage ? 'MAIN SEMULA' : mazeGame.mode === 'endless' ? 'TERUS MENDAKI' : 'TAHAP SETERUSNYA';
    mazeCompleteOverlay.hidden = false;
    setMazeStatus('LEVEL COMPLETE', 'Portal dicapai. Tahap selesai!');
    syncMazeHud();
    playSound('victory');
  }

  function nextMazeLevel() {
    mazeCompleteOverlay.hidden = true;
    if (mazeGame.mode === 'stage' && mazeGame.level >= 3) {
      restartMazeGame();
      return;
    }
    mazeGame.level += 1;
    mazeGame.state = 'running';
    buildMazeBoard(mazeGame.level);
    setMazeStatus(mazeGame.mode === 'endless' ? 'VOID MENINGKAT' : `TAHAP ${mazeGame.level}`, 'Maze baharu dibuka.');
    syncMazeHud();
  }

  function endMazeGame(reason) {
    mazeGame.sliding = false;
    mazeGame.state = 'gameover';
    rememberMazeScore();
    document.querySelector('#maze-final-score').textContent = `${reason} Skor akhir: ${mazeGame.score.toLocaleString('en-US')} • Tahap ${mazeGame.level}`;
    mazeGameOverOverlay.hidden = false;
    setMazeStatus('GAME OVER', reason);
    syncMazeHud();
    playSound('wrong');
  }

  function hideMazeOverlays() {
    mazeStartOverlay.hidden = true;
    mazePauseOverlay.hidden = true;
    mazeGameOverOverlay.hidden = true;
    mazeCompleteOverlay.hidden = true;
    mazeMathOverlay.hidden = true;
  }

  function startMazeGame() {
    activeArcade = 'maze';
    if (spaceGame.mode === 'running') pauseSpaceGame(true);
    if (typeof runGame !== 'undefined' && runGame.state === 'running') pauseHeroRun(true);
    const mode = mazeGame.mode;
    mazeGame = createMazeState(mode);
    mazeGame.state = 'running';
    buildMazeBoard(1);
    hideMazeOverlays();
    setMazeStatus('BERGERAK', 'Misi Mask Maze bermula. Pilih arah pertama.');
    syncMazeHud();
    drawMaze();
    playSound('victory');
  }

  function restartMazeGame() {
    startMazeGame();
  }

  function pauseMazeGame(automatic = false) {
    if (!['running', 'sliding'].includes(mazeGame.state)) return;
    mazeGame.sliding = false;
    mazeGame.state = 'paused';
    mazePauseOverlay.hidden = false;
    setMazeStatus('DIJEDA', automatic ? 'Permainan dijeda kerana arena atau halaman ditukar.' : 'Permainan dijeda.');
    syncMazeHud();
    drawMaze();
  }

  function resumeMazeGame() {
    if (mazeGame.state !== 'paused') return;
    activeArcade = 'maze';
    if (spaceGame.mode === 'running') pauseSpaceGame(true);
    mazeGame.state = 'running';
    mazePauseOverlay.hidden = true;
    setMazeStatus('BERGERAK', 'Permainan disambung.');
    syncMazeHud();
    drawMaze();
  }

  function chooseMazeMode(mode) {
    if (mazeGame.state === 'running' || mazeGame.state === 'sliding') pauseMazeGame(true);
    mazeGame = createMazeState(mode);
    buildMazeBoard(1);
    mazeGame.state = 'idle';
    document.querySelectorAll('.maze-mode').forEach(button => {
      const active = button.id === `maze-${mode}-mode`;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    hideMazeOverlays();
    mazeStartOverlay.hidden = false;
    setMazeStatus(mode === 'endless' ? 'ENDLESS SEDIA' : 'STAGE SEDIA', mode === 'endless' ? 'Void akan naik setiap tiga gerakan.' : 'Tiga tahap menanti.');
    syncMazeHud();
    drawMaze();
  }

  function handleMazeRoute(route) {
    if (route !== 'gamifikasi' && ['running', 'sliding'].includes(mazeGame.state)) pauseMazeGame(true);
  }

  function drawMazeWall(context, x, y) {
    const px = x * mazeTile;
    const py = y * mazeTile;
    const gradient = context.createLinearGradient(px, py, px + mazeTile, py + mazeTile);
    gradient.addColorStop(0, '#35177a');
    gradient.addColorStop(1, '#112e6a');
    context.fillStyle = gradient;
    context.fillRect(px + 1, py + 1, mazeTile - 2, mazeTile - 2);
    context.strokeStyle = 'rgba(77,225,255,.7)';
    context.lineWidth = 2;
    context.strokeRect(px + 3, py + 3, mazeTile - 6, mazeTile - 6);
  }

  function drawMazeHero(context, x, y) {
    const px = x * mazeTile;
    const py = y * mazeTile;
    context.save();
    context.shadowColor = '#36ffc7'; context.shadowBlur = 16;
    context.fillStyle = '#17ddb7'; context.fillRect(px + 13, py + 8, 22, 28);
    context.fillStyle = '#7e48ff'; context.fillRect(px + 10, py + 22, 28, 17);
    context.fillStyle = '#071327'; context.fillRect(px + 13, py + 11, 22, 10);
    context.fillStyle = '#fff36e'; context.fillRect(px + 17, py + 14, 5, 4); context.fillRect(px + 27, py + 14, 5, 4);
    context.fillStyle = '#30f3ff'; context.fillRect(px + 5, py + 25, 7, 7); context.fillRect(px + 36, py + 25, 7, 7);
    context.restore();
  }

  function drawMaze() {
    const context = mazeContext;
    context.clearRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    const background = context.createLinearGradient(0, 0, mazeCanvas.width, mazeCanvas.height);
    background.addColorStop(0, '#05051a'); background.addColorStop(.55, '#0d0829'); background.addColorStop(1, '#031b2b');
    context.fillStyle = background; context.fillRect(0, 0, mazeCanvas.width, mazeCanvas.height);
    context.strokeStyle = 'rgba(54,212,255,.055)'; context.lineWidth = 1;
    for (let line = 0; line <= mazeSize; line += 1) {
      context.beginPath(); context.moveTo(line * mazeTile, 0); context.lineTo(line * mazeTile, mazeCanvas.height); context.stroke();
      context.beginPath(); context.moveTo(0, line * mazeTile); context.lineTo(mazeCanvas.width, line * mazeTile); context.stroke();
    }
    mazeGame.grid.forEach((row, y) => row.forEach((cell, x) => { if (cell === 1) drawMazeWall(context, x, y); }));

    if (mazeGame.mode === 'endless' && mazeGame.voidRow < mazeSize) {
      const voidY = mazeGame.voidRow * mazeTile;
      const voidGradient = context.createLinearGradient(0, voidY, 0, mazeCanvas.height);
      voidGradient.addColorStop(0, 'rgba(224,45,255,.4)'); voidGradient.addColorStop(1, 'rgba(255,37,105,.82)');
      context.fillStyle = voidGradient; context.fillRect(0, voidY, mazeCanvas.width, mazeCanvas.height - voidY);
      context.fillStyle = '#ff9dff'; context.fillRect(0, voidY, mazeCanvas.width, 4);
    }

    const exitPulse = .62 + Math.sin(Date.now() / 180) * .25;
    context.save(); context.globalAlpha = exitPulse; context.shadowColor = '#52ffcf'; context.shadowBlur = 22;
    context.strokeStyle = '#52ffcf'; context.lineWidth = 5; context.strokeRect(mazeGame.exit.x * mazeTile + 10, mazeGame.exit.y * mazeTile + 8, mazeTile - 20, mazeTile - 16);
    context.fillStyle = mazeGame.collected === mazeGame.totalCoins && mazeGame.gateAnswered ? '#66ffd6' : '#793ca6'; context.fillRect(mazeGame.exit.x * mazeTile + 18, mazeGame.exit.y * mazeTile + 15, mazeTile - 36, mazeTile - 30); context.restore();

    mazeGame.coins.filter(coin => !coin.collected).forEach(coin => {
      const cx = coin.x * mazeTile + mazeTile / 2; const cy = coin.y * mazeTile + mazeTile / 2;
      context.save(); context.shadowColor = '#ffd94d'; context.shadowBlur = 14; context.fillStyle = '#ffd94d';
      context.beginPath(); context.arc(cx, cy, 8, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fff4a0'; context.lineWidth = 3; context.stroke(); context.restore();
    });
    mazeGame.traps.forEach(trap => {
      const px = trap.x * mazeTile; const py = trap.y * mazeTile;
      context.fillStyle = '#ff547b';
      for (let spike = 0; spike < 3; spike += 1) { context.beginPath(); context.moveTo(px + 7 + spike * 13, py + 39); context.lineTo(px + 13 + spike * 13, py + 14); context.lineTo(px + 20 + spike * 13, py + 39); context.fill(); }
    });
    mazeGame.lasers.forEach(laser => {
      const px = laser.x * mazeTile; const py = laser.y * mazeTile;
      context.fillStyle = mazeLaserActive() ? '#ff315f' : '#57233b'; context.shadowColor = '#ff315f'; context.shadowBlur = mazeLaserActive() ? 14 : 0;
      context.fillRect(px + 5, py + 21, mazeTile - 10, 6); context.shadowBlur = 0;
    });
    if (mazeGame.questionTile && !mazeGame.questionTile.used) {
      const px = mazeGame.questionTile.x * mazeTile; const py = mazeGame.questionTile.y * mazeTile;
      context.save(); context.shadowColor = '#38e8ff'; context.shadowBlur = 15; context.fillStyle = '#28dff5'; context.fillRect(px + 9, py + 9, 30, 30); context.fillStyle = '#07162b'; context.font = '900 24px system-ui'; context.textAlign = 'center'; context.fillText('?', px + 24, py + 33); context.restore();
    }
    mazeGame.enemies.forEach(enemy => {
      const px = enemy.x * mazeTile; const py = enemy.y * mazeTile + Math.sin(enemy.pulse) * 2;
      context.save(); context.shadowColor = '#ff5b9f'; context.shadowBlur = 12; context.fillStyle = '#b72f7d'; context.fillRect(px + 9, py + 11, 30, 27); context.fillStyle = '#ffe76c'; context.fillRect(px + 14, py + 18, 5, 5); context.fillRect(px + 28, py + 18, 5, 5); context.restore();
    });
    drawMazeHero(context, mazeGame.player.x, mazeGame.player.y);
  }

  document.querySelector('#maze-stage-mode').addEventListener('click', () => chooseMazeMode('stage'));
  document.querySelector('#maze-endless-mode').addEventListener('click', () => chooseMazeMode('endless'));
  document.querySelector('#maze-start').addEventListener('click', startMazeGame);
  document.querySelector('#maze-play-again').addEventListener('click', restartMazeGame);
  document.querySelector('#maze-restart').addEventListener('click', restartMazeGame);
  mazePauseButton.addEventListener('click', () => pauseMazeGame(false));
  mazeResumeButton.addEventListener('click', resumeMazeGame);
  document.querySelector('#maze-resume-overlay').addEventListener('click', resumeMazeGame);
  mazeNextLevelButton.addEventListener('click', nextMazeLevel);
  document.querySelector('#maze-math-continue').addEventListener('click', continueMazeMission);
  document.querySelectorAll('[data-maze-direction]').forEach(button => {
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      button.classList.add('active');
      slideMaze(button.dataset.mazeDirection);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => button.addEventListener(type, () => button.classList.remove('active')));
  });
  mazeCanvas.addEventListener('pointerdown', event => {
    event.preventDefault();
    mazeSwipeStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    mazeCanvas.setPointerCapture?.(event.pointerId);
  });
  mazeCanvas.addEventListener('pointerup', event => {
    if (!mazeSwipeStart || mazeSwipeStart.id !== event.pointerId) return;
    event.preventDefault();
    const dx = event.clientX - mazeSwipeStart.x;
    const dy = event.clientY - mazeSwipeStart.y;
    mazeSwipeStart = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
    slideMaze(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  mazeCanvas.addEventListener('pointercancel', () => { mazeSwipeStart = null; });
  document.addEventListener('keydown', event => {
    if (document.querySelector('[data-page="gamifikasi"]').hidden || activeArcade !== 'maze') return;
    const keyDirections = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
    if (keyDirections[event.code] && mazeGame.state === 'running') {
      event.preventDefault();
      slideMaze(keyDirections[event.code]);
    }
    if (event.code === 'Escape') {
      if (mazeGame.state === 'running' || mazeGame.state === 'sliding') pauseMazeGame(false);
      else if (mazeGame.state === 'paused') resumeMazeGame();
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && (mazeGame.state === 'running' || mazeGame.state === 'sliding')) pauseMazeGame(true);
  });
  window.setInterval(moveMazeEnemies, 760);
  window.setInterval(() => {
    if (!reduceMotion.matches && !document.querySelector('[data-page="gamifikasi"]').hidden) drawMaze();
  }, 150);
  buildMazeBoard(1);
  mazeGame.state = 'idle';
  syncMazeHud();
  drawMaze();

  // PLUS ULTRA HERO RUN: auto-run platformer with hold-to-jump physics.
  const runRoot = document.querySelector('#hero-run');
  const runCanvas = document.querySelector('#run-canvas');
  const runContext = runCanvas.getContext('2d');
  const runStartOverlay = document.querySelector('#run-start-overlay');
  const runPauseOverlay = document.querySelector('#run-pause-overlay');
  const runGameOverOverlay = document.querySelector('#run-gameover-overlay');
  const runCompleteOverlay = document.querySelector('#run-complete-overlay');
  const runMathOverlay = document.querySelector('#run-math-overlay');
  const runPauseButton = document.querySelector('#run-pause');
  const runResumeButton = document.querySelector('#run-resume');
  const runJumpButton = document.querySelector('#run-jump');
  const runLiveStatus = document.querySelector('#run-live-status');
  const runGroundY = 430;
  const runHeroScreenX = 150;
  let runAnimationFrame = 0;
  let runLastTime = 0;

  const runQuestions = [
    { question: '48.5 cm = ? mm', options: ['4.85 mm', '48.5 mm', '485 mm', '4,850 mm'], answer: 2, explanation: 'cm → mm: darab 10. 48.5 × 10 = 485 mm.' },
    { question: '325 cm = ? m', options: ['0.325 m', '3.25 m', '32.5 m', '325 m'], answer: 1, explanation: 'cm → m: bahagi 100. 325 ÷ 100 = 3.25 m.' },
    { question: '2.006 km = ? m', options: ['20.06 m', '200.6 m', '2,006 m', '20,060 m'], answer: 2, explanation: 'km → m: darab 1,000. 2.006 × 1,000 = 2,006 m.' },
    { question: '1.5 m = ? cm', options: ['15 cm', '150 cm', '1,500 cm', '0.15 cm'], answer: 1, explanation: 'm → cm: darab 100. 1.5 × 100 = 150 cm.' },
    { question: '0.75 km = ? m', options: ['7.5 m', '75 m', '750 m', '7,500 m'], answer: 2, explanation: 'km → m: darab 1,000. 0.75 × 1,000 = 750 m.' },
    { question: '850 mm = ? cm', options: ['8.5 cm', '85 cm', '850 cm', '8,500 cm'], answer: 1, explanation: 'mm → cm: bahagi 10. 850 ÷ 10 = 85 cm.' },
    { question: '4.25 m = ? cm', options: ['42.5 cm', '425 cm', '4,250 cm', '0.425 cm'], answer: 1, explanation: 'm → cm: darab 100. 4.25 × 100 = 425 cm.' },
    { question: '3,500 m = ? km', options: ['0.35 km', '3.5 km', '35 km', '350 km'], answer: 1, explanation: 'm → km: bahagi 1,000. 3,500 ÷ 1,000 = 3.5 km.' }
  ];

  function createRunState() {
    return {
      state: 'idle', level: 1, score: 0, coins: 0, lives: 3, worldX: 0, length: 5600,
      speed: 205, jumps: 0, questionIndex: 0, shield: 0, invulnerable: 0,
      highScore: Number(localStorage.getItem('plusUltraHeroRunHighScore') || 0),
      player: { x: runHeroScreenX, y: runGroundY - 62, width: 44, height: 62, vy: 0, onGround: true, jumpHeld: false, holdTime: 0 },
      gaps: [], platforms: [], obstacles: [], enemies: [], coinsList: [], stars: [], crystals: [], particles: []
    };
  }
  let runGame = createRunState();

  function buildRunLevel(level = 1) {
    runGame.level = level;
    runGame.length = 5200 + level * 650;
    runGame.speed = 195 + level * 22;
    runGame.worldX = 0;
    runGame.player = { x: runHeroScreenX, y: runGroundY - 62, width: 44, height: 62, vy: 0, onGround: true, jumpHeld: false, holdTime: 0 };
    const extra = (level - 1) * 80;
    runGame.gaps = [
      { start: 820, end: 970 + extra / 3 }, { start: 1770, end: 1940 + extra / 2 },
      { start: 2960, end: 3125 + extra / 3 }, { start: 4240, end: 4420 + extra / 2 }
    ];
    runGame.platforms = [
      { x: 560, y: 335, width: 230, height: 24 }, { x: 1120, y: 300, width: 270, height: 24 },
      { x: 2060, y: 350, width: 250, height: 24 }, { x: 2520, y: 275, width: 280, height: 24 },
      { x: 3330, y: 325, width: 290, height: 24 }, { x: 3810, y: 255, width: 250, height: 24 },
      { x: 4620, y: 330, width: 300, height: 24 }
    ];
    runGame.obstacles = [
      { x: 480, y: runGroundY - 48, width: 44, height: 48, kind: 'block' },
      { x: 1500, y: runGroundY - 76, width: 58, height: 76, kind: 'pipe' },
      { x: 2380, y: runGroundY - 52, width: 48, height: 52, kind: 'block' },
      { x: 3650, y: runGroundY - 82, width: 62, height: 82, kind: 'pipe' },
      { x: 4970, y: runGroundY - 56, width: 50, height: 56, kind: 'block' }
    ];
    runGame.enemies = [1050, 2220, 2780, 3490, 4560, 5180].slice(0, 4 + level).map((x, index) => ({
      x: x + level * 22, y: runGroundY - 42, width: 43, height: 42, alive: true, direction: index % 2 ? -1 : 1, origin: x + level * 22, range: 62 + level * 10, speed: 34 + level * 8
    }));
    runGame.coinsList = [];
    for (let x = 320; x < runGame.length - 280; x += 210) {
      const arc = Math.sin(x / 310) * 45;
      runGame.coinsList.push({ x, y: runGroundY - 86 - Math.max(0, arc), radius: 10, collected: false });
    }
    runGame.platforms.forEach(platform => {
      for (let offset = 55; offset < platform.width - 20; offset += 66) runGame.coinsList.push({ x: platform.x + offset, y: platform.y - 34, radius: 10, collected: false });
    });
    runGame.stars = [
      { x: 1350, y: 245, radius: 15, collected: false },
      { x: 2760, y: 220, radius: 15, collected: false },
      { x: 4030, y: 205, radius: 15, collected: false }
    ];
    runGame.crystals = [
      { x: 420 + level * 30, y: runGroundY - 82, width: 30, height: 48, collected: false },
      { x: 3560 + level * 45, y: runGroundY - 82, width: 30, height: 48, collected: false }
    ];
    runGame.particles = [];
    syncRunHud();
    drawHeroRun();
  }

  function setRunStatus(status, message = status) {
    document.querySelector('#run-status').textContent = status;
    runLiveStatus.textContent = message;
  }

  function rememberRunScore() {
    const previous = Number(localStorage.getItem('plusUltraGameScore') || 0);
    if (runGame.score > previous) localStorage.setItem('plusUltraGameScore', String(runGame.score));
    if (runGame.score > runGame.highScore) {
      runGame.highScore = runGame.score;
      localStorage.setItem('plusUltraHeroRunHighScore', String(runGame.highScore));
    }
  }

  function syncRunHud() {
    document.querySelector('#run-score').textContent = Math.round(runGame.score).toLocaleString('en-US');
    document.querySelector('#run-level').textContent = runGame.level;
    document.querySelector('#run-coins').textContent = runGame.coins;
    document.querySelector('#run-lives').textContent = Array.from({ length: 3 }, (_, index) => index < runGame.lives ? '♥' : '♡').join(' ');
    document.querySelector('#run-lives').setAttribute('aria-label', `${runGame.lives} nyawa`);
    document.querySelector('#run-distance').textContent = `${Math.floor(runGame.worldX / 10)} m`;
    document.querySelector('#run-high-score').textContent = Math.round(runGame.highScore).toLocaleString('en-US');
    document.querySelector('#run-progress-bar').style.width = `${Math.min(100, runGame.worldX / runGame.length * 100)}%`;
    runRoot.dataset.runState = runGame.state;
    runRoot.dataset.runDistance = String(Math.round(runGame.worldX));
    runRoot.dataset.runJumps = String(runGame.jumps);
    runRoot.dataset.runCoins = String(runGame.coins);
    runRoot.dataset.runLives = String(runGame.lives);
    runPauseButton.disabled = runGame.state !== 'running';
    runPauseButton.hidden = runGame.state === 'paused';
    runResumeButton.hidden = runGame.state !== 'paused';
  }

  function runBoxOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function runGroundExists(worldX) {
    return !runGame.gaps.some(gap => worldX > gap.start && worldX < gap.end);
  }

  function pressRunJump() {
    if (runGame.state !== 'running') return;
    const player = runGame.player;
    if (player.onGround) {
      player.vy = -655;
      player.onGround = false;
      player.jumpHeld = true;
      player.holdTime = 0;
      runGame.jumps += 1;
      runJumpButton.classList.add('active');
      setRunStatus('LOMPAT!', 'Wira melompat. Tahan untuk mencapai ketinggian tambahan.');
      playSound('click');
      syncRunHud();
    } else if (player.vy < 0 && player.holdTime < .23) {
      player.jumpHeld = true;
      runJumpButton.classList.add('active');
    }
  }

  function releaseRunJump() {
    runGame.player.jumpHeld = false;
    runJumpButton.classList.remove('active');
  }

  function addRunParticles(x, y, color, count = 8) {
    for (let index = 0; index < count; index += 1) {
      runGame.particles.push({ x, y, vx: (Math.random() - .5) * 180, vy: -50 - Math.random() * 150, life: .55 + Math.random() * .45, color, size: 3 + Math.random() * 4 });
    }
  }

  function damageRunPlayer(reason) {
    if (runGame.invulnerable > 0 || runGame.state !== 'running') return;
    runGame.lives -= 1;
    runGame.score = Math.max(0, runGame.score - 100);
    playSound('wrong');
    if (runGame.lives <= 0) {
      endHeroRun(reason);
      return;
    }
    runGame.worldX = Math.max(0, runGame.worldX - 240);
    Object.assign(runGame.player, { y: runGroundY - runGame.player.height, vy: 0, onGround: true, jumpHeld: false });
    runGame.invulnerable = 2.2;
    setRunStatus('NYAWA -1', `${reason} Wira kembali ke titik selamat. Baki ${runGame.lives} nyawa.`);
    syncRunHud();
  }

  function collectRunItems() {
    const playerWorld = { x: runGame.worldX + runHeroScreenX, y: runGame.player.y, width: runGame.player.width, height: runGame.player.height };
    runGame.coinsList.forEach(coin => {
      const coinBox = { x: coin.x - coin.radius, y: coin.y - coin.radius, width: coin.radius * 2, height: coin.radius * 2 };
      if (!coin.collected && runBoxOverlap(playerWorld, coinBox)) {
        coin.collected = true;
        runGame.coins += 1;
        runGame.score += 25 * runGame.level;
        addRunParticles(coin.x, coin.y, '#ffd84b', 7);
        playSound('click');
      }
    });
    runGame.stars.forEach(star => {
      const box = { x: star.x - star.radius, y: star.y - star.radius, width: star.radius * 2, height: star.radius * 2 };
      if (!star.collected && runBoxOverlap(playerWorld, box)) {
        star.collected = true;
        runGame.score += 150 * runGame.level;
        runGame.shield = Math.max(runGame.shield, 3.5);
        addRunParticles(star.x, star.y, '#8bffef', 16);
        setRunStatus('BINTANG!', 'Perisai tenaga aktif selama beberapa saat.');
        playSound('correct');
      }
    });
    const crystal = runGame.crystals.find(item => !item.collected && runBoxOverlap(playerWorld, item));
    if (crystal) {
      crystal.collected = true;
      showRunQuestion();
    }
  }

  function updateRunPhysics(delta) {
    const player = runGame.player;
    const previousBottom = player.y + player.height;
    runGame.worldX += runGame.speed * delta;
    runGame.score += delta * 4 * runGame.level;
    if (player.jumpHeld && player.vy < 0 && player.holdTime < .23) {
      player.vy -= 760 * delta;
      player.holdTime += delta;
    }
    player.vy += 1750 * delta;
    player.y += player.vy * delta;
    player.onGround = false;

    const heroWorldLeft = runGame.worldX + runHeroScreenX;
    const heroWorldRight = heroWorldLeft + player.width;
    const surfaces = [];
    if (runGroundExists(heroWorldLeft + player.width / 2)) surfaces.push(runGroundY);
    runGame.platforms.forEach(platform => {
      if (heroWorldRight > platform.x + 5 && heroWorldLeft < platform.x + platform.width - 5) surfaces.push(platform.y);
    });
    if (player.vy >= 0) {
      const landing = surfaces.filter(surface => previousBottom <= surface + 9 && player.y + player.height >= surface).sort((a, b) => a - b)[0];
      if (landing !== undefined) {
        player.y = landing - player.height;
        player.vy = 0;
        player.onGround = true;
        player.holdTime = 0;
      }
    }
    if (player.y > runCanvas.height + 30) {
      damageRunPlayer('Wira terjatuh ke dalam jurang!');
      return;
    }

    const playerWorld = { x: heroWorldLeft, y: player.y, width: player.width, height: player.height };
    runGame.obstacles.forEach(obstacle => {
      if (runBoxOverlap(playerWorld, obstacle)) damageRunPlayer('Terlanggar halangan!');
    });
    runGame.enemies.forEach(enemy => {
      if (!enemy.alive) return;
      enemy.x += enemy.direction * enemy.speed * delta;
      if (Math.abs(enemy.x - enemy.origin) > enemy.range) enemy.direction *= -1;
      if (!runBoxOverlap(playerWorld, enemy)) return;
      if (player.vy > 80 && previousBottom <= enemy.y + 15) {
        enemy.alive = false;
        player.vy = -420;
        runGame.score += 120 * runGame.level;
        addRunParticles(enemy.x, enemy.y, '#ff6b83', 12);
        playSound('correct');
      } else if (runGame.shield > 0) {
        enemy.alive = false;
        runGame.score += 80;
        addRunParticles(enemy.x, enemy.y, '#49ffd0', 12);
      } else {
        damageRunPlayer('Bertembung dengan musuh!');
      }
    });
    collectRunItems();
    runGame.shield = Math.max(0, runGame.shield - delta);
    runGame.invulnerable = Math.max(0, runGame.invulnerable - delta);
    runGame.particles.forEach(particle => { particle.x += particle.vx * delta; particle.y += particle.vy * delta; particle.vy += 500 * delta; particle.life -= delta; });
    runGame.particles = runGame.particles.filter(particle => particle.life > 0);
    rememberRunScore();
    syncRunHud();
    if (runGame.worldX >= runGame.length) completeRunLevel();
  }

  function showRunQuestion() {
    if (runGame.state !== 'running') return;
    runGame.state = 'quiz';
    cancelAnimationFrame(runAnimationFrame);
    releaseRunJump();
    const question = runQuestions[runGame.questionIndex % runQuestions.length];
    runGame.questionIndex += 1;
    document.querySelector('#run-math-question').textContent = question.question;
    const options = document.querySelector('#run-math-options');
    options.innerHTML = '';
    question.options.forEach((label, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'run-math-option';
      button.textContent = label;
      button.addEventListener('click', () => answerRunQuestion(index, question));
      options.appendChild(button);
    });
    const feedback = document.querySelector('#run-math-feedback');
    feedback.className = 'run-math-feedback';
    feedback.textContent = 'Jawapan betul memberikan 300 mata dan perisai tenaga.';
    document.querySelector('#run-math-continue').hidden = true;
    runMathOverlay.hidden = false;
    setRunStatus('UNIT POWER', `Soalan Matematik: ${question.question}`);
    syncRunHud();
    drawHeroRun();
  }

  function answerRunQuestion(chosenIndex, question) {
    const buttons = [...document.querySelectorAll('.run-math-option')];
    if (buttons.some(button => button.disabled)) return;
    buttons.forEach((button, index) => {
      button.disabled = true;
      if (index === question.answer) button.classList.add('correct');
    });
    const feedback = document.querySelector('#run-math-feedback');
    if (chosenIndex === question.answer) {
      runGame.score += 300 * runGame.level;
      runGame.shield = 5;
      buttons[chosenIndex].classList.add('correct');
      feedback.className = 'run-math-feedback good';
      feedback.innerHTML = `<strong>BETUL! +${(300 * runGame.level).toLocaleString('en-US')} MATA.</strong> ${question.explanation} Perisai dibuka selama 5 saat.`;
      playSound('victory');
    } else {
      buttons[chosenIndex].classList.add('wrong');
      feedback.className = 'run-math-feedback bad';
      feedback.innerHTML = `<strong>Belum tepat.</strong> Jawapan betul ialah ${question.options[question.answer]}. ${question.explanation}`;
      playSound('wrong');
    }
    rememberRunScore();
    syncRunHud();
    document.querySelector('#run-math-continue').hidden = false;
  }

  function continueHeroRun() {
    if (document.querySelector('#run-math-continue').hidden) return;
    runMathOverlay.hidden = true;
    runGame.state = 'running';
    setRunStatus('LARIAN DISAMBUNG', 'Unit Power selesai. Teruskan ke garisan penamat!');
    syncRunHud();
    startRunLoop();
  }

  function hideRunOverlays() {
    runStartOverlay.hidden = true;
    runPauseOverlay.hidden = true;
    runGameOverOverlay.hidden = true;
    runCompleteOverlay.hidden = true;
    runMathOverlay.hidden = true;
  }

  function startHeroRun() {
    activeArcade = 'run';
    if (spaceGame.mode === 'running') pauseSpaceGame(true);
    if (mazeGame.state === 'running' || mazeGame.state === 'sliding') pauseMazeGame(true);
    const savedHighScore = runGame.highScore;
    runGame = createRunState();
    runGame.highScore = savedHighScore;
    runGame.state = 'running';
    buildRunLevel(1);
    hideRunOverlays();
    setRunStatus('AUTO-RUN!', 'Wira mula berlari secara automatik. Bersedia untuk melompat.');
    syncRunHud();
    playSound('victory');
    startRunLoop();
  }

  function pauseHeroRun(automatic = false) {
    if (runGame.state !== 'running') return;
    runGame.state = 'paused';
    cancelAnimationFrame(runAnimationFrame);
    releaseRunJump();
    runPauseOverlay.hidden = false;
    setRunStatus('DIJEDA', automatic ? 'Permainan dijeda kerana arena atau halaman ditukar.' : 'Permainan dijeda.');
    syncRunHud();
    drawHeroRun();
  }

  function resumeHeroRun() {
    if (runGame.state !== 'paused') return;
    activeArcade = 'run';
    if (spaceGame.mode === 'running') pauseSpaceGame(true);
    if (mazeGame.state === 'running' || mazeGame.state === 'sliding') pauseMazeGame(true);
    runGame.state = 'running';
    runPauseOverlay.hidden = true;
    setRunStatus('AUTO-RUN!', 'Larian disambung.');
    syncRunHud();
    startRunLoop();
  }

  function endHeroRun(reason) {
    runGame.state = 'gameover';
    cancelAnimationFrame(runAnimationFrame);
    releaseRunJump();
    rememberRunScore();
    document.querySelector('#run-final-score').textContent = `${reason} Skor akhir: ${Math.round(runGame.score).toLocaleString('en-US')} • ${runGame.coins} syiling`;
    runGameOverOverlay.hidden = false;
    setRunStatus('GAME OVER', reason);
    syncRunHud();
    playSound('wrong');
  }

  function completeRunLevel() {
    if (runGame.state !== 'running') return;
    runGame.state = 'complete';
    cancelAnimationFrame(runAnimationFrame);
    runGame.score += 600 * runGame.level;
    rememberRunScore();
    const finalLevel = runGame.level >= 3;
    document.querySelector('#run-complete-copy').textContent = finalLevel
      ? `Ketiga-tiga tahap selesai! Skor ${Math.round(runGame.score).toLocaleString('en-US')}.`
      : `Tahap ${runGame.level} selesai dengan ${runGame.coins} syiling. Skor ${Math.round(runGame.score).toLocaleString('en-US')}.`;
    document.querySelector('#run-next-level').textContent = finalLevel ? 'MAIN SEMULA' : 'TAHAP SETERUSNYA';
    runCompleteOverlay.hidden = false;
    setRunStatus('LEVEL COMPLETE', 'Garis penamat dicapai!');
    syncRunHud();
    playSound('victory');
  }

  function nextRunLevel() {
    runCompleteOverlay.hidden = true;
    if (runGame.level >= 3) {
      startHeroRun();
      return;
    }
    runGame.level += 1;
    runGame.state = 'running';
    buildRunLevel(runGame.level);
    setRunStatus(`TAHAP ${runGame.level}`, 'Kelajuan meningkat. Bersedia!');
    syncRunHud();
    startRunLoop();
  }

  function handleRunRoute(route) {
    if (route !== 'gamifikasi' && runGame.state === 'running') pauseHeroRun(true);
  }

  function drawRunHero(context) {
    const player = runGame.player;
    const flashing = runGame.invulnerable > 0 && Math.floor(runGame.invulnerable * 12) % 2 === 0;
    context.save();
    if (flashing) context.globalAlpha = .3;
    context.translate(player.x, player.y);
    context.shadowColor = runGame.shield > 0 ? '#ffe75b' : '#38ffc0';
    context.shadowBlur = runGame.shield > 0 ? 24 : 14;
    context.fillStyle = '#23e0ad'; context.fillRect(8, 4, 28, 31);
    context.fillStyle = '#113f75'; context.fillRect(4, 28, 36, 25);
    context.fillStyle = '#071627'; context.fillRect(9, 9, 26, 11);
    context.fillStyle = '#fff36b'; context.fillRect(14, 12, 5, 5); context.fillRect(26, 12, 5, 5);
    context.fillStyle = '#ff526e'; context.fillRect(14, 35, 17, 7);
    const stride = Math.sin(runGame.worldX / 18) * 5;
    context.fillStyle = '#29d9ff'; context.fillRect(7 + stride, 51, 10, 9); context.fillRect(27 - stride, 51, 10, 9);
    if (runGame.shield > 0) { context.strokeStyle = '#ffe65b'; context.lineWidth = 3; context.beginPath(); context.arc(22, 30, 34, 0, Math.PI * 2); context.stroke(); }
    context.restore();
  }

  function drawHeroRun() {
    const context = runContext;
    const width = runCanvas.width;
    const height = runCanvas.height;
    const sky = context.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, '#36a8ff'); sky.addColorStop(.58, '#89e8ff'); sky.addColorStop(1, '#e9fff4');
    context.fillStyle = sky; context.fillRect(0, 0, width, height);
    const sunX = 790 - (runGame.worldX * .03 % 160);
    context.fillStyle = 'rgba(255,244,155,.88)'; context.shadowColor = '#fff2a0'; context.shadowBlur = 35; context.beginPath(); context.arc(sunX, 92, 44, 0, Math.PI * 2); context.fill(); context.shadowBlur = 0;
    for (let index = -1; index < 7; index += 1) {
      const cloudX = ((index * 220 - runGame.worldX * .12) % 1540) - 80;
      context.fillStyle = 'rgba(255,255,255,.72)'; context.beginPath(); context.arc(cloudX, 110 + index % 2 * 42, 30, 0, Math.PI * 2); context.arc(cloudX + 32, 101 + index % 2 * 42, 40, 0, Math.PI * 2); context.arc(cloudX + 68, 113 + index % 2 * 42, 27, 0, Math.PI * 2); context.fill();
    }
    context.fillStyle = '#4e6fc5';
    for (let index = -1; index < 10; index += 1) {
      const x = ((index * 190 - runGame.worldX * .2) % 1900) - 180;
      context.beginPath(); context.moveTo(x, 350); context.lineTo(x + 95, 190 + index % 3 * 35); context.lineTo(x + 190, 350); context.fill();
    }
    context.fillStyle = '#194d78';
    for (let index = -1; index < 16; index += 1) {
      const x = ((index * 105 - runGame.worldX * .42) % 1785) - 100;
      const buildingHeight = 70 + (index * 37 % 110);
      context.fillRect(x, runGroundY - buildingHeight, 70, buildingHeight);
      context.fillStyle = '#54e1ff';
      for (let row = 0; row < 3; row += 1) context.fillRect(x + 12 + row * 18, runGroundY - buildingHeight + 16, 7, 12);
      context.fillStyle = '#194d78';
    }
    context.fillStyle = '#143558'; context.fillRect(0, runGroundY, width, height - runGroundY);
    context.fillStyle = '#2aef9d'; context.fillRect(0, runGroundY, width, 12);

    const toScreen = worldX => worldX - runGame.worldX;
    runGame.gaps.forEach(gap => {
      const x = toScreen(gap.start); const gapWidth = gap.end - gap.start;
      context.fillStyle = '#020616'; context.fillRect(x, runGroundY - 2, gapWidth, height - runGroundY + 4);
      context.fillStyle = '#9a45ff'; context.fillRect(x, runGroundY + 26, gapWidth, 5);
    });
    runGame.platforms.forEach(platform => {
      const x = toScreen(platform.x); if (x > width || x + platform.width < 0) return;
      const gradient = context.createLinearGradient(x, platform.y, x, platform.y + platform.height);
      gradient.addColorStop(0, '#36ffc1'); gradient.addColorStop(1, '#186fa2'); context.fillStyle = gradient; context.fillRect(x, platform.y, platform.width, platform.height); context.fillStyle = '#ffe64d'; context.fillRect(x, platform.y, platform.width, 5);
    });
    runGame.obstacles.forEach(obstacle => {
      const x = toScreen(obstacle.x); if (x > width || x + obstacle.width < 0) return;
      context.shadowColor = obstacle.kind === 'pipe' ? '#39ffc0' : '#ff7055'; context.shadowBlur = 10;
      context.fillStyle = obstacle.kind === 'pipe' ? '#158b75' : '#dd4e3a'; context.fillRect(x, obstacle.y, obstacle.width, obstacle.height);
      context.fillStyle = obstacle.kind === 'pipe' ? '#4affc8' : '#ffb33e'; context.fillRect(x - 4, obstacle.y, obstacle.width + 8, 10); context.shadowBlur = 0;
    });
    runGame.coinsList.filter(coin => !coin.collected).forEach(coin => {
      const x = toScreen(coin.x); if (x < -20 || x > width + 20) return;
      context.save(); context.shadowColor = '#ffd84b'; context.shadowBlur = 12; context.fillStyle = '#ffd84b'; context.beginPath(); context.arc(x, coin.y, coin.radius, 0, Math.PI * 2); context.fill(); context.strokeStyle = '#fff5a0'; context.lineWidth = 3; context.stroke(); context.restore();
    });
    runGame.stars.filter(star => !star.collected).forEach(star => {
      const x = toScreen(star.x); if (x < -30 || x > width + 30) return;
      context.save(); context.translate(x, star.y); context.shadowColor = '#fff65a'; context.shadowBlur = 18; context.fillStyle = '#fff65a'; context.beginPath(); for (let point = 0; point < 10; point += 1) { const radius = point % 2 ? 7 : 16; const angle = -Math.PI / 2 + point * Math.PI / 5; context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius); } context.closePath(); context.fill(); context.restore();
    });
    runGame.crystals.filter(crystal => !crystal.collected).forEach(crystal => {
      const x = toScreen(crystal.x); if (x < -40 || x > width + 40) return;
      context.save(); context.translate(x + crystal.width / 2, crystal.y + crystal.height / 2); context.shadowColor = '#b566ff'; context.shadowBlur = 22; context.fillStyle = '#9555ff'; context.beginPath(); context.moveTo(0, -24); context.lineTo(15, 0); context.lineTo(0, 24); context.lineTo(-15, 0); context.closePath(); context.fill(); context.fillStyle = '#fff'; context.font = '900 17px system-ui'; context.textAlign = 'center'; context.fillText('?', 0, 6); context.restore();
    });
    runGame.enemies.filter(enemy => enemy.alive).forEach(enemy => {
      const x = toScreen(enemy.x); if (x < -60 || x > width + 60) return;
      context.save(); context.shadowColor = '#ff4d77'; context.shadowBlur = 12; context.fillStyle = '#9d2868'; context.fillRect(x, enemy.y, enemy.width, enemy.height); context.fillStyle = '#ffe66b'; context.fillRect(x + 8, enemy.y + 10, 7, 7); context.fillRect(x + 28, enemy.y + 10, 7, 7); context.fillStyle = '#3e0a2a'; context.fillRect(x + 7, enemy.y + 32, 29, 8); context.restore();
    });
    const finishX = toScreen(runGame.length);
    if (finishX < width + 120) { context.fillStyle = '#fff'; context.fillRect(finishX, 120, 10, runGroundY - 120); context.fillStyle = '#ffd84b'; context.fillRect(finishX + 10, 130, 90, 48); context.fillStyle = '#15365b'; context.font = '1000 16px system-ui'; context.fillText('FINISH', finishX + 21, 160); }
    runGame.particles.forEach(particle => { const x = toScreen(particle.x); context.globalAlpha = Math.max(0, particle.life); context.fillStyle = particle.color; context.fillRect(x, particle.y, particle.size, particle.size); }); context.globalAlpha = 1;
    drawRunHero(context);
  }

  function runLoop(timestamp) {
    if (runGame.state !== 'running') return;
    if (!runLastTime) runLastTime = timestamp;
    const delta = Math.min(.032, (timestamp - runLastTime) / 1000);
    runLastTime = timestamp;
    updateRunPhysics(delta);
    drawHeroRun();
    if (runGame.state === 'running') runAnimationFrame = requestAnimationFrame(runLoop);
  }

  function startRunLoop() {
    cancelAnimationFrame(runAnimationFrame);
    runLastTime = 0;
    runAnimationFrame = requestAnimationFrame(runLoop);
  }

  document.querySelector('#run-start').addEventListener('click', startHeroRun);
  document.querySelector('#run-play-again').addEventListener('click', startHeroRun);
  document.querySelector('#run-restart').addEventListener('click', startHeroRun);
  runPauseButton.addEventListener('click', () => pauseHeroRun(false));
  runResumeButton.addEventListener('click', resumeHeroRun);
  document.querySelector('#run-resume-overlay').addEventListener('click', resumeHeroRun);
  document.querySelector('#run-next-level').addEventListener('click', nextRunLevel);
  document.querySelector('#run-math-continue').addEventListener('click', continueHeroRun);
  const startJumpInput = event => { event.preventDefault(); pressRunJump(); event.currentTarget?.setPointerCapture?.(event.pointerId); };
  const stopJumpInput = event => { event?.preventDefault?.(); releaseRunJump(); };
  [runCanvas, runJumpButton].forEach(target => {
    target.addEventListener('pointerdown', startJumpInput);
    target.addEventListener('pointerup', stopJumpInput);
    target.addEventListener('pointercancel', stopJumpInput);
    target.addEventListener('lostpointercapture', stopJumpInput);
  });
  document.addEventListener('keydown', event => {
    if (document.querySelector('[data-page="gamifikasi"]').hidden || activeArcade !== 'run') return;
    if (['Space', 'ArrowUp'].includes(event.code) && runGame.state === 'running') {
      event.preventDefault();
      if (!event.repeat) pressRunJump();
      else runGame.player.jumpHeld = true;
    }
    if (event.code === 'Escape') {
      if (runGame.state === 'running') pauseHeroRun(false);
      else if (runGame.state === 'paused') resumeHeroRun();
    }
  });
  document.addEventListener('keyup', event => { if (['Space', 'ArrowUp'].includes(event.code)) releaseRunJump(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && runGame.state === 'running') pauseHeroRun(true); });
  buildRunLevel(1);
  runGame.state = 'idle';
  syncRunHud();
  drawHeroRun();

  // Quiz Tokoyami remains separate from the timed game.
  const easyQuestions = [
    { topic: 'PENUKARAN ASAS', q: '1 cm bersamaan dengan berapa milimeter?', options: ['1 mm', '10 mm', '100 mm', '1,000 mm'], answer: 1, why: '1 cm = 10 mm, jadi sentimeter didarab dengan 10.' },
    { topic: 'METER KE SENTIMETER', q: 'Tukarkan 3.4 m kepada cm.', options: ['34 cm', '340 cm', '3,400 cm', '0.034 cm'], answer: 1, why: 'm → cm: 3.4 × 100 = 340 cm.' },
    { topic: 'METER KE KILOMETER', q: '2,500 m bersamaan dengan…', options: ['0.25 km', '2.5 km', '25 km', '250 km'], answer: 1, why: 'm → km: 2,500 ÷ 1,000 = 2.5 km.' },
    { topic: 'PERPULUHAN', q: 'Tukarkan 0.75 km kepada m.', options: ['75 m', '750 m', '7,500 m', '0.00075 m'], answer: 1, why: 'km → m: 0.75 × 1,000 = 750 m.' },
    { topic: 'SENTIMETER KE MILIMETER', q: '12.5 cm bersamaan dengan…', options: ['1.25 mm', '12.5 mm', '125 mm', '1,250 mm'], answer: 2, why: 'cm → mm: 12.5 × 10 = 125 mm.' },
    { topic: 'TIGA TEMPAT PERPULUHAN', q: '2.006 km bersamaan dengan berapa meter?', options: ['20.06 m', '200.6 m', '2,006 m', '20,060 m'], answer: 2, why: '2.006 × 1,000 = 2,006 m.' },
    { topic: 'MILIMETER KE METER', q: 'Tukarkan 4,850 mm kepada m.', options: ['0.485 m', '4.85 m', '48.5 m', '485 m'], answer: 1, why: 'mm → m: 4,850 ÷ 1,000 = 4.85 m.' },
    { topic: 'UKURAN BERCAMPUR', q: '3 m 25 cm ditulis dalam meter ialah…', options: ['3.025 m', '3.25 m', '3.5 m', '325 m'], answer: 1, why: '25 cm = 0.25 m, jadi jumlahnya 3.25 m.' },
    { topic: 'OPERASI PANJANG', q: '1.2 m + 85 cm bersamaan dengan…', options: ['1.285 m', '2.05 m', '2.5 m', '9.7 m'], answer: 1, why: '85 cm = 0.85 m; 1.2 + 0.85 = 2.05 m.' },
    { topic: 'MASALAH HARIAN', q: 'Laluan sepanjang 1.75 km bersamaan dengan berapa meter?', options: ['175 m', '1,075 m', '1,750 m', '17,500 m'], answer: 2, why: '1.75 × 1,000 = 1,750 m.' }
  ];
  const mediumQuestions = [
  {
    "topic": "CABARAN PENUKARAN",
    "q": "48.5 cm = ? mm",
    "options": [
      "485 mm",
      "48.5 mm",
      "4,850 mm",
      "4.85 mm"
    ],
    "answer": 0,
    "why": "48.5 × 10 = 485 mm.",
    "hint": "cm → mm: darab 10."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "325 cm = ? m",
    "options": [
      "32.5 m",
      "0.325 m",
      "3.25 m",
      "32,500 m"
    ],
    "answer": 2,
    "why": "325 ÷ 100 = 3.25 m.",
    "hint": "cm → m: bahagi 100."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "850 mm = ? cm",
    "options": [
      "8.5 cm",
      "85 cm",
      "8,500 cm",
      "0.85 cm"
    ],
    "answer": 1,
    "why": "850 ÷ 10 = 85 cm.",
    "hint": "mm → cm: bahagi 10."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "4.25 m = ? cm",
    "options": [
      "42.5 cm",
      "4,250 cm",
      "0.0425 cm",
      "425 cm"
    ],
    "answer": 3,
    "why": "4.25 × 100 = 425 cm.",
    "hint": "m → cm: darab 100."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "3,500 m = ? km",
    "options": [
      "3.5 km",
      "35 km",
      "0.35 km",
      "3,500,000 km"
    ],
    "answer": 0,
    "why": "3,500 ÷ 1,000 = 3.5 km.",
    "hint": "m → km: bahagi 1,000."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "0.906 km = ? m",
    "options": [
      "90.6 m",
      "9,060 m",
      "906 m",
      "0.906 m"
    ],
    "answer": 2,
    "why": "0.906 × 1,000 = 906 m.",
    "hint": "km → m: darab 1,000."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "6.08 m = ? mm",
    "options": [
      "608 mm",
      "6,080 mm",
      "60.8 mm",
      "60,800 mm"
    ],
    "answer": 1,
    "why": "6.08 × 1,000 = 6,080 mm.",
    "hint": "1 m = 1,000 mm."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "7,025 mm = ? m",
    "options": [
      "70.25 m",
      "0.7025 m",
      "702.5 m",
      "7.025 m"
    ],
    "answer": 3,
    "why": "7,025 ÷ 1,000 = 7.025 m.",
    "hint": "mm → m: bahagi 1,000."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "0.045 km = ? cm",
    "options": [
      "4,500 cm",
      "450 cm",
      "45 cm",
      "45,000 cm"
    ],
    "answer": 0,
    "why": "0.045 × 1,000 = 45 m; 45 × 100 = 4,500 cm.",
    "hint": "Tukar km kepada m, kemudian m kepada cm."
  },
  {
    "topic": "CABARAN PENUKARAN",
    "q": "12,500 cm = ? km",
    "options": [
      "0.0125 km",
      "1.25 km",
      "0.125 km",
      "125 km"
    ],
    "answer": 2,
    "why": "12,500 ÷ 100 = 125 m; 125 ÷ 1,000 = 0.125 km.",
    "hint": "Tukar cm kepada m, kemudian m kepada km."
  }
];
  const hardQuestions = [
  {
    "topic": "MASALAH HARIAN",
    "q": "Aina berjalan 1.275 km pada waktu pagi dan 850 m pada waktu petang. Berapakah jumlah jarak dalam km?",
    "options": [
      "1.36 km",
      "2.125 km",
      "13.6 km",
      "2,125 km"
    ],
    "answer": 1,
    "why": "850 m = 0.85 km; 1.275 + 0.85 = 2.125 km.",
    "hint": "Samakan unit kepada km sebelum menambah."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Tali 5 m dipotong kepada 8 bahagian sama panjang. Berapakah panjang setiap bahagian dalam cm?",
    "options": [
      "6.25 cm",
      "625 cm",
      "40 cm",
      "62.5 cm"
    ],
    "answer": 3,
    "why": "5 m = 500 cm; 500 ÷ 8 = 62.5 cm.",
    "hint": "Tukar kepada cm, kemudian bahagi kepada 8 bahagian."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Pita sepanjang 3.006 m dipotong sebanyak 128.5 cm. Berapakah baki dalam mm?",
    "options": [
      "1,721 mm",
      "172.1 mm",
      "1,851.5 mm",
      "4,285 mm"
    ],
    "answer": 0,
    "why": "3.006 m = 3,006 mm; 128.5 cm = 1,285 mm; 3,006 − 1,285 = 1,721 mm.",
    "hint": "Samakan kedua-dua panjang kepada mm sebelum menolak."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Laluan A panjangnya 2.45 km dan laluan B panjangnya 1,875 m. Berapakah beza panjang dalam m?",
    "options": [
      "4,325 m",
      "57.5 m",
      "575 m",
      "0.575 m"
    ],
    "answer": 2,
    "why": "2.45 km = 2,450 m; 2,450 − 1,875 = 575 m.",
    "hint": "Tukar km kepada m, kemudian cari beza."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Buku A panjangnya 18.5 cm dan buku B panjangnya 167 mm. Berapakah beza panjang dalam cm?",
    "options": [
      "18 cm",
      "1.8 cm",
      "35.2 cm",
      "0.18 cm"
    ],
    "answer": 1,
    "why": "167 mm = 16.7 cm; 18.5 − 16.7 = 1.8 cm.",
    "hint": "Tukar mm kepada cm sebelum menolak."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Empat batang paip masing-masing panjangnya 1.125 m. Berapakah jumlah panjang dalam cm?",
    "options": [
      "45 cm",
      "4,500 cm",
      "112.5 cm",
      "450 cm"
    ],
    "answer": 3,
    "why": "4 × 1.125 m = 4.5 m; 4.5 × 100 = 450 cm.",
    "hint": "Darab bilangan paip, kemudian tukar kepada cm."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Jarak rumah ke sekolah ialah 0.875 km. Selepas berjalan 350 m, berapakah baki jarak dalam km?",
    "options": [
      "0.525 km",
      "0.84 km",
      "1.225 km",
      "525 km"
    ],
    "answer": 0,
    "why": "350 m = 0.35 km; 0.875 − 0.35 = 0.525 km.",
    "hint": "Samakan unit kepada km sebelum menolak."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Reben 2 m 35 cm disambung dengan reben 1,650 mm. Berapakah jumlah panjang dalam m?",
    "options": [
      "2.515 m",
      "3.95 m",
      "4 m",
      "40 m"
    ],
    "answer": 2,
    "why": "2 m 35 cm = 2.35 m; 1,650 mm = 1.65 m; 2.35 + 1.65 = 4 m.",
    "hint": "Tukar setiap bahagian kepada m dahulu."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Satu pusingan trek ialah 120 m. Berapakah jarak 3.5 pusingan dalam km?",
    "options": [
      "4.2 km",
      "0.42 km",
      "420 km",
      "0.042 km"
    ],
    "answer": 1,
    "why": "120 × 3.5 = 420 m; 420 ÷ 1,000 = 0.42 km.",
    "hint": "Darab jarak satu pusingan, kemudian tukar m kepada km."
  },
  {
    "topic": "MASALAH HARIAN",
    "q": "Kabel 6.4 m dipotong kepada tiga bahagian 75 cm setiap satu. Berapakah baki kabel dalam cm?",
    "options": [
      "565 cm",
      "225 cm",
      "6.175 cm",
      "415 cm"
    ],
    "answer": 3,
    "why": "6.4 m = 640 cm; 3 × 75 = 225 cm; 640 − 225 = 415 cm.",
    "hint": "Samakan unit dan tolak jumlah tiga potongan."
  }
];
  const quizLevels = [
    {label:'Easy', level:'Asas', version:'tokoyami-5.1.1-v1', questions:easyQuestions},
    {label:'Medium', level:'Sederhana', version:'tokoyami-5.1.1-medium-v1', questions:mediumQuestions},
    {label:'Hard', level:'Sukar', version:'tokoyami-5.1.1-hard-v1', questions:hardQuestions}
  ];
  let activeQuizLevel = 0;
  let questions = quizLevels[0].questions;
  const accountContext = JSON.parse(document.querySelector('#ua-account-context')?.textContent || '{}');
  const levelStorageKey = 'plusUltraQuizLevels:v1:' + (accountContext.id || 'preview');
  let practiceBest = [0,0,0];
  try { const saved = JSON.parse(localStorage.getItem(levelStorageKey) || '[]'); practiceBest = practiceBest.map((_,i) => Number.isInteger(saved[i]) && saved[i]>=0 && saved[i]<=10 ? saved[i] : 0); } catch {}
  function levelBest(i) { return Math.max(practiceBest[i], ...officialResults.filter(r => r.quiz_version === quizLevels[i].version).map(r=>r.score), 0); }
  function levelUnlocked(i) { return Number.isInteger(i) && i>=0 && i<3 && quizLevels.slice(0,i).every((_,j)=>levelBest(j)>=6); }
  function syncQuizLevels() {
    document.querySelectorAll('[data-quiz-level]').forEach(button => {
      const i = Number(button.dataset.quizLevel), unlocked = levelUnlocked(i);
      button.disabled = !unlocked; button.setAttribute('aria-pressed', String(i===activeQuizLevel));
      button.textContent = `${unlocked ? (i===activeQuizLevel ? '▶ ' : '') : '🔒 '}${quizLevels[i].label} · ${levelBest(i)}/10`;
    });
    document.querySelector('#quiz-level-status').textContent = `Tahap ${quizLevels[activeQuizLevel].label} · 10 soalan · Lulus minimum 6/10. Kemajuan latihan disimpan pada peranti ini. Markah rasmi dipaparkan selepas simpanan akaun disahkan.`;
  }
  function showLevelOutcome() {
    const passed = quizScore >= 6;
    document.querySelector('#result-copy').textContent = passed ? (activeQuizLevel===2 ? 'PLUS ULTRA! Anda berjaya menamatkan tahap Hard!' : `Tahniah! Tahap ${quizLevels[activeQuizLevel+1].label} dibuka. Teruskan misi!`) : `Anda mendapat ${quizScore}/10. Minimum 6 jawapan betul diperlukan. Cuba semula tahap ${quizLevels[activeQuizLevel].label}.`;
    const next = document.querySelector('#next-quiz-level');
    next.hidden = !passed || activeQuizLevel===2 || !levelUnlocked(activeQuizLevel+1);
    next.textContent = activeQuizLevel<2 ? `Teruskan ke ${quizLevels[activeQuizLevel+1].label} →` : 'Semua tahap selesai';
    syncQuizLevels();
  }
  let quizSelections = [];
  let quizSubmissionId = crypto.randomUUID();
  let quizSaving = false;
  let quizLoadSequence = 0;
  let officialQuiz = null;
  const savedSubmissionIds = new Set();
  let officialResults = [];
  let officialResultsLoaded = false;
  let officialResultsError = '';
  let officialResultsReadStatus = 'loading';
  let officialResultsUserRef = '';
  const cloudStatus = document.createElement('div');
  cloudStatus.className = 'quiz-cloud-status';
  cloudStatus.setAttribute('role', 'status');
  const cloudText = document.createElement('span');
  const cloudRetry = document.createElement('button');
  cloudRetry.type = 'button'; cloudRetry.className = 'secondary-button'; cloudRetry.textContent = 'Cuba simpan semula'; cloudRetry.hidden = true;
  cloudStatus.append(cloudText, cloudRetry);
  document.querySelector('.quiz-topbar').after(cloudStatus);
  const diagnosticPanel = document.createElement('details');
  diagnosticPanel.className = 'quiz-save-diagnostics';
  diagnosticPanel.innerHTML = '<summary>Diagnostik penyimpanan markah</summary><div class="quiz-diagnostic-session">Sesi Auth: belum disemak</div><ol></ol><small>Diagnostik tidak merekodkan token atau cookie.</small>';
  cloudStatus.after(diagnosticPanel);
  const diagnosticRows = quizLevels.map(level => ({level:level.level,quiz:'belum disemak',rpc:'tidak dipanggil',save:'belum disahkan'}));
  function renderDiagnostics() {
    diagnosticPanel.querySelector('ol').innerHTML = diagnosticRows.map(row => `<li><b>${row.level}</b><span>Kuiz rasmi: ${row.quiz}</span><span>RPC: ${row.rpc}</span><span>Simpanan: ${row.save}</span></li>`).join('');
  }
  function setDiagnostic(index,patch) { Object.assign(diagnosticRows[index],patch); renderDiagnostics(); }
  function safeFieldSummary(fields = {}) {
    return ['attempt_id','correct','total','correct_count','total_questions'].map(name => {
      const item = fields[name] || {}; return `${name}:${item.present ? item.type : 'tiada'}`;
    }).join(', ');
  }
  async function confirmQuizSession() {
    const session = await quizAPI('session');
    if (!session?.id || session.role !== 'student' || session.id !== accountContext.id) throw new Error('Sesi Auth murid tidak sepadan dengan halaman ini. Log keluar dan masuk semula.');
    diagnosticPanel.querySelector('.quiz-diagnostic-session').textContent = `Sesi Auth: disahkan · murid …${String(session.id).slice(-8)}`;
    return session;
  }
  renderDiagnostics();
  function cloudMessage(message, retry = false) { cloudText.textContent = message; cloudRetry.hidden = !retry; cloudRetry.disabled = quizSaving; }
  async function quizAPI(action, params = {}) {
    const response = await fetch('/api/hero-portal-test?' + new URLSearchParams({action,...params}), {credentials:'same-origin',cache:'no-store'});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `${action}: HTTP ${response.status}`);
    return data;
  }
  async function loadOfficialResults() {
    const [attempts, quizzes] = await Promise.all([quizAPI('my-results'),quizAPI('quizzes')]);
    if (!Array.isArray(attempts.rows) || !Array.isArray(quizzes.quizzes)) throw new Error('Rekod kuiz rasmi tidak sah.');
    if (attempts.project_ref !== 'qyvyxpwqjosqxfmwsikx') throw new Error('Projek Supabase untuk keputusan kuiz tidak sepadan.');
    if (!['records_visible','no_visible_records'].includes(attempts.read_status)) throw new Error('Status bacaan hero_attempts tidak sah.');
    const byId = new Map(quizzes.quizzes.map(q => [String(q.id),q.level]));
    const byLevel = new Map(quizLevels.map(q => [q.level,q.version]));
    const unmapped = attempts.rows.filter(row => !byLevel.get(byId.get(String(row.quiz_id))));
    if (unmapped.length) throw new Error(`${unmapped.length} rekod hero_attempts wujud tetapi quiz_id tidak dapat dipadankan dengan hero_quizzes yang diterbitkan.`);
    const mapped = attempts.rows.map(row => ({
      quiz_version:byLevel.get(byId.get(String(row.quiz_id))), score:Number(row.correct_count), total:Number(row.total_questions)
    }));
    if (mapped.some(row => !row.quiz_version || !Number.isInteger(row.score) || row.total !== 10 || row.score < 0 || row.score > row.total))
      throw new Error('Rekod hero_attempts ditemui tetapi markah atau jumlah soalan tidak sah.');
    officialResults = mapped;
    officialResultsLoaded = true;
    officialResultsError = '';
    officialResultsReadStatus = attempts.read_status;
    officialResultsUserRef = attempts.user_ref || '';
    syncQuizLevels(); refreshCertificateStats();
  }
  async function loadOfficialQuestions(levelIndex, sequence) {
    const level = quizLevels[levelIndex];
    const list = await quizAPI('quizzes');
    if (!Array.isArray(list.quizzes)) throw new Error('Senarai kuiz Supabase tidak sah.');
    const published = list.quizzes.filter(q => q.level === level.level);
    if (published.length === 0) { setDiagnostic(levelIndex,{quiz:'tidak diterbitkan',rpc:'tidak dipanggil',save:'tiada'}); return null; }
    if (published.length !== 1 || String(published[0].id) !== String(levelIndex + 1)) throw new Error('ID kuiz diterbitkan tidak sepadan dengan tahap asal.');
    const quizId = String(published[0].id);
    const payload = await quizAPI('questions', {quiz_id:quizId});
    if (!Array.isArray(payload.questions) || payload.questions.length !== level.questions.length) throw new Error('Bilangan soalan Supabase tidak sepadan dengan kuiz asal.');
    const ordered = [...payload.questions].sort((a,b) => Number(a.position)-Number(b.position));
    const merged = ordered.map((row,i) => {
      const original = level.questions[i];
      if (Number(row.position) !== i+1 || row.prompt !== original.q ||
        JSON.stringify(row.options) !== JSON.stringify(original.options) ||
        !Number.isSafeInteger(Number(row.id)) || Number(row.id) < 1)
        throw new Error(`Soalan ${i+1} tahap ${level.level} tidak sepadan dengan kuiz asal.`);
      return {...original,q:row.prompt,options:row.options,questionId:Number(row.id)};
    });
    if (new Set(merged.map(q => q.questionId)).size !== merged.length) throw new Error('ID soalan Supabase berulang.');
    if (sequence !== quizLoadSequence) return null;
    setDiagnostic(levelIndex,{quiz:`disahkan · ID ${quizId}`,rpc:'tidak dipanggil',save:'belum dihantar'});
    return {id:quizId,questions:merged};
  }
  async function submitQuizAttempt() {
    if (quizSaving || savedSubmissionIds.has(quizSubmissionId) || !officialQuiz || quizSelections.length !== questions.length || quizSelections.some(x => !Number.isInteger(x) || x < 0 || x > 3)) return;
    const submissionId = quizSubmissionId, answers = quizSelections.map((selected_option,i) => ({question_id:officialQuiz.questions[i].questionId,selected_option})), version = quizLevels[activeQuizLevel].version;
    quizSaving = true; setDiagnostic(activeQuizLevel,{rpc:'menyemak sesi',save:'menunggu'}); cloudMessage('Markah sementara selesai. Menyemak sesi sebelum menghantar ke Supabase...');
    try {
      await confirmQuizSession();
      setDiagnostic(activeQuizLevel,{rpc:'hero_submit_quiz sedang dipanggil',save:'menunggu'});
      cloudMessage('Sesi murid disahkan. Memanggil hero_submit_quiz dan menyemak rekod hero_attempts...');
      const response = await fetch('/api/hero-portal-test', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'submit-quiz',quiz_id:officialQuiz.id,answers})});
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Markah belum disimpan.');
      if (!data.result || typeof data.result !== 'object' || data.confirmation?.saved !== true) throw new Error('RPC merespons tetapi simpanan hero_attempts belum disahkan.');
      if (quizSubmissionId !== submissionId) return;
      const confirmed = Number(data.result.correct), total = Number(data.result.total);
      const attemptType = data.diagnostics?.response_fields?.attempt_id?.type || (data.result.attempt_id === null ? 'null' : typeof data.result.attempt_id);
      if (!Number.isInteger(confirmed) || total !== questions.length || confirmed < 0 || confirmed > total) throw new Error('Markah Supabase tidak dapat disahkan.');
      setDiagnostic(activeQuizLevel,{rpc:`berjaya · respons ${data.diagnostics?.rpc_result_container || 'objek'} · ${safeFieldSummary(data.diagnostics?.response_fields)}`,
        save:`disahkan ${confirmed}/${total} · attempt_id ${attemptType}`});
      savedSubmissionIds.add(submissionId); quizScore = confirmed; officialResults.push({quiz_version:version,score:confirmed,total}); officialResultsLoaded = true; officialResultsError = ''; showLevelOutcome();
      document.querySelector('#final-score').textContent = `${quizScore} / ${total}`;
      refreshCertificateStats(); cloudMessage(`✓ Keputusan rasmi Supabase disimpan dan disahkan dalam hero_attempts: ${quizScore} / ${total}.`);
    } catch(e) { if (quizSubmissionId === submissionId) { setDiagnostic(activeQuizLevel,{rpc:'gagal',save:'tidak disahkan · ' + e.message}); cloudMessage('KEPUTUSAN RASMI TIDAK DISIMPAN: ' + e.message, true); diagnosticPanel.open = true; } }
    finally { if (quizSubmissionId === submissionId) { quizSaving = false; cloudRetry.disabled = false; } }
  }
  cloudRetry.addEventListener('click', () => officialQuiz ? submitQuizAttempt() : startQuizLevel(activeQuizLevel));
  cloudMessage('Markah rasmi dikira oleh Supabase selepas sepuluh jawapan dihantar.');
  const quizConcepts = [
    'cm → mm: darab 10. Unit kecil memerlukan bilangan yang lebih besar.',
    'm → cm: darab 100. Ingat, 1 m = 100 cm.',
    'm → km: bahagi 1,000. Ingat, 1 km = 1,000 m.',
    'km → m: darab 1,000. Semak kedudukan titik perpuluhan.',
    'cm → mm: darab 10, termasuk apabila nilainya perpuluhan.',
    'km → m: darab 1,000. Sifar dalam nombor perpuluhan tetap penting.',
    'mm → m: bahagi 1,000 kerana 1 m = 1,000 mm.',
    'Tukarkan bahagian cm kepada m dengan bahagi 100, kemudian tambah bahagian m.',
    'Samakan unit dahulu: cm kepada m ialah bahagi 100. Selepas itu barulah tambah.',
    'km → m: darab 1,000. Anggarkan dahulu untuk menyemak jawapan.'
  ];
  const quizCheers = ['Tenang, Wira. Kita mulakan misi pertama!', 'Baca unit asal dan unit sasaran dengan teliti.', 'Darab atau bahagi? Fikirkan saiz unit dahulu.', 'Perpuluhan pun boleh dikuasai. Teruskan!', 'Sudah separuh perjalanan. Fokus, Wira!', 'Perhatikan setiap digit. Kamu boleh!', 'Samakan unit dengan langkah yang kemas.', 'Pecahkan ukuran bercampur kepada dua bahagian.', 'Samakan unit dahulu sebelum melakukan operasi.', 'Misi terakhir! Semak pilihan sebelum menjawab.'];
  const quizMentor = document.querySelector('#quiz-mentor');
  const missionSteps = document.querySelector('#quiz-mission-steps');
  questions.forEach((_, i) => { const step = document.createElement('span'); step.className = 'quiz-mission-step'; step.setAttribute('role', 'listitem'); step.textContent = String(i + 1); missionSteps.appendChild(step); });
  function updateQuizSteps(answeredCount) {
    [...missionSteps.children].forEach((step, i) => { step.classList.toggle('is-done', i < answeredCount); step.classList.toggle('is-current', i === answeredCount); step.setAttribute('aria-label', `Soalan ${i + 1}: ${i < answeredCount ? 'telah dijawab' : i === answeredCount ? 'semasa' : 'belum dijawab'}`); });
  }
  document.querySelector('#quiz-concept-toggle').addEventListener('click', event => {
    const concept = document.querySelector('#quiz-concept'); concept.hidden = !concept.hidden;
    event.currentTarget.setAttribute('aria-expanded', String(!concept.hidden));
    event.currentTarget.textContent = concept.hidden ? '✦ Petunjuk konsep' : 'Tutup petunjuk';
  });
  let quizIndex = 0;
  let quizScore = 0;
  let quizAnswered = false;
  function animateQuizQuestion() {
    const card = document.querySelector('#quiz-card');
    card.classList.remove('quiz-enter');
    card.dataset.motion = String(quizIndex % 5);
    card.dataset.feedback = '';
    quizMentor.dataset.state = 'ready';
    document.querySelector('#quiz-mentor-message').textContent = quizCheers[quizIndex];
    document.querySelector('#quiz-round-badge').textContent = String(quizIndex + 1).padStart(2, '0');
    document.querySelector('#quiz-concept').textContent = questions[quizIndex].hint || quizConcepts[quizIndex];
    document.querySelector('#quiz-concept').hidden = true;
    document.querySelector('#quiz-concept-toggle').setAttribute('aria-expanded', 'false');
    document.querySelector('#quiz-concept-toggle').textContent = '✦ Petunjuk konsep';
    document.querySelector('#quiz-energy-burst').replaceChildren();
    updateQuizSteps(quizIndex);
    document.querySelector('#quiz-feedback').className = 'quiz-feedback';
    document.querySelector('#quiz-score').classList.remove('score-pop');
    void card.offsetWidth;
    card.classList.add('quiz-enter');
    const progress = document.querySelector('#quiz-progress');
    progress.parentElement.setAttribute('role', 'progressbar');
    progress.parentElement.setAttribute('aria-label', 'Kemajuan Quiz');
    progress.parentElement.setAttribute('aria-valuemin', '0');
    progress.parentElement.setAttribute('aria-valuemax', String(questions.length));
    progress.parentElement.setAttribute('aria-valuenow', String(quizIndex));
  }
  function renderQuestion() {
    const item = questions[quizIndex];
    quizAnswered = false;
    document.querySelector('#quiz-count').textContent = `${quizLevels[activeQuizLevel].label} · Soalan ${quizIndex + 1} / ${questions.length}`;
    document.querySelector('#quiz-score').textContent = `Markah: ${quizScore}`;
    document.querySelector('#quiz-progress').style.width = `${quizIndex / questions.length * 100}%`;
    document.querySelector('#quiz-topic').textContent = item.topic;
    document.querySelector('#quiz-question').textContent = item.q;
    document.querySelector('#quiz-feedback').textContent = '';
    document.querySelector('#next-question').hidden = true;
    const options = document.querySelector('#quiz-options');
    options.innerHTML = '';
    item.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quiz-option';
      button.dataset.index = index;
      button.style.setProperty('--option-delay', `${index * 65}ms`);
      button.innerHTML = `<b>${String.fromCharCode(65 + index)}</b><span>${option}</span>`;
      options.appendChild(button);
    });
    animateQuizQuestion();
  }
  document.querySelector('#quiz-options').addEventListener('click', event => {
    const button = event.target.closest('.quiz-option');
    if (!button || quizAnswered) return;
    quizAnswered = true;
    const chosen = Number(button.dataset.index);
    quizSelections[quizIndex] = chosen;
    button.classList.add('selected');
    const item = questions[quizIndex];
    document.querySelectorAll('.quiz-option').forEach((option, index) => {
      option.disabled = true;
      if (index === item.answer) option.classList.add('correct');
    });
    const feedback = document.querySelector('#quiz-feedback');
    if (chosen === item.answer) {
      quizScore += 1;
      feedback.innerHTML = `<strong><span aria-hidden="true">✓</span> PLUS ULTRA! Jawapan Betul! +1 markah.</strong> ${item.why}`;
      feedback.className = 'quiz-feedback good';
      quizMentor.dataset.state = 'correct';
      document.querySelector('#quiz-mentor-message').textContent = 'PLUS ULTRA! Langkah kamu semakin mantap!';
      const burst = document.querySelector('#quiz-energy-burst');
      for (let i = 0; i < 12; i++) { const spark = document.createElement('i'); spark.style.setProperty('--spark-angle', `${i * 30}deg`); spark.style.setProperty('--spark-distance', `${65 + (i % 3) * 18}px`); burst.appendChild(spark); }

      document.querySelector('#quiz-card').dataset.feedback = 'correct';
      document.querySelector('#quiz-score').classList.add('score-pop');
      playSound('correct');
    } else {
      button.classList.add('wrong');
      feedback.innerHTML = `<strong>Belum tepat.</strong> ${item.why}`;
      feedback.className = 'quiz-feedback bad';
      quizMentor.dataset.state = 'encourage';
      document.querySelector('#quiz-mentor-message').textContent = 'Tak mengapa, Wira. Baca penerangan dan cuba pada misi seterusnya.';

      document.querySelector('#quiz-card').dataset.feedback = 'wrong';
      playSound('wrong');
    }
    document.querySelector('#quiz-score').textContent = `Markah: ${quizScore}`;
    document.querySelector('#quiz-progress').style.width = `${(quizIndex + 1) / questions.length * 100}%`;
    document.querySelector('#quiz-progress').parentElement.setAttribute('aria-valuenow', String(quizIndex + 1));
    updateQuizSteps(quizIndex + 1);
    document.querySelector('#next-question').hidden = false;
  });
  document.querySelector('#next-question').addEventListener('click', () => {
    if (!quizAnswered || quizIndex >= questions.length) return;
    quizAnswered = false;
    quizIndex += 1;
    quizIndex < questions.length ? renderQuestion() : finishQuiz();
  });
  function finishQuiz() {
    quizMentor.dataset.state = 'complete';
    document.querySelector('#quiz-mentor-message').textContent = 'Sepuluh misi selesai! Usaha dan latihan membina seorang wira.';
    document.querySelector('#quiz-concept-toggle').hidden = true;
    document.querySelector('#quiz-concept').hidden = true;
    updateQuizSteps(questions.length);
    document.querySelector('#quiz-card').hidden = true;
    document.querySelector('#quiz-result').hidden = false;
    document.querySelector('#quiz-progress').style.width = '100%';
    document.querySelector('#quiz-count').textContent = 'Selesai';
    document.querySelector('#final-score').textContent = officialQuiz ? `${quizScore} / ${questions.length} (sementara · belum disahkan)` : `${quizScore} / ${questions.length} (latihan)`;
    practiceBest[activeQuizLevel] = Math.max(practiceBest[activeQuizLevel], quizScore);
    try { localStorage.setItem(levelStorageKey, JSON.stringify(practiceBest)); } catch {}
    if (officialQuiz) {
      document.querySelector('#result-copy').textContent = 'Menunggu keputusan rasmi daripada Supabase.';
      document.querySelector('#next-quiz-level').hidden = true;
      submitQuizAttempt();
    } else { setDiagnostic(activeQuizLevel,{rpc:'tidak dipanggil',save:'tidak disimpan'}); showLevelOutcome(); cloudMessage('Kuiz ini belum diterbitkan. Keputusan latihan tidak disimpan dalam Supabase.'); }
    // Refleksi kini halaman ketujuh yang boleh dibuka secara berasingan.
    refreshCertificateStats();
    playSound(quizScore >= 6 ? 'victory' : 'wrong');
  }
  async function startQuizLevel(index) {
    if (!levelUnlocked(index) || quizSaving) return;
    const sequence = ++quizLoadSequence;
    activeQuizLevel = index;
    questions = quizLevels[index].questions;
    officialQuiz = null;
    quizIndex = 0;
    quizScore = 0;
    quizSelections = []; quizSubmissionId = crypto.randomUUID(); quizSaving = false;
    document.querySelector('#quiz-concept-toggle').hidden = false;
    cloudMessage(accountContext.role === 'guest' ? 'Markah akan disimpan untuk sesi murid yang sudah masuk.' : accountContext.role === 'student' ? 'Jawab sepuluh soalan untuk menyimpan keputusan baharu.' : 'Mod pratonton guru — latihan tanpa rekod markah murid.');

    document.querySelector('#quiz-card').hidden = true;
    document.querySelector('#quiz-result').hidden = true;
    syncQuizLevels();
    cloudMessage('Memeriksa soalan kuiz rasmi dalam Supabase...');
    try {
      const loaded = await loadOfficialQuestions(index,sequence);
      if (sequence !== quizLoadSequence) return;
      officialQuiz = loaded;
      if (loaded) questions = loaded.questions;
      cloudMessage(loaded ? 'Soalan rasmi disahkan. Markah akhir dikira oleh Supabase.' : 'Kuiz belum diterbitkan. Anda boleh berlatih; markah tidak disimpan.');
    } catch (error) {
      if (sequence !== quizLoadSequence) return;
      setDiagnostic(index,{quiz:'gagal · ' + error.message,rpc:'tidak dipanggil',save:'tidak disimpan'});
      cloudMessage('Soalan rasmi tidak dapat disahkan: ' + error.message,true);
      diagnosticPanel.open = true;
      return;
    }
    document.querySelector('#quiz-card').hidden = false;
    renderQuestion();
  }
  document.querySelector('#restart-quiz').addEventListener('click', () => startQuizLevel(activeQuizLevel));
  document.querySelector('#next-quiz-level').addEventListener('click', () => { if(quizIndex===10 && quizScore>=6) startQuizLevel(activeQuizLevel+1); });
  document.querySelectorAll('[data-quiz-level]').forEach(button => button.addEventListener('click', () => startQuizLevel(Number(button.dataset.quizLevel))));
  syncQuizLevels();
  startQuizLevel(0);

  // Certificate eligibility is based only on the best official Supabase score
  // for each of the three published levels. Practice/local scores never qualify.
  const certificateForm = document.querySelector('#certificate-form');
  const certificateNameInput = document.querySelector('#student-name');
  const certificateLevelIds = ['#cert-score-basic','#cert-score-medium','#cert-score-hard'];
  if (accountContext.name && !certificateNameInput.value) certificateNameInput.value = accountContext.name;
  function bestOfficialScores() {
    return quizLevels.map(level => {
      const scores = officialResults.filter(result => result.quiz_version === level.version && result.total === 10).map(result => result.score);
      return scores.length ? Math.max(...scores) : null;
    });
  }
  function formatGameScore(value) {
    const score = Number(value);
    return Number.isFinite(score) ? new Intl.NumberFormat('ms-MY',{maximumFractionDigits:2}).format(score) : '0';
  }
  function refreshCertificateStats() {
    const scores = bestOfficialScores();
    const savedGame = formatGameScore(localStorage.getItem('plusUltraGameScore') || '0');
    const eligible = accountContext.role === 'student' && officialResultsLoaded && scores.every(score => score !== null && score >= 6);
    certificateLevelIds.forEach((selector,index) => {
      const element = document.querySelector(selector), score = scores[index];
      element.textContent = officialResultsError ? 'Gagal dibaca' : !officialResultsLoaded ? 'Memuatkan…' : score === null ? 'Belum selesai' : `${score} / 10 — ${score >= 6 ? 'LULUS' : 'BELUM LULUS'}`;
    });
    document.querySelector('#cert-quiz-score').textContent = eligible ? 'LAYAK' : officialResultsError ? 'Gagal disemak' : officialResultsLoaded ? 'BELUM LAYAK' : 'Menyemak…';
    document.querySelector('#cert-game-score').textContent = savedGame;
    document.querySelector('#generate-certificate').disabled = !eligible;
    document.querySelector('#print-certificate').disabled = !eligible;
    const requirement = document.querySelector('#certificate-requirement');
    requirement.className = `requirement${eligible ? ' met' : ''}`;
    if (officialResultsError) requirement.textContent = `Keputusan rasmi belum dapat disahkan: ${officialResultsError}`;
    else if (!officialResultsLoaded) requirement.textContent = 'Menyemak keputusan rasmi kuiz daripada Supabase…';
    else if (officialResultsReadStatus === 'no_visible_records') requirement.textContent = `Tiada rekod kuiz rasmi dapat dibaca untuk akaun Auth …${officialResultsUserRef || 'tidak diketahui'}. Jika Dashboard Guru mempunyai rekod akaun ini, semak student_id dan polisi SELECT RLS hero_attempts.`;
    else if (eligible) requirement.textContent = 'LAYAK MENERIMA SIJIL — ketiga-tiga tahap telah lulus sekurang-kurangnya 6/10.';
    else {
      const pending = quizLevels.filter((_,index) => scores[index] === null || scores[index] < 6).map((level,index) => {
        const originalIndex = quizLevels.indexOf(level), score = scores[originalIndex];
        return `${level.level} (${score === null ? 'belum selesai' : `${score}/10`})`;
      });
      requirement.textContent = `Belum layak. Selesaikan atau ulang tahap: ${pending.join(', ')}.`;
    }
    return {scores,eligible,savedGame};
  }
  async function prepareCertificate() {
    try { await loadOfficialResults(); }
    catch (error) { officialResultsError = error.message || 'Ralat bacaan Supabase.'; refreshCertificateStats(); cloudMessage('Keputusan tersimpan belum dapat disahkan. Sijil belum boleh dijana.'); return false; }
    const {scores,eligible,savedGame} = refreshCertificateStats();
    if (!eligible) {
      return false;
    }
    if (!certificateNameInput.reportValidity()) return false;
    const highest = Math.max(...scores);
    document.querySelector('#certificate-name').textContent = certificateNameInput.value.trim().toLocaleUpperCase('ms-MY');
    document.querySelector('#certificate-rank').textContent = highest >= 8 ? 'Wira Ukuran Elit' : 'Wira Ukuran';
    document.querySelector('#certificate-date').textContent = new Intl.DateTimeFormat('ms-MY', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    document.querySelector('#certificate-detail').textContent = `Asas ${scores[0]}/10 • Sederhana ${scores[1]}/10 • Sukar ${scores[2]}/10 • Mata permainan ${savedGame}`;
    document.querySelector('#print-certificate').disabled = false;
    document.querySelector('#certificate').scrollIntoView({ behavior: scrollBehavior(), block: 'center' });
    playSound('victory');
    return true;
  }
  certificateForm.addEventListener('submit', async event => {
    event.preventDefault();
    await prepareCertificate();
  });
  document.querySelector('#print-certificate').addEventListener('click', async () => { if (await prepareCertificate()) window.print(); });

  refreshCertificateStats();
  if (accountContext.role === 'student') loadOfficialResults().catch(error => {
    officialResultsError = error.message || 'Ralat bacaan Supabase.';
    refreshCertificateStats();
  });
  showRoute();
})();
