/* footnotes.js — lightweight footnote popovers for this blog (no deps).
   Looks for inline refs like <a href="#footnote-1"><sup>1</sup></a>
   and footnote text inside .footnote blocks that start with "N. ".
   Progressive enhancement: without JS the .footnote blocks remain visible. */

(function () {
  'use strict';

  const d = document;
  const root = d.documentElement;
  root.classList.add('js');                 // progressive enhancement hook
  root.classList.add('footnotes-enhanced'); // hide .footnote only when JS runs

  // Build a map: number -> HTML content extracted from .footnote blocks.
  const noteMap = new Map();

  // Find "1. ...", "2. ...", etc. inside .footnote blocks
  d.querySelectorAll('.footnote').forEach(block => {
    block.querySelectorAll('p').forEach(p => {
      const txt = (p.textContent || '').trim();
      const m = /^(\d+)\.\s*/.exec(txt);
      if (!m) return;
      const n = m[1];
      if (noteMap.has(n)) return; // keep first occurrence if duplicated

      // Remove the "N. " prefix from the HTML too
      const html = p.innerHTML.replace(/^\s*\d+\.\s*/, '');
      noteMap.set(n, sanitizeInlineHTML(html));
    });
  });

  // Enhance each inline reference: <a href="#footnote-N"><sup>N</sup></a>
  const refs = Array.from(d.querySelectorAll('a[href^="#footnote-"]'));
  let uid = 0;

  refs.forEach(a => {
    const match = /#footnote-(\d+)/.exec(a.getAttribute('href'));
    if (!match) return;
    const n = match[1];
    const contents = noteMap.get(n) || 'Footnote not found.';

    // Wrap the anchor so we can absolutely-position the bubble
    const wrapper = d.createElement('span');
    wrapper.className = 'fn-wrapper';
    a.before(wrapper);
    wrapper.appendChild(a);

    // Bubble
    const bubble = d.createElement('span');
    bubble.className = 'fn-bubble is-below';
    bubble.setAttribute('role', 'tooltip');
    bubble.hidden = true;
    bubble.id = `fn-bubble-${++uid}`;
    bubble.innerHTML = contents;
    wrapper.appendChild(bubble);

    // Mark reference & a11y wiring
    a.classList.add('fn-ref');
    a.setAttribute('aria-describedby', bubble.id);
    if (!a.hasAttribute('tabindex')) a.setAttribute('tabindex', '0');

    // Show/hide
    let hideTimer = null;
    const show = () => {
      clearTimeout(hideTimer);
      bubble.hidden = false;
      positionBubble(bubble, wrapper);
    };
    const hide = () => { hideTimer = setTimeout(() => { bubble.hidden = true; }, 80); };

    wrapper.addEventListener('mouseenter', show);
    wrapper.addEventListener('mouseleave', hide);
    a.addEventListener('focus', show);
    a.addEventListener('blur', hide);

    // Click toggles without jumping the page
    a.addEventListener('click', (e) => {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // let modified-clicks work
      e.preventDefault();
      bubble.hidden ? show() : hide();
    });

    a.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); bubble.hidden ? show() : hide(); }
    });

    addEventListener('scroll', () => { if (!bubble.hidden) positionBubble(bubble, wrapper); }, { passive: true });
    addEventListener('resize', () => { if (!bubble.hidden) positionBubble(bubble, wrapper); });
  });

  // ---- helpers

  function positionBubble(bubble, wrapper) {
    // reset
    bubble.style.left = '';
    bubble.style.right = '';
    bubble.style.top = '';
    bubble.style.bottom = '';
    bubble.style.setProperty('--arrow-shift', '0px');

    // measure
    const wRect = wrapper.getBoundingClientRect();
    const wasHidden = bubble.hidden;
    if (wasHidden) bubble.hidden = false; // ensure measurable
    const bRect = bubble.getBoundingClientRect();

    // choose above/below depending on available space
    const spaceBelow = innerHeight - wRect.bottom;
    const spaceAbove = wRect.top;
    const placeBelow = spaceBelow >= spaceAbove;

    bubble.classList.toggle('is-below', placeBelow);
    bubble.classList.toggle('is-above', !placeBelow);

    if (placeBelow) bubble.style.top = 'calc(100% + 0.4rem)';
    else            bubble.style.bottom = 'calc(100% + 0.4rem)';

    // center horizontally, but keep inside viewport (16px gutter)
    const desiredLeft = wRect.left + wRect.width / 2 - bRect.width / 2;
    const minLeft = 16;
    const maxLeft = innerWidth - bRect.width - 16;
    const finalLeft = Math.min(Math.max(desiredLeft, minLeft), maxLeft);
    const offset = finalLeft - wRect.left; // viewport -> wrapper offset
    bubble.style.left = offset + 'px';

    // keep caret pointing to the reference
    const bubbleCenter = finalLeft + bRect.width / 2;
    const refCenter = wRect.left + wRect.width / 2;
    const shift = Math.max(-bRect.width / 2 + 12, Math.min(bRect.width / 2 - 12, refCenter - bubbleCenter));
    bubble.style.setProperty('--arrow-shift', shift + 'px');

    if (wasHidden) bubble.hidden = true;
  }

  // Minimal inline sanitizer: unwrap unknown wrappers, keep simple inline tags & safe links
  function sanitizeInlineHTML(html) {
    const allowed = new Set(['A','EM','I','STRONG','B','CODE','KBD','SPAN','SUB','SUP','S','U','SMALL','BR']);
    const root = document.createElement('div');
    root.innerHTML = html;

    (function walk(node){
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 1) {
          const el = child;
          if (!allowed.has(el.tagName)) {
            const frag = document.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            el.replaceWith(frag);
            walk(node);
          } else {
            [...el.attributes].forEach(attr => {
              const name = attr.name.toLowerCase();
              if (name.startsWith('on')) el.removeAttribute(attr.name);
              if (el.tagName === 'A' && name === 'href') {
                const href = attr.value.trim();
                if (/^\s*javascript:/i.test(href)) el.removeAttribute('href');
              } else if (!['href','title','aria-label'].includes(name)) {
                el.removeAttribute(attr.name);
              }
            });
            walk(el);
          }
        }
      });
    })(root);

    return root.innerHTML;
  }
})();
