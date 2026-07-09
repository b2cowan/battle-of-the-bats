import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  renderMarkupToHtml,
  renderHeadingAndBody,
  fillSubjectTokens,
} from '../../lib/email-markup.ts';

describe('renderMarkupToHtml — paragraphs & inline', () => {
  it('wraps a plain line in a styled paragraph', () => {
    const html = renderMarkupToHtml('Hello there.');
    assert.match(html, /<p style="[^"]*">Hello there\.<\/p>/);
  });

  it('joins consecutive lines with <br> and splits paragraphs on blank lines', () => {
    const html = renderMarkupToHtml('Line one\nLine two\n\nSecond para');
    const paras = html.match(/<p /g) ?? [];
    assert.equal(paras.length, 2);
    assert.match(html, /Line one<br>Line two/);
  });

  it('converts **bold** to <strong>', () => {
    const html = renderMarkupToHtml('This is **important** now');
    assert.match(html, /This is <strong>important<\/strong> now/);
  });
});

describe('renderMarkupToHtml — tokens', () => {
  it('fills known tokens with the variable value', () => {
    const html = renderMarkupToHtml('Hi {{firstName}},', { firstName: 'Sam' });
    assert.match(html, /Hi Sam,/);
  });

  it('leaves unknown tokens as literal {{token}} (visible, not blank)', () => {
    const html = renderMarkupToHtml('Hi {{firstName}},', {});
    assert.match(html, /Hi \{\{firstName\}\},/);
  });

  it('HTML-escapes variable values (customer text cannot inject markup)', () => {
    const html = renderMarkupToHtml('Org: {{orgName}}', { orgName: '<b>Acme & Co</b>' });
    assert.match(html, /Org: &lt;b&gt;Acme &amp; Co&lt;\/b&gt;/);
    assert.doesNotMatch(html, /<b>Acme/);
  });

  it('renders tokens as chips in preview (chip) mode', () => {
    const html = renderMarkupToHtml('Hi {{firstName}}', { firstName: 'Sam' }, 'chip');
    assert.match(html, /\{\{firstName\}\}/); // chip shows the token name, not the value
    assert.doesNotMatch(html, />Sam</);
  });
});

describe('renderMarkupToHtml — bullets', () => {
  it('groups consecutive - lines into one <ul>', () => {
    const html = renderMarkupToHtml('- Alpha\n- Beta\n- Gamma');
    assert.equal((html.match(/<ul /g) ?? []).length, 1);
    assert.equal((html.match(/<li>/g) ?? []).length, 3);
    assert.match(html, /<li>Alpha<\/li><li>Beta<\/li><li>Gamma<\/li>/);
  });

  it('a non-bullet line closes the list', () => {
    const html = renderMarkupToHtml('- Alpha\nAfter list');
    assert.equal((html.match(/<ul /g) ?? []).length, 1);
    assert.match(html, /After list/);
  });
});

