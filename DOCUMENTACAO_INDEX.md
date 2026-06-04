# 📑 Índice de Documentação - Sistema Estoque Inteligente

Bem-vindo! Este arquivo ajuda você a navegar por toda a documentação do projeto.

---

## 🎯 Começar Rápido

### 👤 Você é um **Usuário Final**?
- Leia: [**GUIA_USUARIO.md**](GUIA_USUARIO.md)
  - Como usar a aplicação
  - Explicação de cada abas
  - Dicas de uso
  - Troubleshooting básico

### 👨‍💻 Você é um **Desenvolvedor**?
- Leia: [**GUIA_DESENVOLVIMENTO.md**](GUIA_DESENVOLVIMENTO.md)
  - Setup local
  - Como adicionar endpoints
  - Como debugar
  - Como fazer deploy

### 🏗️ Você quer entender a **Arquitetura**?
- Leia: [**ARQUITETURA.md**](ARQUITETURA.md)
  - Visão geral do sistema
  - Modelos de dados
  - Stack tecnológico
  - Fluxos de dados

### 📚 Você precisa de **Referência de APIs**?
- Leia: [**API_DOCUMENTATION.md**](API_DOCUMENTATION.md)
  - Todos os endpoints
  - Exemplos de request/response
  - Parâmetros e validações
  - Códigos de erro

---

## 📁 Estrutura de Arquivos

```
TCC/
├── 📖 DOCUMENTACAO_INDEX.md          ← Você está aqui!
├── 📘 GUIA_USUARIO.md                Manual para usuários finais
├── 🛠️  GUIA_DESENVOLVIMENTO.md        Guia para desenvolvedores
├── 🏗️  ARQUITETURA.md                 Documentação técnica
├── 📚 API_DOCUMENTATION.md            Referência de APIs REST
├── 📋 README.md                       Setup rápido
├── 🧪 TESTS_CURL.md                  Exemplos de teste via curl
├── 📮 Postman_Inventory_TCC_collection.json  Collection Postman
│
├── server/                            Backend ASP.NET Core
│   ├── Program.cs                    Código principal (endpoints, modelos)
│   ├── InventoryApi.csproj           Arquivo de projeto .NET
│   ├── Dockerfile                    Build Docker
│   └── inventory.db                  SQLite database (criado em runtime)
│
├── client/                            Frontend Web
│   ├── index.html                    Interface (6 abas)
│   ├── app.js                        Lógica JavaScript
│   └── styles.css                    Estilos CSS
│
└── docker-compose.yml                 Orquestração de containers
```

---

## 🗂️ Documentação por Tópico

### Instalação & Setup
| Documento | Seção | Descrição |
|-----------|-------|-----------|
| README.md | How to Run | Instruções rápidas |
| GUIA_DESENVOLVIMENTO.md | Setup Local | Setup detalhado |
| ARQUITETURA.md | Deploy com Docker | Deploy em produção |

### Uso da Aplicação
| Documento | Seção | Descrição |
|-----------|-------|-----------|
| GUIA_USUARIO.md | Interface Principal | Navegação pelos 6 abas |
| GUIA_USUARIO.md | Entendendo os Dados | Status, badges, níveis críticos |
| GUIA_USUARIO.md | Exportar Dados | Como gerar CSV |

### Referência Técnica
| Documento | Seção | Descrição |
|-----------|-------|-----------|
| API_DOCUMENTATION.md | Endpoints | GET, POST, PUT, DELETE |
| API_DOCUMENTATION.md | Query Parameters | Filtros, paginação |
| ARQUITETURA.md | Modelo de Dados | Product, Movement entities |
| ARQUITETURA.md | Fluxo de Dados | Como dados fluem no sistema |

