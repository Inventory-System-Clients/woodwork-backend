# Prompt para implementar a aba de Logistica com endpoint agregado

Contexto:
- Projeto frontend em Vite.
- Backend protegido com Bearer Token JWT.
- Endpoint agregado ja disponivel: GET /api/logistics/summary.
- Role exigida no backend: admin e gerente.

Objetivo:
- Alimentar os cards da aba de Logistica com uma unica chamada HTTP.
- Mostrar ranking de materiais mais usados em producoes ativas.
- Exibir custo geral das producoes ativas.

Endpoint:
- GET /api/logistics/summary
- Headers obrigatorios:
  - Authorization: Bearer <token>

Contrato de resposta:
{
  "data": {
    "teamsCount": 0,
    "activeEmployeesCount": 0,
    "productions": {
      "activeCount": 0,
      "overdueCount": 0,
      "nearDeadlineCount": 0,
      "onTimeCount": 0
    },
    "topMaterials": [
      {
        "productId": "string",
        "productName": "string",
        "unit": "string",
        "totalQuantity": 0
      }
    ],
    "activeProductionsTotalCost": 0
  }
}

Regras ja aplicadas pelo backend:
- Producoes ativas: pending, cutting, assembly, finishing, quality_check.
- Atrasada: delivery_date < hoje e status ativo.
- Quase no prazo: delivery_date entre hoje e hoje + 3 dias e status ativo.
- Em dia: delivery_date > hoje + 3 dias e status ativo.
- topMaterials: top 10 por soma de quantidade nas producoes ativas.
- activeProductionsTotalCost: soma de initial_cost nas producoes ativas.

Implementacao frontend sugerida:
1. Criar servico tipado:
- services/logistics.ts com metodo getLogisticsSummary().

2. Criar tipos:
- types/logistics.ts com LogisticsSummaryResponse e LogisticsTopMaterial.

3. Carregar dados da aba:
- Ao abrir a aba de Logistica, fazer uma chamada GET /api/logistics/summary.
- Exibir loading e skeleton para os cards.
- Em erro 401: redirecionar para login.
- Em erro 403: mostrar "Voce nao tem permissao para acessar a Logistica".
- Em erro 500: mostrar fallback com botao "Tentar novamente".

4. Bind de UI:
- Card Equipes = teamsCount
- Card Funcionarios ativos = activeEmployeesCount
- Card Producoes ativas = productions.activeCount
- Card Producoes atrasadas = productions.overdueCount
- Card Quase no prazo = productions.nearDeadlineCount
- Card Em dia = productions.onTimeCount
- Card Custo geral = activeProductionsTotalCost
- Tabela/Grafico de materiais = topMaterials

5. Controle de acesso na UI:
- Exibir aba Logistica somente para roles admin e gerente.
- Para funcionario, esconder aba e rotas relacionadas.

Criterios de aceite frontend:
1. A aba faz somente uma chamada para os indicadores (summary).
2. Os cards exibem exatamente os campos retornados em data.
3. O ranking de materiais renderiza top 10 ordenado por totalQuantity.
4. Erros 401/403/500 tratados com UX adequada.
5. Acesso bloqueado para role funcionario.
