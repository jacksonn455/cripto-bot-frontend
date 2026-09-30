import Link from "next/link";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      className="mt-8"
      title="Página não encontrada"
      description="O endereço acessado não existe neste painel."
      action={
        <Button asChild variant="outline" size="sm">
          <Link href="/">Voltar para a visão geral</Link>
        </Button>
      }
    />
  );
}
