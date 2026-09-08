import { FilterXSS } from 'xss';

// NFR: sanitize HTML email before it ever reaches the browser.
const filter = new FilterXSS({
  stripIgnoreTag: true,
  stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
  onTagAttr: (tag, name, value) => {
    if ((tag === 'a' || tag === 'img') && (name === 'href' || name === 'src')) {
      if (/^\s*(javascript|data|vbscript):/i.test(value)) return '';
    }
    return undefined;
  },
});

export const sanitizeHtml = (html: string) => filter.process(html);
export const toSnippet = (text: string, n = 140) =>
  text.replace(/\s+/g, ' ').trim().slice(0, n);
