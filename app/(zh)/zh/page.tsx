import Image from "next/image";
import Link from "next/link";
import { PublicationRow } from "@/components/publication-row";
import { ResearchVisual } from "@/components/research-visual";
import { profile, type ResearchItem } from "@/data/site";
import { educationZh, experienceZh, honorsZh, languagesZh, profileZh, publicationsZh, selectedResearchZh } from "@/data/site-zh";

function ProjectLinks({ item }: { item: ResearchItem }) {
  if (!item.paper && !item.code && !item.dataset) return null;

  return (
    <div className="resource-links" aria-label={`${item.title} 相关链接`}>
      {item.paper ? <a href={item.paper}>论文</a> : null}
      {item.code ? <a href={item.code}>代码</a> : null}
      {item.dataset ? <a href={item.dataset}>数据集</a> : null}
    </div>
  );
}

function ResearchEntry({ item }: { item: ResearchItem }) {
  return (
    <article className="research-entry">
      <div className="research-entry-visual"><ResearchVisual kind={item.visual} locale="zh" /></div>
      <div className="research-entry-copy">
        <p className="entry-status">{item.status}</p>
        <h3 lang="en">{item.title}</h3>
        <p className="signature-subtitle">{item.subtitle}</p>
        <dl className="research-signature">
          <div><dt>核心主题</dt><dd>{item.topic}</dd></div>
          <div><dt>方法</dt><dd>{item.method}</dd></div>
          <div><dt>核心算法</dt><dd>{item.algorithm}</dd></div>
          <div><dt>结果</dt><dd>{item.result}</dd></div>
        </dl>
        <ProjectLinks item={item} />
      </div>
    </article>
  );
}

export default function ChineseHome() {
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": "https://jw-chae.github.io/#person",
    name: profile.name,
    jobTitle: profileZh.role,
    affiliation: { "@type": "CollegeOrUniversity", name: "清华大学" },
    email: `mailto:${profile.email}`,
    image: "https://jw-chae.github.io/profile/joongwon-chae.jpg",
    sameAs: [profile.github, profile.scholar],
  };

  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      <section className="home-intro shell" id="about" aria-labelledby="home-title">
        <h1 id="home-title" lang="en">{profileZh.name}</h1>
        <p className="profile-role">{profileZh.role} · {profileZh.affiliation}</p>
        <div className="intro-grid">
          <figure className="profile-photo">
            <Image src={profileZh.photo} alt="Joongwon Chae 在明亮的室内植物中庭留影" width={960} height={1280} priority sizes="(max-width: 600px) 150px, 180px" />
            <figcaption>{profileZh.location}</figcaption>
          </figure>

          <div className="bio-copy">
            <h2>简介</h2>
            <p>
              我目前是<strong>{profileZh.affiliation}</strong>的<strong>{profileZh.role}</strong>。我的研究聚焦于免训练视觉推理，即在不更新底层模型参数的情况下选择并使用参考证据。
            </p>
            <p>{profileZh.thesis}</p>
            <p>{profileZh.statement}</p>
            <div className="profile-links" aria-label="学术主页链接">
              <a href={profileZh.scholar}>Google Scholar</a>
              <a href={profileZh.github}>GitHub</a>
              <a href="/JoongwonChae_CV_ZH.pdf">中文简历</a>
              <a href={`mailto:${profileZh.email}`}>邮箱</a>
            </div>
          </div>

          <aside className="focus-list" aria-labelledby="focus-title">
            <h2 id="focus-title">研究方向</h2>
            <ul>
              <li>免训练异常检测</li>
              <li>记忆增强推理</li>
              <li>检索与视觉提示</li>
              <li>医疗与多模态人工智能</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="content-section shell" id="research" aria-labelledby="research-title">
        <header className="section-header">
          <h2 id="research-title">代表性研究</h2>
        </header>
        <div className="research-list">
          {selectedResearchZh.map((item) => <ResearchEntry item={item} key={item.slug} />)}
        </div>
      </section>

      <section className="content-section shell" aria-labelledby="recent-title">
        <header className="section-header">
          <h2 id="recent-title">近期论文</h2>
        </header>
        <div className="publication-list">
          {publicationsZh.slice(0, 5).map((publication) => (
            <PublicationRow key={publication.title} publication={publication} compact locale="zh" />
          ))}
        </div>
        <p className="more-link"><Link href="/zh/publications">查看全部论文</Link></p>
      </section>

      <section className="content-section shell" aria-labelledby="record-title">
        <header className="section-header"><h2 id="record-title">学术经历</h2></header>
        <div className="record-grid">
          <div>
            <h3>经历</h3>
            <ul className="record-list">
              {experienceZh.map((item) => (
                <li key={item.role}><strong>{item.role}</strong>，{item.place}<span>{item.period}</span></li>
              ))}
            </ul>
          </div>
          <div>
            <h3>教育</h3>
            <ul className="record-list">
              {educationZh.map((item) => (
                <li key={item.institution}><strong>{item.institution}</strong><span>{item.period}</span><small>{item.detail}</small></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="honors">
          <h3>荣誉与奖学金</h3>
          <ul>{honorsZh.map((honor) => <li key={honor}>{honor}</li>)}</ul>
        </div>
        <div className="languages">
          <h3>语言能力</h3>
          <p>{languagesZh}</p>
        </div>
      </section>
    </main>
  );
}
