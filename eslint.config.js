import js from '@eslint/js'
import globals from 'globals'
import pluginReact from 'eslint-plugin-react' // Import the react plugin as pluginReact
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      // Remove react.configs.recommended from extends
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: { // Define plugins as an object
      react: pluginReact,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: { // Add settings for react plugin
      react: {
        version: 'detect',
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules, // Spread recommended react rules
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Override specific rules if needed
      'react/react-in-jsx-scope': 'off', // Not needed for React 17+ with new JSX transform
      'react/jsx-uses-react': 'off',     // Not needed for React 17+ with new JSX transform
    },
  },
])
