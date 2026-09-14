/* Catálogo de equipe, categorias e serviços — fonte única usada pelo site
   (index.html) e pelo painel (painel.html, no agendamento manual), para os
   dois nunca ficarem com preços/duração desencontrados. */

/* ---- EQUIPE (multiprofissional). cats = categorias que a profissional atende ---- */
/* Hoje a Simone atende sozinha. Se um dia entrar mais alguém, é só acrescentar aqui
   ({id, nome, papel, cats}) — o passo "Profissional" reaparece sozinho no agendamento. */
const PROFS = [
  {id:"simone", nome:"Simone", papel:"Esteticista responsável · +7 anos de experiência",
   foto:"fotos/simone.jpg",   // sem foto, o card mostra a inicial num círculo
   cats:["facial","corporal","terapias","laser","cera"]}
];

/* ---- CATEGORIAS ---- */
const CATS = [
  {id:"facial",   nome:"Estética Facial",     tab:"Facial",   sub:"Limpezas, peelings, microagulhamento e protocolos de rejuvenescimento com avaliação individual."},
  {id:"corporal", nome:"Estética Corporal",   tab:"Corporal", sub:"Drenagem, modelagem, clareamentos e tratamentos dermatofuncionais para pele e contorno."},
  {id:"terapias", nome:"Massagens & Terapias",tab:"Massagens",sub:"Relaxamento, ventosaterapia, pedras quentes e terapias integrativas."},
  {id:"laser",    nome:"Depilação a Laser",   tab:"Laser",    sub:"Tecnologia de alta potência, sessões rápidas e resultado progressivo. Protocolos femininos e masculinos."},
  {id:"cera",     nome:"Depilação a Cera",    tab:"Cera",     sub:"Cera quente e roll-on descartável, aplicada por profissional especializada."}
];

