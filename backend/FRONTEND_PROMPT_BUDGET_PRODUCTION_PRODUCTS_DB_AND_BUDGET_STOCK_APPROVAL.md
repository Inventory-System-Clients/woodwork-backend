# Prompt para ligar formularios de Orcamento e Producao aos Produtos do banco + baixa de estoque na aprovacao do Orcamento

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com autenticacao JWT.
- Agora os formularios de Novo Orcamento e Nova Producao devem usar produtos cadastrados no banco.
- Ao aprovar Orcamento, o backend desconta automaticamente estoque dos produtos usados no Orcamento.

Objetivo:
- Popular o campo/categoria Produtos dos dois formularios com dados reais do backend.
- Garantir envio de materiais com vinculo a produto (productId).
- Tratar corretamente sucesso/erros da aprovacao de Orcamento com impacto em estoque.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Produtos, Orcamentos e Producoes: `admin` e `gerente`.
- Em `403`, mostrar mensagem de acesso negado.

Endpoints usados neste fluxo:

1) Produtos para preencher select/categoria
- GET `/api/products`
- Filtro opcional: GET `/api/products?search=texto`

Resposta:
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "stockQuantity": 0,
      "createdAt": "ISO string",
      "updatedAt": "ISO string"
    }
  ]
}

2) Criar Orcamento
- POST `/api/budgets`

Payload (materiais vinculados a produto):
{
  "clientName": "string",
  "description": "string",
  "deliveryDate": "ISO string | null",
  "totalPrice": 0,
  "notes": "string | null",
  "status": "draft | pending | approved | rejected",
  "materials": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": 1,
      "unit": "string",
      "unitPrice": 0
    }
  ]
}

3) Aprovar Orcamento (com baixa de estoque)
- PATCH `/api/budgets/:id/approve`

Regra de backend:
- Na transicao para `approved`, o backend:
  - desconta do `products.stock_quantity`
  - cria movimentacao de saida em `product_stock_movements`
- Se ja estiver aprovado, nao desconta de novo.

4) Criar Producao
- POST `/api/productions`

Payload:
{
  "clientName": "string",
  "description": "string",
  "deliveryDate": "ISO string | null",
  "installationTeamId": "string",
  "initialCost": 0,
  "materials": [
    {
      "productId": "string",
      "productName": "string",
      "quantity": 1,
      "unit": "string"
    }
  ]
}

Implementacao frontend sugerida:

1. Servico de produtos
- Criar/usar `services/products.ts` com:
  - `listProducts(search?)`
- Chamar ao abrir formulario de Novo Orcamento e Novo Producao.
- Preencher select de produto com `id` e `name`.

2. Formulario de Novo Orcamento
- Campo material deve selecionar produto vindo de `/api/products`.
- Ao selecionar produto:
  - salvar `productId`
  - preencher `productName` com `name` do produto selecionado
- Nao usar nome digitado manualmente como fonte principal quando houver selecao.

3. Formulario de Nova Producao
- Mesmo comportamento do Orcamento:
  - selecionar produto do backend
  - enviar `productId` e `productName` no material

4. Aprovacao de Orcamento
- Acao de confirmar deve chamar `PATCH /api/budgets/:id/approve`.
- Em sucesso:
  - atualizar detalhe/lista de Orcamentos
  - atualizar lista de Produtos (estoque atual)
  - atualizar lista de Movimentacoes de Estoque (se houver aba/widget aberta)

5. Tratamento de erros na aprovacao de Orcamento
- `409` (estoque insuficiente):
  - mostrar erro amigavel
  - ler `details` para exibir produto e quantidades
  - exemplo: solicitado X, disponivel Y
- `400` (produto nao encontrado ou material inconsistente):
  - mostrar erro de dados inconsistentes do Orcamento
- `500` (schema de estoque nao aplicado):
  - fallback com "Contate o suporte"
- `401`: redirecionar para login
- `403`: acesso negado

6. UX minima recomendada
- Desabilitar botao de confirmar enquanto requisicao estiver em andamento.
- Evitar duplo clique na aprovacao.
- Em erro, manter modal aberto para usuario ajustar/revisar.

Criterios de aceite:
1. Campo/categoria Produtos no Novo Orcamento usa dados de `/api/products`.
2. Campo/categoria Produtos no Nova Producao usa dados de `/api/products`.
3. Materiais enviados por Orcamento/Producao incluem `productId` e `productName` do produto selecionado.
4. Ao aprovar Orcamento, estoque do produto e baixado no backend.
5. Se nao houver estoque suficiente, frontend mostra erro 409 com feedback claro.
6. Recarregar pagina mantem dados corretos vindos da API (sem dependencia de estado local).
