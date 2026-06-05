# 🛠️ Guia de Desenvolvimento - Extensão & Manutenção

## Bem-vindo, Desenvolvedor!

Este guia orienta como estender, manter e debugar o Sistema Estoque Inteligente.

---

## 🚀 Setup Local

### Pré-requisitos
- **.NET 7 SDK** ([download](https://dotnet.microsoft.com/download/dotnet/7.0))
- **Docker + Docker Compose** (opcional, mas recomendado)
- **Git** para versionamento
- **Visual Studio Code** ou **Visual Studio 2022+**
- **Postman** ou **REST Client** (para testar APIs)

### Instalação

#### Opção 1: Com Docker (Recomendado)
```bash
cd caminho/para/TCC
docker compose up --build
# Aplicação roda em http://localhost:5000
# Backend em http://localhost:5000/api
```

#### Opção 2: .NET CLI
```bash
cd server
dotnet restore
dotnet run --urls "http://localhost:5000"
```

#### Opção 3: Visual Studio
```
1. Abrir InventoryApi.csproj
2. F5 (Debug) ou Ctrl+F5 (Release)
3. Aplicação abre automaticamente
```

---

## 📁 Estrutura Detalhada de Arquivos

### Backend

#### `server/Program.cs`
**O arquivo principal — todos os endpoints e lógica estão aqui.**

```csharp
// Configuração inicial
var builder = WebApplication.CreateBuilder(args);

// DbContext (SQLite)
builder.Services.AddDbContext<InventoryDbContext>(options =>
    options.UseSqlite("Data Source=inventory.db"));

// Endpoints REST
app.MapGet("/api/dashboard", ...).Produces<DashboardDto>();
app.MapGet("/api/products", ...).Produces<PagedResult<ProductDto>>();
app.MapPost("/api/products", ...).Accepts<CreateProductDto>();
// ... outros endpoints
```

**Estrutura:**
1. **Configuração** (DbContext, CORS, JWT, Authorization e Swagger)
2. **Modelos** (class Product, Movement, User e ProductCategory)
3. **DTOs** (Data Transfer Objects)
4. **Seed Data** (dados iniciais)
5. **Endpoints** (GET, POST, PUT, DELETE)

#### `server/InventoryApi.csproj`
**Arquivo de projeto .NET**

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net7.0</TargetFramework>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Authentication.JwtBearer" Version="7.0.20" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Sqlite" Version="7.0.0" />
    <PackageReference Include="Microsoft.ML" Version="6.0.0-preview.26160.2" />
    <!-- Adicione novos pacotes NuGet aqui -->
  </ItemGroup>
</Project>
```

**Como adicionar pacotes:**
```bash
cd server
dotnet add package NomeDoPacote
# Ou editar .csproj e executar: dotnet restore
```

#### `server/inventory.db`
**SQLite database (gerado em runtime)**

**Para limpar e começar do zero:**
```bash
rm server/inventory.db
# Ou em PowerShell:
Remove-Item server/inventory.db -Force
# Reinicie a aplicação (SeedData será executado novamente)
```

### Frontend

#### `client/index.html`
**Estrutura HTML da aplicação**

```html
<!-- Sidebar -->
<nav class="sidebar">
  <button onclick="switchTab('tab-dashboard')">Dashboard</button>
  <!-- ... outros botões -->
</nav>

<!-- Tabs (Abas) -->
<div id="tab-dashboard" class="tab-content active">
  <!-- KPI Cards -->
  <div id="kpi-total-products" class="kpi-card">...</div>
  <!-- ... -->
</div>
```

**Como adicionar uma nova aba:**
1. Adicione novo `<button>` no sidebar
2. Crie novo `<div class="tab-content" id="tab-novo">`
3. Implemente `switchTab('tab-novo')` em JavaScript

#### `client/app.js`
**Lógica JavaScript — interface com backend**

```javascript
// Estado (paginação)
let productsPaginationState = { page: 1, pageSize: 10, total: 0 };

// Funções principais
async function loadDashboard() { ... }
async function loadProductsIntoTable() { ... }
function renderProductsPaginationControls() { ... }

// Event listeners
document.getElementById('formCadastro').addEventListener('submit', async (e) => { ... });
```

**Padrões:**
- Usar `async/await` para chamadas HTTP
- Estado em variáveis globais (ou considerar um manager)
- Event listeners com `addEventListener`
- Tratamento de erros com try-catch

#### `client/styles.css`
**Estilos CSS (minificado)**

```css
:root {
  --primary: #2563eb;
  --background: #0f172a;
  /* ... cores */
}

.sidebar { /* ... */ }
.tab-content { /* ... */ }
.kpi-card { /* ... */ }
```

**Como customizar:**
- Editar variáveis CSS (`:root`)
- Adicionar novas classes conforme necessário
- Manter consistência com design existente

---

## 🔧 Tarefas Comuns de Desenvolvimento

### Adicionar Novo Endpoint

#### Passo 1: Criar DTO (se necessário)
```csharp
// Em Program.cs, antes dos endpoints
class GetProductStockReportDto {
    public int ProductId { get; set; }
    public string ProductName { get; set; }
    public int CurrentStock { get; set; }
    public decimal TotalValue { get; set; }
}
```

#### Passo 2: Implementar Endpoint
```csharp
app.MapGet("/api/products/{id}/stock-report", async (int id, InventoryDbContext db) => {
    var product = await db.Products.FindAsync(id);
    if (product == null) return Results.NotFound();
    
    var report = new GetProductStockReportDto {
        ProductId = product.Id,
        ProductName = product.Name,
        CurrentStock = product.Quantity,
        TotalValue = product.Quantity * product.Price
    };
    
    return Results.Ok(report);
}).RequireAuthorization("PasswordReady");
```

#### Passo 3: Testar com Postman ou curl
```bash
curl http://localhost:5000/api/products/1/stock-report \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

#### Passo 4: Conectar ao Frontend
```javascript
// Em app.js
async function loadStockReport(productId) {
    const res = await authFetch(`/api/products/${productId}/stock-report`);
    const report = await res.json();
    console.log('Stock Report:', report);
}
```

---

### Adicionar Campo ao Modelo

#### Passo 1: Editar Classe Product
```csharp
class Product {
    public int Id { get; set; }
    public string Name { get; set; }
    // Novo campo:
    public string Supplier { get; set; }
    public string SKU { get; set; }
    // ... outros campos
}
```

#### Passo 2: Criar Migration (Entity Framework)
```bash
cd server
dotnet ef migrations add AddSupplierAndSKU
dotnet ef database update
```

> **Nota:** Com SQLite, `database update` é automático se não houver migração anterior.

#### Passo 3: Atualizar DTOs
```csharp
class ProductDto {
    public string Supplier { get; set; }
    public string SKU { get; set; }
}
```

#### Passo 4: Atualizar Seed Data
```csharp
// Em SeedData
new Product { 
    Name = "Notebook", 
    Supplier = "Dell Inc.", 
    SKU = "NB-001",
    // ...
}
```

#### Passo 5: Testar
```bash
dotnet run
# Verificar se dados aparecem nas APIs
```

---

### Adicionar Filtro a um Endpoint

#### Exemplo: Filtrar produtos por preço

```csharp
app.MapGet("/api/products", async (
    int page, 
    int pageSize, 
    string search,
    decimal? minPrice,  // Novo parâmetro
    decimal? maxPrice,  // Novo parâmetro
    InventoryDbContext db) => {
    
    var query = db.Products.AsQueryable();
    
    if (!string.IsNullOrEmpty(search))
        query = query.Where(p => p.Name.Contains(search));
    
    // Novo filtro de preço
    if (minPrice.HasValue)
        query = query.Where(p => p.Price >= minPrice.Value);
    if (maxPrice.HasValue)
        query = query.Where(p => p.Price <= maxPrice.Value);
    
    var total = await query.CountAsync();
    var items = await query
        .Skip((page - 1) * pageSize)
        .Take(pageSize)
        .ToListAsync();
    
    return Results.Ok(new { total, page, pageSize, items });
});
```

**Teste:**
```bash
curl "http://localhost:5000/api/products?minPrice=100&maxPrice=5000"
```

---

### Modificar a Interface (UI)

#### Adicionar Campo de Entrada

```html
<!-- Em index.html, dentro do formCadastro -->
<div class="form-group">
  <label>Fornecedor</label>
  <input type="text" id="fornecedor" placeholder="Ex: Dell Inc.">
</div>
```

#### Atualizar JavaScript

```javascript
// Em app.js, função formCadastro
const formData = {
    name: document.getElementById('nomeProduto').value,
    supplier: document.getElementById('fornecedor').value,  // Novo
    category: document.getElementById('cadCategoria').value,
    // ... outros campos
};
```

#### Adicionar Coluna na Tabela

```html
<!-- Em index.html, thead da tabelaEstoque -->
<thead>
  <tr>
    <th>ID</th>
    <th>Nome</th>
    <th>Fornecedor</th>  <!-- Novo -->
    <th>Categoria</th>
    <!-- ... outras colunas -->
  </tr>
</thead>
```

#### Renderizar Coluna

```javascript
// Em app.js, função loadProductsIntoTable
items.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.name}</td>
        <td>${p.supplier}</td>  <!-- Novo -->
        <td>${p.category}</td>
        <!-- ... -->
    `;
    tbody.appendChild(tr);
});
```

---

## 🐛 Debugging

### Backend

#### 1. Logs no Console
```csharp
Console.WriteLine($"Produto criado: {product.Name}");
Console.WriteLine($"Total de movimentos: {movements.Count}");
```

#### 2. Debugger Visual Studio
```
1. Colocar breakpoint (F9)
2. F5 (Run)
3. Executar requisição
4. Breakpoint para execução
5. Inspecionar variáveis
```

#### 3. SQL Gerado pelo EF Core
```csharp
var query = db.Products.Where(p => p.Quantity < 10);
Console.WriteLine(query.ToQueryString());  // Imprime SQL
```

#### 4. Verificar Banco de Dados
```bash
# Com SQLite CLI (se instalado)
sqlite3 server/inventory.db
sqlite> SELECT * FROM Products;
sqlite> SELECT * FROM Movements;
```

### Frontend

#### 1. Browser DevTools (F12)
```javascript
// Console
console.log('productsPaginationState:', productsPaginationState);
console.error('Erro ao carregar:', error);
```

#### 2. Network Tab
- Abrir DevTools (F12)
- Aba "Network"
- Clicar em requisição para ver request/response
- Verificar status code (200, 404, 500, etc)

#### 3. Breakpoints JavaScript
```javascript
debugger;  // Execução para neste ponto
async function loadDashboard() {
    debugger;  // Inspecione aqui
    const res = await fetch('/api/dashboard');
    debugger;  // E aqui
}
```

---

## 🧪 Testes

### Teste Manual com curl

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# Dashboard
curl http://localhost:5000/api/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Produtos (primeira página)
curl "http://localhost:5000/api/products?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN"

# Criar produto
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","category":"Test","price":100,"quantity":10,"minQuantity":2}'

# Movimentação
curl -X POST http://localhost:5000/api/movements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"quantityChange":-2}'
```

