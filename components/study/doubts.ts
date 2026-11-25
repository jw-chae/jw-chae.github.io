/** "여기서 드는 의문": the objections a careful reader raises after each section, and their answers.
 *  Keyed by section id so the chapter copy files stay untouched. */

export type Doubt = { q: string; a: string[] };
export type Doubts = Record<string, Doubt[]>;
