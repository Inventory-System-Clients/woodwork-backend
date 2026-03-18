# Prompt para implementar imagens nas producoes e exibicao no link publico (frontend)

Contexto:
- Frontend em Vite + React.
- Backend em Express + TypeScript.
- Ja existe fluxo de compartilhamento publico por token.
- Agora cada producao pode ter imagens e essas imagens devem aparecer para o cliente na pagina publica.

Objetivo:
- Permitir upload de imagens na tela interna de producao.
- Exibir galeria dessas imagens na pagina publica `/acompanhar-producao/:token`.
- Manter compatibilidade com aliases de endpoint para evitar 404 em ambientes diferentes.

Base URL:
- `${VITE_API_URL}/api`

## Regras de autenticacao

- Upload/listagem interna de imagens: requer JWT e perfil `admin` ou `gerente`.
- Consulta publica por token: nao envia JWT.

## Endpoints que o frontend deve usar

1) Upload/listagem interna (autenticado)
- `GET /api/productions/:id/images`
- `POST /api/productions/:id/images`

Contrato de upload:
- `Content-Type: multipart/form-data`
- campo de arquivo: `images`
- pode enviar varios arquivos no mesmo request
- maximo 10 arquivos por request
- maximo 8MB por arquivo
- somente `image/*`

Resposta de upload/listagem:

```json
{
  "data": [
    {
      "id": "uuid",
      "productionId": "2",
      "fileName": "acabamento-1.jpg",
      "mimeType": "image/jpeg",
      "fileSize": 245761,
      "createdAt": "2026-03-18T13:40:00.000Z"
    }
  ]
}
```

2) Producao publica por token (sem autenticacao)
- principal: `GET /api/public/productions/:token`
- alias 1: `GET /api/productions/public/:token`
- alias 2: `GET /api/productions/shared/:token`

Resposta publica esperada (trecho):

```json
{
  "data": {
    "id": "2",
    "clientName": "Cliente X",
    "productionStatus": "cutting",
    "materials": [],
    "images": [
      {
        "id": "uuid",
        "fileName": "acabamento-1.jpg",
        "mimeType": "image/jpeg",
        "fileSize": 245761,
        "createdAt": "2026-03-18T13:40:00.000Z",
        "url": "/api/public/productions/<token>/images/<imageId>"
      }
    ]
  }
}
```

3) Conteudo binario da imagem publica (sem autenticacao)
- principal: `GET /api/public/productions/:token/images/:imageId`
- alias 1: `GET /api/productions/public/:token/images/:imageId`
- alias 2: `GET /api/productions/shared/:token/images/:imageId`

## Implementacao sugerida

1. Criar servicos de API
- `uploadProductionImages(productionId: string, files: File[])`
  - criar `FormData`
  - para cada arquivo: `formData.append("images", file)`
  - `POST /productions/:id/images`
- `listProductionImages(productionId: string)`
  - `GET /productions/:id/images`
- `getPublicProductionByToken(token: string)`
  - tentar endpoints publicos nesta ordem:
    1. `/public/productions/:token`
    2. `/productions/public/:token`
    3. `/productions/shared/:token`

2. Tela interna de producao
- Adicionar seletor de arquivo com `multiple` e `accept="image/*"`.
- Botao "Enviar imagens" para chamar upload.
- Mostrar progresso/estado de envio.
- Ao finalizar upload com sucesso:
  - atualizar galeria local da producao
  - exibir toast de sucesso

3. Tela publica `/acompanhar-producao/:token`
- Buscar dados no mount.
- Fazer polling a cada 30s para atualizar status e imagens.
- Renderizar galeria com `data.images`:
  - se `image.url` comecar com `/`, montar URL final com `${VITE_API_URL}${image.url}`
  - usar `<img src={resolvedUrl} loading="lazy" alt={image.fileName} />`
- Fallback visual quando nao houver imagens.

4. Tratamento de erros
- `401` (rotas internas): redirecionar login.
- `403` (rotas internas): mostrar sem permissao.
- `404` (rota publica/token): mostrar "Link invalido ou expirado".
- `400` no upload: mostrar mensagem amigavel (tipo invalido, arquivo muito grande, request invalido).
- `500`: exibir estado de erro com opcao de tentar novamente.

5. Requisitos de UX
- Mostrar metadados minimos da imagem (nome e data de envio) na area interna.
- Na pagina publica, priorizar visual limpo:
  - grid responsivo
  - placeholder enquanto carrega
  - abrir imagem ampliada ao clicar (modal/lightbox)

## Criterios de aceite

1. Usuario admin/gerente consegue enviar 1 ou mais imagens para uma producao.
2. Lista interna de imagens da producao atualiza apos upload sem reload manual.
3. Pagina publica por token mostra as imagens da producao.
4. Polling atualiza novas imagens automaticamente na pagina publica.
5. Frontend suporta aliases de endpoint para evitar 404 entre ambientes.
6. Erros de upload e de token sao tratados com mensagens claras para o usuario.
