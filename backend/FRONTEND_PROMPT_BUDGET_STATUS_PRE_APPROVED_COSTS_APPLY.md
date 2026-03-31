# Frontend Prompt - Status de Orcamento com Pre-aprovacao e Custos Aplicados

Contexto:
O backend agora suporta 3 status operacionais no fluxo principal de orcamento:
- `draft` (rascunho)
- `pre_approved` (custos aplicados imediatamente)
- `approved` (orcamento oficial/aprovado)

Importante:
- Ao definir `pre_approved`, o backend aplica como gasto o valor salvo em `costsApplicableValue`.
- Ao definir `approved`, o orcamento torna-se oficial e mantem os custos aplicados.

## Objetivo
Implementar no frontend o novo fluxo de status com UX clara para aplicacao de custos em `pre_approved` e aprovacao final em `approved`.

## Contrato da API

### Criar orcamento
`POST /api/budgets`

Campos financeiros relevantes para custos aplicaveis:
- `costsApplicableValue` (number, opcional no payload, mas recomendado para explicitar o valor que sera aplicado no `pre_approved`)

Campo `status` aceito:
- `draft`
- `pending`
- `pre_approved`
- `approved`
- `rejected`

Observacao de regra de negocio para UI:
- Fluxo principal esperado: `draft` -> `pre_approved` -> `approved`

### Editar orcamento
`PATCH /api/budgets/:id`

Campo `status` pode ser atualizado para `pre_approved` quando for aplicar custos.

Campo adicional aceito:
- `costsApplicableValue` (number >= 0)

### Aprovar oficialmente
`PATCH /api/budgets/:id/approve`

Define status final como `approved`.

### Resposta de orcamento (novos campos)
Em `data` do orcamento:
- `status`
- `costsApplicableValue` (number)
- `costsAppliedAt` (string ISO ou `null`)
- `costsAppliedValue` (number)
- `financialSummary.costsApplicableValue` (number)
- `financialSummary.costsAppliedAt` (string ISO ou `null`)
- `financialSummary.costsAppliedValue` (number)
- `financialSummary.remainingCostToApply` (number)

## Requisitos de UI

1. Campo de status no formulario:
- Exibir opcoes com labels amigaveis:
  - `draft` -> "Rascunho"
  - `pre_approved` -> "Pre-aprovado (aplica custos)"
  - `approved` -> "Aprovado (oficial)"
- `pending` e `rejected` podem ficar em fluxo secundario/administrativo se ja usados no sistema.

2. Confirmacao antes de aplicar custos:
- Quando usuario trocar para `pre_approved`, abrir modal de confirmacao:
  - Titulo: "Aplicar custos agora?"
- Texto: "Ao pre-aprovar, sera aplicado como gasto o valor salvo em custo aplicavel deste orcamento."
- Se cancelar, nao enviar a alteracao.

3. Campo de custo aplicavel:
- Adicionar campo numerico `Custo aplicavel` no formulario.
- Salvar no payload como `costsApplicableValue`.
- Se vazio, usar regra atual da tela (ex.: preencher com custo total calculado antes do submit).
- Exibir esse valor tambem no detalhe do orcamento.

4. Indicadores financeiros no detalhe/listagem:
- Exibir "Custos aplicados" com valor de `costsAppliedValue`.
- Exibir data/hora de aplicacao com `costsAppliedAt`.
- Exibir "Custo restante para aplicar" com `financialSummary.remainingCostToApply`.

5. Fluxo recomendado de acoes:
- Acao primaria em rascunho: "Pre-aprovar e aplicar custos".
- Acao primaria em pre-aprovado: "Aprovar oficialmente".

6. Edicao apos pre-aprovacao:
- Permitir edicao de campos conforme regra atual do produto.
- Sempre exibir alerta de que custos ja foram aplicados.

## Mapeamento de status para label

- `draft` -> "Rascunho"
- `pre_approved` -> "Pre-aprovado"
- `approved` -> "Aprovado"
- `pending` -> "Pendente"
- `rejected` -> "Rejeitado"

## Tratamento de erros

1. Se API retornar erro de validacao de status:
- Exibir mensagem proxima ao campo de status.
- Nao limpar os demais campos do formulario.

2. Se falhar pre-aprovacao:
- Manter status atual na UI.
- Exibir toast/snackbar com mensagem de falha.

## Criterios de aceite

1. Usuario consegue mudar de `draft` para `pre_approved` com confirmacao.
2. Ao salvar como `pre_approved`, `costsAppliedValue` deve refletir exatamente o valor de `costsApplicableValue` salvo no orcamento.
3. Usuario consegue aprovar oficialmente via `approved`/endpoint de aprovacao.
4. Listagem e detalhe exibem corretamente status e informacoes de custos aplicados.
5. A UI comunica claramente que `pre_approved` aplica custos imediatamente.
