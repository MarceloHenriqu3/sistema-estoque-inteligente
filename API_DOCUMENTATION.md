# 📖 Documentação Completa da API REST

## Base URL
```
http://localhost:5000
```

---

## 🔐 Autenticação

Quase todos os endpoints da API exigem autenticação JWT. Primeiro faça login:

```http
POST /api/users/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response (200):**
```json
{
  "id": 1,
  "username": "admin",
  "name": "Marcelo Henrique",
  "role": "Administrador",
  "isActive": true,
  "mustChangePassword": false,
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Use o token nas próximas requisições:

```http
Authorization: Bearer SEU_TOKEN_AQUI
```

Perfis:
- **Administrador:** gerencia usuários e também acessa as funções operacionais.
- **Operador:** acessa estoque, categorias, produtos, movimentações, histórico e IA.
- **Troca pendente:** usuário só pode alterar a própria senha até concluir o primeiro acesso.

Em produção, o backend exige a variável `INVENTORY_JWT_SECRET`. Sem ela, a API não inicia em ambiente `Production`.

---

## 📊 Dashboard

### GET /api/dashboard
Obtém KPIs do dashboard inicial.

**Request:**
```http
GET /api/dashboard
Authorization: Bearer SEU_TOKEN_AQUI
```

**Response (200):**
```json
{
  "totalProducts": 50,
  "critical": 5,
  "movementsToday": 12,
  "stockValue": 15420.50,
  "inactiveProducts": 2,
  "criticalProducts": [],
  "latestMovements": [],
  "criticalCategories": []
}
```

**Campos:**
- `totalProducts` (int): Total de produtos cadastrados
- `critical` (int): Produtos com estoque abaixo do mínimo
- `movementsToday` (int): Movimentações registradas hoje
- `stockValue` (decimal): Valor total do estoque ativo
- `inactiveProducts` (int): Produtos inativos
- `criticalProducts` (array): Produtos críticos prioritários
- `latestMovements` (array): Últimas movimentações
- `criticalCategories` (array): Categorias com itens críticos

---

## 🗂️ Categorias

### GET /api/categories
Lista categorias cadastradas.

Permissão: usuário autenticado com senha regular.

### POST /api/categories
Cria uma categoria.

Permissão: usuário autenticado com senha regular.

### PUT /api/categories/{id}
Atualiza uma categoria e reflete o novo nome nos produtos vinculados.

Permissão: usuário autenticado com senha regular.

### DELETE /api/categories/{id}
Exclui uma categoria, desde que ela não esteja em uso por produtos.

Permissão: usuário autenticado com senha regular.

### PUT /api/categories/{id}/active
Ativa ou desativa uma categoria sem apagar seu histórico.

Permissão: usuário autenticado com senha regular.

```http
PUT /api/categories/1/active
Content-Type: application/json

{
  "isActive": false
}
```

---

## 📦 Produtos

### GET /api/products
Lista produtos com paginação, filtros e busca.

**Request:**
```http
GET /api/products?page=1&pageSize=20&search=Notebook&category=Eletrônicos
```

**Query Parameters:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| page | int | Não | Número da página (padrão: 1) |
| pageSize | int | Não | Itens por página (padrão: 10, máx: 100) |
| search | string | Não | Busca por nome (case-insensitive) |
| category | string | Não | Filtro por categoria |

**Response (200):**
```json
{
  "total": 50,
  "page": 1,
  "pageSize": 20,
  "items": [
    {
      "id": 1,
      "name": "Notebook Dell",
      "quantity": 15,
      "minQuantity": 5,
      "isActive": true,
      "category": "Eletrônicos",
      "price": 3500.00
    },
    {
      "id": 2,
      "name": "Mouse Logitech",
      "quantity": 2,
      "minQuantity": 10,
      "isActive": true,
      "category": "Periféricos",
      "price": 150.00
    }
  ]
}
```

**Campos:**
- `total` (int): Total de produtos (ignorando paginação)
- `page` (int): Página atual
- `pageSize` (int): Itens por página
- `items` (array): Array de produtos

**Exemplo curl:**
```bash
curl "http://localhost:5000/api/products?page=1&pageSize=10&search=Notebook" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI"
```

---

### POST /api/products
Cria um novo produto.

Permissão: usuário autenticado com senha regular.

**Request:**
```http
POST /api/products
Content-Type: application/json

{
  "name": "Teclado Mecânico",
  "category": "Periféricos",
  "price": 450.00,
  "quantity": 20,
  "minQuantity": 5
}
```

**Request Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| name | string | Sim | Nome do produto (único) |
| category | string | Sim | Classificação do produto |
| price | decimal | Sim | Preço unitário (≥ 0) |
| quantity | int | Sim | Estoque inicial (≥ 0) |
| minQuantity | int | Sim | Nível crítico (≥ 0) |

**Response (201):**
```json
{
  "id": 10,
  "name": "Teclado Mecânico",
  "quantity": 20,
  "minQuantity": 5,
  "isActive": true,
  "category": "Periféricos",
  "price": 450.00
}
```

**Erros:**
- `400 Bad Request`: Validação falhou (nome duplicado, valores negativos)
- `500 Internal Server Error`: Erro de banco de dados

**Exemplo curl:**
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Monitor LG 27",
    "category": "Monitores",
    "price": 1200.00,
    "quantity": 8,
    "minQuantity": 2
  }'
