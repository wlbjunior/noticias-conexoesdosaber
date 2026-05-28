export type Topic = 'mitologia' | 'filosofia' | 'religiao' | 'artes' | 'psicologia';

export interface NewsItem {
  id: string;
  topic: Topic;
  title: string;
  description?: string | null;
  source_name?: string | null;
  source_url: string;
  full_article_url?: string | null;
  published_at: string;
  fetched_at: string;
  image_url?: string | null;
  created_at?: string;
}

export const TOPICS: Topic[] = ['mitologia', 'filosofia', 'religiao', 'artes', 'psicologia'];

export const topicStyles = {
  mitologia: {
    color: 'hsl(230, 70%, 30%)',
    bgClass: 'bg-mitologia/10',
    solidBgClass: 'bg-mitologia',
    textClass: 'text-mitologia',
    borderClass: 'border-mitologia',
    gradientClass: 'gradient-mitologia',
    shadowClass: 'shadow-glow-mitologia',
    label: 'Mitologia',
    icon: '⚡'
  },
  filosofia: {
    color: 'hsl(35, 85%, 35%)',
    bgClass: 'bg-filosofia/10',
    solidBgClass: 'bg-filosofia',
    textClass: 'text-filosofia',
    borderClass: 'border-filosofia',
    gradientClass: 'gradient-filosofia',
    shadowClass: 'shadow-glow-filosofia',
    label: 'Filosofia',
    icon: '💭'
  },
  religiao: {
    color: 'hsl(250, 50%, 32%)',
    bgClass: 'bg-religiao/10',
    solidBgClass: 'bg-religiao',
    textClass: 'text-religiao',
    borderClass: 'border-religiao',
    gradientClass: 'gradient-religiao',
    shadowClass: 'shadow-glow-religiao',
    label: 'Religião',
    icon: '⛪'
  },
  artes: {
    color: 'hsl(340, 70%, 35%)',
    bgClass: 'bg-artes/10',
    solidBgClass: 'bg-artes',
    textClass: 'text-artes',
    borderClass: 'border-artes',
    gradientClass: 'gradient-artes',
    shadowClass: 'shadow-glow-artes',
    label: 'Artes',
    icon: '🎨'
  },
  psicologia: {
    color: 'hsl(160, 65%, 25%)',
    bgClass: 'bg-psicologia/10',
    solidBgClass: 'bg-psicologia',
    textClass: 'text-psicologia',
    borderClass: 'border-psicologia',
    gradientClass: 'gradient-psicologia',
    shadowClass: 'shadow-glow-psicologia',
    label: 'Psicologia',
    icon: '🧠'
  },
} as const;

export type TopicStyle = typeof topicStyles[Topic];

export function getTopicStyle(topic: Topic): TopicStyle {
  return topicStyles[topic];
}
