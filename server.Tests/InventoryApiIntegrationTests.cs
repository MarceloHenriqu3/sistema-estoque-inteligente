using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

public class InventoryApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public InventoryApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Dashboard_WithoutToken_ReturnsUnauthorized()
    {
        using var client = _factory.CreateClient();

        var response = await client.GetAsync("/api/dashboard");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AdminLogin_WithValidCredentials_ReturnsTokenAndAllowsDashboard()
    {
        using var client = _factory.CreateClient();

        var login = await LoginAsync(client, "admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", login.Token);

        var response = await client.GetAsync("/api/dashboard");

        Assert.False(string.IsNullOrWhiteSpace(login.Token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Operator_CanManageStockButCannotManageUsers()
    {
        using var client = _factory.CreateClient();
        var adminLogin = await LoginAsync(client, "admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminLogin.Token);

        var suffix = Guid.NewGuid().ToString("N")[..8];
        var username = $"op_test_{suffix}";
        var createdUser = await CreateOperatorAsync(client, username, "temp123");

        var operatorLogin = await LoginAsync(client, username, "temp123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", operatorLogin.Token);

        var changedPassword = await client.PutAsJsonAsync($"/api/users/{createdUser.Id}/change-password", new
        {
            currentPassword = "temp123",
            newPassword = "nova123"
        });
        changedPassword.EnsureSuccessStatusCode();
        var operatorReady = await changedPassword.Content.ReadFromJsonAsync<LoginResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", operatorReady!.Token);

        var categoryResponse = await client.PostAsJsonAsync("/api/categories", new { name = $"Categoria Teste {suffix}" });
        var productResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = $"Produto Teste {suffix}",
            category = $"Categoria Teste {suffix}",
            price = 10,
            quantity = 5,
            minQuantity = 1,
            isActive = true
        });
        var usersResponse = await client.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Created, categoryResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, productResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, usersResponse.StatusCode);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminLogin.Token);
        await client.DeleteAsync($"/api/users/{createdUser.Id}");
    }

    [Fact]
    public async Task Movement_WithQuantityGreaterThanStock_ReturnsBadRequest()
    {
        using var client = _factory.CreateClient();
        var adminLogin = await LoginAsync(client, "admin", "admin123");
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", adminLogin.Token);

        var suffix = Guid.NewGuid().ToString("N")[..8];
        var productResponse = await client.PostAsJsonAsync("/api/products", new
        {
            name = $"Produto Estoque Baixo {suffix}",
            category = "Hardware",
            price = 1,
            quantity = 1,
            minQuantity = 1,
            isActive = true
        });
        productResponse.EnsureSuccessStatusCode();
        var product = await productResponse.Content.ReadFromJsonAsync<ProductResponse>();

        var movementResponse = await client.PostAsJsonAsync("/api/movements", new
        {
            productId = product!.Id,
            quantityChange = -2
        });

        Assert.Equal(HttpStatusCode.BadRequest, movementResponse.StatusCode);
    }

    private static async Task<LoginResponse> LoginAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/users/login", new { username, password });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<LoginResponse>())!;
    }

    private static async Task<UserResponse> CreateOperatorAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/users/register", new
        {
            username,
            name = "Operador Teste",
            role = "Operador",
            password
        });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UserResponse>())!;
    }

    private sealed record LoginResponse(
        int Id,
        string Username,
        string Name,
        string Role,
        bool IsActive,
        bool MustChangePassword,
        string Token);

    private sealed record UserResponse(int Id, string Username, string Name, string Role, bool MustChangePassword);

    private sealed record ProductResponse(int Id, string Name, int Quantity);
}
