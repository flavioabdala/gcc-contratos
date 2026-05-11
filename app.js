import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyANDKaXyI94pDmWlYGNbGX0MU0gf8iDWd0',
  authDomain: 'caixinharf7.firebaseapp.com',
  projectId: 'caixinharf7',
  storageBucket: 'caixinharf7.firebasestorage.app',
  messagingSenderId: '656032777586',
  appId: '1:656032777586:web:9bd01f70de1839da2089eb',
  measurementId: 'G-NV7ZMM1WLE'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Estado Global
const state = {
  user: null,
  canEdit: false,
  currentUserRole: 'visualizador',
  users: [],
  atletas: [],
  transacoes: [],
  peladas: [],
  config: {
    rules: {
      mensalidadeLinha: 60,
      mensalidadeGoleiro: 30,
      custoPelada: 100,
      pagamentoGilberto: 15,
      tesoureiros: ['Flávio', 'Tim', 'Fabiano']
    }
  },
  activeTab: 'dashboard'
};

const refs = {
  loginView: document.getElementById('login-view'),
  mainView: document.getElementById('main-view'),
  loginForm: document.getElementById('login-form'),
  loginMsg: document.getElementById('login-message'),
  logoutBtn: document.getElementById('logout-btn'),
  userBadge: document.getElementById('user-badge'),
  refreshBtn: document.getElementById('refresh-data'),
  tabs: document.getElementById('tabs'),
  sections: {
    dashboard: document.getElementById('sec-dashboard'),
    atletas: document.getElementById('sec-atletas'),
    transacoes: document.getElementById('sec-transacoes'),
    penalidades: document.getElementById('sec-penalidades'),
    peladas: document.getElementById('sec-peladas'),
    relatorios: document.getElementById('sec-relatorios'),
    usuarios: document.getElementById('sec-usuarios')
  }
};

const BASE_TAB_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'atletas', label: 'Atletas' },
  { key: 'transacoes', label: 'Transações' },
  { key: 'penalidades', label: 'Penalidades' },
  { key: 'peladas', label: 'Peladas' },
  { key: 'relatorios', label: 'Relatórios' }
];

init();

function init() {
  bindEvents();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
      refs.mainView.classList.add('hidden');
      refs.loginView.classList.remove('hidden');
      return;
    }
    state.user = user;
    refs.loginView.classList.add('hidden');
    refs.mainView.classList.remove('hidden');
    await reloadData();
  });
}

function bindEvents() {
  refs.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      refs.loginMsg.textContent = "Erro: " + error.message;
    }
  });
  refs.logoutBtn.addEventListener('click', () => signOut(auth));
  refs.refreshBtn.addEventListener('click', reloadData);
}

async function reloadData() {
  if (!state.user) return;

  // 1. Verificar Super Admin por Email
  const email = state.user.email.toLowerCase().trim();
  const admins = ['flavioabdala@yahoo.com.br', 'flavioabdala@gmail.com', 'flavio@rf7.com.br'];
  state.canEdit = admins.includes(email);

  // 2. Carregar Configurações (Preços)
  const configSnap = await getDoc(doc(db, 'configuracoes', 'financeiro'));
  if (configSnap.exists()) {
    state.config = configSnap.data();
  }

  // 3. Carregar Dados do Banco
  const atletasSnap = await getDocs(query(collection(db, 'atletas'), orderBy('nome')));
  state.atletas = atletasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const transSnap = await getDocs(query(collection(db, 'transacoes'), orderBy('data', 'desc')));
  state.transacoes = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const peladasSnap = await getDocs(query(collection(db, 'peladas'), orderBy('data', 'desc')));
  state.peladas = peladasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderAll();
}

function renderAll() {
  renderUserBadge();
  renderTabs();
  renderDashboard();
  renderAtletas();
  renderTransacoes();
  renderPenalidades();
  renderPeladas();
  renderRelatorios();
  showSection(state.activeTab);
}

function renderUserBadge() {
  const label = state.canEdit ? 'Admin' : 'Visitante';
  refs.userBadge.innerHTML = `<strong>${state.user.email}</strong> <span class="badge ${state.canEdit?'admin':''}">${label}</span>`;
}

function renderTabs() {
  refs.tabs.innerHTML = BASE_TAB_ITEMS.map(t => `
    <button class="tab-btn ${state.activeTab===t.key?'active':''}" onclick="changeTab('${t.key}')">${t.label}</button>
  `).join('');
}

window.changeTab = (key) => {
  state.activeTab = key;
  renderAll();
};

function showSection(key) {
  Object.keys(refs.sections).forEach(k => refs.sections[k].classList.toggle('hidden', k !== key));
}

