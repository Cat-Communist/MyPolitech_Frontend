/* Сборка фона, метрики сцены и переключение экранов.
   Экраны монтируются из <template> в index.html и при уходе удаляются из DOM —
   поэтому анимация появления (pp-in) проигрывается заново при каждом входе. */

window.Screens = (function () {
  'use strict';

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var current = null;
  var layer1 = null;   /* сетка и столбцы кода — ближний слой параллакса */
  var layer2 = null;   /* схемные дорожки — дальний слой */

  /* ---------- подстановка текстов и картинок из config.js ---------- */

  function fill(root) {
    var T = window.CONFIG.texts;
    var IMG = window.CONFIG.images;

    root.querySelectorAll('[data-text]').forEach(function (el) {
      el.textContent = T[el.dataset.text] || '';
    });

    root.querySelectorAll('[data-img]').forEach(function (el) {
      el.src = IMG[el.dataset.img];
      if (el.dataset.alt) el.alt = T[el.dataset.alt] || '';
    });
  }

  /* ---------------------- метрики сцены ---------------------- */

  /* Сцена имеет фиксированный размер и целиком масштабируется под окно.
     Ниже те же числа, что были в исходной версии. */
  function applyLayout() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var portrait = vw / vh < 0.85;

    var W = portrait ? 900 : 1600;
    var H = portrait ? 1600 : 900;
    /* На совсем маленьких окнах поля не оставляем, иначе ужимаем на 4%. */
    var scale = Math.min(vw / W, vh / H) * (vw < 700 || vh < 500 ? 1 : 0.96);

    var s = document.documentElement.style;
    s.setProperty('--stage-w', W + 'px');
    s.setProperty('--stage-h', H + 'px');
    s.setProperty('--stage-scale', String(scale));
    s.setProperty('--modes-dir', portrait ? 'column' : 'row');
    s.setProperty('--mode-w', portrait ? '760px' : '680px');
    s.setProperty('--mark-h', portrait ? '220px' : '150px');
    s.setProperty('--title-size', portrait ? '76px' : '78px');
    s.setProperty('--menu-gap', portrait ? '40px' : '28px');
    s.setProperty('--foot-w', portrait ? '600px' : '340px');
  }

  /* --------------------------- фон ---------------------------
     Фон детерминированный: тот же линейный конгруэнтный генератор
     с зерном 11, что и в исходной версии, и тот же порядок вызовов,
     поэтому расположение столбцов, их содержимое и тайминги совпадают. */

  function buildBackground() {
    var bg = document.getElementById('bg');
    if (!bg || bg.childElementCount) return;

    var seed = 11;
    var rnd = function () {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    /* 40 строк, в каждой от 1 до 3 символов «0»/«1». */
    var colText = function () {
      return Array.from({ length: 40 }, function () {
        return Array.from({ length: 1 + Math.floor(rnd() * 3) }, function () {
          return rnd() > 0.5 ? '1' : '0';
        }).join('');
      }).join('\n');
    };

    /* --- столбцы кода --- */
    var code = document.createElement('div');
    code.className = 'bg__code';

    [3, 9, 16, 84, 91, 97].forEach(function (x) {
      var txt = colText();
      var dur = 60 + rnd() * 50;
      var delay = -rnd() * dur;

      var col = document.createElement('div');
      col.className = 'bg__col';
      col.style.left = x + '%';
      col.style.animation = 'pp-code ' + dur + 's linear ' + delay + 's infinite';
      /* Текст продублирован — вместе с pp-code даёт бесшовную прокрутку. */
      col.textContent = txt + '\n' + txt;
      code.appendChild(col);
    });

    /* --- схемные дорожки --- */
    function trace(svg, d, k) {
      var base = document.createElementNS(SVG_NS, 'path');
      base.setAttribute('d', d);
      base.setAttribute('class', 'bg__trace');
      svg.appendChild(base);

      var pulse = document.createElementNS(SVG_NS, 'path');
      pulse.setAttribute('d', d);
      pulse.setAttribute('class', 'bg__trace-pulse');
      pulse.style.animation =
        'pp-trace ' + (9 + k * 2) + 's linear ' + (-k * 3) + 's infinite';
      svg.appendChild(pulse);
    }

    function node(svg, x, y) {
      var c = document.createElementNS(SVG_NS, 'circle');
      c.setAttribute('cx', x);
      c.setAttribute('cy', y);
      c.setAttribute('r', '4');
      c.setAttribute('class', 'bg__node');
      svg.appendChild(c);
    }

    function circuit(modifier, parts) {
      var svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('width', '560');
      svg.setAttribute('height', '380');
      svg.setAttribute('viewBox', '0 0 560 380');
      svg.setAttribute('class', 'bg__circuit bg__circuit--' + modifier);
      parts.forEach(function (p) {
        trace(svg, p.d, p.k);
        node(svg, p.x, p.y);
      });
      return svg;
    }

    var circuitTL = circuit('tl', [
      { d: 'M0 90 H180 L230 140 H420', k: 0, x: 420, y: 140 },
      { d: 'M0 150 H120 L200 230 H300 L340 270', k: 1, x: 340, y: 270 },
      { d: 'M120 0 V50 L160 90', k: 2, x: 160, y: 90 },
    ]);

    var circuitBR = circuit('br', [
      { d: 'M560 290 H380 L330 240 H140', k: 3, x: 140, y: 240 },
      { d: 'M560 230 H440 L360 150 H260 L220 110', k: 4, x: 220, y: 110 },
      { d: 'M440 380 V330 L400 290', k: 5, x: 400, y: 290 },
    ]);

    /* --- сборка слоёв --- */
    layer1 = document.createElement('div');
    layer1.className = 'bg__layer';
    var gridSm = document.createElement('div');
    gridSm.className = 'bg__grid bg__grid--sm';
    var gridLg = document.createElement('div');
    gridLg.className = 'bg__grid bg__grid--lg';
    layer1.append(gridSm, gridLg, code);

    layer2 = document.createElement('div');
    layer2.className = 'bg__layer';
    layer2.append(circuitTL, circuitBR);

    var vignette = document.createElement('div');
    vignette.className = 'bg__vignette';

    bg.append(layer1, layer2, vignette);
  }

  /* Смещение слоёв за курсором. nx и ny — от -0.5 до 0.5. */
  function parallax(nx, ny) {
    if (layer1) layer1.style.transform = 'translate(' + nx * -14 + 'px, ' + ny * -10 + 'px)';
    if (layer2) layer2.style.transform = 'translate(' + nx * -30 + 'px, ' + ny * -20 + 'px)';
  }

  /* ---------------------- экраны ---------------------- */

  function mount(slotId, tplId) {
    var slot = document.getElementById(slotId);
    slot.replaceChildren();
    if (!tplId) return null;
    var frag = document.getElementById(tplId).content.cloneNode(true);
    fill(frag);
    slot.appendChild(frag);
    return slot;
  }

  function show(name, mode) {
    current = name;
    mount('screen-slot', 'tpl-' + name);

    if (name === 'stub') {
      var T = window.CONFIG.texts;
      /* Неизвестный режим — показываем выпускников, как в исходнике. */
      var key = (mode === 'applicants') ? 'applicants' : 'alumni';
      document.getElementById('stub-badge').textContent = T[key + 'Title'];
      document.getElementById('stub-text').textContent = 'Здесь будет ' + T[key + 'Soon'];
    }

    /* Кнопки в углу появляются после загрузки и дальше висят постоянно. */
    if (name !== 'loading' && !document.getElementById('corner')) {
      mount('corner-slot', 'tpl-corner');
    }
  }

  function setProgress(value) {
    var pct = Math.round(value * 100);
    document.documentElement.style.setProperty('--progress', pct + '%');
    var label = document.getElementById('progress-label');
    if (label) label.textContent = String(pct).padStart(3, '0') + '%';
  }

  function setSound(on) {
    var corner = document.getElementById('corner');
    if (!corner) return;
    corner.dataset.sound = on ? 'on' : 'off';
    document.getElementById('btn-sound').setAttribute('aria-pressed', String(on));
    document.getElementById('sound-label').textContent =
      on ? window.CONFIG.texts.soundOn : window.CONFIG.texts.soundOff;
  }

  function openAbout() { mount('modal-slot', 'tpl-about'); }
  function closeAbout() { mount('modal-slot', null); }
  function isAboutOpen() { return !!document.getElementById('about-overlay'); }

  return {
    applyLayout: applyLayout,
    buildBackground: buildBackground,
    parallax: parallax,
    show: show,
    currentScreen: function () { return current; },
    setProgress: setProgress,
    setSound: setSound,
    openAbout: openAbout,
    closeAbout: closeAbout,
    isAboutOpen: isAboutOpen,
  };
})();
