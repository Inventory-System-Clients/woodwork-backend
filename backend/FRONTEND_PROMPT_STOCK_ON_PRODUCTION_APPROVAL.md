# Prompt para atualizar frontend com baixa de estoque na aprovacao de orcamento/producao

Contexto:
- Projeto frontend em Vite.
- Backend protegido com Bearer Token JWT.
- O backend agora baixa estoque automaticamente ao aprovar/concluir a producao.
- A aprovacao/conclusao acontece no endpoint `PATCH /api/productions/:id/complete`.

Objetivo:
- Garantir UX correta quando a aprovacao falhar por estoque insuficiente.
- Atualizar UI de produtos/estoque e lista de producoes apos aprovacao com sucesso.

Endpoint impactado:
- `PATCH /api/productions/:id/complete`
- Headers obrigatorios:
  - `Authorization: Bearer <token>`

Novo comportamento backend:
- Quando a producao muda para `delivered`:
  - Desconta `materials[].quantity` do `products.stock_quantity`.
  - Cria movimentacao de saida em `product_stock_movements` para cada material.
- Operacao e transacional e idempotente:
  - Se ja estava `delivered`, nao desconta novamente.

Tratamento de erros esperado no frontend:

1. HTTP 409 (estoque insuficiente)
- Exibir toast/modal de erro:
  - Mensagem padrao: `Estoque insuficiente para concluir a producao`.
- Ler `response.details` quando existir:
  - `productId`
  - `productName`
  - `requestedQuantity`
  - `availableStock`
- Exemplo de mensagem detalhada:
  - `Produto MDF 15mm (id: prod-123): solicitado 8, disponivel 3`.

2. HTTP 400 (material sem productId ou produto inexistente)
- Exibir erro de dados inconsistentes do orcamento/producao.
- Sugerir acao ao usuario: revisar materiais vinculados ao produto.

3. HTTP 500 (migracao de estoque nao aplicada)
- Exibir fallback amigavel:
  - `Configuracao de estoque do servidor nao aplicada. Contate o suporte.`

Implementacao frontend sugerida:
1. Servico
- Atualizar funcao de conclusao/aprovacao de producao para mapear erros 400/409/500.

2. Tela de producoes
- Ao sucesso:
  - Atualizar status da producao para `delivered`.
  - Revalidar/refetch da lista de producoes.
  - Revalidar/refetch de estoque/produtos (se houver widget/tabela de estoque na mesma tela).

3. UX
- Desabilitar botao `Aprovar/Concluir` enquanto a requisicao estiver em andamento.
- Em 409, manter modal de aprovacao aberto e mostrar mensagem detalhada.
- Em sucesso, fechar modal e mostrar toast de sucesso.

Criterios de aceite frontend:
1. Aprovar/concluir producao com estoque suficiente retorna sucesso e atualiza UI.
2. Estoque insuficiente (409) mostra mensagem detalhada por produto.
3. Erros 400 e 500 possuem feedback claro e acionavel.
4. A interface nao dispara aprovacao duplicada por clique repetido.