// --- LÓGICA DE ATLETAS (CATEGORIAS) ---
function renderAtletas() {
  refs.sections.atletas.innerHTML = `
    <h3>Gestão de Atletas</h3>
    <form id="ath-form" class="grid-form" style="margin-bottom:20px">
      <label>Nome <input id="ath-nome" required></label>
      <label>Categoria 
        <select id="ath-cat">
          <option value="linha">Linha (R$ ${state.config.rules.mensalidadeLinha})</option>
          <option value="goleiro_pagante">Goleiro (R$ ${state.config.rules.mensalidadeGoleiro})</option>
          <option value="goleiro_isento">Goleiro (Isento)</option>
        </select>
      </label>
      <button type="submit" class="btn primary" ${!state.canEdit?'disabled':''}>Salvar Atleta</button>
    </form>
    <table>
      <thead><tr><th>Nome</th><th>Categoria</th><th>Ação</th></tr></thead>
      <tbody>
        ${state.atletas.map(a => `
          <tr>
            <td>${a.nome}</td>
            <td>${a.categoria || 'linha'}</td>
            <td><button onclick="deleteAtleta('${a.id}')" class="btn small danger">Excluir</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('ath-form').onsubmit = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('ath-nome').value;
    const categoria = document.getElementById('ath-cat').value;
    await addDoc(collection(db, 'atletas'), { nome, categoria, status: 'ativo', createdAt: serverTimestamp() });
    reloadData();
  };
}

window.deleteAtleta = async (id) => {
  if(confirm('Excluir atleta?')) { await deleteDoc(doc(db, 'atletas', id)); reloadData(); }
};

// --- LÓGICA DE TRANSAÇÕES (MENSALIDADE AUTOMÁTICA) ---
function renderTransacoes() {
  refs.sections.transacoes.innerHTML = `
    <div class="grid-2">
      <article class="panel">
        <h4>1. Gerar Débitos do Mês</h4>
        <p class="muted">Isso cria a dívida para todos os atletas ativos.</p>
        <input type="month" id="gen-month" value="${new Date().toISOString().slice(0,7)}">
        <button onclick="gerarMensalidades()" class="btn primary">Gerar para Todos</button>
      </article>

      <article class="panel">
        <h4>2. Registrar Pagamento</h4>
        <form id="pay-form" class="grid-form">
          <select id="pay-ath">${state.atletas.map(a=>`<option value="${a.id}">${a.nome}</option>`)}</select>
          <input type="month" id="pay-month" required>
          <input type="number" id="pay-val" placeholder="Valor pago" required>
          <button type="submit" class="btn primary">Baixar Mensalidade</button>
        </form>
      </article>
    </div>
  `;

  document.getElementById('pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const athId = document.getElementById('pay-ath').value;
    const month = document.getElementById('pay-month').value;
    const valor = Number(document.getElementById('pay-val').value);

    await addDoc(collection(db, 'transacoes'), {
      atletaId: athId,
      atletaNome: state.atletas.find(a=>a.id===athId).nome,
      categoria: 'mensalidade_pagamento',
      descricao: `Pagamento Mensalidade ${month}`,
      valor: valor,
      direcao: 'entrada',
      efeitoAtleta: 'credito',
      data: Timestamp.now()
    });
    alert('Pagamento registrado!');
    reloadData();
  };
}

window.gerarMensalidades = async () => {
  const mes = document.getElementById('gen-month').value;
  if(!confirm(`Gerar débitos para ${mes}?`)) return;

  for (let a of state.atletas) {
    let valor = 0;
    if (a.categoria === 'linha') valor = state.config.rules.mensalidadeLinha;
    else if (a.categoria === 'goleiro_pagante') valor = state.config.rules.mensalidadeGoleiro;

    if (valor > 0) {
      await addDoc(collection(db, 'transacoes'), {
        atletaId: a.id,
        atletaNome: a.nome,
        categoria: 'mensalidade_debito',
        valor: valor,
        direcao: 'none',
        efeitoAtleta: 'debito',
        descricao: `Débito Mensalidade ${mes}`,
        data: Timestamp.now(),
        referencia: mes
      });
    }
  }
  alert('Mensalidades geradas com sucesso!');
  reloadData();
};

// --- RELATÓRIOS CORRIGIDOS ---
function renderDashboard() {
  const entradas = state.transacoes.filter(t => t.direcao === 'entrada').reduce((a, b) => a + b.valor, 0);
  const saidas = state.transacoes.filter(t => t.direcao === 'saida').reduce((a, b) => a + b.valor, 0);
  
  refs.sections.dashboard.innerHTML = `
    <div class="stats">
      <div class="stat-card"><h4>Saldo em Caixa</h4><strong>R$ ${entradas - saidas}</strong></div>
      <div class="stat-card"><h4>Total Entradas</h4><strong>R$ ${entradas}</strong></div>
      <div class="stat-card"><h4>Total Saídas</h4><strong>R$ ${saidas}</strong></div>
    </div>
  `;
}

