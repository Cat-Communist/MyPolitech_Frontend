/* Запуск: экран загрузки, звук и обработка всех действий пользователя. */

(function () {
  'use strict';

  var CONFIG = window.CONFIG;
  var S = window.Screens;

  var sound = false;
  var audio = null;      /* AudioContext создаётся при первом звуке */
  var raf = 0;
  var timer = 0;

  /* ------------------------- звук -------------------------
     Короткий писк на осцилляторе — отдельных звуковых файлов нет. */

  function blip(freq, dur, type, vol) {
    if (!sound) return;
    freq = (freq === undefined) ? 660 : freq;
    dur = (dur === undefined) ? 0.06 : dur;
    type = type || 'sine';
    vol = (vol === undefined) ? 0.06 : vol;

    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      var o = audio.createOscillator();
      var g = audio.createGain();
      var t = audio.currentTime;

      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.05);

      o.connect(g).connect(audio.destination);
      o.start(t);
      o.stop(t + dur + 0.06);
    } catch (e) {
      /* Звук — необязательная часть, молча игнорируем отказ браузера. */
    }
  }

  /* ------------------------ действия ------------------------ */

  /* Обёртка над Screens.show: после монтирования кнопок в углу
     нужно проставить актуальную подпись звука. */
  function show(name, mode) {
    S.show(name, mode);
    S.setSound(sound);
  }

  function goMenu() {
    blip(440);
    show('menu');
  }

  function openMode(mode) {
    blip(880, 0.1);
    show('stub', mode);
  }

  function toggleSound() {
    sound = !sound;
    S.setSound(sound);
    /* Писк звучит только при включении: при выключении sound уже false. */
    blip(760, 0.08);
  }

  function openAbout() {
    blip(700);
    S.openAbout();
  }

  function closeAbout() {
    blip(440);
    S.closeAbout();
  }

  function hover() {
    blip(620, 0.04, 'sine', 0.03);
  }

  /* ------------------------ события ------------------------
     Делегирование на document: экраны монтируются и удаляются,
     поэтому вешать обработчики на конкретные кнопки нельзя. */

  document.addEventListener('click', function (e) {
    var el = e.target;
    if (!el.closest) return;

    var mode = el.closest('.mode');
    if (mode) { openMode(mode.dataset.mode); return; }

    if (el.closest('#btn-back')) { goMenu(); return; }
    if (el.closest('#btn-about')) { openAbout(); return; }
    if (el.closest('#btn-sound')) { toggleSound(); return; }
    if (el.closest('#btn-about-ok')) { closeAbout(); return; }

    /* Клик по затемнению закрывает диалог, по самому окну — нет. */
    if (el.closest('#about-overlay') && !el.closest('#about-dialog')) {
      closeAbout();
    }
  });

  /* mouseover всплывает, в отличие от mouseenter, поэтому отсеиваем
     перемещения внутри самой кнопки — иначе писк повторялся бы. */
  var HOVER_SELECTOR = '.mode, #btn-back, #btn-about, #btn-about-ok';
  document.addEventListener('mouseover', function (e) {
    if (!e.target.closest) return;
    var el = e.target.closest(HOVER_SELECTOR);
    if (!el) return;
    if (e.relatedTarget && el.contains(e.relatedTarget)) return;
    hover();
  });

  window.addEventListener('resize', function () {
    S.applyLayout();
  });

  window.addEventListener('pointermove', function (e) {
    var nx = e.clientX / window.innerWidth - 0.5;
    var ny = e.clientY / window.innerHeight - 0.5;
    S.parallax(nx, ny);
  });

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    if (S.isAboutOpen()) closeAbout();
    else if (S.currentScreen() === 'stub') goMenu();
  });

  /* ------------------------ загрузка ------------------------ */

  function preload() {
    Object.keys(CONFIG.images).forEach(function (key) {
      var img = new Image();
      img.src = CONFIG.images[key];
    });
  }

  function startLoader() {
    var t0 = performance.now();

    function tick(t) {
      var p = Math.min(1, (t - t0) / CONFIG.loaderMs);
      /* Замедление к концу — та же кривая, что в исходной версии. */
      S.setProgress(1 - Math.pow(1 - p, 2.2));

      if (p < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        timer = setTimeout(function () { show('menu'); }, 250);
      }
    }

    raf = requestAnimationFrame(tick);
  }

  window.addEventListener('beforeunload', function () {
    cancelAnimationFrame(raf);
    clearTimeout(timer);
  });

  /* --------------------------- старт --------------------------- */

  S.applyLayout();
  S.buildBackground();
  show('loading');
  S.setProgress(0);
  preload();
  startLoader();
})();
