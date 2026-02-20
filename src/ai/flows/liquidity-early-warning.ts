'use server';

/**
 * @fileOverview Un flow AI per analizzare le proiezioni di cassa e generare alert di liquidità dinamici.
 * Esegue il calcolo dello stato (verde/giallo/rosso) in TypeScript e usa Gemini per la narrativa.
 *
 * - liquidityEarlyWarning - La funzione principale che orchestra l'analisi.
 * - LiquidityEarlyWarningInput - Lo schema di input per il flow.
 * - LiquidityEarlyWarningOutput - Lo schema di output del flow.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getFirestore, collection, query, where, orderBy, limit, getDocs, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { firebaseConfig } from '@/firebase/config';
import type { LiquidityAlert, CashFlowProjection } from '@/lib/types/pianificazione';
import { differenceInDays, parseISO, startOfToday, addDays } from 'date-fns';

// Inizializzazione Firebase lato server
if (getApps().length === 0) {
  initializeApp(firebaseConfig);
}
const db = getFirestore();

const LiquidityEarlyWarningInputSchema = z.object({
  societa: z.string().describe("La società per cui generare l'alert ('LNC' o 'STG')."),
  userId: z.string().describe("L'ID dell'utente che richiede l'analisi."),
  safetyThreshold: z.number().optional().default(5000).describe("La soglia di sicurezza del saldo di cassa."),
});

const LiquidityEarlyWarningOutputSchema = z.object({
  alert: z.any().describe("L'oggetto LiquidityAlert generato."),
  previousStatus: z.string().optional().describe("Lo stato dell'alert precedente."),
  hasChanged: z.boolean().describe("Indica se lo stato è cambiato rispetto all'ultimo alert."),
});

export async function liquidityEarlyWarning(input: z.infer<typeof LiquidityEarlyWarningInputSchema>) {
  return liquidityEarlyWarningFlow(input);
}

// Prompt per Gemini dedicato alla generazione del messaggio di alert
const alertMessagePrompt = ai.definePrompt({
  name: 'liquidityAlertMessagePrompt',
  input: {
    schema: z.object({
      status: z.string(),
      projectedDate: z.string(),
      projectedBalance: z.number(),
      weekData: z.string(),
      societa: z.string(),
    })
  },
  output: { schema: z.object({ message: z.string() }) },
  prompt: `Sei un esperto consulente finanziario per una società italiana chiamata {{societa}}.
  Devi generare un messaggio di allerta liquidità basandoti sui seguenti dati tecnici:
  - Stato Semaforo: {{status}} (green=OK, yellow=Attenzione, red=CRITICO)
  - Data prevista criticità: {{projectedDate}}
  - Saldo previsto: {{projectedBalance}}€
  - Dati flussi della settimana critica: {{weekData}}

  REGOLE:
  1. Se lo stato è 'green', scrivi un messaggio rassicurante e breve (max 2 frasi).
  2. Se lo stato è 'yellow' o 'red', spiega chiaramente QUANDO accadrà e PERCHÉ (guarda i flussi della settimana).
  3. Per 'yellow' e 'red', fornisci 2-3 suggerimenti pratici (es. posticipare fornitori, sollecitare crediti).
  4. Usa un tono professionale, diretto e improntato all'azione.
  5. Scrivi in italiano naturale.`,
});

const liquidityEarlyWarningFlow = ai.defineFlow(
  {
    name: 'liquidityEarlyWarningFlow',
    inputSchema: LiquidityEarlyWarningInputSchema,
    outputSchema: LiquidityEarlyWarningOutputSchema,
  },
  async (input) => {
    const { societa, userId, safetyThreshold } = input;
    const today = startOfToday();

    try {
      // 1. Recupero la proiezione "realistic" più recente
      const projectionsRef = collection(db, 'cashFlowProjections');
      const projQuery = query(
        projectionsRef, 
        where('societa', '==', societa), 
        where('scenarioType', '==', 'realistic'),
        orderBy('generatedAt', 'desc'),
        limit(1)
      );
      const projSnapshot = await getDocs(projQuery);
      
      if (projSnapshot.empty) {
        throw new Error("Nessuna proiezione di cassa trovata. Genera prima una proiezione.");
      }
      
      const projection = projSnapshot.docs[0].data() as CashFlowProjection;
      const weeklyProjections = projection.weeklyProjections;

      // 2. Analisi della soglia nelle 13 settimane
      let status: 'green' | 'yellow' | 'red' = 'green';
      let breachWeek = null;
      
      for (const week of weeklyProjections) {
        if (week.cumulativeBalance < safetyThreshold) {
          const daysToBreach = differenceInDays(parseISO(week.weekEnd), today);
          
          if (daysToBreach <= 30) {
            status = 'red';
            breachWeek = week;
            break; // Il rosso ha la priorità massima
          } else if (daysToBreach <= 90 && status !== 'red') {
            status = 'yellow';
            if (!breachWeek) breachWeek = week;
          }
        }
      }

      // 3. Recupero l'ultimo alert per verificare cambiamenti
      const alertsRef = collection(db, 'liquidityAlerts');
      const lastAlertQuery = query(
        alertsRef,
        where('societa', '==', societa),
        orderBy('triggeredAt', 'desc'),
        limit(1)
      );
      const lastAlertSnapshot = await getDocs(lastAlertQuery);
      const previousAlert = lastAlertSnapshot.empty ? null : lastAlertSnapshot.docs[0].data() as LiquidityAlert;
      
      const hasChanged = previousAlert ? previousAlert.status !== status : true;

      // 4. Generazione messaggio con Gemini
      const { output } = await alertMessagePrompt({
        status,
        projectedDate: breachWeek ? breachWeek.weekEnd : today.toISOString(),
        projectedBalance: breachWeek ? breachWeek.cumulativeBalance : weeklyProjections[weeklyProjections.length-1].cumulativeBalance,
        weekData: breachWeek ? JSON.stringify(breachWeek) : "Nessuna criticità rilevata",
        societa,
      });

      const message = output?.message || (status === 'green' ? "La liquidità è sotto controllo." : "Rilevata criticità di cassa.");

      // 5. Salvataggio nuovo alert
      const newAlert: Omit<LiquidityAlert, 'id'> = {
        societa,
        userId,
        status,
        message,
        projectedDate: breachWeek ? breachWeek.weekEnd : today.toISOString(),
        projectedBalance: breachWeek ? breachWeek.cumulativeBalance : weeklyProjections[weeklyProjections.length-1].cumulativeBalance,
        triggeredAt: new Date().toISOString(),
        acknowledged: false,
      };

      const docRef = await addDoc(alertsRef, newAlert);
      const finalAlert = { id: docRef.id, ...newAlert };

      return {
        alert: finalAlert,
        previousStatus: previousAlert?.status,
        hasChanged,
      };

    } catch (error: any) {
      console.error("Errore nel flow 'liquidityEarlyWarningFlow':", error);
      throw new Error(error.message || "Errore durante l'analisi della liquidità.");
    }
  }
);