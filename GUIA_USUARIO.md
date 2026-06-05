# 📘 Guia do Usuário - Sistema Estoque Inteligente

## Introdução

O **Sistema Estoque Inteligente** é uma aplicação web para gerenciar inventário com previsões de demanda baseadas em inteligência artificial. Permite cadastro de produtos, rastreamento de movimentações, visualização de histórico e análise preditiva.

---

## 🚀 Como Iniciar

### Pré-requisitos
- Docker + Docker Compose instalados (recomendado), OU
- .NET 7 SDK instalado (alternativa)

### Opção 1: Docker (Recomendado)
```bash
cd caminho/para/TCC
docker compose up --build
```
Abra http://localhost:5000 no navegador.

### Opção 2: .NET SDK
```bash
cd caminho/para/TCC/server
dotnet restore
dotnet run --urls "http://localhost:5000"
```
Acesse http://localhost:5000.

### Acesso inicial
Use o administrador padrão para a demonstração:

| Campo | Valor |
|-------|-------|
| Usuário | `admin` |
| Senha | `admin123` |

O administrador pode criar novos usuários. Usuários do perfil **Operador** recebem uma senha inicial e, no primeiro login, precisam alterar essa senha antes de acessar as demais telas.

---

## 📱 Interface Principal

A aplicação possui um menu lateral com as principais áreas do sistema. Algumas opções aparecem apenas para administradores.

### 0. **Login e Segurança**
- O usuário informa nome de usuário e senha.
- O backend valida a senha e retorna um token JWT.
- Esse token é usado automaticamente pelo sistema para autorizar as próximas ações.
- Se o usuário operador estiver no primeiro acesso, a tela de troca de senha é exibida antes do dashboard.

### Administração de Usuários
Disponível apenas para administradores.

**Funcionalidades:**
- Criar usuários administradores ou operadores
- Editar nome e perfil
- Ativar ou desativar usuários
- Redefinir senha de usuários
- Visualizar se um operador ainda está com "Troca pendente"

### 1. **Dashboard Inicial**
- Visão geral do estoque em tempo real
- **Total de Produtos Ativos:** quantidade de produtos disponíveis para operação
- **Produtos em Estoque Crítico:** itens abaixo ou iguais ao nível mínimo
- **Movimentações do Dia:** entradas e saídas registradas no dia
- **Valor Total do Estoque:** soma de quantidade vezes preço unitário
- **Produtos Inativos:** produtos desativados sem perda de histórico
- **Sugestões de Compra (IA):** quantidade de produtos com recomendação de reposição

### 2. **Cadastrar Produto**
Formulário para adicionar novos produtos ao sistema.

**Campos:**
- **Nome do Produto:** Identificação do item
- **Categoria:** Classificação (ex: Eletrônicos, Alimentos)
- **Preço Unitário:** Valor por unidade (R$)
- **Quantidade Inicial:** Estoque inicial
- **Nível Crítico:** Quantidade mínima (abaixo disso, alerta é acionado)

**Ação:** Clique em "Cadastrar Produto" para salvar.

Ao salvar, o sistema gera um identificador no formato `PRD-001` e um QR Code. Esse QR Code pode ser impresso e colocado na prateleira ou no próprio produto.

### 3. **Categorias**
Permite cadastrar, editar e excluir categorias usadas no cadastro e nos filtros de produtos.

Uma categoria em uso por produtos não deve ser excluída sem antes alterar os produtos vinculados.
Também é possível desativar uma categoria. Categorias inativas continuam disponíveis para filtros e relatórios, mas deixam de aparecer como opção principal para novos cadastros de produto.

### 4. **Consulta de Estoque**
Busca e visualização de produtos com filtros avançados.

**Funcionalidades:**
- **Busca por Nome:** Digite para filtrar produtos
- **Filtro por Categoria:** Selecione categoria específica
- **Filtro por Status:** Ativo/Inativo
- **Status de Nível:** Estável ou Crítico
- **Paginação:** Navegue entre páginas (5, 10, 20 ou 50 itens por página)
- **Exportar CSV:** Baixe relatório em formato Excel
- **QR Code:** Abra o QR Code do produto
- **Editar/Desativar/Reativar:** Ações rápidas de manutenção

**Colunas da Tabela:**
- Código QR
- Nome
- Categoria
- Quantidade disponível
- Preço Unitário
- Status de nível
- Situação

### 5. **Registrar Movimentação**
Registre entradas e saídas de produtos.

**Campos:**
- **Produto:** Selecione do dropdown
- **Tipo de Movimento:** Entrada (reabastecimento) ou Saída (venda/uso)
- **Quantidade:** Quantas unidades
- **Operador:** identificado automaticamente pelo login

