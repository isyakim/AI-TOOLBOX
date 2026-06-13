export interface ProposedFileChange {
  path: string
  action: 'write' | 'delete'
  content: string
}
