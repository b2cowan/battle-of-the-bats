import type { HelpPageContent } from './index';
import { HelpDef, HelpDefs, HelpNote, HelpSteps } from '@/components/help/HelpBlocks';

/**
 * Use your club's own address (Club Tier Stage 4e close-out, 2026-10-24). A PUBLIC page at /help/own-address, not a guide in the
 * admin hub: the Web address row's "Copy both as a message" hands this link to whoever looks after the domain (often not a
 * FieldLogicHQ user), and the row's "How to: GoDaddy · Namecheap · Hover · Other places" links land on the sub-topics below
 * (`#godaddy`, `#namecheap`, `#hover`, `#other-places`). ⚠ Those four ids are built by OwnAddressPanel from the place's name:
 * renaming one breaks that link.
 *
 * The words follow CLUB_TIER_STAGE4E_COPY.md (the row's own labels: Padlock check, Your site, Waiting, Connected, Needs
 * attention, Not working, Not connected). The registrars' steps were read from their own help pages on 2026-10-24: Namecheap
 * (support/knowledgebase 9646, 385) and Hover (support.hover.com 201000064728, 201000064747) in full; GoDaddy's help pages
 * (godaddy.com/help 19236, 12123) refused the reading, so its steps are marked "may look a little different".
 * ⚠ Do not promise an ALIAS or ANAME route: the host is asked to serve ONE name (www or another), not the bare domain, so
 * pointing the bare name at us would show a certificate warning. See the "alias" sub-topic.
 */
