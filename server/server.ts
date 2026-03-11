import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { saveLog, saveTask } from './db.ts';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

// Mock ADK Signal Handler
const handleAgentLogic = async (frameData: string) => {
    // In a real implementation, this would send the frame to Gemini Live API
    // and receive tool calls via the ADK.
    if (frameData.length > 0) {
        console.log('[ADK] Processing frame analysis...');
        // Example response simulation
        return {
            type: 'ACTION',
            message: 'Analyzed billing form. Identifying CVV field.'
        };
    }
    return null;
};

wss.on('connection', (ws: WebSocket) => {
    console.log('Client connected to Red-Eye Agent');

    ws.on('message', async (message: string) => {
        try {
            const payload = JSON.parse(message.toString());

            if (payload.type === 'FRAME') {
                // Handle incoming frame
                const result = await handleAgentLogic(payload.data);

                // Persistence
                await saveLog('session_alpha_1', { type: 'FRAME_PROCESSED', timestamp: Date.now() });

                // Echo back to client for terminal update
                if (result) {
                    ws.send(JSON.stringify(result));
                    await saveTask('session_alpha_1', result);
                }
            } else if (payload.type === 'AUDIO') {
                // Process audio data (Bidi-streaming placeholder)
                // In Phase 3, this will be piped to the ADK session
                // await saveLog('session_alpha_1', { type: 'AUDIO_INPUT', volume: payload.data.length });
            } else if (payload.type === 'CONFIRMATION') {
                console.log('[SAFETY] User confirmed action:', payload.status);
                await saveLog('session_alpha_1', { type: 'USER_CONFIRMATION', status: payload.status });
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Red-Eye Backend running on http://localhost:${PORT}`);
});
