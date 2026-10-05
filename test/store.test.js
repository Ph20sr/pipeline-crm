import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDeal, reducer, matches, stageSummary, metrics, daysInStage, toCSV, load, save,
} from '../src/store.js';

const t0 = new Date('2026-10-01T12:00:00Z');
const t1 = new Date('2026-10-05T12:00:00Z');

const deal = (over = {}) => createDeal({ title: 'Site institucional', company: 'Padaria São João', value: 4500, ...over }, t0);

test('createDeal valida e normaliza', () => {
  const d = deal({ value: 1234.567 });
  assert.equal(d.value, 1234.57);
  assert.equal(d.stage, 'lead');
  assert.deepEqual(d.history, [{ stage: 'lead', at: t0.toISOString() }]);
  assert.throws(() => createDeal({ title: '  ' }), TypeError);
  assert.throws(() => createDeal({ title: 'x', value: -1 }), RangeError);
  assert.throws(() => createDeal({ title: 'x', stage: 'nope' }), RangeError);
});

test('move registra histórico e reposiciona na coluna', () => {
  const a = deal({ id: 'a' });
  const b = deal({ id: 'b', stage: 'proposal' });
  const c = deal({ id: 'c', stage: 'proposal' });
  let state = { deals: [a, b, c] };

  state = reducer(state, { type: 'move', id: 'a', stage: 'proposal', beforeId: 'c', now: t1 });
  assert.deepEqual(state.deals.map((d) => d.id), ['b', 'a', 'c']);
  const moved = state.deals.find((d) => d.id === 'a');
  assert.equal(moved.stage, 'proposal');
  assert.equal(moved.stageChangedAt, t1.toISOString());
  assert.equal(moved.history.length, 2);

  // Reordenar na mesma etapa não altera histórico
  state = reducer(state, { type: 'move', id: 'a', stage: 'proposal', now: t1 });
  assert.deepEqual(state.deals.map((d) => d.id), ['b', 'c', 'a']);
  assert.equal(state.deals.find((d) => d.id === 'a').history.length, 2);

  assert.throws(() => reducer(state, { type: 'move', id: 'a', stage: 'x' }), RangeError);
  assert.equal(reducer(state, { type: 'move', id: 'zzz', stage: 'won' }), state);
});

test('update não deixa trocar etapa nem histórico por fora do move', () => {
  const state = reducer({ deals: [deal({ id: 'a' })] }, { type: 'update', id: 'a', patch: { value: 9000, stage: 'won' } });
  assert.equal(state.deals[0].value, 9000);
  assert.equal(state.deals[0].stage, 'lead');
});

test('busca ignora acentos e caixa', () => {
  const d = deal({ contact: 'José' });
  assert.equal(matches(d, 'padaria sao'), true);
  assert.equal(matches(d, 'jose'), true);
  assert.equal(matches(d, 'mecânica'), false);
  assert.equal(matches(d, ''), true);
});

test('resumo por etapa e métricas do funil', () => {
  const deals = [
    deal({ id: '1', stage: 'proposal', value: 1000 }),
    deal({ id: '2', stage: 'negotiation', value: 2000 }),
    deal({ id: '3', stage: 'won', value: 3000 }),
    deal({ id: '4', stage: 'won', value: 5000 }),
    deal({ id: '5', stage: 'lost', value: 7000 }),
  ];
  const proposal = stageSummary(deals).find((s) => s.id === 'proposal');
  assert.deepEqual([proposal.count, proposal.total, proposal.weighted], [1, 1000, 500]);

  const m = metrics(deals, new Date('2026-10-20T12:00:00Z'));
  assert.equal(m.openCount, 2);
  assert.equal(m.openValue, 3000);
  assert.equal(m.forecast, 500 + 1500);
  assert.equal(m.wonValue, 8000);
  assert.equal(m.winRate, 2 / 3);
  assert.equal(m.averageTicket, 4000);
  assert.deepEqual(m.staleIds, ['1', '2'], 'abertos há mais de 14 dias na mesma etapa');
  assert.equal(metrics([]).winRate, null);
});

test('daysInStage', () => {
  assert.equal(daysInStage(deal(), t1), 4);
});

test('CSV para Excel pt-BR, com proteção contra fórmulas', () => {
  const csv = toCSV([deal({ title: '=HYPERLINK("x")', company: 'A; B', value: 1500.5 })]);
  const [header, row] = csv.slice(1).split('\r\n');
  assert.ok(csv.startsWith('﻿'), 'BOM para acentos no Excel');
  assert.equal(header, 'Título;Empresa;Contato;Responsável;Etapa;Valor;Criado em;Na etapa desde');
  assert.equal(row, `"'=HYPERLINK(""x"")";"A; B";;;Lead;1500,50;2026-10-01;2026-10-01`);
});

test('load/save toleram storage ausente ou corrompido', () => {
  const map = new Map();
  const storage = { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) };
  const fallback = { deals: [] };

  assert.equal(load(storage, fallback), fallback);
  save(storage, { deals: [deal({ id: 'x' })] });
  assert.equal(load(storage, fallback).deals[0].id, 'x');

  map.set('pipeline-crm:v1', '{quebrado');
  assert.equal(load(storage, fallback), fallback);
  assert.equal(load(null, fallback), fallback);
  save({ setItem: () => { throw new Error('QuotaExceeded'); } }, { deals: [] });
});
