export type SecurityFinding = { rule: string; severity: 'high' | 'medium'; file: string; detail: string }
export function auditProjectSecurity(files: Array<{path:string;content:string}>): SecurityFinding[] {
  const findings: SecurityFinding[] = []
  for (const file of files) {
    const source = file.content
    const rules: Array<{rule:string;severity:'high'|'medium';pattern:RegExp;detail:string}> = [
      {rule:'secret-exposure',severity:'high',pattern:/\b(?:NEXT_PUBLIC_[A-Z_]*SECRET|NEXT_PUBLIC_[A-Z_]*SERVICE_ROLE|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*['"`][^'"`]+/i,detail:'Possível segredo exposto em código ou variável pública.'},
      {rule:'unsafe-eval',severity:'high',pattern:/\b(?:eval\s*\(|new\s+Function\s*\()/i,detail:'Execução dinâmica de código requer revisão.'},
      {rule:'unsafe-html',severity:'medium',pattern:/\bdangerouslySetInnerHTML\b|\.innerHTML\s*=/i,detail:'HTML dinâmico exige sanitização e revisão contra XSS.'},
      {rule:'insecure-url',severity:'medium',pattern:/https?:\/\/[^\s'"]+@/i,detail:'URL contém credenciais embutidas.'},
    ]
    for (const rule of rules) if (rule.pattern.test(source)) findings.push({rule:rule.rule,severity:rule.severity,file:file.path,detail:rule.detail})
  }
  return findings
}