**Ação:** Clique em "Registrar Movimento" para confirmar.

> **Nota:** A quantidade em estoque é atualizada automaticamente. O sistema impede saída maior do que o estoque disponível.

**Fluxo com QR Code físico:**
- O operador escaneia o QR Code usando a câmera nativa do celular.
- O QR Code abre o sistema no navegador.
- Se o operador ainda não estiver logado, o sistema mostra a tela de login.
- Após o login, o sistema abre diretamente a tela de movimentação com o produto selecionado.

### 6. **Histórico Detalhado**
Consulte histórico de todas as movimentações.

**Funcionalidades:**
- **Filtro por Produto:** Digite nome para filtrar
- **Filtro por Tipo:** Entrada/Saída
- **Filtro por Operador:** nome do usuário responsável
- **Filtro por Data:** data da movimentação
- **Paginação:** Navegue entre páginas
- **Exportar CSV:** gere relatório do histórico
- **Data/Hora:** Registro completo de quando ocorreu cada movimento

**Colunas:**
- Data e Hora
- Produto
- Tipo (Entrada/Saída - com badge colorido)
- Quantidade
- Operador

### 7. **Análise Preditiva IA**
Previsões baseadas em dados históricos de movimentação.

**Seções:**

#### **Sugestões de Compra**
- Lista de produtos críticos com recomendações de quantidade a comprar
- Baseado na previsão de saída diária, nível mínimo e horizonte selecionado

#### **Gráficos de Previsão**
- Visualização da demanda esperada por produto
- Dados de movimento histórico

#### **Saúde do Modelo**
- Exibe um indicador de confiança conforme o volume de histórico disponível.
- Produtos com pouco histórico usam média histórica simples.
- Produtos com dados suficientes usam regressão **ML.NET SDCA Regression**.

**Como Usar:**
1. Navegue até "Análise Preditiva IA"
2. Analise as sugestões de compra (quantidade recomendada)
3. Use os gráficos para entender tendências de consumo
4. Tome decisões de reabastecimento baseado em previsões

---

## 📊 Entendendo os Dados

### Status de Produto
- 🟢 **Ativo:** Produto disponível para movimentação
- 🔴 **Inativo:** Produto fora de operação (não removido, apenas desativado)
- 🟡 **Troca pendente:** usuário precisa alterar a senha inicial

### Badges de Movimento
- 🟢 **Entrada:** Reabastecimento (aumento de estoque)
- 🔴 **Saída:** Venda ou consumo (redução de estoque)

### Níveis Críticos
Quando a quantidade em estoque cai abaixo do "Nível Crítico":
- Um alerta aparece no Dashboard Inicial
- O produto é listado em "Sugestões de Compra" da IA
- Considere reabastecimento prioritário

---

## 💾 Exportar Dados

### CSV (Estoque)
1. Acesse "Consulta de Estoque"
2. Clique em **"Exportar CSV"**
3. O arquivo é baixado com colunas: ID, Nome, Categoria, Quantidade, Nível Mínimo, Preço, Status

Use em planilhas (Excel, Google Sheets) para análises customizadas.

---

## ⚙️ Dicas de Uso

- **Atualizar Dashboard:** Clique no tab "Dashboard Inicial" para recarregar dados
- **Filtros em Tempo Real:** Os filtros funcionam instantaneamente sem recarregar
- **Busca Sensível a Minúsculas:** Use qualquer case (maiúscula/minúscula)
- **Múltiplos Filtros:** Combine busca + categoria + status simultaneamente
- **Paginação:** Cada abreviação de página é independente (não sincroniza)

---

## 🆘 Troubleshooting

| Problema | Solução |
|----------|---------|
| Página em branco | Verifique se backend está rodando (docker compose ou dotnet run) |
| Login não entra | Verifique usuário/senha e se o usuário está ativo |
| Sistema pede troca de senha | Troque a senha inicial para liberar o acesso |
| Produtos não aparecem | Clique em "Consulta de Estoque" e aguarde carregamento |
| Movimentação não registra | Certifique-se de selecionar um produto válido |
| CSV não baixa | Desabilite bloqueadores de popup do navegador |
| Erro de conexão | Verifique se aplicação está em http://localhost:5000 |

---

## 📞 Suporte

Para problemas ou dúvidas:
1. Consulte a seção API_DOCUMENTATION.md para detalhes técnicos
2. Verifique os exemplos em TESTS_CURL.md
3. Teste endpoints com Postman (Postman_Inventory_TCC_collection.json)

---

**Versão:** 1.0  
**Data:** Junho 2026  
**Status:** Projeto Concluído
