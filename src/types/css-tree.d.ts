declare module 'css-tree' {
  export interface CssNode {
    type: string
    name?: string
    property?: string
    value?: CssNode | string
    prelude?: CssNode
    block?: CssNode
    children?: { forEach(callback: (node: CssNode) => void): void }
  }
  export function parse(css: string, options?: { context?: string }): CssNode
  export function generate(node: CssNode): string
  export function walk(node: CssNode, callback: (node: CssNode) => void): void
}
