import type { Config } from '@docusaurus/types';
import {themes as prismThemes} from 'prism-react-renderer';

const config: Config = {
  title: 'Dokumentacja',
  url: 'http://localhost:3100',
  baseUrl: '/',
  i18n: { defaultLocale: 'pl', locales: ['pl'] },

  // Na początek tylko istniejące katalogi:
  staticDirectories: ['static'],

  markdown: { mermaid: true },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          path: '../docs',
          routeBasePath: '/',
          sidebarPath: './sidebars.ts',        // <— string zamiast require.resolve
          showLastUpdateAuthor: true,
          showLastUpdateTime: true,
        },
        blog: false,
        pages: false,
        theme: {
          customCss: './src/css/custom.css',   // <— string zamiast require.resolve
        },
      } as any,
    ],
  ],

  themeConfig: {
    navbar: { title: 'Dokumentacja', items: [] },
    prism: { theme: prismThemes.github, darkTheme: prismThemes.dracula },
  },
};

export default config;
