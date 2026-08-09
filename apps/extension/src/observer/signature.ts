export class ObservationSignature {
  #current = "";

  claim(signature: string): boolean {
    if (signature === this.#current) return false;
    this.#current = signature;
    return true;
  }

  retry(signature: string): void {
    if (this.#current !== signature) return;
    this.#current = "";
  }

  reset(): void {
    this.#current = "";
  }
}
