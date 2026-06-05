using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.ComponentModel.DataAnnotations;
using System.IdentityModel.Tokens.Jwt;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;

var builder = WebApplication.CreateBuilder(args);
var configuredJwtSecret = builder.Configuration["Jwt:Secret"]
    ?? Environment.GetEnvironmentVariable("INVENTORY_JWT_SECRET");
var explicitEnvironment = Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
    ?? Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT");
var isExplicitProduction = explicitEnvironment?.Equals("Production", StringComparison.OrdinalIgnoreCase) == true;
if (isExplicitProduction && string.IsNullOrWhiteSpace(configuredJwtSecret))
{
    throw new InvalidOperationException("Configure a variável de ambiente INVENTORY_JWT_SECRET antes de iniciar em produção.");
}

var jwtSecret = configuredJwtSecret ?? "InventoryTccDevelopmentSecretKey2026!ChangeMe";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "InventoryApi";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "InventoryClient";
var jwtSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret));
builder.Services.AddDbContext<InventoryContext>(options =>
    options.UseSqlite("Data Source=inventory.db"));
builder.Services.AddCors(options =>
{
    options.AddPolicy("LocalClient", policy =>
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod());
});
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = jwtSigningKey,
            ClockSkew = TimeSpan.FromMinutes(2)
        };
    });
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("Admin", policy =>
        policy.RequireAuthenticatedUser()
              .RequireRole("Administrador")
              .RequireClaim("mustChangePassword", "false"));
    options.AddPolicy("PasswordReady", policy =>
        policy.RequireAuthenticatedUser()
              .RequireClaim("mustChangePassword", "false"));
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();
app.UseCors("LocalClient");
app.UseAuthentication();
app.UseAuthorization();

// Serve client folder static files (try local 'client' then parent)
string clientPath = Path.Combine(Directory.GetCurrentDirectory(), "client");
if (!Directory.Exists(clientPath))
{
    clientPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "client");
}
if (Directory.Exists(clientPath))
{
    app.UseDefaultFiles(new DefaultFilesOptions { FileProvider = new PhysicalFileProvider(clientPath) });
    app.UseStaticFiles(new StaticFileOptions { FileProvider = new PhysicalFileProvider(clientPath) });
}

using var scope = app.Services.CreateScope();
var db = scope.ServiceProvider.GetRequiredService<InventoryContext>();
db.Database.EnsureCreated();
EnsureCategorySchema(db);
EnsureMovementSchema(db);
EnsureUserSchema(db);
EnsureAuditSchema(db);
SeedData(db);

app.MapGet("/api/dashboard", async (InventoryContext db) =>
{
    var totalProducts = await db.Products.CountAsync(p => p.IsActive);
    var critical = await db.Products.CountAsync(p => p.IsActive && p.Quantity <= p.MinQuantity);
    var inactiveProducts = await db.Products.CountAsync(p => !p.IsActive);
    var movementsToday = await db.Movements.CountAsync(m => m.Timestamp.Date == DateTime.UtcNow.Date);
    var activeProducts = await db.Products
        .Where(p => p.IsActive)
        .ToListAsync();
    var stockValue = activeProducts.Sum(p => p.Quantity * p.Price);
    var activeCriticalProducts = await db.Products
        .Where(p => p.IsActive && p.Quantity <= p.MinQuantity)
        .ToListAsync();
    var criticalProducts = activeCriticalProducts
        .OrderBy(p => p.Quantity - p.MinQuantity)
        .Take(5)
        .Select(p => new
        {
            p.Id,
            p.Name,
            p.Category,
            p.Quantity,
            p.MinQuantity,
            Missing = Math.Max(0, p.MinQuantity - p.Quantity)
        });
    var latestMovementRows = await db.Movements
        .Include(m => m.Product)
        .OrderByDescending(m => m.Timestamp)
        .Take(5)
        .ToListAsync();
    var latestMovements = latestMovementRows
        .Select(m => new
        {
            m.Id,
            m.Timestamp,
            ProductName = m.Product != null ? m.Product.Name : $"Produto {m.ProductId}",
            m.QuantityChange,
            m.Type,
            m.Operator
        });
    var criticalCategories = activeCriticalProducts
        .GroupBy(p => string.IsNullOrWhiteSpace(p.Category) ? "Sem categoria" : p.Category)
        .Select(g => new { Category = g.Key, Count = g.Count() })
        .OrderByDescending(g => g.Count)
        .ThenBy(g => g.Category)
        .Take(5);

    return Results.Json(new
    {
        totalProducts,
        critical,
        inactiveProducts,
        movementsToday,
        stockValue,
        criticalProducts,
        latestMovements,
        criticalCategories
    });
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/public-url", (HttpRequest request) =>
{
    var port = request.Host.Port ?? 5123;
    var localIp = NetworkInterface.GetAllNetworkInterfaces()
        .Where(i => i.OperationalStatus == OperationalStatus.Up)
        .SelectMany(i => i.GetIPProperties().UnicastAddresses)
        .Where(a => a.Address.AddressFamily == AddressFamily.InterNetwork && !System.Net.IPAddress.IsLoopback(a.Address))
        .Select(a => a.Address.ToString())
        .FirstOrDefault(ip => ip.StartsWith("192.168.") || ip.StartsWith("10.") || ip.StartsWith("172."))
        ?? request.Host.Host;

    return Results.Json(new { baseUrl = $"{request.Scheme}://{localIp}:{port}" });
});

app.MapGet("/api/categories", async (InventoryContext db) =>
{
    var categories = await db.Categories.OrderBy(c => c.Name).ToListAsync();
    return Results.Json(categories);
}).RequireAuthorization("PasswordReady");

app.MapPost("/api/categories", async (CategoryDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var name = dto.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest("Nome da categoria é obrigatório.");

    if (await db.Categories.AnyAsync(c => c.Name.ToLower() == name.ToLower()))
        return Results.Conflict("Categoria já cadastrada.");

    var category = new ProductCategory { Name = name, IsActive = true };
    db.Categories.Add(category);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "CREATE", "Category", category.Id.ToString(), $"Categoria criada: {category.Name}");
    return Results.Created($"/api/categories/{category.Id}", category);
}).RequireAuthorization("PasswordReady");

