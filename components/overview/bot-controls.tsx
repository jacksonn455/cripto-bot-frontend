"use client";

import { CirclePause, CirclePlay, OctagonX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { describeError } from "@/components/states/error-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useBotControls } from "@/hooks/use-bot-controls";
import { pauseReasonLabel } from "@/lib/bot-health";
import type { BotStatus, KillSwitchResult } from "@/lib/schemas";

export const KILL_SWITCH_WORD = "CONFIRMAR";

/** Actions always target the bot's running mode (from /bot/status), never the data filter. */
export function BotControls({ status }: { status: BotStatus | undefined }) {
  const [open, setOpen] = useState<"pause" | "resume" | "kill" | null>(null);
  const disabled = !status;
  const close = () => setOpen(null);

  return (
    <div className="flex flex-wrap gap-2">
      {status?.paused ? (
        <Button variant="outline" onClick={() => setOpen("resume")} disabled={disabled}>
          <CirclePlay aria-hidden /> Retomar
        </Button>
      ) : (
        <Button variant="outline" onClick={() => setOpen("pause")} disabled={disabled}>
          <CirclePause aria-hidden /> Pausar
        </Button>
      )}
      <Button
        onClick={() => setOpen("kill")}
        disabled={disabled}
        className="bg-mode-live text-white hover:bg-mode-live/90 focus-visible:ring-destructive/40"
      >
        <OctagonX aria-hidden /> Kill switch
      </Button>

      {status && (
        <>
          <PauseDialog open={open === "pause"} onClose={close} status={status} />
          <ResumeDialog open={open === "resume"} onClose={close} status={status} />
          <KillSwitchDialog open={open === "kill"} onClose={close} status={status} />
        </>
      )}
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onClose: () => void;
  status: BotStatus;
}

function ErrorLine({ error }: { error: unknown }) {
  if (!error) return null;
  const { title, message } = describeError(error);
  return (
    <p role="alert" className="rounded-md border border-loss/40 bg-loss/10 px-3 py-2 text-sm">
      <strong>{title}:</strong> {message}
    </p>
  );
}

function PauseDialog({ open, onClose, status }: DialogProps) {
  const { pause } = useBotControls();
  const [reason, setReason] = useState("");

  const submit = () =>
    pause.mutate(reason.trim() || undefined, {
      onSuccess: (state) => {
        toast.success("Bot pausado", { description: pauseReasonLabel(state.pauseReason) });
        setReason("");
        onClose();
      },
    });

  return (
    <Dialog open={open} onOpenChange={(o) => {
        if (!o) {
          pause.reset();
          onClose();
        }
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pausar o bot ({status.mode})?</DialogTitle>
          <DialogDescription>
            Novas entradas ficam bloqueadas. Posições abertas continuam sendo monitoradas e podem ser fechadas pelo stop
            ou alvo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="pause-reason">Motivo (opcional)</Label>
          <Textarea
            id="pause-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: revisar parâmetros da estratégia"
            maxLength={200}
          />
        </div>
        <ErrorLine error={pause.error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={submit} disabled={pause.isPending}>
            {pause.isPending ? "Pausando…" : "Pausar bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResumeDialog({ open, onClose, status }: DialogProps) {
  const { resume } = useBotControls();
  const submit = () =>
    resume.mutate(undefined, {
      onSuccess: () => {
        toast.success("Bot retomado", { description: "Novas entradas voltam a ser permitidas." });
        onClose();
      },
    });

  return (
    <Dialog open={open} onOpenChange={(o) => {
        if (!o) {
          resume.reset();
          onClose();
        }
      }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retomar o bot ({status.mode})?</DialogTitle>
          <DialogDescription>
            Pausado por: {pauseReasonLabel(status.pauseReason)}. Ao retomar, o bot volta a abrir posições
            {status.mode === "LIVE" ? " com dinheiro real." : " simuladas."}
          </DialogDescription>
        </DialogHeader>
        <ErrorLine error={resume.error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancelar</Button>
          </DialogClose>
          <Button onClick={submit} disabled={resume.isPending}>
            {resume.isPending ? "Retomando…" : "Retomar bot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function KillSwitchDialog({ open, onClose, status }: DialogProps) {
  const { killSwitch } = useBotControls();
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState<KillSwitchResult | null>(null);
  const confirmed = typed.trim() === KILL_SWITCH_WORD;

  const handleOpenChange = (o: boolean) => {
    if (o || killSwitch.isPending) return;
    killSwitch.reset();
    setTyped("");
    setResult(null);
    onClose();
  };

  const submit = () =>
    killSwitch.mutate(undefined, {
      onSuccess: (r) => {
        setResult(r);
        toast.warning("Kill switch executado", {
          description: `${r.canceledOrders} ordem(ns) cancelada(s), ${r.closedPositions} posição(ões) fechada(s). Bot pausado.`,
        });
      },
    });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle>Kill switch executado</DialogTitle>
              <DialogDescription>Resultado informado pelo backend:</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-2 gap-3 text-sm" aria-live="polite">
              <div className="rounded-md border p-3">
                <dt className="text-muted-foreground">Ordens canceladas</dt>
                <dd className="text-2xl font-semibold tabular-nums">{result.canceledOrders}</dd>
              </div>
              <div className="rounded-md border p-3">
                <dt className="text-muted-foreground">Posições fechadas</dt>
                <dd className="text-2xl font-semibold tabular-nums">{result.closedPositions}</dd>
              </div>
            </dl>
            <p className="text-sm text-muted-foreground">
              O bot foi pausado. Falhas individuais não interrompem o kill switch e só aparecem no log do backend: confira
              a lista de posições abertas.
            </p>
            <DialogFooter>
              <DialogClose asChild>
                <Button>Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-loss">Acionar kill switch ({status.mode})?</DialogTitle>
              <DialogDescription asChild>
                <div className="space-y-2">
                  <p>Esta ação não pode ser desfeita. O backend vai:</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>cancelar todas as ordens abertas;</li>
                    <li>
                      fechar a mercado todas as {status.openTrades} posição(ões) abertas
                      {status.mode === "LIVE" && <strong> com dinheiro real</strong>};
                    </li>
                    <li>pausar o bot.</li>
                  </ul>
                </div>
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="kill-confirm">
                Digite <strong>{KILL_SWITCH_WORD}</strong> para continuar
              </Label>
              <Input
                id="kill-confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                onKeyDown={(e) => e.key === "Enter" && confirmed && !killSwitch.isPending && submit()}
              />
            </div>
            <ErrorLine error={killSwitch.error} />
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline" disabled={killSwitch.isPending}>
                  Cancelar
                </Button>
              </DialogClose>
              <Button
                onClick={submit}
                disabled={!confirmed || killSwitch.isPending}
                className="bg-mode-live text-white hover:bg-mode-live/90"
              >
                {killSwitch.isPending ? "Executando…" : "Acionar kill switch"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
