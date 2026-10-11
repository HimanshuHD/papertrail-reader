/** Keep the production database names unchanged so existing reading metadata survives. */
export function environmentDatabaseName(name: string, base = import.meta.env.BASE_URL): string {
  const preview = base.match(/\/preview\/pr-([1-9]\d*)\/$/)
  if (preview) return `${name}:preview-${preview[1]}`
  if (base.endsWith('/staging/')) return `${name}:staging`
  return name
}
