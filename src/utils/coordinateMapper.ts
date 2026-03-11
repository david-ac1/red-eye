/**
 * Translates Gemini's 0-999 normalized coordinates to actual viewport pixels.
 */
export interface Point {
    x: number;
    y: number;
}

export function normalizeToViewport(point: Point, viewportWidth: number, viewportHeight: number): Point {
    return {
        x: (point.x / 1000) * viewportWidth,
        y: (point.y / 1000) * viewportHeight,
    };
}

export function viewportToNormalize(point: Point, viewportWidth: number, viewportHeight: number): Point {
    return {
        x: Math.round((point.x / viewportWidth) * 1000),
        y: Math.round((point.y / viewportHeight) * 1000),
    };
}
