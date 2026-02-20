
'use server';

/**
 * @fileOverview Un flow AI per l'audit trail e la verifica dell'integrità dei dati.
 * - logDataChange - Registra le modifiche ai dati finanziari.
 * - verifyDataIntegrity - Analizza la qualità dei dati e genera un report di riconciliazione.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import { startOfToday, subMonths, parseISO, isBefore, format } from 'date-fns';
import { it } from 'date-fns/locale';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

/**
 * Registra una modifica ai dati nella collection dataAuditLog.
 * @param params Dettagli dell'operazione e dati modificati.
 */
export async function logDataChange(params: {
  societa: string;
  userId: string;
  collection: string;
  documentId: string;
  action: 'create' | 'update' | 'delete';
  previousData: any;
  newData: any;
  changedFields?: string[];
  source: 'manual' | 'import' | 'ai_suggestion' | 'bulk_operation';
}) {
  try {
    const logRef = collection(db, 'dataAuditLog');
    await addDoc(logRef, {
      ...params,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Errore durante il logging dell'audit trail:", error);
  }
}

const VerifyDataIntegrityInputSchema = z.object({
  societa: z.string().describe("La società per cui verificare l'integrità dei dati."),
  userId: z.string().describe("L'ID dell'utente che richiede la verifica."),
});

const IssueSchema = z.object({
  type: z.string(),
  severity: z.enum(['error', 'warning']),
  description: z.string(),
  documentId: z.string().optional(),
  collection: z.string().optional(),
});

const VerifyDataIntegrityOutputSchema = z.object({
  issues: z.array(IssueSchema),
  totalIssues: z.number(),
  narrative: z.string().describe("Un report narrativo generato dall'AI sull'integrità e riconciliazione."),
});

export async function verifyDataIntegrity(input: z.infer<typeof VerifyDataIntegrityInputSchema>) {
  return verifyDataIntegrityFlow(input);
}

const integrityPrompt = ai.definePrompt({
  name: 'dataIntegrityNarrativePrompt',
  input: { 
    schema: z.object({ 
      issues: z.string(), 
      societa: z.string(),
      reconData: z.string()
    }) 
  },
  output: { schema: z.object({ narrative: z.string() }) },
  prompt: `
    Sei un Senior Financial Auditor esperto in contabilità italiana.
    Hai eseguito un'analisi dell'integrità dei dati per la società {{societa}}.
    
    PROBLEMI RILEVATI:
    {{issues}}
    
    DATI DI RICONCILIAZIONE (Mese Scorso):
    {{reconData}}
    
    IL TUO COMPITO:
    1. Genera un report di sintesi professionale in italiano.
    2. Inizia con un giudizio complessivo sulla "salute" dei dati.
    3. Commenta i problemi di integrità (es. importi a zero, scadenze passate, duplicati).
    4. Commenta la riconciliazione tra previsto ed effettivo, evidenziando gli scostamenti principali (es. "Gennaio 2026: entrate previste €..., effettive €...").
    5. Fornisci 2-3 raccomandazioni pratiche per migliorare la qualità del database.
    
    Usa un tono autorevole, preciso e orientato all'azione. Max 5-6 frasi.
  `,
});

const verifyDataIntegrityFlow = ai.defineFlow(
  {
    name: 'verifyDataIntegrityFlow',
    inputSchema: VerifyDataIntegrityInputSchema,
    outputSchema: VerifyDataIntegrityOutputSchema,
  },
  async (input) => {
    const { societa } = input;
    const issues: z.infer<typeof IssueSchema>[] = [];
    const today = startOfToday();

    try {
      const fetchAll = async (coll: string) => {
        const q = query(collection(db, coll), where('societa', '==', societa));
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      };

      const [movements, deadlines, incomeForecasts, expenseForecasts] = await Promise.all([
        fetchAll('movements'),
        fetchAll('deadlines'),
        fetchAll('incomeForecasts'),
        fetchAll('expenseForecasts'),
      ]);

      // 1. Controlli Importi
      movements.forEach(m => {
        if ((m.entrata || 0) + (m.uscita || 0) <= 0) {
          issues.push({
            type: 'invalid_amount',
            severity: 'error',
            description: `Movimento "${m.descrizione}" del ${m.data} ha importo nullo o negativo.`,
            documentId: m.id,
            collection: 'movements'
          });
        }
      });

      // 2. Scadenze passate non completate
      deadlines.forEach(d => {
        const dueDate = parseISO(d.dataScadenza);
        if (isBefore(dueDate, today) && d.stato !== 'Pagato' && d.stato !== 'Annullato') {
          issues.push({
            type: 'past_due_open',
            severity: 'warning',
            description: `Scadenza "${d.descrizione}" del ${d.dataScadenza} risulta ancora aperta.`,
            documentId: d.id,
            collection: 'deadlines'
          });
        }
      });

      // 3. Duplicati probabili (Movements)
      const keys = new Map<string, string>();
      movements.forEach(m => {
        const key = `${m.data}_${m.entrata}_${m.uscita}_${m.descrizione.toLowerCase().trim()}`;
        if (keys.has(key)) {
          issues.push({
            type: 'potential_duplicate',
            severity: 'warning',
            description: `Possibile duplicato: "${m.descrizione}" del ${m.data} (€${m.entrata || m.uscita}).`,
            documentId: m.id,
            collection: 'movements'
          });
        } else {
          keys.set(key, m.id);
        }
      });

      // 4. Riconciliazione (Mese Scorso)
      const lastMonthDate = subMonths(today, 1);
      const monthYearStr = format(lastMonthDate, 'MMMM yyyy', { locale: it });
      const monthFilter = format(lastMonthDate, 'yyyy-MM');

      const actualIn = movements.filter(m => m.data.startsWith(monthFilter)).reduce((s, m) => s + (m.entrata || 0), 0);
      const actualOut = movements.filter(m => m.data.startsWith(monthFilter)).reduce((s, m) => s + (m.uscita || 0), 0);
      const plannedIn = incomeForecasts.filter(f => f.dataPrevista.startsWith(monthFilter)).reduce((s, f) => s + (f.importoLordo || 0), 0);
      const plannedOut = expenseForecasts.filter(f => f.dataScadenza.startsWith(monthFilter)).reduce((s, f) => s + (f.importoLordo || 0), 0);

      const reconData = `
        Mese: ${monthYearStr}
        Entrate: Previste ${formatCurrency(plannedIn)} | Effettive ${formatCurrency(actualIn)}
        Uscite: Previste ${formatCurrency(plannedOut)} | Effettive ${formatCurrency(actualOut)}
      `;

      // 5. Narrativa AI
      const issuesText = issues.length > 0 
        ? issues.map(i => `- [${i.severity.toUpperCase()}] ${i.description}`).join('\n')
        : "Nessun problema di integrità strutturale rilevato.";

      const { output } = await integrityPrompt({ 
        issues: issuesText, 
        societa, 
        reconData 
      });

      return {
        issues,
        totalIssues: issues.length,
        narrative: output?.narrative || "Analisi completata con successo."
      };

    } catch (error: any) {
      console.error("Errore nel flow verifyDataIntegrityFlow:", error);
      throw new Error("L'analisi di integrità dei dati è fallita.");
    }
  }
);

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}
