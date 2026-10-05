// Estado e regras do pipeline, sem DOM: testável no Node.

export const STAGES = [
  { id: 'lead', name: 'Lead', probability: 0.1 },
  { id: 'qualified', name: 'Qualificado', probability: 0.25 },
  { id: 'proposal', name: 'Proposta', probability: 0.5 },
  { id: 'negotiation', name: 'Negociação', probability: 0.75 },
  { id: 'won', name: 'Ganho', probability: 1 },
  { id: 'lost', name: 'Perdido', probability: 0 },
];

const stageIds = new Set(STAGES.map((s) => s.id));
const DAY = 86_400_000;

let counter = 0;
const newId = () => `d_${Date.now().toString(36)}${(counter++).toString(36)}`;

export function createDeal(input, now = new Date()) {
  const title = String(input.title ?? '').trim();
  if (!title) throw new TypeError('O negócio precisa de um título');
  const value = Number(input.value ?? 0);
  if (!Number.isFinite(value) || value < 0) throw new RangeError('Valor inválido');
  const stage = input.stage ?? 'lead';
  if (!stageIds.has(stage)) throw new RangeError(`Etapa desconhecida: ${stage}`);

  return {
    id: input.id ?? newId(),
    title,
    company: String(input.company ?? '').trim(),
    contact: String(input.contact ?? '').trim(),
    value: Math.round(value * 100) / 100,
    stage,
    owner: String(input.owner ?? '').trim(),
    createdAt: input.createdAt ?? now.toISOString(),
    stageChangedAt: input.stageChangedAt ?? now.toISOString(),
    history: input.history ?? [{ stage, at: now.toISOString() }],
  };
}

/** Reducer puro: (state, action) -> novo state. */
export function reducer(state, action) {
  const now = action.now ?? new Date();
  switch (action.type) {
    case 'add':
      return { ...state, deals: [...state.deals, createDeal(action.deal, now)] };

    case 'update':
      return {
        ...state,
        deals: state.deals.map((d) => (d.id === action.id
          ? createDeal({ ...d, ...action.patch, id: d.id, stage: d.stage, history: d.history }, now)
          : d)),
      };

    case 'move': {
      if (!stageIds.has(action.stage)) throw new RangeError(`Etapa desconhecida: ${action.stage}`);
      const deals = state.deals.filter((d) => d.id !== action.id);
      const deal = state.deals.find((d) => d.id === action.id);
      if (!deal) return state;
      const moved = deal.stage === action.stage ? deal : {
        ...deal,
        stage: action.stage,
        stageChangedAt: now.toISOString(),
        history: [...deal.history, { stage: action.stage, at: now.toISOString() }],
      };
      // Reposiciona dentro da coluna de destino (antes de beforeId, ou no fim)
      const index = action.beforeId ? deals.findIndex((d) => d.id === action.beforeId) : -1;
      if (index === -1) deals.push(moved);
      else deals.splice(index, 0, moved);
      return { ...state, deals };
    }

    case 'remove':
      return { ...state, deals: state.deals.filter((d) => d.id !== action.id) };

    case 'replace':
      return { ...state, deals: action.deals.map((d) => createDeal(d, now)) };

    default:
      return state;
  }
}

export function matches(deal, query) {
  const q = normalize(query).trim();
  if (!q) return true;
  return normalize(`${deal.title} ${deal.company} ${deal.contact} ${deal.owner}`).includes(q);
}

const normalize = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Totais por etapa: quantidade, soma e soma ponderada pela probabilidade. */
export function stageSummary(deals) {
  return STAGES.map((stage) => {
    const inStage = deals.filter((d) => d.stage === stage.id);
    const total = inStage.reduce((sum, d) => sum + d.value, 0);
    return { ...stage, count: inStage.length, total, weighted: total * stage.probability };
  });
}

/** Métricas do funil. */
export function metrics(deals, now = new Date()) {
  const open = deals.filter((d) => d.stage !== 'won' && d.stage !== 'lost');
  const won = deals.filter((d) => d.stage === 'won');
  const lost = deals.filter((d) => d.stage === 'lost');
  const closed = won.length + lost.length;
  const forecast = stageSummary(open).reduce((sum, s) => sum + s.weighted, 0);
  const stale = open.filter((d) => now - new Date(d.stageChangedAt) > 14 * DAY);

  return {
    openCount: open.length,
    openValue: open.reduce((s, d) => s + d.value, 0),
    forecast,
    wonValue: won.reduce((s, d) => s + d.value, 0),
    winRate: closed ? won.length / closed : null,
    averageTicket: won.length ? won.reduce((s, d) => s + d.value, 0) / won.length : null,
    staleIds: stale.map((d) => d.id),
  };
}

export const daysInStage = (deal, now = new Date()) => Math.floor((now - new Date(deal.stageChangedAt)) / DAY);

const csvCell = (v) => {
  const s = String(v ?? '');
  // Neutraliza fórmulas (CSV injection) e escapa aspas
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return /[";\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** CSV com ";" e vírgula decimal, que abre direto no Excel em pt-BR. */
export function toCSV(deals) {
  const stageName = Object.fromEntries(STAGES.map((s) => [s.id, s.name]));
  const header = ['Título', 'Empresa', 'Contato', 'Responsável', 'Etapa', 'Valor', 'Criado em', 'Na etapa desde'];
  const rows = deals.map((d) => [
    d.title, d.company, d.contact, d.owner, stageName[d.stage],
    d.value.toFixed(2).replace('.', ','), d.createdAt.slice(0, 10), d.stageChangedAt.slice(0, 10),
  ]);
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

const STORAGE_KEY = 'pipeline-crm:v1';

export function load(storage, fallback) {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.deals) ? { deals: parsed.deals.map((d) => createDeal(d)) } : fallback;
  } catch {
    return fallback;
  }
}

export function save(storage, state) {
  try { storage?.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage cheio ou bloqueado */ }
}