### Teste Automatizado (Recomendado)

O projeto possui testes básicos de integração em `server.Tests`.

```bash
dotnet test server.Tests/InventoryApi.Tests.csproj
```

Esses testes validam:
- rota protegida sem token retorna `401`;
- login do admin retorna token e libera dashboard;
- operador consegue cadastrar categoria/produto, mas não gerenciar usuários;
- saída maior que o estoque disponível retorna erro.

```csharp
// File: server/InventoryApi.Tests.cs
using Xunit;

public class ProductTests {
    [Fact]
    public async Task CreateProduct_ValidData_ReturnsId() {
        // Arrange
        var product = new Product { Name = "Test", Category = "Test", Price = 100 };
        
        // Act
        var result = await CreateProduct(product);
        
        // Assert
        Assert.NotNull(result);
        Assert.True(result.Id > 0);
    }
}
```

**Executar testes:**
```bash
cd server
dotnet test
```

---

## 📦 Deployment

### Docker (Produção)

```yaml
# docker-compose.yml
version: '3.8'
services:
  inventory:
    build:
      context: .
      dockerfile: server/Dockerfile
    ports:
      - "5000:80"
    environment:
      - ASPNETCORE_ENVIRONMENT=Production
    volumes:
      - ./data:/app/data  # Persistência do DB
```

