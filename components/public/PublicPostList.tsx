import { formatStoredDate } from '@/lib/timezone';
import type { Announcement } from '@/lib/types';
import styles from './PublicParts.module.css';

/**
 * Posts as the public tournament pages list them (Public tournament pages Stage 2; the hub's `.post`): the date, the
 * title, two lines of the body, in one card. The Overview's News now; the News page's own card (NewsContent.tsx, the full
 * post) is redrawn in its stage and can take this. A pinned post says so in words; no star (owner, 2026-10-28: the
 * stars are few).
 */
export default function PublicPostList({ posts }: { posts: Announcement[] }) {
  if (posts.length === 0) return null;
  return (
    <ul className={styles.posts}>
      {posts.map(p => {
        const date = formatStoredDate(p.date, { withYear: false });
        return (
          <li key={p.id} className={styles.post}>
            <small>{p.pinned ? `Pinned · ${date}` : date}</small>
            <b>{p.title}</b>
            {p.body && <p>{p.body}</p>}
          </li>
        );
      })}
    </ul>
  );
}
