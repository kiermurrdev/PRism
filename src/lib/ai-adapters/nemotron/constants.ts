/**
 * Configuration constants for the Nemotron adapter.
 */

export const NEMOTRON_BASE_URL =
  process.env.NEMOTRON_BASE_URL ?? "https://integrate.api.nvidia.com/v1";

export const NEMOTRON_MODEL =
  process.env.NEMOTRON_MODEL ?? "nvidia/nemotron-nano-12b-8k-instruct";

export const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY;

export const DEFAULT_TIMEOUT_MS = 120_000; // 2 minutes

export const MAX_REPAIR_ATTEMPTS = 1;
