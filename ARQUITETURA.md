# 🏗️ Documentação da Arquitetura - Sistema Estoque Inteligente

## Visão Geral

O Sistema Estoque Inteligente é uma aplicação **full-stack** moderna com separação clara entre frontend e backend, utilizando arquitetura em camadas.

```
┌─────────────────────────────────────────────────────────┐
│                    Cliente Web (Browser)                 │
│        HTML5 + CSS3 + JavaScript (Vanilla)              │
│              client/index.html + app.js                 │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP/JSON
                  ▼
┌─────────────────────────────────────────────────────────┐
│          Backend ASP.NET Core Minimal APIs             │
│              server/Program.cs (Port 5000)              │
│  ┌──────────────────────────────────────────────────┐  │
│  │    Controllers / Endpoints (REST API)           │  │
│  │  • GET /api/dashboard                           │  │
│  │  • GET/POST /api/products                       │  │
│  │  • GET/POST /api/movements                      │  │
│  │  • GET /api/history/{productId}                 │  │
│  │  • GET /api/ai/suggestions                      │  │
│  │  • GET /api/ai/predict/{productId}              │  │
│  └──────────────────────────────────────────────────┘  │
│                    ▲                                     │
│                    │ Entity Framework Core              │
│                    ▼                                     │
│  ┌──────────────────────────────────────────────────┐  │
│  │      DbContext (InventoryDbContext)             │  │
│  │   • Product (DbSet)                             │  │
│  │   • Movement (DbSet)                            │  │
│  └──────────────────────────────────────────────────┘  │
│                    ▲                                     │
│                    │ SQLite Provider                    │
│                    ▼                                     │
└─────────────────────────────────────────────────────────┘
                  │ File I/O
                  ▼
         📁 inventory.db (SQLite)
```

---

## 📦 Estrutura de Diretórios

```
TCC/
├── server/                      # Backend ASP.NET Core
│   ├── Program.cs              # Entry point, endpoints, DbContext
│   ├── InventoryApi.csproj     # Project file (.NET 7)
│   ├── Dockerfile              # Multi-stage Docker build
│   ├── inventory.db            # SQLite database (gerado em runtime)
│   └── bin/                    # Build output (compilado)
│
├── client/                      # Frontend Web
│   ├── index.html              # UI principal (6 abas)
│   ├── app.js                  # Lógica JavaScript (fetch APIs)
│   ├── styles.css              # Estilos CSS (minificado)
│   └── (servido por ASP.NET Core na rota raiz)
│
├── docker-compose.yml          # Orquestração de containers
├── README.md                   # Setup e instruções
├── GUIA_USUARIO.md             # Manual do usuário
├── GUIA_DESENVOLVIMENTO.md     # Extensão e desenvolvimento
├── ARQUITETURA.md              # Este arquivo
├── API_DOCUMENTATION.md        # Referência completa de APIs
├── TESTS_CURL.md               # Exemplos de teste via curl
└── Postman_Inventory_TCC_collection.json  # Collection Postman
```

---

## 🗄️ Modelo de Dados

### Entidade: Product
```csharp
class Product {
    int Id                 // PK, auto-increment
    string Name           // Identificação única do produto
    int Quantity          // Estoque atual
    int MinQuantity       // Nível crítico de reabastecimento
    bool IsActive         // Ativo/Inativo
    string Category       // Classificação (ex: Eletrônicos)
    decimal Price         // Valor unitário (R$)
}
```

**Índices:**
- PK: Id
- Constraint: Name deve ser único

### Entidade: Movement
```csharp
class Movement {
    int Id                    // PK, auto-increment
    int ProductId             // FK referenciando Product
    Product Product           // Navigation property
    int QuantityChange        // Magnitude (+entrada, -saída)
    string Type               // "IN" (entrada) ou "OUT" (saída)
    DateTime Timestamp        // Quando ocorreu
    string Operator           // Quem registrou
}
```

**Índices:**
- PK: Id
- FK: ProductId → Product.Id (cascade delete)

