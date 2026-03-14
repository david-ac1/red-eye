import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { saveLog, saveTask } from './db.ts';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = 3001;

/**
 * SENTINEL SYSTEM INSTRUCTION
 */
const SENTINEL_SYSTEM_PROMPT = `
Role: Lead Forensic Media Analyst specializing in Large Language Models (LLMs) and Diffusion/Transformer-based generative architectures.

Objective: Perform a deep-layer audit of the attached media to identify synthetic signatures. Move beyond surface-level errors and analyze the "Statistical Signature" of the content.

1. Textual Forensic Dimensions:
Syntactic Uniformity: Look for "The Great Average"—sentences of near-equal length and a rhythmic, "Subject-Verb-Object" cadence that lacks human burstiness.
Lexical Clusters: Identify "AI-favored" transitions (e.g., Moreover, In conclusion, Ultimately, Not only... but also).
The "False Nuance" Trope: Flag the "It’s not just X, it’s Y" or "While X is true, Y remains the priority" sentiment—a common alignment-tuning artifact used to sound balanced.
Hedging & Politeness: Detect excessive neutrality or a refusal to take a definitive, idiosyncratic stance.

2. Visual (Image/Video) Forensic Dimensions:
High-Frequency Noise Distribution: Check for "over-smoothing" in skin textures versus "fractal chaos" in complex patterns like hair, knitwear, or tree leaves.
Coherence over Time (Video Only): Flag "Neural Morphing"—where an earring disappears for three frames or a background limb transforms into a piece of furniture during a camera pan.
Global vs. Local Logic: Does the image look perfect locally (e.g., a hand) but fail globally (e.g., the hand has six fingers or attaches to the elbow at an impossible angle)?

3. Auditory Forensic Dimensions:
Spectral Flatness: Identify the lack of "micro-prosody"—the tiny, irregular shifts in pitch and volume humans use to emphasize emotion.
Breath Management: Look for "Impossible Phrasing"—long sentences spoken without a physiological need for a breath, or breaths that occur mid-phoneme.
Phonetic Smearing: Listen for "slurred" consonants in high-speed speech where the model struggles with the transition between complex dental or plosive sounds.

Output Format (Strict JSON): so that it can better detect
If high threat is detected, you MUST trigger the "trigger_authenticity_warning" tool.
`;

