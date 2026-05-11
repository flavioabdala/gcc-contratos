import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
  orderBy,
  Timestamp,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

// Configuração do Firebase
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

// Estado Global da Aplicação
const state = {
  user: null,
  canEdit: false,
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

// Referências do DOM
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
    configuracoes: document.getElementById('sec-configuracoes')
  }
};

const BASE_TAB_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'atletas', label: 'Atletas' },
  { key: 'transacoes', label: 'Transações' },
  { key: 'penalidades', label: 'Penalidades' },
  { key: 'peladas', label: 'Peladas' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações' }
];

// Inicialização
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

// Carregamento de Dados
async function reloadData() {
  if (!state.user) return;

  const email = state.user.email.toLowerCase().trim();
  const admins = ['flavioabdala@yahoo.com.br', 'flavioabdala@gmail.com', 'flavio@rf7.com.br'];
  state.canEdit = admins.includes(email);

  try {
    const configSnap = await getDoc(doc(db, 'configuracoes', 'financeiro'));
    if (configSnap.exists()) {
      state.config = configSnap.data();
    }

    const atletasSnap = await getDocs(query(collection(db, 'atletas'), orderBy('nome')));
    state.atletas = atletasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const transSnap = await getDocs(query(collection(db, 'transacoes'), orderBy('data', 'desc')));
    state.transacoes = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    const peladasSnap = await getDocs(query(collection(db, 'peladas'), orderBy('data', 'desc')));
    state.peladas = peladasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    renderAll();
  } catch (error) {
    console.error("Erro ao carregar dados:", error);
  }
}

function renderAll() {
  renderUserBadge();
  renderTabs();
  renderDashboard();
  renderAtletas();
  renderTransacoes();
  renderPeladas();
  renderRelatorios();
  renderConfiguracoes();
  showSection(state.activeTab);
}

function renderUserBadge() {
  const label = state.canEdit ? 'Admin' : 'Visitante';
  refs.userBadge.innerHTML = `<strong>${state.user.email}</strong> <span class="badge ${state.canEdit ? 'admin' : ''}">${label}</span>`;
}

function renderTabs() {
  refs.tabs.innerHTML = BASE_TAB_ITEMS.map(t => `
    <button class="tab-btn ${state.activeTab === t.key ? 'active' : ''}" onclick="changeTab('${t.key}')">${t.label}</button>
  `).join('');
}

window.changeTab = (key) => {
  state.activeTab = key;
  renderAll();
};

function showSection(key) {
  Object.keys(refs.sections).forEach(k => {
    if (refs.sections[k]) refs.sections[k].classList.toggle('hidden', k !== key);
  });
}

