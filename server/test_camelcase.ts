import WebSocket from 'ws';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

const SENTINEL_SYSTEM_PROMPT = "You are a fact checker.";

const setups = [
    {
        name: "Test 1: Base Setup (No Generation Config)",
        payload: {
            setup: {
                model: "models/gemini-2.5-flash-native-audio-latest",
                systemInstruction: { parts: [{ text: SENTINEL_SYSTEM_PROMPT }] }
            }
        }
    },
    {
        name: "Test 2: Setup with Basic generationConfig",
        payload: {
            setup: {
                model: "models/gemini-2.5-flash-native-audio-latest",
                systemInstruction: { parts: [{ text: SENTINEL_SYSTEM_PROMPT }] },
                generationConfig: {
                    responseModalities: ["AUDIO"]
                }
            }
        }
    },
    {
        name: "Test 3: Setup with speechConfig inside generationConfig (Current)",
        payload: {
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
        }
    }
];

async function testSetup(config: any) {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.on('open', () => {
            console.log(`[${config.name}] Sending setup...`);
            ws.send(JSON.stringify(config.payload));
        });

        ws.on('message', (data) => {
            const resp = JSON.parse(data.toString());
            if (resp.setupComplete) {
                console.log(`[${config.name}] ✅ Setup OK. Sending Dummy Frame...`);
                // If setup passes, test if it crashes on FRAME input
                ws.send(JSON.stringify({
                    realtimeInput: { mediaChunks: [{ mimeType: "image/jpeg", data: "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=" }] }
                }));
            } else if (resp.serverContent) {
                console.log(`[${config.name}] ✅ Survived Frame Input!`);
                ws.close(1000);
                resolve(true);
            } else {
                console.log(`[${config.name}] Response:`, resp);
            }
        });

        ws.on('close', (code, reason) => {
            if (code !== 1000) {
                console.log(`[${config.name}] ❌ Failed: Code ${code} - ${reason}`);
                resolve(false);
            }
        });
        ws.on('error', (err) => {
            console.log(`[${config.name}] ERROR:`, err.message);
            resolve(false);
        });
    });
}

async function main() {
    for (const config of setups) {
        await testSetup(config);
    }
}

main();
