import { app } from 'electron'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, extname, join, normalize } from 'node:path'
import { parse as parseVueSfc } from '@vue/compiler-sfc'
import TreeSitter from '@vscode/tree-sitter-wasm'
import type { Node, Parser as TreeSitterParser } from 'web-tree-sitter'
import type {
  ProjectMap,
  ProjectRelation,
  ProjectSymbol,
  WorkspaceProject
} from '../../src/shared/types/ipc'
import type { ScannedProjectFile } from './projectScanner'

const parserCache = new Map<string, TreeSitterParser>()
let parserInitialized = false
const { Language, Parser } = TreeSitter

export interface AnalyzedChunk {
  text: string
  relativePath: string
  lineStart: number
  lineEnd: number
  symbol?: string
  language: string
}

export interface ProjectAnalysis {
  chunks: AnalyzedChunk[]
  projectMap: ProjectMap
}

export async function analyzeProject(
  project: WorkspaceProject,
  files: ScannedProjectFile[]
): Promise<ProjectAnalysis> {
  const chunks: AnalyzedChunk[] = []
  const symbols: ProjectSymbol[] = []
  const relations: ProjectRelation[] = []
  const testFiles: string[] = []
  const entryFiles: string[] = []
  const largeFiles: Array<{ path: string; bytes: number }> = []

  for (const file of files) {
    const source = await fs.readFile(file.path, 'utf-8')
    if (isTestFile(file.relativePath)) testFiles.push(file.relativePath)
    if (isEntryFile(file.relativePath, source)) entryFiles.push(file.relativePath)
    if (file.bytes > 200 * 1024) largeFiles.push({ path: file.relativePath, bytes: file.bytes })

    const result = await analyzeFile(project.id, file, source)
    chunks.push(...result.chunks)
    symbols.push(...result.symbols)
    relations.push(...result.relations)
  }

  for (const testPath of testFiles) {
    const base = testPath.replace(/\.(?:test|spec)(?=\.)/, '').replace(/(^|\/)tests?\//, '$1')
    const target = files.find((file) => normalizeStem(file.relativePath) === normalizeStem(base))
    if (target)
      relations.push({
        projectId: project.id,
        fromPath: testPath,
        toPath: target.relativePath,
        kind: 'tests'
      })
  }

  const coupling = new Map<string, number>()
  for (const relation of relations.filter((item) => item.kind === 'imports')) {
    coupling.set(relation.toPath, (coupling.get(relation.toPath) || 0) + 1)
  }
  const hotspots = Array.from(coupling.entries())
    .filter(([, score]) => score >= 2)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([path, score]) => ({ path, score, reason: `Imported by ${score} indexed modules.` }))

  return {
    chunks,
    projectMap: { project, entryFiles, symbols, relations, testFiles, largeFiles, hotspots }
  }
}

async function analyzeFile(projectId: string, file: ScannedProjectFile, source: string) {
  if (file.extension === '.vue') return analyzeVue(projectId, file, source)
  if (['.ts', '.tsx', '.js', '.jsx'].includes(file.extension)) {
    return analyzeScript(projectId, file, source)
  }
  return { chunks: chunkLines(source, file), symbols: [], relations: [] }
}

async function analyzeVue(projectId: string, file: ScannedProjectFile, source: string) {
  const parsed = parseVueSfc(source, { filename: file.relativePath })
  const scripts = [parsed.descriptor.script, parsed.descriptor.scriptSetup].filter(Boolean)
  const chunks: AnalyzedChunk[] = []
  const symbols: ProjectSymbol[] = []
  const relations: ProjectRelation[] = []

  for (const block of scripts) {
    if (!block) continue
    const extension = block.lang === 'tsx' ? '.tsx' : block.lang === 'ts' ? '.ts' : '.js'
    const virtualFile = { ...file, extension, language: 'Vue' }
    const result = await analyzeScript(
      projectId,
      virtualFile,
      block.content,
      block.loc.start.line - 1
    )
    chunks.push(...result.chunks)
    symbols.push(...result.symbols)
    relations.push(...result.relations)
  }

  if (parsed.descriptor.template?.content.trim()) {
    const offset = parsed.descriptor.template.loc.start.line - 1
    chunks.push(...chunkLines(parsed.descriptor.template.content, file, offset, 'template'))
  }
  if (!chunks.length) chunks.push(...chunkLines(source, file))
  symbols.push({
    id: symbolId(projectId, file.relativePath, 'component', 1),
    projectId,
    path: file.relativePath,
    name:
      file.relativePath
        .split('/')
        .pop()
        ?.replace(/\.vue$/, '') || 'Vue component',
    kind: 'component',
    exported: true,
    lineStart: 1,
    lineEnd: source.split(/\r?\n/).length
  })
  return { chunks, symbols, relations }
}

