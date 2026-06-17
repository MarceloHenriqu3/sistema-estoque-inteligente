// Client-side logic to integrate UI with API endpoints
// Pagination state
let productsPaginationState = { page: 1, pageSize: 10, total: 0 };
let movementsPaginationState = { page: 1, pageSize: 10, total: 0 };
let currentUser = null;
let pendingQrProductId = null;
let selectedQrProductId = null;
let publicAppBaseUrl = '';
let productCategories = [];
let systemUsers = [];
let auditLogs = [];
let selectedAdminUserId = null;
let movementProducts = [];
let inventoryProducts = [];
let kardexProducts = [];
let aiInsightsRefreshPromise = null;
const API_BASE_URL = window.location.protocol === 'file:' ? 'http://localhost:5123' : '';
const SESSION_USER_KEY = 'estoqueInteligente.currentUser';

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function formatProductCode(productId) {
  return `PRD-${productId.toString().padStart(3, '0')}`;
}

function getProductQrUrl(productId) {
  if (publicAppBaseUrl) {
    return `${publicAppBaseUrl}/index.html?produto=${productId}`;
  }

  if (window.location.protocol === 'file:') {
    return `${API_BASE_URL}/index.html?produto=${productId}`;
  }

  const url = new URL(window.location.href);
  url.pathname = url.pathname.endsWith('/') ? `${url.pathname}index.html` : url.pathname;
  url.search = `?produto=${productId}`;
  url.hash = '';
  return url.toString();
}

async function loadPublicAppBaseUrl() {
  try {
    const data = await fetchJson('/api/public-url');
    publicAppBaseUrl = data.baseUrl || '';
  } catch (err) {
    console.warn('Não foi possível carregar a URL pública do app.', err);
  }
}

function getProductIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const rawId = params.get('produto') || params.get('productId') || params.get('id');
  const productId = parseInt(rawId || '', 10);
  return Number.isInteger(productId) && productId > 0 ? productId : null;
}

function clearProductIdFromUrl() {
  if (!window.history?.replaceState || window.location.protocol === 'file:') return;

  const url = new URL(window.location.href);
  ['produto', 'productId', 'id'].forEach(param => url.searchParams.delete(param));
  window.history.replaceState({}, document.title, url.toString());
}

function escapeHtml(value) {
  return (value ?? '').toString().replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[char]));
}

function parseUtcDate(value) {
  if (!value) return new Date();
  const raw = value.toString();
  const hasTimezone = /z$|[+-]\d{2}:\d{2}$/i.test(raw);
  return new Date(hasTimezone ? raw : `${raw}Z`);
}

function isAdminUser() {
  return currentUser?.role?.toString().toLowerCase() === 'administrador';
}

function userMustChangePassword() {
  return Boolean(currentUser?.mustChangePassword || currentUser?.MustChangePassword);
}

function isAdminTab(tabId) {
  return ['register', 'usuarios'].includes(tabId);
}

function saveCurrentUserSession() {
  if (currentUser) {
    sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(currentUser));
  }
}

function restoreCurrentUserSession() {
  try {
    const storedUser = sessionStorage.getItem(SESSION_USER_KEY);
    currentUser = storedUser ? JSON.parse(storedUser) : null;
  } catch {
    currentUser = null;
    sessionStorage.removeItem(SESSION_USER_KEY);
  }
}

function clearCurrentUserSession() {
  sessionStorage.removeItem(SESSION_USER_KEY);
}

function updateAdminNav() {
  document.querySelectorAll('.admin-only').forEach(el => {
    if (isAdminUser()) {
      el.style.display = 'flex';
    } else {
      el.style.display = 'none';
    }
  });
}

function updateNavVisibility() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    const onclick = btn.getAttribute('onclick') || '';
    const match = onclick.match(/switchTab\('([^']+)'\)/);
    const tabId = match ? match[1] : '';
    if (tabId === 'login') {
      btn.style.display = currentUser ? 'none' : 'flex';
    } else if (isAdminTab(tabId)) {
      btn.style.display = isAdminUser() && !userMustChangePassword() ? 'flex' : 'none';
    } else {
      btn.style.display = currentUser && !userMustChangePassword() ? 'flex' : 'none';
    }
  });
  const logoutButton = document.getElementById('navLogout');
  if (logoutButton) {
    logoutButton.style.display = currentUser ? 'flex' : 'none';
  }
}

function logout() {
  currentUser = null;
  clearCurrentUserSession();
  document.getElementById('loginForm')?.reset();
  renderUserProfile();
  updateAdminNav();
  updateNavVisibility();
  switchTab('login');
  showMessage('Sessão encerrada. Faça login novamente.', 'success');
}