```

---

### GET /api/products/{id}
Obtém detalhes de um produto específico.

**Request:**
```http
GET /api/products/1
```

**Response (200):**
```json
{
  "id": 1,
  "name": "Notebook Dell",
  "quantity": 15,
  "minQuantity": 5,
  "isActive": true,
  "category": "Eletrônicos",
  "price": 3500.00
}
```

**Erros:**
- `404 Not Found`: Produto não existe

---

### PUT /api/products/{id}
Atualiza um produto existente.

Permissão: usuário autenticado com senha regular.

**Request:**
```http
PUT /api/products/1
Content-Type: application/json

{
  "name": "Notebook Dell XPS",
  "category": "Eletrônicos",
  "price": 4000.00,
  "quantity": 15,
  "minQuantity": 3,
  "isActive": true
}
```

**Response (200):**
```json
{
  "id": 1,
  "name": "Notebook Dell XPS",
  "quantity": 15,
  "minQuantity": 3,
  "isActive": true,
  "category": "Eletrônicos",
  "price": 4000.00
}
```

---

### PUT /api/products/{id}/active
Ativa ou desativa um produto sem apagar o histórico.

Permissão: usuário autenticado com senha regular.

**Request:**
```http
PUT /api/products/1/active
Content-Type: application/json

{
  "isActive": false
}
```

**Response (200):**
Retorna o produto atualizado.

---

### GET /api/products/export
Exporta produtos em formato CSV.

**Request:**
```http
GET /api/products/export?search=termo&category=Eletrônicos
```

**Query Parameters:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| search | string | Não | Filtro de busca |
| category | string | Não | Filtro de categoria |

**Response (200):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="products.csv"

Id,Name,Category,Quantity,MinQuantity,Price,IsActive
1,Notebook Dell,Eletrônicos,15,5,3500.00,True
2,Mouse Logitech,Periféricos,2,10,150.00,True
```

**Exemplo curl:**
```bash
curl "http://localhost:5000/api/products/export?search=Notebook" \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" > products.csv
```

---

## 📝 Movimentações

### GET /api/movements
Lista movimentações com paginação e filtros.

**Request:**
```http
GET /api/movements?page=1&pageSize=20&productId=1&from=2026-05-25&to=2026-06-01
```

**Query Parameters:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| page | int | Não | Número da página (padrão: 1) |
| pageSize | int | Não | Itens por página (padrão: 10) |
| productId | int | Não | Filtro por produto |
| from | string (date) | Não | Data inicial (YYYY-MM-DD) |
| to | string (date) | Não | Data final (YYYY-MM-DD) |

**Response (200):**
```json
{
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "items": [
    {
      "id": 100,
      "productId": 1,
      "product": {
        "id": 1,
        "name": "Notebook Dell",
        "quantity": 15,
        "minQuantity": 5,
        "isActive": true,
        "category": "Eletrônicos",
        "price": 3500.00
      },
      "quantityChange": 5,
      "type": "IN",
      "timestamp": "2026-06-01T10:30:00",
      "operator": "João Silva"
    },
    {
      "id": 99,
      "productId": 2,
      "product": {
        "id": 2,
        "name": "Mouse Logitech",
        "quantity": 2,
        "minQuantity": 10,
        "isActive": true,
        "category": "Periféricos",
        "price": 150.00
      },
      "quantityChange": -1,
      "type": "OUT",
      "timestamp": "2026-06-01T09:15:00",
      "operator": "Maria Santos"
    }
  ]
}
```

