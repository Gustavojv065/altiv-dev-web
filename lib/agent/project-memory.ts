/** Stateless, bounded context retrieval from project-owned records; no cross-tenant reads. */
export type MemoryEntry = {role:string;content:string;created_at?:string}
export function buildProjectMemory(messages:MemoryEntry[], maxChars=6000):string {
  const relevant=messages.filter(m=>m.role==='user'||m.role==='assistant').slice(-24)
  const result:string[]=[]
  let remaining=Math.max(0,Math.min(maxChars,12000))
  for(const item of relevant.reverse()){
    const text=item.content.trim().slice(0,1200)
    if(!text||remaining<=0)break
    const entry=(item.role==='user'?'Pedido: ':'Resposta: ')+text
    result.unshift(entry.slice(0,remaining))
    remaining-=entry.length
  }
  return result.join('\n')
}