wss.on('connection', (ws: WebSocket) => {
    const time = new Date().toISOString();
    console.log(`[NET] Client connected at ${time}`);

    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        console.error('[CORE] Missing GEMINI_API_KEY in .env');
        ws.send(JSON.stringify({ type: 'LOG', message: 'ERROR: Backend missing GEMINI_API_KEY.' }));
        ws.close();
        return;
    }

    // Initialize Gemini Live WebSocket (v1beta required for 2.5 models)
    const geminiWsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${API_KEY}`;
    let geminiWs: WebSocket | null = null;

    try {
        geminiWs = new WebSocket(geminiWsUrl);

        geminiWs.on('open', () => {
            console.log('[GEMINI] Live Session established.');
            const setup = {
                setup: {
                    model: "models/gemini-2.5-flash-native-audio-latest",
                    generation_config: {
                        response_modalities: ["AUDIO"],
                        speech_config: {
                            voice_config: {
                                prebuilt_voice_config: {
                                    voice_name: "Aoede"
                                }
                            }
                        }
                    },
                    system_instruction: { parts: [{ text: SENTINEL_SYSTEM_PROMPT }] },
                    tools: [{
                        function_declarations: [{
                            name: "trigger_authenticity_warning",
                            description: "Triggers a modal warning when synthetic content is detected with high confidence.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    threat_type: { type: "STRING", description: "The type of threat (e.g. DEEPFAKE_VIDEO, LLM_TEXT, AUDIO_CLONE)" },
                                    confidence: { type: "NUMBER", description: "Confidence score (0.0 to 1.0)" },
                                    details: { type: "STRING", description: "Bullet points explaining why it was flagged." }
                                },
                                required: ["threat_type", "confidence", "details"]
                            }
                        }]
                    }]
                }
            };
            geminiWs?.send(JSON.stringify(setup));
        });

        geminiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data.toString());

                if (response.setupComplete) console.log('[GEMINI] Setup complete.');

                // Handle text responses and audio chunks
                if (response.serverContent?.modelTurn?.parts) {
                    for (const part of response.serverContent.modelTurn.parts) {
                        if (part.text) {
                            ws.send(JSON.stringify({ type: 'LOG', message: `SENTINEL: ${part.text}` }));
                        }
                        if (part.inlineData) {
                            ws.send(JSON.stringify({
                                type: 'AUDIO_OUT',
                                data: part.inlineData.data
                            }));
                        }
                    }
                }

                if (response.serverContent?.audioOutput) {
                    ws.send(JSON.stringify({
                        type: 'AUDIO_OUT',
                        data: response.serverContent.audioOutput.data
                    }));
                }

                // Handle tool calls
                if (response.serverContent?.modelTurn?.parts?.[0]?.functionCall) {
                    const call = response.serverContent.modelTurn.parts[0].functionCall;
                    if (call.name === 'trigger_authenticity_warning') {
                        console.log('[SENTINEL] AI triggered warning:', call.args);
                        ws.send(JSON.stringify({
                            type: 'ACTION',
                            message: `THREAT_IDENTIFIED: ${call.args.threat_type} (${(call.args.confidence * 100).toFixed(0)}% Confidence). ${call.args.details}`
                        }));
                        geminiWs?.send(JSON.stringify({
                            tool_response: {
                                function_responses: [{
                                    name: "trigger_authenticity_warning",
                                    response: { status: "SUCCESS", message: "Modal displayed." }
                                }]
                            }
                        }));
                    }
                }
            } catch (err) {
                console.error('[GEMINI] Error parsing response:', err);
            }
        });

        geminiWs.on('error', (err: any) => {
            console.error('[GEMINI] WebSocket Error:', err.message);
            ws.send(JSON.stringify({ type: 'LOG', message: `SENTINEL_ERROR: Gemini failure - ${err.message}` }));
        });

        geminiWs.on('close', (code, reason) => {
            console.log(`[GEMINI] Session closed. Code: ${code}, Reason: ${reason}`);
            ws.send(JSON.stringify({ type: 'LOG', message: `SENTINEL_NOTICE: Session terminated (${code}).` }));
        });

    } catch (err) {
        console.error('[GEMINI] Link failed:', err);
        ws.send(JSON.stringify({ type: 'LOG', message: 'CRITICAL: Failed to initialize Gemini Live link.' }));
    }

    ws.on('message', async (message: string) => {
        if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

        try {
            const payload = JSON.parse(message.toString());

            if (payload.type === 'AUDIO') {
                geminiWs.send(JSON.stringify({
                    realtime_input: {
                        media_chunks: [{
                            mime_type: "audio/pcm;rate=24000",
                            data: payload.data
                        }]
                    }
                }));
            } else if (payload.type === 'TEXT') {
                geminiWs.send(JSON.stringify({
                    client_content: {
                        turns: [{
                            role: "user",
                            parts: [{ text: payload.data }]
                        }],
                        turn_complete: true
                    }
                }));
            } else if (payload.type === 'FRAME') {
                const base64Data = payload.data.split(',')[1];
                geminiWs.send(JSON.stringify({
                    realtime_input: {
                        media_chunks: [{
                            mime_type: "image/jpeg",
                            data: base64Data
                        }]
                    }
                }));
            } else if (payload.type === 'CONFIRMATION') {
                if (payload.status === 'APPROVED') {
                    geminiWs.send(JSON.stringify({
                        client_content: {
                            turns: [{
                                role: "user",
                                parts: [{ text: "The user has confirmed. Proceed with forensic highlight." }]
                            }],
                            turn_complete: true
                        }
                    }));
                }
            }
        } catch (err) {
            console.error('Error processing message:', err);
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        if (geminiWs) geminiWs.close();
    });
});

server.listen(PORT, () => {
    console.log(`Red-Eye Backend running on Port ${PORT}`);
});
