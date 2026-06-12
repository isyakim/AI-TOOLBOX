export async function* parseSSEStream(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const events = buffer.split(/\r?\n\r?\n/)
    buffer = events.pop() || ''
    for (const event of events) {
      const token = parseSSEEvent(event)
      if (token !== null) yield token
    }
    if (done) break
  }
  if (buffer.trim()) {
    const token = parseSSEEvent(buffer)
    if (token !== null) yield token
  }
}

function parseSSEEvent(event: string): string | null {
  const data = event
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trimStart())
    .join('\n')
  if (!data || data === '[DONE]') return null
  try {
    const payload = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> }
    return payload.choices?.[0]?.delta?.content || null
  } catch {
    return null
  }
}
