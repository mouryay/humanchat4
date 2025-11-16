export const normalizeRequestedName = (value: string): string => {
  if (!value) return '';
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase()
    .trim();
};