**Build e deploy:**
```bash
docker compose up --build -d
docker logs inventory  # Ver logs
docker compose down    # Parar
```

### Alternativa: Deploy Manual

```bash
# Compilar release
cd server
dotnet publish -c Release -o ../dist

# Copiar client
cp -r client/* ../dist/wwwroot/

# Executar
cd ../dist
dotnet InventoryApi.dll
```

---

## 🔒 Segurança para Produção

### Checklist
- [x] Implementar autenticação JWT
- [x] Proteger rotas por perfil de usuário
- [x] Armazenar senhas com hash e salt
- [x] Exigir troca de senha inicial para operadores
- [ ] Ativar HTTPS (SSL/TLS)
- [ ] Configurar CORS com domínios específicos
- [ ] Validar e sanitizar entrada do usuário
- [x] Exigir `INVENTORY_JWT_SECRET` em produção
- [ ] Implementar rate limiting
- [x] Adicionar logs de auditoria
- [x] Adicionar backup SQLite e exportação JSON completa
- [ ] Realizar SQL injection testing
- [ ] Testar segurança com OWASP ZAP

### Autenticação JWT no Projeto

```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options => {
        options.TokenValidationParameters = new TokenValidationParameters {
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Key"])),
            ValidateIssuer = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"]
        };
    });

app.MapGet("/api/admin/summary", AdminSummary)
    .RequireAuthorization("Admin");
```

