import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
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

const state = {
  user: null,
  canEdit: false,
  atletas: [],
  transacoes: [],
  config: {
    rules: {
      mensalidadeLinha: 60,
      mensalidadeGoleiro: 30,
      custoPelada: 100,
      pagamentoGilberto: 15,
      tesoureiros: ['Flávio']
    }
  },
  activeTab: 'dashboard'
};

const refs = {
  loginView: document.getElementById('login-view'),
  registerView: document.getElementById('register-view'),
  mainView: document.getElementById('main-view'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginMsg: document.getElementById('login-message'),
  registerMsg: document.getElementById('register-message'),
  openRegisterBtn: document.getElementById('open-register'),
  backToLoginBtn: document.getElementById('back-to-login'),
  logoutBtn: document.getElementById('logout-btn'),
  userBadge: document.getElementById('user-badge'),
  refreshBtn: document.getElementById('refresh-data'),
  tabs: document.getElementById('tabs'),
  sections: {
    dashboard: document.getElementById('sec-dashboard'),
    atletas: document.getElementById('sec-atletas'),
    transacoes: document.getElementById('sec-transacoes'),
    peladas: document.getElementById('sec-peladas'),
    relatorios: document.getElementById('sec-relatorios'),
    configuracoes: document.getElementById('sec-configuracoes')
  }
};

const BASE_TAB_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'atletas', label: 'Atletas' },
  { key: 'transacoes', label: 'Transações' },
  { key: 'peladas', label: 'Peladas' },
  { key: 'relatorios', label: 'Relatórios' },
  { key: 'configuracoes', label: 'Configurações' }
];

init();

function init() {
  bindEvents();
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      state.user = null;
      refs.mainView.classList.add('hidden');
      refs.registerView.classList.add('hidden');
      refs.loginView.classList.remove('hidden');
      return;
    }
    state.user = user;
    refs.loginView.classList.add('hidden');
    refs.registerView.classList.add('hidden');
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
    } catch (e) { refs.loginMsg.textContent = "Erro: " + e.message; }
  });

  refs.registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const name = document.getElementById('register-name').value;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName: name });
      alert("Sucesso!");
    } catch (e) { refs.registerMsg.textContent = "Erro: " + e.message; }
  });

  refs.openRegisterBtn.addEventListener('click', () => {
    refs.loginView.classList.add('hidden');
    refs.registerView.classList.remove('hidden');
  });

  refs.backToLoginBtn.addEventListener('click', () => {
    refs.registerView.classList.add('hidden');
    refs.loginView.classList.remove('hidden');
  });

  refs.logoutBtn.addEventListener('click', () => signOut(auth));
  refs.refreshBtn.addEventListener('click', reloadData);
}

async function reloadData() {
  if (!state.user) return;
  const email = state.user.email.toLowerCase();
  const admins = ['flavioabdala@yahoo.com.br', 'flavioabdala@gmail.com', 'flavio@rf7.com.br'];
  state.canEdit = admins.includes(email);

  const configSnap = await getDoc(doc(db, 'configuracoes', 'financeiro'));
  if (configSnap.exists()) state.config = configSnap.data();

  const atletasSnap = await getDocs(query(collection(db, 'atletas'), orderBy('nome')));
  state.atletas = atletasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const transSnap = await getDocs(query(collection(db, 'transacoes'), orderBy('data', 'desc')));
  state.transacoes = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderAll();
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
  refs.userBadge.innerHTML = `<strong>${state.user.email}</strong> [${state.canEdit ? 'Admin' : 'Visitante'}]`;
}

function renderTabs() {
  refs.tabs.innerHTML = BASE_TAB_ITEMS.map(t => `
    <button class="tab-btn ${state.activeTab === t.key ? 'active' : ''}" onclick="window.changeTab('${t.key}')">${t.label}</button>
  `).join('');
}

window.changeTab = (key) => { state.activeTab = key; renderAll(); };

function showSection(key) {
  Object.keys(refs.sections).forEach(k => {
    if (refs.sections[k]) refs.sections[k].classList.toggle('hidden', k !== key);
  });
}

function renderAtletas() {
  const container = document.getElementById('atletas-list');
  container.innerHTML = `
    <table>
      <thead><tr><th>Nome</th><th>Categoria</th><th>Ação</th></tr></thead>
      <tbody>
        ${state.atletas.map(a => `<tr><td>${a.nome}</td><td>${a.categoria}</td><td><button onclick="deleteAth('${a.id}')" class="btn small danger">X</button></td></tr>`).join('')}
      </tbody>
    </table>`;

  document.getElementById('ath-form').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'atletas'), {
      nome: document.getElementById('ath-nome').value,
      categoria: document.getElementById('ath-cat').value,
      status: document.getElementById('ath-status').value,
      createdAt: serverTimestamp()
    });
    reloadData();
  };
}

