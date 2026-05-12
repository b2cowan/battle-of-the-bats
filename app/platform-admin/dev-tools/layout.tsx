import { redirect } from 'next/navigation';

export default function DevToolsLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_TOOLS !== 'true') {
    redirect('/platform-admin');
  }
  return <>{children}</>;
}
