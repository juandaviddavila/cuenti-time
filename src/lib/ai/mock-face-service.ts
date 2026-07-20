import { sleep, randomBetween } from "@/lib/utils";
import type {
  IFaceService,
  FaceValidationResult,
  LivenessResult,
  FaceEmbedding,
  FaceComparisonResult,
} from "./types";

/**
 * Mock implementation of IFaceService.
 * Simulates AI facial recognition with realistic delays and scores.
 * Replace this with a real provider (Azure Face API, AWS Rekognition, etc.)
 * by implementing IFaceService.
 */
export class MockFaceService implements IFaceService {
  private readonly successRate = 0.85; // 85% success rate in simulation

  async validateFace(_imageData: string): Promise<FaceValidationResult> {
    await sleep(randomBetween(800, 1500));

    const hasImage = _imageData && _imageData.length > 100;
    const isSuccess = Math.random() < this.successRate;

    if (!hasImage) {
      return {
        isValid: false,
        faceDetected: false,
        multipleFaces: false,
        confidenceScore: 0,
        livenessScore: 0,
        antiSpoofingPassed: false,
        quality: { illumination: 0, blur: 0, pose: 0, occlusion: 0 },
        reason: "No image data provided",
      };
    }

    if (!isSuccess) {
      const reasons = [
        "Face not clearly visible",
        "Poor lighting conditions",
        "Face partially occluded",
        "Image too blurry",
      ];
      return {
        isValid: false,
        faceDetected: Math.random() > 0.3,
        multipleFaces: Math.random() > 0.8,
        confidenceScore: randomBetween(0.1, 0.5),
        livenessScore: randomBetween(0.1, 0.5),
        antiSpoofingPassed: false,
        quality: {
          illumination: randomBetween(0.1, 0.4),
          blur: randomBetween(0.1, 0.4),
          pose: randomBetween(0.1, 0.4),
          occlusion: randomBetween(0.5, 0.9),
        },
        reason: reasons[Math.floor(Math.random() * reasons.length)],
      };
    }

    return {
      isValid: true,
      faceDetected: true,
      multipleFaces: false,
      confidenceScore: randomBetween(0.82, 0.99),
      livenessScore: randomBetween(0.78, 0.98),
      antiSpoofingPassed: true,
      quality: {
        illumination: randomBetween(0.75, 0.98),
        blur: randomBetween(0.8, 0.99),
        pose: randomBetween(0.8, 0.99),
        occlusion: randomBetween(0.02, 0.1),
      },
    };
  }

  async detectLiveness(_imageData: string): Promise<LivenessResult> {
    await sleep(randomBetween(1000, 2000));

    const passed = Math.random() < 0.88;
    return {
      passed,
      score: passed ? randomBetween(0.78, 0.99) : randomBetween(0.1, 0.55),
      method: "blink",
      details: passed
        ? "Liveness confirmed via blink detection"
        : "Liveness check failed — possible spoofing attempt",
    };
  }

  async compareFace(
    _embedding1: number[],
    _embedding2: number[]
  ): Promise<FaceComparisonResult> {
    await sleep(randomBetween(300, 700));

    // Simulate cosine distance between embeddings
    const threshold = 0.6;
    const distance = randomBetween(0.05, 0.9);
    const confidenceScore = Math.max(0, 1 - distance / threshold);

    return {
      match: distance < threshold,
      confidenceScore,
      threshold,
      distance,
    };
  }

  async registerFaceEmbedding(_imageData: string): Promise<FaceEmbedding> {
    await sleep(randomBetween(1200, 2500));

    // Generate a mock 512-dimension embedding vector
    const vector = Array.from({ length: 512 }, () =>
      parseFloat((Math.random() * 2 - 1).toFixed(6))
    );

    return {
      id: `embed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      vector,
      modelVersion: "mock-v1.0",
      createdAt: new Date().toISOString(),
    };
  }

  async getValidationScore(_imageData: string): Promise<number> {
    await sleep(randomBetween(200, 500));
    return randomBetween(0.6, 0.99);
  }
}

// Singleton instance — replace with real provider when ready
export const faceService: IFaceService = new MockFaceService();
