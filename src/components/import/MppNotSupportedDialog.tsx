import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileWarning } from "lucide-react";

export function MppNotSupportedDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileWarning className="h-5 w-5 text-amber-600" />
            Arquivo .mpp precisa ser convertido para XML
          </DialogTitle>
          <DialogDescription>
            Por enquanto importamos somente o formato XML do MS Project. O arquivo .mpp é binário proprietário e não é lido diretamente.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p className="font-medium">Como converter no MS Project:</p>
          <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
            <li>Abra o arquivo .mpp no Microsoft Project.</li>
            <li>Vá em <strong>Arquivo → Salvar como</strong>.</li>
            <li>Em <strong>Tipo</strong>, selecione <strong>XML (*.xml)</strong>.</li>
            <li>Salve e selecione esse .xml aqui na importação.</li>
          </ol>
          <p className="text-xs text-muted-foreground pt-2">
            Suporte direto a .mpp está no roadmap (requer biblioteca WASM de ~10 MB carregada sob demanda).
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Entendi</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
