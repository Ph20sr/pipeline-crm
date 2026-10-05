// Dados fictícios para a primeira visita.
const daysAgo = (n) => new Date(Date.now() - n * 86_400_000).toISOString();

const raw = [
  ['Site institucional', 'Clínica Sorriso Pleno', 'Dra. Carla', 4800, 'lead', 'Pedro', 2],
  ['Landing page + tráfego', 'Academia Ponto Fit', 'Rafael', 3200, 'lead', 'Ana', 5],
  ['CRM para equipe comercial', 'Imobiliária Horizonte', 'Marcos', 18000, 'qualified', 'Pedro', 6],
  ['Loja virtual', 'Empório Serra Verde', 'Juliana', 12500, 'qualified', 'Ana', 18],
  ['Sistema de agendamento', 'Barbearia Navalha', 'Thiago', 6900, 'proposal', 'Pedro', 3],
  ['Portal do aluno', 'Escola Caminho do Saber', 'Patrícia', 22000, 'proposal', 'Lucas', 21],
  ['Integração Asaas + ERP', 'Distribuidora Rota Sul', 'Fernando', 15000, 'negotiation', 'Pedro', 4],
  ['Painel de gestão', 'Contabilidade Exata', 'Renata', 9800, 'negotiation', 'Lucas', 9],
  ['Manutenção mensal', 'Pet Shop Amigo Fiel', 'Bruno', 1500, 'won', 'Ana', 1],
  ['App de pedidos', 'Pizzaria Forno a Lenha', 'Giovana', 14000, 'won', 'Pedro', 12],
  ['Site + blog', 'Advocacia Lima & Reis', 'Dr. Lima', 5600, 'lost', 'Lucas', 15],
];

export const seedDeals = raw.map(([title, company, contact, value, stage, owner, age], i) => ({
  id: `seed_${i}`,
  title, company, contact, value, stage, owner,
  createdAt: daysAgo(age + 10),
  stageChangedAt: daysAgo(age),
  history: [{ stage, at: daysAgo(age) }],
}));
