Projeto TCC — Sistema de Estoque Inteligente

Servidor (ASP.NET Core + SQLite) e frontend simples (HTML/CSS/JS).

Como executar (requer .NET 7 SDK):

```powershell
cd "c:\Users\mh.soares\OneDrive - Grupo Unimetal\Área de Trabalho\faculdade\TCC\server"
dotnet restore
dotnet run
```

O servidor servirá a interface estática do cliente (pasta `client`) em `http://localhost:5000`.

Endpoints principais:
Frontend improvements:
The product form now sends `category` and `price` to the backend.
The stock view includes an "Exportar CSV" button which downloads the CSV from `/api/products/export`.
- `GET /api/ai/suggestions`, `GET /api/ai/predict/{productId}`
