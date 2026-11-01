// Things the pages provide outside of our own code.

interface Window {
    webkitAudioContext?: typeof AudioContext; // older Safari
    turnstile?: { reset(): void }; // Cloudflare Turnstile, when its script is on the page
    launchConfetti?: () => void; // exposed for trying it from the console
}

// @simplewebauthn/browser, loaded from a <script> tag on the login and enroll pages.
declare const SimpleWebAuthnBrowser: {
    startAuthentication(options: { optionsJSON: unknown }): Promise<unknown>;
    startRegistration(options: { optionsJSON: unknown }): Promise<unknown>;
};
