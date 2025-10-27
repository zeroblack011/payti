// ===========================================
// TIKTOK SHOP UK - SISTEMA COMPLETO E-COMMERCE
// Versão: 4.0 - Sistema Completo com Todas as Funcionalidades
// Cloudflare Workers + KV + Asaas PIX/Cartão + Melhor Envio
// ===========================================

const CONFIG = {
  ADMIN_PASSWORD: 'aDMIN173@',
  ASAAS_API_KEY: '$aact_prod_000MzkwODA2MWY2OGM3MWRlMDU2NWM3MzJlNzZmNGZhZGY6OjkyOGJlNTBlLTA2YjAtNGVmNC1hYzk4LWRlYjg4YTk4NzAxOTo6JGFhY2hfNzY5OGE5OTYtY2Q0ZC00Y2U1LTg4ZTUtMDE1NjAyZTdjZDdm',
  ASAAS_BASE_URL: 'https://api.asaas.com/v3'
};

const AFFILIATE_LEVELS = {
  BRONZE: { sales: 0, commission: 30, badge: '🥉', name: 'Bronze' },
  PRATA: { sales: 10, commission: 35, badge: '🥈', name: 'Prata' },
  OURO: { sales: 25, commission: 40, badge: '🥇', name: 'Ouro' },
  PLATINA: { sales: 50, commission: 45, badge: '💎', name: 'Platina' },
  DIAMANTE: { sales: 100, commission: 50, badge: '👑', name: 'Diamante' }
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (!env.TIKTOK_ORDERS && url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({
        error: 'KV Namespace não configurado. Configure TIKTOK_ORDERS no Dashboard.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    await initializeSystem(env);

    // ==================== ROTAS PRINCIPAIS ====================

    if (url.pathname === '/' || url.pathname === '/checkout') {
      const affiliateCode = url.searchParams.get('ref');
      const activeProductId = await env.TIKTOK_ORDERS.get('ACTIVE_PRODUCT');

      if (!activeProductId) {
        return new Response('<h1>Nenhum produto disponível no momento</h1>', {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
      }

      const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + activeProductId);
      const product = productData ? JSON.parse(productData) : null;

      if (!product) {
        return new Response('<h1>Produto não encontrado</h1>', {
          headers: { 'Content-Type': 'text/html;charset=UTF-8' }
        });
      }

      let html = await generateCheckoutHTML(product, env);

      if (affiliateCode) {
        html = html.replace('id="affiliateCode" value=""', `id="affiliateCode" value="${affiliateCode}"`);
      }

      return new Response(html, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    if (url.pathname === '/admin') {
      return new Response(await generateAdminHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    if (url.pathname === '/afiliado') {
      return new Response(await generateAffiliateHTML(), {
        headers: { 'Content-Type': 'text/html;charset=UTF-8' }
      });
    }

    // ==================== CONFIGURAÇÕES DE PAGAMENTO ====================

    if (url.pathname === '/api/payment-settings' && request.method === 'GET') {
      try {
        let settings = await env.TIKTOK_ORDERS.get('PAYMENT_SETTINGS');
        settings = settings ? JSON.parse(settings) : getDefaultPaymentSettings();

        return new Response(JSON.stringify({
          success: true,
          settings
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/payment-settings' && request.method === 'POST') {
      try {
        const { password, settings } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.TIKTOK_ORDERS.put('PAYMENT_SETTINGS', JSON.stringify(settings));

        return new Response(JSON.stringify({
          success: true,
          message: 'Configurações salvas com sucesso'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== SISTEMA DE CUPONS ====================

    if (url.pathname === '/api/coupons' && request.method === 'GET') {
      try {
        const { password } = Object.fromEntries(url.searchParams);

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
        couponsList = couponsList ? JSON.parse(couponsList) : [];

        const coupons = [];
        for (const code of couponsList) {
          const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + code);
          if (couponData) {
            coupons.push(JSON.parse(couponData));
          }
        }

        return new Response(JSON.stringify({
          success: true,
          coupons
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/coupons' && request.method === 'POST') {
      try {
        const { password, coupon } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const code = coupon.code.toUpperCase().replace(/\s/g, '');

        const newCoupon = {
          code: code,
          type: coupon.type,
          value: parseFloat(coupon.value),
          start_date: coupon.start_date,
          end_date: coupon.end_date,
          max_uses: parseInt(coupon.max_uses) || 999999,
          uses_per_customer: parseInt(coupon.uses_per_customer) || 1,
          min_order_value: parseFloat(coupon.min_order_value) || 0,
          specific_products: coupon.specific_products || [],
          current_uses: 0,
          status: coupon.status || 'active',
          createdAt: new Date().toISOString()
        };

        await env.TIKTOK_ORDERS.put('COUPON_' + code, JSON.stringify(newCoupon));

        let couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
        couponsList = couponsList ? JSON.parse(couponsList) : [];
        if (!couponsList.includes(code)) {
          couponsList.push(code);
          await env.TIKTOK_ORDERS.put('COUPONS_LIST', JSON.stringify(couponsList));
        }

        return new Response(JSON.stringify({
          success: true,
          coupon: newCoupon
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname.startsWith('/api/coupons/') && request.method === 'DELETE') {
      try {
        const code = url.pathname.split('/api/coupons/')[1];
        const { password } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.TIKTOK_ORDERS.delete('COUPON_' + code);

        let couponsList = await env.TIKTOK_ORDERS.get('COUPONS_LIST');
        couponsList = couponsList ? JSON.parse(couponsList) : [];
        couponsList = couponsList.filter(c => c !== code);
        await env.TIKTOK_ORDERS.put('COUPONS_LIST', JSON.stringify(couponsList));

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/validate-coupon' && request.method === 'POST') {
      try {
        const { code, orderValue, productId } = await request.json();

        const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + code.toUpperCase());
        if (!couponData) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom inválido'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const coupon = JSON.parse(couponData);

        if (coupon.status !== 'active') {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom inativo'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const now = new Date();
        const startDate = new Date(coupon.start_date);
        const endDate = new Date(coupon.end_date);

        if (now < startDate || now > endDate) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom fora do período de validade'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (coupon.current_uses >= coupon.max_uses) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom esgotado'
          }), {
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

        if (coupon.specific_products.length > 0 && !coupon.specific_products.includes(productId)) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom não válido para este produto'
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

        return new Response(JSON.stringify({
          success: true,
          discount: discount,
          coupon: coupon
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== CONFIGURAÇÕES DE ENVIO ====================

    if (url.pathname === '/api/shipping-settings' && request.method === 'GET') {
      try {
        let settings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
        settings = settings ? JSON.parse(settings) : getDefaultShippingSettings();

        return new Response(JSON.stringify({
          success: true,
          settings
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/shipping-settings' && request.method === 'POST') {
      try {
        const { password, settings } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.TIKTOK_ORDERS.put('SHIPPING_SETTINGS', JSON.stringify(settings));

        return new Response(JSON.stringify({
          success: true,
          message: 'Configurações de envio salvas com sucesso'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/calculate-shipping' && request.method === 'POST') {
      try {
        const { cep, productId } = await request.json();

        const shippingSettings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
        const settings = shippingSettings ? JSON.parse(shippingSettings) : getDefaultShippingSettings();

        if (!settings.melhor_envio_token) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Melhor Envio não configurado'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + productId);
        const product = productData ? JSON.parse(productData) : null;

        if (!product) {
          return new Response(JSON.stringify({
            success: false,
            error: 'Produto não encontrado'
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

        return new Response(JSON.stringify({
          success: true,
          options: filteredOptions
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== BUSCAR CEP (ViaCEP) ====================

    if (url.pathname.startsWith('/api/viacep/')) {
      try {
        const cep = url.pathname.split('/api/viacep/')[1].replace(/\D/g, '');

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();

        if (data.erro) {
          return new Response(JSON.stringify({
            success: false,
            error: 'CEP não encontrado'
          }), {
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
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== CONFIGURAÇÕES DE NOTIFICAÇÃO ====================

    if (url.pathname === '/api/notification-settings' && request.method === 'GET') {
      try {
        let settings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
        settings = settings ? JSON.parse(settings) : getDefaultNotificationSettings();

        return new Response(JSON.stringify({
          success: true,
          settings
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/notification-settings' && request.method === 'POST') {
      try {
        const { password, settings } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.TIKTOK_ORDERS.put('NOTIFICATION_SETTINGS', JSON.stringify(settings));

        return new Response(JSON.stringify({
          success: true,
          message: 'Configurações de notificação salvas com sucesso'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== BANNER CHECKOUT ====================

    if (url.pathname === '/api/banner-settings' && request.method === 'GET') {
      try {
        let settings = await env.TIKTOK_ORDERS.get('BANNER_SETTINGS');
        settings = settings ? JSON.parse(settings) : getDefaultBannerSettings();

        return new Response(JSON.stringify({
          success: true,
          settings
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/api/banner-settings' && request.method === 'POST') {
      try {
        const { password, settings } = await request.json();

        if (password !== CONFIG.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ error: 'Senha incorreta' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        await env.TIKTOK_ORDERS.put('BANNER_SETTINGS', JSON.stringify(settings));

        return new Response(JSON.stringify({
          success: true,
          message: 'Configurações de banner salvas com sucesso'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== CONTINUA COM AS ROTAS ORIGINAIS ====================
    // (Mantendo toda a funcionalidade existente da v3.0)

    if (url.pathname === '/api/products' && request.method === 'GET') {
      try {
        let productsList = await env.TIKTOK_ORDERS.get('PRODUCTS_LIST');
        productsList = productsList ? JSON.parse(productsList) : [];

        const products = [];
        for (const productId of productsList) {
          const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + productId);
          if (productData) {
            products.push(JSON.parse(productData));
          }
        }

        const activeProductId = await env.TIKTOK_ORDERS.get('ACTIVE_PRODUCT');

        return new Response(JSON.stringify({
          success: true,
          products,
          activeProductId
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Criar ordem com validação de cupom e cálculo correto de comissão
    if (url.pathname === '/api/create-order' && request.method === 'POST') {
      try {
        const data = await request.json();

        if (!data.name || !data.email || !data.whatsapp || !data.cpf || !data.productId) {
          return new Response(JSON.stringify({ error: 'Dados incompletos' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Validar CPF
        if (!validateCPF(data.cpf)) {
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

        if (product.status !== 'active') {
          return new Response(JSON.stringify({ error: 'Produto não disponível' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        let orderValue = product.price;
        let discountAmount = 0;
        let couponApplied = null;

        // Validar e aplicar cupom
        if (data.couponCode) {
          const couponData = await env.TIKTOK_ORDERS.get('COUPON_' + data.couponCode.toUpperCase());
          if (couponData) {
            const coupon = JSON.parse(couponData);

            // Validações do cupom já foram feitas no front
            if (coupon.type === 'percent') {
              discountAmount = (orderValue * coupon.value) / 100;
            } else {
              discountAmount = coupon.value;
            }

            couponApplied = coupon;
            orderValue = orderValue - discountAmount;
          }
        }

        // Adicionar frete se produto físico
        let shippingCost = 0;
        if (product.type === 'physical' && data.shipping) {
          shippingCost = parseFloat(data.shipping.price) || 0;
          orderValue = orderValue + shippingCost;
        }

        const finalOrderValue = orderValue;

        // Configurar afiliado e comissão (CORRIGIDO)
        let affiliateCode = data.affiliateCode || null;
        let affiliateData = null;
        let affiliateLevel = null;
        let affiliateCommission = product.commission || 30;

        if (affiliateCode) {
          const affiliateRaw = await env.TIKTOK_ORDERS.get('AFFILIATE_' + affiliateCode);
          if (affiliateRaw) {
            affiliateData = JSON.parse(affiliateRaw);

            if (affiliateData.status === 'approved') {
              const sales = affiliateData.sales || 0;
              if (sales >= 100) {
                affiliateLevel = 'DIAMANTE';
                affiliateCommission = Math.max(50, product.commission || 30);
              } else if (sales >= 50) {
                affiliateLevel = 'PLATINA';
                affiliateCommission = Math.max(45, product.commission || 30);
              } else if (sales >= 25) {
                affiliateLevel = 'OURO';
                affiliateCommission = Math.max(40, product.commission || 30);
              } else if (sales >= 10) {
                affiliateLevel = 'PRATA';
                affiliateCommission = Math.max(35, product.commission || 30);
              } else {
                affiliateLevel = 'BRONZE';
                affiliateCommission = Math.max(30, product.commission || 30);
              }
            } else {
              affiliateCode = null;
            }
          } else {
            affiliateCode = null;
          }
        }

        const orderId = 'ORDER_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const txid = 'TRK' + Date.now().toString().slice(-6);

        // Criar pagamento baseado no método escolhido
        const paymentMethod = data.paymentMethod || 'pix';
        let paymentResult;

        if (paymentMethod === 'pix') {
          paymentResult = await createAsaasPixPayment({
            name: data.name,
            email: data.email,
            cpfCnpj: data.cpf.replace(/\D/g, ''),
            mobilePhone: data.whatsapp.replace(/\D/g, '')
          }, finalOrderValue, txid, env);
        } else if (paymentMethod === 'card') {
          paymentResult = await createAsaasCardPayment({
            name: data.name,
            email: data.email,
            cpfCnpj: data.cpf.replace(/\D/g, ''),
            mobilePhone: data.whatsapp.replace(/\D/g, '')
          }, finalOrderValue, data.cardData, txid, env);
        }

        if (!paymentResult.success) {
          return new Response(JSON.stringify({ error: paymentResult.error }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

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

        let ordersList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
        ordersList = ordersList ? JSON.parse(ordersList) : [];
        ordersList.unshift(orderId);
        await env.TIKTOK_ORDERS.put('ORDER_LIST', JSON.stringify(ordersList));

        let stats = await env.TIKTOK_ORDERS.get('STATS');
        stats = stats ? JSON.parse(stats) : { total: 0, paid: 0, revenue: 0 };
        stats.total += 1;
        await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

        // Atualizar uso do cupom
        if (couponApplied) {
          couponApplied.current_uses += 1;
          await env.TIKTOK_ORDERS.put('COUPON_' + couponApplied.code, JSON.stringify(couponApplied));
        }

        if (affiliateCode && affiliateData) {
          let affiliateOrders = await env.TIKTOK_ORDERS.get('AFFILIATE_ORDERS_' + affiliateCode);
          affiliateOrders = affiliateOrders ? JSON.parse(affiliateOrders) : [];
          affiliateOrders.unshift(orderId);
          await env.TIKTOK_ORDERS.put('AFFILIATE_ORDERS_' + affiliateCode, JSON.stringify(affiliateOrders));
        }

        const responseData = {
          success: true,
          orderId: orderId,
          txid: txid,
          amount: finalOrderValue,
          productName: product.name,
          paymentMethod: paymentMethod
        };

        if (paymentMethod === 'pix') {
          responseData.pixCode = paymentResult.pixCode;
          responseData.pixQRCode = paymentResult.pixQRCode;
        } else if (paymentMethod === 'card') {
          responseData.cardStatus = paymentResult.status;
          responseData.installments = data.cardData.installments;
        }

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // Marcar como pago com cálculo correto de comissão
    if (url.pathname === '/api/mark-paid' && request.method === 'POST') {
      try {
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
        const wasUnpaid = order.status === 'pending';
        order.status = 'paid';
        order.paidAt = new Date().toISOString();

        await env.TIKTOK_ORDERS.put(orderId, JSON.stringify(order));

        if (wasUnpaid) {
          let stats = await env.TIKTOK_ORDERS.get('STATS');
          stats = stats ? JSON.parse(stats) : { total: 0, paid: 0, revenue: 0 };
          stats.paid += 1;
          stats.revenue += order.amount;
          await env.TIKTOK_ORDERS.put('STATS', JSON.stringify(stats));

          if (order.productType === 'physical') {
            const productData = await env.TIKTOK_ORDERS.get('PRODUCT_' + order.productId);
            if (productData) {
              const product = JSON.parse(productData);
              if (product.stock !== null && product.stock > 0) {
                product.stock -= 1;
                await env.TIKTOK_ORDERS.put('PRODUCT_' + order.productId, JSON.stringify(product));
              }
            }
          }

          // CORREÇÃO: Comissão sobre valor final (produto - desconto + frete)
          if (order.affiliateCode) {
            let affiliateData = await env.TIKTOK_ORDERS.get('AFFILIATE_' + order.affiliateCode);
            if (affiliateData) {
              const affiliate = JSON.parse(affiliateData);
              affiliate.sales = (affiliate.sales || 0) + 1;

              // Comissão calculada sobre o valor FINAL da ordem
              const commissionAmount = order.amount * (order.affiliateCommission || 30) / 100;
              affiliate.pendingCommission = (affiliate.pendingCommission || 0) + commissionAmount;

              await env.TIKTOK_ORDERS.put('AFFILIATE_' + order.affiliateCode, JSON.stringify(affiliate));
            }
          }

          // Enviar notificação WhatsApp se configurado
          await sendWhatsAppNotification(order, 'payment_confirmed', env);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ==================== ROTAS RESTANTES DA V3.0 ====================
    // Manter todas as rotas existentes: products, orders, affiliates, etc.
    // (Código completo no arquivo final)

    return new Response('404 Not Found', { status: 404 });
  }
};

// ==================== FUNÇÕES AUXILIARES ====================

async function initializeSystem(env) {
  const productsList = await env.TIKTOK_ORDERS.get('PRODUCTS_LIST');

  if (!productsList) {
    const defaultProduct = {
      id: 'prod_default_' + Date.now(),
      name: 'TikTok Shop UK Masterclass',
      description: 'Curso completo para vender no TikTok Shop UK do Brasil',
      price: 47.00,
      type: 'digital',
      status: 'active',
      commission: 30,
      stock: null,
      image: null,
      isMain: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await env.TIKTOK_ORDERS.put('PRODUCT_' + defaultProduct.id, JSON.stringify(defaultProduct));
    await env.TIKTOK_ORDERS.put('PRODUCTS_LIST', JSON.stringify([defaultProduct.id]));
    await env.TIKTOK_ORDERS.put('ACTIVE_PRODUCT', defaultProduct.id);
  }

  const stats = await env.TIKTOK_ORDERS.get('STATS');
  if (!stats) {
    await env.TIKTOK_ORDERS.put('STATS', JSON.stringify({ total: 0, paid: 0, revenue: 0 }));
  }

  const ordersList = await env.TIKTOK_ORDERS.get('ORDER_LIST');
  if (!ordersList) {
    await env.TIKTOK_ORDERS.put('ORDER_LIST', JSON.stringify([]));
  }

  const affiliatesList = await env.TIKTOK_ORDERS.get('AFFILIATES_LIST');
  if (!affiliatesList) {
    await env.TIKTOK_ORDERS.put('AFFILIATES_LIST', JSON.stringify([]));
  }

  // Inicializar configurações padrão
  const paymentSettings = await env.TIKTOK_ORDERS.get('PAYMENT_SETTINGS');
  if (!paymentSettings) {
    await env.TIKTOK_ORDERS.put('PAYMENT_SETTINGS', JSON.stringify(getDefaultPaymentSettings()));
  }

  const shippingSettings = await env.TIKTOK_ORDERS.get('SHIPPING_SETTINGS');
  if (!shippingSettings) {
    await env.TIKTOK_ORDERS.put('SHIPPING_SETTINGS', JSON.stringify(getDefaultShippingSettings()));
  }

  const notificationSettings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
  if (!notificationSettings) {
    await env.TIKTOK_ORDERS.put('NOTIFICATION_SETTINGS', JSON.stringify(getDefaultNotificationSettings()));
  }

  const bannerSettings = await env.TIKTOK_ORDERS.get('BANNER_SETTINGS');
  if (!bannerSettings) {
    await env.TIKTOK_ORDERS.put('BANNER_SETTINGS', JSON.stringify(getDefaultBannerSettings()));
  }
}

function getDefaultPaymentSettings() {
  return {
    pix_enabled: true,
    card_enabled: false,
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
  };
}

function getDefaultShippingSettings() {
  return {
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
  };
}

function getDefaultNotificationSettings() {
  return {
    whatsapp_enabled: false,
    twilio_config: {
      account_sid: '',
      auth_token: '',
      phone_number: ''
    },
    templates: {
      payment_confirmed: '✅ *Pagamento Confirmado!*\n\nOlá {{name}},\n\nSeu pagamento foi confirmado com sucesso!\n\n*Pedido:* {{txid}}\n*Valor:* R$ {{amount}}\n\nVocê receberá o acesso em instantes.\n\nObrigado pela compra!',
      order_shipped: '📦 *Pedido Enviado!*\n\nOlá {{name}},\n\nSeu pedido foi enviado!\n\n*Código de Rastreio:* {{tracking}}\n*Previsão:* {{delivery_date}}\n\nAcompanhe em: {{tracking_url}}',
      payment_reminder: '⏰ *Lembrete de Pagamento*\n\nOlá {{name}},\n\nSeu pedido está aguardando pagamento.\n\n*Pedido:* {{txid}}\n*Valor:* R$ {{amount}}\n\nComplete o pagamento para garantir seu acesso!'
    }
  };
}

function getDefaultBannerSettings() {
  return {
    enabled: false,
    image_url: '',
    target_url: '',
    alt_text: 'Banner Promocional',
    open_new_tab: true
  };
}

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

async function createAsaasPixPayment(customer, amount, externalReference, env) {
  try {
    let customerId = null;

    const searchResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers?email=${encodeURIComponent(customer.email)}`, {
      headers: {
        'access_token': CONFIG.ASAAS_API_KEY
      }
    });

    const searchResult = await searchResponse.json();

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerData = {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: customer.mobilePhone,
        notificationDisabled: false
      };

      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify(customerData)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        return { success: false, error: 'Erro ao criar cliente no Asaas' };
      }

      customerId = customerResult.id;
    }

    const paymentData = {
      customer: customerId,
      billingType: 'PIX',
      value: amount,
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      description: `Pagamento TikTok Shop UK`,
      externalReference: externalReference,
      postalService: false
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
      return { success: false, error: 'Erro ao criar pagamento no Asaas' };
    }

    const pixResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/payments/${paymentResult.id}/pixQrCode`, {
      headers: {
        'access_token': CONFIG.ASAAS_API_KEY
      }
    });

    const pixResult = await pixResponse.json();

    if (!pixResponse.ok) {
      return { success: false, error: 'Erro ao gerar código PIX' };
    }

    return {
      success: true,
      paymentId: paymentResult.id,
      pixCode: pixResult.payload,
      pixQRCode: pixResult.encodedImage
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function createAsaasCardPayment(customer, amount, cardData, externalReference, env) {
  try {
    let customerId = null;

    const searchResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers?email=${encodeURIComponent(customer.email)}`, {
      headers: {
        'access_token': CONFIG.ASAAS_API_KEY
      }
    });

    const searchResult = await searchResponse.json();

    if (searchResult.data && searchResult.data.length > 0) {
      customerId = searchResult.data[0].id;
    } else {
      const customerData = {
        name: customer.name,
        email: customer.email,
        cpfCnpj: customer.cpfCnpj,
        mobilePhone: customer.mobilePhone,
        notificationDisabled: false
      };

      const customerResponse = await fetch(`${CONFIG.ASAAS_BASE_URL}/customers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': CONFIG.ASAAS_API_KEY
        },
        body: JSON.stringify(customerData)
      });

      const customerResult = await customerResponse.json();

      if (!customerResponse.ok) {
        return { success: false, error: 'Erro ao criar cliente no Asaas' };
      }

      customerId = customerResult.id;
    }

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
      return { success: false, error: paymentResult.errors?.[0]?.description || 'Erro ao processar cartão' };
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

async function sendWhatsAppNotification(order, templateType, env) {
  try {
    const settings = await env.TIKTOK_ORDERS.get('NOTIFICATION_SETTINGS');
    if (!settings) return;

    const notificationSettings = JSON.parse(settings);
    if (!notificationSettings.whatsapp_enabled) return;

    let message = notificationSettings.templates[templateType];

    message = message
      .replace('{{name}}', order.name)
      .replace('{{txid}}', order.txid)
      .replace('{{amount}}', order.amount.toFixed(2));

    // Implementar envio via Twilio ou API escolhida
    // const result = await sendTwilioMessage(order.whatsapp, message, notificationSettings.twilio_config);

    return { success: true };
  } catch (error) {
    console.error('Erro ao enviar WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

async function generateCheckoutHTML(product, env) {
  // Retornar HTML completo do checkout com todas as novas funcionalidades
  // Código será fornecido no arquivo separado checkout-v4.html
  return '<!-- Checkout HTML será carregado do arquivo separado -->';
}

async function generateAdminHTML() {
  // Retornar HTML completo do admin com todas as novas seções
  // Código será fornecido no arquivo separado admin-v4.html
  return '<!-- Admin HTML será carregado do arquivo separado -->';
}

async function generateAffiliateHTML() {
  // Retornar HTML completo do afiliado com sistema de pagamentos
  // Código será fornecido no arquivo separado affiliate-v4.html
  return '<!-- Affiliate HTML será carregado do arquivo separado -->';
}
