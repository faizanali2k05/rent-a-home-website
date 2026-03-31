let envConfigPromise;
let mapsApiPromise;
const FALLBACK_GOOGLE_MAPS_API_KEY = 'AIzaSyD1uN1zVm4l15WuL94ugjLsXcWXnPQa7tw';

function parseEnv(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
}

export async function loadEnvConfig() {
  if (window.__rentHomeEnvConfig) return window.__rentHomeEnvConfig;
  if (!envConfigPromise) {
    envConfigPromise = fetch('./.env', { cache: 'no-store' })
      .then((response) => (response.ok ? response.text() : ''))
      .then((text) => {
        const config = { GOOGLE_MAPS_API_KEY: FALLBACK_GOOGLE_MAPS_API_KEY, ...parseEnv(text) };
        window.__rentHomeEnvConfig = config;
        return config;
      })
      .catch(() => {
        const config = { GOOGLE_MAPS_API_KEY: FALLBACK_GOOGLE_MAPS_API_KEY };
        window.__rentHomeEnvConfig = config;
        return config;
      });
  }
  return envConfigPromise;
}

export async function loadGoogleMapsApi() {
  if (window.google?.maps) return window.google.maps;
  if (mapsApiPromise) return mapsApiPromise;

  mapsApiPromise = loadEnvConfig().then((config) => new Promise((resolve, reject) => {
    const apiKey = config.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      reject(new Error('Google Maps API key is missing from .env'));
      return;
    }

    const existingScript = document.querySelector('script[data-google-maps-loader="true"]');
    if (existingScript) {
      const checkLoaded = () => {
        if (window.google?.maps) resolve(window.google.maps);
        else setTimeout(checkLoaded, 100);
      };
      checkLoaded();
      return;
    }

    const callbackName = '__rentHomeInitMap';
    window[callbackName] = () => {
      resolve(window.google.maps);
      delete window[callbackName];
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&callback=${callbackName}`;
    script.async = true;
    script.defer = true;
    script.dataset.googleMapsLoader = 'true';
    script.onerror = () => reject(new Error('Failed to load Google Maps API'));
    document.head.appendChild(script);
  }));

  return mapsApiPromise;
}
