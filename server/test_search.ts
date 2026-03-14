import WebSocket from 'ws';
import 'dotenv/config';

const API_KEY = process.env.GEMINI_API_KEY;
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

// Dummy 1x1 jpeg base64
const DUMMY_JPEG = "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=";

const testTool = [{
    function_declarations: [{
        name: "trigger_fact_check_warning",
        description: "Triggers a modal warning when a fact checking fails.",
        parameters: { type: "OBJECT", properties: { claim: { type: "STRING" } } }
    }]
}, { googleSearch: {} }];

async function testRuntimeInput() {
    return new Promise((resolve) => {
        const ws = new WebSocket(url);
        ws.on('open', () => {
            console.log(`Connected. Sending setup...`);
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
                console.log(`Setup COMPLETE! Sending FRAME...`);
                ws.send(JSON.stringify({
                    realtime_input: {
                        media_chunks: [{ mime_type: "image/jpeg", data: DUMMY_JPEG }]
                    }
                }));
            } else if (resp.serverContent) {
                console.log(`Got Server Content!`);
                ws.close();
                resolve(true);
            } else {
                console.log(`message:`, resp);
            }
        });
        ws.on('close', (code, reason) => {
            console.log(`Closed with code ${code}: ${reason}`);
            resolve(false);
        });
        ws.on('error', (err) => console.log(`Error:`, err.message));
    });
}

testRuntimeInput();
