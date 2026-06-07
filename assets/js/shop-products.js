/**
 * GRIGA Events FZE – Shop Product Catalog
 * Add new products to this array without changing page structure.
 */
(function (global) {
  var JERSEY_BASE = 'assets/media/shop/jerseys/';

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
      variants: [
        {
          id: 'men',
          label: 'Men',
          images: [
            { src: JERSEY_BASE + 'jersey men 1.png', alt: "Where There's Smoke official jersey – men's fit front view" },
            { src: JERSEY_BASE + 'jersey 2.png', alt: "Where There's Smoke official jersey – men's fit side view" },
            { src: JERSEY_BASE + 'jersey 3.png', alt: "Where There's Smoke official jersey – men's fit detail" },
            { src: JERSEY_BASE + 'jersey 4.png', alt: "Where There's Smoke official jersey – men's fit back view" },
            { src: JERSEY_BASE + 'jersey 5.png', alt: "Where There's Smoke official jersey – men's fit lifestyle" },
            { src: JERSEY_BASE + 'jersey 6.png', alt: "Where There's Smoke official jersey – men's fit close-up" },
            { src: JERSEY_BASE + 'jersey 7.png', alt: "Where There's Smoke official jersey – men's fit alternate angle" },
            { src: JERSEY_BASE + 'jersey 8.png', alt: "Where There's Smoke official jersey – men's fit studio shot" },
            { src: JERSEY_BASE + 'jersey 9.png', alt: "Where There's Smoke official jersey – men's fit full view" }
          ]
        },
        {
          id: 'women',
          label: 'Women',
          images: [
            { src: JERSEY_BASE + 'jersey 1 ladies.png', alt: "Where There's Smoke official jersey – women's fit front view" },
            { src: JERSEY_BASE + 'jersey 2 ladies.png', alt: "Where There's Smoke official jersey – women's fit side view" },
            { src: JERSEY_BASE + 'jersey 3.png', alt: "Where There's Smoke official jersey – women's fit detail" },
            { src: JERSEY_BASE + 'jersey 4.png', alt: "Where There's Smoke official jersey – women's fit back view" },
            { src: JERSEY_BASE + 'jersey 5.png', alt: "Where There's Smoke official jersey – women's fit lifestyle" }
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
