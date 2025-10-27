# 🚀 INSTRUÇÕES COMPLETAS - CLOUDFLARE DASHBOARD

## ✅ CÓDIGO 100% PRONTO - ARQUIVO ÚNICO

O arquivo `worker-production.js` contém **TODO** o sistema v4.0 em um único código:
- Backend completo com todas as APIs
- Checkout HTML embutido
- Admin Panel HTML embutido
- Painel do Afiliado HTML embutido
- Integração Asaas **CORRIGIDA** (gera QR Code PIX)
- Todas as 13 funcionalidades

---

## 📝 PASSO 1: CONFIGURAR O WORKER NO CLOUDFLARE DASHBOARD

### 1.1 Acessar Dashboard Cloudflare

1. Acesse: https://dash.cloudflare.com/
2. Faça login na sua conta
3. Clique em "Workers & Pages" no menu lateral

### 1.2 Criar Novo Worker

1. Clique em **"Create Application"**
2. Clique em **"Create Worker"**
3. Dê um nome para o worker (ex: `tiktok-shop-uk`)
4. Clique em **"Deploy"**

### 1.3 Copiar o Código

1. Após criar o worker, clique em **"Edit Code"**
2. **APAGUE** todo o código que aparece no editor
3. Abra o arquivo `worker-production.js`
4. **COPIE TODO O CÓDIGO** (CTRL+A, CTRL+C)
5. **COLE** no editor do Cloudflare (CTRL+V)

### 1.4 Configurar Variáveis Importantes

No início do arquivo, **ALTERE** estas linhas:

```javascript
const CONFIG = {
  ADMIN_PASSWORD: 'admin123',  // ⚠️ ALTERAR PARA UMA SENHA FORTE!
  ASAAS_API_KEY: 'SUA_CHAVE_ASAAS_AQUI',  // ⚠️ COLOCAR SUA CHAVE ASAAS
  ASAAS_BASE_URL: 'https://api.asaas.com/v3',  // Produção
  SITE_URL: 'https://seu-worker.workers.dev'  // URL do seu worker
};
```

**Como obter a chave Asaas:**
1. Acesse: https://www.asaas.com/
2. Crie sua conta (grátis para começar)
3. Vá em: **Configurações → Integrações → API Key**
4. Copie sua API Key e cole em `ASAAS_API_KEY`

**IMPORTANTE:** Se estiver testando, use a sandbox:
```javascript
ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3',
```

Para produção real, use:
```javascript
ASAAS_BASE_URL: 'https://api.asaas.com/v3',
```

### 1.5 Salvar e Fazer Deploy

1. Clique em **"Save and Deploy"** (botão azul no canto superior direito)
2. Aguarde o deploy finalizar (alguns segundos)
3. Copie a URL do worker (algo como: `https://tiktok-shop-uk.seu-usuario.workers.dev`)

---

## 📦 PASSO 2: CONFIGURAR KV STORAGE

O sistema precisa de um KV namespace para armazenar dados.

### 2.1 Criar KV Namespace

1. No Dashboard Cloudflare, vá em **"Workers & Pages"**
2. Clique em **"KV"** no menu lateral
3. Clique em **"Create a namespace"**
4. Nome: `TIKTOK_ORDERS`
5. Clique em **"Add"**

### 2.2 Vincular ao Worker

1. Volte para **"Workers & Pages"**
2. Clique no seu worker (ex: `tiktok-shop-uk`)
3. Vá na aba **"Settings"**
4. Role até **"Variables and Secrets"**
5. Clique em **"Add"** na seção **"KV Namespace Bindings"**
6. **Variable name:** `TIKTOK_ORDERS`
7. **KV namespace:** Selecione `TIKTOK_ORDERS` (que você criou)
8. Clique em **"Save"**

### 2.3 Fazer Deploy Novamente

1. Volte para **"Quick Edit"**
2. Clique em **"Save and Deploy"** novamente (para aplicar as mudanças)

---

## 🎯 PASSO 3: ACESSAR O SISTEMA

Agora seu sistema está 100% funcionando!

### 3.1 URLs Disponíveis

Substitua `SEU-WORKER.workers.dev` pela URL real do seu worker:

- **Checkout (clientes):** `https://SEU-WORKER.workers.dev/`
- **Admin Panel:** `https://SEU-WORKER.workers.dev/admin`
- **Painel Afiliado:** `https://SEU-WORKER.workers.dev/afiliado`

### 3.2 Primeiro Acesso ao Admin

1. Acesse: `https://SEU-WORKER.workers.dev/admin`
2. Digite a senha que você configurou em `ADMIN_PASSWORD`
3. **PRIMEIRO: Criar um produto**
   - Clique em "Produtos"
   - Clique em "+ Novo Produto"
   - Preencha os dados
   - Clique em "Salvar"
   - Clique em "Ativar" no produto criado

### 3.3 Testar uma Compra

