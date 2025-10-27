// ============================================
// TIKTOK SHOP UK v4.0 - CÓDIGO ÚNICO COMPLETO
// 100% PRONTO PARA CLOUDFLARE DASHBOARD
// ============================================

// ⚠️ CONFIGURAR ESTAS VARIÁVEIS ANTES DE USAR
const CONFIG = {
  ADMIN_PASSWORD: 'admin123',  // ALTERAR!
  ASAAS_API_KEY: 'SUA_CHAVE_ASAAS_AQUI',  // Pegar em: https://www.asaas.com/
  ASAAS_BASE_URL: 'https://api.asaas.com/v3',  // PRODUÇÃO (remover 'sandbox.' para produção real)
  SITE_URL: 'https://seu-worker.workers.dev'  // URL do seu worker
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
// FUNÇÕES DE PAGAMENTO ASAAS - CORRIGIDAS
// ============================================

async function createAsaasPixPayment(customer, amount, externalReference, env) {
  try {
    console.log('Criando pagamento PIX - Valor:', amount);

    // 1. Buscar ou criar customer
    let customerId = null;

    const searchUrl = `${CONFIG.ASAAS_BASE_URL}/customers?cpfCnpj=${customer.cpfCnpj}`;
    console.log('Buscando customer:', searchUrl);

    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      }
    });

    const searchResult = await searchResponse.json();
    console.log('Resultado busca customer:', searchResult);

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
      console.log('Customer encontrado:', customerId);
    } else {
      // Criar customer
      console.log('Criando novo customer');
      const customerPayload = {
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        email: customer.email,
        mobilePhone: customer.mobilePhone
      };

      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify(customerPayload)
      });

      const customerResult = await customerResponse.json();
      console.log('Resultado criação customer:', customerResult);

      if (!customerResponse.ok) {
        console.error('Erro ao criar customer:', customerResult);
        return { success: false, error: 'Erro ao criar cliente: ' + (customerResult.errors?.[0]?.description || 'Desconhecido') };
      }

      customerId = customerResult.id;
      console.log('Customer criado:', customerId);
    }

    // 2. Criar cobrança PIX
    const today = new Date();
    const dueDate = new Date(today.getTime() + (24 * 60 * 60 * 1000)); // +1 dia
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const paymentPayload = {
      customer: customerId,
      billingType: 'PIX',
      value: parseFloat(amount),
      dueDate: dueDateStr,
      description: 'Pagamento TikTok Shop UK',
      externalReference: externalReference
    };

    console.log('Criando cobrança PIX:', paymentPayload);

    const paymentResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentResult = await paymentResponse.json();
    console.log('Resultado criação cobrança:', paymentResult);

    if (!paymentResponse.ok) {
      console.error('Erro ao criar cobrança:', paymentResult);
      return {
        success: false,
        error: 'Erro ao criar cobrança PIX: ' + (paymentResult.errors?.[0]?.description || 'Desconhecido')
      };
    }

    // 3. Gerar QR Code PIX
    console.log('Gerando QR Code para payment:', paymentResult.id);

    const pixResponse = await fetch(
      `${CONFIG.ASAAS_BASE_URL}/payments/${paymentResult.id}/pixQrCode`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        }
      }
    );

    const pixData = await pixResponse.json();
    console.log('Resultado QR Code:', pixData);

    if (!pixResponse.ok) {
      console.error('Erro ao gerar QR Code:', pixData);
      return {
        success: false,
        error: 'Erro ao gerar QR Code: ' + (pixData.errors?.[0]?.description || 'Desconhecido')
      };
    }

    console.log('PIX criado com sucesso!');
    return {
      success: true,
      paymentId: paymentResult.id,
      pixCode: pixData.payload,
      pixQRCode: pixData.encodedImage,
      expirationDate: pixData.expirationDate
    };

  } catch (error) {
    console.error('Erro geral ao criar PIX:', error);
    return { success: false, error: 'Erro ao processar pagamento: ' + error.message };
  }
}

