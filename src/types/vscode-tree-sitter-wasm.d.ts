declare module '@vscode/tree-sitter-wasm' {
  const TreeSitter: typeof import('web-tree-sitter')
  export default TreeSitter
}