/* ---- SERVIÇOS ----
   min = duração em minutos | preco = R$ | ap = "a partir de" | foto = "" (troque pela URL da sua foto quadrada)
*/
const SERVICES = [
/* ---------------- FACIAL ---------------- */
{id:"limpeza-de-pele-premium",cat:"facial",nome:"Limpeza de pele Premium",min:60,preco:150,desc:"Higienização profunda, extração, alta frequência e máscara calmante.",foto:""},
{id:"limpeza-de-pele-glow",cat:"facial",nome:"Limpeza de pele Glow",min:90,preco:200,desc:"Limpeza completa com ativos iluminadores e finalização de brilho imediato.",foto:""},
{id:"peeling",cat:"facial",nome:"Peeling",min:60,preco:150,desc:"Renovação celular para manchas, textura irregular e falta de viço.",foto:""},
{id:"microagulhamento",cat:"facial",nome:"Microagulhamento",min:60,preco:200,ap:true,desc:"Indução de colágeno para cicatrizes, poros e flacidez. Valor conforme área.",foto:""},
{id:"microagulhamento-sem-agulhas",cat:"facial",nome:"Microagulhamento sem agulhas",min:60,preco:150,desc:"Permeação de ativos sem downtime, indolor e sem descamação.",foto:""},
{id:"revitalizacao-facial",cat:"facial",nome:"Revitalização facial",min:40,preco:80,desc:"Hidratação intensa e nutrição para pele cansada. Ótimo antes de eventos.",foto:""},
{id:"tratamento-rejuvenescimento",cat:"facial",nome:"Tratamento Rejuvenescimento",min:60,preco:100,desc:"Firmeza e linhas finas: protocolo com ativos tensores e estímulo de colágeno.",foto:""},
{id:"tratamento-rosacea",cat:"facial",nome:"Tratamento Rosácea",min:60,preco:90,desc:"Controle de vermelhidão e sensibilidade com ativos calmantes.",foto:""},
{id:"tratamento-acne",cat:"facial",nome:"Tratamento Acne",min:60,preco:90,desc:"Controle de oleosidade, extração cuidadosa e ação anti-inflamatória.",foto:""},
{id:"hydra-gloss-lips",cat:"facial",nome:"Hydra Gloss Lips",min:50,preco:100,desc:"Hidratação profunda dos lábios com efeito volumizado e brilho natural.",foto:""},
{id:"rinomodelagem",cat:"facial",nome:"Rinomodelagem",min:60,preco:200,desc:"Harmonização do nariz sem cirurgia, com avaliação prévia.",foto:"",profs:["bella"]},

/* ---------------- CORPORAL ---------------- */
{id:"drenagem-linfatica",cat:"corporal",nome:"Drenagem linfática",min:60,preco:110,desc:"Manobras que reduzem retenção de líquido, inchaço e sensação de peso.",foto:""},
{id:"detox-corporal",cat:"corporal",nome:"Detox corporal",min:60,preco:100,desc:"Esfoliação, ativos drenantes e bandagem para desintoxicar e desinchar.",foto:""},
{id:"esfoliacao-corporal",cat:"corporal",nome:"Esfoliação corporal",min:60,preco:80,desc:"Remove células mortas e deixa a pele lisa, uniforme e preparada.",foto:""},
{id:"banho-de-lua-bracos",cat:"corporal",nome:"Banho de lua (braços)",min:45,preco:60,desc:"Esfoliação, clareamento dos pelos e hidratação dos braços.",foto:""},
{id:"banho-de-lua-pernas",cat:"corporal",nome:"Banho de lua (pernas)",min:60,preco:95,desc:"Pernas mais claras, macias e uniformes com efeito imediato.",foto:""},
{id:"banho-de-lua-completo",cat:"corporal",nome:"Banho de lua (braços e pernas)",min:100,preco:140,desc:"Protocolo completo de clareamento e hidratação. Melhor custo-benefício.",foto:""},
{id:"gessoterapia",cat:"corporal",nome:"Gessoterapia",min:60,preco:120,desc:"Bandagem com efeito térmico para contorno corporal e medidas.",foto:""},
{id:"liporedux",cat:"corporal",nome:"Liporedux",min:45,preco:70,desc:"Protocolo redutor localizado com ativos lipolíticos.",foto:""},
{id:"massagem-modeladora",cat:"corporal",nome:"Massagem modeladora",min:60,preco:130,desc:"Manobras vigorosas para gordura localizada e contorno corporal.",foto:""},
{id:"aplicacao-de-enzimas",cat:"corporal",nome:"Aplicação de enzimas",min:60,preco:150,ap:true,desc:"Enzimas para gordura localizada e flacidez. Valor conforme área e protocolo.",foto:"",profs:["bella"]},
{id:"secagem-de-vasinhos",cat:"corporal",nome:"Secagem de vasinhos",min:60,preco:130,ap:true,desc:"Tratamento de microvasos nas pernas. Valor conforme extensão da área.",foto:"",profs:["bella"]},
{id:"clareamento-axilas",cat:"corporal",nome:"Clareamento de axilas",min:40,preco:70,desc:"Uniformiza o tom das axilas com ativos clareadores seguros.",foto:""},
{id:"clareamento-intimo",cat:"corporal",nome:"Clareamento íntimo",min:40,preco:80,desc:"Clareamento da região íntima com produtos específicos e sigilo total.",foto:""},
{id:"tratamento-foliculite",cat:"corporal",nome:"Tratamento de foliculite",min:40,preco:80,desc:"Reduz pelos encravados, vermelhidão e inflamação após a depilação.",foto:""},
{id:"manchas-solares-maos",cat:"corporal",nome:"Tratamento de manchas solares (mãos)",min:30,preco:80,desc:"Clareamento das manchas de sol no dorso das mãos.",foto:""},

/* ---------------- MASSAGENS & TERAPIAS ---------------- */
{id:"massagem-relaxante-60",cat:"terapias",nome:"Massagem relaxante (1h)",min:60,preco:100,desc:"Alivia tensão, estresse e dores musculares. Óleos aromáticos inclusos.",foto:""},
{id:"massagem-relaxante-30",cat:"terapias",nome:"Massagem relaxante (30min)",min:30,preco:55,desc:"Sessão express focada em pescoço, ombros e costas.",foto:""},
{id:"pedras-quentes",cat:"terapias",nome:"Pedras quentes",min:60,preco:120,desc:"Calor terapêutico que relaxa profundamente a musculatura.",foto:""},
{id:"ventosaterapia",cat:"terapias",nome:"Ventosaterapia",min:50,preco:100,desc:"Ventosas para circulação, dores nas costas e liberação miofascial.",foto:""},
{id:"relaxante-e-ventosa",cat:"terapias",nome:"Relaxante + ventosaterapia",min:60,preco:120,desc:"O melhor dos dois: massagem relaxante combinada com ventosas.",foto:""},
{id:"escalda-pes",cat:"terapias",nome:"Escalda pés com massagem",min:40,preco:65,desc:"Imersão aromática quente com massagem nos pés. Puro descanso.",foto:""},
{id:"acupuntura-auricular",cat:"terapias",nome:"Acupuntura auricular",min:30,preco:60,desc:"Pontos auriculares para ansiedade, sono, compulsão alimentar e dores.",foto:""},

/* ---------------- LASER — FEMININO ---------------- */
{id:"laser-buco",cat:"laser",sub:"Feminina",nome:"Laser buço",min:20,preco:50,desc:"Sessão rápida e praticamente indolor no buço.",foto:""},
{id:"laser-queixo-buco",cat:"laser",sub:"Feminina",nome:"Laser queixo + buço",min:30,preco:85,desc:"Combo de face inferior com economia na sessão.",foto:""},
{id:"laser-rosto",cat:"laser",sub:"Feminina",nome:"Laser rosto",min:35,preco:100,desc:"Buço, queixo e laterais do rosto, com resultado progressivo a cada sessão.",foto:""},
{id:"laser-axilas",cat:"laser",sub:"Feminina",nome:"Laser axilas",min:25,preco:80,desc:"Adeus lâmina: pele lisa e sem manchas por atrito.",foto:""},
{id:"laser-faixa-umbigo",cat:"laser",sub:"Feminina",nome:"Laser faixa do umbigo",min:15,preco:25,desc:"Linha alba tratada em poucos minutos.",foto:""},
{id:"laser-gluteos",cat:"laser",sub:"Feminina",nome:"Laser glúteos",min:25,preco:70,desc:"Remoção dos pelos da região glútea com conforto.",foto:""},
{id:"laser-perianal",cat:"laser",sub:"Feminina",nome:"Laser perianal",min:25,preco:60,desc:"Higiene e conforto, com total privacidade.",foto:""},
{id:"laser-virilha-simples",cat:"laser",sub:"Feminina",nome:"Laser virilha simples",min:25,preco:140,desc:"Contorno da linha do biquíni.",foto:""},
{id:"laser-virilha-cavada",cat:"laser",sub:"Feminina",nome:"Laser virilha cavada",min:30,preco:150,desc:"Vai além da linha do biquíni, mantendo o centro.",foto:""},
{id:"laser-virilha-completa",cat:"laser",sub:"Feminina",nome:"Laser virilha completa",min:30,preco:160,desc:"Remoção total da região íntima.",foto:""},
{id:"laser-meia-perna",cat:"laser",sub:"Feminina",nome:"Laser meia perna",min:30,preco:100,desc:"Do joelho ao tornozelo, sessão confortável.",foto:""},
{id:"laser-perna-inteira",cat:"laser",sub:"Feminina",nome:"Laser perna inteira",min:40,preco:200,desc:"Pernas completas, resultado progressivo sessão a sessão.",foto:""},
{id:"laser-bracos",cat:"laser",sub:"Feminina",nome:"Laser braços",min:30,preco:130,desc:"Braços completos, sem irritação e sem encravados.",foto:""},
{id:"laser-combo-axila-buco",cat:"laser",sub:"Feminina",nome:"Combo laser axila + buço",min:25,preco:110,desc:"Duas áreas na mesma sessão com desconto.",foto:""},
{id:"laser-combo-virilha-axila",cat:"laser",sub:"Feminina",nome:"Combo laser virilha + axila",min:40,preco:220,desc:"As duas áreas mais pedidas, juntas e mais em conta.",foto:""},
{id:"laser-combo-virilha-axila-meia-perna",cat:"laser",sub:"Feminina",nome:"Combo laser virilha + axila + meia perna",min:60,preco:330,desc:"Combo campeão de vendas: economia real por sessão.",foto:""},

/* ---------------- LASER — MASCULINO ---------------- */
{id:"laser-masc-barba",cat:"laser",sub:"Masculina",nome:"Laser masculina barba",min:25,preco:140,desc:"Desenho de barba e fim da foliculite no pescoço.",foto:""},
{id:"laser-masc-axilas",cat:"laser",sub:"Masculina",nome:"Laser masculina axilas",min:25,preco:90,desc:"Menos suor aparente e mais conforto no dia a dia.",foto:""},
{id:"laser-masc-peito",cat:"laser",sub:"Masculina",nome:"Laser masculina peito",min:25,preco:110,desc:"Redução ou remoção total dos pelos do tórax.",foto:""},
{id:"laser-masc-abdomen",cat:"laser",sub:"Masculina",nome:"Laser masculina abdômen",min:30,preco:110,desc:"Abdômen definido sem lâmina nem irritação.",foto:""},
{id:"laser-masc-costas",cat:"laser",sub:"Masculina",nome:"Laser masculina costas",min:30,preco:180,desc:"Área ampla resolvida em uma sessão rápida.",foto:""},
{id:"laser-masc-bracos",cat:"laser",sub:"Masculina",nome:"Laser masculina braços",min:30,preco:160,desc:"Redução de volume de pelos com naturalidade.",foto:""},
{id:"laser-masc-meia-perna",cat:"laser",sub:"Masculina",nome:"Laser masculina meia perna",min:25,preco:130,desc:"Ideal para quem pratica esportes e ciclismo.",foto:""},
{id:"laser-masc-perna-inteira",cat:"laser",sub:"Masculina",nome:"Laser masculina perna inteira",min:30,preco:230,desc:"Pernas completas com aplicador de alta cobertura.",foto:""},

/* ---------------- CERA — FEMININO ---------------- */
{id:"cera-buco",cat:"cera",sub:"Feminina",nome:"Cera buço",min:20,preco:30,desc:"Cera quente com finalização calmante.",foto:""},
{id:"cera-rosto",cat:"cera",sub:"Feminina",nome:"Cera rosto",min:40,preco:50,desc:"Buço, queixo e laterais do rosto.",foto:""},
{id:"cera-nariz-orelha",cat:"cera",sub:"Feminina",nome:"Cera nariz ou orelha",min:20,preco:30,desc:"Remoção rápida e segura com cera específica.",foto:""},
{id:"cera-axilas",cat:"cera",sub:"Feminina",nome:"Cera axilas",min:30,preco:40,desc:"Cera quente, menos dor e menos encravados.",foto:""},
{id:"cera-bracos",cat:"cera",sub:"Feminina",nome:"Cera braços",min:60,preco:90,desc:"Braços completos com hidratação pós-depilação.",foto:""},
{id:"cera-faixa-umbigo",cat:"cera",sub:"Feminina",nome:"Cera faixa de umbigo",min:20,preco:20,desc:"Linha do umbigo, rapidinho.",foto:""},
{id:"cera-meia-perna",cat:"cera",sub:"Feminina",nome:"Cera meia perna",min:40,preco:65,desc:"Do joelho ao pé, pele lisa por semanas.",foto:""},
{id:"cera-perna-inteira",cat:"cera",sub:"Feminina",nome:"Cera perna inteira",min:60,preco:110,desc:"Pernas completas com cera quente premium.",foto:""},
{id:"cera-virilha-simples",cat:"cera",sub:"Feminina",nome:"Cera virilha simples",min:40,preco:65,desc:"Contorno da linha do biquíni.",foto:""},
{id:"cera-virilha-cavada",cat:"cera",sub:"Feminina",nome:"Cera virilha cavada",min:45,preco:80,desc:"Cavada, mantendo o centro.",foto:""},
{id:"cera-virilha-completa",cat:"cera",sub:"Feminina",nome:"Cera virilha completa",min:60,preco:90,desc:"Remoção total, com cera de baixa temperatura.",foto:""},
{id:"cera-gluteos",cat:"cera",sub:"Feminina",nome:"Cera glúteos",min:40,preco:50,desc:"Região glútea completa.",foto:""},
{id:"cera-perianal",cat:"cera",sub:"Feminina",nome:"Cera perianal",min:30,preco:50,desc:"Higiene e conforto, com total privacidade.",foto:""},

/* ---------------- CERA — MASCULINO ---------------- */
{id:"cera-masc-axilas",cat:"cera",sub:"Masculina",nome:"Cera masculina axilas",min:40,preco:60,desc:"Cera quente masculina com pós-calmante.",foto:""},
{id:"cera-masc-peito",cat:"cera",sub:"Masculina",nome:"Cera masculina peito",min:60,preco:70,desc:"Tórax completo, resultado imediato.",foto:""},
{id:"cera-masc-abdomen",cat:"cera",sub:"Masculina",nome:"Cera masculina abdômen",min:60,preco:70,desc:"Abdômen completo com cera específica para pelo grosso.",foto:""},
{id:"cera-masc-costas",cat:"cera",sub:"Masculina",nome:"Cera masculina costas",min:60,preco:140,desc:"Costas inteiras, incluindo lombar.",foto:""},
{id:"cera-masc-bracos",cat:"cera",sub:"Masculina",nome:"Cera masculina braços",min:60,preco:140,desc:"Braços completos com finalização hidratante.",foto:""},
{id:"cera-masc-meia-perna",cat:"cera",sub:"Masculina",nome:"Cera masculina meia perna",min:60,preco:100,desc:"Do joelho ao pé — favorito de ciclistas.",foto:""},
{id:"cera-masc-perna-inteira",cat:"cera",sub:"Masculina",nome:"Cera masculina perna inteira",min:120,preco:190,desc:"Pernas completas em sessão única.",foto:""},
{id:"cera-masc-dedos",cat:"cera",sub:"Masculina",nome:"Cera masculina dedos (pés e mãos)",min:30,preco:50,desc:"Detalhe que faz diferença no acabamento.",foto:""}
];
