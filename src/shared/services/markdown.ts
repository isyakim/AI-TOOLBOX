import { marked, type Tokens } from 'marked'

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[character] || character
  )
}

export function renderSafeMarkdown(markdown: string): string {
  marked.use({
    renderer: {
      html({ text }: Tokens.HTML | Tokens.Tag) {
        return escapeHtml(text)
      }
    }
  })
  const html = marked.parse(markdown, { breaks: true, gfm: true }) as string

  const document = new DOMParser().parseFromString(html, 'text/html')
  document
    .querySelectorAll('script, style, iframe, object, embed, form')
    .forEach((node) => node.remove())

  document.body.querySelectorAll('*').forEach((element) => {
    for (const attribute of Array.from(element.attributes)) {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim().toLowerCase()
      if (name.startsWith('on') || name === 'style') element.removeAttribute(attribute.name)
      if ((name === 'href' || name === 'src') && /^(javascript|vbscript):/.test(value)) {
        element.removeAttribute(attribute.name)
      }
    }
    if (element.tagName === 'A') {
      element.setAttribute('rel', 'noreferrer noopener')
      element.setAttribute('target', '_blank')
    }
  })

  return document.body.innerHTML
}
