// The onboarding questionnaire, shared by the page (Spanish labels) and the server (the English fact
// sent to Jev for each answer). Answers are words, not numbers: Jev reads meaning better than figures.

export type LevelOption = { id: string; label: string; fact: string }
export type LevelQuestion = { id: LevelQuestionId; label: string; options: LevelOption[] }
export type LevelQuestionId = 'years' | 'frequency' | 'results' | 'tournaments'

export const LEVEL_QUESTIONS: LevelQuestion[] = [
  {
    id: 'years',
    label: '¿Desde cuándo juegas tenis?',
    options: [
      { id: 'new', label: 'Empecé hace poco, menos de un año', fact: 'started playing tennis less than a year ago' },
      { id: 'few', label: 'Hace unos pocos años', fact: 'has played tennis for a few years' },
      { id: 'several', label: 'Hace varios años', fact: 'has played tennis for several years' },
      { id: 'lifelong', label: 'Desde niño o casi toda mi vida', fact: 'has played tennis since childhood, most of their life' },
    ],
  },
  {
    id: 'frequency',
    label: '¿Qué tan seguido juegas?',
    options: [
      { id: 'rarely', label: 'De vez en cuando', fact: 'plays occasionally, less than once a week' },
      { id: 'weekly', label: 'Una vez por semana', fact: 'plays about once a week' },
      { id: 'often', label: 'Varias veces por semana', fact: 'plays several times a week' },
      { id: 'training', label: 'Casi todos los días, con entrenamiento', fact: 'plays almost every day with structured training' },
    ],
  },
  {
    id: 'results',
    label: 'Cuando juegas contra otros jugadores de tu club…',
    options: [
      { id: 'learning', label: 'Todavía estoy aprendiendo a mantener la pelota en juego', fact: 'is still learning to keep rallies going' },
      { id: 'lose_more', label: 'Pierdo más de lo que gano', fact: 'loses more matches than they win against club players' },
      { id: 'even', label: 'Gano y pierdo más o menos parejo', fact: 'wins and loses about evenly against club players' },
      { id: 'win_more', label: 'Gano la mayoría de mis partidos', fact: 'wins most of their matches against club players' },
      { id: 'dominate', label: 'Gano casi siempre, incluso a los más fuertes', fact: 'almost always wins, even against the strongest club players' },
    ],
  },
  {
    id: 'tournaments',
    label: '¿Has jugado torneos?',
    options: [
      { id: 'never', label: 'Nunca', fact: 'has never played a tournament' },
      { id: 'club', label: 'Torneos internos o de club', fact: 'has played internal or club tournaments' },
      { id: 'open', label: 'Torneos abiertos, regionales o nacionales', fact: 'has played open, regional or national amateur tournaments' },
      { id: 'ranked', label: 'Torneos federados, universitarios o internacionales', fact: 'has competed in federation-ranked, college or international tournaments' },
    ],
  },
]

export const SELF_DESCRIPTION_MAX = 300

export type LevelAnswers = Record<LevelQuestionId, string> & { self_description?: string }

export type LevelSuggestion = {
  category_id: string
  name: string
  probability: number
  runner_up: { category_id: string; name: string; probability: number } | null
}
