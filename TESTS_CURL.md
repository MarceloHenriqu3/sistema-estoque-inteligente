Testes rápidos com curl para a API (assumindo `http://localhost:5000`)

1) Dashboard

```bash
curl http://localhost:5000/api/dashboard
```

2) Listar produtos

```bash
curl "http://localhost:5000/api/products?page=1&pageSize=20&search=Parafuso"
```

3) Criar produto

```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Exemplo Produto","category":"Periféricos","price":249.9,"quantity":100,"minQuantity":20,"isActive":true}'
```

4) Listar movimentações

```bash
curl "http://localhost:5000/api/movements?page=1&pageSize=20&productId=1&from=2026-05-25&to=2026-06-01"
```

5) Registrar movimentação (neg = saída, pos = entrada)

```bash
curl -X POST http://localhost:5000/api/movements \
  -H "Content-Type: application/json" \
  -d '{"productId":1,"quantityChange":-5}'
```

6) Histórico detalhado de um produto

```bash
curl http://localhost:5000/api/history/1
```

7) Sugestões de compra (IA stub)

```bash
curl http://localhost:5000/api/ai/suggestions
```

9) Exportar produtos em CSV

```bash
curl -o produtos.csv "http://localhost:5000/api/products/export?search=Parafuso"
```

8) Previsão simples para um produto

```bash
curl http://localhost:5000/api/ai/predict/1
```

Observações:
- Substitua `localhost:5000` pelo host/porta que estiver usando (no Docker mapeei para 5000:80).
- Use `jq` para formatar JSON nas saídas: `curl ... | jq`.
