# Frontend Prompt - Departamentos de Gasto no Orcamento

Contexto:
O backend agora suporta departamentos de gasto reutilizaveis no orcamento.
Cada item de departamento de gasto tem:
- `expenseDepartmentId` (opcional, quando vier do catalogo)
- `name` (nome editavel)
- `sector` (setor editavel)
- `amount` (valor do gasto)

Quando um departamento de gasto e criado/alterado no orcamento, ele e salvo no catalogo para uso futuro em outros orcamentos.

## Objetivo
Implementar no frontend:
1. Cadastro/edicao de departamentos de gasto dentro do formulario de orcamento.
2. Reuso de departamentos ja cadastrados anteriormente.
3. Exibicao desses custos como parte do custo total do orcamento.

## Contrato da API

### Listar catalogo reutilizavel de departamentos
`GET /api/budgets/expense-departments`

Query opcional:
- `search` (filtra por nome ou setor)

Resposta:
```json
{
  "data": [
    {
      "id": "8d280470-12af-4f72-8ec2-6882d3ec1880",
      "name": "Terceirizado eletrica",
      "sector": "Eletrica",
      "defaultAmount": 3500,
      "createdAt": "2026-03-31T14:00:00.000Z",
      "updatedAt": "2026-03-31T14:00:00.000Z"
    }
  ]
}
```

### Criar orcamento
`POST /api/budgets`

Campo novo no payload:
- `expenseDepartments: BudgetExpenseDepartment[]` (opcional, default `[]`)

Exemplo:
```json
{
  "clientName": "Cliente Exemplo",
  "category": "executivo",
  "description": "Projeto residencial",
  "status": "pending",
  "totalPrice": 28000,
  "laborCost": 5000,
  "materials": [
    {
      "productId": null,
      "productName": "MDF Branco 18mm",
      "quantity": 2,
      "unit": "chapas",
      "unitPrice": 550
    }
  ],
  "expenseDepartments": [
    {
      "expenseDepartmentId": "8d280470-12af-4f72-8ec2-6882d3ec1880",
      "name": "Terceirizado eletrica",
      "sector": "Eletrica",
      "amount": 4200
    },
    {
      "name": "Marcenaria externa",
      "sector": "Marcenaria",
      "amount": 1900
    }
  ]
}
```

### Editar orcamento
`PATCH /api/budgets/:id`

Campos aceitos:
- `expenseDepartments` (opcional)

Regra:
- Se enviado, substitui a lista atual de departamentos daquele orcamento.

### Ler orcamentos
`GET /api/budgets` e `GET /api/budgets/:id`

Cada orcamento agora retorna:
- `expenseDepartments: []`
- `financialSummary.expenseDepartmentsCost`

## Requisitos de UI

1. Formulario de orcamento (criar/editar)
- Adicionar secao "Departamentos de gasto".
- Permitir adicionar/remover linhas dinamicamente.
- Cada linha deve ter:
  - Seletor opcional de item existente do catalogo (autocomplete)
  - Campo `Nome` editavel
  - Campo `Setor` editavel
  - Campo `Valor` editavel (moeda, >= 0)
- Ao selecionar item do catalogo, preencher nome, setor e valor padrao.
- Usuario pode alterar nome/setor/valor mesmo quando vier do catalogo.

2. Reuso rapido
- Carregar catalogo em `GET /api/budgets/expense-departments` ao abrir formulario.
- Suportar busca por texto (nome/setor).
- Exibir sugestoes como: `Nome - Setor (valor padrao)`.

3. Resumo financeiro no form
- Mostrar subtotal de departamentos de gasto:
  - `soma(expenseDepartments[].amount)`
- Exibir junto de materiais e mao de obra no bloco de custos.
- Atualizar valores em tempo real ao editar os campos.

4. Listagem e detalhe do orcamento
- Exibir quantidade de departamentos e custo total desses departamentos.
- No detalhe, listar todos os departamentos com nome, setor e valor.

## Validacoes de frontend

- `name` obrigatorio.
- `sector` obrigatorio.
- `amount` obrigatorio e >= 0.
- Nao permitir submit com valores invalidos.

## Tratamento de erro

Se API retornar erro de validacao em `expenseDepartments`:
- destacar a linha/campo invalido;
- manter os demais dados preenchidos no formulario;
- exibir mensagem amigavel.

## Criterios de aceite

1. Usuario consegue adicionar departamentos de gasto no orcamento.
2. Usuario consegue editar nome, setor e valor de cada departamento.
3. O custo dos departamentos entra no custo total (`financialSummary.totalCost`).
4. Um departamento criado uma vez pode ser reutilizado em novos orcamentos.
5. Catalogo de departamentos pode ser pesquisado no formulario.
6. Criacao e edicao de orcamento continuam funcionando com e sem departamentos.
