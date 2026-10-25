/* Галерея выпускников: шкала лет и альбом с перелистыванием. Данные — js/data/gallery.js. */

window.Gallery = (function () {
  'use strict';

  var WIN = 9;          /* сколько лет помещается на шкале */
  var FLIP_MS = 820;
  var PER_PAGE = 3;     /* фото на обычной странице; на титульной — одно */

  var T = window.CONFIG.texts;

  var years = [];       /* { year, photos, pages, spreads } по возрастанию года */
  var spreads = [];     /* все развороты альбома подряд: { y, k, n } */

  var root = null;
  var hooks = {};
  var cur = 0;          /* индекс текущего разворота */
  var dir = 0;          /* направление идущего перелистывания, 0 — не листаем */
  var win = 0;          /* первый год, видимый на шкале */
  var timer = null;

  function pad(n) { return String(n).padStart(2, '0'); }

  function plural(n, forms) {
    var a = n % 100;
    var b = n % 10;
    if (a > 10 && a < 20) return forms[2];
    if (b === 1) return forms[0];
    if (b > 1 && b < 5) return forms[1];
    return forms[2];
  }

  /* Раскладка по страницам: титульная с первым фото, дальше по PER_PAGE фото на страницу. */
  function build() {
    years = window.GALLERY_DATA.slice().sort(function (a, b) { return a.year - b.year; })
      .map(function (y) {
        var pages = [{ title: true, start: 0 }];
        for (var i = 1; i < y.photos.length; i += PER_PAGE) pages.push({ start: i });
        return { year: y.year, photos: y.photos, pages: pages, spreads: Math.ceil(pages.length / 2) };
      });

    spreads = [];
    years.forEach(function (y, yi) {
      for (var k = 0; k < y.spreads; k++) spreads.push({ y: yi, k: k, n: y.spreads });
    });
  }

  function firstSpreadOf(yi) {
    for (var i = 0; i < spreads.length; i++) if (spreads[i].y === yi) return i;
    return 0;
  }

  /* Сдвигает окно шкалы ровно настолько, чтобы год yi стал виден. */
  function ensureVisible(yi) {
    if (yi < win) win = yi;
    else if (yi >= win + WIN) win = yi - WIN + 1;
  }

  function fillPhoto(btn, y, index) {
    var photo = y.photos[index];
    if (!photo) { btn.hidden = true; return; }

    btn.dataset.year = y.year;
    btn.dataset.index = index;
    if (photo.src) {
      var img = document.createElement('img');
      img.className = 'photo__img';
      img.src = photo.src;
      img.alt = photo.caption;
      btn.appendChild(img);
    } else {
      btn.classList.add('photo--stub');
      btn.textContent = T.photoStub + ' ' + y.year;
    }
  }

  function makePage(idx, side) {
    var sp = spreads[idx];
    if (!sp) return Screens.clone('tpl-page-end');

    var y = years[sp.y];
    var pn = sp.k * 2 + (side === 'R' ? 1 : 0);
    var page = y.pages[pn];
    var frag;
    var slot = function (name) { return frag.querySelector('[data-slot="' + name + '"]'); };

    if (page && page.title) {
      frag = Screens.clone('tpl-page-title');
      var count = y.photos.length;
      slot('num').textContent = pad(sp.y + 1) + ' / ' + pad(years.length);
      slot('year').textContent = y.year;
      slot('meta').textContent = sp.n + ' ' + plural(sp.n, T.spreadForms) + ' · ' +
        count + ' ' + plural(count, T.photoForms);
      fillPhoto(slot('photo0'), y, 0);
      slot('caption').textContent = y.photos[0] ? y.photos[0].caption : '';
    } else {
      /* Нечётное число страниц: последняя правая страница года остаётся пустой, с одной шапкой. */
      var start = page ? page.start : y.photos.length;
      frag = Screens.clone('tpl-page-photos');
      slot('release').textContent = T.release + ' ' + y.year;
      slot('num').textContent = T.pageShort + ' ' + pad(pn + 1) + ' / ' + pad(sp.n * 2);
      for (var i = 0; i < PER_PAGE; i++) fillPhoto(slot('photo' + i), y, start + i);
      slot('caption').textContent = y.photos[start] ? y.photos[start].caption : '';
    }

    frag.firstElementChild.classList.add(side === 'L' ? 'page--l' : 'page--r');
    return frag;
  }

  function put(id, idx, side) {
    root.querySelector('#' + id).replaceChildren(makePage(idx, side));
  }

  /* Год, который показываем на шкале и в подвале: во время перелистывания — уже тот, куда листаем. */
  function target() { return spreads[cur + dir]; }

  function renderTimeline() {
    var active = target().y;
    var box = root.querySelector('#tl-years');
    box.replaceChildren();

    for (var i = win; i < Math.min(years.length, win + WIN); i++) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tl__year' + (i === active ? ' is-active' : '');
      b.dataset.yi = i;
      b.innerHTML = '<span class="tl__dot"></span><span class="tl__label"></span>';
      b.lastChild.textContent = years[i].year;
      box.appendChild(b);
    }

    root.querySelector('#tl-prev').disabled = win === 0;
    root.querySelector('#tl-next').disabled = win >= years.length - WIN;
  }

  function renderFoot() {
    var t = target();
    root.querySelector('#foot-year').textContent = T.release + ' ' + years[t.y].year;
    root.querySelector('#foot-spread').textContent = T.spread + ' ' + (t.k + 1) + ' ' + T.of + ' ' + t.n;
    root.querySelector('#foot-no').textContent = T.yearShort + ' ' + pad(t.y + 1) + ' / ' + pad(years.length);

    var dots = root.querySelector('#foot-dots');
    dots.replaceChildren();
    for (var i = 0; i < t.n; i++) {
      var d = document.createElement('span');
      d.className = 'album-foot__dot' + (i === t.k ? ' is-active' : '');
      dots.appendChild(d);
    }
  }

  function renderNav() {
    var atStart = cur === 0;
    var atEnd = cur === spreads.length - 1;
    root.querySelector('#album-prev').disabled = atStart;
    root.querySelector('#corner-prev').disabled = atStart;
    root.querySelector('#album-next').disabled = atEnd;
    root.querySelector('#corner-next').disabled = atEnd;
  }

  function renderSpread() {
    put('page-l', cur, 'L');
    put('page-r', cur, 'R');
    root.querySelector('#album').classList.remove('is-flipping', 'is-back');
    renderTimeline();
    renderFoot();
    renderNav();
  }

  /* Лист лежит поверх половины, с которой уходит. Под ним уже нарисована страница,
     которая откроется, а на обороте — страница, которая ляжет на другую половину. */
  function flip(d) {
    if (dir) return;
    var nx = cur + d;
    if (nx < 0 || nx >= spreads.length) return;

    dir = d;
    var fwd = d > 0;
    var album = root.querySelector('#album');
    var leaf = root.querySelector('#album-leaf');

    if (fwd) {
      put('page-r', nx, 'R');
      put('leaf-front', cur, 'R');
      put('leaf-back', nx, 'L');
    } else {
      put('page-l', nx, 'L');
      put('leaf-front', cur, 'L');
      put('leaf-back', nx, 'R');
    }

    album.classList.toggle('is-back', !fwd);
    album.classList.remove('is-flipping');
    album.classList.add('is-turning');
    leaf.getBoundingClientRect();   /* фиксируем начальное положение, иначе переход не запустится */
    album.classList.add('is-flipping');

    ensureVisible(spreads[nx].y);
    renderTimeline();
    renderFoot();
    if (hooks.flip) hooks.flip();

    timer = setTimeout(function () {
      cur = nx;
      dir = 0;
      album.classList.remove('is-turning');
      renderSpread();
    }, FLIP_MS);
  }

  function selectYear(yi) {
    if (dir) return;
    cur = firstSpreadOf(yi);
    ensureVisible(yi);
    renderSpread();
  }

  function shiftWindow(d) {
    win = Math.max(0, Math.min(years.length - WIN, win + d));
    renderTimeline();
  }

  function onClick(e) {
    var el = e.target;
    var year = el.closest('.tl__year');
    if (year) { selectYear(Number(year.dataset.yi)); return; }
    if (el.closest('#tl-prev')) { shiftWindow(-1); return; }
    if (el.closest('#tl-next')) { shiftWindow(1); return; }
    if (el.closest('#album-prev, #corner-prev')) { flip(-1); return; }
    if (el.closest('#album-next, #corner-next')) { flip(1); }
  }

  function init(el, h) {
    clearTimeout(timer);
    root = el;
    hooks = h || {};
    build();
    cur = 0;
    dir = 0;
    win = 0;
    root.addEventListener('click', onClick);
    renderSpread();
  }

  function key(e) {
    if (e.key === 'ArrowLeft') flip(-1);
    else if (e.key === 'ArrowRight') flip(1);
  }

  return { init: init, key: key };
})();