### Desenvolvimento & Extensão
| Documento | Seção | Descrição |
|-----------|-------|-----------|
| GUIA_DESENVOLVIMENTO.md | Tarefas Comuns | Adicionar endpoint, campo, filtro |
| GUIA_DESENVOLVIMENTO.md | Debugging | Logs, breakpoints, DevTools |
| GUIA_DESENVOLVIMENTO.md | Testes | Teste manual, automatizado |
| GUIA_DESENVOLVIMENTO.md | Segurança para Produção | Autenticação, HTTPS, CORS |

### Testes & Exemplos
| Documento | Descrição |
|-----------|-----------|
| TESTS_CURL.md | Exemplos de requisições curl |
| Postman_Inventory_TCC_collection.json | Collection Postman pronta para usar |

---

## 🚀 Fluxos Comuns

### Fluxo 1: Executar a Aplicação
```
1. Ler: README.md (How to Run)
2. Executar: docker compose up --build OU dotnet run
3. Acessar: http://localhost:5000
4. Usar: GUIA_USUARIO.md para navegar
```

### Fluxo 2: Testar um Endpoint
```
1. Ler: API_DOCUMENTATION.md (endpoint específico)
2. Opção A: Usar exemplos em TESTS_CURL.md
3. Opção B: Importar Postman_Inventory_TCC_collection.json no Postman
4. Testar e validar response
```

### Fluxo 3: Adicionar uma Nova Funcionalidade
```
1. Ler: GUIA_DESENVOLVIMENTO.md (Tarefas Comuns)
2. Escolher exemplo relevante (novo endpoint, campo, etc)
3. Seguir passos específicos
4. Testar localmente
5. Validar com Postman ou curl
```

### Fluxo 4: Debugar um Erro
```
1. Ler: GUIA_DESENVOLVIMENTO.md (Debugging)
2. Identificar: Frontend ou Backend?
3. Se Backend: usar logs, breakpoints, SQL
4. Se Frontend: usar DevTools (F12), console
5. Corrigir e testar
```

### Fluxo 5: Fazer Deploy em Produção
```
1. Ler: GUIA_DESENVOLVIMENTO.md (Deployment)
2. Ler: ARQUITETURA.md (Deploy com Docker)
3. Ler: GUIA_DESENVOLVIMENTO.md (Segurança para Produção)
4. Seguir checklist de segurança
5. Deploy com docker compose
```

---

## 💡 Dicas Rápidas

### Para Usuários
- 📖 Comece pelo **GUIA_USUARIO.md**
- 🎯 Procure sua seção específica (Dashboard, Consulta de Estoque, etc)
- 🆘 Use Troubleshooting se tiver problema

### Para Desenvolvedores
- 🛠️ Comece pelo **GUIA_DESENVOLVIMENTO.md** (Setup Local)
- 🏗️ Leia **ARQUITETURA.md** para entender a estrutura
- 📚 Consulte **API_DOCUMENTATION.md** enquanto desenvolve
- 🧪 Use **TESTS_CURL.md** + **Postman** para testar

### Para Arquitetos/Leads
- 🏗️ Comece por **ARQUITETURA.md** (Visão Geral)
- 📚 Leia **API_DOCUMENTATION.md** (Design dos endpoints)
- 📊 Estude o modelo de dados em **ARQUITETURA.md**
- 🔒 Revise segurança em **GUIA_DESENVOLVIMENTO.md**

---

## 📞 Encontrando Respostas

### Pergunta: "Como faço X?"
- ✅ Procure em **GUIA_USUARIO.md** (se for uso final)
- ✅ Procure em **GUIA_DESENVOLVIMENTO.md** (se for técnico)

### Pergunta: "Qual é a URL do endpoint Y?"
- ✅ Vá direto em **API_DOCUMENTATION.md**

### Pergunta: "Como funciona o fluxo X no sistema?"
- ✅ Consulte **ARQUITETURA.md** (Fluxo de Dados)

### Pergunta: "Como adiciono um novo campo?"
- ✅ Procure em **GUIA_DESENVOLVIMENTO.md** (Tarefas Comuns)

