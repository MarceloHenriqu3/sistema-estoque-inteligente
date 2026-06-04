// Client-side logic to integrate UI with API endpoints
// Pagination state
let productsPaginationState = { page: 1, pageSize: 10, total: 0 };
let movementsPaginationState = { page: 1, pageSize: 10, total: 0 };

async function fetchJson(url, opts) {
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function safeFetchText(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.text();
}

async function loadDashboard() {
  try {
    const d = await fetchJson('/api/dashboard');
    document.getElementById('kpi-total-products').innerText = d.totalProducts;
    document.getElementById('kpi-critical').innerText = d.critical;
    document.getElementById('kpi-movements-today').innerText = d.movementsToday;
  } catch (e) {
    console.error('Failed to load dashboard', e);
  }
}

async function loadProductsIntoTable() {
  try {
    const res = await fetch(`/api/products?page=${productsPaginationState.page}&pageSize=${productsPaginationState.pageSize}`);
    const data = await res.json();
    const products = data.items || data;
    productsPaginationState.total = data.total || 0;
    
    const tbody = document.querySelector('#tabelaEstoque tbody');
    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      const status = p.quantity <= p.minQuantity ? 'Crítico' : 'Estável';
      tr.setAttribute('data-categoria', p.category || '');
      tr.setAttribute('data-status', status);
      tr.innerHTML = `
        <td><code>PRD-${p.id.toString().padStart(3,'0')}</code></td>
        <td>${p.name}</td>
        <td>${p.category || '-'}</td>
        <td>${p.quantity}</td>
        <td>R$ ${(p.price || 0).toFixed(2)}</td>
        <td><span class="badge ${status==='Crítico'?'bg-danger':'bg-success'}">${status}</span></td>
      `;
      tbody.appendChild(tr);
    });

    // Render pagination controls
    renderProductsPaginationControls();

    // populate movement product select
    const select = document.getElementById('movProductSelect');
    select.innerHTML = '';
    products.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.name} (ID ${p.id})`;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error('Failed to load products', e);
  }
}

function renderProductsPaginationControls() {
  const div = document.getElementById('paginationEstoque');
  const totalPages = Math.ceil(productsPaginationState.total / productsPaginationState.pageSize);
  
  let html = '<button id="prodPrevBtn" class="pagination-btn">← Anterior</button>';
  html += `<span class="pagination-info">Página ${productsPaginationState.page} de ${totalPages}</span>`;
  html += '<button id="prodNextBtn" class="pagination-btn">Próximo →</button>';
  html += `<select id="prodPageSizeSelect" class="pagination-select"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option><option value="50">50</option></select>`;
  
  div.innerHTML = html;
  
  document.getElementById('prodPrevBtn').addEventListener('click', () => {
    if (productsPaginationState.page > 1) {
      productsPaginationState.page--;
      loadProductsIntoTable();
    }
  });
  
  document.getElementById('prodNextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(productsPaginationState.total / productsPaginationState.pageSize);
    if (productsPaginationState.page < totalPages) {
      productsPaginationState.page++;
      loadProductsIntoTable();
    }
  });
  
  document.getElementById('prodPageSizeSelect').addEventListener('change', (e) => {
    productsPaginationState.pageSize = parseInt(e.target.value, 10);
    productsPaginationState.page = 1;
    loadProductsIntoTable();
  });
  
  document.getElementById('prodPrevBtn').disabled = productsPaginationState.page <= 1;
  document.getElementById('prodNextBtn').disabled = productsPaginationState.page >= totalPages;
}

async function loadMovementsIntoHistory() {
  try {
    const res = await fetch(`/api/movements?page=${movementsPaginationState.page}&pageSize=${movementsPaginationState.pageSize}`);
    const data = await res.json();
    const items = data.items || data;
    movementsPaginationState.total = data.total || 0;
    
    const tbody = document.querySelector('#tabelaHistorico tbody');
    tbody.innerHTML = '';
    items.forEach(m => {
      const tr = document.createElement('tr');
      tr.setAttribute('data-tipo', m.type || (m.quantityChange>0? 'Entrada':'Saida'));
      const dt = new Date(m.timestamp || m.Timestamp || m.timestampUtc || Date.now());
      tr.innerHTML = `
        <td>${dt.toLocaleString()}</td>
        <td>${m.product?.name || m.productName || ('ID '+m.productId)}</td>
        <td><span class="badge ${m.type==='IN' || m.type==='Entrada' || m.quantityChange>0 ? 'bg-success':'bg-danger'}">${m.type || (m.quantityChange>0? 'Entrada':'Saida')}</span></td>
        <td>${Math.abs(m.quantityChange)}</td>
        <td>${m.operator || ''}</td>
      `;
      tbody.appendChild(tr);
    });

    // Render pagination controls
    renderMovementsPaginationControls();
  } catch (e) {
    console.error('Failed to load movements', e);
  }
}

function renderMovementsPaginationControls() {
  const div = document.getElementById('paginationHistorico');
  const totalPages = Math.ceil(movementsPaginationState.total / movementsPaginationState.pageSize);
  
  let html = '<button id="movPrevBtn" class="pagination-btn">← Anterior</button>';
  html += `<span class="pagination-info">Página ${movementsPaginationState.page} de ${totalPages}</span>`;
  html += '<button id="movNextBtn" class="pagination-btn">Próximo →</button>';
  html += `<select id="movPageSizeSelect" class="pagination-select"><option value="5">5</option><option value="10" selected>10</option><option value="20">20</option><option value="50">50</option></select>`;
  
  div.innerHTML = html;
  
  document.getElementById('movPrevBtn').addEventListener('click', () => {
    if (movementsPaginationState.page > 1) {
      movementsPaginationState.page--;
      loadMovementsIntoHistory();
    }
  });
  
  document.getElementById('movNextBtn').addEventListener('click', () => {
    const totalPages = Math.ceil(movementsPaginationState.total / movementsPaginationState.pageSize);
    if (movementsPaginationState.page < totalPages) {
      movementsPaginationState.page++;
      loadMovementsIntoHistory();
    }
  });
  
  document.getElementById('movPageSizeSelect').addEventListener('change', (e) => {
    movementsPaginationState.pageSize = parseInt(e.target.value, 10);
    movementsPaginationState.page = 1;
    loadMovementsIntoHistory();
  });
  
  document.getElementById('movPrevBtn').disabled = movementsPaginationState.page <= 1;
  document.getElementById('movNextBtn').disabled = movementsPaginationState.page >= totalPages;
}

async function loadAISuggestions() {
  try {
    const suggestions = await fetchJson('/api/ai/suggestions');
    document.getElementById('kpi-ai-suggestions').innerText = suggestions.length || 0;
    const orders = document.getElementById('ia-orders');
    orders.innerHTML = '';
    suggestions.forEach(s => {
      const li = document.createElement('li');
      li.style = 'background: rgba(245, 158, 11, 0.1); border: 1px solid var(--warning); padding: 0.75rem; border-radius: 0.375rem;';
      li.innerHTML = `⚠️ <strong>Comprar +${s.SuggestedPurchase || s.suggestedPurchase} unid:</strong> ${s.Name || s.name || ''}`;
      orders.appendChild(li);
    });

    // IA report and charts - try to call predict for first 3 products
    const productsRes = await fetch('/api/products?page=1&pageSize=10');
    const productsData = await productsRes.json();
    const products = productsData.items || productsData;
    const charts = document.getElementById('ia-charts');
    charts.innerHTML = '';
    for (let i=0;i<Math.min(3, products.length); i++) {
      const p = products[i];
      const pred = await fetchJson(`/api/ai/predict/${p.id}`);
      const percent = Math.round((pred.predictedDailyOutflow||0) * 10); // synthetic mapping
      const div = document.createElement('div');
      div.className = 'chart-row';
      div.innerHTML = `<span>${p.name}</span><div class="progress-track"><div class="progress-fill ${percent>50?'trending-up':'trending-down'}" style="width:${Math.min(100,percent)}%;"></div></div><span style="font-weight:600;color:${percent>50? '#34d399':'#f87171'}">${percent}%</span>`;
      charts.appendChild(div);
    }

    // health and report (placeholders)
    const health = Math.round(Math.random()*10)+90;
    document.getElementById('ia-health').innerText = `${health}%`;
    document.getElementById('ia-report').innerText = 'Relatório automático gerado com base nos padrões de movimentação e demanda. (Resumo automatizado)';

  } catch (e) {
    console.error('Failed to load AI data', e);
  }
}

function filtrarEstoque() {
  const searchValue = document.getElementById('searchEstoque').value.toLowerCase();
  const categoriaValue = document.getElementById('filterCategoria').value;
  const statusValue = document.getElementById('filterStatus').value;
  const rows = document.querySelectorAll('#tabelaEstoque tbody tr');

  rows.forEach(row => {
      const textMatch = row.innerText.toLowerCase().includes(searchValue);
      const categoriaMatch = categoriaValue === "" || row.getAttribute('data-categoria') === categoriaValue;
      const statusMatch = statusValue === "" || row.getAttribute('data-status') === statusValue;

      if (textMatch && categoriaMatch && statusMatch) {
          row.style.display = "";
      } else {
          row.style.display = "none";
      }
  });
}

function filtrarHistorico() {
  const searchValue = document.getElementById('searchHistorico').value.toLowerCase();
  const tipoValue = document.getElementById('filterTipoTransacao').value;
  const rows = document.querySelectorAll('#tabelaHistorico tbody tr');

  rows.forEach(row => {
      const textMatch = row.cells[1].innerText.toLowerCase().includes(searchValue);
      const tipoMatch = tipoValue === "" || row.getAttribute('data-tipo') === tipoValue;

      if (textMatch && tipoMatch) {
          row.style.display = "";
      } else {
          row.style.display = "none";
      }
  });
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => { if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active'); });
  const titles = {
    'dashboard': 'Dashboard Inicial',
    'cadastro-produto': 'Cadastrar Novo Produto',
    'estoque': 'Consulta e Filtro de Estoque Real',
    'movimentacao': 'Controle de Entrada e Saída via QR Code',
    'historico': 'Histórico e Auditoria de Logs',
    'ia-preditiva': 'Módulo Analítico e Inteligência Artificial'
  };
  document.getElementById('page-title').innerText = titles[tabId] || '';
}

document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadProductsIntoTable();
  loadMovementsIntoHistory();
  loadAISuggestions();

  // product registration
  document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('nomeProduto').value;
    const qty = parseInt(document.getElementById('qtdInicial').value||'0',10);
    const minQ = parseInt(document.getElementById('nivelCritico').value||'0',10);
    const category = document.getElementById('cadCategoria').value;
    const price = parseFloat(document.getElementById('precoUnitario').value || '0');
    try {
      await fetchJson('/api/products', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name, quantity: qty, minQuantity: minQ, isActive: true, category, price }) });
      alert('Produto cadastrado com sucesso');
      await loadProductsIntoTable();
      await loadDashboard();
    } catch (err) { alert('Erro ao cadastrar: '+err); }
  });

  // movement registration
  document.getElementById('movSubmitBtn').addEventListener('click', async () => {
    const productId = parseInt(document.getElementById('movProductSelect').value,10);
    const qty = parseInt(document.getElementById('movQtyInput').value||'0',10);
    const type = document.getElementById('movTypeSelect').value;
    const quantityChange = type === 'Entrada' ? qty : -qty;
    try {
      await fetchJson('/api/movements', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ productId, quantityChange }) });
      alert('Movimentação registrada');
      await loadProductsIntoTable();
      await loadMovementsIntoHistory();
      await loadDashboard();
    } catch (err) { alert('Erro ao registrar movimentação: '+err); }
  });

  // export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    const search = encodeURIComponent(document.getElementById('searchEstoque').value || '');
    const url = `/api/products/export?search=${search}`;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Falha ao exportar');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'produtos.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) { alert('Erro ao exportar CSV: '+e); }
  });
});

