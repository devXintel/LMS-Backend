module.exports = {
  /**
   * Extract a transcript from a video URL.
   * Currently returns an empty string – replace with real implementation when needed.
   */
  async extractTranscript(videoUrl) {
    // TODO: integrate with a video‑to‑text provider (e.g., Google Video AI, Whisper, etc.)
    console.log(`[Video Service] Extracting transcript for ${videoUrl} (STUB)`);
    return '';
  },
};
