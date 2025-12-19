/**
 * Simple Bloom Filter implementation for JWT blacklist
 * Used to efficiently track revoked/blacklisted tokens
 */

import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

export class BloomFilter {
  private bits: Uint8Array;
  private size: number;
  private hashCount: number;

  constructor(size: number = 10000, hashCount: number = 3) {
    this.size = size * 8; // Convert to bits
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
    this.hashCount = hashCount;
  }

  /**
   * Generate hash values for an item using multiple hash functions
   */
  private async getHashes(item: string): Promise<number[]> {
    const hashes: number[] = [];
    const encoder = new TextEncoder();
    const data = encoder.encode(item);

    for (let i = 0; i < this.hashCount; i++) {
      const hashInput = encoder.encode(item + i.toString());
      const hashBuffer = await crypto.subtle.digest("SHA-256", hashInput);
      const view = new DataView(hashBuffer);
      const hash = view.getUint32(0, true);
      hashes.push(Math.abs(hash) % this.size);
    }

    return hashes;
  }

  /**
   * Add an item to the Bloom filter
   */
  async add(item: string): Promise<void> {
    const hashes = await this.getHashes(item);
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      this.bits[byteIndex] |= 1 << bitIndex;
    }
  }

  /**
   * Check if an item might be in the Bloom filter
   * Returns true if item is definitely in the set or might be (false positives possible)
   * Returns false only if item is definitely not in the set
   */
  async contains(item: string): Promise<boolean> {
    const hashes = await this.getHashes(item);
    for (const hash of hashes) {
      const byteIndex = Math.floor(hash / 8);
      const bitIndex = hash % 8;
      if ((this.bits[byteIndex] & (1 << bitIndex)) === 0) {
        return false; // Definitely not in the set
      }
    }
    return true; // Might be in the set
  }

  /**
   * Clear all bits (reset the filter)
   */
  clear(): void {
    this.bits.fill(0);
  }

  /**
   * Get current filter size info
   */
  getStats(): { size: number; hashCount: number; byteArraySize: number } {
    return {
      size: this.size,
      hashCount: this.hashCount,
      byteArraySize: this.bits.length,
    };
  }
}

// Global blacklist instance
export const tokenBlacklist = new BloomFilter(10000, 3);
