import { Highlight } from "react-pdf-highlighter-plus";

export interface PatentHighlight extends Highlight {
  targetId?: string; // residue name or compound ID
  comment?: string;
}

export const mockHighlights: Record<string, PatentHighlight[]> = {};
