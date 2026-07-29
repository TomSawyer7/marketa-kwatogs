import type { ReactNode } from "react";

export type LegalSection = {
  id: string;
  title: string;
  body: ReactNode;
};

export type LegalDoc = {
  title: string;
  intro: ReactNode;
  sections: LegalSection[];
};
