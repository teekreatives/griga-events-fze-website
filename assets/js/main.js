// GRIGA Events FZE - Core interactions

// Helper: on DOM ready
function onReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn);
  } else {
    fn();
  }
}

onReady(function () {
  // Sticky header shrink
  var header = document.getElementById('site-header');
  var backToTop = document.querySelector('.back-to-top');

  function handleScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) {
      if (y > 80) {
        header.classList.add('shrink');
      } else {
        header.classList.remove('shrink');
      }
    }

    if (backToTop) {
      if (y > 300) {
        backToTop.classList.add('visible');
      } else {
        backToTop.classList.remove('visible');
      }
    }
  }

  window.addEventListener('scroll', handleScroll);
  handleScroll();

  // Back to top
  if (backToTop) {
    backToTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Mobile nav toggle
  var navToggle = document.querySelector('.nav-toggle');
  var navLinks = document.querySelector('.nav-links');

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navToggle.classList.toggle('open');
      navLinks.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && navToggle.classList.contains('open')) {
        navToggle.classList.remove('open');
        navLinks.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Year in footer
  var yearEl = document.getElementById('year');
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }

  // Featured events slider
  if (typeof Swiper !== 'undefined') {
    var featuredEl = document.querySelector('.featured-swiper');
    if (featuredEl) {
      new Swiper(featuredEl, {
        slidesPerView: 1,
        spaceBetween: 24,
        centeredSlides: true,
        loop: true,
        pagination: {
          el: '.swiper-pagination',
          clickable: true
        },
        breakpoints: {
          768: {
            slidesPerView: 1
          },
          1024: {
            slidesPerView: 1
          }
        }
      });
    }
  }

  // Simple stat count-up animation
  var statEls = document.querySelectorAll('.stat-number[data-count]');
  var statsAnimated = false;

  function animateStats() {
    if (statsAnimated) return;
    var statsSection = document.getElementById('stats');
    if (!statsSection) return;

    var rect = statsSection.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.8) {
      statsAnimated = true;
      statEls.forEach(function (el) {
        var targetText = String(el.getAttribute('data-count'));
        var numeric = parseInt(targetText, 10) || 0;
        var suffix = '';
        if (targetText.endsWith('+')) suffix = '+';

        var duration = 1200;
        var start = null;

        function step(timestamp) {
          if (!start) start = timestamp;
          var progress = Math.min((timestamp - start) / duration, 1);
          var value = Math.floor(progress * numeric);
          el.textContent = value + suffix;
          if (progress < 1) {
            window.requestAnimationFrame(step);
          }
        }

        window.requestAnimationFrame(step);
      });
    }
  }

  window.addEventListener('scroll', animateStats);
  animateStats();

  var heroSection = document.querySelector('.hero#top');
  var heroContent = heroSection ? heroSection.querySelector('.hero-content') : null;
  var heroVideo = heroSection ? heroSection.querySelector('.hero-video') : null;
  var heroHeadingVisible = false;
  var LOGO_ANIMATION_DURATION = 16;
  var DEFAULT_VIDEO_DURATION = 60;

  function applyHeroVisibility(shouldShow) {
    if (!heroContent) return;
    if (shouldShow && !heroHeadingVisible) {
      heroContent.classList.add('hero-heading-visible');
      heroHeadingVisible = true;
    } else if (!shouldShow && heroHeadingVisible) {
      heroContent.classList.remove('hero-heading-visible');
      heroHeadingVisible = false;
    }
  }

  function evaluateHeroVisibility() {
    if (!heroContent) return;

    if (!heroVideo) {
      applyHeroVisibility(true);
      return;
    }

    var duration = heroVideo.duration;
    if (!duration || !isFinite(duration)) {
      duration = DEFAULT_VIDEO_DURATION;
    }

    var normalizedTime = heroVideo.currentTime % duration;
    var isDuringLogo = normalizedTime < LOGO_ANIMATION_DURATION;

    applyHeroVisibility(!isDuringLogo);
  }

  function startHeroVideoWatch() {
    if (!heroContent) return;

    evaluateHeroVisibility();

    if (!heroVideo) return;

    var updateVisibility = function () {
      evaluateHeroVisibility();
    };

    heroVideo.addEventListener('timeupdate', updateVisibility);
    heroVideo.addEventListener('playing', updateVisibility);
    heroVideo.addEventListener('seeked', updateVisibility);
    heroVideo.addEventListener('loadedmetadata', updateVisibility);
    heroVideo.addEventListener('ended', updateVisibility);
  }

  startHeroVideoWatch();

  // AOS init
  if (typeof AOS !== 'undefined') {
    AOS.init({
      duration: 700,
      once: true,
      offset: 80
    });
  }
});
