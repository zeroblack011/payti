# 🚀 TIKTOK SHOP UK - VERSÃO 4.0

## Sistema Completo E-Commerce com Todas as Funcionalidades

### 📋 NOVAS FUNCIONALIDADES IMPLEMENTADAS

#### ✅ 1. SISTEMA DE GATEWAYS DE PAGAMENTO CONFIGURÁVEL
- Switch PIX e Cartão independentes
- Configuração completa de parcelamento (1-12x)
- Tabela de juros personalizável
- Checkout inteligente baseado em métodos ativos

#### ✅ 2. PAGAMENTO COM CARTÃO DE CRÉDITO
- Integração completa Asaas
- Tokenização segura
- Parcelamento dinâmico
- Validação em tempo real
- Suporte débito e crédito

#### ✅ 3. SISTEMA DE CUPONS DE DESCONTO
- Cupons percentuais e valor fixo
- Validação por data
- Limite de usos
- Valor mínimo de compra
- Produtos específicos

#### ✅ 4. INTEGRAÇÃO MELHOR ENVIO
- Cálculo automático de frete
- Múltiplas transportadoras
- Opção retirada em loja
- API completa integrada

#### ✅ 5. NOTIFICAÇÕES WHATSAPP
- Templates personalizáveis
- Pagamento confirmado
- Pedido enviado
- Lembrete de pagamento

#### ✅ 6. CORREÇÃO CÁLCULO COMISSÃO AFILIADO
- Comissão sobre valor final (produto - desconto + frete)
- Cálculo correto por nível

#### ✅ 7. CPF OBRIGATÓRIO COM VALIDAÇÃO
- Campo CPF com máscara
- Validação de dígitos verificadores
- Obrigatório em todo checkout

#### ✅ 8. BANNER PERSONALIZÁVEL
- Upload de imagem
- URL de destino
- Exibição condicional

#### ✅ 9. FLUXO ENDEREÇO COM VIACEP
- Busca automática por CEP
- Preenchimento automático
- Interface otimizada

#### ✅ 10. RESUMO PROFISSIONAL DE VENDA
- Todos os dados organizados
- Valores detalhados
- Edição fácil

#### ✅ 11. SISTEMA DE PAGAMENTO AFILIADOS
- Dados bancários completos
- PIX e transferência
- Histórico de pagamentos

#### ✅ 12. PERFIL COM FOTO
- Upload de foto admin
- Upload de foto afiliado
- Preview em tempo real

---

## 🔧 INSTALAÇÃO E CONFIGURAÇÃO

### 1. CONFIGURAR CLOUDFLARE WORKERS

1. Acesse o Cloudflare Dashboard
2. Vá em Workers & Pages
3. Crie um novo Worker chamado `tiktok-shop-v4`
4. Cole o conteúdo de `worker-v4.js`

### 2. CONFIGURAR KV NAMESPACE

1. Vá em Workers & Pages > KV
2. Crie um namespace: `TIKTOK_ORDERS`
3. Vincule ao seu Worker:
   - Settings > Variables > KV Namespace Bindings
   - Variable name: `TIKTOK_ORDERS`
   - KV namespace: Selecione o criado

### 3. CONFIGURAR VARIÁVEIS DE AMBIENTE

No arquivo `worker-v4.js`, atualize:

```javascript
const CONFIG = {
  ADMIN_PASSWORD: 'SUA_SENHA_ADMIN',
  ASAAS_API_KEY: 'SUA_CHAVE_ASAAS',
  ASAAS_BASE_URL: 'https://api.asaas.com/v3'
};
```

### 4. ROTAS DO SISTEMA

- `/` - Checkout principal
- `/admin` - Painel administrativo
- `/afiliado` - Painel do afiliado
- `/api/*` - Todas as APIs

---

## 📱 CONFIGURAÇÕES INICIAIS

### PAINEL ADMIN - CONFIGURAÇÕES

Acesse `/admin` e configure:

#### 1. PAGAMENTOS
- Ativar/desativar PIX
- Ativar/desativar Cartão
- Configurar parcelamento
- Definir juros por parcela

#### 2. ENVIO (MELHOR ENVIO)
- Token API: Obtenha em melhorenvio.com.br
- CEP de origem
- Dimensões padrão dos produtos
- Transportadoras ativas

#### 3. NOTIFICAÇÕES WHATSAPP
- Token Twilio/WhatsApp Business
- Número WhatsApp
- Personalizar templates

#### 4. BANNER CHECKOUT
- Upload de imagem (máx 2MB)
- URL de destino
- Ativar/desativar

---

## 🎯 NOVOS ENDPOINTS API

### Configurações de Pagamento
```
GET  /api/payment-settings
POST /api/payment-settings
```

### Sistema de Cupons
```
GET    /api/coupons
POST   /api/coupons
DELETE /api/coupons/[CODE]
POST   /api/validate-coupon
```

### Configurações de Envio
```
GET  /api/shipping-settings
POST /api/shipping-settings
POST /api/calculate-shipping
```

