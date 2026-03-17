# Prompt para persistir orcamentos no PostgreSQL (backend + frontend)

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com autenticao JWT.
- Orcamentos nao podem mais existir apenas em estado local no frontend.
- Todo novo orcamento deve ser salvo no banco PostgreSQL via API.

Objetivo:
- Trocar o fluxo local por fluxo remoto (CRUD de orcamentos via backend).
- Garantir que criar, listar, abrir detalhe, editar e aprovar usem endpoints da API.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Rotas de orcamento: somente `admin` e `gerente`.
- Em `403`, mostrar mensagem de acesso negado.

Endpoints de orcamento:

1. GET `/api/budgets`
- Lista orcamentos com materiais.

2. GET `/api/budgets/:id`
- Detalhe de um orcamento.

3. POST `/api/budgets`
- Cria orcamento no banco.

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
      "productId": "string opcional",
      "productName": "string",
      "quantity": 1,
      "unit": "string",
      "unitPrice": 0
    }
  ]
}

4. PATCH `/api/budgets/:id`
- Atualiza campos do orcamento.
- Pode enviar qualquer subconjunto dos campos acima.

5. PATCH `/api/budgets/:id/approve`
- Aprova o orcamento (status vira `approved`).

Contrato de resposta (lista e detalhe):
{
  "data": {
    "id": "string",
    "clientName": "string",
    "description": "string",
    "status": "draft | pending | approved | rejected",
    "deliveryDate": "ISO string | null",
    "totalPrice": 0,
    "notes": "string | null",
    "approvedAt": "ISO string | null",
    "createdAt": "ISO string",
    "updatedAt": "ISO string",
    "materials": [
      {
        "productId": "string opcional",
        "productName": "string",
        "quantity": 1,
        "unit": "string",
        "unitPrice": 0
      }
    ]
  }
}

Implementacao frontend sugerida:
1. Servico
- Criar `services/budgets.ts` com:
  - `listBudgets()`
  - `getBudgetById(id)`
  - `createBudget(payload)`
  - `updateBudget(id, payload)`
  - `approveBudget(id)`

2. Estado da tela
- Ao abrir tela de orcamentos: chamar `GET /api/budgets`.
- Ao criar: chamar `POST /api/budgets` e atualizar lista com retorno do backend.
- Remover qualquer `useState` que gere id local tipo `b1`, `b2` como fonte principal.

3. Erros
- 401: redirecionar login.
- 403: mostrar acesso negado.
- 400: mostrar erro de validacao.
- 500: fallback com botao de tentar novamente.

Criterios de aceite:
1. Novo orcamento criado aparece apos refresh da pagina.
2. IDs de orcamento passam a vir do backend.
3. Lista e detalhe usam apenas dados da API.
4. Aprovar orcamento usa endpoint de aprovacao da API.
