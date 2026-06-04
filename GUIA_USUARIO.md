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

---

## 📱 Interface Principal

A aplicação possui um menu lateral com 6 abas principais:

### 1. **Dashboard Inicial**
- Visão geral do estoque em tempo real
- **KPI Total de Produtos:** Total de produtos cadastrados
- **KPI Produtos Críticos:** Produtos abaixo do nível mínimo
- **KPI Movimentações Hoje:** Quantidade de movimentos registrados
- **KPI Sugestões IA:** Produtos que precisam ser reabastecidos

### 2. **Cadastrar Produto**
Formulário para adicionar novos produtos ao sistema.

**Campos:**
- **Nome do Produto:** Identificação do item
- **Categoria:** Classificação (ex: Eletrônicos, Alimentos)
- **Preço Unitário:** Valor por unidade (R$)
- **Quantidade Inicial:** Estoque inicial
- **Nível Crítico:** Quantidade mínima (abaixo disso, alerta é acionado)

**Ação:** Clique em "Cadastrar Produto" para salvar.

### 3. **Consulta de Estoque**
Busca e visualização de produtos com filtros avançados.

**Funcionalidades:**
- **Busca por Nome:** Digite para filtrar produtos
- **Filtro por Categoria:** Selecione categoria específica
- **Filtro por Status:** Ativo/Inativo
- **Paginação:** Navegue entre páginas (5, 10, 20 ou 50 itens por página)
- **Exportar CSV:** Baixe relatório em formato Excel

**Colunas da Tabela:**
- ID do produto
- Nome
- Categoria
- Quantidade
- Nível Mínimo
- Preço Unitário
- Status (Ativo/Inativo)

### 4. **Registrar Movimentação**
Registre entradas e saídas de produtos.

**Campos:**
- **Produto:** Selecione do dropdown
- **Tipo de Movimento:** Entrada (reabastecimento) ou Saída (venda/uso)
- **Quantidade:** Quantas unidades
- **Operador:** Seu nome/ID

**Ação:** Clique em "Registrar Movimento" para confirmar.

> **Nota:** A quantidade em estoque é atualizada automaticamente.

### 5. **Histórico Detalhado**
Consulte histórico de todas as movimentações.

**Funcionalidades:**
- **Filtro por Produto:** Digite nome para filtrar
- **Filtro por Tipo:** Entrada/Saída
- **Paginação:** Navegue entre páginas
- **Data/Hora:** Registro completo de quando ocorreu cada movimento

**Colunas:**
- Data e Hora
- Produto
- Tipo (Entrada/Saída - com badge colorido)
- Quantidade
- Operador

### 6. **Análise Preditiva IA**
Previsões baseadas em dados históricos de movimentação.

**Seções:**

#### **Sugestões de Compra**
- Lista de produtos críticos com recomendações de quantidade a comprar
- Baseado em média de consumo dos últimos 30 dias

#### **Gráficos de Previsão**
- Visualização da demanda esperada por produto
- Dados de movimento histórico

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
