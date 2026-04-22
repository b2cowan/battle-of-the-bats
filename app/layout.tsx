import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'Battle of the Bats | Milton Bats Softball Tournament',
  description: 'Official website for the Battle of the Bats softball tournament hosted by the Milton Bats. Schedules, results, team rosters, and more.',
  keywords: 'softball, tournament, Milton Bats, Battle of the Bats, youth softball',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <main>{children}</main>
        <Footer />
        <BottomNav />
      </body>
    </html>
  );
}
