# Prompt frontend: producao com multiplas etapas editaveis e equipe por etapa

Contexto:
- Frontend em Vite.
- Backend em Express + TypeScript com JWT.
- Agora cada producao pode ter varias etapas ao mesmo tempo.
- Cada etapa precisa ter equipe responsavel (equipes existentes no sistema).

Objetivo:
- Permitir visualizar e editar etapas da producao.
- Permitir avancar etapa escolhendo etapa existente OU digitando etapa nova.
- Em cada etapa, obrigar selecao de equipe.
- Exibir as mesmas informacoes no link publico de compartilhamento.

Base URL:
- `${VITE_API_URL}/api`

Headers:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Edicao/avanco de etapas: `admin` e `gerente`.

## Novos contratos backend

### 1) Listar producoes (ja existente)
GET `/api/productions`

Cada item de producao agora inclui:
- `productionStatus: string` (resumo legado, agora pode vir como lista em texto)
- `statuses: Array<{ id, stageId, stageName, teamId, teamName, createdAt }>`

### 2) Opcoes de etapas existentes
GET `/api/productions/status-options`

Resposta:
```
{
  "data": [
    {
      "id": "string",
      "name": "cutting",
      "normalizedName": "cutting",
      "usageCount": 12
    }
  ]
}
```

### 3) Avancar etapa (adiciona etapa sem remover as atuais)
PATCH `/api/productions/:id/advance-status`

Body (usar etapa existente):
```
{
  "stageId": "stage-id-existente",
  "teamId": "team-id"
}
```

Body (criar/usar etapa digitada):
```
{
  "stageName": "Eletrica",
  "teamId": "team-id"
}
```

Resposta:
- `data` = producao atualizada com `statuses`.

### 4) Substituir lista de etapas da producao
PUT `/api/productions/:id/statuses`

Body:
```
{
  "statuses": [
    { "stageId": "stage-id", "teamId": "team-id" },
    { "stageName": "Corte", "teamId": "team-id" },
    { "stageName": "Eletrica", "teamId": "team-id" }
  ]
}
```

Regra:
- Cada item precisa de `teamId`.
- Cada item precisa de `stageId` ou `stageName`.

### 5) Compartilhamento publico
GET `/api/public/productions/:token`

A resposta publica tambem inclui `statuses` com etapa + equipe.

## Endpoints auxiliares para tela
- Equipes existentes: GET `/api/teams`

## UX sugerida
1. No detalhe de producao, renderizar bloco "Etapas ativas" em tags/chips:
- Texto: `stageName`
- Subtexto: `teamName`

2. Botao "Avancar etapa":
- Modal com duas abas:
  - "Usar etapa existente": select com `status-options` + select de equipe
  - "Criar nova etapa": input texto + select de equipe
- Submit chama PATCH `/advance-status`.

3. Botao "Editar etapas":
- Abrir editor com lista atual (`statuses`) permitindo adicionar/remover linhas.
- Cada linha: etapa (existente ou nova digitada) + equipe.
- Salvar chama PUT `/statuses`.

4. No card/lista de producoes:
- Mostrar as etapas em linha (wrap) com equipe.

5. Na pagina publica de acompanhamento:
- Mostrar cronologia simples por `createdAt` de `statuses`.
- Para cada item: `stageName` + `teamName`.

## Tratamento de erros
- `400`: equipe ou etapa invalida.
- `401`: token expirado -> redirecionar login.
- `403`: sem permissao.
- `404`: producao nao encontrada.
- `409`: conflito de estoque ao entrar em etapa de aprovacao.
- `500`: exibir fallback e opcao de tentar novamente.

## Criterios de aceite
1. Usuario consegue adicionar mais de uma etapa simultanea na mesma producao.
2. Usuario consegue digitar etapa nova e associar equipe existente.
3. Usuario consegue usar etapa existente e escolher equipe.
4. `statuses` aparece nas telas internas e no link publico.
5. Persistencia mantida apos reload sem perder associacoes etapa/equipe.
