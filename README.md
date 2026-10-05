# Pipeline CRM

[![CI](https://github.com/Ph20sr/pipeline-crm/actions/workflows/ci.yml/badge.svg)](https://github.com/Ph20sr/pipeline-crm/actions/workflows/ci.yml)
[![Deploy](https://github.com/Ph20sr/pipeline-crm/actions/workflows/pages.yml/badge.svg)](https://ph20sr.github.io/pipeline-crm/)
![license](https://img.shields.io/badge/license-MIT-blue)

Funil de vendas em kanban para pequenas equipes comerciais. Roda 100% no navegador, sem build e sem dependências.

**[Abrir a demo →](https://ph20sr.github.io/pipeline-crm/)**

## Funcionalidades

- **Kanban** com 6 etapas (Lead → Qualificado → Proposta → Negociação → Ganho/Perdido), com arrastar e soltar e reordenação dentro da coluna
- **Indicadores**: valor em aberto, **previsão ponderada** (valor × probabilidade da etapa), total ganho, ticket médio e taxa de conversão
- **Alerta de negócio parado**: cards há mais de 14 dias na mesma etapa ficam destacados
- **Histórico de etapas** por negócio (base para medir o tempo médio de cada etapa)
- **Busca** que ignora acentos: `emporio` encontra "Empório"
- **Exportar CSV** pronto para o Excel em pt-BR (`;`, vírgula decimal e BOM), com proteção contra *CSV injection*
- **Acessível pelo teclado**: Tab até o card, **Enter** edita e **Alt + ← / →** muda de etapa; as ações são anunciadas para leitores de tela
- Responsivo (no celular, o quadro rola na horizontal sem quebrar a página) e com tema claro/escuro automático
- Dados salvos no `localStorage`

## Arquitetura

```
index.html      layout e diálogo (<dialog> nativo)
styles.css      tokens de cor, tema escuro, grid do quadro
src/store.js    regras de negócio puras: reducer, métricas, CSV, persistência
src/app.js      renderização, drag and drop e teclado
src/seed.js     dados fictícios da primeira visita
```

Toda a regra de negócio fica em `store.js`, um reducer puro sem DOM, testado com `node:test`. A interface só despacha ações e re-renderiza. Trocar o `localStorage` por uma API REST é questão de substituir `load`/`save`.

## Rodando localmente

```bash
npm run dev    # http://localhost:5173
npm test
```

O deploy no GitHub Pages é automático a cada push na `main` (`.github/workflows/pages.yml`). Os testes rodam antes da publicação.

## Licença

MIT
