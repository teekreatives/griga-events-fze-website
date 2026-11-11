document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryCards = document.querySelectorAll('.gallery-card');
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImage = lightbox?.querySelector('.lightbox-media img');
  const filenameEl = lightbox?.querySelector('.lightbox-filename');
  const downloadLink = lightbox?.querySelector('.lightbox-download');
  const heartButton = lightbox?.querySelector('.lightbox-heart');
  const shareButton = lightbox?.querySelector('.lightbox-share');
  const savedPhotos = new Set();
  const lightboxMedia = lightbox?.querySelector('.lightbox-media');
  const phoneQuery = window.matchMedia('(max-width: 960px)');
  let activeFilter = 'all';
  let activeCard = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchDeltaX = 0;
  let touchAxis = '';
  let swipeToken = 0;

  const setFilter = (filter) => {
    activeFilter = filter;
    galleryCards.forEach((card) => {
      const category = card.getAttribute('data-category');
      const isVideo = category === 'videos';
      const isVisible =
        filter === 'all' ? !isVideo :
        filter === 'videos' ? isVideo :
        category === filter;
      card.style.display = isVisible ? 'block' : 'none';
      card.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
    });
  };

  filterButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const filter = button.getAttribute('data-filter');
      if (!filter || filter === activeFilter) return;
      filterButtons.forEach((btn) => {
        btn.classList.toggle('active', btn === button);
        btn.setAttribute('aria-pressed', String(btn === button));
      });
      setFilter(filter);
    });
  });

  const visibleCards = () =>
    Array.from(galleryCards).filter((card) => getComputedStyle(card).display !== 'none');

  const fullSrcFor = (fileName) =>
    `assets/media/images/smoke-8th-edition-pics/${encodeURIComponent(fileName).replace(/%2F/g, '/')}`;

  const showCard = (card) => {
    if (!lightbox || !lightboxImage) return;
    const sourceImg = card.querySelector('img');
    if (!sourceImg) return;
    const fileName = card.getAttribute('data-file') || '';
    const previewSrc = sourceImg.currentSrc || sourceImg.src;
    const fullSrc = fileName ? fullSrcFor(fileName) : previewSrc;
    activeCard = card;
    lightbox.dataset.currentFile = fileName || fullSrc;
    lightboxImage.src = previewSrc;
    lightboxImage.alt = sourceImg.alt;
    if (filenameEl) {
      filenameEl.textContent = fileName;
    }
    if (downloadLink) {
      downloadLink.href = fullSrc;
      downloadLink.setAttribute('download', fileName || 'photo.jpg');
    }
    if (heartButton) {
      heartButton.setAttribute('aria-pressed', savedPhotos.has(fileName || fullSrc) ? 'true' : 'false');
    }
    if (fileName && fullSrc !== previewSrc) {
      const fullImage = new Image();
      fullImage.onload = () => {
        if (lightbox.dataset.currentFile === fileName) {
          lightboxImage.src = fullSrc;
        }
      };
      fullImage.src = fullSrc;
    }
  };

  const openLightbox = (card) => {
    if (!lightbox || !lightboxImage) return;
    swipeToken += 1;
    showCard(card);
    if (lightboxImage) {
      lightboxImage.style.transition = '';
      lightboxImage.style.transform = '';
    }
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    swipeToken += 1;
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
    touchAxis = '';
    if (lightboxImage) {
      lightboxImage.style.transition = '';
      lightboxImage.style.transform = '';
    }
  };

  const stepCard = (direction) => {
    const cards = visibleCards();
    if (!cards.length) return;
    const index = cards.indexOf(activeCard);
    const start = index < 0 ? 0 : index;
    const next = cards[(start + direction + cards.length) % cards.length];
    showCard(next);
    if (lightboxImage) {
      lightboxImage.style.transition = 'none';
      lightboxImage.style.transform = '';
    }
  };

  galleryCards.forEach((card) => {
    card.addEventListener('click', () => openLightbox(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openLightbox(card);
      }
    });
  });

  lightbox?.querySelectorAll('[data-lightbox-close]').forEach((button) => {
    button.addEventListener('click', closeLightbox);
  });

  if (lightbox) {
    lightbox.addEventListener('click', (event) => {
      if (event.target === lightbox) {
        closeLightbox();
      }
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeLightbox();
    }
  });

  if (lightbox && lightboxMedia && lightboxImage) {
    const resetSwipe = () => {
      touchAxis = '';
      touchDeltaX = 0;
      lightboxImage.style.transition = 'transform 0.2s ease';
      lightboxImage.style.transform = '';
      lightboxImage.style.opacity = '';
    };

    lightboxMedia.addEventListener('touchstart', (event) => {
      if (!lightbox.classList.contains('open') || !phoneQuery.matches || event.touches.length !== 1) return;
      swipeToken += 1;
      const touch = event.touches[0];
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      touchDeltaX = 0;
      touchAxis = 'pending';
      lightboxImage.style.transition = 'none';
      lightboxImage.style.opacity = '';
    }, { passive: true });

    lightboxMedia.addEventListener('touchmove', (event) => {
      if (touchAxis === '' || event.touches.length !== 1) return;
      const touch = event.touches[0];
      const deltaX = touch.clientX - touchStartX;
      const deltaY = touch.clientY - touchStartY;
      if (touchAxis === 'pending') {
        if (Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
        touchAxis = Math.abs(deltaX) > Math.abs(deltaY) ? 'x' : 'y';
      }
      if (touchAxis !== 'x') return;
      event.preventDefault();
      touchDeltaX = deltaX;
      lightboxImage.style.transform = `translate3d(${deltaX}px, 0, 0)`;
    }, { passive: false });

    lightboxMedia.addEventListener('touchend', () => {
      if (touchAxis !== 'x') {
        if (touchAxis !== '') resetSwipe();
        return;
      }
      const direction = touchDeltaX <= -48 ? 1 : touchDeltaX >= 48 ? -1 : 0;
      touchAxis = '';
      touchDeltaX = 0;
      if (!direction) {
        resetSwipe();
        return;
      }
      const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reduceMotion) {
        stepCard(direction);
        return;
      }
      const token = ++swipeToken;
      const width = lightboxMedia.clientWidth || window.innerWidth;
      lightboxImage.style.transition = 'transform 0.18s ease';
      lightboxImage.style.transform = `translate3d(${direction > 0 ? -width : width}px, 0, 0)`;
      window.setTimeout(() => {
        if (token !== swipeToken || !lightbox.classList.contains('open')) return;
        lightboxImage.style.opacity = '0';
        stepCard(direction);
        window.requestAnimationFrame(() => {
          if (token !== swipeToken) return;
          lightboxImage.style.opacity = '';
        });
      }, 180);
    });

    lightboxMedia.addEventListener('touchcancel', () => {
      if (touchAxis === '') return;
      swipeToken += 1;
      resetSwipe();
    });
  }

  if (heartButton) {
    heartButton.addEventListener('click', () => {
      const key = lightbox?.dataset.currentFile;
      if (!key) return;
      const saved = savedPhotos.has(key);
      if (saved) {
        savedPhotos.delete(key);
      } else {
        savedPhotos.add(key);
      }
      heartButton.setAttribute('aria-pressed', saved ? 'false' : 'true');
    });
  }

  if (shareButton) {
    shareButton.addEventListener('click', async () => {
      const fileName = filenameEl?.textContent || 'Edition 8 photo';
      const href = downloadLink?.href;
      if (!href) return;
      const url = new URL(href, window.location.href).href;
      if (navigator.share) {
        try {
          await navigator.share({ title: fileName, url });
        } catch (error) {
          if (error && error.name === 'AbortError') return;
        }
        return;
      }
      window.open(url, '_blank', 'noopener');
    });
  }

  if (filterButtons.length) {
    setFilter('all');
  }
});
