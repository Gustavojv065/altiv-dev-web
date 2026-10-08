export type NicheId = 'barbershop' | 'beauty-salon' | 'restaurant' | 'clinic' | 'legal' | 'accounting' | 'generic'

export type NicheProfile = {
  id:NicheId
  label:string
  audience:string
  visualDirection:string
  preferredContent:string[]
  forbiddenContent:string[]
  mediaDirection:string[]
  heroDirection:string
}

const profiles:Record<NicheId,NicheProfile> = {
  barbershop:{
    id:'barbershop',
    label:'Barbearia masculina premium',
    audience:'homens que valorizam corte, barba, estilo, conforto e atendimento profissional',
    visualDirection:'masculino, sofisticado, editorial, contemporâneo, alto contraste controlado e acabamento de marca premium',
    preferredContent:['corte masculino','barba','barboterapia','acabamento','sobrancelha masculina','ambiente da barbearia','barbeiro em atendimento','cadeira de barbeiro','navalha','máquina de corte'],
    forbiddenContent:['manicure','pedicure','unhas','esmalte','cílios','maquiagem','penteado feminino','escova feminina','depilação feminina','salão feminino'],
    mediaDirection:['barbeiro atendendo cliente masculino','detalhe de corte masculino','barba sendo alinhada','ambiente premium de barbearia','cadeira clássica de barbeiro'],
    heroDirection:'hero forte com imagem ou vídeo de barbearia ocupando área visual relevante, nome da marca, proposta clara e CTA de agendamento; nunca apenas texto sobre fundo vazio',
  },
  'beauty-salon':{
    id:'beauty-salon',label:'Salão de beleza',audience:'clientes de beleza e cuidados pessoais',
    visualDirection:'elegante, acolhedor, refinado e visualmente leve',
    preferredContent:['cabelo','tratamentos','coloração','escova','beleza'],forbiddenContent:[],
    mediaDirection:['atendimento de salão','cabelo','ambiente sofisticado'],heroDirection:'hero editorial com resultado visual e CTA claro',
  },
  restaurant:{
    id:'restaurant',label:'Restaurante',audience:'clientes que buscam experiência gastronômica',
    visualDirection:'apetite visual, fotografia forte, identidade acolhedora e foco em conversão',
    preferredContent:['pratos','ambiente','cardápio','reservas','delivery'],forbiddenContent:[],
    mediaDirection:['pratos reais','cozinha','ambiente','equipe'],heroDirection:'hero com prato ou ambiente em destaque, proposta e CTA para reservar/pedir',
  },
  clinic:{
    id:'clinic',label:'Clínica',audience:'pacientes que precisam de confiança, clareza e facilidade de agendamento',
    visualDirection:'limpo, confiável, acolhedor e profissional',
    preferredContent:['especialidades','equipe','atendimento','agendamento'],forbiddenContent:[],
    mediaDirection:['equipe profissional','ambiente clínico acolhedor'],heroDirection:'hero limpo com benefício, confiança e CTA de agendamento',
  },
  legal:{
    id:'legal',label:'Advocacia',audience:'clientes que buscam orientação jurídica e confiança',
    visualDirection:'sóbrio, premium, institucional e moderno',
    preferredContent:['áreas de atuação','equipe','credibilidade','contato'],forbiddenContent:[],
    mediaDirection:['escritório profissional','equipe jurídica'],heroDirection:'hero institucional forte com especialidade e CTA de contato',
  },
  accounting:{
    id:'accounting',label:'Contabilidade',audience:'empresas e profissionais que precisam de gestão contábil',
    visualDirection:'claro, confiável, moderno e orientado a negócios',
    preferredContent:['contabilidade','fiscal','folha','empresas','consultoria'],forbiddenContent:[],
    mediaDirection:['equipe contábil','reunião de negócios'],heroDirection:'hero com proposta objetiva e CTA comercial',
  },
  generic:{
    id:'generic',label:'Projeto comercial',audience:'público definido pelo pedido',
    visualDirection:'profissional, específico para o setor, não genérico',
    preferredContent:[],forbiddenContent:[],mediaDirection:[],
    heroDirection:'hero com proposta forte, composição visual relevante e CTA claro',
  },
}

export function detectNiche(prompt:string):NicheProfile {
  const text=prompt.toLowerCase()
  if (/(barbearia|barber|barbeiro|barba|barboterapia|corte masculino)/i.test(text)) return profiles.barbershop
  if (/(salão de beleza|salao de beleza|manicure|cabeleireir|beauty salon)/i.test(text)) return profiles['beauty-salon']
  if (/(restaurante|pizzaria|hamburgueria|espetinho|choperia|bar gastronômico|bar gastronomico)/i.test(text)) return profiles.restaurant
  if (/(clínica|clinica|consultório|consultorio|odontolog|médic|medic)/i.test(text)) return profiles.clinic
  if (/(advocacia|advogado|jurídic|juridic|escritório de advocacia|escritorio de advocacia)/i.test(text)) return profiles.legal
  if (/(contábil|contabil|contabilidade|contador)/i.test(text)) return profiles.accounting
  return profiles.generic
}

export function nicheInstructions(profile:NicheProfile) {
  return [
    'NICHO DETECTADO: '+profile.label,
    'Público: '+profile.audience,
    'Direção visual: '+profile.visualDirection,
    'Hero obrigatório: '+profile.heroDirection,
    profile.preferredContent.length ? 'Conteúdo prioritário: '+profile.preferredContent.join(', ') : '',
    profile.forbiddenContent.length ? 'Conteúdo proibido/incoerente: '+profile.forbiddenContent.join(', ') : '',
    profile.mediaDirection.length ? 'Direção de mídia: '+profile.mediaDirection.join(', ') : '',
    'O resultado deve parecer criado especificamente para este nicho, não um template genérico.',
  ].filter(Boolean).join('\n')
}
