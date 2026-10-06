import Link from "next/link";
import { PublicShell } from "@/components/layout/public-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function NotFound() {
  return (
    <PublicShell>
      <Card className="space-y-4 text-center">
        <h1 className="font-display text-2xl font-semibold text-main">No encontramos esta página</h1>
        <p className="text-muted-foreground">Puede que el link esté mal o que no tengas acceso a lo que buscás.</p>
        <Button asChild>
          <Link href="/">Ir a mis reclamos</Link>
        </Button>
      </Card>
    </PublicShell>
  );
}
