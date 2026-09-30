import { CheckSquare, HelpCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MIN_TRADES } from "@/lib/backtest-explain";

const CHECKLIST = [
  `Teve pelo menos ${MIN_TRADES} trades (menos que isso pode ser sorte).`,
  "Ganhou de simplesmente comprar e segurar a moeda no mesmo período.",
  "A pior queda do saldo é algo que você aguentaria com dinheiro real.",
  "Com walk-forward, lucrou na maioria das janelas, não só em uma.",
  "Você não testou dezenas de combinações até achar uma que “deu certo”.",
  "Depois de tudo isso, confirme em paper antes de pensar em dinheiro real.",
];

/** What a backtest is and how to read one, for people new to it. */
export function BacktestExplainer() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HelpCircle className="size-4" aria-hidden /> O que é backtest e para que serve esta tela
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-3">
        <section className="space-y-1">
          <h3 className="font-medium">O que é</h3>
          <p className="text-muted-foreground">
            Um teste da estratégia no passado: o Krypto “finge” que estava operando em um período que já aconteceu e mostra
            quanto teria ganho ou perdido. Nenhuma ordem é enviada e nenhum dinheiro é usado.
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">Como funciona aqui</h3>
          <p className="text-muted-foreground">
            A simulação vê o mercado como o Krypto ao vivo: candle a candle, com as mesmas regras de risco, cobrando taxas e
            slippage (a diferença entre o preço esperado e o preço executado). As trades ficam gravadas como BACKTEST.
          </p>
        </section>
        <section className="space-y-1">
          <h3 className="font-medium">Para que serve</h3>
          <p className="text-muted-foreground">
            Descartar ideias ruins rápido e sem custo, e comparar parâmetros. Um bom resultado aqui não garante nada: é só o
            primeiro filtro antes de testar em paper.
          </p>
        </section>
        <details className="md:col-span-3">
          <summary className="flex cursor-pointer items-center gap-2 font-medium hover:text-foreground">
            <CheckSquare className="size-4 text-muted-foreground" aria-hidden /> Antes de confiar num resultado, confira
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-muted-foreground">
            {CHECKLIST.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      </CardContent>
    </Card>
  );
}
