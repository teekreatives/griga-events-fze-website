/**
 * GRIGA Events FZE – Shop interactions
 * Cart, gallery, checkout UI (backend-ready architecture)
 */
(function () {
  'use strict';

  var CART_KEY = 'griga_shop_cart';

  var state = {
    product: null,
    variant: 'men',
    size: null,
    quantity: 1,
    galleryIndex: 0,
    cart: [],
    checkoutStep: 1,
    paymentMethod: null,
    order: null,
    gallerySwiper: null
  };

  var els = {};

  function $(id) {
    return document.getElementById(id);
  }

  function formatPrice(amount) {
    if (window.SHOP_CATALOG && SHOP_CATALOG.formatPrice) {
      return SHOP_CATALOG.formatPrice(amount, state.product ? state.product.currency : 'AED');
    }
    return 'AED ' + amount;
  }

  function getVariantImages() {
    if (!state.product) return [];
    var variant = state.product.variants.find(function (v) {
      return v.id === state.variant;
    });
    return variant ? variant.images : state.product.variants[0].images;
  }

  function getCurrentImage() {
    var images = getVariantImages();
    return images[state.galleryIndex] || images[0];
  }

  function saveCart() {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    } catch (e) {
      /* storage unavailable */
    }
  }

  function loadCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      state.cart = raw ? JSON.parse(raw) : [];
    } catch (e) {
      state.cart = [];
    }
  }

  function cartCount() {
    return state.cart.reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function cartSubtotal() {
    return state.cart.reduce(function (sum, item) {
      return sum + item.price * item.quantity;
    }, 0);
  }

  function generateOrderId() {
    return 'GRG-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);
  }

  function validateSelection() {
    if (!state.size) {
      showToast('Please select a size.');
      return false;
    }
    return true;
  }

  function scrollToGallery() {
    var gallery = document.getElementById('shop-gallery');
    if (!gallery) return;

    var header = document.getElementById('site-header');
    var offset = header ? header.offsetHeight + 16 : 96;
    var top = gallery.getBoundingClientRect().top + window.pageYOffset - offset;

    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }

  function scrollToPaymentDetails() {
    if (!window.matchMedia('(max-width: 768px)').matches) return;

    var panel = $('shop-payment-detail-panel');
    var scrollContainer = document.querySelector('.shop-checkout-panel');
    if (!panel || panel.hidden || !scrollContainer) return;

    requestAnimationFrame(function () {
      setTimeout(function () {
        var containerRect = scrollContainer.getBoundingClientRect();
        var panelRect = panel.getBoundingClientRect();
        var target = panelRect.top - containerRect.top + scrollContainer.scrollTop - 20;
        scrollContainer.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
      }, 120);
    });
  }

  function showToast(message) {
    var toast = els.toast;
    if (!toast) {
      window.alert(message);
      return;
    }
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, 2800);
  }

  /* ── Gallery ── */

  function encodeSrc(path) {
    return encodeURI(path).replace(/#/g, '%23');
  }

  function getThumbSrc(img) {
    return img.thumb || img.src;
  }

  function loadSlideImage(index) {
    var wrapper = $('shop-gallery-swiper-wrapper');
    if (!wrapper || index < 0 || index >= wrapper.children.length) return;

    var imgEl = wrapper.children[index].querySelector('img');
    if (!imgEl || imgEl.getAttribute('src')) return;

    var src = imgEl.getAttribute('data-src');
    if (src) imgEl.setAttribute('src', src);
  }

  function preloadNearbySlides(activeIndex) {
    loadSlideImage(activeIndex);
    loadSlideImage(activeIndex + 1);
    loadSlideImage(activeIndex - 1);
  }

  function buildSlidesHtml(images) {
    return images
      .map(function (img, i) {
        var alt = img.alt.replace(/"/g, '&quot;');
        if (i === 0) {
          return (
            '<div class="swiper-slide">' +
            '<img src="' +
            encodeSrc(img.src) +
            '" alt="' +
            alt +
            '" decoding="async" fetchpriority="high" />' +
            '</div>'
          );
        }
        return (
          '<div class="swiper-slide">' +
          '<img data-src="' +
          encodeSrc(img.src) +
          '" alt="' +
          alt +
          '" decoding="async" class="shop-slide-lazy" />' +
          '</div>'
        );
      })
      .join('');
  }

  function initMobileSwiper() {
    if (typeof Swiper === 'undefined') return;

    if (state.gallerySwiper) {
      state.gallerySwiper.destroy(true, true);
      state.gallerySwiper = null;
    }

    var swiperEl = document.querySelector('.shop-gallery-swiper');
    if (!swiperEl) return;

    state.gallerySwiper = new Swiper(swiperEl, {
      slidesPerView: 1,
      spaceBetween: 0,
      speed: 400,
      initialSlide: state.galleryIndex,
      observer: true,
      observeParents: true,
      on: {
        init: function (sw) {
          preloadNearbySlides(sw.activeIndex);
        },
        slideChange: function (sw) {
          state.galleryIndex = sw.activeIndex;
          renderGalleryThumbsOnly();
          preloadNearbySlides(sw.activeIndex);
          if (els.galleryMainImg) {
            var img = getVariantImages()[state.galleryIndex];
            if (img) {
              els.galleryMainImg.src = encodeSrc(img.src);
              els.galleryMainImg.alt = img.alt;
            }
          }
        }
      }
    });
  }

  function ensureMobileSwiper(images) {
    var wrapper = $('shop-gallery-swiper-wrapper');
    if (!wrapper) return;

    wrapper.innerHTML = buildSlidesHtml(images);
    initMobileSwiper();
    syncSwiper();
    preloadNearbySlides(state.galleryIndex);
  }

  function renderThumbs(images) {
    if (!els.thumbsContainer) return;

    els.thumbsContainer.innerHTML = images
      .map(function (img, i) {
        var isActive = i === state.galleryIndex;
        var isFirst = i === 0;
        return (
          '<button type="button" class="shop-thumb' +
          (isActive ? ' is-active' : '') +
          '" data-index="' +
          i +
          '" aria-label="View image ' +
          (i + 1) +
          '">' +
          '<img src="' +
          encodeSrc(getThumbSrc(img)) +
          '" alt="" ' +
          (isFirst ? 'decoding="async"' : 'loading="lazy" decoding="async"') +
          ' width="72" height="72" />' +
          '</button>'
        );
      })
      .join('');

    els.thumbsContainer.querySelectorAll('.shop-thumb').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.galleryIndex = parseInt(btn.dataset.index, 10);
        renderGalleryThumbsOnly();
        preloadNearbySlides(state.galleryIndex);
        if (els.galleryMainImg) {
          var img = getVariantImages()[state.galleryIndex];
          els.galleryMainImg.src = encodeSrc(img.src);
          els.galleryMainImg.alt = img.alt;
        }
        syncSwiper();
      });
    });
  }

  function renderGalleryThumbsOnly() {
    if (!els.thumbsContainer) return;
    els.thumbsContainer.querySelectorAll('.shop-thumb').forEach(function (btn, i) {
      btn.classList.toggle('is-active', i === state.galleryIndex);
    });
  }

  function syncSwiper() {
    if (state.gallerySwiper && typeof state.gallerySwiper.slideTo === 'function') {
      state.gallerySwiper.slideTo(state.galleryIndex, 300);
    }
  }

  /* ── Product UI ── */

  function renderProduct() {
    if (!state.product || !els.productRoot) return;

    var p = state.product;

    var images = getVariantImages();

    els.productRoot.innerHTML =
      '<div class="shop-gallery shop-reveal" id="shop-gallery">' +
      '<div class="shop-gallery-main">' +
      '<div class="shop-gallery-zoom shop-gallery-desktop">' +
      '<img id="shop-gallery-main-img" src="' +
      encodeSrc(getCurrentImage().src) +
      '" alt="' +
      getCurrentImage().alt.replace(/"/g, '&quot;') +
      '" decoding="async" fetchpriority="high" width="1200" height="1200" />' +
      '</div>' +
      '<div class="swiper shop-gallery-swiper shop-gallery-mobile">' +
      '<div class="swiper-wrapper" id="shop-gallery-swiper-wrapper">' +
      buildSlidesHtml(images) +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div class="shop-gallery-thumbs" id="shop-gallery-thumbs" role="tablist" aria-label="Product images"></div>' +
      '</div>' +
      '<div class="shop-product-details shop-reveal">' +
      '<p class="eyebrow shop-product-eyebrow">Official Event Merchandise</p>' +
      '<h2 class="shop-product-title">' +
      p.name +
      '</h2>' +
      '<p class="shop-product-price" id="shop-price">' +
      formatPrice(p.price) +
      '</p>' +
      '<p class="shop-product-desc">' +
      p.shortDescription +
      '</p>' +
      '<fieldset class="shop-variant-fieldset">' +
      '<span class="shop-field-label">Variant</span>' +
      '<div class="shop-variant-group" role="radiogroup" aria-label="Jersey variant">' +
      p.variants
        .map(function (v) {
          return (
            '<button type="button" class="shop-variant-btn' +
            (v.id === state.variant ? ' is-active' : '') +
            '" data-variant="' +
            v.id +
            '" role="radio" aria-checked="' +
            (v.id === state.variant) +
            '">' +
            v.label +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '</fieldset>' +
      '<fieldset class="shop-size-fieldset">' +
      '<span class="shop-field-label">Size</span>' +
      '<div class="shop-size-group" role="radiogroup" aria-label="Jersey size">' +
      p.sizes
        .map(function (s) {
          return (
            '<button type="button" class="shop-size-btn' +
            (s === state.size ? ' is-active' : '') +
            '" data-size="' +
            s +
            '" role="radio" aria-checked="' +
            (s === state.size) +
            '">' +
            s +
            '</button>'
          );
        })
        .join('') +
      '</div>' +
      '</fieldset>' +
      '<div class="shop-qty-row">' +
      '<div><span class="shop-field-label">Quantity</span>' +
      '<div class="shop-qty-control">' +
      '<button type="button" class="shop-qty-btn" id="shop-qty-minus" aria-label="Decrease quantity">−</button>' +
      '<span class="shop-qty-value" id="shop-qty-value">' +
      state.quantity +
      '</span>' +
      '<button type="button" class="shop-qty-btn" id="shop-qty-plus" aria-label="Increase quantity">+</button>' +
      '</div></div>' +
      (p.inStock
        ? '<p class="shop-stock"><span class="shop-stock-icon" aria-hidden="true">✓</span> Available</p>'
        : '<p class="shop-stock" style="color:#c0392b">Out of Stock</p>') +
      '</div>' +
      '<div class="shop-actions">' +
      '<button type="button" class="btn btn-primary" id="shop-add-cart">Add to Cart</button>' +
      '<button type="button" class="btn btn-shop-outline" id="shop-buy-now">Buy Now</button>' +
      '</div>' +
      '</div>';

    els.galleryMainImg = $('shop-gallery-main-img');
    els.thumbsContainer = $('shop-gallery-thumbs');

    bindProductEvents();
    renderThumbs(images);
    initMobileSwiper();
    preloadNearbySlides(state.galleryIndex);
  }

  function bindProductEvents() {
    document.querySelectorAll('.shop-variant-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.variant = btn.dataset.variant;
        state.galleryIndex = 0;
        document.querySelectorAll('.shop-variant-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
        if (state.gallerySwiper) {
          state.gallerySwiper.destroy(true, true);
          state.gallerySwiper = null;
        }
        renderThumbs(getVariantImages());
        ensureMobileSwiper(getVariantImages());
        if (els.galleryMainImg) {
          var first = getCurrentImage();
          els.galleryMainImg.src = encodeSrc(first.src);
          els.galleryMainImg.alt = first.alt;
        }
        scrollToGallery();
      });
    });

    document.querySelectorAll('.shop-size-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        state.size = btn.dataset.size;
        document.querySelectorAll('.shop-size-btn').forEach(function (b) {
          b.classList.toggle('is-active', b === btn);
          b.setAttribute('aria-checked', b === btn ? 'true' : 'false');
        });
      });
    });

    var minus = $('shop-qty-minus');
    var plus = $('shop-qty-plus');
    var qtyVal = $('shop-qty-value');

    if (minus) {
      minus.addEventListener('click', function () {
        if (state.quantity > 1) {
          state.quantity -= 1;
          qtyVal.textContent = state.quantity;
        }
      });
    }

    if (plus) {
      plus.addEventListener('click', function () {
        if (state.quantity < 10) {
          state.quantity += 1;
          qtyVal.textContent = state.quantity;
        }
      });
    }

    var addBtn = $('shop-add-cart');
    var buyBtn = $('shop-buy-now');

    if (addBtn) addBtn.addEventListener('click', function () {
      addToCart(false);
    });
    if (buyBtn) buyBtn.addEventListener('click', function () {
      addToCart(true);
    });
  }

  function buildCartItem() {
    var img = getCurrentImage();
    var variantLabel =
      state.product.variants.find(function (v) {
        return v.id === state.variant;
      }).label || state.variant;

    return {
      productId: state.product.id,
      name: state.product.name,
      variant: state.variant,
      variantLabel: variantLabel,
      size: state.size,
      quantity: state.quantity,
      price: state.product.price,
      currency: state.product.currency,
      image: img.src
    };
  }

  function addToCart(openCheckout) {
    if (!validateSelection()) return;

    var item = buildCartItem();
    var existing = state.cart.findIndex(function (c) {
      return c.productId === item.productId && c.variant === item.variant && c.size === item.size;
    });

    if (existing >= 0) {
      state.cart[existing].quantity += item.quantity;
    } else {
      state.cart.push(item);
    }

    saveCart();
    updateCartUI();

    if (openCheckout) {
      openCart(false);
      openCheckoutModal();
    } else {
      openCart(true);
      showToast('Added to cart');
    }
  }

  /* ── Cart drawer ── */

  function updateCartUI() {
    var count = cartCount();
    if (els.cartCount) {
      els.cartCount.textContent = count;
      els.cartCount.classList.toggle('is-visible', count > 0);
    }

    if (!els.cartItems) return;

    if (!state.cart.length) {
      els.cartItems.innerHTML = '<p class="shop-drawer-empty">Your cart is empty.</p>';
      if (els.cartSubtotal) els.cartSubtotal.textContent = formatPrice(0);
      if (els.cartTotal) els.cartTotal.textContent = formatPrice(0);
      if (els.checkoutBtn) els.checkoutBtn.disabled = true;
      return;
    }

    if (els.checkoutBtn) els.checkoutBtn.disabled = false;

    els.cartItems.innerHTML = state.cart
      .map(function (item, index) {
        return (
          '<article class="shop-cart-item">' +
          '<div class="shop-cart-item-thumb"><img src="' +
          item.image +
          '" alt="" loading="lazy" decoding="async" /></div>' +
          '<div class="shop-cart-item-info">' +
          '<h4>' +
          item.name +
          '</h4>' +
          '<p class="shop-cart-item-meta">' +
          item.variantLabel +
          ' · Size ' +
          item.size +
          ' · Qty ' +
          item.quantity +
          '</p>' +
          '<p class="shop-cart-item-price">' +
          formatPrice(item.price * item.quantity) +
          '</p>' +
          '</div>' +
          '<button type="button" class="shop-cart-item-remove" data-index="' +
          index +
          '" aria-label="Remove item">Remove</button>' +
          '</article>'
        );
      })
      .join('');

    els.cartItems.querySelectorAll('.shop-cart-item-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.dataset.index, 10);
        state.cart.splice(idx, 1);
        saveCart();
        updateCartUI();
      });
    });

    var sub = cartSubtotal();
    if (els.cartSubtotal) els.cartSubtotal.textContent = formatPrice(sub);
    if (els.cartTotal) els.cartTotal.textContent = formatPrice(sub);
  }

  function openCart(show) {
    els.drawer.classList.toggle('is-open', show);
    els.overlay.classList.toggle('is-open', show);
    document.body.classList.toggle('shop-drawer-open', show);
    if (show) els.drawer.setAttribute('aria-hidden', 'false');
    else els.drawer.setAttribute('aria-hidden', 'true');
  }

  function closeCart() {
    openCart(false);
  }

  /* ── Checkout ── */

  function openCheckoutModal() {
    if (!state.cart.length) {
      showToast('Your cart is empty.');
      return;
    }
    state.checkoutStep = 1;
    state.paymentMethod = null;
    state.order = null;
    state.customer = null;
    var panel = $('shop-payment-detail-panel');
    if (panel) {
      panel.innerHTML = '';
      panel.hidden = true;
    }
    document.querySelectorAll('.shop-payment-card input').forEach(function (input) {
      input.checked = false;
    });
    document.querySelectorAll('.shop-payment-card').forEach(function (card) {
      card.classList.remove('is-selected');
    });
    renderCheckoutStep();
    els.checkout.classList.add('is-open');
    document.body.classList.add('shop-checkout-open');
    closeCart();
  }

  function closeCheckoutModal() {
    els.checkout.classList.remove('is-open');
    document.body.classList.remove('shop-checkout-open');
  }

  function renderCheckoutStep() {
    document.querySelectorAll('.shop-step').forEach(function (step) {
      var n = parseInt(step.dataset.step, 10);
      step.classList.toggle('is-active', n === state.checkoutStep);
      step.classList.toggle('is-complete', n < state.checkoutStep);
    });

    document.querySelectorAll('.shop-checkout-step').forEach(function (panel) {
      panel.classList.toggle('is-active', parseInt(panel.dataset.step, 10) === state.checkoutStep);
    });

    if (state.checkoutStep === 2) renderOrderReview();
    if (state.checkoutStep === 3) renderPaymentPanel();
    if (state.checkoutStep === 4) renderConfirmation();

    var backBtn = $('shop-checkout-back');
    var nextBtn = $('shop-checkout-next');
    if (backBtn) backBtn.style.visibility = state.checkoutStep === 1 ? 'hidden' : 'visible';
    if (nextBtn) {
      nextBtn.classList.add('btn-primary');
      nextBtn.classList.remove('btn-secondary');
      if (state.checkoutStep === 3) {
        nextBtn.style.display = '';
        if (state.paymentMethod) {
          nextBtn.textContent = 'Send proof via WhatsApp';
        } else {
          nextBtn.textContent = 'Place Order';
        }
      } else if (state.checkoutStep >= 4) {
        nextBtn.style.display = 'none';
      } else {
        nextBtn.style.display = '';
        nextBtn.textContent = 'Continue';
      }
    }
  }

  function getCheckoutAmountLabel() {
    if (window.SHOP_PAYMENTS && SHOP_PAYMENTS.formatAmount) {
      return SHOP_PAYMENTS.formatAmount(cartSubtotal(), state.product ? state.product.currency : 'AED');
    }
    return formatPrice(cartSubtotal());
  }

  function renderPaymentPanel() {
    var panel = $('shop-payment-detail-panel');
    if (!panel || !window.SHOP_PAYMENTS) return;

    if (!state.paymentMethod) {
      panel.innerHTML = '';
      panel.hidden = true;
      return;
    }

    var method = SHOP_PAYMENTS.getMethod(state.paymentMethod);
    if (!method) {
      panel.innerHTML = '';
      panel.hidden = true;
      return;
    }

    var amount = getCheckoutAmountLabel();
    panel.hidden = false;

    if (method.type === 'stripe') {
      panel.innerHTML =
        '<article class="payment-option payment-option--stripe shop-checkout-payment">' +
        '<h3>Stripe Checkout</h3>' +
        '<p>' +
        method.description +
        '</p>' +
        '<dl class="payment-details"><div><dt>Order Total</dt><dd>' +
        amount +
        '</dd></div></dl>' +
        '<div class="payment-actions">' +
        '<button type="button" class="btn btn-secondary" id="shop-stripe-pay">Pay via Card</button>' +
        '</div>' +
        '<p class="shop-payment-panel-note">Complete payment on Stripe, then click <strong>Send proof via WhatsApp</strong> below with your Stripe confirmation so we can process your jersey order.</p>' +
        '</article>';
      bindStripePayButton();
      scrollToPaymentDetails();
      return;
    }

    var details = method.details ? method.details() : [];
    var detailsHtml = details
      .map(function (row) {
        return '<div><dt>' + row.dt + '</dt><dd>' + row.dd + '</dd></div>';
      })
      .join('');

    if (method.amountDetail) {
      detailsHtml += '<div><dt>Amount</dt><dd>' + amount + '</dd></div>';
    }

    var heading = '<h3>' + method.label + '</h3>';
    if (method.logo && method.title) {
      heading =
        '<div class="payment-option__heading">' +
        '<img class="payment-option__logo" src="' +
        method.logo +
        '" alt="' +
        (method.logoAlt || '') +
        '" />' +
        '<span class="payment-option__title">' +
        method.title +
        '</span></div>';
    } else if (method.logo) {
      heading =
        '<div class="payment-option__heading">' +
        '<img class="payment-option__logo" src="' +
        method.logo +
        '" alt="' +
        (method.logoAlt || '') +
        '" />' +
        '<h3>' +
        method.label +
        '</h3></div>';
    }

    var copyInfo = method.copyInfo ? method.copyInfo(amount) : '';

    panel.innerHTML =
      '<article class="payment-option ' +
      method.cardClass +
      ' shop-checkout-payment">' +
      heading +
      '<p>' +
      method.intro(amount) +
      '</p>' +
      '<dl class="payment-details">' +
      detailsHtml +
      '</dl>' +
      '<div class="payment-actions">' +
      '<button type="button" class="btn btn-secondary" id="shop-copy-payment" data-payment-info="' +
      copyInfo.replace(/"/g, '&quot;') +
      '">Copy Details</button>' +
      '</div>' +
      '<p class="shop-payment-panel-note">After paying, click <strong>Send proof via WhatsApp</strong> below. We will verify and confirm your order.</p>' +
      '</article>';

    bindCopyPaymentButton();
    scrollToPaymentDetails();
  }

  function bindStripePayButton() {
    var payBtn = $('shop-stripe-pay');
    if (!payBtn) return;

    payBtn.addEventListener('click', openStripeCheckout);
  }

  function bindCopyPaymentButton() {
    var copyBtn = $('shop-copy-payment');
    if (!copyBtn) return;

    copyBtn.addEventListener('click', function () {
      var payload = copyBtn.getAttribute('data-payment-info');
      if (!payload) return;

      var original = copyBtn.textContent;
      var onCopied = function () {
        copyBtn.textContent = 'Copied';
        copyBtn.classList.add('copied');
        setTimeout(function () {
          copyBtn.textContent = original;
          copyBtn.classList.remove('copied');
        }, 2000);
      };

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(payload).then(onCopied).catch(function () {
          fallbackCopy(payload);
          onCopied();
        });
      } else {
        fallbackCopy(payload);
        onCopied();
      }
    });
  }

  function fallbackCopy(value) {
    var temp = document.createElement('textarea');
    temp.value = value;
    temp.setAttribute('readonly', '');
    temp.style.position = 'absolute';
    temp.style.left = '-9999px';
    document.body.appendChild(temp);
    temp.select();
    document.execCommand('copy');
    document.body.removeChild(temp);
  }

  function getPaymentMethodLabel(methodId) {
    var method = window.SHOP_PAYMENTS ? SHOP_PAYMENTS.getMethod(methodId) : null;
    return method ? method.label : methodId;
  }

  function renderOrderReview() {
    var container = $('shop-order-review');
    if (!container || !state.cart.length) return;

    var item = state.cart[0];
    var total = cartSubtotal();

    container.innerHTML =
      '<div class="shop-order-review-row shop-order-review-row--product">' +
      '<span class="shop-order-review-label">Product</span>' +
      '<span class="shop-order-review-value">' +
      item.name +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Variant</span>' +
      '<span class="shop-order-review-value">' +
      item.variantLabel +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Size</span>' +
      '<span class="shop-order-review-value">' +
      item.size +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Quantity</span>' +
      '<span class="shop-order-review-value">' +
      item.quantity +
      '</span></div>' +
      '<div class="shop-order-review-row">' +
      '<span class="shop-order-review-label">Total</span>' +
      '<span class="shop-order-review-value">' +
      formatPrice(total) +
      '</span></div>';
  }

  function renderConfirmation() {
    if (!state.order) return;
    var o = state.order;
    var container = $('shop-confirmation-content');
    if (!container) return;

    var isStripe = o.paymentMethod === 'stripe';
    var lead = isStripe
      ? 'Your order details have been sent via WhatsApp. Our team will verify your Stripe payment and confirm your order shortly.'
      : 'Your payment proof has been sent via WhatsApp. Our team will verify and confirm your order shortly.';

    container.innerHTML =
      '<div class="shop-confirmation">' +
      '<div class="shop-confirmation-icon" aria-hidden="true">✓</div>' +
      '<h3>Thank You For Your Order</h3>' +
      '<p>' +
      lead +
      '</p>' +
      '<div class="shop-confirmation-summary">' +
      '<div><strong>Order Number</strong><span>' +
      o.orderId +
      '</span></div>' +
      '<div><strong>Customer</strong><span>' +
      o.customerName +
      '</span></div>' +
      '<div><strong>Product</strong><span>' +
      o.productName +
      '</span></div>' +
      '<div><strong>Variant</strong><span>' +
      o.variant +
      ' · Size ' +
      o.size +
      '</span></div>' +
      '<div><strong>Payment</strong><span>' +
      getPaymentMethodLabel(o.paymentMethod) +
      '</span></div>' +
      '<div><strong>Total</strong><span>' +
      formatPrice(o.total) +
      '</span></div>' +
      '</div>' +
      '<p class="shop-confirmation-notice">A confirmation email will be sent to <strong>' +
      o.email +
      '</strong> once payment is verified.</p>' +
      '<div class="shop-confirmation-actions">' +
      (isStripe
        ? '<a href="' +
          (window.SHOP_PAYMENTS ? SHOP_PAYMENTS.stripeUrl : '#') +
          '" class="btn btn-primary" target="_blank" rel="noopener noreferrer">Open Stripe Again</a>'
        : '') +
      '<a href="#product-showcase" class="btn btn-secondary" id="shop-continue-shopping">Continue Shopping</a>' +
      '<a href="home.html" class="btn btn-secondary">Go Home</a>' +
      '</div>' +
      '</div>';

    var contBtn = $('shop-continue-shopping');
    if (contBtn) {
      contBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeCheckoutModal();
        document.getElementById('product-showcase').scrollIntoView({ behavior: 'smooth' });
      });
    }
  }

  function validateStep1() {
    var name = $('shop-customer-name').value.trim();
    var email = $('shop-customer-email').value.trim();
    var phone = $('shop-customer-phone').value.trim();
    var err = $('shop-form-error');

    if (!name || !email || !phone) {
      if (err) err.textContent = 'Please complete all fields.';
      return null;
    }
    if (!$('shop-customer-email').checkValidity()) {
      if (err) err.textContent = 'Please enter a valid email address.';
      return null;
    }
    if (err) err.textContent = '';
    return { name: name, email: email, phone: phone };
  }

  function finalizeOrder(customer, paymentMethod, orderId) {
    var item = state.cart[0];
    state.order = {
      orderId: orderId || generateOrderId(),
      customerName: customer.name,
      email: customer.email,
      phone: customer.phone,
      productName: item.name,
      variant: item.variantLabel,
      size: item.size,
      quantity: item.quantity,
      total: cartSubtotal(),
      currency: item.currency || 'AED',
      paymentMethod: paymentMethod,
      createdAt: new Date().toISOString()
    };

    console.info('[GRIGA Shop] Order submitted:', state.order);

    state.cart = [];
    saveCart();
    updateCartUI();
    state.checkoutStep = 4;
    renderCheckoutStep();
  }

  function buildOrderPayload() {
    var item = state.cart[0];
    if (!item) return null;

    return {
      orderId: generateOrderId(),
      customerName: state.customer.name,
      email: state.customer.email,
      phone: state.customer.phone,
      productName: item.name,
      variant: item.variantLabel,
      size: item.size,
      quantity: item.quantity,
      total: cartSubtotal(),
      currency: item.currency || 'AED'
    };
  }

  function validateCheckoutReady() {
    if (!state.paymentMethod) {
      showToast('Please select a payment method.');
      return false;
    }
    if (!state.customer) {
      showToast('Please complete your customer details.');
      state.checkoutStep = 1;
      renderCheckoutStep();
      return false;
    }
    if (!state.cart.length) {
      showToast('Your cart is empty.');
      return false;
    }
    return true;
  }

  function openStripeCheckout() {
    if (!validateCheckoutReady()) return;
    if (window.SHOP_PAYMENTS && SHOP_PAYMENTS.stripeUrl) {
      window.open(SHOP_PAYMENTS.stripeUrl, '_blank', 'noopener,noreferrer');
      showToast('Complete payment on Stripe, then send proof via WhatsApp.');
    }
  }

  function sendPaymentProofViaWhatsApp() {
    if (!validateCheckoutReady()) return;
    if (!window.SHOP_PAYMENTS) {
      showToast('Payment configuration unavailable.');
      return;
    }

    var orderPayload = buildOrderPayload();
    if (!orderPayload) {
      showToast('Your cart is empty.');
      return;
    }

    var message = SHOP_PAYMENTS.buildWhatsAppMessage(state.paymentMethod, orderPayload);
    var url = 'https://wa.me/' + SHOP_PAYMENTS.whatsappNumber + '?text=' + encodeURIComponent(message);
    window.open(url, '_blank', 'noopener,noreferrer');
    finalizeOrder(state.customer, state.paymentMethod, orderPayload.orderId);
  }

  function processPayment() {
    sendPaymentProofViaWhatsApp();
  }

  function handleCheckoutNext() {
    if (state.checkoutStep === 1) {
      var customer = validateStep1();
      if (!customer) return;
      state.customer = customer;
      state.checkoutStep = 2;
      renderCheckoutStep();
      return;
    }

    if (state.checkoutStep === 2) {
      state.checkoutStep = 3;
      renderCheckoutStep();
      return;
    }

    if (state.checkoutStep === 3) {
      processPayment();
    }
  }

  function handleCheckoutBack() {
    if (state.checkoutStep > 1 && state.checkoutStep < 4) {
      state.checkoutStep -= 1;
      renderCheckoutStep();
    }
  }

  function renderInfoCards() {
    if (!state.product || !els.infoGrid) return;
    var cards = state.product.infoCards;
    var titles = ['Product Details', 'Available Sizes', 'Delivery Information', 'Return Policy'];
    var keys = ['productDetails', 'availableSizes', 'delivery', 'returns'];

    els.infoGrid.innerHTML = keys
      .map(function (key, i) {
        return (
          '<article class="shop-info-card shop-reveal" style="animation-delay:' +
          i * 0.08 +
          's">' +
          '<h3>' +
          titles[i] +
          '</h3>' +
          '<p>' +
          cards[key] +
          '</p>' +
          '</article>'
        );
      })
      .join('');
  }

  function init() {
    if (!window.SHOP_CATALOG) return;

    loadCart();

    state.product = SHOP_CATALOG.getFeaturedProducts()[0];
    if (!state.product) return;

    state.variant = state.product.defaultVariant || state.product.variants[0].id;

    els.productRoot = $('shop-product-root');
    els.infoGrid = $('shop-info-grid');
    els.drawer = $('shop-cart-drawer');
    els.overlay = $('shop-overlay');
    els.cartItems = $('shop-cart-items');
    els.cartCount = $('shop-cart-count');
    els.cartSubtotal = $('shop-cart-subtotal');
    els.cartTotal = $('shop-cart-total');
    els.checkoutBtn = $('shop-cart-checkout');
    els.checkout = $('shop-checkout');
    els.toast = $('shop-toast');

    renderProduct();
    renderInfoCards();
    updateCartUI();

    if (els.cartToggle) {
      els.cartToggle.addEventListener('click', function () {
        openCart(true);
      });
    }

    document.querySelectorAll('[data-shop-cart-open]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openCart(true);
      });
    });

    if ($('shop-drawer-close')) {
      $('shop-drawer-close').addEventListener('click', closeCart);
    }
    if (els.overlay) {
      els.overlay.addEventListener('click', closeCart);
    }
    if (els.checkoutBtn) {
      els.checkoutBtn.addEventListener('click', openCheckoutModal);
    }

    if ($('shop-checkout-close')) {
      $('shop-checkout-close').addEventListener('click', closeCheckoutModal);
    }
    if ($('shop-checkout-backdrop')) {
      $('shop-checkout-backdrop').addEventListener('click', closeCheckoutModal);
    }
    if ($('shop-checkout-next')) {
      $('shop-checkout-next').addEventListener('click', handleCheckoutNext);
    }
    if ($('shop-checkout-back')) {
      $('shop-checkout-back').addEventListener('click', handleCheckoutBack);
    }

    document.querySelectorAll('.shop-payment-card input').forEach(function (input) {
      input.addEventListener('change', function () {
        state.paymentMethod = input.value;
        document.querySelectorAll('.shop-payment-card').forEach(function (card) {
          card.classList.toggle('is-selected', card.contains(input));
        });
        if (state.checkoutStep === 3) {
          renderPaymentPanel();
          renderCheckoutStep();
        }
      });
    });

    if (typeof AOS !== 'undefined' && typeof AOS.refreshHard === 'function') {
      AOS.refreshHard();
    } else if (typeof AOS !== 'undefined' && typeof AOS.refresh === 'function') {
      AOS.refresh();
    }

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        if (els.checkout && els.checkout.classList.contains('is-open')) closeCheckoutModal();
        else if (els.drawer && els.drawer.classList.contains('is-open')) closeCart();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    els.cartToggle = $('shop-cart-toggle');
    init();
  });
})();