async function fetchJson(url, opts) {
  const res = await authFetch(url, opts);
  if (res.status === 401) {
    if (currentUser) {
      currentUser = null;
      clearCurrentUserSession();
      updateAdminNav();
      updateNavVisibility();
      switchTab('login');
    }
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (res.status === 403) {
    throw new Error('Seu perfil não tem permissão para acessar este recurso.');
  }
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

function getAuthHeaders(extra = {}) {
  const headers = { ...extra };
  const token = currentUser?.token || currentUser?.Token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

function authFetch(url, opts = {}) {
  const requestUrl = url.startsWith('http') ? url : apiUrl(url);
  return fetch(requestUrl, {
    ...opts,
    headers: getAuthHeaders(opts.headers || {})
  });
}

function adminHeaders(extra = {}) {
  return getAuthHeaders(extra);
}

async function safeFetchText(url) {
  const res = await authFetch(url);
  if (!res.ok) return null;
  return res.text();
}

async function loadDashboard() {
  try {
    const d = await fetchJson('/api/dashboard');
    document.getElementById('kpi-total-products').innerText = d.totalProducts;
    document.getElementById('kpi-critical').innerText = d.critical;
    document.getElementById('kpi-movements-today').innerText = d.movementsToday;
    document.getElementById('kpi-stock-value').innerText = formatCurrency(d.stockValue || 0);
    document.getElementById('kpi-inactive-products').innerText = d.inactiveProducts || 0;
    renderCriticalStockAlert(d.critical || 0, d.criticalProducts || []);
    renderDashboardCriticalProducts(d.criticalProducts || []);
    renderDashboardLatestMovements(d.latestMovements || []);
    renderDashboardCriticalCategories(d.criticalCategories || []);
  } catch (e) {
    console.error('Failed to load dashboard', e);
  }
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

function renderCriticalStockAlert(criticalCount, criticalProducts) {
  const alert = document.getElementById('criticalStockAlert');
  if (!alert) return;

  if (!criticalCount) {
    alert.style.display = 'none';
    alert.innerHTML = '';
    return;
  }

  const productNames = criticalProducts
    .slice(0, 3)
    .map(product => escapeHtml(product.name))
    .join(', ');
  const suffix = criticalCount > 3 ? ` e mais ${criticalCount - 3}` : '';
  alert.style.display = 'flex';
  alert.innerHTML = `
    <div>
      <strong>${criticalCount} produto(s) precisam de reposição</strong>
      <span>${productNames ? `Prioridade: ${productNames}${suffix}.` : 'Verifique a lista de produtos críticos.'}</span>
    </div>
    <button type="button" onclick="openCriticalStockFilter()">Ver Estoque</button>
  `;
}

function openCriticalStockFilter() {
  switchTab('estoque');
  const search = document.getElementById('searchEstoque');
  const category = document.getElementById('filterCategoria');
  const status = document.getElementById('filterStatus');
  const active = document.getElementById('filterAtivo');
  if (search) search.value = '';
  if (category) category.value = '';
  if (status) status.value = 'Crítico';
  if (active) active.value = 'active';
  productsPaginationState.page = 1;
  loadProductsIntoTable();
}

function renderEmptyDashboardList(targetId, message) {
  const target = document.getElementById(targetId);
  if (!target) return;
  target.innerHTML = `<div class="dashboard-empty">${message}</div>`;
}

function renderDashboardCriticalProducts(products) {
  const target = document.getElementById('dashboard-critical-products');
  if (!target) return;

  if (!products.length) {
    renderEmptyDashboardList('dashboard-critical-products', 'Nenhum produto crítico no momento.');
    return;
  }

  target.innerHTML = products.map(product => `
    <div class="dashboard-list-item">
      <div>
        <strong>${escapeHtml(product.name)}</strong>
        <span>${escapeHtml(product.category || 'Sem categoria')}</span>
      </div>
      <div class="dashboard-metric danger">
        <strong>${product.quantity}/${product.minQuantity}</strong>
        <span>faltam ${product.missing}</span>
      </div>
    </div>
  `).join('');
}

function renderDashboardLatestMovements(movements) {
  const target = document.getElementById('dashboard-latest-movements');
  if (!target) return;

  if (!movements.length) {
    renderEmptyDashboardList('dashboard-latest-movements', 'Nenhuma movimentação registrada.');
    return;
  }

  target.innerHTML = movements.map(movement => {
    const typeDisplay = normalizeMovementType(movement.type || (movement.quantityChange > 0 ? 'Entrada' : 'Saida'));
    const dt = parseUtcDate(movement.timestamp);
    return `
      <div class="dashboard-list-item">
        <div>
          <strong>${escapeHtml(movement.productName || 'Produto')}</strong>
          <span>${dt.toLocaleString()} · ${escapeHtml(movement.operator || 'Sistema')}</span>
        </div>
        <div class="dashboard-metric ${typeDisplay === 'Entrada' ? 'success' : 'danger'}">
          <strong>${typeDisplay}</strong>
          <span>${Math.abs(movement.quantityChange)} un.</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderDashboardCriticalCategories(categories) {
  const target = document.getElementById('dashboard-critical-categories');
  if (!target) return;

  if (!categories.length) {
    renderEmptyDashboardList('dashboard-critical-categories', 'Nenhuma categoria com itens críticos.');
    return;
  }

  target.innerHTML = categories.map(category => `
    <div class="dashboard-list-item">
      <div>
        <strong>${escapeHtml(category.category)}</strong>
        <span>Produtos abaixo do mínimo</span>
      </div>
      <div class="dashboard-metric warning">
        <strong>${category.count}</strong>
        <span>item(ns)</span>
      </div>
    </div>
  `).join('');
}

function renderCategoryOptions() {
  const productCategorySelect = document.getElementById('cadCategoria');
  const filterCategorySelect = document.getElementById('filterCategoria');
  const currentProductCategory = productCategorySelect?.value || '';
  const currentFilterCategory = filterCategorySelect?.value || '';

  if (productCategorySelect) {
    productCategorySelect.innerHTML = '';
    const productCategoryOptions = productCategories.filter(category =>
      category.isActive || category.name === currentProductCategory
    );

    productCategoryOptions.forEach(category => {
      const opt = document.createElement('option');
      opt.value = category.name;
      opt.textContent = category.isActive ? category.name : `${category.name} (inativa)`;
      productCategorySelect.appendChild(opt);
    });

    if (productCategoryOptions.some(category => category.name === currentProductCategory)) {
      productCategorySelect.value = currentProductCategory;
    }
  }

  if (filterCategorySelect) {
    filterCategorySelect.innerHTML = '<option value="">Todas as Categorias</option>';
    productCategories.forEach(category => {
      const opt = document.createElement('option');
      opt.value = category.name;
      opt.textContent = category.name;
      filterCategorySelect.appendChild(opt);
    });

    if (productCategories.some(category => category.name === currentFilterCategory)) {
      filterCategorySelect.value = currentFilterCategory;
    }
  }
}

function renderCategoriesTable() {
  const tbody = document.querySelector('#tabelaCategorias tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  productCategories.forEach(category => {
    const tr = document.createElement('tr');
    const isActive = category.isActive !== false;
    tr.innerHTML = `
      <td data-label="ID">${category.id}</td>
      <td data-label="Categoria">${escapeHtml(category.name)}</td>
      <td data-label="Status"><span class="badge ${isActive ? 'bg-success' : 'bg-muted'}">${isActive ? 'Ativa' : 'Inativa'}</span></td>
      <td data-label="Ações">
        <div class="table-actions">
          <button type="button" class="btn-table-action primary" onclick="editarCategoria(${category.id})">Editar</button>
          <button type="button" class="btn-table-action ${isActive ? 'danger' : 'success'}" onclick="alterarStatusCategoria(${category.id}, ${!isActive})">${isActive ? 'Desativar' : 'Ativar'}</button>
          <button type="button" class="btn-table-action danger" onclick="excluirCategoria(${category.id})">Excluir</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!productCategories.length) {
    tbody.innerHTML = '<tr><td colspan="4">Nenhuma categoria cadastrada.</td></tr>';
  }
}

async function loadCategories() {
  try {
    productCategories = await fetchJson('/api/categories');
    renderCategoryOptions();
    renderCategoriesTable();
  } catch (e) {
    console.error('Failed to load categories', e);
  }
}

function getProductFilterParams() {
  const search = document.getElementById('searchEstoque').value || '';
  const category = document.getElementById('filterCategoria').value || '';
  const status = document.getElementById('filterStatus').value || '';
  const activeStatus = document.getElementById('filterAtivo').value || '';
  const query = new URLSearchParams({
    page: productsPaginationState.page,
    pageSize: productsPaginationState.pageSize,
    search,
    category,
    status,
    activeStatus
  });
  return query.toString();
}

function showMessage(text, type = 'success') {
  const messageEl = document.getElementById('feedbackMessage');
  if (!messageEl) {
    alert(text);
    return;
  }

  messageEl.textContent = text;
  messageEl.className = `feedback-message visible ${type}`;
  clearTimeout(showMessage.timeoutId);
  showMessage.timeoutId = setTimeout(() => {
    messageEl.classList.remove('visible');
  }, 4000);
}

function renderUserProfile() {
  const profileBox = document.querySelector('.user-profile');
  const profileName = document.getElementById('profileName');
  const profileRole = document.getElementById('profileRole');
  if (!profileName || !profileRole) return;

  if (currentUser) {
    if (profileBox) profileBox.style.display = 'flex';
    profileName.textContent = currentUser.name || currentUser.username;
    profileRole.textContent = currentUser.role?.toUpperCase() || 'USUÁRIO';
  } else {
    if (profileBox) profileBox.style.display = 'none';
    profileName.textContent = '';
    profileRole.textContent = '';
  }
}

async function continueAfterPasswordReady() {
  if (pendingQrProductId) {
    await loadAuthenticatedData();
    const productId = pendingQrProductId;
    pendingQrProductId = null;
    clearProductIdFromUrl();
    await abrirProdutoPorQRCode(productId);
  } else {
    switchTab('dashboard');
    loadAuthenticatedData();
  }
}

async function loadAuthenticatedData() {
  if (!currentUser || userMustChangePassword()) return;
  await Promise.all([
    loadCategories(),
    loadDashboard(),
    loadProductsIntoTable(),
    loadMovementsIntoHistory()
  ]);
  refreshAiInsightsInBackground();
}

async function loadProductsIntoTable() {
  try {
    const query = getProductFilterParams();
    const res = await authFetch(`/api/products?${query}`);
    const data = await res.json();
    const products = data.items || data;
    productsPaginationState.total = data.total || products.length || 0;
    
    const tbody = document.querySelector('#tabelaEstoque tbody');
    tbody.innerHTML = '';
    products.forEach(p => {
      const tr = document.createElement('tr');
      const status = p.quantity <= p.minQuantity ? 'Crítico' : 'Estável';
      const activeStatus = p.isActive ? 'Ativo' : 'Inativo';
      const productCode = formatProductCode(p.id);
      tr.setAttribute('data-categoria', p.category || '');
      tr.setAttribute('data-status', status);
      tr.setAttribute('data-ativo', p.isActive ? 'active' : 'inactive');
      tr.innerHTML = `
        <td data-label="Código"><code>${productCode}</code></td>
        <td data-label="Produto">${escapeHtml(p.name)}</td>
        <td data-label="Categoria">${escapeHtml(p.category || '-')}</td>
        <td data-label="Qtd">${p.quantity}</td>
        <td data-label="Preço">R$ ${(p.price || 0).toFixed(2)}</td>
        <td data-label="Estoque"><span class="badge ${status==='Crítico'?'bg-danger':'bg-success'}">${status}</span></td>
        <td data-label="Status"><span class="badge ${p.isActive ? 'bg-success' : 'bg-muted'}">${activeStatus}</span></td>
        <td data-label="Ações">
          <div class="table-actions">
            <button type="button" class="btn-table-action primary" onclick="editarProduto(${p.id})">Editar</button>
            <button type="button" class="btn-table-action" onclick="abrirQRCodeProduto(${p.id})">QR Code</button>
            <button type="button" class="btn-table-action ${p.isActive ? 'danger' : 'success'}" onclick="alterarStatusProduto(${p.id}, ${!p.isActive})">${p.isActive ? 'Desativar' : 'Reativar'}</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Apply local filters to rendered rows in case backend isn't filtering yet
    applyProductFiltersToRenderedRows();

    // Render pagination controls
    renderProductsPaginationControls();

    await loadProductsIntoMovementSelect();
  } catch (e) {
    console.error('Failed to load products', e);
  }
}

async function loadProductsIntoMovementSelect() {
  try {
    const data = await fetchJson('/api/products?page=1&pageSize=1000&activeStatus=active');
    movementProducts = data.items || data;
    renderMovementProductOptions();
  } catch (e) {
    console.error('Failed to load movement products', e);
  }
}

async function loadInventoryProducts() {
  try {
    inventoryProducts = await fetchJson('/api/inventory/products');
    renderInventoryTable();
    renderKardexProductOptions();
  } catch (err) {
    showMessage('Erro ao carregar inventário: ' + err.message, 'error');
  }
}

function getInventoryFilteredProducts() {
  const searchValue = (document.getElementById('inventorySearch')?.value || '').toLowerCase().trim();
  if (!searchValue) return inventoryProducts;

  return inventoryProducts.filter(product => {
    const code = formatProductCode(product.id).toLowerCase();
    return code.includes(searchValue)
      || (product.name || '').toLowerCase().includes(searchValue)
      || (product.category || '').toLowerCase().includes(searchValue);
  });
}

function renderInventoryTable() {
  const tbody = document.querySelector('#tabelaInventario tbody');
  if (!tbody) return;

  const products = getInventoryFilteredProducts();
  tbody.innerHTML = '';
  products.forEach(product => {
    const tr = document.createElement('tr');
    tr.dataset.productId = product.id;
    tr.dataset.currentQuantity = product.quantity;
    tr.innerHTML = `
      <td data-label="Código"><code>${formatProductCode(product.id)}</code></td>
      <td data-label="Produto">${escapeHtml(product.name)}</td>
      <td data-label="Categoria">${escapeHtml(product.category || '-')}</td>
      <td data-label="Sistema">${product.quantity}</td>
      <td data-label="Contagem"><input type="number" class="form-control inventory-count-input" min="0" value="${product.quantity}" data-product-id="${product.id}"></td>
      <td data-label="Diferença"><span class="inventory-diff">0</span></td>
    `;
    tbody.appendChild(tr);
  });

  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum produto encontrado para inventário.</td></tr>';
  }

  document.querySelectorAll('.inventory-count-input').forEach(input => {
    input.addEventListener('input', updateInventoryDiffs);
  });
  updateInventoryDiffs();
}

function updateInventoryDiffs() {
  let listed = 0;
  let diffs = 0;
  let net = 0;

  document.querySelectorAll('#tabelaInventario tbody tr').forEach(row => {
    const input = row.querySelector('.inventory-count-input');
    const diffEl = row.querySelector('.inventory-diff');
    if (!input || !diffEl) return;

    listed++;
    const currentQuantity = parseInt(row.dataset.currentQuantity || '0', 10);
    const countedQuantity = parseInt(input.value || '0', 10);
    const diff = countedQuantity - currentQuantity;
    net += diff;
    if (diff !== 0) diffs++;
    diffEl.textContent = diff > 0 ? `+${diff}` : diff.toString();
    diffEl.className = `inventory-diff ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : ''}`;
  });

  document.getElementById('inventorySummaryProducts').textContent = listed;
  document.getElementById('inventorySummaryDiffs').textContent = diffs;
  document.getElementById('inventorySummaryNet').textContent = net > 0 ? `+${net}` : net;
}

async function applyInventoryAdjustments() {
  const items = Array.from(document.querySelectorAll('.inventory-count-input'))
    .map(input => ({
      productId: parseInt(input.dataset.productId, 10),
      countedQuantity: parseInt(input.value || '0', 10),
      currentQuantity: parseInt(input.closest('tr')?.dataset.currentQuantity || '0', 10)
    }))
    .filter(item => item.productId && item.countedQuantity !== item.currentQuantity)
    .map(({ productId, countedQuantity }) => ({ productId, countedQuantity }));

  if (!items.length) {
    showMessage('Nenhuma divergência para ajustar.', 'success');
    return;
  }

  if (!confirm(`Aplicar ${items.length} ajuste(s) de inventário ao estoque?`)) return;

  try {
    const result = await fetchJson('/api/inventory/adjustments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items,
        notes: document.getElementById('inventoryNotes')?.value || ''
      })
    });
    showMessage(`Inventário aplicado: ${result.adjusted} produto(s) ajustado(s).`, 'success');
    document.getElementById('inventoryNotes').value = '';
    await loadInventoryProducts();
    await loadProductsIntoTable();
    await loadMovementsIntoHistory();
    await loadDashboard();
  } catch (err) {
    showMessage('Erro ao aplicar inventário: ' + err.message, 'error');
  }
}

function renderKardexProductOptions() {
  const select = document.getElementById('kardexProductSelect');
  if (!select) return;

  const currentValue = select.value;
  kardexProducts = inventoryProducts.length ? inventoryProducts : movementProducts;
  select.innerHTML = '';
  kardexProducts.forEach(product => {
    const opt = document.createElement('option');
    opt.value = product.id;
    opt.textContent = `${product.name} (${formatProductCode(product.id)})`;
    select.appendChild(opt);
  });
  if (currentValue && Array.from(select.options).some(option => option.value === currentValue)) {
    select.value = currentValue;
  }
}

function getKardexQueryParams() {
  const query = new URLSearchParams();
  const productId = document.getElementById('kardexProductSelect')?.value || '';
  const from = document.getElementById('kardexFrom')?.value || '';
  const to = document.getElementById('kardexTo')?.value || '';
  if (productId) query.set('productId', productId);
  if (from) {
    const [year, month, day] = from.split('-').map(Number);
    query.set('from', new Date(year, month - 1, day, 0, 0, 0).toISOString());
  }
  if (to) {
    const [year, month, day] = to.split('-').map(Number);
    query.set('to', new Date(year, month - 1, day + 1, 0, 0, 0).toISOString());
  }
  return query.toString();
}

async function loadKardex() {
  try {
    if (!document.getElementById('kardexProductSelect')?.value) {
      await loadInventoryProducts();
    }

    const query = getKardexQueryParams();
    if (!query.includes('productId=')) {
      document.querySelector('#tabelaKardex tbody').innerHTML = '<tr><td colspan="7">Selecione um produto para consultar o Kardex.</td></tr>';
      return;
    }

    const data = await fetchJson(`/api/kardex?${query}`);
    const rows = data.rows || [];
    const totalIn = rows.reduce((sum, row) => sum + Number(row.quantityIn || 0), 0);
    const totalOut = rows.reduce((sum, row) => sum + Number(row.quantityOut || 0), 0);

    document.getElementById('kardexOpeningBalance').textContent = data.openingBalance ?? 0;
    document.getElementById('kardexTotalIn').textContent = totalIn;
    document.getElementById('kardexTotalOut').textContent = totalOut;
    document.getElementById('kardexCurrentBalance').textContent = data.currentBalance ?? 0;

    const tbody = document.querySelector('#tabelaKardex tbody');
    tbody.innerHTML = rows.map(row => {
      const typeDisplay = normalizeMovementType(row.type || (row.quantityChange > 0 ? 'Entrada' : 'Saida'));
      const dt = parseUtcDate(row.timestamp);
      return `
        <tr>
          <td data-label="Data">${dt.toLocaleString()}</td>
          <td data-label="Produto">${escapeHtml(data.product?.name || '-')}</td>
          <td data-label="Tipo"><span class="badge ${typeDisplay === 'Entrada' ? 'bg-success' : typeDisplay === 'Ajuste' ? 'bg-warning' : 'bg-danger'}">${typeDisplay}</span></td>
          <td data-label="Entrada">${row.quantityIn || 0}</td>
          <td data-label="Saída">${row.quantityOut || 0}</td>
          <td data-label="Saldo">${row.balanceAfter}</td>
          <td data-label="Operador">${escapeHtml(row.operator || 'Sistema')}</td>
        </tr>
      `;
    }).join('');

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7">Nenhuma movimentação encontrada para o período.</td></tr>';
    }
  } catch (err) {
    showMessage('Erro ao carregar Kardex: ' + err.message, 'error');
  }
}

function renderMovementProductOptions() {
    const select = document.getElementById('movProductSelect');
    const searchValue = (document.getElementById('movProductSearch')?.value || '').toLowerCase().trim();
    select.innerHTML = '';

    const filteredProducts = movementProducts.filter(p => {
      if (!searchValue) return true;
      const productCode = formatProductCode(p.id).toLowerCase();
      return p.name.toLowerCase().includes(searchValue)
        || p.id.toString().includes(searchValue)
        || productCode.includes(searchValue);
    });

    filteredProducts.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.dataset.quantity = p.quantity;
      opt.dataset.category = p.category || '';
      opt.dataset.minQuantity = p.minQuantity;
      opt.dataset.price = p.price || 0;
      opt.textContent = `${p.name} (${formatProductCode(p.id)})`;
      select.appendChild(opt);
    });

    if (!filteredProducts.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = movementProducts.length ? 'Nenhum produto encontrado' : 'Nenhum produto ativo disponível';
      select.appendChild(opt);
    }
    updateMovementProductPanel();
}

async function selectMovementProductById(productId) {
  if (!movementProducts.some(product => product.id === productId)) {
    await loadProductsIntoMovementSelect();
  }

  const search = document.getElementById('movProductSearch');
  const select = document.getElementById('movProductSelect');
  if (search) {
    search.value = '';
    renderMovementProductOptions();
  }

  if (select && Array.from(select.options).some(option => option.value === productId.toString())) {
    select.value = productId.toString();
    updateMovementProductPanel();
    return true;
  }

  return false;
}

function getSelectedMovementProductData() {
  const select = document.getElementById('movProductSelect');
  const option = select?.options[select.selectedIndex];
  if (!option || !option.value) return null;

  return {
    id: parseInt(option.value, 10),
    category: option.dataset.category || '-',
    quantity: parseInt(option.dataset.quantity || '0', 10),
    minQuantity: parseInt(option.dataset.minQuantity || '0', 10),
    price: parseFloat(option.dataset.price || '0')
  };
}

function updateMovementProductPanel() {
  const product = getSelectedMovementProductData();
  const warning = document.getElementById('movementWarning');

  if (!product) {
    document.getElementById('movProductCategory').textContent = '—';
    document.getElementById('movProductQuantity').textContent = '—';
    document.getElementById('movProductMinQuantity').textContent = '—';
    document.getElementById('movProductStatus').textContent = '—';
    document.getElementById('movProductPrice').textContent = '—';
    warning.style.display = 'none';
    warning.textContent = '';
    return;
  }

  const status = product.quantity <= product.minQuantity ? 'Crítico' : 'Estável';
  document.getElementById('movProductCategory').textContent = product.category;
  document.getElementById('movProductQuantity').textContent = product.quantity;
  document.getElementById('movProductMinQuantity').textContent = product.minQuantity;
  document.getElementById('movProductStatus').textContent = status;
  document.getElementById('movProductPrice').textContent = formatCurrency(product.price);

  const type = document.getElementById('movTypeSelect').value;
  const qty = parseInt(document.getElementById('movQtyInput').value || '0', 10);
  const projectedQuantity = type === 'Saida' ? product.quantity - qty : product.quantity + qty;

  if (type === 'Saida' && qty > 0 && projectedQuantity <= product.minQuantity) {
    warning.textContent = `Atenção: após esta saída, o estoque ficará em ${projectedQuantity} unidade(s), dentro do nível crítico.`;
    warning.style.display = 'block';
  } else {
    warning.style.display = 'none';
    warning.textContent = '';
  }
}

function renderProductsPaginationControls() {
  const div = document.getElementById('paginationEstoque');
  const totalPages = Math.ceil(productsPaginationState.total / productsPaginationState.pageSize);
  
  const selected = productsPaginationState.pageSize;
  let html = '<button id="prodPrevBtn" class="pagination-btn">← Anterior</button>';
  html += `<span class="pagination-info">Página ${productsPaginationState.page} de ${totalPages}</span>`;
  html += '<button id="prodNextBtn" class="pagination-btn">Próximo →</button>';
  html += `<select id="prodPageSizeSelect" class="pagination-select"><option value="5" ${selected===5?'selected':''}>5</option><option value="10" ${selected===10?'selected':''}>10</option><option value="20" ${selected===20?'selected':''}>20</option><option value="50" ${selected===50?'selected':''}>50</option></select>`;
  
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

function normalizeMovementType(type) {
  if (!type) return '';
  const raw = type.toString().toLowerCase();
  if (raw.includes('adjust') || raw.includes('invent')) return 'Ajuste';
  if (raw.includes('in')) return 'Entrada';
  if (raw.includes('out') || raw.includes('saída') || raw.includes('saida')) return 'Saida';
  if (raw.includes('entrada')) return 'Entrada';
  if (raw.includes('saida') || raw.includes('saída')) return 'Saida';
  return type;
}

function getMovementFilterParams(includePagination = true) {
  const query = new URLSearchParams();
  if (includePagination) {
    query.set('page', movementsPaginationState.page);
    query.set('pageSize', movementsPaginationState.pageSize);
  }

  const search = document.getElementById('searchHistorico').value || '';
  const type = document.getElementById('filterTipoTransacao').value || '';
  const operatorName = document.getElementById('filterOperadorHistorico').value || '';
  const movementDate = document.getElementById('filterDataMovimentacaoHistorico').value || '';

  if (search) query.set('search', search);
  if (type) query.set('type', type);
  if (operatorName) query.set('operatorName', operatorName);
  if (movementDate) {
    const [year, month, day] = movementDate.split('-').map(Number);
    const localStart = new Date(year, month - 1, day, 0, 0, 0);
    const localEnd = new Date(year, month - 1, day + 1, 0, 0, 0);
    query.set('from', localStart.toISOString());
    query.set('to', localEnd.toISOString());
  }
  return query.toString();
}

async function loadMovementsIntoHistory() {
  try {
    await loadMovementSummary();
    const query = getMovementFilterParams();
    const res = await authFetch(`/api/movements?${query}`);
    const data = await res.json();
    const items = data.items || data;
    movementsPaginationState.total = data.total || 0;
    
    const tbody = document.querySelector('#tabelaHistorico tbody');
    tbody.innerHTML = '';
    items.forEach(m => {
      const tr = document.createElement('tr');
      const typeDisplay = normalizeMovementType(m.type || (m.quantityChange > 0 ? 'Entrada' : 'Saida'));
      tr.setAttribute('data-tipo', typeDisplay);
      const dt = parseUtcDate(m.timestamp || m.Timestamp || m.timestampUtc);
      tr.innerHTML = `
        <td data-label="Data">${dt.toLocaleString()}</td>
        <td data-label="Produto">${m.product?.name || m.productName || ('ID '+m.productId)}</td>
        <td data-label="Tipo"><span class="badge ${typeDisplay === 'Entrada' ? 'bg-success' : typeDisplay === 'Ajuste' ? 'bg-warning' : 'bg-danger'}">${typeDisplay}</span></td>
        <td data-label="Quantidade">${Math.abs(m.quantityChange)}</td>
        <td data-label="Operador">${escapeHtml(m.operator || 'Sistema')}</td>
      `;
      tbody.appendChild(tr);
    });

    // Render pagination controls
    renderMovementsPaginationControls();
  } catch (e) {
    console.error('Failed to load movements', e);
  }
}

async function loadMovementSummary() {
  try {
    const query = getMovementFilterParams(false);
    const url = query ? `/api/movements/summary?${query}` : '/api/movements/summary';
    const summary = await fetchJson(url);
    document.getElementById('historySummaryTotal').textContent = summary.totalMovements || 0;
    document.getElementById('historySummaryIn').textContent = summary.totalIn || 0;
    document.getElementById('historySummaryOut').textContent = summary.totalOut || 0;
    document.getElementById('historySummaryNet').textContent = summary.net || 0;
  } catch (err) {
    console.error('Failed to load movement summary', err);
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

function renderDashboardAiInsights({
  predictions,
  recommendedProducts,
  averageConfidence,
  criticalProducts,
  lowConfidenceProducts,
  lowHistoryProducts,
  mlProducts,
  recommendedTotal,
  horizonDays
}) {
  const insights = document.getElementById('ai-insights');
  if (!insights) return;

  if (!predictions.length) {
    insights.innerHTML = '<p>Sem produtos ativos suficientes para calcular uma análise preditiva.</p>';
    return;
  }

  const topRecommendation = recommendedProducts[0];
  const methodSummary = mlProducts > 0
    ? `${mlProducts} produto(s) com regressão ML.NET`
    : 'modelo usando média histórica por falta de base suficiente';
  const recommendationText = topRecommendation
    ? `Maior prioridade: <strong>${escapeHtml(topRecommendation.product.name)}</strong>, com sugestão de compra de <strong>${topRecommendation.prediction.recommendedOrder}</strong> unidade(s).`
    : 'Nenhuma compra adicional foi recomendada para o horizonte analisado.';

  insights.innerHTML = `
    <p><strong>Análise de IA:</strong> horizonte de <strong>${horizonDays}</strong> dia(s), com confiança média de <strong>${averageConfidence}%</strong> e ${methodSummary}.</p>
    <p>${recommendationText}</p>
    <p>Resumo operacional: <strong>${criticalProducts}</strong> produto(s) crítico(s), <strong>${recommendedTotal}</strong> unidade(s) recomendada(s) para compra, <strong>${lowConfidenceProducts}</strong> previsão(ões) com baixa confiança e <strong>${lowHistoryProducts}</strong> produto(s) com pouco histórico de saídas.</p>
  `;
}

function refreshAiInsightsInBackground() {
  if (!currentUser || userMustChangePassword()) return null;
  if (aiInsightsRefreshPromise) return aiInsightsRefreshPromise;

  const insights = document.getElementById('ai-insights');
  if (insights) {
    insights.innerHTML = '<p>Atualizando análise preditiva em segundo plano...</p>';
  }

  aiInsightsRefreshPromise = loadAISuggestions()
    .catch((err) => console.error('Failed to refresh dashboard AI insights', err))
    .finally(() => {
      aiInsightsRefreshPromise = null;
    });

  return aiInsightsRefreshPromise;
}

async function loadAISuggestions() {
  if (!currentUser || userMustChangePassword()) return;

  try {
    document.getElementById('iaSummaryProducts').textContent = '...';
    document.getElementById('iaSummaryCritical').textContent = '...';
    document.getElementById('iaSummaryRecommended').textContent = '...';
    document.getElementById('iaSummaryLowConfidence').textContent = '...';
    document.getElementById('ia-health').innerText = '...';
    document.getElementById('ia-charts').innerHTML = '<div class="dashboard-empty">Calculando previsões dos produtos ativos...</div>';
    document.getElementById('ia-orders').innerHTML = '<li class="dashboard-empty">Calculando recomendações...</li>';
    document.querySelector('#iaPredictionTable tbody').innerHTML = '<tr><td colspan="8">Calculando análise preditiva...</td></tr>';
    document.getElementById('ia-report').innerText = 'Processando histórico de movimentações e estimando demanda futura.';

    const suggestions = await fetchJson('/api/ai/suggestions');
    document.getElementById('kpi-ai-suggestions').innerText = suggestions.length || 0;

    const horizonDays = parseInt(document.getElementById('iaHorizonSelect')?.value || '15', 10);
    const productsRes = await authFetch('/api/products?page=1&pageSize=1000&activeStatus=active');
    if (!productsRes.ok) throw new Error(await productsRes.text());
    const productsData = await productsRes.json();
    const products = productsData.items || productsData;
    const predictions = (await Promise.all(products.map(async (p) => {
      try {
        const pred = await fetchJson(`/api/ai/predict/${p.id}?days=${horizonDays}`);
        return { product: p, prediction: pred };
      } catch (err) {
        console.error('Failed to predict product', p.id, err);
        return null;
      }
    }))).filter(Boolean);

    const recommendedProducts = predictions
      .filter(item => Number(item.prediction.recommendedOrder || 0) > 0)
      .sort((a, b) => Number(b.prediction.recommendedOrder || 0) - Number(a.prediction.recommendedOrder || 0));
    const confidenceValues = predictions.map(item => item.prediction.confidencePercent || 0);
    const averageConfidence = confidenceValues.length
      ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
      : 0;
    const criticalProducts = products.filter(p => p.quantity <= p.minQuantity).length;
    const lowConfidenceProducts = predictions.filter(item => (item.prediction.confidencePercent || 0) < 50).length;
    const lowHistoryProducts = predictions.filter(item => (item.prediction.daysWithOutflow || 0) < 3).length;
    const mlProducts = predictions.filter(item => item.prediction.method === 'ML.NET SDCA Regression').length;
    const recommendedTotal = predictions.reduce((sum, item) => sum + Number(item.prediction.recommendedOrder || 0), 0);

    renderDashboardAiInsights({
      predictions,
      recommendedProducts,
      averageConfidence,
      criticalProducts,
      lowConfidenceProducts,
      lowHistoryProducts,
      mlProducts,
      recommendedTotal,
      horizonDays
    });

    document.getElementById('iaSummaryProducts').textContent = predictions.length;
    document.getElementById('iaSummaryCritical').textContent = criticalProducts;
    document.getElementById('iaSummaryRecommended').textContent = recommendedTotal;
    document.getElementById('iaSummaryLowConfidence').textContent = lowConfidenceProducts;
    document.getElementById('ia-health').innerText = `${averageConfidence}%`;

    const charts = document.getElementById('ia-charts');
    charts.innerHTML = '';
    recommendedProducts.slice(0, 5).forEach(({ product: p, prediction: pred }) => {
      const percent = Math.min(100, Math.round((pred.confidencePercent || 0)));
      const dailyOutflow = Number(pred.predictedDailyOutflow || 0);
      const recommendedOrder = Number(pred.recommendedOrder || 0);
      const div = document.createElement('div');
      div.className = 'chart-row';
      div.innerHTML = `
        <span>${escapeHtml(p.name)}</span>
        <div>
          <div class="progress-track"><div class="progress-fill ${recommendedOrder > 0 ? 'trending-up' : 'trending-down'}" style="width:${Math.max(8, percent)}%;"></div></div>
          <small class="ai-chart-detail">${dailyOutflow.toFixed(1)} saídas/dia · ${pred.method || 'Sem método'} · ${pred.daysWithOutflow || 0} dia(s) com saída</small>
        </div>
        <span style="font-weight:600;color:${recommendedOrder > 0 ? '#16a34a' : '#475569'}">+${recommendedOrder}</span>
      `;
      charts.appendChild(div);
    });

    if (!recommendedProducts.length) {
      charts.innerHTML = '<div class="dashboard-empty">Nenhuma compra recomendada para o horizonte selecionado.</div>';
    }

    const orders = document.getElementById('ia-orders');
    orders.innerHTML = '';
    recommendedProducts.slice(0, 5).forEach(({ product, prediction }) => {
      const li = document.createElement('li');
      li.className = 'ai-order-item';
      li.innerHTML = `<strong>Comprar +${prediction.recommendedOrder} unid.</strong><span>${escapeHtml(product.name)}</span>`;
      orders.appendChild(li);
    });
    if (!recommendedProducts.length) {
      orders.innerHTML = '<li class="dashboard-empty">Sem ordens recomendadas.</li>';
    }

    const tableBody = document.querySelector('#iaPredictionTable tbody');
    tableBody.innerHTML = predictions.map(({ product, prediction }) => {
      const method = prediction.method || 'Sem método';
      const methodBadge = (prediction.daysWithOutflow || 0) < 3 ? 'Pouco histórico' : (method.includes('ML.NET') ? 'Modelo ML' : 'Média histórica');
      return `
        <tr>
          <td data-label="Produto">${escapeHtml(product.name)}</td>
          <td data-label="Estoque">${product.quantity}</td>
          <td data-label="Mínimo">${product.minQuantity}</td>
          <td data-label="Saída/dia">${Number(prediction.predictedDailyOutflow || 0).toFixed(1)}</td>
          <td data-label="Histórico">${prediction.daysWithOutflow || 0}/${prediction.observationDays || 0} dia(s)</td>
          <td data-label="Confiança">${Math.round(prediction.confidencePercent || 0)}%</td>
          <td data-label="Comprar"><strong>${prediction.recommendedOrder || 0}</strong></td>
          <td data-label="Método"><span class="badge ${methodBadge === 'Modelo ML' ? 'bg-primary' : 'bg-muted'}">${methodBadge}</span></td>
        </tr>
      `;
    }).join('');

    document.getElementById('ia-report').innerText =
      `Análise de ${horizonDays} dia(s) calculada com ${predictions.length} produto(s). ${mlProducts} produto(s) usaram regressão ML.NET; ${lowHistoryProducts} ainda têm pouco histórico e usam média histórica simples. Pedido recomendado total: ${recommendedTotal} unidade(s). Produtos com baixa confiança: ${lowConfidenceProducts}.`;

  } catch (e) {
    console.error('Failed to load AI data', e);
    document.getElementById('ia-charts').innerHTML = '<div class="dashboard-empty">Não foi possível carregar a análise preditiva.</div>';
    document.querySelector('#iaPredictionTable tbody').innerHTML = '<tr><td colspan="8">Erro ao calcular a análise.</td></tr>';
    document.getElementById('ia-report').innerText = 'Verifique se há produtos ativos e histórico de movimentações disponível.';
  }
}

function filtrarEstoque() {
  productsPaginationState.page = 1;
  loadProductsIntoTable();
}

function applyProductFiltersToRenderedRows() {
  const searchValue = document.getElementById('searchEstoque').value.toLowerCase();
  const categoriaValue = document.getElementById('filterCategoria').value;
  const statusValue = document.getElementById('filterStatus').value;
  const ativoValue = document.getElementById('filterAtivo').value;
  const rows = document.querySelectorAll('#tabelaEstoque tbody tr');

  rows.forEach(row => {
    const textMatch = searchValue === '' || row.innerText.toLowerCase().includes(searchValue);
    const categoriaMatch = categoriaValue === '' || row.getAttribute('data-categoria') === categoriaValue;
    const statusMatch = statusValue === '' || row.getAttribute('data-status') === statusValue;
    const ativoMatch = ativoValue === '' || row.getAttribute('data-ativo') === ativoValue;

    if (textMatch && categoriaMatch && statusMatch && ativoMatch) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

function filtrarHistorico() {
  movementsPaginationState.page = 1;
  loadMovementsIntoHistory();
}

function limparFiltrosHistorico() {
  document.getElementById('searchHistorico').value = '';
  document.getElementById('filterTipoTransacao').value = '';
  document.getElementById('filterOperadorHistorico').value = '';
  document.getElementById('filterDataMovimentacaoHistorico').value = '';
  filtrarHistorico();
}

async function loadUsersAdmin() {
  if (!isAdminUser()) return;

  try {
    systemUsers = await fetchJson('/api/users', {
      headers: adminHeaders()
    });
    renderUsersAdminTable();
  } catch (err) {
    showMessage('Erro ao carregar usuários: ' + err.message, 'error');
  }
}

function renderUsersAdminTable() {
  const tbody = document.querySelector('#tabelaUsuarios tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  systemUsers.forEach(user => {
      const tr = document.createElement('tr');
      const isSelected = selectedAdminUserId === user.id;
      const statusClass = !user.isActive ? 'bg-muted' : (user.mustChangePassword ? 'bg-warning' : 'bg-success');
      const statusText = user.isActive ? (user.mustChangePassword ? 'Troca pendente' : 'Ativo') : 'Inativo';
      tr.innerHTML = `
      <td data-label="ID">${user.id}</td>
      <td data-label="Usuário">${escapeHtml(user.username)}</td>
      <td data-label="Nome">${escapeHtml(user.name || '-')}</td>
      <td data-label="Perfil">${escapeHtml(user.role || '-')}</td>
      <td data-label="Status"><span class="badge ${statusClass}">${statusText}</span></td>
      <td data-label="Ações">
        <div class="table-actions">
          <button type="button" class="btn-table-action ${isSelected ? '' : 'primary'}" onclick="${isSelected ? 'cancelarEdicaoUsuarioAdmin()' : `editarUsuarioAdmin(${user.id})`}">${isSelected ? 'Cancelar' : 'Selecionar'}</button>
          <button type="button" class="btn-table-action ${user.isActive ? 'danger' : 'success'}" onclick="alterarStatusUsuarioAdmin(${user.id}, ${!user.isActive})">${user.isActive ? 'Desativar' : 'Ativar'}</button>
          ${currentUser?.id === user.id ? '' : `<button type="button" class="btn-table-action danger" onclick="excluirUsuarioAdmin(${user.id})">Excluir</button>`}
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  if (!systemUsers.length) {
    tbody.innerHTML = '<tr><td colspan="6">Nenhum usuário cadastrado.</td></tr>';
  }
}

function editarUsuarioAdmin(userId) {
  const user = systemUsers.find(item => item.id === userId);
  if (!user) return;

  selectedAdminUserId = user.id;
  document.getElementById('usuarioIdEdicao').value = user.id;
  document.getElementById('usuarioAdminUsername').value = user.username;
  document.getElementById('usuarioAdminName').value = user.name || '';
  document.getElementById('usuarioAdminRole').value = user.role || 'Operador';
  document.getElementById('usuarioAdminPassword').value = '';
  document.getElementById('usuarioAdminForcePasswordChange').checked = true;
  document.getElementById('usuarioFormBadge').textContent = user.isActive ? 'Usuário ativo' : 'Usuário inativo';
  setUsuarioAdminFormEnabled(true);
  renderUsersAdminTable();
  window.scrollTo(0, 0);
}

function cancelarEdicaoUsuarioAdmin() {
  selectedAdminUserId = null;
  document.getElementById('usuarioIdEdicao').value = '';
  document.getElementById('formUsuarioAdmin').reset();
  document.getElementById('usuarioAdminUsername').value = '';
  document.getElementById('usuarioAdminForcePasswordChange').checked = true;
  document.getElementById('usuarioFormBadge').textContent = 'Selecione um usuário';
  setUsuarioAdminFormEnabled(false);
  renderUsersAdminTable();
}

function setUsuarioAdminFormEnabled(enabled) {
  document.getElementById('usuarioAdminName').disabled = !enabled;
  document.getElementById('usuarioAdminRole').disabled = !enabled;
  document.getElementById('usuarioAdminPassword').disabled = !enabled;
  document.getElementById('usuarioAdminForcePasswordChange').disabled = !enabled;
  document.getElementById('btnSalvarUsuarioAdmin').disabled = !enabled;
}

async function alterarStatusUsuarioAdmin(userId, isActive) {
  const user = systemUsers.find(item => item.id === userId);
  if (!user) return;

  const action = isActive ? 'ativar' : 'desativar';
  if (!confirm(`Deseja ${action} o usuário "${user.username}"?`)) return;

  try {
    await fetchJson(`/api/users/${userId}/status`, {
      method: 'PUT',
      headers: adminHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ isActive })
    });
    showMessage(`Usuário ${isActive ? 'ativado' : 'desativado'} com sucesso.`, 'success');
    cancelarEdicaoUsuarioAdmin();
    await loadUsersAdmin();
  } catch (err) {
    showMessage(`Erro ao ${action} usuário: ` + err.message, 'error');
  }
}

async function excluirUsuarioAdmin(userId) {
  const user = systemUsers.find(item => item.id === userId);
  if (!user) return;

  if (currentUser?.id === userId) {
    showMessage('Não é possível excluir o usuário logado.', 'error');
    return;
  }

  if (!confirm(`Deseja excluir permanentemente o usuário "${user.username}"?`)) return;

  try {
    const res = await authFetch(`/api/users/${userId}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });
    if (!res.ok) throw new Error(await res.text());

    showMessage('Usuário excluído com sucesso.', 'success');
    cancelarEdicaoUsuarioAdmin();
    await loadUsersAdmin();
  } catch (err) {
    showMessage('Erro ao excluir usuário: ' + err.message, 'error');
  }
}

async function loadAuditLogs() {
  if (!isAdminUser()) return;

  try {
    const data = await fetchJson(`/api/audit-logs?${getAuditFilterParams()}`);
    auditLogs = data.items || [];
    renderAuditLogsTable();
  } catch (err) {
    console.error('Failed to load audit logs', err);
  }
}

function getAuditFilterParams() {
  const query = new URLSearchParams({
    page: 1,
    pageSize: 30
  });
  const action = document.getElementById('auditActionFilter')?.value.trim() || '';
  const entity = document.getElementById('auditEntityFilter')?.value || '';
  const username = document.getElementById('auditUserFilter')?.value.trim() || '';

  if (action) query.set('action', action);
  if (entity) query.set('entity', entity);
  if (username) query.set('username', username);
  return query.toString();
}

function clearAuditFilters() {
  const action = document.getElementById('auditActionFilter');
  const entity = document.getElementById('auditEntityFilter');
  const username = document.getElementById('auditUserFilter');
  if (action) action.value = '';
  if (entity) entity.value = '';
  if (username) username.value = '';
  loadAuditLogs();
}

function renderAuditLogsTable() {
  const tbody = document.querySelector('#tabelaAuditoria tbody');
  if (!tbody) return;

  tbody.innerHTML = '';
  auditLogs.forEach(log => {
    const tr = document.createElement('tr');
    const timestamp = parseUtcDate(log.timestamp);
    tr.innerHTML = `
      <td data-label="Data">${timestamp.toLocaleString()}</td>
      <td data-label="Usuário">${escapeHtml(log.username || '-')}</td>
      <td data-label="Ação"><span class="badge bg-primary">${escapeHtml(log.action || '-')}</span></td>
      <td data-label="Entidade">${escapeHtml(log.entity || '-')}${log.entityId ? ` #${escapeHtml(log.entityId)}` : ''}</td>
      <td data-label="Detalhes">${escapeHtml(log.details || '-')}</td>
    `;
    tbody.appendChild(tr);
  });

  if (!auditLogs.length) {
    tbody.innerHTML = '<tr><td colspan="5">Nenhum evento de auditoria registrado.</td></tr>';
  }
}

async function downloadAuthenticatedFile(url, fallbackFileName) {
  try {
    const res = await authFetch(url);
    if (!res.ok) throw new Error(await res.text());

    const blob = await res.blob();
    const contentDisposition = res.headers.get('content-disposition') || '';
    const match = contentDisposition.match(/filename="?([^"]+)"?/i);
    const fileName = match?.[1] || fallbackFileName;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
    showMessage('Download iniciado com sucesso.', 'success');
    await loadAuditLogs();
  } catch (err) {
    showMessage('Erro ao baixar arquivo: ' + err.message, 'error');
  }
}

function switchTab(tabId) {
  if (!currentUser && tabId !== 'login' && tabId !== 'forgot-password') {
    showMessage('Faça login para acessar o sistema.', 'error');
    return;
  }

  if (currentUser && userMustChangePassword() && tabId !== 'change-password' && tabId !== 'login') {
    tabId = 'change-password';
    showMessage('Troque sua senha inicial para continuar.', 'error');
  }

  if (isAdminTab(tabId) && !isAdminUser()) {
    showMessage('Apenas administrador pode acessar esta área.', 'error');
    return;
  }

  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const buttons = document.querySelectorAll('.nav-btn');
  buttons.forEach(btn => { if(btn.getAttribute('onclick') && btn.getAttribute('onclick').includes(tabId)) btn.classList.add('active'); });
  const titles = {
    'login': 'Entrar no Sistema',
    'forgot-password': 'Recuperar Senha',
    'change-password': 'Alterar Senha Inicial',
    'register': 'Criar Novo Usuário',
    'usuarios': 'Gerenciar Usuários',
    'dashboard': 'Dashboard Inicial',
    'cadastro-produto': 'Cadastrar Novo Produto',
    'categorias': 'Cadastro de Categorias',
    'estoque': 'Consulta de Estoque',
    'inventario': 'Inventário Mensal',
    'movimentacao': 'Controle de Entrada e Saída via QR Code',
    'historico': 'Histórico e Auditoria de Logs',
    'kardex': 'Kardex de Estoque',
    'ia-preditiva': 'Módulo Analítico e Inteligência Artificial'
  };
  document.getElementById('page-title').innerText = titles[tabId] || '';

  if (tabId === 'usuarios') {
    loadUsersAdmin();
    loadAuditLogs();
  }
  if (tabId === 'ia-preditiva') {
    refreshAiInsightsInBackground();
  }
  if (tabId === 'inventario') {
    loadInventoryProducts();
  }
  if (tabId === 'kardex') {
    loadInventoryProducts().then(loadKardex);
  }
}

function atualizarModoFormularioCategoria(categoriaId = null) {
  const isEditing = Boolean(categoriaId);
  document.getElementById('categoriaFormTitulo').textContent = isEditing ? 'Editar Categoria' : 'Cadastrar Categoria';
  document.getElementById('categoriaFormBadge').textContent = isEditing ? 'Modo edição' : 'Nova categoria';
  document.getElementById('btnSalvarCategoria').textContent = isEditing ? 'Atualizar Categoria' : 'Salvar Categoria';
  document.getElementById('btnCancelarCategoria').style.display = isEditing ? 'inline-flex' : 'none';
}

function editarCategoria(categoriaId) {
  const category = productCategories.find(item => item.id === categoriaId);
  if (!category) return;

  document.getElementById('categoriaIdEdicao').value = category.id;
  document.getElementById('nomeCategoria').value = category.name;
  atualizarModoFormularioCategoria(category.id);
  window.scrollTo(0, 0);
}

function cancelarEdicaoCategoria(showFeedback = true) {
  document.getElementById('categoriaIdEdicao').value = '';
  document.getElementById('formCategoria').reset();
  atualizarModoFormularioCategoria();
  if (showFeedback) {
    showMessage('Edição de categoria cancelada.', 'info');
  }
}

async function excluirCategoria(categoriaId) {
  const category = productCategories.find(item => item.id === categoriaId);
  if (!category) return;

  if (!confirm(`Excluir a categoria "${category.name}"?`)) return;

  try {
    await authFetch(`/api/categories/${categoriaId}`, { method: 'DELETE' }).then(async res => {
      if (!res.ok) throw new Error(await res.text());
    });
    showMessage('Categoria excluída com sucesso.', 'success');
    await loadCategories();
    await loadProductsIntoTable();
  } catch (err) {
    showMessage('Erro ao excluir categoria: ' + err.message, 'error');
  }
}

async function alterarStatusCategoria(categoriaId, isActive) {
  const category = productCategories.find(item => item.id === categoriaId);
  if (!category) return;

  const action = isActive ? 'ativar' : 'desativar';
  if (!confirm(`Deseja ${action} a categoria "${category.name}"?`)) return;

  try {
    await fetchJson(`/api/categories/${categoriaId}/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive })
    });
    showMessage(`Categoria ${isActive ? 'ativada' : 'desativada'} com sucesso.`, 'success');
    await loadCategories();
    await loadProductsIntoTable();
  } catch (err) {
    showMessage(`Erro ao ${action} categoria: ` + err.message, 'error');
  }
}

// Funções para QR Code e Edição de Produtos
function renderQRCode(targetId, produtoId) {
  const qrcodeContainer = document.getElementById(targetId);
  if (!qrcodeContainer) return;

  qrcodeContainer.innerHTML = '';
  const qrData = getProductQrUrl(produtoId);

  if (typeof QRCode === 'undefined') {
    qrcodeContainer.innerHTML = `<div class="qr-fallback">${formatProductCode(produtoId)}</div>`;
    return;
  }

  new QRCode(qrcodeContainer, {
    text: qrData,
    width: 200,
    height: 200,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.L
  });
}

function gerarQRCode(produtoId) {
  const qrData = formatProductCode(produtoId);
  document.getElementById('codigoQrProduto').value = qrData;
  document.getElementById('qrcodeLabel').textContent = qrData;
  renderQRCode('qrcodeDisplay', produtoId);
  document.getElementById('qrcodeContainer').style.display = 'block';
}

function atualizarModoFormularioProduto(produtoId = null) {
  const isEditing = Boolean(produtoId);
  document.getElementById('produtoFormTitulo').textContent = isEditing ? 'Editar Produto' : 'Cadastrar Produto';
  document.getElementById('produtoFormSubtitulo').textContent = isEditing
    ? 'Atualize os dados do produto. O identificador QR permanece o mesmo.'
    : 'Informe os dados do item para gerar seu cadastro e identificador QR.';
  document.getElementById('produtoFormBadge').textContent = isEditing ? 'Modo edição' : 'Novo produto';
  document.getElementById('btnCancelarEdicao').style.display = isEditing ? 'inline-flex' : 'none';
  document.getElementById('btnSalvarProduto').textContent = isEditing ? 'Atualizar Produto' : 'Salvar Produto';
  document.getElementById('codigoQrProduto').value = isEditing ? formatProductCode(produtoId) : 'Gerado automaticamente ao salvar...';
}

async function editarProduto(produtoId) {
  try {
    const res = await authFetch(`/api/products/${produtoId}`);
    if (!res.ok) throw new Error('Produto não encontrado');
    const produto = await res.json();
    
    document.getElementById('produtoIdEdicao').value = produtoId;
    document.getElementById('produtoAtivoEdicao').value = produto.isActive ? 'true' : 'false';
    document.getElementById('nomeProduto').value = produto.name;
    document.getElementById('cadCategoria').value = produto.category;
    document.getElementById('precoUnitario').value = produto.price;
    document.getElementById('qtdInicial').value = produto.quantity;
    document.getElementById('nivelCritico').value = produto.minQuantity;
    
    atualizarModoFormularioProduto(produtoId);
    gerarQRCode(produtoId);
    
    switchTab('cadastro-produto');
    showMessage('Carregado para edição. Altere os campos e clique em "Atualizar Produto".', 'success');
    window.scrollTo(0, 0);
  } catch (err) {
    showMessage('Erro ao carregar produto: ' + err.message, 'error');
  }
}

function cancelarEdicao(showFeedback = true) {
  document.getElementById('produtoIdEdicao').value = '';
  document.getElementById('produtoAtivoEdicao').value = 'true';
  document.getElementById('formCadastro').reset();
  atualizarModoFormularioProduto();
  document.getElementById('qrcodeContainer').style.display = 'none';
  if (showFeedback) {
    showMessage('Edição cancelada.', 'info');
  }
}

async function alterarStatusProduto(produtoId, isActive) {
  const action = isActive ? 'reativar' : 'desativar';
  if (!confirm(`Deseja ${action} este produto?`)) return;

  try {
    await fetchJson(`/api/products/${produtoId}/active`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive })
    });
    showMessage(`Produto ${isActive ? 'reativado' : 'desativado'} com sucesso.`, 'success');
    await loadProductsIntoTable();
    await loadDashboard();
  } catch (err) {
    showMessage(`Erro ao ${action} produto: ` + err.message, 'error');
  }
}

