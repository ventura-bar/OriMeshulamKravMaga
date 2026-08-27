// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const mainNav = document.getElementById('mainNav');

navToggle.addEventListener('click', () => {
  const isOpen = mainNav.classList.toggle('open');
  navToggle.setAttribute('aria-expanded', String(isOpen));
});

mainNav.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mainNav.classList.remove('open');
    navToggle.setAttribute('aria-expanded', 'false');
  });
});

// Gallery carousel -- images come from data/gallery.json so new photos can
// be added there without touching this file.
(async () => {
  const galleryTrack = document.getElementById('galleryTrack');
  if (!galleryTrack) return;

  const galleryThumbs = document.getElementById('galleryThumbs');
  const galleryPrev = document.getElementById('galleryPrev');
  const galleryNext = document.getElementById('galleryNext');

  let galleryImages = [];
  try {
    const res = await fetch('data/gallery.json');
    galleryImages = await res.json();
  } catch (err) {
    console.error('Failed to load gallery.json', err);
    return;
  }
  if (!galleryImages.length) return;

  let galleryIndex = 0;

  function renderGallery(index) {
    galleryIndex = (index + galleryImages.length) % galleryImages.length;
    // RTL flex row lays child 0 at the right (matching the viewport) and each
    // next child further left, so bringing slide N into view means shifting
    // the track right (positive), not left, unlike the equivalent LTR case.
    galleryTrack.style.transform = `translateX(${galleryIndex * 100}%)`;

    galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
      thumb.classList.toggle('active', i === galleryIndex);
    });
  }

  // Build one slide per entry in galleryImages (real slide-sideways transition,
  // not a fade -- see .gallery-track's transform transition in style.css)
  galleryImages.forEach((image) => {
    const slide = document.createElement('div');
    slide.className = 'gallery-slide';
    if (image.src) {
      // Blurred backdrop copy (fills the frame) + the real photo on top,
      // uncropped -- see .gallery-slide-bg in style.css for why.
      const bg = document.createElement('img');
      bg.className = 'gallery-slide-bg';
      bg.src = image.src;
      bg.alt = '';
      bg.setAttribute('aria-hidden', 'true');
      slide.appendChild(bg);

      const img = document.createElement('img');
      img.src = image.src;
      img.alt = image.alt || '';
      img.loading = 'lazy';
      slide.appendChild(img);
    } else {
      slide.insertAdjacentHTML('beforeend',
        '<svg class="ph-icon" viewBox="0 0 24 24" aria-hidden="true">' +
        '<path d="M21 19V5a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2zM8.5 13.5l2.5 3 3.5-4.5L19 17H5l3.5-4.5z"/>' +
        '<circle cx="8" cy="8.5" r="1.5"/></svg>'
      );
      const span = document.createElement('span');
      span.textContent = image.alt || '';
      slide.appendChild(span);
    }
    galleryTrack.appendChild(slide);
  });

  // Build one dot per image (markup only has placeholders for a fixed count)
  galleryThumbs.innerHTML = '';
  galleryImages.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'gallery-thumb' + (i === 0 ? ' active' : '');
    dot.setAttribute('data-index', String(i));
    dot.setAttribute('aria-label', `עבור לתמונה ${i + 1}`);
    galleryThumbs.appendChild(dot);
  });

  const galleryViewport = galleryTrack.parentElement;
  const galleryFrame = galleryViewport.parentElement;

  // Auto-advance one slide at a time; any manual move resets the countdown
  // so it doesn't fight the button/swipe the visitor just used.
  const autoplayDelay = 4000;
  let autoplayTimer = null;

  function resetAutoplay() {
    if (autoplayTimer) clearInterval(autoplayTimer);
    autoplayTimer = setInterval(() => renderGallery(galleryIndex + 1), autoplayDelay);
  }

  galleryPrev.addEventListener('click', () => { renderGallery(galleryIndex - 1); resetAutoplay(); });
  galleryNext.addEventListener('click', () => { renderGallery(galleryIndex + 1); resetAutoplay(); });
  galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.addEventListener('click', () => { renderGallery(i); resetAutoplay(); });
  });
  renderGallery(0);
  resetAutoplay();

  // Swipe / drag to move between images (mouse + touch + iPhone Safari).
  // Listens on the whole frame, not just the viewport: the prev/next
  // buttons float on top of the image edges (siblings, not descendants
  // of the viewport), which is exactly where a thumb naturally starts a
  // swipe -- a viewport-only listener would miss those touches entirely.
  let dragStartX = null;
  const swipeThreshold = 40;

  // Prev/next/zoom buttons float inside this same frame (on top of the
  // image edges, a natural thumb-swipe starting point) and already have
  // their own click handlers. A gesture that starts on one of them must
  // still count as a swipe if it ends as one -- that's the whole reason
  // this listens on the frame, not just the viewport -- but if it ends as
  // a plain tap, it should be left entirely to the button's own click,
  // not ALSO open the lightbox underneath it.
  let startedOnButton = false;

  galleryFrame.addEventListener('pointerdown', (e) => {
    startedOnButton = !!e.target.closest('.gallery-nav, .gallery-zoom-btn');
    dragStartX = e.clientX;
    // No setPointerCapture here: this logic only reads the down/up
    // coordinates (no pointermove), and capturing the pointer to the frame
    // was suppressing the prev/next buttons' native click synthesis for a
    // real mouse click (the buttons are inside this same frame).
  });
  galleryFrame.addEventListener('pointerup', (e) => {
    if (dragStartX === null) return;
    const dx = e.clientX - dragStartX;
    dragStartX = null;
    if (dx > swipeThreshold) { renderGallery(galleryIndex - 1); resetAutoplay(); }
    else if (dx < -swipeThreshold) { renderGallery(galleryIndex + 1); resetAutoplay(); }
    else if (!startedOnButton) { openLightbox(galleryIndex); } // a tap on the image, not a swipe
  });
  galleryFrame.addEventListener('pointercancel', () => { dragStartX = null; });

  // ---------- Lightbox: full-screen zoom/pan viewer ----------
  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightboxImg');
  const lightboxViewport = document.getElementById('lightboxViewport');
  const lightboxClose = document.getElementById('lightboxClose');
  const lightboxPrev = document.getElementById('lightboxPrev');
  const lightboxNext = document.getElementById('lightboxNext');
  const lightboxCounter = document.getElementById('lightboxCounter');
  const galleryZoomBtn = document.getElementById('galleryZoomBtn');

  let lightboxIndex = 0;
  let scale = 1, panX = 0, panY = 0;
  const MIN_SCALE = 1, MAX_SCALE = 4;

  function applyTransform() {
    lightboxImg.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    lightboxImg.classList.toggle('panning', scale > 1);
  }

  function clampPan() {
    // Don't let the image be dragged entirely out of view once zoomed.
    const rect = lightboxViewport.getBoundingClientRect();
    const maxX = (rect.width * (scale - 1)) / 2;
    const maxY = (rect.height * (scale - 1)) / 2;
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function setScale(newScale, originClientX, originClientY) {
    const rect = lightboxViewport.getBoundingClientRect();
    const cx = originClientX - (rect.left + rect.width / 2);
    const cy = originClientY - (rect.top + rect.height / 2);
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    // Keep the point under the cursor/fingers fixed while scaling.
    const ratio = clamped / scale;
    panX = cx - (cx - panX) * ratio;
    panY = cy - (cy - panY) * ratio;
    scale = clamped;
    if (scale === MIN_SCALE) { panX = 0; panY = 0; }
    clampPan();
    applyTransform();
  }

  function updateLightboxImage() {
    const image = galleryImages[lightboxIndex];
    lightboxImg.src = image.src || '';
    lightboxImg.alt = image.alt || '';
    // <bdi> isolates just this text run's bidi direction so "1 / 20" doesn't
    // reorder to "20 / 1" inside the page's RTL context -- unlike setting
    // direction:ltr on the counter element itself, it doesn't also affect
    // that element's own inset-inline-* positioning.
    lightboxCounter.innerHTML = '';
    const bdi = document.createElement('bdi');
    bdi.textContent = `${lightboxIndex + 1} / ${galleryImages.length}`;
    lightboxCounter.appendChild(bdi);
    scale = 1; panX = 0; panY = 0;
    applyTransform();
  }

  function openLightbox(index) {
    lightboxIndex = index;
    updateLightboxImage();
    lightbox.classList.add('open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    clearInterval(autoplayTimer); // don't keep advancing the carousel behind the lightbox
  }

  function closeLightbox() {
    lightbox.classList.remove('open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    renderGallery(lightboxIndex); // keep the carousel in sync with what was viewed
    resetAutoplay();
  }

  function lightboxStep(dir) {
    lightboxIndex = (lightboxIndex + dir + galleryImages.length) % galleryImages.length;
    updateLightboxImage();
  }

  galleryZoomBtn.addEventListener('click', () => openLightbox(galleryIndex));
  lightboxClose.addEventListener('click', closeLightbox);
  lightboxPrev.addEventListener('click', () => lightboxStep(-1));
  lightboxNext.addEventListener('click', () => lightboxStep(1));
  lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener('keydown', (e) => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowRight') lightboxStep(1);
    else if (e.key === 'ArrowLeft') lightboxStep(-1);
  });

  // Wheel to zoom (desktop), centered on the cursor.
  lightboxViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    setScale(scale - e.deltaY * 0.01, e.clientX, e.clientY);
  }, { passive: false });

  // Double-click / double-tap to toggle zoom. Implemented manually off
  // pointerup timing (not the 'dblclick' event) so it behaves identically
  // for mouse and touch.
  let lastTapTime = 0, lastTapX = 0, lastTapY = 0;
  function handleDoubleTap(x, y) {
    const now = Date.now();
    const isDouble = now - lastTapTime < 350 && Math.hypot(x - lastTapX, y - lastTapY) < 30;
    lastTapTime = isDouble ? 0 : now;
    lastTapX = x; lastTapY = y;
    if (isDouble) {
      setScale(scale > MIN_SCALE ? MIN_SCALE : 2.5, x, y);
    }
    return isDouble;
  }

  // Unified pointer handling: single pointer pans when zoomed in or swipes
  // to the next/prev photo when not; two pointers pinch-zoom. touch-action
  // is fully disabled on this element (see CSS), so the browser never takes
  // over these gestures itself -- unlike the reviews marquee, there's no
  // native scrolling here to conflict with.
  const activePointers = new Map();
  let pinchStartDist = 0, pinchStartScale = 1;
  let dragStart = null; // { x, y, panX, panY } for single-pointer drag

  lightboxViewport.addEventListener('pointerdown', (e) => {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    lightboxViewport.setPointerCapture(e.pointerId);
    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      pinchStartDist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      pinchStartScale = scale;
      dragStart = null;
    } else if (activePointers.size === 1) {
      dragStart = { x: e.clientX, y: e.clientY, panX, panY };
    }
  });

  lightboxViewport.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size === 2) {
      const pts = [...activePointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const midX = (pts[0].x + pts[1].x) / 2;
      const midY = (pts[0].y + pts[1].y) / 2;
      if (pinchStartDist > 0) setScale(pinchStartScale * (dist / pinchStartDist), midX, midY);
    } else if (activePointers.size === 1 && dragStart) {
      const dx = e.clientX - dragStart.x;
      const dy = e.clientY - dragStart.y;
      if (scale > MIN_SCALE) {
        panX = dragStart.panX + dx;
        panY = dragStart.panY + dy;
        clampPan();
        applyTransform();
      }
    }
  });

  function endLightboxPointer(e) {
    const wasSingle = activePointers.size === 1 && dragStart;
    let swipeDx = 0;
    if (wasSingle) swipeDx = e.clientX - dragStart.x;
    activePointers.delete(e.pointerId);
    if (activePointers.size < 2) pinchStartDist = 0;

    if (wasSingle && scale === MIN_SCALE) {
      // Not zoomed: a horizontal drag navigates instead of panning.
      if (swipeDx > 50) lightboxStep(-1);
      else if (swipeDx < -50) lightboxStep(1);
      else handleDoubleTap(e.clientX, e.clientY);
    } else if (wasSingle) {
      handleDoubleTap(e.clientX, e.clientY);
    }
    dragStart = null;
  }
  lightboxViewport.addEventListener('pointerup', endLightboxPointer);
  lightboxViewport.addEventListener('pointercancel', () => {
    activePointers.clear();
    pinchStartDist = 0;
    dragStart = null;
  });
})();