async function createAsaasCardPayment(customer, amount, cardData, externalReference, env) {
  try {
    console.log('Criando pagamento CARTÃO - Valor:', amount);

    // Buscar ou criar customer
    let customerId = null;

    const searchUrl = `${CONFIG.ASAAS_BASE_URL}/customers?cpfCnpj=${customer.cpfCnpj}`;
    const searchResponse = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      }
    });

    const searchResult = await searchResponse.json();

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerPayload = {
        name: customer.name,
        cpfCnpj: customer.cpfCnpj,
        email: customer.email,
        mobilePhone: customer.mobilePhone
      };

      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify(customerPayload)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        return { success: false, error: 'Erro ao criar cliente' };
      }

      customerId = customerResult.id;
    }

    // Criar pagamento com cartão
    const today = new Date();
    const dueDate = new Date(today.getTime() + (24 * 60 * 60 * 1000));
    const dueDateStr = dueDate.toISOString().split('T')[0];

    const paymentPayload = {
      customer: customerId,
      billingType: 'CREDIT_CARD',
      value: parseFloat(amount),
      dueDate: dueDateStr,
      description: 'Pagamento TikTok Shop UK',
      externalReference: externalReference,
      installmentCount: parseInt(cardData.installments) || 1,
      installmentValue: parseFloat(amount) / (parseInt(cardData.installments) || 1),
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
      },
      remoteIp: '127.0.0.1'
    };

    console.log('Criando pagamento cartão:', paymentPayload);

    const paymentResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'access_token': CONFIG.ASAAS_API_KEY
      },
      body: JSON.stringify(paymentPayload)
    });

    const paymentResult = await paymentResponse.json();
    console.log('Resultado pagamento cartão:', paymentResult);

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
    console.error('Erro ao criar pagamento cartão:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function getAffiliateLevel(sales) {
  if (sales >= 100) return { name: 'DIAMANTE', icon: '👑', commission: 50 };
  if (sales >= 50) return { name: 'PLATINA', icon: '💎', commission: 45 };
  if (sales >= 25) return { name: 'OURO', icon: '🥇', commission: 40 };
  if (sales >= 10) return { name: 'PRATA', icon: '🥈', commission: 35 };
  return { name: 'BRONZE', icon: '🥉', commission: 30 };
}

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

      // Configurações v4.0
      await env.TIKTOK_ORDERS.put('PAYMENT_SETTINGS', JSON.stringify({
        pix_enabled: true,
        card_enabled: true,
        pix_config: {
          api_key: CONFIG.ASAAS_API_KEY,
          expiration_minutes: 30
        },
        card_config: {
          api_key: CONFIG.ASAAS_API_KEY,
          max_installments: 12,
          min_installment_value: 20
        }
      }));

      await env.TIKTOK_ORDERS.put('SHIPPING_SETTINGS', JSON.stringify({
        melhor_envio_token: '',
        origin_cep: '',
        default_dimensions: { length: 20, width: 15, height: 5, weight: 0.5 },
        active_services: ['PAC', 'SEDEX'],
        store_pickup_enabled: false
      }));

      await env.TIKTOK_ORDERS.put('BANNER_SETTINGS', JSON.stringify({
        enabled: false,
        image_url: '',
        target_url: ''
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

    // Inicializar sistema
    await initializeSystem(env);

    // ==========================================
    // ROTAS API
    // ==========================================

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

    // GET /api/payment-settings
    if (url.pathname === '/api/payment-settings' && request.method === 'GET') {
      let settings = await env.TIKTOK_ORDERS.get('PAYMENT_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        pix_enabled: true,
        card_enabled: true
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // GET /api/banner-settings
    if (url.pathname === '/api/banner-settings' && request.method === 'GET') {
      let settings = await env.TIKTOK_ORDERS.get('BANNER_SETTINGS');
      settings = settings ? JSON.parse(settings) : {
        enabled: false
      };

      return new Response(JSON.stringify({ success: true, settings }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // POST /api/create-order
    if (url.pathname === '/api/create-order' && request.method === 'POST') {
      const data = await request.json();

      console.log('=== CRIANDO PEDIDO ===');
      console.log('Dados recebidos:', JSON.stringify(data, null, 2));

      // Validar CPF
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
      console.log('Produto:', product);

      let orderValue = product.price;
      let discountAmount = 0;
      let couponApplied = null;

      // Aplicar cupom
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

      // Adicionar frete
      let shippingCost = 0;
      if (product.type === 'physical' && data.shipping) {
        shippingCost = parseFloat(data.shipping.price) || 0;
        orderValue = orderValue + shippingCost;
      }

      const finalOrderValue = orderValue;
      console.log('Valor final do pedido:', finalOrderValue);

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
      console.log('Método de pagamento:', paymentMethod);

      let paymentResult;

      const customerData = {
        name: data.name,
        email: data.email,
        cpfCnpj: data.cpf.replace(/\D/g, ''),
        mobilePhone: data.whatsapp.replace(/\D/g, '')
      };

      if (paymentMethod === 'pix') {
        console.log('Criando pagamento PIX...');
        paymentResult = await createAsaasPixPayment(
          customerData,
          finalOrderValue,
          txid,
          env
        );
        console.log('Resultado PIX:', paymentResult);

        if (!paymentResult.success) {
          return new Response(JSON.stringify({ error: paymentResult.error }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else if (paymentMethod === 'card') {
        console.log('Criando pagamento CARTÃO...');
        paymentResult = await createAsaasCardPayment(
          customerData,
          finalOrderValue,
          data.cardData,
          txid,
          env
        );
        console.log('Resultado CARTÃO:', paymentResult);

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

      // Adicionar à lista
      const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
      const orders = orderList ? JSON.parse(orderList) : [];
      orders.unshift(orderId);
      await env.TIKTOK_ORDERS.put('ORDER_LIST', JSON.stringify(orders));

      // Atualizar uso do cupom
      if (couponApplied) {
        couponApplied.current_uses += 1;
        await env.TIKTOK_ORDERS.put('COUPON_' + couponApplied.code, JSON.stringify(couponApplied));
      }

      // Atualizar stats
      const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
      stats.totalOrders += 1;
      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      console.log('Pedido criado com sucesso!');

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

    // POST /api/mark-paid
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

      // Atualizar stats
      const stats = JSON.parse(await env.TIKTOK_ORDERS.get('STATS'));
      stats.totalPaidOrders += 1;
      stats.totalRevenue += order.amount;

      // Atualizar comissão afiliado (CORRIGIDO)
      if (order.affiliateCode) {
        const affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + order.affiliateCode);
        if (affiliateData) {
          const affiliate = JSON.parse(affiliateData);
          affiliate.sales = (affiliate.sales || 0) + 1;

          // Comissão sobre VALOR FINAL
          const finalOrderValue = order.amount;
          const commissionAmount = finalOrderValue * (order.affiliateCommission || 30) / 100;

          affiliate.pendingCommission = (affiliate.pendingCommission || 0) + commissionAmount;
          stats.totalPendingCommission += commissionAmount;

          await env.TIKTOK_ORDERS.put('AFFILIATE_' + order.affiliateCode, JSON.stringify(affiliate));
        }
      }

      await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

      return new Response(JSON.stringify({ success: true }), {
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

      const existing = await env.TIKTOK_ORDERS.get('AFFILIATE_' + code);
      if (existing) {
        return new Response(JSON.stringify({ error: 'Código já existe' }), {
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
      const level = getAffiliateLevel(affiliate.sales || 0);

      // Buscar pedidos
      const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
      const orderIds = orderList ? JSON.parse(orderList) : [];
      const orders = [];

      for (const orderId of orderIds) {
        const orderData = await env.TIKTOK_ORDERS.get(orderId);
        if (orderData) {
          const order = JSON.parse(orderData);
          if (order.affiliateCode === code) {
            orders.push(order);
          }
        }
      }

      return new Response(JSON.stringify({
        success: true,
        affiliate,
        level,
        orders
      }), {
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

    // Webhook Asaas
    if (url.pathname === '/webhook/asaas' && request.method === 'POST') {
      const data = await request.json();
      console.log('Webhook Asaas recebido:', data);

      if (data.event === 'PAYMENT_CONFIRMED' || data.event === 'PAYMENT_RECEIVED') {
        const externalReference = data.payment.externalReference;

        const orderList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
        const orderIds = orderList ? JSON.parse(orderList) : [];

        for (const orderId of orderIds) {
          const orderData = await env.TIKTOK_ORDERS.get(orderId);
          if (orderData) {
            const order = JSON.parse(orderData);
            if (order.txid === externalReference && order.status === 'pending') {
              order.status = 'paid';
              order.paidAt = new Date().toISOString();
              await env.TIKTOK_ORDERS.put(orderId, JSON.stringify(order));

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
                }
              }

              await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));
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
    // PÁGINAS HTML (EMBUTIDAS)
    // ==========================================

    // Rota raiz - Checkout
    if (url.pathname === '/' || url.pathname === '/checkout') {
      return new Response(CHECKOUT_HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Admin
    if (url.pathname === '/admin') {
      return new Response(ADMIN_HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // Afiliado
    if (url.pathname === '/afiliado') {
      return new Response(AFFILIATE_HTML, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // 404
    return new Response('404 - Not Found', {
      status: 404,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
};

// ============================================
// HTMLs EMBUTIDOS (Simplificados para economizar espaço)
// ============================================

const CHECKOUT_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Checkout - TikTok Shop UK</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen py-8 px-4">
  <div class="max-w-2xl mx-auto bg-white rounded-2xl shadow-2xl p-8">
    <h1 class="text-3xl font-bold text-center mb-8">Finalizar Compra</h1>

    <div id="form" class="space-y-4">
      <input type="hidden" id="productId" value="">

      <div>
        <label class="block font-semibold mb-2">Nome Completo *</label>
        <input type="text" id="name" required class="w-full px-4 py-3 border-2 rounded-lg">
      </div>

      <div>
        <label class="block font-semibold mb-2">Email *</label>
        <input type="email" id="email" required class="w-full px-4 py-3 border-2 rounded-lg">
      </div>

      <div>
        <label class="block font-semibold mb-2">WhatsApp *</label>
        <input type="tel" id="whatsapp" required placeholder="(00) 00000-0000" maxlength="15" class="w-full px-4 py-3 border-2 rounded-lg">
      </div>

      <div>
        <label class="block font-semibold mb-2">CPF *</label>
        <input type="text" id="cpf" required placeholder="000.000.000-00" maxlength="14" class="w-full px-4 py-3 border-2 rounded-lg">
        <p id="cpfError" class="text-red-500 text-sm mt-1 hidden">CPF inválido</p>
      </div>

      <div>
        <label class="block font-semibold mb-2">Cupom de Desconto</label>
        <div class="flex gap-2">
          <input type="text" id="couponCode" placeholder="DESCONTO10" class="flex-1 px-4 py-3 border-2 rounded-lg uppercase">
          <button onclick="applyCoupon()" class="bg-purple-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-purple-700">Aplicar</button>
        </div>
        <p id="couponSuccess" class="text-green-600 text-sm mt-1 hidden"></p>
        <p id="couponError" class="text-red-500 text-sm mt-1 hidden"></p>
      </div>

      <div class="border-t pt-4">
        <div class="flex justify-between mb-2">
          <span>Subtotal:</span>
          <span id="displaySubtotal" class="font-bold">R$ 0,00</span>
        </div>
        <div id="discountRow" class="flex justify-between mb-2 text-green-600 hidden">
          <span>Desconto:</span>
          <span id="displayDiscount" class="font-bold">-R$ 0,00</span>
        </div>
        <div class="flex justify-between text-xl font-bold">
          <span>TOTAL:</span>
          <span id="displayTotal">R$ 0,00</span>
        </div>
      </div>

      <button onclick="processPayment()" class="w-full bg-gradient-to-r from-green-500 to-green-600 text-white font-bold py-4 rounded-lg text-lg hover:opacity-90">
        GERAR PIX
      </button>
    </div>

    <div id="pixResult" class="hidden text-center">
      <h2 class="text-2xl font-bold text-green-600 mb-4">✅ PIX Gerado!</h2>
      <img id="pixQRCode" src="" alt="QR Code" class="mx-auto mb-4" style="max-width: 300px;">
      <div class="bg-gray-100 p-4 rounded-lg mb-4">
        <p class="text-xs break-all" id="pixCodeText"></p>
      </div>
      <button onclick="copyPix()" class="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-blue-700">
        📋 COPIAR CÓDIGO PIX
      </button>
      <p class="text-sm text-gray-600 mt-4">Aguardando pagamento...</p>
    </div>
  </div>

  <script>
    let productData = null;
    let appliedCoupon = null;
    let couponDiscount = 0;
    let pixCode = '';

    async function init() {
      try {
        const response = await fetch('/api/active-product');
        const data = await response.json();
        if (data.success) {
          productData = data.product;
          document.getElementById('productId').value = data.product.id;
          updateDisplay();
        }
      } catch (error) {
        console.error('Erro ao carregar produto:', error);
      }
    }

    // Máscaras
    document.getElementById('whatsapp').addEventListener('input', (e) => {
      let v = e.target.value.replace(/\\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 10) {
        v = \`(\${v.slice(0,2)}) \${v.slice(2,7)}-\${v.slice(7)}\`;
      } else if (v.length > 6) {
        v = \`(\${v.slice(0,2)}) \${v.slice(2,6)}-\${v.slice(6)}\`;
      } else if (v.length > 2) {
        v = \`(\${v.slice(0,2)}) \${v.slice(2)}\`;
      }
      e.target.value = v;
    });

    document.getElementById('cpf').addEventListener('input', (e) => {
      let v = e.target.value.replace(/\\D/g, '');
      if (v.length > 11) v = v.slice(0, 11);
      if (v.length > 9) {
        v = v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6,9) + '-' + v.slice(9);
      } else if (v.length > 6) {
        v = v.slice(0,3) + '.' + v.slice(3,6) + '.' + v.slice(6);
      } else if (v.length > 3) {
        v = v.slice(0,3) + '.' + v.slice(3);
      }
      e.target.value = v;

      if (v.replace(/\\D/g, '').length === 11) {
        if (validateCPF(v)) {
          document.getElementById('cpfError').classList.add('hidden');
        } else {
          document.getElementById('cpfError').classList.remove('hidden');
        }
      }
    });

    function validateCPF(cpf) {
      cpf = cpf.replace(/\\D/g, '');
      if (cpf.length !== 11 || /^(\\d)\\1{10}$/.test(cpf)) return false;

      let sum = 0;
      for (let i = 0; i < 9; i++) sum += parseInt(cpf.charAt(i)) * (10 - i);
      let digit = 11 - (sum % 11);
      if (digit >= 10) digit = 0;
      if (digit !== parseInt(cpf.charAt(9))) return false;

      sum = 0;
      for (let i = 0; i < 10; i++) sum += parseInt(cpf.charAt(i)) * (11 - i);
      digit = 11 - (sum % 11);
      if (digit >= 10) digit = 0;
      if (digit !== parseInt(cpf.charAt(10))) return false;

      return true;
    }

    async function applyCoupon() {
      const code = document.getElementById('couponCode').value.trim().toUpperCase();
      if (!code || !productData) return;

      try {
        const response = await fetch('/api/validate-coupon', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code,
            orderValue: productData.price,
            productId: productData.id
          })
        });

        const data = await response.json();

        if (data.success) {
          appliedCoupon = data.coupon;
          couponDiscount = data.discount;
          document.getElementById('couponSuccess').textContent = '✅ Cupom aplicado! Desconto: R$ ' + data.discount.toFixed(2);
          document.getElementById('couponSuccess').classList.remove('hidden');
          document.getElementById('couponError').classList.add('hidden');
          document.getElementById('discountRow').classList.remove('hidden');
          updateDisplay();
        } else {
          document.getElementById('couponError').textContent = data.error;
          document.getElementById('couponError').classList.remove('hidden');
          document.getElementById('couponSuccess').classList.add('hidden');
        }
      } catch (error) {
        console.error('Erro ao validar cupom:', error);
      }
    }

    function updateDisplay() {
      if (!productData) return;

      const subtotal = productData.price;
      const discount = couponDiscount;
      const total = subtotal - discount;

      document.getElementById('displaySubtotal').textContent = 'R$ ' + subtotal.toFixed(2).replace('.', ',');
      document.getElementById('displayDiscount').textContent = '-R$ ' + discount.toFixed(2).replace('.', ',');
      document.getElementById('displayTotal').textContent = 'R$ ' + total.toFixed(2).replace('.', ',');
    }

    async function processPayment() {
      if (!productData) {
        alert('Erro: Produto não encontrado');
        return;
      }

      const name = document.getElementById('name').value.trim();
      const email = document.getElementById('email').value.trim();
      const whatsapp = document.getElementById('whatsapp').value.trim();
      const cpf = document.getElementById('cpf').value.trim();

      if (!name || !email || !whatsapp || !cpf) {
        alert('Preencha todos os campos obrigatórios');
        return;
      }

      if (!validateCPF(cpf)) {
        alert('CPF inválido');
        return;
      }

      const orderData = {
        productId: productData.id,
        name,
        email,
        whatsapp,
        cpf,
        paymentMethod: 'pix',
        couponCode: appliedCoupon ? appliedCoupon.code : null
      };

      try {
        const response = await fetch('/api/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(orderData)
        });

        const data = await response.json();

        if (data.success) {
          pixCode = data.pixCode;
          document.getElementById('pixQRCode').src = data.pixQRCode;
          document.getElementById('pixCodeText').textContent = data.pixCode;

          document.getElementById('form').classList.add('hidden');
          document.getElementById('pixResult').classList.remove('hidden');
        } else {
          alert('Erro ao criar pedido: ' + data.error);
        }
      } catch (error) {
        console.error('Erro ao processar pagamento:', error);
        alert('Erro ao processar pagamento');
      }
    }

    function copyPix() {
      navigator.clipboard.writeText(pixCode).then(() => {
        alert('✅ Código PIX copiado!');
      });
    }

    window.addEventListener('DOMContentLoaded', init);
  </script>
</body>
</html>`;

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Panel</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen">
  <div id="loginScreen" class="flex items-center justify-center min-h-screen">
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold mb-6 text-center">🔐 Admin Login</h2>
      <input type="password" id="passwordInput" placeholder="Senha" class="w-full px-4 py-3 border-2 rounded-lg mb-4">
      <button onclick="login()" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg">ENTRAR</button>
      <p id="loginError" class="text-red-500 text-sm mt-2 hidden text-center">Senha incorreta</p>
    </div>
  </div>

  <div id="adminContent" class="hidden p-4">
    <div class="max-w-7xl mx-auto">
      <div class="bg-white rounded-2xl shadow-2xl p-8 mb-4">
        <div class="flex justify-between items-center">
          <h1 class="text-3xl font-bold">🔧 Admin Panel</h1>
          <button onclick="logout()" class="bg-red-500 text-white px-4 py-2 rounded-lg">Sair</button>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Total Pedidos</div>
          <div class="text-3xl font-bold text-purple-600" id="stat-orders">0</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Pedidos Pagos</div>
          <div class="text-3xl font-bold text-green-600" id="stat-paid">0</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Receita</div>
          <div class="text-3xl font-bold text-blue-600" id="stat-revenue">R$ 0</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Afiliados</div>
          <div class="text-3xl font-bold text-orange-600" id="stat-affiliates">0</div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <div class="flex gap-2 mb-6 overflow-x-auto">
          <button onclick="showTab('products')" class="tab-btn px-4 py-2 rounded-lg font-semibold bg-purple-600 text-white">Produtos</button>
          <button onclick="showTab('orders')" class="tab-btn px-4 py-2 rounded-lg font-semibold">Pedidos</button>
          <button onclick="showTab('affiliates')" class="tab-btn px-4 py-2 rounded-lg font-semibold">Afiliados</button>
        </div>

        <div id="content"></div>
      </div>
    </div>
  </div>

  <script>
    let adminPassword = '';

    async function login() {
      const password = document.getElementById('passwordInput').value;
      adminPassword = password;

      try {
        const response = await fetch('/api/stats?password=' + password);
        const data = await response.json();

        if (data.success) {
          document.getElementById('loginScreen').classList.add('hidden');
          document.getElementById('adminContent').classList.remove('hidden');
          loadDashboard();
          showTab('products');
        } else {
          document.getElementById('loginError').classList.remove('hidden');
        }
      } catch {
        document.getElementById('loginError').classList.remove('hidden');
      }
    }

    function logout() {
      adminPassword = '';
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('adminContent').classList.add('hidden');
      document.getElementById('passwordInput').value = '';
    }

    async function loadDashboard() {
      const response = await fetch('/api/stats?password=' + adminPassword);
      const data = await response.json();

      if (data.success) {
        document.getElementById('stat-orders').textContent = data.stats.totalOrders;
        document.getElementById('stat-paid').textContent = data.stats.totalPaidOrders;
        document.getElementById('stat-revenue').textContent = 'R$ ' + data.stats.totalRevenue.toFixed(2);
        document.getElementById('stat-affiliates').textContent = data.stats.totalAffiliates;
      }
    }

    function showTab(tab) {
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.className = 'tab-btn px-4 py-2 rounded-lg font-semibold bg-gray-200';
      });
      event.target.className = 'tab-btn px-4 py-2 rounded-lg font-semibold bg-purple-600 text-white';

      if (tab === 'products') loadProducts();
      if (tab === 'orders') loadOrders();
      if (tab === 'affiliates') loadAffiliates();
    }

    async function loadProducts() {
      const response = await fetch('/api/products');
      const data = await response.json();

      let html = '<button onclick="showNewProductForm()" class="mb-4 bg-green-600 text-white px-6 py-3 rounded-lg font-bold">+ Novo Produto</button>';
      html += '<div id="productForm" class="hidden mb-6 border-2 border-purple-600 rounded-lg p-6"><h3 class="text-xl font-bold mb-4">Novo Produto</h3>';
      html += '<input type="text" id="pName" placeholder="Nome" class="w-full px-4 py-2 border-2 rounded-lg mb-2">';
      html += '<input type="number" id="pPrice" placeholder="Preço" class="w-full px-4 py-2 border-2 rounded-lg mb-2">';
      html += '<select id="pType" class="w-full px-4 py-2 border-2 rounded-lg mb-2"><option value="digital">Digital</option><option value="physical">Físico</option></select>';
      html += '<input type="url" id="pImage" placeholder="URL da Imagem" class="w-full px-4 py-2 border-2 rounded-lg mb-4">';
      html += '<button onclick="saveProduct()" class="bg-purple-600 text-white px-6 py-2 rounded-lg font-bold">Salvar</button></div>';

      html += '<div class="space-y-4">';
      data.products.forEach(p => {
        html += \`<div class="border-2 rounded-lg p-4"><div class="flex justify-between items-start"><div><h3 class="font-bold text-lg">\${p.name}</h3><p class="text-purple-600 font-bold">R$ \${p.price.toFixed(2)}</p><p class="text-sm text-gray-600">\${p.type === 'digital' ? 'Digital' : 'Físico'}</p></div><div class="flex gap-2"><button onclick="setActive('\${p.id}')" class="bg-blue-500 text-white px-4 py-2 rounded-lg text-sm">Ativar</button><button onclick="deleteProduct('\${p.id}')" class="bg-red-500 text-white px-4 py-2 rounded-lg text-sm">Deletar</button></div></div></div>\`;
      });
      html += '</div>';

      document.getElementById('content').innerHTML = html;
    }

    function showNewProductForm() {
      document.getElementById('productForm').classList.toggle('hidden');
    }

    async function saveProduct() {
      const product = {
        name: document.getElementById('pName').value,
        price: parseFloat(document.getElementById('pPrice').value),
        type: document.getElementById('pType').value,
        image: document.getElementById('pImage').value,
        stock: null
      };

      await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, product })
      });

      loadProducts();
    }

    async function setActive(id) {
      await fetch('/api/set-active-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, productId: id })
      });
      alert('Produto ativado!');
    }

    async function deleteProduct(id) {
      if (!confirm('Deletar produto?')) return;
      await fetch('/api/products/' + id + '?password=' + adminPassword, { method: 'DELETE' });
      loadProducts();
    }

    async function loadOrders() {
      const response = await fetch('/api/orders?password=' + adminPassword);
      const data = await response.json();

      let html = '<div class="space-y-4">';
      data.orders.forEach(o => {
        const statusColor = o.status === 'paid' ? 'text-green-600' : 'text-yellow-600';
        html += \`<div class="border-2 rounded-lg p-4"><div class="flex justify-between items-start"><div><h3 class="font-bold">\${o.name}</h3><p class="text-sm">\${o.email} | \${o.whatsapp}</p><p class="text-sm">CPF: \${o.cpf}</p><p class="text-sm font-semibold mt-2">\${o.productName}</p><p>R$ \${o.amount.toFixed(2)}</p><p class="\${statusColor} font-semibold">\${o.status === 'paid' ? 'PAGO' : 'PENDENTE'}</p></div>\`;
        if (o.status === 'pending') {
          html += \`<button onclick="markPaid('\${o.id}')" class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">Marcar Pago</button>\`;
        }
        html += '</div></div>';
      });
      html += '</div>';

      document.getElementById('content').innerHTML = html;
    }

    async function markPaid(id) {
      if (!confirm('Confirmar pagamento?')) return;
      await fetch('/api/mark-paid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, orderId: id })
      });
      loadOrders();
      loadDashboard();
    }

    async function loadAffiliates() {
      const response = await fetch('/api/affiliates?password=' + adminPassword);
      const data = await response.json();

      let html = '<div class="space-y-4">';
      data.affiliates.forEach(a => {
        const statusColor = a.status === 'approved' ? 'text-green-600' : 'text-yellow-600';
        html += \`<div class="border-2 rounded-lg p-4"><div class="flex justify-between items-start"><div><h3 class="font-bold">\${a.name}</h3><p class="text-sm">\${a.email} | \${a.whatsapp}</p><p class="text-sm">Código: <span class="font-mono font-bold">\${a.code}</span></p><p class="text-sm">Vendas: \${a.sales || 0}</p><p class="text-sm">Comissão: R$ \${(a.pendingCommission || 0).toFixed(2)}</p><p class="\${statusColor} font-semibold">\${a.status === 'approved' ? 'APROVADO' : 'PENDENTE'}</p></div>\`;
        if (a.status === 'pending') {
          html += \`<button onclick="approveAffiliate('\${a.code}')" class="bg-green-500 text-white px-4 py-2 rounded-lg text-sm">Aprovar</button>\`;
        }
        html += '</div></div>';
      });
      html += '</div>';

      document.getElementById('content').innerHTML = html;
    }

    async function approveAffiliate(code) {
      await fetch('/api/approve-affiliate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword, code })
      });
      loadAffiliates();
    }
  </script>
</body>
</html>`;

const AFFILIATE_HTML = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Painel do Afiliado</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-purple-600 to-blue-600 min-h-screen">
  <div id="loginScreen" class="flex items-center justify-center min-h-screen">
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold mb-6 text-center">👤 Painel do Afiliado</h2>
      <input type="text" id="codeInput" placeholder="Código de Afiliado" class="w-full px-4 py-3 border-2 rounded-lg mb-4 uppercase">
      <button onclick="login()" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg mb-4">ACESSAR</button>
      <button onclick="showRegister()" class="w-full border-2 border-purple-600 text-purple-600 font-bold py-3 rounded-lg">CADASTRAR</button>
      <p id="loginError" class="text-red-500 text-sm mt-2 hidden text-center">Código inválido</p>
    </div>
  </div>

  <div id="registerScreen" class="hidden flex items-center justify-center min-h-screen">
    <div class="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full mx-4">
      <h2 class="text-2xl font-bold mb-6 text-center">📝 Cadastro</h2>
      <input type="text" id="regName" placeholder="Nome Completo" class="w-full px-4 py-3 border-2 rounded-lg mb-2">
      <input type="email" id="regEmail" placeholder="Email" class="w-full px-4 py-3 border-2 rounded-lg mb-2">
      <input type="tel" id="regWhatsapp" placeholder="WhatsApp" class="w-full px-4 py-3 border-2 rounded-lg mb-2">
      <input type="text" id="regCode" placeholder="Código Desejado" class="w-full px-4 py-3 border-2 rounded-lg mb-4 uppercase">
      <button onclick="register()" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg mb-2">CADASTRAR</button>
      <button onclick="backToLogin()" class="w-full border-2 border-gray-300 font-bold py-3 rounded-lg">VOLTAR</button>
    </div>
  </div>

  <div id="affiliateContent" class="hidden p-4">
    <div class="max-w-7xl mx-auto">
      <div class="bg-white rounded-2xl shadow-2xl p-8 mb-4">
        <div class="flex justify-between items-center">
          <div>
            <h1 class="text-3xl font-bold">👋 Olá, <span id="affiliateName">Afiliado</span>!</h1>
            <p class="text-gray-600">Código: <span id="affiliateCode" class="font-mono font-bold"></span></p>
          </div>
          <button onclick="logout()" class="bg-red-500 text-white px-4 py-2 rounded-lg">Sair</button>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow-2xl p-6 mb-4">
        <div class="flex items-center justify-between">
          <div>
            <h2 class="text-xl font-bold mb-2">Seu Nível</h2>
            <span id="levelBadge" class="inline-block px-4 py-2 rounded-full font-bold"></span>
            <p class="mt-2">Comissão: <span id="levelCommission" class="font-bold text-purple-600"></span></p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Vendas</div>
          <div class="text-3xl font-bold text-purple-600" id="stat-sales">0</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Comissão Pendente</div>
          <div class="text-3xl font-bold text-yellow-600" id="stat-pending">R$ 0</div>
        </div>
        <div class="bg-white rounded-lg shadow p-6">
          <div class="text-gray-600 text-sm font-semibold mb-2">Recebido</div>
          <div class="text-3xl font-bold text-green-600" id="stat-paid">R$ 0</div>
        </div>
      </div>

      <div class="bg-white rounded-2xl shadow-2xl p-8">
        <h2 class="text-2xl font-bold mb-4">🔗 Seu Link de Afiliado</h2>
        <div class="bg-gray-100 p-4 rounded-lg mb-4">
          <p class="text-sm font-mono break-all" id="affiliateLink"></p>
        </div>
        <button onclick="copyLink()" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold py-3 rounded-lg">
          📋 COPIAR LINK
        </button>
      </div>
    </div>
  </div>

  <script>
    let currentCode = '';

    const levelConfig = {
      'BRONZE': { color: '#CD7F32', commission: 30, icon: '🥉' },
      'PRATA': { color: '#C0C0C0', commission: 35, icon: '🥈' },
      'OURO': { color: '#FFD700', commission: 40, icon: '🥇' },
      'PLATINA': { color: '#E5E4E2', commission: 45, icon: '💎' },
      'DIAMANTE': { color: '#B9F2FF', commission: 50, icon: '👑' }
    };

    async function login() {
      const code = document.getElementById('codeInput').value.toUpperCase().trim();
      if (!code) return;

      try {
        const response = await fetch('/api/affiliate/' + code);
        const data = await response.json();

        if (data.success) {
          currentCode = code;
          document.getElementById('loginScreen').classList.add('hidden');
          document.getElementById('affiliateContent').classList.remove('hidden');
          loadAffiliate(data);
        } else {
          document.getElementById('loginError').classList.remove('hidden');
        }
      } catch {
        document.getElementById('loginError').classList.remove('hidden');
      }
    }

    function logout() {
      currentCode = '';
      document.getElementById('loginScreen').classList.remove('hidden');
      document.getElementById('affiliateContent').classList.add('hidden');
      document.getElementById('codeInput').value = '';
    }

    function showRegister() {
      document.getElementById('loginScreen').classList.add('hidden');
      document.getElementById('registerScreen').classList.remove('hidden');
    }

    function backToLogin() {
      document.getElementById('registerScreen').classList.add('hidden');
      document.getElementById('loginScreen').classList.remove('hidden');
    }

    async function register() {
      const affiliate = {
        name: document.getElementById('regName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        whatsapp: document.getElementById('regWhatsapp').value.trim(),
        code: document.getElementById('regCode').value.toUpperCase().trim()
      };

      if (!affiliate.name || !affiliate.email || !affiliate.whatsapp || !affiliate.code) {
        alert('Preencha todos os campos');
        return;
      }

      try {
        const response = await fetch('/api/affiliates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(affiliate)
        });

        const data = await response.json();

        if (data.success) {
          alert('✅ Cadastro realizado! Aguarde aprovação.\\nSeu código: ' + affiliate.code);
          backToLogin();
        } else {
          alert('❌ ' + data.error);
        }
      } catch {
        alert('Erro ao cadastrar');
      }
    }

    function loadAffiliate(data) {
      document.getElementById('affiliateName').textContent = data.affiliate.name;
      document.getElementById('affiliateCode').textContent = data.affiliate.code;

      const level = data.level;
      const levelBadge = document.getElementById('levelBadge');
      levelBadge.textContent = level.icon + ' ' + level.name;
      levelBadge.style.backgroundColor = levelConfig[level.name].color;
      levelBadge.style.color = level.name === 'OURO' ? '#000' : '#fff';

      document.getElementById('levelCommission').textContent = level.commission + '%';

      document.getElementById('stat-sales').textContent = data.affiliate.sales || 0;
      document.getElementById('stat-pending').textContent = 'R$ ' + (data.affiliate.pendingCommission || 0).toFixed(2);
      document.getElementById('stat-paid').textContent = 'R$ ' + (data.affiliate.paidCommission || 0).toFixed(2);

      const link = window.location.origin + '/checkout?aff=' + data.affiliate.code;
      document.getElementById('affiliateLink').textContent = link;
    }

    function copyLink() {
      const link = document.getElementById('affiliateLink').textContent;
      navigator.clipboard.writeText(link).then(() => {
        alert('✅ Link copiado!');
      });
    }
  </script>
</body>
</html>`;
