// Same module scope as the application. This layer never writes workspace data.
const uiMotion = (() => {
  const systemReduce = matchMedia('(prefers-reduced-motion: reduce)');
  const smallScreen = matchMedia('(max-width: 700px)');
  const active = new Set();
  let previousScene = '';
  let intent = { action: '', at: 0 };
  let sheetController;
  let sheetOpener;

  // Damped spring response, sampled once. Timing is independent of frame rate.
  function response(t) {
    const damping = .92, frequency = 12, w = frequency * Math.sqrt(1 - damping * damping);
    return 1 - Math.exp(-damping * frequency * t) *
      (Math.cos(w * t) + damping * frequency / w * Math.sin(w * t));
  }
  const samples = Array.from({length: 45}, (_, i) => i === 44 ? 1 : response(i / 44));
  const cssSpring = `linear(${samples.map(n => n.toFixed(5)).join(',')})`;
  if (CSS.supports('animation-timing-function', cssSpring)) {
    document.documentElement.style.setProperty('--spring', cssSpring);
  }
  function reduced() { return systemReduce.matches || !!profile().reducedMotion; }
  function preferences() {
    document.documentElement.classList.toggle('no-motion', reduced());
    if (reduced()) for (const animation of active) animation.cancel();
  }
  systemReduce.addEventListener('change', preferences);
  function play(element, frames, duration = 320, easing = 'linear') {
    if (!element || reduced() || !element.animate) return;
    const animation = element.animate(frames, { duration, easing, fill: 'both' });
    active.add(animation);
    const done = () => { active.delete(animation); animation.cancel(); };
    animation.finished.then(done, () => active.delete(animation));
    return animation;
  }
  function spring(element, frame, duration = 360) {
    return play(element, samples.map((value, i) => ({ ...frame(value), offset:i / 44 })), duration);
  }
  function rect(element) {
    if (!element || !element.getClientRects().length) return null;
    const r = element.getBoundingClientRect();
    return { x:r.x, y:r.y, width:r.width, height:r.height };
  }
  const groups = ['.nav-list', '.bottom-tabs', '.segment'];
  function selectionSnapshot() {
    return groups.map(selector => {
      const group = root.querySelector(selector);
      return { selector, box:rect(group?.querySelector('.ui-selection') || group?.querySelector('.active')) };
    });
  }
  function selections(before = []) {
    for (const selector of groups) {
      const group = root.querySelector(selector);
      const target = group?.querySelector('button.active');
      const box = rect(target), parent = rect(group);
      if (!box || !parent) continue;
      group.classList.add('ui-has-selection');
      let lens = group.querySelector('.ui-selection');
      if (!lens) {
        lens = document.createElement('span');
        lens.className = 'ui-selection'; lens.setAttribute('aria-hidden', 'true');
        group.prepend(lens);
      }
      Object.assign(lens.style, {
        left:`${box.x - parent.x - group.clientLeft}px`, top:`${box.y - parent.y - group.clientTop}px`,
        width:`${box.width}px`, height:`${box.height}px`
      });
      const old = before.find(item => item.selector === selector)?.box;
      if (!old || old.width <= 0 || old.height <= 0) continue;
      const dx = old.x - box.x, dy = old.y - box.y;
      if (Math.abs(dx) + Math.abs(dy) < .5) continue;
      spring(lens, p => ({transform:`translate(${dx*(1-p)}px,${dy*(1-p)}px) scale(${1+(old.width/box.width-1)*(1-p)},${1+(old.height/box.height-1)*(1-p)})`}), 360);
      spring(target.querySelector('.icon'), p => ({transform:`scale(${.88 + .12*p})`}), 280);
    }
  }
  function rowSnapshot() {
    const result = new Map();
    for (const el of root.querySelectorAll('.course-card,.list-row,.exam-card,.component-row')) {
      const item = el.matches('[data-id]') ? el : el.querySelector('[data-id]');
      const id = item?.dataset.id;
      const box = rect(el);
      if (id && box && box.y < innerHeight && box.y + box.height > 0) result.set(id, box);
    }
    return result;
  }
  function settleRows(before) {
    for (const el of root.querySelectorAll('.course-card,.list-row,.exam-card,.component-row')) {
      const item = el.matches('[data-id]') ? el : el.querySelector('[data-id]');
      const old = before.get(item?.dataset.id), box = rect(el);
      if (!old || !box) continue;
      const dy = old.y - box.y;
      if (Math.abs(dy) > 1 && Math.abs(dy) < innerHeight) spring(el, p => ({transform:`translateY(${dy*(1-p)}px)`}), 280);
    }
  }
  function scene(html) {
    if (html.includes('id="auth-form"')) return 'auth';
    if (html.includes('id="welcome-form"')) return 'welcome';
    return [state.view,state.courseId,state.view === 'schedule' ? [state.week,state.day,state.calendarView].join(':') : '',
      ['tasks','exams'].includes(state.view) ? [state.months[state.view],state.dateScope,state.courseFilter,state.statusFilter].join(':') : ''].join('/');
  }
  function render(html) {
    const before = selectionSnapshot();
    const rows = rowSnapshot();
    const focused = root.contains(document.activeElement) ? document.activeElement : null;
    const focusKey = focused?.dataset.action ? {action:focused.dataset.action,id:focused.dataset.id || ''} : null;
    const next = scene(html), changed = next !== previousScene;
    const first = !previousScene;
    previousScene = next;
    root.innerHTML = html;
    // Controls are usable immediately; animation never defers DOM updates.
    selections(before);
    if (focusKey) {
      const replacement = [...root.querySelectorAll('[data-action]')].find(el => el.dataset.action === focusKey.action && (el.dataset.id || '') === focusKey.id);
      replacement?.focus({preventScroll:true});
    }
    if (!changed) { settleRows(rows); return; }
    const panel = root.querySelector('#main') || root.querySelector('.welcome-panel');
    if (!panel || reduced()) return;
    const action = performance.now() - intent.at < 1200 ? intent.action : '';
    const direction = action.startsWith('previous-') ? -1 : action.startsWith('next-') ? 1 : 0;
    const dx = direction * 14, dy = direction ? 0 : first ? 10 : 6;
    spring(panel, p => ({opacity:Math.min(1,.55+p*.45),transform:`translate(${dx*(1-p)}px,${dy*(1-p)}px)`}), direction ? 240 : 300);
    if (first) play(root.querySelector('.welcome-intro'), [{opacity:0},{opacity:1}], 260, 'ease-out');
    const tiles = [...panel.querySelectorAll('.courses-grid>.course-card,.metrics>.card,.settings-grid>.card')].slice(0,8);
    tiles.forEach((tile,i) => {
      // Tiny stagger, never a blocking cinematic entrance.
      if (reduced() || !tile.animate) return;
      const anim = tile.animate([{opacity:.5,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:220,delay:i*14,easing:'cubic-bezier(.2,.75,.25,1)',fill:'both'});
      active.add(anim); anim.finished.then(() => {active.delete(anim);anim.cancel();}, () => active.delete(anim));
    });
    for (const circle of panel.querySelectorAll('.ring-fill')) {
      const target = circle.getAttribute('stroke-dasharray');
      if (parseFloat(target) > 0) play(circle,[{strokeDasharray:'0 207.345'},{strokeDasharray:target}],460,'cubic-bezier(.2,.75,.25,1)');
    }
  }
  let agendaSwipe = null;
  let suppressClickUntil = 0;
  function moveScheduleDay(delta) {
    const next = addDays(state.day, delta);
    state.day = next;
    state.week = weekStart(next, profile().weekStarts ?? 1);
    intent = {action:delta > 0 ? 'next-day-swipe' : 'previous-day-swipe',at:performance.now()};
    renderApp(true);
  }
  root.addEventListener('pointerdown', event => {
    if (!smallScreen.matches || state.view !== 'schedule' || event.button !== 0) return;
    const area = event.target.closest?.('.mobile-agenda');
    if (!area) return;
    agendaSwipe = {id:event.pointerId,startX:event.clientX,startY:event.clientY,
      lastX:event.clientX,lastY:event.clientY,area,horizontal:false};
  }, {passive:true});
  root.addEventListener('pointermove', event => {
    if (!agendaSwipe || event.pointerId !== agendaSwipe.id) return;
    const dx = event.clientX - agendaSwipe.startX;
    const dy = event.clientY - agendaSwipe.startY;
    agendaSwipe.lastX = event.clientX; agendaSwipe.lastY = event.clientY;
    if (!agendaSwipe.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { agendaSwipe = null; return; }
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.15) {
        agendaSwipe.horizontal = true;
        try { agendaSwipe.area.setPointerCapture(event.pointerId); } catch {}
      }
    }
    if (!agendaSwipe?.horizontal || reduced()) return;
    const offset = Math.max(-34, Math.min(34, dx * .18));
    agendaSwipe.area.style.transform = `translateX(${offset}px)`;
    agendaSwipe.area.style.opacity = String(1 - Math.min(.12, Math.abs(dx) / 900));
  }, {passive:true});
  function finishAgendaSwipe(event, cancelled = false) {
    if (!agendaSwipe || event.pointerId !== agendaSwipe.id) return;
    const swipe = agendaSwipe; agendaSwipe = null;
    swipe.area.style.removeProperty('transform'); swipe.area.style.removeProperty('opacity');
    if (cancelled || !swipe.horizontal) return;
    const dx = swipe.lastX - swipe.startX;
    const dy = swipe.lastY - swipe.startY;
    if (Math.abs(dx) < 48 || Math.abs(dx) <= Math.abs(dy) * 1.15) return;
    suppressClickUntil = performance.now() + 420;
    moveScheduleDay(dx < 0 ? 1 : -1);
  }
  root.addEventListener('pointerup', event => finishAgendaSwipe(event), {passive:true});
  root.addEventListener('pointercancel', event => finishAgendaSwipe(event, true), {passive:true});
  document.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil) {
      event.preventDefault(); event.stopImmediatePropagation(); return;
    }
    const target = event.target.closest?.('[data-action]');
    if (target) intent = {action:target.dataset.action,element:target,at:performance.now()};
  }, true);
  let resizeFrame;
  window.addEventListener('resize', () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => selections());
  }, {passive:true});

  function openSheet(dialog) {
    sheetController?.abort();
    sheetController = new AbortController();
    const signal = sheetController.signal;
    // showModal focuses an input; capture the actual invoking control via intent.
    sheetOpener = intent.element?.isConnected ? intent.element : null;
    const header = dialog.querySelector('.sheet-header');
    const grabber = document.createElement('span'); grabber.className='sheet-grabber'; grabber.setAttribute('aria-hidden','true');
    header?.prepend(grabber);
    const origin = rect(sheetOpener), panel = rect(dialog);
    if (origin && panel && !smallScreen.matches) dialog.style.setProperty('--sheet-origin', `${Math.max(0,Math.min(100,(origin.x+origin.width/2-panel.x)/panel.width*100))}% 65%`);
    if (!CSS.supports('transition-behavior','allow-discrete')) {
      spring(dialog, p => ({opacity:Math.min(1,.5+.5*p),transform:smallScreen.matches?`translateY(${(1-p)*70}px)`:`translateY(${(1-p)*12}px) scale(${.97+.03*p})`}),320);
    }
    let drag = null;
    const reset = () => { dialog.classList.remove('ui-dragging'); dialog.style.removeProperty('transform'); drag = null; };
    header?.addEventListener('pointerdown', event => {
      if (!smallScreen.matches || reduced() || event.button !== 0 || event.target.closest('button,a,input,select,textarea')) return;
      drag = {id:event.pointerId,start:event.clientY,last:event.clientY,time:event.timeStamp,dy:0,velocity:0};
      header.setPointerCapture(event.pointerId);
    }, {signal});
    header?.addEventListener('pointermove', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dy = Math.max(0,event.clientY-drag.start);
      drag.velocity = (event.clientY-drag.last) / Math.max(1,event.timeStamp-drag.time);
      drag.last=event.clientY;drag.time=event.timeStamp;drag.dy=dy;
      if (dy < 3) return;
      dialog.classList.add('ui-dragging');dialog.style.transform=`translateY(${dy*.85}px)`;
    }, {signal});
    header?.addEventListener('pointerup', event => {
      if (!drag || drag.id !== event.pointerId) return;
      const dismiss = drag.dy > 115 || drag.dy > 45 && drag.velocity > .65;
      if (dismiss) { if (!closeModal()) reset(); } else reset();
    }, {signal});
    header?.addEventListener('pointercancel', reset, {signal});
  }
  function closeSheet(dialog) {
    sheetController?.abort();sheetController=null;
    dialog.classList.remove('ui-dragging');dialog.style.removeProperty('transform');
    const opener = sheetOpener;
    requestAnimationFrame(() => {
      if (!dialog.open && opener?.isConnected) opener.focus({preventScroll:true});
    });
  }
  function feedback(element,error) {
    const symbol = element.querySelector('.icon');
    if (error) play(symbol,[{opacity:.4},{opacity:1}],160,'ease-out');
    else spring(symbol,p=>({transform:`scale(${.75+.25*p})`}),300);
  }
  return {preferences,render,openSheet,closeSheet,feedback};
})();
