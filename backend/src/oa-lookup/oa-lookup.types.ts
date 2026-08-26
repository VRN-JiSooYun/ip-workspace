export type OaCountryLookup = {
  id: number;
  country: string;
};

export type OaStatusLookup = {
  id: number;
  status: string;
};

export type OaLookups = {
  countries: OaCountryLookup[];
  examStatuses: OaStatusLookup[];
  legalStatuses: OaStatusLookup[];
};
