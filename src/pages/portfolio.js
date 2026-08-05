import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";
import styles from "./index.module.css";
import { PAGE_TITLES, PAGE_DESCRIPTIONS } from "../constants";

function SectionKicker({ kicker, title }) {
  return (
    <div className={styles.sectionHeader}>
      <span className={styles.kicker}>{kicker}</span>
      <h2 className={styles.editorialTitle}>{title}</h2>
    </div>
  );
}

function ProjectCard({ project }) {
  return (
    <article className={styles.featureCard}>
      <div className={styles.featureImageWrap}>
        <img
          src={project.img}
          alt={project.title}
          className={styles.featureImg}
        />
      </div>
      <div className={styles.featureBody}>
        <span className={styles.featureCategory}>{project.category}</span>
        <h3 className={styles.featureTitle}>{project.title}</h3>
        <p className={styles.featureDesc}>{project.desc}</p>
        {project.tags && project.tags.length > 0 && (
          <div className={styles.featureTags}>
            {project.tags.map((tag, i) => (
              <span key={i} className={styles.featureTag}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className={styles.featureLinks}>
          {(() => {
            const links = [];
            if (project.github) {
              const repos = Array.isArray(project.github) ? project.github : [project.github];
              repos.forEach((repoLink, index, arr) => {
                const isMulti = arr.length > 1;
                const label = isMulti ? (index === 0 ? "GitHub (前端) ↗" : "GitHub (後端) ↗") : "GitHub Repo ↗";
                links.push(
                  <Link key={`github-${index}`} to={repoLink} className={styles.featureLink}>
                    {label}
                  </Link>
                );
              });
            }
            if (project.demo) {
              links.push(
                <Link key="demo" to={project.demo} className={styles.featureLink}>
                  Demo ↗
                </Link>
              );
            }
            if (project.link) {
              links.push(
                <Link key="link" to={project.link} className={styles.featureLink}>
                  開發紀錄 ↗
                </Link>
              );
            }

            return links.map((linkElement, index) => (
              <React.Fragment key={index}>
                {linkElement}
                {index < links.length - 1 && <span className={styles.featureSep}>・</span>}
              </React.Fragment>
            ));
          })()}
        </div>
      </div>
    </article>
  );
}

export default function PortfolioPage() {
  // 團隊合作作品
  const teamProjects = [
    {
      title: "伴你在日常",
      category: "電商主題",
      desc: "專為家庭照顧者與專業人員打造的輔具電商平台。我們透過清楚的分類與友善設計，化解輔具選購的資訊焦慮。以「陪伴」為核心，期盼讓家人安全舒適，也讓照顧者擁有更多餘裕。",
      link: "/blog/withyourlife-project",
      img: require("@site/static/img/lifewithyou.png").default,
      tags: ["Vite", "Bootstrap 5", "SCSS", "GSAP", "leaflet", "Git", "GitHub"],
      github: "https://github.com/Duncanin/with_your_life",
      demo: "https://duncanin.github.io/with_your_life/",
    },
    {
      title: "YeStep 每一步，找回生活的呼吸",
      category: "檢索主題",
      desc: "以「把 Yes 變成 Step」為核心精神的步道資訊平台。專為忙碌上班族與親子家庭設計，鼓勵大眾跨出探索自然的第一步。透過直覺的檢索體驗，陪伴你走入山林，找回身心療癒的寧靜。",
      link: "/blog/yestep-project",
      img: require("@site/static/img/yestep.png").default,
      tags: [
        "Vite",
        "React",
        "JavaScript",
        "Bootstrap 5",
        "SCSS",
        "Swiper",
        "Lottie",
        "Chart.js",
        "Axios",
        "Git",
        "GitHub",
      ],
      github: "https://github.com/MalricHsu/yestep",
      demo: "https://malrichsu.github.io/yestep/#/",
    },
  ];

  // 個人作品（之後新增：依上方格式填入物件即可）
  const personalProjects = [
    {
      title: "HexSchool 2026 - Nelson Blog",
      category: "部落格主題",
      desc: "使用 Nuxt 4 開發部落格專案，從 SSR 架構、資料取得到 SEO 設計，完整實作並紀錄開發過程中的踩雷與解法細節，都記錄在部落格中",
      link: "/blog/hexSchool-2026",
      img: require("@site/static/img/hexschool-2026.png").default,
      tags: [
        "Nuxt 4",
        "Vue 3",
        "@nuxt/content",
        "Pinia",
        "Bootstrap 5",
        "Sass",
        "Zod",
        "Axios",
        "Swiper",
      ],
      github: "https://github.com/MalricHsu/hex-blog",
      demo: "https://hex-blog-nu.vercel.app/",
    },
    {
      title: "URBNSTEP 運動鞋電商網站",
      category: "電商主題",
      desc: "將手刻切版作品重做成 Vue SPA 版本，補上會員登入、商品 API、收藏清單同步等功能，讓它從「看起來像電商」變成「真的有基本互動流程」的前端專案。",
      link: "/blog/hexSchool-URBNSTEP",
      img: require("@site/static/img/URBNSTEP.png").default,
      tags: [
        "Vue 3",
        "Composition API",
        "Vite",
        "Vue Router",
        "Pinia",
        "axios",
        "js-cookie",
        "SCSS",
        "Bootstrap Icons",
        "Swiper",
      ],
      github: "https://github.com/MalricHsu/urbnstep",
      demo: "https://urbnstep.vercel.app/",
    },
  ];

  // 後端小工具（之後新增：依上方格式填入物件即可）
  const backendTools = [{
    title: "Roomly 即時聊天室",
      category: "聊天室",
      desc: "Vue 3 + Firebase 打造的即時登入聊天室，支援 Email 註冊登入、忘記密碼、輸入代碼建立或加入多房間、訊息即時同步更新。",
      link: "/blog/vue-firebase-chatroom",
      img: require("@site/static/img/roomly.png").default,
      tags: [
        'Vue 3', 'Composition API', 'Vite', 'Vue Router', 'Firebase Authentication', 'Cloud Firestore'
      ],
      github: "https://github.com/MalricHsu/roomly",
      demo: "https://roomly-azure.vercel.app/",
    },
    {
    title: "Pixly 圖片壓縮工具",
      category: "工具",
      desc: "Vue 3 + Express 打造的圖片壓縮工具，支援圖片上傳、壓縮、下載，可調整壓縮品質。",
      link: "/blog/vue-nodejs-image-compressor",
      img: require("@site/static/img/pixly.png").default,
      tags: [
        "Vue 3", "Composition API", "Vite", "axios", "Node.js", "Express", "formidable", "sharp"
      ],
      github: ["https://github.com/hsuchinglun/image-compress-frontend", "https://github.com/hsuchinglun/image-compress-backend"],
      demo: "https://image-compress-frontend.vercel.app/",
    }
  ];

  // 互動式學習（之後新增：依上方格式填入物件即可）
  const interactiveProjects = [
         {
          title: "Git Daily",
          category: "互動學習",
          desc: "專為新手設計的 Git 互動學習網頁，透過簡單易懂的圖文搭配實際操作，帶領學習者一步步踏入 Git 的世界。",
          img: require("@site/static/img/gitdaily.png").default,
          tags: ["vue3","claude code"],
          github: "https://github.com/hsuchinglun/learn_git",
          demo: "https://git.7lunchapter.com/",
         }
  ];

  return (
    <Layout
      title={PAGE_TITLES.portfolio}
      description={PAGE_DESCRIPTIONS.portfolio}
    >
      <main className={styles.mainContainer}>
        <div className="container">
          <header className={styles.pageHeader}>
            <span className={styles.kicker}>作品 ・ PORTFOLIO</span>
            <h1 className={styles.pageTitle}>作品集</h1>
            <p className={styles.pageLead}>
              記錄我從團隊協作到獨立開發的實作歷程，累積解決問題與優化體驗的軌跡。
            </p>
          </header>

          <section className={styles.portfolioGroup}>
            <SectionKicker kicker="團隊協作 ・ TEAM" title="團隊合作作品" />
            <div className={styles.featureGrid}>
              {teamProjects.map((project, idx) => (
                <ProjectCard key={idx} project={project} />
              ))}
            </div>
          </section>

          <section className={styles.portfolioGroup}>
            <SectionKicker kicker="個人專案 ・ PERSONAL" title="個人作品" />
            {personalProjects.length === 0 ? (
              <p className={styles.contentsEmpty}>個人作品準備中，敬請期待。</p>
            ) : (
              <div className={styles.featureGrid}>
                {personalProjects.map((project, idx) => (
                  <ProjectCard key={idx} project={project} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.portfolioGroup}>
            <SectionKicker kicker="後端工具 ・ BACKEND" title="後端工具" />
            {backendTools.length === 0 ? (
              <p className={styles.contentsEmpty}>後端小工具準備中，敬請期待。</p>
            ) : (
              <div className={styles.featureGrid}>
                {backendTools.map((project, idx) => (
                  <ProjectCard key={idx} project={project} />
                ))}
              </div>
            )}
          </section>

          <section className={styles.portfolioGroup}>
            <SectionKicker kicker="互動學習 ・ INTERACTIVE" title="互動式學習網站" />
            {interactiveProjects.length === 0 ? (
              <p className={styles.contentsEmpty}>互動式學習作品準備中，敬請期待。</p>
            ) : (
              <div className={styles.featureGrid}>
                {interactiveProjects.map((project, idx) => (
                  <ProjectCard key={idx} project={project} />
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </Layout>
  );
}