// --- ATLETAS ---
function renderAtletas() {
  const container = document.getElementById('atletas-list');
  container.innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Categoria</th><th>Status</th><th>Ações</th></tr></thead>
      <tbody>
        ${state.atletas.map(a => `
          <tr>
            <td>${a.nome}</td>
            <td>${a.categoria || 'linha'}</td>
            <td>${a.status}</td>
            <td><button onclick="deleteAtleta('${a.id}')" class="btn small danger" ${!state.canEdit ? 'disabled' : ''}>Excluir</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('ath-form').onsubmit = async (e) => {
    e.preventDefault();
    const nome = document.getElementById('ath-nome').value;
    const categoria = document.getElementById('ath-cat').value;
    const status = document.getElementById('ath-status').value;

    await addDoc(collection(db, 'atletas'), { nome, categoria, status, createdAt: serverTimestamp() });
    reloadData();
  };
}

window.deleteAtleta = async (id) => {
  if (confirm('Deseja excluir este atleta?')) {
    await deleteDoc(doc(db, 'atletas', id));
    reloadData();
  }
};

// --- TRANSAÇÕES (MENSALIDADES) ---
function renderTransacoes() {
  const selectAth = document.getElementById('pay-ath');
  selectAth.innerHTML = state.atletas.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');

  const container = document.getElementById('transacoes-list');
  container.innerHTML = `
    <h4>Histórico Recente</h4>
    <table>
      <thead><tr><th>Data</th><th>Descrição</th><th>Valor</th><th>Tipo</th></tr></thead>
      <tbody>
        ${state.transacoes.slice(0, 15).map(t => `
          <tr>
            <td>${t.data?.toDate().toLocaleDateString() || '-'}</td>
            <td>${t.descricao}</td>
            <td>R$ ${t.valor.toFixed(2)}</td>
            <td style="color:${t.direcao === 'entrada' ? 'green' : (t.direcao === 'saida' ? 'red' : 'gray')}">
              ${t.direcao === 'entrada' ? 'Entrada' : (t.direcao === 'saida' ? 'Saída' : 'Débito')}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  document.getElementById('btn-gerar-mes').onclick = gerarMensalidades;

  document.getElementById('pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const athId = document.getElementById('pay-ath').value;
    const month = document.getElementById('pay-month').value;
    const valor = Number(document.getElementById('pay-val').value);
    const atleta = state.atletas.find(a => a.id === athId);

    await addDoc(collection(db, 'transacoes'), {
      atletaId: athId,
      atletaNome: atleta.nome,
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

async function gerarMensalidades() {
  const mes = document.getElementById('gen-month').value;
  if (!mes || !confirm(`Gerar débitos de ${mes} para todos os ativos?`)) return;

  const ativos = state.atletas.filter(a => a.status === 'ativo');
  for (let a of ativos) {
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
  alert('Débitos gerados!');
  reloadData();
}

// --- PELADAS ---
function renderPeladas() {
  document.getElementById('btn-lancar-pelada').onclick = async () => {
    const custo = state.config.rules.custoPelada;
    const juiz = state.config.rules.pagamentoGilberto;

    await addDoc(collection(db, 'transacoes'), {
      categoria: 'custo_pelada',
      valor: custo,
      direcao: 'saida',
      efeitoAtleta: 'none',
      descricao: 'Aluguel Quadra',
      data: Timestamp.now()
    });
    await addDoc(collection(db, 'transacoes'), {
      categoria: 'pagamento_gilberto',
      valor: juiz,
      direcao: 'saida',
      efeitoAtleta: 'none',
      descricao: 'Pagamento Juiz',
      data: Timestamp.now()
    });
    alert('Saídas de Pelada e Juiz lançadas!');
    reloadData();
  };
}

// --- DASHBOARD E RELATÓRIOS ---
function renderDashboard() {
  const entradas = state.transacoes.filter(t => t.direcao === 'entrada').reduce((a, b) => a + b.valor, 0);
  const saidas = state.transacoes.filter(t => t.direcao === 'saida').reduce((a, b) => a + b.valor, 0);

  refs.sections.dashboard.innerHTML = `
    <div class="stats">
      <div class="stat-card"><h4>Saldo em Caixa</h4><strong>R$ ${(entradas - saidas).toFixed(2)}</strong></div>
      <div class="stat-card"><h4>Entradas</h4><strong style="color:green">R$ ${entradas.toFixed(2)}</strong></div>
      <div class="stat-card"><h4>Saídas</h4><strong style="color:red">R$ ${saidas.toFixed(2)}</strong></div>
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
    <h3>Dívidas Pendentes</h3>
    <table>
      <thead><tr><th>Atleta</th><th>Status Financeiro</th></tr></thead>
      <tbody>
        ${saldos.map(s => `
          <tr>
            <td>${s.nome}</td>
            <td style="color:${s.saldo > 0 ? 'red' : 'green'}; font-weight:bold">
              ${s.saldo > 0 ? `Deve R$ ${s.saldo.toFixed(2)}` : 'Em dia'}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

// --- CONFIGURAÇÕES ---
function renderConfiguracoes() {
  if (!state.canEdit) {
    refs.sections.configuracoes.innerHTML = `<p>Acesso restrito ao administrador.</p>`;
    return;
  }

  // Preencher os campos com os valores atuais
  document.getElementById('cfg-lin').value = state.config.rules.mensalidadeLinha;
  document.getElementById('cfg-gol').value = state.config.rules.mensalidadeGoleiro;
  document.getElementById('cfg-pel').value = state.config.rules.custoPelada;
  document.getElementById('cfg-juiz').value = state.config.rules.pagamentoGilberto;
  document.getElementById('cfg-tes').value = state.config.rules.tesoureiros.join(', ');

  document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();
    const newRules = {
      mensalidadeLinha: Number(document.getElementById('cfg-lin').value),
      mensalidadeGoleiro: Number(document.getElementById('cfg-gol').value),
      custoPelada: Number(document.getElementById('cfg-pel').value),
      pagamentoGilberto: Number(document.getElementById('cfg-juiz').value),
      tesoureiros: document.getElementById('cfg-tes').value.split(',').map(t => t.trim())
    };

    await setDoc(doc(db, 'configuracoes', 'financeiro'), { rules: newRules, updatedAt: serverTimestamp() });
    alert('Configurações salvas!');
    reloadData();
  };
}
