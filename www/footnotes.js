(function () {
  function textPreview(el, max=1024) {
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    return t.length > max ? t.slice(0, max - 1) + "…" : t;
  }

  function unwrap(node) {
    const removeTags = ["font", "class", "div", "span"];
    removeTags.forEach(tag => {
      node.querySelectorAll(tag).forEach(el => {
        if (el.matches('div.footnote')) return; // keep the root until we’re done
        if (el.attributes.length === 0 || el.getAttribute('align') || el.getAttribute('style')) {
          while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
          el.remove();
        }
      });
    });
    return node;
  }

  function findPrevParagraph(node) {
    // When <div.footnote> sits between two <p>s (after parser autocloses the first),
    // the paragraph we want is the previous element sibling if it’s a <p>.
    let prev = node.previousElementSibling;
    if (prev && prev.tagName && prev.tagName.toLowerCase() === 'p') return prev;
    // Fallback: climb to a parent and look backward
    let p = node.parentElement;
    while (p && p.tagName && p.tagName.toLowerCase() !== 'p') p = p.parentElement;
    return p || null;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const inlineNotes = Array.from(document.querySelectorAll('div.footnote'));
    if (!inlineNotes.length) return;

    // Hide until processed (CSS listens on html.footnotes-ready)
    document.documentElement.classList.remove('footnotes-ready');

    // Superscripts and return anchors map by document order.
    const supLinks = Array.from(document.querySelectorAll('sup a[href^="#footnote"]'));
    const returnAnchors = Array.from(document.querySelectorAll('a[id^="footnr-"]'));

    // Move each superscript back into the previous paragraph BEFORE we hide <div.footnote>
    inlineNotes.forEach((fn, i) => {
      const sup = supLinks[i];
      const supEl = sup ? (sup.closest('sup') || sup) : null;
      const ret = returnAnchors[i] || null;
      const prevP = findPrevParagraph(fn);

      if (prevP) {
        // Insert tiny backref marker (where users jump back to)
        if (ret && ret.parentNode) { prevP.appendChild(ret); }
        // Now the superscript itself
        if (supEl && supEl.parentNode) { prevP.appendChild(supEl); }
      }
    });

    // Create bottom notes section
    let notes = document.getElementById('notes');
    if (!notes) {
      notes = document.createElement('section');
      notes.id = 'notes';
      const hr = document.createElement('hr'); hr.className = 'footnotes-rule';
      const ol = document.createElement('ol'); ol.className = 'footnotes';
      notes.appendChild(hr);
      notes.appendChild(ol);
      document.body.appendChild(notes);
    }
    const list = notes.querySelector('ol.footnotes');

    // Build endnotes and wire previews
    inlineNotes.forEach((fn, i) => {
      const num = i + 1;

      const clone = fn.cloneNode(true);
      unwrap(clone);

      const p0 = clone.querySelector('p');
      if (p0) p0.innerHTML = p0.innerHTML.replace(/^\s*\d+\.\s*/, '');

      const li = document.createElement('li');
      li.id = `footnote-${num}`;
      li.innerHTML = clone.innerHTML.trim();

      const back = document.createElement('a');
      back.className = 'footnote-backref';
      back.href = `#footref-${num}`;
      back.setAttribute('aria-label', 'Back to content');
      back.textContent = '↩︎';
      li.append(' ', back);
      list.appendChild(li);

      const sup = supLinks[i];
      if (sup) {
        sup.href = `#footnote-${num}`;
        sup.classList.add('footnote-ref');
        sup.setAttribute('data-footnote', textPreview(li));
      }

      const ret = returnAnchors[i];
      if (ret) {
        ret.id = `footref-${num}`;
      } else if (sup) {
        const marker = document.createElement('a');
        marker.id = `footref-${num}`;
        sup.parentNode.insertBefore(marker, sup);
      }

      // Hide the original inline footnote <div>
      fn.classList.add('tm-footnote-processed');
    });

    // Reveal after rewrites
    document.documentElement.classList.add('footnotes-ready');
  });
})();