async function abrirQRCodeProduto(produtoId) {
  try {
    const produto = await fetchJson(`/api/products/${produtoId}`);
    const qrData = formatProductCode(produtoId);
    const qrUrl = getProductQrUrl(produtoId);
    document.getElementById('qrModalProductName').textContent = produto.name || `Produto ${produtoId}`;
    document.getElementById('qrModalCode').textContent = qrData;
    document.getElementById('qrModalLink').textContent = qrUrl;
    renderQRCode('qrModalDisplay', produtoId);

    const modal = document.getElementById('qrModal');
    modal.classList.add('visible');
    modal.setAttribute('aria-hidden', 'false');
  } catch (err) {
    showMessage('Erro ao gerar QR Code: ' + err.message, 'error');
  }
}

function fecharModalQRCode() {
  const modal = document.getElementById('qrModal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

function imprimirQRCodeProduto() {
  const qrNode = document.querySelector('#qrModalDisplay canvas, #qrModalDisplay img');
  const productName = document.getElementById('qrModalProductName')?.textContent || 'Produto';
  const productCode = document.getElementById('qrModalCode')?.textContent || '';
  const productUrl = document.getElementById('qrModalLink')?.textContent || '';

  if (!qrNode) {
    showMessage('QR Code ainda não foi gerado para impressão.', 'error');
    return;
  }

  const qrImage = qrNode.tagName.toLowerCase() === 'canvas'
    ? qrNode.toDataURL('image/png')
    : qrNode.getAttribute('src');
  const printWindow = window.open('', '_blank', 'width=420,height=560');
  if (!printWindow) {
    showMessage('Permita pop-ups para imprimir o QR Code.', 'error');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>QR Code ${escapeHtml(productCode)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
          background: #ffffff;
        }
        .label {
          width: 9cm;
          min-height: 11cm;
          padding: 0.7cm;
          border: 2px solid #111827;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          gap: 0.35cm;
        }
        h1 { margin: 0; font-size: 18pt; }
        .code { font-size: 14pt; font-weight: 700; letter-spacing: 0.08em; }
        img { width: 5.8cm; height: 5.8cm; image-rendering: pixelated; }
        .url { max-width: 100%; overflow-wrap: anywhere; font-size: 8pt; color: #4b5563; }
        .hint { margin-top: 0.2cm; font-size: 9pt; color: #374151; }
        @media print {
          body { min-height: auto; }
          .label { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <section class="label">
        <h1>${escapeHtml(productName)}</h1>
        <div class="code">${escapeHtml(productCode)}</div>
        <img src="${qrImage}" alt="QR Code do produto">
        <div class="hint">Escaneie para registrar movimentação</div>
        <div class="url">${escapeHtml(productUrl)}</div>
      </section>
      <script>
        window.addEventListener('load', () => {
          window.print();
        });
      <\/script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function abrirProdutoPorQRCode(produtoId) {
  if (!currentUser) {
    pendingQrProductId = produtoId;
    switchTab('login');
    showMessage('Faça login para registrar movimentação do produto escaneado.', 'success');
    return;
  }

  try {
    const produto = await fetchJson(`/api/products/${produtoId}`);
    selectedQrProductId = produtoId;
    switchTab('movimentacao');
    const selected = await selectMovementProductById(produtoId);
    if (selected) {
      showMessage(`Produto selecionado pelo QR Code: ${produto.name || formatProductCode(produtoId)}.`, 'success');
    } else {
      showMessage('Produto do QR Code não está ativo para movimentação.', 'error');
    }
  } catch (err) {
    showMessage('Produto do QR Code não encontrado: ' + err.message, 'error');
  }
}

function fecharProdutoQRCode() {
  const modal = document.getElementById('produtoQrModal');
  modal.classList.remove('visible');
  modal.setAttribute('aria-hidden', 'true');
}

function editarProdutoDoQr() {
  if (!selectedQrProductId) return;
  fecharProdutoQRCode();
  editarProduto(selectedQrProductId);
}

function abrirMovimentacaoProdutoQr() {
  if (!selectedQrProductId) return;
  const productId = selectedQrProductId;
  fecharProdutoQRCode();
  switchTab('movimentacao');
  const select = document.getElementById('movProductSelect');
  if (select) {
    select.value = productId.toString();
    updateMovementProductPanel();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  pendingQrProductId = getProductIdFromUrl();
  restoreCurrentUserSession();
  renderUserProfile();
  updateAdminNav();
  updateNavVisibility();
  switchTab(currentUser ? (userMustChangePassword() ? 'change-password' : 'dashboard') : 'login');
  loadPublicAppBaseUrl();
  loadAuthenticatedData();
  atualizarModoFormularioProduto();
  atualizarModoFormularioCategoria();
  setUsuarioAdminFormEnabled(false);

  document.getElementById('qrModal').addEventListener('click', (e) => {
    if (e.target.id === 'qrModal') fecharModalQRCode();
  });

  document.getElementById('produtoQrModal').addEventListener('click', (e) => {
    if (e.target.id === 'produtoQrModal') fecharProdutoQRCode();
  });

  if (pendingQrProductId) {
    showMessage('QR Code lido. Faça login para registrar a movimentação.', 'success');
    if (currentUser && !userMustChangePassword()) {
      continueAfterPasswordReady();
    }
  } else if (window.location.search) {
    clearProductIdFromUrl();
  }

  document.getElementById('movProductSearch').addEventListener('input', renderMovementProductOptions);
  document.getElementById('movProductSelect').addEventListener('change', updateMovementProductPanel);
  document.getElementById('movTypeSelect').addEventListener('change', updateMovementProductPanel);
  document.getElementById('movQtyInput').addEventListener('input', updateMovementProductPanel);
  document.getElementById('iaHorizonSelect').addEventListener('change', loadAISuggestions);
  document.getElementById('inventorySearch').addEventListener('input', renderInventoryTable);
  document.getElementById('reloadInventoryBtn').addEventListener('click', loadInventoryProducts);
  document.getElementById('applyInventoryBtn').addEventListener('click', applyInventoryAdjustments);
  document.getElementById('loadKardexBtn').addEventListener('click', loadKardex);
  document.getElementById('kardexProductSelect').addEventListener('change', loadKardex);
  document.getElementById('clearKardexBtn').addEventListener('click', () => {
    document.getElementById('kardexFrom').value = '';
    document.getElementById('kardexTo').value = '';
    loadKardex();
  });
  document.getElementById('backupDatabaseBtn').addEventListener('click', () => downloadAuthenticatedFile('/api/backup/database', 'inventory-backup.db'));
  document.getElementById('backupJsonBtn').addEventListener('click', () => downloadAuthenticatedFile('/api/backup/export', 'inventory-export.json'));
  document.getElementById('refreshAuditBtn').addEventListener('click', loadAuditLogs);
  document.getElementById('applyAuditFiltersBtn').addEventListener('click', loadAuditLogs);
  document.getElementById('clearAuditFiltersBtn').addEventListener('click', clearAuditFilters);
  ['auditActionFilter', 'auditEntityFilter', 'auditUserFilter'].forEach(id => {
    document.getElementById(id).addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadAuditLogs();
      }
    });
  });
  document.getElementById('auditEntityFilter').addEventListener('change', loadAuditLogs);

  document.getElementById('forgotPasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('forgotUsername').value.trim();
    const submitButton = document.querySelector('#forgotPasswordForm button[type="submit"]');

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
      }
      const response = await authFetch('/api/users/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      if (!response.ok) throw new Error(await response.text());
      document.getElementById('forgotPasswordForm').reset();
      showMessage('Solicitação registrada. Procure o administrador para receber uma nova senha.', 'success');
      switchTab('login');
    } catch (err) {
      showMessage('Erro ao solicitar recuperação: ' + err.message, 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Solicitar Recuperação';
      }
    }
  });

  document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const submitButton = document.querySelector('#loginForm button[type="submit"]');

    try {
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Entrando...';
      }
      currentUser = await fetchJson('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      saveCurrentUserSession();
      renderUserProfile();
      updateAdminNav();
      updateNavVisibility();
      showMessage('Login realizado com sucesso.', 'success');
      if (userMustChangePassword()) {
        switchTab('change-password');
        showMessage('Troque sua senha inicial para continuar.', 'success');
      } else {
        await continueAfterPasswordReady();
      }
      document.getElementById('loginForm').reset();
    } catch (err) {
      showMessage('Falha no login: ' + err.message, 'error');
    } finally {
      if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Acessar Sistema';
      }
    }
  });

  document.getElementById('changePasswordForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const newPasswordConfirm = document.getElementById('newPasswordConfirm').value;

    if (newPassword !== newPasswordConfirm) {
      showMessage('As novas senhas não coincidem.', 'error');
      return;
    }

    if (!currentUser?.id) {
      showMessage('Faça login novamente para alterar sua senha.', 'error');
      switchTab('login');
      return;
    }

    try {
      currentUser = await fetchJson(`/api/users/${currentUser.id}/change-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      saveCurrentUserSession();
      renderUserProfile();
      updateAdminNav();
      updateNavVisibility();
      document.getElementById('changePasswordForm').reset();
      showMessage('Senha alterada com sucesso.', 'success');
      await continueAfterPasswordReady();
    } catch (err) {
      showMessage('Erro ao alterar senha: ' + err.message, 'error');
    }
  });

  document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('registerUsername').value.trim();
    const name = document.getElementById('registerName').value.trim();
    const role = document.getElementById('registerRole').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;

    if (password !== passwordConfirm) {
      showMessage('As senhas não coincidem.', 'error');
      return;
    }

    if (!isAdminUser()) {
      showMessage('Apenas administrador pode criar novos usuários.', 'error');
      return;
    }

    try {
      await fetchJson('/api/users/register', {
        method: 'POST',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username, name, role, password })
      });
      showMessage('Usuário criado com sucesso.', 'success');
      await loadUsersAdmin();
      switchTab('dashboard');
      document.getElementById('registerForm').reset();
    } catch (err) {
      showMessage('Falha no cadastro: ' + err.message, 'error');
    }
  });

  document.getElementById('formUsuarioAdmin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('usuarioIdEdicao').value;
    const name = document.getElementById('usuarioAdminName').value.trim();
    const role = document.getElementById('usuarioAdminRole').value;
    const password = document.getElementById('usuarioAdminPassword').value;
    const mustChangePassword = document.getElementById('usuarioAdminForcePasswordChange').checked;

    if (!userId) {
      showMessage('Selecione um usuário para editar.', 'error');
      return;
    }

    if (!name) {
      showMessage('Informe o nome completo do usuário.', 'error');
      return;
    }

    try {
      await fetchJson(`/api/users/${userId}`, {
        method: 'PUT',
        headers: adminHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name, role })
      });

      if (password) {
        await fetchJson(`/api/users/${userId}/password`, {
          method: 'PUT',
          headers: adminHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ password, mustChangePassword })
        });
      }

      showMessage(password ? `Usuário atualizado e senha redefinida${mustChangePassword ? ' com troca obrigatória no próximo login' : ''}.` : 'Usuário atualizado com sucesso.', 'success');
      cancelarEdicaoUsuarioAdmin();
      await loadUsersAdmin();
    } catch (err) {
      showMessage('Erro ao salvar usuário: ' + err.message, 'error');
    }
  });

  document.getElementById('formCategoria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const categoriaIdEdicao = document.getElementById('categoriaIdEdicao').value;
    const name = document.getElementById('nomeCategoria').value.trim();

    if (!name) {
      showMessage('Informe o nome da categoria.', 'error');
      return;
    }

    try {
      if (categoriaIdEdicao) {
        await fetchJson(`/api/categories/${categoriaIdEdicao}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        showMessage('Categoria atualizada com sucesso.', 'success');
        cancelarEdicaoCategoria(false);
      } else {
        await fetchJson('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name })
        });
        showMessage('Categoria cadastrada com sucesso.', 'success');
        document.getElementById('formCategoria').reset();
      }

      await loadCategories();
      await loadProductsIntoTable();
    } catch (err) {
      showMessage('Erro ao salvar categoria: ' + err.message, 'error');
    }
  });

  // product registration and update
  document.getElementById('formCadastro').addEventListener('submit', async (e) => {
    e.preventDefault();
    const produtoIdEdicao = document.getElementById('produtoIdEdicao').value;
    const name = document.getElementById('nomeProduto').value;
    const isActive = document.getElementById('produtoAtivoEdicao').value !== 'false';
    const qty = parseInt(document.getElementById('qtdInicial').value||'0',10);
    const minQ = parseInt(document.getElementById('nivelCritico').value||'0',10);
    const category = document.getElementById('cadCategoria').value;
    const price = parseFloat(document.getElementById('precoUnitario').value || '0');
    
    try {
      if (produtoIdEdicao) {
        // Atualizar produto existente
        await fetchJson(`/api/products/${produtoIdEdicao}`, { 
          method: 'PUT', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify({ name, quantity: qty, minQuantity: minQ, isActive, category, price }) 
        });
        showMessage('Produto atualizado com sucesso.', 'success');
        cancelarEdicao(false);
      } else {
        // Criar novo produto
        const res = await fetchJson('/api/products', { 
          method: 'POST', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify({ name, quantity: qty, minQuantity: minQ, isActive: true, category, price }) 
        });
        showMessage('Produto cadastrado com sucesso.', 'success');
        
        // Gerar QR Code com o novo ID
        if (res && res.id) {
          document.getElementById('formCadastro').reset();
          gerarQRCode(res.id);
        }
      }
      await loadProductsIntoTable();
      await loadDashboard();
    } catch (err) { showMessage('Erro ao salvar: ' + err.message, 'error'); }
  });

  // movement registration
  document.getElementById('movSubmitBtn').addEventListener('click', async () => {
    const productSelect = document.getElementById('movProductSelect');
    const selectedProduct = productSelect.options[productSelect.selectedIndex];
    const productId = parseInt(productSelect.value,10);
    const qty = parseInt(document.getElementById('movQtyInput').value||'0',10);
    const type = document.getElementById('movTypeSelect').value;
    const quantityChange = type === 'Entrada' ? qty : -qty;

    if (!productId) {
      showMessage('Selecione um produto para movimentar.', 'error');
      return;
    }

    if (!qty || qty <= 0) {
      showMessage('Informe uma quantidade maior que zero.', 'error');
      return;
    }

    const availableQuantity = parseInt(selectedProduct?.dataset.quantity || '0', 10);
    if (type === 'Saida' && qty > availableQuantity) {
      showMessage(`Estoque insuficiente. Disponível: ${availableQuantity} unidade(s).`, 'error');
      return;
    }

    try {
      await fetchJson('/api/movements', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ productId, quantityChange }) });
      showMessage('Movimentação registrada com sucesso.', 'success');
      document.getElementById('movQtyInput').value = '1';
      await loadProductsIntoTable();
      await loadMovementsIntoHistory();
      await loadDashboard();
      updateMovementProductPanel();
    } catch (err) { showMessage('Erro ao registrar movimentação: ' + err.message, 'error'); }
  });

  // export CSV
  document.getElementById('exportCsvBtn').addEventListener('click', async () => {
    const search = encodeURIComponent(document.getElementById('searchEstoque').value || '');
    const category = encodeURIComponent(document.getElementById('filterCategoria').value || '');
    const status = encodeURIComponent(document.getElementById('filterStatus').value || '');
    const activeStatus = encodeURIComponent(document.getElementById('filterAtivo').value || '');
    const url = `/api/products/export?search=${search}&category=${category}&status=${status}&activeStatus=${activeStatus}`;
    try {
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Falha ao exportar');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'produtos.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showMessage('Exportação CSV iniciada.', 'success');
    } catch (e) {
      showMessage('Erro ao exportar CSV: ' + e.message, 'error');
    }
  });

  document.getElementById('exportHistoryCsvBtn').addEventListener('click', async () => {
    const query = getMovementFilterParams(false);
    const url = query ? `/api/movements/export?${query}` : '/api/movements/export';
    try {
      const res = await authFetch(url);
      if (!res.ok) throw new Error('Falha ao exportar histórico');
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'historico_movimentacoes.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      showMessage('Exportação do histórico iniciada.', 'success');
    } catch (e) {
      showMessage('Erro ao exportar histórico: ' + e.message, 'error');
    }
  });
});

