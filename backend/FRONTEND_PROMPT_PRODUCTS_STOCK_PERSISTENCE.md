# Prompt para persistir Produtos e Estoque no PostgreSQL (backend + frontend)

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com autenticacao JWT.
- A aba Produtos nao pode depender de estado local como fonte principal.
- A aba Estoque (movimentacoes) deve ler e gravar dados no banco PostgreSQL via API.

Objetivo:
- Trocar o fluxo local por fluxo remoto para produtos e movimentacoes de estoque.
- Garantir que listagem, criacao, edicao e movimentacao sejam persistidas no backend.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Rotas de produtos e estoque: somente `admin` e `gerente`.
- Em `403`, mostrar mensagem de acesso negado.

Endpoints de Produtos:

1. GET `/api/products`
- Lista produtos.
- Filtro opcional: `?search=texto`.

2. GET `/api/products/:id`
- Detalhe de um produto.

3. POST `/api/products`
- Cria produto no banco.

Payload:
{
  "name": "string",
  "stockQuantity": 0
}

4. PATCH `/api/products/:id`
- Atualiza produto.

Payload:
{
  "name": "string"
}

Contrato de resposta (produto):
{
  "data": {
    "id": "string",
    "name": "string",
    "stockQuantity": 0,
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}

Endpoints de Estoque (movimentacoes):

1. GET `/api/stock/movements`
- Lista movimentacoes.
- Filtros opcionais:
  - `productId`
  - `movementType` (`entrada` | `saida`)
  - `limit` (1-200)
  - `offset`

Resposta:
{
  "data": [
    {
      "id": "string",
      "productId": "string",
      "productName": "string",
      "movementType": "entrada | saida",
      "quantity": 0,
      "unit": "string | null",
      "reason": "string",
      "referenceType": "string | null",
      "referenceId": "string | null",
      "currentStock": 0,
      "createdAt": "ISO string"
    }
  ],
  "meta": {
    "total": 0,
    "limit": 50,
    "offset": 0
  }
}

2. POST `/api/stock/movements`
- Cria movimentacao e atualiza estoque do produto no backend (transacional).

Payload:
{
  "productId": "string",
  "movementType": "entrada | saida",
  "quantity": 1,
  "unit": "string | null",
  "reason": "string",
  "referenceType": "string | null",
  "referenceId": "string | null"
}

Resposta:
{
  "data": {
    "id": "string",
    "productId": "string",
    "productName": "string",
    "movementType": "entrada | saida",
    "quantity": 1,
    "unit": "string | null",
    "reason": "string",
    "referenceType": "string | null",
    "referenceId": "string | null",
    "currentStock": 0,
    "createdAt": "ISO string"
  }
}

Implementacao frontend sugerida:
1. Servicos
- Criar `services/products.ts` com:
  - `listProducts(search?)`
  - `getProductById(id)`
  - `createProduct(payload)`
  - `updateProduct(id, payload)`
- Criar `services/stock.ts` com:
  - `listStockMovements(filters?)`
  - `createStockMovement(payload)`

2. Estado da tela Produtos
- Ao abrir a aba Produtos: chamar `GET /api/products`.
- Ao criar produto: chamar `POST /api/products` e atualizar lista com retorno remoto.
- Ao editar produto: chamar `PATCH /api/products/:id` e atualizar item na lista.
- Remover geracao local de ids como fonte principal.

3. Estado da tela Estoque
- Ao abrir a aba Estoque: chamar `GET /api/stock/movements`.
- Ao registrar entrada/saida: chamar `POST /api/stock/movements`.
- Em sucesso de movimentacao:
  - atualizar lista de movimentacoes
  - atualizar lista de produtos (estoque atual)

4. Erros
- 401: redirecionar para login.
- 403: mostrar acesso negado.
- 404: produto nao encontrado.
- 409: estoque insuficiente na saida (exibir detalhes retornados em `details`).
- 400: mostrar erro de validacao.
- 500: fallback com botao de tentar novamente.

Criterios de aceite:
1. Novo produto criado aparece apos refresh da pagina.
2. Lista de produtos usa apenas dados da API.
3. Movimentacao de estoque gera registro em lista de movimentacoes apos refresh.
4. Saldo de estoque do produto muda conforme entradas/saidas registradas.
5. Saida sem saldo suficiente retorna erro 409 com feedback amigavel na UI.
