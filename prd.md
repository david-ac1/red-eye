Product Requirements Document: Red-Eye Navigator
1. Executive Summary
Red-Eye is a real-time, vision-augmented "Contextual Fact-Checker" and Integrity Analyst built on the Google ADK and Gemini Live API. It acts as a "Visual Copilot" for verifying claims in real-time. The Hackathon Hook: "In an era of AI content, the origin doesn't matter—the truth does." It leverages Gemini's 2-million-token context window to cross-reference claims against Google Search in real-time.

2. Primary Use Cases
The Truth Validator: A user uploads or streams a video of a "new medical discovery." The agent identifies the speaker, checks their credentials via Search, and flags if the "scientific data" in the video has been hallucinated.

The Fact-Checking Auditor: Navigating unindexed medical or historical databases, verifying audio/video claims against a visual "truth" on the screen and generating high-confidence alerts when claims fail logical or factual consistency checks.

3. Functional Requirements (FR)
FR1: Visual Perception Loop
Continuous Input: The system must capture the user’s browser window at 1 FPS (Gemini Live standard) and stream it as JPEG frames to the model.

Claim Identification: The agent must identify factual statements, data points, or core claims within the video, audio, or text streams.

FR2: Real-Time Audio & "Barge-In"
Low-Latency Voice: Utilize 16-bit PCM, 16kHz audio streaming for sub-600ms response times.

Interruptible Execution: If a user says "Stop" while Red-Eye is moving the cursor, the agent must immediately halt and clear its action buffer.

FR3: Coordinate-Based Tooling (The "Hands")
Normalized Mapping: The agent must output coordinates in a 0-999 normalized grid, which the backend maps to actual pixel values (optimized for 1440x900 viewports).

Action Set: Support for click(x, y), type(text), scroll(direction), and hover(x, y).

4. Technical Requirements (TR)
TR1: The "Brain" (Model & SDK)
Model: gemini-live-2.5-flash-native-audio (The GA recommended version for low-latency).
 
Framework: Mandatory use of Google Agent Development Kit (ADK) for session management and tool orchestration.

TR2: Cloud Infrastructure
Compute: Backend hosted on Google Cloud Run with Session Affinity enabled (required for stable WebSockets).

Database: Firestore for "Long-Term Memory" (storing the user's passport details or health-tech API keys).

TR3: Security & Safety
Confirmed Actions: High-impact actions (like "Submit Application") must trigger a require_confirmation safety state in the UI.