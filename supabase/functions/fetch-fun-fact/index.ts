import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback facts related to: mythology, philosophy, religion, arts, psychology
const themedFacts = [
  "Na mitologia nórdica, Odin sacrificou um de seus olhos para beber da fonte de Mimir e obter sabedoria infinita.",
  "O mito de Sísifo, condenado a empurrar uma pedra morro acima eternamente, inspirou Albert Camus a escrever sobre o absurdo da existência.",
  "Na mitologia grega, Prometeu roubou o fogo dos deuses para dar aos humanos, sendo punido eternamente por isso.",
  "O Minotauro, criatura meio homem meio touro, vivia no labirinto construído por Dédalo em Creta.",
  "Na mitologia egípcia, o coração do morto era pesado contra a pena de Maat para determinar seu destino no além.",
  "Segundo a mitologia japonesa, o arquipélago foi criado quando gotas de água salgada caíram da lança do deus Izanagi.",
  "O mito da Fênix, ave que renasce das próprias cinzas, aparece em diversas culturas antigas independentemente.",
  "Sócrates nunca escreveu nada. Tudo que sabemos sobre ele vem dos escritos de seus discípulos, principalmente Platão.",
  "O 'Cogito, ergo sum' (Penso, logo existo) de Descartes foi escrito originalmente em francês, não em latim.",
  "Nietzsche colapsou mentalmente ao ver um cavalo sendo chicoteado em Turim, abraçando o animal em prantos.",
  "Diógenes, o filósofo cínico, vivia em um barril e andava com uma lanterna de dia procurando 'um homem honesto'.",
  "Aristóteles foi tutor de Alexandre, o Grande, influenciando um dos maiores conquistadores da história.",
  "Kant seguia uma rotina tão precisa que os moradores de Königsberg acertavam seus relógios por seus passeios diários.",
  "Spinoza foi excomungado da comunidade judaica por suas ideias filosóficas consideradas heréticas.",
  "O Vaticano tem a maior biblioteca privada do mundo, com mais de 1,6 milhão de livros impressos.",
  "O budismo é a única grande religião mundial que não tem um conceito de deus criador.",
  "A Bíblia foi o primeiro livro impresso por Gutenberg, marcando o início da era da imprensa.",
  "O islamismo, cristianismo e judaísmo compartilham o mesmo patriarca: Abraão.",
  "O hinduísmo não tem um fundador único, sendo considerada a religião organizada mais antiga do mundo.",
  "O Monte Athos, na Grécia, abriga 20 monastérios ortodoxos e proíbe a entrada de mulheres há mais de mil anos.",
  "A Cabala, tradição mística judaica, influenciou profundamente o pensamento esotérico ocidental.",
  "Leonardo da Vinci escrevia da direita para a esquerda, criando textos que só podiam ser lidos com um espelho.",
  "Van Gogh vendeu apenas uma pintura durante toda sua vida: 'O Vinhedo Vermelho'.",
  "Michelangelo pintou o teto da Capela Sistina deitado de costas em andaimes, não de pé como muitos imaginam.",
  "A Mona Lisa não tem sobrancelhas porque era moda na Renascença italiana raspar os pelos faciais.",
  "Beethoven compôs suas obras mais importantes quando já estava completamente surdo.",
  "O 'Grito' de Edvard Munch foi inspirado por um pôr do sol vermelho causado pela erupção do vulcão Krakatoa.",
  "Shakespeare inventou mais de 1.700 palavras que usamos até hoje em inglês.",
  "Freud tinha fobia de samambaias e do número 62, acreditando que morreria aos 62 anos.",
  "O efeito placebo funciona mesmo quando o paciente sabe que está tomando um placebo.",
  "Carl Jung criou o conceito de 'inconsciente coletivo' após estudar mitologias de diferentes culturas.",
  "A síndrome de Estocolmo foi nomeada após um assalto a banco em 1973 onde reféns defenderam seus captores.",
  "O experimento do marshmallow de Stanford mostrou que autocontrole na infância prevê sucesso na vida adulta.",
  "Estudos mostram que o cérebro humano não consegue distinguir entre memórias reais e imaginárias vívidas.",
  "A teoria das cores de Goethe influenciou tanto a arte quanto a psicologia da percepção visual.",
];

// Get today's date string for consistent daily fact
function getTodayDateString(): string {
  const today = new Date();
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`;
}

// Generate a consistent hash from date string
function hashDateToIndex(dateString: string, maxIndex: number): number {
  let hash = 0;
  for (let i = 0; i < dateString.length; i++) {
    const char = dateString.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % maxIndex;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const dateString = getTodayDateString();
    console.log('[FunFact] Fetching fact for date:', dateString);

    // Try RapidAPI World Fun Facts first
    const rapidApiKey = Deno.env.get('RAPIDAPI_KEY');
    
    if (rapidApiKey) {
      try {
        console.log('[FunFact] Attempting RapidAPI World Fun Facts...');
        
        const response = await fetch('https://world-fun-facts-all-languages-support.p.rapidapi.com/fact.php?lang=pt', {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'world-fun-facts-all-languages-support.p.rapidapi.com'
          }
        });

        console.log('[FunFact] RapidAPI response status:', response.status);

        if (response.ok) {
          const data = await response.json();
          console.log('[FunFact] RapidAPI response data:', JSON.stringify(data));
          
          // The API returns { fact: "..." } or similar structure
          const fact = data.fact || data.text || data.data?.fact;
          
          if (fact && typeof fact === 'string' && fact.length > 0) {
            console.log('[FunFact] Successfully got fact from RapidAPI');
            return new Response(JSON.stringify({ 
              fact: { 
                fact: fact,
                date: dateString,
                source: 'rapidapi'
              } 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        }
        
        console.log('[FunFact] RapidAPI failed or returned invalid data, falling back to curated list');
      } catch (apiError) {
        console.error('[FunFact] RapidAPI error:', apiError);
      }
    } else {
      console.log('[FunFact] No RAPIDAPI_KEY found, using curated list');
    }

    // Fallback to curated themed facts
    const factIndex = hashDateToIndex(dateString, themedFacts.length);
    const todaysFact = themedFacts[factIndex];

    console.log('[FunFact] Using curated fact, index:', factIndex);

    return new Response(JSON.stringify({ 
      fact: { 
        fact: todaysFact,
        date: dateString,
        source: 'curated'
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[FunFact] Error:', error);
    
    // Ultimate fallback
    return new Response(JSON.stringify({ 
      fact: { 
        fact: themedFacts[0],
        date: 'fallback',
        source: 'fallback'
      } 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