describe('renderMarkupToHtml — buttons & links', () => {
  it('renders a primary button with filled href', () => {
    const html = renderMarkupToHtml('::button Go now → | {{url}}', { url: 'https://x.test/setup' });
    assert.match(html, /<a href="https:\/\/x\.test\/setup"[^>]*>Go now →<\/a>/);
    assert.match(html, /background:#D9F99D/);
  });

  it('renders a quiet secondary link', () => {
    const html = renderMarkupToHtml('::link See plans → | {{url}}', { url: 'https://x.test/pricing' });
    assert.match(html, /<a href="https:\/\/x\.test\/pricing"[^>]*>See plans →<\/a>/);
    assert.doesNotMatch(html, /background:#D9F99D/); // link variant has no fill
  });

  it('escapes & in a filled URL to &amp; (attribute-safe)', () => {
    const html = renderMarkupToHtml('::button Go | {{url}}', { url: 'https://x.test/a?b=1&c=2' });
    assert.match(html, /href="https:\/\/x\.test\/a\?b=1&amp;c=2"/);
  });

  it('keeps a label containing a literal | (splits on the LAST pipe)', () => {
    const html = renderMarkupToHtml('::button Buy 1 | Get 1 Free | {{url}}', { url: 'https://x.test/deal' });
    assert.match(html, /<a href="https:\/\/x\.test\/deal"[^>]*>Buy 1 \| Get 1 Free<\/a>/);
  });

  it('strips newlines from a URL value so it cannot inject a <br> into the href', () => {
    const html = renderMarkupToHtml('::button Go | {{url}}', { url: 'https://x.test/ok\nmalicious' });
    assert.doesNotMatch(html, /<br>/);
    assert.match(html, /href="https:\/\/x\.test\/okmalicious"/);
  });
});

describe('renderMarkupToHtml — malformed markup resilience', () => {
  it('does NOT truncate remaining content on a stray top-level ::end', () => {
    const html = renderMarkupToHtml('First para\n::end\nSecond para survives');
    assert.match(html, /First para/);
    assert.match(html, /Second para survives/);
    assert.doesNotMatch(html, /::end/);
  });

  it('does NOT truncate when ::else is misused inside a ::callout', () => {
    // Operator typo: ::else where ::end was meant. Content after must still render.
    const html = renderMarkupToHtml('::callout Box\nInside\n::else\nAfter block renders\n::end');
    assert.match(html, /Inside/);
    assert.match(html, /After block renders/);
    assert.doesNotMatch(html, /::(else|end)/);
  });

  it('renders content after an unmatched ::else at top level', () => {
    const html = renderMarkupToHtml('Lead\n::else\nTail still here');
    assert.match(html, /Lead/);
    assert.match(html, /Tail still here/);
  });
});

describe('renderMarkupToHtml — callouts', () => {
  it('renders a lime callout with a label and inner bullets', () => {
    const md = '::callout What you get\n- One\n- Two\n::end';
    const html = renderMarkupToHtml(md);
    assert.match(html, /rgba\(217,249,157/); // lime border
    assert.match(html, /text-transform:uppercase[^"]*">What you get<\/p>/);
    assert.equal((html.match(/<li>/g) ?? []).length, 2);
  });

  it('renders a blue callout via ::callout.blue', () => {
    const html = renderMarkupToHtml('::callout.blue Heads up\nBody line\n::end');
    assert.match(html, /rgba\(30,58,138/); // blue border
    assert.match(html, />Heads up<\/p>/);
    assert.match(html, /Body line/);
  });
});

describe('renderMarkupToHtml — conditionals', () => {
  const md = [
    '::if hasActivity',
    '::callout Season so far',
    'You played **{{games}} games**.',
    '::end',
    '::else',
    'Nothing yet — go set up a tournament.',
    '::end',
  ].join('\n');

  it('renders the THEN branch when the token is truthy', () => {
    const html = renderMarkupToHtml(md, { hasActivity: '1', games: 47 });
    assert.match(html, /Season so far/);
    assert.match(html, /You played <strong>47 games<\/strong>/);
    assert.doesNotMatch(html, /Nothing yet/);
  });

  it('renders the ELSE branch when the token is falsy', () => {
    const html = renderMarkupToHtml(md, { hasActivity: '0' });
    assert.match(html, /Nothing yet/);
    assert.doesNotMatch(html, /Season so far/);
  });

  it('treats a missing token as falsy', () => {
    const html = renderMarkupToHtml(md, {});
    assert.match(html, /Nothing yet/);
  });

  it('shows BOTH branches in preview (chip) mode so operators see all content', () => {
    const html = renderMarkupToHtml(md, {}, 'chip');
    assert.match(html, /Season so far/);
    assert.match(html, /Nothing yet/);
  });
});

describe('renderHeadingAndBody', () => {
  it('renders a lime heading followed by the body, with tokens filled', () => {
    const html = renderHeadingAndBody({
      heading: 'Welcome, {{orgName}}',
      body: 'You are **in**.',
      vars: { orgName: 'Acme' },
    });
    assert.match(html, /<h2 style="[^"]*">Welcome, Acme<\/h2>/);
    assert.match(html, /You are <strong>in<\/strong>\./);
    // Heading precedes body
    assert.ok(html.indexOf('<h2') < html.indexOf('You are'));
  });

  it('omits the heading element when heading is blank', () => {
    const html = renderHeadingAndBody({ heading: '   ', body: 'Just body.' });
    assert.doesNotMatch(html, /<h2/);
    assert.match(html, /Just body\./);
  });
});

describe('fillSubjectTokens', () => {
  it('fills tokens without HTML escaping', () => {
    assert.equal(fillSubjectTokens('Your {{plan}} & more', { plan: 'Club' }), 'Your Club & more');
  });
  it('leaves unknown tokens literal', () => {
    assert.equal(fillSubjectTokens('Hi {{name}}', {}), 'Hi {{name}}');
  });
});
