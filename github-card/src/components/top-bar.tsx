import { LOGO_PATH } from '@/lib/terminal-card';
import { REPO_URL, repoStars } from '@/lib/stars';

/** The site header: the 1337 logo and name on the left, a "Star us" button with the live star count on the right. */
export async function TopBar() {
  const stars = await repoStars();
  return <header className="gc-bar">
    <div className="gc-bar-in">
      <a className="gc-brand" href="/" aria-label="GitHub Card, home">
        <svg width="30" height="30" viewBox="0 0 2000 2000" aria-hidden="true"><path transform="translate(0 2000) scale(1 -1)" d={LOGO_PATH}/></svg>
        <span>GitHub Card</span>
      </a>
      <a className="gc-star" href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="#f5b301" stroke="#d99a00" strokeWidth="1.2" strokeLinejoin="round"/></svg>
        Star us{stars !== null && <span className="gc-stars">{stars.toLocaleString('en-US')}</span>}
      </a>
    </div>
  </header>;
}