async function analyzeScript(
  projectId: string,
  file: ScannedProjectFile,
  source: string,
  lineOffset = 0
) {
  try {
    const parser = await getParser(file.extension)
    const tree = parser.parse(source)
    if (!tree) throw new Error('Parser returned no syntax tree.')
    const symbols: ProjectSymbol[] = []
    const chunks: AnalyzedChunk[] = []
    walk(tree.rootNode, (node) => {
      const symbol = symbolFromNode(projectId, file.relativePath, source, node, lineOffset)
      if (!symbol) return
      symbols.push(symbol)
      chunks.push({
        text: source.slice(node.startIndex, node.endIndex),
        relativePath: file.relativePath,
        lineStart: symbol.lineStart,
        lineEnd: symbol.lineEnd,
        symbol: symbol.name,
        language: file.language
      })
    })
    const relations = importRelations(projectId, file, source)
    tree.delete()
    return {
      chunks: chunks.length ? chunks : chunkLines(source, file, lineOffset),
      symbols,
      relations
    }
  } catch {
    return {
      chunks: chunkLines(source, file, lineOffset),
      symbols: [],
      relations: importRelations(projectId, file, source)
    }
  }
}

async function getParser(extension: string): Promise<TreeSitterParser> {
  const grammar = extension === '.tsx' ? 'tsx' : extension === '.ts' ? 'typescript' : 'javascript'
  const cached = parserCache.get(grammar)
  if (cached) return cached
  const wasmRoot = app.isPackaged
    ? join(process.resourcesPath, 'tree-sitter')
    : join(process.cwd(), 'node_modules', '@vscode', 'tree-sitter-wasm', 'wasm')
  if (!parserInitialized) {
    await Parser.init({ locateFile: () => join(wasmRoot, 'tree-sitter.wasm') })
    parserInitialized = true
  }
  const language = await Language.load(join(wasmRoot, `tree-sitter-${grammar}.wasm`))
  const parser = new Parser()
  parser.setLanguage(language)
  parserCache.set(grammar, parser)
  return parser
}

function symbolFromNode(
  projectId: string,
  path: string,
  source: string,
  node: Node,
  offset: number
): ProjectSymbol | null {
  const kinds: Record<string, ProjectSymbol['kind']> = {
    function_declaration: 'function',
    class_declaration: 'class',
    method_definition: 'method',
    lexical_declaration: 'variable'
  }
  const kind = kinds[node.type]
  if (!kind) return null
  const nameNode = node.childForFieldName('name') || findIdentifier(node)
  const name = nameNode ? source.slice(nameNode.startIndex, nameNode.endIndex) : ''
  if (
    !name ||
    (kind === 'variable' && !/^export\s/.test(source.slice(node.startIndex, node.endIndex)))
  )
    return null
  const lineStart = node.startPosition.row + 1 + offset
  const lineEnd = node.endPosition.row + 1 + offset
  const prefix = source.slice(Math.max(0, node.startIndex - 16), node.startIndex)
  return {
    id: symbolId(projectId, path, name, lineStart),
    projectId,
    path,
    name,
    kind,
    exported:
      /export\s*$/.test(prefix) || /^export\s/.test(source.slice(node.startIndex, node.endIndex)),
    lineStart,
    lineEnd
  }
}

function findIdentifier(node: Node): Node | null {
  for (const child of node.namedChildren) {
    if (child.type === 'identifier' || child.type === 'property_identifier') return child
    const nested = findIdentifier(child)
    if (nested) return nested
  }
  return null
}

function walk(node: Node, visitor: (node: Node) => void): void {
  visitor(node)
  node.namedChildren.forEach((child) => walk(child, visitor))
}

function importRelations(
  projectId: string,
  file: ScannedProjectFile,
  source: string
): ProjectRelation[] {
  const relations: ProjectRelation[] = []
  const pattern = /(?:import[\s\S]*?from\s*|require\s*\()\s*['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    if (!match[1].startsWith('.')) continue
    const target = normalize(join(dirname(file.relativePath), match[1])).replace(/\\/g, '/')
    relations.push({ projectId, fromPath: file.relativePath, toPath: target, kind: 'imports' })
  }
  return relations
}

function chunkLines(
  source: string,
  file: ScannedProjectFile,
  lineOffset = 0,
  symbol?: string
): AnalyzedChunk[] {
  const lines = source.split(/\r?\n/)
  const chunks: AnalyzedChunk[] = []
  for (let start = 0; start < lines.length; start += 60) {
    const end = Math.min(start + 80, lines.length)
    const text = lines.slice(start, end).join('\n').trim()
    if (text)
      chunks.push({
        text,
        relativePath: file.relativePath,
        lineStart: start + 1 + lineOffset,
        lineEnd: end + lineOffset,
        symbol,
        language: file.language
      })
  }
  return chunks
}

function isTestFile(path: string): boolean {
  return /(^|\/)(tests?|e2e)\//i.test(path) || /\.(test|spec)\.[^.]+$/i.test(path)
}

function isEntryFile(path: string, source: string): boolean {
  const name = path.split('/').pop()?.toLowerCase() || ''
  return (
    /^(main|index|app)\.(?:ts|tsx|js|jsx|vue)$/.test(name) ||
    /createApp\s*\(|new BrowserWindow\s*\(/.test(source)
  )
}

function normalizeStem(path: string): string {
  return path.replace(/\.(?:test|spec)(?=\.)/, '').replace(extname(path), '')
}

function symbolId(projectId: string, path: string, name: string, line: number): string {
  return createHash('sha256')
    .update(`${projectId}:${path}:${name}:${line}`)
    .digest('hex')
    .slice(0, 20)
}