No frontend, use `authFetch` ou `fetchJson`, pois essas funções adicionam automaticamente o header `Authorization: Bearer ...`.

---

## 📊 Monitoramento e Observabilidade

### Application Insights (Azure)

```csharp
builder.Services.AddApplicationInsightsTelemetry();
```

### Logging Estruturado (Serilog)

```csharp
using Serilog;

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/app-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

app.Logger.LogInformation("Aplicação iniciada");
```

---

## 🚀 Performance & Otimização

### Dicas
1. **Índices de Banco:** Adicionar em ProductId, Timestamp
2. **Lazy Loading:** Usar `Include()` estrategicamente
3. **Caching:** Implementar Redis para dashboards
4. **Paginação:** Nunca carregar tudo (máximo 100 itens/página)
5. **Async/Await:** Usar sempre em I/O-bound operations

### Exemplo: Índice SQLite

```csharp
// Adicionar migração
modelBuilder.Entity<Movement>()
    .HasIndex(m => m.ProductId)
    .HasName("IX_Movement_ProductId");
```

---

## 📚 Recursos

- [.NET 7 Documentation](https://docs.microsoft.com/dotnet/)
- [Entity Framework Core](https://docs.microsoft.com/ef/core/)
- [SQLite](https://www.sqlite.org/)
- [MDN Web Docs](https://developer.mozilla.org/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 🤝 Contribuindo

### Workflow
1. Criar branch: `git checkout -b feature/nova-funcionalidade`
2. Fazer alterações
3. Testar localmente
4. Commit: `git commit -m "Adicionar nova funcionalidade"`
5. Push: `git push origin feature/nova-funcionalidade`
6. Pull Request

### Padrões de Código
- Usar PascalCase para classes e métodos
- Usar camelCase para variáveis
- Comentar código complexo
- Seguir conventions C#/.NET
- Executar `dotnet format` antes de commit

---

## 📞 Contato & Suporte

- **Código**: Todos os arquivos documentados inline
- **Arquitetura**: Veja [ARQUITETURA.md](ARQUITETURA.md)
- **API Reference**: Veja [API_DOCUMENTATION.md](API_DOCUMENTATION.md)
- **User Guide**: Veja [GUIA_USUARIO.md](GUIA_USUARIO.md)

---

**Versão:** 1.0  
**Data:** Junho 2026  
**Status:** Projeto Concluído  
**Responsável:** Desenvolvedor da Equipe TCC
