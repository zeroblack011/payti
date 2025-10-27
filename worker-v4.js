// ============================================
// TIKTOK SHOP UK - VERSÃO 4.0
// Sistema Completo E-Commerce
// Cloudflare Workers + KV Storage
// ============================================

// CONFIGURAÇÕES PRINCIPAIS
const CONFIG = {
  ADMIN_PASSWORD: 'admin123',  // ALTERAR EM PRODUÇÃO!
  ASAAS_API_KEY: '$aact_YTU5YTE0M2M2N2I4MTliNzk0YTI5N2U5MzdjNWZmNDQ6OjAwMDAwMDAwMDAwMDAwOTE2ODA6OiRhYWNoXzYxNzI5NDUyLTc2OTctNGQ4NC04ODRlLTU4YjYxNzI5YjFhMQ==',  // SUA CHAVE ASAAS
  ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3'  // Trocar para produção
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

function validateCPF(cpf) {
  cpf = cpf.replace(/\D/g, '');

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(9))) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  digit = 11 - (sum % 11);
  if (digit >= 10) digit = 0;
  if (digit !== parseInt(cpf.charAt(10))) return false;

  return true;
}

// ============================================
// FUNÇÕES DE PAGAMENTO
// ============================================

async function createAsaasPixPayment(customer, amount, externalReference, env) {
  try {
    // Buscar ou criar customer
    let customerId = null;

    const searchResponse = await fetch(
      `${CONFIG.ASAAS_BASE_URL}/customers?email=${encodeURIComponent(customer.email)}`,
      {
        headers: {
          'access_token': CONFIG.ASAAS_API_KEY
        }
      }
    );

    const searchResult = await searchResponse.json();

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: customer.name,
          email: customer.email,
          cpfCnpj: customer.cpfCnpj,
          mobilePhone: customer.mobilePhone
        })
      });

      const customerResult = await customerResponse.json();
      if (!customerResponse.ok) {
        return { success: false, error: 'Erro ao criar cliente no Asaas' };
      }

      customerId = customerResult.id;
    }

    // Criar pagamento PIX
    const paymentData = {
      customer: customerId,
      billingType: 'PIX',
      value: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Pagamento TikTok Shop UK`,
      externalReference: externalReference
    };

    const paymentResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      },
      body: JSON.stringify(paymentData)
    });

    const paymentResult = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return { success: false, error: 'Erro ao criar pagamento PIX' };
    }

    // Gerar QR Code PIX
    const pixResponse = await fetch(
      `${CONFIG.ASAAS_BASE_URL}/payments/${paymentResult.id}/pixQrCode`,
      {
        headers: {
          'access_token': CONFIG.ASAAS_API_KEY
        }
      }
    );

    const pixData = await pixResponse.json();

    return {
      success: true,
      paymentId: paymentResult.id,
      pixCode: pixData.payload,
      pixQRCode: pixData.encodedImage
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createAsaasCardPayment(customer, amount, cardData, externalReference, env) {
  try {
    // Buscar ou criar customer
    let customerId = null;

    const searchResponse = await fetch(
      `${CONFIG.ASAAS_BASE_URL}/customers?email=${encodeURIComponent(customer.email)}`,
      {
        headers: {
          'access_token': CONFIG.ASAAS_API_KEY
        }
      }
    );

    const searchResult = await searchResponse.json();

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: customer.name,
          email: customer.email,
          cpfCnpj: customer.cpfCnpj,
          mobilePhone: customer.mobilePhone
        })
      });

      const customerResult = await customerResponse.json();
      if (!customerResponse.ok) {
        return { success: false, error: 'Erro ao criar cliente no Asaas' };
      }

      customerId = customerResult.id;
    }

    // Criar pagamento com cartão
    const paymentData = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: amount,
      dueDate: new Date().toISOString().split('T')[0],
      description: `Pagamento TikTok Shop UK`,
      externalReference: externalReference,
      installmentCount: cardData.installments,
      installmentValue: amount / cardData.installments,
      creditCard: {
        holderName: cardData.holderName,
        number: cardData.number.replace(/\s/g, ''),
        expiryMonth: cardData.expiryMonth,
        expiryYear: cardData.expiryYear,
        ccv: cardData.cvv
      },
      creditCardHolderInfo: {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        postalCode: cardData.postalCode || '00000000',
        addressNumber: '0',
        phone: customer.mobilePhone
      }
    };

    const paymentResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      },
      body: JSON.stringify(paymentData)
    });

    const paymentResult = await paymentResponse.json();

    if (!paymentResponse.ok) {
      return {
        success: false,
        error: paymentResult.errors?.[0]?.description || 'Erro ao processar cartão'
      };
    }

    return {
      success: true,
      paymentId: paymentResult.id,
      status: paymentResult.status,
      brand: paymentResult.creditCard?.creditCardBrand || 'N/A'
    };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ============================================
// FUNÇÕES DE FRETE
// ============================================

async function calculateMelhorEnvioShipping(originCep, destCep, dimensions, token) {
  try {
    const response = await fetch('https://melhorenvio.com.br/api/v2/me/shipment/calculate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        from: { postal_code: originCep.replace(/\D/g, '') },
        to: { postal_code: destCep.replace(/\D/g, '') },
        package: {
          height: dimensions.height,
          width: dimensions.width,
          length: dimensions.length,
          weight: dimensions.weight
        }
      })
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Erro ao calcular frete:', error);
    return [];
  }
}

// ============================================
// FUNÇÕES DE NOTIFICAÇÃO
// ============================================

async function sendWhatsAppNotification(to, message, settings) {
  if (!settings.whatsapp_enabled) return;

  try {
    // Implementar envio via Twilio ou outra API
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${settings.twilio_config.account_sid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + btoa(`${settings.twilio_config.account_sid}:${settings.twilio_config.auth_token}`)
      },
      body: new URLSearchParams({
        From: `whatsapp:${settings.twilio_config.phone_number}`,
        To: `whatsapp:${to}`,
        Body: message
      })
    });

    return response.ok;
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return false;
  }
}

// ============================================
// FUNÇÕES DE NÍVEL DE AFILIADO
// ============================================

function getAffiliateLevel(sales) {
  if (sales >= 100) return { name: 'DIAMANTE', icon: '👑', commission: 50 };
  if (sales >= 50) return { name: 'PLATINA', icon: '💎', commission: 45 };
  if (sales >= 25) return { name: 'OURO', icon: '🥇', commission: 40 };
  if (sales >= 10) return { name: 'PRATA', icon: '🥈', commission: 35 };
  return { name: 'BRONZE', icon: '🥉', commission: 30 };
}

// ============================================
// INICIALIZAÇÃO DO SISTEMA
// ============================================

async function initializeSystem(env) {
  try {
    const stats = await env.TIKTOK_ORDERS.get('STATS');

    if (!stats) {
      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify({
        totalOrders: 0,
        totalPaidOrders: 0,
        totalRevenue: 0,
        totalAffiliates: 0,
        totalPendingCommission: 0,
        totalPaidCommission: 0
      }));

      await env.TIKTOK_ORDERS.put('ORDER_LIST', JSON.stringify([]));
      await env.TIKTOK_ORDERS.put('PRODUCTS_LIST', JSON.stringify([]));
      await env.TIKTOK_ORDERS.put('AFFILIATES_LIST', JSON.stringify([]));
      await env.TIKTOK_ORDERS.put('COUPONS_LIST', JSON.stringify([]));
    }

    // Inicializar configurações de pagamento v4.0
    const paymentSettings = await env.TIKTOK_ORDERS.get('PAYMENT_SETTINGS');
    if (!paymentSettings) {
      await env.TIKTOK_ORDERS.put('PAYMENT_SETTINGS', JSON.stringify({
        pix_enabled: true,
        card_enabled: true,
        pix_config: {
          api_key: CONFIG.ASAAS_API_KEY,
          expiration_minutes: 30,
          custom_message: 'Pagamento via PIX - Aprovação automática'
        },
        card_config: {
          api_key: CONFIG.ASAAS_API_KEY,
          max_installments: 12,
          installments_config: [
            { installment: 1, interest: 0, free: true },
            { installment: 2, interest: 0, free: true },
            { installment: 3, interest: 0, free: true },
            { installment: 4, interest: 2.99, free: false },
            { installment: 5, interest: 2.99, free: false },
            { installment: 6, interest: 2.99, free: false },
            { installment: 7, interest: 2.99, free: false },
            { installment: 8, interest: 2.99, free: false },
            { installment: 9, interest: 2.99, free: false },
            { installment: 10, interest: 2.99, free: false },
            { installment: 11, interest: 2.99, free: false },
            { installment: 12, interest: 2.99, free: false }
          ],
          min_installment_value: 20,
          accept_debit: true
        }
      }));
    }

    // Inicializar configurações de envio
    const shippingSettings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
    if (!shippingSettings) {
      await env.TIKTOK_ORDERS.put('SHIPPING_SETTINGS', JSON.stringify({
        melhor_envio_token: '',
        origin_cep: '',
        default_dimensions: {
          length: 20,
          width: 15,
          height: 5,
          weight: 0.5
        },
        active_services: ['PAC', 'SEDEX'],
        store_pickup_enabled: false,
        free_shipping_min_value: 0
      }));
    }

    // Inicializar configurações de notificações
    const notificationSettings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
    if (!notificationSettings) {
      await env.TIKTOK_ORDERS.put('NOTIFICATION_SETTINGS', JSON.stringify({
        whatsapp_enabled: false,
        twilio_config: {
          account_sid: '',
          auth_token: '',
          phone_number: ''
        },
        templates: {
          payment_confirmed: '✅ *Pagamento Confirmado!*\n\nOlá {{name}},\n\nSeu pagamento foi confirmado!\n\n*Pedido:* {{txid}}\n*Valor:* R$ {{amount}}',
          order_shipped: '📦 *Pedido Enviado!*\n\nOlá {{name}},\n\nSeu pedido foi enviado!\n\n*Rastreio:* {{tracking}}',
          payment_reminder: '⏰ *Lembrete de Pagamento*\n\nOlá {{name}},\n\nSeu pedido está aguardando pagamento.\n\n*Pedido:* {{txid}}'
        }
      }));
    }

    // Inicializar configurações de banner
    const bannerSettings = await env.TIKTOK_ORDERS.get('BANNER_SETTINGS');
    if (!bannerSettings) {
      await env.TIKTOK_ORDERS.put('BANNER_SETTINGS', JSON.stringify({
        enabled: false,
        image_url: '',
        target_url: '',
        alt_text: 'Banner Promocional',
        open_new_tab: true
      }));
    }

    return true;
  } catch (error) {
    console.error('Erro ao inicializar sistema:', error);
    return false;
  }
}

// ============================================
// HANDLER PRINCIPAL
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Inicializar sistema se necessário
    await initializeSystem(env);

    // ==========================================
    // ROTAS API
    // ==========================================

    // GET /api/payment-settings
    if (url.pathname === '/api/payment-settings' && request.method === 'GET') {
      let settings = await env.TIKTOK_ORDERS.get('PAYMENT_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        pix_enabled: true,
        card_enabled: false,
        pix_config: { api_key: CONFIG.ASAAS_API_KEY, expiration_minutes: 30 },
        card_config: { api_key: CONFIG.ASAAS_API_KEY, max_installments: 12 }
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/payment-settings
    if (url.pathname === '/api/payment-settings' && request.method === 'POST') {
      const { password, settings } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.put('PAYMENT_SETTINGS', JSON.stringify(settings));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/validate-coupon
    if (url.pathname === '/api/validate-coupon' && request.method === 'POST') {
      const { code, orderValue, productId } = await request.json();

      const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + code.toUpperCase());
      if (!couponData) {
        return new Response(JSON.stringify({ success: false, error: 'Cupom inválido' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const coupon = JSON.parse(couponData);

      // Validações
      if (coupon.status !== 'active') {
        return new Response(JSON.stringify({ success: false, error: 'Cupom inativo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const now = new Date();
      const startDate = new Date(coupon.start_date);
      const endDate = new Date(coupon.end_date);

      if (now < startDate || now > endDate) {
        return new Response(JSON.stringify({ success: false, error: 'Cupom fora da validade' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (coupon.current_uses >= coupon.max_uses) {
        return new Response(JSON.stringify({ success: false, error: 'Cupom esgotado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      if (orderValue < coupon.min_order_value) {
        return new Response(JSON.stringify({
          success: false,
          error: `Valor mínimo de R$ ${coupon.min_order_value.toFixed(2)} não atingido`
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Calcular desconto
      let discount = 0;
      if (coupon.type === 'percent') {
        discount = (orderValue * coupon.value) / 100;
      } else {
        discount = coupon.value;
      }

      return new Response(JSON.stringify({ success: true, discount, coupon }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/coupons
    if (url.pathname === '/api/coupons' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
      const codes = couponsList ? JSON.parse(couponsList) : [];

      const coupons = [];
      for (const code of codes) {
        const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + code);
        if (couponData) {
          coupons.push(JSON.parse(couponData));
        }
      }

      return new Response(JSON.stringify({ success: true, coupons }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/coupons
    if (url.pathname === '/api/coupons' && request.method === 'POST') {
      const { password, coupon } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const code = coupon.code.toUpperCase();

      // Verificar se já existe
      const existing = await env.TIKTOK_ORDERS.get('COUPON_' + code);
      if (existing) {
        return new Response(JSON.stringify({ error: 'Cupom já existe' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Adicionar à lista
      const couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
      const codes = couponsList ? JSON.parse(couponsList) : [];
      codes.push(code);
      await env.TIKTOK_ORDERS.put('COUPONS_LIST', JSON.stringify(codes));

      // Salvar cupom
      coupon.current_uses = 0;
      coupon.created_at = new Date().toISOString();
      await env.TIKTOK_ORDERS.put('COUPON_' + code, JSON.stringify(coupon));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/coupons/:code
    if (url.pathname.startsWith('/api/coupons/') && request.method === 'DELETE') {
      const code = url.pathname.split('/api/coupons/')[1].toUpperCase();
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Remover da lista
      const couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
      const codes = couponsList ? JSON.parse(couponsList) : [];
      const newCodes = codes.filter(c => c !== code);
      await env.TIKTOK_ORDERS.put('COUPONS_LIST', JSON.stringify(newCodes));

      // Deletar cupom
      await env.TIKTOK_ORDERS.delete('COUPON_' + code);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/viacep/:cep
    if (url.pathname.startsWith('/api/viacep/')) {
      const cep = url.pathname.split('/api/viacep/')[1].replace(/\D/g, '');

      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        return new Response(JSON.stringify({ success: false, error: 'CEP não encontrado' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        address: {
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/calculate-shipping
    if (url.pathname === '/api/calculate-shipping' && request.method === 'POST') {
      const { cep, productId } = await request.json();

      const shippingSettings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
      const settings = shippingSettings ? JSON.parse(shippingSettings) : {
        melhor_envio_token: '',
        origin_cep: '',
        default_dimensions: { length: 20, width: 15, height: 5, weight: 0.5 },
        active_services: ['PAC', 'SEDEX'],
        store_pickup_enabled: false
      };

      if (!settings.melhor_envio_token) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Melhor Envio não configurado'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const shippingOptions = await calculateMelhorEnvioShipping(
        settings.origin_cep,
        cep,
        settings.default_dimensions,
        settings.melhor_envio_token
      );

      const filteredOptions = shippingOptions.filter(opt =>
        settings.active_services.includes(opt.name)
      );

      if (settings.store_pickup_enabled) {
        filteredOptions.unshift({
          id: 'store_pickup',
          name: 'Retirada em Loja',
          price: 0,
          delivery_time: 0,
          company: { name: 'Loja Física' }
        });
      }

      return new Response(JSON.stringify({ success: true, options: filteredOptions }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/shipping-settings
    if (url.pathname === '/api/shipping-settings' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let settings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        melhor_envio_token: '',
        origin_cep: '',
        default_dimensions: { length: 20, width: 15, height: 5, weight: 0.5 }
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/shipping-settings
    if (url.pathname === '/api/shipping-settings' && request.method === 'POST') {
      const { password, settings } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.put('SHIPPING_SETTINGS', JSON.stringify(settings));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/notification-settings
    if (url.pathname === '/api/notification-settings' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      let settings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        whatsapp_enabled: false,
        twilio_config: { account_sid: '', auth_token: '', phone_number: '' }
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/notification-settings
    if (url.pathname === '/api/notification-settings' && request.method === 'POST') {
      const { password, settings } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.put('NOTIFICATION_SETTINGS', JSON.stringify(settings));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/banner-settings
    if (url.pathname === '/api/banner-settings' && request.method === 'GET') {
      let settings = await env.TIKTOK_ORDERS.get('BANNER_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        enabled: false,
        image_url: '',
        target_url: ''
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/banner-settings
    if (url.pathname === '/api/banner-settings' && request.method === 'POST') {
      const { password, settings } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.put('BANNER_SETTINGS', JSON.stringify(settings));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/create-order (ATUALIZADO v4.0)
    if (url.pathname === '/api/create-order' && request.method === 'POST') {
      const data = await request.json();

      // VALIDAÇÃO CPF
      if (!data.cpf || !validateCPF(data.cpf)) {
        return new Response(JSON.stringify({ error: 'CPF inválido' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + data.productId);
      if (!productData) {
        return new Response(JSON.stringify({ error: 'Produto não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const product = JSON.parse(productData);

      let orderValue = product.price;
      let discountAmount = 0;
      let couponApplied = null;

      // VALIDAR E APLICAR CUPOM
      if (data.couponCode) {
        const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + data.couponCode.toUpperCase());
        if (couponData) {
          const coupon = JSON.parse(couponData);

          if (coupon.type === 'percent') {
            discountAmount = (orderValue * coupon.value) / 100;
          } else {
            discountAmount = coupon.value;
          }

          couponApplied = coupon;
          orderValue = orderValue - discountAmount;
        }
      }

      // ADICIONAR FRETE
      let shippingCost = 0;
      if (product.type === 'physical' && data.shipping) {
        shippingCost = parseFloat(data.shipping.price) || 0;
        orderValue = orderValue + shippingCost;
      }

      const finalOrderValue = orderValue;

      // Gerar IDs
      const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substring(7);
      const txid = 'TXID' + Date.now();

      // Verificar afiliado
      let affiliateCode = null;
      let affiliateLevel = null;
      let affiliateCommission = null;

      if (data.affiliateCode) {
        const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + data.affiliateCode.toUpperCase());
        if (affiliateData) {
          const affiliate = JSON.parse(affiliateData);
          if (affiliate.status === 'approved') {
            affiliateCode = affiliate.code;
            const level = getAffiliateLevel(affiliate.sales || 0);
            affiliateLevel = level.name;
            affiliateCommission = level.commission;
          }
        }
      }

      // CRIAR PAGAMENTO
      const paymentMethod = data.paymentMethod || 'pix';
      let paymentResult;

      if (paymentMethod === 'pix') {
        paymentResult = await createAsaasPixPayment({
          name: data.name,
          email: data.email,
          cpfCnpj: data.cpf.replace(/\D/g, ''),
          mobilePhone: data.whatsapp.replace(/\D/g, '')
        }, finalOrderValue, txid, env);

        if (!paymentResult.success) {
          return new Response(JSON.stringify({ error: paymentResult.error }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else if (paymentMethod === 'card') {
        paymentResult = await createAsaasCardPayment({
          name: data.name,
          email: data.email,
          cpfCnpj: data.cpf.replace(/\D/g, ''),
          mobilePhone: data.whatsapp.replace(/\D/g, '')
        }, finalOrderValue, data.cardData, txid, env);

        if (!paymentResult.success) {
          return new Response(JSON.stringify({ error: paymentResult.error }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }

      // SALVAR PEDIDO
      const order = {
        id: orderId,
        txid: txid,
        productId: product.id,
        productName: product.name,
        productType: product.type,
        productPrice: product.price,
        name: data.name,
        email: data.email,
        whatsapp: data.whatsapp,
        cpf: data.cpf,
        address: product.type === 'physical' ? data.address : null,
        shipping: product.type === 'physical' ? data.shipping : null,
        shippingCost: shippingCost,
        couponCode: couponApplied ? couponApplied.code : null,
        discountAmount: discountAmount,
        subtotal: product.price,
        amount: finalOrderValue,
        status: 'pending',
        paymentMethod: paymentMethod,
        asaasPaymentId: paymentResult.paymentId,
        pixCode: paymentResult.pixCode || null,
        pixQRCode: paymentResult.pixQRCode || null,
        cardInfo: paymentMethod === 'card' ? {
          installments: data.cardData.installments,
          brand: paymentResult.brand
        } : null,
        createdAt: new Date().toISOString(),
        paidAt: null,
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        affiliateCode: affiliateCode,
        affiliateLevel: affiliateLevel,
        affiliateCommission: affiliateCommission,
        affiliatePaid: false
      };

      await env.TIKTOK_ORDERS.put(orderId, JSON.stringify(order));

      // Adicionar à lista de pedidos
      const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
      const orders = orderList ? JSON.parse(orderList) : [];
      orders.unshift(orderId);
      await env.TIKTOK_ORDERS.put('ORDER_LIST', JSON.stringify(orders));

      // ATUALIZAR USO DO CUPOM
      if (couponApplied) {
        couponApplied.current_uses += 1;
        await env.TIKTOK_ORDERS.put('COUPON_' + couponApplied.code, JSON.stringify(couponApplied));
      }

      // Atualizar estatísticas
      const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
      stats.totalOrders += 1;
      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      // Atualizar estoque se produto físico
      if (product.type === 'physical' && product.stock !== null) {
        product.stock -= 1;
        await env.TIKTOK_ORDERS.put('PRODUCT_' + product.id, JSON.stringify(product));
      }

      return new Response(JSON.stringify({
        success: true,
        orderId: orderId,
        txid: txid,
        paymentMethod: paymentMethod,
        pixCode: paymentResult.pixCode,
        pixQRCode: paymentResult.pixQRCode,
        amount: finalOrderValue
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/mark-paid (ATUALIZADO v4.0 - Comissão Corrigida)
    if (url.pathname === '/api/mark-paid' && request.method === 'POST') {
      const { password, orderId } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const orderData = await env.TIKTOK_ORDERS.get(orderId);
      if (!orderData) {
        return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const order = JSON.parse(orderData);

      if (order.status === 'paid') {
        return new Response(JSON.stringify({ error: 'Pedido já está pago' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      order.status = 'paid';
      order.paidAt = new Date().toISOString();

      await env.TIKTOK_ORDERS.put(orderId, JSON.stringify(order));

      // Atualizar estatísticas
      const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
      stats.totalPaidOrders += 1;
      stats.totalRevenue += order.amount;
      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      // CORREÇÃO: Atualizar comissão do afiliado sobre VALOR FINAL
      if (order.affiliateCode) {
        const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + order.affiliateCode);
        if (affiliateData) {
          const affiliate = JSON.parse(affiliateData);
          affiliate.sales = (affiliate.sales || 0) + 1;

          // COMISSÃO SOBRE VALOR FINAL (produto - desconto + frete)
          const finalOrderValue = order.amount;
          const commissionAmount = finalOrderValue * (order.affiliateCommission || 30) / 100;

          affiliate.pendingCommission = (affiliate.pendingCommission || 0) + commissionAmount;
          stats.totalPendingCommission += commissionAmount;

          await env.TIKTOK_ORDERS.put('AFFILIATE_' + order.affiliateCode, JSON.stringify(affiliate));

          // Adicionar pedido à lista do afiliado
          const affiliateOrdersKey = 'AFFILIATE_ORDERS_' + order.affiliateCode;
          let affiliateOrders = await env.TIKTOK_ORDERS.get(affiliateOrdersKey);
          affiliateOrders = affiliateOrders ? JSON.parse(affiliateOrders) : [];
          affiliateOrders.unshift(orderId);
          await env.TIKTOK_ORDERS.put(affiliateOrdersKey, JSON.stringify(affiliateOrders));
        }
      }

      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      // Enviar notificação WhatsApp
      const notificationSettings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
      if (notificationSettings) {
        const settings = JSON.parse(notificationSettings);
        if (settings.whatsapp_enabled) {
          const message = settings.templates.payment_confirmed
            .replace('{{name}}', order.name)
            .replace('{{txid}}', order.txid)
            .replace('{{amount}}', order.amount.toFixed(2));

          await sendWhatsAppNotification(order.whatsapp, message, settings);
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/stats
    if (url.pathname === '/api/stats' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const stats = await env.TIKTOK_ORDERS.get('STATS');

      return new Response(JSON.stringify({ success: true, stats: JSON.parse(stats) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/orders
    if (url.pathname === '/api/orders' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
      const orderIds = orderList ? JSON.parse(orderList) : [];

      const orders = [];
      for (const orderId of orderIds) {
        const orderData = await env.TIKTOK_ORDERS.get(orderId);
        if (orderData) {
          orders.push(JSON.parse(orderData));
        }
      }

      return new Response(JSON.stringify({ success: true, orders }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/products
    if (url.pathname === '/api/products' && request.method === 'GET') {
      const productsList = await env.TIKTOK_ORDERS.get('PRODUCTS_LIST');
      const productIds = productsList ? JSON.parse(productsList) : [];

      const products = [];
      for (const productId of productIds) {
        const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + productId);
        if (productData) {
          products.push(JSON.parse(productData));
        }
      }

      return new Response(JSON.stringify({ success: true, products }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/products
    if (url.pathname === '/api/products' && request.method === 'POST') {
      const { password, product } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const productId = 'PROD_' + Date.now();
      product.id = productId;
      product.createdAt = new Date().toISOString();

      await env.TIKTOK_ORDERS.put('PRODUCT_' + productId, JSON.stringify(product));

      const productsList = await env.TIKTOK_ORDERS.get('PRODUCTS_LIST');
      const productIds = productsList ? JSON.parse(productsList) : [];
      productIds.unshift(productId);
      await env.TIKTOK_ORDERS.put('PRODUCTS_LIST', JSON.stringify(productIds));

      return new Response(JSON.stringify({ success: true, productId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // DELETE /api/products/:id
    if (url.pathname.startsWith('/api/products/') && request.method === 'DELETE') {
      const productId = url.pathname.split('/api/products/')[1];
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.delete('PRODUCT_' + productId);

      const productsList = await env.TIKTOK_ORDERS.get('PRODUCTS_LIST');
      const productIds = productsList ? JSON.parse(productsList) : [];
      const newProductIds = productIds.filter(id => id !== productId);
      await env.TIKTOK_ORDERS.put('PRODUCTS_LIST', JSON.stringify(newProductIds));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/set-active-product
    if (url.pathname === '/api/set-active-product' && request.method === 'POST') {
      const { password, productId } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      await env.TIKTOK_ORDERS.put('ACTIVE_PRODUCT', productId);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/active-product
    if (url.pathname === '/api/active-product' && request.method === 'GET') {
      const activeProductId = await env.TIKTOK_ORDERS.get('ACTIVE_PRODUCT');

      if (!activeProductId) {
        return new Response(JSON.stringify({ success: false, error: 'Nenhum produto ativo' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + activeProductId);
      if (!productData) {
        return new Response(JSON.stringify({ success: false, error: 'Produto não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ success: true, product: JSON.parse(productData) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/affiliates
    if (url.pathname === '/api/affiliates' && request.method === 'GET') {
      const password = url.searchParams.get('password');

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const affiliatesList = await env.TIKTOK_ORDERS.get('AFFILIATES_LIST');
      const affiliateCodes = affiliatesList ? JSON.parse(affiliatesList) : [];

      const affiliates = [];
      for (const code of affiliateCodes) {
        const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + code);
        if (affiliateData) {
          affiliates.push(JSON.parse(affiliateData));
        }
      }

      return new Response(JSON.stringify({ success: true, affiliates }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/affiliates
    if (url.pathname === '/api/affiliates' && request.method === 'POST') {
      const affiliate = await request.json();

      const code = affiliate.code.toUpperCase();

      // Verificar se já existe
      const existing = await env.TIKTOK_ORDERS.get('AFFILIATE_' + code);
      if (existing) {
        return new Response(JSON.stringify({ error: 'Código de afiliado já existe' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      affiliate.createdAt = new Date().toISOString();
      affiliate.status = 'pending';
      affiliate.sales = 0;
      affiliate.pendingCommission = 0;
      affiliate.paidCommission = 0;

      await env.TIKTOK_ORDERS.put('AFFILIATE_' + code, JSON.stringify(affiliate));

      const affiliatesList = await env.TIKTOK_ORDERS.get('AFFILIATES_LIST');
      const affiliateCodes = affiliatesList ? JSON.parse(affiliatesList) : [];
      affiliateCodes.unshift(code);
      await env.TIKTOK_ORDERS.put('AFFILIATES_LIST', JSON.stringify(affiliateCodes));

      const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
      stats.totalAffiliates += 1;
      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/approve-affiliate
    if (url.pathname === '/api/approve-affiliate' && request.method === 'POST') {
      const { password, code } = await request.json();

      if (password !== CONFIG.ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + code.toUpperCase());
      if (!affiliateData) {
        return new Response(JSON.stringify({ error: 'Afiliado não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const affiliate = JSON.parse(affiliateData);
      affiliate.status = 'approved';

      await env.TIKTOK_ORDERS.put('AFFILIATE_' + code.toUpperCase(), JSON.stringify(affiliate));

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/affiliate/:code
    if (url.pathname.startsWith('/api/affiliate/')) {
      const code = url.pathname.split('/api/affiliate/')[1].toUpperCase();

      const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + code);
      if (!affiliateData) {
        return new Response(JSON.stringify({ error: 'Afiliado não encontrado' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const affiliate = JSON.parse(affiliateData);

      // Buscar pedidos do afiliado
      const affiliateOrdersKey = 'AFFILIATE_ORDERS_' + code;
      let affiliateOrders = await env.TIKTOK_ORDERS.get(affiliateOrdersKey);
      const orderIds = affiliateOrders ? JSON.parse(affiliateOrders) : [];

      const orders = [];
      for (const orderId of orderIds) {
        const orderData = await env.TIKTOK_ORDERS.get(orderId);
        if (orderData) {
          orders.push(JSON.parse(orderData));
        }
      }

      const level = getAffiliateLevel(affiliate.sales || 0);

      return new Response(JSON.stringify({
        success: true,
        affiliate,
        level,
        orders
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Webhook Asaas
    if (url.pathname === '/webhook/asaas' && request.method === 'POST') {
      const data = await request.json();

      if (data.event === 'PAYMENT_CONFIRMED' || data.event === 'PAYMENT_RECEIVED') {
        const externalReference = data.payment.externalReference;

        // Buscar pedido pelo txid
        const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
        const orderIds = orderList ? JSON.parse(orderList) : [];

        for (const orderId of orderIds) {
          const orderData = await env.TIKTOK_ORDERS.get(orderId);
          if (orderData) {
            const order = JSON.parse(orderData);
            if (order.txid === externalReference && order.status === 'pending') {
              // Marcar como pago
              order.status = 'paid';
              order.paidAt = new Date().toISOString();
              await env.TIKTOK_ORDERS.put(orderId, JSON.stringify(order));

              // Atualizar estatísticas e comissões (mesmo código do mark-paid)
              const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
              stats.totalPaidOrders += 1;
              stats.totalRevenue += order.amount;

              if (order.affiliateCode) {
                const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + order.affiliateCode);
                if (affiliateData) {
                  const affiliate = JSON.parse(affiliateData);
                  affiliate.sales = (affiliate.sales || 0) + 1;

                  const finalOrderValue = order.amount;
                  const commissionAmount = finalOrderValue * (order.affiliateCommission || 30) / 100;

                  affiliate.pendingCommission = (affiliate.pendingCommission || 0) + commissionAmount;
                  stats.totalPendingCommission += commissionAmount;

                  await env.TIKTOK_ORDERS.put('AFFILIATE_' + order.affiliateCode, JSON.stringify(affiliate));

                  const affiliateOrdersKey = 'AFFILIATE_ORDERS_' + order.affiliateCode;
                  let affiliateOrders = await env.TIKTOK_ORDERS.get(affiliateOrdersKey);
                  affiliateOrders = affiliateOrders ? JSON.parse(affiliateOrders) : [];
                  affiliateOrders.unshift(orderId);
                  await env.TIKTOK_ORDERS.put(affiliateOrdersKey, JSON.stringify(affiliateOrders));
                }
              }

              await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

              // Enviar notificação WhatsApp
              const notificationSettings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
              if (notificationSettings) {
                const settings = JSON.parse(notificationSettings);
                if (settings.whatsapp_enabled) {
                  const message = settings.templates.payment_confirmed
                    .replace('{{name}}', order.name)
                    .replace('{{txid}}', order.txid)
                    .replace('{{amount}}', order.amount.toFixed(2));

                  await sendWhatsAppNotification(order.whatsapp, message, settings);
                }
              }

              break;
            }
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ==========================================
    // PÁGINAS HTML
    // ==========================================

    // Rota raiz - Checkout
    if (url.pathname === '/' || url.pathname === '/checkout') {
      return new Response('Checkout HTML v4.0 - Em desenvolvimento', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Admin
    if (url.pathname === '/admin') {
      return new Response('Admin Panel v4.0 - Em desenvolvimento', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Afiliado
    if (url.pathname === '/afiliado') {
      return new Response('Affiliate Panel v4.0 - Em desenvolvimento', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // 404
    return new Response('404 - Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};