function renderRelatorios() {
  const saldos = state.atletas.map(a => {
    const deb = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'debito').reduce((s, x) => s + x.valor, 0);
    const cre = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'credito').reduce((s, x) => s + x.valor, 0);
    return { nome: a.nome, saldo: deb - cre };
  });

  refs.sections.relatorios.innerHTML = `
    <h3>Resumo de Dívidas (Atletas)</h3>
    <table>
      <thead><tr><th>Atleta</th><th>Status</th></tr></thead>
      <tbody>
        ${saldos.map(s => `
          <tr>
            <td>${s.nome}</td>
            <td style="color:${s.saldo > 0 ? 'red' : 'green'}">
              ${s.saldo > 0 ? `Deve R$ ${s.saldo}` : 'Em dia'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// Funções de ajuda
function money(v) { return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }

// Renderização das demais seções (simplificadas para o exemplo)
function renderPenalidades() { refs.sections.penalidades.innerHTML = "<h4>Penalidades</h4> (Implementar similar a Transações)"; }
function renderPeladas() { 
  refs.sections.peladas.innerHTML = `
    <h4>Registrar Pelada</h4>
    <button onclick="lancarPelada()" class="btn primary">Lançar Pelada Hoje</button>
  `;
}

window.lancarPelada = async () => {
    const custo = state.config.rules.custoPelada;
    const juiz = state.config.rules.pagamentoGilberto;
    
    // Lança a saída do aluguel
    await addDoc(collection(db, 'transacoes'), {
        categoria: 'custo_pelada',
        valor: custo,
        direcao: 'saida',
        efeitoAtleta: 'none', // Não afeta dívida de ninguém
        descricao: 'Aluguel Quadra',
        data: Timestamp.now()
    });
    // Lança a saída do juiz
    await addDoc(collection(db, 'transacoes'), {
        categoria: 'pagamento_gilberto',
        valor: juiz,
        direcao: 'saida',
        efeitoAtleta: 'none',
        descricao: 'Pagamento Juiz',
        data: Timestamp.now()
    });
    alert('Pelada e Juiz lançados como SAÍDA!');
    reloadData();
}
// 1. Atualize a lista de abas para incluir Configurações
const BASE_TAB_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'atletas', label: 'Atletas' },
  { key: 'transacoes', label: 'Transações' },
  { key: 'penalidades', label: 'Penalidades' },
  { key: 'peladas', label: 'Peladas' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações' } // Nova aba
];

// 2. Adicione a referência da nova seção no objeto 'refs'
// (Dentro de refs.sections)
// configuracoes: document.getElementById('sec-configuracoes')

// 3. Adicione a função de renderização da aba
function renderConfiguracoes() {
  if (!state.canEdit) {
    refs.sections.configuracoes.innerHTML = `<h3>Configurações</h3><p class="muted">Acesso restrito ao administrador.</p>`;
    return;
  }

  refs.sections.configuracoes.innerHTML = `
    <h3>Configurações do Sistema</h3>
    <p class="muted">Ajuste os valores base para cálculos automáticos.</p>
    
    <form id="config-form" class="card panel grid-form">
      <label>Mensalidade Linha (R$)
        <input type="number" id="cfg-lin" value="${state.config.rules.mensalidadeLinha}">
      </label>
      <label>Mensalidade Goleiro (R$)
        <input type="number" id="cfg-gol" value="${state.config.rules.mensalidadeGoleiro}">
      </label>
      <label>Custo da Pelada (Aluguel R$)
        <input type="number" id="cfg-pel" value="${state.config.rules.custoPelada}">
      </label>
      <label>Pagamento Juiz (R$)
        <input type="number" id="cfg-juiz" value="${state.config.rules.pagamentoGilberto}">
      </label>
      <label>Tesoureiros (separe por vírgula)
        <input type="text" id="cfg-tes" value="${state.config.rules.tesoureiros.join(', ')}">
      </label>
      <button type="submit" class="btn primary">Salvar Alterações</button>
    </form>
  `;

  document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();
    const newRules = {
      mensalidadeLinha: Number(document.getElementById('cfg-lin').value),
      mensalidadeGoleiro: Number(document.getElementById('cfg-gol').value),
      custoPelada: Number(document.getElementById('cfg-pel').value),
      pagamentoGilberto: Number(document.getElementById('cfg-juiz').value),
      tesoureiros: document.getElementById('cfg-tes').value.split(',').map(t => t.trim())
    };

    try {
      await setDoc(doc(db, 'configuracoes', 'financeiro'), { rules: newRules, updatedAt: serverTimestamp() });
      alert('Configurações atualizadas com sucesso!');
      await reloadData();
    } catch (error) {
      alert('Erro ao salvar: ' + error.message);
    }
  };
}

// 4. Não esqueça de chamar renderConfiguracoes() dentro da sua função renderAll()
