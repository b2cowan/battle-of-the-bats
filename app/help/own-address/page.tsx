import HelpPageLayout from '@/components/help/HelpPageLayout';
import ownAddressHelp from '@/lib/help-content/own-address';
import { marketingMetadata } from '@/lib/marketing-metadata';
import kit from '@/components/marketing/MarketingKit.module.css';

export const metadata = marketingMetadata({
  title: 'Use your club’s own address',
  description:
    'Add two records where your club’s address was bought, forward the plain name to www, and keep your email as it is. Steps for GoDaddy, Namecheap and Hover.',
  path: '/help/own-address',
});

/**
 * A PUBLIC page (no sign-in): the Web address row on Public site hands this link to whoever looks after the club's domain, who
 * is often not a FieldLogicHQ user. The words are lib/help-content/own-address.tsx. The row's registrar links land on its
 * sub-topics (#godaddy, #namecheap, #hover, #other-places).
 */
export default function OwnAddressHelpPage() {
  return (
    <main className={kit.page}>
      <section className={kit.section}>
        <div className="container">
          <HelpPageLayout {...ownAddressHelp} />
        </div>
      </section>
    </main>
  );
}
