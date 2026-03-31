import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.babyhealthbook',
  appName: 'Baby Digital Health Book',
  webDir: 'dist',
  server: {
    url: 'https://34d9c4e4-9239-4e6d-a8d2-58e360a13f94.lovableproject.com?forceHideBadge=true',
    cleartext: true
  }
};

export default config;
