export interface TrashItem {
  id: string;
  name: string;
  note: string;
}

// Edit these names and one-line stories to change what is in Kooda.
export const items: readonly TrashItem[] = [
  { id: 'final', name: 'final_final_v7.txt', note: 'The final version, until the next final version.' },
  { id: 'weekend', name: 'weekend-plan.txt', note: 'A quiet weekend, interrupted by a small side project.' },
  { id: 'rewrite', name: 'quick-rewrite.txt', note: 'It was only going to take an afternoon.' },
  { id: 'tabs', name: 'all-those-tabs.txt', note: 'Every tab was important. None of them were remembered.' },
  { id: 'domain', name: 'another-domain.txt', note: 'A very good name for a project that does not exist yet.' },
  { id: 'todo', name: 'todo-tomorrow.txt', note: 'Tomorrow has been carrying this one for a while.' },
];

export const TRASH_DATA_KEY = 'trash:index';
