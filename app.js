import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut, updateProfile } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, collection, doc, addDoc, getDoc, getDocs, deleteDoc, setDoc, query, orderBy, Timestamp, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyANDKaXyI94pDmWlYGNbGX0MU0gf8iDWd0',
  authDomain: 'caixinharf7.firebaseapp.com',
  projectId: 'caixinharf7',
  storageBucket: 'caixinharf7.firebasestorage.app',
  messagingSenderId: '656032777586',
  appId: '1:656032777586:web:9bd01f70de1839da2089eb'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const state = {
  user: null,
  canEdit: false,
  atletas: [],
  transacoes: [],
  config: { rules: { mensalidadeLinha: 60, mensalidadeGoleiro: 30, custoPelada: 100, pagamentoGilberto: 15, tesoureiros: ['Flávio', 'Tim', 'Fabiano'] } },
  activeTab: 'dashboard'
};

const refs = {
  loginView: document.getElementById('login-view'),
  registerView: document.getElementById('register-view'),
  mainView: document.getElementById('main-view'),
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

const PENALTY_VALUES = { atraso_leve: 2, atraso_grave: 5, falta: 10, amarelo: 2, vermelho: 10 };

init();

function init() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      refs.mainView.classList.add('hidden');
      refs.loginView.classList.remove('hidden');
      return;
    }
    state.user = user;
    refs.loginView.classList.add('hidden');
    refs.mainView.classList.remove('hidden');
    await reloadData();
  });

  document.getElementById('login-form').onsubmit = async (e) => {
    e.preventDefault();
    try { await signInWithEmailAndPassword(auth, document.getElementById('login-email').value, document.getElementById('login-password').value); } catch (e) { alert(e.message); }
  };

  document.getElementById('open-register').onclick = () => { refs.loginView.classList.add('hidden'); refs.registerView.classList.remove('hidden'); };
  document.getElementById('back-to-login').onclick = () => { refs.registerView.classList.add('hidden'); refs.loginView.classList.remove('hidden'); };
  document.getElementById('logout-btn').onclick = () => signOut(auth);
  document.getElementById('refresh-data').onclick = reloadData;
}

async function reloadData() {
  const email = state.user.email.toLowerCase();
  state.canEdit = ['flavioabdala@yahoo.com.br', 'flavioabdala@gmail.com', 'flavio@rf7.com.br'].includes(email);

  const configSnap = await getDoc(doc(db, 'configuracoes', 'financeiro'));
  if (configSnap.exists()) state.config = configSnap.data();

  const atletasSnap = await getDocs(query(collection(db, 'atletas'), orderBy('nome')));
  state.atletas = atletasSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  const transSnap = await getDocs(query(collection(db, 'transacoes'), orderBy('data', 'desc')));
  state.transacoes = transSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  renderAll();
}

function renderAll() {
  document.getElementById('user-badge').innerHTML = `<strong>${state.user.email}</strong> [${state.canEdit ? 'Admin' : 'Visitante'}]`;
  document.getElementById('tabs').innerHTML = ['dashboard', 'atletas', 'transacoes', 'penalidades', 'peladas', 'relatorios', 'configuracoes'].map(k => `
    <button class="tab-btn ${state.activeTab === k ? 'active' : ''}" onclick="window.changeTab('${k}')">${k.toUpperCase()}</button>
  `).join('');
  
  updateSelects();
  renderDashboard();
  renderAtletas();
  renderTransacoes();
  renderPeladas();
  renderRelatorios();
  renderConfiguracoes();
  showSection(state.activeTab);
}

window.changeTab = (key) => { state.activeTab = key; renderAll(); };

function showSection(key) {
  Object.keys(refs.sections).forEach(k => refs.sections[k].classList.toggle('hidden', k !== key));
}

function updateSelects() {
  const tesHTML = state.config.rules.tesoureiros.map(t => `<option value="${t}">${t}</option>`).join('');
  const athHTML = state.atletas.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
  
  ['pay-tes', 'p-tes', 'pel-tes'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = tesHTML; });
  ['pay-ath', 'p-ath'].forEach(id => { const el = document.getElementById(id); if(el) el.innerHTML = athHTML; });
}

function renderAtletas() {
  document.getElementById('atletas-list').innerHTML = `<table>${state.atletas.map(a => `<tr><td>${a.nome}</td><td>${a.categoria}</td><td><button onclick="deleteAth('${a.id}')">X</button></td></tr>`).join('')}</table>`;
  document.getElementById('ath-form').onsubmit = async (e) => {
    e.preventDefault();
    await addDoc(collection(db, 'atletas'), { nome: document.getElementById('ath-nome').value, categoria: document.getElementById('ath-cat').value, status: document.getElementById('ath-status').value, createdAt: serverTimestamp() });
    reloadData();
  };
}