window.deleteAth = async (id) => { if(confirm('Excluir?')) { await deleteDoc(doc(db, 'atletas', id)); reloadData(); }};

function renderTransacoes() {
  const select = document.getElementById('pay-ath');
  select.innerHTML = state.atletas.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');

  document.getElementById('btn-gerar-mes').onclick = async () => {
    const mes = document.getElementById('gen-month').value;
    if(!mes) return alert("Selecione o mês");
    for (let a of state.atletas.filter(x => x.status === 'ativo')) {
      let v = a.categoria === 'linha' ? state.config.rules.mensalidadeLinha : (a.categoria === 'goleiro_pagante' ? state.config.rules.mensalidadeGoleiro : 0);
      if (v > 0) {
        await addDoc(collection(db, 'transacoes'), {
          atletaId: a.id, atletaNome: a.nome, categoria: 'debito', valor: v, direcao: 'none', efeitoAtleta: 'debito', descricao: `Mensalidade ${mes}`, data: Timestamp.now()
        });
      }
    }
    alert("Gerado!"); reloadData();
  };

  document.getElementById('pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const id = document.getElementById('pay-ath').value;
    await addDoc(collection(db, 'transacoes'), {
      atletaId: id, atletaNome: state.atletas.find(x => x.id === id).nome,
      categoria: 'pagamento', valor: Number(document.getElementById('pay-val').value),
      direcao: 'entrada', efeitoAtleta: 'credito', descricao: `Pagamento ${document.getElementById('pay-month').value}`, data: Timestamp.now()
    });
    reloadData();
  };
}

function renderPeladas() {
  document.getElementById('btn-lancar-pelada').onclick = async () => {
    await addDoc(collection(db, 'transacoes'), { categoria: 'saida', valor: state.config.rules.custoPelada, direcao: 'saida', efeitoAtleta: 'none', descricao: 'Aluguel Quadra', data: Timestamp.now() });
    await addDoc(collection(db, 'transacoes'), { categoria: 'saida', valor: state.config.rules.pagamentoGilberto, direcao: 'saida', efeitoAtleta: 'none', descricao: 'Juiz', data: Timestamp.now() });
    alert("Lançado!"); reloadData();
  };
}

function renderDashboard() {
  const ent = state.transacoes.filter(t => t.direcao === 'entrada').reduce((a, b) => a + b.valor, 0);
  const sai = state.transacoes.filter(t => t.direcao === 'saida').reduce((a, b) => a + b.valor, 0);
  refs.sections.dashboard.innerHTML = `<div class="stats"><div class="stat-card"><h4>Caixa</h4><strong>R$ ${(ent-sai).toFixed(2)}</strong></div></div>`;
}

function renderRelatorios() {
  const data = state.atletas.map(a => {
    const d = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'debito').reduce((s, x) => s + x.valor, 0);
    const c = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'credito').reduce((s, x) => s + x.valor, 0);
    return `<tr><td>${a.nome}</td><td style="color:${d-c > 0 ? 'red' : 'green'}">R$ ${(d-c).toFixed(2)}</td></tr>`;
  }).join('');
  refs.sections.relatorios.innerHTML = `<h3>Saldos Individuais</h3><table>${data}</table>`;
}

function renderConfiguracoes() {
  if (!state.canEdit) return refs.sections.configuracoes.innerHTML = "Acesso Negado";
  document.getElementById('cfg-lin').value = state.config.rules.mensalidadeLinha;
  document.getElementById('cfg-gol').value = state.config.rules.mensalidadeGoleiro;
  document.getElementById('cfg-pel').value = state.config.rules.custoPelada;
  document.getElementById('cfg-juiz').value = state.config.rules.pagamentoGilberto;
  document.getElementById('cfg-tes').value = state.config.rules.tesoureiros.join(', ');

  document.getElementById('config-form').onsubmit = async (e) => {
    e.preventDefault();
    const rules = {
      mensalidadeLinha: Number(document.getElementById('cfg-lin').value),
      mensalidadeGoleiro: Number(document.getElementById('cfg-gol').value),
      custoPelada: Number(document.getElementById('cfg-pel').value),
      pagamentoGilberto: Number(document.getElementById('cfg-juiz').value),
      tesoureiros: document.getElementById('cfg-tes').value.split(',').map(t => t.trim())
    };
    await setDoc(doc(db, 'configuracoes', 'financeiro'), { rules, updatedAt: serverTimestamp() });
    alert("Salvo!"); reloadData();
  };
}
