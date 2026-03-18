# Prompt para persistir a aba Clientes no PostgreSQL (backend + frontend)

Contexto:
- Projeto frontend em Vite.
- Backend em Express + TypeScript com autenticacao JWT.
- A aba Clientes nao deve mais depender de estado local.
- Clientes da Mais Quiosque devem ser armazenados e gerenciados via API.

Objetivo:
- Implementar CRUD completo de clientes com persistencia no banco.
- Permitir listar, criar, editar e excluir cliente com dados completos.

Base URL:
- `${VITE_API_URL}/api`

Headers obrigatorios:
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

Permissoes:
- Rotas de clientes: somente `admin` e `gerente`.
- Em `403`, mostrar mensagem de acesso negado.

Endpoints de Clientes:

1. GET `/api/clients`
- Lista clientes.
- Filtros opcionais:
  - `search`: texto para buscar por nome, empresa, documento, email ou telefone.
  - `isActive`: `true` ou `false`.

Exemplo:
- `GET /api/clients?search=quiosque`
- `GET /api/clients?isActive=true`

2. GET `/api/clients/:id`
- Detalhe de um cliente.

3. POST `/api/clients`
- Cria cliente no banco.

Payload:
{
  "name": "string",
  "companyName": "string | null",
  "document": "string | null",
  "contactName": "string | null",
  "email": "string | null",
  "phone": "string | null",
  "secondaryPhone": "string | null",
  "street": "string | null",
  "number": "string | null",
  "complement": "string | null",
  "neighborhood": "string | null",
  "city": "string | null",
  "state": "string | null",
  "postalCode": "string | null",
  "notes": "string | null",
  "isActive": true,
  "metadata": {}
}

4. PATCH `/api/clients/:id`
- Atualiza qualquer subconjunto de campos do cliente.

5. DELETE `/api/clients/:id`
- Exclui cliente permanentemente.

Contrato de resposta (lista e detalhe):
{
  "data": {
    "id": "string",
    "name": "string",
    "companyName": "string | null",
    "document": "string | null",
    "contactName": "string | null",
    "email": "string | null",
    "phone": "string | null",
    "secondaryPhone": "string | null",
    "street": "string | null",
    "number": "string | null",
    "complement": "string | null",
    "neighborhood": "string | null",
    "city": "string | null",
    "state": "string | null",
    "postalCode": "string | null",
    "notes": "string | null",
    "isActive": true,
    "metadata": {},
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}

Implementacao frontend sugerida:

1. Servico
- Criar `services/clients.ts` com:
  - `listClients(filters?)`
  - `getClientById(id)`
  - `createClient(payload)`
  - `updateClient(id, payload)`
  - `deleteClient(id)`

2. Estado da aba Clientes
- Ao abrir tela: chamar `GET /api/clients`.
- Filtro de busca: chamar `GET /api/clients?search=...` (com debounce).
- Filtro de status: chamar `GET /api/clients?isActive=true|false`.

3. Formulario de cliente
- Incluir todos os campos de perfil e contato.
- Em modo criar: `POST /api/clients`.
- Em modo editar: `PATCH /api/clients/:id`.
- Validar nome obrigatorio e email valido (quando preenchido).

4. Exclusao
- Exibir confirmacao antes de excluir.
- Chamar `DELETE /api/clients/:id`.
- Ao sucesso, remover da lista local ou recarregar dados.

5. Tratamento de erros
- `401`: redirecionar para login.
- `403`: mostrar acesso negado.
- `404`: cliente nao encontrado.
- `409`: email ou documento ja em uso.
- `400`: erro de validacao.
- `500`: fallback com botao de tentar novamente.

Criterios de aceite:
1. Cliente criado aparece na lista apos refresh.
2. Edicao de cliente persiste e aparece na tela de detalhe/lista.
3. Exclusao remove cliente da lista apos refresh.
4. Busca e filtro por status ativo funcionam via API.
5. IDs de clientes sao sempre do backend.
6. Aba clientes funciona sem dados mockados em estado local.
