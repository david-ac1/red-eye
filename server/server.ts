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
You are the Lead Contextual Fact-Checker for the "Red-Eye" Multimodal Truth Validation system.
Objective: In an era of boundless AI content, the origin doesn't matter as much as the truth. Your mission is to perform a deep-layer audit of the attached media to identify factual inaccuracies, hallucinated scientific data, or false claims. 

How it works: 
1. Identify the core claims being made in the video, audio, or text. If you cannot see the screen, or the image is entirely blank or unreadable, YOU MUST explicitly state "I cannot see any content yet." DO NOT invent or hallucinate claims.
2. YOU MUST ALWAYS use the "verify_claim_with_search" tool to cross-reference claims against the live internet. Do not rely solely on your internal knowledge.
3. Evaluate the speaker's credentials if analyzing a "new discovery."

Focus Areas:
- Scientific Data & Claims: Flag any "data" that appears hallucinated, fabricated, or contradicts established scientific consensus.
- Historical & Factual Accuracy: Identify incorrect dates, events, or attributions.
- Logical Consistency: Find internal contradictions within the provided media.

MINDSET: You are a rigorous fact-checker. Do not assume any claim is true without verification. Assume the role of a meticulous verifier.

Output Format: Provide a concise spoken forensic breakdown of the claims.
If you detect a hallucinated fact or a highly suspicious claim with > 60% confidence, you MUST trigger the "trigger_fact_check_warning" tool with a detailed explanation of the inaccuracy.
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
                    generationConfig: {
                        responseModalities: ["AUDIO"],
                        speechConfig: {
                            voiceConfig: {
                                prebuiltVoiceConfig: {
                                    voiceName: "Aoede"
                                }
                            }
                        }
                    },
                    systemInstruction: { parts: [{ text: SENTINEL_SYSTEM_PROMPT }] },
                    tools: [{
                        functionDeclarations: [{
                            name: "trigger_fact_check_warning",
                            description: "Triggers a modal warning when a hallucinated fact, false claim, or inaccurate data is detected with high confidence.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    claim: { type: "STRING", description: "The specific claim or fact that is being flagged." },
                                    confidence: { type: "NUMBER", description: "Confidence score (0.0 to 1.0) that the claim is false." },
                                    details: { type: "STRING", description: "Bullet points explaining why the claim is factually incorrect or hallucinated." }
                                },
                                required: ["claim", "confidence", "details"]
                            }
                        }, {
                            name: "verify_claim_with_search",
                            description: "Uses Google Search to verify a specific claim, fact, or scientific data point against the live internet. Use this BEFORE triggering a warning.",
                            parameters: {
                                type: "OBJECT",
                                properties: {
                                    claim: { type: "STRING", description: "The specific claim to search for." }
                                },
                                required: ["claim"]
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
                if (response.serverContent?.modelTurn?.parts) {
                    for (const part of response.serverContent.modelTurn.parts) {
                        if (part.functionCall) {
                            const call = part.functionCall;

                            if (call.name === 'verify_claim_with_search') {
                                console.log('[SENTINEL] Delegating search for claim:', call.args.claim);

                                // Use the REST API as an Agentic Delegate to bypass the Bidi Visual/Search conflict
                                const REST_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
                                fetch(REST_URL, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        contents: [{ parts: [{ text: `Verify this claim using Google Search and return a brief, definitive verdict (TRUE, FALSE, or UNVERIFIABLE) along with the factual details: "${call.args.claim}"` }] }],
                                        tools: [{ googleSearch: {} }]
                                    })
                                })
                                    .then(res => res.json())
                                    .then(searchData => {
                                        const searchResult = searchData.candidates?.[0]?.content?.parts?.[0]?.text || "Unable to verify claim via search.";
                                        console.log('[SENTINEL] Search completed.');
                                        geminiWs?.send(JSON.stringify({
                                            tool_response: {
                                                function_responses: [{
                                                    name: "verify_claim_with_search",
                                                    response: { result: searchResult }
                                                }]
                                            }
                                        }));
                                    })
                                    .catch(err => console.error('[SENTINEL] Search Delegate Error:', err));
                            }

                            if (call.name === 'trigger_fact_check_warning') {
                                console.log('[SENTINEL] AI triggered fact check warning:', call.args);
                                ws.send(JSON.stringify({
                                    type: 'ACTION',
                                    message: `FACT_CHECK_FAILED: "${call.args.claim}" (${(call.args.confidence * 100).toFixed(0)}% Confidence). ${call.args.details}`
                                }));
                                geminiWs?.send(JSON.stringify({
                                    tool_response: {
                                        function_responses: [{
                                            name: "trigger_fact_check_warning",
                                            response: { status: "SUCCESS", message: "Fact check warning displayed." }
                                        }]
                                    }
                                }));
                            }
                        }
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
                const base64Data = payload.data?.split(',')[1];
                if (!base64Data || base64Data.length < 100) {
                    console.log(`[SERVER] Dropped corrupt/empty frame.`);
                    return;
                }
                console.log(`[SERVER] Relaying FRAME (${base64Data.length} bytes)`);
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
