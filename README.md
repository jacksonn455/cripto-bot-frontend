# Trade Bot — Painel

Painel Next.js para **acompanhar e controlar** o trade bot (backend NestJS em `../backend`).
Nenhuma lógica de trading roda aqui: o painel só lê dados do backend e envia os comandos
pausar, retomar e kill switch.

> Projeto educacional. Resultados passados, inclusive de backtest, não garantem resultados futuros.

## Como rodar

Requisitos: Node 20+ e pnpm (`corepack enable`, ou `corepack pnpm <comando>` se não puder habilitar).

```bash
cp .env.example .env.local   # ajuste se o backend não estiver em localhost:8000
pnpm install
pnpm dev                     # http://localhost:3000
```

O backend precisa estar rodando (`cd ../backend && pnpm start:dev`). Se ele estiver fora do ar,
o painel continua abrindo e mostra o aviso "Backend offline", tentando reconectar a cada 10 s.

Produção: `pnpm build && pnpm start`.

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | URL do backend. Fixada no momento do build. |
| `API_URL` | — | Opcional. Sobrescreve a anterior em tempo de execução, sem rebuild. |
| `API_KEY` | — | Opcional. Mesmo valor de `CONTROL_API_KEY` do backend. |

### Como a chave fica protegida

O navegador **nunca** chama o backend direto. Tudo passa pelo proxy `app/api/backend/[...path]`,
que roda no servidor do Next.js e:

- adiciona o header `X-Control-Api-Key` com `API_KEY` (a chave não vai para o navegador);
- repassa só os endpoints que o painel usa (lista fixa na rota) e exige `POST` para os comandos;
- responde `503 BACKEND_OFFLINE` / `504 BACKEND_TIMEOUT` quando o backend não responde.

### Login do painel (opcional, recomendado fora da sua máquina)

Sem `DASHBOARD_PASSWORD`, o painel fica aberto: **quem acessar a URL pode pausar o bot e acionar
o kill switch**. Com a senha definida:

- `proxy.ts` manda qualquer página para `/login` e responde 401 na API;
- o proxy do backend confere a sessão de novo, porque é ele que envia os comandos;
- a sessão é um cookie httpOnly assinado com HMAC-SHA256, válido por 7 dias;
- o login limita a 5 tentativas erradas por minuto por IP;
- sem sessão, o painel só renderiza a tela de login, sem consultas nem SSE.

| Variável | Uso |
| --- | --- |
| `DASHBOARD_PASSWORD` | Liga o login. |
| `SESSION_SECRET` | Opcional. Assina o cookie; se vazio, deriva da senha (trocar a senha desloga todos). |

### Apontar para outro backend

```bash
API_URL=http://192.168.0.10:8000 pnpm start   # sem rebuild
# ou, em dev: defina NEXT_PUBLIC_API_URL no .env.local e reinicie o pnpm dev
```

O backend limita 120 requisições por minuto por IP. Como tudo sai do servidor do painel, esse
limite vale para todas as abas abertas juntas.

## Scripts

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` / `pnpm start` | Build e servidor de produção |
| `pnpm test` | Testes (schemas Zod, cliente da API, proxy, componentes) |
| `pnpm test:contract` | Valida os schemas contra um backend real, só com GETs. Uso: `CONTRACT_API_URL=http://localhost:8000 pnpm test:contract` |
| `pnpm typecheck` / `pnpm lint` | TypeScript e ESLint |

## Estrutura

```
app/                      rotas (App Router) + proxy em app/api/backend
components/
  layout/                 cabeçalho, navegação, rodapé de risco, cabeçalho de página
  mode/                   selo de modo do bot e seletor de modo dos dados
  states/                 estados de erro, vazio, carregando e backend offline
  ui/                     componentes shadcn/ui
hooks/                    hooks de dados (TanStack Query) e contexto de modo
lib/
  api/                    cliente tipado (client.ts) e um método por endpoint (endpoints.ts)
  schemas/                schemas Zod, gerados a partir dos DTOs do backend
  format.ts               formatação pt-BR (moeda, %, datas, sinal +/−)
test/                     fixtures de exemplo e teste de contrato
```

## Telas prontas

- **Visão geral (`/`)**: cartões de desempenho, status do bot, controles (pausar, retomar e kill
  switch com confirmação), último sinal por símbolo, curva de capital com drawdown e posições abertas.
- **Trades (`/trades`)**: tabela com filtros, ordenação e paginação feitas no servidor, e exportação
  CSV. Os filtros ficam na URL, então dá para recarregar ou compartilhar a visão filtrada.
  O detalhe (`/trades/[id]`) mostra os candles do período da trade, com setas de entrada e saída e
  linhas de entrada, stop e alvo.

