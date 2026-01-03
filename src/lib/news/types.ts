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
  mitologia: { color: 'hsl(210, 100%, 56%)', bgClass: 'bg-blue-500/10', textClass: 'text-blue-500', borderClass: 'border-blue-500', label: 'Mitologia' },
  filosofia: { color: 'hsl(39, 100%, 50%)', bgClass: 'bg-orange-500/10', textClass: 'text-orange-500', borderClass: 'border-orange-500', label: 'Filosofia' },
  religiao: { color: 'hsl(0, 0%, 50%)', bgClass: 'bg-gray-500/10', textClass: 'text-gray-500', borderClass: 'border-gray-500', label: 'Religião' },
  artes: { color: 'hsl(330, 100%, 71%)', bgClass: 'bg-pink-400/10', textClass: 'text-pink-400', borderClass: 'border-pink-400', label: 'Artes' },
  psicologia: { color: 'hsl(120, 61%, 50%)', bgClass: 'bg-green-500/10', textClass: 'text-green-500', borderClass: 'border-green-500', label: 'Psicologia' },
} as const;

export function getTopicStyle(topic: Topic) {
  return topicStyles[topic];
}
