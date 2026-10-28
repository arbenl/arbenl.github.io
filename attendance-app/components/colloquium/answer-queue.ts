type Snapshot = { answers: Record<string, string | null>; revisions: Record<string, number>; revision: number };
type Saved = { questionRevision: number; revision: number };
/** One writer per question. Remote polling never replaces a local pending choice. */
export class AnswerQueue {
  answers: Record<string, string | null> = {};
  private revisions: Record<string, number> = {};
  private revision = 0;
  private dirty = new Set<string>();
  private running = new Map<string, Promise<void>>();
  private failed = new Set<string>();
  constructor(private save: (question: string, option: string | null, revision: number) => Promise<Saved>, private changed: () => void) {}
  get status() { return this.failed.size ? 'error' : this.dirty.size || this.running.size ? 'saving' : 'saved'; }
  hydrate(snapshot: Snapshot) {
    this.revision = Math.max(this.revision, snapshot.revision);
    for (const question of Object.keys(snapshot.answers)) {
      if ((snapshot.revisions[question] ?? 0) >= (this.revisions[question] ?? 0)) {
        this.revisions[question] = snapshot.revisions[question] ?? 0;
        if (!this.dirty.has(question) && !this.running.has(question)) this.answers[question] = snapshot.answers[question];
      }
    }
  }
  choose(question: string, option: string | null) {
    this.answers[question] = option;
    this.dirty.add(question);
    this.failed.delete(question);
    this.start(question);
    this.changed();
  }
  private start(question: string) {
    if (this.running.has(question)) return;
    const operation = (async () => {
      while (this.dirty.has(question)) {
        const option = this.answers[question];
        try {
          const saved = await this.save(question, option, this.revisions[question] ?? 0);
          this.revisions[question] = Math.max(this.revisions[question] ?? 0, saved.questionRevision);
          this.revision = Math.max(this.revision, saved.revision);
          if (this.answers[question] === option) this.dirty.delete(question);
        } catch {
          this.failed.add(question);
          break;
        }
      }
    })().finally(() => { this.running.delete(question); this.changed(); });
    this.running.set(question, operation);
  }
  async flush() {
    while (this.running.size) await Promise.all([...this.running.values()]);
    if (this.dirty.size) throw new Error('unsaved_answers');
    return this.revision;
  }
  async retry() {
    this.failed.clear();
    for (const question of this.dirty) this.start(question);
    this.changed();
    await this.flush();
  }
}