---

### POST /api/movements
Registra uma nova movimentação.

**Request:**
```http
POST /api/movements
Content-Type: application/json

{
  "productId": 1,
  "quantityChange": 10
}
```

**Request Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| productId | int | Sim | ID do produto |
| quantityChange | int | Sim | Positivo para entrada, negativo para saída |

**Response (200):**
```json
{
  "id": 101,
  "productId": 1,
  "product": {
    "id": 1,
    "name": "Notebook Dell",
    "quantity": 25,
    "minQuantity": 5,
    "isActive": true,
    "category": "Eletrônicos",
    "price": 3500.00
  },
  "quantityChange": 10,
  "type": "IN",
  "timestamp": "2026-06-01T14:45:00",
  "operator": "Marcelo Henrique"
}
```

**Validações:**
- productId deve existir
- quantityChange não pode ser zero
- Produto inativo não recebe movimentações
- Saída não pode deixar estoque negativo
- Operador é obtido automaticamente pelo token JWT

**Erros:**
- `400 Bad Request`: Validação falhou
- `404 Not Found`: Produto não encontrado
- `500 Internal Server Error`: Erro ao atualizar estoque

**Exemplo curl:**
```bash
curl -X POST http://localhost:5000/api/movements \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "quantityChange": -3
  }'
```

---

## 📚 Histórico

### GET /api/history/{productId}
Obtém histórico de movimentações de um produto específico.

**Request:**
```http
GET /api/history/1
```

**Response (200):**
```json
[
  {
    "id": 105,
    "productId": 1,
    "quantityChange": -2,
    "type": "OUT",
    "timestamp": "2026-06-01T13:00:00",
    "operator": "Vendedor Carlos"
  },
  {
    "id": 104,
    "productId": 1,
    "quantityChange": 10,
    "type": "IN",
    "timestamp": "2026-06-01T10:30:00",
    "operator": "João Silva"
  }
]
```

**Parâmetros:**
| Parâmetro | Tipo | Obrigatório | Descrição |
|-----------|------|------------|-----------|
| productId | int | Sim | ID do produto (path parameter) |

---

## 🤖 Inteligência Artificial

### GET /api/ai/suggestions
Obtém sugestões de reabastecimento para produtos críticos.

**Request:**
```http
GET /api/ai/suggestions
```

**Response (200):**
```json
[
  {
    "id": 2,
    "name": "Mouse Logitech",
    "quantity": 2,
    "minQuantity": 10,
    "category": "Periféricos",
    "price": 150.00,
    "suggestedPurchase": 8,
    "estimatedCost": 1200.00
  },
  {
    "id": 5,
    "name": "Cabo USB-C",
    "quantity": 1,
    "minQuantity": 50,
    "category": "Cabos",
    "price": 25.00,
    "suggestedPurchase": 49,
    "estimatedCost": 1225.00
  }
]
```

**Campos:**
- `suggestedPurchase`: minQuantity - quantity (quantidade a comprar)
- `estimatedCost`: suggestedPurchase × price

---

### GET /api/ai/predict/{productId}
Prevê demanda futura com base no histórico de saídas.

**Request:**
```http
GET /api/ai/predict/1?days=15
```

**Response (200):**
```json
{
  "productId": 1,
  "horizonDays": 15,
  "predictedDailyOutflow": 1.8,
  "recommendedOrder": 22,
  "method": "ML.NET SDCA Regression",
  "daysWithOutflow": 9,
  "observationDays": 14,
  "confidencePercent": 84
}
```

**Campos:**
- `horizonDays`: horizonte de previsão solicitado
- `predictedDailyOutflow`: saída diária estimada
- `recommendedOrder`: quantidade recomendada para compra
- `method`: método usado, como média histórica ou ML.NET SDCA Regression
- `daysWithOutflow`: quantidade de dias com saída registrada
- `observationDays`: período observado
- `confidencePercent`: confiança estimada conforme volume de histórico

