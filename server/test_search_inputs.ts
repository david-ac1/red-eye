import WebSocket from 'ws';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

const DUMMY_JPEG = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";
const DUMMY_PCM = Buffer.alloc(1024).toString('base64'); // 1024 bytes of silence

const testTool = [{
    function_declarations: [{
        name: "trigger_fact_check_warning",
        description: "warning",
        parameters: { type: "OBJECT", properties: { claim: { type: "STRING" } } }
    }]
}, { googleSearch: {} }];

async function testInput(name: string, payload: any) {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.on('open', () => {
            ws.send(JSON.stringify({
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-latest",
                    generation_config: { response_modalities: ["AUDIO"], speech_config: { voice_config: { prebuilt_voice_config: { voice_name: "Aoede" } } } },
                    tools: testTool
                }
            }));
        });

        ws.on('message', (data) => {
            const resp = JSON.parse(data.toString());
            if (resp.setupComplete) {
                ws.send(JSON.stringify(payload));
                // Send a turn complete signal if it's realtime_input to see if it processes
                ws.send(JSON.stringify({
                    client_content: {
                        turns: [{ role: "user", parts: [{ text: "Check the image" }] }],
                        turn_complete: true
                    }
                }));
            } else if (resp.serverContent) {
                console.log(`[${name}] ✅ Success! Got Server Content.`);
                ws.close();
                resolve(true);
            }
        });

        ws.on('close', (code) => {
            if (code !== 1000) {
                console.log(`[${name}] ❌ Failed! Code ${code}`);
                resolve(false);
            }
        });
    });
}

async function main() {
    console.log('Testing GoogleSearch with different inputs...');

    await testInput("Test 1: Text Only", {
        client_content: {
            turns: [{ role: "user", parts: [{ text: "Who won the superbowl in 2024?" }] }],
            turn_complete: true
        }
    });

    await testInput("Test 2: Image Chunk", {
        realtime_input: {
            media_chunks: [{ mime_type: "image/jpeg", data: DUMMY_JPEG }]
        }
    });

    await testInput("Test 3: Audio Chunk", {
        realtime_input: {
            media_chunks: [{ mime_type: "audio/pcm;rate=24000", data: DUMMY_PCM }]
        }
    });
}

main();
