# Frontend Prompt - Categoria de Orcamento (Arquitetonico/Executivo)

Contexto:
O backend agora exige o campo `category` no cadastro e na edicao de orcamentos.
Categorias validas:
- `arquitetonico`
- `executivo`

## Objetivo
Implementar no frontend a selecao obrigatoria da categoria no formulario de orcamento e suportar filtro por categoria na listagem.

## Contrato da API

### Criar orcamento
`POST /api/budgets`

Payload minimo esperado:
```json
{
  "clientName": "Cliente Exemplo",
  "category": "arquitetonico",
  "description": "Descricao do projeto",
  "status": "pending",
  "totalPrice": 0,
  "materials": [
    {
      "productId": null,
      "productName": "MDF Branco 18mm",
      "quantity": 2,
      "unit": "chapas",
      "unitPrice": 0
    }
  ]
}
```

### Editar orcamento
`PATCH /api/budgets/:id`

Campos aceitos:
- `category` (opcional, mas quando enviado precisa ser `arquitetonico` ou `executivo`)

### Listar orcamentos
`GET /api/budgets?category=arquitetonico`

Filtro opcional por categoria:
- `category=arquitetonico`
- `category=executivo`

## Requisitos de UI

1. Formulario de criacao/edicao de orcamento:
- Adicionar campo obrigatorio `Categoria do orcamento`.
- Tipo recomendado: `select` ou `radio group` com 2 opcoes:
  - Projeto arquitetonico -> valor `arquitetonico`
  - Projeto executivo -> valor `executivo`
- Se nenhum valor for selecionado, bloquear submit e mostrar mensagem amigavel.

2. Listagem de orcamentos:
- Exibir badge/coluna com a categoria do orcamento.
- Adicionar filtro por categoria no topo da listagem.
- Ao filtrar, enviar `category` na query string de `GET /api/budgets`.

3. Detalhe do orcamento:
- Exibir categoria no cabecalho ou bloco principal de informacoes.

## Mapeamento de labels

- `arquitetonico` -> "Projeto arquitetonico"
- `executivo` -> "Projeto executivo"

Importante:
- Persistir sempre o valor tecnico (`arquitetonico`/`executivo`) no payload.
- Usar labels amigaveis apenas para exibicao.

## Tratamento de erro

Se API retornar erro de validacao para `category`:
- Exibir mensagem proxima ao campo.
- Nao limpar os demais campos do formulario.

## Criterios de aceite

1. Nao e possivel criar orcamento sem categoria.
2. E possivel criar com `arquitetonico` e com `executivo`.
3. A categoria aparece corretamente na listagem e no detalhe.
4. O filtro por categoria funciona e atualiza os resultados.
5. Edicao de orcamento permite alterar categoria.
