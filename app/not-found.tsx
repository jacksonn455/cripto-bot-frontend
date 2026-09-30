import Link from "next/link";
import { BrandMark } from "@/components/layout/brand";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-6 text-center">
      <BrandMark size={72} decorative={false} />
      <div className="space-y-1">
        <p className="font-medium">Página não encontrada</p>
        <p className="max-w-prose text-sm text-muted-foreground">O endereço acessado não existe no Krypto.</p>
      </div>
      <Button asChild variant="outline" size="sm">
        <Link href="/">Voltar para a visão geral</Link>
      </Button>
    </div>
  );
}