### Pergunta: "Onde fico com erro 404?"
- ✅ Consulte **API_DOCUMENTATION.md** (Troubleshooting de API)

### Pergunta: "Como debugo um problema?"
- ✅ Leia **GUIA_DESENVOLVIMENTO.md** (Debugging)

---

## 🔗 Relacionamentos de Documentação

```
README.md (entry point)
    ├─→ GUIA_USUARIO.md (como usar)
    ├─→ GUIA_DESENVOLVIMENTO.md (como estender)
    ├─→ ARQUITETURA.md (como funciona)
    └─→ API_DOCUMENTATION.md (referência técnica)

TESTS_CURL.md (exemplos práticos)
    └─→ API_DOCUMENTATION.md (referência completa)

Postman_Inventory_TCC_collection.json (teste visual)
    └─→ API_DOCUMENTATION.md (documentação de cada endpoint)
```

---

## ✅ Checklist de Leitura

### Primeira Vez (Usuário)
- [ ] README.md
- [ ] GUIA_USUARIO.md
- [ ] Testar aplicação

### Primeira Vez (Desenvolvedor)
- [ ] README.md
- [ ] GUIA_DESENVOLVIMENTO.md (Setup Local)
- [ ] ARQUITETURA.md
- [ ] Rodar localmente
- [ ] Testar com TESTS_CURL.md

### Primeira Vez (Arquiteto/Lead)
- [ ] README.md
- [ ] ARQUITETURA.md
- [ ] API_DOCUMENTATION.md
- [ ] GUIA_DESENVOLVIMENTO.md (Deployment, Segurança)

---

## 📊 Estatísticas da Documentação

| Documento | Páginas | Foco |
|-----------|---------|------|
| GUIA_USUARIO.md | ~8 | Usuários finais |
| GUIA_DESENVOLVIMENTO.md | ~15 | Developers |
| ARQUITETURA.md | ~12 | Arquitetos/Leads |
| API_DOCUMENTATION.md | ~20 | API Reference |
| README.md | ~2 | Quick Start |
| TESTS_CURL.md | ~3 | Exemplos |
| **TOTAL** | **~60** | Cobertura Completa |

---

## 🎓 Programas de Aprendizado

### Aprenda a Usar (2h)
1. README.md (5 min)
2. GUIA_USUARIO.md (30 min)
3. Explore a aplicação (1h 25 min)

### Aprenda a Desenvolver (4h)
1. README.md (5 min)
2. GUIA_DESENVOLVIMENTO.md - Setup (30 min)
3. ARQUITETURA.md (1h)
4. API_DOCUMENTATION.md (1h)
5. Desenvolva um novo endpoint (1h 25 min)

### Aprenda a Arquitetar (3h)
1. README.md (5 min)
2. ARQUITETURA.md (1h 30 min)
3. API_DOCUMENTATION.md (1h)
4. Discuta melhorias futuras (15 min)

---

## 🆘 Suporte Técnico

| Problema | Solução |
|----------|---------|
| Não consigo começar | Leia: README.md |
| Não entendo como usar | Leia: GUIA_USUARIO.md |
| Preciso adicionar uma função | Leia: GUIA_DESENVOLVIMENTO.md |
| Preciso entender arquitetura | Leia: ARQUITETURA.md |
| Preciso de referência de API | Leia: API_DOCUMENTATION.md |
| Quero testar manualmente | Leia: TESTS_CURL.md |

---

## 📌 Informações Gerais

- **Projeto**: Sistema Estoque Inteligente (TCC)
- **Versão**: 1.0
- **Status**: Concluído
- **Data**: Junho 2026
- **Stack**: ASP.NET Core 7 + SQLite + Vanilla JS
- **Documentação Última Atualização**: Junho 1, 2026

---

**Última atualização**: Junho 1, 2026  
**Próxima revisão**: Junho 2027 (ou conforme necessário)

---

## 🎉 Obrigado por ler!

Explore a documentação apropriada para seu papel e aproveite o sistema! 🚀
