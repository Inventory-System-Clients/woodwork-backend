# Prompt frontend: categorias de equipe (interna e terceirizada)

Contexto:
- Frontend em Vite.
- Backend em Express + TypeScript com JWT.
- O cadastro de equipes agora possui categoria obrigatoria.

Objetivo:
- Permitir criar e editar equipes com categoria.
- Exibir categoria na listagem e detalhe de equipes.
- Filtrar equipes por categoria na UI (opcional, recomendado).

Base URL:
- `${VITE_API_URL}/api`

Headers:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Endpoints de equipes exigem `admin` ou `gerente`.

## Contratos atualizados do backend

### Tipo de categoria
- `interna`
- `terceirizada`

### 1) Listar equipes
GET `/api/teams`

Resposta (item):
```
{
  "id": "string",
  "name": "Equipe Marcenaria",
  "category": "interna",
  "description": "...",
  "createdAt": "ISO",
  "updatedAt": "ISO",
  "members": []
}
```

### 2) Buscar equipe por id
GET `/api/teams/:id`

Retorna o mesmo formato com `category`.

### 3) Criar equipe
POST `/api/teams`

Body:
```
{
  "name": "Equipe Instalacao Externa",
  "category": "terceirizada",
  "description": "Parceiro regional",
  "memberIds": ["emp-1", "emp-2"]
}
```

Observacao:
- `category` obrigatoria.

### 4) Editar equipe
PATCH `/api/teams/:id`

Body (parcial):
```
{
  "category": "interna"
}
```

Ou:
```
{
  "name": "Equipe Corte",
  "category": "terceirizada",
  "description": "..."
}
```

## Implementacao frontend sugerida

1. Tipos
- Atualizar interface `Team` adicionando:
```
category: 'interna' | 'terceirizada'
```

2. Formulario de equipe (criar/editar)
- Adicionar campo obrigatorio `category`:
  - Radio ou Select
  - Label: `Categoria`
  - Opcoes:
    - `Interna` (valor `interna`)
    - `Terceirizada` (valor `terceirizada`)

3. Listagem de equipes
- Exibir badge/chip com categoria:
  - `Interna`
  - `Terceirizada`

4. Filtro na tela (recomendado)
- Filtro por categoria: `Todas | Internas | Terceirizadas`.

5. Integracao
- Garantir envio de `category` no POST.
- Garantir envio opcional de `category` no PATCH.

## Tratamento de erros
- `400`: payload invalido (categoria ausente/invalida).
- `401`: nao autenticado.
- `403`: sem permissao.
- `404`: equipe nao encontrada.
- `409`: nome de equipe ja em uso.

## Criterios de aceite
1. Usuario consegue criar equipe selecionando categoria.
2. Usuario consegue editar categoria da equipe.
3. Listagem exibe categoria de cada equipe.
4. API recebe e retorna `category` corretamente.
5. Fluxo funciona sem quebrar os membros da equipe.