### Buscar CEP
```
GET /api/viacep/[CEP]
```

### Notificações
```
GET  /api/notification-settings
POST /api/notification-settings
POST /api/send-whatsapp
```

### Banner
```
GET  /api/banner-settings
POST /api/banner-settings
```

### Perfil Admin/Afiliado
```
GET  /api/profile
POST /api/profile
GET  /api/affiliate-profile/[CODE]
POST /api/affiliate-profile/[CODE]
```

### Pagamento de Afiliados
```
POST /api/affiliate-payment
GET  /api/affiliate-payment/[CODE]
```

---

## 💾 ESTRUTURA KV STORAGE

### Novos Keys Criados

```
PAYMENT_SETTINGS          - Configurações de pagamento
COUPONS_LIST             - Lista de códigos de cupons
COUPON_[CODE]            - Dados de cada cupom
SHIPPING_SETTINGS        - Configurações Melhor Envio
NOTIFICATION_SETTINGS    - Config WhatsApp e templates
BANNER_SETTINGS          - Configurações do banner
ADMIN_PROFILE            - Perfil do administrador
AFFILIATE_[CODE]_PROFILE - Perfil de cada afiliado
AFFILIATE_[CODE]_BANK    - Dados bancários afiliado
```

### Keys Existentes (mantidos)
```
PRODUCTS_LIST            - Lista de produtos
PRODUCT_[ID]             - Dados do produto
ACTIVE_PRODUCT          - Produto principal ativo
ORDER_LIST              - Lista de pedidos
ORDER_[ID]              - Dados do pedido
STATS                   - Estatísticas gerais
AFFILIATES_LIST         - Lista de afiliados
AFFILIATE_[CODE]        - Dados do afiliado
AFFILIATE_ORDERS_[CODE] - Pedidos do afiliado
```

---

## 🔄 FLUXO COMPLETO DE COMPRA

### 1. CHECKOUT - ETAPA 1: DADOS PESSOAIS
- Nome completo
- Email
- WhatsApp (com máscara)
- **CPF (NOVO - com validação)**

### 2. CHECKOUT - ETAPA 2: ENDEREÇO (Produtos Físicos)
- CEP (busca automática ViaCEP)
- Endereço preenchido automaticamente
- Número e complemento manual
- **Cálculo de frete automático Melhor Envio**

### 3. CHECKOUT - ETAPA 3: CUPOM (Opcional)
- Campo para código do cupom
- Validação em tempo real
- Desconto aplicado no total

### 4. CHECKOUT - ETAPA 4: RESUMO
- Todos os dados
- Valores detalhados:
  - Subtotal
  - Desconto (se houver)
  - Frete (se houver)
  - **TOTAL FINAL**

### 5. CHECKOUT - ETAPA 5: PAGAMENTO
- **Escolher método** (se ambos ativos):
  - PIX: QR Code + Copia e Cola
  - Cartão: Formulário completo + Parcelamento

### 6. CONFIRMAÇÃO
- Aguardar pagamento
- Webhook automático Asaas
- Notificação WhatsApp

---

## 👥 SISTEMA DE AFILIADOS COMPLETO

### Níveis e Comissões
```
🥉 BRONZE   - 0 vendas   - 30%
🥈 PRATA    - 10 vendas  - 35%
🥇 OURO     - 25 vendas  - 40%
💎 PLATINA  - 50 vendas  - 45%
👑 DIAMANTE - 100 vendas - 50%
```

### Cálculo Comissão (CORRIGIDO)
```javascript
// Comissão agora é sobre o valor FINAL
const finalValue = productPrice - discount + shipping;
const commission = finalValue * (level_percentage / 100);
```

### Painel do Afiliado
- Dashboard completo
- Link de divulgação
- Estatísticas em tempo real
- **Dados bancários (NOVO)**
  - PIX ou Transferência
  - Histórico de recebimentos
- **Perfil com foto (NOVO)**

### Painel Admin - Gestão de Afiliados
- Aprovar/Bloquear afiliados
- Visualizar dados bancários
- Registrar pagamentos
- Exportar relatórios

---

## 🛠 INTEGRAÇÕES EXTERNAS

### 1. ASAAS (Pagamentos)
**Documentação:** https://docs.asaas.com

**Necessário:**
- Conta Asaas (gratuita para começar)
- API Key (produção ou sandbox)
- Webhook configurado

**Funcionalidades usadas:**
- Criar cliente
- Pagamento PIX
- Pagamento Cartão
- Webhooks de confirmação

### 2. MELHOR ENVIO (Frete)
**Documentação:** https://docs.melhorenvio.com.br

**Necessário:**
- Conta Melhor Envio
- Token API (configurar no painel admin)

**Funcionalidades usadas:**
- Cálculo de frete
- Cotação de transportadoras

### 3. VIACEP (Busca de Endereço)
**Documentação:** https://viacep.com.br

**Gratuito e sem necessidade de cadastro**

### 4. TWILIO / WHATSAPP BUSINESS (Opcional)
**Para notificações WhatsApp**

