const sanitize = require('sanitize-html');

// Admin rich text is rendered with dangerouslySetInnerHTML on public pages, so
// it is cleaned on save: scripts, event handlers, unsafe URLs and layout-hijacking
// CSS go, while everything the editor or a Word/Docs paste legitimately produces stays.
const SAFE_CSS_VALUE = [/^(?!.*(url\s*\(|expression\s*\(|javascript:|@import)).*$/i];

const SAFE_CSS_PROPERTIES = [
  'color', 'background', 'background-color',
  'font', 'font-family', 'font-size', 'font-style', 'font-variant', 'font-weight',
  'text-align', 'text-decoration', 'text-indent', 'text-transform',
  'line-height', 'letter-spacing', 'word-spacing', 'white-space', 'word-break', 'overflow-wrap', 'vertical-align',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
  'border-color', 'border-style', 'border-width', 'border-collapse', 'border-spacing', 'border-radius',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'aspect-ratio',
  'float', 'clear', 'display', 'table-layout', 'caption-side', 'list-style-type',
];

const OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span', 'br', 'hr',
    'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'del', 'ins', 'sub', 'sup', 'small', 'big', 'mark', 'font',
    'a', 'img', 'figure', 'figcaption',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'table', 'caption', 'colgroup', 'col', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'blockquote', 'pre', 'code',
  ],
  // Word's embedded style sheets and XML metadata would otherwise leak as text.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'xml'],
  allowedAttributes: {
    '*': ['style', 'class', 'id', 'dir', 'lang', 'align', 'title', 'width', 'height'],
    a: ['href', 'name', 'target', 'rel'],
    img: ['src', 'srcset', 'sizes', 'alt', 'loading'],
    table: ['border', 'cellpadding', 'cellspacing', 'bgcolor', 'summary'],
    td: ['colspan', 'rowspan', 'headers', 'valign', 'bgcolor', 'nowrap'],
    th: ['colspan', 'rowspan', 'headers', 'scope', 'valign', 'bgcolor', 'nowrap'],
    tr: ['valign', 'bgcolor'],
    col: ['span'],
    colgroup: ['span'],
    ol: ['start', 'type', 'reversed'],
    ul: ['type'],
    li: ['value'],
    font: ['color', 'face', 'size'],
    hr: ['size', 'noshade'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  // Older posts embed pictures as base64, so `data:` stays valid on images only.
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  allowedStyles: { '*': Object.fromEntries(SAFE_CSS_PROPERTIES.map((p) => [p, SAFE_CSS_VALUE])) },
};

const sanitizeContent = (html) => (typeof html === 'string' ? sanitize(html, OPTIONS) : html);

module.exports = { sanitizeContent };