window.deleteAth = async (id) => { if(confirm('Excluir?')) { await deleteDoc(doc(db, 'atletas', id)); reloadData(); }};

function renderTransacoes() {
  document.getElementById('btn-gerar-mes').onclick = async () => {
    const mes = document.getElementById('gen-month').value;
    if(!mes) return alert("Selecione o mês");
    for (let a of state.atletas.filter(x => x.status === 'ativo')) {
      let v = a.categoria === 'linha' ? state.config.rules.mensalidadeLinha : (a.categoria === 'goleiro_pagante' ? state.config.rules.mensalidadeGoleiro : 0);
      if (v > 0) await addDoc(collection(db, 'transacoes'), { atletaId: a.id, atletaNome: a.nome, categoria: 'debito_mensal', valor: v, direcao: 'none', efeitoAtleta: 'debito', descricao: `Mensalidade ${mes}`, data: Timestamp.now() });
    }
    alert("Gerado!"); reloadData();
  };

  document.getElementById('pay-form').onsubmit = async (e) => {
    e.preventDefault();
    const ath = state.atletas.find(x => x.id === document.getElementById('pay-ath').value);
    await addDoc(collection(db, 'transacoes'), {
      atletaId: ath.id, atletaNome: ath.nome, tesoureiro: document.getElementById('pay-tes').value,
      categoria: 'pagamento', valor: Number(document.getElementById('pay-val').value),
      direcao: 'entrada', efeitoAtleta: 'credito', descricao: `Pagamento ${document.getElementById('pay-month').value}`, data: Timestamp.now()
    });
    reloadData();
  };
}

document.getElementById('pen-form').onsubmit = async (e) => {
  e.preventDefault();
  const type = document.getElementById('p-type').value;
  const ath = state.atletas.find(x => x.id === document.getElementById('p-ath').value);
  await addDoc(collection(db, 'transacoes'), {
    atletaId: ath.id, atletaNome: ath.nome, tesoureiro: document.getElementById('p-tes').value,
    categoria: 'multa', valor: PENALTY_VALUES[type],
    direcao: 'none', efeitoAtleta: 'debito', descricao: `Multa: ${type.replace('_',' ')}`, data: Timestamp.now()
  });
  alert("Multa aplicada!"); reloadData();
};

function renderPeladas() {
  document.getElementById('btn-lancar-pelada').onclick = async () => {
    const tes = document.getElementById('pel-tes').value;
    await addDoc(collection(db, 'transacoes'), { categoria: 'saida', tesoureiro: tes, valor: state.config.rules.custoPelada, direcao: 'saida', efeitoAtleta: 'none', descricao: 'Aluguel Quadra', data: Timestamp.now() });
    await addDoc(collection(db, 'transacoes'), { categoria: 'saida', tesoureiro: tes, valor: state.config.rules.pagamentoGilberto, direcao: 'saida', efeitoAtleta: 'none', descricao: 'Pagamento Juiz (Gilberto)', data: Timestamp.now() });
    alert("Saídas registradas!"); reloadData();
  };
}

function renderDashboard() {
  const ent = state.transacoes.filter(t => t.direcao === 'entrada').reduce((a, b) => a + b.valor, 0);
  const sai = state.transacoes.filter(t => t.direcao === 'saida').reduce((a, b) => a + b.valor, 0);
  refs.sections.dashboard.innerHTML = `<div class="stats"><div class="stat-card"><h4>Caixa Geral</h4><strong>R$ ${(ent-sai).toFixed(2)}</strong></div></div>`;
}

function renderRelatorios() {
  const data = state.atletas.map(a => {
    const d = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'debito').reduce((s, x) => s + x.valor, 0);
    const c = state.transacoes.filter(t => t.atletaId === a.id && t.efeitoAtleta === 'credito').reduce((s, x) => s + x.valor, 0);
    return `<tr><td>${a.nome}</td><td style="color:${d-c > 0 ? 'red' : 'green'}">R$ ${(d-c).toFixed(2)}</td></tr>`;
  }).join('');
  refs.sections.relatorios.innerHTML = `<h3>Saldos Individuais</h3><table><thead><th>Atleta</th><th>Saldo (Débito)</th></thead>${data}</table>`;
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
    alert("Configurações Salvas!"); reloadData();
  };
}