### Relacionamentos
```
Product (1) ──── (∞) Movement
  Id              ProductId
```

---

## 🔌 Endpoints REST

### Dashboard
```http
GET /api/dashboard
```
**Resposta:**
```json
{
  "totalProducts": 50,
  "critical": 5,
  "movementsToday": 12,
  "aiSuggestionsCount": 5
}
```

### Produtos
```http
GET /api/products?page=1&pageSize=20&search=termo&category=Eletrônicos
POST /api/products

GET /api/products/export?search=termo
GET /api/products/{id}
PUT /api/products/{id}
DELETE /api/products/{id}
```

### Movimentações
```http
GET /api/movements?page=1&pageSize=20&productId=1&from=2026-05-25&to=2026-06-01
POST /api/movements

GET /api/history/{productId}
```

### IA / Previsões
```http
GET /api/ai/suggestions
GET /api/ai/predict/{productId}
```

---

## 🔄 Fluxo de Dados

### 1️⃣ Carregamento Inicial
```
User abre http://localhost:5000
    ↓
Frontend carrega index.html + app.js + styles.css
    ↓
JavaScript inicializa (loadDashboard, loadProductsIntoTable, etc)
    ↓
fetch /api/dashboard, /api/products, /api/ai/suggestions
    ↓
Backend consulta SQLite via EF Core
    ↓
Respostas JSON populam as UIs
```

### 2️⃣ Cadastro de Produto
```
User preenche formCadastro e clica "Cadastrar"
    ↓
JavaScript event listener captura submit
    ↓
POST /api/products { name, category, price, quantity, minQuantity }
    ↓
Backend: DbContext.Products.Add(product) + SaveChanges()
    ↓
SQLite insere nova linha em Products table
    ↓
Response retorna { id, ... } ao frontend
    ↓
JavaScript recarrega tabela (loadProductsIntoTable)
```

### 3️⃣ Registrar Movimentação
```
User seleciona produto + tipo + quantidade
    ↓
POST /api/movements { productId, type, quantityChange, operator }
    ↓
Backend:
  1. DbContext.Movements.Add(movement)
  2. product = DbContext.Products.Find(productId)
  3. product.Quantity += quantityChange
  4. DbContext.SaveChanges()
    ↓
SQLite atualiza ambas tabelas (Movement + Product)
    ↓
Frontend recarrega dashboard + histórico
```

### 4️⃣ Paginação
```
User clica "Próximo →" em Consulta de Estoque
    ↓
productsPaginationState.page++
    ↓
fetch /api/products?page=2&pageSize=10
    ↓
Backend: Skip((page-1)*pageSize).Take(pageSize) + Count() total
    ↓
Response { total: 150, page: 2, pageSize: 10, items: [...] }
    ↓
Frontend renderiza nova página + atualiza controles
```

---

## 🏭 Stack Tecnológico

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| **Frontend** | HTML5 + CSS3 + JavaScript | ES6+ |
| **Backend** | ASP.NET Core | net7.0 |
| **ORM** | Entity Framework Core | 7.0.0 |
| **Banco** | SQLite | 3 |
| **Container** | Docker | - |
| **Runtime** | .NET 7 | - |

---

## 🚀 Performance & Escalabilidade

### Otimizações Implementadas
1. **Paginação:** Carrega dados em chunks (5, 10, 20, 50 itens)
2. **Índices:** PK/FK otimizados no SQLite
3. **Lazy Loading:** Navigation properties carregadas conforme necessário
4. **Cache:** Dashboard KPIs recalculados a cada reload (sem cache persistente)

### Limitações Atuais
- SQLite para ≤ 100k registros (considerar PostgreSQL para escala)
- Sem autenticação/autorização (ambiente de demonstração)
- Sem criptografia de dados em repouso
- Sem backup automático

### Melhorias Futuras
- Migrar para PostgreSQL + Elasticsearch
- Implementar autenticação OAuth2
- Adicionar cache distribuído (Redis)
- Implementar logs centralizados (Serilog)
- Adicionar monitoramento (Application Insights)

---

## 🔒 Segurança

