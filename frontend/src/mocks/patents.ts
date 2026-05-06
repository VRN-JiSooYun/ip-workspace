export interface Patent {
  id: string;
  patentNumber: string;
  title: string;
  applicant: string;
  publicationDate: string;
  target: string;
  status: 'Analyzing' | 'Completed' | 'Pending';
  isFavorite: boolean;
  keyCompoundSmiles: string;
  abstract: string;
}

export const mockPatents: Patent[] = [
  {
    id: '1',
    patentNumber: 'US-2023-0123456-A1',
    title: 'Novel EGFR Inhibitors for the Treatment of Non-Small Cell Lung Cancer',
    applicant: 'Voronoi Bio',
    publicationDate: '2023-05-12',
    target: 'EGFR',
    status: 'Completed',
    isFavorite: true,
    keyCompoundSmiles: 'CN1C=C(C2=C1N=CN=C2NC3=CC(=C(C=C3)N4CCN(CC4)C)OC)C5=CN=CC=C5',
    abstract: 'The present invention relates to novel compounds that inhibit EGFR, pharmaceutical compositions comprising the same, and methods of using the same for treating cancer.',
  },
  {
    id: '2',
    patentNumber: 'WO-2024-9876543-A2',
    title: 'Macrocyclic Compounds as CDK9 Inhibitors',
    applicant: 'Sample Pharma',
    publicationDate: '2024-01-20',
    target: 'CDK9',
    status: 'Analyzing',
    isFavorite: false,
    keyCompoundSmiles: 'CC1=C(C=C(C=C1)C2=CC3=C(C=C2)N=CN=C3NC4=CC=CC=C4)C(=O)N',
    abstract: 'This disclosure provides macrocyclic compounds useful for the inhibition of CDK9 and their use in treating various diseases including oncology.',
  },
  {
    id: '3',
    patentNumber: 'KR-10-2022-0055443',
    title: 'PROTAC Degraders Targeting KRAS G12C',
    applicant: 'Daehun Tech',
    publicationDate: '2022-11-05',
    target: 'KRAS',
    status: 'Completed',
    isFavorite: true,
    keyCompoundSmiles: 'C1CC1N2C=C(C3=C2N=C(N=C3NC4=CC=C(C=C4)F)C5=CC=CC=C5)C6=CC=CC=C6',
    abstract: 'The invention provides bifunctional compounds, which act as PROTACs to degrade KRAS G12C proteins.',
  },
  {
    id: '4',
    patentNumber: 'EP-3948576-B1',
    title: 'JAK3 Selective Inhibitors with Improved Metabolic Stability',
    applicant: 'Global Bio',
    publicationDate: '2023-08-30',
    target: 'JAK3',
    status: 'Pending',
    isFavorite: false,
    keyCompoundSmiles: 'CC(C)N1C=C(C2=C1N=CN=C2NC3=CC=C(C=C3)S(=O)(=O)C)C4=CC=NC=C4',
    abstract: 'Small molecule inhibitors showing high selectivity for JAK3 over other JAK family kinases are disclosed.',
  }
];

export interface ResidueMapping {
  residue: string; // e.g., "Thr790"
  position: number;
  description: string;
  patentMention: string;
}

export const mockResidues: Record<string, ResidueMapping[]> = {
  '1': [
    { residue: 'Thr790', position: 790, description: 'Gatekeeper mutation causing resistance', patentMention: 'Page 12, Line 4: "Resistance due to T790M mutation..."' },
    { residue: 'Cys797', position: 797, description: 'Covalent binding site', patentMention: 'Page 15, Line 10: "The compound forms a covalent bond with Cys797."' },
  ],
  '3': [
    { residue: 'Gly12', position: 12, description: 'Mutation site G12C', patentMention: 'Page 5, Line 2: "Targeting the KRAS G12C mutant protein."' },
  ]
};
