export type SortMode = 'default' | 'active' | 'recent';
export type ConversationTypeFilter = 'all' | 'free' | 'paid' | 'charity';

export interface PeopleSearchFilters {
  onlineOnly: boolean;
  conversationType: ConversationTypeFilter;
  sort: SortMode;
}

export const DEFAULT_PEOPLE_SEARCH_FILTERS: PeopleSearchFilters = {
  onlineOnly: true,
  conversationType: 'all',
  sort: 'active'
};