app.MapPut("/api/categories/{id}", async (int id, CategoryDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var name = dto.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest("Nome da categoria é obrigatório.");

    var category = await db.Categories.FindAsync(id);
    if (category == null) return Results.NotFound();

    if (await db.Categories.AnyAsync(c => c.Id != id && c.Name.ToLower() == name.ToLower()))
        return Results.Conflict("Categoria já cadastrada.");

    var oldName = category.Name;
    category.Name = name;

    var products = await db.Products.Where(p => p.Category == oldName).ToListAsync();
    foreach (var product in products)
    {
        product.Category = name;
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "UPDATE", "Category", category.Id.ToString(), $"Categoria renomeada de {oldName} para {category.Name}");
    return Results.Ok(category);
}).RequireAuthorization("PasswordReady");

app.MapDelete("/api/categories/{id}", async (int id, InventoryContext db, HttpContext httpContext) =>
{
    var category = await db.Categories.FindAsync(id);
    if (category == null) return Results.NotFound();

    var inUse = await db.Products.AnyAsync(p => p.Category == category.Name);
    if (inUse)
        return Results.Conflict("Categoria em uso por produtos. Altere os produtos antes de excluir.");

    var categoryName = category.Name;
    db.Categories.Remove(category);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "DELETE", "Category", id.ToString(), $"Categoria excluída: {categoryName}");
    return Results.NoContent();
}).RequireAuthorization("PasswordReady");

app.MapPut("/api/categories/{id}/active", async (int id, CategoryStatusDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var category = await db.Categories.FindAsync(id);
    if (category == null) return Results.NotFound();

    category.IsActive = dto.IsActive;
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, dto.IsActive ? "ACTIVATE" : "DEACTIVATE", "Category", category.Id.ToString(), $"Categoria {(dto.IsActive ? "ativada" : "desativada")}: {category.Name}");
    return Results.Ok(category);
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/products", async (int? page, int? pageSize, string? search, string? category, string? status, string? activeStatus, InventoryContext db) =>
{
    var q = db.Products.AsQueryable();
    if (!string.IsNullOrWhiteSpace(search)) q = q.Where(p => p.Name.Contains(search));
    if (!string.IsNullOrWhiteSpace(category)) q = q.Where(p => p.Category == category);
    if (!string.IsNullOrWhiteSpace(activeStatus))
    {
        if (activeStatus.Equals("active", StringComparison.OrdinalIgnoreCase)) q = q.Where(p => p.IsActive);
        else if (activeStatus.Equals("inactive", StringComparison.OrdinalIgnoreCase)) q = q.Where(p => !p.IsActive);
    }
    if (!string.IsNullOrWhiteSpace(status))
    {
        if (status == "Crítico") q = q.Where(p => p.Quantity <= p.MinQuantity);
        else if (status == "Estável") q = q.Where(p => p.Quantity > p.MinQuantity);
    }
    var total = await q.CountAsync();
    int p = page.GetValueOrDefault(1);
    int ps = pageSize.GetValueOrDefault(20);
    var items = await q.OrderBy(pdt => pdt.Id).Skip((p - 1) * ps).Take(ps).ToListAsync();
    return Results.Json(new { total, page = p, pageSize = ps, items });
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/products/export", async (string? search, string? category, string? status, string? activeStatus, InventoryContext db) =>
{
    var q = db.Products.AsQueryable();
    if (!string.IsNullOrWhiteSpace(search)) q = q.Where(p => p.Name.Contains(search));
    if (!string.IsNullOrWhiteSpace(category)) q = q.Where(p => p.Category == category);
    if (!string.IsNullOrWhiteSpace(activeStatus))
    {
        if (activeStatus.Equals("active", StringComparison.OrdinalIgnoreCase)) q = q.Where(p => p.IsActive);
        else if (activeStatus.Equals("inactive", StringComparison.OrdinalIgnoreCase)) q = q.Where(p => !p.IsActive);
    }
    if (!string.IsNullOrWhiteSpace(status))
    {
        if (status == "Crítico") q = q.Where(p => p.Quantity <= p.MinQuantity);
        else if (status == "Estável") q = q.Where(p => p.Quantity > p.MinQuantity);
    }
    var list = await q.OrderBy(p => p.Id).ToListAsync();
    var sb = new StringBuilder();
    sb.AppendLine("Id,Name,Category,Quantity,MinQuantity,Price,IsActive");
    foreach (var p in list)
    {
        var safeName = p.Name?.Replace('"', ' ') ?? string.Empty;
        var safeCategory = p.Category?.Replace('"', ' ') ?? string.Empty;
        sb.AppendLine($"{p.Id},\"{safeName}\",\"{safeCategory}\",{p.Quantity},{p.MinQuantity},{p.Price},{p.IsActive}");
    }
    return Results.Text(sb.ToString(), "text/csv");
}).RequireAuthorization("PasswordReady");

app.MapPost("/api/users/register", async (UserRegisterDto dto, InventoryContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
        return Results.BadRequest("Usuário e senha são obrigatórios.");

    if (await db.Users.AnyAsync(u => u.Username == dto.Username))
        return Results.Conflict("Usuário já existe.");

    var user = new User
    {
        Username = dto.Username,
        PasswordHash = CreatePasswordHash(dto.Password),
        Name = string.IsNullOrWhiteSpace(dto.Name) ? dto.Username : dto.Name,
        Role = string.IsNullOrWhiteSpace(dto.Role) ? "Operador" : dto.Role
    };
    user.MustChangePassword = !user.Role.Equals("Administrador", StringComparison.OrdinalIgnoreCase);

    db.Users.Add(user);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "CREATE", "User", user.Id.ToString(), $"Usuário criado: {user.Username} ({user.Role})");

    return Results.Created($"/api/users/{user.Id}", new { user.Id, user.Username, user.Name, user.Role, user.MustChangePassword });
}).RequireAuthorization("Admin");