- **Análises (`/analytics`)**: métricas (win rate, payoff, profit factor, expectância, retorno
  médio, Sharpe e Sortino por trade, maior sequência de perdas, tempo médio em posição, drawdown).
  Também tem PnL por estratégia, símbolo, hora do dia e dia da semana (no fuso do navegador),
  histograma do PnL e motivos de saída. O período filtra pela data de saída.
  - A comparação "Backtest × paper × live" coloca as mesmas métricas lado a lado. Por padrão ela usa
    a execução de backtest mais recente e destaca as diferenças grandes. Com menos de 30 trades num
    modo, aparece o aviso de amostra pequena.

- **Mercado (`/market`)**: candles com seletor de símbolo, timeframe e quantidade.
  - As EMAs usam os mesmos períodos da estratégia (lidos de `/strategies`) e a mesma fórmula do
    backend (conferida contra o `technicalindicators`). São só para exibição.
  - Mostra as trades do modo selecionado como marcadores.
- **Backtests (`/backtests`)**:
  - Card "O que é backtest e para que serve esta tela" com checklist antes de confiar num resultado.
  - Lista paginada (10/20/50) com resultado em %, comparação com comprar e segurar, pior queda e
    uma leitura curta (veredito) de cada execução.
  - "O que esse resultado quer dizer" no detalhe e logo após rodar: veredito (inconclusivo,
    prejuízo, pior que segurar, instável, promissor) e explicações em linguagem simples
    (amostra, taxas, acertos × payoff, walk-forward, overfitting). Regras em `lib/backtest-explain.ts`.
  - Formulário completo: estratégia, símbolo, timeframe, período, saldo, taxa, slippage,
    walk-forward e parâmetros da estratégia. Só os parâmetros alterados são enviados.
  - Lista de execuções e detalhe de cada uma: parâmetros, métricas, curva de capital, janelas de
    walk-forward, comparação com paper/live e trades.
  - Comparação de duas execuções lado a lado, com os parâmetros diferentes destacados.
  - Aviso de overfitting sempre visível, com o número de combinações de parâmetros já testadas.

- **Funding (`/funding`)**: ranking do último scan, com busca, ordem (maiores, menores/negativas ou
  maior magnitude) e taxa anualizada. Somente leitura.
- **Sinais e eventos (`/signals`)**:
  - Feed em tempo real com entradas, saídas, vetos de risco, sinais aprovados, pausa/retomada,
    erros e alertas. Tem filtro por tipo e reconexão automática, e guarda os últimos 200 eventos
    desde que o painel foi aberto.
  - Lista de sinais avaliados pelo risco (`/signals`), com os vetados e o motivo de cada veto.
    Se o backend não tiver o endpoint, aparece "endpoint indisponível".

Componentes de gráfico reutilizáveis: `EquityChart`, `CandleChart`, `BarMetricChart` e `Histogram`
(em `components/charts`).

Bibliotecas de tabela e gráfico: TanStack Table **v9** (API nova: `useTable` + `tableFeatures`,
diferente da v8), lightweight-charts v5 e Recharts.

## Atualização em tempo real

- Uma conexão SSE (`/events/stream`, via proxy) atualiza status, trades e relatórios assim que o bot
  abre ou fecha uma trade, pausa ou dispara um alerta. Alertas críticos aparecem como notificação.
  O indicador "Ao vivo" no cabeçalho mostra o estado da conexão, e ela reconecta sozinha.
- A cada conexão e reconexão, o painel carrega o histórico (`/events/recent`, 30 dias no backend)
  e junta com o que chega ao vivo, sem duplicar (cada evento tem `id`). Assim o feed mostra também
  o que aconteceu com o painel fechado ou durante uma queda.
- Se o backend cair e voltar, as consultas que falharam são refeitas sozinhas.
- A Visão geral mostra a saúde do MongoDB e do Redis (`/health`).
- Além disso, há polling leve: status e posições a cada 10 s, preços a cada 15 s e o resto a cada
  30 s. O polling pausa quando a aba fica oculta.
- O alerta de "loop parado" usa o heartbeat `lastPollAt`: dispara depois de 3 intervalos de polling
  sem notícia, e nunca antes de 2 min.

## Modos

- O **selo no cabeçalho** mostra em que modo o bot está rodando (`/bot/status`: PAPER ou LIVE).
  LIVE aparece em vermelho, com o aviso "dinheiro real".
- O seletor **"Dados:"** escolhe de qual modo são os dados exibidos (PAPER, LIVE ou BACKTEST).
  O padrão é PAPER, e a escolha fica salva em cookie. Não existe a opção "todos": as telas
  nunca misturam modos, exceto a comparação entre modos, que é explícita.
- Quando o modo dos dados é diferente do modo do bot, cada tela mostra um aviso.
