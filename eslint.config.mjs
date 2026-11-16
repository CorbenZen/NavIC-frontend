import js from '@eslint/js';
import globals from 'globals';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['node_modules/', 'vite/build/', 'dist/', '.vite/', '*.config.js', '*.config.mjs'] },
  {
    files: ['**/*.{js,mjs,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2022 },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    settings: { 
      react: { version: '19.3' },
      'import/resolver': {
        alias: {
          map: [
            ['@react', './react-jsx'],
            ['@services', './javascript-services'],
            ['@leaflet', './leaflet-react'],
            ['@styles', './css-styles'],
          ],
        },
      },
    },
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'no-unused-vars': 'warn',
      'react-hooks/rules-of-hooks': 'error',
    },
  },
];
