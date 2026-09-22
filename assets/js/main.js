/* Local, dependency-free UI. All visual effects are progressive enhancements. */
(() => {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  let manualPause = false;
  try { manualPause = localStorage.getItem('jm-motion-paused') === 'true'; } catch { /* Private mode remains functional. */ }
  let paused = media.matches || manualPause;
  const motionButton = $('#motion-toggle');
  const motionSubscribers = new Set();
  function syncMotion() {
    paused = media.matches || manualPause;
    document.documentElement.classList.toggle('motion-paused', paused);
    if (motionButton) {
      motionButton.setAttribute('aria-pressed', String(paused));
      motionButton.textContent = paused ? (media.matches ? 'Reduced motion on' : '▶ Resume motion') : 'Ⅱ Pause motion';
      motionButton.disabled = media.matches;
      motionButton.title = media.matches ? 'Motion follows your device accessibility setting.' : '';
    }
    motionSubscribers.forEach(fn => fn());
  }
  motionButton?.addEventListener('click', () => {
    manualPause = !manualPause;
    try { localStorage.setItem('jm-motion-paused', String(manualPause)); } catch { /* Optional preference storage. */ }
    syncMotion();
  });
  media.addEventListener('change', syncMotion);
  syncMotion();
  $('#current-year').textContent = String(new Date().getFullYear());

  // Mobile navigation: Escape, outside click, link selection and resize all close it.
  const nav = $('#navigation');
  const menu = $('#menu-toggle');
  function closeMenu(returnFocus = false) {
    nav.classList.remove('is-open');
    menu.setAttribute('aria-expanded', 'false');
    menu.setAttribute('aria-label', 'Open menu');
    if (returnFocus) menu.focus();
  }
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    nav.classList.toggle('is-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  nav.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
  document.addEventListener('click', event => { if (!event.target.closest('.site-header')) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && nav.classList.contains('is-open')) closeMenu(true); });
  matchMedia('(min-width: 701px)').addEventListener('change', event => { if (event.matches) closeMenu(); });

  // One scroll callback per frame; no continuous layout polling.
  const header = $('#site-header');
  const progress = $('#scroll-progress');
  const navLinks = $$('a', nav);
  const sections = navLinks.map(link => $(link.getAttribute('href'))).filter(Boolean);
  let scrollQueued = false;
  function updateScroll() {
    scrollQueued = false;
    header.classList.toggle('scrolled', scrollY > 24);
    const range = document.documentElement.scrollHeight - innerHeight;
    progress.style.transform = 'scaleX(' + (range > 0 ? Math.min(1, scrollY / range) : 0) + ')';
    let current = '';
    sections.forEach(section => { if (section.getBoundingClientRect().top <= 180) current = section.id; });
    navLinks.forEach(link => {
      if (link.hash === '#' + current) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
  function queueScroll() { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(updateScroll); } }
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', queueScroll, { passive: true });
  updateScroll();

  // Visible HTML without JS; reveal is enabled only after a working observer exists.
  if ('IntersectionObserver' in window && !paused) {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) { entry.target.classList.add('in'); revealObserver.unobserve(entry.target); }
      });
    }, { threshold: 0.07 });
    $$('.reveal').forEach(el => revealObserver.observe(el));
    document.documentElement.classList.add('js-reveal');
  }

  const hero = $('.hero');
  const heroArt = $('#hero-art');
  let heroFrame = 0;
  let pointer = { x: 0, y: 0 };
  const paintHero = () => {
    heroFrame = 0;
    heroArt.style.setProperty('--px', pointer.x + 'px');
    heroArt.style.setProperty('--py', pointer.y + 'px');
  };
  hero.addEventListener('pointermove', event => {
    if (paused || !finePointer.matches || innerWidth <= 700) return;
    const rect = hero.getBoundingClientRect();
    pointer = { x: (event.clientX / rect.width - .5) * -15, y: ((event.clientY - rect.top) / rect.height - .5) * -10 };
    if (!heroFrame) heroFrame = requestAnimationFrame(paintHero);
  });
  hero.addEventListener('pointerleave', () => { pointer = { x: 0, y: 0 }; if (!heroFrame) heroFrame = requestAnimationFrame(paintHero); });
  $$('.tilt-surface').forEach(surface => {
    let frame = 0;
    let x = 0, y = 0;
    surface.addEventListener('pointermove', event => {
      if (paused || !finePointer.matches) return;
      const rect = surface.getBoundingClientRect();
      x = ((event.clientY - rect.top) / rect.height - .5) * -6;
      y = ((event.clientX - rect.left) / rect.width - .5) * 6;
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0; surface.style.setProperty('--tilt-x', x + 'deg'); surface.style.setProperty('--tilt-y', y + 'deg');
      });
    });
    surface.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame); frame = 0;
      surface.style.setProperty('--tilt-x', '0deg'); surface.style.setProperty('--tilt-y', '0deg');
    });
  });

  // Perspective-projected 3D torus: local Canvas, capped resolution, 30 fps.
  // Rendering stops offscreen, in hidden tabs, and when motion is paused.
  function initSculpture() {
    const canvas = $('#stack-sculpture');
    const stage = $('#sculpture-stage');
    const ctx = canvas?.getContext('2d');
    if (!ctx || !stage) return;
    let width = 0, height = 0, frame = 0, visible = false, previous = 0, angle = .5;
    const points = [];
    for (let u = 0; u < 54; u++) for (let v = 0; v < 14; v++) {
      const a = u / 54 * Math.PI * 2, b = v / 14 * Math.PI * 2;
      points.push({ x: (1 + .29 * Math.cos(b)) * Math.cos(a), y: (1 + .29 * Math.cos(b)) * Math.sin(a), z: .29 * Math.sin(b), u, v });
    }
    function draw() {
      if (!width || !height) return;
      ctx.clearRect(0, 0, width, height);
      const sin = Math.sin(angle), cos = Math.cos(angle), tilt = .8;
      const transformed = points.map(p => {
        const x = p.x * cos + p.z * sin;
        const z = -p.x * sin + p.z * cos;
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt);
        const zz = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const scale = 3.8 / (3.8 + zz);
        return { x: width / 2 + x * scale * Math.min(width, height) * .28, y: height * .44 + y * scale * Math.min(width, height) * .28, z: zz, scale };
      });
      transformed.forEach((p, index) => {
        const next = transformed[(index + 14) % points.length];
        const alpha = .12 + (1.6 - p.z) * .13;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(next.x, next.y);
        ctx.strokeStyle = 'rgba(204,143,202,' + alpha + ')'; ctx.lineWidth = .6; ctx.stroke();
      });
      transformed.filter((_, index) => index % 3 === 0).sort((a, b) => b.z - a.z).forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(.5, p.scale * .95), 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,179,214,' + (.35 + (1.5 - p.z) * .17) + ')'; ctx.fill();
      });
    }
    function animate(time) {
      frame = 0;
      if (!visible || paused || document.hidden) return;
      if (time - previous >= 32) {
        angle += Math.min(time - previous, 60) * .00023;
        previous = time; draw();
      }
      frame = requestAnimationFrame(animate);
    }
    function sync() {
      cancelAnimationFrame(frame); frame = 0; previous = performance.now();
      draw();
      if (visible && !paused && !document.hidden) frame = requestAnimationFrame(animate);
    }
    function resize() {
      width = stage.clientWidth; height = stage.clientHeight;
      const ratio = Math.min(devicePixelRatio || 1, 1.75);
      canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0); draw();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
    else addEventListener('resize', resize, { passive: true });
    if ('IntersectionObserver' in window) new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }).observe(stage);
    else visible = true;
    document.addEventListener('visibilitychange', sync);
    motionSubscribers.add(sync);
    resize(); sync();
  }
  initSculpture();

  // The backend advertises itself only when this page is served by server.mjs.
  // A static/file preview makes zero failing API calls.
  const form = $('#contact-form');
  const feedback = $('#form-feedback');
  const sendButton = $('#send-button');
  const fallback = $('#email-fallback');
  const recipient = 'jebastinmichealraj@gmail.com';
  const configuredBase = String(window.PORTFOLIO_CONFIG?.apiBase || '').replace(/\/$/, '');
  const injectedBase = $('meta[name="portfolio-api-base"]')?.content;
  const base = configuredBase || (injectedBase === 'same-origin' ? location.origin : '');
  let sending = false;
  async function apiStatus() {
    if (!base || !/^https?:\/\//i.test(base)) return false;
    try {
      const response = await fetch(base + '/api/contact/status', { signal: AbortSignal.timeout(6000), credentials: 'omit' });
      if (!response.ok) return false;
      return (await response.json()).configured === true;
    } catch { return false; }
  }
  const ready = apiStatus();
  const messages = { name: 'Enter your name (2–80 characters).', email: 'Enter a valid email address.', subject: 'Choose a topic.', message: 'Write a message of 10–5000 characters.' };
  const fields = ['name', 'email', 'subject', 'message'];
  function validate(id) {
    const field = $('#' + id, form);
    const value = field.value.trim();
    let valid = field.checkValidity() && value.length > 0;
    if (id === 'name') valid = valid && value.length >= 2 && !/[\r\n]/.test(value);
    if (id === 'email') valid = valid && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    if (id === 'message') valid = valid && value.length >= 10;
    field.setAttribute('aria-invalid', String(!valid));
    $('#' + id + '-error').textContent = valid ? '' : messages[id];
    return valid;
  }
  fields.forEach(id => {
    const field = $('#' + id, form);
    field.addEventListener('input', () => { if (field.hasAttribute('aria-invalid')) validate(id); });
    field.addEventListener('blur', () => { if (field.value || field.hasAttribute('aria-invalid')) validate(id); });
  });
  $('#message').addEventListener('input', event => { $('#message-count').textContent = event.target.value.length + ' / 5000'; });
  function status(text, state) { feedback.textContent = text; feedback.dataset.state = state; }
  function prepareFallback(data) {
    const body = 'Name: ' + data.name + '\nEmail: ' + data.email + '\n\n' + data.message;
    fallback.href = 'mailto:' + recipient + '?subject=' + encodeURIComponent('[Portfolio] ' + data.subject) + '&body=' + encodeURIComponent(body);
    fallback.hidden = false;
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (sending) return;
    const invalid = fields.filter(id => !validate(id));
    if (invalid.length) { status('Please check the highlighted fields.', 'error'); $('#' + invalid[0], form).focus(); return; }
    const data = Object.fromEntries(new FormData(form));
    for (const id of fields) data[id] = data[id].trim();
    prepareFallback(data); fallback.hidden = true;
    sending = true; sendButton.disabled = true; sendButton.textContent = 'Sending…';
    form.setAttribute('aria-busy', 'true'); status('Sending your message…', 'pending');
    try {
      if (!(await ready)) {
        status('The contact form is temporarily unavailable. Your message is still here; you can send it using the email link below.', 'error');
        fallback.hidden = false; return;
      }
      const response = await fetch(base + '/api/contact', {
        method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data), signal: AbortSignal.timeout(40000)
      });
      let result;
      try { result = await response.json(); } catch { throw new Error('Unconfirmed response'); }
      if (!response.ok || result.ok !== true || result.delivery !== 'accepted') {
        status(typeof result.message === 'string' ? result.message : 'Your message could not be sent. Please try again later or use the email link below.', 'error');
        fallback.hidden = false; return;
      }
      status('Your message has been sent to Jebastin. Thank you for reaching out!', 'success');
      form.reset(); fields.forEach(id => { $('#' + id).removeAttribute('aria-invalid'); $('#' + id + '-error').textContent = ''; });
      $('#message-count').textContent = '0 / 5000'; fallback.hidden = true;
    } catch {
      status('I could not confirm whether your message was sent. Your message is still here. Please wait before retrying, or use the email link below.', 'error');
      fallback.hidden = false;
    } finally {
      sending = false; sendButton.disabled = false; sendButton.textContent = 'Send message ↗';
      form.removeAttribute('aria-busy'); feedback.focus({ preventScroll: true });
    }
  });
})();
