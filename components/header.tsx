import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="shell nav-wrap">
        <Link className="wordmark" href="/" aria-label="Joongwon Chae home">
          Joongwon Chae
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/">Home</Link>
          <Link href="/#research">Research</Link>
          <Link href="/publications">Publications</Link>
          <Link href="/cv">CV</Link>
          <Link href="/#about">About</Link>
        </nav>
      </div>
    </header>
  );
}
