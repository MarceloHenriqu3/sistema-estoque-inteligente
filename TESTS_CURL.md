# Testes rápidos com curl

Base usada nos exemplos:

```bash
BASE_URL=http://localhost:5000
```

No PowerShell, use:

```powershell
$BASE_URL = "http://localhost:5000"
```

## 1. Login e captura do token

### Bash
```bash
TOKEN=$(curl -s -X POST "$BASE_URL/api/users/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)
```

### PowerShell
```powershell
$login = Invoke-RestMethod -Uri "$BASE_URL/api/users/login" `
  -Method Post `
  -ContentType "application/json" `
  -Body '{"username":"admin","password":"admin123"}'

$TOKEN = $login.token
```

Todas as próximas chamadas protegidas usam:

```bash
-H "Authorization: Bearer $TOKEN"
```

## 2. Dashboard

```bash
curl "$BASE_URL/api/dashboard" \
  -H "Authorization: Bearer $TOKEN"
```

## 3. Listar produtos

```bash
curl "$BASE_URL/api/products?page=1&pageSize=20&search=Parafuso" \
  -H "Authorization: Bearer $TOKEN"
```

## 4. Criar produto

```bash
curl -X POST "$BASE_URL/api/products" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Exemplo Produto","category":"Periféricos","price":249.9,"quantity":100,"minQuantity":20,"isActive":true}'
```

## 5. Registrar movimentação

Quantidade positiva representa entrada. Quantidade negativa representa saída.

```bash
curl -X POST "$BASE_URL/api/movements" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"quantityChange":-5}'
```

O operador é identificado pelo token JWT, não pelo corpo da requisição.

## 6. Histórico detalhado de um produto

```bash
curl "$BASE_URL/api/history/1" \
  -H "Authorization: Bearer $TOKEN"
```

## 7. Sugestões de compra

```bash
curl "$BASE_URL/api/ai/suggestions" \
  -H "Authorization: Bearer $TOKEN"
```

## 8. Previsão para um produto

```bash
curl "$BASE_URL/api/ai/predict/1?days=15" \
  -H "Authorization: Bearer $TOKEN"
```

## 9. Exportar produtos em CSV

```bash
curl -o produtos.csv "$BASE_URL/api/products/export?search=Parafuso" \
  -H "Authorization: Bearer $TOKEN"
```

## 10. Testar proteção de rota

Sem token, uma rota protegida deve retornar `401 Unauthorized`:

```bash
curl -i "$BASE_URL/api/dashboard"
```

## Observações

- Substitua `localhost:5000` pela porta usada no `dotnet run`.
- Use `jq` para formatar JSON no Bash.
- No PowerShell, `Invoke-RestMethod` já converte JSON em objeto.
