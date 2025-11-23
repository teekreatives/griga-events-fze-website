document.addEventListener('DOMContentLoaded', () => {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryCards = document.querySelectorAll('.gallery-card');
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxImage = lightbox?.querySelector('.lightbox-media img');
  const lightboxCaption = lightbox?.querySelector('.lightbox-caption');
  const closeButton = lightbox?.querySelector('[data-lightbox-close]');
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
    lightboxImage.src = sourceImg.src;
    lightboxImage.alt = sourceImg.alt;
    if (lightboxCaption) {
      lightboxCaption.textContent = '';
    }
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

  if (closeButton) {
    closeButton.addEventListener('click', closeLightbox);
  }

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

  setFilter('all');
});
