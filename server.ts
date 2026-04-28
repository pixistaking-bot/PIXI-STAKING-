import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { 
  getFirestore, 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  increment, 
  serverTimestamp, 
  writeBatch,
  Timestamp 
} from "firebase/firestore";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load Firebase Config
const firebaseConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "firebase-applet-config.json"), "utf8"));

// Constants from App.tsx
const ADMIN_EMAIL = "admin@pixi.com";
const ADMIN_PASSWORD = "ibaigini2025";

const STAKING_PLANS = [
  { id: 'starter', name: 'Starter Plan', dailyPayout: 0.1 },
  { id: 'basic', name: 'Basic Plan', dailyPayout: 0.1 },
  { id: 'flexible', name: 'Flexible Plan', dailyPayout: 0.1 },
];

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Background Payout Worker
  let isProcessing = false;
  const runPayoutWorker = async () => {
    if (isProcessing) return;
    isProcessing = true;
    console.log("[Payout Worker] Checking for due payouts...");

    try {
      // Step 1: Sign in as Admin to bypass typical user-only read restrictions (if any)
      // Though rules check isAdmin() which checks UID/Email.
      await signInWithEmailAndPassword(auth, ADMIN_EMAIL, ADMIN_PASSWORD);
      
      const now = new Date();
      const q = query(collection(db, "investments"), where("status", "==", "active"));
      const snapshot = await getDocs(q);

      console.log(`[Payout Worker] Found ${snapshot.size} active investments.`);

      for (const invDoc of snapshot.docs) {
        const inv = { id: invDoc.id, ...invDoc.data() } as any;
        if (!inv.startDate || !inv.amount || !inv.userId) continue;

        const lastPayout = inv.lastPayoutDate instanceof Timestamp 
          ? inv.lastPayoutDate.toDate() 
          : inv.startDate instanceof Timestamp 
            ? inv.startDate.toDate() 
            : new Date();

        const diffTime = now.getTime() - lastPayout.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays >= 1) {
          console.log(`[Payout Worker] Processing payout for ${inv.id} (User: ${inv.userId}). Days: ${diffDays}`);
          
          try {
            const plan = STAKING_PLANS.find(p => p.id === inv.planId) || STAKING_PLANS[1];
            const dailyRate = plan.dailyPayout || 0.1;
            const payoutAmount = inv.amount * dailyRate * diffDays;
            const uRef = doc(db, "users", inv.userId);
            const invRef = doc(db, "investments", inv.id);
            
            const batch = writeBatch(db);
            batch.update(uRef, { balance: increment(payoutAmount) });
            batch.update(invRef, { lastPayoutDate: serverTimestamp() });
            
            if (inv.endDate instanceof Timestamp) {
              const endDate = inv.endDate.toDate();
              if (now >= endDate) {
                batch.update(invRef, { status: "completed" });
              }
            }
            
            await batch.commit();
            console.log(`[Payout Worker] Successfully credited $${payoutAmount.toFixed(2)} to ${inv.userId}`);
          } catch (err) {
            console.error(`[Payout Worker] Failed to process payout for ${inv.id}:`, err);
          }
        }
      }
    } catch (err) {
      console.error("[Payout Worker] Critical error in worker loop:", err);
    } finally {
      isProcessing = false;
      console.log("[Payout Worker] Check complete.");
    }
  };

  // Run initial check and then every hour
  runPayoutWorker();
  setInterval(runPayoutWorker, 60 * 60 * 1000); // Every hour

  // API Route for triggering manually (optional, for debug)
  app.get("/api/trigger-payouts", async (req, res) => {
    await runPayoutWorker();
    res.json({ message: "Payout worker triggered" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