**Opções:**
- Twilio API
- WhatsApp Business API
- Outras plataformas de envio

---

## 🎨 CUSTOMIZAÇÃO

### Alterar Cores e Estilos
Todos os arquivos HTML usam Tailwind CSS inline. Para personalizar:

1. Abra o arquivo HTML desejado
2. Modifique as classes Tailwind
3. Ou adicione CSS customizado na tag `<style>`

### Adicionar Novos Gateways de Pagamento
1. Adicione nova opção em `PAYMENT_SETTINGS`
2. Crie função `createXXXPayment()` no worker
3. Adicione interface no checkout HTML
4. Implemente validações

### Adicionar Novos Métodos de Envio
1. Configure em `SHIPPING_SETTINGS`
2. Implemente API de cálculo
3. Adicione na seleção do checkout

---

## 🐛 TROUBLESHOOTING

### Erro: "KV Namespace não configurado"
**Solução:** Vincule o KV namespace no Cloudflare Dashboard

### Erro: "Asaas payment failed"
**Solução:** Verifique API Key e se a conta está ativa

### Frete não calcula
**Solução:**
- Verifique token Melhor Envio
- Confirme CEP de origem configurado
- Teste CEP de destino válido

### Notificação WhatsApp não envia
**Solução:**
- Verifique configurações Twilio
- Confirme número formatado corretamente
- Teste credenciais

### Cupom não aplica desconto
**Solução:**
- Verifique data de validade
- Confirme limite de usos
- Valide valor mínimo da compra

---

## 🚀 DEPLOY E PRODUÇÃO

### Checklist Pré-Produção

- [ ] Worker publicado no Cloudflare
- [ ] KV Namespace vinculado
- [ ] Senha admin alterada
- [ ] API Key Asaas (PRODUÇÃO) configurada
- [ ] Webhook Asaas configurado
- [ ] Token Melhor Envio obtido
- [ ] CEP origem configurado
- [ ] Produtos cadastrados
- [ ] Testes de compra PIX
- [ ] Testes de compra Cartão
- [ ] Testes de frete
- [ ] Testes de cupom
- [ ] Domínio customizado (opcional)

### Configurar Domínio Customizado

1. Cloudflare Dashboard
2. Workers & Pages > seu worker
3. Triggers > Custom Domains
4. Add Custom Domain
5. Digite seu domínio
6. Configure DNS automaticamente

---

## 📊 MONITORAMENTO E ANALYTICS

### Métricas Disponíveis no Admin

- Total de pedidos
- Pedidos pagos
- Faturamento total
- Afiliados ativos
- Afiliados pendentes
- Taxa de conversão
- Comissões pendentes
- Comissões pagas

### Logs e Debugging

Acesse Cloudflare Dashboard > Workers > Logs em tempo real

---

## 🔐 SEGURANÇA

### Implementações de Segurança

✅ Validação de senha admin em todas as rotas sensíveis
✅ Validação de CPF com dígitos verificadores
✅ Sanitização de inputs
✅ CORS configurado
✅ Dados sensíveis não expostos no frontend
✅ Tokenização de cartão via Asaas
✅ HTTPS obrigatório (Cloudflare)

### Recomendações Adicionais

- Altere senha admin regularmente
- Monitore tentativas de acesso
- Mantenha API keys seguras
- Use ambiente sandbox para testes
- Ative 2FA no Cloudflare

---

## 🆘 SUPORTE

### Problemas Comuns

**Worker não atualiza:**
- Force refresh (Ctrl+Shift+R)
- Limpe cache do Cloudflare
- Aguarde propagação (até 60s)

**Pedidos não aparecem:**
- Verifique KV namespace
- Confirme inicialização do sistema
- Valide estrutura de dados

**Pagamento não confirma:**
- Teste webhook Asaas
- Verifique logs do Worker
- Confirme API Key válida

---

## 📞 CONTATO E CRÉDITOS

**Sistema:** TikTok Shop UK v4.0
**Desenvolvido para:** E-commerce completo
**Tecnologias:** Cloudflare Workers, KV Storage, Asaas, Melhor Envio

---

## 📄 LICENÇA

Todos os direitos reservados.
Sistema proprietário para uso comercial.

---

## 🔄 CHANGELOG

### v4.0 (Atual)
- ✅ Sistema de pagamento com cartão
- ✅ Sistema de cupons de desconto
- ✅ Integração Melhor Envio
- ✅ Notificações WhatsApp
- ✅ CPF obrigatório com validação
- ✅ Banner personalizável
- ✅ Fluxo endereço com ViaCEP
- ✅ Resumo profissional
- ✅ Sistema pagamento afiliados
- ✅ Perfil com foto
- ✅ Correção cálculo comissão

### v3.0
- Sistema multiproduto
- Afiliados com níveis
- Painel administrativo
- Pagamento PIX

---

**🎉 SISTEMA 100% PRONTO PARA PRODUÇÃO!**

Todos os recursos foram testados e estão funcionais.
Pronto para processar vendas reais.

**BOA SORTE COM SUAS VENDAS! 🚀💰**
