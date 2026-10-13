/**
 * Everything the assistant is allowed to say about the firm and its lawyers.
 * The assistant will ONLY share lawyer details that are listed here.
 * Leave `lawyers` empty until you have real details to publish; the chat will
 * then offer the "Request a consultation" form instead of naming anyone.
 *
 * Bar Council of India rules limit how advocates may publicise themselves,
 * so list only what you are comfortable publishing (name, practice areas,
 * city, languages, how to reach the firm).
 */
export type Lawyer = {
  name: string;
  role?: string;          // e.g. "Advocate"
  areas?: string[];       // e.g. ["Contracts", "Property"]
  city?: string;
  languages?: string[];
  note?: string;
};

export const FIRM = {
  name: "Vidhira Legal",
  website: "https://vidhiralegal.in",
  email: "",      // e.g. "nihaika@vidhiralegal.in"
  phone: "",      // e.g. "+91 98xxxxxxx"
  address: "",
  hours: "",      // e.g. "Mon-Sat, 10am-6pm IST"
  lawyers: [] as Lawyer[],
};

/**
 * Curated notes that sharpen the assistant. Add short, verified facts here
 * (one per line) whenever feedback shows the assistant got something wrong or
 * was too vague. They are added to every conversation.
 */
export const KNOWLEDGE: string[] = [
  "Criminal law: the Indian Penal Code, Code of Criminal Procedure and Indian Evidence Act were replaced from 1 July 2024 by the Bharatiya Nyaya Sanhita (BNS), Bharatiya Nagarik Suraksha Sanhita (BNSS) and Bharatiya Sakshya Adhiniyam (BSA). Offences before that date are still governed by the old codes. Mention both when helpful.",
  "Consumer disputes are governed by the Consumer Protection Act, 2019; complaints go to the District, State or National Commission depending on the claim value, and can be filed online at the e-Daakhil portal.",
  "Free legal aid: the Legal Services Authorities Act, 1987 entitles eligible persons (women, children, SC/ST, persons in custody, low-income earners and others) to free legal services through NALSA and State/District Legal Services Authorities. NALSA helpline: 15100.",
  "Emergency and helplines: Police 112, Women Helpline 181, Child Helpline 1098, National Cyber Crime Helpline 1930 (and cybercrime.gov.in).",
  "RTI: the Right to Information Act, 2005 lets citizens request information from public authorities; the central application fee is Rs 10, with first appeal and then appeal to the Information Commission.",
];
