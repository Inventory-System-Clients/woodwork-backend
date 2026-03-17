# Prompt para implementar Login, Roles, Equipes, Funcionarios e Producoes por Equipe no frontend

Contexto:
- Projeto frontend em Vite.
- Backend base URL configurada em VITE_API_URL.
- Objetivo: implementar autenticacao por email/senha e controle de acesso por role.
- Roles do sistema: admin, gerente, funcionario.

Regras de permissao:
1. Admin e Gerente
- Mesmas permissoes.
- Podem cadastrar/editar/excluir funcionarios.
- Podem cadastrar/editar/excluir equipes e membros.
- Podem criar producoes e concluir producoes.
- Podem acessar todos os modulos do painel.

2. Funcionario
- Nao pode criar producoes.
- Nao pode ver receita mensal.
- Nao pode ver clientes.
- Nao pode ver funcionarios.
- Nao pode ver orcamentos.
- Pode apenas ver producoes da equipe em que participa.

Endpoints backend para autenticacao:
- POST /api/auth/login
- GET /api/auth/me

Endpoints backend para dominio:
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
- GET /api/productions
- GET /api/productions?employeeId=:employeeId
- POST /api/productions
- PATCH /api/productions/:id/complete

Contrato de autenticacao:

Login request (POST /api/auth/login):
{
  "email": "string",
  "password": "string"
}

Login response:
{
  "data": {
    "token": "jwt",
    "user": {
      "id": "string",
      "name": "string",
      "email": "string",
      "role": "admin | gerente | funcionario"
    }
  }
}

Me response (GET /api/auth/me):
{
  "data": {
    "id": "string",
    "name": "string",
    "email": "string",
    "role": "admin | gerente | funcionario"
  }
}

Funcionario (response):
{
  "id": "string",
  "name": "string",
  "position": "string | null",
  "phone": "string | null",
  "email": "string",
  "role": "admin | gerente | funcionario",
  "isActive": true,
  "createdAt": "ISO string",
  "updatedAt": "ISO string"
}

Criar funcionario (POST /api/employees):
{
  "name": "string",
  "position": "string | null",
  "phone": "string | null",
  "email": "string",
  "password": "string (min 6)",
  "role": "admin | gerente | funcionario",
  "isActive": true
}

Editar funcionario (PATCH /api/employees/:id):
{
  "name": "string opcional",
  "position": "string | null opcional",
  "phone": "string | null opcional",
  "email": "string opcional",
  "password": "string opcional",
  "role": "admin | gerente | funcionario opcional",
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

Regras de producao por perfil:
- Admin/gerente: podem listar todas as producoes (GET /api/productions) e filtrar por funcionario com ?employeeId.
- Funcionario: backend ja devolve somente producoes da equipe dele em GET /api/productions; frontend nao deve exibir filtro global para funcionario.

Requisitos tecnicos de frontend:
- Criar modulo de autenticacao com contexto global (AuthProvider ou store).
- Salvar token JWT (preferencia: memory + refresh via login; alternativa: localStorage).
- Enviar Authorization: Bearer <token> em todas as chamadas autenticadas.
- Na inicializacao do app, chamar GET /api/auth/me para restaurar sessao.
- Criar guardas de rota por role.
- Montar menu dinamico por role:
  - admin/gerente: menu completo.
  - funcionario: esconder receita mensal, clientes, funcionarios, orcamentos e criacao de producao.
- No formulario de producao, equipe deve ser select obrigatorio alimentado por GET /api/teams.
- Tratar 401 redirecionando para login.
- Tratar 403 exibindo mensagem de acesso negado.

Critérios de aceite:
1. Usuario autentica com email/senha e recebe token.
2. Sessao persiste durante a navegacao e pode ser restaurada por /api/auth/me.
3. Admin e gerente possuem as mesmas telas e permissoes.
4. Funcionario nao ve modulos restritos (receita mensal, clientes, funcionarios, orcamentos).
5. Funcionario nao consegue criar producao.
6. Funcionario ve apenas producoes da propria equipe.
7. Formulario de producao usa select de equipe e envia installationTeamId valido.
