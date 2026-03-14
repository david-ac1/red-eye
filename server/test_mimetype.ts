import WebSocket from 'ws';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

const SENTINEL_SYSTEM_PROMPT = "You are a fact checker.";

const currentSetup = {
    setup: {
        model: "models/gemini-2.5-flash-native-audio-latest",
        systemInstruction: { parts: [{ text: SENTINEL_SYSTEM_PROMPT }] },
        generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
                voiceConfig: {
                    prebuiltVoiceConfig: {
                        voiceName: "Aoede"
                    }
                }
            }
        }
    }
};

const frameTests = [
    {
        name: "Test 1: camelCase mimeType",
        payload: {
            realtimeInput: { mediaChunks: [{ mimeType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=" }] }
        }
    },
    {
        name: "Test 2: snake_case mime_type",
        payload: {
            realtimeInput: { mediaChunks: [{ mime_type: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=" }] }
        }
    }
];

async function testFrameInput(config: any) {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.on('open', () => {
            console.log(`[${config.name}] Sending setup...`);
            ws.send(JSON.stringify(currentSetup));
        });

        ws.on('message', (data) => {
            const resp = JSON.parse(data.toString());
            if (resp.setupComplete) {
                console.log(`[${config.name}] ✅ Setup OK. Sending Dummy Frame...`);
                ws.send(JSON.stringify(config.payload));
            } else if (resp.serverContent) {
                console.log(`[${config.name}] Response:`, resp);
            }
        });

        // Wait 2 seconds to see if it closes, if not, it lived!
        const timeout = setTimeout(() => {
            console.log(`[${config.name}] ✅ Survived 2 seconds!`);
            ws.close(1000);
            resolve(true);
        }, 2000);

        ws.on('close', (code, reason) => {
            clearTimeout(timeout);
            if (code !== 1000) {
                console.log(`[${config.name}] ❌ Failed: Code ${code} - ${reason}`);
                resolve(false);
            }
        });
    });
}

async function main() {
    for (const test of frameTests) {
        await testFrameInput(test);
    }
}

main();
