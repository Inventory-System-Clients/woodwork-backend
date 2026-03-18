# Prompt para implementar compartilhamento publico de producao (frontend)

Contexto:
- Frontend em Vite + React.
- Backend em Express + TypeScript.
- Objetivo: eliminar erro 404 no fluxo de compartilhamento publico de producao e permitir polling da pagina publica.

Base URL:
- `${VITE_API_URL}/api`

## Regras de autenticacao

- Criar link compartilhavel exige JWT e perfil `admin` ou `gerente`.
- Consulta publica por token NAO usa JWT.

## Endpoints para criar link (autenticado)

- Principal: `POST /api/productions/:id/share-link`
- Alias de compatibilidade: `POST /api/productions/:id/share`

Resposta esperada:

```json
{
  "data": {
    "token": "string",
    "url": "https://frontend/acompanhar-producao/<token> ou /acompanhar-producao/<token>",
    "expiresAt": "2026-04-17T14:00:00.000Z"
  }
}
```

## Endpoints publicos por token (sem autenticacao)

Implementar fallback automatico nesta ordem para evitar 404 legado:

1. `GET /api/public/productions/:token`
2. `GET /api/productions/public/:token`
3. `GET /api/productions/shared/:token`

Resposta esperada:

```json
{
  "data": {
    "id": "uuid",
    "clientName": "Cliente X",
    "description": "Armario planejado",
    "productionStatus": "pending|cutting|assembly|finishing|quality_check|approved|delivered",
    "deliveryDate": "2026-03-25T00:00:00.000Z",
    "installationTeam": "Equipe Norte",
    "materials": [
      {
        "productId": "uuid",
        "productName": "MDF Branco 18mm",
        "quantity": 6,
        "unit": "chapas"
      }
    ],
    "observations": "texto",
    "updatedAt": "2026-03-18T10:45:00.000Z"
  }
}
```

## Implementacao sugerida

1. Camada de servico
- `createProductionShareLink(productionId: string)`:
  - tenta `POST /productions/:id/share-link`
  - se receber 404/405 por compatibilidade, tenta `POST /productions/:id/share`
- `getPublicProductionByToken(token: string)`:
  - tenta os 3 GET publicos em sequencia ate obter 200.

2. Tela interna (producao)
- Botao "Compartilhar" visivel apenas para `admin|gerente`.
- Ao clicar:
  - chama createProductionShareLink
  - copia `data.url` para clipboard
  - mostra toast de sucesso
- Tratar erros:
  - `401`: redirecionar login
  - `403`: sem permissao
  - `404`: producao nao encontrada
  - `500`: mensagem generica

3. Tela publica `/acompanhar-producao/:token`
- Nao enviar Authorization header.
- Buscar dados ao montar a pagina.
- Fazer polling a cada 30s para manter status atualizado:
  - refetch silencioso
  - atualizar badge/status e data de ultima atualizacao
- Se endpoint retornar `404`: mostrar "Link invalido ou expirado".

4. Mapa de status para UX
- pending -> Pendente
- cutting -> Corte
- assembly -> Montagem
- finishing -> Acabamento
- quality_check -> Controle
- approved -> Aprovado
- delivered -> Entregue

## Criterios de aceite

1. Clicar em compartilhar gera link sem 404.
2. Pagina publica abre com token e exibe dados de producao.
3. Polling atualiza status automaticamente sem recarregar pagina.
4. Frontend suporta os aliases de endpoint para compatibilidade retroativa.
