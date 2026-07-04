/**
 * GRIGA Events FZE – Shop payment configuration
 * Mirrors tickets.html payment logic with shop order amounts.
 */
(function (global) {
  var STRIPE_CHECKOUT_URL = 'https://buy.stripe.com/4gM4gBaYyeRYbyee8G3oA03';
  var WHATSAPP_NUMBER = '971522184531';

  var METHODS = {
    stripe: {
      id: 'stripe',
      type: 'stripe',
      label: 'Stripe Checkout',
      cardClass: 'payment-option--stripe',
      description:
        'Secure credit/debit payments in one click. You will be redirected to our hosted Stripe checkout for shop orders.'
    },
    mpesa: {
      id: 'mpesa',
      type: 'manual',
      label: 'M-PESA PAYMENT',
      prefix: 'MPESA',
      cardClass: 'payment-option--mpesa',
      logo: '/assets/media/logos/m-pesa-logo.png',
      logoAlt: 'M-PESA logo',
      intro: function (amount) {
        return (
          'Send ' +
          amount +
          ' over M-Pesa to the number below, then confirm the payment so we can process your jersey order.'
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
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via BOTIM Money using the number below, then confirm the payment so we can process your order.'
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
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via E& Money using the number below, then confirm the payment so we can process your order.'
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
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via Whizmo using the details below, then confirm the payment so we can process your order.'
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
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via ADCB using the details below, then confirm the payment so we can process your order.'
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
      intro: function (amount) {
        return (
          'Pay ' +
          amount +
          ' via NBD using the details below, then confirm the payment so we can process your order.'
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

  function formatAmount(total, currency) {
    return (currency || 'AED') + ' ' + Number(total).toLocaleString('en-AE');
  }

  function buildWhatsAppMessage(methodId, order) {
    var method = getMethod(methodId);
    var amount = formatAmount(order.total, order.currency || 'AED');
    var proofLine =
      methodId === 'stripe'
        ? "I'm attaching my Stripe payment confirmation.\n"
        : "I'm attaching a screenshot to proof the payment.\n";

    var items = order.items || [];
    var itemsBlock = items
      .map(function (it, i) {
        var line =
          i +
          1 +
          '. ' +
          it.name +
          ' — ' +
          it.variant +
          ' · Size ' +
          it.size +
          ' · Qty ' +
          it.quantity;
        if (typeof it.price === 'number') {
          line += ' · ' + formatAmount(it.price * it.quantity, it.currency || order.currency || 'AED');
        }
        return line;
      })
      .join('\n');

    return (
      'Hello, I have paid for my merchandise order via ' +
      (method ? method.label : methodId) +
      '.\n' +
      'Name: ' +
      order.customerName +
      '\n' +
      'Phone: ' +
      order.phone +
      '\n' +
      'Items:\n' +
      itemsBlock +
      '\n' +
      'Total: ' +
      amount +
      '\n' +
      'Order ID: ' +
      order.orderId +
      '\n' +
      proofLine +
      'Kindly confirm and send my order details. Thank you.'
    );
  }

  function generateManualOrderId(prefix) {
    return prefix + '-' + Date.now().toString(36).toUpperCase() + '-' + Math.floor(Math.random() * 900 + 100);
  }

  global.SHOP_PAYMENTS = {
    stripeUrl: STRIPE_CHECKOUT_URL,
    whatsappNumber: WHATSAPP_NUMBER,
    methods: METHODS,
    getMethod: getMethod,
    formatAmount: formatAmount,
    buildWhatsAppMessage: buildWhatsAppMessage,
    generateManualOrderId: generateManualOrderId
  };
})(typeof window !== 'undefined' ? window : this);