**Erros:**
- `404 Not Found`: Produto não encontrado

---

## 🧾 Auditoria e Backup

Endpoints disponíveis apenas para Administrador.

### GET /api/audit-logs
Lista os eventos de auditoria mais recentes.

```http
GET /api/audit-logs?page=1&pageSize=30
Authorization: Bearer SEU_TOKEN_ADMIN
```

Registra eventos como login, alteração de usuário, criação/edição de produto, movimentação de estoque, simulação de IA e backup.

### GET /api/backup/database
Baixa uma cópia completa do arquivo SQLite.

```http
GET /api/backup/database
Authorization: Bearer SEU_TOKEN_ADMIN
```

### GET /api/backup/export
Exporta os dados principais em JSON, incluindo produtos, categorias, movimentações, usuários sem hash de senha e logs de auditoria.

```http
GET /api/backup/export
Authorization: Bearer SEU_TOKEN_ADMIN
```

---

## 🔄 Códigos de Status HTTP

| Código | Significado |
|--------|------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado com sucesso |
| 204 | No Content - Ação executada (sem corpo de resposta) |
| 401 | Unauthorized - Token ausente ou inválido |
| 403 | Forbidden - Usuário sem permissão para a rota |
| 400 | Bad Request - Erro de validação |
| 404 | Not Found - Recurso não encontrado |
| 500 | Internal Server Error - Erro no servidor |
| 503 | Service Unavailable - Servidor temporariamente indisponível |

---

## 📌 Formato de Data/Hora

- **ISO 8601:** `2026-06-01T14:45:00`
- **Para filtros de data:** `YYYY-MM-DD`
- **Timezone:** UTC (usar offset local conforme necessário)

---

## 🔐 Segurança (Informações)

### Status Atual
- ✅ Autenticação obrigatória via JWT
- ✅ Rotas administrativas protegidas por perfil
- ✅ Senhas armazenadas com hash seguro PBKDF2
- ✅ Proteção contra SQL Injection (Entity Framework Core)
- ⚠️ Sem rate limiting
- ⚠️ Sem encriptação TLS (usar em produção com HTTPS)

### Recomendações
1. Configurar `INVENTORY_JWT_SECRET` em ambiente real
2. Implementar CORS com origin específico
3. Usar HTTPS em produção
4. Validar todas as entradas
5. Implementar rate limiting

---

## 📋 Exemplo de Fluxo Completo

### Cenário: Criar produto e registrar movimento

```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)

# 2. Criar produto
curl -X POST http://localhost:5000/api/products \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Webcam HD",
    "category": "Periféricos",
    "price": 200.00,
    "quantity": 10,
    "minQuantity": 2
  }'
# Response: { "id": 11, ... }

# 3. Listar produtos (verificar)
curl "http://localhost:5000/api/products?page=1&pageSize=5" \
  -H "Authorization: Bearer $TOKEN"

# 4. Registrar movimento (saída de 2 unidades)
curl -X POST http://localhost:5000/api/movements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 11,
    "quantityChange": -2
  }'
# Estoque reduz de 10 para 8

# 5. Consultar histórico
curl http://localhost:5000/api/history/11 \
  -H "Authorization: Bearer $TOKEN"

# 6. Buscar sugestões IA
curl http://localhost:5000/api/ai/suggestions \
  -H "Authorization: Bearer $TOKEN"

# 7. Prever demanda
curl "http://localhost:5000/api/ai/predict/11?days=15" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🧪 Teste com Postman

**Importar Collection:**
1. Abra Postman
2. Clique em "Import" → Selecione `Postman_Inventory_TCC_collection.json`
3. Clique em cada request e execute
4. Veja responses formatadas e salvas

---

## 📞 Troubleshooting de API

| Problema | Solução |
|----------|---------|
| 404 Not Found | Verifique URL exata e se recurso existe |
| 400 Bad Request | Valide JSON, tipos de dados, campos obrigatórios |
| 500 Error | Verifique logs do servidor (docker logs ou console) |
| Timeout | Aumente pageSize ou reduza intervalo de filtros |
| CORS Error | Adicione headers apropriados ou configure CORS backend |

---

**Versão:** 1.0  
**Data:** Junho 2026  
**Status:** Projeto Concluído
