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
  var CROP_BASE = 'assets/media/shop/crop tops/';
  var KIDS_BASE = 'assets/media/shop/kids merch/';

  function jerseyImg(fileBase, alt) {
    return {
      src: JERSEY_BASE + 'optimized/' + fileBase + '.webp',
      thumb: JERSEY_BASE + 'thumbs/' + fileBase + '.webp',
      alt: alt
    };
  }

  function cropImg(fileBase, alt) {
    return {
      src: CROP_BASE + 'optimized/' + fileBase + '.webp',
      thumb: CROP_BASE + 'thumbs/' + fileBase + '.webp',
      alt: alt
    };
  }

  function kidsImg(fileBase, alt) {
    return {
      src: KIDS_BASE + 'optimized/' + fileBase + '.webp',
      thumb: KIDS_BASE + 'thumbs/' + fileBase + '.webp',
      alt: alt
    };
  }

  var DELIVERY_INFO =
    'Orders ship across the UAE within 3–5 business days after payment confirmation. Pick-up available at select GRIGA Events.';
  var RETURNS_INFO =
    'Unworn items with tags attached may be exchanged within 14 days of delivery. Contact our team to initiate a return.';

  var SHOP_PRODUCTS = [
    {
      id: 'wts-official-jersey',
      slug: 'where-theres-smoke-official-jersey',
      name: "Where There's Smoke Official Jersey",
      category: 'jerseys',
      categoryLabel: 'Jerseys',
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
          sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
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
          sizes: ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
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
          'Available in S through XXXL, in Men\'s and Women\'s fits. Refer to our size guide or contact support for fit recommendations.',
        delivery: DELIVERY_INFO,
        returns: RETURNS_INFO
      }
    },
    {
      id: 'wts-crop-top',
      slug: 'where-theres-smoke-crop-top',
      name: "Where There's Smoke Crop Top",
      category: 'crop-tops',
      categoryLabel: 'Crop Tops',
      price: 100,
      currency: 'AED',
      shortDescription:
        'A bold, fitted crop top for the SMOKE community — festival-ready and made to move.',
      inStock: true,
      sizes: ['S', 'M', 'L'],
      defaultVariant: 'crop',
      heroImage: cropImg('crop-top-1', "Where There's Smoke crop top").src,
      variants: [
        {
          id: 'crop',
          label: 'Crop Top',
          sizes: ['S', 'M', 'L'],
          images: [
            cropImg('crop-top-1', "Where There's Smoke crop top – front view"),
            cropImg('crop-top-2', "Where There's Smoke crop top – side view"),
            cropImg('crop-top-3', "Where There's Smoke crop top – detail"),
            cropImg('crop-top-4', "Where There's Smoke crop top – back view"),
            cropImg('crop-top-5', "Where There's Smoke crop top – lifestyle"),
            cropImg('crop-top-6', "Where There's Smoke crop top – close-up"),
            cropImg('crop-top-7', "Where There's Smoke crop top – full view")
          ]
        }
      ],
      infoCards: {
        productDetails:
          'Official Where There\'s Smoke crop top with a fitted cut and premium print. Perfect for festival nights and everyday styling.',
        availableSizes:
          'Available in S, M, and L. Fitted crop cut. Refer to our size guide or contact support for fit recommendations.',
        delivery: DELIVERY_INFO,
        returns: RETURNS_INFO
      }
    },
    {
      id: 'wts-kids-merch',
      slug: 'where-theres-smoke-kids-merch',
      name: "Where There's Smoke Kids Merch",
      category: 'kids',
      categoryLabel: 'Kids',
      price: 100,
      currency: 'AED',
      shortDescription:
        'Official Where There\'s Smoke merch sized for the little ones in the SMOKE family.',
      inStock: true,
      sizes: ['7-8', '10-11'],
      defaultVariant: 'kids-jersey',
      heroImage: kidsImg('kids-jersey-1', "Where There's Smoke kids jersey").src,
      variants: [
        {
          id: 'kids-jersey',
          label: 'Kids Jersey',
          sizes: ['7-8', '10-11'],
          images: [
            kidsImg('kids-jersey-1', "Where There's Smoke kids jersey – front view"),
            kidsImg('kids-jersey-2', "Where There's Smoke kids jersey – alternate view"),
            kidsImg('kids-jersey-3', "Where There's Smoke kids jersey – detail"),
            kidsImg('kids-jersey-4', "Where There's Smoke kids jersey – full view")
          ]
        },
        {
          id: 'kids-crop-top',
          label: 'Kids Crop Top',
          sizes: ['7-8', '10-11'],
          images: [
            kidsImg('kids-crop-top-1', "Where There's Smoke kids crop top – front view"),
            kidsImg('kids-crop-top-2', "Where There's Smoke kids crop top – alternate view"),
            kidsImg('kids-crop-top-3', "Where There's Smoke kids crop top – detail"),
            kidsImg('kids-crop-top-4', "Where There's Smoke kids crop top – full view")
          ]
        }
      ],
      infoCards: {
        productDetails:
          'Official Where There\'s Smoke kids merch with the same premium branding, sized for younger fans. Available as a kids jersey or kids crop top.',
        availableSizes:
          'Available in kids sizes 7-8 and 10-11, in Jersey and Crop Top styles. Refer to our size guide or contact support for fit recommendations.',
        delivery: DELIVERY_INFO,
        returns: RETURNS_INFO
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

  function getCategories() {
    var seen = {};
    var list = [];
    SHOP_PRODUCTS.forEach(function (p) {
      if (p.category && !seen[p.category]) {
        seen[p.category] = true;
        list.push({ id: p.category, label: p.categoryLabel || p.category });
      }
    });
    return list;
  }

  function formatPrice(amount, currency) {
    return (currency || 'AED') + ' ' + Number(amount).toLocaleString('en-AE');
  }

  global.SHOP_CATALOG = {
    products: SHOP_PRODUCTS,
    getProductById: getProductById,
    getFeaturedProducts: getFeaturedProducts,
    getCategories: getCategories,
    formatPrice: formatPrice
  };
})(typeof window !== 'undefined' ? window : this);