1. Acesse: `https://SEU-WORKER.workers.dev/`
2. Preencha os dados (nome, email, WhatsApp, CPF válido)
3. Clique em "GERAR PIX"
4. **O QR CODE PIX APARECERÁ!** ✅

---

## 🔧 CONFIGURAR WEBHOOK ASAAS (Para pagamentos automáticos)

Para o Asaas avisar automaticamente quando o PIX for pago:

### 4.1 Configurar no Asaas

1. Acesse: https://www.asaas.com/ (ou sandbox)
2. Vá em: **Configurações → Webhooks**
3. Clique em **"Adicionar Webhook"**
4. **URL:** `https://SEU-WORKER.workers.dev/webhook/asaas`
5. **Eventos:** Marque:
   - ✅ PAYMENT_CONFIRMED
   - ✅ PAYMENT_RECEIVED
6. Salve

Agora quando um PIX for pago, o pedido será marcado automaticamente como pago!

---

## 📊 FUNCIONALIDADES IMPLEMENTADAS

### ✅ Sistema Funcionando 100%

1. **Checkout Completo**
   - Campo CPF com validação
   - Cupons de desconto
   - Geração de QR Code PIX ✅ **FUNCIONANDO**
   - Pagamento cartão (Asaas)

2. **Admin Panel**
   - Dashboard com estatísticas
   - Gerenciar produtos
   - Ver pedidos
   - Aprovar afiliados
   - Marcar pedidos como pagos

3. **Sistema de Afiliados**
   - Cadastro de afiliados
   - 5 níveis (Bronze → Diamante)
   - Comissões: 30% → 50%
   - Link de afiliado
   - Dashboard com vendas

4. **Integrações**
   - ✅ Asaas PIX (100% funcional)
   - ✅ Asaas Cartão
   - ✅ ViaCEP (busca CEP)
   - ✅ Sistema de Cupons
   - ✅ Webhook automático

---

## 🐛 TROUBLESHOOTING

### Problema: "Erro ao gerar QR Code"

**Solução:**
1. Verifique se sua `ASAAS_API_KEY` está correta
2. Se estiver testando, use: `ASAAS_BASE_URL: 'https://sandbox.asaas.com/api/v3'`
3. Para produção real: `ASAAS_BASE_URL: 'https://api.asaas.com/v3'`
4. Certifique-se de que sua conta Asaas está ativa

### Problema: "Produto não encontrado"

**Solução:**
1. Acesse `/admin`
2. Vá em "Produtos"
3. Crie um produto
4. Clique em "Ativar" no produto

### Problema: KV erro

**Solução:**
1. Verifique se criou o KV namespace chamado `TIKTOK_ORDERS`
2. Verifique se vinculou ao worker com o nome **exatamente** `TIKTOK_ORDERS`
3. Salve e faça deploy novamente

---

## 💡 DICAS IMPORTANTES

### ✅ Boas Práticas

1. **ALTERE A SENHA ADMIN** imediatamente:
   ```javascript
   ADMIN_PASSWORD: 'MinhaS3nhaF0rt3!2024',
   ```

2. **Use HTTPS** sempre (Cloudflare já fornece)

3. **Configure o Webhook Asaas** para pagamentos automáticos

4. **Teste em Sandbox** antes de usar em produção real

5. **Monitore os logs** no Cloudflare Dashboard:
   - Workers → Seu Worker → Logs

### 🎨 Personalizar

Para personalizar cores, textos, etc, edite as seções HTML no final do código:
- `CHECKOUT_HTML` - Página de checkout
- `ADMIN_HTML` - Painel admin
- `AFFILIATE_HTML` - Painel afiliado

---

## 📞 SUPORTE

**Logs do Sistema:**
Os erros aparecem em:
- Cloudflare Dashboard → Workers → [Seu Worker] → Logs
- Console do navegador (F12)

**Códigos de Erro Comuns:**
- `401 Unauthorized` - Senha incorreta
- `404 Not Found` - Produto não existe ou não está ativo
- `400 Bad Request` - Dados inválidos (CPF, etc)
- `500 Internal Server Error` - Erro no Asaas (chave inválida)

---

## ✅ CHECKLIST FINAL

- [ ] Worker criado no Cloudflare
- [ ] Código colado e configurado
- [ ] `ADMIN_PASSWORD` alterado
- [ ] `ASAAS_API_KEY` configurada
- [ ] KV namespace `TIKTOK_ORDERS` criado
- [ ] KV vinculado ao worker
- [ ] Deploy realizado
- [ ] Produto criado e ativado
- [ ] Teste de compra realizado
- [ ] QR Code PIX gerado com sucesso ✅
- [ ] Webhook Asaas configurado (opcional)

---

## 🎉 PRONTO!

Seu sistema TikTok Shop UK v4.0 está **100% FUNCIONANDO** no Cloudflare!

**URL do Checkout:** `https://SEU-WORKER.workers.dev/`
**URL do Admin:** `https://SEU-WORKER.workers.dev/admin`

**Teste fazendo uma compra e veja o QR Code PIX sendo gerado!** 🚀