app.MapPost("/api/users/login", async (LoginDto dto, InventoryContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(dto.Username) || string.IsNullOrWhiteSpace(dto.Password))
        return Results.BadRequest("Usuário e senha são obrigatórios.");

    var user = await db.Users.SingleOrDefaultAsync(u => u.Username == dto.Username);
    if (user == null || !VerifyPasswordHash(dto.Password, user.PasswordHash))
    {
        await LogAuditAsync(db, httpContext, "LOGIN_FAILED", "User", null, "Tentativa de login com usuário ou senha inválidos.", dto.Username);
        return Results.BadRequest("Usuário ou senha inválidos.");
    }
    if (!user.IsActive)
    {
        await LogAuditAsync(db, httpContext, "LOGIN_BLOCKED", "User", user.Id.ToString(), "Tentativa de login com usuário inativo.", user.Username);
        return Results.BadRequest("Usuário inativo. Procure o administrador.");
    }

    await LogAuditAsync(db, httpContext, "LOGIN_SUCCESS", "User", user.Id.ToString(), "Login realizado com sucesso.", user.Username);
    return Results.Ok(new
    {
        user.Id,
        user.Username,
        user.Name,
        user.Role,
        user.IsActive,
        user.MustChangePassword,
        Token = GenerateJwtToken(user)
    });
});

app.MapGet("/api/users", async (InventoryContext db) =>
{
    var users = await db.Users
        .OrderBy(u => u.Username)
        .Select(u => new { u.Id, u.Username, u.Name, u.Role, u.IsActive, u.MustChangePassword })
        .ToListAsync();
    return Results.Json(users);
}).RequireAuthorization("Admin");

app.MapPut("/api/users/{id}", async (int id, UserUpdateDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    var name = dto.Name?.Trim();
    var role = dto.Role?.Trim();
    if (string.IsNullOrWhiteSpace(name)) return Results.BadRequest("Nome é obrigatório.");
    if (role != "Administrador" && role != "Operador") return Results.BadRequest("Perfil inválido.");

    if (user.Role == "Administrador" && role != "Administrador")
    {
        var activeAdmins = await db.Users.CountAsync(u => u.Id != id && u.IsActive && u.Role == "Administrador");
        if (activeAdmins == 0) return Results.BadRequest("Não é possível remover o último administrador ativo.");
    }

    var oldRole = user.Role;
    user.Name = name;
    user.Role = role;
    if (user.Role == "Administrador")
    {
        user.MustChangePassword = false;
    }
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "UPDATE", "User", user.Id.ToString(), $"Usuário atualizado: {user.Username}; perfil {oldRole} -> {user.Role}");

    return Results.Ok(new { user.Id, user.Username, user.Name, user.Role, user.IsActive, user.MustChangePassword });
}).RequireAuthorization("Admin");

app.MapPut("/api/users/{id}/status", async (int id, UserStatusDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (!dto.IsActive && user.Role == "Administrador")
    {
        var activeAdmins = await db.Users.CountAsync(u => u.Id != id && u.IsActive && u.Role == "Administrador");
        if (activeAdmins == 0) return Results.BadRequest("Não é possível desativar o último administrador ativo.");
    }

    user.IsActive = dto.IsActive;
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, dto.IsActive ? "ACTIVATE" : "DEACTIVATE", "User", user.Id.ToString(), $"Usuário {(dto.IsActive ? "ativado" : "desativado")}: {user.Username}");

    return Results.Ok(new { user.Id, user.Username, user.Name, user.Role, user.IsActive, user.MustChangePassword });
}).RequireAuthorization("Admin");

app.MapPut("/api/users/{id}/password", async (int id, PasswordResetDto dto, InventoryContext db, HttpContext httpContext) =>
{
    if (string.IsNullOrWhiteSpace(dto.Password) || dto.Password.Length < 4)
        return Results.BadRequest("A nova senha deve ter pelo menos 4 caracteres.");

    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    user.PasswordHash = CreatePasswordHash(dto.Password);
    user.MustChangePassword = !user.Role.Equals("Administrador", StringComparison.OrdinalIgnoreCase);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "RESET_PASSWORD", "User", user.Id.ToString(), $"Senha redefinida pelo administrador para: {user.Username}");

    return Results.Ok(new { user.Id, user.Username, user.Name, user.Role, user.IsActive, user.MustChangePassword });
}).RequireAuthorization("Admin");

