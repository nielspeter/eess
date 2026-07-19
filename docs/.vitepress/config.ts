import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'eess',
  description:
    'Architecture guardrails for AI coding agents — deterministic gates that ground the agent loop; drift fails the build',
  base: '/eess/',

  themeConfig: {
    nav: [
      { text: 'Guide', link: '/getting-started' },
      { text: 'API', link: '/api-reference' },
      { text: 'Dialects', link: '/mermaid' },
      { text: 'GitHub', link: 'https://github.com/NielsPeter/eess' },
    ],

    sidebar: [
      {
        text: 'Introduction',
        items: [
          { text: 'What is eess?', link: '/what-is-eess' },
          { text: 'The Manifesto', link: '/manifesto' },
          { text: 'Calculator Walkthrough', link: '/eess-walkthrough-calculator' },
          { text: 'eess as a Harness', link: '/eess-as-a-harness' },
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'What to Check', link: '/what-to-check' },
        ],
      },
      {
        text: 'Guide',
        items: [
          { text: 'Core Concepts', link: '/core-concepts' },
          { text: 'Module Rules', link: '/modules' },
          { text: 'Class Rules', link: '/classes' },
          { text: 'Function Rules', link: '/functions' },
          { text: 'Type Rules', link: '/types' },
          { text: 'Body Analysis', link: '/body-analysis' },
          { text: 'Call Rules', link: '/calls' },
          { text: 'JSX Element Rules', link: '/jsx' },
          { text: 'Pattern Templates', link: '/patterns' },
          { text: 'Slices & Layers', link: '/slices' },
          { text: 'Cross-Layer Validation', link: '/cross-layer' },
          { text: 'Smell Detection', link: '/smell-detection' },
          { text: 'GraphQL Rules', link: '/graphql' },
          { text: 'Standard Rules', link: '/standard-rules' },
          { text: 'Architecture Presets', link: '/presets' },
          { text: 'Recipes', link: '/recipes' },
          { text: 'Metrics', link: '/metrics' },
          { text: 'Custom Rules', link: '/custom-rules' },
          { text: 'Violation Reporting', link: '/violation-reporting' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'CLI', link: '/cli' },
          { text: 'Explain Command', link: '/explain' },
          { text: 'API Reference', link: '/api-reference' },
        ],
      },
      {
        text: 'The eess family',
        items: [
          { text: 'Mermaid dialect (eess-mermaid)', link: '/mermaid' },
          { text: 'Markdown dialect (eess-md)', link: '/markdown' },
          { text: 'Cross-validation (eess-crossvalidate)', link: '/crossvalidate' },
          { text: 'eess validates eess', link: '/dogfooding' },
        ],
      },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'Released under the MIT License.',
    },
  },
})
