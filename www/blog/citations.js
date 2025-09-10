/* citations.js — lightweight citation popovers (no deps).
   Finds inline links like:  [ ... <a href="#bib-XYZ">3</a> ... ]
   Looks up the corresponding entry in the References list where a <dd>
   contains an anchor: <a id="bib-XYZ"></a> …reference text…
   Progressive enhancement: the References section remains visible.
*/

(function () {
  'use strict';

  const d = document;
  const root = d.documentElement;
  root.classList.add('js');
  root.classList.add('citations-enhanced'); // hook if you ever want special styles

  // --- Build id -> HTML map from bibliography definitions -------------------
  const citeMap = new Map();

  // Each bibliography entry contains <a id="bib-..."></a> inside its <dd>
  d.querySelectorAll('a[id^="bib-"]').forEach(anchor => {
    const id = anchor.id;
    const dd = anchor.closest('dd') || anchor.closest('p') || anchor.parentElement;
    if (!dd) return;

    // Clone and strip the defining #bib- anchor(s) from the payload
    const clone = dd.cloneNode(true);
    clone.querySelectorAll('a[id^="bib-"]').forEach(n => n.remove());

    // Prefer the inner <p> for a cleaner snippet if present
    const payloadEl = clone.matches('dd') && clone.querySelector('p') ? clone.querySelector('p') : clone;

    const html = sanitizeInlineHTML((payloadEl.innerHTML || '').trim());
    citeMap.set(id, html);
  });

  // --- Enhance each inline citation: <a href="#bib-...">N</a> ----------------
  const refs = Array.from(d.querySelectorAll('a[href^="#bib-"]'));
  let uid = 0;

  refs.forEach(link => {
    const href = link.getAttribute('href') || '';
    const m = /^#(bib-[\w\-:.]+)$/.exec(href);
    if (!m) return;

    const id = m[1];
    const contents = citeMap.get(id) || 'Citation not found.';

    // Wrap for positioning (reuse footnote classes for styling)
    const wrapper = d.createElement('span');
    wrapper.className = 'fn-wrapper cite-wrapper';
    link.before(wrapper);
    wrapper.appendChild(link);

    // Bubble
    const bubble = d.createElement('span');
    bubble.className = 'fn-bubble cite-bubble is-below';
    bubble.setAttribute('role', 'tooltip');
    bubble.hidden = true;
    bubble.id = `cite-bubble-${++uid}`;
    bubble.innerHTML = contents;
    wrapper.appendChild(bubble);

    // A11y + keyboard toggling (reuse fn-ref styling)
    link.classList.add('fn-ref', 'cite-ref');
    link.setAttribute('aria-describedby', bubble.id);
    if (!link.hasAttribute('tabindex')) link.setAttribute('tabindex', '0');

    let hideTimer = null;
    const show = () => {
      clearTimeout(hideTimer);
      bubble.hidden = false;
      positionBubble(bubble, wrapper);
    };
    const hide = () => { hideTimer = setTimeout(() => { bubble.hidden = true; }, 80); };

    wrapper.addEventListener('mouseenter', show);
    wrapper.addEventListener('mouseleave', hide);
    link.addEventListener('focus', show);
    link.addEventListener('blur', hide);

    link.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') hide();
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); bubble.hidden ? show() : hide(); }
    });

    addEventListener('scroll', () => { if (!bubble.hidden) positionBubble(bubble, wrapper); }, { passive: true });
    addEventListener('resize', () => { if (!bubble.hidden) positionBubble(bubble, wrapper); });
  });

  // --- helpers ---------------------------------------------------------------

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

    // above/below depending on available space
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
    const allowed = new Set(['A','EM','I','STRONG','B','CODE','KBD','SPAN','SUB','SUP','S','U','SMALL','CITE','BR']);
    const root = document.createElement('div');
    root.innerHTML = html;

    (function walk(node){
      [...node.childNodes].forEach(child => {
        if (child.nodeType === 1) {
          const el = child;
          const tag = el.tagName ? el.tagName.toUpperCase() : ''; // robust for XHTML
          if (!allowed.has(tag)) {
            const frag = document.createDocumentFragment();
            while (el.firstChild) frag.appendChild(el.firstChild);
            el.replaceWith(frag);
            walk(node);
          } else {
            [...el.attributes].forEach(attr => {
              const name = attr.name.toLowerCase();
              if (name.startsWith('on')) el.removeAttribute(attr.name);
              if (tag === 'A' && name === 'href') {
                const href = (attr.value || '').trim();
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
