// Подмодуль MSAL «redirect-bridge» (поле exports): TypeScript проекта (moduleResolution node) его не находит, сборщик — находит.
declare module '@azure/msal-browser/redirect-bridge' {
  export function broadcastResponseToMainFrame(): Promise<void>;
}
