# Prompt para implementar alerta de estoque baixo usando lowStockAlertQuantity (frontend)

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com JWT.
- Produtos agora possuem campo `lowStockAlertQuantity`.
- Esse campo define o limite para alerta de estoque baixo por produto.

Objetivo:
- Permitir cadastrar e editar limite de alerta no formulario de produto.
- Exibir alertas de estoque baixo na aba Produtos com base nesse limite.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Rotas de produtos: `admin` e `gerente`.

Endpoints envolvidos:

1. GET `/api/products`
2. GET `/api/products/:id`
3. POST `/api/products`
4. PATCH `/api/products/:id`

Contrato de produto:
{
  "id": "string",
  "name": "string",
  "stockQuantity": 0,
  "lowStockAlertQuantity": 0,
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}

Regras de frontend:

1. Formulario de criar produto
- Incluir campo numerico `lowStockAlertQuantity`.
- Enviar no payload de `POST /api/products`.
- Exemplo payload:
{
  "name": "MDF 15mm",
  "stockQuantity": 120,
  "lowStockAlertQuantity": 30
}

2. Formulario de editar produto
- Permitir editar `lowStockAlertQuantity`.
- Enviar no payload de `PATCH /api/products/:id`.
- Exemplo payload:
{
  "name": "MDF 15mm",
  "lowStockAlertQuantity": 25
}

3. Regra de alerta na listagem
- Produto em alerta quando:
  - `stockQuantity <= lowStockAlertQuantity`
- Produto sem alerta quando:
  - `stockQuantity > lowStockAlertQuantity`

4. UX sugerida
- Mostrar badge `Estoque baixo` em vermelho para itens em alerta.
- Exibir contagem total de produtos em alerta no topo da tela.
- Permitir filtro rapido: `Todos | Em alerta`.

5. Atualizacao de estado
- Recarregar lista de produtos apos criar/editar produto.
- Recalcular alertas apos movimentacoes de estoque (entrada/saida).

Tratamento de erros:
- `401`: redirecionar login.
- `403`: acesso negado.
- `400`: validacao (ex.: valor negativo).
- `404`: produto nao encontrado.
- `500`: fallback com botao de tentar novamente.

Criterios de aceite:
1. Campo `lowStockAlertQuantity` existe e salva no criar produto.
2. Campo `lowStockAlertQuantity` pode ser alterado no editar produto.
3. Lista marca corretamente produtos com `stockQuantity <= lowStockAlertQuantity`.
4. Contador de itens em alerta bate com os dados da API.
5. Alertas atualizam apos movimentacao de estoque.
