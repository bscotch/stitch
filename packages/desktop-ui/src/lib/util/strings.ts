export function pluralize(count: number, singular: string, plural: string) {
  const rules = new Intl.PluralRules('en-US');
  switch (rules.select(count)) {
    case 'one':
      return singular;
    case 'other':
      return plural;
    default:
      throw new Error('Unexpected plural rule');
  }
}
