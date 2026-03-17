# Prompt para implementar Equipes e Funcionarios no frontend

Contexto:
- Projeto frontend em Vite.
- Backend base URL configurada em VITE_API_URL.
- API existente no backend com os endpoints abaixo.
- Objetivo: criar duas abas novas no sistema: Funcionarios e Equipes.

Requisitos funcionais:
1. Aba Funcionarios
- Listar funcionarios cadastrados.
- Cadastrar funcionario.
- Editar funcionario.
- Excluir funcionario.

2. Aba Equipes
- Listar equipes cadastradas.
- Cadastrar equipe.
- Editar equipe.
- Excluir equipe.
- Montar equipe escolhendo funcionarios ja cadastrados.
- Permitir atualizar membros da equipe (adicionar/remover) com selecao multipla.

3. Integracao entre telas
- Ao abrir cadastro/edicao de equipe, carregar lista de funcionarios para selecao.
- Exibir no card/linha da equipe quantos membros ela tem e lista resumida dos nomes.

4. Producao vinculada a equipe
- Na tela de criacao de producao, o campo Equipe deve ser um select carregado de GET /api/teams.
- Ao salvar producao, enviar installationTeamId com o id da equipe selecionada.
- Para listar as producoes de um funcionario, chamar GET /api/productions?employeeId=:employeeId.

Endpoints backend:
- GET /api/employees
- GET /api/employees/:id
- POST /api/employees
- PATCH /api/employees/:id
- DELETE /api/employees/:id
- GET /api/teams
- GET /api/teams/:id
- POST /api/teams
- PATCH /api/teams/:id
- PUT /api/teams/:id/members
- DELETE /api/teams/:id
- GET /api/productions?employeeId=:employeeId
- POST /api/productions

Contrato de dados esperado:

Funcionario (response):
{
  "id": "string",
  "name": "string",
  "position": "string | null",
  "phone": "string | null",
  "email": "string | null",
  "isActive": true,
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}

Criar funcionario (POST /api/employees):
{
  "name": "string",
  "position": "string | null",
  "phone": "string | null",
  "email": "string | null",
  "isActive": true
}

Editar funcionario (PATCH /api/employees/:id):
{
  "name": "string opcional",
  "position": "string | null opcional",
  "phone": "string | null opcional",
  "email": "string | null opcional",
  "isActive": "boolean opcional"
}

Equipe (response):
{
  "id": "string",
  "name": "string",
  "description": "string | null",
  "createdAt": "ISO string",
  "updatedAt": "ISO string",
  "members": [
    {
      "employeeId": "string",
      "name": "string",
      "position": "string | null",
      "email": "string | null",
      "phone": "string | null",
      "isActive": true
    }
  ]
}

Criar equipe (POST /api/teams):
{
  "name": "string",
  "description": "string | null",
  "memberIds": ["employee-id-1", "employee-id-2"]
}

Editar equipe (PATCH /api/teams/:id):
{
  "name": "string opcional",
  "description": "string | null opcional"
}

Atualizar membros da equipe (PUT /api/teams/:id/members):
{
  "employeeIds": ["employee-id-1", "employee-id-2"]
}

Criar producao (POST /api/productions):
{
  "clientName": "string",
  "description": "string",
  "deliveryDate": "ISO string | null",
  "installationTeamId": "team-id",
  "initialCost": 0,
  "materials": [
    {
      "productId": "string opcional",
      "productName": "string",
      "quantity": 1,
      "unit": "string"
    }
  ]
}

Listar producoes por funcionario (GET /api/productions?employeeId=:employeeId):
- Retorna somente producoes vinculadas as equipes nas quais o funcionario e membro.

Requisitos tecnicos de frontend:
- Criar camada de API tipada (ex.: services/employees.ts e services/teams.ts).
- Tratar loading, erro e estado vazio nas duas abas.
- Se backend retornar erro 400/409, exibir mensagem amigavel.
- Evitar hardcode de URL: usar VITE_API_URL.
- Se VITE_API_URL nao existir, usar fallback /api.
- No formulario de producao, equipe deve ser select obrigatorio alimentado por GET /api/teams.
- Na tela de funcionario, incluir acao "Minhas producoes" usando GET /api/productions?employeeId=<id>.

Critérios de aceite:
1. Usuario consegue cadastrar funcionario e visualizar na listagem.
2. Usuario consegue cadastrar equipe e definir membros com funcionarios existentes.
3. Usuario consegue editar membros da equipe sem recarregar a pagina inteira.
4. Exclusao de funcionario remove vinculos nas equipes sem quebrar a tela.
5. Todas as chamadas usam os endpoints corretos e tratam erro de rede/API.
6. Criacao de producao envia installationTeamId valido.
7. Listagem por funcionario nao exibe producoes de equipes onde ele nao participa.
