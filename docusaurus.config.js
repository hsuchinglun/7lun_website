// @ts-check
import { themes as prismThemes } from "prism-react-renderer";
import { SITE_TITLE } from "./src/constants";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: SITE_TITLE,
  tagline: "Every project starts a new chapter.",
  favicon: "img/logo-round.svg",
  stylesheets: [
    "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Noto+Sans+TC:wght@400;500;700&family=Noto+Serif+TC:wght@500;700&display=swap",
    "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css",
  ],
  clientModules: [require.resolve("./src/clientModules/scrollHandler.js")],

  future: {
    v4: true,
  },

  url: "https://www.7lunchapter.com",
  baseUrl: "/",

  organizationName: "MalricHsu",
  projectName: "7lun-workspace",
  deploymentBranch: "gh-pages",
  trailingSlash: false,

  onBrokenLinks: "ignore",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn",
    },
  },

  i18n: {
    defaultLocale: "zh-Hant",
    locales: ["zh-Hant"],
  },

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js",
        },
        blog: {
          blogTitle: "部落格 Blog",
          showReadingTime: true,
          onInlineTags: "warn",
          blogSidebarTitle: "全部文章",
          blogSidebarCount: "ALL",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
        gtag: {
          trackingID: "G-P7RJ6M9VTN",
          anonymizeIP: true,
        },
      }),
    ],
  ],

  plugins: [["./plugins/recent-docs", { docsDir: "docs", limit: 3 }]],

  themes: [
    [
      require.resolve("@easyops-cn/docusaurus-search-local"),
      /** @type {import('@easyops-cn/docusaurus-search-local').PluginOptions} */
      ({
        hashed: true,
        language: ["en", "zh"], // 中英斷詞
        indexDocs: true, // 索引 語法 Notes
        indexBlog: true, // 索引 部落格
        indexPages: false, // 首頁/關於/作品 等自訂頁不索引
        docsRouteBasePath: "/docs",
        blogRouteBasePath: "/blog",
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/og-image.png",
      colorMode: {
        disableSwitch: true,
        defaultMode: "light",
      },
      navbar: {
        title: SITE_TITLE,
        hideOnScroll: false,
        items: [
          { to: "/about", label: "關於 About", position: "right" },
          { to: "/portfolio", label: "作品 Portfolio", position: "right" },
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "right",
            label: "語法 Notes",
          },
          { to: "/blog", label: "部落格 Blog", position: "right" },
          {
            href: "https://github.com/hsuchinglun",
            position: "right",
            className: "header-github-link",
            label: "GitHub",
          },
        ],
      },
      footer: {
        style: "light",
        links: [
          {
            items: [
              { label: "關於 About", to: "/about" },
              { label: "作品 Portfolio", to: "/portfolio" },
              { label: "語法 Notes", to: "/docs/intro" },
              { label: "部落格 Blog", to: "/blog" },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} ${SITE_TITLE}.`,
      },
      prism: {
        theme: prismThemes.github,
      },
    }),
};

export default config;
