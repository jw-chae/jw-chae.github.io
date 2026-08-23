import { profile } from "@/data/site";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-grid">
        <div>
          <p>Joongwon Chae</p>
          <span>Tsinghua University SIGS · Training-free visual inference</span>
        </div>
        <div className="footer-links">
          <a href={profile.scholar}>Google Scholar</a>
          <a href={profile.github}>GitHub</a>
          <a href={`mailto:${profile.email}`}>Email</a>
        </div>
      </div>
    </footer>
  );
}
