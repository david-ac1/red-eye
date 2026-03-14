import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

dotenv.config();

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './service-account.json';

try {
    const serviceAccount = JSON.parse(readFileSync(join(process.cwd(), serviceAccountPath), 'utf8'));

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });

    console.log('[Database] Firestore initialized safely.');
} catch (error) {
    console.warn('[Database] Firestore initialization failed. Running in mock mode.', error.message);
}

export const db = admin.apps.length ? admin.firestore() : null;

let firestoreEnabled = true;

const LOG_DIR = join(process.cwd(), 'logs');
if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR);

const localLog = (type: string, data: any) => {
    const filePath = join(LOG_DIR, `${type}.jsonl`);
    const entry = JSON.stringify({ ...data, timestamp: new Date().toISOString() }) + '\n';
    appendFileSync(filePath, entry);
};

export const saveLog = async (sessionID: string, log: any) => {
    // Always log locally as fallback/backup
    localLog('terminal_logs', { sessionID, ...log });

    if (!db || !firestoreEnabled) return;
    try {
        await db.collection('sessions').doc(sessionID).collection('logs').add({
            ...log,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        if (err.code === 5) {
            console.error('[Database] Firestore Project/Database not found (5 NOT_FOUND). Please ensure Firestore is enabled in the Google Cloud Console for project: red-eye-29a57');
        } else {
            console.warn('[Database] Firestore API error:', err.message);
        }
        firestoreEnabled = false;
    }
};

export const saveTask = async (sessionID: string, task: any) => {
    localLog('tasks', { sessionID, ...task });

    if (!db || !firestoreEnabled) return;
    try {
        await db.collection('sessions').doc(sessionID).collection('tasks').add({
            ...task,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.warn('[Database] Firestore API error:', err.message);
        firestoreEnabled = false;
    }
};