const ownAddressHelp: HelpPageContent = {
  title: 'Use your club’s own address',
  role: 'Whoever looks after your club’s web address',
  intro:
    'Your club can use its own web address, like www.yourclub.ca, instead of fieldlogichq.ca/your-club. ' +
    'It takes two records added where the address was bought, and a minute to forward the plain name. ' +
    'Your email there is not affected.',
  searchPlaceholder: 'Search: records, GoDaddy, Namecheap, Hover, forward, padlock…',
  sections: [
    {
      id: 'own-address-records',
      group: 'Set it up',
      heading: 'The two records, and why you keep both',
      summary: 'Record 1 is the padlock check, record 2 sends visitors to your site. Add both where you bought the address.',
      keywords: ['own address', 'own domain', 'custom domain', 'web address', 'records', 'cname', 'record 1', 'record 2', 'padlock check', 'your site', 'sites.fieldlogichq.ca', 'padlock', 'certificate', 'https', 'security warning', 'keep record 1', 'dns', 'dns records', 'manage dns'],
      searchText: 'add two records where you bought the address sign in look for a setting called dns dns records or manage dns type cname name value copy keep both records for as long as you use this address padlock renews only while record 1 is there security warning if removed delete the old www record first some places want the whole name like www type only the part shown copy both as a message for whoever looks after the domain email is not affected change nothing else there',
      content: (
        <>
          <p>
            Sign in where you bought your address and look for a setting called <strong>DNS</strong>, <strong>DNS records</strong> or{' '}
            <strong>Manage DNS</strong>. Add the two records shown on your club&rsquo;s <strong>Public site &rsaquo; Web address</strong> row,
            exactly as shown.
          </p>
          <HelpDefs>
            <HelpDef term="1 · Padlock check">
              A <strong>CNAME</strong> record that lets the certificate issuer confirm the address is yours, so your site has its padlock.
              {' '}<strong>Keep it for good:</strong> the padlock renews only while this record is there. If it goes missing, the row turns to{' '}
              <strong>Needs attention</strong> and visitors see a security warning once the padlock runs out.
            </HelpDef>
            <HelpDef term="2 · Your site">
              A <strong>CNAME</strong> record, normally named <code>www</code>, whose value is <code>sites.fieldlogichq.ca</code>. It sends
              visitors to your site. If <code>www</code> already has a record (your old website), delete that one first.
            </HelpDef>
          </HelpDefs>
          <p>
            Some places want the whole name, like <code>www.yourclub.ca</code>. If yours adds <code>yourclub.ca</code> by itself, type only the part shown.
          </p>
          <HelpNote variant="info" title="Someone else looks after your address?">
            Press <strong>Copy both as a message</strong> on the row. It copies a plain message, with this page&rsquo;s link, that you can send
            to them.
          </HelpNote>
          <p>Your email at your address is not affected. Change nothing else there.</p>
        </>
      ),
    },
    {
      id: 'own-address-forward',
      group: 'Set it up',
      heading: 'Forward the plain name to www',
      summary: 'So people who type yourclub.ca without the www still arrive. Where to click at GoDaddy, Namecheap and Hover.',
      keywords: ['forward', 'forwarding', 'redirect', 'url redirect', 'bare name', 'plain name', 'without www', 'root domain', 'godaddy', 'namecheap', 'hover', 'other places', 'registrar', 'alias', 'aname', 'apex', '301', 'permanent', 'masking'],
      searchText: 'and the plain name on its own set it to forward to https www address where you bought it usually called forwarding or redirect free at most places godaddy domain portfolio dns forwarding add forwarding namecheap domain list manage advanced dns url redirect record hover forwards tab forward this domain domain forward alias aname bare domain not supported permanent 301 no masking unmasked https may show a warning share the www address',
      content: (
        <>
          <p>
            Set the plain name (<code>yourclub.ca</code>, without the www) to forward to <code>https://www.yourclub.ca</code> where you bought
            it. It is usually called <strong>Forwarding</strong> or <strong>Redirect</strong>, and it is free at most places. Pick{' '}
            <strong>permanent</strong>, and not <strong>masking</strong> (masking can show a blank page).
          </p>
          <p>
            The forward catches people who type the plain name. A few places only forward plain <code>http://</code> visits, so share and
            print the <strong>www</strong> address, never the plain name.
          </p>
        </>
      ),
      subtopics: [
        {
          id: 'godaddy',
          title: 'GoDaddy',
          content: (
            <>
              <p>GoDaddy&rsquo;s screens may look a little different from these; the words to look for are the same.</p>
              <HelpSteps>
                <li>Sign in, open your <strong>Domain Portfolio</strong>, pick the domain and open its <strong>DNS</strong> tab.</li>
                <li>
                  Add the records: press <strong>Add New Record</strong>, choose type <strong>CNAME</strong>, and type only{' '}
                  <code>www</code> as the name. Paste <code>sites.fieldlogichq.ca</code> as the value and save. Do the same for record 1
                  (the name and value are on the row).
                </li>
                <li>To forward the plain name, open <strong>Forwarding</strong> on the same tab and press <strong>Add Forwarding</strong>.</li>
                <li>Choose <strong>Domain</strong> (not a subdomain), enter <code>https://www.yourclub.ca</code>, and choose <strong>Permanent (301)</strong>. Leave masking off, then save.</li>
              </HelpSteps>
              <HelpNote variant="info">
                Once forwarding is on, GoDaddy locks the plain name&rsquo;s own record. That is normal.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'namecheap',
          title: 'Namecheap',
          content: (
            <>
              <HelpSteps>
                <li>Sign in, open <strong>Domain List</strong>, press <strong>Manage</strong> next to the domain and open the <strong>Advanced DNS</strong> tab.</li>
                <li>
                  Under <strong>Host Records</strong> press <strong>Add New Record</strong>, choose <strong>CNAME Record</strong>, and type
                  only <code>www</code> as the Host. Paste <code>sites.fieldlogichq.ca</code> as the value. Do the same for record 1.
                </li>
                <li>To forward the plain name, add another record: choose <strong>URL Redirect Record</strong>, Host <code>@</code>, and value <code>https://www.yourclub.ca</code>.</li>
                <li>Choose <strong>Unmasked</strong>, not Masked, then press <strong>Save All Changes</strong>. Allow about 30 minutes.</li>
              </HelpSteps>
              <HelpNote variant="warning">
                Namecheap adds your domain to the Host by itself, so never type the whole name there. A name can hold only one of a CNAME,
                a URL Redirect or another record, so delete an old <code>www</code> record first.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'hover',
          title: 'Hover',
          content: (
            <>
              <HelpSteps>
                <li>Sign in, open the domain and go to its <strong>DNS</strong> tab.</li>
                <li>
                  Press <strong>Add a record</strong>, choose type <strong>CNAME</strong>, and type only <code>www</code> as the Hostname.
                  Paste <code>sites.fieldlogichq.ca</code> as the Target Name and save. Do the same for record 1.
                </li>
                <li>To forward the plain name, open the <strong>Forwards</strong> tab and press <strong>Forward this domain</strong>.</li>
                <li>Choose <strong>Domain forward</strong>, enter <code>https://www.yourclub.ca</code> and press <strong>Save forward</strong>. Allow about 30 minutes.</li>
              </HelpSteps>
              <HelpNote variant="info">
                Hover&rsquo;s forward is temporary and works for plain <code>http://</code> visits only. Leave the two records Hover
                already has on the plain name as they are.
              </HelpNote>
            </>
          ),
        },
        {
          id: 'other-places',
          title: 'Other places',
          content: (
            <>
              <HelpSteps>
                <li>Find the setting called <strong>DNS</strong>, <strong>DNS records</strong> or <strong>Manage DNS</strong> and add the two <strong>CNAME</strong> records exactly as the row shows them.</li>
                <li>Look for <strong>Forwarding</strong>, <strong>Redirect</strong> or <strong>URL redirect</strong> for the plain name. Send it to <code>https://www.yourclub.ca</code>, permanent, no masking.</li>
              </HelpSteps>
              <p>
                If the place has no forwarding, skip that step. Your www address works either way; only people typing the plain name miss out.
              </p>
            </>
          ),
        },
        {
          id: 'alias',
          title: 'If your place offers an ALIAS or ANAME record',
          content: (
            <p>
              Some places offer an <strong>ALIAS</strong> or <strong>ANAME</strong> record for the plain name. Don&rsquo;t use one here: your
              club&rsquo;s own address is the <strong>www</strong> name (or another name you chose), and pointing the plain name straight at
              FieldLogicHQ is not supported yet, so visitors would see a certificate warning. Forward the plain name instead.
            </p>
          ),
        },
      ],
    },
    {
      id: 'own-address-states',
      group: 'Afterwards',
      heading: 'What the row says, and what to do',
      summary: 'Waiting, Connected, Needs attention, Not working, Not connected: what each means and the one thing to do.',
      keywords: ['waiting', 'connected', 'needs attention', 'not working', 'not connected', 'try again', 'check now', 'gave up', 'two days', 'checking', 'stopped checking', 'padlock record is gone', 'not reaching your site', 'live', 'email', 'points elsewhere', 'missing', 'not seen yet'],
      searchText: 'checking for your records we look again every 15 minutes and email you when your site is live often minutes after both records are in it can take up to two days you can leave this page check now never says live record 1 is in record 2 still sends people to your old website connected the padlock renews by itself needs attention the padlock check record is gone your site still works today put record 1 back before the date not working address is not reaching your site record 2 was changed or removed we check every hour clears by itself once record 2 is back not connected we stopped checking after two days try again records stay the same use a different address owner connects and removes the address admins can look',
      content: (
        <>
          <p>The row on <strong>Public site</strong> shows one status. Most clear by themselves once the record is back.</p>
          <HelpDefs>
            <HelpDef term="Waiting">
              <strong>Checking for your records.</strong> We look again every 15 minutes and email you when your site is live. It is often
              minutes after both records are in, and can take up to two days. You can leave the page. <strong>Check now</strong> updates the two
              cards; only the host decides the site is live.
            </HelpDef>
            <HelpDef term="Connected">
              Families find your site at your own address, and the old <code>fieldlogichq.ca</code> address forwards there. We keep checking both records and write to you if one goes missing.
            </HelpDef>
            <HelpDef term="Needs attention">
              Record 1 (the padlock check) is gone. Your site works today, but the padlock cannot renew without it. Put it back before the date shown. It clears by itself.
            </HelpDef>
            <HelpDef term="Not working">
              Record 2 was changed or removed, so the address is not reaching your site. Every link we hand out goes back to the{' '}
              <code>fieldlogichq.ca</code> address meanwhile. We check every hour; it clears by itself once record 2 is back.
            </HelpDef>
            <HelpDef term="Not connected">
              We stopped checking after two days because a record never appeared. Your site still works at its <code>fieldlogichq.ca</code> address.
              Check the records are saved exactly as shown, then press <strong>Try again</strong> (the records stay the same), or{' '}
              <strong>Use a different address</strong>.
            </HelpDef>
          </HelpDefs>
          <HelpNote variant="info">
            The owner connects and removes the address. An admin can see every status and press <strong>Check now</strong>.
          </HelpNote>
        </>
      ),
    },
    {
      id: 'own-address-stop',
      group: 'Afterwards',
      heading: 'Stop using your own address',
      summary: 'Everything goes back to the fieldlogichq.ca address at once. Why the padlock rule lasts up to two years.',
      keywords: ['stop', 'stop using', 'remove', 'disconnect', 'go back', 'cancel and start over', 'delete the records', 'two years', 'padlock', 'hsts', 'security warning'],
      searchText: 'stop using your own address press stop using it your site goes back to fieldlogichq.ca at once links and posters with your address stop working browsers that visited remember to use a padlock for up to two years so whatever you put there next needs one too you can delete the two records where you bought the address cancel and start over while waiting acts at once owner only',
      content: (
        <>
          <p>
            Only the owner can stop. <strong>Stop using your own address</strong> asks first, then your site goes back to{' '}
            <code>fieldlogichq.ca/your-club</code> at once, and links and posters with your own address stop working. You can then delete the
            two records where you bought the address.
          </p>
          <HelpNote variant="warning">
            For up to two years, browsers that visited your address will open it only with a padlock, so whatever you put there next needs
            one too.
          </HelpNote>
        </>
      ),
    },
  ],
  faqs: [
    {
      id: 'own-address-faq-email',
      question: 'Will this change my email?',
      answer: <>No. Your email at your address is not affected. Add only the two records shown and change nothing else there.</>,
      answerText: 'No. Your email at your address is not affected. Add only the two records shown and change nothing else there.',
      keywords: ['email', 'mx', 'mail'],
      popular: true,
    },
    {
      id: 'own-address-faq-both',
      question: 'Can I delete record 1 once my site is working?',
      answer: <>No. Keep both records for as long as you use the address. The padlock renews only while record 1 is there.</>,
      answerText: 'No. Keep both records for as long as you use the address. The padlock renews only while record 1 is there.',
      keywords: ['delete', 'remove', 'padlock', 'record 1'],
    },
  ],
};

export default ownAddressHelp;
