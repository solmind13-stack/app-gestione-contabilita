// src/app/(app)/movimenti/page.tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlusCircle, Upload, FileText, FileSpreadsheet, FileCode, Image } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { movimentiData, riepilogoMovimenti } from '@/lib/movimenti-data';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

export default function MovimentiPage() {
  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Movimenti</CardTitle>
            <CardDescription>
              Visualizza, aggiungi e importa i tuoi movimenti finanziari.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Aggiungi Movimento
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Upload className="mr-2 h-4 w-4" />
                  Importa
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  <span>Importa da Excel</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <FileText className="mr-2 h-4 w-4" />
                  <span>Importa da PDF</span>
                </DropdownMenuItem>
                 <DropdownMenuItem>
                  <FileCode className="mr-2 h-4 w-4" />
                  <span>Importa da Word</span>
                </DropdownMenuItem>
                 <DropdownMenuItem>
                  <Image className="mr-2 h-4 w-4" />
                  <span>Importa da Immagine</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>% IVA</TableHead>
                  <TableHead className="text-right">Entrate</TableHead>
                  <TableHead className="text-right">Uscite</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentiData.map((movimento) => (
                  <TableRow key={movimento.id}>
                    <TableCell className="whitespace-nowrap">{movimento.data}</TableCell>
                    <TableCell>{movimento.descrizione}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{movimento.categoria}</Badge>
                    </TableCell>
                    <TableCell>{movimento.iva * 100}%</TableCell>
                    <TableCell className={cn("text-right font-medium", movimento.entrata > 0 && "text-green-600")}>
                      {movimento.entrata > 0 ? formatCurrency(movimento.entrata) : '-'}
                    </TableCell>
                    <TableCell className={cn("text-right font-medium", movimento.uscita > 0 && "text-red-600")}>
                      {movimento.uscita > 0 ? formatCurrency(movimento.uscita) : '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
               <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>TOTALI</TableCell>
                  <TableCell className="text-right font-bold text-green-600">{formatCurrency(movimentiData.reduce((acc, m) => acc + m.entrata, 0))}</TableCell>
                  <TableCell className="text-right font-bold text-red-600">{formatCurrency(movimentiData.reduce((acc, m) => acc + m.uscita, 0))}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="w-full md:w-1/2 lg:w-1/3">
          <CardHeader>
              <CardTitle>Riepilogo Movimenti LNC</CardTitle>
          </CardHeader>
          <CardContent>
              <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogoMovimenti.totaleEntrate)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">Totale Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogoMovimenti.totaleUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>Saldo:</span>
                      <span>{formatCurrency(riepilogoMovimenti.saldo)}</span>
                  </div>
                   <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Entrate:</span>
                      <span className="font-medium">{formatCurrency(riepilogoMovimenti.ivaEntrate)}</span>
                  </div>
                  <div className="flex justify-between">
                      <span className="text-muted-foreground">IVA Uscite:</span>
                      <span className="font-medium">{formatCurrency(riepilogoMovimenti.ivaUscite)}</span>
                  </div>
                   <div className="flex justify-between font-bold">
                      <span>IVA Netta:</span>
                      <span>{formatCurrency(riepilogoMovimenti.ivaNetta)}</span>
                  </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
