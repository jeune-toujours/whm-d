import type { CollectionAfterChangeHook, Field } from 'payload'

export const audit: CollectionAfterChangeHook = async ({ req, doc, previousDoc, operation, collection }) => {
  const fields = collection.fields.filter((field): field is Field & { name: string } => 'name' in field).map(f => f.name).filter(k => JSON.stringify(doc[k]) !== JSON.stringify(previousDoc?.[k]))
  // Do not mutate shared req.context: nested writes must retain their audits.
  await req.payload.create({ collection: 'audit-log', overrideAccess: true, req, data: { actor: req.user?.id, entity: collection.slug, entityID: String(doc.id), action: operation, changedFields: fields.join(',') } })
  return doc
}
