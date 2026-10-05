import {
  STAGES, reducer, matches, stageSummary, metrics, daysInStage, toCSV, load, save,
} from './store.js';
import { seedDeals } from './seed.js';

const $ = (sel) => document.querySelector(sel);
const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 0 });
const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

let storage = null;
try { storage = window.localStorage; } catch { storage = null; }

let state = load(storage, null) ?? reducer({ deals: [] }, { type: 'replace', deals: seedDeals });
let query = '';
let editingId = null;

function dispatch(action) {
  state = reducer(state, action);
  save(storage, state);
  render();
}

const announce = (msg) => { $('#live').textContent = msg; };

function renderKpis() {
  const m = metrics(state.deals);
  $('#kpi-open').textContent = brl.format(m.openValue);
  $('#kpi-open-count').textContent = `${m.openCount} negócio${m.openCount === 1 ? '' : 's'}`;
  $('#kpi-forecast').textContent = brl.format(m.forecast);
  $('#kpi-won').textContent = brl.format(m.wonValue);
  $('#kpi-ticket').textContent = m.averageTicket ? `ticket médio ${brl.format(m.averageTicket)}` : '';
  $('#kpi-rate').textContent = m.winRate === null ? '–' : pct.format(m.winRate);
  $('#kpi-stale').textContent = m.staleIds.length ? `${m.staleIds.length} parado(s) há +14 dias` : 'nenhum negócio parado';
}

function cardHtml(deal, stale) {
  const days = daysInStage(deal);
  const badge = stale
    ? `<span class="badge stale" title="Sem avanço há ${days} dias">⚠ ${days}d</span>`
    : `<span class="badge">${days}d</span>`;
  return `
    <li class="card" draggable="true" tabindex="0" data-id="${escapeHtml(deal.id)}"
        aria-label="${escapeHtml(`${deal.title}, ${brl.format(deal.value)}. Enter para editar, Alt+setas para mover`)}">
      <div class="title">${escapeHtml(deal.title)}</div>
      <div class="meta">${escapeHtml([deal.company, deal.contact].filter(Boolean).join(' · '))}</div>
      <div class="foot"><span class="value">${brl.format(deal.value)}</span>
        <span class="meta">${escapeHtml(deal.owner)}</span>${badge}</div>
    </li>`;
}

function renderBoard() {
  const visible = state.deals.filter((d) => matches(d, query));
  const stale = new Set(metrics(state.deals).staleIds);
  const summary = stageSummary(visible);

  $('#board').innerHTML = summary.map((stage) => {
    const cards = visible.filter((d) => d.stage === stage.id);
    return `
      <section class="column" data-stage="${stage.id}" aria-labelledby="col-${stage.id}">
        <header>
          <h2 id="col-${stage.id}">${stage.name} <span class="count">${stage.count}</span></h2>
          <div class="sum">${brl.format(stage.total)}${stage.probability > 0 && stage.probability < 1 ? ` · ${pct.format(stage.probability)}` : ''}</div>
        </header>
        <ul class="cards">
          ${cards.map((d) => cardHtml(d, stale.has(d.id))).join('') || `<li class="empty">${query ? 'Nada encontrado' : 'Arraste negócios para cá'}</li>`}
        </ul>
      </section>`;
  }).join('');
}

function render() {
  renderKpis();
  renderBoard();
}

// ---------- Arrastar e soltar ----------
let draggedId = null;

$('#board').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  draggedId = card.dataset.id;
  card.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', draggedId);
});

$('#board').addEventListener('dragend', (e) => {
  e.target.closest('.card')?.classList.remove('dragging');
  document.querySelectorAll('.column.drop').forEach((c) => c.classList.remove('drop'));
  draggedId = null;
});

$('#board').addEventListener('dragover', (e) => {
  const column = e.target.closest('.column');
  if (!column || !draggedId) return;
  e.preventDefault();
  document.querySelectorAll('.column.drop').forEach((c) => c !== column && c.classList.remove('drop'));
  column.classList.add('drop');
});

