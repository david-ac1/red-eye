import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { saveLog, saveTask } from './db.ts';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

wss.on('connection', (ws: WebSocket) => {
    const time = new Date().toISOString();
    console.log(`[NET] Client connected at ${time}`);
    let actionSent = false;

    ws.on('message', async (message: string) => {
        try {
            const payload = JSON.parse(message.toString());

            if (payload.type === 'FRAME') {
                console.log(`[STREAM] Received frame at ${new Date().toISOString()}`);

                // Mock logic within connection scope
                let result = null;
                if (payload.data.length > 0 && !actionSent) {
                    console.log('[ADK] Processing frame analysis...');
                    actionSent = true;
                    result = {
                        type: 'ACTION',
                        message: 'Analyzed billing form. Identifying CVV field.'
                    };
                }

                // Persistence
                await saveLog('session_alpha_1', { type: 'FRAME_PROCESSED', timestamp: Date.now() });

                // Echo back to client
                if (result) {
                    ws.send(JSON.stringify(result));
                    await saveTask('session_alpha_1', result);
                }

                // Randomly simulate URL updates for demo feel
                if (Math.random() > 0.9) {
                    ws.send(JSON.stringify({
                        type: 'URL_UPDATE',
                        url: `https://navigator.internal.sys/analysis/${Math.floor(Math.random() * 1000)}`
                    }));
                }
            } else if (payload.type === 'AUDIO') {
                // Process audio data (Bidi-streaming placeholder)
                // In Phase 3, this will be piped to the ADK session
                // await saveLog('session_alpha_1', { type: 'AUDIO_INPUT', volume: payload.data.length });
            } else if (payload.type === 'CONFIRMATION') {
                console.log('[SAFETY] User confirmed action:', payload.status);
                await saveLog('session_alpha_1', { type: 'USER_CONFIRMATION', status: payload.status });
                // Reset for demo purposes so it can trigger again on next focus
                actionSent = false;
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

server.listen(PORT, () => {
    console.log(`Red-Eye Backend running on Port ${PORT}`);
});
