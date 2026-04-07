# Prompt frontend: fechamento mensal na aba Logistica

Contexto:
- Frontend em Vite.
- Backend em Express + TypeScript com JWT.
- A aba de Logistica exibe os cards:
  - Custo Geral Ativo
  - Receita Vinculada
  - Lucro Liquido
  - Lucro Bruto
  - Custos Aplicados (Pre-aprovados)

Objetivo:
- Criar um botao "Fechamento Mensal" na aba de Logistica.
- Ao clicar, salvar os 5 valores atuais dos cards em uma tabela de fechamento mensal no backend.
- Permitir listar fechamentos ja salvos por mes.

Base URL:
- `${VITE_API_URL}/api`

Headers:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Endpoints exigem `admin` ou `gerente`.

## Endpoints backend

### 1) Criar/atualizar fechamento mensal
POST `/api/logistics/fechamentos`

Body:
```
{
  "referenceMonth": "2026-04",
  "custoGeralAtivo": 15000,
  "receitaVinculada": 24000,
  "lucroLiquido": 6200,
  "lucroBruto": 9000,
  "custosAplicadosPreAprovados": 1800
}
```

Regras:
- `referenceMonth` no formato `YYYY-MM`.
- Se o mes ja existir, o backend atualiza os valores (upsert).

Resposta:
```
{
  "data": {
    "id": "string",
    "referenceMonth": "2026-04",
    "custoGeralAtivo": 15000,
    "receitaVinculada": 24000,
    "lucroLiquido": 6200,
    "lucroBruto": 9000,
    "custosAplicadosPreAprovados": 1800,
    "createdAt": "ISO",
    "updatedAt": "ISO"
  }
}
```

### 2) Listar fechamentos
GET `/api/logistics/fechamentos`
GET `/api/logistics/fechamentos?referenceMonth=2026-04`

Resposta:
```
{
  "data": [
    {
      "id": "string",
      "referenceMonth": "2026-04",
      "custoGeralAtivo": 15000,
      "receitaVinculada": 24000,
      "lucroLiquido": 6200,
      "lucroBruto": 9000,
      "custosAplicadosPreAprovados": 1800,
      "createdAt": "ISO",
      "updatedAt": "ISO"
    }
  ]
}
```

## Implementacao frontend sugerida

1. Botao na tela de Logistica
- Adicionar botao primario: `Fechamento Mensal`.
- Exibir ao lado dos filtros da tela (ex.: periodo/mes).

2. Seletor de mes de referencia
- Adicionar campo `Mes de referencia` (input month).
- Valor enviado no formato `YYYY-MM`.
- Default: mes atual.

3. Montagem do payload
- Ler os valores atualmente exibidos nos cards:
  - `custoGeralAtivo`
  - `receitaVinculada`
  - `lucroLiquido`
  - `lucroBruto`
  - `custosAplicadosPreAprovados`
- Enviar no POST junto com `referenceMonth`.

4. UX recomendada
- Confirm dialog antes de salvar:
  - "Deseja salvar o fechamento mensal de MM/AAAA?"
- Loading no botao durante request.
- Toast de sucesso:
  - "Fechamento mensal salvo com sucesso."
- Toast de erro com fallback:
  - "Nao foi possivel salvar o fechamento mensal."

5. Historico de fechamentos
- Criar tabela/lista abaixo dos cards com GET `/api/logistics/fechamentos`.
- Colunas sugeridas:
  - Mes
  - Custo Geral Ativo
  - Receita Vinculada
  - Lucro Liquido
  - Lucro Bruto
  - Custos Aplicados (Pre-aprovados)
  - Atualizado em
- Filtro por mes opcional usando `referenceMonth`.

## Tratamento de erros
- `400`: payload invalido (`referenceMonth` invalido, valores ausentes, negativos quando nao permitido).
- `401`: nao autenticado.
- `403`: sem permissao (`funcionario`).
- `500`: erro interno.

## Criterios de aceite
1. Usuario admin/gerente consegue salvar fechamento mensal pelo botao.
2. Mes repetido atualiza o fechamento existente (nao cria duplicado).
3. Historico lista os fechamentos ordenados por mes desc.
4. Frontend trata estados de loading, sucesso e erro.
5. Usuario sem permissao nao visualiza acao de fechamento mensal.
