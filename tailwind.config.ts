import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        ink: '#12161D',
        panel: '#1B212B',
        panel2: '#242B36',
        brass: 'var(--accent, #C9974B)',
        signal: '#6FA88F',
        paper: '#E7E3D6',
        muted: '#8B93A1',
        line: '#2E3644',
        danger: '#C4694B',
      },
      fontFamily: {
        display: ['var(--font-fraunces)', 'serif'],
        body: ['var(--font-plex-sans)', 'sans-serif'],
        mono: ['var(--font-plex-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
