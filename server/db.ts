import admin from 'firebase-admin';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
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

export const saveLog = async (sessionID: string, log: any) => {
    if (!db) return;
    try {
        await db.collection('sessions').doc(sessionID).collection('logs').add({
            ...log,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error('[Database] Failed to save log:', err);
    }
};

export const saveTask = async (sessionID: string, task: any) => {
    if (!db) return;
    try {
        await db.collection('sessions').doc(sessionID).collection('tasks').add({
            ...task,
            serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (err) {
        console.error('[Database] Failed to save task:', err);
    }
};
