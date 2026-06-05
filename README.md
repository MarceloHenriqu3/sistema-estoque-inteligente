# Sistema Inteligente de Estoque com Analise Preditiva

Projeto de TCC desenvolvido para demonstrar um sistema web de controle de estoque com autenticação, rastreabilidade de movimentações, geração de QR Code e apoio à decisão por análise preditiva.

## Objetivo do Projeto

O sistema resolve um problema comum em pequenos e médios estoques: a falta de visibilidade sobre quantidade disponível, produtos críticos, histórico de entrada e saída e necessidade futura de reposição.

Na apresentação, a ideia central pode ser explicada assim:

> Este projeto centraliza o controle de estoque em uma aplicação web. Cada produto possui quantidade atual, nível crítico, categoria, preço e identificador QR. Toda entrada ou saída gera um registro histórico com operador autenticado. A partir desses dados, o sistema calcula indicadores no dashboard e usa ML.NET para estimar demanda futura, sugerindo compras antes que o estoque chegue a um ponto de ruptura.

## Tecnologias Utilizadas

- Backend: ASP.NET Core 7 Minimal API
- Banco de dados: SQLite com Entity Framework Core
- Inteligência artificial: ML.NET com regressão SDCA
- Frontend: HTML, CSS e JavaScript puro
- Segurança: autenticação por JWT, controle de acesso por perfil, auditoria e backup
- Documentação/testes: Swagger, Postman e exemplos curl

## Como Executar

Requer .NET 7 SDK instalado.

```powershell
cd "c:\Users\marce\OneDrive\Desktop\Faculdade\TCC_project_COMPLETO\server"
dotnet restore
dotnet run --urls "http://localhost:5000"
```

Acesse no navegador:

```text
http://localhost:5000
```

Tambem funciona em outra porta, por exemplo:

```powershell
dotnet run --urls "http://localhost:5123"
```

## Login Inicial

Usuario administrador padrão para demonstração:

```text
Usuario: admin
Senha: admin123
```

O administrador pode criar novos usuários. Usuários operadores criados pelo admin devem trocar a senha no primeiro login antes de acessar o restante do sistema.

## Principais Funcionalidades

- Login seguro com token JWT
- Perfis de usuário: Administrador e Operador
- Criação e gerenciamento de usuários
- Cadastro de produtos com categoria, preço, estoque inicial e nível crítico
- Consulta de estoque com filtros, paginação e exportação CSV
- Ativação/desativação de produtos sem perder histórico
- Registro de entradas e saídas com validação de estoque
- Histórico detalhado por produto, operador, data e tipo de movimentação
- Logs de auditoria para login, usuários, produtos, categorias, movimentações, IA e backup
- Backup completo do banco SQLite e exportação JSON pelo painel administrativo
- Dashboard com KPIs operacionais
- QR Code por produto para consulta rápida
- Análise preditiva com sugestão de compra

## Funcionamento Para Explicar na Apresentação

1. O usuário faz login e recebe um token JWT.
2. O frontend envia esse token em cada chamada protegida da API.
3. O backend valida o token e identifica o perfil do usuário.
4. O administrador gerencia usuários.
5. O operador acessa as rotinas de estoque, incluindo categorias, produtos, histórico e movimentações.
6. Cada movimentação atualiza o estoque e grava um histórico auditável.
7. O dashboard resume produtos ativos, itens críticos, valor total e movimentações.
8. O módulo de IA analisa saídas históricas e estima a demanda futura.
9. Com base na previsão, o sistema recomenda quantidades de compra.
10. O administrador pode consultar auditoria e exportar uma cópia completa do banco.

## Documentação

- `GUIA_USUARIO.md`: manual de uso da aplicação
- `ARQUITETURA.md`: explicação técnica do sistema
- `API_DOCUMENTATION.md`: referência dos endpoints REST
- `GUIA_DESENVOLVIMENTO.md`: instruções para manutenção e evolução
- `TESTS_CURL.md`: exemplos de testes via terminal

## Testes Automatizados

Os testes básicos de integração ficam em `server.Tests` e validam login, autorização, acesso ao dashboard, permissões do operador e regra de estoque insuficiente.

```powershell
dotnet test server.Tests\InventoryApi.Tests.csproj
```

## Observações de Segurança

O sistema usa JWT para autenticação e autorização. Em produção, a chave JWT deve ser definida por variável de ambiente:

```powershell
$env:INVENTORY_JWT_SECRET="uma-chave-grande-e-segura"
```

Para TCC e demonstração local, existe uma chave padrão de desenvolvimento no backend.

Se a aplicação for iniciada em ambiente `Production` sem `INVENTORY_JWT_SECRET`, o backend bloqueia a inicialização para evitar uso de chave fraca em produção.

## Status

Projeto em versão de demonstração acadêmica, adequado para apresentação de TCC e evolução futura.
