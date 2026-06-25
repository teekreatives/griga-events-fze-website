/**
 * GRIGA Events FZE – Ticket payment configuration
 * Mirrors shop checkout payment logic for event tickets.
 */
(function (global) {
  var STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/cNi4gBgiS25c6dUaWu3oA02';
  var WHATSAPP_NUMBER = '971522184531';
  var TICKET_PRICE_AED = 150;
  var TICKET_PRICE_MPESA_KSH = 5500;
  var EVENT_NAME = "Where There's Smoke Edition 8";
  var EVENT_DATE = 'Saturday, 7 November 2026 · 6:00 PM – Dawn';
  var EVENT_VENUE = 'HAMRIYA EAST AJMAN - DESERT OASIS CAMPS & LAND PARK';

  var METHODS = {
    stripe: {
      id: 'stripe',
      type: 'stripe',
      label: 'Stripe Checkout',
      cardClass: 'payment-option--stripe',
      description:
        'Secure credit/debit payments in one click. You will be redirected to our hosted Stripe checkout for tickets.'
    },
    mpesa: {
      id: 'mpesa',
      type: 'manual',
      label: 'M-PESA PAYMENT',
      prefix: 'MPESA',
      cardClass: 'payment-option--mpesa',
      logo: '/assets/media/logos/m-pesa-logo.png',
      logoAlt: 'M-PESA logo',
      currency: 'KSH',
      intro: function (amount) {
        return (
          'Send ' +
          amount +
          ' over M-Pesa to the number below, then confirm the payment so we can deliver your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Number', dd: '0710 261 539' },
          { dt: 'Name', dd: 'Grishon Gachomo' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return '0710 261 539';
      }
    },
    botim: {
      id: 'botim',
      type: 'manual',
      label: 'BOTIM Money',
      prefix: 'BOTIM',
      cardClass: 'payment-option--botim',
      logo: '/assets/media/logos/botim-money.jpg',
      logoAlt: 'BOTIM logo',
      currency: 'AED',
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via BOTIM Money using the number below, then confirm the payment so we can send your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Number', dd: '+971 52 994 8589' },
          { dt: 'Name', dd: 'Grishon Gachomo' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return '+971 52 994 8589';
      }
    },
    eand: {
      id: 'eand',
      type: 'manual',
      label: 'E& Money',
      prefix: 'EAND',
      cardClass: 'payment-option--eand',
      logo: '/assets/media/logos/E%26%20Money.jpg',
      logoAlt: 'E& Money logo',
      currency: 'AED',
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via E& Money using the number below, then confirm the payment so we can deliver your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Number', dd: '+971 52 994 8589' },
          { dt: 'Name', dd: 'Grishon Gachomo' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return '+971 52 994 8589';
      }
    },
    whizmo: {
      id: 'whizmo',
      type: 'manual',
      label: 'Whizmo Bank Transfer',
      prefix: 'BANK',
      cardClass: 'payment-option--bank payment-option--whizmo',
      logo: '/assets/media/logos/whizmo.jpg',
      logoAlt: 'Whizmo logo',
      title: 'Whizmo',
      currency: 'AED',
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via Whizmo using the details below, then confirm the payment so we can deliver your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Bank Name', dd: 'Abu Dhabi Commercial Bank' },
          { dt: 'Account Name', dd: "GRIGA EVENT'S FZE" },
          { dt: 'IBAN', dd: 'AE700030077195013990091' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return 'AE700030077195013990091';
      }
    },
    adcb: {
      id: 'adcb',
      type: 'manual',
      label: 'ADCB Bank Transfer',
      prefix: 'ADCB',
      cardClass: 'payment-option--bank payment-option--adcb',
      logo: '/assets/media/logos/ADCB.png',
      logoAlt: 'ADCB logo',
      title: 'ADCB',
      currency: 'AED',
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via ADCB using the details below, then confirm the payment so we can deliver your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Bank Name', dd: 'Abu Dhabi Commercial Bank PJSC' },
          { dt: 'Account Name', dd: 'GRISHON GITHINJI GACHOMO' },
          { dt: 'Account Number', dd: '10085351920001' },
          { dt: 'IBAN', dd: 'AE570030010085351920001' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return 'AE570030010085351920001';
      }
    },
    nbd: {
      id: 'nbd',
      type: 'manual',
      label: 'NBD Bank Transfer',
      prefix: 'NBD',
      cardClass: 'payment-option--bank payment-option--nbd',
      logo: '/assets/media/logos/NBD.png',
      logoAlt: 'NBD logo',
      title: 'NBD',
      currency: 'AED',
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via NBD using the details below, then confirm the payment so we can deliver your ticket.'
        );
      },
      details: function () {
        return [
          { dt: 'Bank Name', dd: 'Emirates NBD' },
          { dt: 'Account Name', dd: 'Grishon Githinji Gachomo' },
          { dt: 'Account Number', dd: '1014091695801' },
          { dt: 'IBAN', dd: 'AE060260001014091695801' }
        ];
      },
      amountDetail: true,
      copyInfo: function (amount) {
        return 'AE060260001014091695801';
      }
    }
  };

  function getMethod(id) {
    return METHODS[id] || null;
  }

  function getUnitPrice(methodId) {
    if (methodId === 'mpesa') {
      return { amount: TICKET_PRICE_MPESA_KSH, currency: 'KSH' };
    }
    return { amount: TICKET_PRICE_AED, currency: 'AED' };
  }

  function getOrderTotal(methodId, quantity) {
    var unit = getUnitPrice(methodId);
    return {
      amount: unit.amount * quantity,
      currency: unit.currency
    };
  }

  function formatAmount(total, currency) {
    if (currency === 'KSH') {
      return 'KSH ' + Number(total).toLocaleString('en-KE');
    }
    return (currency || 'AED') + ' ' + Number(total).toLocaleString('en-AE');
  }

  function formatAmountForMethod(methodId, quantity) {
    var total = getOrderTotal(methodId, quantity || 1);
    return formatAmount(total.amount, total.currency);
  }

  function buildWhatsAppMessage(methodId, order) {
    var method = getMethod(methodId);
    var amount = formatAmount(order.total, order.currency);
    var proofLine =
      methodId === 'stripe'
        ? "I'm attaching my Stripe payment confirmation.\n"
        : "I'm attaching a screenshot to proof the payment.\n";
    return (
      'Hello, I have paid for my ticket via ' +
      (method ? method.label : methodId) +
      '.\n' +
      'Name: ' +
      order.customerName +
      '\n' +
      'Phone: ' +
      order.phone +
      '\n' +
      'Email: ' +
      order.email +
      '\n' +
      'Tickets: ' +
      order.quantity +
      '\n' +
      'Amount: ' +
      amount +
      '\n' +
      'Order ID: ' +
      order.orderId +
      '\n' +
      proofLine +
      'Kindly confirm and send my ticket. Thank you.'
    );
  }

  function generateOrderId(prefix) {
    return (
      (prefix || 'TKT') +
      '-' +
      Date.now().toString(36).toUpperCase() +
      '-' +
      Math.floor(Math.random() * 900 + 100)
    );
  }

  global.TICKET_PAYMENTS = {
    stripeUrl: STRIPE_CHECKOUT_URL,
    whatsappNumber: WHATSAPP_NUMBER,
    eventName: EVENT_NAME,
    eventDate: EVENT_DATE,
    eventVenue: EVENT_VENUE,
    priceAed: TICKET_PRICE_AED,
    priceMpesaKsh: TICKET_PRICE_MPESA_KSH,
    methods: METHODS,
    getMethod: getMethod,
    getUnitPrice: getUnitPrice,
    getOrderTotal: getOrderTotal,
    formatAmount: formatAmount,
    formatAmountForMethod: formatAmountForMethod,
    buildWhatsAppMessage: buildWhatsAppMessage,
    generateOrderId: generateOrderId
  };
})(typeof window !== 'undefined' ? window : this);