### Status Atual
- ⚠️ Sem autenticação (endpoint aberto)
- ⚠️ Sem validação de entrada robusta
- ⚠️ Sem rate limiting
- ✅ SQL Injection protegido (via EF Core parameterized queries)

### Recomendações de Produção
1. Implementar JWT ou OAuth2
2. Adicionar validação com FluentValidation
3. Implementar Rate Limiting
4. Usar HTTPS (SSL/TLS)
5. Configurar CORS apropriadamente
6. Adicionar logging de auditoria

---

## 🧪 Testabilidade

### Testes Manuais
- Arquivo: `TESTS_CURL.md` com exemplos curl
- Collection: `Postman_Inventory_TCC_collection.json`

### Testes Automatizados (Recomendado)
```csharp
// xUnit + Moq example
[Fact]
public async Task GetProducts_WithPagination_ReturnsPagedResult()
{
    var controller = new ProductsController(dbContext);
    var result = await controller.GetProducts(page: 1, pageSize: 10);
    
    Assert.NotNull(result);
    Assert.Equal(10, result.Value.Items.Count);
}
```

---

## 📈 Algoritmo de IA

### Sugestões de Compra
```
Para cada produto P:
    Se P.Quantity < P.MinQuantity:
        suggestedPurchase = P.MinQuantity - P.Quantity
```

### Previsão de 30 Dias
```
outflows = Movimentos de saída dos últimos 30 dias
dailyAverage = outflows.Sum() / 30
recommendedOrder = dailyAverage * 30  // Estocar para 30 dias
```

---

## 🐳 Deploy com Docker

### Processo
```bash
1. Build backend (SDK stage)
   docker build -t inventory-api server/

2. Run with docker-compose
   docker compose up
   
   • Compila C# → DLL
   • Executa em runtime container
   • Expõe porta 5000
   • Persiste inventory.db em volume
```

### Volumes
```yaml
services:
  inventory:
    volumes:
      - ./server/inventory.db:/app/inventory.db  # Persistência
```

---

## 📝 Convenções de Código

### Nomeação
- **Classes:** PascalCase (Product, Movement, InventoryDbContext)
- **Métodos:** PascalCase (GetProducts, CreateMovement)
- **Variáveis:** camelCase (productId, movementList)
- **Constantes:** UPPER_SNAKE_CASE (DATABASE_PATH)

### JavaScript
- **Funções:** camelCase (loadDashboard, renderProductsPaginationControls)
- **DOM IDs:** kebab-case (kpi-total-products, pagination-estoque)
- **Estado:** camelCase objects (productsPaginationState)

---

## 🔗 Relacionamentos com Frontend

```
index.html (estrutura)
    ├── formCadastro → app.js formCadastro.addEventListener
    ├── tabelaEstoque → app.js loadProductsIntoTable()
    ├── paginationEstoque → app.js renderProductsPaginationControls()
    ├── tabelaHistorico → app.js loadMovementsIntoHistory()
    └── paginationHistorico → app.js renderMovementsPaginationControls()

app.js (lógica)
    ├── fetch /api/dashboard
    ├── fetch /api/products?page=X&pageSize=Y
    ├── fetch /api/movements?page=X&pageSize=Y
    ├── fetch /api/history/{productId}
    ├── fetch /api/ai/suggestions
    └── POST /api/movements (registra movimento)

Program.cs (endpoints)
    ├── GET /api/dashboard → KPIs
    ├── GET /api/products → lista paginada
    ├── POST /api/products → cria produto
    ├── GET /api/movements → lista paginada
    ├── POST /api/movements → registra + atualiza product.Quantity
    └── GET /api/ai/predict/{id} → cálculo de previsão
```

---

## 📞 Contato para Dúvidas Técnicas

Consulte:
- `API_DOCUMENTATION.md` — Referência de endpoints
- `GUIA_DESENVOLVIMENTO.md` — Como estender o sistema
- `TESTS_CURL.md` — Exemplos práticos

---

**Versão:** 1.0  
**Data:** Junho 2026  
**Status:** Projeto Concluído