// Reviews: auto-scrolls on its own, but can also be dragged/swiped by hand.
// Content comes from data/reviews.json, cloned into 3 copies here so the
// scroll position can wrap seamlessly for a true infinite loop, with real
// content as a buffer on both sides of the visible window.
(async () => {
  const reviewsMarquee = document.querySelector('.reviews-marquee');
  const reviewsTrack = document.getElementById('reviewsTrack');
  if (!reviewsMarquee || !reviewsTrack) return;

  let reviews = [];
  try {
    const res = await fetch('data/reviews.json');
    reviews = await res.json();
  } catch (err) {
    console.error('Failed to load reviews.json', err);
    return;
  }
  if (!reviews.length) return;

  function buildCard(review, hidden) {
    const card = document.createElement('div');
    card.className = 'review-card';
    if (hidden) card.setAttribute('aria-hidden', 'true');

    const stars = document.createElement('div');
    stars.className = 'review-stars';
    stars.textContent = '★★★★★'.slice(0, review.stars || 5);
    card.appendChild(stars);

    const quote = document.createElement('p');
    quote.className = 'review-quote';
    quote.textContent = `"${review.quote}"`;
    card.appendChild(quote);

    const author = document.createElement('div');
    author.className = 'review-author';
    author.textContent = review.author || '';
    card.appendChild(author);

    return card;
  }

  // Many copies (not just 2-3) so a real touch-scroll gesture can never
  // physically reach the true start/end of the track. The wrap-correction
  // below only runs while nothing is being touched (see wrapReviewsScroll),
  // so during an active swipe the position isn't corrected in real time --
  // with too few copies, a longer swipe session could still reach the real
  // edge before release, showing genuine empty space (reported on iOS
  // Safari: "not a loop after last one, it's empty"). Each copy is fairly
  // cheap (9 short text cards, no images), so a generous buffer costs
  // little.
  const COPY_COUNT = 9;
  const middleCopy = Math.floor(COPY_COUNT / 2);

  for (let copy = 0; copy < COPY_COUNT; copy++) {
    reviews.forEach((review) => {
      reviewsTrack.appendChild(buildCard(review, copy !== middleCopy));
    });
  }

  let isInteracting = false;
  let isDragging = false;
  let dragStartX = 0;
  let scrollStart = 0;
  const autoScrollSpeed = 0.6; // px per frame

  // One copy's width. Deliberately NOT reviewsTrack.scrollWidth / COPY_COUNT:
  // WebKit's scrollWidth on this flex container comes out far larger than
  // the sum of its (correctly, individually 300px-wide) children whenever
  // they contain long wrapping text -- confirmed by measuring every child's
  // own getBoundingClientRect() (all exactly 300px) against scrollWidth
  // (reported ~2.5x too large). Chromium doesn't have this bug, so the
  // symptom only showed up in real Safari. Computing our own unit width
  // from the known, reliably-measured card width sidesteps it entirely.
  const cardWidth = reviewsTrack.children[0].getBoundingClientRect().width;
  const trackGap = parseFloat(getComputedStyle(reviewsTrack).columnGap) || 18;
  const unitWidth = reviews.length * (cardWidth + trackGap);
  reviewsMarquee.scrollLeft = -middleCopy * unitWidth;

  // Safari rounds scrollLeft to a whole pixel on read, so repeatedly doing
  // scrollLeft -= 0.6 (reading the rounded value back each frame) never
  // accumulates -- it looked like autoplay just didn't work in Safari.
  // Tracking our own float position sidesteps that rounding entirely.
  let autoPos = reviewsMarquee.scrollLeft;

  function syncAutoPos() {
    autoPos = reviewsMarquee.scrollLeft;
  }

  // Only runs while nothing is being touched/dragged. Reading scrollLeft
  // is a layout-dependent property, and polling it every frame *during* an
  // active native touch-scroll competes with iOS's own scroll handling for
  // that gesture -- it was throttling how far a swipe could actually move
  // (a swipe barely moved the content at all). Keeps the position within a
  // single unit-wide window around the middle copy, wrapping by exactly one
  // unitWidth (seamless, since every copy is identical) whenever it drifts
  // out -- the many extra copies on either side are what actually stop a
  // real swipe from reaching the true edge before this runs on release.
  const lowerBound = -(middleCopy + 1) * unitWidth;
  const upperBound = -(middleCopy - 1) * unitWidth;
  function wrapReviewsScroll() {
    if (reviewsMarquee.scrollLeft <= lowerBound) {
      reviewsMarquee.scrollLeft += unitWidth;
      syncAutoPos();
    } else if (reviewsMarquee.scrollLeft > upperBound) {
      reviewsMarquee.scrollLeft -= unitWidth;
      syncAutoPos();
    }
  }

  function tick() {
    if (!isInteracting) {
      autoPos -= autoScrollSpeed;
      reviewsMarquee.scrollLeft = autoPos;
      wrapReviewsScroll();
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Mouse drag
  reviewsMarquee.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse') return; // touch uses native scrolling below
    isDragging = true;
    isInteracting = true;
    reviewsMarquee.classList.add('dragging');
    dragStartX = e.clientX;
    scrollStart = reviewsMarquee.scrollLeft;
    reviewsMarquee.setPointerCapture(e.pointerId);
  });
  reviewsMarquee.addEventListener('pointermove', (e) => {
    if (!isDragging) return;
    reviewsMarquee.scrollLeft = scrollStart - (e.clientX - dragStartX);
  });
  // pointerType-gated, matching pointerdown: touch fires 'pointercancel'
  // shortly after 'pointerdown' as soon as the browser recognizes the
  // gesture as native panning (expected, spec-compliant behavior for an
  // element with touch-action allowing that axis) -- an unguarded handler
  // here was resetting isInteracting back to false ~20ms into every touch
  // gesture, re-enabling the auto-scroll loop to fight the user's finger
  // for the rest of the swipe. This was the real cause of "swipe barely
  // moves anything" (auto-scroll and native touch-scroll both writing to
  // scrollLeft every frame) and, at narrow/iPhone widths, of it feeling
  // completely stuck (small net movement is imperceptible when a single
  // card already fills most of the visible frame).
  const endMouseDrag = (e) => {
    if (e.pointerType && e.pointerType !== 'mouse') return;
    isDragging = false;
    isInteracting = false;
    syncAutoPos();
    reviewsMarquee.classList.remove('dragging');
  };
  reviewsMarquee.addEventListener('pointerup', endMouseDrag);
  reviewsMarquee.addEventListener('pointercancel', endMouseDrag);
  reviewsMarquee.addEventListener('pointerleave', endMouseDrag);

  // Touch: pause auto-scroll while a finger is on it, resume on release
  reviewsMarquee.addEventListener('touchstart', () => { isInteracting = true; }, { passive: true });
  reviewsMarquee.addEventListener('touchend', () => { isInteracting = false; syncAutoPos(); }, { passive: true });
  reviewsMarquee.addEventListener('touchcancel', () => { isInteracting = false; syncAutoPos(); }, { passive: true });

  // Trackpad / mouse-wheel horizontal scroll (the normal way to scroll a
  // horizontal element on a Mac -- a two-finger swipe, not a click-drag).
  // This was never treated as "interacting" at all, so the RAF loop kept
  // forcing scrollLeft back to its own auto-scroll position on every frame
  // while a trackpad gesture was simultaneously trying to move it -- the
  // two fought over scrollLeft 60 times a second. Wheel events don't have a
  // clean start/end like pointer or touch events (they just stop firing
  // when the gesture ends), so debounce: treat it as interacting for a
  // short idle window after the last wheel event.
  let wheelIdleTimer = null;
  reviewsMarquee.addEventListener('wheel', () => {
    isInteracting = true;
    clearTimeout(wheelIdleTimer);
    wheelIdleTimer = setTimeout(() => {
      isInteracting = false;
      syncAutoPos();
    }, 150);
  }, { passive: true });
})();
