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
  let activeFilter = 'all';

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

  const openLightbox = (card) => {
    if (!lightbox || !lightboxImage) return;
    const sourceImg = card.querySelector('img');
    if (!sourceImg) return;
    const fileName = card.getAttribute('data-file');
    const fullSrc = fileName
      ? `assets/media/images/smoke-8th-edition-pics/${encodeURIComponent(fileName).replace(/%2F/g, '/')}`
      : sourceImg.currentSrc || sourceImg.src;
    lightboxImage.src = fullSrc;
    lightboxImage.alt = sourceImg.alt;
    if (filenameEl) {
      filenameEl.textContent = fileName || '';
    }
    if (downloadLink) {
      downloadLink.href = fullSrc;
      downloadLink.setAttribute('download', fileName || 'photo.jpg');
    }
    if (heartButton) {
      heartButton.setAttribute('aria-pressed', savedPhotos.has(fileName || fullSrc) ? 'true' : 'false');
    }
    lightbox.dataset.currentFile = fileName || fullSrc;
    lightbox.setAttribute('aria-hidden', 'false');
    lightbox.classList.add('open');
    document.body.style.overflow = 'hidden';
  };

  const closeLightbox = () => {
    if (!lightbox) return;
    lightbox.setAttribute('aria-hidden', 'true');
    lightbox.classList.remove('open');
    document.body.style.overflow = '';
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
