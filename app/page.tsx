import Link from "next/link";
import { PublicationRow } from "@/components/publication-row";
import { ResearchVisual } from "@/components/research-visual";
import {
  education,
  experience,
  honors,
  profile,
  publications,
  selectedResearch,
  type ResearchItem,
} from "@/data/site";

function ProjectLinks({ item }: { item: ResearchItem }) {
  if (!item.arxiv && !item.code) return null;

  return (
    <div className="resource-links" aria-label={item.title + " resources"}>
      {item.arxiv ? <a href={"https://arxiv.org/abs/" + item.arxiv}>paper</a> : null}
      {item.code ? <a href={item.code}>code</a> : null}
    </div>
  );
}

function ResearchEntry({ item }: { item: ResearchItem }) {
  const status = item.visual === "boundary" ? "Ongoing research · working title" : item.status;

  return (
    <article className="research-entry">
      <div className="research-entry-visual">
        <ResearchVisual kind={item.visual} />
      </div>
      <div className="research-entry-copy">
        <p className="entry-status">{status}</p>
        <h3>{item.title}</h3>
        <p className="entry-finding">{item.finding}</p>
        <p>{item.detail}</p>
        <ProjectLinks item={item} />
      </div>
    </article>
  );
}

export default function Home() {
  const personSchema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    affiliation: { "@type": "CollegeOrUniversity", name: "Tsinghua University" },
    email: "mailto:" + profile.email,
    sameAs: [profile.github, profile.scholar],
  };

  return (
    <main id="main">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(personSchema) }} />

      <section className="home-intro shell" id="about" aria-labelledby="home-title">
        <h1 id="home-title">{profile.name}</h1>
        <div className="intro-grid">
          <div className="bio-copy">
            <h2>Bio</h2>
            <p>
              I am a graduate researcher at <strong>{profile.affiliation}</strong>. My work focuses on
              training-free visual inference: systems that select and use reference evidence without
              updating the underlying model.
            </p>
            <p>{profile.thesis}</p>
            <p>{profile.statement}</p>
            <div className="profile-links" aria-label="Research profile links">
              <a href={profile.scholar}>Google Scholar</a>
              <a href={profile.github}>GitHub</a>
              <a href="/JoongwonChae_CV.pdf">C.V.</a>
              <a href={"mailto:" + profile.email}>Email</a>
            </div>
          </div>

          <aside className="focus-list" aria-labelledby="focus-title">
            <h2 id="focus-title">Research interests</h2>
            <ul>
              <li>Training-free anomaly detection</li>
              <li>Memory-augmented inference</li>
              <li>Retrieval and visual prompting</li>
              <li>Medical and multimodal AI</li>
            </ul>
          </aside>
        </div>
      </section>

      <section className="content-section shell" id="research" aria-labelledby="research-title">
        <header className="section-header">
          <h2 id="research-title">Selected Research</h2>
          <p>Recent work on how frozen visual models choose, route, and use reference evidence.</p>
        </header>
        <div className="research-list">
          {selectedResearch.map((item) => <ResearchEntry item={item} key={item.slug} />)}
        </div>
      </section>

      <section className="content-section shell" aria-labelledby="recent-title">
        <header className="section-header">
          <h2 id="recent-title">Recent Publications</h2>
          <p>Selected preprints and peer-reviewed work. The complete list is available on Google Scholar.</p>
        </header>
        <div className="publication-list">
          {publications.slice(0, 5).map((publication) => (
            <PublicationRow key={publication.title} publication={publication} compact />
          ))}
        </div>
        <p className="more-link"><Link href="/publications">Full publication list</Link></p>
      </section>

      <section className="content-section shell" aria-labelledby="record-title">
        <header className="section-header">
          <h2 id="record-title">Academic Record</h2>
        </header>
        <div className="record-grid">
          <div>
            <h3>Experience</h3>
            <ul className="record-list">
              {experience.map((item) => (
                <li key={item.role}>
                  <strong>{item.role}</strong>, {item.place}
                  <span>{item.period}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>Education</h3>
            <ul className="record-list">
              {education.map((item) => (
                <li key={item.institution}>
                  <strong>{item.institution}</strong>
                  <span>{item.period}</span>
                  <small>{item.detail}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="honors">
          <h3>Honors</h3>
          <ul>
            {honors.map((honor) => <li key={honor}>{honor}</li>)}
          </ul>
        </div>
      </section>
    </main>
  );
}
