(() => {
  'use strict';

  const init = () => {
    const shell = document.getElementById('page-shell');
    const sidebar = document.querySelector('.profile-sidebar');
    const readingColumn = document.querySelector('.reading-column');
    const track = document.getElementById('companion-track');
    const button = document.getElementById('companion');
    const caption = document.getElementById('companion-caption');
    const motionButton = document.getElementById('companion-motion');
    if (!shell || !track || !button) return;

    button.innerHTML = '<img class="robot-fallback" src="static/assets/robot-rover.svg?v=20261012-binocular-2" alt="" width="206" height="223">';
    track.removeAttribute('aria-hidden');
    if (!track.hasAttribute('role')) track.setAttribute('role', 'complementary');
    if (!track.hasAttribute('aria-label')) track.setAttribute('aria-label', 'ADAM, research companion');

    const desktop = window.matchMedia('(min-width: 701px)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const storageKey = 'bingzhou-adam-motion-paused';
    let paused = false;
    try { paused = window.localStorage.getItem(storageKey) === 'true'; } catch { /* Storage is optional. */ }

    const sectionIds = ['about', 'publications', 'experience', 'education', 'awards', 'hobbies'];
    const sections = sectionIds.map(id => document.getElementById(id)).filter(Boolean);
    const sectionCaptions = {
      about: 'Hello, I’m ADAM. A little curiosity goes a long way.',
      publications: 'A few papers, and plenty of open questions.',
      experience: 'cPilot: taking agents from research to the desktop.',
      education: 'Good questions begin with strong foundations.',
      awards: 'A few milestones along the way.',
      hobbies: 'Piano, badminton, and a round of CS2 or VALORANT.'
    };
    const thoughts = [
      'Fewer tokens. More room for new ideas.',
      'A reliable agent learns from what went wrong.',
      'My human also makes time for the piano.',
      'Small robot. Plenty of research questions.'
    ];
    const gestures = ['HeadTilt', 'Happy', 'LookAround', 'Jump', 'HeadTilt', 'Wave', 'Wiggle', 'Spin'];

    let ready = false;
    let activeSection = sections[0] || shell;
    let pointerPaper = null;
    let focusPaper = null;
    let thoughtIndex = 0;
    let position = null;
    let travel = null;
    let travelFrame = 0;
    let layoutFrame = 0;
    let roamTimer = 0;
    let gestureTimer = 0;
    let talkingTimer = 0;
    let talkingUntil = 0;
    let interactionUntil = 0;
    let actionUntil = 0;
    let pointerBusy = false;
    let guideTarget = null;
    let guideUntil = 0;
    let hasRoamed = false;

    const random = (min, max) => min + Math.random() * (max - min);
    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
    const canAnimate = () => ready && !paused && !reducedMotion.matches && !document.hidden;
    const currentPaper = () => {
      if (focusPaper?.hidden) focusPaper = null;
      if (pointerPaper?.hidden) pointerPaper = null;
      return focusPaper || pointerPaper;
    };

    const setCaption = (text, announce = true) => {
      if (!caption) return;
      caption.setAttribute('aria-live', announce ? 'polite' : 'off');
      if (caption.textContent !== text) caption.textContent = text;
    };
    const setGait = gait => {
      if (track.dataset.gait !== gait) track.dataset.gait = gait;
    };
    const setFacing = yaw => {
      const value = String(Math.round(yaw * 1000) / 1000);
      if (track.dataset.facing !== value) track.dataset.facing = value;
    };
    const applyPosition = point => {
      position = point;
      track.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0)`;
    };

    const laneTop = () => {
      const sidebarRect = sidebar?.getBoundingClientRect();
      const profileVisible = sidebarRect && sidebarRect.bottom > 0 && sidebarRect.top < window.innerHeight;
      return Math.max(70, profileVisible ? sidebarRect.bottom + 16 : 70);
    };
    const safeBounds = () => {
      const shellRect = shell.getBoundingClientRect();
      const width = track.offsetWidth || 194;
      const height = track.offsetHeight || 270;
      const mainLeft = readingColumn?.getBoundingClientRect().left ?? shellRect.left + 240;
      const minX = Math.max(8, shellRect.left - 70);
      const maxX = Math.min(shellRect.left + 14, mainLeft - width - 20, window.innerWidth - width - 12);
      const maxY = window.innerHeight - height - 16;
      const minY = laneTop();
      if (maxX < minX || maxY < minY) return null;
      return { minX, maxX, minY, maxY };
    };
    const clampPoint = (point, bounds) => ({
      x: clamp(point.x, bounds.minX, bounds.maxX),
      y: clamp(point.y, bounds.minY, bounds.maxY)
    });
    const canRoam = () => canAnimate() && desktop.matches && track.classList.contains('is-roaming');

    const stopTravel = () => {
      window.cancelAnimationFrame(travelFrame);
      travelFrame = 0;
      travel = null;
      track.classList.remove('is-moving');
      setGait('idle');
      setFacing(0);
    };
    const stopSchedules = () => {
      window.clearTimeout(roamTimer);
      window.clearTimeout(gestureTimer);
      roamTimer = gestureTimer = 0;
    };
    const showAction = name => {
      if (!canAnimate()) return;
      actionUntil = performance.now() + 2600;
      track.dispatchEvent(new CustomEvent('companion:action', { detail: { name } }));
    };
    const targetPoint = (target, bounds) => ({
      x: clamp(position?.x ?? (bounds.minX + bounds.maxX) / 2, bounds.minX, bounds.maxX),
      y: clamp(target.getBoundingClientRect().top + 12, bounds.minY, bounds.maxY)
    });

    const stepTravel = time => {
      travelFrame = 0;
      if (!travel || !canRoam()) { stopTravel(); return; }
      const bounds = safeBounds();
      if (!bounds) { refreshLayout(); return; }
      const destination = travel.target ? targetPoint(travel.target, bounds) : clampPoint(travel.to, bounds);
      const progress = clamp((time - travel.started) / travel.duration, 0, 1);
      const smooth = progress * .75 + progress * progress * (3 - 2 * progress) * .25;
      const next = clampPoint({
        x: travel.from.x + (destination.x - travel.from.x) * smooth,
        y: travel.from.y + (destination.y - travel.from.y) * smooth
      }, bounds);
      const dx = next.x - position.x;
      const dy = next.y - position.y;
      if (Math.hypot(dx, dy) > .5) setFacing(Math.atan2(dx, dy));
      applyPosition(next);
      if (progress < 1) travelFrame = window.requestAnimationFrame(stepTravel);
      else stopTravel();
    };
    const startTravel = (destination, { target = null, run = false } = {}) => {
      if (!canRoam() || !position) return;
      const bounds = safeBounds();
      if (!bounds) return;
      const to = target ? targetPoint(target, bounds) : clampPoint(destination, bounds);
      const from = clampPoint(position, bounds);
      const distance = Math.hypot(to.x - from.x, to.y - from.y);
      stopTravel();
      applyPosition(from);
      if (distance < 8) return;
      const gait = run && distance > 80 ? 'running' : 'walking';
      const duration = clamp(distance / (gait === 'running' ? 235 : 80) * 1000, run ? 650 : 420, 2200);
      travel = { from, to, target, duration, started: performance.now() };
      setGait(gait);
      setFacing(Math.atan2(to.x - from.x, to.y - from.y));
      track.classList.add('is-moving');
      travelFrame = window.requestAnimationFrame(stepTravel);
    };

    const mayWander = () => canRoam() && !travel && !pointerBusy && !currentPaper() &&
      performance.now() > Math.max(interactionUntil, actionUntil);
    const scheduleRoam = (delay = hasRoamed ? random(4500, 7500) : 3200) => {
      if (roamTimer || !canRoam()) return;
      roamTimer = window.setTimeout(() => {
        roamTimer = 0;
        if (mayWander() && position) {
          const bounds = safeBounds();
          if (bounds) {
            // Choose the farther end of the available lane, even when short.
            const x = position.x < (bounds.minX + bounds.maxX) / 2 ? bounds.maxX : bounds.minX;
            const y = position.y < (bounds.minY + bounds.maxY) / 2 ? bounds.maxY : bounds.minY;
            startTravel({ x, y });
            hasRoamed = true;
          }
        }
        scheduleRoam(travel ? undefined : 1200);
      }, delay);
    };
    const scheduleGesture = () => {
      if (gestureTimer || !canRoam()) return;
      gestureTimer = window.setTimeout(() => {
        gestureTimer = 0;
        if (mayWander()) showAction(gestures[Math.floor(Math.random() * gestures.length)]);
        scheduleGesture();
      }, random(5000, 9000));
    };

    function refreshLayout() {
      if (sidebar) {
        shell.style.setProperty('--companion-top', `${sidebar.offsetTop + sidebar.offsetHeight + 24}px`);
      }
      const eligible = ready && desktop.matches;
      track.classList.toggle('is-roaming', eligible);
      if (eligible) {
        const width = window.innerWidth > 1000 ? 194 : 145;
        track.style.setProperty('--companion-width', `${width}px`);
        const overhead = Math.max(60, track.offsetHeight - button.offsetHeight);
        const availableHeight = window.innerHeight - laneTop() - 16;
        const size = Math.max(96, Math.min(width, Math.floor((availableHeight - overhead - 56) * 206 / 223)));
        track.style.setProperty('--companion-size', `${size}px`);
      }
      const bounds = eligible ? safeBounds() : null;
      const roaming = Boolean(bounds);
      track.classList.toggle('is-roaming', roaming);
      if (!roaming) {
        stopTravel();
        stopSchedules();
        track.style.transform = '';
        position = null;
        return;
      }
      if (!position) {
        applyPosition({ x: (bounds.minX + bounds.maxX) / 2, y: Math.min(bounds.maxY, bounds.minY + 20) });
      } else {
        const safe = clampPoint(position, bounds);
        if (safe.x !== position.x || safe.y !== position.y) applyPosition(safe);
      }
      if (canRoam()) {
        scheduleRoam();
        scheduleGesture();
      }
    }

    const syncPaper = (announce = true, move = false) => {
      const paper = currentPaper();
      track.classList.toggle('is-reading', Boolean(paper) && !paused);
      if (paused) { setCaption('Taking a break.', announce); return; }
      if (performance.now() >= talkingUntil) {
        setCaption(paper?.dataset.companion || sectionCaptions[activeSection.id] || sectionCaptions.about, announce);
      }
      if (move && canRoam()) {
        const target = paper || activeSection;
        startTravel(null, { target, run: true });
      }
    };

    const syncMotion = (announce = false) => {
      track.classList.toggle('is-paused', paused);
      track.classList.toggle('is-reduced-motion', reducedMotion.matches);
      if (motionButton) {
        motionButton.setAttribute('aria-pressed', String(paused));
        motionButton.textContent = paused ? 'resume ADAM' : 'pause ADAM';
        motionButton.setAttribute('aria-label', paused ? 'Resume ADAM’s motion' : 'Pause ADAM’s motion');
      }
      if (!canAnimate()) {
        stopTravel();
        stopSchedules();
        window.clearTimeout(talkingTimer);
        talkingTimer = 0;
        talkingUntil = 0;
        track.classList.remove('is-talking');
      }
      refreshLayout();
      syncPaper(announce);
    };

    const updateViewport = () => {
      layoutFrame = 0;
      refreshLayout();
      let next = sections[0] || shell;
      if (guideTarget && performance.now() < guideUntil) next = guideTarget;
      else {
        guideTarget = null;
        sections.forEach(section => {
          if (section.getBoundingClientRect().top <= window.innerHeight * .25) next = section;
        });
      }
      const changed = next !== activeSection;
      activeSection = next;
      syncPaper(false);
      if (changed && canRoam() && !currentPaper() && !travel && !pointerBusy && performance.now() > actionUntil) {
        startTravel(null, { target: activeSection });
      }
    };
    const queueViewport = () => {
      if (layoutFrame || document.hidden) return;
      layoutFrame = window.requestAnimationFrame(updateViewport);
    };

    button.addEventListener('click', () => {
      stopTravel();
      interactionUntil = performance.now() + 7000;
      window.clearTimeout(talkingTimer);
      talkingUntil = performance.now() + 4000;
      track.classList.add('is-talking');
      talkingTimer = window.setTimeout(() => {
        talkingTimer = 0;
        talkingUntil = 0;
        track.classList.remove('is-talking');
        syncPaper(false);
      }, 4000);
      if (paused) setCaption('Taking a break. Choose “resume ADAM” to explore again.');
      else {
        setCaption(thoughts[thoughtIndex]);
        thoughtIndex = (thoughtIndex + 1) % thoughts.length;
        showAction(Math.random() < .7 ? 'Wave' : 'Jump');
      }
    });
    button.addEventListener('pointerdown', () => {
      pointerBusy = true;
      interactionUntil = performance.now() + 7000;
      stopTravel();
    });
    const endPointer = () => { pointerBusy = false; interactionUntil = performance.now() + 5000; };
    window.addEventListener('pointerup', endPointer);
    window.addEventListener('pointercancel', endPointer);
    button.addEventListener('keydown', event => {
      if (['ArrowLeft', 'ArrowRight', 'Home'].includes(event.key)) {
        interactionUntil = performance.now() + 7000;
        stopTravel();
      }
    });
    motionButton?.addEventListener('click', () => {
      paused = !paused;
      try { window.localStorage.setItem(storageKey, String(paused)); } catch { /* Storage is optional. */ }
      syncMotion(true);
      if (!paused) setCaption('Back to exploring.');
    });

    document.querySelectorAll('.publication[data-companion]').forEach(paper => {
      const read = () => {
        interactionUntil = performance.now() + 5000;
        talkingUntil = 0;
        syncPaper(true, true);
      };
      paper.addEventListener('pointerenter', event => {
        if (event.pointerType === 'touch') return;
        pointerPaper = paper;
        read();
      });
      paper.addEventListener('pointerleave', () => {
        if (pointerPaper === paper) pointerPaper = null;
        syncPaper(false);
      });
      paper.addEventListener('focusin', () => { focusPaper = paper; read(); });
      paper.addEventListener('focusout', event => {
        if (event.relatedTarget && paper.contains(event.relatedTarget)) return;
        if (focusPaper === paper) focusPaper = null;
        syncPaper(false);
      });
    });
    document.querySelectorAll('[data-guide-target]').forEach(link => {
      link.addEventListener('click', () => {
        const target = document.getElementById((link.dataset.guideTarget || '').replace(/^#/, ''));
        if (!target) return;
        activeSection = guideTarget = target;
        guideUntil = performance.now() + 1700;
        interactionUntil = performance.now() + 6000;
        talkingUntil = 0;
        syncPaper(true, true);
        queueViewport();
      });
    });

    const watchMedia = media => {
      if (media.addEventListener) media.addEventListener('change', () => syncMotion());
      else media.addListener(() => syncMotion());
    };
    watchMedia(desktop);
    watchMedia(reducedMotion);
    window.addEventListener('scroll', queueViewport, { passive: true });
    window.addEventListener('resize', queueViewport, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        window.cancelAnimationFrame(layoutFrame);
        layoutFrame = 0;
        pointerBusy = false;
      }
      syncMotion();
    });
    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(queueViewport);
      observer.observe(shell);
      observer.observe(track);
    }
    document.fonts?.ready.then(queueViewport);

    track.addEventListener('companion:ready', () => {
      ready = true;
      syncMotion();
      showAction('Wave');
    });
    if ('MutationObserver' in window) {
      const rendererState = new MutationObserver(() => {
        if (button.dataset.renderer === 'fallback') {
          ready = false;
          syncMotion();
        }
      });
      rendererState.observe(button, { attributes: true, attributeFilter: ['data-renderer'] });
    }
    window.addEventListener('pagehide', () => {
      stopTravel();
      stopSchedules();
      window.cancelAnimationFrame(layoutFrame);
      layoutFrame = 0;
      window.clearTimeout(talkingTimer);
      talkingTimer = 0;
      talkingUntil = 0;
      track.classList.remove('is-talking');
    });
    window.addEventListener('pageshow', event => { if (event.persisted) syncMotion(); });

    setGait('idle');
    setFacing(0);
    syncMotion();
    import('./robot-renderer.js?v=20261012-binocular-2').then(({ mountRobot }) => {
      return mountRobot(button, track);
    }).catch(() => {
      ready = false;
      button.dataset.renderer = 'fallback';
      button.querySelector('canvas')?.remove();
      syncMotion();
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
