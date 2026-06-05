# Roteiro de Apresentação do TCC

## 1. Abertura

Este trabalho apresenta um Sistema Inteligente de Estoque com Análise Preditiva. A proposta é resolver problemas comuns no controle de estoque, como falta de rastreabilidade, dificuldade para identificar produtos críticos e ausência de apoio à decisão para reposição.

O sistema foi desenvolvido como uma aplicação web, com backend em ASP.NET Core, banco SQLite, frontend em HTML/CSS/JavaScript e um módulo de previsão usando ML.NET.

## 2. Problema

Em muitos ambientes, o estoque ainda é controlado por planilhas ou registros manuais. Isso pode gerar:

- divergência entre quantidade registrada e quantidade real;
- dificuldade para saber quem movimentou determinado produto;
- atraso na identificação de produtos em nível crítico;
- compras feitas de forma reativa, somente depois que o item já está acabando;
- falta de histórico para tomada de decisão.

## 3. Solução Proposta

O sistema centraliza o controle de produtos, usuários e movimentações. Cada produto possui categoria, preço, estoque atual, nível crítico e um identificador QR.

Quando ocorre uma entrada ou saída, o sistema atualiza o estoque automaticamente e grava a movimentação no histórico com data, tipo, quantidade e operador responsável.

Além do controle operacional, o sistema possui um dashboard e um módulo de análise preditiva. Esse módulo usa o histórico de saídas para estimar demanda futura e sugerir quantidade de compra.

## 4. Fluxo Principal do Sistema

1. O usuário acessa a aplicação e faz login.
2. O backend valida as credenciais e gera um token JWT.
3. O frontend usa esse token para acessar as rotas protegidas.
4. O administrador pode criar e administrar usuários.
5. O operador pode administrar categorias, produtos, estoque e movimentações.
6. Toda saída ou entrada atualiza o estoque e alimenta o histórico.
7. O dashboard consolida os principais indicadores.
8. A IA usa o histórico para sugerir reposição.

## 5. Segurança

O sistema usa autenticação JWT. Isso significa que, após o login, o usuário recebe um token assinado pelo backend.

As rotas protegidas só respondem se esse token for enviado. Além disso, existem perfis de acesso:

- Administrador: gerencia usuários e também pode operar o estoque.
- Operador: executa as rotinas operacionais de estoque, incluindo categorias, produtos e movimentações.

As senhas são armazenadas com hash PBKDF2 e salt. Usuários operadores criados pelo administrador precisam trocar a senha inicial no primeiro acesso.

Para ambiente de produção, o backend exige a variável `INVENTORY_JWT_SECRET`. Assim, a aplicação não sobe em produção usando uma chave padrão de desenvolvimento.

Também existe auditoria administrativa: logins, alterações de usuários, produtos, categorias, movimentações, simulações da IA e downloads de backup ficam registrados com data, usuário e detalhes da ação.

## 6. Dashboard

O dashboard mostra a situação atual do estoque:

- total de produtos ativos;
- produtos em nível crítico;
- movimentações do dia;
- valor total do estoque;
- produtos inativos;
- sugestões de compra.

Ele também apresenta listas de produtos críticos, últimas movimentações e categorias com maior atenção.

## 7. Cadastro e QR Code

No cadastro de produto, o usuário informa nome, categoria, preço, estoque inicial e nível crítico.

Após salvar, o sistema gera um código identificador, como `PRD-001`, e um QR Code. Esse QR Code facilita a consulta rápida do produto, simulando um cenário real de estoque com leitura por etiqueta.

Na operação física, esse QR Code pode ficar impresso na prateleira ou no próprio produto. O operador escaneia usando a câmera nativa do celular. O link abre o sistema, solicita login se necessário e direciona automaticamente para a tela de movimentação com o produto selecionado.

## 8. Movimentações

As movimentações são divididas em:

- Entrada: aumenta a quantidade em estoque.
- Saída: reduz a quantidade em estoque.

O sistema impede uma saída maior do que o estoque disponível. Isso evita estoque negativo e aumenta a confiabilidade dos dados.

O operador responsável é obtido pelo login, não digitado manualmente. Isso melhora a rastreabilidade.

## 9. Histórico e Auditoria

O histórico permite consultar todas as movimentações realizadas. É possível filtrar por produto, tipo, operador e data.

Além do histórico operacional, o administrador possui uma área de auditoria e backup. Nela é possível consultar os eventos recentes do sistema, baixar o arquivo completo do banco SQLite e exportar os dados em JSON.

Essa parte é importante porque permite responder perguntas como:

- Quem realizou determinada saída?
- Quando um produto entrou em nível crítico?
- Quantas unidades saíram em determinado período?
- Qual produto teve maior movimentação?

## 10. Análise Preditiva

O módulo de IA analisa as saídas históricas dos produtos.

Quando o produto possui pouco histórico, o sistema usa média histórica simples. Quando há dados suficientes, o sistema usa regressão com ML.NET SDCA Regression.

A previsão estima uma saída diária esperada e, com base no horizonte escolhido, calcula uma recomendação de compra considerando:

```text
demanda prevista no período + nível mínimo - estoque atual
```

O objetivo não é substituir o gestor, mas apoiar a decisão com dados.

## 11. Demonstração Sugerida

1. Fazer login como administrador.
2. Mostrar o dashboard inicial.
3. Criar ou editar uma categoria.
4. Cadastrar um produto com nível crítico.
5. Mostrar o QR Code gerado.
6. Escanear o QR Code pela câmera nativa do celular e registrar uma saída com o produto já selecionado.
7. Mostrar que o estoque foi atualizado.
8. Abrir o histórico e destacar o operador autenticado.
9. Abrir a área administrativa e mostrar os logs de auditoria e os botões de backup.
10. Mostrar a análise preditiva e a recomendação de compra.
11. Criar um operador, demonstrar a troca obrigatória de senha no primeiro login e mostrar que ele não acessa administração de usuários.

## 12. Conclusão

O sistema atende ao objetivo do TCC ao unir controle de estoque, segurança de acesso, rastreabilidade, geração de QR Code e apoio à decisão com análise preditiva.

Como evolução futura, o projeto pode receber banco PostgreSQL, testes automatizados mais amplos, deploy em nuvem e relatórios gerenciais mais avançados.
