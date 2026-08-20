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

// Gallery carousel
// Replace `src: null` with the real image path once photos are ready
// (e.g. { label: '** תמונת אימון 1 **', src: 'assets/gallery-1.jpg' })
const galleryImages = [
  { label: '** תמונת אימון 1 **', src: null },
  { label: '** תמונת אימון 2 **', src: null },
  { label: '** תמונת אימון 3 **', src: null },
  { label: '** תמונת אימון 4 **', src: null },
  { label: '** תמונת אימון 5 **', src: null },
  { label: '** תמונת אימון 6 **', src: null },
];

const galleryMain = document.getElementById('galleryMain');
const galleryMainLabel = document.getElementById('galleryMainLabel');
const galleryThumbs = document.getElementById('galleryThumbs');
const galleryPrev = document.getElementById('galleryPrev');
const galleryNext = document.getElementById('galleryNext');

let galleryIndex = 0;

function renderGallery(index) {
  galleryIndex = (index + galleryImages.length) % galleryImages.length;
  const image = galleryImages[galleryIndex];

  galleryMain.querySelector('img')?.remove();
  if (image.src) {
    const img = document.createElement('img');
    img.src = image.src;
    img.alt = image.label;
    galleryMainLabel.style.display = 'none';
    galleryMain.prepend(img);
  } else {
    galleryMainLabel.textContent = image.label;
    galleryMainLabel.style.display = '';
  }

  galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === galleryIndex);
  });
}

if (galleryMain) {
  galleryPrev.addEventListener('click', () => renderGallery(galleryIndex - 1));
  galleryNext.addEventListener('click', () => renderGallery(galleryIndex + 1));
  galleryThumbs.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.addEventListener('click', () => renderGallery(i));
  });
  renderGallery(0);

  // Swipe / drag to move between images (mouse + touch + iPhone Safari)
  let dragStartX = null;
  const swipeThreshold = 40;

  galleryMain.addEventListener('pointerdown', (e) => {
    dragStartX = e.clientX;
    galleryMain.setPointerCapture(e.pointerId);
  });
  galleryMain.addEventListener('pointerup', (e) => {
    if (dragStartX === null) return;
    const dx = e.clientX - dragStartX;
    dragStartX = null;
    if (dx > swipeThreshold) renderGallery(galleryIndex - 1);
    else if (dx < -swipeThreshold) renderGallery(galleryIndex + 1);
  });
  galleryMain.addEventListener('pointercancel', () => { dragStartX = null; });
}

// Reviews: auto-scrolls on its own, but can also be dragged/swiped by hand.
// Content is duplicated in the HTML (see #reviewsTrack) so the scroll position
// can wrap seamlessly for a true infinite loop, whether it moved by the
// animation loop, a mouse drag, or native touch scrolling.
const reviewsMarquee = document.querySelector('.reviews-marquee');
const reviewsTrack = document.getElementById('reviewsTrack');

if (reviewsMarquee && reviewsTrack) {
  let isInteracting = false;
  let isDragging = false;
  let dragStartX = 0;
  let scrollStart = 0;
  const autoScrollSpeed = 0.6; // px per frame

  function wrapReviewsScroll() {
    const halfWidth = reviewsTrack.scrollWidth / 2;
    if (reviewsMarquee.scrollLeft <= -halfWidth) {
      reviewsMarquee.scrollLeft += halfWidth;
    } else if (reviewsMarquee.scrollLeft > 0) {
      reviewsMarquee.scrollLeft -= halfWidth;
    }
  }

  function tick() {
    if (!isInteracting) {
      reviewsMarquee.scrollLeft -= autoScrollSpeed;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  reviewsMarquee.addEventListener('scroll', wrapReviewsScroll);

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
  const endMouseDrag = () => {
    isDragging = false;
    isInteracting = false;
    reviewsMarquee.classList.remove('dragging');
  };
  reviewsMarquee.addEventListener('pointerup', endMouseDrag);
  reviewsMarquee.addEventListener('pointercancel', endMouseDrag);
  reviewsMarquee.addEventListener('pointerleave', endMouseDrag);

  // Touch: pause auto-scroll while a finger is on it, resume on release
  reviewsMarquee.addEventListener('touchstart', () => { isInteracting = true; }, { passive: true });
  reviewsMarquee.addEventListener('touchend', () => { isInteracting = false; }, { passive: true });
  reviewsMarquee.addEventListener('touchcancel', () => { isInteracting = false; }, { passive: true });
}
