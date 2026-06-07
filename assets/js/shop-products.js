/**
 * GRIGA Events FZE – Shop Product Catalog
 * Add new products to this array without changing page structure.
 *
 * Image folders:
 *   jerseys/optimized/  – WebP gallery images (~80–120 KB)
 *   jerseys/thumbs/     – WebP thumbnails (~3–8 KB)
 *   jerseys/*.png       – Original masters (not served on the shop page)
 */
(function (global) {
  var JERSEY_BASE = 'assets/media/shop/jerseys/';

  function jerseyImg(fileBase, alt) {
    return {
      src: JERSEY_BASE + 'optimized/' + fileBase + '.webp',
      thumb: JERSEY_BASE + 'thumbs/' + fileBase + '.webp',
      alt: alt
    };
  }

  var SHOP_PRODUCTS = [
    {
      id: 'wts-official-jersey',
      slug: 'where-theres-smoke-official-jersey',
      name: "Where There's Smoke Official Jersey",
      price: 100,
      currency: 'AED',
      shortDescription:
        'Designed for the community that loves great food, great music, and unforgettable experiences.',
      inStock: true,
      sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
      defaultVariant: 'men',
      heroImage: jerseyImg('jersey men 1', "Where There's Smoke official jersey").src,
      variants: [
        {
          id: 'men',
          label: 'Men',
          images: [
            jerseyImg('jersey men 1', "Where There's Smoke official jersey – men's fit front view"),
            jerseyImg('jersey 2', "Where There's Smoke official jersey – men's fit side view"),
            jerseyImg('jersey 3', "Where There's Smoke official jersey – men's fit detail"),
            jerseyImg('jersey 4', "Where There's Smoke official jersey – men's fit back view"),
            jerseyImg('jersey 5', "Where There's Smoke official jersey – men's fit lifestyle"),
            jerseyImg('jersey 6', "Where There's Smoke official jersey – men's fit close-up"),
            jerseyImg('jersey 7', "Where There's Smoke official jersey – men's fit alternate angle"),
            jerseyImg('jersey 8', "Where There's Smoke official jersey – men's fit studio shot"),
            jerseyImg('jersey 9', "Where There's Smoke official jersey – men's fit full view")
          ]
        },
        {
          id: 'women',
          label: 'Women',
          images: [
            jerseyImg('jersey 1 ladies', "Where There's Smoke official jersey – women's fit front view"),
            jerseyImg('jersey 2 ladies', "Where There's Smoke official jersey – women's fit side view"),
            jerseyImg('jersey 3', "Where There's Smoke official jersey – women's fit detail"),
            jerseyImg('jersey 4', "Where There's Smoke official jersey – women's fit back view"),
            jerseyImg('jersey 5', "Where There's Smoke official jersey – women's fit lifestyle")
          ]
        }
      ],
      infoCards: {
        productDetails:
          'Premium event jersey featuring the official Where There\'s Smoke branding. Breathable fabric built for festival nights and everyday wear.',
        availableSizes:
          'Available in S through XXXL. Relaxed athletic fit. Refer to our size guide or contact support for fit recommendations.',
        delivery:
          'Orders ship across the UAE within 3–5 business days after payment confirmation. Pick-up available at select GRIGA Events.',
        returns:
          'Unworn items with tags attached may be exchanged within 14 days of delivery. Contact our team to initiate a return.'
      }
    }
  ];

  function getProductById(id) {
    return SHOP_PRODUCTS.find(function (p) {
      return p.id === id;
    }) || null;
  }

  function getFeaturedProducts() {
    return SHOP_PRODUCTS.slice();
  }

  function formatPrice(amount, currency) {
    return (currency || 'AED') + ' ' + Number(amount).toLocaleString('en-AE');
  }

  global.SHOP_CATALOG = {
    products: SHOP_PRODUCTS,
    getProductById: getProductById,
    getFeaturedProducts: getFeaturedProducts,
    formatPrice: formatPrice
  };
})(typeof window !== 'undefined' ? window : this);