app.MapPut("/api/users/{id}/change-password", async (int id, ChangeOwnPasswordDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var authenticatedUserId = GetAuthenticatedUserId(httpContext);
    if (authenticatedUserId != id) return Results.Forbid();

    if (string.IsNullOrWhiteSpace(dto.CurrentPassword) || string.IsNullOrWhiteSpace(dto.NewPassword))
        return Results.BadRequest("Senha atual e nova senha são obrigatórias.");
    if (dto.NewPassword.Length < 4)
        return Results.BadRequest("A nova senha deve ter pelo menos 4 caracteres.");
    if (dto.CurrentPassword == dto.NewPassword)
        return Results.BadRequest("A nova senha deve ser diferente da senha atual.");

    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();
    if (!user.IsActive) return Results.BadRequest("Usuário inativo. Procure o administrador.");
    if (!VerifyPasswordHash(dto.CurrentPassword, user.PasswordHash))
        return Results.BadRequest("Senha atual inválida.");

    user.PasswordHash = CreatePasswordHash(dto.NewPassword);
    user.MustChangePassword = false;
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "CHANGE_PASSWORD", "User", user.Id.ToString(), "Usuário alterou a própria senha.");

    return Results.Ok(new
    {
        user.Id,
        user.Username,
        user.Name,
        user.Role,
        user.IsActive,
        user.MustChangePassword,
        Token = GenerateJwtToken(user)
    });
}).RequireAuthorization();

app.MapDelete("/api/users/{id}", async (int id, InventoryContext db, HttpContext httpContext) =>
{
    if (GetAuthenticatedUserId(httpContext) == id)
        return Results.BadRequest("Não é possível excluir o usuário logado.");

    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound();

    if (user.Role == "Administrador")
    {
        var activeAdmins = await db.Users.CountAsync(u => u.Id != id && u.IsActive && u.Role == "Administrador");
        if (activeAdmins == 0) return Results.BadRequest("Não é possível excluir o último administrador ativo.");
    }

    var deletedUsername = user.Username;
    db.Users.Remove(user);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "DELETE", "User", id.ToString(), $"Usuário excluído: {deletedUsername}");
    return Results.NoContent();
}).RequireAuthorization("Admin");

app.MapGet("/api/products/{id}", async (int id, InventoryContext db) => await db.Products.FindAsync(id) is Product p ? Results.Ok(p) : Results.NotFound())
    .RequireAuthorization("PasswordReady");
app.MapPost("/api/products", async (Product p, InventoryContext db, HttpContext httpContext) =>
{
    p.Name = p.Name.Trim();
    if (string.IsNullOrWhiteSpace(p.Name)) return Results.BadRequest("Nome do produto é obrigatório.");
    if (await db.Products.AnyAsync(existing => existing.Name.ToLower() == p.Name.ToLower()))
        return Results.Conflict("Já existe um produto cadastrado com esse nome.");

    db.Products.Add(p);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "CREATE", "Product", p.Id.ToString(), $"Produto criado: {p.Name}; estoque inicial {p.Quantity}");
    return Results.Created($"/api/products/{p.Id}", p);
}).RequireAuthorization("PasswordReady");

app.MapPut("/api/products/{id}", async (int id, Product updatedProduct, InventoryContext db, HttpContext httpContext) =>
{
    var product = await db.Products.FindAsync(id);
    if (product == null) return Results.NotFound();
    updatedProduct.Name = updatedProduct.Name.Trim();
    if (string.IsNullOrWhiteSpace(updatedProduct.Name)) return Results.BadRequest("Nome do produto é obrigatório.");
    if (await db.Products.AnyAsync(existing => existing.Id != id && existing.Name.ToLower() == updatedProduct.Name.ToLower()))
        return Results.Conflict("Já existe um produto cadastrado com esse nome.");
    
    var oldQuantity = product.Quantity;
    var oldName = product.Name;
    product.Name = updatedProduct.Name;
    product.Category = updatedProduct.Category;
    product.Price = updatedProduct.Price;
    product.Quantity = updatedProduct.Quantity;
    product.MinQuantity = updatedProduct.MinQuantity;
    product.IsActive = updatedProduct.IsActive;
    
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "UPDATE", "Product", product.Id.ToString(), $"Produto atualizado: {oldName} -> {product.Name}; estoque {oldQuantity} -> {product.Quantity}");
    return Results.Ok(product);
}).RequireAuthorization("PasswordReady");

