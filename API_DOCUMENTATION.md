# 📖 Documentação Completa da API REST

## Base URL
```
http://localhost:5000
```

---

## 📊 Dashboard

### GET /api/dashboard
Obtém KPIs do dashboard inicial.

**Request:**
```http
GET /api/dashboard
```

**Response (200):**
```json
{
  "totalProducts": 50,
  "critical": 5,
  "movementsToday": 12,
  "aiSuggestionsCount": 3
}
```

**Campos:**
- `totalProducts` (int): Total de produtos cadastrados
- `critical` (int): Produtos com estoque abaixo do mínimo
- `movementsToday` (int): Movimentações registradas hoje
- `aiSuggestionsCount` (int): Produtos com sugestão de reabastecimento

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
curl "http://localhost:5000/api/products?page=1&pageSize=10&search=Notebook"
```

---

### POST /api/products
Cria um novo produto.

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

### DELETE /api/products/{id}
Deleta um produto (soft delete - marca como inativo).

**Request:**
```http
DELETE /api/products/1
```

**Response (204 No Content):**
(sem corpo)

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
curl "http://localhost:5000/api/products/export?search=Notebook" > products.csv
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
  "type": "IN",
  "quantityChange": 10,
  "operator": "João Silva"
}
```

**Request Body:**
| Campo | Tipo | Obrigatório | Descrição |
|-------|------|------------|-----------|
| productId | int | Sim | ID do produto |
| type | string | Sim | "IN" (entrada) ou "OUT" (saída) |
| quantityChange | int | Sim | Magnitude (sempre positivo, sinal é determinado por `type`) |
| operator | string | Não | Quem registrou (padrão: "System") |

**Response (201):**
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
  "operator": "João Silva"
}
```

**Validações:**
- productId deve existir
- quantityChange deve ser > 0
- type deve ser "IN" ou "OUT"
- Movimento OUT não pode deixar estoque negativo (opcional, implementação específica)

**Erros:**
- `400 Bad Request`: Validação falhou
- `404 Not Found`: Produto não encontrado
- `500 Internal Server Error`: Erro ao atualizar estoque

**Exemplo curl:**
```bash
curl -X POST http://localhost:5000/api/movements \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 1,
    "type": "OUT",
    "quantityChange": 3,
    "operator": "Vendedor João"
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
Prevê demanda futura com base em média móvel de 30 dias.

**Request:**
```http
GET /api/ai/predict/1
```

**Response (200):**
```json
{
  "productId": 1,
  "productName": "Notebook Dell",
  "totalMovementsLast30Days": 45,
  "outflowsCount": 15,
  "averageDailyOutflow": 0.5,
  "recommendedOrder": 15,
  "confidence": "medium",
  "analysis": "Baseado em 15 saídas em 30 dias = 0.5 por dia"
}
```

**Campos:**
- `totalMovementsLast30Days`: Total de movimentações (IN + OUT)
- `outflowsCount`: Apenas movimentações de saída (OUT)
- `averageDailyOutflow`: outflowsCount / 30
- `recommendedOrder`: averageDailyOutflow × 30 (estoque para 30 dias)
- `confidence`: "high" | "medium" | "low" (baseado em volume de dados)
- `analysis`: Descrição textual da análise

**Erros:**
- `404 Not Found`: Produto não encontrado

---

## 🔄 Códigos de Status HTTP

| Código | Significado |
|--------|------------|
| 200 | OK - Requisição bem-sucedida |
| 201 | Created - Recurso criado com sucesso |
| 204 | No Content - Ação executada (sem corpo de resposta) |
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
- ⚠️ Sem autenticação obrigatória
- ✅ Proteção contra SQL Injection (Entity Framework Core)
- ⚠️ Sem rate limiting
- ⚠️ Sem encriptação TLS (usar em produção com HTTPS)

### Recomendações
1. Adicionar autenticação JWT
2. Implementar CORS com origin específico
3. Usar HTTPS em produção
4. Validar todas as entradas
5. Implementar rate limiting

---

## 📋 Exemplo de Fluxo Completo

### Cenário: Criar produto e registrar movimento

```bash
# 1. Criar produto
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Webcam HD",
    "category": "Periféricos",
    "price": 200.00,
    "quantity": 10,
    "minQuantity": 2
  }'
# Response: { "id": 11, ... }

# 2. Listar produtos (verificar)
curl http://localhost:5000/api/products?page=1&pageSize=5

# 3. Registrar movimento (saída de 2 unidades)
curl -X POST http://localhost:5000/api/movements \
  -H "Content-Type: application/json" \
  -d '{
    "productId": 11,
    "type": "OUT",
    "quantityChange": 2,
    "operator": "Vendedor 1"
  }'
# Estoque reduz de 10 para 8

# 4. Consultar histórico
curl http://localhost:5000/api/history/11

# 5. Buscar sugestões IA
curl http://localhost:5000/api/ai/suggestions

# 6. Prever demanda
curl http://localhost:5000/api/ai/predict/11
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
