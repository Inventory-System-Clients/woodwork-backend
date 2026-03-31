# Prompt frontend: novo material no orçamento com auto cadastro em produtos/estoque

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com PostgreSQL.
- Na tela de orçamento, o usuario precisa poder incluir material novo que ainda nao existe em produtos.

Objetivo:
- Permitir criar material novo direto no formulario de orcamento.
- Quando o material novo for enviado sem `productId`, o backend cria automaticamente um produto no catalogo com:
  - `stockQuantity = 0`
  - `lowStockAlertQuantity = 0`
- O backend salva o orcamento e persiste o `productId` desse novo produto em `budget.materials`.
- No frontend, esse item deve aparecer como status visual `precisa comprar` quando estoque for zero.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

## Contrato atualizado do backend (orcamentos)

### POST `/api/budgets`
Agora aceita materiais existentes ou novos:

Payload:
{
  "clientName": "string",
  "description": "string",
  "deliveryDate": "ISO string | null",
  "totalPrice": 0,
  "notes": "string | null",
  "status": "draft | pending | approved | rejected",
  "materials": [
    {
      "productId": "string (opcional para novo material)",
      "productName": "string (obrigatorio)",
      "quantity": 1,
      "unit": "string",
      "unitPrice": 0
    }
  ]
}

Regra:
- Se `productId` vier preenchido: usa produto existente.
- Se `productId` nao vier: backend procura produto por `productName`.
- Se nao existir produto com esse nome: backend cria produto com estoque 0.
- Se existir mais de um produto com o mesmo nome: backend retorna `409`.

### PATCH `/api/budgets/:id`
- Mesma regra para `materials` quando o payload incluir materiais.

### Resposta de orcamento
- Em sucesso, o backend retorna materiais com `productId` persistido.

## Fluxo frontend sugerido

1. Formulario de materiais do orcamento
- Permitir 2 modos por item:
  - `Selecionar produto existente`
  - `Cadastrar material novo`
- No modo existente:
  - usuario escolhe item de `/api/products`
  - enviar `productId` + `productName`
- No modo novo:
  - usuario digita nome do material
  - enviar `productName`
  - nao enviar `productId` (ou enviar `null`)

2. Montagem do payload
- Antes de enviar `POST /api/budgets` ou `PATCH /api/budgets/:id`, montar `materials` assim:
  - existente: `{ productId, productName, quantity, unit, unitPrice }`
  - novo: `{ productName, quantity, unit, unitPrice }`

3. Pos-sucesso
- Recarregar:
  - lista de orcamentos (`GET /api/budgets`)
  - lista de produtos (`GET /api/products`), para incluir os novos materiais criados automaticamente

4. Status visual na tela de produtos/orcamento
- Regra sugerida para badge:
  - se `stockQuantity <= 0`: `precisa comprar`
  - se `stockQuantity > 0`: `em estoque`
- Essa regra deve ser aplicada na listagem de produtos e onde exibir resumo de materiais.

5. Tratamento de erros
- `400`: validacao (mostrar campos invalidos)
- `401`: redirecionar login
- `403`: acesso negado
- `409`: conflito de nome de produto duplicado (mostrar mensagem para selecionar produto existente)
- `500`: fallback com tentativa novamente

## Criterios de aceite

1. Usuario consegue salvar orcamento com material novo sem produto pre-cadastrado.
2. Ao salvar, material novo aparece no catalogo de produtos apos refresh.
3. Produto criado automaticamente inicia com estoque 0.
4. Badge/status visual do item novo aparece como `precisa comprar`.
5. `budget.materials` retornado pela API vem com `productId` preenchido tambem para os materiais novos.
6. Edicao de orcamento (`PATCH`) respeita o mesmo comportamento de criacao automatica.