app.MapPut("/api/products/{id}/active", async (int id, ProductStatusDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var product = await db.Products.FindAsync(id);
    if (product == null) return Results.NotFound();

    product.IsActive = dto.IsActive;
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, dto.IsActive ? "ACTIVATE" : "DEACTIVATE", "Product", product.Id.ToString(), $"Produto {(dto.IsActive ? "reativado" : "desativado")}: {product.Name}");
    return Results.Ok(product);
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/movements", async (int? page, int? pageSize, int? productId, DateTime? from, DateTime? to, string? type, string? search, string? operatorName, InventoryContext db) =>
{
    var q = db.Movements.Include(m => m.Product).AsQueryable();
    if (productId.HasValue) q = q.Where(m => m.ProductId == productId.Value);
    if (from.HasValue) q = q.Where(m => m.Timestamp >= from.Value);
    if (to.HasValue)
    {
        var endFilter = GetMovementEndFilter(to.Value);
        q = q.Where(m => m.Timestamp < endFilter);
    }
    if (!string.IsNullOrWhiteSpace(type))
    {
        if (type.Equals("Entrada", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange > 0);
        else if (type.Equals("Saida", StringComparison.OrdinalIgnoreCase) || type.Equals("Saída", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange < 0);
    }
    if (!string.IsNullOrWhiteSpace(search)) q = q.Where(m => m.Product != null && m.Product.Name.Contains(search));
    if (!string.IsNullOrWhiteSpace(operatorName))
    {
        var op = operatorName.Trim();
        q = q.Where(m => (m.Operator ?? "Sistema").Contains(op));
    }
    var total = await q.CountAsync();
    int p = page.GetValueOrDefault(1);
    int ps = pageSize.GetValueOrDefault(20);
    var items = await q.OrderByDescending(m => m.Timestamp).Skip((p - 1) * ps).Take(ps).ToListAsync();
    return Results.Json(new { total, page = p, pageSize = ps, items });
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/movements/summary", async (int? productId, DateTime? from, DateTime? to, string? type, string? search, string? operatorName, InventoryContext db) =>
{
    var q = db.Movements.Include(m => m.Product).AsQueryable();
    if (productId.HasValue) q = q.Where(m => m.ProductId == productId.Value);
    if (from.HasValue) q = q.Where(m => m.Timestamp >= from.Value);
    if (to.HasValue)
    {
        var endFilter = GetMovementEndFilter(to.Value);
        q = q.Where(m => m.Timestamp < endFilter);
    }
    if (!string.IsNullOrWhiteSpace(type))
    {
        if (type.Equals("Entrada", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange > 0);
        else if (type.Equals("Saida", StringComparison.OrdinalIgnoreCase) || type.Equals("Saída", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange < 0);
    }
    if (!string.IsNullOrWhiteSpace(search)) q = q.Where(m => m.Product != null && m.Product.Name.Contains(search));
    if (!string.IsNullOrWhiteSpace(operatorName))
    {
        var op = operatorName.Trim();
        q = q.Where(m => (m.Operator ?? "Sistema").Contains(op));
    }

    var movements = await q.ToListAsync();
    var totalIn = movements.Where(m => m.QuantityChange > 0).Sum(m => m.QuantityChange);
    var totalOut = movements.Where(m => m.QuantityChange < 0).Sum(m => Math.Abs(m.QuantityChange));
    return Results.Json(new
    {
        totalMovements = movements.Count,
        totalIn,
        totalOut,
        net = totalIn - totalOut
    });
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/movements/export", async (int? productId, DateTime? from, DateTime? to, string? type, string? search, string? operatorName, InventoryContext db) =>
{
    var q = db.Movements.Include(m => m.Product).AsQueryable();
    if (productId.HasValue) q = q.Where(m => m.ProductId == productId.Value);
    if (from.HasValue) q = q.Where(m => m.Timestamp >= from.Value);
    if (to.HasValue)
    {
        var endFilter = GetMovementEndFilter(to.Value);
        q = q.Where(m => m.Timestamp < endFilter);
    }
    if (!string.IsNullOrWhiteSpace(type))
    {
        if (type.Equals("Entrada", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange > 0);
        else if (type.Equals("Saida", StringComparison.OrdinalIgnoreCase) || type.Equals("Saída", StringComparison.OrdinalIgnoreCase)) q = q.Where(m => m.QuantityChange < 0);
    }
    if (!string.IsNullOrWhiteSpace(search)) q = q.Where(m => m.Product != null && m.Product.Name.Contains(search));
    if (!string.IsNullOrWhiteSpace(operatorName))
    {
        var op = operatorName.Trim();
        q = q.Where(m => (m.Operator ?? "Sistema").Contains(op));
    }

    var list = await q.OrderByDescending(m => m.Timestamp).ToListAsync();
    var sb = new StringBuilder();
    sb.AppendLine("DataHora,Produto,Tipo,Quantidade,Operador");
    foreach (var m in list)
    {
        var productName = (m.Product?.Name ?? $"Produto {m.ProductId}").Replace('"', ' ');
        var movementType = m.QuantityChange > 0 ? "Entrada" : "Saida";
        var operatorSafe = (m.Operator ?? "Sistema").Replace('"', ' ');
        sb.AppendLine($"{m.Timestamp:O},\"{productName}\",{movementType},{Math.Abs(m.QuantityChange)},\"{operatorSafe}\"");
    }
    return Results.Text(sb.ToString(), "text/csv");
}).RequireAuthorization("PasswordReady");

app.MapPost("/api/movements", async (MovementDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var product = await db.Products.FindAsync(dto.ProductId);
    if (product == null) return Results.BadRequest("Produto não encontrado.");
    if (!product.IsActive) return Results.BadRequest("Produto inativo não pode receber movimentações.");
    if (dto.QuantityChange == 0) return Results.BadRequest("A quantidade da movimentação deve ser maior que zero.");
    if (dto.QuantityChange < 0 && product.Quantity + dto.QuantityChange < 0)
    {
        return Results.BadRequest($"Estoque insuficiente. Disponível: {product.Quantity} unidade(s).");
    }

    product.Quantity += dto.QuantityChange;
    var operatorName = GetAuthenticatedUserName(httpContext) ?? "Sistema";
    var m = new Movement
    {
        ProductId = dto.ProductId,
        QuantityChange = dto.QuantityChange,
        Type = dto.QuantityChange > 0 ? "IN" : "OUT",
        Timestamp = DateTime.UtcNow,
        Operator = operatorName
    };
    db.Movements.Add(m);
    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, dto.QuantityChange > 0 ? "STOCK_IN" : "STOCK_OUT", "Movement", m.Id.ToString(), $"Produto {product.Name}; alteração {dto.QuantityChange}; estoque atual {product.Quantity}");
    return Results.Ok(m);
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/history/{productId}", async (int productId, InventoryContext db) =>
    await db.Movements.Where(m => m.ProductId == productId).OrderByDescending(m => m.Timestamp).ToListAsync())
    .RequireAuthorization("PasswordReady");

app.MapGet("/api/ai/suggestions", async (InventoryContext db) =>
{
    var products = await db.Products.ToListAsync();
    var suggestions = products.Where(p => p.IsActive && p.Quantity <= p.MinQuantity).Select(p => new
    {
        p.Id,
        p.Name,
        SuggestedPurchase = Math.Max(0, p.MinQuantity * 2 - p.Quantity)
    });
    return Results.Json(suggestions);
}).RequireAuthorization("PasswordReady");

app.MapGet("/api/ai/predict/{productId}", async (int productId, int? days, InventoryContext db) =>
{
    var horizonDays = Math.Clamp(days.GetValueOrDefault(14), 1, 90);
    var forecast = await InventoryForecast.ForecastDailyOutflowAsync(productId, db);
    var product = await db.Products.FindAsync(productId);
    var recommendedOrder = 0;
    if (product != null)
    {
        recommendedOrder = Math.Max(0, (int)Math.Ceiling(forecast.PredictedDailyOutflow * horizonDays) + product.MinQuantity - product.Quantity);
    }
    return Results.Json(new
    {
        productId,
        horizonDays,
        predictedDailyOutflow = forecast.PredictedDailyOutflow,
        recommendedOrder,
        forecast.Method,
        forecast.DaysWithOutflow,
        forecast.ObservationDays,
        forecast.ConfidencePercent
    });
}).RequireAuthorization("PasswordReady");

app.MapPost("/api/ai/test-history", async (AiTestHistoryDto dto, InventoryContext db, HttpContext httpContext) =>
{
    var product = await db.Products.FindAsync(dto.ProductId);
    if (product == null) return Results.BadRequest("Produto não encontrado.");
    if (!product.IsActive) return Results.BadRequest("Produto inativo não pode receber histórico simulado.");

    var averageOutflow = Math.Clamp(dto.AverageOutflow <= 0 ? 2 : dto.AverageOutflow, 1, 999);
    var startDate = DateTime.UtcNow.Date.AddDays(-6);
    var existingSimulation = await db.Movements
        .Where(m => m.ProductId == product.Id && m.Operator == "Simulação IA")
        .ToListAsync();
    db.Movements.RemoveRange(existingSimulation);

    for (var day = 0; day < 7; day++)
    {
        var variation = day % 3 - 1;
        var quantity = Math.Max(1, averageOutflow + variation);
        db.Movements.Add(new Movement
        {
            ProductId = product.Id,
            QuantityChange = -quantity,
            Type = "OUT",
            Timestamp = startDate.AddDays(day).AddHours(15),
            Operator = "Simulação IA"
        });
    }

    await db.SaveChangesAsync();
    await LogAuditAsync(db, httpContext, "AI_TEST_HISTORY", "Product", product.Id.ToString(), $"Histórico simulado de IA gerado para {product.Name}; média {averageOutflow}; registros substituídos {existingSimulation.Count}");
    return Results.Ok(new { product.Id, product.Name, daysGenerated = 7, averageOutflow, replacedMovements = existingSimulation.Count });
}).RequireAuthorization("Admin");

app.MapGet("/api/audit-logs", async (int? page, int? pageSize, string? action, string? entity, InventoryContext db) =>
{
    var q = db.AuditLogs.AsQueryable();
    if (!string.IsNullOrWhiteSpace(action)) q = q.Where(log => log.Action.Contains(action));
    if (!string.IsNullOrWhiteSpace(entity)) q = q.Where(log => log.Entity == entity);

    var total = await q.CountAsync();
    var p = Math.Max(1, page.GetValueOrDefault(1));
    var ps = Math.Clamp(pageSize.GetValueOrDefault(30), 1, 200);
    var items = await q
        .OrderByDescending(log => log.Timestamp)
        .Skip((p - 1) * ps)
        .Take(ps)
        .ToListAsync();

    return Results.Json(new { total, page = p, pageSize = ps, items });
}).RequireAuthorization("Admin");

app.MapGet("/api/backup/database", async (InventoryContext db, HttpContext httpContext) =>
{
    var dbPath = Path.GetFullPath(db.Database.GetDbConnection().DataSource);
    if (string.IsNullOrWhiteSpace(dbPath) || !File.Exists(dbPath))
        return Results.NotFound("Arquivo do banco não encontrado.");

    var fileName = $"inventory-backup-{DateTime.UtcNow:yyyyMMdd-HHmmss}.db";
    var backupDirectory = Path.Combine(AppContext.BaseDirectory, "backups");
    Directory.CreateDirectory(backupDirectory);
    var backupPath = Path.Combine(backupDirectory, fileName);
    File.Copy(dbPath, backupPath, overwrite: false);

    await LogAuditAsync(db, httpContext, "BACKUP_DATABASE", "Database", null, $"Download completo do arquivo SQLite: {fileName}");
    return Results.File(backupPath, "application/octet-stream", fileName);
}).RequireAuthorization("Admin");

app.MapGet("/api/backup/export", async (InventoryContext db, HttpContext httpContext) =>
{
    var export = new
    {
        exportedAt = DateTime.UtcNow,
        products = await db.Products.OrderBy(p => p.Id).ToListAsync(),
        categories = await db.Categories.OrderBy(c => c.Id).ToListAsync(),
        movements = await db.Movements.OrderBy(m => m.Id).ToListAsync(),
        users = await db.Users
            .OrderBy(u => u.Id)
            .Select(u => new { u.Id, u.Username, u.Name, u.Role, u.IsActive, u.MustChangePassword })
            .ToListAsync(),
        auditLogs = await db.AuditLogs.OrderBy(log => log.Id).ToListAsync()
    };

    await LogAuditAsync(db, httpContext, "EXPORT_JSON", "Database", null, "Exportação completa dos dados em JSON.");
    return Results.Json(export);
}).RequireAuthorization("Admin");

app.MapGet("/", () => Results.Redirect("/index.html"));

app.Run();

void SeedData(InventoryContext db)
{
    if (!db.Users.Any())
    {
        var admin = new User
        {
            Username = "admin",
            PasswordHash = CreatePasswordHash("admin123"),
            Name = "Marcelo Henrique",
            Role = "Administrador",
            MustChangePassword = false
        };
        db.Users.Add(admin);
    }

    if (!db.Products.Any())
    {
        var p1 = new Product { Name = "Parafuso M4", Quantity = 150, MinQuantity = 50, IsActive = true, Category = "Hardware", Price = 0.10m };
        var p2 = new Product { Name = "Porca M4", Quantity = 20, MinQuantity = 50, IsActive = true, Category = "Hardware", Price = 0.05m };
        var p3 = new Product { Name = "Arruela", Quantity = 5, MinQuantity = 20, IsActive = true, Category = "Hardware", Price = 0.03m };
        db.Products.AddRange(p1, p2, p3);
        db.Movements.AddRange(
            new Movement { Product = p1, QuantityChange = -10, Type = "OUT", Timestamp = DateTime.UtcNow.AddDays(-1) },
            new Movement { Product = p2, QuantityChange = -5, Type = "OUT", Timestamp = DateTime.UtcNow.AddDays(-2) },
            new Movement { Product = p3, QuantityChange = -3, Type = "OUT", Timestamp = DateTime.UtcNow }
        );
    }

    var defaultCategories = new[] { "Hardware", "Periféricos", "Escritório" };
    foreach (var categoryName in defaultCategories)
    {
        if (!db.Categories.Any(c => c.Name == categoryName))
        {
            db.Categories.Add(new ProductCategory { Name = categoryName });
        }
    }

    db.SaveChanges();
}

void EnsureCategorySchema(InventoryContext db)
{
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "Categories" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_Categories" PRIMARY KEY AUTOINCREMENT,
            "Name" TEXT NOT NULL
        );
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE UNIQUE INDEX IF NOT EXISTS "IX_Categories_Name" ON "Categories" ("Name");
        """);
    try
    {
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Categories" ADD COLUMN "IsActive" INTEGER NOT NULL DEFAULT 1;""");
    }
    catch
    {
        // Existing databases already have this column after the first run.
    }
}

void EnsureMovementSchema(InventoryContext db)
{
    try
    {
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Movements" ADD COLUMN "Operator" TEXT;""");
    }
    catch
    {
        // Existing databases already have this column after the first run.
    }
}

void EnsureUserSchema(InventoryContext db)
{
    try
    {
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Users" ADD COLUMN "IsActive" INTEGER NOT NULL DEFAULT 1;""");
    }
    catch
    {
        // Existing databases already have this column after the first run.
    }
    try
    {
        db.Database.ExecuteSqlRaw("""ALTER TABLE "Users" ADD COLUMN "MustChangePassword" INTEGER NOT NULL DEFAULT 0;""");
    }
    catch
    {
        // Existing databases already have this column after the first run.
    }
}

void EnsureAuditSchema(InventoryContext db)
{
    db.Database.ExecuteSqlRaw("""
        CREATE TABLE IF NOT EXISTS "AuditLogs" (
            "Id" INTEGER NOT NULL CONSTRAINT "PK_AuditLogs" PRIMARY KEY AUTOINCREMENT,
            "Timestamp" TEXT NOT NULL,
            "UserId" INTEGER NULL,
            "Username" TEXT NULL,
            "Action" TEXT NOT NULL,
            "Entity" TEXT NOT NULL,
            "EntityId" TEXT NULL,
            "Details" TEXT NULL,
            "IpAddress" TEXT NULL
        );
        """);
    db.Database.ExecuteSqlRaw("""
        CREATE INDEX IF NOT EXISTS "IX_AuditLogs_Timestamp" ON "AuditLogs" ("Timestamp");
        """);
}

DateTime GetMovementEndFilter(DateTime to)
{
    return to.TimeOfDay == TimeSpan.Zero ? to.Date.AddDays(1) : to;
}

int? GetAuthenticatedUserId(HttpContext httpContext)
{
    var idClaim = httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
    return int.TryParse(idClaim, out var userId) ? userId : null;
}

string? GetAuthenticatedUserName(HttpContext httpContext)
{
    return httpContext.User.FindFirstValue(ClaimTypes.Name)
        ?? httpContext.User.FindFirstValue(ClaimTypes.NameIdentifier);
}

async Task LogAuditAsync(
    InventoryContext db,
    HttpContext httpContext,
    string action,
    string entity,
    string? entityId = null,
    string? details = null,
    string? usernameOverride = null)
{
    var username = usernameOverride
        ?? httpContext.User.FindFirstValue("username")
        ?? GetAuthenticatedUserName(httpContext);

    db.AuditLogs.Add(new AuditLog
    {
        Timestamp = DateTime.UtcNow,
        UserId = GetAuthenticatedUserId(httpContext),
        Username = username,
        Action = action,
        Entity = entity,
        EntityId = entityId,
        Details = details,
        IpAddress = httpContext.Connection.RemoteIpAddress?.ToString()
    });
    await db.SaveChangesAsync();
}

string GenerateJwtToken(User user)
{
    var claims = new[]
    {
        new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new Claim(ClaimTypes.Name, string.IsNullOrWhiteSpace(user.Name) ? user.Username : user.Name),
        new Claim(ClaimTypes.Role, user.Role),
        new Claim("username", user.Username),
        new Claim("mustChangePassword", user.MustChangePassword ? "true" : "false")
    };

    var credentials = new SigningCredentials(jwtSigningKey, SecurityAlgorithms.HmacSha256);
    var token = new JwtSecurityToken(
        issuer: jwtIssuer,
        audience: jwtAudience,
        claims: claims,
        expires: DateTime.UtcNow.AddHours(8),
        signingCredentials: credentials);

    return new JwtSecurityTokenHandler().WriteToken(token);
}

string CreatePasswordHash(string password)
{
    using var rng = RandomNumberGenerator.Create();
    var salt = new byte[16];
    rng.GetBytes(salt);
    using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 310_000, HashAlgorithmName.SHA256);
    var hash = pbkdf2.GetBytes(32);
    var combined = new byte[48];
    Buffer.BlockCopy(salt, 0, combined, 0, 16);
    Buffer.BlockCopy(hash, 0, combined, 16, 32);
    return Convert.ToBase64String(combined);
}

bool VerifyPasswordHash(string password, string storedHash)
{
    try
    {
        var combined = Convert.FromBase64String(storedHash);
        var salt = new byte[16];
        Buffer.BlockCopy(combined, 0, salt, 0, 16);
        using var pbkdf2 = new Rfc2898DeriveBytes(password, salt, 310_000, HashAlgorithmName.SHA256);
        var hash = pbkdf2.GetBytes(32);
        for (int i = 0; i < 32; i++)
        {
            if (hash[i] != combined[16 + i]) return false;
        }
        return true;
    }
    catch
    {
        return false;
    }
}

public class InventoryContext : DbContext
{
    public InventoryContext(DbContextOptions<InventoryContext> options) : base(options) { }
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Movement> Movements => Set<Movement>();
    public DbSet<User> Users => Set<User>();
    public DbSet<ProductCategory> Categories => Set<ProductCategory>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ProductCategory>()
            .HasIndex(c => c.Name)
            .IsUnique();
    }
}

