# Prompt para implementar fluxo de status da producao com botao Avancar Etapa (frontend)

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com JWT.
- Producao agora possui fluxo de status por etapas, nao apenas pendente/aprovado/concluido.

Objetivo:
- Mostrar status da producao com nomenclatura amigavel.
- Permitir avancar etapa com um botao na tela de producao.
- Atualizar lista/detalhe apos cada mudanca de etapa.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Mudanca de status: `admin` e `gerente`.
- Em `403`, mostrar acesso negado.

Status oficiais no backend:
- `pending` -> Pendente
- `cutting` -> Corte
- `assembly` -> Montagem
- `finishing` -> Acabamento
- `quality_check` -> Controle
- `approved` -> Aprovado
- `delivered` -> Entregue

Ordem de transicao:
- `pending -> cutting -> assembly -> finishing -> quality_check -> approved -> delivered`

Endpoint para avancar etapa:
- PATCH `/api/productions/:id/advance-status`

Resposta:
{
  "data": {
    "id": "string",
    "productionStatus": "pending | cutting | assembly | finishing | quality_check | approved | delivered",
    "...": "demais campos da producao"
  }
}

Regras importantes:
- Quando a transicao chega em `approved`, o backend baixa estoque automaticamente.
- Se faltar estoque nessa transicao, backend retorna `409`.
- Se ja estiver `delivered`, chamar advance-status nao muda estado.

Implementacao frontend sugerida:

1. Servico
- Em `services/productions.ts`, adicionar:
  - `advanceProductionStatus(id)` -> PATCH `/api/productions/:id/advance-status`

2. UI de status
- Criar mapa de labels:
  - pending: Pendente
  - cutting: Corte
  - assembly: Montagem
  - finishing: Acabamento
  - quality_check: Controle
  - approved: Aprovado
  - delivered: Entregue

3. Botao Avancar Etapa
- Exibir para `admin` e `gerente`.
- Desabilitar durante requisicao.
- Ocultar/desabilitar quando status for `delivered`.
- Ao sucesso:
  - atualizar item da lista e/ou detalhe com retorno da API
  - exibir toast "Status atualizado para <novo_status>"

4. Tratamento de erros
- `401`: redirecionar login.
- `403`: acesso negado.
- `404`: producao nao encontrada.
- `409`: estoque insuficiente ao avancar para `approved` (mostrar detalhes de produto/quantidade se existir em `details`).
- `500`: fallback com botao de tentar novamente.

5. Compatibilidade
- Manter suporte aos endpoints existentes `PATCH /api/productions/:id/approve` e `PATCH /api/productions/:id/complete` se a tela antiga ainda usar.
- Preferir o novo endpoint `advance-status` no fluxo novo da UI.

Criterios de aceite:
1. A tela mostra os 7 status com labels corretos.
2. Botao Avancar Etapa muda para o proximo status conforme ordem oficial.
3. Ao atingir `approved`, erros de estoque (`409`) sao tratados na UI.
4. Em `delivered`, botao nao avanca mais.
5. Lista e detalhe refletem o status retornado pelo backend sem refresh manual.
