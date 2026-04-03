// ============================================================
// wms-ui.js — WMS Shared UI Utility
// Smooth show/hide, ripple, stagger, skeleton, toast, shake.
// Được load trước api-client.js trên tất cả trang.
// ============================================================

const UI = (() => {

  // ────────────────────────────────────────────────────────
  // 1. SHOW / HIDE — animated, thay thế style.display toggle
  // ────────────────────────────────────────────────────────

  /**
   * Hiện element với animation mượt mà.
   * @param {HTMLElement} el
   * @param {string}  [anim]      CSS animation class (default: 'anim-slide-up')
   * @param {string}  [display]   Display value (default: 'block')
   */
  function show(el, anim, display) {
    if (!el) return;
    anim    = anim    || 'anim-slide-up';
    display = display || 'block';

    // Nếu đang exit-animation, hủy bỏ
    _cancelHide(el);

    el.style.display = display;

    // Restart animation bằng cách remove rồi re-add
    el.classList.remove(anim);
    void el.offsetWidth; // force reflow — bắt browser "thấy" class đã xóa
    el.classList.add(anim);
  }

  /** Hiện với display: flex */
  function showFlex(el, anim) {
    show(el, anim || 'anim-slide-up', 'flex');
  }

  /** Hiện với display: inline */
  function showInline(el, anim) {
    show(el, anim || 'anim-fade-in', 'inline');
  }

  /**
   * Ẩn element với animation fade-out.
   * Sau khi animation xong mới set display:none.
   */
  function hide(el) {
    if (!el || el.style.display === 'none') return;

    el.style.animation = 'wms-collapse-out var(--dur-fast) var(--ease-in-out) forwards';
    el.style.pointerEvents = 'none';

    const TIMEOUT = 170;
    const done = () => {
      el.style.display     = 'none';
      el.style.animation   = '';
      el.style.pointerEvents = '';
    };

    const timer = setTimeout(done, TIMEOUT);
    el.addEventListener('animationend', function handler() {
      clearTimeout(timer);
      done();
      el.removeEventListener('animationend', handler);
    });

    // Lưu timer để cancel nếu cần
    el._wmsHideTimer = timer;
  }

  function _cancelHide(el) {
    if (el._wmsHideTimer) {
      clearTimeout(el._wmsHideTimer);
      el._wmsHideTimer = null;
      el.style.animation    = '';
      el.style.pointerEvents = '';
    }
  }

  // ────────────────────────────────────────────────────────
  // 2. RIPPLE — hiệu ứng sóng khi bấm button
  // ────────────────────────────────────────────────────────

  function ripple(btn, event) {
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height) * 2.2;
    const x    = event ? event.clientX - rect.left  - size / 2 : rect.width  / 2 - size / 2;
    const y    = event ? event.clientY - rect.top   - size / 2 : rect.height / 2 - size / 2;

    const wave = document.createElement('span');
    wave.className = 'ripple-wave';
    wave.style.cssText = [
      'width:'  + size + 'px',
      'height:' + size + 'px',
      'left:'   + x    + 'px',
      'top:'    + y    + 'px',
    ].join(';');

    // Đảm bảo btn có position relative + overflow hidden
    if (getComputedStyle(btn).position === 'static') btn.style.position = 'relative';
    btn.style.overflow = 'hidden';

    btn.appendChild(wave);
    wave.addEventListener('animationend', () => wave.remove());
  }

  /** Tự gắn ripple vào tất cả .btn (và theo dõi DOM mới). */
  function _initRipples() {
    const attach = (btn) => {
      if (btn._wmsRipple) return;
      btn._wmsRipple = true;
      btn.classList.add('ripple-host');
      btn.addEventListener('pointerdown', e => ripple(btn, e));
    };
    document.querySelectorAll('.btn').forEach(attach);

    // Watch dynamic buttons
    new MutationObserver(mutations => {
      mutations.forEach(m => m.addedNodes.forEach(n => {
        if (n.nodeType !== 1) return;
        if (n.classList && n.classList.contains('btn')) attach(n);
        n.querySelectorAll && n.querySelectorAll('.btn').forEach(attach);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  // ────────────────────────────────────────────────────────
  // 3. STAGGER — animate danh sách items lần lượt
  // ────────────────────────────────────────────────────────

  /**
   * Stagger animate một tập elements.
   * @param {NodeList|Array} elements
   * @param {string}  [anim]      Tên animation class
   * @param {number}  [step]      Milliseconds mỗi bước (default 45ms)
   * @param {number}  [baseDelay] Delay trước item đầu tiên (default 0ms)
   */
  function stagger(elements, anim, step, baseDelay) {
    anim      = anim      || 'anim-slide-up';
    step      = step      || 45;
    baseDelay = baseDelay || 0;

    Array.from(elements).forEach((el, i) => {
      el.style.animationDelay = (baseDelay + i * step) + 'ms';
      el.classList.remove(anim);
      void el.offsetWidth;
      el.classList.add(anim);
    });
  }

  // ────────────────────────────────────────────────────────
  // 4. SKELETON LOADER — thay nội dung bằng pulsing bars
  // ────────────────────────────────────────────────────────

  /**
   * Hiện skeleton loader trong container.
   * @param {HTMLElement} el
   * @param {number}  [lines]  Số dòng skeleton (default 3)
   */
  function skeleton(el, lines) {
    if (!el) return;
    el._wmsOriginalHTML = el.innerHTML;
    lines = lines || 3;
    const widths = ['full', 'medium', 'short', 'full', 'medium'];
    let html = '';
    for (let i = 0; i < lines; i++) {
      html += '<div class="skeleton-line ' + widths[i % widths.length] + '" '
            + 'style="animation-delay:' + (i * 90) + 'ms"></div>';
    }
    el.innerHTML = html;
  }

  /** Khôi phục nội dung gốc sau khi skeleton xong. */
  function unskeleton(el, newContent) {
    if (!el) return;
    if (newContent !== undefined) {
      el.innerHTML = newContent;
    } else if (el._wmsOriginalHTML !== undefined) {
      el.innerHTML = el._wmsOriginalHTML;
      delete el._wmsOriginalHTML;
    }
  }

  // ────────────────────────────────────────────────────────
  // 5. SHAKE — lắc element khi có lỗi validation
  // ────────────────────────────────────────────────────────

  function shake(el) {
    if (!el) return;
    el.classList.remove('wms-shake');
    void el.offsetWidth;
    el.classList.add('wms-shake');
    el.addEventListener('animationend', () => el.classList.remove('wms-shake'), { once: true });
  }

  // ────────────────────────────────────────────────────────
  // 6. TOAST — thay showToast() dùng chung
  // ────────────────────────────────────────────────────────

  /**
   * Hiện toast notification.
   * @param {string}  msg
   * @param {string}  [type]    'success' | 'error' | 'info'
   * @param {number}  [duration] ms (default 3500)
   */
  function toast(msg, type, duration) {
    type     = type     || 'success';
    duration = duration || 3500;

    const wrap = document.getElementById('toastWrap');
    if (!wrap) { console.warn('WMS: #toastWrap not found'); return; }

    const el = document.createElement('div');
    el.className = 'toast ' + (type === 'success' ? 't-ok' : type === 'error' ? 't-err' : 't-inf');
    el.textContent = msg;
    el.style.cursor = 'pointer';

    const dismiss = () => {
      el.classList.add('wms-toast-exit');
      setTimeout(() => el.remove(), 160);
    };

    el.addEventListener('click', dismiss);
    wrap.appendChild(el);
    setTimeout(dismiss, duration);

    return el;
  }

  // ────────────────────────────────────────────────────────
  // 7. BADGE POP — animate status badge khi thay đổi
  // ────────────────────────────────────────────────────────

  function popBadge(el) {
    if (!el) return;
    el.classList.remove('anim-pop-sm');
    void el.offsetWidth;
    el.classList.add('anim-pop-sm');
    el.addEventListener('animationend', () => el.classList.remove('anim-pop-sm'), { once: true });
  }

  // ────────────────────────────────────────────────────────
  // 8. BUTTON SUCCESS FLASH
  // ────────────────────────────────────────────────────────

  function successFlash(btn, originalText, delay) {
    if (!btn) return;
    delay = delay || 1200;
    btn.classList.add('wms-success-flash');
    setTimeout(() => btn.classList.remove('wms-success-flash'), delay);
    if (originalText) {
      setTimeout(() => { btn.textContent = originalText; }, delay);
    }
  }

  // ────────────────────────────────────────────────────────
  // 9. TOPBAR SCROLL SHADOW
  // ────────────────────────────────────────────────────────

  function _initScrollShadow() {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const handler = () => {
      topbar.classList.toggle('scrolled', window.scrollY > 4);
    };
    window.addEventListener('scroll', handler, { passive: true });
  }

  // ────────────────────────────────────────────────────────
  // 10. PAGE FADE-IN
  // ────────────────────────────────────────────────────────

  function _initPageEntrance() {
    const app = document.querySelector('.app') || document.querySelector('.s-nav') || document.body;
    if (app && !app.classList.contains('wms-page-enter')) {
      app.classList.add('wms-page-enter');
    }
  }

  // ────────────────────────────────────────────────────────
  // 11. AUTO-ATTACH STAGGER to results containers
  // ────────────────────────────────────────────────────────

  /**
   * Khi container được render xong (innerHTML set),
   * tự stagger animate các direct children.
   */
  function staggerChildren(containerEl, anim, step) {
    if (!containerEl) return;
    const children = containerEl.querySelectorAll(
      '.veh-card, .req-card, .wms-tbl-row, tr'
    );
    if (children.length) stagger(children, anim || 'anim-slide-up', step || 40);
  }

  // ────────────────────────────────────────────────────────
  // 12. INIT — gọi khi DOM ready
  // ────────────────────────────────────────────────────────

  function init() {
    _initRipples();
    _initScrollShadow();
    _initPageEntrance();

    // Login card nếu có
    const loginCard = document.querySelector('.card');
    if (loginCard && document.querySelector('.logo')) {
      loginCard.classList.add('login-card');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ────────────────────────────────────────────────────────
  // PUBLIC API
  // ────────────────────────────────────────────────────────
  return {
    show, showFlex, showInline, hide,
    ripple, stagger, staggerChildren,
    skeleton, unskeleton,
    shake, toast, popBadge, successFlash,
  };

})();