public class ProductCategory
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
}

public class Product
{
    public int Id { get; set; }
    [Required]
    public string Name { get; set; } = string.Empty;
    public int Quantity { get; set; }
    public int MinQuantity { get; set; }
    public bool IsActive { get; set; } = true;
    public string? Category { get; set; }
    public decimal Price { get; set; }
}

public class Movement
{
    public int Id { get; set; }
    public int ProductId { get; set; }
    public Product? Product { get; set; }
    public int QuantityChange { get; set; }
    public string? Type { get; set; }
    public DateTime Timestamp { get; set; }
    public string? Operator { get; set; }
}

public class AuditLog
{
    public int Id { get; set; }
    public DateTime Timestamp { get; set; }
    public int? UserId { get; set; }
    public string? Username { get; set; }
    [Required]
    public string Action { get; set; } = string.Empty;
    [Required]
    public string Entity { get; set; } = string.Empty;
    public string? EntityId { get; set; }
    public string? Details { get; set; }
    public string? IpAddress { get; set; }
}

public class MovementDto
{
    public int ProductId { get; set; }
    public int QuantityChange { get; set; }
    public string? Operator { get; set; }
}

public class ProductStatusDto
{
    public bool IsActive { get; set; }
}

public class User
{
    public int Id { get; set; }
    [Required]
    public string Username { get; set; } = string.Empty;
    [Required]
    public string PasswordHash { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "Operador";
    public bool IsActive { get; set; } = true;
    public bool MustChangePassword { get; set; }
}

public class UserRegisterDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? Role { get; set; }
}

public class LoginDto
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class UserUpdateDto
{
    public string Name { get; set; } = string.Empty;
    public string Role { get; set; } = "Operador";
}

public class UserStatusDto
{
    public bool IsActive { get; set; }
}

public class PasswordResetDto
{
    public string Password { get; set; } = string.Empty;
}

public class ChangeOwnPasswordDto
{
    public string CurrentPassword { get; set; } = string.Empty;
    public string NewPassword { get; set; } = string.Empty;
}

public class AiTestHistoryDto
{
    public int ProductId { get; set; }
    public int AverageOutflow { get; set; } = 2;
}

public class CategoryDto
{
    public string Name { get; set; } = string.Empty;
}

public class CategoryStatusDto
{
    public bool IsActive { get; set; }
}

public partial class Program { }