$('#board').addEventListener('drop', (e) => {
  const column = e.target.closest('.column');
  if (!column || !draggedId) return;
  e.preventDefault();
  // Solta antes do card sob o cursor (pela metade de cima) ou no fim da coluna
  const target = [...column.querySelectorAll('.card:not(.dragging)')]
    .find((c) => e.clientY < c.getBoundingClientRect().top + c.offsetHeight / 2);
  const id = draggedId;
  dispatch({ type: 'move', id, stage: column.dataset.stage, beforeId: target?.dataset.id });
  announce(`Movido para ${STAGES.find((s) => s.id === column.dataset.stage).name}`);
});

// ---------- Teclado: Alt+←/→ muda de etapa, Enter edita ----------
$('#board').addEventListener('keydown', (e) => {
  const card = e.target.closest('.card');
  if (!card) return;
  const deal = state.deals.find((d) => d.id === card.dataset.id);
  if (e.key === 'Enter') {
    e.preventDefault();
    openDialog(deal);
  } else if (e.altKey && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
    e.preventDefault();
    const index = STAGES.findIndex((s) => s.id === deal.stage) + (e.key === 'ArrowRight' ? 1 : -1);
    const next = STAGES[index];
    if (!next) return;
    dispatch({ type: 'move', id: deal.id, stage: next.id });
    announce(`${deal.title} movido para ${next.name}`);
    document.querySelector(`.card[data-id="${CSS.escape(deal.id)}"]`)?.focus();
  }
});

$('#board').addEventListener('dblclick', (e) => {
  const card = e.target.closest('.card');
  if (card) openDialog(state.deals.find((d) => d.id === card.dataset.id));
});

// ---------- Formulário ----------
const dialog = $('#deal-dialog');
const form = $('#deal-form');
const field = (name) => form.elements.namedItem(name);
field('stage').innerHTML = STAGES.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');

function openDialog(deal = null) {
  editingId = deal?.id ?? null;
  form.reset();
  $('#form-error').textContent = '';
  $('#dialog-title').textContent = deal ? 'Editar negócio' : 'Novo negócio';
  $('#delete-deal').hidden = !deal;
  if (deal) {
    for (const key of ['title', 'company', 'contact', 'owner', 'stage']) field(key).value = deal[key];
    field('value').value = deal.value.toFixed(2).replace('.', ',');
  }
  dialog.showModal();
  field('title').focus();
}

const parseMoney = (s) => {
  const clean = String(s).replace(/[R$\s]/g, '');
  if (!clean) return 0;
  return Number(clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean);
};

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const deal = { ...data, value: parseMoney(data.value) };
  try {
    if (editingId) {
      const current = state.deals.find((d) => d.id === editingId);
      let next = reducer(state, { type: 'update', id: editingId, patch: deal });
      if (current.stage !== deal.stage) next = reducer(next, { type: 'move', id: editingId, stage: deal.stage });
      state = next;
      save(storage, state);
      render();
    } else {
      dispatch({ type: 'add', deal });
    }
    dialog.close();
    announce('Negócio salvo');
  } catch (err) {
    $('#form-error').textContent = err.message;
  }
});

$('#cancel').addEventListener('click', () => dialog.close());
$('#delete-deal').addEventListener('click', () => {
  if (editingId && confirm('Excluir este negócio?')) {
    dispatch({ type: 'remove', id: editingId });
    dialog.close();
    announce('Negócio excluído');
  }
});

// ---------- Topo ----------
$('#new-deal').addEventListener('click', () => openDialog());
$('#search').addEventListener('input', (e) => { query = e.target.value; renderBoard(); });
$('#export').addEventListener('click', () => {
  const blob = new Blob([toCSV(state.deals)], { type: 'text/csv;charset=utf-8' });
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: `pipeline-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

render();
