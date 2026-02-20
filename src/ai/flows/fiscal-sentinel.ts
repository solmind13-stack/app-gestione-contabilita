'use server';

/**
 * @fileOverview Un flow AI per monitorare le novità fiscali e normative italiane rilevanti per l'azienda.
 * Utilizza Gemini per filtrare le notizie legislative in base al profilo aziendale.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, getDocs, addDoc, limit } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { Movimento, CompanyProfile } from '@/lib/types';
import { format } from 'date-fns';

if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const FiscalUpdateSchema = z.object({
  title: z.string().describe("Titolo sintetico della novità."),
  type: z.enum(['bonus', 'obbligo', 'scadenza', 'agevolazione', 'modifica_aliquota']),
  description: z.string().describe("Spiegazione chiara in 2-3 frasi."),
  impact: z.string().describe("Come impatta questa azienda specificamente."),
  actionRequired: z.string().describe("Cosa deve fare l'imprenditore."),
  urgency: z.enum(['alta', 'media', 'bassa']),
  deadline: z.string().optional().describe("Data entro cui agire (formato YYYY-MM-DD)."),
});

const FiscalSentinelInputSchema = z.object({
  societa: z.string().describe("La società per cui recuperare gli aggiornamenti."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
});

const FiscalSentinelOutputSchema = z.object({
  updates: z.array(FiscalUpdateSchema),
  narrative: z.string().describe("Un riassunto professionale dell'attuale scenario normativo."),
  disclaimer: z.string(),
});

export async function fiscalSentinel(input: z.infer<typeof FiscalSentinelInputSchema>) {
  return fiscalSentinelFlow(input);
}

const prompt = ai.definePrompt({
  name: 'fiscalSentinelPrompt',
  input: { 
    schema: z.object({ 
      companyProfile: z.string(),
      expenseContext: z.string(),
      currentDate: z.string()
    }) 
  },
  output: { schema: FiscalSentinelOutputSchema },
  prompt: `
    Sei un Commercialista Italiano esperto, sempre aggiornato sulle ultime circolari dell'Agenzia delle Entrate, decreti legge e novità INPS/INAIL.
    
    CONTESTO AZIENDALE:
    {{{companyProfile}}}
    
    PROFILO DI SPESA (Ultimi 12 mesi):
    {{{expenseContext}}}
    
    DATA ODIERNA: {{currentDate}}

    IL TUO COMPITO:
    Identifica le 3-5 novità fiscali e normative italiane più recenti e rilevanti per questa specifica azienda. 
    Concentrati su: Bonus investimenti (es. Transizione 5.0), crediti d'imposta, modifiche aliquote contributive, nuovi obblighi di fatturazione elettronica o conservazione, incentivi settoriali (Immobiliare/Energia se applicabile), novità per datori di lavoro.

    REGOLE PER IL REPORT:
    1. 'impact': Spiega chiaramente perché questa azienda dovrebbe interessarsi (es. "Avendo alte spese in energia, il nuovo credito d'imposta potrebbe ridurre le uscite del Q3").
    2. 'actionRequired': Sii pratico (es. "Raccogliere le fatture dei beni strumentali", "Contattare il consulente del lavoro").
    3. 'narrative': Un commento di apertura di 3-4 frasi che dia un senso di orientamento all'imprenditore.
    4. Sii molto preciso sui termini tecnici (F24, Aliquota, Ravvedimento, etc.).

    IMPORTANTE: Queste informazioni sono basate sulla tua conoscenza e potrebbero non includere novità dell'ultimissima ora. Inserisci sempre il disclaimer.

    Rispondi esclusivamente in formato JSON.
  `,
});

const fiscalSentinelFlow = ai.defineFlow(
  {
    name: 'fiscalSentinelFlow',
    inputSchema: FiscalSentinelInputSchema,
    outputSchema: FiscalSentinelOutputSchema,
  },
  async (input) => {
    const { societa, userId } = input;
    const currentDate = format(new Date(), 'dd/MM/yyyy');

    try {
      // 1. Recupero dati per contestualizzare
      const companyRef = query(collection(db, 'companies'), where('sigla', '==', societa), limit(1));
      const companySnap = await getDocs(companyRef);
      const profile = companySnap.docs[0]?.data() as CompanyProfile;

      const movementsRef = collection(db, 'movements');
      const mvQuery = query(movementsRef, where('societa', '==', societa), limit(100));
      const mvSnap = await getDocs(mvQuery);
      const movements = mvSnap.docs.map(d => d.data() as Movimento);

      // Sintesi per il prompt
      const expenseContext = movements.length > 0 
        ? Array.from(new Set(movements.map(m => m.categoria))).join(', ')
        : "Dati di spesa non ancora disponibili";

      const companyProfileStr = profile 
        ? `Ragione Sociale: ${profile.name}, Tipo: ${profile.type}, Sigla: ${profile.sigla}`
        : `Società: ${societa} (Profilo dettagliato non trovato)`;

      // 2. Chiamata a Gemini
      const { output } = await prompt({
        companyProfile: companyProfileStr,
        expenseContext,
        currentDate
      });

      if (!output) {
        throw new Error("L'AI non è riuscita a generare gli aggiornamenti fiscali.");
      }

      const finalResult = {
        ...output,
        disclaimer: "Le informazioni fornite sono a scopo illustrativo basate sulla conoscenza dell'IA. Non costituiscono consulenza professionale. Si raccomanda vivamente di verificare ogni novità con il proprio commercialista prima di intraprendere qualsiasi azione."
      };

      // 3. Salvataggio su Firestore
      await addDoc(collection(db, 'externalInsights'), {
        ...finalResult,
        type: 'fiscal_updates',
        societa,
        userId,
        createdAt: new Date().toISOString()
      });

      return finalResult;

    } catch (error: any) {
      console.error("Fiscal Sentinel flow failed:", error);
      throw new Error(error.message || "Errore durante il recupero delle novità fiscali.");
    }
  }
);
